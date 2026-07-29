"""
内容生成引擎
融合项目事实、项目知识、风格特征，生成高质量文案
"""

import json
import re
from typing import Dict, List, Optional, Any
from datetime import datetime


class ContentGenerator:
    """内容生成引擎"""

    def __init__(self, facts: Dict[str, Any], knowledge: Dict[str, Any], style: Dict[str, Any]):
        """
        初始化内容生成器

        Args:
            facts: 项目事实数据
            knowledge: 项目知识数据
            style: 风格特征数据
        """
        self.facts = facts
        self.knowledge = knowledge
        self.style = style

    def generate_video_script(self) -> Dict[str, Any]:
        """
        生成 B 站视频文案

        Returns:
            视频脚本数据
        """
        sections = []

        # 1. 开头钩子 (0-10s)
        sections.append(self._generate_hook())

        # 2. 需求验证 (10-30s)
        sections.append(self._generate_demand_validation())

        # 3. 价值说明 (30-60s)
        sections.append(self._generate_value_proposition())

        # 4. 实操演示 (60-150s)
        sections.extend(self._generate_practical_demo())

        # 5. 避坑提示 (150-180s)
        sections.append(self._generate_pitfall_tips())

        # 6. CTA (180-200s)
        sections.append(self._generate_cta())

        # 计算总时长
        total_duration = sum([s['duration'] for s in sections])

        return {
            'meta': {
                'product_name': self.facts.get('product_name', 'unknown'),
                'scenario': 'video',
                'generated_at': datetime.now().isoformat(),
                'style_card': self.style.get('name', 'default')
            },
            'video_script': {
                'total_duration': f"{total_duration}s",
                'sections': sections
            }
        }

    def _generate_hook(self) -> Dict[str, Any]:
        """生成开头钩子"""
        top_want = self.facts.get('top_want', 0)
        price_range = self.facts.get('price_range', [0, 0])
        product_name = self.facts.get('product_name', '这个产品')

        # 构建钩子文案
        if top_want > 500:
            narration = f"一个 {price_range[0]}-{price_range[1]} 元的{product_name}，竟然有 {top_want} 个人想要..."
        else:
            narration = f"你有没有想过，{product_name}在闲鱼能卖多少钱？"

        return {
            'section': '开头钩子',
            'timestamp': '0-10s',
            'duration': 10,
            'narration': narration,
            'visual': {
                'screenshot': 'product-top-wants.png',
                'action': '放大价格和想要数',
                'source': 'goofish-research'
            },
            'fact_source': 'market_facts.top_products[0].wants',
            'knowledge_source': None,
            'style_feature': '数据+反差钩子'
        }

    def _generate_demand_validation(self) -> Dict[str, Any]:
        """生成需求验证段落"""
        search_count = self.facts.get('search_count', 0)
        product_name = self.facts.get('product_name', '这个产品')

        narration = f"我搜了一下「{product_name}」，发现有 {search_count} 个相关结果，说明需求是真实存在的。"

        if self.facts.get('wants_density') == 'high':
            narration += "而且想要数的密度很高，这是个值得做的品。"

        return {
            'section': '需求验证',
            'timestamp': '10-30s',
            'duration': 20,
            'narration': narration,
            'visual': {
                'screenshot': 'search-overview.png',
                'action': '展示搜索结果数和想要数分布',
                'source': 'goofish-research'
            },
            'fact_source': 'search_analysis.total_results',
            'knowledge_source': '如何验证闲鱼需求',
            'style_feature': '数据验证，建立可信度'
        }

    def _generate_value_proposition(self) -> Dict[str, Any]:
        """生成价值说明段落"""
        target_audience = self.facts.get('target_audience', '用户')
        core_pain = self.facts.get('core_pain', '需求')

        narration = f"为什么这个品好卖？因为目标用户是{target_audience}，他们的核心痛点是{core_pain}。"

        # 融入知识库的经验
        if self.knowledge.get('best_practices'):
            practice = self.knowledge['best_practices'][0]
            practice_title = practice.get('title', '')
            narration += f"根据《{practice_title}》的经验，这类产品的机会在于解决用户的时间成本问题。"

        return {
            'section': '价值说明',
            'timestamp': '30-60s',
            'duration': 30,
            'narration': narration,
            'visual': {
                'screenshot': 'target-audience-analysis.png',
                'action': '展示目标用户画像',
                'source': 'goofish-research'
            },
            'fact_source': 'demand_facts.target_audience',
            'knowledge_source': 'best_practices[0].title',
            'style_feature': '痛点分析，价值阐述'
        }

    def _generate_practical_demo(self) -> List[Dict[str, Any]]:
        """生成实操演示段落"""
        sections = []

        # 价格策略
        price_range = self.facts.get('price_range', [0, 0])
        sections.append({
            'section': '实操演示 - 价格策略',
            'timestamp': '60-90s',
            'duration': 30,
            'narration': f"价格方面，主力价格带在 {price_range[0]}-{price_range[1]} 元之间。我建议定价在这个区间的中位数，既有竞争力，又保证利润。",
            'visual': {
                'screenshot': 'price-distribution.png',
                'action': '展示价格分布图，标注主力价格带',
                'source': 'goofish-research'
            },
            'fact_source': 'market_facts.price_tiers',
            'knowledge_source': '定价策略',
            'style_feature': '具体数据+实操建议'
        })

        # 标题技巧
        high_freq_words = self.facts.get('high_freq_words', [])
        if high_freq_words:
            top_words = ', '.join([w.get('word', '') for w in high_freq_words[:3]])
            sections.append({
                'section': '实操演示 - 标题优化',
                'timestamp': '90-120s',
                'duration': 30,
                'narration': f"标题要包含高频关键词，像「{top_words}」这些词，都是用户搜索时会用到的。把这些词组合起来，曝光率能提升不少。",
                'visual': {
                    'screenshot': 'high-freq-words.png',
                    'action': '展示高频词列表',
                    'source': 'goofish-research'
                },
                'fact_source': 'supply_facts.high_freq_words',
                'knowledge_source': '标题优化技巧',
                'style_feature': '实操演示，可复制'
            })

        # 交付方式
        sections.append({
            'section': '实操演示 - 交付说明',
            'timestamp': '120-150s',
            'duration': 30,
            'narration': "交付方式很重要。数据类产品建议用网盘链接或者表格文件，交付要快，最好自动化发货，节省时间。",
            'visual': {
                'screenshot': 'delivery-example.png',
                'action': '展示交付流程示例',
                'source': 'knowledge-base'
            },
            'fact_source': None,
            'knowledge_source': '虚拟产品交付指南',
            'style_feature': '实操细节，降低门槛'
        })

        return sections

    def _generate_pitfall_tips(self) -> Dict[str, Any]:
        """生成避坑提示段落"""
        narration = "几个要注意的坑："

        # 融入知识库的避坑建议
        if self.knowledge.get('pitfalls'):
            pitfall = self.knowledge['pitfalls'][0]
            pitfall_title = pitfall.get('title', '')
            narration += f"第一，避免版权问题，参考《{pitfall_title}》里的建议。"

        narration += "第二，不要承诺过度，说清楚数据的来源和限制。第三，售后要跟上，虽然是虚拟产品，但体验不能差。"

        return {
            'section': '避坑提示',
            'timestamp': '150-180s',
            'duration': 30,
            'narration': narration,
            'visual': {
                'screenshot': 'pitfall-checklist.png',
                'action': '展示避坑清单',
                'source': 'knowledge-base'
            },
            'fact_source': None,
            'knowledge_source': 'pitfalls[0].title',
            'style_feature': '风险提示，增强可信度'
        }

    def _generate_cta(self) -> Dict[str, Any]:
        """生成 CTA 段落"""
        narration = "如果你也想在闲鱼做虚拟产品，可以关注我，后续会分享更多实战案例。有问题也可以私信交流。"

        return {
            'section': 'CTA',
            'timestamp': '180-200s',
            'duration': 20,
            'narration': narration,
            'visual': {
                'screenshot': 'cta-follow.png',
                'action': '展示关注按钮',
                'source': 'template'
            },
            'fact_source': None,
            'knowledge_source': None,
            'style_feature': '自然引导，不强推'
        }

    def generate_titles(self, count: int = 5) -> List[Dict[str, Any]]:
        """
        生成闲鱼标题方案

        Args:
            count: 生成数量

        Returns:
            标题方案列表
        """
        titles = []

        high_freq_words = self.facts.get('high_freq_words', [])
        product_name = self.facts.get('product_name', '产品')
        target_audience = self.facts.get('target_audience', '用户')

        # 方案1: 关键词堆叠型
        if len(high_freq_words) >= 3:
            words = [w.get('word', '') for w in high_freq_words[:3]]
            title1 = f"{words[0]} {words[1]} {words[2]} {product_name}"
            titles.append({
                'title': title1,
                'score': 9.2,
                'reasoning': {
                    'fact_basis': f"高频词: {words[0]}({high_freq_words[0].get('count', 0)}次), {words[1]}({high_freq_words[1].get('count', 0)}次)",
                    'knowledge_basis': '标题前置核心关键词，提高搜索曝光',
                    'style_basis': '简洁直接，符合用户搜索习惯'
                },
                'optimization': [
                    f"包含高频词「{words[0]}」- 提升搜索匹配",
                    f"包含高频词「{words[1]}」- 精准定位",
                    "关键词前置 - 提高权重"
                ],
                'compliance': {'safe': True}
            })

        # 方案2: 痛点导向型
        core_pain = self.facts.get('core_pain', '需求')
        title2 = f"{product_name} 已{core_pain}好 {target_audience}专用"
        titles.append({
            'title': title2,
            'score': 8.8,
            'reasoning': {
                'fact_basis': f"核心痛点: {core_pain}",
                'knowledge_basis': f"强调「已{core_pain}好」解决用户痛点",
                'style_basis': '痛点导向，吸引目标用户'
            },
            'optimization': [
                f"直击痛点 - {core_pain}",
                f"明确受众 - {target_audience}",
                "降低决策成本"
            ],
            'compliance': {'safe': True}
        })

        # 方案3: 场景化型
        usage_scenarios = self.facts.get('usage_scenarios', [])
        if usage_scenarios:
            scenario = usage_scenarios[0]
            title3 = f"{product_name} {scenario}必备 完整版"
            titles.append({
                'title': title3,
                'score': 8.5,
                'reasoning': {
                    'fact_basis': f"使用场景: {scenario}",
                    'knowledge_basis': '场景化描述增强代入感',
                    'style_basis': '具体场景，精准触达'
                },
                'optimization': [
                    f"场景化 - {scenario}",
                    "强调完整性 - 增加信任",
                    "刚需感 - 必备"
                ],
                'compliance': {'safe': True}
            })

        # 方案4: 时效性型
        if len(high_freq_words) >= 1:
            word = high_freq_words[0].get('word', '')
            title4 = f"2024最新 {word} {product_name} 更新版"
            titles.append({
                'title': title4,
                'score': 8.3,
                'reasoning': {
                    'fact_basis': f"高频词: {word}",
                    'knowledge_basis': '时效性词汇提升吸引力',
                    'style_basis': '新鲜感+更新承诺'
                },
                'optimization': [
                    "时效性 - 2024最新",
                    "更新承诺 - 增加价值感",
                    f"关键词 - {word}"
                ],
                'compliance': {'safe': True}
            })

        # 方案5: 价值强调型
        price_range = self.facts.get('price_range', [0, 0])
        title5 = f"{product_name} 全套资料 {target_audience}推荐"
        titles.append({
            'title': title5,
            'score': 8.0,
            'reasoning': {
                'fact_basis': f"目标用户: {target_audience}",
                'knowledge_basis': '强调完整性+推荐增加信任',
                'style_basis': '价值感+社会证明'
            },
            'optimization': [
                "全套 - 强调完整性",
                f"{target_audience}推荐 - 社会证明",
                "降低风险感知"
            ],
            'compliance': {'safe': True}
        })

        return titles[:count]

    def generate_description(self) -> Dict[str, Any]:
        """
        生成商品描述

        Returns:
            商品描述数据
        """
        product_name = self.facts.get('product_name', '产品')
        core_pain = self.facts.get('core_pain', '需求')
        target_audience = self.facts.get('target_audience', '用户')

        description = f"""# {product_name}

## 产品介绍
专为{target_audience}准备的{product_name}，已经{core_pain}好，可以直接使用。

## 适用人群
- {target_audience}
- 需要{core_pain}的人群
- 追求效率的专业人士

## 交付说明
- 格式: Excel/PDF
- 交付方式: 网盘链接
- 交付时间: 付款后自动发货

## 注意事项
- 数据仅供参考，请结合实际使用
- 有问题随时联系，提供售后支持
"""

        return {
            'description': description,
            'fact_sources': ['target_audience', 'core_pain'],
            'knowledge_sources': ['虚拟产品交付指南'],
            'style_features': ['简洁明了', '结构化展示']
        }
