# 口播语义标注指南

## 目录

1. 锚点
2. 段落职责
3. 关系型句式
4. 框架路径
5. 主张与证据
6. 节奏
7. 叙事位置、认知推进、机会包装与段落价值承接
8. 受众意图与信息角色
9. 常见误判

## 1. 锚点

使用稳定 ID，例如 `u03:p04` 或 `u03:p04:s02`。锚点只记录来源位置、相对位置和语义功能；公开 DNA 不保存原句。

每个锚点至少标注：

- `anchor_id`
- `unit_id`
- `relative_position`：0–1
- `function`
- `relations`
- `audience_effect`
- `information_role`
- `claim_ids` / `material_ids`（如适用）
- `annotation_confidence`

## 2. 段落职责

允许的基础职责包括：hook、promise、stance、credibility、preview、explanation、warning、method、proof、interaction、summary、cta、continuation。

这些是标注词汇，不是固定顺序。不同内容类型应形成不同路径。

## 3. 关系型句式

句式公式必须描述关系，而非关键词。例如：

- `常见认知 → 转折 → 真正关键`
- `预设质疑 → 立即回答 → 理由 → 动作`
- `抽象机制 → 熟悉类比 → 当前主题动作`
- `较低生活参照 → 较高生活参照`，前提是来源中确有两个参照和方向变化

每个公式写明输入槽位、适用条件、不适用条件、位置和风险。新稿比喻可以重新创作，但不得暗中改变目标内容的数值、主体、周期或条件。

## 4. 框架路径

框架不是段落名称清单，而是同一内容类型中反复出现的有序职责序列。

为每个样本路径记录：

```text
independence_cluster_id
unit_id
beat_id → anchor_id → ordinal
```

必需节拍至少由两个独立路径支持。可选节拍要标 `required: false`，不能用一个样本的偶发段落扩充所有框架。

## 5. 主张与证据

只有存在“主张—材料—证明作用”关系时，才标为 proof。记录：

- 主张是什么类型；
- 材料类型；
- 材料证明、示范、对比还是仅供操作；
- 材料出现于主张之前还是之后；
- 没有材料时该表达是否必须降级。

“截图”“数据”“表格”只是词，不自动构成证据。

## 6. 节奏

节奏至少观察：短句簇、长短句交替、反问、停顿、编号重置、互动重置、重复、段尾落点。转写标点不可靠时标记 unknown，不凭平均句长猜停顿。

## 7. 叙事位置、认知推进、机会包装与段落价值承接

这三层先用已有锚点和关系标注，不复制原句，也不虚构作者背景。

- 叙事位置：寻找 `stance`、`credibility`、`preview`、`method` 等锚点，记录文本中的说话者如何介入，例如先说明自己观察、拆解或测试过什么，再给判断和路径。只有目标内容也提供相应身份或动作时，下游才能用第一人称承接；否则退回中性讲述。
- 认知推进：至少区分起始理解、被挑战的关注点、目标判断和过渡手段。可使用 `common_view_to_challenge`、`challenge_to_new_standard`、`new_standard_to_action`、`action_to_generalization` 等抽象 relation；没有完整路线时只标局部关系。
- 机会包装：记录价值显现顺序，例如 `surface_signal_to_question`、`question_to_reveal`、`evidence_to_value_meaning`、`audience_state_to_relevance`、`specific_case_to_reusable_method`。表面与真实结果不构成同一关系时不得硬设悬念。
- 段落价值承接：只标主要章节边界。先识别上一环节或当前状态，再确认文本是否用下一环节的真实作用、收益、代价、未解决问题或不做后果提高其信息价值，最后才进入方法。可使用 `completed_stage_to_next_bottleneck`、`next_section_value_to_method` 等抽象 relation；只有“接下来/第一/第二”而没有价值说明时，不成立。

三层都必须区分“文本动作”和“真实效果”：可以说文本以拆解者位置推进、试图纠正某个关注点、把证据解释为某种价值；不能说作者现实中就是专家、观众已经被说服，或项目客观上必然值得做。

## 8. 受众意图与信息角色

`audience_effect` 写文本试图完成的受众状态变化，只能使用：

```text
establish_relevance / create_curiosity / set_expectation
reduce_uncertainty / increase_clarity / reset_attention
support_trust / prompt_action / leave_reflection / unknown
```

它是 intended effect，不是实测因果；不写“观众一定相信/购买”。仅有文本时，判断依据固定为文本位置、语义职责和关系结构，不能反推真实留存、情绪或转化。

`information_role` 写该锚点承载的信息职责，只能使用：

```text
core_claim / scope_preview / risk_boundary / method_step / reason
proof_of_claim / example / transition / interaction / cta
reflection / none / unknown
```

数据只有与主张建立证明关系时才标 `proof_of_claim`。不确定时使用 `unknown`，不要自造近义标签掩盖不确定性。

字段使用抽象标签或简短说明，不复制原句、数字、账号、关键词或来源事实。candidate/approved 的证据锚点必须同时具备两个字段。

## 9. 常见误判

- “注意看”不等于风险提示。warning 需要对象、原因/后果和结构位置。
- 两条相似转写不等于两个独立证据。
- “第一”不等于先有框架预告。
- 出现生活消费词不等于阶梯对比。
- 通用教程结构不等于某 IP 独有风格。
- 资料 CTA 不是所有 IP 或所有内容类型的必需节拍。
- 同一句包含风险词和方法词，不证明“先排雷再给方法”。
- 把 intended audience effect 写成真实效果证明。
- 从“没有出现某写法”直接推断 IP 永远不用该写法。
- 从纯文本推断镜头、B-roll、截图或大字版式偏好。
- 把第一人称“我看过/我拆过”直接推断为现实职业、资历或长期经验。
- 只看到一次反问或转折，就拼出完整认知旅程。
- 把普通的数据解释、相关性说明或结尾总结，一律命名为机会包装。
- 把所有章节标题都改成反问或“最关键”，冒充段落价值承接；真正的承接必须消费目标内容已有的理由、收益、后果或依赖关系，而且只用于主要章节边界。
