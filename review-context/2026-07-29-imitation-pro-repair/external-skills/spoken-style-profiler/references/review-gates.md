# 风格档案审阅门禁

## 交付 draft 前

- [ ] 样本边界正确，文档总标题未计为口播单元。
- [ ] 近重复和转写变体已报告。
- [ ] 独立支持度按 cluster 计算，而不是按 unit 数计算。
- [ ] 每条规则有适用、不适用、证据锚点、风险和状态。
- [ ] 每个证据锚点有 audience effect 和 information role，且没有把意图写成效果证明。
- [ ] 沟通人格与内容策略只描述可观察行为，没有心理/身份推断。
- [ ] 内容类型和框架选择器可以拒绝不匹配输入，不依赖行业关键词。
- [ ] selector signal 使用已登记的 source_path/operator；无匹配和最高分并列都明确 abstain。
- [ ] 每个候选框架的必需节拍有两个独立路径支持且顺序一致。
- [ ] observation 为 `review_only`。
- [ ] 冲突结构已拆分或保留为 observation。
- [ ] 证据位置绑定到具体主张功能。
- [ ] 转写质量不足的节奏项标为 unknown。
- [ ] 机器档案通过 validate 和 leakage。
- [ ] 每条可生成 pattern 有命令式 generation instruction、使用预算和 avoid_when。
- [ ] 负面风格有正当 evidence basis，不由简单缺席推断。
- [ ] 已写出不超过两句的一句话核心模型，且它能解释多数高质量样本。
- [ ] 叙事位置、认知推进、机会包装均被当作可选增强；没有证据时留空，没有从局部句式拼成完整理论。
- [ ] 如果档案声称存在段落价值承接，证据包含“下一章节 + 真实价值/后果/未解决问题 + 方法入口”，而不只是编号、标题或“接下来”；没有把每个小步骤都强制包装。
- [ ] 已做规则去重：同一生成动作没有同时存在于 framework、strategy、attention 和 pattern 四层。
- [ ] 已用简单主框架基线对比叠加辅助控制的版本；辅助版没有更像目标 IP 时已回退。

## 人工批准前

- [ ] 用户确认样本保留、排除和合并决定。
- [ ] 用户逐项确认 candidate 是否真属于该 IP。
- [ ] 用户确认没有来源项目、收益、案例、账号、资料和 CTA 进入 DNA。
- [ ] 至少一条留出样本验证通过，或 limitation 明确说明无法留出。
- [ ] 隔离 generation test 的选择器、内容锁、规则预算、负面规则和元话语检查通过。
- [ ] 人工已审阅评测稿的风格相似、过拟合和来源污染。
- [ ] profile 中没有未解决决策。
- [ ] approved_by、approved_at 和 change_reason 有真实人工记录。
- [ ] 独立批准记录与 profile 的 record_id、reviewer 和 ISO 时间完全一致。
- [ ] reviewed generation test 与 profile_id、candidate profile digest 和 generation_test_id 完全一致；其 `profile_schema_version` 固定绑定 `1.1-draft` candidate 投影。
- [ ] reviewed suite 为每个可选框架覆盖 positive、excluded/abstain、fallback，并覆盖每条 pattern 上限和 avoid trigger。
- [ ] content contract、output 和 output audit 都绑定到真实文件摘要；output audit 的语义提取已由人复核。
- [ ] profile 与批准记录同时绑定当前 candidate profile、实际 approved control state、evidence bundle、generation suite 和 output set 摘要；approved profile 没有残留 candidate。

## 不得批准的情况

- 依赖同一内容的两个转写版本凑够证据。
- 框架只有 unit ID，没有段落/句子路径。
- 规则只由关键词共现推断。
- 单样本 observation 可被下游选择。
- 来源长句、具体数字、账号、资源或 CTA 泄漏。
- 通用口播常识被包装成 IP 独有特征。
- 未做跨 IP 前向测试却宣称 Skill 已通用。
- 无匹配框架时强行选择最近框架。
- 只验证“能拆解”，没有验证控制规则能否指导隔离生成。
- 新增理论层后测试稿比更简单基线更差，却仍以“模型更完整”为由保留。
- 把单个测试稿的修稿意见、目标内容专属揭晓顺序或一次第一人称动作固化成 IP 稳定 DNA。
- 1.0 legacy profile 或未人工审阅 generation test 被标为 approved。
- 仅比较调用方自报 hash，没有外部 content contract 与绑定 output audit。
- 批准记录没有绑定全部获批产物摘要，或产物变化后仍复用旧批准。

确定性 leakage 只负责精确长片段、标题和数字/金额/CTA 等敏感短片段；它不能证明语义改写后没有夹带来源事实，人工来源边界审阅仍是硬门禁。

Validator 只能验证 artifact 摘要、结构、关系值和 reviewer 声明格式，不能证明现实身份，也不能自动证明自然语言 output audit 的语义提取正确。不得把“机器校验通过”写成“事实保真已自动证明”。

## 下游仿写接口门禁

风格档案只能声明如何消费内容槽位，不能替下游生成事实。正式仿写模块至少检查：

- 数值、单位、主体、周期、条件和证据归属不变；
- 没有新增目标原文不存在的事实；
- 没有导入风格样本事实；
- 没有过程性元话语；
- 风险报告与观众稿分离。
- selector 无可靠匹配时 abstain；
- pattern 次数、位置和相邻重复符合 profile；
- avoid pattern 违规数为 0。
