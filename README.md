
# 风格仿写

这是一个内容工作流项目：先从任意中文短视频口播 IP 的样本里拆解“怎么说”，经人工批准后，再与用户自己的项目、步骤、数据、证据和 CTA 结合做仿写。

当前主线只做风格拆解与 generation-ready 控制契约。通用 Skill `$spoken-style-profiler` 的 Style DNA 1.1 将可审计档案升级为可受控的下游生成接口；它不生成正式仿写稿，UI、飞书、改写、TTS 和视频链路均暂停扩展。

## 当前主线

第一条流程已经锁定为：

```text
输入一个 IP 的多篇完整口播样本
-> 样本健康检查和人工决策
-> 拆解框架、钩子、句式、节奏、证据编排、CTA 与风险边界
-> 结构校验和来源泄漏扫描
-> 隔离 generation suite：选择器分支、内容契约、输出审计与摘要绑定
-> 输出待人工确认的 DNA 草稿
-> 用户明确批准后才允许进入仿写
```

钱十七与非教程型叙事夹具仍都是 draft；没有任何已批准 DNA。钱十七是第一个真实前向测试，不是写死在通用 Skill 里的唯一风格。

## Style DNA 1.1 边界

- 以有类型的 selector DSL 决定内容类型与框架；无匹配或并列时必须 abstain，不能暗中选规则。
- 可观察的沟通 persona、内容策略、框架节拍、表达 pattern 和 negative style 都必须给出可执行控制、适用条件、证据与风险；不推断真人身份、心理或效果。
- 外部 content contract 锁定目标事实关系；output audit 绑定真实输出、pattern span 和避免项。摘要可由 validator 重算，但不能证明人工身份或自然语言语义审计正确。
- 批准记录用五个摘要字段共同绑定：`candidate_profile_sha256`（审阅内容）、`approved_control_state_sha256`（实际 status/availability）、`evidence_bundle_sha256`、`generation_test_sha256`、`generation_output_set_sha256`；approved profile 不得残留 candidate，任一项变化都会使旧批准失效。
- 机器 profile 严格使用 1.1 命名与字段白名单；纯文本档案禁止 visual、camera、shot、B-roll、palette、typography 等视觉命名空间。

## 历史本地工作台

启动：

```powershell
cd 'D:\项目仓库\风格仿写'
& 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts\serve-workbench.mjs'
```

打开：

```text
http://127.0.0.1:4188
```

## 关键文件

- `AGENTS.md`: Agent 先读规则。
- `CURRENT.md`: 当前状态和下一步。
- `HANDOFF.md`: 跨线程继续说明。
- `docs/requirements.md`: 项目边界和验收标准。
- `C:\Users\admin\.codex\skills\spoken-style-profiler\SKILL.md`: 当前通用风格拆解 Skill。
- `style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`: 用户确认合格的钱十七唯一内容主版本。
- `style-engine/evaluation/spoken-style-profiler-qian17/style-dna.draft.json`: 同一风格的机器审计契约和证据入口。
- `style-engine/evaluation/spoken-style-profiler-narrative-fixture/`: 非教程型叙事通用性夹具。
- `profiles/钱十七-闲鱼风格拆解.md`: 为兼容本地工作台保留的 hard-link 别名，内容与重构版是同一物理文件。
- `docs/github-style-tooling-research.md`: GitHub 现成方案评估。
- `scripts/serve-workbench.mjs`: 飞书读取和模型改写 API。
- `workbench-ui/`: 本地工作台页面。

## 当前结论

GitHub 项目只作为方法参考，没有直接搬入代码或语料。当前采用个人 Codex Skill + 外部 JSON 证据包 + 人工批准记录：通用方法与具体 IP 档案分离，来源事实不能进入风格 DNA，机器档案也不能自我批准。

## 闲鱼知识库集成

本项目已集成闲鱼知识库（位于 `D:\项目仓库\闲鱼知识库`），提供以下支持：

- **违规词检查**: 自动检测文案中的违规词汇
- **写作知识**: 按标签/分类检索相关经验文章
- **话术模板**: 获取各场景的标准话术
- **品类知识**: 获取特定品类的运营知识

### 使用方法

```python
from knowledge_client import KnowledgeClient

# 初始化客户端
client = KnowledgeClient()

# 检查违规词
result = client.check_violations("假一赔十，正品保证")
if not result['safe']:
    print(f"发现违规词: {result['violations']}")

# 获取标题优化知识
knowledge = client.get_title_optimization_tips(category="电子产品")
for article in knowledge['articles']:
    print(article['title'])

# 获取话术模板
scripts = client.get_scripts("开场")  # 开场/卖点/促成/议价/售后

# 验证内容合规性
validation = client.validate_content(
    title="iPhone 13 Pro 256G 九成新",
    description="手机功能正常，无拆无修"
)
print(f"整体安全: {validation['overall_safe']}")

# 全文搜索
results = client.search("闲鱼选品技巧", limit=5)
```

### 测试

```powershell
python knowledge_client.py --test
```
