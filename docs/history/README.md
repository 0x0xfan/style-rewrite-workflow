# 归档文档

这里的文件记录的是**当时的状态**，不随仓库结构更新。里面提到的路径大多已经不存在。

2026-08-22 做过一次结构重构，新旧路径对应关系如下：

| 旧路径 | 新路径 |
| --- | --- |
| `style-engine/` | `engine/` |
| `style-engine/evaluation/spoken-style-profiler-qian17/` | `ips/钱十七/`，按 `corpus/` `dna/` `audits/` `generation/` 分开 |
| `style-engine/evaluation/spoken-style-profiler-narrative-fixture/` | `engine/fixtures/narrative/` |
| `style-engine/evaluation/style-copywriter-tests/` | `engine/fixtures/writer-tests/` |
| `profiles/钱十七-闲鱼风格拆解.md` | `ips/钱十七/dna/钱十七-DNA-重构版.md`（原为 hard link 别名，已退役） |
| `profiles/半佛-*.md` | `ips/半佛/dna/` |

同时删除的路径（可从 git 历史恢复）：

- `workbench-ui/`、`scripts/serve-workbench.mjs`、`init.ps1` — 本地浏览器工作台、飞书导入、模型改写、TTS
- `review-context/` — 2026-07-29 给 ChatGPT Pro 的投递包，投递本身失败作废
- `tmp/`、`workbench_imports/` — 生成缓存与 2026-06-27 的单次导入残留

## 文件

- `CURRENT-归档-20260822.md` — 2026-06 至 2026-07-31 的逐轮状态记录
- `HANDOFF-归档-20260822.md` — 同期的跨线程交接记录
- `EXECUTION_PLAN-归档-20260822.md` — 2026-07-28 的执行计划
- `TASK_CARD-F007-归档-20260822.md` — F007 任务卡，已完成
- `对话备份-风格拆解讨论-20260729.md` — 风格拆解讨论对话备份
