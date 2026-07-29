# GPT Pro Review Context

This directory is a private, review-only context package for the 2026-07-29 imitation-quality repair.

- It is not a runtime source of truth.
- Files under `external-skills/` are snapshots of the local canonical personal Skills at dispatch time; edits must be returned as a patch against their named source paths and independently integrated by Codex.
- Files under `user-feedback-case/` are selected text/JSON evidence for the user-rejected imitation output. Screenshots, Word documents, credentials and browser/runtime state are intentionally excluded.
- `CHATGPT_PRO_TASK.md` is the authoritative task contract for the external reviewer.
- Every profile remains draft/review-only unless the existing approval gates are satisfied. This review context grants no approval.

Baseline repository commit before adding this context: `c85a9a19e34a968231d75342d33eb1e2b49bde9a`.
