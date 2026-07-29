# xianyu-knowledge-writer

> 闲鱼知识增强风格仿写 Skill v1.0.0

结合闲鱼知识库生成风格化、合规的闲鱼运营内容。

## 快速开始

### 1. 查看示例

```bash
# 虚拟产品选品文案示例
cat examples/example-01-product.md

# 标题优化示例
cat examples/example-02-title.md

# 客服话术示例
cat examples/example-03-script.md
```

### 2. 测试工具函数

```bash
python skill_utils.py
```

预期输出:
```
[OK] 解析成功
[OK] 找到 5 篇相关文章
[OK] 风格卡加载成功: 钱十七
[OK] Prompt 构建完成
```

### 3. 使用 Skill

创建输入 YAML 文件:

```yaml
# input.yaml
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
  tags: ["选品策略", "虚拟产品"]
  risk_check: true
```

## 功能特性

- ✅ **知识增强**: 基于 220+ 篇闲鱼运营经验文章
- ✅ **风格适配**: 支持钱十七等风格卡
- ✅ **合规保障**: 自动检查 50+ 违规词
- ✅ **场景定制**: 支持选品、标题、引流、客服、售后
- ✅ **知识溯源**: 标注所有引用来源

## 支持场景

| 场景 | 输出类型 | 示例 |
|------|----------|------|
| 选品 | 选品分析文案 | [example-01](examples/example-01-product.md) |
| 标题 | 标题优化方案（3-5个） | [example-02](examples/example-02-title.md) |
| 引流 | 引流话术/文案 | - |
| 客服 | 结构化话术 | [example-03](examples/example-03-script.md) |
| 售后 | 售后处理话术 | - |

## 文档

- **完整文档**: [SKILL.md](SKILL.md)
- **实施报告**: [IMPLEMENTATION-REPORT.md](IMPLEMENTATION-REPORT.md)
- **测试用例**: [tests/test-cases.md](tests/test-cases.md)

## 依赖

**必需**:
- Python 3.x
- 闲鱼知识库 (`D:\项目仓库\闲鱼知识库`)
- `knowledge_api.py`

**可选**:
- 风格卡文件 (`profiles/*.md`)

## 架构

```
输入 (YAML) 
    ↓
skill_utils.parse_input()      # 解析验证
    ↓
skill_utils.search_knowledge() # 知识检索
    ↓
skill_utils.load_style()       # 风格加载（可选）
    ↓
skill_utils.build_prompt()     # Prompt 构建
    ↓
[AI 生成内容]                  # 外部 AI 模型
    ↓
skill_utils.check_compliance() # 合规检查
    ↓
skill_utils.format_output()    # 格式化输出
    ↓
输出 (结构化结果 + 审计报告)
```

## 核心函数

```python
from skill_utils import SkillUtils

utils = SkillUtils()

# 1. 解析输入
parsed = utils.parse_input(input_data)

# 2. 检索知识
knowledge = utils.search_knowledge(parsed)

# 3. 加载风格（可选）
style_dna = utils.load_style("钱十七")

# 4. 构建 Prompt
prompt = utils.build_prompt(parsed, knowledge, style_dna)

# 5. 合规检查
violations = utils.check_compliance(generated_content)

# 6. 格式化输出
output = utils.format_output(generated_content, parsed, knowledge, style_dna, violations)
```

## 测试状态

| 测试项 | 状态 |
|--------|------|
| 输入解析 | ✅ 通过 |
| 知识检索 | ✅ 通过（5篇文章）|
| 风格加载 | ✅ 通过 |
| Prompt 构建 | ✅ 通过（3286字符）|
| 违规词检查 | ✅ 通过 |

详见: [IMPLEMENTATION-REPORT.md](IMPLEMENTATION-REPORT.md)

## 示例效果

### 虚拟产品选品文案

**输入**: 虚拟产品、0成本、易操作、快速变现  
**输出**: 850字选品指南文案，包含3个避坑原则和实操路径  
**风格**: 钱十七（痛点开场、编号清晰、CTA明确）  
**合规**: ✅ 无违规词  

### 标题优化

**输入**: iPhone 13 Pro、256G、九成新  
**输出**: 5个标题方案，每个含优化策略和曝光预估  
**知识**: 基于闲鱼标题优化知识库  
**合规**: ✅ 无违规词  

### 客服话术

**输入**: 服饰鞋包、议价场景、已是底价  
**输出**: 15+条结构化话术，覆盖5个阶段  
**知识**: 融合议价应对知识+话术库  
**合规**: ✅ 检测并修正"最低价"→"底价"  

## 注意事项

1. **知识准确性**: 内容基于知识库，请确保知识库更新
2. **合规优先**: 违规词检查为强制项
3. **人工审核**: 发布前请人工复核
4. **证据要求**: 数字和案例必须真实

## 版本历史

- **v1.0.0** (2026-07-27): 初始版本
  - 支持 5 种场景
  - 集成知识库 API
  - 支持风格卡
  - 违规词自动检查

## 贡献

欢迎提交 Issue 和 Pull Request！

## License

内部项目，保留所有权利。

---

**开发**: Codex Agent  
**维护**: 风格仿写项目团队  
**更新**: 2026-07-27
