#!/usr/bin/env python3
"""
样本质量评分工具

根据音视频可用性、内容完整性、风格代表性、独立性四个维度评分，
判定样本质量等级（A/B/C/不可用）
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime


class SampleGrader:
    """样本质量评估器"""

    def __init__(self):
        self.score = 0
        self.breakdown = {}

    def assess_audio_quality(self):
        """评估音视频可用性（40分）"""
        print("\n=== 1. 音视频可用性评估（40分）===")
        print("A级（40分）：可回听音视频 + 高质量转写（准确率>95%，保留停顿标记）")
        print("B级（25分）：有原文但无音频（官方文字稿，无法验证节奏）")
        print("C级（10分）：低质量单行转写（无分段/标点，可能有错误）")
        print("不可用（0分）：二手转述、改写版本、片段不完整")

        choice = input("\n请选择（A/B/C/0）: ").strip().upper()

        score_map = {"A": 40, "B": 25, "C": 10, "0": 0}
        if choice in score_map:
            self.breakdown["audio_quality"] = score_map[choice]
            self.score += score_map[choice]
            return score_map[choice]
        else:
            print("无效选择，默认0分")
            self.breakdown["audio_quality"] = 0
            return 0

    def assess_completeness(self):
        """评估内容完整性（30分）"""
        print("\n=== 2. 内容完整性评估（30分）===")
        print("完整（30分）：有明确的开头、主体、结尾，核心信息齐全")
        print("基本完整（20分）：主体完整，开头或结尾可能缺失")
        print("片段（10分）：只有部分段落，缺少关键环节")

        choice = input("\n请选择（完整/基本/片段）: ").strip()

        score_map = {"完整": 30, "基本": 20, "片段": 10}
        if choice in score_map:
            self.breakdown["completeness"] = score_map[choice]
            self.score += score_map[choice]
            return score_map[choice]
        else:
            print("无效选择，默认10分")
            self.breakdown["completeness"] = 10
            self.score += 10
            return 10

    def assess_representativeness(self):
        """评估风格代表性（20分）"""
        print("\n=== 3. 风格代表性评估（20分）===")
        print("典型（20分）：明显的个人风格，与其他样本一致")
        print("一般（10分）：有部分风格特征，但不够典型")
        print("非典型（0分）：风格差异大，可能是客串/代写")

        choice = input("\n请选择（典型/一般/非典型）: ").strip()

        score_map = {"典型": 20, "一般": 10, "非典型": 0}
        if choice in score_map:
            self.breakdown["representativeness"] = score_map[choice]
            self.score += score_map[choice]
            return score_map[choice]
        else:
            print("无效选择，默认10分")
            self.breakdown["representativeness"] = 10
            self.score += 10
            return 10

    def assess_independence(self):
        """评估独立性（10分）"""
        print("\n=== 4. 独立性评估（10分）===")
        print("独立（10分）：与其他样本内容不重复，非模板复用")
        print("部分独立（5分）：有部分模板复用，但核心内容独立")
        print("非独立（0分）：与已有样本高度重复，同一文案不同版本")

        choice = input("\n请选择（独立/部分/非独立）: ").strip()

        score_map = {"独立": 10, "部分": 5, "非独立": 0}
        if choice in score_map:
            self.breakdown["independence"] = score_map[choice]
            self.score += score_map[choice]
            return score_map[choice]
        else:
            print("无效选择，默认5分")
            self.breakdown["independence"] = 5
            self.score += 5
            return 5

    def determine_grade(self):
        """判定质量等级"""
        if self.score >= 85:
            return "A级"
        elif self.score >= 60:
            return "B级"
        elif self.score >= 30:
            return "C级"
        else:
            return "不可用"

    def get_capabilities(self, grade):
        """获取支持能力"""
        capabilities = {
            "A级": {
                "支持": "框架、策略、句式、节奏、修辞",
                "最低数量": "框架:2, 句式:2, 修辞:3"
            },
            "B级": {
                "支持": "框架、策略、句式",
                "最低数量": "框架:3, 句式:3, 禁止修辞"
            },
            "C级": {
                "支持": "框架（宏观）、段落职责",
                "最低数量": "框架:5, 禁止句式和修辞"
            },
            "不可用": {
                "支持": "不应纳入样本库",
                "最低数量": "N/A"
            }
        }
        return capabilities.get(grade, {})

    def generate_report(self, sample_id, source, title):
        """生成评估报告"""
        grade = self.determine_grade()
        capabilities = self.get_capabilities(grade)

        report = f"""# 样本 {sample_id}

## 元数据

- **样本ID**: {sample_id}
- **来源**: {source}
- **标题**: {title}
- **采集日期**: {datetime.now().strftime('%Y-%m-%d')}
- **采集人**: 人工评估

---

## 质量评估

### 音视频可用性
- **得分**: {self.breakdown.get('audio_quality', 0)}/40

### 内容完整性
- **得分**: {self.breakdown.get('completeness', 0)}/30

### 风格代表性
- **得分**: {self.breakdown.get('representativeness', 0)}/20

### 独立性
- **得分**: {self.breakdown.get('independence', 0)}/10

### 质量等级判定
- **总分**: {self.score}/100
- **等级**: {grade}

---

## 支持能力

- **可提取特征**: {capabilities.get('支持', 'N/A')}
- **最低数量要求**: {capabilities.get('最低数量', 'N/A')}

---

## 特殊标记

<!-- 如果有模板复用，在对应段落标记 -->
<!-- TEMPLATE_SHARED: 模板名称 -->

<!-- 如果是同文异转版本 -->
<!-- DUPLICATE_VARIANT: 主样本ID -->

<!-- 如果风格非典型 -->
<!-- ATYPICAL: 原因说明 -->

---

## 样本内容

### 原始文本

{{在此粘贴完整的原始文本}}

---

## 审查记录

| 日期 | 审查人 | 结论 | 备注 |
|------|--------|------|------|
| {datetime.now().strftime('%Y-%m-%d')} | 系统评分 | {grade} | 自动生成 |
"""
        return report


def main():
    parser = argparse.ArgumentParser(description="样本质量评分工具")
    parser.add_argument("--sample-id", required=True, help="样本ID（如：sample-001）")
    parser.add_argument("--source", required=True, help="来源（如：钱十七抖音视频）")
    parser.add_argument("--title", required=True, help="标题")
    parser.add_argument("--output", help="输出文件路径（默认：assets/samples/{sample-id}.md）")

    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"样本质量评估工具 - Spoken Style Profiler V2")
    print(f"{'='*60}")
    print(f"\n评估样本: {args.sample_id}")
    print(f"来源: {args.source}")
    print(f"标题: {args.title}")

    grader = SampleGrader()

    # 四个维度评估
    grader.assess_audio_quality()
    grader.assess_completeness()
    grader.assess_representativeness()
    grader.assess_independence()

    # 生成报告
    print(f"\n{'='*60}")
    print(f"评估结果")
    print(f"{'='*60}")
    print(f"总分: {grader.score}/100")
    print(f"等级: {grader.determine_grade()}")
    print(f"\n评分明细:")
    for key, value in grader.breakdown.items():
        print(f"  - {key}: {value}")

    grade = grader.determine_grade()
    capabilities = grader.get_capabilities(grade)
    print(f"\n支持能力:")
    print(f"  - 可提取特征: {capabilities.get('支持', 'N/A')}")
    print(f"  - 最低数量要求: {capabilities.get('最低数量', 'N/A')}")

    # 保存报告
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = Path(f"assets/samples/{args.sample_id}.md")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    report = grader.generate_report(args.sample_id, args.source, args.title)
    output_path.write_text(report, encoding="utf-8")

    print(f"\n报告已保存到: {output_path}")
    print(f"\n提示: 请在文件中填写完整的原始文本内容")


if __name__ == "__main__":
    main()
