
# AGENTS.md

## Project Map

- Project: 风格仿写
- Type: 内容/写作工作流
- Goal: 用通用 Skill 从任意中文短视频口播样本中拆出可验证、可人工批准、generation-ready 的风格 DNA 控制契约；批准后才与用户自己的内容事实结合做仿写。
- Current first flow: 用钱十七样本验证通用口播风格拆解 Skill。
- Stack: Codex Skill, JSON/Markdown evidence bundle, Node CLI; legacy workbench is frozen.

## Read First

1. `CURRENT.md`
2. `HANDOFF.md`
3. `docs/requirements.md`
4. `C:\Users\admin\.codex\skills\spoken-style-profiler\SKILL.md`
5. `C:\Users\admin\.codex\skills\spoken-style-profiler\references\profile-schema.md`
6. `C:\Users\admin\.codex\skills\spoken-style-profiler\references\generation-readiness.md`
7. `style-engine/evaluation/spoken-style-profiler-qian17/forward-test-report.md`
8. `style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`
9. `style-engine/evaluation/spoken-style-profiler-qian17/style-dna.draft.json`
10. `docs/source-inventory.md`
11. `docs/github-style-tooling-research.md`
12. `DECISIONS.md`

## Project-Specific Rules

- First source sample: `F:\dai ma\钱十七剪辑拆解\钱十七文案素材\钱十七-闲鱼文案拆解.md`.
- The canonical `goofish-research` implementation for this project is `.codex/skills/goofish-research/`. It must not use random/mock products, placeholder browser success, or screenshot filenames without image files; a screenshot is verified only after decode, dimension and SHA-256 checks, and dynamic search/detail values must remain separately attributed.
- The generic Skill core must not contain any IP-specific, platform-specific, industry-specific, or money-making formula. Put those findings only in that IP's external profile and evidence bundle.
- Learn only expression style: hook rhythm, structure, sentence pacing, evidence placement, CTA shape, risk patterns.
- Do not reuse source facts unless the user explicitly provides them as facts for the new draft: earnings, cases, product tutorials, resource lists, platform tactics, screenshots, account operations, or public-account keywords.
- Generated audience-facing copy must not expose the rewrite or evidence-audit process. Do not allow phrases such as `原稿里`, `原文里`, `文案里`, `飞书里`, `资料里`, `根据你提供的`, `下面这版`, `另一张截图里`, `截图显示`, `计算器显示`, `参考数据更新至`, or `结算数据更新至` in the final script unless the evidence carrier itself is the content being discussed; preserve source ownership and dates in the private audit instead.
- For future Feishu input, do not infer from a link string. Fetch the actual document content and materials, then record the verified source in `docs/source-inventory.md`.
- Feishu source text shown in the left editor must preserve and visually render document heading levels such as `#` and `##`; do not flatten H1/H2 into plain paragraphs or show headings at the same size as body text.
- When adapting P002 workbench code, keep content-production modules that users expect in this project, especially `风格库` and `语音合成`, unless they are explicitly excluded. It is acceptable to leave out Jianying drafts, Chrome capture, storyboard, and video-template calibration code.
- For Xianyu or income-related copy, keep all risk notes explicit in the private contract/audit, but do not turn the audience script into repeated disclaimers. The audience script should emphasize benefits, mechanisms, and steps; surface only copyright, privacy, illegality, financial-loss, or execution-blocking red lines, normally in at most one compact risk block. Do not invent platform safety, income certainty, official endorsement, or compliance status.
- DNA 拆解先写不超过两句的一句话核心模型，再建立内容类型与框架主干；句式、叙事位置、认知推进、机会包装、人群代入和价值升维都只能作为有独立证据的辅助层，不能因为字段齐全就强行填满或压过主干。必须区分“场景型价值预演”和“段落价值承接”：前者把将要讲的普通内容翻译为学会后的生活升级、能力路径、当天可执行动作、效率或证据支持的收益画面，负责包装与留存；后者只连接当前步骤与下一步骤的真实依赖。钱十七稿在主要章节前反复出现前者时，应将其作为核心表达策略验证，不能降成一两次问题型承接；小步骤仍不强制包装。修辞式“不是X，而是Y”默认视为 AI 纠偏句壳，必要数据边界直接短说。单篇影子稿的修稿意见、目标内容专属揭晓顺序、一次第一人称动作不得直接上升为 IP 稳定 DNA。每轮新增控制后必须和“只用主框架”的简单基线比较；如果更绕、更像说明书/培训稿或用户评价下降，就删除或降级。对保留的口播句式仍须沉淀“抽象公式 + 适用条件 + 证据锚点 + 风险边界”，不得保存来源原句或把来源结果当成新稿事实。
- 口播 DNA 必须另列“内容类型框架库”：每个框架写清适用条件、禁用条件、段落职责与证据锚点；候选框架至少要有两个独立证据簇，各自都出现完整且同序的框架路径，碎片不能拼成完整证据。
- `observation` 永远只能是 `review_only`；候选规则仍需人工批准整个 profile，不能凭样本数量自动升级。
- 没有外部 `approval-record` 且五项人工检查没有全部通过时，任何 profile 都不得标为 `approved` 或进入仿写选择器。
- Style DNA 1.1 只能使用严格版本和字段白名单；纯文本 profile 的任意层级禁止 `visual`、`camera`、`shot`、`B-roll`、`palette`、`typography` 等视觉命名空间。
- selector 只能读取外部 content contract 中已登记、带类型的信号；无匹配或最高分并列必须 `abstain`，且不得继续应用 persona、strategy、节拍或 pattern 控制。
- persona 与 content strategy 只记录可观察的沟通行为；`audience_effect` 仅是文本预期作用，不能宣称真人身份、心理、留存、信任或转化已经得到证明。
- 生成控制只能改变呈现方式：框架 beat/pattern 必须受 content locks、preserve、负面风格与应用预算约束；外部 output audit 必须绑定实际输出、摘要、pattern span 和 avoidance findings。
- 批准必须同时绑定 candidate profile、evidence bundle、reviewed generation suite 与 output set 的摘要；validator 可验证摘要和结构，不能证明现实人工身份或自然语言语义审计正确。
- generation suite 仅作评测，必须覆盖 selectable framework 的 positive、excluded/abstain、fallback 分支，以及 pattern 预算、avoid trigger；不得当作正式仿写、UI 或视频交付。
- 风格拆解与仿写是两个独立阶段。风格档案只回答“怎么说”；用户输入的项目、步骤、数据、案例、证据、风险和 CTA 才回答“说什么”。
- 所有正式文案生成必须使用三类独立输入：项目事实 contract、非空且可回读的相关知识包、指定风格档案。生成前必须真实检索知识库，至少使用一条相关知识丰富解释、方法、机制或必要边界；知识缺失、不可访问或检索为零时停止，不得降级为“事实 + 风格”。知识中的数字、案例、收益、时效和平台结论只有经核实并提升为 contract 锁后才能进入观众稿。
- 钱十七完整文案默认交付为单一 canonical Word `.docx`：把已核实图片就地插入其证据段落并补齐替代文本；超宽原图保留不改，Word 中用可复现裁切只展示关键内容。成稿只能出现一个正常标题、正文和图片，禁止可见的风格/证据版标签、图号图注、页眉、页脚和页码。逐页渲染并通过图片/无障碍审计后，只在聊天中返回文件链接和简短验收结论；修订时更新既有 canonical 文件，不创建并行版本。
- 赚钱项目成稿前必须锁定 `narrator / target_viewer / case_buyer / content_goal`：讲述者面向想做项目的人，买家痛点只用于证明服务需求；章节包装和结果画面默认站在卖家/操盘者视角。四者混淆时停止生成，不能把“教人靠项目赚钱”写成“教买家购买或使用服务”。
- 用户已确认合格的钱十七唯一内容主版本是 `style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`。`profiles/钱十七-闲鱼风格拆解.md` 只能作为指向它的 NTFS hard-link 工作台别名，两个路径必须保持同一 File ID；`style-dna.draft.json` 仅是机器审计契约。不得再创建“改进版、正式版、V2”等并行风格内容。清理前必须完整读取候选文件、逐节合并、核对差异并通过验证，禁止先删后看。
- GitHub projects are references only unless `DECISIONS.md` is updated with a concrete adoption decision.

## Operating Rules

- Keep WIP=1 by default.
- Touch only files needed for the current task.
- Preserve user changes. Do not revert files you did not intentionally modify.
- Do not claim completion without evidence from local files, commands, API responses, browser checks, or a clearly marked manual checklist.
- For Chrome, Feishu, Xianyu, MiniMax, WeCom, browsers, and other external platforms, verify real platform behavior instead of relying on configuration guesses.
- If the same blocker repeats twice, stop hard trying and write a blocked report in `HANDOFF.md`.
- End each session by updating `CURRENT.md` and `HANDOFF.md`.

## Subagent Rules

- Use subagents only for bounded read-only analysis, review, verification, or disjoint implementation scopes.
- Give each subagent a clear role, readable inputs, forbidden actions, and output format.
- Do not let multiple agents edit the same file area unless the work is explicitly coordinated.

## Self-Update

When a durable workflow lesson is learned, update the relevant `AGENTS.md` after checking for an existing rule. Use global rules only for cross-project behavior; use this project file for project-specific paths, commands, and gotchas.
