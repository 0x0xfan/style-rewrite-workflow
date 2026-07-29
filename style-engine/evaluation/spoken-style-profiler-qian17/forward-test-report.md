# Spoken Style Profiler 前向测试报告｜钱十七口播

## 范围

- 输入语料：`F:\dai ma\钱十七剪辑拆解\钱十七文案素材\钱十七-闲鱼文案拆解.md`
- 输出目录：本目录
- 档案状态：`draft`；所有内容类型、框架和表达规则均为 `observation` / `review_only`。
- 未生成仿写稿，未批准 DNA。

## 执行命令与结果

```powershell
node C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs scaffold --source 'F:\dai ma\钱十七剪辑拆解\钱十七文案素材\钱十七-闲鱼文案拆解.md' --corpus-id qian17-spoken-v1 --out 'D:\项目仓库\风格仿写\style-engine\evaluation\spoken-style-profiler-qian17'
```

结果：`ok: true`；分出 8 个 H2 单元；健康度 `warning`。工具检测到 `u03` / `u07` 为近重复候选，similarity `0.871`。该候选最初保持 `unresolved`，后于 2026-07-22 由用户明确确认为同一文案的不同转写版本。

```powershell
node C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs validate --profile 'D:\项目仓库\风格仿写\style-engine\evaluation\spoken-style-profiler-qian17\style-dna.draft.json'
```

首次结果：失败（已保留，未通过删除证据规避）。原样错误：

```text
profile.corpus.independence_clusters: 必须是数组
profile.corpus.raw_unit_count: 必须等于 included + excluded unit 数
profile.corpus.independence_clusters: included unit 缺少 cluster：qian17-spoken-v1:u01
profile.corpus.independence_clusters: included unit 缺少 cluster：qian17-spoken-v1:u02
profile.corpus.independence_clusters: included unit 缺少 cluster：qian17-spoken-v1:u04
profile.corpus.independence_clusters: included unit 缺少 cluster：qian17-spoken-v1:u05
profile.corpus.independence_clusters: included unit 缺少 cluster：qian17-spoken-v1:u06
profile.corpus.independence_clusters: included unit 缺少 cluster：qian17-spoken-v1:u08
profile.corpus.independent_cluster_count: 必须等于 independence_clusters 数量
profile.content_types[0].evidence[0].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
profile.content_types[0].evidence[1].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
profile.frameworks[0].evidence_paths[0].independence_cluster_id: 路径 cluster 与 corpus 映射不一致
profile.frameworks[0].evidence_paths[1].independence_cluster_id: 路径 cluster 与 corpus 映射不一致
profile.patterns[0].evidence[0].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
profile.patterns[0].evidence[1].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
profile.patterns[1].evidence[0].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
profile.patterns[1].evidence[1].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
profile.patterns[2].evidence[0].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
profile.patterns[3].evidence[0].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
profile.patterns[3].evidence[1].independence_cluster_id: 证据 cluster 与 corpus 映射不一致
```

说明：首次运行时，模板和文档尚未写出校验器要求的 `independence_clusters`。该失败被保留为历史证据；随后通用 Skill 的模板、Schema 和校验器已经同步。人工决定前，近重复对曾临时放入 `unresolved:duplicate-candidate-01` 技术分组；用户确认后已改为正式 `variant:duplicate-candidate-01`，两份转写只能贡献一个独立证据簇。

修正后同一 validate 命令结果：

```json
{
  "ok": true,
  "errors": [],
  "warnings": [],
  "summary": {
    "profile_id": "qian17-spoken-draft-v1",
    "status": "draft",
    "content_type_count": 1,
    "framework_count": 1,
    "pattern_count": 4
  }
}
```

```powershell
node C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs leakage --source 'F:\dai ma\钱十七剪辑拆解\钱十七文案素材\钱十七-闲鱼文案拆解.md' --profile 'D:\项目仓库\风格仿写\style-engine\evaluation\spoken-style-profiler-qian17\style-dna.draft.json' --corpus-id qian17-spoken-v1
```

结果：`ok: true`，`min_length: 20`，`match_count: 0`。

```powershell
node C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs render --profile 'D:\项目仓库\风格仿写\style-engine\evaluation\spoken-style-profiler-qian17\style-dna.draft.json' --out "$env:TEMP\qian17-style-review.md" --force
```

结果：`ok: true`；人读 Markdown 已生成。

另以 PowerShell `Get-Content -Encoding UTF8 | ConvertFrom-Json` 解析 5 个 JSON 产物，全部通过。最终状态回读：`profile.status=draft`、`approval.state=draft`、`requires_human_approval=True`、`observations_selectable=False`。

## 未决项与风险

- `u03` / `u07` 已由用户按 `merge_as_variant` 处理，记录为 `sample-review-20260722-001`；二者不得重复计为独立证据。
- `u04`–`u08` 多为单段超长转写，尚不能可靠标注节奏、句群或完整段落职责；未用于规则证据。
- `u01` / `u02` 的共同开场、互动、收尾可能是系列或平台模板。虽有两条路径，尚未升级为 candidate。
- 无完成标注且不参与融合的留出样本；未执行留出验证。
- 首次发现的 `independence_clusters` 模板不一致已在 Skill 中修复；历史失败保留在本报告，当前模板和校验器已重新验证一致。

## 收紧门禁后的回归

- annotations 中每个锚点已补齐所属 `unit_id`，并继续保留位置、功能、关系和标注置信度。
- 使用 manifest、health、decisions、annotations 四件套重新运行 validate：`ok=true`。
- 使用升级后的标题、四字符数字/金额、跨字段重建扫描重新运行 leakage：`ok=true`、`match_count=0`。
- `u03/u07` 已合并为同一个 variant cluster；由于二者均无语义锚点且本档案全部为 `observation/review_only`，没有借此增加证据或生成 candidate。

## V1.1 draft generation suite（2026-07-22）

- 新增 `generation-test.draft.json` 与 `generation-cases/abstain-story/content-contract.json`。该 suite 只有一个 `abstain` case：档案中的内容类型、框架、persona、strategy、attention 和 pattern 全部仍是 `observation/review_only`，因此不得应用任何控制，也不得产出观众稿。
- `validate-generation-test` 已携带 manifest、health、decisions、annotations 与原始语料路径运行：`ok: true`、1 case、0 errors；唯一 warning 明确指出 suite 尚未人工 reviewed，不能支持 profile approval。
- 完整 `validate --generation-test --reference-source`、`leakage --annotations` 与 `render --force` 均为 `ok: true`。确定性 leakage 为 0 matches；这不替代人工语义来源边界审阅。
- 测试和 profile 均保持 `draft`。没有 approval record、human review、selectable control、output artifact 或正式仿写稿。

## 人工样本决定回归（2026-07-22）

- 用户在当前会话选择选项 `2`，明确确认 `u03/u07` 是同一文案的不同转写版本。
- `sample-decisions.draft.json` 已记录 `decision=merge_as_variant`、human reviewer、记录号和 UTC 时间；profile 与 annotations 统一映射到 `variant:duplicate-candidate-01`。
- 更新后的 `validate-generation-test` 与完整 `validate --generation-test --reference-source` 均为 `ok: true`；`leakage --annotations` 为 `ok: true`、0 matches；人读 Style DNA 已重新 render。
- 此决定只解决独立样本计数，不代表用户已经确认任何风格 observation，也不产生 candidate、approved 或 selectable 规则。

## 钱十七完整 DNA 重建（2026-07-22）

- 用户明确要求由 Agent 自行完成样本清洗和结构恢复，只把通俗风格结论交给用户做最终保留、修改、删除确认。
- `annotations.draft.json` 已从 2 篇最小标注扩展到 8 个单元、75 个锚点：
  - `u03` 作为 `u03/u07` 变体簇中边界较清晰的结构参考；冲突处仍为 unknown；
  - `u04/u05/u06/u08` 只建立低置信度临时语义锚点，不提取句式、词汇、修辞或真实音频节奏；
  - `u05` 的共享模板模块单独记录在 `template-reuse-audit.draft.json`，不重复计证；
  - `u01/u02` 的同系列教学骨架和互动/CTA 外壳继续保留混淆标记。
- `style-dna.draft.json` 当前包含 5 个内容类型、6 个互不平均的框架、4 个沟通姿态、7 个内容策略、5 个文本功能阶段、13 个钩子/句式/说服/CTA pattern 和 5 条 human-boundary avoid rule。全部仍为 `observation/review_only`。
- 对抗式自查删除了两个只由低质量单行稿支持的微观 pattern，并清除了其余 pattern 对低质量锚点的依赖；当前 13 个表达规则只引用中等质量转写。低质量稿继续只支持宏观类型、段落职责和显式顺序。
- 已单独保留用户指出的“生活化消费阶梯式结果对比”：公式是“较紧的日常参照 → 更有余裕的日常参照”，目标数据和关系不可改变，来源比喻不可复用。当前仍是单样本 observation。
- 冲突顺序没有平均：筛选型内容被拆为 `先排除再推荐` 与 `先公式再验证` 两个框架，并分别使用确定性结构信号。
- 新的人类审阅入口是 `钱十七-DNA-人工审阅清单.md`；用户不再需要审查样本编号或底层 JSON。
- candidate profile digest 更新为 `sha256:bfff176a045b4dc3200bde5ecf57acba1d91da2b8188644d078728cfbcb29e52`，draft generation suite 已同步。
- 最新命令结果：
  - `validate-generation-test`: `ok=true`，1 个 observation-only abstain case；
  - 完整 `validate --generation-test --reference-source`: `ok=true`，5 content types、6 frameworks、13 patterns、21 generation controls；
  - `leakage --annotations`: `ok=true`，0 matches；
  - `render --force`: `ok=true`。
- 当前没有 approved/selectable 控制、正式仿写稿、reviewed suite 或 approval record。
