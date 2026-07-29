# 生成器核心逻辑

## 1. 验证知识输入

生成前读取 `knowledge-pack.json`：

1. 校验 `schema_version: 1.0`、可审计的非空 `query` 与 `minimum_used_sources >= 1`；`sources` 非空，且每项都有唯一 `id`、`title`、可回读 `locator`、非空 `excerpt` 和至少一个合法 `allowed_uses`。
2. 只选择与 contract 主题、受众或步骤直接相关的条目；长稿通常使用 2–4 条，最少实际使用 1 条。
3. 建立 `source_id -> section -> use_as -> output_excerpt` 映射。`source_id` 必须精确存在，且 `use_as` 必须获该来源允许；知识只补充 explanation、method、mechanism 或 risk。
4. 知识中的数字、收益、案例、时效、平台规则和效果结论若未进入 contract，禁止写入观众稿。任何知识使用片段中的数值或受支持的定量/结果主张都必须能在 contract 中回读。
5. 缺少知识、零相关结果或无法建立映射时返回 `abstain`，不得继续生成。

## 2. 解析 Style DNA

优先读取 1.1 JSON 档案：

- `selector_signals`
- `content_types`
- `frameworks`
- `patterns`
- `avoid_patterns`
- `boundaries`
- `rewrite_interface`
- `generation_interface`

Markdown 仅作为人读兼容输入。若 Markdown 缺少可执行 selector，要求调用方在配置中明确 `framework`；不要根据标题或经验猜选。

## 3. 选择框架

1. 仅评估 `availability: selectable` 的 content type、framework 和 pattern。
2. 以 contract 已登记的结构化信号计算 selector。
3. `requires_all` 必须全真，`excludes_any` 必须全假。
4. 按 `priority`、再按 `prefers_any` 命中数量排序。
5. 无候选或最高分并列时返回 `abstain`。
6. 配置显式指定 framework 时，仍须检查 selector 和必需槽位；不适用则返回 `abstain`。

## 4. 组织 beats

按所选 framework 的既定顺序生成。对每个 beat：

1. 读取 `input_slots`。
2. 只使用对应的 contract 内容。
3. 执行 `generation_instruction` 与 `transformation_rule`。
4. 核对 `preserve` 关系。
5. 缺少必需输入时执行该 beat 的 `fallback`；fallback 仍不能保留事实时停止。

先用 contract 完成 framework 基线，再把已筛选知识补入对应 beat，最后评估可选规则。不得为了塞入知识或使用 pattern 重排已选 framework 的开头、主体职责、信息顺序或收束。

## 5. 应用 patterns

对每条 pattern：

- 仅在 `availability: selectable`、适用条件成立、位置允许时使用。
- 尊重 `min_per_script`、`max_per_script` 和 `avoid_adjacent_repeat`。
- `intensity` 只能减少可选 pattern 的数量，不能突破上限或逼迫不适用规则出现。
- pattern 不得新增收益、案例、紧迫性、人物身份、平台背书、因果或结果。

记录实际应用的规则 ID 与对应段落，写入元数据。

## 6. 执行 avoid patterns

逐条检查所有适用 avoid pattern。任何 violation 都必须重写，无法重写则停止输出。重点检查：

- 观众稿出现审计、截图、原稿、资料来源或生成过程元话语。
- 风格来源事实泄漏进目标内容。
- 数据主体、数值、单位、范围、条件或触发机制被删除、模糊或改写。
- 未锁定的 CTA、收益承诺、平台规则或风险结论被新增。

## 7. 写出产物并验证

输出观众稿时只写口播内容。另写元数据：

```json
{
  "framework_used": "...",
  "rules_applied": ["..."],
  "knowledge_sources_used": [
    {
      "source_id": "k01",
      "section": "...",
      "output_excerpt": "...",
      "use_as": "method"
    }
  ],
  "generation_timestamp": "...",
  "validation_status": "pending"
}
```

若 profile 不是 approved，增加 `delivery_status: evaluation_only`；不要宣称成稿已通过人工风格或事实审阅。

写出后立即运行：

```powershell
node scripts/validate-generated-copy.mjs `
  --contract '<source-contract.md>' `
  --knowledge '<knowledge-pack.json>' `
  --metadata '<generation-metadata.json>' `
  --copy '<generated-copy.md>' `
  --report '<generation-validation-report.md>' `
  --reference '<可选：风格样本原文>'
```

验证器失败时，将 `validation_status` 保持为 `failed`，不要把观众稿当作可交付成稿。若 contract 没有提供可机器检查的事实锁，报告必须保留该警告。
