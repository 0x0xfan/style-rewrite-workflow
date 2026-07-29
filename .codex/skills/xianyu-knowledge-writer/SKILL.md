# xianyu-knowledge-writer

## Metadata

```yaml
skill: xianyu-knowledge-writer
version: 1.0.0
description: 结合闲鱼知识库生成风格化、合规的闲鱼运营内容
requires:
  - knowledge_api.py (闲鱼知识库 API)
  - 闲鱼知识库数据 (D:\项目仓库\闲鱼知识库)
optional:
  - 风格卡（钱十七或其他 IP）
tags:
  - 闲鱼运营
  - 内容生成
  - 知识增强
  - 风格仿写
```

## 功能概述

`xianyu-knowledge-writer` 是一个结合闲鱼知识库的智能内容生成 Skill，能够：

1. **知识增强**: 基于 220+ 篇闲鱼运营经验文章生成内容
2. **风格适配**: 可选择性应用特定 IP 风格（如钱十七）
3. **合规保障**: 自动检查 50+ 违规词，确保内容安全
4. **场景定制**: 支持选品、标题、引流、客服、售后等多种场景
5. **知识溯源**: 标注引用的知识来源，确保内容可追溯

## Input Schema

### 必需字段

```yaml
project_facts:
  product_type: string      # 产品类型（如"虚拟产品"、"电子产品"、"服饰鞋包"）
  scenario: string          # 场景（选品/标题/引流/客服/售后）
  target_audience: string   # 目标受众（如"闲鱼新手"、"学生党"）
  key_points: list          # 核心卖点/特点列表
  constraints: list         # 约束条件（可选）
```

### 可选字段

```yaml
style_preference:
  style_card: string        # 风格卡名称（如"钱十七"）
  tone: string              # 语气（专业/亲切/幽默）
  length: string            # 长度（短/中/长）

knowledge_focus:
  tags: list                # 关注的标签（如["选品策略", "新手入门"]）
  include_scripts: bool     # 是否包含话术（默认 false）
  risk_check: bool          # 是否进行违规词检查（默认 true）
```

## Output Schema

```yaml
output:
  content:                  # 生成的文案
    text: string            # 主文案
    title: string           # 标题（如适用）
    sections: list          # 分段内容（如适用）
  
  metadata:                 # 元数据
    generated_at: datetime  # 生成时间
    scenario: string        # 场景类型
    style_card: string      # 使用的风格卡
  
  knowledge_sources:        # 知识来源
    - title: string         # 文章标题
      category: string      # 分类
      relevance: float      # 相关度分数
      key_points: list      # 提取的关键点
  
  compliance_report:        # 合规报告
    violations_found: int   # 发现的违规词数量
    violations_details: list # 违规词详情
    safe: bool              # 是否安全
  
  suggestions:              # 优化建议
    - type: string          # improvement/warning/info
      message: string       # 建议内容
```

## Processing Steps

### Step 1: 项目信息解析

解析并验证用户输入：

```python
# 验证必需字段
validate_required_fields(project_facts)

# 规范化品类名称
normalized_category = normalize_category(project_facts.product_type)

# 确定搜索标签
search_tags = determine_tags(project_facts.scenario, knowledge_focus.tags)
```

### Step 2: 知识库检索

调用闲鱼知识库 API 获取相关知识：

```python
from knowledge_api import KnowledgeAPI

# 初始化知识库客户端
kb_path = Path("D:\项目仓库\闲鱼知识库")
api = KnowledgeAPI(kb_root=kb_path)

# 按标签搜索相关文章
knowledge = api.search_by_tags(
    tags=search_tags,
    limit=5
)

# 获取品类知识（如果有）
category_knowledge = api.get_category_knowledge(normalized_category)

# 获取话术（如果需要）
if knowledge_focus.include_scripts:
    scripts = api.get_scripts_by_scenario(project_facts.scenario)

# 违规词预检查
violation_check = api.check_violations(
    ' '.join(project_facts.key_points)
)
```

### Step 3: 风格加载（可选）

如果指定了风格卡，加载风格特征：

```python
if style_preference.style_card:
    style_path = Path(f"profiles/{style_preference.style_card}-闲鱼风格拆解.md")
    
    if style_path.exists():
        with open(style_path, 'r', encoding='utf-8') as f:
            style_content = f.read()
        
        # 提取关键风格特征
        style_dna = extract_style_features(style_content)
        # style_dna 包含: persona, framework, patterns, tone
```

### Step 4: 构建生成 Prompt

整合所有信息构建生成 Prompt：

```markdown
# 闲鱼内容生成任务

## 项目事实
- **产品类型**: {product_type}
- **应用场景**: {scenario}
- **目标受众**: {target_audience}
- **核心卖点**: {', '.join(key_points)}
{f"- **约束条件**: {', '.join(constraints)}" if constraints else ""}

## 知识库参考

从闲鱼知识库检索到以下相关经验：

{format_knowledge_sources(knowledge)}

{f"## 品类知识\n\n{category_knowledge['content']}" if category_knowledge else ""}

{f"## 话术参考\n\n{format_scripts(scripts)}" if scripts else ""}

## 风格要求

{format_style_requirements(style_dna, style_preference) if style_dna else "请使用专业、亲切的闲鱼运营风格"}

## 合规要求

**必须避免的违规词**: {', '.join([v['word'] for v in violation_check])}

请生成{scenario_mapping[scenario]}内容，要求：

1. **知识融合**: 自然融入知识库中的经验和技巧
2. **风格一致**: 符合指定的表达风格和语气
3. **合规安全**: 严格避免所有违规词
4. **卖点突出**: 清晰展现产品核心优势
5. **场景适配**: 符合{scenario}场景的内容结构

{get_scenario_specific_requirements(scenario)}
```

### Step 5: 内容生成

调用 AI 生成内容（由 Codex Agent 执行）

### Step 6: 输出审计

对生成的内容进行审计：

```python
# 违规词二次检查
final_violations = api.check_violations(generated_content)

# 知识来源标注
knowledge_sources = format_knowledge_sources_output(knowledge)

# 风格符合度评估（如果有风格卡）
if style_dna:
    style_compliance = evaluate_style_compliance(generated_content, style_dna)

# 生成优化建议
suggestions = generate_suggestions(
    generated_content,
    final_violations,
    style_compliance,
    knowledge
)
```

## 使用示例

### 示例 1: 虚拟产品选品文案

**输入：**

```yaml
project_facts:
  product_type: "虚拟产品"
  scenario: "选品"
  target_audience: "闲鱼新手"
  key_points:
    - "0成本"
    - "易操作"
    - "快速变现"

style_preference:
  style_card: "钱十七"
  tone: "亲切"
  length: "中"

knowledge_focus:
  tags: ["选品策略", "虚拟产品", "新手入门"]
  risk_check: true
```

**调用方式：**

```bash
codex run xianyu-knowledge-writer --input input.yaml
```

### 示例 2: 标题优化

**输入：**

```yaml
project_facts:
  product_type: "电子产品"
  scenario: "标题"
  target_audience: "学生党"
  key_points:
    - "iPhone 13 Pro"
    - "256G"
    - "九成新"
    - "价格实惠"

knowledge_focus:
  tags: ["标题优化", "流量技巧"]
  risk_check: true
```

### 示例 3: 客服话术

**输入：**

```yaml
project_facts:
  product_type: "服饰鞋包"
  scenario: "客服"
  target_audience: "议价买家"
  key_points:
    - "已是最低价"
    - "包邮"
    - "支持验货"

knowledge_focus:
  tags: ["应对议价", "话术技巧"]
  include_scripts: true
  risk_check: true
```

## 场景映射

不同场景对应的输出要求：

| 场景 | 输出类型 | 特殊要求 |
|------|----------|----------|
| 选品 | 选品分析文案 | 包含品类特点、竞争分析、货源建议 |
| 标题 | 标题方案集 | 3-5 个标题方案，每个说明优化点 |
| 引流 | 引流话术/文案 | 突出吸引力，包含 CTA |
| 客服 | 结构化话术 | 开场→解释→促成，应对异议 |
| 售后 | 售后处理话术 | 安抚情绪，提供解决方案 |

## 依赖说明

### 知识库 API

本 Skill 依赖 `D:\项目仓库\闲鱼知识库\scripts\knowledge_api.py`，请确保：

1. 知识库路径正确
2. 索引文件已生成 (`cleaned/index.json`)
3. 违规词库存在 (`5-违规词库/`)
4. 话术库存在 (`4-话术库/`)

### 风格卡（可选）

风格卡位于 `profiles/` 目录，格式为 `{风格名}-闲鱼风格拆解.md`

当前可用风格卡：
- 钱十七 (`profiles/钱十七-闲鱼风格拆解.md`)

## 文件说明

```
.codex/skills/xianyu-knowledge-writer/
├── SKILL.md                    # 本文件：Skill 定义和使用说明
├── skill_utils.py              # 核心工具函数
├── templates/
│   ├── content-template.md     # 内容生成模板
│   └── audit-template.md       # 审计报告模板
├── examples/
│   ├── example-01-product.md   # 虚拟产品选品示例
│   ├── example-02-title.md     # 标题优化示例
│   └── example-03-script.md    # 客服话术示例
└── tests/
    └── test-cases.md           # 测试用例
```

## 注意事项

1. **知识准确性**: 所有生成内容基于知识库，请确保知识库内容准确
2. **合规优先**: 违规词检查为强制项，不可关闭
3. **风格适配**: 风格卡为可选项，不使用时将生成通用专业风格
4. **证据要求**: 如使用数字、案例，必须来自用户提供的事实，不可虚构
5. **知识溯源**: 输出必须标注引用的知识来源，确保可追溯

## 版本历史

- **v1.0.0** (2026-07-27): 初始版本
  - 支持 5 种场景（选品、标题、引流、客服、售后）
  - 集成闲鱼知识库 API
  - 支持风格卡加载（钱十七）
  - 违规词自动检查
  - 知识来源可追溯

## 支持与反馈

如有问题或建议，请在项目中提 Issue 或联系开发团队。
