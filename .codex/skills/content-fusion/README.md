# content-fusion Skill

> 整合项目事实、项目知识、风格特征，生成高质量闲鱼运营文案

**版本**: v1.0.0  
**状态**: ✅ 已完成  
**创建日期**: 2026-07-27

---

## 🎯 功能简介

content-fusion 是一个内容融合生成工具，能够：

1. **读取项目事实**：从 goofish-research 证据包中提取市场数据、需求分析、竞争态势
2. **检索项目知识**：从 xianyu-knowledge-writer 知识库中获取实战经验和避坑建议
3. **加载风格特征**：从风格卡中提取 persona、框架、语言特点
4. **智能融合生成**：生成 B 站视频文案、闲鱼标题、商品描述

## 🚀 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行测试

```bash
python test.py
```

输出将保存到 `examples/统计年鉴数据/output/`

### 完整使用

```bash
python main.py --input examples/统计年鉴数据/input.yaml --output ./output
```

## 📋 输出示例

### 1. B站视频脚本

生成 300-400 字的口播视频文案，包含：
- 开头钩子 (0-10s)
- 需求验证 (10-30s)
- 价值说明 (30-60s)
- 实操演示 (60-150s)
- 避坑提示 (150-180s)
- CTA (180-200s)

每段包含：口播文本、画面描述、数据来源标注

### 2. 闲鱼标题方案

生成 5 个标题方案，每个包含：
- 标题文本
- 评分（0-10）
- 优化理由（事实依据+知识依据+风格依据）
- 优化点列表
- 合规性检查

### 3. 商品描述

结构化的商品描述，包含：
- 产品介绍
- 适用人群
- 产品特点
- 交付说明
- 注意事项

### 4. 合规报告

检查是否包含违规词：
- 躺赚、零成本、日入、月入、暴利
- 必赚、保证、绝对、100% 等

### 5. 素材清单

列出需要的素材：
- 截图列表
- 引用的知识文章
- 数据来源路径

## 📁 目录结构

```
content-fusion/
├── skill.md                    # Skill 文档
├── README.md                   # 本文件
├── main.py                     # 主程序
├── test.py                     # 快速测试
├── config.yaml                 # 配置文件
├── requirements.txt            # 依赖
├── IMPLEMENTATION_REPORT.md    # 实施报告
├── modules/                    # 核心模块
│   ├── fact_loader.py          # 事实加载器
│   ├── knowledge_retriever.py  # 知识检索器
│   ├── style_loader.py         # 风格加载器
│   ├── content_generator.py    # 内容生成器
│   └── output_formatter.py     # 输出格式化器
├── templates/                  # Jinja2 模板
├── prompts/                    # Prompt 模板
└── examples/                   # 示例
    └── 统计年鉴数据/
        ├── input.yaml
        └── output/
```

## 🔧 配置说明

编辑 `config.yaml`：

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

## 📖 使用文档

详细文档请参考：
- **skill.md**: 完整功能说明和使用方法
- **IMPLEMENTATION_REPORT.md**: 实施报告和验收结果

## ✅ 核心特性

### 三源融合
将项目事实、项目知识、风格特征有机融合，生成自然流畅的文案。

### 可追溯性
每个关键数据都标注来源，可回溯到原始证据。

### 合规检查
自动检查违规词，确保内容安全合规。

### 双格式输出
同时输出 Markdown（人类阅读）和 JSON（程序处理）格式。

## 📊 示例数据

项目自带"统计年鉴数据"完整示例：

**输入**：
- 产品名称: 统计年鉴数据
- 证据包: goofish-research 输出
- 风格卡: 通用风格

**输出**：
- 视频脚本: 7 个段落，170 秒
- 标题方案: 3 个方案，评分 8.0-8.8
- 商品描述: 结构化描述
- 合规报告: ✅ 通过（0 个违规词）

查看输出：`examples/统计年鉴数据/output/`

## 🛠️ 技术栈

- Python 3.8+
- PyYAML: 配置文件解析
- Jinja2: 模板渲染

## 📝 版本历史

### v1.0.0 (2026-07-27)
- ✅ 初始版本
- ✅ 支持视频文案、标题优化、商品描述生成
- ✅ 支持三源融合（事实+知识+风格）
- ✅ 支持可追溯性和合规检查
- ✅ 完整示例和文档

## 🤝 贡献

本 Skill 由 Codex Agent 实施完成。

## 📄 许可

Internal use only.

---

**快速链接**:
- [完整文档](skill.md)
- [实施报告](IMPLEMENTATION_REPORT.md)
- [示例输出](examples/统计年鉴数据/output/)
