---
name: style-copywriter
description: 根据外部 source-contract.md 中已锁定的事实、强制知识包和指定 Style DNA 重写中文短视频口播文案。用于“按某个已批准风格重写文案”“用指定 Style DNA 生成口播稿”或需要从项目事实 + 知识库 + 风格档案生成可审计改写稿的任务。
---

# Style Copywriter

从用户任务、项目事实、相关知识与表达风格四个独立输入生成口播稿。用户任务先锁定“给谁、从什么能力状态开始、要让他完成什么”；知识只负责丰富解释、方法和边界，不得改写项目事实。

## 输入

读取：

1. `task-brief.json`：用户原始需求、内容模式、叙事角色锁、目标观众初始能力状态、候选 framework 必需槽位及证据等级。缺失时停止生成。
2. `source-contract.md`：目标内容的唯一事实来源，并通过 `style-copywriter-task-alignment` 注释绑定 task brief 及其 SHA-256。
3. `knowledge-pack.json`：本次主题从知识库检索得到的相关知识。格式与边界见 [knowledge-pack.md](knowledge-pack.md)。缺失、不可读、没有有效来源或没有实际使用计划时停止生成。
4. Style DNA：优先读取 1.1 JSON 档案；只有人读版 Markdown 时，按其中的框架、节拍、表达规则和负面风格执行。
5. 人工校准锁：用户已经通过/拒绝具体表达，或本轮会调整主要结构、篇幅分配、钩子链时，读取任务本地 `style-acceptance-locks.json`，规则见 [style-acceptance-locks.md](style-acceptance-locks.md)。
6. 可选 `generation_config`：

```json
{
  "task_brief_path": "path/to/task-brief.json",
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
- 将 task brief 中的用户原话、内容模式、`narrator / target_viewer / case_buyer / content_goal` 及 `target_viewer.starting_state` 视为任务语义锁。不得把“尚未具备交付能力的观众”改写成“已经会安装、接模型或排错的人”。
- Framework 只有在其全部 required slot 都达到 task brief 指定的证据等级时才能选择；市场存在、测试计划或同行页面不能替代获客、成交、交付、收益等缺失路径证据。
- 每次生成前必须检索知识库并读取非空 `knowledge-pack.json`；从中选择与当前主题直接相关的解释、方法、机制或必要边界，至少实际使用 1 条。
- 知识库中的数字、收益、案例、平台规则或效果结论不能直接进入文案；需要使用时，先核实并提升为 contract 中的锁定事实。
- 不从 Style DNA、样本、旧稿或模型记忆补充项目、收益、案例、资源、账号或平台规则。
- 不向观众稿暴露审计过程、来源载体、截图、原稿、contract 或风格档案。
- 不用风险提示、条件话术或免责声明替代 contract 已锁定的真实机制；仅保留 contract 明确给出的必要红线。
- 不得在 selector 无匹配、最高分并列、required beat 缺少输入槽位，或事实关系无法保留时继续生成；明确返回 `abstain` 与原因。
- 正式面向用户的生成只使用 `approved/selectable` 控制。若显式使用 draft 或 `review_only` 档案，标记为 `evaluation_only`，不得写成已批准成稿。
- 人工已通过表达默认是输出锁，不得为了缩短、润色、合规或改结构而擅自改弱；确有事实冲突时先更新校准记录和锁摘要。
- 普通问题、编号和逻辑转场不能冒充钩子。任务声明 `hook_duties` 时，每个主要钩子必须由目标事实支持，并在限定段落内兑现。

## 核心流程

1. 从用户原话建立 `task-brief.json`，先锁定内容模式、叙事角色、目标观众初始能力和明确排除的假设；有人工校准时建立外部锁文件并绑定校准原文、锁文件和任务三组摘要。
2. 按 [contract-parser.md](contract-parser.md) 解析 contract，建立事实锁、内容信号和可用槽位，并用 task brief SHA-256 固定任务语义。
3. 按 [knowledge-pack.md](knowledge-pack.md) 验证知识包，给每条候选知识标记 `support / supplement / counterevidence / conflict`，建立“知识条目 -> 目标章节 -> 用途”计划；无可用条目时返回 `abstain`。
4. 按 [generator-core.md](generator-core.md) 解析 Style DNA；只有候选 framework 的必需槽位都满足证据等级时，才将唯一候选写入元数据。
5. 在写正文前运行生成输入预检；只有报告为 `passed` 才能继续：

   ```powershell
   node scripts/validate-generation-inputs.mjs `
     --task '<task-brief.json>' `
     --contract '<source-contract.md>' `
     --knowledge '<knowledge-pack.json>' `
     --metadata '<generation-metadata.json>' `
     --report '<generation-input-preflight-report.md>'
   ```

6. 先按 framework beats 排列内容。项目/机会型内容同时写 `listener_progression` 与任务级 `hook_duties`：前者检查逻辑推进，后者检查主要段落如何用真实利益、动作或后果给下一段提价并立即兑现；两者不得互相替代。
7. 把知识映射到合适章节，最后应用满足条件且未超预算的 patterns。只有编号或“接下来”而没有揭晓和意义时，只算转场，不算推进。
8. 逐条执行 avoid patterns，删除或重写违例表达。
9. 进行任务、事实与输出面回读：逐项核对目标观众能力状态、数据主体、数值、单位、时间、条件、步骤、CTA 与不可变关系；包名、命令、版本、URL、路径和密钥字段默认留在 visual/audit，不得因审计字面值准确就强迫进入合成口播。
10. 对 `draft/review_only` profile 或任何结构性重写，生成本轮新的 framework-only Baseline 与 bounded Enhanced，记录两个文件的 SHA-256；不得复用旧对照或旧 validation 状态。
11. 写出观众稿和独立元数据；不要把元数据或知识来源说明混入观众稿。
12. 运行生成后验证器。只有报告为 `passed` 时，才把元数据中的 `validation_status` 写为 `passed`；style acceptance 仍保持 `pending_user_review`：

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
- `task-brief.json`：本次用户任务及 framework 准入证据。
- `knowledge-pack.json`：本次实际检索并筛选的知识来源。
- `generation-metadata.json`：记录本次选择与待验证状态。
- `generation-input-preflight-report.md`：正文生成前的任务、角色、framework 与知识用途审计。
- `generation-validation-report.md`：自动验证的通过、警告、失败与修改建议。
- `listener-progression-plan.md` 或等价私有元数据：项目型内容的核心问题和主要 beat 推进计划。
- `style-acceptance-locks.json`：任务本地人工通过/拒绝表达、钩子兑现和内容配比边界。
- fresh Baseline/Enhanced 与 `comparison_audit`：结构性修改后的新对照、摘要和待用户验收状态。

元数据至少包含：

```json
{
  "task_alignment": {
    "task_id": "task-example",
    "task_brief_sha256": "...",
    "content_mode": "...",
    "selected_framework": "fw-example",
    "narrative_role_lock": {}
  },
  "framework_used": "fw-example",
  "framework_gate_sha256": "...",
  "rules_applied": ["pt-example"],
  "requires_style_application_audit": true,
  "required_style_controls": ["A1", "A2", "pt-example"],
  "style_application": {
    "controls": [
      {
        "rule_id": "A1",
        "purpose": "该控制在本稿承担的具体职责",
        "output_excerpt": "正文中可回读的实际应用片段"
      }
    ]
  },
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

验证器同时核对 contract、知识包、元数据和人工校准锁：知识包必须是可审计的 1.0 包（非空 query、有效来源及用途）；`knowledge_sources_used` 必须引用真实知识 ID，`use_as` 必须获该来源允许，且 `output_excerpt` 必须存在于观众稿。要求风格审计时，`required_style_controls` 与 `rules_applied` 中的每个控制都必须在 `style_application.controls` 绑定用途和正文原句；只在 metadata 写风格名或规则 ID 视为未应用。人工锁还必须验证已通过原句、已拒绝表达、钩子兑现、内容占比和 fresh Baseline/Enhanced 摘要。所有机器检查都不能证明人工相似度。使用片段中的数值或定量结果主张（包括 `四位数`、`百分之X`、`X倍`、`翻倍`、`当天出单`）必须已能在 contract 中回读。验证器从 contract 的 `style-copywriter-validation` 清单读取必须保留的字面值、数据主体关系和额外禁用词。清单必须使用以下 HTML 注释格式；Markdown 标题或独立 JSON 代码块不会被解析：

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
