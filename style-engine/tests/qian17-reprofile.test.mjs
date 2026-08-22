import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "evaluation", "spoken-style-profiler-qian17");
const readJson = (name) => JSON.parse(readFileSync(join(root, name), "utf8"));

const manifest = readJson("corpus-manifest.json");
const health = readJson("sample-health.json");
const decisions = readJson("sample-decisions.draft.json");
const annotations = readJson("annotations.draft.json");
const profile = readJson("style-dna.draft.json");
const canonical = readFileSync(join(root, "钱十七-DNA-重构版.md"), "utf8");

test("Qian17 complete corpus is closed over 11 units and 10 independent clusters", () => {
  assert.equal(manifest.corpus_id, "qian17-spoken-v2");
  assert.equal(manifest.unit_count, 11);
  assert.equal(health.unit_count, 11);
  assert.equal(profile.corpus.raw_unit_count, 11);
  assert.equal(profile.corpus.independent_cluster_count, 10);

  const manifestIds = manifest.units.map((unit) => unit.id);
  assert.deepEqual(profile.corpus.included_unit_ids, manifestIds);
  assert.deepEqual(annotations.units.map((unit) => unit.unit_id), manifestIds);
  assert.equal(profile.corpus.independence_clusters.length, 10);
});

test("the only duplicate vote is the user-reviewed u03/u07 transcript variant", () => {
  assert.equal(health.near_duplicate_pairs.length, 1);
  assert.deepEqual(health.near_duplicate_pairs[0], {
    left_unit_id: "qian17-spoken-v2:u03",
    right_unit_id: "qian17-spoken-v2:u07",
    similarity: 0.871
  });
  assert.equal(decisions.duplicate_decisions.length, 1);
  assert.equal(decisions.duplicate_decisions[0].decision, "merge_as_variant");
  assert.deepEqual(decisions.duplicate_decisions[0].unit_ids, [
    "qian17-spoken-v2:u03",
    "qian17-spoken-v2:u07"
  ]);
});

test("candidate framework library has two complete independent paths per framework", () => {
  assert.deepEqual(profile.frameworks.map((item) => item.id), [
    "fw-project-breakdown",
    "fw-screening-tutorial",
    "fw-resource-directory"
  ]);

  for (const framework of profile.frameworks) {
    assert.equal(framework.status, "candidate");
    assert.equal(framework.availability, "profile_approval_required");
    assert.ok(framework.evidence_paths.length >= 2);
    assert.equal(new Set(framework.evidence_paths.map((path) => path.independence_cluster_id)).size, framework.evidence_paths.length);

    const expectedBeatIds = framework.beats.map((beat) => beat.id);
    const expectedBeatRoles = framework.beats.map((beat) => beat.role);
    for (const evidencePath of framework.evidence_paths) {
      assert.deepEqual(evidencePath.beats.map((beat) => beat.beat_id), expectedBeatIds);
      assert.deepEqual(evidencePath.beats.map((beat) => beat.ordinal), expectedBeatIds.map((_, index) => index + 1));

      const annotationUnit = annotations.units.find((unit) => unit.unit_id === evidencePath.unit_id);
      const evidenceAnchors = evidencePath.beats.map((beatEvidence) => annotationUnit.anchors.find((anchor) => anchor.anchor_id === beatEvidence.anchor_id));
      const positions = evidenceAnchors.map((anchor) => anchor?.relative_position);
      assert.equal(positions.every((position) => Number.isFinite(position)), true);
      assert.deepEqual([...positions].sort((left, right) => left - right), positions);
      assert.deepEqual(evidenceAnchors.map((anchor) => anchor.function), expectedBeatRoles);
    }
  }
});

test("auxiliary controls remain review-only and bounded", () => {
  assert.equal(profile.patterns.length, 7);
  for (const pattern of profile.patterns) {
    assert.equal(pattern.status, "observation");
    assert.equal(pattern.availability, "review_only");
    assert.equal(pattern.application_control.min_per_script, 0);
    assert.equal(pattern.application_control.max_per_script, pattern.id === "pt-stage-value-reset" ? 2 : 1);
    assert.equal(pattern.application_control.avoid_adjacent_repeat, true);
  }

  const lowBarrier = profile.patterns.find((pattern) => pattern.id === "pt-low-barrier-triad");
  assert.equal(lowBarrier.evidence.length, 1);
  assert.equal(lowBarrier.risk.includes("不增加独立证据票"), true);

  const baselinePlan = { framework_id: profile.frameworks[0].id, pattern_ids: [] };
  const enhancedPlan = { framework_id: baselinePlan.framework_id, pattern_ids: profile.patterns.slice(0, 2).map((item) => item.id) };
  assert.equal(baselinePlan.framework_id, enhancedPlan.framework_id);
  assert.equal(baselinePlan.pattern_ids.length, 0);
  assert.ok(enhancedPlan.pattern_ids.length <= 2);
});

test("canonical profile contains no facts leaked from prior target drafts", () => {
  const machine = JSON.stringify(profile);
  for (const forbidden of ["手机数据恢复", "探店博主", "圣矾", "网盘拉新", "6143.54", "89673", "269单"]) {
    assert.equal(canonical.includes(forbidden), false, forbidden);
    assert.equal(machine.includes(forbidden), false, forbidden);
  }
});

test("workbench alias content matches the canonical profile", () => {
  const alias = readFileSync(join(root, "..", "..", "..", "profiles", "钱十七-闲鱼风格拆解.md"), "utf8");
  assert.equal(alias, canonical);
});
