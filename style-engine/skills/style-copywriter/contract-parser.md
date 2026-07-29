# Contract 解析规则

将 `source-contract.md` 解析为“可说内容”和“不可变关系”，而不是把它当作可自由改写的原稿。

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
