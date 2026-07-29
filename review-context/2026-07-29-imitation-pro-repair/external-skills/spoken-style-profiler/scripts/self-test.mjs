#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  approvedControlStateSha256,
  assessHealth,
  buildScaffold,
  evidenceBundleSha256,
  generationOutputSetSha256,
  generationTestSha256,
  makeTemporaryDirectoryForTests,
  profileCandidateSha256,
  readCorpus,
  renderProfileMarkdown,
  resolveFrameworkSelection,
  scanLeakage,
  validateGenerationTest,
  validateProfile,
} from "./spoken-style-tool.mjs";

const evidence = (unitId, clusterId, anchorId, position) => ({
  unit_id: unitId,
  independence_cluster_id: clusterId,
  anchor_id: anchorId,
  position,
  function: "验证结构关系",
});
const annotationAnchor = (unitId, anchorId, relativePosition) => ({
  anchor_id: anchorId,
  unit_id: unitId,
  relative_position: relativePosition,
  function: "test_function",
  relations: ["test_relation"],
  audience_effect: "increase_clarity",
  information_role: "method_step",
  annotation_confidence: "high",
});

const baseProfile = () => ({
  schema_version: "1.1-draft",
  profile_id: "fixture-ip",
  display_name: "Fixture IP",
  domain: "zh-short-video-spoken",
  status: "draft",
  approval: {
    state: "draft",
    requires_human_approval: true,
    approved_by: null,
    approved_at: null,
    change_reason: null,
    record_id: null,
    generation_test_id: null,
    candidate_profile_sha256: null,
    approved_control_state_sha256: null,
    evidence_bundle_sha256: null,
    generation_test_sha256: null,
    generation_output_set_sha256: null,
  },
  corpus: {
    corpus_id: "fixture-v1",
    raw_unit_count: 3,
    independent_cluster_count: 3,
    independence_clusters: [
      { id: "c01", unit_ids: ["fixture-v1:u01"] },
      { id: "c02", unit_ids: ["fixture-v1:u02"] },
      { id: "c03", unit_ids: ["fixture-v1:u03"] },
    ],
    included_unit_ids: ["fixture-v1:u01", "fixture-v1:u02", "fixture-v1:u03"],
    excluded_unit_ids: [],
    unresolved_decisions: [],
  },
  selector_signals: [
    { id: "content.has_steps", source_path: "steps", operator: "nonempty_array", description: "目标内容包含步骤" },
    { id: "content.is_personal_story", source_path: "primary_value", operator: "equals", value: "personal_story", description: "主要价值是个人故事" },
    { id: "content.has_cta", source_path: "cta", operator: "exists", description: "目标内容包含 CTA" },
  ],
  communication_persona: [],
  content_strategy: [],
  content_types: [{
    id: "tutorial",
    name: "教程",
    status: "candidate",
    availability: "profile_approval_required",
    definition: "解释一个可执行方法",
    generation_goal: "把目标内容已有步骤组织成可执行说明",
    selector: { requires_all: ["content.has_steps"], prefers_any: ["content.has_cta"], excludes_any: ["content.is_personal_story"], abstain_when: ["步骤为空"], priority: 60 },
    evidence: [
      evidence("fixture-v1:u01", "c01", "u01:p01", 0.1),
      evidence("fixture-v1:u02", "c02", "u02:p01", 0.1),
    ],
  }],
  frameworks: [{
    id: "tutorial-path",
    name: "教程路径",
    content_type_id: "tutorial",
    status: "candidate",
    availability: "profile_approval_required",
    when_to_use: "目标内容包含明确步骤",
    do_not_use: "没有可执行步骤",
    selector: { requires_all: ["content.has_steps"], prefers_any: ["content.has_cta"], excludes_any: ["content.is_personal_story"], abstain_when: ["步骤意义无法锁定"], priority: 60 },
    beats: [
      { id: "b01", role: "hook", required: true, purpose: "给出停留理由", input_slots: ["content.core_claim"], transformation_rule: "前置已有主张", generation_instruction: "把目标内容已有主张前置，不新增结果", audience_effect: "establish_relevance", preserve: ["claim.meaning"], fallback: "使用已有痛点" },
      { id: "b02", role: "method", required: true, purpose: "展开方法", input_slots: ["steps"], transformation_rule: "重排表达不改步骤含义", generation_instruction: "按目标步骤顺序解释，不补来源步骤", audience_effect: "increase_clarity", preserve: ["step.meaning"], fallback: "缺少步骤则不使用" },
      { id: "b03", role: "close", required: true, purpose: "完成收束", input_slots: ["cta"], transformation_rule: "只学习动作形态", generation_instruction: "仅使用目标 CTA；缺少时自然总结", audience_effect: "prompt_action", preserve: ["cta.channel", "cta.keyword"], fallback: "没有 CTA 则自然总结" },
    ],
    evidence_paths: [
      { unit_id: "fixture-v1:u01", independence_cluster_id: "c01", beats: [{ beat_id: "b01", anchor_id: "u01:p01", ordinal: 1 }, { beat_id: "b02", anchor_id: "u01:p02", ordinal: 2 }, { beat_id: "b03", anchor_id: "u01:p03", ordinal: 3 }] },
      { unit_id: "fixture-v1:u02", independence_cluster_id: "c02", beats: [{ beat_id: "b01", anchor_id: "u02:p01", ordinal: 1 }, { beat_id: "b02", anchor_id: "u02:p02", ordinal: 2 }, { beat_id: "b03", anchor_id: "u02:p03", ordinal: 3 }] },
    ],
  }],
  attention_rhythm: { basis: "unknown", stages: [] },
  patterns: [{
    id: "contrast",
    category: "sentence",
    name: "认知转折",
    status: "candidate",
    availability: "profile_approval_required",
    formula: "常见认知 → 转折 → 真正关键",
    applicability: "纠正常见误区",
    non_applicability: "没有真实误区",
    generation_instruction: "仅在目标内容存在真实误区时，先陈述误区再转向关键点",
    application_control: { positions: ["entry", "body"], min_per_script: 0, max_per_script: 1, avoid_adjacent_repeat: true },
    avoid_when: ["content.is_personal_story"],
    input_slots: ["claims.common_belief", "claims.key_point"],
    preserve: ["claim.meaning"],
    risk: "low",
    evidence: [
      evidence("fixture-v1:u01", "c01", "u01:p01:s02", 0.12),
      evidence("fixture-v1:u02", "c02", "u02:p01:s03", 0.15),
    ],
  }],
  avoid_patterns: [],
  boundaries: ["不保存来源事实。", "下游只使用目标内容事实。"],
  rewrite_interface: {
    required_content_fields: ["project", "audience", "claims", "steps", "data", "evidence", "risks", "cta"],
    immutable_relations: ["data.value+unit+subject+time_window+conditions"],
    observations_selectable: false,
    prohibited_audience_meta_phrases: ["原稿里", "原文里", "文案里", "飞书里", "资料里", "材料中", "根据你提供的", "下面这版"],
  },
  generation_interface: {
    forward_test_required_before_approval: true,
    selector_abstention_required: true,
    fact_lock_source: "external_content_contract_and_output_audit",
    conflict_policy: "fail_closed",
    control_precedence: ["boundaries_and_content_locks", "selector_abstention", "avoid_patterns", "framework", "communication_persona_and_content_strategy", "attention_rhythm", "patterns"],
    required_checks: ["selector_resolution_bound", "content_lock_audit_matches", "output_artifact_bound", "pattern_span_audit_passed", "avoidance_span_audit_passed", "audience_meta_absent", "reference_leakage_scan_passed", "no_new_facts_human_confirmed", "no_style_source_facts_human_confirmed", "human_style_similarity_accepted", "overfit_absent_human_confirmed"],
  },
  limitations: [],
});

const baseEvidenceBundle = () => ({
  manifest: {
    corpus_id: "fixture-v1",
    unit_count: 3,
    units: ["fixture-v1:u01", "fixture-v1:u02", "fixture-v1:u03"].map((id) => ({ id })),
  },
  health: {
    suggested_duplicate_clusters: [],
    repeated_opening_groups: [],
  },
  decisions: {
    corpus_id: "fixture-v1",
    state: "draft",
    duplicate_decisions: [],
    repeated_opening_decisions: [],
    excluded_unit_ids: [],
    approved_by: null,
    approved_at: null,
  },
  annotations: {
    corpus_id: "fixture-v1",
    state: "draft",
    units: [
      { unit_id: "fixture-v1:u01", independence_cluster_id: "c01", include_in_fusion: true, anchors: ["u01:p01", "u01:p01:s02", "u01:p02", "u01:p03"].map((anchor_id, index) => annotationAnchor("fixture-v1:u01", anchor_id, 0.1 + index * 0.2)) },
      { unit_id: "fixture-v1:u02", independence_cluster_id: "c02", include_in_fusion: true, anchors: ["u02:p01", "u02:p01:s03", "u02:p02", "u02:p03"].map((anchor_id, index) => annotationAnchor("fixture-v1:u02", anchor_id, 0.1 + index * 0.2)) },
      { unit_id: "fixture-v1:u03", independence_cluster_id: "c03", include_in_fusion: true, anchors: [] },
    ],
  },
});

const validateFixture = (profile, options = {}) => validateProfile(profile, {
  evidenceBundle: baseEvidenceBundle(),
  ...options,
});

const sha256File = (filePath) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
const writeJson = (filePath, value) => fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

const buildGenerationSuiteFixture = (profile, { reviewed = false } = {}) => {
  const temp = makeTemporaryDirectoryForTests();
  const referenceSource = path.join(temp, "reference.md");
  fs.writeFileSync(referenceSource, "## 参考风格样本\n\n这里是一段完全不同的抽象风格参考，不包含生成夹具事实。", "utf8");
  const referenceCorpus = readCorpus(referenceSource, { corpusId: "fixture-reference" });
  const cases = [];
  const humanReviews = [];
  const immutableValues = () => profile.rewrite_interface.immutable_relations.map((relation) => ({ relation, value: { locked: relation } }));

  const addCase = ({ caseId, caseType, content, targetFrameworkId = null, fallbackBeatIds = [], outputText = null }) => {
    const caseDir = path.join(temp, caseId);
    fs.mkdirSync(caseDir, { recursive: true });
    const inputPath = path.join(caseDir, "input.md");
    fs.writeFileSync(inputPath, `fixture input ${caseId}\n${JSON.stringify(content)}`, "utf8");
    const contractPath = path.join(caseDir, "content-contract.json");
    const contract = { schema_version: "1.0", contract_id: `${caseId}-contract`, case_id: caseId, input_sha256: sha256File(inputPath), content, immutable_values: immutableValues() };
    writeJson(contractPath, contract);
    const selection = resolveFrameworkSelection(profile, content);
    const artifacts = {
      input_path: path.relative(temp, inputPath).replace(/\\/g, "/"),
      input_sha256: sha256File(inputPath),
      content_contract_path: path.relative(temp, contractPath).replace(/\\/g, "/"),
      content_contract_sha256: sha256File(contractPath),
      output_path: null,
      output_sha256: null,
      output_audit_path: null,
      output_audit_sha256: null,
    };
    if (outputText !== null) {
      const outputPath = path.join(caseDir, "output.md");
      fs.writeFileSync(outputPath, outputText, "utf8");
      const auditPath = path.join(caseDir, "output-audit.json");
      const eligibleAvoid = (profile.avoid_patterns || []).filter((item) => profile.status === "approved" ? item.status === "approved" : ["candidate", "approved"].includes(item.status));
      const audit = {
        schema_version: reviewed ? "1.0-reviewed" : "1.0-draft",
        case_id: caseId,
        output_sha256: sha256File(outputPath),
        relation_observations: immutableValues(),
        pattern_applications: [{ pattern_id: "contrast", start: 0, end: Math.min(4, outputText.length) }],
        avoidance_findings: eligibleAvoid.map((item) => ({ avoid_pattern_id: item.id, violations: [] })),
        new_fact_findings: [],
        style_source_fact_findings: [],
        reviewer_type: reviewed ? "human" : null,
        reviewer: reviewed ? "Human Reviewer" : null,
        reviewed_at: reviewed ? "2026-07-22T05:00:00Z" : null,
        notes: [],
      };
      writeJson(auditPath, audit);
      artifacts.output_path = path.relative(temp, outputPath).replace(/\\/g, "/");
      artifacts.output_sha256 = sha256File(outputPath);
      artifacts.output_audit_path = path.relative(temp, auditPath).replace(/\\/g, "/");
      artifacts.output_audit_sha256 = sha256File(auditPath);
      humanReviews.push({ case_id: caseId, no_new_facts: reviewed || null, no_style_source_facts: reviewed || null, style_similarity_accepted: reviewed || null, overfit_absent: reviewed || null });
    }
    cases.push({
      case_id: caseId,
      case_type: caseType,
      target_framework_id: targetFrameworkId,
      fallback_beat_ids: fallbackBeatIds,
      expected_selection: { abstained: selection.abstained, content_type_id: selection.content_type_id, framework_id: selection.framework_id },
      applied_controls: { persona_rule_ids: [], strategy_rule_ids: [], attention_stage_ids: [] },
      artifacts,
    });
  };

  addCase({ caseId: "positive-01", caseType: "positive", content: { steps: ["one"], primary_value: "tutorial", cta: "follow" }, targetFrameworkId: "tutorial-path", outputText: "先讲清楚步骤，再自然收束。" });
  if (reviewed) {
    addCase({ caseId: "fallback-01", caseType: "fallback", content: { steps: ["one"], primary_value: "tutorial" }, targetFrameworkId: "tutorial-path", fallbackBeatIds: ["b03"], outputText: "先讲清楚步骤，没有行动入口就自然总结。" });
    addCase({ caseId: "excluded-01", caseType: "excluded", content: { primary_value: "personal_story" }, targetFrameworkId: "tutorial-path" });
  }
  const suite = {
    schema_version: reviewed ? "1.1-reviewed" : "1.1-draft",
    test_id: "fixture-generation-suite",
    profile_id: profile.profile_id,
    profile_schema_version: "1.1-draft",
    candidate_profile_sha256: profileCandidateSha256(profile),
    mode: "evaluation_only",
    state: reviewed ? "reviewed" : "draft",
    cases,
    human_review: {
      state: reviewed ? "reviewed" : "pending",
      reviewer_type: reviewed ? "human" : null,
      reviewer: reviewed ? "Human Reviewer" : null,
      reviewed_at: reviewed ? "2026-07-22T05:00:00Z" : null,
      case_reviews: humanReviews,
      notes: [],
    },
    limitations: [],
  };
  const suitePath = path.join(temp, "generation-test.json");
  writeJson(suitePath, suite);
  return { temp, suite, suitePath, referenceCorpus };
};

const buildApprovedValidationFixture = () => {
  const profile = baseProfile();
  profile.schema_version = "1.1-approved";
  profile.status = "approved";
  for (const collection of [profile.content_types, profile.frameworks, profile.patterns]) {
    for (const item of collection) {
      item.status = "approved";
      item.availability = "selectable";
    }
  }
  profile.approval = {
    state: "approved",
    requires_human_approval: false,
    approved_by: "Human Reviewer",
    approved_at: "2026-07-22T06:00:00Z",
    change_reason: "人工逐项确认并批准绑定产物",
    record_id: "human-review-20260722-001",
    generation_test_id: "fixture-generation-suite",
    candidate_profile_sha256: null,
    approved_control_state_sha256: null,
    evidence_bundle_sha256: null,
    generation_test_sha256: null,
    generation_output_set_sha256: null,
  };
  const evidenceBundle = baseEvidenceBundle();
  const generation = buildGenerationSuiteFixture(profile, { reviewed: true });
  const digests = {
    candidate_profile_sha256: profileCandidateSha256(profile),
    approved_control_state_sha256: approvedControlStateSha256(profile),
    evidence_bundle_sha256: evidenceBundleSha256(evidenceBundle),
    generation_test_sha256: generationTestSha256(generation.suite),
    generation_output_set_sha256: generationOutputSetSha256(generation.suite),
  };
  Object.assign(profile.approval, digests);
  const approvalRecord = {
    record_id: profile.approval.record_id,
    profile_id: profile.profile_id,
    generation_test_id: generation.suite.test_id,
    decision_source: "user_explicit_confirmation",
    decision: "approved",
    reviewer_type: "human",
    reviewer: profile.approval.approved_by,
    decided_at: profile.approval.approved_at,
    change_reason: profile.approval.change_reason,
    ...digests,
    checklist: {
      sample_decisions_confirmed: true,
      candidate_evidence_confirmed: true,
      source_facts_absent: true,
      holdout_or_limitation_confirmed: true,
      generation_test_confirmed: true,
    },
  };
  return { profile, evidenceBundle, approvalRecord, ...generation };
};

test("H1 不计样本，H2 成为口播单元", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "# 总标题\n\n## 第一条\n\n第一条正文。\n\n## 第二条\n\n第二条正文。\n", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    assert.equal(corpus.units.length, 2);
    assert.equal(corpus.units[0].title, "第一条");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("Markdown YAML frontmatter 不会成为口播单元", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "---\ntitle: 测试\nplatform: demo\n---\n\n真正的单条口播正文。\n", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    assert.equal(corpus.units.length, 1);
    assert.equal(corpus.units[0].text.includes("platform"), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("近重复只产生人工决策，不自动排除", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    const repeated = "这是同一条口播的完整转写内容，包含足够多的重复字符用于稳定识别。".repeat(8);
    fs.writeFileSync(source, `## 甲\n\n${repeated}\n\n## 乙\n\n${repeated}\n\n## 丙\n\n完全不同的第三条内容。`, "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    const health = assessHealth(corpus);
    const scaffold = buildScaffold(corpus, health);
    assert.equal(health.suggested_duplicate_clusters.length, 1);
    assert.equal(scaffold.decisions.duplicate_decisions[0].decision, "unresolved");
    assert.equal(scaffold.annotations.units[0].include_in_fusion, null);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("完整候选框架和规则通过契约", () => {
  const report = validateFixture(baseProfile());
  assert.equal(report.ok, true, report.errors.join("\n"));
});

test("candidate 缺少外部证据闭环时拒绝", () => {
  const report = validateProfile(baseProfile());
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("必须同时校验")));
});

test("单一独立样本不能伪装成 candidate", () => {
  const profile = baseProfile();
  profile.patterns[0].evidence[1].independence_cluster_id = "c01";
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("至少需要两个独立样本簇")));
});

test("证据不能用伪造 cluster ID 绕过重复约束", () => {
  const profile = baseProfile();
  profile.patterns[0].evidence[1].independence_cluster_id = "fake-independent-cluster";
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("corpus 映射不一致")));
});

test("observation 必须保持 review_only", () => {
  const profile = baseProfile();
  profile.patterns[0].status = "observation";
  profile.patterns[0].availability = "selectable";
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("review_only")));
});

test("框架证据路径顺序冲突会被拒绝", () => {
  const profile = baseProfile();
  profile.frameworks[0].evidence_paths[1].beats = [
    { beat_id: "b02", anchor_id: "u02:p02", ordinal: 1 },
    { beat_id: "b01", anchor_id: "u02:p01", ordinal: 2 },
    { beat_id: "b03", anchor_id: "u02:p03", ordinal: 3 },
  ];
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("路径顺序与框架节拍顺序不一致")));
});

test("不存在的证据锚点会被拒绝", () => {
  const profile = baseProfile();
  profile.patterns[0].evidence[0].anchor_id = "not-in-annotations";
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("锚点不在 annotations")));
});

test("annotations 中的空壳锚点不能伪造证据", () => {
  const profile = baseProfile();
  const evidenceBundle = baseEvidenceBundle();
  evidenceBundle.annotations.units[0].anchors.push({ anchor_id: "invented" });
  profile.patterns[0].evidence[0].anchor_id = "invented";
  const report = validateProfile(profile, { evidenceBundle });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("relative_position") || item.includes("unit_id")));
});

test("带 evidence 的 observation 也必须提供外部锚点闭环", () => {
  const profile = baseProfile();
  for (const collection of [profile.content_types, profile.frameworks, profile.patterns]) {
    for (const item of collection) {
      item.status = "observation";
      item.availability = "review_only";
    }
  }
  const report = validateProfile(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("必须同时校验")));
});

test("未决样本决定存在时不能保留 candidate", () => {
  const profile = baseProfile();
  profile.corpus.unresolved_decisions = ["duplicate-candidate-01"];
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("不得有未决样本决定")));
});

test("碎片路径不能拼成从未出现的完整候选框架", () => {
  const profile = baseProfile();
  profile.frameworks[0].evidence_paths = [
    { unit_id: "fixture-v1:u01", independence_cluster_id: "c01", beats: [{ beat_id: "b01", anchor_id: "u01:p01", ordinal: 1 }] },
    { unit_id: "fixture-v1:u02", independence_cluster_id: "c02", beats: [{ beat_id: "b01", anchor_id: "u02:p01", ordinal: 1 }] },
    { unit_id: "fixture-v1:u01", independence_cluster_id: "c01", beats: [{ beat_id: "b02", anchor_id: "u01:p02", ordinal: 1 }] },
    { unit_id: "fixture-v1:u02", independence_cluster_id: "c02", beats: [{ beat_id: "b02", anchor_id: "u02:p02", ordinal: 1 }] },
    { unit_id: "fixture-v1:u01", independence_cluster_id: "c01", beats: [{ beat_id: "b03", anchor_id: "u01:p03", ordinal: 1 }] },
    { unit_id: "fixture-v1:u02", independence_cluster_id: "c02", beats: [{ beat_id: "b03", anchor_id: "u02:p03", ordinal: 1 }] },
  ];
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("全部必需节拍的独立完整路径")));
});

test("公开 DNA 禁止来源正文载荷字段", () => {
  const profile = baseProfile();
  profile.patterns[0].source_quote = "不应保存的原句";
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("来源载荷字段")));
});

test("draft 中 approved/selectable 内容类型会被拒绝", () => {
  const profile = baseProfile();
  profile.content_types[0].status = "approved";
  profile.content_types[0].availability = "selectable";
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("draft profile 不能包含 approved/selectable")));
});

test("悬空 content type 引用和缺失定义会被拒绝", () => {
  const profile = baseProfile();
  delete profile.content_types[0].definition;
  profile.frameworks[0].content_type_id = "missing-type";
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("definition")));
  assert.ok(report.errors.some((item) => item.includes("不存在的 content type")));
});

test("两节拍叙事框架可通过，不强制教程式三节拍", () => {
  const profile = baseProfile();
  profile.frameworks[0].beats = profile.frameworks[0].beats.slice(0, 2);
  profile.frameworks[0].evidence_paths.forEach((item) => { item.beats = item.beats.slice(0, 2); });
  const report = validateFixture(profile);
  assert.equal(report.ok, true, report.errors.join("\n"));
});

test("来源长片段泄漏扫描返回指纹而不是原句", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "## 第一条\n\n这是一段绝对不应该进入公开风格档案的来源长句内容。", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    const profile = baseProfile();
    profile.limitations.push("这是一段绝对不应该进入公开风格档案的来源长句内容");
    const report = scanLeakage(corpus, profile, { minLength: 16 });
    assert.equal(report.ok, false);
    assert.equal(report.matches[0].fingerprint.length, 64);
    assert.equal(JSON.stringify(report).includes("绝对不应该"), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("标题和短数字事实都会触发泄漏扫描", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "## 这是一个不应该复制进入档案的完整标题\n\n这个案例7天赚3000元。", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    const profile = baseProfile();
    profile.limitations.push("这是一个不应该复制进入档案的完整标题");
    profile.patterns[0].risk = "这个案例7天赚3000元";
    const report = scanLeakage(corpus, profile, { minLength: 12, sensitiveMinLength: 6 });
    assert.equal(report.ok, false);
    assert.ok(report.matches.some((item) => item.source_kind === "title"));
    assert.ok(report.matches.some((item) => item.match_kind === "sensitive_exact"));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("跨字段拆分的敏感事实仍会被扫描", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "## 测试\n\n7天赚3000元。", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    const profile = baseProfile();
    profile.patterns[0].formula = "7天赚";
    profile.patterns[0].applicability = "3000元";
    const report = scanLeakage(corpus, profile, { minLength: 12, sensitiveMinLength: 6 });
    assert.equal(report.ok, false);
    assert.ok(report.matches.some((item) => item.match_kind === "sensitive_cross_field"));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("预置来源边界不参与泄漏误报", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "## 测试\n\n不保存来源事实，下游只使用目标内容事实。", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    const report = scanLeakage(corpus, baseProfile(), { minLength: 12 });
    assert.equal(report.ok, true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("draft 不能伪装成人工批准", () => {
  const profile = baseProfile();
  profile.status = "approved";
  profile.approval.state = "approved";
  profile.approval.requires_human_approval = false;
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("真实人工记录")));
});

test("自由文本自批和无效时间不能通过 approved 门禁", () => {
  const profile = baseProfile();
  profile.status = "approved";
  profile.approval = {
    state: "approved",
    requires_human_approval: false,
    approved_by: "AI self",
    approved_at: "not-a-timestamp",
    change_reason: "self approved",
    record_id: "fake-record",
  };
  const approvalRecord = {
    record_id: "fake-record",
    profile_id: profile.profile_id,
    decision: "approved",
    reviewer_type: "human",
    reviewer: "AI self",
    decided_at: "not-a-timestamp",
    change_reason: "self approved",
    checklist: { sample_decisions_confirmed: true },
  };
  const report = validateFixture(profile, { approvalRecord });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("ISO 8601")));
});

test("健康报告中的未决重复候选会阻断 candidate", () => {
  const profile = baseProfile();
  const evidenceBundle = baseEvidenceBundle();
  evidenceBundle.health.suggested_duplicate_clusters = [{ cluster_id: "duplicate-candidate-01", unit_ids: ["fixture-v1:u01", "fixture-v1:u02"] }];
  evidenceBundle.decisions.duplicate_decisions = [{ cluster_id: "duplicate-candidate-01", unit_ids: ["fixture-v1:u01", "fixture-v1:u02"], decision: "unresolved", retained_unit_ids: [] }];
  const report = validateProfile(profile, { evidenceBundle });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("存在未决样本决定")));
});

test("非法 decision、缺失 opening 决定和 manifest 漏记都会被拒绝", () => {
  const profile = baseProfile();
  const evidenceBundle = baseEvidenceBundle();
  evidenceBundle.manifest.unit_count = 4;
  evidenceBundle.manifest.units.push({ id: "fixture-v1:u04" });
  evidenceBundle.health.suggested_duplicate_clusters = [{ cluster_id: "duplicate-candidate-01", unit_ids: ["fixture-v1:u01", "fixture-v1:u02"] }];
  evidenceBundle.health.repeated_opening_groups = [{ unit_ids: ["fixture-v1:u01", "fixture-v1:u02"], count: 2 }];
  evidenceBundle.decisions.duplicate_decisions = [{ cluster_id: "duplicate-candidate-01", unit_ids: ["fixture-v1:u01", "fixture-v1:u02"], decision: "banana", retained_unit_ids: [] }];
  const report = validateProfile(profile, { evidenceBundle });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("非法 decision")));
  assert.ok(report.errors.some((item) => item.includes("opening-candidate-01")));
  assert.ok(report.errors.some((item) => item.includes("未在 profile 记账")));
});

test("批准记录必须包含完整且无替代项的五项清单", () => {
  const profile = baseProfile();
  profile.status = "approved";
  profile.approval = {
    state: "approved",
    requires_human_approval: false,
    approved_by: "Human Reviewer",
    approved_at: "2026-07-22T03:00:00Z",
    change_reason: "人工逐项确认",
    record_id: "human-review-20260722-001",
  };
  const approvalRecord = {
    record_id: "human-review-20260722-001",
    profile_id: profile.profile_id,
    decision: "approved",
    reviewer_type: "human",
    reviewer: "Human Reviewer",
    decided_at: "2026-07-22T03:00:00Z",
    change_reason: "人工逐项确认",
    checklist: { sample_decisions_confirmed: true },
  };
  const report = validateFixture(profile, { approvalRecord });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("必须完整且仅包含规定项")));
});

test("四字符收益和 preserve 字段不能逃逸泄漏扫描", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "## 测试\n\n。。。。月入3万，这是一段需要隔离的内容。", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    const profile = baseProfile();
    profile.patterns[0].preserve.push("月入3万");
    const report = scanLeakage(corpus, profile);
    assert.equal(report.ok, false);
    assert.ok(report.matches.some((item) => item.match_kind === "sensitive_exact"));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("非敏感来源经历拆进多个字段仍会被重建扫描", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "## 测试\n\n我在雨天回头帮陌生人搬完纸箱才明白善意只是愿意停一下。", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    const profile = baseProfile();
    profile.patterns[0].formula = "我在雨天回头帮陌生人";
    profile.patterns[0].applicability = "搬完纸箱才明白善意";
    profile.patterns[0].risk = "只是愿意停一下";
    const report = scanLeakage(corpus, profile, { minLength: 16 });
    assert.equal(report.ok, false);
    assert.ok(report.matches.some((item) => item.match_kind === "cross_field_reconstruction"));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("人读渲染只展示锚点和抽象规则", () => {
  const markdown = renderProfileMarkdown(baseProfile());
  assert.match(markdown, /教程路径/);
  assert.match(markdown, /u01:p01/);
  assert.equal(markdown.includes("source_quote"), false);
});

test("叙事位置、认知推进与机会包装使用固定类别并进入人读档案", () => {
  const profile = baseProfile();
  const observation = (id, discriminatorKey, discriminatorValue, name) => ({
    id,
    [discriminatorKey]: discriminatorValue,
    name,
    status: "observation",
    availability: "review_only",
    definition: "描述可观察的文本推进动作",
    generation_instruction: "只使用目标内容已有身份、判断和价值关系组织表达",
    applicability: "目标内容提供对应槽位",
    non_applicability: "目标内容缺少对应槽位",
    evidence: [evidence("fixture-v1:u01", "c01", "u01:p01", 0.1)],
    risk: "不推断现实身份、真实认知变化或新增价值",
  });
  profile.communication_persona = [
    observation("narrator", "dimension", "narrator_position", "文本中的拆解者位置"),
  ];
  profile.content_strategy = [
    observation("journey", "category", "cognitive_journey", "从起始理解推进到目标判断"),
    observation("packaging", "category", "opportunity_packaging", "让已有价值逐层显现"),
  ];
  const report = validateFixture(profile);
  assert.equal(report.ok, true, report.errors.join("\n"));
  const markdown = renderProfileMarkdown(profile);
  assert.match(markdown, /叙事位置与沟通人格/);
  assert.match(markdown, /narrator_position/);
  assert.match(markdown, /cognitive_journey/);
  assert.match(markdown, /opportunity_packaging/);

  profile.communication_persona[0].dimension = "psychological_identity";
  const invalidPersona = validateFixture(profile);
  assert.equal(invalidPersona.ok, false);
  assert.ok(invalidPersona.errors.some((item) => item.includes("未知 dimension")));

  profile.communication_persona[0].dimension = "narrator_position";
  profile.content_strategy[0].category = "conversion_magic";
  const invalidStrategy = validateFixture(profile);
  assert.equal(invalidStrategy.ok, false);
  assert.ok(invalidStrategy.errors.some((item) => item.includes("未知 category")));
});

test("1.1 使用严格版本和顶层字段白名单", () => {
  const valid = validateFixture(baseProfile());
  assert.equal(valid.ok, true);
  const arbitrary = baseProfile();
  arbitrary.schema_version = "1.1-anything";
  assert.equal(validateFixture(arbitrary).ok, false);
  const visual = baseProfile();
  visual.visual_style = { palette: "neon", camera_language: "push" };
  const report = validateFixture(visual);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("未知顶层字段")));
  const nestedVisual = baseProfile();
  nestedVisual.frameworks[0].visual_interface = { shot_list: ["push-in"] };
  const nestedReport = validateFixture(nestedVisual);
  assert.equal(nestedReport.ok, false);
  assert.ok(nestedReport.errors.some((item) => item.includes("纯文本 profile 禁止声明视觉")));
});

test("legacy 1.0 只能回读 draft，不能伪装 approved", () => {
  const profile = baseProfile();
  profile.schema_version = "1.0-draft";
  for (const key of ["selector_signals", "communication_persona", "content_strategy", "attention_rhythm", "avoid_patterns", "generation_interface"]) delete profile[key];
  const legacyDraft = validateFixture(profile);
  assert.equal(legacyDraft.ok, true, legacyDraft.errors.join("\n"));
  profile.schema_version = "1.0-approved";
  profile.status = "approved";
  const legacyApproved = validateFixture(profile);
  assert.equal(legacyApproved.ok, false);
  assert.ok(legacyApproved.errors.some((item) => item.includes("仅支持 1.0-draft")));
});

test("selector DSL 产生唯一框架或明确 abstain", () => {
  const profile = baseProfile();
  const match = resolveFrameworkSelection(profile, { steps: ["one"], primary_value: "tutorial", cta: "follow" });
  assert.equal(match.framework_id, "tutorial-path");
  const rejected = resolveFrameworkSelection(profile, { primary_value: "personal_story" });
  assert.equal(rejected.abstained, true);
  const tied = baseProfile();
  tied.frameworks.push({ ...structuredClone(tied.frameworks[0]), id: "tutorial-path-tied", name: "同优先级冲突" });
  const ambiguous = resolveFrameworkSelection(tied, { steps: ["one"], cta: "follow" });
  assert.equal(ambiguous.abstained, true);
  assert.match(ambiguous.reason, /ambiguous_tie/);

  const duplicateRank = baseProfile();
  duplicateRank.frameworks.push({ ...structuredClone(duplicateRank.frameworks[0]), id: "tutorial-path-duplicate-rank", name: "重复偏好不得加权" });
  duplicateRank.frameworks[1].selector.prefers_any = ["content.has_cta", "content.has_cta"];
  const duplicateResolution = resolveFrameworkSelection(duplicateRank, { steps: ["one"], cta: "follow" });
  assert.equal(duplicateResolution.abstained, true);
  assert.match(duplicateResolution.reason, /ambiguous_tie/);
  const duplicateReport = validateFixture(duplicateRank);
  assert.equal(duplicateReport.ok, false);
  assert.ok(duplicateReport.errors.some((item) => item.includes("不得包含重复项")));

  const overlapping = baseProfile();
  overlapping.frameworks[0].selector.prefers_any = ["content.has_steps"];
  const overlapReport = validateFixture(overlapping);
  assert.equal(overlapReport.ok, false);
  assert.ok(overlapReport.errors.some((item) => item.includes("requires_all/prefers_any")));
});

test("1.1 缺少生成动作或 intended anchor 字段会失败", () => {
  const profile = baseProfile();
  delete profile.patterns[0].generation_instruction;
  const missingInstruction = validateFixture(profile);
  assert.equal(missingInstruction.ok, false);
  assert.ok(missingInstruction.errors.some((item) => item.includes("generation_instruction")));

  const evidenceBundle = baseEvidenceBundle();
  delete evidenceBundle.annotations.units[0].anchors[0].audience_effect;
  const missingEffect = validateProfile(baseProfile(), { evidenceBundle });
  assert.equal(missingEffect.ok, false);
  assert.ok(missingEffect.errors.some((item) => item.includes("audience_effect")));

  const badPosition = baseProfile();
  badPosition.patterns[0].application_control.positions = ["middle"];
  const badPositionReport = validateFixture(badPosition);
  assert.equal(badPositionReport.ok, false);
  assert.ok(badPositionReport.errors.some((item) => item.includes("未知 position")));

  const badBeatEffect = baseProfile();
  badBeatEffect.frameworks[0].beats[0].audience_effect = "proven_conversion";
  const badBeatEffectReport = validateFixture(badBeatEffect);
  assert.equal(badBeatEffectReport.ok, false);
  assert.ok(badBeatEffectReport.errors.some((item) => item.includes("fixed intended-effect") || item.includes("固定 intended-effect")));
});

test("纯文本 attention basis 不得伪装语速停顿或真实留存", () => {
  const profile = baseProfile();
  profile.attention_rhythm = {
    basis: "textual_function_inference",
    stages: [{
      id: "attention-entry",
      name: "进入",
      status: "observation",
      availability: "review_only",
      relative_range: [0, 0.2],
      audience_state: "retention 已验证",
      objective: "建立价值",
      mechanism: "提高语速并增加停顿",
      generation_instruction: "只前置已有主张",
      intensity: "medium",
      evidence: [],
      risk: "文本推断",
    }],
  };
  const report = validateFixture(profile);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((item) => item.includes("纯文本 basis")));
});

test("draft generation suite 绑定真实 input、output、contract 和 audit", () => {
  const profile = baseProfile();
  const fixture = buildGenerationSuiteFixture(profile);
  try {
    const report = validateGenerationTest(profile, fixture.suite, { generationTestPath: fixture.suitePath, referenceCorpus: fixture.referenceCorpus });
    assert.equal(report.ok, true, report.errors.join("\n"));
    assert.ok(report.warnings.some((item) => item.includes("尚未人工 reviewed")));
    const integrated = validateProfile(profile, {
      evidenceBundle: baseEvidenceBundle(),
      generationTest: fixture.suite,
      generationTestPath: fixture.suitePath,
      referenceCorpus: fixture.referenceCorpus,
    });
    assert.equal(integrated.ok, true, integrated.errors.join("\n"));
    assert.ok(integrated.warnings.some((item) => item.includes("generation_test")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("generation suite 与 artifact 使用严格字段且禁止目录逃逸", () => {
  const profile = baseProfile();
  const fixture = buildGenerationSuiteFixture(profile);
  try {
    fixture.suite.unreviewed_claim = true;
    fixture.suite.cases[0].artifacts.input_path = "../outside.md";
    const report = validateGenerationTest(profile, fixture.suite, { generationTestPath: fixture.suitePath, referenceCorpus: fixture.referenceCorpus });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("generation_test.unreviewed_claim")));
    assert.ok(report.errors.some((item) => item.includes("必须位于 generation test 目录内")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("自报相同 hash 不能掩盖 content contract 与 output audit 不一致", () => {
  const profile = baseProfile();
  const fixture = buildGenerationSuiteFixture(profile);
  try {
    const generationCase = fixture.suite.cases[0];
    const auditPath = path.resolve(fixture.temp, generationCase.artifacts.output_audit_path);
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    audit.relation_observations[0].value = { tampered: true };
    writeJson(auditPath, audit);
    generationCase.artifacts.output_audit_sha256 = sha256File(auditPath);
    const report = validateGenerationTest(profile, fixture.suite, { generationTestPath: fixture.suitePath, referenceCorpus: fixture.referenceCorpus });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("content_lock")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("draft audit 已记录的新事实或来源 notes 也不能带错通过", () => {
  const profile = baseProfile();
  const fixture = buildGenerationSuiteFixture(profile);
  try {
    const generationCase = fixture.suite.cases[0];
    const auditPath = path.resolve(fixture.temp, generationCase.artifacts.output_audit_path);
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    audit.new_fact_findings = [{ finding: "新增了输入不存在的事实" }];
    audit.notes = ["这里是一段完全不同的抽象风格参考，不包含生成夹具事实。"];
    writeJson(auditPath, audit);
    generationCase.artifacts.output_audit_sha256 = sha256File(auditPath);
    const report = validateGenerationTest(profile, fixture.suite, { generationTestPath: fixture.suitePath, referenceCorpus: fixture.referenceCorpus });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("审计发现新增事实")));
    assert.ok(report.errors.some((item) => item.includes("output_audit.notes") && item.includes("泄漏扫描")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("pattern span 超预算和输出元话语都会失败", () => {
  const profile = baseProfile();
  const fixture = buildGenerationSuiteFixture(profile);
  try {
    const generationCase = fixture.suite.cases[0];
    const outputPath = path.resolve(fixture.temp, generationCase.artifacts.output_path);
    fs.writeFileSync(outputPath, "根据你提供的内容，先讲清楚步骤，再自然收束。", "utf8");
    generationCase.artifacts.output_sha256 = sha256File(outputPath);
    const auditPath = path.resolve(fixture.temp, generationCase.artifacts.output_audit_path);
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    audit.output_sha256 = generationCase.artifacts.output_sha256;
    audit.pattern_applications = [{ pattern_id: "contrast", start: 0, end: 2 }, { pattern_id: "contrast", start: 3, end: 5 }];
    writeJson(auditPath, audit);
    generationCase.artifacts.output_audit_sha256 = sha256File(auditPath);
    const report = validateGenerationTest(profile, fixture.suite, { generationTestPath: fixture.suitePath, referenceCorpus: fixture.referenceCorpus });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("使用次数超出预算")));
    assert.ok(report.errors.some((item) => item.includes("过程性元话语")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("profile 自定义 prohibited meta phrase 会扫描绑定 output", () => {
  const profile = baseProfile();
  profile.rewrite_interface.prohibited_audience_meta_phrases.push("自然收束");
  const fixture = buildGenerationSuiteFixture(profile);
  try {
    const report = validateGenerationTest(profile, fixture.suite, { generationTestPath: fixture.suitePath, referenceCorpus: fixture.referenceCorpus });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("过程性元话语：自然收束")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("pattern 的 min 预算与 avoid_when 都会在真实 output audit 上执行", () => {
  const minProfile = baseProfile();
  minProfile.patterns[0].application_control.min_per_script = 1;
  const minFixture = buildGenerationSuiteFixture(minProfile);
  try {
    const generationCase = minFixture.suite.cases[0];
    const auditPath = path.resolve(minFixture.temp, generationCase.artifacts.output_audit_path);
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    audit.pattern_applications = [];
    writeJson(auditPath, audit);
    generationCase.artifacts.output_audit_sha256 = sha256File(auditPath);
    const report = validateGenerationTest(minProfile, minFixture.suite, { generationTestPath: minFixture.suitePath, referenceCorpus: minFixture.referenceCorpus });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("使用次数超出预算")));
  } finally {
    fs.rmSync(minFixture.temp, { recursive: true, force: true });
  }

  const avoidProfile = baseProfile();
  avoidProfile.selector_signals.push({ id: "content.blocks_contrast", source_path: "blocks_contrast", operator: "equals", value: true, description: "目标内容禁用认知转折" });
  avoidProfile.patterns[0].avoid_when = ["content.blocks_contrast"];
  const avoidFixture = buildGenerationSuiteFixture(avoidProfile);
  try {
    const generationCase = avoidFixture.suite.cases[0];
    const contractPath = path.resolve(avoidFixture.temp, generationCase.artifacts.content_contract_path);
    const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    contract.content.blocks_contrast = true;
    writeJson(contractPath, contract);
    generationCase.artifacts.content_contract_sha256 = sha256File(contractPath);
    const report = validateGenerationTest(avoidProfile, avoidFixture.suite, { generationTestPath: avoidFixture.suitePath, referenceCorpus: avoidFixture.referenceCorpus });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("avoid_when")));
  } finally {
    fs.rmSync(avoidFixture.temp, { recursive: true, force: true });
  }
});

test("avoid pattern 的违规 span 声明会阻断 generation suite", () => {
  const profile = baseProfile();
  profile.avoid_patterns.push({
    id: "avoid-false-guarantee",
    name: "禁止虚假保证",
    status: "candidate",
    availability: "profile_approval_required",
    trigger: "目标内容含步骤",
    trigger_signals: ["content.has_steps"],
    avoid_instruction: "不得把步骤写成结果保证",
    rationale: "样本只解释路径，不保证结果",
    basis: "observed_contrast",
    evidence: [
      evidence("fixture-v1:u01", "c01", "u01:p01", 0.1),
      evidence("fixture-v1:u02", "c02", "u02:p01", 0.1),
    ],
  });
  const fixture = buildGenerationSuiteFixture(profile);
  try {
    const generationCase = fixture.suite.cases[0];
    const auditPath = path.resolve(fixture.temp, generationCase.artifacts.output_audit_path);
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    audit.avoidance_findings[0].violations = [{ start: 0, end: 2 }];
    writeJson(auditPath, audit);
    generationCase.artifacts.output_audit_sha256 = sha256File(auditPath);
    const report = validateGenerationTest(profile, fixture.suite, { generationTestPath: fixture.suitePath, referenceCorpus: fixture.referenceCorpus });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("存在违规")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("完整 reviewed suite 和摘要绑定可通过，批准后篡改规则立即失效", () => {
  const fixture = buildApprovedValidationFixture();
  try {
    const options = {
      evidenceBundle: fixture.evidenceBundle,
      approvalRecord: fixture.approvalRecord,
      generationTest: fixture.suite,
      generationTestPath: fixture.suitePath,
      referenceCorpus: fixture.referenceCorpus,
    };
    const valid = validateProfile(fixture.profile, options);
    assert.equal(valid.ok, true, valid.errors.join("\n"));
    fixture.profile.frameworks[0].beats[0].transformation_rule = "批准后被篡改";
    const tampered = validateProfile(fixture.profile, options);
    assert.equal(tampered.ok, false);
    assert.ok(tampered.errors.some((item) => item.includes("candidate_profile_sha256")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("批准后 evidence bundle 或真实输出变化都会让原批准记录失效", () => {
  const fixture = buildApprovedValidationFixture();
  try {
    const options = {
      evidenceBundle: fixture.evidenceBundle,
      approvalRecord: fixture.approvalRecord,
      generationTest: fixture.suite,
      generationTestPath: fixture.suitePath,
      referenceCorpus: fixture.referenceCorpus,
    };
    const mutatedEvidence = structuredClone(fixture.evidenceBundle);
    mutatedEvidence.annotations.units[0].anchors[0].function = "changed-after-approval";
    const evidenceReport = validateProfile(fixture.profile, { ...options, evidenceBundle: mutatedEvidence });
    assert.equal(evidenceReport.ok, false);
    assert.ok(evidenceReport.errors.some((item) => item.includes("evidence_bundle_sha256")));

    const outputPath = path.resolve(fixture.temp, fixture.suite.cases[0].artifacts.output_path);
    fs.appendFileSync(outputPath, "批准后变更", "utf8");
    const outputReport = validateProfile(fixture.profile, options);
    assert.equal(outputReport.ok, false);
    assert.ok(outputReport.errors.some((item) => item.includes("实际 artifact SHA-256")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("approved control 状态变化由独立摘要绑定且不得残留 candidate", () => {
  const fixture = buildApprovedValidationFixture();
  try {
    const before = approvedControlStateSha256(fixture.profile);
    fixture.profile.patterns[0].status = "candidate";
    fixture.profile.patterns[0].availability = "profile_approval_required";
    const after = approvedControlStateSha256(fixture.profile);
    assert.notEqual(after, before);
    const report = validateProfile(fixture.profile, {
      evidenceBundle: fixture.evidenceBundle,
      approvalRecord: fixture.approvalRecord,
      generationTest: fixture.suite,
      generationTestPath: fixture.suitePath,
      referenceCorpus: fixture.referenceCorpus,
    });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("approved_control_state_sha256")));
    assert.ok(report.errors.some((item) => item.includes("不得残留 candidate")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("AI self 不能伪装 human reviewer", () => {
  const fixture = buildApprovedValidationFixture();
  try {
    fixture.profile.approval.approved_by = "AI self";
    fixture.approvalRecord.reviewer = "AI self";
    const report = validateProfile(fixture.profile, {
      evidenceBundle: fixture.evidenceBundle,
      approvalRecord: fixture.approvalRecord,
      generationTest: fixture.suite,
      generationTestPath: fixture.suitePath,
      referenceCorpus: fixture.referenceCorpus,
    });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("AI/assistant/model")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("OpenAI 等模型名不能伪装人工批准者", () => {
  const fixture = buildApprovedValidationFixture();
  try {
    fixture.profile.approval.approved_by = "OpenAI Reviewer";
    fixture.approvalRecord.reviewer = "OpenAI Reviewer";
    const report = validateProfile(fixture.profile, {
      evidenceBundle: fixture.evidenceBundle,
      approvalRecord: fixture.approvalRecord,
      generationTest: fixture.suite,
      generationTestPath: fixture.suitePath,
      referenceCorpus: fixture.referenceCorpus,
    });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("AI/assistant/model")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("reviewed suite 必须覆盖正例、拒绝例和 fallback", () => {
  const fixture = buildApprovedValidationFixture();
  try {
    fixture.suite.cases = fixture.suite.cases.filter((item) => item.case_type !== "fallback");
    const report = validateGenerationTest(fixture.profile, fixture.suite, { generationTestPath: fixture.suitePath, referenceCorpus: fixture.referenceCorpus, requireReviewed: true });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((item) => item.includes("缺少 fallback case")));
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test("annotations 也进入 reference-corpus 泄漏扫描", () => {
  const temp = makeTemporaryDirectoryForTests();
  try {
    const source = path.join(temp, "sample.md");
    fs.writeFileSync(source, "## 测试\n\n这是一整段不允许复制到受众作用字段里的来源内容。", "utf8");
    const corpus = readCorpus(source, { corpusId: "fixture" });
    const annotations = baseEvidenceBundle().annotations;
    annotations.units[0].anchors[0].audience_effect = "这是一整段不允许复制到受众作用字段里的来源内容";
    const report = scanLeakage(corpus, baseProfile(), { minLength: 16, annotations });
    assert.equal(report.ok, false);
    assert.ok(report.matches.some((item) => item.profile_location.startsWith("annotations.")));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
