# GitHub Style Tooling Research

Date: 2026-07-21

## Question

Can an existing GitHub project be used directly for this project's first flow: deconstruct 钱十七-style Xianyu short-video copy and later imitate the style using user-provided Feishu copy/materials?

## Checked Candidates

### StyleLLM

URL: https://github.com/stylellm/stylellm_models

What it is: a text style transfer project using fine-tuned large language models trained on classical Chinese novels.

Useful idea: style transfer can be treated as a separable layer from base content.

Why not adopt for V1:

- It targets literary styles, not commercial short-video口播.
- It requires model-level infrastructure and is heavier than the current need.
- It does not solve the key project boundary: separating style from source facts, risky claims, and CTA ownership.

### InkOS

URL: https://github.com/Narcooo/inkos

What it is: a story-creation AI agent system with long-form writing, state management, auditing, and style analysis/import commands.

Useful idea: persistent project state, author intent, current focus, audit/revise loops, and style fingerprints are worth borrowing later.

Why not adopt for V1:

- It is optimized for novels, scripts, fanfic, and interactive worlds, not short-video commercial copy.
- It is a full TypeScript agent system with AGPL-3.0 licensing implications.
- It would expand scope before the first style-card flow is proven.

### Local Copy Style Deconstructor

Path: `D:\文案仿写\copy-style-deconstructor`

What it is: a local, previously built style-deconstruction Skill/workflow.

Useful idea: this is the closest fit. It explicitly separates style from facts and uses a style-card schema.

Decision:

Use the local style-card framework as the V1 structure, but keep this project self-contained by writing the active style card into `profiles/`.

## Current Decision

Do not install or vendor an external GitHub repo for V1.

Use a Markdown-first style-card workflow:

```text
sample copy -> source inventory -> style card -> risk boundary -> future imitation checklist
```

Only revisit external tooling if a concrete missing capability appears, such as batch scoring many style samples, automated Feishu material extraction, or measurable style-similarity checks.

## 2026-07-21 Expansion: Style DNA Research

The following repositories were read as source evidence. No source code, model weight, or source corpus is vendored into this project.

| Repository | Useful mechanism | Decision |
| --- | --- | --- |
| [larashero3-dotcom/writing-dna-skill](https://github.com/larashero3-dotcom/writing-dna-skill) | Six layers: language, structure, topic/angle, material strategy, cognition, visual presentation; corpus confidence expectations. | Adapt the taxonomy to short-video口播 and record a sample-confidence grade. |
| [shannhk/writing-style-extractor](https://github.com/shannhk/writing-style-extractor) | Structured profile + readable report, evidence-backed findings, replication blueprint and confidence per finding. | Adopt a local JSON DNA contract and actionable replication rules; omit source quotations and facts. |
| [lifeiscabaret/writing-dna-studio](https://github.com/lifeiscabaret/writing-dna-studio) | Offline measurable axes and re-fingerprint style-match scoring after rewrite. | Adapt five axes for Chinese口播: 口播感、能量、直接性、证据密度、转化力度. Implement as explainable local heuristics. |
| [stylellm/stylellm_models](https://github.com/stylellm/stylellm_models) | Treat style transfer as a separable transformation layer. | Keep the separation principle; do not add a fine-tuned literary model because it does not fit commercial口播 or the current hardware/scope. |
| [Narcooo/inkos](https://github.com/Narcooo/inkos) | Generate → audit → targeted revision, explicit rule stacks. | Borrow only the post-generation audit concept. Do not vendor or depend on the AGPL-3.0 project. |
| [unixpickle/textprint](https://github.com/unixpickle/textprint) | Author fingerprint vectors and attribution-oriented sample discipline. | Treat vector/author-identification work as out of scope; this project is for controllable style transfer, not author attribution. |

### Adoption Decision

Add a project-owned Style DNA layer on top of Markdown style cards:

```text
reference samples
-> deterministic Style DNA extraction
-> editable Markdown style card + optional JSON fingerprint
-> fact/risk boundary
-> rewrite
-> style-match score + existing risk/material/meta-reference gates
```

This is a method-level adaptation, not a direct derivative of any external repository. It remains Markdown-first, local, and compatible with existing style cards.

## 2026-07-21 Second Expansion: From Fingerprint to a Complete Imitation Workflow

The first expansion was too narrow: it focused on extracting and scoring a fingerprint. A second GitHub scan covered style-workflow, controlled-transfer, evaluation, prompt-asset, and marketing-copy repositories. The goal is not to install them, but to close the gaps between “a score exists” and “a draft is safely publishable.”

### Read Candidates

| Repository | What was verified from its README | Mechanism worth adapting | Project decision |
| --- | --- | --- | --- |
| [dvdxfv/skill-writing-dna](https://github.com/dvdxfv/skill-writing-dna) | Three human confirmation gates; sample health checks; repeated-template stripping; DNA version history; rewrite comparison report and unapplied-rule reporting. | Treat corpus cleaning, user confirmation, DNA versions, and rewrite evidence as first-class workflow stages. | High-priority method source. Adapt the workflow and reports; do not vendor its code. |
| [amathur2k/WritingStyleExtractor](https://github.com/amathur2k/WritingStyleExtractor) | Multi-format intake, context-preserving chunking, iterative refinement until a style profile converges. | A long reference corpus must be chunked and merged deliberately, rather than treated as one undifferentiated document. | Adopt a chunk/merge contract when multi-file or long-document intake is added. |
| [PrithivirajDamodaran/Styleformer](https://github.com/PrithivirajDamodaran/Styleformer) | Fine-grained controllable transfer such as formal/casual and active/passive; quality filter and candidate count knobs. | “Style” needs independent, adjustable dimensions instead of one all-or-nothing rewrite switch. | Adopt explicit rewrite intensity and dimension controls; do not add its English-only pretrained models. |
| [SALT-NLP/FormalityStyleTransfer](https://github.com/SALT-NLP/FormalityStyleTransfer) | Formality transfer is evaluated as a distinct task with generated outputs and scores. | A style transformation must be evaluated separately from content preservation. | Add content/claim preservation checks beside style match; do not adopt its Fairseq training stack. |
| [IBM/eval-assist](https://github.com/IBM/eval-assist) | Model-agnostic LLM-as-a-judge framework supporting rubric-based and pairwise evaluation, saved test cases, and bulk evaluation. | A style rubric should support both absolute gates and A/B comparisons, with reusable evaluation cases. | Adopt a local rubric contract and side-by-side candidate review; use LLM judging only as optional assistance, never as sole approval. |
| [linshenkx/prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) | Prompt assets with source binding, variables, version history, testing, single-result evaluation, and compare evaluation. The repository is AGPL-3.0. | Treat rewrite instructions as versioned assets tested against fixed factual cases. | Borrow the product concept only; do not import or depend on AGPL code. |
| [maitrix-org/PromptAgent](https://github.com/maitrix-org/PromptAgent) | Error feedback and reward-guided prompt refinement against a held-out test set. | Improve the project prompt from observed failure categories, not from intuition alone. | Add a small curated regression set and change prompts only when it improves the approved cases without opening a safety regression. |
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | A shared product-marketing context is read before specialized copywriting, editing, social, video, CRO, and testing workflows. | A style engine must know the user-owned offer, audience, channel, CTA, and proof before it can safely borrow an expression pattern. | Add a project-owned “content brief” contract as the shared input for every rewrite and evaluator. Do not install the full skill collection. |
| [ssharpe42/AuthorStyle](https://github.com/ssharpe42/AuthorStyle) | Stylometry and authorship-attribution feature pipelines. | Corpus-level stability is useful as a diagnostic concept. | Explicitly exclude author identification or “prove this was written by X”; the project serves controllable writing, not attribution. |

### Broader Scan Result

Search families included `writing DNA`, language style transfer, copywriting agents, LLM-as-a-judge evaluation, stylometry/authorship, and prompt optimization. The serious candidates above were selected because their mechanisms address a concrete project gap. Repositories that only rename a short prompt or target fiction, English-only transfer models, model training, or author attribution are not V1 dependencies.

### Upgraded Product Model

```text
reference corpus
-> sample-health / repeated-template review
-> approved, versioned Style DNA
-> user-owned content brief (facts, evidence, audience, CTA, risk boundary)
-> controlled rewrite (scene + intensity + dimensions)
-> independent checks: fact/claim preservation, risk gates, meta-reference gate, style match
-> candidate comparison + human approval
-> approved cases feed a regression set for prompt and rule changes
```

### Proposed Adoption Order

1. **Sample hygiene and review gates**: detect repeated boilerplate, near-duplicate samples, short/over-dominant samples, and require a visible “keep/remove” decision before a profile is marked stable.
2. **Versioned style cards**: persist an approved DNA version, its corpus-health report, changes, and the reason for each edit; allow read-only comparison with the prior version.
3. **Controlled rewrites**: add channel, intensity, and independently adjustable dimensions. “Style match” remains advisory; user facts and risk rules always outrank it.
4. **Rewrite quality report**: report fact/claim coverage, forbidden meta references, risk terms needing review, style-dimension deltas, and unapplied rules. A good style score cannot mask missing facts.
5. **Candidate bench and regression cases**: generate or compare labeled variants only when the model provider is healthy; save user-approved factual cases as a fixed test set before modifying prompts/rules.

### Boundaries Retained

- No third-party repository code, weights, training corpus, or license obligations are introduced by this research.
- No author identification, imitation claim, or source-fact reuse is added.
- Model-based judging is optional assistance. A user-facing approval and deterministic fact/risk gates remain necessary.
