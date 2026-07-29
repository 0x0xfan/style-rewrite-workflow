# 生成就绪与隔离前向测试

## 1. 定位

Style DNA 只回答“怎么说”，不提供“说什么”。隔离 generation suite 用来检查抽象规则能否在不改目标内容关系的前提下指导生成；其中 output 只是评测产物，不得作为用户成稿交付，也不能自动批准 profile。

## 2. 确定性选择

1. 在 profile 的 `selector_signals[]` 中预先定义 `source_path`、operator 和比较值。
2. 从 case 的私有 content contract 读取结构化 `content`；不让模型临时解释自由文本信号。
3. 先选 content type，再在该类型下选 framework。
4. `requires_all` 全真且 `excludes_any` 全假才可入围。
5. 依次比较 `priority` 与命中的 `prefers_any` 数量；最高分并列或无匹配时明确 `abstain`。
6. observation 永远不参与选择或控制应用。

Selector abstain 后不得继续应用 persona、strategy、attention、pattern 或生成 output。

## 3. 控制应用与冲突

固定优先级为：

```text
boundaries/content locks
→ selector abstention
→ avoid patterns
→ framework
→ communication persona/content strategy
→ attention rhythm
→ patterns
```

高优先级约束覆盖低优先级动作；同层冲突或无法证明安全时 fail closed。framework 是表达主干，communication persona/content strategy 只能增强、不能改写 framework 的开头类型、主体职责、信息顺序和收束。叙事位置不能借用来源作者身份，认知推进不能伪造受众旧认知，机会包装不能新增价值、紧迫性或结果。`transformation_rule` 说明抽象变换，`generation_instruction` 说明执行动作；两者都不能改变 preserve 或内容锁。

每个 positive/fallback 评测至少保留一份“只应用 content type + framework + 必要事实锁”的简单基线供人工比较。若叠加 persona、cognitive journey、opportunity packaging 或额外 patterns 后，文本更绕、更像讲解分析过程、说明书或培训稿，判定辅助控制过拟合并回退；不能以控制数量或术语完整度替代风格相似。

Pattern 必须按 `application_control` 限制位置、次数和相邻重复。Output audit 用字符 span 绑定每次应用。Avoid pattern 必须记录检查结果；violations 非空即失败。Span 与 findings 是人工/独立审计后的结构化记账，不是 validator 自动理解自然语言的证明。

## 4. 外部内容契约与输出审计

每个 case 把真实文件与 SHA-256 绑定在 suite 内，且文件必须位于 suite 目录中：

- `input.md`；
- `content-contract.json`；
- positive/fallback 的 `output.md`；
- positive/fallback 的 `output-audit.json`。

Content contract 私有保存：

- selector 需要的结构化 `content`；
- 实际 input 文件摘要；
- `rewrite_interface.immutable_relations` 每一项的权威值。

Output audit 私有保存：

- 实际 output 文件摘要；
- 相同 immutable relations 的人工提取值；
- pattern spans 与 avoidance findings；
- 新增事实和风格来源事实 findings。

Validator 重算实际文件摘要并比较两侧规范化关系值，因此仅复制一对自报 hash 不能冒充内容保真。但它仍不能从自然语言中自动证明审计者提取的关系一定正确；`no_new_facts`、证据归属和语义等价必须由真实人工确认。

## 5. Suite 覆盖

`1.1-draft` / `state=draft` 只能用于开发验证，人工状态必须 pending。`1.1-reviewed` / `state=reviewed` 才能支持批准。

Reviewed suite 必须：

- 为每个 selectable framework 提供 positive；
- 为每个 selectable framework 提供 excluded 或 abstain；
- 为每个 selectable framework 提供缺字段 fallback；
- 为每个 selectable pattern 实际命中一次 `max_per_script`；
- 为每个 selectable avoid pattern 提供 trigger case；
- 对所有 positive/fallback 完成人工事实、来源污染、风格相似和过拟合审阅；
- 扫描 output 的过程性元话语和 reference-corpus 精确泄漏。

一条案例不能替整个多分支 profile 取得批准。

## 6. 运行命令

用 `assets/generation-test.template.json`、`assets/content-contract.template.json` 和 `assets/output-audit.template.json` 起草。运行：

```powershell
node scripts/spoken-style-tool.mjs validate-generation-test `
  --profile '<style-dna.draft.json>' `
  --test '<generation-test.draft.json>' `
  --manifest '<corpus-manifest.json>' `
  --health '<sample-health.json>' `
  --decisions '<sample-decisions.draft.json>' `
  --annotations '<annotations.draft.json>' `
  --reference-source '<风格参考语料>'
```

只有准备人工批准时才加 `--require-reviewed`。普通 `validate` 和 `render` 也可以通过 `--generation-test` 与 `--reference-source` 读取 suite。

## 7. 批准摘要

Approved profile 与独立 approval record 必须同时绑定：

- `candidate_profile_sha256`：绑定审阅内容的 candidate 投影；
- `approved_control_state_sha256`：绑定实际控制项 status/availability；
- `evidence_bundle_sha256`；
- `generation_test_sha256`；
- `generation_output_set_sha256`。

任何规则、控制项 status/availability、证据、suite 声明或真实 output 变化都会让旧批准失效。Approved profile 不允许残留 candidate。人工批准记录必须来自用户明确确认；validator 能检查摘要和声明格式、拒绝明显 AI reviewer 名称，但不能证明现实身份。

## 8. 必须失败

- 无匹配或最高分并列时仍强制选择；
- 选中 observation，或 abstain 后仍应用控制/产生 output；
- artifact 摘要不匹配、路径逃出 suite 目录或出现未知字段；
- content contract 与 output audit 的不可变关系不一致；
- pattern 超预算、位置不符、相邻滥用；
- avoid violations 非空或缺少 required trigger 覆盖；
- output 含过程性元话语或命中来源泄漏；
- reviewed suite 缺少任一分支覆盖或人工确认；
- 把评测 output 当正式成稿；
- 用纯文本语料声明 IP 视觉、镜头或排版 DNA。
