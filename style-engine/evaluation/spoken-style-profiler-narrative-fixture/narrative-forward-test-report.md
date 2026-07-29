# Narrative forward test report

## Scope

- Source analysed: `source.md` only; it was read but not modified.
- Output profile: a fictional narrative spoken-word IP, kept in `draft` and pending human confirmation.
- Explicitly excluded: project, tutorial, data, earnings, platform-operation, and CTA slots.
- The profile uses one permitted two-beat narrative framework; no approval was created.

## Commands and results

1. `node C:\Users\admin\.codex\skills\spoken-style-profiler\scripts\spoken-style-tool.mjs scaffold --source ...\source.md --corpus-id narrative-fixture-v1 --out ...\spoken-style-profiler-narrative-fixture`
   - Exit: 0
   - Result: 3 H2 units; generated manifest, health report, sample-decision draft, and annotation skeleton.
   - Health: `warning`; the third unit was flagged as short.

2. `node ...\spoken-style-tool.mjs validate --profile ...\style-dna.draft.json --manifest ...\corpus-manifest.json --health ...\sample-health.json --decisions ...\sample-decisions.draft.json --annotations ...\annotations.draft.json`
   - Exit: 0
   - Result: `ok: true`; 0 errors and 0 validator warnings.
   - Summary: 1 content type, 1 framework, and 4 patterns. The profile status remained `draft`.

3. `node ...\spoken-style-tool.mjs leakage --source ...\source.md --profile ...\style-dna.draft.json`
   - Exit: 0
   - Result: `ok: true`; 0 deterministic source-leakage matches.
   - Scope note: the scanner cannot prove that a semantic paraphrase contains no source fact; the manual source-boundary review remains open.

4. `node ...\spoken-style-tool.mjs render --profile ...\style-dna.draft.json --manifest ...\corpus-manifest.json --health ...\sample-health.json --decisions ...\sample-decisions.draft.json --annotations ...\annotations.draft.json --out ...\Style-DNA.draft.md`
   - Exit: 0
   - Result: `ok: true`; rendered `Style-DNA.draft.md`.

## Artifacts

- `corpus-manifest.json`: private source locations and three H2 units, with no transcript text.
- `sample-health.json`: tool-generated health warning and no duplicate/opening candidate.
- `sample-decisions.draft.json`: no tool-identified sample decision is resolved or falsely human-signed.
- `annotations.draft.json`: semantic anchors and evidence relations, without copied source sentences.
- `style-dna.draft.json`: candidate content type, two-beat framework, three candidate expression relations, and one non-selectable rhythm observation.
- `review-checklist.md`: remaining manual confirmation gate.

## Adversarial checks

- Candidate support is based on three distinct, one-unit independence clusters. Validate cross-checked every candidate evidence ID and both required framework beats against the annotations and manifest.
- The source-leakage scan found zero exact long-fragment, title, or sensitive-short-fragment matches. This does not replace manual semantic source-boundary review.
- A separate artifact assertion passed: `status=draft`, `requires_human_approval=true`, one framework has exactly two beats, `required_content_fields=[]`, no CTA pattern exists, and all 3 units have anchors.
- The profile remains non-selectable: candidates are `profile_approval_required`; the only rhythm claim is `observation/review_only` because no audio was available.

## Limitations and manual gate

- Only three independent units are present; all are in the same broad everyday-reflection mode.
- No holdout sample exists because all three units support the candidate rules.
- One unit is short according to the health report and cannot alone justify a candidate.
- Audio performance cannot be inferred from written punctuation; rhythm remains review-only.
- This report and every profile artifact remain `draft`. No user approval, approval record, selectable rule, or approved profile was produced.

## V1.1 draft generation suite（2026-07-22）

- `generation-test.draft.json` binds three cases to real artifacts and SHA-256 digests: `positive-convenience` selects `everyday-reflective-narrative` and `scene-to-reflection-two-beat`; `fallback-no-reflection` selects the same framework with fallback beat `b02`; `excluded-tutorial` abstains because its step signal excludes the narrative type/framework.
- Positive and fallback content contracts enumerate exactly the four `rewrite_interface.immutable_relations`; their output audits repeat the same relation values. The positive audit binds three measured spans within the 115-character output (entry `0–9`, body `29–55`, close `98–114`). The fallback audit binds two measured spans within the 66-character output (entry `0–9`, body `24–48`).
- `avoid-grandiose-self-congratulation` is checked only where its reflection trigger is present, with an empty violation list in a draft audit. The audit has no reviewer and explicitly does not claim a human fact, style-similarity, leakage, or overfit decision.
- `validate-generation-test` with manifest, health, decisions, annotations and `source.md` returned `ok: true`, 3 cases, 0 errors. It emitted the expected single warning that a draft suite has not been human reviewed. Full `validate --generation-test --reference-source`, `leakage --annotations`, and `render --force` also returned `ok: true`; deterministic leakage found 0 matches.
- The suite is `evaluation_only` and remains `draft`; it does not approve the profile or make candidates selectable. The two generated artifacts are isolated evaluation outputs, not audience-facing delivery.
