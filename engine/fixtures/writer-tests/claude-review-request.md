# Claude 只读审查任务

你是独立、只读的审查员。请只读取文件，严禁编辑、创建、删除文件，也不要运行 shell 命令。

## 目标

评估 `EXECUTION_PLAN.md` 的阶段 3（生成后验证）和阶段 4（隔离端到端测试）是否按计划完成，以及是否存在会让测试结果虚假的缺陷。

## 读取范围

- `EXECUTION_PLAN.md`
- `engine/skills/style-copywriter/SKILL.md`
- `engine/skills/style-copywriter/generator-core.md`
- `engine/skills/style-copywriter/scripts/validate-generated-copy.mjs`
- `engine/fixtures/writer-tests/README.md`
- `engine/fixtures/writer-tests/test-case-001/source-contract.md`
- `engine/fixtures/writer-tests/test-case-001/knowledge-pack.json`
- `engine/fixtures/writer-tests/test-case-001/reference-corpus-fixture.md`
- `engine/fixtures/writer-tests/test-case-001/generated-copy.md`
- `engine/fixtures/writer-tests/test-case-001/generation-metadata.json`
- `engine/fixtures/writer-tests/test-case-001/validation-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-missing-data.md`
- `engine/fixtures/writer-tests/test-case-001/negative-validation-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-forbidden-term.md`
- `engine/fixtures/writer-tests/test-case-001/negative-forbidden-term-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-leakage.md`
- `engine/fixtures/writer-tests/test-case-001/negative-leakage-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-missing-subject.md`
- `engine/fixtures/writer-tests/test-case-001/negative-missing-subject-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-empty-knowledge-pack.json`
- `engine/fixtures/writer-tests/test-case-001/negative-empty-knowledge-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-invalid-knowledge-metadata.json`
- `engine/fixtures/writer-tests/test-case-001/negative-invalid-knowledge-usage-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-fake-knowledge-usage-metadata.json`
- `engine/fixtures/writer-tests/test-case-001/negative-fake-knowledge-usage-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-ungrounded-knowledge-numeric.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-ungrounded-knowledge-numeric-metadata.json`
- `engine/fixtures/writer-tests/test-case-001/negative-ungrounded-knowledge-numeric-report.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-ungrounded-knowledge-outcome.md`
- `engine/fixtures/writer-tests/test-case-001/adversarial-ungrounded-knowledge-outcome-metadata.json`
- `engine/fixtures/writer-tests/test-case-001/negative-ungrounded-knowledge-outcome-report.md`
- `engine/fixtures/writer-tests/test-case-001/human-review.md`

## 已知边界

- 阶段 2 自动事实提取、阶段 5 批量能力不在本轮范围。
- 钱十七 DNA 仍是 `draft/review_only`，测试必须是 `evaluation_only`，不得宣称正式仿写完成。

## 输出要求

用中文输出：

1. 结论：通过 / 需修改 / 不通过。
2. 事实锁、数据主体、禁用词、20 字泄漏扫描是否实现可靠。
3. 正例与对抗样本能否分别证明事实锁、数据主体、禁用词、引用泄漏、空知识包、伪造使用记录与未锁定知识数值检查真的工作。
4. 阶段 4 是否构成可复现端到端测试。
5. `generation-metadata.json` 是否与正例报告一致，且保持 `evaluation_only` 边界。
6. 最多 5 条按严重性排序的具体问题；每条必须给文件路径和原因。

不要客套，不要泛泛建议，不要修改任何文件。
