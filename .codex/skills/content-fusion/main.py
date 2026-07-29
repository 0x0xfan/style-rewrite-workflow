"""
content-fusion Skill 主流程
整合项目事实、项目知识、风格特征，生成闲鱼运营文案
"""

import sys
import argparse
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional

# 修复 Windows 控制台编码问题
sys.stdout.reconfigure(encoding='utf-8')

from modules import (
    FactLoader,
    KnowledgeRetriever,
    StyleLoader,
    ContentGenerator,
    OutputFormatter
)


class ContentFusion:
    """内容融合主类"""

    def __init__(self, config_path: str):
        """
        初始化

        Args:
            config_path: 配置文件路径
        """
        self.config = self._load_config(config_path)
        self.fact_loader = None
        self.knowledge_retriever = None
        self.style_loader = None
        self.output_formatter = OutputFormatter()

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """加载配置文件"""
        config_file = Path(config_path)
        if not config_file.exists():
            raise FileNotFoundError(f"配置文件不存在: {config_path}")

        with open(config_file, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        return config

    def run(self, input_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行内容融合

        Args:
            input_params: 输入参数

        Returns:
            生成结果
        """
        if not isinstance(input_params, dict):
            raise ValueError("输入参数必须是对象")
        knowledge_params = self._require_knowledge_params(input_params)

        print("=" * 60)
        print("Content Fusion Skill - 启动")
        print("=" * 60)

        # 1. 加载项目事实
        print("\n[1/5] 加载项目事实...")
        evidence_path = input_params.get('evidence_package')
        if not evidence_path:
            raise ValueError("缺少必需参数: evidence_package")

        self.fact_loader = FactLoader(evidence_path)
        facts = self.fact_loader.get_key_data()
        print(f"✓ 已加载项目事实: {facts.get('product_name', 'unknown')}")
        print(f"  - Top 想要数: {facts.get('top_want', 0)}")
        print(f"  - 主力价格带: {facts.get('price_range', [0, 0])}")
        print(f"  - 目标受众: {facts.get('target_audience', 'unknown')}")

        # 2. 检索项目知识
        print("\n[2/5] 检索项目知识...")
        knowledge_api_path = self.config.get('knowledge_api_path')
        self.knowledge_retriever = KnowledgeRetriever(knowledge_api_path)

        scenario = input_params.get('scenario', 'video')
        product_type = knowledge_params['product_type']
        tags = knowledge_params.get('tags', [])

        knowledge = self.knowledge_retriever.retrieve_for_scenario(
            scenario=scenario,
            product_type=product_type,
            tags=tags
        )
        knowledge_pack = self.knowledge_retriever.build_knowledge_pack(
            knowledge=knowledge,
            scenario=scenario,
            product_type=product_type,
            tags=tags
        )
        print(f"✓ 已检索知识: {len(knowledge.get('articles', []))} 篇文章")

        # 3. 加载风格特征
        print("\n[3/5] 加载风格特征...")
        style_cards_dir = self.config.get('style_cards_dir')
        self.style_loader = StyleLoader(style_cards_dir)

        style_params = input_params.get('style_params', {})
        style_card_name = style_params.get('style_card', None)

        if style_card_name:
            style = self.style_loader.load_style_card(style_card_name)
            print(f"✓ 已加载风格卡: {style.get('name', 'unknown')}")
        else:
            style = self.style_loader.load_style_card('default')
            print("✓ 使用默认风格")

        # 4. 生成内容
        print("\n[4/5] 生成内容...")
        generator = ContentGenerator(facts, knowledge, style)

        results = {}

        if scenario == 'video':
            video_script = generator.generate_video_script()
            results['video_script'] = video_script
            print(f"✓ 已生成视频脚本: {len(video_script['video_script']['sections'])} 个段落")

        elif scenario == 'title':
            titles = generator.generate_titles(count=5)
            results['titles'] = titles
            print(f"✓ 已生成标题方案: {len(titles)} 个")

        elif scenario == 'description':
            description = generator.generate_description()
            results['description'] = description
            print("✓ 已生成商品描述")

        else:
            # 生成所有内容
            video_script = generator.generate_video_script()
            titles = generator.generate_titles(count=5)
            description = generator.generate_description()

            results['video_script'] = video_script
            results['titles'] = titles
            results['description'] = description
            print("✓ 已生成所有内容")

        # 5. 合规检查
        print("\n[5/5] 合规检查...")
        all_text = self._extract_all_text(results)
        compliance = self.knowledge_retriever.check_compliance(all_text)

        if compliance['safe']:
            print("✓ 合规检查通过")
        else:
            print(f"⚠ 发现 {len(compliance['violations'])} 个违规词")

        # 生成素材清单
        screenshots = self.fact_loader.get_screenshots()
        materials = self.output_formatter.generate_material_list({
            'screenshots': [s['path'] for s in screenshots],
            'knowledge_articles': [a.get('title', '') for a in knowledge.get('articles', [])],
            'data_sources': [evidence_path]
        })

        # 组装完整输出
        output = {
            'results': results,
            'compliance_report': compliance,
            'material_list': materials,
            'knowledge_pack': knowledge_pack
        }

        return output

    def _require_knowledge_params(self, input_params: Dict[str, Any]) -> Dict[str, Any]:
        """Reject generation inputs that cannot be tied to project knowledge."""
        if 'knowledge_params' not in input_params:
            raise ValueError("缺少必需参数: knowledge_params；知识库输入是每次生成文案的必需条件")
        knowledge_params = input_params['knowledge_params']
        if not isinstance(knowledge_params, dict):
            raise ValueError("knowledge_params 必须是对象")
        product_type = knowledge_params.get('product_type')
        if not isinstance(product_type, str) or not product_type.strip():
            raise ValueError("缺少必需参数: knowledge_params.product_type")
        if 'tags' in knowledge_params:
            tags = knowledge_params['tags']
            if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
                raise ValueError("knowledge_params.tags 必须是字符串列表")
        return knowledge_params

    def _extract_all_text(self, results: Dict[str, Any]) -> str:
        """提取所有文本用于合规检查"""
        texts = []

        if 'video_script' in results:
            script = results['video_script'].get('video_script', {})
            for section in script.get('sections', []):
                texts.append(section.get('narration', ''))

        if 'titles' in results:
            for title in results['titles']:
                texts.append(title.get('title', ''))

        if 'description' in results:
            texts.append(results['description'].get('description', ''))

        return '\n'.join(texts)

    def save_output(self, output: Dict[str, Any], output_dir: str) -> None:
        """
        保存输出

        Args:
            output: 输出数据
            output_dir: 输出目录
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        print("\n" + "=" * 60)
        print("保存输出文件")
        print("=" * 60)

        results = output.get('results', {})
        knowledge_pack = output.get('knowledge_pack')
        if not isinstance(knowledge_pack, dict) or not knowledge_pack.get('sources'):
            raise ValueError("缺少有效 knowledge_pack，拒绝保存未绑定知识库的生成结果")

        knowledge_pack_path = output_path / 'knowledge-pack.json'
        self.output_formatter.save_to_json(knowledge_pack, str(knowledge_pack_path))
        print(f"✓ 知识包: {knowledge_pack_path}")

        # 保存视频脚本
        if 'video_script' in results:
            # Markdown 格式
            md_text = self.output_formatter.format_video_script(results['video_script'])
            md_path = output_path / 'video_script.md'
            self.output_formatter.save_to_markdown(md_text, str(md_path))
            print(f"✓ 视频脚本 (Markdown): {md_path}")

            # JSON 格式
            json_path = output_path / 'video_script.json'
            self.output_formatter.save_to_json(results['video_script'], str(json_path))
            print(f"✓ 视频脚本 (JSON): {json_path}")

        # 保存标题方案
        if 'titles' in results:
            # Markdown 格式
            md_text = self.output_formatter.format_titles(results['titles'])
            md_path = output_path / 'titles.md'
            self.output_formatter.save_to_markdown(md_text, str(md_path))
            print(f"✓ 标题方案 (Markdown): {md_path}")

            # JSON 格式
            json_path = output_path / 'titles.json'
            self.output_formatter.save_to_json({'titles': results['titles']}, str(json_path))
            print(f"✓ 标题方案 (JSON): {json_path}")

        # 保存商品描述
        if 'description' in results:
            md_text = self.output_formatter.format_description(results['description'])
            md_path = output_path / 'description.md'
            self.output_formatter.save_to_markdown(md_text, str(md_path))
            print(f"✓ 商品描述: {md_path}")

        # 保存合规报告
        compliance_path = output_path / 'compliance_report.json'
        self.output_formatter.save_to_json(output['compliance_report'], str(compliance_path))
        print(f"✓ 合规报告: {compliance_path}")

        # 保存素材清单
        materials_path = output_path / 'material_list.json'
        self.output_formatter.save_to_json(output['material_list'], str(materials_path))
        print(f"✓ 素材清单: {materials_path}")

        print("\n✓ 所有文件已保存")


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(description='Content Fusion Skill')

    parser.add_argument('--config', type=str, default='config.yaml',
                        help='配置文件路径')
    parser.add_argument('--input', type=str, required=True,
                        help='输入参数文件 (YAML/JSON)')
    parser.add_argument('--output', type=str, default='output',
                        help='输出目录')

    args = parser.parse_args()

    # 加载输入参数
    input_file = Path(args.input)
    if not input_file.exists():
        print(f"错误: 输入文件不存在: {args.input}")
        return

    with open(input_file, 'r', encoding='utf-8') as f:
        if input_file.suffix == '.json':
            input_params = json.load(f)
        else:
            input_params = yaml.safe_load(f)

    # 执行融合
    fusion = ContentFusion(args.config)
    output = fusion.run(input_params)

    # 保存输出
    fusion.save_output(output, args.output)

    print("\n" + "=" * 60)
    print("✓ Content Fusion 完成")
    print("=" * 60)


if __name__ == '__main__':
    main()
