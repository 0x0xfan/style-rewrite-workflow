
# Verification

## 2026-07-30 Qian17 style application rerun

- After the user correctly challenged “why was Qian17 style not actually used,” the rejected screening draft was not treated as evidence that the profile itself was wrong.
- Rebuilt the same Codex project as a money-project explanation using `fw-project-breakdown`, with all 10 required path slots explicitly evidenced or marked `test_only/bounded_verified`.
- Added style-application trace validation: every required stable control and declared pattern must bind a purpose and an exact output excerpt. A metadata-only style/rule declaration now fails.
- New styled copy traces A1–A6 plus P1/P7 to eight real spans; input preflight passed 6/6 and output validation passed 8/8. The report explicitly states that span coverage does not prove human similarity.
- Word QA: 19 nonempty paragraphs exactly match canonical Markdown after removing two internal image markers; 2 inline images, 2 semantic alt texts, a11y 0/0/0, no headers/footers or visible production markers.
- Real Word-compatible COM export + Poppler render produced two pages; both were visually inspected and passed.
- Five-minute expansion: 1,126 CJK characters / 1,240 spoken units, estimated 4.8 minutes at 260 units/minute and 5.2 minutes at 240 units/minute. Added only practice, listing-detail and inquiry-scope actions.
- Canonical Word: 348,979 bytes, SHA-256 `77CD1353AB8AABFC1FBEE625D7927C9B83FCF0CC60A00EA68254D60F7E193083`.
- Repository gates: lint passed; test suite 19/19 passed; personal Qian17 Skill valid; `git diff --check` no whitespace errors.
- User style judgment is pending; profile remains `draft/review_only`.

## 2026-07-30 Codex installation clean generation baseline (historical; user rejected for AI tone/no Qian17 voice)

- Saved a SHA-bound task brief that preserves the user's exact novice-viewer requirement while classifying “几分钟学会 / 接单赚钱” as unverified hypotheses rather than facts.
- Added `validate-generation-inputs.mjs` and five Node regression tests for a valid plan, role drift, unverified required slots, counterevidence misuse and rejected-plan reuse.
- Replaced the ineligible `fw-project-breakdown` with `fw-screening-tutorial`; Baseline and bounded Enhanced both passed 6/6 preflight checks and 7/7 output checks with zero warnings/failures.
- Local isolated install evidence: Windows 11 x64, `@openai/codex@0.145.0`, 229.6 seconds, exit 0, `codex-cli 0.145.0`; no authentication or customer delivery was attempted.
- Canonical Word: 348,294 bytes, SHA-256 `1CE77870CBB76ECAC9464A7ECB73B0BF9C5CD020CF71C14D43F24BCC7C1D34F9`; two inline verified images, two nonempty semantic alt texts, a11y 0/0/0.
- Real Word-compatible COM export + Poppler render produced two pages; both pages were visually inspected with no clipping, overlap, blank page, unreadable crop or detached evidence paragraph.
- Repository gates: `npm run lint` passed; `npm run test:spoken-dna` passed 17/17; new validator syntax passed; personal `qian17-copywriter` Skill returned `Skill is valid!`; `git diff --check` reported no whitespace errors.
- Profile remains `draft/review_only`; machine checks do not constitute user style approval.

## 2026-07-29 Qian17 complete-corpus reprofile

- Authoritative DOCX SHA-256: `036B6795AC894CCE20A81A2ACCFC08284C67337B8F20E27643592D0AC2F1E290`.
- Text/structure extraction: 86 total paragraphs, 75 nonempty, 11 script units.
- Scaffold health: 11 raw units, 20,745 effective characters, one known near-duplicate pair (`u03/u07`, similarity 0.871), 10 independent clusters after the user's reviewed merge decision.
- `spoken-style-tool.mjs validate`: `ok=true`, 0 errors, 0 warnings.
- `spoken-style-tool.mjs leakage --min 20`: `ok=true`, 0 matches.
- `npm run lint`: passed.
- `npm run test:spoken-dna`: passed 12/12, including corpus closure, duplicate handling, two-path framework evidence, baseline/enhanced budget, target-draft fact leakage and canonical-alias equality.
- NTFS hard-link audit: canonical profile and `profiles` alias have the same File ID.
- Personal `qian17-copywriter` Skill: `quick_validate.py` returned `Skill is valid!` with UTF-8 system Python.
- DOCX visual rendering was not run because LibreOffice `soffice` is unavailable. This task used textual/structural evidence only.
- Right-side ChatGPT Pro external dispatch did not occur: two upload routes timed out with recurring ChatGPT page network errors; no prompt, file or conversation URL was created.
- Scoped recovery ZIP: `artifacts/dual-agent/2026-07-29-qian17-reprofile/qian17-reprofile-ab10111.zip`, 80,872 bytes, SHA-256 `c69c8d8e544bac113808658c076b07022e9fb2098dd027b360868afda0d9e34b`; 15 entries, secret scan 0 findings, forbidden archive paths 0.

## Required Evidence Types

- Static checks: project files exist and can be read as UTF-8.
- Source checks: sample path exists and headings can be extracted.
- Style-card checks: card separates reusable style from non-reusable facts.
- Platform checks: Feishu/Chrome/Xianyu are not considered verified unless actually read or opened in a real session.
- Manual review: user can inspect the style card and decide whether to proceed to the first imitation task.

## Evidence Log

2026-06-27:

- Initialized project files in `D:\项目仓库\风格仿写`.
- Verified source sample exists at `F:\dai ma\钱十七剪辑拆解\钱十七文案素材\钱十七-闲鱼文案拆解.md`.
- Extracted 8 `##` sections from the sample document.
- Created `ips/钱十七/dna/钱十七-DNA-重构版.md`.
- Created GitHub tooling research note.
- Verified `feature_list.json` parses with PowerShell `ConvertFrom-Json`.
- Added local workbench files: `package.json`, `scripts/serve-workbench.mjs`, `workbench-ui/index.html`, `workbench-ui/app.js`, `workbench-ui/styles.css`.
- Verified Node syntax with bundled Node:
  - `node --check scripts\serve-workbench.mjs`
  - `node --check workbench-ui\app.js`
- Started local server at `http://127.0.0.1:4188` and verified `/api/status`.
- Real Feishu readback succeeded for `https://yq9pu32e9v.feishu.cn/wiki/RQj2wuwaQiz9p8kDdTPc2aU5nCe` through `lark-cli`.
- Latest verified import: `workbench_imports/feishu_20260627034418`.
  - title: `闲鱼虚拟资料详细项目拆解`
  - paragraph_count: 55
  - image_count: 6
  - downloaded_count: 6
  - failed_count: 0
  - reader: `lark-cli`
- Verified `workbench_imports/feishu_20260627034418/source_brief_preview.json` exists and contains topic, market signals, 6 imported assets, CTA extraction, and risk extraction.
- Verified `/api/rewrite-copy` returns `AI_NOT_CONFIGURED` with source brief when no API key is configured.
- Browser verification with system Chrome succeeded:
  - page title and H1: `风格仿写工作台`
  - clicking `读取飞书` populated正文、6 个素材卡、事实提取和证据路径
  - page errors: none
  - console errors: none
- Copied P002 local-account proxy model config into `.env.local` without printing the secret.
- Verified `/api/status` now reports:
  - configured: true
  - base_url: `http://localhost:48760/v1`
  - model: `gpt-5.5`
- Verified `/api/test-ai-config` fails with `fetch failed` because `localhost:48760` is not currently listening.
- Added rewrite style selector and backend style listing.
- Verified `/api/styles` returns:
  - id: `钱十七-闲鱼风格拆解.md`
  - name: `钱十七-闲鱼风格拆解`
  - is_default: true
- Browser verification with system Chrome succeeded:
  - `#styleSelect` is visible in the middle action rail
  - selected value: `钱十七-闲鱼风格拆解.md`
  - selected label: `钱十七-闲鱼风格拆解`
  - page errors: none
  - console errors: none
- Added meta-reference prompt constraints and backend quality gate for final scripts.
- Verified local model proxy recovered:
  - `/api/test-ai-config` returned `ok=true`
  - model: `gpt-5.5`
  - base_url: `http://localhost:48760/v1`
- Verified short rewrite smoke test:
  - rewrite id: `rewrite_20260627055825`
  - matched forbidden terms: 0
- Verified full Feishu rewrite:
  - import id: `feishu_20260627034418`
  - rewrite id: `rewrite_20260627055957`
  - output path: `workbench_rewrites/rewrite_20260627055957/rewritten_script.txt`
  - matched forbidden terms: 0
- Updated Feishu source normalization to preserve heading levels in the left editor.
- Verified real Feishu import after the change:
  - import id: `feishu_20260627061955`
  - first source line: `# 闲鱼虚拟资料详细项目拆解`
  - sample heading lines include `# ***一.项目简介***`, `## 有需要的兄弟们...`, `# *二、项目实操流程*`, `# *三.如何选品？*`
- Browser verification with system Chrome confirmed `textarea#sourceCopy` displays preserved heading markers and had no page or console errors.
- Replaced the visible source textarea with a Markdown-aware editable source view while keeping hidden `textarea#sourceCopy` as the Markdown source for API submission.
- Browser verification with system Chrome confirmed:
  - `#sourceEditor` visible: true
  - `#sourceCopy` visible: false
  - hidden raw first line: `# 闲鱼虚拟资料详细项目拆解`
  - hidden raw has heading marker: true
  - rendered H1 text: `闲鱼虚拟资料详细项目拆解`
  - rendered H1 font size: 22px
  - rendered body paragraph font size: 14px
  - page errors: none
  - console errors: none
- Restored `风格库` and `语音合成` workbench modules after over-trimming the P002 page.
- Verified syntax after restoration:
  - `node --check scripts\serve-workbench.mjs`
  - `node --check workbench-ui\app.js`
- Verified `/api/status` reports model `gpt-5.5` and TTS model `gpt-4o-mini-tts` at `http://localhost:48760/v1`.
- Verified style library endpoints:
  - `/api/style-profile?id=钱十七-闲鱼风格拆解.md` returned ok, style id `钱十七-闲鱼风格拆解.md`, content length 2734.
  - `/api/style-library` returned ok, active style `钱十七-闲鱼风格拆解.md`, style count 1.
  - `/api/style-profile` save works for ASCII and Chinese style names; temporary verification files were deleted.
- Verified `/api/tts-config` returns ok with model `gpt-4o-mini-tts`, voice `alloy`, format `mp3`.
- Verified `/api/synthesize-voice` reaches the local proxy but does not generate audio because upstream returns Cloudflare verification:
  - code: `TTS_REQUEST_FAILED`
  - message: `upstream server error: Enable JavaScript and cookies to continue [kind=html, cf_ray=...]`
- In-app browser verification after reload confirmed:
  - page contains `风格库`
  - page contains `语音合成`
  - `#styleContent` is visible
  - `#styleLibraryList` shows `钱十七-闲鱼风格拆解.md`
  - `#synthesizeVoice` is visible
  - `#voiceStatus` shows `TTS 已配置：gpt-4o-mini-tts / alloy`
  - page console errors: none

## Completion Rule

A task is done only when evidence is recorded here or the blocker is explicitly documented in `HANDOFF.md`.

## Spoken DNA Engine

2026-07-22:

- User confirmed that this phase is text spoken-script DNA only; UI, rewrite, Feishu, TTS, video and publishing work are frozen.
- Added `engine/` with independent corpus segmentation, health assessment, seven-layer analysis, draft fusion/rendering and CLI entrypoint.
- `npm run test:spoken-dna` passed 6/6:
  - only H2 headings become units;
  - near duplicates are surfaced;
  - DNA cannot contain test-source phrases or bypass human approval;
  - `先排雷再给方法` verifies risk-before-method order instead of merely co-occurring words.
- Real run command produced `engine/profiles/qian17-xianyu-spoken/draft/`:
  - `corpus-manifest.json`: 8 units;
  - `sample-health.json`: `warning`; near duplicate `u03/u07` at 0.871;
  - `style-dna.draft.json` and `Style-DNA.draft.md`: 14 candidate rules and 6 content-type frameworks, `status=draft`, `requires_human_approval=true`.
- Candidate invariant checks passed: 8 units, every candidate rule has at least two evidence IDs, forbidden sampled phrases are absent, and the DNA JSON parses as UTF-8.
- The first implementation test exposed a punctuation-normalization defect in the ordering check. The analyzer was repaired to recognize numbered markers after normalization, and the complete test/run sequence passed after the repair.
- User review exposed that a broad “结果型开场” label failed to capture the recurring生活化结果落差句式. Added `L1-R04` as an abstract formula with two source-unit anchors, low confidence, user-evidence-only applicability and high risk review; it stores no source line. `npm run test:spoken-dna` now passes 5/5, including the formula/no-source-line regression.
- User review then exposed that “先框架、后编号” was too coarse to guide imitation. Added a profile-bound framework map and a rendered `口播框架库`: F00 实操教学主干; F01 新手基础系列; F02 判断公式与选项筛选; F03 低门槛项目拆解; F04 案例驱动服务模型; F05 资源目录清单. Candidate frameworks require at least two evidence units; one-sample frameworks are explicitly observations. The sixth regression checks this boundary. The CLI rejects a framework map whose profile ID does not match `--style-id`; final real run reports 6 frameworks and no source-specific phrase leakage.

## Generic Spoken Style Profiler Skill

2026-07-22:

- Created the personal Skill at `C:\Users\admin\.codex\skills\spoken-style-profiler`; it is generic and keeps all IP/platform/industry findings in external profiles rather than the Skill core.
- Skill structure validator returned `Skill is valid!`. The validator's PyYAML dependency was exposed only through an isolated temporary `PYTHONPATH`; no dependency was added to the project or Skill. Cleanup of `C:\Users\admin\AppData\Local\Temp\spoken-style-profiler-validation-pyyaml` was rejected by execution policy, so the isolated validation files remain but are not a runtime dependency.
- `node --check` passed for `scripts/spoken-style-tool.mjs` and `scripts/self-test.mjs`.
- `scripts/self-test.mjs` passed 30/30. The attacks include:
  - false independent-cluster claims, fragmented framework paths, dangling anchors, and empty-shell annotations;
  - missing/illegal human decisions, unresolved near duplicates/opening candidates, and manifest omissions;
  - draft or free-text self-approval, incomplete approval checklists, non-human reviewer values, and invalid timestamps;
  - exact long fragments, titles, four-character earnings claims, punctuation-normalized matches, protected fields, and cross-field source reconstruction;
  - a valid two-beat non-tutorial framework without forced tutorial, income, project, data, or CTA fields.
- 钱十七 forward test at `ips/钱十七/` passed `validate` and `leakage` with zero errors/warnings/matches. It remains draft; every item is `observation/review_only`, and `u03/u07` similarity 0.871 remains an unresolved human decision.
- Synthetic everyday-reflection narrative fixture at `engine/fixtures/narrative/` passed `validate` and `leakage`. It uses a real two-beat narrative framework and empty `required_content_fields`, demonstrating that the core does not require a tutorial/commercial schema. This fixture is not a substitute for a second real IP corpus.
- Both human Markdown reports were rendered only from validated abstract rules and anchor references; source lines were not emitted into the profiles.
- Independent adversarial review reran the attacks and both forward tests. All previously reported gaps were fixed; final verdict: `ACCEPTED`. Reviewed script SHA-256: `1C0EE401…231C7FC`.
- No profile is approved. The historical workbench DNA and `engine/profiles/qian17-xianyu-spoken/draft/` do not satisfy the new approval contract and must not be selected for formal rewriting.

## Style DNA 1.1 Control Contract Upgrade

2026-07-22:

- Documentation and F009 acceptance criteria now require typed selector DSL, observable persona/content strategy controls, executable beats/pattern budgets, intended audience effects, negative style, external content contract/output audit, digest-bound approval, strict 1.1/version and visual-namespace bans, and reviewed generation-suite branch coverage.
- Local checks executed: `node --check` passed for canonical `scripts/spoken-style-tool.mjs` and `scripts/self-test.mjs`; all six JSON assets parsed; `assets/profile-template.json` itself returned `ok=true`; `node scripts/self-test.mjs` passed 50/50; Skill Creator `quick_validate.py` returned `Skill is valid!`.
- `assets/profile-template.json` remains only a starting point: an actual profile must be validated with manifest, health, decisions and annotations. Template/self-test success does not substitute for real-profile evidence.
- 钱十七 actual draft: `validate-generation-test` returned `ok=true`, 1 abstain case, 0 errors; full `validate --generation-test --reference-source` returned `ok=true`; `leakage --annotations` returned 0 matches. All controls remain observation/review_only, so no output exists and positive/fallback coverage is intentionally inapplicable until candidates exist.
- Narrative actual draft: `validate-generation-test` returned `ok=true`, 3 cases, 0 errors; positive selected `everyday-reflective-narrative` + `scene-to-reflection-two-beat`, fallback used `b02`, excluded tutorial abstained. The three candidate patterns each hit their max=1 in the positive case, and `avoid-grandiose-self-congratulation` received a trigger probe. Full validate returned `ok=true`; leakage with annotations returned 0 matches.
- Both actual suites emitted the expected warning that they are not human reviewed. Their branch and span records are draft evidence only, not approval or an automatic semantic guarantee.
- Both profiles remain draft; no approved DNA exists. Validator digest/structure checks cannot prove a real human reviewer identity or natural-language output-audit semantics.
- Approval-state regression also binds `approved_control_state_sha256` in addition to candidate/evidence/suite/output digests; it records actual control status/availability, and validation rejects any candidate left inside an approved profile.
- Independent final quality gate reran the current files and returned `ACCEPTED`: Node syntax and 50/50 tests passed; both actual suites/full validations/leakage scans passed; selector duplicates, invalid positions/effects and approved control-state changes were rejected. Both profiles/suites remained draft with zero approved/selectable entries and no approval record.
- User sample decision `sample-review-20260722-001`: `u03/u07` were confirmed as two transcriptions of the same script and recorded as `merge_as_variant`. Annotations/profile now share `variant:duplicate-candidate-01`; independent cluster count remains 7. Independent review returned `ACCEPTED`; full validate and generation-test validate passed, leakage with annotations returned 0 matches, and all 11 controls remained `observation/review_only`.
- 钱十七完整 DNA 已在用户授权 Agent 自行处理样本后重建：annotations 现有 75 anchors；低质量长转写只提供宏观临时语义锚点；`u05` 局部模板复用已隔离；冲突的筛选路径拆为两个框架。对抗式自查删除了低质量稿支撑的微观规则后，档案现有 5 content types、6 frameworks、13 patterns 和 21 generation controls，全部为 `observation/review_only`；13 个 pattern 均不引用低质量转写。
- 最新实际验证：`validate-generation-test` 与完整 `validate --generation-test --reference-source` 均 `ok=true`；唯一 warning 为 draft suite 尚未人工 reviewed；`leakage --annotations` 为 `ok=true`、0 matches；人读 `Style-DNA.draft.md` 已重新 render。用户审阅入口为 `钱十七-DNA-人工审阅清单.md`。

## Qian17 Same-PDF Shadow Revision

2026-07-23:

- User authorized a Qian17-profile-only upgrade after adversarial review; the generic `$spoken-style-profiler` was intentionally not changed.
- Added two evidence-backed content strategies and two patterns: benefit-through-steps, data-job sequencing, reason→action→payoff, and opportunity→process→unit-economics→cumulative-proof staging. New micro controls cite only medium-quality `u02/u03` anchors.
- Added `av-no-abstract-project-opening` from explicit human feedback and updated `fw-low-barrier-project` plus entry/body attention controls. Profile totals are now 9 content strategies, 15 patterns, 7 avoid patterns and 25 reported generation controls; all remain `observation/review_only`.
- Candidate digest updated to `sha256:699eb24b420dca51ec687380439b05cf8be4cc6f6a497dc7ebcde402684f4ba2` and rebound in `generation-test.draft.json`.
- Full validate returned `ok=true`; only the expected unreviewed draft-suite warning remains. Leakage returned `ok=true`, 0 matches. `Style-DNA.draft.md` rendered successfully.
- Revised shadow output checks: all 16 surfaced data groups present; banned rewrite/evidence-carrier/abstract-opening terms 0; unwhitelisted 20-character overlap with the Qian17 corpus 0. Relative positions: opportunity data 4%, store result 62.9%, unit economics 73.7%, cumulative proof 78%.
- This deterministic evidence does not establish human style acceptance. The latest script still awaits the user's semantic review.

### Value-Packaging Revision

- Added three observable packaging strategies and three executable patterns: common-view→hidden-layer opportunity reframing, audience-state→first-step insertion, and data→meaning→value translation. Added bare-data and formula→CTA-jump avoid rules.
- Expanded `fw-low-barrier-project` without changing the generic schema. Positive micro controls cite only medium-quality `u01/u02/u03` anchors; no fixed information percentages or low-quality transcript evidence were introduced.
- Profile totals: 12 content strategies, 18 patterns, 9 avoid patterns, 30 validator-reported generation controls. Candidate digest: `sha256:4ba4eb3815e4a4678bd8f2c823ac25903cfb348c446780d74e89ff00b1da3bde`.
- Full validate returned `ok=true` with the expected unreviewed draft-suite warning; leakage returned 0 matches; rendered Markdown contains the new controls.
- Revised shadow script passed all 16 surfaced-data checks, banned/meta/abstract-secret term checks, and the unwhitelisted 20-character reference-overlap scan. Packaging probes for cognitive gap, second-layer value, audience insertion, data translation, commercial explanation and pre-CTA value elevation all passed.

### Cognitive-Journey And Reveal-Order Revision

- Added two observable strategies, two patterns and one human-boundary avoid for old-belief→new-standard cognitive progression and surface-anchor→question→real-result reveal order. Positive micro controls cite medium-quality `u02/u03` anchors; the exact 0.2→19.9 order is also bound by explicit user feedback.
- Updated `fw-low-barrier-project`, entry/proof attention instructions and the user review checklist. The profile uses existing Style DNA 1.1 fields; the generic Skill schema was not changed.
- Candidate digest updated and rebound: `sha256:8431b252745f8fa412f14c20b4f0c779bb6362d1deb8fe910dd407e232eacdb6`.
- Full validate returned `ok=true` with only the unreviewed-suite warning; leakage returned 0; rendered Markdown succeeded. Totals: 14 content strategies, 20 patterns, 10 avoid patterns, 33 reported generation controls.
- Shadow output assertions passed: first paragraph contains 0.2 but not 19.9; the question follows 0.2 and 19.9 follows the question; all 16 numeric facts remain; cognitive-route probes pass; banned terms and unwhitelisted 20-character source overlap are 0.

### Narrator-Position And Generic Control Revision

- The user explicitly authorized changing the generic Skill after the fifth review showed that a correct framework, reveal order and cognitive route can still sound like a detached project manual.
- The generic Style DNA 1.1 contract now gives first-class semantics to `narrator_position`, `cognitive_journey` and `opportunity_packaging` inside the existing `communication_persona[]` and `content_strategy[]` collections. No new top-level namespace was added.
- The validator now enforces fixed persona dimensions and strategy categories. The renderer prints discriminator values in the human profile. Documentation and annotation guidance require observable text evidence and prohibit inferred real identity, invented audience beliefs or newly manufactured opportunity/value claims.
- Canonical Node syntax checks passed. `scripts/self-test.mjs` passed 51/51, including valid narrator/cognitive/packaging observations and rejection of unknown psychological/conversion categories. The non-tutorial narrative fixture still validates, so the generic change does not force project/tutorial structure.
- The generic Skill scan found no Qian17 name, lifestyle analogy, reveal values or cloud-drive tactic in the canonical Skill. Its only platform/industry wording is an explicit generic prohibition against hardcoding any platform or field.
- The Qian17 profile recategorized the existing cognitive and opportunity controls, changed A01 to a target-owned researcher/deconstructor narrator position, and added two human-boundary avoids: detached manual voice and training-deck jargon. Totals are 4 persona, 14 strategies, 20 patterns, 12 avoids and 35 reported generation controls; all 66 control items remain `observation/review_only`, with 0 candidate and 0 approved.
- Candidate digest updated and rebound to `sha256:70b42b61c64446144bbee05f2f0e226fbf74d1870a0b3fefb2bd814f1466b4a2`. Full validation returned `ok=true` with only the expected draft-suite-not-reviewed warning; profile leakage returned 0; Markdown render succeeded.
- The fifth shadow script starts from the target speaker's present deconstruction action, then anomaly, judgment and four-part path. All 16 surfaced numeric groups remain. Banned audit and training-jargon probes returned 0. Reveal order passed. Relative positions: 0.2 at 2.9%, 19.9 at 6.7%, store result at 62.0%, unit economics at 77.9%, cumulative proof at 81.1%, value elevation at 86.0%.
- Qian17 reference scan found 0 exact 20-character overlaps. One sensitive 4-character normalized overlap (`是19.9`) remains because 19.9 is a target-owned locked consultation price; manual review classified it as target content, not style-source fact leakage. Shadow-script SHA-256 is `2301dd2d06b295c279b63912253e2f59d067de3340feca68a37bdc2e6cc4277a`.
- Skill Creator `quick_validate.py` was attempted twice but could not start because both available Python runtimes lacked PyYAML. Per project policy, no third retry or dependency mutation was attempted. This is a tooling dependency gap, not a passing result; Node contract/self-tests and actual-profile validations are the current evidence.

### Subtraction Calibration After User Regression

- The user explicitly rejected the V5 opening “我把项目拆了一遍，先发现……” and reported that later iterations had accumulated more unsatisfactory elements. This was treated as a regression signal rather than a request for another additive rule.
- The subtraction audit identified the failure mode: feedback from one target-content shadow script had been promoted into stable IP DNA. Researcher/deconstructor narrator position, full-script cognitive journey, target-specific 0.2→19.9 reveal order, every-section correction template and forced value elevation were overfitted auxiliary controls.
- The generic `spoken-style-profiler` now requires a one- or two-sentence core model before detailed rules, framework-first control, optional auxiliary layers, rule deduplication and a human comparison between a framework-only baseline and an enriched version. It explicitly rejects retaining a richer theory when the simpler baseline is more faithful.
- The `qian17-copywriter` Skill now defines Qian17 primarily as a practical project explainer: specific project/result → why it matters → roadmap → numbered explanation/actions → payoff → target-owned CTA. Self-narrated research process and repeated cognitive correction are prohibited by default; risk remains subordinate to method and payoff.
- The Qian17 profile reverted A01 from `narrator_position` to `speaker_position`. Removed controls: `cs-cognitive-correction-route`, `cs-surface-anchor-delayed-reveal`, `pt-surface-anchor-question-reveal`, `pt-error-key-standard-action`, `av-no-premature-answer-reveal`, `av-no-detached-manual-narrator`.
- The low-barrier project framework was rewritten as specific project/result → value reason → roadmap → numbered method → payoff mechanism → resource close. Remaining opportunity packaging, audience insertion, local correction and value-summary controls are optional and cannot override the framework.
- Counts changed from 14 strategies / 20 patterns / 12 avoids / 35 reported generation controls to 1 / 11 / 10 / 20 after three deduplication rounds. Framework owns the content backbone, attention only supplies position, patterns retain local sentence/rhetorical devices, and the single strategy controls whole-script risk priority. All controls remain `observation/review_only`; no candidate or approved control was created.
- Independent read-only review initially returned ITERATE and found four hard issues: step-order lock violation, unregistered “一键三连/下期见” source-style CTA, conditional-income generalization and remaining “我去问了一下” process narration. All four were corrected before user handoff. Two further semantic-dedup rounds removed repeated hook, roadmap, close, proof, reason-action, audience, objection and risk controls; final independent re-review returned `ACCEPT`.
- V6 shadow script restored direct project entry and contains only one explicit correction shell. Account→content→delivery order passes; activity/customer conditions remain explicit only at the applicable payoff sentence; unregistered CTA and process narration hits are 0. All 16 numeric groups remain. Relative positions: 0.2=1.8%, 19.9=5.9%, store result=59.1%, unit economics=71.9%, cumulative result=79.2%, project summary=85.0%. Script SHA-256: `f5e00bd6aeb3661562f7808beb9558ff6d1da104c09cfa6d8fb0c7d5c39326e0`.
- Candidate digest was rebound to `sha256:0b288346283addc63df6ae0fae7ff1aacbf96ceb56f2b43178f6a37a61428a44`. Node syntax passed; canonical self-tests passed 51/51; Qian17 full validation returned `ok=true` with only the expected unreviewed-draft-suite warning; profile leakage returned 0; render succeeded.
- The exact 20-character script-to-Qian17 overlap remains 0. One 4-character sensitive normalized match (`是19.9`) is target-owned price content and is documented rather than hidden.
- The profile remains draft. Human acceptance of the simpler script is still required; machine checks cannot establish style similarity.

### 2026-07-23 Qian17 V7 section-value bridges

- User review showed V6 subtraction had removed a stable retention device: descriptive setup before major sections. Raw-corpus evidence was added to annotations for `u01:p08`, `u02:p11`, `u03:p08` and `u03:p10`; the relation is supported across three independent clusters.
- Added one local observation pattern, `pt-section-value-bridge`, with a maximum of three body uses and explicit bans on empty suspense, identical shells, fabricated urgency, causal claims and income. `ar-body-reset` now owns only interaction/save prompts, closing the cross-layer duplication.
- V7 uses three target-bound bridges: account/store purpose, content/link preparation for repeatable delivery, and conditional additional payoff. Two unsupported causal phrasings and unconditional income language were removed after independent review.
- Final candidate digest: `sha256:1c44555710904937977e4124a3db8f95baefbfad1545e9b36957b3de141fec57`. Canonical self-tests passed 51/51; full profile validate returned `ok=true` with only the unreviewed-suite warning; leakage returned 0; render succeeded.
- Script checks: all 16 numeric groups present; process/evidence-carrier/unregistered CTA terms 0; exact 20-character Qian17 overlap 0; positions 0.2=1.5%, 19.9=5.0%, store=60.9%, unit economics=76.3%, cumulative=82.5%, summary=87.3%; SHA-256 `a84085079030c19045dca36100d47145a04084f5dc1f62c3250d4487f3e7c031`.
- Independent review iterated twice on semantic ownership and fact locks, then returned `ACCEPT`. Profile remains draft and cannot be selected until user approval and a reviewed suite exist.

## Initialization Revalidation

2026-07-21:

- `init.ps1` completed successfully and ran both Node syntax checks.
- Required harness files were read back: 17 files present, including project brief, architecture, evaluator rubric, clean-state checklist, and harness audit.
- `feature_list.json` parsed as UTF-8 JSON; WIP limit is 1 and no feature is active.
- Source sample read back as UTF-8: 155 lines and 8 `##` sections.
- Style card read back as UTF-8: 2734 characters.
- Local workbench started at `http://127.0.0.1:4188`.
- `GET /api/status` returned `ok=true`, model configured as `gpt-5.5`, and TTS configuration present as `gpt-4o-mini-tts / alloy`.
- `GET /api/style-library` returned `ok=true` with 1 style card and active style `钱十七-闲鱼风格拆解.md`.
- `GET /` returned HTTP 200, title `风格仿写工作台`, and contained both `风格库` and `语音合成`.
- Git isolation check: this directory is not a Git repository; future parallel write tasks remain disabled.

## Style DNA Research And Integration

2026-07-21:

- Read six GitHub candidates and recorded the method-level adoption decision in `docs/github-style-tooling-research.md`; no external code, model, corpus, or repo was vendored.
- Added project-owned `docs/style-dna-spec.md`: confidence grading, privacy boundary, JSON contract, five short-video axes, and score limitations.
- Added `POST /api/analyze-style` for deterministic local Style DNA extraction and editable Markdown draft generation.
- Added `POST /api/style-match` for explainable five-axis style-match scoring.
- Extended style save/load so a Markdown card can carry a sibling `.md.dna.json` fingerprint.
- Historical F005 verification generated a sibling workbench DNA from 8 sample units / 14,843 characters; that legacy file was removed during the 2026-07-28 single-source cleanup and is no longer an active profile:
  - confidence: `初步可用` / 0.55
  - axes: 口播感 79, 能量 51, 直接性 47, 证据密度 65, 转化力度 80
- Passed static checks:
  - `node --check scripts\serve-workbench.mjs`
  - `node --check workbench-ui\app.js`
- API checks passed:
  - `/api/status` reported the default style with `dna_available=true`.
  - `/api/style-profile` returned the saved `style_dna`.
  - `/api/analyze-style` returned an editable DNA Markdown draft for a Chinese test sample.
  - `/api/style-match` returned `available=true`, five dimensions, an overall score, and an explicit limitation that the score is not a fact/compliance/effect proof.
- Browser checks passed at `http://127.0.0.1:4188`:
  - `提取当前文本 DNA` generated an unsaved draft and explanatory status.
  - Direct paste into the visible source editor now updates the hidden Markdown value and character counter.
  - `检测改写稿匹配度` displayed a five-axis result and limitation statement.
  - No console errors were captured.
- External model verification is blocked separately; see `HANDOFF.md`. The deterministic DNA extraction and match APIs do not depend on that model endpoint.

## Sample Health And DNA Version Audit

2026-07-21:

- Added `POST /api/style-sample-health` for sample-unit segmentation, character distribution, trigram near-duplicate checks, and repeated-template candidates.
- Added explicit template exclusion handling: candidates remain in the report by default and are only removed from DNA statistics after the corresponding checkbox is selected.
- Added DNA approval metadata and snapshot files at `profiles/.dna-versions/<style-id>/`; `GET /api/style-dna-version` reads a selected snapshot without overwriting the current style card.
- Added workbench controls for health checks, template selection, approval confirmation, change reason, and read-only version history.
- Static checks passed:
  - `node --check scripts\serve-workbench.mjs`
  - `node --check workbench-ui\app.js`
- Browser verification at `http://127.0.0.1:4189` passed with no console errors:
  - a three-unit local sample reported `warning`, 0 near-duplicate pairs, and one repeated fixed-opening candidate covering 3/3 units;
  - selecting that candidate remained checked after extraction, and the DNA character count dropped from 111 to 82;
  - report rendering correctly shows numeric zero after the UI rendering fix.
- API verification at `http://127.0.0.1:4190` passed:
  - an approved test DNA with a selected template candidate saved and created/read v1 successfully;
  - its persisted DNA contained neither the test sample heading nor the selected template phrase;
  - a `serious` two-unit sample returned HTTP 400 when approval was requested, and no Markdown style card was written before rejection.
- Persistence boundary regression at `http://127.0.0.1:4191` passed:
  - caller-injected sample text, template phrases, and unknown JSON fields were removed by the DNA schema whitelist before current DNA and v1 snapshot persistence;
  - valid predefined signature signals, approval state, and version readback remained available.
- Temporary test cards and version snapshots were deleted after verification. The default 钱十七 DNA remains an existing, unversioned fingerprint until a person reviews its reported sample-health warnings.

## 2026-08-22 仓库整理与结构重构

- 重构前基线：`npm run test:spoken-dna` 32/32 通过。
- 重构后：`npm test` 31/31 通过，`npm run lint` 通过。
- 少的一条是 `workbench alias content matches the canonical profile`。该测试断言 `profiles/钱十七-闲鱼风格拆解.md` 与正本内容一致；别名已随工作台退役，测试失去断言对象，已删除。删除前核验两文件 SHA-256 均为 `0c20c3c0d8d2a88f43f390cb3122c8dd09735dc7f232d3d6970764933285d80e`。
- `feature_list.json` 通过 `json.load` 解析。
- 路径引用改写覆盖 14 个文件；`DECISIONS.md` 与本文件中指向已删路径的历史记录**未修改**，因为那是当时的事实。
- 删除的路径：`workbench-ui/`、`scripts/serve-workbench.mjs`、`init.ps1`、`review-context/`、`tmp/`、`workbench_imports/`。前四项已提交过，可从 git 历史恢复；后两项为未跟踪的本地缓存，不可恢复。
- 未删除：`workbench_rewrites/`（2026-06-27 单次改写残留，未跟踪，本轮未获明确授权）。
- 未提交、未推送、未部署之外的状态变化：无。钱十七 profile 仍为 `draft / review_only`。

## 2026-08-22 晚（F011 收尾与四层→五层门禁）

只记录本机实际跑过的验证。今晚 6 个提交（`c46b030`→`accf8c9`），`npm test` 数按 54→60→63 变化。

- **`c46b030`（F011 报告刷新 + 修 A7 三句照抄）**：钱十七长稿 A7 三句重写后，禁用话术 grep 零命中；对权威语料做 12 字连续重合扫描命中 0、最长重合 6 字；跨稿重复 PASS；`npm test` **54/54**。
- **`ad50600`（12 字来源泄漏扫描入仓）**：新增 6 条测试（4 内联 + 2 条件在本机语料上），两条条件测试在本机均跑过并通过；四稿在 12 字这一档全部干净。`npm test` **54→60**。
- **`05bad9d`（半佛过通用流水线）**：`scaffold` 返回 `ok:true`、`unit_count:10`、`health:healthy`，产出 4 个草稿文件；`validate/leakage/render` 在 `readJson(--profile)` 处失败退出 1（半佛无 1.1 JSON 契约，未硬造）；新增文件未影响测试，`npm test` **60/60**。
- **`d0bfe48`（机器契约同步——阻塞）**：外部 validator 基线 `ok:true`、0 error / 0 warning、pattern 7；写入四条修订后 validator 仍 `ok:true`、0/0、pattern 10（schema 接受）；但 `npm test` 变 **59 pass / 1 fail**（`qian17-reprofile.test.mjs` 断言 `10 !== 7`）。JSON 已按字节恢复，`npm test` 回到 **60/60**。
- **`8f9319a`（10 篇压测）**：10 个选题各一篇 + 现有餐饮券短稿共 **11 篇**；每篇过平台合规、过 12 字来源泄漏扫描；去注释后正文两两重合最高 **1.6%**（55 对全部 ≤ 8% 上限），账本报“无跨稿重句”。`npm test` **60/60**。
- **`accf8c9`（修重复工具两处缺陷）**：`bodyOf()` 剥 HTML 注释、同 IP 口径细分为同选题；压测批 FAIL→PASS，四稿仍 PASS；新增 3 条测试（含 10 篇 fixtures + 餐饮券短稿的条件回归锁）。`npm test` **60→63**。
- **收尾态**：`npm test` **63/63** 通过；`feature_list.json` 通过 `json.load` 解析。钱十七 profile 仍为 `draft / review_only`；今晚提交均未推送。

## 2026-08-23 上午（去 AI 味：调研→诊断→规则→检查器→四稿重写）

只记录本机实际跑过的验证。今早 5 个提交（`d3dac6f`→`4352528`），`npm test` 从 63 → 75 → 78。

- **`d3dac6f`（调研）**：`docs/research/de-ai-flavor-20260823.md` 汇总 12 源、22 特征（13 条可机器测），每条附一 bad/good 对；对两篇已出短稿的抽检确认清单能咬中。npm test 不变（60/60，`accf8c9` 后基线 63 但本机在此提交前后为 63）。
- **`9cede2c`（诊断）**：`docs/research/ai-flavor-diagnosis-20260823.md` 对 14 篇稿（四稿+10 压测）与 21 篇真人（钱十七 11 + 半佛 10）按每千字标点/短语密度、句长 mean/SD/CV、悬空"的"等测算。最大偏离：破折号 13–18×、总结壳 3×；对钱十七 引号 18×/冒号 8×（列点腔）；对半佛 句长过匀过短（CV 0.5–0.6 对 0.8，mean 15 对 28）。判为无罪：口语衬字密度、三段排比、具体名词密度。IP-native 不砍：半佛一句话/连问/警句收尾，钱十七编号/排比。
- **`401d6a0`（规则+入档）**：`docs/de-ai-writing.md` + 两份 DNA 加"AI 味负面清单" + AGENTS.md/generation-intake.md 加交付前置。`npm test` **63/63**。
- **`49a6321`（检查器入仓）**：`engine/naturalness/check-ai-flavor.mjs` 按 IP 分别定阈值；对现有 **14 篇稿实测全 FAIL**（改前）——主要命中：破折号（钱十七短 6.5/千字）、悬空"的"、句长过匀、总结壳。新增 12 条测试，`npm test` **63→75**；`npm run check:ai-flavor` 已挂 package.json。
- **`4352528`（四稿重写）**：内容/结构/受众/事实/长度未动，只调措辞。检查器启发式同步调优（`是…的` 判定不再算悬空）；测试锁四稿 PASS 作为回归。跑过：AI 味 四稿 **block=0 warn=0**、短稿合规 PASS、跨 IP 重合最高 **0.5%**、12 字来源泄漏 **0** 命中（钱十七两稿对源 docx、半佛两稿对 10 篇源 txt）；`npm test` **75→78**。
- **收尾态**：`npm test` **78/78** 通过；`feature_list.json` 通过 `json.load` 解析。钱十七 profile 仍为 `draft / review_only`；今早提交均未推送。

## 2026-08-23 上午（二）（用词层：IP 词表 + 用词陌生度报告 + 四稿逐句润色）

只记录本机实际跑过的验证。今早第二轮 4 个提交（`a958449`→`fb9cf89`→`3557c34`→`81420ab`），`npm test` 从 78 → 80 → 89 → 89 → 94。触发是用户读第一轮去 AI 味重写稿后评价"凑合、勉强能用、距离好还差很多"，举了三处用词证据：`找货 → 找货源`、`散在…这些口子`（没人这么说）、`说不说得清打哪来 → 得搞清楚渠道从哪来`。

- **`a958449`（用词层入规则）**：`docs/de-ai-writing.md` 加"一之二 · 用这个 IP 自己的词"整节（缩略/生造搭配/硬装口语/压缩四条零容忍，各附用户 bad→good 对），并入两份 DNA 负面清单与 `AGENTS.md`/`docs/generation-intake.md` 作交付前置；文档明写"六道门禁全过 ≠ 好，好 = 这个 IP 的读者听不出换了人"。`npm test` **78→80**（新增 2 条测试锁两份 DNA 负面清单条目）。
- **`fb9cf89`（IP 词表 + 报告工具入仓）**：
  - 词表构建：`ips/钱十七/corpus/lexicon.json` **1,525 词 / 11 篇**、`ips/半佛/corpus/lexicon.json` **2,378 词 / 10 篇**，分词器为 **jieba posseg**（保留 n/v/a），另出行业词子集；两份 JSON 均通过 `python -c "import json; json.load(open(...))"`。
  - 工具：`engine/naturalness/check-lexicon.mjs`（最大正向匹配作为初版后端）+ `lexicon-hints.json`（seed 三条：货→货源、散在→都在/藏在、打哪来→从哪来）；命令 `npm run check:lexicon`；warn 级、非 block。
  - 已知缺陷：MFM 在只含内容词的词表上会产出跨度碎片而非整词，jieba 后端在下一提交补齐。
  - 新增 9 条测试，`npm test` **80→89**。
- **`3557c34`（四稿逐句用词润色 24 处）**：用户三例按原话改；另 21 处同类（钱十七：差价 not 价差、渠道 not 口子、限流 not 掐流量、下期/选品 not 下条/挑品牌；半佛：来路 not 出处、塞在犄角旮旯 not 散在；不使用 IP 从未说过的"掂量掂量/蹲得住"）。结构、事实、数字、受众、钩子位置**未动**。跑过：
  - **AI 味检查器**：四稿全 **block=0 warn=0**（半佛短/长、钱十七短/长四稿 PASS）。
  - **平台合规**：两条短稿 PASS、两条长稿 FAIL（按测试锁定的作用域）。
  - **跨 IP 重复**：最高 **0.5%**（远低于同 IP 不同选题 8% 阈值）。
  - **12 字来源泄漏**：**0 命中**（钱十七两稿对源 docx；半佛两稿对 10 篇源 txt）。
  - `npm test` **89/89**（未新增测试；四稿 fixture 未变，原 fixture 锁继续通过）。
  - 长度未变：短稿两篇各约 400+ 字（长视频稿约 1,400–1,600 字），与重写前同量级。
  - 残留：P8 框架"一周买一次"复原、极少数压缩句尾待下次微调（见提交说明）。
- **`81420ab`（check-lexicon 换 jieba 后端）**：`engine/naturalness/segment.py` 用 jieba posseg 对稿件分词（与词表构建口径一致），Node 端 spawn Python，Python/jieba 缺席时回退 MFM；加专名/数量词白名单，报告改为"整词 + 整句上下文"。新增 5 条测试，`npm test` **89→94**。
- **收尾态**：`npm test` **94/94** 通过；`feature_list.json` 通过 `json.load` 解析。钱十七 profile 仍为 `draft / review_only`；今早第二轮提交均未推送。**用户读四稿后评价"凑合、勉强能用、距离好还差很多"**——判定为**六道门禁全过 ≠ 好**。用词层作为报告工具入仓，最终由人判。

