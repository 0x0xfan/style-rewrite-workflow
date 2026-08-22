# Current

## Codex 远程安装文案视频配图 — 2026-07-31（已撤销）

- 用户认为新增配图不合格，要求删除并恢复原状。
- 已从本轮备份恢复 `research-runs/2026-07-27_codex代安装_refresh/style-application-20260730/钱十七风格-Codex远程安装项目文案.docx`。
- 恢复验证：正文文本与备份一致，inline 图片恢复为原有 2 张；恢复后 SHA-256：`60A8BBF9A8CBEB1FBBCD61A758AAC2029C23187D1981FC4890EA8F9727047F2A`。
- 本轮新增素材、渲染目录和生成缓存已移入回收站；本轮辅助脚本已删除。当前不再保留配图修改。

## 提问式校准对话导出 — 2026-07-31

- 已从本地 Codex 原始 rollout 记录中导出 2026-07-30 14:10:19–17:04:39（Asia/Shanghai）的用户/Codex 问答校准过程到桌面：`C:\Users\admin\Desktop\钱十七风格校准_提问式训练对话_20260730_1410-1704.md`。
- 文件大小 80,716 bytes；SHA-256：`497097F5B2BDA04AE8A0E25863D45A6A98B1C5A92DE70918D279A905AFB2979E`。
- 导出保留 14:10–17:04 时间段的问答正文，排除了自动注入的浏览器/环境上下文和 AGENTS 系统说明；未修改项目源码、未提交、未推送、未部署。

## Codex 代安装中段与结尾重写 — 2026-07-31（当前）

- 用户明确锁定：开头已在前一日校准，本轮只解决中段和结尾；不能继续把开头当作本轮成果。
- 已重新逐篇读取权威 11 篇钱十七原稿。结论：钱十七项目稿的中段按资源/能力、流量、发布、咨询/成交条件、交付或放大等真实环节推进，只在大环节转换处重新包装价值；清单和小步骤直接交付，不按固定频率硬塞钩子。
- Enhanced 已原位重写：三类买家压缩为一个需求证明段；主体改为“能力准备 → 发布获客 → 需求判断 → 报价 → 交付”；结尾删除全文复述，直接接免费安装包、安装教程、添加圣矾和身份。
- Fresh Baseline SHA-256：`6CED29A44C461599B6C978DC722794817C10B1ABE5504EBFCEBE97D0F12F9EAF`；Enhanced SHA-256：`9D2B05D0BC3C5A4C12CE8D6359FDF525D621A6366CFCB40664849ED0787679FA`。
- Enhanced 展示与纯 TTS 均为 1,251 个有效字符，按 240 字/分钟约 5:13；搜索与标题辅助内容 172/1,251，即 13.7%。
- 输入预检 Baseline 8/8、Enhanced 8/8；输出验证 13/13、0 warning、0 failure；权威 11 篇 20 字连续引用泄漏 0 命中；32/32 tests、lint、validator syntax、JSON 和 `git diff --check` 通过。
- Canonical Word：`research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`；348,672 bytes；SHA-256 `B682D8FA16AD0C12A3AF2809DE9AB892ABA5068B1C41709E684C71E050AAE809`。
- Word 与 Markdown 19/19 段一致；2 张 inline 证据图、2 条语义 alt；a11y 0/0/0。内置渲染器缺少 `soffice`，已改用本机 Microsoft Word 真实导出 PDF，再用 bundled Poppler 生成 2 页 PNG 并逐页检查，无裁切、重叠、空白页、乱码、缺图或页眉页脚。
- 状态：仅本地、未提交、未推送、未部署；profile 仍为 `draft/review_only`，当前候选等待用户判断中段与结尾是否合格。

## Codex 代安装人工硬锁重写 — 2026-07-31（历史；已由中后段重写取代）

- 用户拒绝上一份“只修内容占比”的稿件：虽然商品发布已压缩，但正文又退化为 AI 式分类与总结，用户已通过的中段钩子也被擅自改弱。
- 已新增任务本地 `style-acceptance-locks.json`：绑定人工校准原文，硬锁 5 条通过原句、3 条语义关系、6 组拒绝表达、3 个 AI 句壳预算和 6 个钩子兑现职责；产品事实没有写入通用钱十七 DNA。
- 预检新增“人工校准硬锁”和“fresh Baseline/Enhanced 计划”；结构性修改后旧 validation/style acceptance 未重置会直接失败。输出验证新增原句保留、拒绝句壳、钩子兑现、内容占比和双稿摘要门禁。
- 本轮 fresh Baseline/Enhanced 已闭合。Enhanced 保留信息差开头、“最简单的单子有多简单”、价格关系、标题钩子和“有小伙伴问了”，并把钩子分别落在机会、付费原因、简单服务、复杂服务、商品表达与资源 CTA。
- Enhanced 展示稿 1,170 个有效字符；TTS 1,153 个有效字符，按 240 字/分钟约 4:48。搜索页与商品发布为 159/1,170，即 13.6%，未超过本稿 15% 上限。
- Canonical Word：`research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`；348,711 bytes；SHA-256 `811C94A177EF170E9F3D99E501E357AE5389741CB323FE753E9972AB3938D61F`。
- Word 与 Markdown 22/22 段一致；2 张 inline 证据图、2 条语义 alt；a11y 0/0/0；无素材标记、页眉、页脚或私有审计标签。当前机器缺文档转换器，最新版未完成逐页视觉渲染，不得引用旧图冒充验证。
- 门禁：生成前 8/8、生成后 13/13；32/32 tests；两个 Skills 均 valid；lint、validator syntax 与 `git diff --check` 通过。
- ChatGPT Pro 对话：`https://chatgpt.com/c/6a69b4e9-dec8-83ee-80c4-8d9ad4a8e568`。发送连续两次因 `ab.chatgpt.com` 网络错误超时，本轮没有第三次硬试，也没有新回复。
- 状态：仅本地、未提交、未推送、未部署；profile 仍为 `draft/review_only`，Enhanced 仍为 `pending_user_review`。

## 业务架构可视化 — 2026-07-30

- 已为用户生成业务逻辑版 draw.io 架构图：`D:\项目仓库\大脑\diagrams\04-风格仿写业务架构图.drawio`。
- 因本地 Next AI Draw.io 的 `embed.diagrams.net` iframe 未完成加载，已补一个本地浏览器预览页：`D:\项目仓库\大脑\diagrams\04-风格仿写业务架构图.preview.html`；当前通过 `http://localhost:4317/04-%E9%A3%8E%E6%A0%BC%E4%BB%BF%E5%86%99%E4%B8%9A%E5%8A%A1%E6%9E%B6%E6%9E%84%E5%9B%BE.preview.html` 打开给用户查看。
- 图中按业务层级表达：风格来源层、风格 DNA 层、目标内容输入层、仿写生成层、交付与复利层。
- 重点标出三个闸门：来源事实不得流入新稿；未批准 DNA 只能 review_only；正式生成必须有 task brief、事实 contract、非空知识包和可回查素材。
- 该图不改变当前项目状态；钱十七 profile 仍为 `draft/review_only`，风格接受仍等待用户判断。

## 钱十七风格实际应用重写 — 2026-07-30

- 用户确认应先问“这次为什么没有真正使用钱十七风格”，并要求按钱十七风格重写。
- 已撤销“失败稿直接证明 DNA 有问题”的错误归因；本轮保留同一项目事实，建立无风格 Baseline 与实际风格稿对照。
- 新稿使用 `fw-project-breakdown`，10 个路径 slot 全部有 verified/bounded/test-only 证据；不再写成“三道测试”的谨慎筛选说明。
- A1–A6 与 P1/P7 共 8 个风格控制均绑定正文原句。`validate-generated-copy.mjs` 新增风格 span 门禁，metadata-only 的规则声明会失败；自动结果只证明落位，用户仍决定像不像。
- 用户要求增加到约 5 分钟后，正文扩展到 1,240 个可朗读单位；偏快语速约 4.8 分钟，普通语速约 5.2 分钟。新增内容只补练习复现、详情页四项信息和咨询范围判断。
- canonical Word 已原位更新：348,979 bytes；SHA-256 `77CD1353AB8AABFC1FBEE625D7927C9B83FCF0CC60A00EA68254D60F7E193083`。
- Word 共 2 页，22 段正文与 Markdown 完全一致，2 张 inline 证据图、2 条 alt text、a11y 0/0/0；两页已逐页检查。
- 输入预检 6/6、输出验证 8/8、19/19 tests、lint、Skill 校验和 `git diff --check` 全部通过。
- 当前状态：仅本地、未提交/推送/部署；钱十七 profile 仍为 `draft/review_only`，等待用户阅读新 Word 后判断风格。

## 2026-07-30 用户再次拒绝 Codex 代安装稿（历史；针对上一轮筛选稿）

- 用户反馈：本轮 Enhanced 仍然 AI 味重，且看不出钱十七风格；canonical Word 与 Enhanced metadata 已标记为 rejected，不得再把技术门禁通过解释为风格通过。
- 这次暴露出两个仍未解决的问题：内容方向被从“赚钱项目口播”改成了“谨慎的可行性筛选”；风格层只复现通用编号结构，没有复现钱十七的利益驱动、确定语气、口语毛边和边讲边卖的推进感。
- 当前不继续润色或新增 Word。先与用户确认新的重做方向：补齐商业路径事实，同时从 11 篇中单独重建“赚钱项目文案”的语气/语言行为层，再做小段声音测试，确认像了以后才写完整稿。

## Codex 代安装干净 Baseline / Enhanced — 2026-07-30

- 已完成用户要求的“先查清问题再重做”：根因不是单纯句子不像，而是旧任务角色、F1 framework 准入、知识立场和验收状态在生成前已错位。
- 已建立 `baseline-20260730/task-brief.json`，保存用户原话，并把“几分钟学会、接单赚钱”保留为待证假设；目标观众锁为尚未具备 Codex 交付能力的人。
- 新增通用输入门禁 `style-engine/skills/style-copywriter/scripts/validate-generation-inputs.mjs` 与 5 个回归测试；通用/钱十七 Skill 均已加入 task SHA、framework slot 和知识 stance 约束。
- 框架从不合格的 `fw-project-breakdown` 改为 `fw-screening-tutorial`。Baseline 和 Enhanced 的输入预检均 6/6 passed，输出验证均 7/7 passed；Enhanced 仅用 2 个有预算的辅助 pattern，被选为 canonical Word 内容。
- canonical Word 已原位更新：`research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`；348,294 bytes；SHA-256 `1CE77870CBB76ECAC9464A7ECB73B0BF9C5CD020CF71C14D43F24BCC7C1D34F9`。
- Word 2 页已真实导出并逐页检查；2 张 inline 证据图、2 条 alt text、a11y 0/0/0，无可见插图标记、页眉、页脚或页码。
- 本地隔离安装 `@openai/codex@0.145.0` 成功，229.6 秒，返回 `codex-cli 0.145.0`；未登录、未读取凭据、未做真实客户交付。
- ChatGPT Pro 对话：`https://chatgpt.com/c/6a69b4e9-dec8-83ee-80c4-8d9ad4a8e568`；另有 2 个 `gpt-5.6-terra / ultra` 后台核查任务完成，无 fallback。
- 仓库门禁：lint passed；17/17 tests passed；个人 Skill valid；`git diff --check` 无 whitespace error。
- 状态：仅本地、未提交、未推送、未部署。钱十七 profile 仍为 `draft/review_only`，下一步只等待用户对本轮 Word 的主观风格判断。

## Codex 代安装稿用户拒绝与 Pro 复核 — 2026-07-29（历史；已由 2026-07-30 干净基线取代）

- 用户确认最新稿与 2026-07-29 Claude 对话中被否定的稿子属于同一种问题；本稿已记录为 `rejected_by_user`，原技术验证通过不得再解释为风格通过。
- 直接证据：用户要求面向“想通过闲鱼赚钱、尚未具备 Codex 交付能力的人”，但 contract 锁成“会一点电脑或 AI 工具的人”，正文继续以“你要是已经会装 Codex”作为前提。
- F1 明确禁止在缺资源/获客/成交/交付关键环节、只有市场信号时启动；当前事实包只有商品卡、价格、想要/浏览和页面服务描述，强行选择 F1 违反自身准入条件。
- `knowledge-01` 仅凭服务类标签进入，内容主张高门槛虚拟产品，随后把正文推成排错能力与服务边界，和用户希望验证的零基础机会角度相反。
- ChatGPT Pro 第三轮复核同意：当前 Baseline 被需求理解、role lock、selector、knowledge relevance、商业链路与验收状态五类变量污染，不能证明新 DNA 正确或错误；首要缺陷是生成前输入控制链没有拒绝错误任务。
- Pro 对话：`https://chatgpt.com/c/6a69b4e9-dec8-83ee-80c4-8d9ad4a8e568`。Codex 已发送进一步反驳，要求避免关键词门禁、过严全链路门禁和二元知识淘汰；页面连续两次未提交成功，停止重复点击。
- 当前下一步不是改稿或加 DNA 条目，而是建立语义一致的任务 contract、分级证据/claim 边界和可 abstain 的 selector，再做干净 Baseline。

## Codex 代安装纯框架实稿 — 2026-07-29（历史；用户已拒绝）

- 已用钱十七重拆档案的 `fw-project-breakdown` 生成一篇纯框架 Baseline，未叠加辅助 pattern，用于隔离判断“主框架本身是否对”。
- canonical Word 已原位更新：`research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`；正文聚焦需求证据、接单判断、服务拆分、定价边界、交付清单和 CTA。
- 三输入已闭合：`source-contract.md`、非空 `knowledge-pack.json`、钱十七 draft profile；知识只使用一条机制，没有迁移收益/案例数字。
- 生成验证 `passed`：7 项通过、0 warning、0 failure；与权威钱十七语料 20 字连续重合 0 命中。
- Word 结构与无障碍检查通过：2 张真实证据图、2 条语义化 alt text、0 finding、无页眉页脚页码；Microsoft Word + Poppler 渲染 3 页并逐页检查通过。
- DOCX：348,854 bytes，SHA-256 `4274BFFD964C374256D0831D4727C11AA308B7C3FFA8BD665E6AC902D6719FFC`。
- `npm run lint` 通过，`npm run test:spoken-dna` 12/12 通过，`git diff --check` 通过。
- 当前等待用户主观评审；profile 仍为 `draft / review_only`，没有批准、提交、推送或部署。

## 钱十七完整语料重拆 — 2026-07-29

- 用户提供的 `钱十七-闲鱼文案拆解.docx` 已核验为 11 篇原始稿；旧 Markdown/manifest 只有前 8 篇。u03/u07 沿用用户既有决定，按同稿转写版本合并，因此当前是 10 个独立证据簇。
- 旧“用户已确认合格”状态已撤回。原因不只是漏稿：旧人工版还把目标测试稿中的项目、数据和作者身份写成“样本证据”，并把固定 3-5 次场景价值预演、全面禁二元对比/指图等编辑偏好升级成稳定 DNA。
- 唯一主版本 `style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md` 已原位重建；`profiles/钱十七-闲鱼风格拆解.md` 仍是同 File ID hard link。
- 机器证据已更新为 `qian17-spoken-v2`：11 units、10 clusters、3 个 candidate framework、7 个 review-only pattern；结构验证 0 error/0 warning，泄漏扫描 0 match。
- 新增 `style-engine/tests/qian17-reprofile.test.mjs`，仓库测试通过 12/12；lint 通过。
- 实际生成入口 `C:\Users\admin\.codex\skills\qian17-copywriter\` 已同步移除固定 3-5 次场景预演、默认零对比句和单一风险块等旧硬编码，并改为先选 3 个候选框架、按需使用阶段价值重置；Skill 结构验证通过。
- 当前状态仍为 `draft / profile_approval_required`。下一最小任务是用同一个真实 target contract 生成 Baseline 与 Enhanced 两篇完整稿，交给用户盲评后再决定是否批准。
- 右侧 ChatGPT Pro 专项对话未成功创建：新聊天页可打开，但一般文件输入和可见附件按钮两条上传路径均超时，页面持续出现 `ab.chatgpt.com` 网络超时；没有文件、消息或对话链接送达，不能声称已完成外部 Pro 审查。
- 可恢复 Pro 证据包已准备：`artifacts/dual-agent/2026-07-29-qian17-reprofile/qian17-reprofile-ab10111.zip`，80,872 bytes，SHA-256 `c69c8d8e544bac113808658c076b07022e9fb2098dd027b360868afda0d9e34b`；15 entries，凭据扫描 0 finding，禁入路径 0。

## GPT Pro GitHub Direct Dispatch Override — 2026-07-29

- User explicitly replaced the ZIP-only transfer method with direct private-GitHub access for the right-side ChatGPT Pro conversation.
- Complete review context was committed and pushed to private repository commit `1eba623e4ac76ae8c89df92283a5053c8940d87f` under `review-context/2026-07-29-imitation-pro-repair/`.
- The context contains the task contract, manifest, real rejected output, generation metadata, knowledge pack, fact/product analysis, internal report and review-only snapshots of both external Skills. Credential scan returned zero findings.
- Dispatch remains `BLOCKED` at message submission, not repository access: Playwright `fill + Enter` and direct DOM `click/type/Enter` each timed out. Readback after both attempts showed URL `https://chatgpt.com/`, no user message, no conversation ID and recurring `ab.chatgpt.com` initialization timeout.
- No claim has been made that ChatGPT Pro accessed GitHub or reviewed the source.
- Safe resume: submit the short GitHub task message once from the visible right-side tab, then Codex can monitor the created conversation, record its URL, challenge findings and integrate verified repairs.

## GPT Pro Imitation Repair Dispatch — 2026-07-29

- User feedback: the current imitation quality is unsatisfactory; this is now the WIP=1 mainline.
- A new evidence-complete package was built from Git commit `c85a9a19e34a968231d75342d33eb1e2b49bde9a` and includes the real rejected output, generation metadata, knowledge pack, product/fact analysis, canonical style contracts and both external Skills.
- Package: `artifacts/dual-agent/2026-07-29-imitation-pro-repair/imitation-pro-repair-c85a9a1.zip`, 574,914 bytes, SHA-256 `59049d7f9ec31c5bf62be68693779aa72f054457d7db79f71313a819b2a6d2ab`.
- Task contract: `artifacts/dual-agent/2026-07-29-imitation-pro-repair/CHATGPT_PRO_TASK.md`.
- Secret scan passed with zero credential findings and zero forbidden archive entries.
- Dispatch status: `BLOCKED`. The right-side in-app ChatGPT Pro tab is open and set to Pro, but two upload-path attempts failed: the unique general file input was not visible, then the visible attachment-button interaction timed out. Page readback again showed `ab.chatgpt.com` timeout traffic and no attached filename.
- No task message was sent and no ChatGPT Pro conversation URL was created. Do not claim external review occurred.
- Safe resume: manually attach the existing ZIP in the right-side Pro tab once, then Codex can send the prepared task, record the conversation URL, monitor, repair and independently verify.

## GitHub Repository — 2026-07-29

- Repository: `https://github.com/0x0xfan/style-rewrite-workflow`
- Visibility: private.
- Default/local branch: `main`.
- Initial import commit: `7b0774b0568800dc15cb58d2654cc5798c022797`.
- Local repository is now valid and tracks `origin/main`; this supersedes the earlier pre-initialization statement that Git/worktree isolation was unavailable.
- Initial import contains 177 source, project-document and test files. `.env.local`, local agent state, artifacts, research runs, imported/rewrite/audio outputs, private case libraries, databases, caches and generated media are ignored and were not pushed.
- Initial validation before push: workbench/validator syntax passed; spoken DNA 6/6; canonical profiler 51/51; content-fusion 8/8 in an ignored local virtual environment; staged secret scan 0 findings.

## Dual-Agent Engineering Run — 2026-07-29

- Project state: `BLOCKED` before external implementation dispatch.
- Current phase: orchestration handoff to the user-authorized external ChatGPT Pro engineer.
- Scope lock: improve the two coupled capabilities—spoken-style profiling and fact/knowledge/style-bound imitation—without approving any draft profile, moving source facts, or reviving a second canonical Qian17 profile.
- Repository baseline: this directory is not a valid Git repository. The visible `.git` directory is empty; branch, commit and worktree isolation are unavailable. Git was not initialized or repaired.
- Local baseline evidence:
  - Node syntax checks for `scripts/serve-workbench.mjs` and `workbench-ui/app.js` passed.
  - `style-engine/tests/*.test.mjs` passed 6/6.
  - canonical `spoken-style-profiler` self-test passed 51/51.
  - `content-fusion/test.py` could not run because the bundled Python lacks `PyYAML`; no dependency was installed to conceal the baseline gap.
- Source package: `artifacts/dual-agent/2026-07-29-style-workflow/style-workflow-source-20260729.zip`, 491,799 bytes, SHA-256 `6cb2b558aab976c2bece7c549927f02692d5eb20cea5bca021bd06fb24c1e825`.
- Security evidence: `artifacts/dual-agent/2026-07-29-style-workflow/SECRET_SCAN_REPORT.json` passed; the archive contains no `.env`, `.git`, cache, database or browser-state entries.
- Task contract: `artifacts/dual-agent/2026-07-29-style-workflow/CHATGPT_PRO_TASK.md`.
- Blocker: the Codex in-app browser timed out twice while attaching the ZIP—once through the visible attachment menu and once through the unique general `input[type=file]`. A DOM readback confirmed the filename never appeared. The page also repeatedly reported timeout traffic to `ab.chatgpt.com`.
- ChatGPT Pro thread link: not created; no message or source archive reached ChatGPT Pro.
- Next smallest safe action: after the in-app browser upload path is healthy, upload the existing verified ZIP to a fresh Pro chat, send the existing task contract, record the resulting conversation URL, then resume monitoring. Do not rebuild or rescan the package unless source files changed.

## Active Task

当前 Codex 代安装稿已按“讲给想做项目的人听”的卖家视角重写：强制使用项目事实 contract、非空相关知识包和钱十七主风格，先锁定讲述者、目标观众、案例买家和内容目标，再生成干净的配图 Word。

## Word Delivery Default — 2026-07-28

- `$qian17-copywriter` 的完整文案默认输出 `.docx`；聊天只返回文件链接和简短验收结果，用户明确要求时才给聊天预览。
- 工作 Markdown 和素材标记只作内部组装；最终 Word 只保留正常标题、正文和带替代文本的真实图片，不显示风格/证据版标签、图号图注、页眉页脚或页码，也不留 `[插图]` / `[录屏]` 标记。
- 修订既有稿件时更新 canonical Word，不创建 `V2`、`正式版` 等并行交付。
- 当前 Codex 代安装 canonical Word 已原位重建；2 张 21:9 来源截图的原文件保持不变，Word 内只裁出详情数据和代表性商品卡片。

## Canonical Files

- 唯一人工可读主版本（当前待重新批准）：`style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`
- 工作台兼容路径：`profiles/钱十七-闲鱼风格拆解.md`，是主版本的 NTFS hard link，不是第二份内容
- 同一风格的机器审计契约：`style-engine/evaluation/spoken-style-profiler-qian17/style-dna.draft.json`
- 实际调用 Skill：`C:\Users\admin\.codex\skills\qian17-copywriter\SKILL.md`

机器审计 JSON 只负责证据、状态和验证，不是第二套写法。旧“已确认合格”状态已撤回；人读主版本和 JSON 现在都等待新的 Baseline/Enhanced 实稿对照与用户批准。

## Mandatory Knowledge Input — 2026-07-28

- `content-fusion` 真实调用 `D:\项目仓库\闲鱼知识库\scripts\knowledge_api.py` 的 `KnowledgeAPI`，不再因接口不匹配静默返回空结果。
- 每次运行必须提供 `knowledge_params.product_type`；API 不可读、零结果、条目无正文或来源不可回读时直接停止。
- 成功检索后输出 `knowledge-pack.json`，统一 schema `1.0`，包含 query、来源 ID、标题、locator、摘要、允许用途和内容摘要哈希。
- 通用 `style-copywriter` 现在强制接收 `--knowledge` 与 `--metadata`；至少一条 `knowledge_sources_used` 必须引用真实来源，且 `output_excerpt` 能在正文中定位。
- 知识补充片段中的阿拉伯数字和“四位数、百分之X、X倍、翻倍、当天出单”等中文量化/结果主张，必须已经进入 contract，否则验证失败。
- `$qian17-copywriter` 完整口播生成前必须检索并私下映射 2–4 条相关知识到主要章节，至少实际使用一条；知识只丰富解释、方法、机制和必要边界。

## Latest Calibration — 2026-07-28

- 把“场景型价值预演”提升为核心留存机制：先让观众看到学会后的生活、能力、当天动作、效率或已证实收益会发生什么变化，再进入方法。
- 长稿在开头和 3–5 个主要章节前分别使用不同的场景维度；小步骤直接讲，不逐条包装。
- “项目依赖承接”只负责连接真实步骤，不能替代场景型包装。
- 默认删除修辞式 `不是 X，而是 Y`，也避免连续使用“很多人以为、其实、真正关键、本质上、核心逻辑、你会发现”等 AI 纠偏壳。
- 餐饮参照、当天出单、百分比、利润倍数等只能学习表达形状；没有目标内容自己的证据时，不得迁移具体承诺。
- 赚钱项目必须先锁定讲述者、目标观众、案例买家和内容目标；买家痛点只证明需求，场景包装落在卖家的接单、定价、交付和效率变化上。

## Cleanup Result

- 先前误删的 DNA 重构版已恢复。旧 `profiles` 内容经过逐节核对后，其中仍有价值的适用边界、来源事实、证据、CTA、风险和输入要求已经合并进重构版；旧开场公式和课程化框架没有重新合入。
- `profiles/钱十七-闲鱼风格拆解.md` 已改为重构版的 hard-link 别名；两个路径共享同一 File ID 和内容哈希。
- Codex 代安装案例只保留一套主交付：
  - `research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.md`
  - `research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`
- 相关事实包、真实截图、报告和 Word 转换脚本继续保留；旧候选稿、临时解包、缓存和渲染中间件已移入回收站。
- 工作台历史只保留最新 1 次飞书导入和最新 1 次改写运行。
- `仿写案例库` 中的版本历史和 Skill 自带素材没有删除，它们是训练证据或运行资产，不是当前钱十七风格入口。

## Verification

- 正式审计 JSON 解析通过。
- 合格重构版的 A/B/C 结构核对通过：A=7、B=6、C=5；95% 主干权重、频次限制、段落示例和完整检查清单均保留。
- 重构版与 `profiles` 工作台别名哈希一致，并已验证为同一 hard link。
- `$spoken-style-profiler` 完整结构验证通过：0 errors，0 warnings。
- 与钱十七来源的 20 字精确泄漏扫描通过：0 matches。
- 项目单元测试 6/6 通过；style-copywriter 正例和 4 个对抗分支均符合预期。
- `content-fusion` Python 编译与 8/8 测试通过；真实 Codex 代安装证据包端到端检索到 3 篇知识并输出 3 条、schema `1.0` 的可审计知识包。
- `style-copywriter` 正例通过；事实缺失、禁用词、泄漏、主体缺失、空知识包、假来源、假正文片段、未锁定数字、未锁定中文结果主张共 9 个对抗分支均按预期失败。
- `$qian17-copywriter` 与通用 `style-copywriter` 均通过 Skill 结构验证；Node 验证器语法检查通过。
- `$qian17-copywriter` 新增 Word 默认交付规则后再次通过 `quick_validate.py`。
- Codex 代安装 Word 含 2 张 inline 图片、2 条有效替代文本，图片审计通过；无障碍审计 `high=0, medium=0, low=0`。
- Word 已用本机 Word 导出并逐页检查 4 页渲染：无错误裁切、重叠、溢出或空白页；最终正文无可见说明标签、图号图注、页眉页脚、`[插图]` / `[录屏]` 残留，也未命中 `不是/而是/真正关键/本质上/底层逻辑/你会发现` 等禁用壳。
- 事实、钱十七风格、Word/截图三路独立复审均为 `ACCEPT`；事实复审同时纠正了截图共用采集记录时间的边界说明。
- 排除刻意保留的案例库训练/Skill 资产后，其余项目范围精确哈希重复组为 0。
- 唯一主文件和 Skill 已包含场景型价值预演与反 AI 二元纠偏规则。

## Next Step

等待用户直接审阅当前 canonical Word。后续继续走“角色锁定 → 事实 + 知识 + 风格 → 干净 Word 就地配图 → 逐页验收”的单一流程；除非用户明确要求，不在聊天中展开全文。
