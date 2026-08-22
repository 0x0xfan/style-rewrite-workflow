# Style Copywriter 测试案例库

本目录验证 `style-copywriter` 的生成后检查链路，不替代用户对风格相似度和事实真实性的最终判断。

## 当前用例

- `test-case-001`：合成的本地咖啡店预约与回访表服务，明确不是闲鱼虚拟资料项目。

当前用例包含 1 个正例和 9 个对抗分支；正例必须退出 `0`，每个对抗分支必须退出 `1`。

每个用例必须保存：

- `source-raw.md`：原始测试文案或测试事实。
- `source-contract.md`：人工锁定的事实与验证清单；阶段 2 的自动提取器尚未实现。
- `knowledge-pack.json`：本次生成强制使用的知识库检索结果；必须非空并可回读。
- `generated-copy.md`：评价模式下的生成稿，不是正式交付。
- `generation-metadata.json`：本次 framework、规则、知识使用位置和状态。
- `validation-report.md`：自动验证输出。
- `human-review.md`：人工可读性、事实和风格判断；未签署不等于用户批准。
- `reference-corpus-fixture.md`：只供本地泄漏扫描使用的合成引用源，不含真实 IP 语料。
- `adversarial-missing-data.md` 与 `negative-validation-report.md`：故意缺失锁定数据的拒绝分支证据。
- `adversarial-forbidden-term.md` 与 `negative-forbidden-term-report.md`：事实完整但命中观众稿禁用词。
- `adversarial-leakage.md` 与 `negative-leakage-report.md`：事实完整但复制合成引用源的连续片段。
- `adversarial-missing-subject.md` 与 `negative-missing-subject-report.md`：数据字面值完整但缺少数据主体。
- `adversarial-empty-knowledge-pack.json` 与 `negative-empty-knowledge-report.md`：知识输入存在但零结果。
- `adversarial-invalid-knowledge-metadata.json` 与 `negative-invalid-knowledge-usage-report.md`：元数据伪报不存在的知识来源。
- `adversarial-fake-knowledge-usage-metadata.json` 与 `negative-fake-knowledge-usage-report.md`：来源 ID 真实但正文使用片段是伪造的。
- `adversarial-ungrounded-knowledge-numeric.md` 与 `adversarial-ungrounded-knowledge-numeric-metadata.json`：知识使用片段新增了 contract 没有的数值主张。
- `adversarial-ungrounded-knowledge-outcome.md` 与 `adversarial-ungrounded-knowledge-outcome-metadata.json`：知识使用片段新增了未锁入 contract 的中文定量/结果主张。

运行：

```powershell
node ../../skills/style-copywriter/scripts/validate-generated-copy.mjs `
  --contract ./test-case-001/source-contract.md `
  --knowledge ./test-case-001/knowledge-pack.json `
  --metadata ./test-case-001/generation-metadata.json `
  --copy ./test-case-001/generated-copy.md `
  --report ./test-case-001/validation-report.md `
  --reference ./test-case-001/reference-corpus-fixture.md
```

从本目录运行上述命令。正例应返回退出码 `0` 和状态 `passed`。再将 `--copy` 与 `--report` 分别替换为下列组合；每个对抗样本都应返回退出码 `1` 和状态 `failed`：

| 对抗样本 | 报告 | 独立证明的检查 |
|---|---|---|
| `adversarial-missing-data.md` | `negative-validation-report.md` | 长度、事实锁、数据主体 |
| `adversarial-forbidden-term.md` | `negative-forbidden-term-report.md` | 禁用词 |
| `adversarial-leakage.md` | `negative-leakage-report.md` | 20 字连续引用泄漏 |
| `adversarial-missing-subject.md` | `negative-missing-subject-report.md` | 数据存在但主体关系缺失 |
| 正例稿 + `adversarial-empty-knowledge-pack.json` | `negative-empty-knowledge-report.md` | 强制知识输入不得为空 |
| 正例稿 + `adversarial-invalid-knowledge-metadata.json` | `negative-invalid-knowledge-usage-report.md` | 知识来源 ID 与正文使用记录必须可核验 |
| 正例稿 + `adversarial-fake-knowledge-usage-metadata.json` | `negative-fake-knowledge-usage-report.md` | 真实来源 ID 也不能伪造正文使用片段 |
| `adversarial-ungrounded-knowledge-numeric.md` + `adversarial-ungrounded-knowledge-numeric-metadata.json` | `negative-ungrounded-knowledge-numeric-report.md` | 知识使用片段的数值主张必须已锁入 contract |
| `adversarial-ungrounded-knowledge-outcome.md` + `adversarial-ungrounded-knowledge-outcome-metadata.json` | `negative-ungrounded-knowledge-outcome-report.md` | 中文定量/结果主张也必须已锁入 contract |

现行验证器要求同时传入 `--knowledge` 与 `--metadata`。缺少任一输入必须报错退出；知识包零来源、缺少审计 query、来源缺少可回读字段/合法用途、元数据没有有效知识使用记录、用途未获来源允许，或正文找不到 `output_excerpt` 必须判定失败。知识使用片段中的数值及受支持的中文定量/结果主张也必须能在 contract 中找到。

所有命令只依赖仓库内文件和 Node.js，不读取 F 盘或其他外部语料。合成引用源只证明泄漏扫描分支可复现，不能替代正式生成时对实际、已获准读取的风格语料执行扫描，也不证明生成稿与钱十七真实语料不存在重合。

`generation-metadata.json` 必须与正例报告一致：评价模式保持 `delivery_status: evaluation_only`，且只有正例报告为 `passed` 时才记录 `validation_status: passed`。
