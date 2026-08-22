# 半佛过流水线实测（能力一二次实证）

日期：2026-08-22
执行人：Claude（受托代跑）
目的：验证「不绑 IP 的通用拆解流水线」（个人 Skill `spoken-style-profiler`：scaffold / validate / leakage / render）换到第二个 IP 半佛能不能真的跑起来。这是继钱十七之后对能力一的第一次二次实证。

工具：`C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs`
语料：`仿写案例库/半佛/extracted_texts/*.txt`（PyMuPDF 从公众号图文 PDF 提取的前 10 篇，gitignore）

只新增了三处文件，未改任何既有文件、未改 Skill、未 commit：
- `ips/半佛/corpus/pipeline-input.md`
- `ips/半佛/corpus/pipeline-scaffold/*`（4 个产物）
- 本报告

---

## 一、结果总览

| 步骤 | 结果 | 说明 |
| --- | --- | --- |
| 清洗拼接 pipeline-input.md | 跑通 | 10 篇 → 每篇 `## 标题`，去尾巴/页眉/截图行 |
| scaffold | **跑通** | `ok:true, unit_count:10, health:healthy`，产出 4 个文件 |
| 对比手工 manifest | 跑通（有结论） | 单元数一致=10；SHA 无法对比；字数口径不同 |
| validate | **跑不了** | 缺 JSON profile，`JSON.parse` 直接报错退出 1 |
| leakage | **跑不了** | 同上 |
| render | **跑不了** | 同上 |
| npm test | 60 pass / 0 fail | 新增文件未影响测试 |

一句话结论：**流水线的确定性前半段（scaffold + health + 草稿）换 IP 能跑、且不需要改一行代码；后半段（validate/leakage/render）跑不了，但卡点不在“换了 IP”，而在半佛根本没有 1.1 JSON profile——那是需要人工标注 + 起草的产物，本就不属于自动化步骤。**

---

## 二、第 1 步：清洗与拼接

把 10 篇 txt 按手工 manifest 的 bf01–bf10 顺序拼成一个 `## 标题` 分单元的 markdown，输出到 `ips/半佛/corpus/pipeline-input.md`（清洗脚本一次性跑完，规则对 10 篇统一生效）。

每篇都清掉三类内容：

**A. 页眉残留（每篇固定 4 行）**：标题原始行（改写为规范 `## 标题`）、`原创 半佛仙人`（bf04 是 `原创 橙子 半佛`）、独立行 `半佛仙人`、`这是半佛仙人的第N篇原创`。

**B. 公众号固定尾巴（每篇 20–21 行）**：从 `公众号：半佛仙人` 前的分隔线一直到文末，含账号矩阵（B站/微博/知乎）、“这是一个神奇的男人…”、`点击关注下方账号…`、抽奖暗号段、`【我爱这个魔幻的世界】`。各篇抽奖暗号分别为：安稳/不解/物理/神了/三体/体验/试试/勤用/醒来/重要——正好印证审计结论四：这段是账号固定资产，与单篇内容无关。

**C. PDF 提取残留（仅 4 篇命中）**：
- bf02：`（截图来自微博账号罗永浩的十字路口）`、`（截图来自澎湃新闻）`
- bf03：`（截图来自大众点评）`
- bf05：`向下滑动查看所有内容`、`(截图来自华商报大风新闻)`
- 散落的独立 `阅读` / `阅读修改于` 行（多数落在尾巴块内，随 B 一并清掉）

保留：数字分节标记（`1`/`2`/`3`…，这是半佛的“数字分节”结构特征）、`【理财有风险，投资需谨慎】`（bf01 正文内的广告免责句，在尾巴分隔线之前，属正文）。

**未修复（已知残留）**：PDF 按栏宽产生的句中硬换行（如 “余\n额宝”“大\n佬”）没有回流合并——因为回流有改动原文语义的风险，且 scaffold 的字数统计会归一化掉空白、不受换行影响。清洗后对 `pipeline-input.md` 做残留扫描（公众号/抽奖/截图/向下滑动/我爱这个魔幻/点击关注/独立阅读行），**0 命中**。

---

## 三、第 2 步：scaffold（跑通）

```
node spoken-style-tool.mjs scaffold \
  --source ips/半佛/corpus/pipeline-input.md \
  --corpus-id banfo-wechat-v1 \
  --out ips/半佛/corpus/pipeline-scaffold
```

返回 `{ok:true, unit_count:10, health:"healthy"}`，产出 4 个文件：`corpus-manifest.json`、`sample-health.json`、`sample-decisions.draft.json`、`annotations.draft.json`。

- 切分策略被正确识别为 `markdown_h2_units`，10 个 `##` = 10 个单元，与预期一致。
- `sample-decisions.draft.json`：三个 decision 数组全空（无近重复、无重复开场候选），state=draft。
- `annotations.draft.json`：10 个单元骨架，`include_in_fusion:true`、`content_type_id:null`、`anchors:[]`——都等着人工填。

这一步是纯确定性的，换 IP 零改动即可运行。

---

## 四、第 3 步：与手工 manifest 对比

| 项 | 手工 `corpus/corpus-manifest.json` | 流水线 `pipeline-scaffold/corpus-manifest.json` | 是否对得上 |
| --- | --- | --- | --- |
| 单元数 | 10 | 10 | **一致** |
| SHA-256 | 每篇有（原 txt 文件哈希） | **无此字段** | **无法对比** |
| 字数口径 | `chars`＝原 txt 原始字数 | `character_count`＝归一化后（去空白/标点/符号） | 系统性不同，非错误 |
| 内容类型/开篇类型/分节数 | 有（人工判断） | 无 | 流水线不产出这些 |

**SHA 对不上的真实原因**：不是“清洗前后哈希变了”，而是**流水线 manifest 根本不生成任何内容哈希**（`publicManifest` 只保留 id/ordinal/title/source_locator/行号/character_count/estimated_seconds，连正文都不留）。所以这里不存在“SHA 对得上/对不上”的问题，是“没有 SHA 可比”。手工 manifest 的 sha256 是回源可追溯性设计，流水线目前不覆盖这一层。

**字数口径对照**（手工原始 → 流水线归一化）：

| unit | 手工 chars | 流水线 char_count |
| --- | --- | --- |
| bf01 | 3490 | 2487 |
| bf02 | 2531 | 1690 |
| bf03 | 4493 | 3388 |
| bf04 | 2011 | 1262 |
| bf05 | 1573 | 897 |
| bf06 | 4336 | 3256 |
| bf07 | 5193 | 4009 |
| bf08 | 2994 | 2141 |
| bf09 | 4200 | 2981 |
| bf10 | 4832 | 3670 |
| 合计 | 35653 | 25781 |

差额同时来自两件事：清洗掉了页眉/尾巴/截图行，以及归一化剥离了全部标点与空白。两个数不是同一个东西，不能互校。

**sample-health 报了什么**：`grade:healthy`，`near_duplicate_pairs`、`suggested_duplicate_clusters`、`repeated_opening_groups`、`too_short_unit_ids` **全空**，`human_decision_required:false`。字数分布 min=897 / p50=2487 / max=4009 / total=25781。

值得注意：审计（source-reread-20260822.md）人工发现 10 篇里有“后台有人问/分享”开篇 2 篇、第一人称踩坑 3 篇这类**开篇家族**，但 health 的 `repeated_opening_groups` 一个都没报。原因是它按“归一化后前 18 字完全相同”判重复开场，而这些开篇只是语义同类、字面不同，于是漏掉。**长图文的健康指标基本是“全绿”，但这个绿并不代表语料没有值得人工决策的结构重复——只是流水线的重复检测器（精确前缀 + 4-gram Jaccard≥0.52）对语义级模式不敏感。**

---

## 五、第 4 步：validate / leakage / render（跑不了，如实记录）

三条命令全部在第一步 `readJson(--profile)` 处失败，因为半佛的档案（`ips/半佛/dna/半佛-DNA-可执行版.md`）是 Markdown，不是 1.1 JSON profile。报错原文（三条一致）：

```
SyntaxError: Unexpected token '#', "# 半佛仙人风格DN"... is not valid JSON
    at JSON.parse (<anonymous>)
    at readJson (.../spoken-style-tool.mjs:1805:37)
    at runCli (.../spoken-style-tool.mjs:1850:21)   // leakage=1877, render=1885
退出码：1
```

按约束**没有硬造 JSON profile**。render 在校验失败时提前退出，未写出任何 `Style-DNA.draft.md`（scaffold 目录仍只有 4 个文件）。

这三步跑不了**不是“换 IP 导致代码坏了”**，而是它们本就以“人工完成标注 + 起草 1.1 JSON profile”为前置。半佛从没走过标注→profile 这一步，所以缺的是**输入**，不是能力。要跑通需要补：
1. 人工填 `annotations.draft.json`（给每个单元标 content_type_id、锚点 anchors、主张-证据关系、节奏）；
2. 人工做 `sample-decisions`（这里恰好无重复要判，但仍需人确认纳入范围）；
3. 用 `assets/profile-template.json` 起草 `style-dna.draft.json`（1.1），把审计里那几条候选控制（数字分节、短句成行、反问连打、先表面矛盾再翻转、类比、经历建立发言权）写成带 selector/beat/evidence 的机器规则，且每条 candidate 需 ≥2 个独立样本簇证据；
4. 之后 validate / leakage / render 才有对象可跑。

---

## 六、流水线对“公众号长图文（非口播）”的不适配点

1. **切分假设是“口播单元”**。scaffold 把 `##` 之间当一个“口播单元”，`estimated_seconds` 按 240 字/分算。半佛是长图文，算出来每篇 5–17 分钟“时长”，这个字段对图文毫无意义（bf07 报 1002 秒）。指标本身能跑，但语义标签错位。

2. **健康指标是为口播短样本调的**。`too_short<180 字`、开篇重复=“前 18 字精确相同”、近重复=4-gram Jaccard≥0.52——对长图文，短阈值几乎永不触发，精确前缀漏掉语义开篇家族（见第四节）。对图文，真正该报的是“数字分节数分布、段落数、恰饭/纯评论比例”这类结构指标，流水线目前不产。

3. **清洗规则被迫留在流水线之外**。公众号页眉/尾巴/截图行/PDF 硬换行是这类语料的固定噪声，但 scaffold 直接吃原文、不做任何清洗。这次是我在流水线外手工写脚本清的。**同一套噪声每换一个公众号 IP 都要重写一遍清洗脚本**，这明显应该沉淀成流水线的一个可配置预处理步骤（至少覆盖：账号尾巴、原创页眉、截图/滑动提示、独立“阅读”行）。

4. **manifest 不带内容哈希**，无法像手工 manifest 那样把结论回查到具体样本文件。对“可回查、可审计”这个项目核心诉求，是个缺口。

5. **content_type 是一等公民却无处安放**。半佛 10 篇里恰饭稿/纯评论/惊叹夸赞是决定结构的关键变量（审计结论一、五），但 scaffold 的 manifest 不记内容类型，只在 annotations 里留一个 `content_type_id:null` 等人工填。对“恰饭稿结构”这种项目最需要的东西，流水线没有任何自动辅助。

---

## 七、「让第二个 IP 真正跑通整条流水线还差什么」清单（本任务最重要产出）

按“先补输入、再补能力”排序：

### A. 必须由人工补的输入（缺了后半段一定跑不了）
- [ ] **标注 `annotations.draft.json`**：给 10 个单元逐一填 content_type_id、anchors（段落/句子锚点）、主张-证据关系、口播/图文节奏。这是 validate/leakage/render 的硬前置，目前全是空骨架。
- [ ] **确认 `sample-decisions`**：本例无近重复/重复开场需裁决，但仍需人工确认 10 篇全部纳入。
- [ ] **起草 `style-dna.draft.json`（1.1）**：用模板把审计里 6 条稳定候选特征写成机器规则；每条 candidate 必须挂 ≥2 个独立样本簇证据，且不得把来源原句写进 DNA（审计结论三专门点名半佛旧档案犯了这个错）。
- [ ] **产出人读版**：起草完再用 `render` 生成 `Style-DNA.draft.md`（届时会跑通）。

### B. 应该补进流水线的能力（这样第三、第四个 IP 才不用每次手工绕）
- [ ] **可配置的语料预处理步骤**：把“清洗公众号噪声（尾巴/页眉/截图/硬换行）”从我这次的一次性脚本，升级成流水线内一个带开关的 clean 步骤，并把“清掉了什么”记进产物（可回查）。当前它必须在流水线外做。
- [ ] **manifest 增加内容哈希字段**：让流水线 manifest 也能回查到样本（对齐手工 manifest 的可审计设计）。
- [ ] **图文类语料的健康指标**：数字分节数、段落数、内容类型分布、语义级开篇家族识别（而非仅精确前缀），替代/补充口播味的 `estimated_seconds` 与 180 字阈值。
- [ ] **区分“口播 vs 图文”的语料模式**：至少让 `estimated_seconds`、too_short 阈值、切分语义随模式切换，避免把图文硬套口播口径。

### C. 取证标准（这次没做，达标才算与钱十七同级）
- [ ] 建立独立证据簇、做同序路径验证（审计“未解决”里自己也点了这两条缺口）。
- [ ] 说明 10 篇是“语料前 10 个文件”而非抽样设计，恰饭稿 7/10 只能说明语料构成，不能推断半佛整体产出比例。

---

## 八、可复现命令

```powershell
$TOOL='C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs'
$SC='D:\项目仓库\风格仿写\ips\半佛\corpus\pipeline-scaffold'
# scaffold（跑通）
node $TOOL scaffold --source 'D:\项目仓库\风格仿写\ips\半佛\corpus\pipeline-input.md' --corpus-id banfo-wechat-v1 --out $SC
# validate / leakage / render（当前必然失败：缺 1.1 JSON profile）
node $TOOL validate --profile 'D:\项目仓库\风格仿写\ips\半佛\dna\半佛-DNA-可执行版.md' --manifest "$SC\corpus-manifest.json" --health "$SC\sample-health.json" --decisions "$SC\sample-decisions.draft.json" --annotations "$SC\annotations.draft.json"
```
