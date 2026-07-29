# Generation Validation Report

## 状态

- 状态：failed
- Contract：`test-case-001/source-contract.md`
- Knowledge Pack：`test-case-001/knowledge-pack.json`
- Metadata：`test-case-001/generation-metadata.json`
- 生成稿：`test-case-001/adversarial-forbidden-term.md`
- 风格样本引用源：`test-case-001/reference-corpus-fixture.md`

## 汇总

| 检查项 | 结果 |
|---|---|
| 知识输入 | 通过 |
| 知识实际使用 | 通过 |
| 可读长度 | 通过 |
| 禁用词 | 失败 |
| 数据保留 | 通过 |
| 数据主体与关系 | 通过 |
| 20 字引用泄漏 | 通过 |

## ✅ 通过项

- Knowledge Pack 包含 2 条可审计来源。
- 已在正文中核验 1 条知识来源的使用片段。
- 生成稿长度为 312 个字符。
- 已保留 17 项锁定字面值。
- 已保留 8 组数据主体与关系。
- 未发现至少 20 字的连续引用重合。

## ⚠️ 警告项

- 无

## ❌ 失败项

- 命中面向观众稿的禁用词：根据你提供的。

## 建议修改

- 删除审计、来源、截图或改写过程元话语。
