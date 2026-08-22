# Generation Validation Report

## 状态

- 状态：failed
- Contract：`test-case-001/source-contract.md`
- Knowledge Pack：`test-case-001/knowledge-pack.json`
- Metadata：`test-case-001/generation-metadata.json`
- 生成稿：`test-case-001/adversarial-missing-data.md`
- 风格样本引用源：`test-case-001/reference-corpus-fixture.md`

## 汇总

| 检查项 | 结果 |
|---|---|
| 知识输入 | 通过 |
| 知识实际使用 | 通过 |
| 可读长度 | 失败 |
| 禁用词 | 通过 |
| 数据保留 | 失败 |
| 数据主体与关系 | 失败 |
| 20 字引用泄漏 | 通过 |

## ✅ 通过项

- Knowledge Pack 包含 2 条可审计来源。
- 已在正文中核验 1 条知识来源的使用片段。
- 未命中观众稿禁用词。
- 未发现至少 20 字的连续引用重合。

## ⚠️ 警告项

- 无

## ❌ 失败项

- 生成稿少于 120 个字符，无法作为完整口播稿审阅。
- 缺少锁定字面值：d01a=7天、d01b=41条、d01c=26位、d02=2小时、d03=399元、d04=3张表、d05a=10:00、d05b=20:00、d06=24小时、d07a=12位、d07b=第6天、d08=18单复购、d09a=99元一个月、d09b=2家门店、d10a=30分钟、d10b=5分钟、d11=60%。
- 以下数据主体或关系不完整：g01_community_cafe_trial、g02_owner_time、g03_first_setup_price、g04_confirmation_window、g05_followup_condition、g06_trial_repurchase、g07_maintenance_scope、g08_target_not_result。

## 建议修改

- 补齐完整的开头、主体和收束后重新生成。
- 恢复缺失的数据、单位、条件或 CTA，且不要改变它们的含义。
- 让每组数据紧邻其主体、范围或触发条件，不要把案例、讲述者和店铺数据混写。
