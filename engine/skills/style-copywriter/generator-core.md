# 生成器核心逻辑

## 1. 锁定用户任务

先读取 `task-brief.json`，并把用户原话、内容模式、framework 候选、叙事角色及目标观众初始能力状态当作不可改写约束。Contract 和 metadata 必须逐字段绑定该文件及其 SHA-256。

对候选 framework 的每个 required slot，核对允许的证据状态和证据登记 ID。市场页只能证明可见需求信号，测试动作只能证明计划存在；两者都不能自动升级为获客、成交、交付或收益证据。缺少真实订单或收益时，先降低对应 claim 的强度或省略结果 beat，不得自动把整篇机会测试稿拒绝；缺少需求信号、能力形成路径或任何可执行动作时，才换用其他 framework 或 `abstain`。

## 2. 验证知识输入

生成前读取 `knowledge-pack.json`：

1. 校验 `schema_version: 1.0`、可审计的非空 `query` 与 `minimum_used_sources >= 1`；`sources` 非空，且每项都有唯一 `id`、`title`、可回读 `locator`、非空 `excerpt` 和至少一个合法 `allowed_uses`。
2. 只选择与 contract 主题、受众或步骤直接相关的条目；长稿通常使用 2–4 条，最少实际使用 1 条。
3. 生成前建立 `source_id -> section -> use_as -> stance` 计划；正文生成后再绑定 `output_excerpt`。来源必须绑定本次 task brief SHA-256，章节、用途和立场都在允许范围内；`counterevidence/conflict` 只能用作 risk。
4. 知识中的数字、收益、案例、时效、平台规则和效果结论若未进入 contract，禁止写入观众稿。任何知识使用片段中的数值或受支持的定量/结果主张都必须能在 contract 中回读。
5. 缺少知识、零相关结果或无法建立映射时返回 `abstain`，不得继续生成。

## 3. 解析 Style DNA

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

## 4. 选择框架

1. 仅评估 `availability: selectable` 的 content type、framework 和 pattern。
2. 以 contract 已登记的结构化信号计算 selector。
3. `requires_all` 必须全真，`excludes_any` 必须全假。
4. 按 `priority`、再按 `prefers_any` 命中数量排序。
5. 无候选或最高分并列时返回 `abstain`。
6. 配置显式指定 framework 时，仍须检查 selector 和必需槽位；不适用则返回 `abstain`。

## 5. 生成前预检

候选 framework、知识使用计划和元数据写定后，在生成任何观众稿前运行 `scripts/validate-generation-inputs.mjs`。预检必须同时通过任务结构、任务语义锁、证据登记、framework 准入、知识语义相关性和验收状态六项；机械可读不代表任务正确。

## 6. 组织 beats

按所选 framework 的既定顺序生成。对每个 beat：

1. 读取 `input_slots`。
2. 只使用对应的 contract 内容。
3. 执行 `generation_instruction` 与 `transformation_rule`。
4. 核对 `preserve` 关系。
5. 缺少必需输入时执行该 beat 的 `fallback`；fallback 仍不能保留事实时停止。

先用 contract 完成 framework 基线，再把已筛选知识补入对应 beat，最后评估可选规则。不得为了塞入知识或使用 pattern 重排已选 framework 的开头、主体职责、信息顺序或收束。

对于项目/机会型内容，在写正文前另建 `listener_progression`，但它不是钩子数量表。先写全稿的 `core_question`，再为每个主要 beat 记录：

```text
question_before
-> information_revealed
-> meaning_for_viewer
-> expected_judgment_after
-> next_question
```

正文必须先回答前一节点的问题，再进入新的事实和动作。只有“第一块、接下来、这里注意”而没有揭晓、意义或判断变化时，只算转场，不算推进。该计划记录文本预期作用，不宣称真人注意力或认知已被改变。

## 7. 应用 patterns

对每条 pattern：

- 仅在 `availability: selectable`、适用条件成立、位置允许时使用。
- 尊重 `min_per_script`、`max_per_script` 和 `avoid_adjacent_repeat`。
- `intensity` 只能减少可选 pattern 的数量，不能突破上限或逼迫不适用规则出现。
- pattern 不得新增收益、案例、紧迫性、人物身份、平台背书、因果或结果。

记录实际应用的规则 ID 与对应段落，写入元数据。

## 8. 执行 avoid patterns

逐条检查所有适用 avoid pattern。任何 violation 都必须重写，无法重写则停止输出。重点检查：

- 观众稿出现审计、截图、原稿、资料来源或生成过程元话语。
- 风格来源事实泄漏进目标内容。
- 数据主体、数值、单位、范围、条件或触发机制被删除、模糊或改写。
- 未锁定的 CTA、收益承诺、平台规则或风险结论被新增。

## 9. 写出产物并验证

输出观众稿时只写口播内容。另写元数据：

```json
{
  "task_alignment": {
    "task_id": "...",
    "task_brief_sha256": "...",
    "content_mode": "...",
    "selected_framework": "...",
    "narrative_role_lock": {}
  },
  "framework_used": "...",
  "framework_gate_sha256": "...",
  "rules_applied": ["..."],
  "requires_style_application_audit": true,
  "required_style_controls": ["..."],
  "requires_listener_progression_audit": true,
  "listener_progression": {
    "core_question": "...",
    "beats": [
      {
        "id": "lp01",
        "question_before": "...",
        "information_revealed": "...",
        "meaning_for_viewer": "...",
        "expected_judgment_after": "...",
        "next_question": "...",
        "output_excerpt": "正文原句"
      }
    ]
  },
  "style_application": {
    "controls": [
      {"rule_id": "...", "purpose": "...", "output_excerpt": "正文原句"}
    ]
  },
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

风格转换稿不得只记录 `style_profile`、framework 或 `rules_applied`。稳定主干和实际启用的 pattern 都要写入 `style_application.controls`，并绑定其在本稿中的职责与正文原句；任何声明但无法在正文定位的规则都视为未应用。自动检查只验证落位，不能替代用户对“像不像”的判断。

观众稿、画面值和私有审计值必须分层。Contract 的 `required_literals` 可为每项声明 `surface: spoken | visual | audit`；只有 `spoken` 值要求进入口播。包名、命令、版本、URL、文件路径和密钥字段默认进入 visual/audit，除非目标语音词典已有明确发音别名。TTS 模式下运行原始技术字符串门禁，不能用“事实准确”迫使不可朗读字符进入正文。

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
