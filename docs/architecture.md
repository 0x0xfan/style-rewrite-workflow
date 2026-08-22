# Architecture

## 结构

仓库按“能力”和“IP”两轴切开：`engine/` 里不出现任何具体 IP，`ips/` 里不出现任何通用逻辑。

```text
engine/                              不绑 IP 的引擎
  skills/spoken-style-profiler-v2/   能力一：风格拆解（Skill 定义与资产）
  skills/style-copywriter/           能力二：风格仿写（Skill 定义、生成前预检、输出校验）
  analyzers/ contracts/ corpus/      拆解流水线：切分、健康检查、七层分析、
  health/ fusion/ render/ cli/       契约校验、草稿融合、渲染、命令行入口
  fixtures/narrative/                通用性夹具：非教程型叙事，验证不绑 IP
  fixtures/writer-tests/             仿写器的正例与对抗夹具
  tests/                             Node 测试

ips/                                 每个 IP 一个目录，结构统一
  <IP名>/
    corpus/                          语料清单、样本健康、纳入决定、可回查标注
    dna/                             风格 DNA（机器契约 + 人读档案）与人工审阅清单
    audits/                          对抗测试、来源泄漏审计、减法审计、前向测试报告
    generation/                      生成测试套件与用例
    outputs/                         用该 IP 风格产出的实际稿件

docs/                                需求、命令、架构、验证、决策
docs/history/                        已被取代的状态文档与对话备份
CURRENT.md / HANDOFF.md              跨会话状态
feature_list.json                    WIP=1 功能清单和证据索引
```

两个 IP 目录当前的完整度不同，这是真实状态而非模板缺失：

| IP | corpus | dna | audits | generation | outputs |
| --- | --- | --- | --- | --- | --- |
| 钱十七 | 有（11 单元 / 10 证据簇） | 有（draft） | 有 | 有 | 无（历史产出在 `research-runs/`，未入库） |
| 半佛 | 无（语料未入库，仅有提取脚本） | 有（无证据锚点） | 无 | 无 | 有（闲鱼餐饮券两稿） |

原始语料不入库：`仿写案例库/`（约 350MB PDF 与文本）和 `research-runs/` 均在 `.gitignore` 中，仓库只保存从语料中提炼出的产物与可回查的锚点索引。

Skill 的真身目前在仓库之外（`C:\Users\admin\.codex\skills\`），`engine/skills/` 是项目内副本，两者没有同步机制。这是当前已知的结构缺口。

## 数据边界

- 参考文案只提供表达风格，不能自动成为新稿事实。
- 风格拆解只回答“怎么说”；仿写前另行读取用户输入，锁定“说什么”。两个阶段不能共享或暗中迁移事实字段。
- 用户提供的文档和素材必须真实读取后才能进入仿写输入。
- 生成结果必须经过风险标注和元引用检查。
- Style DNA 只保存统计信号与可执行规则，不保存来源全文或授权复用来源事实。
- 风格匹配分只衡量口播信号接近度，不能替代事实、合规或素材验证。
- 外部 API 失败时返回可读错误，不写入伪造产物。
- 口播 DNA 的草稿与正式批准分离；`draft` 绝不自动变为可使用的 `approved`。
- 候选规则必须由独立证据簇支撑；框架还要求每个证据簇中都出现完整、同序路径，不能用零散片段拼接。
- 机器 profile 不携带自我批准权。正式批准必须来自独立 `approval-record`，并与 profile 身份、版本、审阅人和五项人工检查逐项匹配。
- 泄漏扫描是确定性辅助门禁；它不能取代人工语义泄漏审查。
- 1.1 selector 层只读取私有 content contract 中的 typed signals：先 content type、后 framework；无匹配或并列一律 abstain，停止其余控制。
- profile 层保存可观察 persona/content strategy、framework beats、attention rhythm、patterns 和 avoid patterns；每项由输入槽位、可执行指令、适用边界、证据及风险组成，不能记录或推断真人心理、身份或真实受众效果。
- generation case 将 input、content contract、output 和 output audit 放在 suite 内并由 SHA-256 绑定。validator 能重算摘要、验证结构化关系、预算与 span，但不能从自然语言自动证明审计正确或 reviewer 为真人。
- approved 的信任根是独立 approval record 同时绑定 candidate profile、实际 approved control state、evidence bundle、reviewed suite 和 output set 摘要；approved profile 不得残留 candidate，变动任何一项均失效。纯文本 profile 实施严格 1.1 字段白名单与视觉命名空间禁令。

## 运行边界

拆解与仿写都通过本地 Node 运行，不启动 UI、不调用模型、不依赖飞书或 TTS。

飞书导入、模型改写、TTS 和本地浏览器工作台（`workbench-ui/`、`scripts/serve-workbench.mjs`）已于 2026-08-22 删除。它们从 2026-07 起就已停工，可从 git 历史恢复。

项目已在 2026-07-29 初始化为私有 GitHub 仓库；后续独立写任务可使用 Git worktree 隔离，主目录仍保持 WIP=1。
