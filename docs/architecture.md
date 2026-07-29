# Architecture

## 结构

```text
C:\Users\admin\.codex\skills\spoken-style-profiler\
                              通用口播风格拆解 Skill：脚手架、1.1 控制契约、证据/摘要校验、泄漏扫描、人工报告
style-engine/evaluation/      项目内前向测试证据；不等于批准后的风格库
profiles/*.md                 风格卡（给人和模型阅读）
profiles/*.md.dna.json        可解释 Style DNA 指纹（给工作台评分）
style-engine/                 历史无 UI 原型及新 Skill 的项目内评估夹具
workbench-ui/                  本地浏览器工作台
scripts/serve-workbench.mjs   静态页面、飞书导入、改写、风格库、TTS API
workbench_imports/             导入证据与素材索引（本地生成、忽略提交）
workbench_rewrites/            改写结果（本地生成、忽略提交）
workbench_audio/               音频结果（本地生成、忽略提交）
docs/                          需求、命令、架构、验证和问题
CURRENT.md / HANDOFF.md        跨会话状态
feature_list.json              WIP=1 功能清单和证据索引
```

## 数据边界

- 参考文案只提供表达风格，不能自动成为新稿事实。
- 风格拆解只回答“怎么说”；仿写前另行读取用户输入，锁定“说什么”。两个阶段不能共享或暗中迁移事实字段。
- 飞书文档和素材必须真实读取后才能进入仿写输入。
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
- generation case 将 input、content contract、output 和 output audit 放在 suite 内并由 SHA-256 绑定。validator 能重算摘要、验证结构化关系/预算/span，但不能从自然语言自动证明审计正确或 reviewer 为真人。
- approved 的信任根是独立 approval record 同时绑定 candidate profile、实际 approved control state、evidence bundle、reviewed suite 和 output set 摘要；approved profile 不得残留 candidate，变动任何一项均失效。纯文本 profile 实施严格 1.1 字段白名单与视觉命名空间禁令。

## 运行边界

当前主线 Skill 使用本地 Node CLI，不启动 UI、不调用模型，也不依赖飞书或 TTS。旧工作台仍可监听 `127.0.0.1:4188`，但不属于当前 F009 验收。项目已在 2026-07-29 初始化为私有 GitHub 仓库；后续独立写任务可使用 Git worktree 隔离，主目录仍保持 WIP=1。
