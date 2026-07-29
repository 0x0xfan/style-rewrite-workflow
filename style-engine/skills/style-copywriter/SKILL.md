---
name: style-copywriter
description: 根据外部 source-contract.md 中已锁定的事实、强制知识包和指定 Style DNA 重写中文短视频口播文案。用于“按某个已批准风格重写文案”“用指定 Style DNA 生成口播稿”或需要从项目事实 + 知识库 + 风格档案生成可审计改写稿的任务。
---

# Style Copywriter

从项目事实、相关知识与表达风格三个独立输入生成口播稿。知识只负责丰富解释、方法和边界，不得改写项目事实。

## 输入

读取：

1. `source-contract.md`：目标内容的唯一事实来源。
2. `knowledge-pack.json`：本次主题从知识库检索得到的相关知识。格式与边界见 [knowledge-pack.md](knowledge-pack.md)。缺失、不可读、没有有效来源或没有实际使用记录时停止生成。
3. Style DNA：优先读取 1.1 JSON 档案；只有人读版 Markdown 时，按其中的框架、节拍、表达规则和负面风格执行。
4. 可选 `generation_config`：

```json
{
  "contract_path": "path/to/source-contract.md",
  "knowledge_pack_path": "path/to/knowledge-pack.json",
  "style_dna_path": "path/to/style-dna.json",
  "generation_config": {
    "framework": "auto",
    "intensity": 0.6,
    "target_length": "auto"
  }
}
```

`framework` 可填写明确 framework ID；`auto` 只允许使用 DNA 中可确定匹配的 selector。`intensity` 只控制可选表达规则的使用密度，不能改变事实、步骤、CTA 或风险边界。

## 必须遵守的边界

- 将 contract 中的数据、单位、数据主体、时间范围、条件、步骤含义、CTA 和不可变关系视为锁定事实。
- 每次生成前必须检索知识库并读取非空 `knowledge-pack.json`；从中选择与当前主题直接相关的解释、方法、机制或必要边界，至少实际使用 1 条。
- 知识库中的数字、收益、案例、平台规则或效果结论不能直接进入文案；需要使用时，先核实并提升为 contract 中的锁定事实。
- 不从 Style DNA、样本、旧稿或模型记忆补充项目、收益、案例、资源、账号或平台规则。
- 不向观众稿暴露审计过程、来源载体、截图、原稿、contract 或风格档案。
- 不用风险提示、条件话术或免责声明替代 contract 已锁定的真实机制；仅保留 contract 明确给出的必要红线。
- 不得在 selector 无匹配、最高分并列、required beat 缺少输入槽位，或事实关系无法保留时继续生成；明确返回 `abstain` 与原因。
- 正式面向用户的生成只使用 `approved/selectable` 控制。若显式使用 draft 或 `review_only` 档案，标记为 `evaluation_only`，不得写成已批准成稿。

## 核心流程

1. 按 [contract-parser.md](contract-parser.md) 解析 contract，建立事实锁、内容信号和可用槽位。
2. 按 [knowledge-pack.md](knowledge-pack.md) 验证知识包，选择相关知识并建立“知识条目 -> 目标章节 -> 输出片段”映射；无可用条目时返回 `abstain`。
3. 按 [generator-core.md](generator-core.md) 解析 Style DNA，选择唯一可用的 framework。
4. 先按 framework beats 排列内容，再把知识映射到合适章节，最后应用满足条件且未超预算的 patterns。
5. 逐条执行 avoid patterns，删除或重写违例表达。
6. 进行事实回读：逐项核对数据主体、数值、单位、时间、条件、步骤、CTA 与不可变关系。
7. 写出观众稿和独立元数据；不要把元数据或知识来源说明混入观众稿。
8. 运行生成验证器。只有报告为 `passed` 时，才把元数据中的 `validation_status` 写为 `passed`：

   ```powershell
   node scripts/validate-generated-copy.mjs `
     --contract '<source-contract.md>' `
     --knowledge '<knowledge-pack.json>' `
     --metadata '<generation-metadata.json>' `
     --copy '<generated-copy.md>' `
     --report '<generation-validation-report.md>' `
     --reference '<风格样本原文，可选>'
   ```

## 输出

在指定输出目录生成：

- `generated-copy.md`：只含可直接朗读的口播文案。
- `knowledge-pack.json`：本次实际检索并筛选的知识来源。
- `generation-metadata.json`：记录本次选择与待验证状态。
- `generation-validation-report.md`：自动验证的通过、警告、失败与修改建议。

元数据至少包含：

```json
{
  "framework_used": "fw-example",
  "rules_applied": ["pt-example"],
  "knowledge_sources_used": [
    {
      "source_id": "k01",
      "section": "交付方法",
      "output_excerpt": "正文中确实使用知识后写出的片段",
      "use_as": "method"
    }
  ],
  "generation_timestamp": "2026-07-25T00:00:00Z",
  "validation_status": "pending"
}
```

生成前后都使用 [assets/validation-checklist.md](assets/validation-checklist.md)。需要将结构化约束转成生成指令时，使用 [assets/prompt-template.md](assets/prompt-template.md)，但不得把模板中的占位内容当作事实。

验证器同时核对 contract、知识包和元数据：知识包必须是可审计的 1.0 包（非空 query、有效来源及用途）；`knowledge_sources_used` 必须引用真实知识 ID，`use_as` 必须获该来源允许，且 `output_excerpt` 必须存在于观众稿。使用片段中的数值或定量结果主张（包括 `四位数`、`百分之X`、`X倍`、`翻倍`、`当天出单`）必须已能在 contract 中回读。验证器从 contract 的 `style-copywriter-validation` 清单读取必须保留的字面值、数据主体关系和额外禁用词。清单必须使用以下 HTML 注释格式；Markdown 标题或独立 JSON 代码块不会被解析：

```html
<!-- style-copywriter-validation
{
  "required_literals": [],
  "required_groups": [],
  "forbidden_terms": [],
  "reference_overlap_window": 20
}
-->
```

清单不存在时，验证器只执行默认元话语和引用泄漏检查，并把数据保留标为警告，不能冒充已完成事实审计。清单存在但 JSON 无效时，验证器必须报错退出。

## 失败输出

发生失败即不生成观众稿，返回：

```json
{
  "status": "abstain",
  "reason": "selector_no_unique_match",
  "missing_or_conflicting_inputs": ["..."]
}
```

知识输入相关失败原因使用：`knowledge_input_required`、`knowledge_no_relevant_result`、`knowledge_usage_unverifiable`。
