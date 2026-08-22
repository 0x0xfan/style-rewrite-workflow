# Handoff

## Codex 远程安装文案视频配图 — 2026-07-31（已撤销）

- 用户认为新增配图不合格，要求删除并恢复原状。
- 已从本轮备份恢复原文档，正文文本与备份一致，inline 图片恢复为原有 2 张。
- 恢复后文档 SHA-256：`60A8BBF9A8CBEB1FBBCD61A758AAC2029C23187D1981FC4890EA8F9727047F2A`。
- 本轮新增素材、渲染目录和生成缓存已移入回收站；本轮辅助脚本已删除，未保留配图交付物。

## 提问式校准对话导出 — 2026-07-31

- 目标：把用户要求“向我提问、我判断对错”的昨天下午对话导出给其他模型参考。
- 产物：`C:\Users\admin\Desktop\钱十七风格校准_提问式训练对话_20260730_1410-1704.md`。
- 范围：2026-07-30 14:10:19–17:04:39（Asia/Shanghai）；来源为本地 rollout JSONL；已排除自动注入上下文和 AGENTS 系统说明。
- 验证：80,716 bytes；SHA-256 `497097F5B2BDA04AE8A0E25863D45A6A98B1C5A92DE70918D279A905AFB2979E`；已检查文件头、文件尾和哈希。
- 状态：导出完成；仅写入桌面文件，项目代码未改动，未提交、未推送、未部署。

## Codex Installation Middle/Ending Rewrite — 2026-07-31 (current)

- User froze the previously calibrated opening and narrowed this round to the middle and ending.
- The authoritative 11-script corpus was reread directly. Qian17 project middles advance through real project dependencies; major transitions repackage value, while small steps deliver continuously without a fixed hook quota.
- The three buyer types are now one compact demand-proof beat. The dominant chain is capability preparation → listing/acquisition → need classification → quotation → delivery. The ending no longer recaps the whole lesson; it moves from the last delivery boundary directly to the free installer/tutorial CTA and identity line.
- Fresh Baseline SHA-256: `6CED29A44C461599B6C978DC722794817C10B1ABE5504EBFCEBE97D0F12F9EAF`; Enhanced SHA-256: `9D2B05D0BC3C5A4C12CE8D6359FDF525D621A6366CFCB40664849ED0787679FA`.
- Enhanced display/TTS units: 1,251 / 1,251; estimated 5:13 at 240 characters/minute. Search/title support: 172/1,251 = 13.7%.
- Preflight: Baseline 8/8, Enhanced 8/8. Output: 13/13, 0 warnings/failures, authoritative-corpus 20-character leakage scan 0 findings. Repo verification: 32/32 tests plus lint, validator syntax, JSON and `git diff --check` passed.
- Canonical Word: `research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`; 348,672 bytes; SHA-256 `B682D8FA16AD0C12A3AF2809DE9AB892ABA5068B1C41709E684C71E050AAE809`.
- Word/Markdown paragraphs: 19/19. Images/alts: 2/2. A11y high/medium/low: 0/0/0. Packaged render lacked `soffice`; Microsoft Word exported a real 2-page PDF and bundled Poppler produced PNGs. Both pages were inspected and passed.
- Status: local only; no commit, push or deployment. Profile remains `draft/review_only`; candidate remains `pending_user_review`.
- Next: accept only user feedback on the middle and ending. If rejected again, isolate whether the failing layer is project-stage selection, benefit packaging at major transitions, or sentence voice; do not restart the opening.

## Codex Installation Human-Lock Rewrite — 2026-07-31 (historical; superseded by middle/ending rewrite)

- User rejected the allocation-only rewrite because it again lost Qian17 hooks and regressed into AI-like classification, tidy summaries and service explanation. The failure was preserved in `human-calibration-20260730.md`.
- New task-local `style-acceptance-locks.json` binds the calibration SHA-256 and keeps product phrases outside the generic DNA. It contains 5 exact approvals, 3 semantic locks, 6 rejected expressions, 3 AI-shell budgets and 6 evidence-bound hook duties.
- Input preflight now fails when calibration/lock/task/metadata hashes do not close, or when a draft/review-only structural rewrite lacks a fresh Baseline/Enhanced plan and reset status. Output validation now checks exact/semantic locks, rejected shells, hook fulfillment, allocation and comparison hashes.
- Fresh Baseline SHA-256: `D71F71F9149BF2A30CAEB4DB65B32B28D20223DF3BAD27CB3B18CD5F4C6737EC`; fresh Enhanced SHA-256: `4C862FEA82585A021B711FB39BFB5979878A11526420ED744629811DC9B1A8A9`.
- Enhanced display copy has 1,170 effective characters. TTS has 1,153 effective characters, no Latin/digits/markers/raw brands, and estimates to 4:48 at 240 characters/minute. Actual TTS pacing is unverified.
- Listing/search support is 159/1,170 effective display characters, 13.6%, below the task-local 15% cap.
- Persistent evidence: `style-acceptance-locks.json`, `baseline-enhanced-comparison-20260731.md`, `adversarial-copy-review-20260730.md`, `final-verification-20260730.md`, `style-application-audit.md`, `listener-progression-plan.md`, and both validation reports.
- Task Brief SHA-256: `F2406C9412E736658992D5444194D5F1BA43D578863700FC017C0404AA03B203`.
- Canonical Word: `research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`; 348,711 bytes; SHA-256 `811C94A177EF170E9F3D99E501E357AE5389741CB323FE753E9972AB3938D61F`.
- Word QA: Markdown/Word 22/22 exact; 2 inline images with semantic alt text; a11y 0/0/0; no non-empty header/footer, unresolved marker or private audit label. Rendering failed because the office converter executable is absent; no current visual-layout pass may be claimed.
- Verification: preflight 8/8; output 13/13; lint passed; repository tests 32/32; both Skills valid; validator syntax and diff-check passed.
- ChatGPT Pro conversation: `https://chatgpt.com/c/6a69b4e9-dec8-83ee-80c4-8d9ad4a8e568`. Two prior sends timed out; no new Pro reply exists and no third retry was made.
- Git state: branch `main`, baseline HEAD `ab101118e63fbf047654cf5e1438282ba2f9e59e`; dirty worktree preserved; local-only, no commit/push/PR/deployment. Qian17 profile remains `draft/review_only`; Enhanced remains `pending_user_review`.

## Business Architecture Diagram — 2026-07-30

- User asked for a business-logic architecture diagram for P011 风格仿写, not code details.
- Created draw.io artifact: `D:\项目仓库\大脑\diagrams\04-风格仿写业务架构图.drawio`.
- User then asked Codex to open it. Next AI Draw.io's `embed.diagrams.net` iframe was present but stuck behind the loading state and rendered a blank/broken frame when forced visible, so a local preview artifact was added: `D:\项目仓库\大脑\diagrams\04-风格仿写业务架构图.preview.html`. It is currently served at `http://localhost:4317/04-%E9%A3%8E%E6%A0%BC%E4%BB%BF%E5%86%99%E4%B8%9A%E5%8A%A1%E6%9E%B6%E6%9E%84%E5%9B%BE.preview.html`.
- Diagram covers five layers: style source, Style DNA, target-content inputs, controlled generation, and delivery/regression.
- Key gates shown: source facts cannot be reused as target facts; draft/review_only DNA cannot drive formal selection; generation requires task brief, fact contract, nonempty knowledge pack and verified materials.
- Validation: `.drawio` parsed successfully as XML; preview page loaded and rendered 187 SVG children in the in-app browser. Project state unchanged: Qian17 remains `draft/review_only`; user style acceptance remains pending.

## Qian17 style application rerun — 2026-07-30

- User corrected the diagnosis: ask why Qian17 style was not actually applied before blaming the profile. The rerun follows that order.
- Same Codex project facts, two private outputs: `style-application-20260730/baseline-content.md` and `qian17-styled.md`; only the styled output was written to the canonical Word.
- Selected `fw-project-breakdown` with 10 evidenced path slots. Acquisition/inquiry remain test-only; no order or income claim was added.
- Style trace: A1–A6 + P1/P7 each bind a purpose and an exact output span. The output validator now rejects declared rules with no copy span and explicitly says span coverage is not human similarity proof.
- Preflight 6/6 passed; output validation 8/8 passed; 20-character source overlap 0.
- User requested a five-minute version. Expanded from 993 to 1,240 spoken units by adding reproducible practice, four listing-detail fields and inquiry-scope screening; estimated 4.8 minutes fast / 5.2 minutes normal.
- Canonical Word: 348,979 bytes; SHA-256 `77CD1353AB8AABFC1FBEE625D7927C9B83FCF0CC60A00EA68254D60F7E193083`; 22 paragraphs, 2 inline images, 2 semantic alt texts, a11y 0/0/0, 2 rendered pages visually passed.
- Repository gates: lint passed, 19/19 tests passed, personal Skill valid, diff-check clean.
- State: local-only, uncommitted, unpushed, undeployed. Style acceptance remains pending user review; profile remains draft/review_only.

## User rejected the clean Enhanced — 2026-07-30 (historical; prior screening draft)

- User's direct verdict: the delivered script still sounds strongly AI-generated and does not read like Qian17.
- Root/enhanced metadata now records `rejected_by_user / failed_user_rejected`; all previous technical passes remain technical evidence only.
- New diagnosis: the rewrite solved task-role consistency but changed the requested money-making-project pitch into a cautious feasibility-screening memo. Symmetric “three tests,” repeated evidentiary caveats, corrective contrasts and a laboratory-style install paragraph dominated the voice.
- The current profile/generator reproduces generic structure better than Qian17's distinctive money-project voice: benefit-led certainty, oral roughness, concrete business motion, persuasion embedded in explanation, and energetic transitions.
- Do not revise the full Word again before aligning with the user. Proposed next step: rebuild the money-project subprofile from the relevant units, separately complete the project's business path, then present a short voice sample before producing another full document.

## Clean Codex Installation Baseline / Enhanced — 2026-07-30

- Objective executed: diagnose whether the failure came from style profiling or downstream generation, discuss the evidence/gates with Pro-level collaborators, then produce a clean Qian17 evaluation draft.
- Root cause: the rejected draft changed the target viewer from “no Codex delivery capability” to “already able to install/connect/troubleshoot,” forced `fw-project-breakdown` without acquisition/order/full-delivery evidence, and let counterevidence define the core method. Post-generation technical checks could not detect that semantic failure.
- New pre-generation artifacts: `research-runs/2026-07-27_codex代安装_refresh/baseline-20260730/task-brief.json`, `source-contract.md`, `knowledge-pack.json`, both metadata files and both preflight reports. Task brief SHA-256: `eb38f4389f69a78e65ccc2591138572b9b0ee04363029fb9bee3df41a1fd24a6`.
- Framework correction: selected `fw-screening-tutorial`; Baseline uses framework only, Enhanced adds only `pt-data-meaning-value` and `pt-formula-compression`. Both input gates passed 6/6 and output validators passed 7/7; Enhanced was selected internally, but user approval remains pending.
- New generic enforcement: `style-engine/skills/style-copywriter/scripts/validate-generation-inputs.mjs`; five regression tests cover clean pass, role drift, missing evidence state, counterevidence misuse and rejected plan reuse. Generic and personal Qian17 Skill instructions now require task SHA alignment, framework slot evidence and knowledge stance restrictions.
- Technical evidence: isolated npm install of `@openai/codex@0.145.0` on Windows 11 x64 completed in 229.6 seconds and returned `codex-cli 0.145.0`; no sign-in, secrets, third-party model work, customer delivery or order validation occurred.
- Canonical Word updated in place: `research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`; 348,294 bytes; SHA-256 `1CE77870CBB76ECAC9464A7ECB73B0BF9C5CD020CF71C14D43F24BCC7C1D34F9`.
- Word QA: 18 text paragraphs match Markdown after removing two internal image markers; 2 inline verified images with 2 semantic alt texts; a11y 0/0/0; no header/footer/page number; 2 rendered pages visually passed.
- Repository gates: lint passed; test suite 17/17 passed; validator syntax passed; personal Skill valid; `git diff --check` no whitespace errors.
- Collaboration: ChatGPT Pro conversation `https://chatgpt.com/c/6a69b4e9-dec8-83ee-80c4-8d9ad4a8e568`; two additional `gpt-5.6-terra / ultra` research/audit tasks completed without fallback. Requested model/settings were accepted; observed hidden runtime identifier was not exposed.
- Background task IDs `019fb078-d9dd-7d00-98fc-581dc90e916d` and `019fb078-835d-75d0-9704-90ffc5b824dd` were archived after their findings were adopted and independently checked.
- State: local-only, uncommitted, not pushed, no PR, no deployment. Qian17 profile remains `draft/review_only`. Next action is the user's subjective style judgment of the canonical Word, not automatic approval.

## User Rejection + ChatGPT Pro Root-Cause Review — 2026-07-29 (historical; superseded by clean 2026-07-30 run)

- User rejected the latest Codex-installation script as the same failure mode documented in `对话备份-风格拆解讨论-20260729.md`.
- Generation metadata now preserves the distinction: technical validator remains passed, while delivery/acceptance is `rejected_by_user` and style review is failed.
- Confirmed upstream contradictions: user requested a viewer without Codex delivery capability; contract assumed some computer/AI competence; copy then assumed installation/model/error-handling competence.
- Confirmed gate violation: `fw-project-breakdown` was selected despite its own abstention rule and the lack of verified learning, acquisition, conversion and full-delivery path.
- Confirmed knowledge-direction defect: a tag-matched high-barrier virtual-product source became the dominant mechanism and reversed the intended novice-opportunity angle.
- ChatGPT Pro conversation: `https://chatgpt.com/c/6a69b4e9-dec8-83ee-80c4-8d9ad4a8e568`.
- Pro revised its earlier emphasis: this draft is not a valid DNA Baseline; pre-generation requirement/role/selector/knowledge controls failed before DNA execution could be isolated. It agreed the current validator proves task formatting, not task correctness.
- Codex challenge to Pro: do not reduce intent consistency to beginner keywords, do not require historical orders for every method-level claim, treat low barrier as a falsifiable hypothesis, and classify knowledge as support/counterevidence/supplement/conflict. The page failed to submit this follow-up twice; stop retrying until page state changes.
- Next safe work: (1) derive a semantically faithful task contract from the user's exact statement; (2) research and classify evidence for learning, service formation, listing/acquisition, conversion claims and delivery; (3) run selector/claim gates before generating a clean Baseline. Do not revise the style DNA yet.

## Codex 代安装纯框架 Baseline — 2026-07-29 (historical; user rejected)

- User asked for one new Codex remote-installation script after the Qian17 re-profile.
- Chosen isolation: `fw-project-breakdown` only, with no auxiliary patterns, so the user can judge the rebuilt main framework without extra style controls.
- Canonical delivery updated in place: `research-runs/2026-07-27_codex代安装_refresh/codex代安装_纯口播稿_钱十七风格_改进版.docx`; no V2/正式版 duplicate was created.
- Inputs: `source-contract.md`, nonempty `knowledge-pack.json`, draft Qian17 profile. Only `knowledge-01` mechanism was used; its revenue/case claims were excluded.
- `generation-validation-report.md`: passed, 7 checks, 0 warnings/failures; nine required literals and four subject relations preserved; 20-character source-overlap scan found 0 matches.
- DOCX QA: Markdown/Word text exact after removing two internal image markers; 2 embedded images, 2 meaningful alt texts, 0 a11y findings, no headers/footers/page-number parts, one title.
- Rendering: packaged renderer could not use missing LibreOffice `soffice`; real Microsoft Word export plus bundled Poppler produced 3 pages. All pages were visually inspected and passed for crop, overlap, overflow, blank-page and screenshot readability.
- Final DOCX: 348,854 bytes; SHA-256 `4274BFFD964C374256D0831D4727C11AA308B7C3FFA8BD665E6AC902D6719FFC`.
- Repository gates: lint passed; spoken DNA tests passed 12/12; `git diff --check` passed with existing line-ending warnings only.
- State: local-only, uncommitted, not pushed/deployed. Profile remains `draft/review_only`; next action is user style judgment, not automatic approval.

## 钱十七完整语料重拆 — 2026-07-29

- Authority source: `C:\Users\admin\Downloads\钱十七-闲鱼文案拆解.docx`; SHA-256 `036B6795AC894CCE20A81A2ACCFC08284C67337B8F20E27643592D0AC2F1E290`.
- Root cause confirmed: Word has 11 scripts; old Markdown/profile covered 8. u03/u07 are one transcript-variant cluster, so evidence changed from 7 to 10 independent clusters.
- Additional defect: old canonical Markdown contained facts and identity from later target test drafts, mislabeled as Qian17 sample evidence. It also promoted single-draft editing preferences to stable style rules.
- Rebuilt in isolated worktree `D:\项目仓库\风格仿写-qian17-reprofile`, branch `agent/qian17-reprofile`; no commit, push, PR or deployment.
- Canonical human file updated in place: `style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`. Workbench alias remains an NTFS hard link and must keep the same File ID.
- Machine evidence rebuilt: `corpus-manifest.json`, `sample-health.json`, `sample-decisions.draft.json`, `annotations.draft.json`, `style-dna.draft.json` now use `qian17-spoken-v2`, 11 raw units, 10 independent clusters, three candidate frameworks and seven bounded review-only patterns.
- Evidence reports: `source-audit-20260729.md`, `baseline-enhanced-audit-20260729.md`.
- Independent adversarial review changed the draft: fixed-frequency value preview, blanket bans on contrast/research background/visible screenshots and one-block risk rules were rejected; stable core is concrete relevance, scope/path, numbered progression, evidence proximity and multi-stage target-owned CTA.
- Validation: `spoken-style-tool validate` ok=true, 0 errors/warnings; `leakage` ok=true, 0 matches; `npm run lint` passed; `npm run test:spoken-dna` passed 12/12.
- Downstream generation entry updated: `C:\Users\admin\.codex\skills\qian17-copywriter\SKILL.md` and `references\generation-workflow.md` now consume the rebuilt framework library and no longer hard-code fixed 3-5 scene previews, zero semantic contrast or one risk block. `quick_validate.py` passed under UTF-8 with system Python/PyYAML.
- DOCX visual rendering was not performed because local LibreOffice `soffice` is unavailable. Text/structure extraction succeeded; do not call it page-layout QA.
- External Pro blocked report: fresh Pro chat loaded, but both the general file-input upload path and visible attachment-button path timed out with recurring `ab.chatgpt.com` network errors. No source, prompt or message was transmitted, and no conversation URL exists. Stop retrying until page state changes.
- Recovery package: `artifacts/dual-agent/2026-07-29-qian17-reprofile/qian17-reprofile-ab10111.zip`; baseline commit `ab101118e63fbf047654cf5e1438282ba2f9e59e`; 80,872 bytes; SHA-256 `c69c8d8e544bac113808658c076b07022e9fb2098dd027b360868afda0d9e34b`; 15 entries; secret findings 0; forbidden archive entries 0.
- Next task: choose one real target content contract with a nonempty verified knowledge pack, generate framework-only Baseline and at-most-two-pattern Enhanced outputs, and ask the user to blind-rank them. Keep profile draft until that comparison is accepted.

## Blocked Report — 2026-07-29 GitHub Direct GPT Pro Dispatch

- User-authorized route: right-side ChatGPT Pro reads the private GitHub repository directly; ZIP upload is superseded for this dispatch.
- Review-context commit: `1eba623e4ac76ae8c89df92283a5053c8940d87f`.
- Review-context path: `review-context/2026-07-29-imitation-pro-repair/`.
- Repository preparation succeeded: 29 files committed and pushed, including the task, manifest, rejected output, generation inputs and external Skill snapshots; secret scan was clean.
- Attempt 1: Playwright located the unique chat textbox, confirmed the Pro selector, filled the GitHub dispatch prompt and pressed Enter, but the browser operation timed out. Recovery readback showed no prompt and no conversation URL.
- Attempt 2: a fresh DOM snapshot identified the visible chat textbox; direct click/type/Enter also timed out. Recovery readback again showed a blank new chat and repeated `ab.chatgpt.com` timeout.
- Status: `BLOCKED` before external review. ChatGPT Pro has not proved repository access and has not returned findings.
- Required recovery: one visible user-side submission of the short GitHub dispatch prompt in the right tab. After a conversation URL exists, Codex resumes all technical communication and verification.
- Do not retry browser submission again until the page state changes; do not claim silence means progress.

## Blocked Report — 2026-07-29 GPT Pro Imitation Repair

- Status: `BLOCKED` before external dispatch; no product implementation was changed in this attempt.
- User feedback: current imitation is unsatisfactory despite prior technical gates.
- New package: `artifacts/dual-agent/2026-07-29-imitation-pro-repair/imitation-pro-repair-c85a9a1.zip`.
- Package baseline: Git commit `c85a9a19e34a968231d75342d33eb1e2b49bde9a`; 574,914 bytes; SHA-256 `59049d7f9ec31c5bf62be68693779aa72f054457d7db79f71313a819b2a6d2ab`; 213 archive entries; zero forbidden entries.
- Added context: the actual rejected Markdown output, `generation-metadata.json`, `knowledge-pack.json`, `analysis.json`, `products.json`, internal report, canonical profiler Skill and Qian17 copywriter Skill.
- Prepared task: `artifacts/dual-agent/2026-07-29-imitation-pro-repair/CHATGPT_PRO_TASK.md`, focused on diagnosing the gap between passing machine gates and failing human style judgment, adding failure-first regressions, implementing a minimal reusable generation-plan fix, and producing an evaluation-only shadow output.
- Attempt 1: direct general file input was present but hidden; supported click failed as not visible.
- Attempt 2: visible attachment-button interaction timed out; recovery readback showed no open menu or attachment and repeated `ab.chatgpt.com` initialization timeout.
- External review evidence: none. No prompt or ZIP reached ChatGPT Pro; no conversation URL exists.
- Required recovery: in the right-side Pro tab, manually attach the existing ZIP once. After the attachment is visible, Codex can continue all remaining communication and verification without user relaying technical messages.
- Forbidden fallback: do not publish the private repository, paste incomplete source context, or ask ChatGPT Pro to pretend it accessed local/private files.

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
