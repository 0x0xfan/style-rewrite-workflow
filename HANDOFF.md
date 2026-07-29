# Handoff

## GitHub Initialization — 2026-07-29

- Private repository: `https://github.com/0x0xfan/style-rewrite-workflow`.
- Branch: `main`, tracking `origin/main`.
- Initial import commit: `7b0774b0568800dc15cb58d2654cc5798c022797`.
- GitHub CLI 2.96.0 was installed and authenticated as `0x0xfan`.
- The repository was created without a remote README to avoid history conflicts, then 177 explicitly scoped files were committed and pushed.
- Excluded from GitHub: `.env.local`, `.agents/`, `.claude/`, `.venv/`, `artifacts/`, `research-runs/`, `仿写案例库/`, workbench import/rewrite/audio outputs, caches, databases, browser/session state, generated media and the two local generated draft Markdown files.
- Pre-push checks: secret scan 0; Node syntax passed; spoken DNA 6/6; canonical profiler 51/51; content-fusion 8/8.
- Worktree isolation is now available for future implementation/review tasks. Keep generated state and ignored private evidence outside worktrees unless a task contract explicitly requires a safe fixture.

## Blocked Report — 2026-07-29 External ChatGPT Pro Dispatch

- Status: `BLOCKED` before external implementation; no product source code was changed.
- Objective: run the user-authorized two-agent workflow in which ChatGPT Pro designs and implements improvements for style profiling and style imitation, while Codex owns integration and acceptance.
- Completed:
  - read project instructions, current state, requirements, architecture, commands, verification evidence, canonical profiler contracts and imitation components;
  - verified the directory is not a valid Git repository and the visible `.git` directory is empty;
  - ran baseline syntax/tests: workbench syntax passed, spoken DNA tests 6/6 passed, canonical profiler self-test 51/51 passed;
  - prepared a 491,799-byte source ZIP with SHA-256 `6cb2b558aab976c2bece7c549927f02692d5eb20cea5bca021bd06fb24c1e825`;
  - excluded `.env.local`, `.git`, node modules, caches, databases, browser state, generated imports/rewrites/audio, research-run media and document/video artifacts;
  - completed local credential scan with no literal credential findings; two scanner matches were reviewed as runtime variable references, not secrets.
- Attempts and evidence:
  1. Opened the visible ChatGPT attachment menu, selected the general computer-upload action through the file chooser flow, and attempted to attach the ZIP. The browser operation timed out; DOM readback showed no attachment.
  2. Identified three file inputs, selected the unique general input with no `accept` restriction, invoked a second chooser flow and attempted the same ZIP. The operation timed out; DOM readback again returned `uploadEvidence=false`.
- Likely cause: the in-app ChatGPT page repeatedly reports network timeouts to `ab.chatgpt.com`; the browser upload bridge does not complete while the page is in that state.
- Required external change: the in-app browser upload path must recover. No password, cookie, token or login material is needed from the user.
- Safe recovery artifacts:
  - `artifacts/dual-agent/2026-07-29-style-workflow/CHATGPT_PRO_TASK.md`
  - `artifacts/dual-agent/2026-07-29-style-workflow/SOURCE_BASELINE.md`
  - `artifacts/dual-agent/2026-07-29-style-workflow/SECRET_SCAN_REPORT.json`
  - `artifacts/dual-agent/2026-07-29-style-workflow/style-workflow-source-20260729.zip`
- Resume rule: do not repeat packaging. Retry upload once only after the page is visibly healthy; if it fails again, keep the task blocked instead of switching browsers or sending incomplete context without the ZIP.
- Permissions still in force: no Git initialization, commit, push, PR, deployment, database migration, production configuration, production feature enablement or real-user-data operations.

## Status

2026-07-28 Codex 代安装稿已按卖家/项目教学视角重写并通过三路复审。钱十七完整文案继续强制三输入，生成前新增角色锁定；最终只交付单一干净 canonical `.docx`，截图在 Word 内裁出关键内容，完成逐页渲染、图片和无障碍验收后只返回文件链接。钱十七唯一主版本仍是 `style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`，本轮没有修改该 DNA。

## What Changed

### 强制知识输入

- `.codex/skills/content-fusion/` 修复了对真实 `KnowledgeAPI` 的调用；知识参数缺失、API 不可读、零结果、无正文或无可回读来源时停止生成。
- 成功检索生成 schema `1.0` 的 `knowledge-pack.json`，与通用生成器字段契约一致。
- `style-engine/skills/style-copywriter/` 强制读取知识包和生成元数据，并验证真实来源 ID、允许用途、正文使用片段及 contract 数字边界。
- `C:\Users\admin\.codex\skills\qian17-copywriter\` 强制按“项目事实 + 相关知识 + 钱十七风格”生成；私下映射 2–4 条知识，至少使用一条。
- 知识中的项目数字、案例、收益、平台结论、时效和结果不能直接进入观众稿；必须先独立核实并提升为 contract 锁。

### Word 默认交付

- `C:\Users\admin\.codex\skills\qian17-copywriter\SKILL.md`、`references\generation-workflow.md` 和 `references\material-integration.md` 已加入 Word 硬门禁：完整稿默认生成/更新 canonical Word，聊天不贴全文。
- 最终 Word 只嵌入已核实素材，图片紧跟所证明的段落并具备可读替代文本；内部 Markdown 可以保留素材标记，Word 只显示正常标题、正文和图片，不显示图注、风格/证据版标签、页眉页脚或页码。
- 当前 Codex 代安装 Markdown 已原位替换，canonical Word 也在原路径重建，未新增 V2 或其他并行版本。
- 当前 Word 使用 `compact_reference_guide`，中文字体为一致的微软雅黑覆盖；2 张原始超宽截图保持不变，Word 内用 OOXML 裁切为可读的 inline 图片。

### 角色与事实校准

- 生成前锁定讲述者、目标观众、案例买家和内容目标；当前稿面向“会一点电脑或 AI 工具、想在闲鱼接技术服务单的人”，买家报错只用于证明服务需求。
- 五个主要章节分别用服务闲置、判断接单、减少报价、服务分档和清单交付做卖家侧场景包装，避免把课程目录或风险提醒当作留钩子。
- 商家自述改写为“页面文案如何包装服务”，不再冒充已验证的买家动机或交付效果；单次 10 条可见样本只支持关注信号，不写成订单或总市场需求。
- 搜索页与详情页共用一个采集记录时间；精确页面采集时刻和先后顺序没有单独保存，1541/1543 只分别绑定各自截图。

### 风格校准

- 钱十七的包装被重新定义为“场景型价值预演”：提前展示学完后的生活、能力、当天动作、效率或有证据的收益变化，再进入方法。
- 长稿分布为开头加 3–5 个主要章节；每处换一个结果维度，小步骤不套包装壳。
- “段落价值承接”收窄为“项目依赖承接”，只连接真实步骤关系。
- 修辞式 `不是 X，而是 Y` 默认禁用；事实边界可以直接短说，例如“想要不等于订单”，不再接工整的 `而是` 结论。
- 同步修改了项目主风格卡、正式审计 JSON、`$qian17-copywriter` Skill、生成流程与项目 `AGENTS.md`。

### 唯一入口

- 用户确认的人类可读主文件：`style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`
- 工作台别名：`profiles/钱十七-闲鱼风格拆解.md`，与主文件是同一个 NTFS File ID
- 机器审计契约：`style-engine/evaluation/spoken-style-profiler-qian17/style-dna.draft.json`
- 调用 Skill：`C:\Users\admin\.codex\skills\qian17-copywriter\SKILL.md`
- `style-dna.draft.json` 保持 `draft/review_only`；本轮没有创建 approval-record，也没有把用户反馈伪装成已批准证据。

### 误删修正与内容核对

- 先前删除重构版之前没有完成逐节合并，这是错误操作；恢复文件 SHA-256 为 `8545FAF402C7542BE5D5FF149F1631E697918946F3F37AA11D096B84EF701D79`。
- 完整读取重构版与旧 `profiles` 风格卡后，以重构版的 A1–A7 主干、B1–B6 辅助层、C1–C5 删除层、95% 主干权重、频次限制、段落示例和检查清单为基准。
- 从旧 `profiles` 风格卡只合并仍有价值且不冲突的内容：适用边界、来源事实不可迁移清单、证据主体约束、CTA 边界、风险处理和仿写输入最低要求。
- 没有合并已被重构版淘汰的旧开场公式、固定“先排雷”课程结构或高频命令词清单。

## Cleanup

累计 65 个明确重复、过时或临时目标已送入 Windows 回收站，约 38 MB、268 个文件，可从回收站恢复。主要包括：

- 钱十七旧重提取版、重构分析、渲染 Markdown、旧工作台 DNA、旧 framework map 和旧手工影子稿目录；重构版曾被误移入回收站，但已经恢复并设为唯一主版本；
- 根目录重复的 `PROJECT_HANDOFF_2026-07-27.md`、`QUICK_START.md`、已完成的 `SKILL-IMPLEMENTATION-PLAN.md`；
- Codex 代安装案例的多套旧 Word/Markdown 候选、旧生成脚本、临时 DOCX 解包、缓存、旧 QA 渲染和替代图文版；
- 12 份旧飞书导入运行和 4 份旧工作台改写运行；每类只保留最新一份历史运行；
- `$qian17-copywriter` 内重复的 `references/style-system.md`，Skill 现在直接读取项目唯一主文件。

保留范围：原始/事实证据、采集截图、审计 JSON、验证器与对抗测试、最终主交付、案例库的训练历史和 Skill 运行资产。`仿写案例库` 中看似重复的样本没有删除，因为它们分别被不同案例或 Skill 资产引用，直接去重会破坏可复现性。

## Verification Evidence

- `style-dna.draft.json` 和现存 JSON 均可解析。
- 合并后的重构版 SHA-256：`6F39CAAAB36F97D97540868E3B55A07C5439BC0B806AB1AAC69D816E792A566A`；A/B/C 章节数量分别为 7/6/5，95% 主干权重、限频、示例和检查清单均存在。
- 主文件与 `profiles` 工作台别名的内容哈希一致，`fsutil hardlink list` 同时返回两个路径。
- `spoken-style-tool.mjs validate`：`ok=true`，0 errors，0 warnings。
- `spoken-style-tool.mjs leakage`：`ok=true`，20 字精确重叠 0 matches。
- `npm run test:spoken-dna`：6/6 通过；style-copywriter 正例通过，4 个对抗样本均按预期失败。
- `content-fusion`：Python 编译通过，8/8 测试通过；用真实 Codex 代安装证据包和本地知识 API 完成端到端运行，检索 3 篇并输出 3 条有效知识来源。
- `style-copywriter`：正例 `passed`；9 个对抗分支全部 `failed`，覆盖原有事实/泄漏检查及空知识、假来源、假使用片段、未锁定阿拉伯数字和中文量化结果。
- Skill 校验：`qian17-copywriter` 与通用 `style-copywriter` 均显示 `Skill is valid!`；验证器 `node --check` 通过。
- 清理后只剩一个项目级钱十七人类可读风格文件。
- Codex 代安装目录只剩一套主交付 Markdown/Word，事实包和截图仍在。
- Word 转换脚本已改为读取保留的 `screenshots/` 证据图；重新生成成功，DOCX 内仍有 2 张图片。
- 新 Word 的图片审计结果为 `inline=2`；无障碍审计 `high=0, medium=0, low=0`；2 张图片均有语义化 alt text。
- 打包的 `render_docx.py` 因本机没有 LibreOffice `soffice` 无法执行；按可复现回退使用本机 Microsoft Word 导出 PDF，再用 bundled Poppler 渲染为 4 页 PNG，逐页检查无错误裁切、重叠、溢出或空白页。
- 最终 DOCX 结构检查：2 张图片、2 条语义化 alt text、无可见说明标签/图注/页眉页脚页码；关键事实字面值全部存在，最终 Word 无素材标记和常见 AI 纠偏壳命中。
- 三路独立复审结果：事实 `ACCEPT`、钱十七风格 `ACCEPT`、Word/截图 `ACCEPT`；无障碍审计 `high=0, medium=0, low=0`。
- 排除刻意保留的 `仿写案例库` 训练/Skill 资产后，项目其余范围的精确哈希重复组为 0。

## Remaining Boundary

- 自动验证只能证明结构、字段和精确泄漏检查通过，不能证明真实留存或风格相似度。
- 知识使用验证能证明来源 ID、用途、正文片段和量化边界可回查，不能自动证明知识相关性、事实真实性或融合后的口语自然度；这些仍需人工审阅。
- 下一次应以一篇真实目标稿做前后对照，由用户判断场景包装是否自然、是否仍有 AI 腔。
- 最终口播中所有时间、收益、订单、百分比、利润倍数和消费参照仍需目标内容证据。

## Next Prompt

读取 `AGENTS.md`、`CURRENT.md`、本文件以及 `$qian17-copywriter`。下一篇完整稿先锁定讲述者、目标观众、案例买家和内容目标，再强制使用“事实 contract + 非空知识包 + 钱十七主风格”，直接生成或更新单一干净 canonical Word，把已核实图片就地插入、裁出关键内容并完成逐页验收；除非用户明确要求，不在聊天中展开全文。
