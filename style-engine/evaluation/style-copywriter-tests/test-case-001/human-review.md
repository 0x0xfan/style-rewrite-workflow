# 人工评审：test-case-001

## 边界

- 本用例使用合成的本地咖啡店服务事实，不是闲鱼虚拟资料。
- 钱十七 Style DNA 仍是 `draft/review_only`；本稿仅作隔离端到端评测，不能当作正式仿写交付或批准证据。
- 本文件的“初步评审”是执行者自检，不替代用户的风格确认。

## 初步评审

| 维度 | 结论 | 证据 |
|---|---|---|
| 事实准确性 | 自动检查通过 | `validation-report.md` 已确认 17 项字面值、8 组主体关系、禁用词和 20 字引用泄漏均通过。 |
| 基本风格结构 | 初步通过 | 具体案例/数据进入，说明为什么值得看，按 3 步拆服务，再回到试运行与维护机制。 |
| 可读性 | 初步通过 | 以短段落、具体动作和自然章节承接组织；没有对观众念审计过程。 |
| 正式风格相似度 >80% | 未测量 | 没有经过校准的自动相似度量表，必须由用户另行判断。 |

## 自动对抗验证

| 样本 | 预期 | 实际 | 独立失败原因 |
|---|---|---|---|
| `generated-copy.md` | `passed` | `passed` | 无 |
| `adversarial-missing-data.md` | `failed` | `failed` | 长度不足、17 项锁定字面值缺失、8 组主体关系不完整 |
| `adversarial-forbidden-term.md` | `failed` | `failed` | 仅命中禁用词“根据你提供的” |
| `adversarial-leakage.md` | `failed` | `failed` | 仅命中 20 字连续引用泄漏 |
| `adversarial-missing-subject.md` | `failed` | `failed` | 17 项字面值完整，但 `g01`、`g02` 的主体关系不完整 |
| 正例稿 + `adversarial-empty-knowledge-pack.json` | `failed` | `failed` | 知识包零来源，且元数据不能映射到有效来源 |
| 正例稿 + `adversarial-invalid-knowledge-metadata.json` | `failed` | `failed` | 元数据使用不存在的来源 ID `k99` |
| 正例稿 + `adversarial-fake-knowledge-usage-metadata.json` | `failed` | `failed` | 来源 ID 真实，但 `output_excerpt` 不在正文中 |
| `adversarial-ungrounded-knowledge-numeric.md` + 对应 metadata | `failed` | `failed` | 知识使用片段引入未锁入 contract 的 `4类` |
| `adversarial-ungrounded-knowledge-outcome.md` + 对应 metadata | `failed` | `failed` | 知识使用片段引入未锁入 contract 的 `四位数`、`百分之五十`、`十倍`、`翻倍`、`当天出单` |

元数据回读：`generation-metadata.json` 的 `delivery_status` 为 `evaluation_only`、`validation_status` 为 `passed`，与正例报告一致。人工签署仍保持未选择。

## 用户签署

- [ ] 事实关系可接受
- [ ] 基本风格可接受
- [ ] 需要按反馈重写
