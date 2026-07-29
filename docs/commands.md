
# Commands

## Stack

Markdown-first style card plus a small local Node workbench for Feishu intake and style rewrite.

## Start Workbench

```powershell
cd 'D:\项目仓库\风格仿写'
& 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts\serve-workbench.mjs'
```

Default URL:

```text
http://127.0.0.1:4188
```

## Configure Model Rewrite

Create `.env.local` when model rewriting is needed:

```text
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1
```

Optional Lark CLI overrides:

```text
LARK_NODE_BIN=E:\DevTools\Node22\node.exe
LARK_CLI_ENTRY=E:\DevTools\Node22\node_modules\@larksuite\cli\scripts\run.js
```

Optional TTS overrides:

```text
TTS_API_KEY=...
TTS_BASE_URL=https://api.openai.com/v1
TTS_MODEL=gpt-4o-mini-tts
TTS_VOICE=alloy
TTS_FORMAT=mp3
```

If `TTS_*` values are not set, the workbench tries to reuse `OPENAI_API_KEY` / `OPENAI_BASE_URL`.

## Syntax Check

```powershell
& 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check 'scripts\serve-workbench.mjs'
& 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check 'workbench-ui\app.js'
```

## Read Source Sample

```powershell
Get-Content -LiteralPath 'F:\dai ma\钱十七剪辑拆解\钱十七文案素材\钱十七-闲鱼文案拆解.md' -Encoding UTF8
```

## List Project Files

```powershell
Get-ChildItem -Recurse -Force 'D:\项目仓库\风格仿写'
```

## Validate JSON

```powershell
Get-Content -LiteralPath 'D:\项目仓库\风格仿写\feature_list.json' -Raw -Encoding UTF8 | ConvertFrom-Json
```

## Validate Markdown Readback

```powershell
Get-Content -LiteralPath 'D:\项目仓库\风格仿写\style-engine\evaluation\spoken-style-profiler-qian17\钱十七-DNA-重构版.md' -Raw -Encoding UTF8
```

## Feishu Intake API

```powershell
$url = [uri]::EscapeDataString('https://yq9pu32e9v.feishu.cn/wiki/RQj2wuwaQiz9p8kDdTPc2aU5nCe')
Invoke-RestMethod -Uri "http://127.0.0.1:4188/api/import-feishu?url=$url" -Method Get
```

Successful imports write:

- `workbench_imports/<import_id>/import_manifest.json`
- `workbench_imports/<import_id>/normalized_script.txt`
- `workbench_imports/<import_id>/script_segments.json`
- `workbench_imports/<import_id>/feishu_asset_index.json`
- `workbench_imports/<import_id>/source_brief_preview.json`

## Add Rewrite Styles

Add a Markdown style card under:

```text
D:\项目仓库\风格仿写\profiles
```

The workbench reads `*.md` files in that folder and exposes them in the `改写风格` dropdown. The first `# Heading` becomes the display name.

## Style Library API

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:4188/api/style-library' -Method Get
Invoke-RestMethod -Uri 'http://127.0.0.1:4188/api/style-profile?id=钱十七-闲鱼风格拆解.md' -Method Get
```

Saving a style writes a Markdown file into `profiles/`.

## Style DNA Extraction And Match

从左侧原文区粘贴参考样本后，可在 `风格库` 点击 `提取当前文本 DNA`。这只会生成可编辑草稿；点击 `保存到风格库` 后才写入：

```text
profiles/<风格名>.md
profiles/<风格名>.md.dna.json
```

接口验证示例：

```powershell
$body = @{ text = '参考口播文本'; name = '新风格'; sample_count = 3 } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:4188/api/analyze-style' -Method Post -ContentType 'application/json; charset=utf-8' -Body $body

$body = @{ text = '待检测改写稿'; style_id = '钱十七-闲鱼风格拆解.md' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:4188/api/style-match' -Method Post -ContentType 'application/json; charset=utf-8' -Body $body
```

评分只比较口播感、能量、直接性、证据密度和转化力度；它不验证事实、合规、素材真实性或商业效果。

## Spoken DNA Engine (No UI)

### Canonical Generic Skill

当前正式入口是个人 Skill `$spoken-style-profiler`。它不启动工作台、不调用模型，也不生成仿写稿。

```powershell
$tool = 'C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs'
$source = 'F:\dai ma\钱十七剪辑拆解\钱十七文案素材\钱十七-闲鱼文案拆解.md'
$out = 'D:\项目仓库\风格仿写\style-engine\evaluation\new-profile'

node $tool scaffold --source $source --corpus-id new-profile-v1 --out $out
```

`scaffold` 只生成语料清单、健康报告、人工样本决策草稿和标注草稿。人工补全标注与 profile 后，用完整外部证据包验证：

```powershell
node $tool validate `
  --profile "$out\style-dna.draft.json" `
  --manifest "$out\corpus-manifest.json" `
  --health "$out\sample-health.json" `
  --decisions "$out\sample-decisions.draft.json" `
  --annotations "$out\annotations.draft.json"

node $tool leakage `
  --source $source `
  --profile "$out\style-dna.draft.json" `
  --corpus-id new-profile-v1

node $tool render `
  --profile "$out\style-dna.draft.json" `
  --manifest "$out\corpus-manifest.json" `
  --health "$out\sample-health.json" `
  --decisions "$out\sample-decisions.draft.json" `
  --annotations "$out\annotations.draft.json" `
  --out "$out\Style-DNA.draft.md" `
  --force

node --check 'C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs'
node --check 'C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\self-test.mjs'
node 'C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\self-test.mjs'
```

用 `assets/profile-template.json` 起草 1.1 profile 后，必须以上述 `validate` 命令、完整外部证据包和实际 profile 路径校验；不要把未替换占位符的模板当成通过的 profile。generation-ready profile 还要用实际 suite 运行：

```powershell
node $tool validate-generation-test `
  --profile "$out\style-dna.draft.json" `
  --test "$out\generation-test.draft.json" `
  --manifest "$out\corpus-manifest.json" `
  --health "$out\sample-health.json" `
  --decisions "$out\sample-decisions.draft.json" `
  --annotations "$out\annotations.draft.json" `
  --reference-source $source
```

规则：有证据的 observation/candidate/approved 都必须携带完整外部证据包；`approved` 还必须增加 `--approval-record <json>`，并以 `--require-reviewed` 验证 generation suite。批准记录不能由 profile 自己替代；template/self-test 通过不替代两个实际 profile 的 CLI 结果。

### 钱十七当前唯一入口

- 用户确认的人类可读风格主文件：`style-engine/evaluation/spoken-style-profiler-qian17/钱十七-DNA-重构版.md`
- 工作台别名：`profiles/钱十七-闲鱼风格拆解.md`（必须是上述主文件的 hard link）
- 机器审计契约：`style-engine/evaluation/spoken-style-profiler-qian17/style-dna.draft.json`
- 证据包仍保留在同一 evaluation 目录；渲染 Markdown 只在审阅时临时生成，不再作为第二份常驻风格文件。
- 旧 `style-engine/profiles/qian17-xianyu-spoken/draft/`、独立 framework map 和工作台 `.md.dna.json` 已清理，禁止重新作为入口。

## Voice Synthesis API

```powershell
$body = @{ text='这是一次语音合成测试。'; model='gpt-4o-mini-tts'; voice='alloy'; format='mp3' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:4188/api/synthesize-voice' -Method Post -ContentType 'application/json; charset=utf-8' -Body $body
```

Successful synthesis writes:

- `workbench_audio/<audio_id>/voice.<format>`
- `workbench_audio/<audio_id>/voice_script.txt`
- `workbench_audio/<audio_id>/voice_manifest.json`

## Troubleshooting

- If Chinese text looks garbled, retry with `-Encoding UTF8`.
- On this machine, plain `python` may resolve to a WindowsApps placeholder. Prefer the Codex bundled Python path if a script is required.
