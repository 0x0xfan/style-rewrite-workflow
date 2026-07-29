"""
闲鱼知识库客户端

调用闲鱼知识库的检索 API，为风格仿写项目提供知识支持

功能:
- 按标签/分类搜索相关文章
- 检查违规词
- 获取话术模板
- 获取品类知识

使用方法:
    from knowledge_client import KnowledgeClient

    client = KnowledgeClient()
    violations = client.check_violations("待检查的文本")
    knowledge = client.get_writing_knowledge("电子产品", ["标题优化"])
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional

# 添加闲鱼知识库路径到 sys.path
KNOWLEDGE_BASE_PATH = Path("D:/项目仓库/闲鱼知识库")
sys.path.insert(0, str(KNOWLEDGE_BASE_PATH))

try:
    from scripts.knowledge_api import KnowledgeAPI
except ImportError as e:
    print(f"错误: 无法导入闲鱼知识库 API - {e}")
    print(f"请确保闲鱼知识库位于: {KNOWLEDGE_BASE_PATH}")
    sys.exit(1)


class KnowledgeClient:
    """闲鱼知识库客户端"""

    def __init__(self):
        """初始化客户端"""
        try:
            self.api = KnowledgeAPI(KNOWLEDGE_BASE_PATH)
            print("[OK] 闲鱼知识库客户端初始化成功")
        except Exception as e:
            print(f"[FAIL] 初始化失败: {e}")
            raise

    def check_violations(self, text: str) -> Dict:
        """
        检查文本中的违规词

        参数:
            text: 待检查的文本

        返回:
            {
                'has_violations': bool,
                'violations': List[Dict],
                'safe': bool
            }
        """
        violations = self.api.check_violations(text)

        return {
            'has_violations': len(violations) > 0,
            'violations': violations,
            'safe': len(violations) == 0
        }

    def get_writing_knowledge(
        self,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 5
    ) -> Dict:
        """
        获取写作相关知识

        参数:
            category: 品类（如"电子产品"）
            tags: 标签列表（如["标题优化", "选品策略"]）
            limit: 返回结果数量

        返回:
            {
                'articles': List[Dict],  # 相关文章
                'scripts': List[str],    # 相关话术
                'category_knowledge': str  # 品类知识
            }
        """
        result = {
            'articles': [],
            'scripts': [],
            'category_knowledge': None
        }

        # 按标签搜索文章
        if tags:
            result['articles'] = self.api.search_by_tags(tags, limit=limit)

        # 按分类搜索（如果没有标签匹配或需要补充）
        if category and len(result['articles']) < limit:
            category_articles = self.api.search_by_category(category, limit=limit)

            # 合并结果，去重
            existing_titles = {a['title'] for a in result['articles']}
            for article in category_articles:
                if article['title'] not in existing_titles:
                    result['articles'].append(article)
                    if len(result['articles']) >= limit:
                        break

        # 获取品类知识
        if category:
            category_info = self.api.get_category_knowledge(category)
            if category_info:
                result['category_knowledge'] = category_info['content']

        return result

    def get_scripts(self, scenario: str) -> List[str]:
        """
        获取指定场景的话术

        参数:
            scenario: 场景名称
                - opening/开场: 开场话术
                - selling/卖点: 卖点描述
                - closing/促成: 促成交易
                - bargaining/议价: 应对议价
                - after_sale/售后: 售后处理

        返回:
            话术列表
        """
        return self.api.get_scripts_by_scenario(scenario)

    def search(self, query: str, limit: int = 5) -> List[Dict]:
        """
        全文搜索

        参数:
            query: 搜索关键词
            limit: 返回结果数量

        返回:
            匹配的文档列表
        """
        return self.api.search_fulltext(query, limit=limit)

    def get_title_optimization_tips(self, category: Optional[str] = None) -> Dict:
        """
        获取标题优化建议

        参数:
            category: 品类（可选）

        返回:
            标题优化相关知识
        """
        tags = ["标题优化", "流量技巧", "曝光提升"]

        result = self.get_writing_knowledge(category=category, tags=tags, limit=3)

        # 提取关键点
        tips = []
        for article in result['articles']:
            content = article.get('content', '')
            # 简单提取：查找包含"标题"的段落
            lines = content.split('\n')
            for line in lines:
                if '标题' in line and len(line) < 200:
                    tips.append(line.strip())

        result['tips'] = tips[:10]  # 限制数量
        return result

    def get_description_templates(self, category: Optional[str] = None) -> Dict:
        """
        获取商品描述模板

        参数:
            category: 品类（可选）

        返回:
            描述模板相关知识
        """
        tags = ["卖点描述", "文案技巧", "商品介绍"]

        result = self.get_writing_knowledge(category=category, tags=tags, limit=3)

        # 获取卖点话术
        result['scripts'] = self.get_scripts("selling")

        return result

    def validate_content(self, title: str, description: str) -> Dict:
        """
        验证标题和描述的合规性

        参数:
            title: 商品标题
            description: 商品描述

        返回:
            {
                'title_safe': bool,
                'description_safe': bool,
                'title_violations': List[Dict],
                'description_violations': List[Dict],
                'overall_safe': bool
            }
        """
        title_check = self.check_violations(title)
        description_check = self.check_violations(description)

        return {
            'title_safe': title_check['safe'],
            'description_safe': description_check['safe'],
            'title_violations': title_check['violations'],
            'description_violations': description_check['violations'],
            'overall_safe': title_check['safe'] and description_check['safe']
        }


def test():
    """测试客户端功能"""
    print("=" * 60)
    print("闲鱼知识库客户端 - 测试模式")
    print("=" * 60)

    try:
        client = KnowledgeClient()

        # 测试1: 违规词检查
        print("\n📋 测试1: 违规词检查")
        test_text = "假一赔十，正品保证，绝对低价！"
        result = client.check_violations(test_text)
        print(f"文本: {test_text}")
        print(f"安全: {result['safe']}")
        if result['violations']:
            print(f"发现 {len(result['violations'])} 个违规词:")
            for v in result['violations']:
                print(f"  - {v['word']} ({v['category']}): {v['reason']}")

        # 测试2: 获取写作知识
        print("\n📋 测试2: 获取标题优化知识")
        knowledge = client.get_title_optimization_tips(category="电子产品")
        print(f"找到 {len(knowledge['articles'])} 篇相关文章:")
        for article in knowledge['articles'][:3]:
            print(f"  - {article['title']}")

        # 测试3: 获取话术
        print("\n📋 测试3: 获取开场话术")
        scripts = client.get_scripts("开场")
        print(f"找到 {len(scripts)} 条话术:")
        for script in scripts[:3]:
            print(f"  - {script}")

        # 测试4: 内容验证
        print("\n📋 测试4: 内容验证")
        validation = client.validate_content(
            title="iPhone 13 Pro 256G 九成新",
            description="手机功能正常，无拆无修，假一赔十！"
        )
        print(f"标题安全: {validation['title_safe']}")
        print(f"描述安全: {validation['description_safe']}")
        print(f"整体安全: {validation['overall_safe']}")
        if validation['description_violations']:
            print(f"描述中的违规词:")
            for v in validation['description_violations']:
                print(f"  - {v['word']}: {v['reason']}")

        # 测试5: 搜索
        print("\n📋 测试5: 全文搜索")
        results = client.search("闲鱼选品技巧", limit=3)
        print(f"找到 {len(results)} 篇相关文章:")
        for result in results:
            print(f"  - {result['title']} (匹配度: {result['match_score']})")

        print("\n" + "=" * 60)
        print("[OK] 所有测试完成")
        print("=" * 60)

    except Exception as e:
        print(f"\n[FAIL] 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description="闲鱼知识库客户端")
    parser.add_argument('--test', action='store_true', help='运行测试')

    args = parser.parse_args()

    if args.test:
        success = test()
        sys.exit(0 if success else 1)
    else:
        print("闲鱼知识库客户端")
        print("使用 --test 运行测试")
        print("\n示例用法:")
        print("  from knowledge_client import KnowledgeClient")
        print("  client = KnowledgeClient()")
        print("  result = client.check_violations('待检查的文本')")


if __name__ == "__main__":
    main()
