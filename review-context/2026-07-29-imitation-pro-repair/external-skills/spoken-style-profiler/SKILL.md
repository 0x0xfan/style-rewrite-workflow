---
name: spoken-style-profiler
description: 从多篇中文短视频口播参考稿中拆解任意 IP 的可审计、可供下游仿写 Agent 调用的风格 DNA，以一条可执行核心模型和内容类型框架为主干，再按证据补充句式、节奏、说服、叙事位置、认知推进、机会包装、CTA 与负面风格；覆盖样本去重、选择器、生成约束、来源边界、过拟合回归和人工审批。用户提出风格拆解、写作 DNA、口播风格提取、建立 IP 风格库、分析同行或本人 IP 文案、比较多个 IP 风格，或需要生成就绪的风格档案时使用；本 Skill 建立并验证风格控制层，不直接生产正式仿写稿。
---

# Spoken Style Profiler

为任意中文短视频口播 IP 建立可回查、可版本化、可驱动下游生成、但不携带来源事实的风格档案。把通用拆解方法留在 Skill 中，把每个 IP 的结论留在项目 `profiles/` 中。

## 必读资源

- 开始任何拆解前，完整读取 [workflow.md](references/workflow.md)。
- 创建或校验产物时，完整读取 [profile-schema.md](references/profile-schema.md)。
- 标注段落、句式、节奏或证据关系时，完整读取 [annotation-guide.md](references/annotation-guide.md)。
- 交付草稿或处理人工批准前，完整读取 [review-gates.md](references/review-gates.md)。
- 建立生成模拟、框架选择或批准档案前，完整读取 [generation-readiness.md](references/generation-readiness.md)。

## 核心边界

- 只拆解“怎么讲”，不沉淀来源中的项目、收益、案例、账号、资料、平台操作或 CTA 关键词。
- 不把某个 IP 的词典、行业、框架或固定话术写进通用 Skill。
- 不把重复转写稿计为独立证据；先报告，再由人决定保留、合并或排除。
- 不用关键词共现代替语义标注。框架顺序、排雷、证据绑定和修辞关系必须有段落/句子锚点。
- 把“人格”限定为可观察的叙事位置、沟通姿态、受众关系、权威来源和确定性策略；不推断真实人格、心理、职业资历或现实作者身份。
- 把“认知推进”限定为文本中可锚定的起始理解、挑战动作、目标判断和过渡手段；不声称观众真实信念已经改变。
- 把“机会包装”限定为对目标内容已有价值、相关性和证据的呈现顺序；不制造隐藏机会、紧迫性或收益事实。
- 把“段落价值承接”限定为主要章节边界上的局部包装：先连接上一环节或当前状态，再用目标内容已有的理由、收益、后果或未解决问题说明下一段为什么值得听，随后进入方法。它优先建成 framework 的可选 transition beat 或局部 pattern，不升级成整篇认知旅程，也不要求每个小标题都包装。
- 当样本以具体案例或项目为桌面对象时，优先抽取“案例对象 → 为什么成立 → 边拆边给动作 → 回到案例算账”的讲解位置；不要把这种自然推进改写成作者研究过程、刻意悬念或“后面再讲/具体怎么算”的留存脚本。
- 先用一句话定义该 IP 最稳定的表达主干，再建内容类型与框架；叙事位置、认知推进和机会包装默认是可选增强，不得因为 schema 有字段就强行填满。
- 新增控制只有在“原样本有证据、与现有规则不重复、前向测试不劣于更简单基线”三项同时成立时才保留；否则删除或降级，不用理论完整性代替风格相似。
- 把 `audience_effect` 记录为文本意图，不声称真实受众一定产生该反应。
- 单个独立样本只能形成 `observation`，并保持 `review_only`。
- 至少两个独立样本簇支持同一关系，才允许形成 `candidate`；框架的每个必需节拍都要满足该门槛。
- 冲突顺序必须拆成条件分支或不同框架，禁止平均成万能模板。
- 所有新档案默认 `draft`；只有用户明确确认后才能另行标记 `approved`。Skill 不自行批准。
- 纯文本语料不能证明 IP 的镜头或画面风格；不得把通用视频建议冒充 IP 视觉 DNA。
- 不在本 Skill 中启动 UI、飞书、TTS、视频、发布或正式仿写链路。允许生成隔离的评测稿，但它只能用于验证 DNA，不得作为用户成稿交付。

## 执行流程

1. 明确 IP 名称、输出目录、语料路径和当前范围仅为中文短视频口播。
2. 运行确定性脚手架，生成语料清单、健康报告、样本决策草稿和标注骨架：

   ```powershell
   node scripts/spoken-style-tool.mjs scaffold `
     --source '<文案文件或目录>' `
     --corpus-id '<corpus-id>' `
     --out '<项目输出目录>'
   ```

3. 停在样本决策门：让人确认近重复、转写变体、固定模板、异常样本和纳入范围。未解决时不得融合候选规则。
4. 按 `anchor_id` 标注内容类型、段落职责、相对位置、受众意图、信息角色、修辞关系、主张—证据关系和口播节奏。若主要章节前反复出现描述性承接，另标“上一环节/当前状态 → 下一问题的重要性或价值 → 进入方法”，不要把它误记成普通目录预告、空悬念或完整认知旅程。不要把原句复制进公开 DNA 或标注字段。
5. 先写一条不超过两句的核心模型，说明该 IP 主要靠什么进入主题、如何展开、如何完成结果或行动；再提取内容类型与框架主干。只有主干解释不了、且样本存在独立证据时，才补充沟通人格、叙事位置、认知推进、机会包装、段落价值承接、注意力节奏、表达 pattern 和负面风格。段落价值承接只服务主要章节边界；如果它只是框架 beat 的同义复述，就保留在 framework，不再复制成 pattern。认知推进与机会包装是辅助层，不得覆盖框架的开头、主体职责或收束。先生成 `observation`，再按独立样本簇和顺序一致性升级 `candidate`。
6. 使用 [profile-template.json](assets/profile-template.json) 创建 1.1 机器版 draft，并同时输出人读 Markdown。1.0 只保留历史 draft 兼容，不能批准。
7. 校验机器档案并扫描长片段泄漏：

   ```powershell
   node scripts/spoken-style-tool.mjs validate --profile '<style-dna.draft.json>' `
     --manifest '<corpus-manifest.json>' --health '<sample-health.json>' `
     --decisions '<sample-decisions.draft.json>' --annotations '<annotations.draft.json>'
   node scripts/spoken-style-tool.mjs leakage --source '<语料>' --profile '<style-dna.draft.json>' `
     --annotations '<annotations.draft.json>'
   node scripts/spoken-style-tool.mjs render --profile '<style-dna.draft.json>' `
     --manifest '<corpus-manifest.json>' --health '<sample-health.json>' `
     --decisions '<sample-decisions.draft.json>' --annotations '<annotations.draft.json>' `
     --out '<Style-DNA.draft.md>'
   ```

8. 用 [generation-test.template.json](assets/generation-test.template.json)、[content-contract.template.json](assets/content-contract.template.json) 和 [output-audit.template.json](assets/output-audit.template.json) 建立隔离生成测试；除验证 selector、artifact、内容锁、预算与负面风格外，还要把“仅主框架的简单基线”与“叠加辅助控制的版本”并排人工比较。辅助版没有明显更像目标 IP，或变得更绕、更像说明书/培训稿时，回退辅助控制。测试稿不是正式交付。
9. 按 review gates 做人工审阅。保持未批准规则不可选用，并把未决问题写入 limitations。`approved` 不得残留 candidate，并通过 `candidate_profile_sha256`、`approved_control_state_sha256`、`evidence_bundle_sha256`、`generation_test_sha256`、`generation_output_set_sha256` 五个摘要字段同时绑定审阅内容、实际控制状态、证据、reviewed suite 和 output set；任一产物变化都会让旧批准失效。

## 必须交付的产物

- `corpus-manifest.json`：私有语料定位、单元、行号、长度；不含正文。
- `sample-health.json`：近重复、长度、重复开场和人工决策提示。
- `sample-decisions.draft.json`：保留、排除、合并和模板决定。
- `annotations.draft.json`：段落/句子锚点及语义关系；不放进公开 DNA。
- `style-dna.draft.json`：机器版风格档案。
- `Style-DNA.draft.md`：人读版风格档案。
- `generation-test.draft.json`：私有生成模拟、选择器、规则预算、内容锁和人工评测记录。
- `generation-cases/**/content-contract.json`：私有目标内容结构与不可变关系权威值。
- `generation-cases/**/output-audit.json`：私有输出关系、pattern span、负面规则与事实污染审计。
- `review-checklist.md` 或等价人工确认记录：开头必须写不超过两句的核心模型，并单列“主干 / 可选增强 / 删除或降级”，避免用户面对一串平权规则。

## 下游接口

本 Skill 不生产正式仿写稿。每个内容类型和框架必须提供可拒绝的确定性选择器；每个框架节拍必须声明 `input_slots`、`transformation_rule`、`generation_instruction`、`audience_effect`、`preserve` 和 `fallback`；每条表达规则必须声明生成动作、使用预算与禁用条件。目标内容中的项目、步骤、数字、单位、主体、周期、条件、证据归属和 CTA 由外部 content contract 与绑定真实输出的人工 output audit 共同保护。

工具能重算 artifact 摘要并比较结构化关系值，但不能自动证明 output audit 的自然语言语义提取或现实 reviewer 身份。不得把机器通过结果夸大为自动事实保真。

最终面向观众的稿件不得出现“原稿里”“原文里”“文案里”“飞书里”“资料里”“材料中”“根据你提供的”“下面这版”等过程性元话语；profile 还可追加禁用项，validator 必须一并扫描绑定 output。风险提示应在稿外报告，不擅自污染口播正文。

## 验证

修改 Skill、脚本或契约后运行：

```powershell
node scripts/self-test.mjs
python '<skill-creator>/scripts/quick_validate.py' '<skill-folder>'
```

再用至少两个表达差异明显的 IP 做前向测试，并验证一次 generation-test 契约。若更换 IP 需要修改通用代码、选择器被迫选错框架、规则只能描述不能执行，或一个 IP 的事实/规则污染另一个档案，则 Skill 未通过。
