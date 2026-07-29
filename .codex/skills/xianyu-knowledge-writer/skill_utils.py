"""
xianyu-knowledge-writer Skill 工具函数

提供内容生成的核心功能：
- 输入解析和验证
- 知识库检索
- 风格加载
- Prompt 构建
- 合规检查
- 输出格式化
"""

import sys
import re
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime


class SkillUtils:
    """xianyu-knowledge-writer Skill 工具类"""

    def __init__(self, kb_root: Optional[Path] = None, project_root: Optional[Path] = None):
        """
        初始化工具类

        参数:
            kb_root: 知识库根目录
            project_root: 项目根目录（风格仿写项目）
        """
        # 知识库路径
        if kb_root is None:
            kb_root = Path(r"D:\项目仓库\闲鱼知识库")
        self.kb_root = Path(kb_root)

        # 项目根目录
        if project_root is None:
            project_root = Path(__file__).resolve().parents[3]  # 从 .codex/skills/xianyu-knowledge-writer/ 向上三层
        self.project_root = Path(project_root)

        # 动态加载知识库 API
        self.api = self._load_knowledge_api()

    def _load_knowledge_api(self):
        """动态加载知识库 API"""
        try:
            # 将知识库 scripts 目录添加到 sys.path
            scripts_path = str(self.kb_root / "scripts")
            if scripts_path not in sys.path:
                sys.path.insert(0, scripts_path)

            from knowledge_api import KnowledgeAPI
            return KnowledgeAPI(kb_root=self.kb_root)
        except Exception as e:
            print(f"⚠️ 警告: 无法加载知识库 API - {e}")
            return None

    def parse_input(self, input_data: Dict) -> Dict:
        """
        解析和验证用户输入

        参数:
            input_data: 用户输入的字典

        返回:
            解析后的标准化数据
        """
        # 验证必需字段
        required_fields = ['project_facts']
        for field in required_fields:
            if field not in input_data:
                raise ValueError(f"缺少必需字段: {field}")

        project_facts = input_data['project_facts']
        required_pf_fields = ['product_type', 'scenario', 'target_audience', 'key_points']
        for field in required_pf_fields:
            if field not in project_facts:
                raise ValueError(f"project_facts 缺少必需字段: {field}")

        # 标准化数据
        parsed = {
            'project_facts': {
                'product_type': project_facts['product_type'],
                'scenario': project_facts['scenario'],
                'target_audience': project_facts['target_audience'],
                'key_points': project_facts['key_points'] if isinstance(project_facts['key_points'], list) else [project_facts['key_points']],
                'constraints': project_facts.get('constraints', [])
            },
            'style_preference': input_data.get('style_preference', {}),
            'knowledge_focus': input_data.get('knowledge_focus', {})
        }

        # 设置默认值
        if 'risk_check' not in parsed['knowledge_focus']:
            parsed['knowledge_focus']['risk_check'] = True
        if 'include_scripts' not in parsed['knowledge_focus']:
            parsed['knowledge_focus']['include_scripts'] = False

        return parsed

    def normalize_category(self, product_type: str) -> str:
        """
        规范化品类名称，映射到知识库品类

        参数:
            product_type: 用户输入的产品类型

        返回:
            规范化后的品类名称
        """
        # 品类映射表
        category_mapping = {
            '虚拟产品': '虚拟产品',
            '虚拟': '虚拟产品',
            '数字产品': '虚拟产品',
            '电子产品': '电子产品',
            '数码': '电子产品',
            '3c': '电子产品',
            '服饰': '服饰鞋包',
            '服装': '服饰鞋包',
            '鞋包': '服饰鞋包',
            '服饰鞋包': '服饰鞋包',
            '家居': '家居用品',
            '家居用品': '家居用品',
            '美妆': '美妆个护',
            '个护': '美妆个护',
            '美妆个护': '美妆个护',
            '图书': '图书文娱',
            '文娱': '图书文娱',
            '图书文娱': '图书文娱'
        }

        product_type_lower = product_type.lower()

        for key, value in category_mapping.items():
            if key.lower() in product_type_lower:
                return value

        # 如果没有匹配，返回原值
        return product_type

    def determine_tags(self, scenario: str, user_tags: Optional[List[str]] = None) -> List[str]:
        """
        确定搜索标签

        参数:
            scenario: 场景类型
            user_tags: 用户指定的标签

        返回:
            标签列表
        """
        # 场景到标签的映射
        scenario_tags = {
            '选品': ['选品策略', '选品技巧', '品类分析'],
            '标题': ['标题优化', '标题技巧', '流量技巧'],
            '引流': ['引流技巧', '流量获取', '曝光提升'],
            '客服': ['客服话术', '应对技巧', '沟通技巧'],
            '售后': ['售后处理', '投诉处理', '退换货']
        }

        tags = []

        # 添加场景相关标签
        scenario_lower = scenario.lower()
        for key, values in scenario_tags.items():
            if key in scenario_lower or scenario_lower in key.lower():
                tags.extend(values)
                break

        # 添加用户指定标签
        if user_tags:
            tags.extend(user_tags)

        # 去重
        return list(set(tags))

    def search_knowledge(self, parsed_input: Dict) -> Dict:
        """
        调用知识库 API 搜索相关知识

        参数:
            parsed_input: 解析后的输入数据

        返回:
            知识检索结果
        """
        if not self.api:
            return {
                'articles': [],
                'category_knowledge': None,
                'scripts': [],
                'input_violations': []
            }

        project_facts = parsed_input['project_facts']
        knowledge_focus = parsed_input['knowledge_focus']

        # 确定搜索标签
        tags = self.determine_tags(
            project_facts['scenario'],
            knowledge_focus.get('tags', [])
        )

        # 搜索相关文章
        articles = self.api.search_by_tags(tags, limit=5)

        # 获取品类知识
        normalized_category = self.normalize_category(project_facts['product_type'])
        category_knowledge = self.api.get_category_knowledge(normalized_category)

        # 获取话术（如果需要）
        scripts = []
        if knowledge_focus.get('include_scripts', False):
            scenario_map = {
                '客服': 'customer_service',
                '议价': 'bargaining',
                '售后': 'after_sale',
                '开场': 'opening',
                '卖点': 'selling_points',
                '促成': 'closing'
            }
            scenario_key = scenario_map.get(project_facts['scenario'], project_facts['scenario'])
            scripts = self.api.get_scripts_by_scenario(scenario_key)

        # 输入违规词检查
        input_violations = []
        if knowledge_focus.get('risk_check', True):
            input_text = ' '.join(project_facts['key_points'])
            input_violations = self.api.check_violations(input_text)

        return {
            'articles': articles,
            'category_knowledge': category_knowledge,
            'scripts': scripts,
            'input_violations': input_violations,
            'search_tags': tags
        }

    def load_style(self, style_card_name: str) -> Optional[Dict]:
        """
        加载风格卡

        参数:
            style_card_name: 风格卡名称

        返回:
            风格特征字典，如果不存在返回 None
        """
        style_path = self.project_root / "profiles" / f"{style_card_name}-闲鱼风格拆解.md"

        if not style_path.exists():
            print(f"⚠️ 风格卡不存在: {style_path}")
            return None

        try:
            with open(style_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 提取关键特征（简单版本）
            style_dna = {
                'name': style_card_name,
                'content': content,
                'features': self._extract_style_features(content)
            }

            return style_dna
        except Exception as e:
            print(f"⚠️ 加载风格卡失败: {e}")
            return None

    def _extract_style_features(self, style_content: str) -> Dict:
        """
        从风格卡内容中提取关键特征

        参数:
            style_content: 风格卡内容

        返回:
            提取的特征字典
        """
        features = {}

        # 提取风格一句话
        one_sentence_match = re.search(r'## 风格一句话\s+(.*?)(?=\n##|\Z)', style_content, re.DOTALL)
        if one_sentence_match:
            features['one_sentence'] = one_sentence_match.group(1).strip()

        # 提取开头公式
        opening_match = re.search(r'## 开头公式\s+(.*?)(?=\n##|\Z)', style_content, re.DOTALL)
        if opening_match:
            features['opening_formulas'] = opening_match.group(1).strip()

        # 提取正文结构
        structure_match = re.search(r'## 正文结构\s+(.*?)(?=\n##|\Z)', style_content, re.DOTALL)
        if structure_match:
            features['structure'] = structure_match.group(1).strip()

        return features

    def build_prompt(self, parsed_input: Dict, knowledge_result: Dict, style_dna: Optional[Dict] = None) -> str:
        """
        构建生成 Prompt

        参数:
            parsed_input: 解析后的输入
            knowledge_result: 知识检索结果
            style_dna: 风格特征（可选）

        返回:
            完整的生成 Prompt
        """
        project_facts = parsed_input['project_facts']
        style_preference = parsed_input['style_preference']

        # 场景映射
        scenario_mapping = {
            '选品': '选品分析文案',
            '标题': '标题优化方案',
            '引流': '引流话术/文案',
            '客服': '客服应对话术',
            '售后': '售后处理话术'
        }

        # 构建 Prompt
        prompt_parts = []

        # 1. 任务说明
        prompt_parts.append("# 闲鱼内容生成任务\n")
        prompt_parts.append("你是一位闲鱼运营专家，需要基于以下信息生成专业、合规的闲鱼运营内容。\n")

        # 2. 项目事实
        prompt_parts.append("## 项目事实\n")
        prompt_parts.append(f"- **产品类型**: {project_facts['product_type']}")
        prompt_parts.append(f"- **应用场景**: {project_facts['scenario']}")
        prompt_parts.append(f"- **目标受众**: {project_facts['target_audience']}")
        prompt_parts.append(f"- **核心卖点**: {', '.join(project_facts['key_points'])}")
        if project_facts.get('constraints'):
            prompt_parts.append(f"- **约束条件**: {', '.join(project_facts['constraints'])}")
        prompt_parts.append("")

        # 3. 知识库参考
        if knowledge_result['articles']:
            prompt_parts.append("## 知识库参考\n")
            prompt_parts.append("从闲鱼知识库检索到以下相关经验，请自然融入生成的内容中：\n")
            for i, article in enumerate(knowledge_result['articles'][:3], 1):
                prompt_parts.append(f"### 参考文章 {i}: {article['title']}")
                prompt_parts.append(f"**分类**: {article.get('category', '未分类')}")
                prompt_parts.append(f"**标签**: {', '.join(article.get('tags', []))}")
                # 提取关键内容（截取前500字）
                content_preview = article.get('content', '')[:500]
                prompt_parts.append(f"**关键内容**: {content_preview}...")
                prompt_parts.append("")

        # 4. 品类知识
        if knowledge_result.get('category_knowledge'):
            prompt_parts.append("## 品类知识\n")
            category_content = knowledge_result['category_knowledge'].get('content', '')[:800]
            prompt_parts.append(f"{category_content}...\n")

        # 5. 话术参考
        if knowledge_result.get('scripts'):
            prompt_parts.append("## 话术参考\n")
            for i, script in enumerate(knowledge_result['scripts'][:5], 1):
                prompt_parts.append(f"{i}. {script}")
            prompt_parts.append("")

        # 6. 风格要求
        prompt_parts.append("## 风格要求\n")
        if style_dna:
            prompt_parts.append(f"**风格名称**: {style_dna['name']}\n")
            features = style_dna.get('features', {})
            if features.get('one_sentence'):
                prompt_parts.append(f"**风格定位**: {features['one_sentence']}\n")
            if features.get('opening_formulas'):
                prompt_parts.append("**开头公式参考**:")
                prompt_parts.append(features['opening_formulas'][:500] + "...\n")
        else:
            tone = style_preference.get('tone', '专业、亲切')
            prompt_parts.append(f"请使用{tone}的闲鱼运营风格\n")

        # 7. 合规要求
        if knowledge_result.get('input_violations'):
            prompt_parts.append("## 合规要求\n")
            violation_words = [v['word'] for v in knowledge_result['input_violations']]
            prompt_parts.append(f"**必须避免的违规词**: {', '.join(violation_words)}")
            prompt_parts.append("**重要**: 生成的内容中不得出现任何违规词，请用合规的替代表达。\n")

        # 8. 生成要求
        prompt_parts.append("## 生成要求\n")
        scenario_type = scenario_mapping.get(project_facts['scenario'], '相关内容')
        prompt_parts.append(f"请生成{scenario_type}，要求：\n")
        prompt_parts.append("1. **知识融合**: 自然融入知识库中的经验和技巧，不要生硬堆砌")
        prompt_parts.append("2. **风格一致**: 符合指定的表达风格和语气")
        prompt_parts.append("3. **合规安全**: 严格避免所有违规词，使用合规替代表达")
        prompt_parts.append("4. **卖点突出**: 清晰展现产品核心优势")
        prompt_parts.append("5. **场景适配**: 符合应用场景的内容结构和要求\n")

        # 9. 场景特定要求
        prompt_parts.append(self._get_scenario_requirements(project_facts['scenario']))

        return '\n'.join(prompt_parts)

    def _get_scenario_requirements(self, scenario: str) -> str:
        """
        获取场景特定要求

        参数:
            scenario: 场景类型

        返回:
            场景特定要求文本
        """
        requirements = {
            '选品': """
### 选品文案特定要求：
- 分析品类特点和市场机会
- 说明竞争情况和差异化优势
- 提供具体的货源建议
- 给出操作步骤和注意事项
""",
            '标题': """
### 标题优化特定要求：
- 生成 3-5 个标题方案
- 每个方案说明优化策略（关键词、痛点、吸引力）
- 标题长度控制在 20-30 字
- 包含预估曝光度分析
""",
            '引流': """
### 引流内容特定要求：
- 开头要有强吸引力钩子
- 突出产品差异化卖点
- 包含明确的行动召唤（CTA）
- 引导用户咨询或下单
""",
            '客服': """
### 客服话术特定要求：
- 结构: 开场问候 → 理解需求 → 解释说明 → 促成交易
- 应对常见异议（价格、质量、物流）
- 语气亲切但专业
- 提供具体解决方案
""",
            '售后': """
### 售后话术特定要求：
- 先安抚情绪，表达理解
- 了解具体问题
- 提供清晰的解决方案
- 争取满意评价
"""
        }

        return requirements.get(scenario, "")

    def check_compliance(self, text: str) -> List[Dict]:
        """
        检查生成内容的违规词

        参数:
            text: 待检查的文本

        返回:
            违规词列表
        """
        if not self.api:
            return []

        return self.api.check_violations(text)

    def format_output(self, generated_content: str, parsed_input: Dict,
                     knowledge_result: Dict, style_dna: Optional[Dict],
                     violations: List[Dict]) -> Dict:
        """
        格式化输出结果

        参数:
            generated_content: 生成的内容
            parsed_input: 解析后的输入
            knowledge_result: 知识检索结果
            style_dna: 风格特征
            violations: 违规词检查结果

        返回:
            格式化的输出字典
        """
        project_facts = parsed_input['project_facts']

        # 提取标题（如果有）
        title = ""
        content = generated_content

        # 尝试提取标题
        title_match = re.search(r'^#\s+(.+)$', generated_content, re.MULTILINE)
        if title_match:
            title = title_match.group(1).strip()

        # 构建输出
        output = {
            'content': {
                'text': content,
                'title': title,
                'sections': []  # 可以进一步分段
            },
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'scenario': project_facts['scenario'],
                'style_card': style_dna['name'] if style_dna else 'default',
                'target_audience': project_facts['target_audience'],
                'product_type': project_facts['product_type']
            },
            'knowledge_sources': [
                {
                    'title': article['title'],
                    'category': article.get('category', ''),
                    'relevance': article.get('match_score', 0),
                    'key_points': article.get('matched_tags', [])
                }
                for article in knowledge_result.get('articles', [])[:5]
            ],
            'compliance_report': {
                'violations_found': len(violations),
                'violations_details': violations,
                'safe': len(violations) == 0
            },
            'suggestions': self._generate_suggestions(violations, knowledge_result, style_dna)
        }

        return output

    def _generate_suggestions(self, violations: List[Dict],
                            knowledge_result: Dict,
                            style_dna: Optional[Dict]) -> List[Dict]:
        """
        生成优化建议

        参数:
            violations: 违规词列表
            knowledge_result: 知识检索结果
            style_dna: 风格特征

        返回:
            建议列表
        """
        suggestions = []

        # 违规词建议
        if violations:
            suggestions.append({
                'type': 'warning',
                'message': f'发现 {len(violations)} 个违规词，请修改后再发布'
            })
            for v in violations[:3]:  # 最多显示3个
                if v.get('suggestion'):
                    suggestions.append({
                        'type': 'improvement',
                        'message': f"'{v['word']}' 建议替换为: {v['suggestion']}"
                    })

        # 知识库建议
        if not knowledge_result.get('articles'):
            suggestions.append({
                'type': 'info',
                'message': '未找到相关知识库文章，建议补充更多标签或调整产品类型'
            })

        # 风格建议
        if not style_dna:
            suggestions.append({
                'type': 'info',
                'message': '未使用风格卡，如需特定风格，请在 style_preference 中指定'
            })

        # 通用建议
        suggestions.append({
            'type': 'info',
            'message': '发布前请人工审核内容，确保与实际情况一致'
        })

        return suggestions


def main():
    """
    使用示例
    """
    # 设置 UTF-8 输出（Windows 兼容）
    import sys
    import io
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("=" * 60)
    print("xianyu-knowledge-writer Skill Utils 测试")
    print("=" * 60)

    # 初始化
    utils = SkillUtils()

    # 测试输入
    test_input = {
        'project_facts': {
            'product_type': '虚拟产品',
            'scenario': '选品',
            'target_audience': '闲鱼新手',
            'key_points': ['0成本', '易操作', '快速变现'],
            'constraints': ['避免提及具体产品名称']
        },
        'style_preference': {
            'style_card': '钱十七',
            'tone': '亲切',
            'length': '中'
        },
        'knowledge_focus': {
            'tags': ['选品策略', '虚拟产品', '新手入门'],
            'risk_check': True
        }
    }

    try:
        # 1. 解析输入
        print("\n[1] 解析输入...")
        parsed = utils.parse_input(test_input)
        print(f"[OK] 解析成功")
        print(f"  场景: {parsed['project_facts']['scenario']}")
        print(f"  产品: {parsed['project_facts']['product_type']}")

        # 2. 知识检索
        print("\n[2] 检索知识库...")
        knowledge = utils.search_knowledge(parsed)
        print(f"[OK] 找到 {len(knowledge['articles'])} 篇相关文章")
        print(f"[OK] 违规词检查: {len(knowledge['input_violations'])} 个问题")

        # 3. 加载风格
        print("\n[3] 加载风格卡...")
        style_card_name = parsed['style_preference'].get('style_card')
        if style_card_name:
            style_dna = utils.load_style(style_card_name)
            if style_dna:
                print(f"[OK] 风格卡加载成功: {style_card_name}")
            else:
                print(f"[WARN] 风格卡加载失败")
                style_dna = None
        else:
            style_dna = None
            print("[SKIP] 跳过（未指定风格卡）")

        # 4. 构建 Prompt
        print("\n[4] 构建生成 Prompt...")
        prompt = utils.build_prompt(parsed, knowledge, style_dna)
        print(f"[OK] Prompt 构建完成 ({len(prompt)} 字符)")
        print("\n--- Prompt 预览 (前500字符) ---")
        print(prompt[:500])
        print("...\n")

        print("=" * 60)
        print("[OK] 测试完成")
        print("=" * 60)

    except Exception as e:
        print(f"\n[ERROR] 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
