"""
风格加载器
从风格卡中加载风格特征
"""

import re
from pathlib import Path
from typing import Dict, List, Optional, Any


class StyleLoader:
    """风格加载器"""

    def __init__(self, style_cards_dir: str):
        """
        初始化风格加载器

        Args:
            style_cards_dir: 风格卡目录路径
        """
        self.style_cards_dir = Path(style_cards_dir)

    def load_style_card(self, style_name: str) -> Dict[str, Any]:
        """
        加载风格卡

        Args:
            style_name: 风格名称（如"钱十七"）

        Returns:
            风格特征字典
        """
        # 查找风格卡文件
        style_file = self.style_cards_dir / f"{style_name}.md"

        if not style_file.exists():
            print(f"警告: 风格卡不存在: {style_file}，使用通用风格")
            return self._get_default_style()

        # 读取风格卡内容
        with open(style_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # 解析风格卡
        style = self._parse_style_card(content, style_name)

        return style

    def _parse_style_card(self, content: str, style_name: str) -> Dict[str, Any]:
        """
        解析风格卡内容

        Args:
            content: 风格卡文本内容
            style_name: 风格名称

        Returns:
            风格特征字典
        """
        style = {
            'name': style_name,
            'persona': '',
            'framework': '',
            'tone': '',
            'sentence_patterns': [],
            'hooks': [],
            'avoid': [],
            'key_phrases': []
        }

        # 提取 Persona
        persona_match = re.search(r'##?\s*(?:Persona|人设|角色定位).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
        if persona_match:
            style['persona'] = self._clean_text(persona_match.group(1))

        # 提取框架/结构
        framework_match = re.search(r'##?\s*(?:框架|结构|内容结构).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
        if framework_match:
            style['framework'] = self._clean_text(framework_match.group(1))

        # 提取语气/语言特点
        tone_match = re.search(r'##?\s*(?:语气|语言特点|表达方式).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
        if tone_match:
            style['tone'] = self._clean_text(tone_match.group(1))

        # 提取句式特征
        pattern_match = re.search(r'##?\s*(?:句式|句式特征).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
        if pattern_match:
            style['sentence_patterns'] = self._extract_list_items(pattern_match.group(1))

        # 提取钩子技巧
        hooks_match = re.search(r'##?\s*(?:钩子|开场|引入技巧).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
        if hooks_match:
            style['hooks'] = self._extract_list_items(hooks_match.group(1))

        # 提取避免事项
        avoid_match = re.search(r'##?\s*(?:避免|不要|禁忌).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
        if avoid_match:
            style['avoid'] = self._extract_list_items(avoid_match.group(1))

        # 提取关键短语
        style['key_phrases'] = self._extract_key_phrases(content)

        return style

    def _clean_text(self, text: str) -> str:
        """清理文本，移除多余空白"""
        # 移除列表标记
        text = re.sub(r'^\s*[-*]\s*', '', text, flags=re.MULTILINE)
        # 移除多余空行
        text = re.sub(r'\n{3,}', '\n\n', text)
        # 移除前后空白
        return text.strip()

    def _extract_list_items(self, text: str) -> List[str]:
        """提取列表项"""
        items = []

        # 匹配 - 或 * 开头的列表项
        list_items = re.findall(r'^\s*[-*]\s*(.+)$', text, re.MULTILINE)
        items.extend([item.strip() for item in list_items])

        # 匹配数字列表
        numbered_items = re.findall(r'^\s*\d+\.\s*(.+)$', text, re.MULTILINE)
        items.extend([item.strip() for item in numbered_items])

        return items

    def _extract_key_phrases(self, content: str) -> List[str]:
        """提取关键短语"""
        phrases = []

        # 查找引号中的内容
        quoted = re.findall(r'[「『""]([^」』""]+)[」』""]', content)
        phrases.extend(quoted)

        # 查找例子中的短语
        example_match = re.search(r'##?\s*(?:示例|例子|案例).*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
        if example_match:
            example_text = example_match.group(1)
            # 提取简短的句子（10-30字）
            sentences = re.findall(r'[^。！？\n]{10,30}[。！？]', example_text)
            phrases.extend(sentences[:5])  # 最多5个

        return phrases[:10]  # 最多10个关键短语

    def _get_default_style(self) -> Dict[str, Any]:
        """获取默认风格（通用风格）"""
        return {
            'name': '通用风格',
            'persona': '专业、客观的运营分析师',
            'framework': '现象观察 → 数据分析 → 策略建议 → 行动指南',
            'tone': '专业、清晰、实用',
            'sentence_patterns': [
                '数据显示...',
                '通过分析发现...',
                '建议采取以下策略...',
                '需要注意的是...'
            ],
            'hooks': [
                '用具体数据开场',
                '提出反常现象',
                '直击痛点'
            ],
            'avoid': [
                '空洞的鸡汤',
                '夸大的承诺',
                '复杂的术语'
            ],
            'key_phrases': []
        }

    def get_style_prompt_section(self, style: Dict[str, Any]) -> str:
        """
        生成风格要求的 Prompt 段落

        Args:
            style: 风格字典

        Returns:
            Prompt 文本
        """
        sections = []

        sections.append(f"### Persona\n{style['persona']}\n")

        sections.append(f"### 内容框架\n{style['framework']}\n")

        sections.append(f"### 语言特点\n{style['tone']}\n")

        if style['sentence_patterns']:
            patterns_text = '\n'.join([f"- {p}" for p in style['sentence_patterns'][:5]])
            sections.append(f"### 句式参考\n{patterns_text}\n")

        if style['hooks']:
            hooks_text = '\n'.join([f"- {h}" for h in style['hooks'][:3]])
            sections.append(f"### 开场技巧\n{hooks_text}\n")

        if style['avoid']:
            avoid_text = '\n'.join([f"- {a}" for a in style['avoid'][:5]])
            sections.append(f"### 避免\n{avoid_text}\n")

        return '\n'.join(sections)

    def apply_style_constraints(self, text: str, style: Dict[str, Any]) -> Dict[str, Any]:
        """
        检查文本是否符合风格约束

        Args:
            text: 待检查文本
            style: 风格字典

        Returns:
            检查结果
        """
        issues = []

        # 检查是否包含应避免的内容
        for avoid_item in style['avoid']:
            # 提取关键词
            keywords = re.findall(r'[一-龥]+', avoid_item)
            for keyword in keywords:
                if keyword in text and len(keyword) > 1:
                    issues.append({
                        'type': 'style_violation',
                        'item': avoid_item,
                        'severity': 'medium'
                    })

        return {
            'compliant': len(issues) == 0,
            'issues': issues
        }
