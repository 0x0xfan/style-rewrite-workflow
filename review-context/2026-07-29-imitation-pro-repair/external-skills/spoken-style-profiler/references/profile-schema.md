# Style DNA 1.1 契约

## 目录

1. 顶层结构与兼容性
2. 状态与证据
3. 确定性选择器
4. 沟通人格与内容策略
5. 框架、节拍与受众意图
6. 注意力节奏
7. 表达规则与负面风格
8. 内容锁与控制优先级
9. 生成测试与批准绑定

## 1. 顶层结构与兼容性

1.1 机器档案只能使用精确版本 `1.1-draft` 或 `1.1-approved`，并包含：

```text
profile_id / display_name / domain / status / approval
corpus
selector_signals[]
communication_persona[]
content_strategy[]
content_types[]
frameworks[]
attention_rhythm
patterns[]
avoid_patterns[]
boundaries[]
rewrite_interface
generation_interface
limitations[]
```

使用 `assets/profile-template.json` 起草。validator 使用顶层白名单；纯文本 profile 在任意层级都不得加入 visual、camera、shot、B-roll、palette、typography 等视觉命名空间。

公开档案不得保存 `source_text`、`raw_text`、`sample_text`、`original_text`、`source_quote`、`cta_keyword`、`account_name` 等来源载荷。1.0 只允许精确的 `1.0-draft` 回读，并产生 legacy warning；不存在可批准的 1.0 版本。

Corpus 继续按独立 cluster 记账。每个 included unit 必须且只能属于一个 cluster；证据中的 unit、cluster 和 anchor 必须与 manifest、decisions、annotations 和 profile 一致。

## 2. 状态与证据

规则状态固定为：

- `observation` → `review_only`；不可进入任何生成案例。
- `candidate` → `profile_approval_required`；至少两个独立 cluster 支持。
- `approved` → `selectable`；仅能存在于整体已批准的 profile。

`communication_persona`、`content_strategy` 等控制规则至少包含：

```text
id / name / status / availability
definition
generation_instruction
applicability / non_applicability
evidence[]
risk
```

`generation_instruction` 必须是消费目标内容槽位的命令式动作，不得只是“有冲击力”“更像朋友”等评价。candidate/approved 的证据至少覆盖两个独立 cluster；框架还必须满足完整路径门槛。

## 3. 确定性选择器

先在 `selector_signals[]` 声明有类型的信号目录：

```json
{
  "id": "content.has_steps",
  "source_path": "steps",
  "operator": "nonempty_array",
  "description": "目标内容包含至少一个步骤"
}
```

允许的 operator：`exists`、`missing`、`nonempty_array`、`empty_array`、`equals`、`not_equals`、`number_gte`、`number_lte`。后四类比较 operator 按契约提供 `value`。信号只读取 generation case 的私有 `content contract`，不得由模型临时解释自由文本标签。

每个 content type 和 framework 的 selector 必须引用已登记的 signal ID：

```json
{
  "requires_all": ["content.has_steps"],
  "prefers_any": ["content.has_evidence"],
  "excludes_any": ["content.primary_value_is_personal_story"],
  "abstain_when": ["步骤意义无法锁定"],
  "priority": 60
}
```

解析顺序：先 content type，再在该类型下选 framework。`requires_all` 全真且 `excludes_any` 全假才可入围；按 `priority`、命中的 `prefers_any` 数量排序。最高分并列或无匹配时必须 `abstain`，不得用 ID 排序偷偷决定赢家。`abstain_when` 是人读说明，不参与机器判定。

## 4. 沟通人格与内容策略

`communication_persona[]` 的 `dimension` 只能使用：`narrator_position`、`speaker_position`、`audience_relationship`、`authority_source`、`default_stance`、`certainty_policy`。`narrator_position` 只在多篇样本反复出现明确的自我介入动作时使用；单次第一人称、身份签名或“我看/我拆”不足以建立该层。`speaker_position` 描述更宽泛的可观察讲述姿态。两者都不推断真实人格、心理、职业资历、身份或动机。

`content_strategy[]` 的 `category` 只能使用：`topic_lens`、`reasoning_move`、`persuasion_move`、`evidence_policy`、`cta_policy`、`cognitive_journey`、`opportunity_packaging`。它只描述反复出现的选题和推理动作，不宣称作者私人世界观。

- `cognitive_journey`：仅在多个独立样本存在完整、同序的“起始理解 → 挑战 → 目标判断 → 过渡手段”时记录。局部纠偏句不能拼成全文旅程。
- `opportunity_packaging`：仅在多个独立样本反复出现稳定的价值呈现顺序时记录。普通的案例切入、数据解释或结尾总结分别归入框架/evidence/reasoning，不为追求完整而强行合并。

两类规则都需要生成动作、适用与禁用条件、证据和风险。它们默认是框架之后的可选增强：不得改变 framework 已选定的开头类型、主体职责、信息顺序和收束方式；发生冲突时框架优先。叙事位置只能读取目标内容允许使用的身份和动作；没有对应槽位时不生成第一人称研究过程。selector 已 abstain 时不得继续应用这些控制。

## 5. 框架、节拍与受众意图

Framework 保留 `when_to_use` / `do_not_use` 供人读，同时必须提供 selector。每个 beat 包含：

```json
{
  "id": "b01",
  "role": "hook",
  "required": true,
  "purpose": "说明该节拍承担什么",
  "input_slots": ["content.core_claim"],
  "transformation_rule": "只改变呈现方式",
  "generation_instruction": "把目标内容已有主张放到第一句，不新增结果",
  "audience_effect": "establish_relevance",
  "preserve": ["claim.meaning"],
  "fallback": "缺少可用主张时 abstain"
}
```

`audience_effect` 是文本预期作用，只能使用：`establish_relevance`、`create_curiosity`、`set_expectation`、`reduce_uncertainty`、`increase_clarity`、`reset_attention`、`support_trust`、`prompt_action`、`leave_reflection`、`unknown`。它不是实际留存、信任、情绪或转化证明。

候选框架的每个必需 beat 必须有至少两个独立、完整且同序的证据路径。不同样本的碎片不能拼成一条从未出现过的路径。

## 6. 注意力节奏

`attention_rhythm.basis` 只能是 `textual_function_inference`、`audio_verified`、`mixed` 或 `unknown`。stage 至少包含：

```text
id / name / status / availability
relative_range = [0..1, 0..1]
audience_state / objective / mechanism
generation_instruction / intensity / evidence[] / risk
```

区间按起点排序；`intensity` 只能是 low、medium、high、unknown。纯文本 basis 只能描述结构位置和文本意图，不能宣称语速、停顿、留存或真实情绪已验证。

## 7. 表达规则与负面风格

Pattern 除公式、适用/不适用、输入槽位、preserve、证据和风险外，还必须包含：

```json
{
  "generation_instruction": "明确的生成动作",
  "application_control": {
    "positions": ["entry", "body"],
    "min_per_script": 0,
    "max_per_script": 1,
    "avoid_adjacent_repeat": true
  },
  "avoid_when": ["content.primary_value_is_personal_story"]
}
```

`positions` 只能使用 entry、body、close、any。candidate/approved 的 `max_per_script` 至少为 1。输出审计必须把每次应用绑定到真实输出的字符 span；它是经人工确认的记账，不是自动语义识别证明。

段落价值承接没有独立顶层字段。若它是某内容类型稳定路径的一部分，放在 framework 的可选 transition beat；若它跨多个框架反复作为局部句式出现，放在 pattern，公式写成“上一环节/当前状态 → 下一环节为什么重要或不做会怎样 → 进入方法”。同一生成动作二选一，不能同时复制到 framework、content strategy、attention 和 pattern。

`avoid_patterns[]` 每项包含：

```text
id / name / status / availability
basis = observed_contrast | absence_with_coverage | human_boundary
trigger / trigger_signals[] / avoid_instruction / rationale
evidence[]
```

“样本中没出现”本身不能证明“永远不用”。`absence_with_coverage` 必须在 limitations 说明覆盖范围；`human_boundary` 是人工安全边界，不得伪装成来源观察。输出审计记录每条可用规则的 violations；任何非空 violations 都失败。

## 8. 内容锁与控制优先级

`rewrite_interface` 声明目标内容字段、不可变关系和受众稿禁用元话语。它只规定锁什么，不存放目标内容值。

`generation_interface` 固定为：

```json
{
  "forward_test_required_before_approval": true,
  "selector_abstention_required": true,
  "fact_lock_source": "external_content_contract_and_output_audit",
  "conflict_policy": "fail_closed",
  "control_precedence": [
    "boundaries_and_content_locks",
    "selector_abstention",
    "avoid_patterns",
    "framework",
    "communication_persona_and_content_strategy",
    "attention_rhythm",
    "patterns"
  ],
  "required_checks": [
    "selector_resolution_bound",
    "content_lock_audit_matches",
    "output_artifact_bound",
    "pattern_span_audit_passed",
    "avoidance_span_audit_passed",
    "audience_meta_absent",
    "reference_leakage_scan_passed",
    "no_new_facts_human_confirmed",
    "no_style_source_facts_human_confirmed",
    "human_style_similarity_accepted",
    "overfit_absent_human_confirmed"
  ]
}
```

发生冲突时按上述优先级处理；同一层冲突或无法证明安全时 fail closed。`transformation_rule` 解释抽象原则，`generation_instruction` 给出执行动作；执行动作不得越过 preserve、boundaries 或 content locks。

## 9. 生成测试与批准绑定

Generation suite 使用精确版本 `1.1-draft` 或 `1.1-reviewed`，模式固定为 `evaluation_only`。每个 case 必须把实际文件及重算 SHA-256 绑定到：

- input；
- 外部 `content-contract.json`；
- positive/fallback 的 output；
- positive/fallback 的 `output-audit.json`。

content contract 私有保存 selector 所需目标内容结构和每个 immutable relation 的权威值；output audit 私有保存相同关系的人工提取值、pattern spans、avoidance findings 和事实污染 findings。validator 比较两侧规范化值，但不能自动证明 output audit 的语义提取一定正确；reviewed 状态仍需真实人工确认。

正式批准的 reviewed suite 必须为每个 selectable framework 覆盖 positive、excluded/abstain 和 fallback；为每个 selectable pattern 覆盖 max budget；为每个 selectable avoid pattern 覆盖 trigger。输出还要扫描过程性元话语和 reference-corpus 精确泄漏。

`approved` profile 必须同时提供 reviewed suite、外部 evidence bundle 和独立 approval record。profile 与 approval record 都要绑定五个摘要字段：`candidate_profile_sha256` 绑定审阅内容；`approved_control_state_sha256` 绑定实际控制项 status/availability；`evidence_bundle_sha256`、`generation_test_sha256`、`generation_output_set_sha256` 绑定证据、suite 与真实输出集合。Approved profile 不得残留 candidate/profile_approval_required；未批准项必须降为 observation 或移除。修改任一获批规则、控制状态、证据、测试或输出都会让旧批准记录失效。

批准记录必须声明 `decision_source=user_explicit_confirmation` 并完整通过五项 checklist。validator 只能拒绝明显的 AI reviewer 名称和检查记录格式，不能证明现实中的身份；Skill 不自行填写人工 reviewer 或把 draft 升为 approved。
