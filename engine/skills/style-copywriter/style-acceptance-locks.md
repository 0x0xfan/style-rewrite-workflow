# Human Style Acceptance Locks

Use this contract when the user has already approved or rejected concrete expressions, or when a structural rewrite could regress a previously calibrated voice.

## Required separation

- Keep project-specific phrases in a task-local `style-acceptance-locks.json`; never copy them into the generic Skill or Style DNA.
- Bind the lock file to the original human-calibration artifact by SHA-256.
- Bind both Task Brief and generation metadata to the lock file SHA-256 and `lock_id`.
- Treat technical validation, style-control placement and user acceptance as separate states.

## Lock schema

```json
{
  "schema_version": "1.0",
  "lock_id": "task-style-lock",
  "calibration_source": {"path": "human-calibration.md", "sha256": "..."},
  "preserve_exact": [{"id": "approved-hook", "text": "用户已通过的原句"}],
  "preserve_semantic": [{"id": "approved-relation", "all_of": ["主体", "关系"]}],
  "rejected_exact": [{"id": "rejected-shell", "text": "用户已拒绝的表达"}],
  "forbidden_patterns": [
    {"id": "repeated-shell", "pattern": "...", "flags": "u", "max_occurrences": 0}
  ],
  "hook_duties": [
    {
      "id": "major-beat-hook",
      "hook_excerpt": "正文里的钩子片段",
      "delivery_excerpt": "紧接着兑现的内容片段",
      "max_paragraph_gap": 1,
      "evidence_ids": ["target-owned-evidence"]
    }
  ]
}
```

## Hook-duty rule

A hook is not merely a question or transition. It must use target-owned facts to raise the value of the next major beat and then deliver the promised fact, action, benefit or boundary within the configured paragraph gap. Do not set a universal hook count; declare duties only for the current task's major beats. Small dependent actions may proceed directly.

## Structural rewrite rule

Any change to the framework, major-section order, content allocation or hook chain invalidates prior style validation. Reset `validation_status` and `style_acceptance_status`, create a fresh Baseline and Enhanced output, bind both SHA-256 values in `comparison_audit`, and keep final acceptance at `pending_user_review`.

The machine gate may prove that locks, hook delivery and comparison artifacts are present. It cannot prove that the Enhanced output sounds natural or matches the reference IP; the user remains the final reviewer.
