# Contract 解析规则

将 `source-contract.md` 解析为“可说内容”和“不可变关系”，而不是把它当作可自由改写的原稿。

同一事实可以有不同输出面。`audit` 保存精确包名、命令、版本和环境；`visual` 保存需要上屏的精确文字；`spoken` 只保存语音合成可自然朗读的表达。事实锁保护三者的语义关系，不要求三者逐字相同，也不得把 audit 字面值自动提升为观众稿必说内容。

解析前必须先读取 `task-brief.json`。Contract 不得重新解释用户是谁、观众会什么或内容要完成什么；它必须用下列 HTML 注释绑定同一份任务。`task_brief_sha256` 是 UTF-8 原始文件字节的 SHA-256，角色对象必须逐字段一致。

```html
<!-- style-copywriter-task-alignment
{
  "task_id": "task-example",
  "task_brief_sha256": "...",
  "content_mode": "feasibility_screening",
  "selected_framework": "fw-screening-tutorial",
  "narrative_role_lock": {
    "narrator": "...",
    "target_viewer": {
      "goal": "...",
      "starting_state": {},
      "excluded_assumptions": []
    },
    "case_buyer": {},
    "content_goal": "..."
  }
}
-->
```

缺少注释、摘要不一致、内容模式漂移、framework 不一致或任一角色字段变化时停止。不要靠在正文中补一句“小白也能看”来修复任务语义漂移。

## 读取顺序

优先识别以下章节；章节名称可以不同，但含义不得猜测：

1. 项目核心：主题、核心主张、目标受众。
2. 关键数据：数值、单位、主体、时间范围、条件、对应主张。
3. 操作步骤：顺序、动作、前置条件、结果。
4. 交付与收益：机制、触发条件、金额或比例、边界。
5. CTA：允许使用的行动号召和资源名称。
6. 风险与边界：必须保留的版权、隐私、违法、资金损失或执行阻塞红线。

## 输出结构

在内部形成下列结构，不写进观众稿：

```json
{
  "content": {
    "core_claim": "...",
    "has_steps": true,
    "steps": [],
    "has_data": true,
    "data": [],
    "has_final_cta": true
  },
  "fact_locks": {
    "claims": [],
    "data_relations": [],
    "step_relations": [],
    "income_or_delivery_relations": [],
    "cta": [],
    "required_boundaries": []
  },
  "issues": []
}
```

每一条数据关系至少保留 `subject`、`value`、`unit`、`scope`、`condition` 和 `meaning`。缺少主体、周期或触发条件时，将其列入 `issues`，不得擅自补成“我的”“工作室的”“某店铺的”或任何平台规则。

## 机器验证清单格式

需要让生成后验证器核对事实锁时，在 contract 中加入且只加入一个如下形式的 HTML 注释。标记名与注释边界必须保留；Markdown 标题或独立 JSON 代码块不会被脚本读取。

```html
<!-- style-copywriter-validation
{
  "required_literals": [
    {"id": "d01", "value": "需要原样保留的字面值"}
  ],
  "required_groups": [
    {"id": "g01", "label": "数据与主体关系", "all_of": ["主体", "数值", "条件"]}
  ],
  "forbidden_terms": ["目标内容专属禁用词"],
  "reference_overlap_window": 20,
  "allowed_reference_overlap": []
}
-->
```

- `required_literals` 用于检查数据、单位、时间、条件和 CTA 等不可丢失字面值。
- `required_groups` 用于检查同一事实关系中的主体、数值和条件是否同时存在。
- `forbidden_terms` 只补充本 contract 的禁用表达；默认元话语禁用词始终生效。
- `reference_overlap_window` 默认是 `20`；`allowed_reference_overlap` 仅登记经人工确认可重合的窗口。
- 缺少清单时，验证器只给事实检查警告；清单 JSON 无效时直接报错，不能降级为通过。

## 信号生成

只从上述结构化字段生成 selector signals。例如：

- `content.has_steps`：`steps` 非空。
- `content.has_data`：存在有明确主体的 `data`。
- `content.has_final_cta`：contract 明确允许 CTA。

不要从自由文本主观推断“这是机会型项目”“受众一定焦虑”等信号。DNA 未登记的信号不能参与 selector。

## 失败条件

以下情况输出问题清单并停止生成：

- 数值与其主体或条件无法关联。
- 两处事实给出冲突的数值、时间范围、触发机制或步骤顺序。
- CTA、收益、风险边界被要求生成但未在 contract 锁定。
- contract 没有足够内容填充被选 framework 的必需 beat。
- task brief、contract 与 generation metadata 的用户任务或叙事角色不一致。
- 候选 framework 的任一 required slot 只有 `unverified/rejected` 证据，或把市场存在/测试动作误当成获客、成交、交付和收益证据。
- 合成口播要求逐字保留包名、命令、版本、URL、文件路径、哈希或密钥字段，却没有单独的 visual/audit 值或自然发音别名。
