# AGENTS.md

2026-09-25 重写。旧版（DNA/F011/approval 路线的全部规矩）已归档到 `docs/history/AGENTS-旧路线-20260925.md`，**那些规矩全部作废，不要遵守**。

## 这个项目是干什么的

给用户圣矾（做闲鱼虚拟项目的 B 站 UP 主，非技术人员）写口播文案，并连同素材交给视频项目出片。

每天的节奏（2026-09-29 定，取代 09-25 版）：
1. **13 个账号每天各写一篇存稿 + 3 篇真人出镜（共 16 篇）**：横版 6 个账号（黑黄 black-yellow-v2 / 荧光绿 lime-capsule / 署名墙 signature-wall / 对账台 ledger-desk / 蓝图拆解 blueprint / 像素街机 pixel-arcade，5 分钟、1300–1600 字，daily-write 写法）；竖版 7 个账号（同六套皮肤竖版 + 聊天记录 chat，1–2 分钟、300–600 字，short-video / chat-record 写法）；真人出镜 3 篇（竖版 1–2 分钟，用户自己录，不出片）。横版和竖版是不同账号。
2. **先排「今日选题表」给用户过目**（`daily-plan` 技能，读 `docs/每日/账号选题台账.md`）：选题只两条硬规矩——同一账号不重复；同一天各篇选题不同。横版以产品题为主，竖版和真人出镜可以讲知识题。用户点头再分批派写稿。
3. 正稿放 NAS「待审文案\<选题>\」，按账号命名，旁边放同名 `.meta.json`（skin / orientation / lengthTarget / date / topicSlug；真人出镜 kind:selfie）；资料放「资料\<选题>\」。用户在中控台「今日任务」逐套审，当晚 AI 出片（真人出镜不出片）。
4. 员工改稿放 NAS「已用」，改动要逐步减到零（`engine/return/edit-stats.mjs` 看趋势）；已用稿走 `script-return` 技能进视频项目。

## 按任务读什么

| 要做的事 | 读 |
|---|---|
| **新会话先看：整条文案流程（两个入口：SRT 优先 / 选题卡）** | `.claude/skills/copy-pipeline/SKILL.md` |
| **每天排今日选题（9 账号 + 3 真人出镜）、分批派写稿、汇总登记** | `.claude/skills/daily-plan/SKILL.md` |
| 写稿（长稿 / 短稿） | `.claude/skills/daily-write/SKILL.md` |
| 写 1–2 分钟竖版口播短视频（含真人出镜） | `.claude/skills/short-video/SKILL.md` |
| 写聊天记录式短视频（手机聊天画面、无配音） | `.claude/skills/chat-record/SKILL.md` |
| 审稿：开头 / 流畅度 / 共鸣 / 传播 / 发布风险 | `.claude/skills/` 下 `dbs-hook`、`dbs-script-flow`、`dbs-resonate`、`dbs-spread`、`dbs-content-risk-check` 的 `SKILL.md` |
| 素材库二次整理（用户放了截图/链接/关键词，说"二次整理 XX"） | `.claude/skills/material-organize/SKILL.md` |
| 员工改好的稿 → 学习 → 进视频项目 | `.claude/skills/script-return/SKILL.md` |
| 知识库有新同行文章 | `.claude/skills/kb-intake/SKILL.md` |
| 了解全貌、路径、已知的坑 | `HANDOFF.md` |
| 用户定过的事 | `DECISIONS.md` 末尾 |

写稿规矩只有两处真身：`docs/写稿规则.json` 和 `docs/用户校准词表.json`。交稿前跑 `npm run check:draft`。

## 硬规矩

- 稿里的钱数、收益、单价只能来自用户给的选题卡或用户自己视频字幕里说过的；闲鱼数据只能来自实际搜索的截图。查不到就停下说明，绝不编。不编"我/学员"的收入。
- 讲述者是圣矾本人，面向想在闲鱼做这个项目的人（卖家视角），不是教买家怎么买。
- 口播稿里不许出现写稿过程（"原稿里""截图显示""根据你提供的"之类），不许出现具体月份等时效词，一律说"你在闲鱼搜"。
- 风险只点版权、隐私、违法、亏钱、做不下去这几类红线，集中说一次，不反复免责；不写躺赚、稳赚、月入过万、百分百。
- 闲鱼采集不许用假数据或假截图；截图要解码、查尺寸和 SHA-256 才算有效。只搜索和截图，不动用户的闲鱼账号。
- 同一选题可以发很多条，但同题的几篇不共享故事、例子、自造说法和开头结构。

## 干活规矩

- 用户不懂技术：说大白话，给选项并带推荐，一次只问一件事；先讨论，用户说干再干。
- 不浪费额度：不反复重试、不轮询；同一个阻塞连续失败两次就停，写进 `HANDOFF.md` 交回。
- 只动当前任务需要的文件；不回退别人的改动；没有证据不说"做完了"。
- 这些文件只由主会话改：`CURRENT.md`、`DECISIONS.md`、`HANDOFF.md`、`docs/反馈台账.md`、`docs/稿件登记.json`（例外：每日写稿按 daily-write 技能用 `engine/return/registry.mjs add` 登记新稿、往 `docs/每日/故事登记.md` 末尾追加一行，只追加不改旧条目）、`docs/用户校准词表.json`、`docs/写稿规则.json`。其他 agent 要改，写在报告里交主会话。
- 视频仓库 `D:\项目仓库\remotion视频制作` 有自己的规矩，动之前先读它的 `AGENTS.md` 和 `STATE.md`。
- 不推 GitHub，除非用户说推。
