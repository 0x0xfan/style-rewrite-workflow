# 钱十七重拆 Baseline / Enhanced 对照审计（2026-07-29）

## 目的

验证新增辅助控制不会压过内容类型框架。本轮只审计生成计划和控制预算，不把评测计划说成正式仿写，也不据此批准 profile。

## 共同前提

- 三个候选框架仍为 `candidate / profile_approval_required`。
- 所有辅助 pattern 仍为 `observation / review_only`。
- Baseline 与 Enhanced 必须使用同一个 content contract、同一个框架、同一事实顺序。
- 任一输入缺少事实 contract、可回读知识包或风格档案时停止。

## 对照设计

| 内容信号 | Baseline | Enhanced | 允许的差异 | 禁止的差异 |
|---|---|---|---|---|
| 完整项目执行链 | 只执行 `fw-project-breakdown` 六个 beats | 同框架，按内容需要最多加 2 个 pattern | 一次结果反差；真实依赖处一次阶段价值重置 | 新增章节、改变步骤顺序、强塞生活场景 |
| 筛选/判断教程 | 只执行 `fw-screening-tutorial` 五个 beats | 同框架，最多加公式压缩与一次互动 | 把已有标准压成一句；密集处提醒保存 | 把单一分支冒充通用公式；反复纠偏句壳 |
| 时间/类别目录 | 只执行 `fw-resource-directory` 五个 beats | 同框架，最多加一次互动提示 | 在高密度条目处提示暂停或保存 | 给每一项都加价值包装；改成课程章节 |

## 自动门禁

`style-engine/tests/qian17-reprofile.test.mjs` 验证：

1. Baseline 的 pattern 数量严格为 0。
2. Enhanced 与 Baseline 使用同一个 framework。
3. Enhanced pattern 总数不超过 2。
4. 一般 pattern 的 `max_per_script=1`；阶段价值重置的 Enhanced 评测预算为 2，且所有 pattern 禁止相邻重复。该预算是防过度控制门禁，不是风格频次结论。
5. 每个候选框架至少有两个完整同序的独立证据路径。

实际结果：`npm run test:spoken-dna` 通过 12/12。

## 本轮删减结论

- 删除“场景价值预演属于 95% 主干”的权重说法。
- 删除“长稿固定 3-5 次场景预演”。
- 阶段价值重置保留为 P7 观察，仅在真实依赖或关键节点使用。
- “三连低门槛”“先排雷再推荐”保留为单路径/模板族观察，不升级为框架主干。
- 默认生成策略选择 Baseline；只有 Enhanced 在真人并排审阅中明确更自然、更像钱十七时，才保留所用辅助控制。

## 尚未完成

- 尚未用同一个真实目标 contract 生成两篇完整观众稿并由用户盲评。
- 尚未获得新一轮外部 approval record。
- 因此 profile 继续保持 `draft`，正式仿写选择器不得启用。
