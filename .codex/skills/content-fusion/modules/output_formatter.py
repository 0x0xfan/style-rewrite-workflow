"""
输出格式化器
将生成的内容格式化为 Markdown 和 JSON
"""

import json
from typing import Dict, List, Any, Optional
from datetime import datetime


class OutputFormatter:
    """输出格式化器"""

    def format_video_script(self, content: Dict[str, Any]) -> str:
        """
        格式化视频脚本为 Markdown

        Args:
            content: 视频脚本数据

        Returns:
            Markdown 格式的文本
        """
        meta = content.get('meta', {})
        script = content.get('video_script', {})

        lines = []

        # 标题
        lines.append(f"# B站视频脚本 - {meta.get('product_name', 'Unknown')}")
        lines.append("")

        # 元信息
        lines.append("## 元信息")
        lines.append(f"- **生成时间**: {meta.get('generated_at', 'N/A')}")
        lines.append(f"- **风格卡**: {meta.get('style_card', 'N/A')}")
        lines.append(f"- **总时长**: {script.get('total_duration', 'N/A')}")
        lines.append("")

        # 各个段落
        sections = script.get('sections', [])
        for section in sections:
            lines.append(f"## {section.get('section', 'Section')} ({section.get('timestamp', 'N/A')})")
            lines.append("")

            # 画面
            visual = section.get('visual', {})
            lines.append("**画面**:")
            lines.append(f"- 截图: `{visual.get('screenshot', 'N/A')}`")
            lines.append(f"- 动作: {visual.get('action', 'N/A')}")
            lines.append(f"- 来源: {visual.get('source', 'N/A')}")
            lines.append("")

            # 口播
            lines.append("**口播**:")
            lines.append(f"> {section.get('narration', 'N/A')}")
            lines.append("")

            # 数据来源
            lines.append("**数据来源**:")
            lines.append(f"- 事实来源: `{section.get('fact_source') or 'N/A'}`")
            lines.append(f"- 知识来源: `{section.get('knowledge_source') or 'N/A'}`")
            lines.append(f"- 风格特征: {section.get('style_feature', 'N/A')}")
            lines.append("")

        return '\n'.join(lines)

    def format_titles(self, titles: List[Dict[str, Any]]) -> str:
        """
        格式化标题方案为 Markdown

        Args:
            titles: 标题列表

        Returns:
            Markdown 格式的文本
        """
        lines = []

        lines.append("# 闲鱼标题优化方案")
        lines.append("")

        for i, title_data in enumerate(titles, 1):
            lines.append(f"## 方案 {i}: {title_data.get('title', 'N/A')}")
            lines.append("")

            # 评分
            lines.append(f"**评分**: {title_data.get('score', 0)}/10")
            lines.append("")

            # 理由
            reasoning = title_data.get('reasoning', {})
            lines.append("**优化理由**:")
            lines.append(f"- **事实依据**: {reasoning.get('fact_basis', 'N/A')}")
            lines.append(f"- **知识依据**: {reasoning.get('knowledge_basis', 'N/A')}")
            lines.append(f"- **风格依据**: {reasoning.get('style_basis', 'N/A')}")
            lines.append("")

            # 优化点
            optimization = title_data.get('optimization', [])
            if optimization:
                lines.append("**优化点**:")
                for opt in optimization:
                    lines.append(f"- {opt}")
                lines.append("")

            # 合规性
            compliance = title_data.get('compliance', {})
            safe_status = "✅ 安全" if compliance.get('safe', True) else "❌ 存在问题"
            lines.append(f"**合规性**: {safe_status}")
            lines.append("")

        return '\n'.join(lines)

    def format_description(self, content: Dict[str, Any]) -> str:
        """
        格式化商品描述为 Markdown

        Args:
            content: 商品描述数据

        Returns:
            Markdown 格式的文本
        """
        lines = []

        lines.append("# 商品描述")
        lines.append("")
        lines.append(content.get('description', 'N/A'))
        lines.append("")

        # 来源信息
        lines.append("## 来源追溯")
        lines.append("")

        fact_sources = content.get('fact_sources', [])
        if fact_sources:
            lines.append("**事实来源**:")
            for source in fact_sources:
                lines.append(f"- {source}")
            lines.append("")

        knowledge_sources = content.get('knowledge_sources', [])
        if knowledge_sources:
            lines.append("**知识来源**:")
            for source in knowledge_sources:
                lines.append(f"- {source}")
            lines.append("")

        return '\n'.join(lines)

    def generate_compliance_report(self, text: str, checks: Dict[str, Any]) -> Dict[str, Any]:
        """
        生成合规报告

        Args:
            text: 检查的文本
            checks: 检查结果

        Returns:
            合规报告字典
        """
        report = {
            'checked_at': datetime.now().isoformat(),
            'text_length': len(text),
            'safe': checks.get('safe', True),
            'violations_found': len(checks.get('violations', [])),
            'violations': checks.get('violations', [])
        }

        return report

    def generate_material_list(self, sources: Dict[str, Any]) -> Dict[str, Any]:
        """
        生成素材清单

        Args:
            sources: 来源数据

        Returns:
            素材清单字典
        """
        material_list = {
            'screenshots': sources.get('screenshots', []),
            'knowledge_articles': sources.get('knowledge_articles', []),
            'data_sources': sources.get('data_sources', []),
            'generated_at': datetime.now().isoformat()
        }

        return material_list

    def save_to_json(self, data: Dict[str, Any], output_path: str) -> None:
        """
        保存为 JSON 文件

        Args:
            data: 数据
            output_path: 输出路径
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_to_markdown(self, text: str, output_path: str) -> None:
        """
        保存为 Markdown 文件

        Args:
            text: Markdown 文本
            output_path: 输出路径
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(text)

    def format_full_output(
        self,
        video_script: Optional[Dict[str, Any]] = None,
        titles: Optional[List[Dict[str, Any]]] = None,
        description: Optional[Dict[str, Any]] = None,
        compliance: Optional[Dict[str, Any]] = None,
        materials: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        格式化完整输出

        Args:
            video_script: 视频脚本
            titles: 标题列表
            description: 商品描述
            compliance: 合规报告
            materials: 素材清单

        Returns:
            完整输出字典
        """
        output = {
            'generated_at': datetime.now().isoformat(),
            'outputs': {}
        }

        if video_script:
            output['outputs']['video_script'] = video_script

        if titles:
            output['outputs']['titles'] = titles

        if description:
            output['outputs']['description'] = description

        if compliance:
            output['compliance_report'] = compliance

        if materials:
            output['material_list'] = materials

        return output

    def format_suggestions(self, content: Dict[str, Any]) -> List[Dict[str, str]]:
        """
        生成优化建议

        Args:
            content: 生成的内容

        Returns:
            建议列表
        """
        suggestions = []

        # 检查视频脚本
        if 'video_script' in content:
            script = content['video_script']
            sections = script.get('sections', [])

            if len(sections) < 5:
                suggestions.append({
                    'type': 'improvement',
                    'message': '视频脚本段落较少，建议增加更多实操细节'
                })

            # 检查是否有足够的数据来源
            fact_sources = [s for s in sections if s.get('fact_source')]
            if len(fact_sources) < 3:
                suggestions.append({
                    'type': 'improvement',
                    'message': '建议增加更多基于事实数据的段落，提升可信度'
                })

        # 检查标题
        if 'titles' in content:
            titles = content['titles']
            if len(titles) < 5:
                suggestions.append({
                    'type': 'improvement',
                    'message': '建议生成更多标题方案供选择'
                })

        return suggestions
