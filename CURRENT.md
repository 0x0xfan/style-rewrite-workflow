# Current

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

- 用户确认的唯一内容主版本：`style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`
- 工作台兼容路径：`profiles/钱十七-闲鱼风格拆解.md`，是主版本的 NTFS hard link，不是第二份内容
- 同一风格的机器审计契约：`style-engine/evaluation/spoken-style-profiler-qian17/style-dna.draft.json`
- 实际调用 Skill：`C:\Users\admin\.codex\skills\qian17-copywriter\SKILL.md`

机器审计 JSON 只负责证据、状态和验证，不是第二套写法。用户已确认重构版为合格写作基准；JSON 仍为 `draft/review_only`，因为正式证据审批尚未单独完成。

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
