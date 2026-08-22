# 机器契约同步 —— 已阻塞（BLOCKED）

日期：2026-08-22
范围：把 `dna/钱十七-DNA-重构版.md` 2026-08-22 增量修订（A7 互动指令层、P8 生活消费阶梯、对立煽动语气分级、A2 悬念绑定）同步进机器契约 `dna/style-dna.draft.json`。
结论：**外部 validator 能通过，但 `npm test` 无法通过；在"只改 style-dna.draft.json、不得改测试、不得改 corpus"的约束下无法干净落地。已把 JSON 恢复到改前状态，MD 头部"未同步"声明保留不动。**

## 一、基线（改动前）

- 外部 validator：`ok: true`，**0 error / 0 warning**，`pattern_count: 7`。
  命令：
  ```
  node C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs validate \
    --profile ips\钱十七\dna\style-dna.draft.json \
    --manifest ips\钱十七\corpus\corpus-manifest.json \
    --health ips\钱十七\corpus\sample-health.json \
    --decisions ips\钱十七\corpus\sample-decisions.draft.json \
    --annotations ips\钱十七\corpus\annotations.draft.json
  ```
- `npm test`：**60 pass / 0 fail**。

## 二、尝试了什么

按任务把四条修订写进机器契约（都用 candidate / observation，未改 approved、未改 corpus_id/units/clusters、未写入任何来源原句/参照物/泄漏词）：

1. **A7 互动指令层** —— 作为 `patterns[]` 一条 `category: "interaction"`、`status: candidate`。
   - `application_control`: positions `["entry","body","close"]`、min 0 / max 4、avoid_adjacent_repeat true（对应"每篇 2-4 处、贯穿全篇"）。
   - 证据引 annotations 中真实的 interaction 锚点：`u01:p16`、`u02:p13`、`u02:p19`、`u04:m02`、`u08:m03`（覆盖 4 个独立簇，满足 candidate 的"≥2 独立簇"门槛）。
   - risk 里注明：审计（漏项一）确认贯穿全篇，但 annotations 只在 u01/u02/u04/u08 标了互动锚点，其余单元属审计级证据、未标注到段落。
2. **P8 生活消费阶梯** —— 作为 `patterns[]` 一条 `status: observation`、`evidence: []`。
   - annotations 里**没有**任何被标为"生活消费阶梯"的段落锚点（consumption-ladder 语句落在 hook / CTA 位置，但未单独标注）。按任务"找不到明确锚点的降为 observation/review_only 并注明'审计级证据、未标注到段落'"处理。
3. **对立煽动语气** —— 作为 `avoid_patterns[]` 一条，`basis: human_boundary`、`evidence: []`、`trigger_signals: ["content.has_claims"]`。
   - schema 的 avoid_pattern **没有** per-platform 分级字段，也没有 availability 分级（availability 严格由 status 决定），"长视频限一次 / 短视频禁用"无法机读表达；按任务退而记入 avoid_patterns，并在 `avoid_instruction` / `rationale` 用文字说明分级、机器层统一按禁用处理。
4. **A2 悬念绑定（末项最高价值）** —— 作为 `patterns[]` 一条独立 `status: observation`、`evidence: []`（同 P8，audit 漏项二有 3 处原文，但未标注到段落锚点）。

## 三、报错原文

改动后重新校验：

- 外部 validator：仍 **`ok: true`，0 error / 0 warning**，`pattern_count: 10`。→ **schema 完全接受这些内容**，包括 A7 作为 candidate pattern、四条新增的全部字段。
- `npm test`：**59 pass / 1 fail**。失败用例与原文：

  ```
  test at engine\tests\qian17-reprofile.test.mjs:75:1
  ✖ auxiliary controls remain review-only and bounded
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    10 !== 7
        at engine/tests/qian17-reprofile.test.mjs:76:10
    actual: 10, expected: 7, operator: 'strictEqual'
  ```

## 四、根因判断

**阻塞源不是 schema，也不是 validator，而是被冻结的测试 `engine/tests/qian17-reprofile.test.mjs`。** 该测试第 75–94 行（"auxiliary controls remain review-only and bounded"）硬断言：

- `profile.patterns.length === 7`（精确 7 条）；
- 每条 pattern `status === "observation"`、`availability === "review_only"`；
- 每条 `min_per_script === 0`、`max_per_script === 1`（`pt-stage-value-reset` 例外为 2）、`avoid_adjacent_repeat === true`。

同文件第 46–51 行还硬断言 `frameworks` 恰好是那 3 条、且全为 candidate。

因此：

1. **任何**向 `patterns[]` 增条都会先撞 `length === 7`（本次即 `10 !== 7`）。
2. 即使把数量对上，A7 作为 candidate（status 非 observation、max 4）也会撞第 77–82 行的 status / max_per_script 断言。
3. 把 A7/P8/A2 改放到 `frameworks[]` 同样会撞第 46–51 行的框架清单断言。

而任务给的落点里，**只有 `patterns[]` 这一层带有 `application_control`（positions / max_per_script）与 `input_slots` / `preserve`** —— 这正是 A7 要求的"位置槽位 + 每篇 2-4 处 + 边界"和 P8 要求的"结构规格 + 槽位关系"所需的字段。`communication_persona` / `content_strategy` / `attention_rhythm.stages` 都没有 `application_control`，无法承载 A7 的位置/次数控制，属于**有损降级**，且与任务"A7/P8 作为 pattern"的明确指令相悖。

任务约束"只改 style-dna.draft.json（成功时加 MD 一句）或只新增 blocked 报告；不改测试"，与"npm test 全过"叠加，导致 pattern 落法无解：改 JSON 则测试红，不改测试则无法让 pattern 增条通过。这是任务描述里对该测试认知不全（任务以为它只查 corpus_id/11 units/10 clusters/泄漏词，实际它还冻结了 pattern 集合与 framework 集合）造成的内在冲突。

补充（次要，不构成本次唯一阻塞，但会影响升级）：即便测试放开，**P8 与 A2 悬念绑定在 annotations 里没有段落级锚点**，只能留在 observation / 空 evidence；要升到 candidate 需要先在 `corpus/annotations.draft.json` 给对应单元补标锚点（且不得把来源原句写进 JSON）。A7 有足够的真实 interaction 锚点（u01/u02/u04/u08，4 个独立簇），一旦测试放开即可作为 candidate 落地。

## 五、要让同步成功需要什么

按优先级：

1. **放开被冻结的测试断言（需 owner 批准，超出本次授权范围）。** 更新 `engine/tests/qian17-reprofile.test.mjs` 第 75–94 行，使其反映新的控制集合：pattern 数量不再钉死为 7、允许 A7 为 candidate（status/availability/max_per_script 相应放开），或把该用例改成按 id 白名单校验而非按总数。这是让 A7/P8/A2 以 pattern 形态落地的前提。
2. **补齐段落级证据标注（P8、A2 悬念绑定升级所需）。** 在 `corpus/annotations.draft.json` 为生活消费阶梯（漏项三，≥3 单元，落在 hook/CTA 位置）与末项悬念（漏项二，3 处原文）补锚点，anchor 的 relations/function/audience_effect/information_role/annotation_confidence 需齐全，且 include_in_fusion=true 才能支撑 candidate；否则二者只能维持 observation。
3. **（可选，若 owner 不愿改测试）接受有损落点。** 把 A7/P8/A2 放到 `content_strategy[]`（A7→cta_policy、P8→opportunity_packaging、A2→persuasion_move）、对立语气放 `avoid_patterns[]`。此路 validator + npm test 均可过，但会**丢失** A7 的位置/次数控制与 P8/A2 的结构槽位（这些字段 content_strategy 没有），且偏离任务"作为 pattern"的明确要求，故未擅自采用，留待 owner 决策。
4. **schema 层（若要机读表达对立语气的长/短视频分级）。** 需要扩展：引入平台信号（如 `content.platform` selector signal + equals operator）并允许 avoid_pattern 携带条件化 availability。当前 1.1 schema 不支持，故本次只能文字记录。

## 六、当前状态（已干净退出）

- `dna/style-dna.draft.json`：**已恢复到改前字节**（md5 与开工前备份一致，`git diff --quiet` 确认内容与 HEAD 一致，`pattern_count` 回到 7；validator 0 error / 0 warning，`npm test` 60/60）。
  - 注：`git status` 可能对该文件显示 `M`，这是仓库 `core.autocrlf=true` 在文件 mtime 变化后触发的行尾归一化提示（本仓库 HEAD 以 LF 存储，工作区亦为 LF），**并非内容改动**；`git diff` 无任何内容差异。
- `dna/钱十七-DNA-重构版.md`：**未改**，头部"以上修订尚未同步进机器契约……机器契约仍是修订前状态"保留。
- 未新增除本报告外的任何仓库文件；未 commit。
