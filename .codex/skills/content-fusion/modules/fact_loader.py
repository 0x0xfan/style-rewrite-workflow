"""
项目事实加载器
从 goofish-research 证据包中加载项目事实数据
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any


class FactLoader:
    """项目事实加载器"""

    def __init__(self, evidence_path: str):
        """
        初始化事实加载器

        Args:
            evidence_path: 证据包路径
        """
        self.evidence_path = Path(evidence_path)
        self.data = None

    def load(self) -> Dict[str, Any]:
        """
        加载完整证据包

        Returns:
            包含所有事实数据的字典
        """
        if self.data is not None:
            return self.data

        # 尝试加载 evidence-package.json（统一格式）
        package_file = self.evidence_path / "evidence-package.json"

        if package_file.exists():
            with open(package_file, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            return self.data

        # 否则加载分散的 JSON 文件（goofish-research 格式）
        self.data = {}

        # 加载 meta.json
        meta_file = self.evidence_path / "meta.json"
        if meta_file.exists():
            with open(meta_file, 'r', encoding='utf-8') as f:
                self.data['meta'] = json.load(f)

        # 加载 analysis.json
        analysis_file = self.evidence_path / "analysis.json"
        if analysis_file.exists():
            with open(analysis_file, 'r', encoding='utf-8') as f:
                analysis = json.load(f)
                self.data.update(analysis)

        # 加载 products.json
        products_file = self.evidence_path / "products.json"
        if products_file.exists():
            with open(products_file, 'r', encoding='utf-8') as f:
                products_data = json.load(f)
                # products.json 可能直接是数组，或者是 {"products": [...]}
                if isinstance(products_data, dict) and 'products' in products_data:
                    self.data['products'] = products_data['products']
                elif isinstance(products_data, list):
                    self.data['products'] = products_data
                else:
                    self.data['products'] = []

        # 加载 keywords.json
        keywords_file = self.evidence_path / "keywords.json"
        if keywords_file.exists():
            with open(keywords_file, 'r', encoding='utf-8') as f:
                self.data['keywords'] = json.load(f)

        if not self.data:
            raise FileNotFoundError(f"证据包文件不存在: {self.evidence_path}")

        return self.data

    def get_key_data(self) -> Dict[str, Any]:
        """
        提取关键数据供文案使用

        Returns:
            关键数据字典
        """
        if self.data is None:
            self.load()

        key_data = {}

        # 从 meta 获取基本信息
        meta = self.data.get('meta', {})
        key_data['product_name'] = meta.get('product_name', meta.get('query', 'unknown'))

        # 尝试从 meta.summary 获取摘要数据（新格式）
        summary = meta.get('summary', {})
        if summary:
            # 新格式：meta.summary
            key_data['price_range'] = [summary.get('price_min', 0), summary.get('price_max', 0)]
            key_data['median_price'] = summary.get('price_median', 0)
            key_data['top_want'] = summary.get('visible_wants_max', 0)
            key_data['total_wants'] = summary.get('visible_wants_sum', 0)
            key_data['wants_cards'] = summary.get('products_with_visible_wants', 0)
            key_data['sample_size'] = summary.get('sampled_products', 0)
            key_data['search_count'] = summary.get('sampled_products', 0)
        else:
            # 旧格式：从 market_facts 获取市场数据
            market_facts = self.data.get('market_facts', {})

            # 价格数据
            price_range = market_facts.get('price_range_cny', [0, 0])
            key_data['price_range'] = price_range
            key_data['median_price'] = market_facts.get('median_price_cny', 0)

            # 想要数数据
            observed_wants = market_facts.get('observed_wants', {})
            key_data['top_want'] = observed_wants.get('max_visible_wants', 0)
            key_data['total_wants'] = observed_wants.get('sum_visible_wants', 0)
            key_data['wants_cards'] = observed_wants.get('cards_with_visible_wants', 0)

            # 样本大小
            key_data['sample_size'] = market_facts.get('sample_size', 0)
            key_data['search_count'] = market_facts.get('sample_size', 0)

        # 从 products 分析需求和竞争信号
        products = self.data.get('products', [])
        if products:
            # 从商品标题中提取需求信号
            demand_hints = set()
            target_audience_hints = set()

            for prod in products:
                raw_text = prod.get('raw_text', '')

                # 提取需求信号
                if '环境搭建' in raw_text or '安装报错' in raw_text:
                    demand_hints.add('环境搭建与安装报错')
                if '模型接入' in raw_text or 'Deepseek' in raw_text:
                    demand_hints.add('大模型接入配置')
                if '中文' in raw_text or '汉化' in raw_text:
                    demand_hints.add('软件中文化')
                if '微软商店' in raw_text:
                    demand_hints.add('微软商店问题')
                if '插件' in raw_text:
                    demand_hints.add('插件安装')

                # 提取目标受众
                if '小白' in raw_text or '新手' in raw_text:
                    target_audience_hints.add('新手')
                if 'Windows' in raw_text:
                    target_audience_hints.add('Windows用户')
                if 'Mac' in raw_text:
                    target_audience_hints.add('Mac用户')

            key_data['demand_signals'] = list(demand_hints)
            key_data['target_audience'] = '、'.join(target_audience_hints) if target_audience_hints else '电脑用户'
            key_data['core_pain'] = list(demand_hints)[0] if demand_hints else '安装配置问题'

            # 竞争信号：价格分布、服务承诺
            key_data['competition_signals'] = [
                f"首屏{len(products)}条均为远程安装服务",
                f"价格带集中在{key_data['price_range'][0]}-{key_data['price_range'][1]}元",
                "多数承诺10-15分钟完成、远程操作、不满意退款"
            ]
        else:
            # 从 demand_signals 提取需求信号（旧格式）
            demand_signals = self.data.get('demand_signals', [])
            if demand_signals:
                key_data['demand_signals'] = demand_signals
                audience_hints = []
                for signal in demand_signals:
                    if '新手' in signal:
                        audience_hints.append('新手')
                    if 'Windows' in signal or 'Mac' in signal:
                        audience_hints.append('电脑用户')
                key_data['target_audience'] = '、'.join(audience_hints) if audience_hints else '用户'
                key_data['core_pain'] = demand_signals[0] if demand_signals else '需求'
            else:
                key_data['target_audience'] = '用户'
                key_data['core_pain'] = '需求'
                key_data['demand_signals'] = []

            # 从 competition_signals 提取竞争信号（旧格式）
            competition_signals = self.data.get('competition_signals', [])
            key_data['competition_signals'] = competition_signals

        # 从 risk_signals 提取风险信号
        risk_signals = self.data.get('risk_signals', [])
        key_data['risk_signals'] = risk_signals

        return key_data

    def get_screenshots(self) -> List[Dict[str, str]]:
        """
        获取截图清单

        Returns:
            截图信息列表
        """
        if self.data is None:
            self.load()

        screenshots = self.data.get('screenshots', {})
        screenshot_list = []

        for category, items in screenshots.items():
            if isinstance(items, list):
                for item in items:
                    screenshot_list.append({
                        'category': category,
                        'path': item.get('path', ''),
                        'description': item.get('description', ''),
                        'source': 'goofish-research'
                    })

        return screenshot_list

    def _get_top_want(self, market_facts: Dict) -> int:
        """获取最高想要数"""
        top_products = market_facts.get('top_products', [])
        if top_products and len(top_products) > 0:
            return top_products[0].get('wants', 0)
        return 0

    def _get_main_price_range(self, market_facts: Dict) -> List[float]:
        """获取主力价格带"""
        price_tiers = market_facts.get('price_tiers', [])

        # 找到产品数量最多的价格带
        if price_tiers:
            max_tier = max(price_tiers, key=lambda x: x.get('count', 0))
            return [max_tier.get('min', 0), max_tier.get('max', 0)]

        return [0, 0]

    def _get_target_audience(self, demand_facts: Dict) -> str:
        """获取目标受众"""
        scenarios = demand_facts.get('usage_scenarios', [])

        # 根据使用场景推断受众
        audience_keywords = {
            '论文': '学生',
            '毕业设计': '学生',
            '研究': '研究人员',
            '分析': '分析师',
            '课程': '学生'
        }

        for scenario in scenarios:
            for keyword, audience in audience_keywords.items():
                if keyword in scenario:
                    return audience

        return '专业用户'

    def _get_core_pain(self, demand_facts: Dict) -> str:
        """获取核心痛点"""
        pain_points = demand_facts.get('pain_points', [])

        if pain_points and len(pain_points) > 0:
            # 返回第一个痛点
            first_pain = pain_points[0]
            if isinstance(first_pain, dict):
                return first_pain.get('pain', '数据整理')
            return str(first_pain)

        return '数据获取'

    def get_fact_source(self, data_point: str) -> str:
        """
        获取数据来源路径

        Args:
            data_point: 数据点名称

        Returns:
            来源路径字符串
        """
        source_map = {
            'top_want': 'market_facts.top_products[0].wants',
            'price_range': 'market_facts.price_tiers',
            'search_count': 'search_analysis.total_results',
            'target_audience': 'demand_facts.usage_scenarios',
            'core_pain': 'demand_facts.pain_points[0]',
            'high_freq_words': 'supply_facts.high_freq_words',
            'seller_count': 'competition_facts.seller_count'
        }

        return f"goofish-research/{source_map.get(data_point, 'unknown')}"
