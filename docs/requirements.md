
# Requirements

## Project

风格仿写

## Goal

建立一个内容工作流：从一组参考文案中拆解风格，再读取用户自己的文案和素材，按拆解出的风格进行仿写。

## Target User

当前默认使用者是项目拥有者本人，用来沉淀可复用的短视频口播/引流文案风格。

## V1 Scope

当前 V1 只验收口播风格拆解，不验收仿写链路：

1. 从一个 IP 的多篇完整口播样本建立可审计语料包。
2. 输出内容类型框架、钩子、句式/修辞、节奏、证据编排、CTA 和风险边界等风格 DNA。
3. 每条结论绑定外部锚点和独立证据簇，区分观察、候选与批准状态。
4. 只有用户通过外部批准记录确认整个 profile 后，它才可供后续仿写选择。

初始验证对象是钱十七的闲鱼相关口播文案。2026-07-29 起权威来源为用户提供的 Word：

```text
C:\Users\admin\Downloads\钱十七-闲鱼文案拆解.docx
```

旧 Markdown 只含前 8 篇，已退为历史不完整提取；当前验收基线为 11 篇原始稿、10 个独立证据簇。

## First End-to-End Flow

```text
读取并切分完整口播样本
-> 样本健康检查和人工纳入/排除决定
-> 可回查标注与独立证据簇
-> 生成 draft 风格 DNA
-> 结构校验和来源泄漏扫描
-> 生成人工审阅报告
-> 用户明确批准后才生成 approved 记录
```

## Future Flow

后续仿写流程不属于当前验收，但边界已经锁定：

```text
输入飞书文档链接
-> 真实读取飞书文档里的文案和素材
-> 抽取用户自己的事实、证据、素材、CTA
-> 按主题检索知识库并形成非空、可回读的 knowledge pack
-> 调用风格卡
-> 在不改变数据、单位、主体、时间范围、条件和步骤含义的前提下，用相关知识丰富解释和方法并完成重构
-> 分离输出面向观众的口播稿与内部风险报告
```

文案生成不得跳过知识检索。知识库不可访问、零结果或无法验证实际使用时停止生成；知识中的新数字、案例、收益和平台结论必须先进入事实 contract，不能直接写入观众稿。

## Non-Goals

- 不把任意飞书链接的读取结果当作已验证；必须真实读取并记录证据。
- 首篇仿写在用户审阅前不标记为完成。
- 正文生成前必须建立 SHA-256 绑定的 `task-brief.json`，保存用户原话、解释目标、目标观众初始能力、排除假设、证据登记和 framework required slots；contract 与 generation metadata 不一致时停止。
- Framework 准入使用分级证据：市场信号、发布测试、真实订单、完整交付和收益不能互相替代。知识条目必须声明 `support / supplement / counterevidence / conflict` 与允许章节；反证/冲突只能约束风险，不能变成核心方法。
- 输入预检通过只证明任务、角色、framework 和知识计划在结构上相互一致；用户验收、真实成交和生产交付仍需独立证据。
- 风格档案路径、framework ID 和 `rules_applied` 不能作为“已应用风格”的充分证据；每个必需稳定控制与实际启用的 pattern 都要绑定本稿职责和正文原句。机器只验证 span 落位，用户人工判断最终相似度。
- 当前阶段不修改 UI，不跑仿写，不接 TTS、视频或发布链路。
- 通用 Skill 不写死钱十七、闲鱼、副业或任何行业内容框架。
- V1 不接入发布平台。
- V1 不自动复用来源文案中的收益、案例、教程事实、资源清单或公众号关键词。
- V1 不安装重型风格迁移模型或小说写作系统。

## Style DNA Quality Gate

- 提取前必须可查看样本单元数、长度分布、近重复和重复模板候选。
- 模板候选是人工判断项，默认保留；只有用户显式勾选后，才在本次 DNA 统计中剥离。
- 样本健康报告只描述输入质量，不判断作者身份、内容真实性、平台合规或商业效果。
- 有待复核项时只能保存 DNA 草稿。`observation` 不能自动升级；候选规则仍需整份 profile 的人工确认。
- 候选规则至少由两个独立证据簇支撑；候选框架要求每个证据簇都包含完整、同序路径。
- 所有健康提示和开头模板候选都必须有显式人工决定；清单、健康、决定、标注与 profile 的单元集合必须闭合。
- `approved` 必须有外部批准记录，且 profile、版本、审阅人、UTC 时间和五项检查完全匹配。
- 每次有实质变化的 DNA 保存要生成可只读回看的版本快照。DNA 和版本快照不得包含样本全文、模板候选原句、来源收益、案例、账号、素材链接或 CTA 关键词。
- 自动泄漏扫描只做确定性辅助检查，最终仍需人工语义泄漏审查。

## Style DNA 1.1 Generation-Ready Contract

- 1.1 档案是“怎么说”的控制契约，不是正式仿写输出；`1.1-draft` 与 `1.1-approved` 使用严格字段白名单，纯文本档案任何层级禁止视觉/镜头/排版命名空间。
- `selector_signals[]` 必须有 `source_path`、受限 operator 和必要的比较值；content type 后再选 framework。无匹配或最高分并列必须 abstain，abstain 后不得应用任何生成控制或产出 output。
- `communication_persona`、`content_strategy`、beat、attention rhythm、pattern 与 avoid pattern 只表达可观察的文本行为和控制动作。`audience_effect` 是预期文本作用，不能当作真实效果、人类心理或身份的证明。
- framework beat 必须声明输入槽位、变换规则、生成指令、保留关系、fallback 和允许的 audience effect；pattern 必须声明位置、次数和相邻重复预算；negative style 的 violations 非空即失败。
- 外部 content contract 私有保存 selector 所需结构和不可变关系权威值；output audit 私有保存输出摘要、同一关系的人工提取值、span、avoidance 与事实污染发现。两者都绑定实际文件摘要。
- 批准记录必须用 `candidate_profile_sha256`、`approved_control_state_sha256`、`evidence_bundle_sha256`、`generation_test_sha256`、`generation_output_set_sha256` 五摘要共同绑定审阅内容、实际 status/availability、证据、reviewed suite 与 output set；approved profile 不得残留 candidate。摘要匹配不是人工身份、语义等价、事实保真或风格相似的自动证明，仍须真实人工确认。
- reviewed generation suite 必须覆盖每个 selectable framework 的 positive、excluded/abstain、fallback 分支，每个 selectable pattern 的最大预算和每个 selectable avoid pattern 的 trigger。所有 suite output 都是评测产物，不进入正式仿写交付。

## Success Evidence

- `C:\Users\admin\.codex\skills\spoken-style-profiler\SKILL.md` 与其脚本、模板、参考文件通过 Skill 结构验证。
- Skill 的 Node 自测全部通过，并覆盖证据伪造、批准伪造、跨字段泄漏和通用框架反例。
- 1.1 自测还覆盖 selector abstain/并列、严格版本与视觉命名空间、artifact 摘要、内容关系、pattern/avoid span 和 reviewed 分支覆盖。
- 钱十七真实样本前向测试与非教程型叙事夹具都通过结构校验和泄漏扫描。
- 两个实际 profile 的 1.1 generation suite 必须以真实命令结果单独记录；模板通过或自报摘要不能替代该证据。
- 钱十七结果保持 draft，所有未批准观察均为 `review_only`，近重复决定没有被自动替用户完成。
- `docs/source-inventory.md` 记录了样本来源和样本结构。
- `docs/github-style-tooling-research.md` 记录 GitHub 现成方案评估和采用/不采用理由。
- `DECISIONS.md` 记录当前工具路线。
- `CURRENT.md` 和 `HANDOFF.md` 指向下一步最小任务。
- 关键 Markdown 和 JSON 文件可用 UTF-8 读回。
- 样本健康、人工决定、标注、profile 和批准记录都是可独立回读的 JSON 证据。
