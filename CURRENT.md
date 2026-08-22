# Current

最后更新：2026-08-22

## 目标

一个不绑 IP 的双能力引擎：

- **能力一 · 拆解**：给一个新 IP 的样本，产出这个 IP 的写作风格 DNA。
- **能力二 · 仿写**：拿某个 IP 的 DNA，改写用户提供的内容。

前提是以后会接入很多个 IP，所以两个能力都必须“换个 IP 就能跑”。钱十七和半佛都只是夹具，不是目的。

## 现在的真实状态

| 项 | 状态 |
| --- | --- |
| 钱十七 profile | `draft / review_only`，从未批准 |
| 半佛 profile | 手写档案，无证据锚点、无审计链、未经任何 CLI 校验 |
| 首篇仿写验收（F003） | 未通过。钱十七线连续三稿被拒；半佛线两稿用户未判定 |
| 仓库测试 | `npm test` 31/31 通过；`npm run lint` 通过 |
| 部署 | 无。项目仅本地 + 私有 GitHub 仓库 |

## 未解决的核心矛盾

技术门禁全绿但风格不合格，这个矛盾没有被解决。

钱十七线在 2026-07 建了完整的门禁体系——生成前预检、输出校验、来源泄漏扫描、五摘要绑定的批准记录——三次生成全部通过全部门禁，三次都被用户拒绝，理由是“AI 味重、看不出钱十七风格”。

`style-acceptance-locks` 是朝这个方向做的第一次尝试（把人工校准原句硬锁进预检），但它绑死在单个任务上，没有上升为 per-IP 的可复用验收层。

同时半佛线用完全相反的方法——手写规则、无审计、两天出稿——产出了看起来可读的东西。哪套方法真的有效，目前没有证据，这正是下一步要判定的。

## 下一步

**F011 · 双路线对照**（用户 2026-08-22 指定）

同一个选题，分别用严谨线（钱十七 DNA）和轻量线（半佛 DNA）各产出一稿，交用户判定哪套方法真的产出了能用的东西，结论写入 `DECISIONS.md`，据此再定路线。

在此之前不预设路线取舍，也不继续给任何一条线加功能。

## 已知缺口

- Skill 真身在仓库外（`C:\Users\admin\.codex\skills\`），`engine/skills/` 是副本，两者无同步机制。
- 半佛没有 `corpus/`：语料在 `仿写案例库/`（gitignore，约 350MB），只有提取脚本入库，拆解结论无法回查到具体样本。
- 钱十七没有 `outputs/`：历史产出在 `research-runs/`（gitignore），未入库。
- `docs/verification.md` 与 `DECISIONS.md` 中保留了指向已删除路径的记录。这是历史事实，不修改。

## 本轮变更（2026-08-22 仓库整理）

- 提交了 2026-07-29 之后积压的一个月工作（两个提交）。
- 删除已停工路径：`workbench-ui/`、`scripts/serve-workbench.mjs`、`review-context/`、`tmp/`、`workbench_imports/`、`init.ps1`。均可从 git 历史恢复。
- 重构为 `engine/`（不绑 IP）+ `ips/<IP名>/`（每 IP 统一五段结构）。
- 退役 `profiles/` 目录与钱十七 hard-link 别名；该别名只为已删除的工作台而存在，正本现位于 `ips/钱十七/dna/`。
- 重写 `README.md`、`CURRENT.md`、`HANDOFF.md`、`docs/architecture.md`、`docs/commands.md`、`feature_list.json`、`package.json`。
- 旧状态文档归档至 `docs/history/`。
