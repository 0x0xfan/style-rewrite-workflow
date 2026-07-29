"""
项目知识检索器
调用 xianyu-knowledge-writer API 检索项目知识
"""

import importlib.util
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone


class KnowledgeRetrievalError(RuntimeError):
    """Raised when the mandatory knowledge input cannot be retrieved safely."""


class KnowledgeRetriever:
    """项目知识检索器"""

    def __init__(self, knowledge_api_path: str):
        """
        初始化知识检索器

        Args:
            knowledge_api_path: knowledge_api.py 的路径
        """
        if not isinstance(knowledge_api_path, str) or not knowledge_api_path.strip():
            raise ValueError("缺少必需配置: knowledge_api_path")

        self.api_path = Path(knowledge_api_path).expanduser().resolve()
        self.client = None
        self._init_client()

    def _init_client(self):
        """初始化知识库客户端"""
        if not self.api_path.is_file():
            raise FileNotFoundError(f"知识库 API 不存在: {self.api_path}")

        try:
            spec = importlib.util.spec_from_file_location(
                "content_fusion_knowledge_api",
                self.api_path
            )
            if spec is None or spec.loader is None:
                raise ImportError("无法创建知识库 API 模块规范")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            api_class = getattr(module, "KnowledgeAPI", None)
            if api_class is None:
                raise ImportError("knowledge_api.py 未导出 KnowledgeAPI")
            # knowledge_api.py exposes a KnowledgeAPI class.  Its root is the
            # directory above `scripts/` (for example `闲鱼知识库/`).
            self.client = api_class(self.api_path.parent.parent)
        except Exception as error:
            raise KnowledgeRetrievalError(f"无法初始化知识库 API: {error}") from error

    def retrieve_for_scenario(
        self,
        scenario: str,
        product_type: str,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        根据场景检索知识

        Args:
            scenario: 场景类型 (video/title/description)
            product_type: 产品类型
            tags: 标签列表

        Returns:
            检索到的知识数据
        """
        if not isinstance(product_type, str) or not product_type.strip():
            raise ValueError("knowledge_params.product_type 必须是非空字符串")
        if tags is None:
            tags = []
        if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
            raise ValueError("knowledge_params.tags 必须是字符串列表")
        if scenario not in {'video', 'title', 'description', 'all'}:
            raise ValueError(f"不支持的场景: {scenario}")

        # 根据场景调整检索策略
        scenario_queries = {
            'video': self._build_video_queries(product_type, tags),
            'title': self._build_title_queries(product_type, tags),
            'description': self._build_description_queries(product_type, tags),
            'all': list(dict.fromkeys(
                self._build_video_queries(product_type, tags)
                + self._build_title_queries(product_type, tags)
                + self._build_description_queries(product_type, tags)
            ))
        }

        queries = scenario_queries.get(scenario, [])

        results = {
            'queries': queries,
            'articles': [],
            'scripts': [],
            'pitfalls': [],
            'best_practices': []
        }

        # 执行检索
        for query in queries:
            articles = self._search_knowledge(query)
            results['articles'].extend(articles)

        # 去重
        results['articles'] = self._deduplicate_articles(results['articles'])

        if not results['articles']:
            raise KnowledgeRetrievalError("知识库没有返回相关内容，停止生成")

        empty_content = [
            article.get('title') or article.get('source') or '<未命名条目>'
            for article in results['articles']
            if not isinstance(article.get('content'), str) or not article['content'].strip()
        ]
        if empty_content:
            raise KnowledgeRetrievalError(
                "知识库返回了缺少正文的条目，停止生成: " + ", ".join(empty_content[:3])
            )

        # 分类整理
        results = self._categorize_knowledge(results)

        return results

    def _build_video_queries(self, product_type: str, tags: List[str]) -> List[str]:
        """构建视频场景的检索查询"""
        queries = [
            f"{product_type} 选品策略",
            f"{product_type} 交付方法",
            f"{product_type} 成交方法"
        ]

        queries.extend(f"{product_type} {tag}" for tag in tags if tag)

        return queries

    def _build_title_queries(self, product_type: str, tags: List[str]) -> List[str]:
        """构建标题场景的检索查询"""
        queries = [
            "闲鱼标题优化",
            "标题关键词策略",
            f"{product_type} 标题技巧"
        ]
        return queries

    def _build_description_queries(self, product_type: str, tags: List[str]) -> List[str]:
        """构建描述场景的检索查询"""
        queries = [
            "商品描述话术",
            "卖点提炼技巧",
            f"{product_type} 交付说明"
        ]
        return queries

    def _search_knowledge(self, query: str) -> List[Dict[str, Any]]:
        """
        搜索知识库

        Args:
            query: 检索查询

        Returns:
            文章列表
        """
        try:
            if not hasattr(self.client, 'search_fulltext'):
                raise KnowledgeRetrievalError("知识库 API 缺少 KnowledgeAPI.search_fulltext")
            articles = self.client.search_fulltext(query, limit=3)
            if not isinstance(articles, list):
                raise KnowledgeRetrievalError("知识库 API search_fulltext 未返回列表")
            if not all(isinstance(article, dict) for article in articles):
                raise KnowledgeRetrievalError("知识库 API search_fulltext 返回了无效条目")
            return articles
        except Exception as error:
            if isinstance(error, KnowledgeRetrievalError):
                raise
            raise KnowledgeRetrievalError(f"知识检索失败（query={query}）: {error}") from error

    def build_knowledge_pack(
        self,
        knowledge: Dict[str, Any],
        scenario: str,
        product_type: str,
        tags: Optional[List[str]] = None,
        minimum_used_sources: int = 1
    ) -> Dict[str, Any]:
        """把检索结果整理为 style-copywriter 可验证的知识包。"""
        articles = knowledge.get('articles', [])
        if not articles:
            raise ValueError("知识库没有返回相关内容，停止生成")

        sources = []
        for index, article in enumerate(articles[:5], 1):
            content = (article.get('content') or '').strip()
            if not content:
                raise ValueError("检索结果包含没有正文的条目，停止生成")
            locator = (
                article.get('cleaned_path')
                or article.get('source')
            )
            if not isinstance(locator, str) or not locator.strip():
                raise ValueError("检索结果缺少可回读的来源 locator，停止生成")
            sources.append({
                # style-copywriter can cite `source_id`; retain `id` for
                # existing consumers that read the earlier draft contract.
                'id': f"knowledge-{index:02d}",
                'source_id': f"knowledge-{index:02d}",
                'title': article.get('title') or f"知识条目 {index}",
                'locator': str(locator),
                'excerpt': content[:500],
                'content_sha256': hashlib.sha256(content.encode('utf-8')).hexdigest(),
                'category': article.get('category', ''),
                'tags': article.get('tags', []),
                'match_score': article.get('match_score'),
                'matched_in': article.get('matched_in', []),
                'allowed_uses': ['explanation', 'method', 'mechanism', 'risk']
            })

        if not sources:
            raise ValueError("检索结果没有可用正文摘要，停止生成")

        return {
            'schema_version': '1.0',
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'producer': {
                'name': 'content-fusion',
                'knowledge_api_path': str(self.api_path)
            },
            'query': {
                'scenario': scenario,
                'product_type': product_type,
                'tags': tags or [],
                'queries': knowledge.get('queries', [])
            },
            'retrieval': {
                'result_count': len(articles),
                'usable_source_count': len(sources),
                'minimum_used_sources': max(1, minimum_used_sources)
            },
            'minimum_used_sources': max(1, minimum_used_sources),
            'sources': sources
        }

    def _deduplicate_articles(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """文章去重"""
        seen = set()
        unique_articles = []

        for article in articles:
            article_id = (
                article.get('id')
                or article.get('cleaned_path')
                or article.get('source')
                or article.get('title')
                or hashlib.sha256(str(article.get('content', '')).encode('utf-8')).hexdigest()
            )
            if article_id not in seen:
                seen.add(article_id)
                unique_articles.append(article)

        return unique_articles

    def _categorize_knowledge(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """分类整理知识"""
        for article in results['articles']:
            content = article.get('content', '')
            title = article.get('title', '')

            # 提取话术模板
            if '话术' in title or '模板' in title:
                results['scripts'].append(article)

            # 提取避坑建议
            if '避坑' in title or '注意' in title or '风险' in title:
                results['pitfalls'].append(article)

            # 提取最佳实践
            if '技巧' in title or '策略' in title or '方法' in title:
                results['best_practices'].append(article)

        return results

    def check_compliance(self, text: str) -> Dict[str, Any]:
        """
        违规词检查

        Args:
            text: 待检查文本

        Returns:
            合规检查结果
        """
        if not hasattr(self.client, 'check_violations'):
            raise KnowledgeRetrievalError("知识库 API 缺少 KnowledgeAPI.check_violations")
        try:
            violations_found = self.client.check_violations(text)
        except Exception as error:
            raise KnowledgeRetrievalError(f"知识库违规词检查失败: {error}") from error
        if not isinstance(violations_found, list):
            raise KnowledgeRetrievalError("知识库 API check_violations 未返回列表")

        return {
            'safe': len(violations_found) == 0,
            'violations': violations_found,
            'checked_at': self._get_timestamp()
        }

    def get_knowledge_summary(self, articles: List[Dict[str, Any]], max_length: int = 500) -> str:
        """
        获取知识摘要

        Args:
            articles: 文章列表
            max_length: 最大长度

        Returns:
            摘要文本
        """
        summaries = []

        for article in articles[:5]:  # 最多5篇
            title = article.get('title', '')
            content = article.get('content', '')

            # 提取前200字作为摘要
            summary = content[:200] if content else ''
            summaries.append(f"**{title}**\n{summary}...\n")

        full_summary = '\n'.join(summaries)

        # 截断到最大长度
        if len(full_summary) > max_length:
            full_summary = full_summary[:max_length] + '...'

        return full_summary

    def _get_timestamp(self) -> str:
        """获取时间戳"""
        from datetime import datetime
        return datetime.now().isoformat()
