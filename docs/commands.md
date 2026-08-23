# Commands

## Stack

本地 Node，无 UI、无模型调用、无外部服务。拆解与仿写都是命令行 + 人工审阅。

## Repository Checks

```powershell
cd 'D:\项目仓库\风格仿写'
npm test
npm run lint
```

`npm test` 运行 `engine/tests/*.test.mjs`，覆盖语料切分、近重复发现、来源隔离、草稿状态、生成前预检、输出校验与 AI 味预检。`npm run check:ai-flavor <稿件...>` 单跑 AI 味检查。

## Validate JSON

```powershell
Get-Content -LiteralPath 'D:\项目仓库\风格仿写\feature_list.json' -Raw -Encoding UTF8 | ConvertFrom-Json
```

## 能力一：风格拆解

正式入口是个人 Skill `$spoken-style-profiler`。它不启动工作台、不调用模型，也不生成仿写稿。

新增一个 IP 时，先建目录：

```powershell
$ip = 'D:\项目仓库\风格仿写\ips\<IP名>'
New-Item -ItemType Directory -Force "$ip\corpus", "$ip\dna", "$ip\audits", "$ip\generation", "$ip\outputs"
```

再生成脚手架：

```powershell
$tool = 'C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs'
$source = '<该 IP 的完整样本文件>'

node $tool scaffold --source $source --corpus-id <ip>-spoken-v1 --out "$ip\corpus"
```

`scaffold` 只生成语料清单、健康报告、人工样本决策草稿和标注草稿。人工补全标注与 profile 后，用完整外部证据包验证：

```powershell
node $tool validate `
  --profile "$ip\dna\style-dna.draft.json" `
  --manifest "$ip\corpus\corpus-manifest.json" `
  --health "$ip\corpus\sample-health.json" `
  --decisions "$ip\corpus\sample-decisions.draft.json" `
  --annotations "$ip\corpus\annotations.draft.json"

node $tool leakage `
  --source $source `
  --profile "$ip\dna\style-dna.draft.json" `
  --corpus-id <ip>-spoken-v1

node $tool render `
  --profile "$ip\dna\style-dna.draft.json" `
  --manifest "$ip\corpus\corpus-manifest.json" `
  --health "$ip\corpus\sample-health.json" `
  --decisions "$ip\corpus\sample-decisions.draft.json" `
  --annotations "$ip\corpus\annotations.draft.json" `
  --out "$ip\dna\Style-DNA.draft.md" `
  --force
```

Skill 自检：

```powershell
node --check 'C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs'
node --check 'C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\self-test.mjs'
node 'C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\self-test.mjs'
```

用 `assets/profile-template.json` 起草 1.1 profile 后，必须以上述 `validate` 命令、完整外部证据包和实际 profile 路径校验；不要把未替换占位符的模板当成通过的 profile。generation-ready profile 还要用实际 suite 运行：

```powershell
node $tool validate-generation-test `
  --profile "$ip\dna\style-dna.draft.json" `
  --test "$ip\generation\generation-test.draft.json" `
  --manifest "$ip\corpus\corpus-manifest.json" `
  --health "$ip\corpus\sample-health.json" `
  --decisions "$ip\corpus\sample-decisions.draft.json" `
  --annotations "$ip\corpus\annotations.draft.json" `
  --reference-source $source
```

规则：有证据的 observation/candidate/approved 都必须携带完整外部证据包；`approved` 还必须增加 `--approval-record <json>`，并以 `--require-reviewed` 验证 generation suite。批准记录不能由 profile 自己替代；template/self-test 通过不替代实际 profile 的 CLI 结果。

## 能力二：风格仿写

生成前预检与输出校验：

```powershell
node engine\skills\style-copywriter\scripts\validate-generation-inputs.mjs --help
node engine\skills\style-copywriter\scripts\validate-generated-copy.mjs --help
```

正式生成必须同时具备三类独立输入：项目事实 contract、非空且可回读的知识包、指定风格档案。缺任何一类都停止，不得降级为“事实 + 风格”。

来源泄漏扫描（查产出稿有没有从原始来源原样搬字；与跨稿重复是两层）：

```powershell
node engine\leakage\check-source-leakage.mjs `
  --corpus 'C:\Users\admin\Downloads\钱十七-闲鱼文案拆解.docx' `
  --drafts 'ips\钱十七\outputs\闲鱼餐饮券-长视频版.md' 'ips\钱十七\outputs\闲鱼餐饮券-短视频版.md' `
  --n 12
```

`--corpus` 支持 .txt/.md/.docx 文件或目录（目录读其中的 .txt/.md/.docx）；默认 12 字连续重合即命中，事实枚举短语受保护（见 `engine/leakage/leakage-rules.json`）。有命中退出 1、无命中退出 0；语料在仓库外时路径不存在会打印“语料不在本机，跳过”并退出 0。

AI 味预检（查产出稿读起来像不像 AI；与合规/重复/泄漏三层并列的第四层）：

```powershell
node engine\naturalness\check-ai-flavor.mjs `
  'ips\钱十七\outputs\闲鱼餐饮券-短视频版.md' 'ips\半佛\outputs\闲鱼餐饮券-短视频版.md'

# 显式指定 IP 档位（不从路径推断时用）：
node engine\naturalness\check-ai-flavor.mjs --ip 半佛 '某篇稿.md'
```

按 IP 分档给阈值（`default`/`钱十七`/`半佛`，见 `engine/naturalness/ai-flavor-rules.json`），阈值取自 `docs/research/ai-flavor-diagnosis-20260823.md` 的真人基线。指标：破折号/冒号/引号/问号/省略号密度（每千字）、总结壳口头禅、"不是X是Y"句壳、悬空"的"句、句长均值/标准差/CV、最长连续反问、口语赘词密度。IP 识别：`--ip` 优先 → 路径 `ips/<IP>/` 推断 → `default`。破折号计数按 `——` 计一次（不按单字双计），故与诊断报告里按单字统计的破折号数值约差一半，属预期。句长 CV 只对半佛/default 门禁，钱十七只报不门禁（钱十七语料是口播转写、句读伪影，见诊断第 0 节）。有 block 级命中退出 1，否则 0。口语赘词只报不门禁。

## 当前各 IP 入口

钱十七：

- 人类可读风格主文件：`ips/钱十七/dna/钱十七-DNA-重构版.md`
- 机器审计契约：`ips/钱十七/dna/style-dna.draft.json`
- 证据包：`ips/钱十七/corpus/`、`ips/钱十七/audits/`
- 状态：`draft / review_only`，未批准
- 渲染 Markdown 只在审阅时临时生成，不作为第二份常驻风格文件。旧 `engine/profiles/qian17-xianyu-spoken/draft/`、独立 framework map 和工作台 `.md.dna.json` 已清理，禁止重新作为入口。

半佛：

- 风格档案：`ips/半佛/dna/半佛-DNA-可执行版.md`、`ips/半佛/dna/半佛-风格拆解.md`
- 产出：`ips/半佛/outputs/`
- 提取脚本：`ips/半佛/tools/extract-samples.py`
- 状态：手写档案，无证据锚点、无审计链，未经上述任何 CLI 校验

## Troubleshooting

- If Chinese text looks garbled, retry with `-Encoding UTF8`.
- On this machine, plain `python` may resolve to a WindowsApps placeholder. Prefer the Codex bundled Python path if a script is required.
