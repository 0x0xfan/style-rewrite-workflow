# Generation Validation Report

## 状态

- 状态：failed
- Contract：`test-case-001/source-contract.md`
- Knowledge Pack：`test-case-001/knowledge-pack.json`
- Metadata：`test-case-001/adversarial-invalid-knowledge-metadata.json`
- 生成稿：`test-case-001/generated-copy.md`
- 风格样本引用源：`test-case-001/reference-corpus-fixture.md`

## 汇总

| 检查项 | 结果 |
|---|---|
| 知识输入 | 通过 |
| 知识实际使用 | 失败 |
| 可读长度 | 通过 |
| 禁用词 | 通过 |
| 数据保留 | 通过 |
| 数据主体与关系 | 通过 |
| 20 字引用泄漏 | 通过 |

## ✅ 通过项

- Knowledge Pack 包含 2 条可审计来源。
- 生成稿长度为 617 个字符。
- 未命中观众稿禁用词。
- 已保留 17 项锁定字面值。
- 已保留 8 组数据主体与关系。
- 未发现至少 20 字的连续引用重合。

## ⚠️ 警告项

- 无

## ❌ 失败项

- 实际使用的知识来源不足：要求至少 1 条，当前可验证 0 条。
- 元数据引用了不存在的知识来源：k99。
- 有 1 条知识使用记录缺少 section/use_as，或 use_as 不在来源允许用途内。

## 建议修改

- 为实际使用的知识记录有效 source_id 和正文原句；知识中的数值或定量结果先核实并写入 Contract。
