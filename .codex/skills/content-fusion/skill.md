---
name: content-fusion
description: 整合项目事实、项目知识、风格特征，生成高质量闲鱼运营文案
version: 1.0.0
author: Codex Agent
created: 2026-07-27
---

# content-fusion Skill

## 功能概述

**content-fusion** 是一个内容融合生成工具，能够整合三种核心数据源：

1. **项目事实**：从 goofish-research 证据包中读取市场数据、需求分析、竞争态势
2. **项目知识**：从 xianyu-knowledge-writer 知识库中检索实战经验、避坑建议
3. **风格特征**：从风格卡中加载 persona、框架、语言特点

最终生成：
- B站口播视频文案（含时间轴、画面、口播、数据来源）
- 闲鱼标题优化方案（多个方案+评分+优化说明）
- 商品描述（结构化、专业、可追溯）

## 使用方法

### 基本用法

```bash
python main.py --input input.yaml --output ./output
```

### 输入格式

创建一个 `input.yaml` 文件：

```yaml
# 产品信息
product_name: "统计年鉴数据"
scenario: "video"  # video / title / description / all

# 项目事实来源
evidence_package: "D:\\圣矾IP运营\\skills\\goofish-research\\examples\\统计年鉴数据\\evidence-package"

# 知识检索参数
knowledge_params:
  product_type: "虚拟产品"
  tags: ["选品策略", "标题优化", "避坑指南"]
  include_scripts: true

# 风格参数（可选）
style_params:
  style_card: "钱十七"  # 可选，不指定则使用通用风格
  tone: "亲切"
  length: "中"
```

### 场景说明

1. **video**：生成 B 站视频文案
   - 开头钩子 (0-10s)
   - 需求验证 (10-30s)
   - 价值说明 (30-60s)
   - 实操演示 (60-150s)
   - 避坑提示 (150-180s)
   - CTA (180-200s)

2. **title**：生成闲鱼标题（5个方案）
   - 关键词堆叠型
   - 痛点导向型
   - 场景化型
   - 时效性型
   - 价值强调型

3. **description**：生成商品描述
   - 产品介绍
   - 适用人群
   - 产品特点
   - 交付说明
   - 注意事项

4. **all**：生成所有内容

### 输出格式

输出目录结构：

```
output/
├── video_script.md          # 视频脚本 (Markdown)
├── video_script.json        # 视频脚本 (JSON)
├── titles.md                # 标题方案 (Markdown)
├── titles.json              # 标题方案 (JSON)
├── description.md           # 商品描述
├── compliance_report.json   # 合规报告
└── material_list.json       # 素材清单
```

## 核心特性

### 1. 三源融合

将三种数据源有机融合：

- **事实数据**：提供真实的市场依据（价格、想要数、高频词）
- **知识经验**：提供实战技巧和避坑建议
- **风格特征**：确保内容符合特定风格

### 2. 可追溯性

每个关键数据都标注来源：

```json
{
  "narration": "一个 9.9 元的统计年鉴，921 个人想要...",
  "fact_source": "market_facts.top_products[0].wants",
  "knowledge_source": null,
  "style_feature": "数据+反差钩子"
}
```

### 3. 合规检查

自动检查违规词：

- 躺赚、零成本、日入、月入、暴利
- 必赚、保证、绝对、100%
- 轻松赚钱、快速致富等

### 4. 素材清单

自动生成素材清单：

- 需要的截图列表
- 引用的知识文章
- 数据来源路径

## 技术架构

### 核心模块

1. **FactLoader**：加载项目事实
   - 读取 evidence-package.json
   - 提取关键数据
   - 提供来源追溯

2. **KnowledgeRetriever**：检索项目知识
   - 调用 knowledge_api
   - 根据场景检索
   - 分类整理知识

3. **StyleLoader**：加载风格特征
   - 解析风格卡 Markdown
   - 提取 persona、框架、句式
   - 提供默认风格

4. **ContentGenerator**：生成内容
   - 融合三种数据源
   - 按场景生成不同类型内容
   - 确保数据可追溯

5. **OutputFormatter**：格式化输出
   - Markdown 格式
   - JSON 格式
   - 合规报告
   - 素材清单

### 数据流

```
goofish-research 证据包
    ↓
FactLoader → 提取关键数据
    ↓
xianyu-knowledge-writer API
    ↓
KnowledgeRetriever → 检索相关知识
    ↓
风格卡 (钱十七.md)
    ↓
StyleLoader → 加载风格特征
    ↓
ContentGenerator → 融合生成内容
    ↓
OutputFormatter → 格式化输出
    ↓
输出文件 (MD + JSON)
```

## 配置文件

`config.yaml` 配置说明：

```yaml
# 知识库 API 路径
knowledge_api_path: "D:\\项目仓库\\闲鱼知识库\\scripts\\knowledge_api.py"

# 风格卡目录
style_cards_dir: "D:\\项目仓库\\风格仿写\\风格卡"

# 违规词列表
violation_words:
  - "躺赚"
  - "零成本"
  # ...
```

## 示例

参见 `examples/统计年鉴数据/` 目录：

- `input.yaml`：输入示例
- `output/`：输出示例
  - `video_script.md`：视频脚本
  - `titles.json`：标题方案
  - `compliance_report.json`：合规报告

## 依赖

- Python 3.8+
- PyYAML
- Jinja2

安装：

```bash
pip install -r requirements.txt
```

## 注意事项

1. **证据包路径**：确保 evidence_package 路径正确
2. **知识库 API**：确保 knowledge_api.py 可访问
3. **风格卡**：如不指定则使用默认风格
4. **合规检查**：生成后务必检查合规报告

## 版本历史

### v1.0.0 (2026-07-27)

- 初始版本
- 支持视频文案、标题优化、商品描述生成
- 支持三源融合（事实+知识+风格）
- 支持可追溯性和合规检查
