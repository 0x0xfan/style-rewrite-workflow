#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "source_text",
  "raw_text",
  "sample_text",
  "original_text",
  "source_quote",
  "source_excerpt",
  "account_name",
  "cta_keyword",
  "resource_keyword",
]);
const ALLOWED_STATUSES = new Set(["observation", "candidate", "approved"]);
const EXPECTED_AVAILABILITY = Object.freeze({
  observation: "review_only",
  candidate: "profile_approval_required",
  approved: "selectable",
});
const REQUIRED_META_PHRASES = ["原稿里", "原文里", "文案里", "飞书里", "资料里", "材料中", "根据你提供的", "下面这版"];
const REQUIRED_APPROVAL_CHECKS = [
  "sample_decisions_confirmed",
  "candidate_evidence_confirmed",
  "source_facts_absent",
  "holdout_or_limitation_confirmed",
  "generation_test_confirmed",
];
const REQUIRED_GENERATION_CHECKS = [
  "selector_resolution_bound",
  "content_lock_audit_matches",
  "output_artifact_bound",
  "pattern_span_audit_passed",
  "avoidance_span_audit_passed",
  "audience_meta_absent",
  "reference_leakage_scan_passed",
  "no_new_facts_human_confirmed",
  "no_style_source_facts_human_confirmed",
  "human_style_similarity_accepted",
  "overfit_absent_human_confirmed",
];
const ALLOWED_ATTENTION_BASES = new Set(["textual_function_inference", "audio_verified", "mixed", "unknown"]);
const ALLOWED_ATTENTION_INTENSITIES = new Set(["low", "medium", "high", "unknown"]);
const ALLOWED_AVOID_BASES = new Set(["observed_contrast", "absence_with_coverage", "human_boundary"]);
const SHA256_FINGERPRINT = /^sha256:[a-f0-9]{64}$/i;
const ALLOWED_SIGNAL_OPERATORS = new Set(["exists", "missing", "nonempty_array", "empty_array", "equals", "not_equals", "number_gte", "number_lte"]);
const ALLOWED_PATTERN_POSITIONS = new Set(["entry", "body", "close", "any"]);
const ALLOWED_CASE_TYPES = new Set(["positive", "abstain", "excluded", "fallback"]);
const ALLOWED_PERSONA_DIMENSIONS = new Set([
  "narrator_position", "speaker_position", "audience_relationship", "authority_source", "default_stance", "certainty_policy",
]);
const ALLOWED_STRATEGY_CATEGORIES = new Set([
  "topic_lens", "reasoning_move", "persuasion_move", "evidence_policy", "cta_policy", "cognitive_journey", "opportunity_packaging",
]);
const VISUAL_NAMESPACE_KEY = /^(?:visual(?:_|$)|camera(?:_|$)|shot(?:_|$)|b_?roll(?:_|$)|palette$|typography$)/i;
const V11_TOP_LEVEL_KEYS = new Set([
  "schema_version", "profile_id", "display_name", "domain", "status", "approval", "corpus",
  "selector_signals", "communication_persona", "content_strategy", "content_types", "frameworks",
  "attention_rhythm", "patterns", "avoid_patterns", "boundaries", "rewrite_interface",
  "generation_interface", "limitations",
]);
const V10_TOP_LEVEL_KEYS = new Set([
  "schema_version", "profile_id", "display_name", "domain", "status", "approval", "corpus",
  "content_types", "frameworks", "patterns", "boundaries", "rewrite_interface", "limitations",
]);
const V11_APPROVAL_KEYS = new Set([
  "state", "requires_human_approval", "approved_by", "approved_at", "change_reason", "record_id",
  "generation_test_id", "candidate_profile_sha256", "approved_control_state_sha256", "evidence_bundle_sha256", "generation_test_sha256",
  "generation_output_set_sha256",
]);
const GENERATION_TEST_KEYS = new Set([
  "schema_version", "test_id", "profile_id", "profile_schema_version", "candidate_profile_sha256",
  "mode", "state", "cases", "human_review", "limitations",
]);
const GENERATION_CASE_KEYS = new Set([
  "case_id", "case_type", "target_framework_id", "fallback_beat_ids", "expected_selection",
  "applied_controls", "artifacts",
]);
const EXPECTED_SELECTION_KEYS = new Set(["abstained", "content_type_id", "framework_id"]);
const APPLIED_CONTROL_KEYS = new Set(["persona_rule_ids", "strategy_rule_ids", "attention_stage_ids"]);
const SELECTOR_KEYS = new Set(["requires_all", "prefers_any", "excludes_any", "abstain_when", "priority"]);
const APPLICATION_CONTROL_KEYS = new Set(["positions", "min_per_script", "max_per_script", "avoid_adjacent_repeat"]);
const V11_BEAT_KEYS = new Set([
  "id", "role", "required", "purpose", "input_slots", "transformation_rule", "generation_instruction",
  "audience_effect", "preserve", "fallback",
]);
const CASE_ARTIFACT_KEYS = new Set([
  "input_path", "input_sha256", "content_contract_path", "content_contract_sha256",
  "output_path", "output_sha256", "output_audit_path", "output_audit_sha256",
]);
const HUMAN_REVIEW_KEYS = new Set(["state", "reviewer_type", "reviewer", "reviewed_at", "case_reviews", "notes"]);
const CASE_REVIEW_KEYS = new Set([
  "case_id", "no_new_facts", "no_style_source_facts", "style_similarity_accepted", "overfit_absent", "notes",
]);
const CONTENT_CONTRACT_KEYS = new Set(["schema_version", "contract_id", "case_id", "input_sha256", "content", "immutable_values"]);
const OUTPUT_AUDIT_KEYS = new Set([
  "schema_version", "case_id", "output_sha256", "relation_observations", "pattern_applications",
  "avoidance_findings", "new_fact_findings", "style_source_fact_findings", "reviewer_type", "reviewer",
  "reviewed_at", "notes",
]);
const APPROVAL_RECORD_KEYS = new Set([
  "record_id", "profile_id", "generation_test_id", "decision_source", "candidate_profile_sha256",
  "approved_control_state_sha256", "evidence_bundle_sha256", "generation_test_sha256", "generation_output_set_sha256", "decision",
  "reviewer_type", "reviewer", "decided_at", "change_reason", "checklist",
]);
const CONTROL_PRECEDENCE = [
  "boundaries_and_content_locks",
  "selector_abstention",
  "avoid_patterns",
  "framework",
  "communication_persona_and_content_strategy",
  "attention_rhythm",
  "patterns",
];
const INTENDED_AUDIENCE_EFFECTS = new Set([
  "establish_relevance", "create_curiosity", "set_expectation", "reduce_uncertainty",
  "increase_clarity", "reset_attention", "support_trust", "prompt_action", "leave_reflection", "unknown",
]);
const INFORMATION_ROLES = new Set([
  "core_claim", "scope_preview", "risk_boundary", "method_step", "reason", "proof_of_claim",
  "example", "transition", "interaction", "cta", "reflection", "none", "unknown",
]);

export const normalizeText = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[\s\p{P}\p{S}]/gu, "")
  .trim();

const lineAt = (text, index) => text.slice(0, index).split("\n").length;
const cleanHeading = (value) => value.replace(/[\*`#]/g, "").trim();
const characterCount = (value) => normalizeText(value).length;
const estimateSeconds = (count, charsPerMinute = 240) => Math.max(1, Math.round((count / charsPerMinute) * 60));
const maskYamlFrontmatter = (text) => {
  if (!/^---\s*\n/.test(text)) return text;
  const closing = /^---\s*$/gm;
  closing.lastIndex = text.indexOf("\n") + 1;
  const match = closing.exec(text);
  if (!match) return text;
  const end = match.index + match[0].length;
  return text.slice(0, end).replace(/[^\n]/g, " ") + text.slice(end);
};

const makeUnit = ({ corpusId, ordinal, title, sourceLocator, lineStart, lineEnd, text, charsPerMinute }) => {
  const count = characterCount(text);
  return {
    id: `${corpusId}:u${String(ordinal).padStart(2, "0")}`,
    ordinal,
    title: title || `样本 ${ordinal}`,
    source_locator: sourceLocator,
    source_line_start: lineStart,
    source_line_end: lineEnd,
    character_count: count,
    estimated_seconds: estimateSeconds(count, charsPerMinute),
    text: text.trim(),
  };
};

const segmentSingleFile = (filePath, corpusId, charsPerMinute) => {
  const text = maskYamlFrontmatter(fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n"));
  const h2Matches = [...text.matchAll(/^##\s+(.+?)\s*$/gm)];
  if (h2Matches.length > 0) {
    return h2Matches.map((match, index) => {
      const headingEnd = match.index + match[0].length;
      const nextStart = h2Matches[index + 1]?.index ?? text.length;
      return makeUnit({
        corpusId,
        ordinal: index + 1,
        title: cleanHeading(match[1]),
        sourceLocator: filePath,
        lineStart: lineAt(text, match.index),
        lineEnd: lineAt(text, Math.max(headingEnd, nextStart - 1)),
        text: text.slice(headingEnd, nextStart),
        charsPerMinute,
      });
    });
  }

  const separator = /^\s*---+\s*$/gm;
  const separatorMatches = [...text.matchAll(separator)];
  if (separatorMatches.length > 0) {
    const boundaries = [0, ...separatorMatches.map((match) => match.index + match[0].length), text.length];
    const parts = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = index < separatorMatches.length ? separatorMatches[index].index : boundaries[index + 1];
      const body = text.slice(start, end).trim();
      if (!body) continue;
      const firstLine = body.split("\n").find((line) => line.trim()) || `样本 ${parts.length + 1}`;
      parts.push(makeUnit({
        corpusId,
        ordinal: parts.length + 1,
        title: cleanHeading(firstLine).slice(0, 80),
        sourceLocator: filePath,
        lineStart: lineAt(text, start),
        lineEnd: lineAt(text, Math.max(start, end - 1)),
        text: body,
        charsPerMinute,
      }));
    }
    return parts;
  }

  return [makeUnit({
    corpusId,
    ordinal: 1,
    title: path.basename(filePath, path.extname(filePath)),
    sourceLocator: filePath,
    lineStart: 1,
    lineEnd: text.split("\n").length,
    text,
    charsPerMinute,
  })];
};

export const readCorpus = (sourcePath, { corpusId, charsPerMinute = 240 } = {}) => {
  if (!corpusId) throw new Error("缺少 corpusId。 ");
  const resolved = path.resolve(sourcePath);
  const stat = fs.statSync(resolved);
  let units;
  let strategy;
  if (stat.isDirectory()) {
    const files = fs.readdirSync(resolved)
      .map((name) => path.join(resolved, name))
      .filter((candidate) => fs.statSync(candidate).isFile() && TEXT_EXTENSIONS.has(path.extname(candidate).toLowerCase()))
      .sort((left, right) => left.localeCompare(right, "zh-CN"));
    if (files.length === 0) throw new Error("目录中没有 Markdown/TXT 语料。 ");
    units = files.map((filePath, index) => {
      const text = maskYamlFrontmatter(fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n"));
      return makeUnit({
        corpusId,
        ordinal: index + 1,
        title: path.basename(filePath, path.extname(filePath)),
        sourceLocator: filePath,
        lineStart: 1,
        lineEnd: text.split("\n").length,
        text,
        charsPerMinute,
      });
    });
    strategy = "one_file_per_unit";
  } else {
    units = segmentSingleFile(resolved, corpusId, charsPerMinute);
    strategy = units.length > 1 && fs.readFileSync(resolved, "utf8").match(/^##\s+/m)
      ? "markdown_h2_units"
      : units.length > 1 ? "horizontal_rule_units" : "single_file_unit";
  }
  return {
    corpus_id: corpusId,
    source_root: resolved,
    segmentation: { strategy, chars_per_minute: charsPerMinute, title_counts_as_unit: false },
    units,
  };
};

export const publicManifest = (corpus) => ({
  corpus_id: corpus.corpus_id,
  source_root: corpus.source_root,
  segmentation: corpus.segmentation,
  unit_count: corpus.units.length,
  units: corpus.units.map(({ text, ...unit }) => unit),
});

const ngrams = (value, size = 4) => {
  const normalized = normalizeText(value);
  const result = new Set();
  for (let index = 0; index <= normalized.length - size; index += 1) result.add(normalized.slice(index, index + size));
  return result;
};

const jaccard = (left, right) => {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
};

const percentile = (numbers, ratio) => {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
};

const buildDuplicateClusters = (unitIds, pairs) => {
  const parent = new Map(unitIds.map((id) => [id, id]));
  const find = (id) => {
    const current = parent.get(id);
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  for (const pair of pairs) union(pair.left_unit_id, pair.right_unit_id);
  const groups = new Map();
  for (const id of unitIds) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) || []), id]);
  }
  return [...groups.values()]
    .filter((ids) => ids.length > 1)
    .map((ids, index) => ({ cluster_id: `duplicate-candidate-${String(index + 1).padStart(2, "0")}`, unit_ids: ids }));
};

export const assessHealth = (corpus, { nearDuplicateThreshold = 0.52, openingLength = 18 } = {}) => {
  const unitGrams = corpus.units.map((unit) => ({ id: unit.id, grams: ngrams(unit.text) }));
  const pairs = [];
  for (let left = 0; left < unitGrams.length; left += 1) {
    for (let right = left + 1; right < unitGrams.length; right += 1) {
      const similarity = Number(jaccard(unitGrams[left].grams, unitGrams[right].grams).toFixed(3));
      if (similarity >= nearDuplicateThreshold) {
        pairs.push({ left_unit_id: unitGrams[left].id, right_unit_id: unitGrams[right].id, similarity });
      }
    }
  }

  const openings = new Map();
  for (const unit of corpus.units) {
    const key = normalizeText(unit.text).slice(0, openingLength);
    if (!key) continue;
    openings.set(key, [...(openings.get(key) || []), unit.id]);
  }
  const repeatedOpenings = [...openings.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) => ({ unit_ids: ids, count: ids.length }));
  const lengths = corpus.units.map((unit) => unit.character_count);
  const tooShort = corpus.units.filter((unit) => unit.character_count < 180).map((unit) => unit.id);
  const duplicateClusters = buildDuplicateClusters(corpus.units.map((unit) => unit.id), pairs);
  const warnings = [];
  if (pairs.length > 0) warnings.push("发现近重复候选；必须人工决定是否为同一内容的转写或版本。 ");
  if (repeatedOpenings.length > 0) warnings.push("发现重复开场候选；不得自动当作可剥离模板。 ");
  if (tooShort.length > 0) warnings.push("存在过短样本；不能单独支撑候选规则。 ");
  if (corpus.units.length < 3) warnings.push("样本少于 3 条，只能生成探索性观察。 ");
  return {
    unit_count: corpus.units.length,
    character_distribution: {
      min: lengths.length ? Math.min(...lengths) : 0,
      p50: percentile(lengths, 0.5),
      max: lengths.length ? Math.max(...lengths) : 0,
      total: lengths.reduce((sum, value) => sum + value, 0),
    },
    near_duplicate_pairs: pairs,
    suggested_duplicate_clusters: duplicateClusters,
    repeated_opening_groups: repeatedOpenings,
    too_short_unit_ids: tooShort,
    grade: warnings.length > 0 ? "warning" : "healthy",
    warnings,
    human_decision_required: duplicateClusters.length > 0 || repeatedOpenings.length > 0,
  };
};

export const buildScaffold = (corpus, health) => {
  const duplicateUnitIds = new Set(health.suggested_duplicate_clusters.flatMap((cluster) => cluster.unit_ids));
  const decisions = {
    schema_version: "1.1-draft",
    corpus_id: corpus.corpus_id,
    state: "draft",
    duplicate_decisions: health.suggested_duplicate_clusters.map((cluster) => ({
      ...cluster,
      decision: "unresolved",
      retained_unit_ids: [],
      note: "",
    })),
    repeated_opening_decisions: health.repeated_opening_groups.map((group, index) => ({
      candidate_id: `opening-candidate-${String(index + 1).padStart(2, "0")}`,
      unit_ids: group.unit_ids,
      decision: "unresolved",
      note: "",
    })),
    excluded_unit_ids: [],
    reviewer_type: null,
    record_id: null,
    approved_by: null,
    approved_at: null,
  };
  const annotations = {
    schema_version: "1.1-draft",
    corpus_id: corpus.corpus_id,
    state: "draft",
    units: corpus.units.map((unit) => ({
      unit_id: unit.id,
      independence_cluster_id: duplicateUnitIds.has(unit.id) ? null : `independent:${unit.id}`,
      include_in_fusion: duplicateUnitIds.has(unit.id) ? null : true,
      content_type_id: null,
      transcript_quality: "unknown",
      anchors: [],
    })),
    claims: [],
    materials: [],
    unresolved_questions: [],
  };
  return { decisions, annotations };
};

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const addError = (errors, location, message) => errors.push(`${location}: ${message}`);
const validateExactKeys = (value, allowedKeys, errors, location) => {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) if (!allowedKeys.has(key)) addError(errors, `${location}.${key}`, "未知字段");
};
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};
const sha256Json = (value) => `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
const candidateProjection = (profile) => {
  const projected = structuredClone(profile);
  projected.schema_version = "1.1-draft";
  projected.status = "draft";
  projected.approval = {
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
  };
  const collections = [
    projected.communication_persona,
    projected.content_strategy,
    projected.content_types,
    projected.frameworks,
    projected.attention_rhythm?.stages,
    projected.patterns,
    projected.avoid_patterns,
  ];
  for (const collection of collections) {
    for (const item of collection || []) {
      if (item.status === "approved") {
        item.status = "candidate";
        item.availability = "profile_approval_required";
      }
    }
  }
  return projected;
};
export const profileCandidateSha256 = (profile) => sha256Json(isV11Profile(profile) && profile.status === "approved" ? candidateProjection(profile) : profile);
const controlStateProjection = (profile) => ({
  schema_version: profile?.schema_version,
  profile_status: profile?.status,
  collections: {
    communication_persona: (profile?.communication_persona || []).map(({ id, status, availability }) => ({ id, status, availability })),
    content_strategy: (profile?.content_strategy || []).map(({ id, status, availability }) => ({ id, status, availability })),
    content_types: (profile?.content_types || []).map(({ id, status, availability }) => ({ id, status, availability })),
    frameworks: (profile?.frameworks || []).map(({ id, status, availability }) => ({ id, status, availability })),
    attention_rhythm_stages: (profile?.attention_rhythm?.stages || []).map(({ id, status, availability }) => ({ id, status, availability })),
    patterns: (profile?.patterns || []).map(({ id, status, availability }) => ({ id, status, availability })),
    avoid_patterns: (profile?.avoid_patterns || []).map(({ id, status, availability }) => ({ id, status, availability })),
  },
});
export const approvedControlStateSha256 = (profile) => sha256Json(controlStateProjection(profile));
export const generationTestSha256 = (generationTest) => sha256Json(generationTest);
export const evidenceBundleSha256 = (evidenceBundle) => sha256Json(evidenceBundle);
export const generationOutputSetSha256 = (generationTest) => sha256Json((generationTest?.cases || [])
  .map((item) => item?.artifacts?.output_sha256)
  .filter(nonEmptyString)
  .sort());
const sha256File = (filePath) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
const looksAutomatedReviewer = (value) => /(?:^|[\s_-])(ai|assistant|codex|chatgpt|openai|claude|gemini|llm|model|self)(?:$|[\s_-])|人工智能|机器人|模型/i.test(String(value || ""));
const validHumanReviewer = (reviewerType, reviewer) => reviewerType === "human" && nonEmptyString(reviewer) && !looksAutomatedReviewer(reviewer);
const isIsoTimestamp = (value) => nonEmptyString(value)
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  && !Number.isNaN(Date.parse(value));
const isV11Profile = (profile) => /^1\.1(?:-|$)/.test(profile?.schema_version || "");
const additionalControlItems = (profile) => [
  ...(profile.communication_persona || []),
  ...(profile.content_strategy || []),
  ...(profile.attention_rhythm?.stages || []),
  ...(profile.avoid_patterns || []),
];
const containsCandidateOrApproved = (profile) => [
  ...(profile.content_types || []),
  ...(profile.frameworks || []),
  ...(profile.patterns || []),
  ...additionalControlItems(profile),
].some((item) => ["candidate", "approved"].includes(item?.status));
const containsEvidenceClaims = (profile) => [
  ...(profile.content_types || []).map((item) => item?.evidence?.length > 0),
  ...(profile.frameworks || []).map((item) => item?.evidence_paths?.length > 0),
  ...(profile.patterns || []).map((item) => item?.evidence?.length > 0),
  ...additionalControlItems(profile).map((item) => item?.evidence?.length > 0),
].some(Boolean);

const scanForbiddenKeys = (value, errors, location = "profile") => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, errors, `${location}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key.toLowerCase())) addError(errors, `${location}.${key}`, "公开 DNA 禁止保存来源载荷字段");
    if (VISUAL_NAMESPACE_KEY.test(key)) addError(errors, `${location}.${key}`, "纯文本 profile 禁止声明视觉、镜头或排版风格命名空间");
    scanForbiddenKeys(child, errors, `${location}.${key}`);
  }
};

const validateEvidence = (evidence, errors, location, corpusIndex = null, evidenceIndex = null, requireFusion = false) => {
  if (!Array.isArray(evidence)) {
    addError(errors, location, "evidence 必须是数组");
    return [];
  }
  for (const [index, item] of evidence.entries()) {
    const itemLocation = `${location}[${index}]`;
    if (!isObject(item)) {
      addError(errors, itemLocation, "证据必须是对象");
      continue;
    }
    for (const key of ["unit_id", "independence_cluster_id", "anchor_id", "function"]) {
      if (!nonEmptyString(item[key])) addError(errors, `${itemLocation}.${key}`, "必填字符串缺失");
    }
    if (typeof item.position !== "number" || item.position < 0 || item.position > 1) {
      addError(errors, `${itemLocation}.position`, "必须是 0–1 的相对位置");
    }
    if (corpusIndex && nonEmptyString(item.unit_id) && nonEmptyString(item.independence_cluster_id)) {
      if (!corpusIndex.includedUnitIds.has(item.unit_id)) {
        addError(errors, `${itemLocation}.unit_id`, "证据 unit 不在 included_unit_ids 中");
      } else if (corpusIndex.clusterByUnit.get(item.unit_id) !== item.independence_cluster_id) {
        addError(errors, `${itemLocation}.independence_cluster_id`, "证据 cluster 与 corpus 映射不一致");
      }
    }
    if (evidenceIndex && nonEmptyString(item.unit_id) && nonEmptyString(item.anchor_id)) {
      const annotatedUnit = evidenceIndex.units.get(item.unit_id);
      if (!annotatedUnit) {
        addError(errors, `${itemLocation}.unit_id`, "证据 unit 不在 annotations 中");
      } else {
        if (requireFusion && annotatedUnit.include_in_fusion !== true) addError(errors, `${itemLocation}.unit_id`, "候选/批准证据必须来自 include_in_fusion=true 的单元");
        if (annotatedUnit.independence_cluster_id !== item.independence_cluster_id) addError(errors, `${itemLocation}.independence_cluster_id`, "证据 cluster 与 annotations 不一致");
        if (!annotatedUnit.anchorIds.has(item.anchor_id)) addError(errors, `${itemLocation}.anchor_id`, "证据锚点不在 annotations 中");
      }
    }
  }
  return evidence.filter(isObject);
};

const validateStatus = (item, errors, location) => {
  if (!ALLOWED_STATUSES.has(item.status)) addError(errors, `${location}.status`, "未知状态");
  if (EXPECTED_AVAILABILITY[item.status] !== item.availability) {
    addError(errors, `${location}.availability`, `${item.status} 必须使用 ${EXPECTED_AVAILABILITY[item.status]}`);
  }
};

const independentSupport = (evidence) => new Set(evidence.map((item) => item.independence_cluster_id).filter(Boolean)).size;

const validateRuleLike = (item, errors, location, corpusIndex = null, evidenceIndex = null) => {
  if (!isObject(item)) {
    addError(errors, location, "条目必须是对象");
    return;
  }
  for (const key of ["id", "name", "status", "availability"]) {
    if (!nonEmptyString(item[key])) addError(errors, `${location}.${key}`, "必填字符串缺失");
  }
  validateStatus(item, errors, location);
  const evidence = validateEvidence(item.evidence, errors, `${location}.evidence`, corpusIndex, evidenceIndex, ["candidate", "approved"].includes(item.status));
  if (["candidate", "approved"].includes(item.status) && independentSupport(evidence) < 2) {
    addError(errors, `${location}.evidence`, "candidate/approved 至少需要两个独立样本簇");
  }
};

const validateStringArray = (value, errors, location, { allowEmpty = true } = {}) => {
  if (!Array.isArray(value) || value.some((item) => !nonEmptyString(item))) {
    addError(errors, location, "必须是字符串数组");
    return [];
  }
  if (!allowEmpty && value.length === 0) addError(errors, location, "不得为空");
  return value;
};

const validateSelector = (selector, errors, location, { framework = false, signalIds = null } = {}) => {
  if (!isObject(selector)) {
    addError(errors, location, "缺少 machine-readable selector");
    return;
  }
  validateExactKeys(selector, SELECTOR_KEYS, errors, location);
  const arrays = {};
  for (const key of ["requires_all", "prefers_any", "excludes_any", "abstain_when"]) {
    arrays[key] = validateStringArray(selector[key], errors, `${location}.${key}`);
    if (new Set(arrays[key]).size !== arrays[key].length) addError(errors, `${location}.${key}`, "不得包含重复项");
  }
  const machineKeys = ["requires_all", "prefers_any", "excludes_any"];
  for (let left = 0; left < machineKeys.length; left += 1) {
    const leftKey = machineKeys[left];
    const leftValues = new Set(arrays[leftKey]);
    for (let right = left + 1; right < machineKeys.length; right += 1) {
      const rightKey = machineKeys[right];
      for (const signal of arrays[rightKey]) if (leftValues.has(signal)) addError(errors, location, `同一信号不能同时出现在 ${leftKey}/${rightKey}：${signal}`);
    }
  }
  if (signalIds) {
    for (const key of ["requires_all", "prefers_any", "excludes_any"]) {
      for (const signal of selector[key] || []) if (!signalIds.has(signal)) addError(errors, `${location}.${key}`, `引用未知 selector signal：${signal}`);
    }
  }
  if ((!Number.isInteger(selector.priority) || selector.priority < 0 || selector.priority > 100)) {
    addError(errors, `${location}.priority`, "必须是 0–100 的整数");
  }
};

const getPathValue = (value, sourcePath) => {
  const parts = sourcePath.split(".").filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (!isObject(current) && !Array.isArray(current)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = current[part];
  }
  return current;
};

const validateSignalCatalog = (signals, errors, location) => {
  if (!Array.isArray(signals)) {
    addError(errors, location, "必须是数组");
    return new Set();
  }
  const ids = new Set();
  signals.forEach((signal, index) => {
    const itemLocation = `${location}[${index}]`;
    if (!isObject(signal)) {
      addError(errors, itemLocation, "signal 必须是对象");
      return;
    }
    for (const key of ["id", "source_path", "operator", "description"]) {
      if (!nonEmptyString(signal[key])) addError(errors, `${itemLocation}.${key}`, "必填字符串缺失");
    }
    if (!/^[a-z][a-z0-9_.-]*$/.test(signal.id || "")) addError(errors, `${itemLocation}.id`, "必须是稳定的小写 signal ID");
    if (ids.has(signal.id)) addError(errors, `${itemLocation}.id`, "signal ID 重复");
    ids.add(signal.id);
    if (!ALLOWED_SIGNAL_OPERATORS.has(signal.operator)) addError(errors, `${itemLocation}.operator`, "未知 operator");
    if (["equals", "not_equals", "number_gte", "number_lte"].includes(signal.operator) && signal.value === undefined) {
      addError(errors, `${itemLocation}.value`, "该 operator 必须提供 value");
    }
    if (["number_gte", "number_lte"].includes(signal.operator) && typeof signal.value !== "number") addError(errors, `${itemLocation}.value`, "数值 operator 必须使用 number value");
  });
  return ids;
};

const evaluateSignal = (signal, content) => {
  const value = getPathValue(content, signal.source_path);
  if (signal.operator === "exists") return value !== undefined && value !== null && value !== "";
  if (signal.operator === "missing") return value === undefined || value === null || value === "";
  if (signal.operator === "nonempty_array") return Array.isArray(value) && value.length > 0;
  if (signal.operator === "empty_array") return Array.isArray(value) && value.length === 0;
  if (value === undefined || value === null) return false;
  if (signal.operator === "equals") return value === signal.value;
  if (signal.operator === "not_equals") return value !== signal.value;
  if (signal.operator === "number_gte") return typeof value === "number" && value >= signal.value;
  if (signal.operator === "number_lte") return typeof value === "number" && value <= signal.value;
  return false;
};

const selectorRank = (item, evaluatedSignals) => {
  const selector = item.selector || {};
  const requiredPass = (selector.requires_all || []).every((id) => evaluatedSignals.get(id) === true);
  const excludedHit = (selector.excludes_any || []).some((id) => evaluatedSignals.get(id) === true);
  if (!requiredPass || excludedHit) return null;
  return {
    item,
    priority: selector.priority,
    preferred: new Set((selector.prefers_any || []).filter((id) => evaluatedSignals.get(id) === true)).size,
  };
};

const pickUniqueSelectorMatch = (items, evaluatedSignals) => {
  const ranked = items.map((item) => selectorRank(item, evaluatedSignals)).filter(Boolean)
    .sort((left, right) => right.priority - left.priority || right.preferred - left.preferred || left.item.id.localeCompare(right.item.id));
  if (ranked.length === 0) return { item: null, reason: "no_match" };
  if (ranked.length > 1 && ranked[0].priority === ranked[1].priority && ranked[0].preferred === ranked[1].preferred) {
    return { item: null, reason: "ambiguous_tie" };
  }
  return { item: ranked[0].item, reason: "matched" };
};

export const resolveFrameworkSelection = (profile, content) => {
  const evaluatedSignals = new Map((profile.selector_signals || []).map((signal) => [signal.id, evaluateSignal(signal, content)]));
  const formal = profile.status === "approved";
  const eligible = (item) => formal ? item.status === "approved" && item.availability === "selectable" : item.status === "candidate" || item.status === "approved";
  const contentPick = pickUniqueSelectorMatch((profile.content_types || []).filter(eligible), evaluatedSignals);
  if (!contentPick.item) return { abstained: true, content_type_id: null, framework_id: null, reason: `content_type:${contentPick.reason}`, evaluated_signals: Object.fromEntries(evaluatedSignals) };
  const frameworkPick = pickUniqueSelectorMatch((profile.frameworks || []).filter((item) => eligible(item) && item.content_type_id === contentPick.item.id), evaluatedSignals);
  if (!frameworkPick.item) return { abstained: true, content_type_id: contentPick.item.id, framework_id: null, reason: `framework:${frameworkPick.reason}`, evaluated_signals: Object.fromEntries(evaluatedSignals) };
  return { abstained: false, content_type_id: contentPick.item.id, framework_id: frameworkPick.item.id, reason: "matched", evaluated_signals: Object.fromEntries(evaluatedSignals) };
};

const validateGenerationControlRule = (item, errors, location, discriminatorKey, allowedDiscriminators, corpusIndex = null, evidenceIndex = null) => {
  validateRuleLike(item, errors, location, corpusIndex, evidenceIndex);
  for (const key of [discriminatorKey, "definition", "generation_instruction", "applicability", "non_applicability", "risk"]) {
    if (!nonEmptyString(item?.[key])) addError(errors, `${location}.${key}`, "必填字符串缺失");
  }
  if (nonEmptyString(item?.[discriminatorKey]) && !allowedDiscriminators.has(item[discriminatorKey])) {
    addError(errors, `${location}.${discriminatorKey}`, `未知 ${discriminatorKey}：${item[discriminatorKey]}`);
  }
};

const validateApplicationControl = (control, errors, location, status) => {
  if (!isObject(control)) {
    addError(errors, location, "缺少 application_control");
    return;
  }
  validateExactKeys(control, APPLICATION_CONTROL_KEYS, errors, location);
  const positions = validateStringArray(control.positions, errors, `${location}.positions`, { allowEmpty: false });
  if (new Set(positions).size !== positions.length) addError(errors, `${location}.positions`, "不得包含重复项");
  for (const position of positions) if (!ALLOWED_PATTERN_POSITIONS.has(position)) addError(errors, `${location}.positions`, `未知 position：${position}`);
  for (const key of ["min_per_script", "max_per_script"]) {
    if (!Number.isInteger(control[key]) || control[key] < 0) addError(errors, `${location}.${key}`, "必须是非负整数");
  }
  if (Number.isInteger(control.min_per_script) && Number.isInteger(control.max_per_script) && control.min_per_script > control.max_per_script) {
    addError(errors, location, "min_per_script 不能大于 max_per_script");
  }
  if (["candidate", "approved"].includes(status) && control.max_per_script < 1) addError(errors, `${location}.max_per_script`, "candidate/approved 至少允许使用 1 次");
  if (typeof control.avoid_adjacent_repeat !== "boolean") addError(errors, `${location}.avoid_adjacent_repeat`, "必须是布尔值");
};

const validateFramework = (framework, errors, location, corpusIndex = null, evidenceIndex = null, v11 = false, signalIds = null) => {
  if (!isObject(framework)) {
    addError(errors, location, "框架必须是对象");
    return;
  }
  for (const key of ["id", "name", "content_type_id", "status", "availability", "when_to_use", "do_not_use"]) {
    if (!nonEmptyString(framework[key])) addError(errors, `${location}.${key}`, "必填字符串缺失");
  }
  validateStatus(framework, errors, location);
  if (v11) validateSelector(framework.selector, errors, `${location}.selector`, { framework: true, signalIds });
  if (!Array.isArray(framework.beats) || framework.beats.length < 2) {
    addError(errors, `${location}.beats`, "框架至少需要两个节拍；单一动作应建为 pattern");
    return;
  }
  const beatOrder = new Map();
  framework.beats.forEach((beat, index) => {
    const beatLocation = `${location}.beats[${index}]`;
    if (!isObject(beat)) {
      addError(errors, beatLocation, "节拍必须是对象");
      return;
    }
    if (v11) validateExactKeys(beat, V11_BEAT_KEYS, errors, beatLocation);
    const requiredKeys = ["id", "role", "purpose", "transformation_rule", "fallback"];
    if (v11) requiredKeys.push("generation_instruction", "audience_effect");
    for (const key of requiredKeys) {
      if (!nonEmptyString(beat[key])) addError(errors, `${beatLocation}.${key}`, "必填字符串缺失");
    }
    if (v11 && !INTENDED_AUDIENCE_EFFECTS.has(beat.audience_effect)) addError(errors, `${beatLocation}.audience_effect`, "必须是固定 intended-effect 标签");
    if (typeof beat.required !== "boolean") addError(errors, `${beatLocation}.required`, "必须是布尔值");
    validateStringArray(beat.input_slots, errors, `${beatLocation}.input_slots`);
    validateStringArray(beat.preserve, errors, `${beatLocation}.preserve`);
    if (beatOrder.has(beat.id)) addError(errors, `${beatLocation}.id`, "节拍 ID 重复");
    beatOrder.set(beat.id, index);
  });

  if (!Array.isArray(framework.evidence_paths)) {
    addError(errors, `${location}.evidence_paths`, "必须是数组");
    return;
  }
  const validPaths = [];
  framework.evidence_paths.forEach((evidencePath, pathIndex) => {
    const pathLocation = `${location}.evidence_paths[${pathIndex}]`;
    if (!isObject(evidencePath)) {
      addError(errors, pathLocation, "路径必须是对象");
      return;
    }
    for (const key of ["unit_id", "independence_cluster_id"]) {
      if (!nonEmptyString(evidencePath[key])) addError(errors, `${pathLocation}.${key}`, "必填字符串缺失");
    }
    if (corpusIndex && nonEmptyString(evidencePath.unit_id) && nonEmptyString(evidencePath.independence_cluster_id)) {
      if (!corpusIndex.includedUnitIds.has(evidencePath.unit_id)) {
        addError(errors, `${pathLocation}.unit_id`, "路径 unit 不在 included_unit_ids 中");
      } else if (corpusIndex.clusterByUnit.get(evidencePath.unit_id) !== evidencePath.independence_cluster_id) {
        addError(errors, `${pathLocation}.independence_cluster_id`, "路径 cluster 与 corpus 映射不一致");
      }
    }
    if (evidenceIndex && nonEmptyString(evidencePath.unit_id)) {
      const annotatedUnit = evidenceIndex.units.get(evidencePath.unit_id);
      if (!annotatedUnit) addError(errors, `${pathLocation}.unit_id`, "路径 unit 不在 annotations 中");
      else {
        if (["candidate", "approved"].includes(framework.status) && annotatedUnit.include_in_fusion !== true) addError(errors, `${pathLocation}.unit_id`, "候选/批准路径必须来自 include_in_fusion=true 的单元");
        if (annotatedUnit.independence_cluster_id !== evidencePath.independence_cluster_id) addError(errors, `${pathLocation}.independence_cluster_id`, "路径 cluster 与 annotations 不一致");
      }
    }
    if (!Array.isArray(evidencePath.beats)) {
      addError(errors, `${pathLocation}.beats`, "必须是数组");
      return;
    }
    let previousOrdinal = -Infinity;
    let previousDefinitionIndex = -Infinity;
    const seen = new Set();
    for (const [beatIndex, pathBeat] of evidencePath.beats.entries()) {
      const beatLocation = `${pathLocation}.beats[${beatIndex}]`;
      if (!isObject(pathBeat) || !nonEmptyString(pathBeat.beat_id) || !nonEmptyString(pathBeat.anchor_id)) {
        addError(errors, beatLocation, "需要 beat_id 和 anchor_id");
        continue;
      }
      if (!Number.isInteger(pathBeat.ordinal) || pathBeat.ordinal < 1) addError(errors, `${beatLocation}.ordinal`, "必须是正整数");
      if (!beatOrder.has(pathBeat.beat_id)) addError(errors, `${beatLocation}.beat_id`, "引用了未知节拍");
      if (seen.has(pathBeat.beat_id)) addError(errors, `${beatLocation}.beat_id`, "同一路径重复节拍");
      seen.add(pathBeat.beat_id);
      const definitionIndex = beatOrder.get(pathBeat.beat_id);
      if (pathBeat.ordinal <= previousOrdinal || definitionIndex <= previousDefinitionIndex) {
        addError(errors, beatLocation, "路径顺序与框架节拍顺序不一致");
      }
      previousOrdinal = pathBeat.ordinal;
      previousDefinitionIndex = definitionIndex;
      if (evidenceIndex && nonEmptyString(evidencePath.unit_id)) {
        const annotatedUnit = evidenceIndex.units.get(evidencePath.unit_id);
        if (annotatedUnit && !annotatedUnit.anchorIds.has(pathBeat.anchor_id)) addError(errors, `${beatLocation}.anchor_id`, "路径锚点不在 annotations 中");
      }
    }
    validPaths.push(evidencePath);
  });

  if (["candidate", "approved"].includes(framework.status)) {
    const requiredBeatIds = new Set(framework.beats.filter((item) => item.required === true).map((item) => item.id));
    const completePaths = validPaths.filter((evidencePath) => {
      const present = new Set((evidencePath.beats || []).map((pathBeat) => pathBeat.beat_id));
      return [...requiredBeatIds].every((beatId) => present.has(beatId));
    });
    const clusters = new Set(completePaths.map((item) => item.independence_cluster_id).filter(Boolean));
    if (clusters.size < 2) addError(errors, `${location}.evidence_paths`, "候选/批准框架至少需要两个包含全部必需节拍的独立完整路径");
  }
};

const buildEvidenceIndex = (profile, evidenceBundle, errors, { requireResolved = false } = {}) => {
  if (!evidenceBundle) return null;
  const { manifest, health, decisions, annotations } = evidenceBundle;
  for (const [name, value] of Object.entries({ manifest, health, decisions, annotations })) {
    if (!isObject(value)) addError(errors, `evidence_bundle.${name}`, "缺少或不是 JSON 对象");
  }
  if (![manifest, decisions, annotations].every(isObject)) return null;
  if (isV11Profile(profile)) scanForbiddenKeys(annotations, errors, "evidence_bundle.annotations");
  for (const [name, value] of Object.entries({ manifest, decisions, annotations })) {
    if (value.corpus_id !== profile.corpus?.corpus_id) addError(errors, `evidence_bundle.${name}.corpus_id`, "与 profile corpus_id 不一致");
  }
  const manifestIds = (manifest.units || []).map((unit) => unit.id);
  const manifestUnitIds = new Set(manifestIds);
  if (manifestUnitIds.size !== manifestIds.length) addError(errors, "evidence_bundle.manifest.units", "manifest unit ID 不得重复");
  if (manifest.unit_count !== manifestUnitIds.size) addError(errors, "evidence_bundle.manifest.unit_count", "必须等于唯一 unit 数");
  const accountedUnitIds = new Set([...(profile.corpus?.included_unit_ids || []), ...(profile.corpus?.excluded_unit_ids || [])]);
  for (const unitId of manifestUnitIds) if (!accountedUnitIds.has(unitId)) addError(errors, "evidence_bundle.manifest", `manifest unit 未在 profile 记账：${unitId}`);
  for (const unitId of accountedUnitIds) if (!manifestUnitIds.has(unitId)) addError(errors, "evidence_bundle.manifest", `profile unit 不在 manifest：${unitId}`);
  for (const unitId of profile.corpus?.included_unit_ids || []) {
    if (!manifestUnitIds.has(unitId)) addError(errors, "evidence_bundle.manifest", `缺少 included unit：${unitId}`);
  }

  const units = new Map();
  for (const [index, unit] of (annotations.units || []).entries()) {
    const location = `evidence_bundle.annotations.units[${index}]`;
    if (!isObject(unit) || !nonEmptyString(unit.unit_id)) {
      addError(errors, location, "缺少 unit_id");
      continue;
    }
    if (units.has(unit.unit_id)) addError(errors, `${location}.unit_id`, "annotation unit 重复");
    const anchorIds = new Set();
    if (!Array.isArray(unit.anchors)) addError(errors, `${location}.anchors`, "必须是数组");
    for (const [anchorIndex, anchor] of (Array.isArray(unit.anchors) ? unit.anchors : []).entries()) {
      const anchorLocation = `${location}.anchors[${anchorIndex}]`;
      if (!isObject(anchor) || !nonEmptyString(anchor.anchor_id)) addError(errors, anchorLocation, "缺少 anchor_id");
      else if (anchorIds.has(anchor.anchor_id)) addError(errors, `${anchorLocation}.anchor_id`, "anchor ID 重复");
      else anchorIds.add(anchor.anchor_id);
      if (!isObject(anchor)) continue;
      if (anchor.unit_id !== unit.unit_id) addError(errors, `${anchorLocation}.unit_id`, "必须与所属 annotation unit 一致");
      if (typeof anchor.relative_position !== "number" || anchor.relative_position < 0 || anchor.relative_position > 1) addError(errors, `${anchorLocation}.relative_position`, "必须是 0–1");
      if (!nonEmptyString(anchor.function)) addError(errors, `${anchorLocation}.function`, "必填字符串缺失");
      if (!Array.isArray(anchor.relations) || anchor.relations.length === 0 || anchor.relations.some((item) => !nonEmptyString(item))) addError(errors, `${anchorLocation}.relations`, "必须是非空关系数组");
      if (isV11Profile(profile) && !INTENDED_AUDIENCE_EFFECTS.has(anchor.audience_effect)) addError(errors, `${anchorLocation}.audience_effect`, "必须使用 intended-effect 枚举");
      if (isV11Profile(profile) && !INFORMATION_ROLES.has(anchor.information_role)) addError(errors, `${anchorLocation}.information_role`, "必须使用 information-role 枚举");
      if (!new Set(["high", "medium", "low", "unknown"]).has(anchor.annotation_confidence)) addError(errors, `${anchorLocation}.annotation_confidence`, "必须是 high/medium/low/unknown");
    }
    units.set(unit.unit_id, {
      include_in_fusion: unit.include_in_fusion,
      independence_cluster_id: unit.independence_cluster_id,
      anchorIds,
    });
  }

  const unresolved = [];
  const allowedDecisions = new Set(["unresolved", "keep_separate", "merge_as_variant", "exclude"]);
  for (const collectionName of ["duplicate_decisions", "repeated_opening_decisions"]) {
    for (const item of decisions[collectionName] || []) {
      if (!allowedDecisions.has(item.decision)) addError(errors, `evidence_bundle.decisions.${collectionName}`, `非法 decision：${item.decision}`);
      if (!nonEmptyString(item.decision) || item.decision === "unresolved") unresolved.push(`${collectionName}:${item.cluster_id || item.candidate_id || "unknown"}`);
    }
  }
  const duplicateDecisionIds = (decisions.duplicate_decisions || []).map((item) => item.cluster_id);
  if (new Set(duplicateDecisionIds).size !== duplicateDecisionIds.length) addError(errors, "evidence_bundle.decisions.duplicate_decisions", "每个 duplicate candidate 必须恰有一个决定");
  const decisionByCluster = new Map((decisions.duplicate_decisions || []).map((item) => [item.cluster_id, item]));
  for (const cluster of health?.suggested_duplicate_clusters || []) {
    const decision = decisionByCluster.get(cluster.cluster_id);
    if (!decision) {
      unresolved.push(`duplicate_decisions:${cluster.cluster_id}:missing`);
      continue;
    }
    if (decision.decision === "merge_as_variant") {
      const includedMembers = cluster.unit_ids.filter((unitId) => profile.corpus?.included_unit_ids?.includes(unitId));
      const mappedClusters = new Set(includedMembers.map((unitId) => profile.corpus?.independence_clusters?.find((item) => item.unit_ids.includes(unitId))?.id).filter(Boolean));
      if (mappedClusters.size > 1) addError(errors, `evidence_bundle.decisions.${cluster.cluster_id}`, "merge_as_variant 的 included units 必须属于同一 cluster");
    }
    if (decision.decision === "exclude") {
      const retained = new Set(decision.retained_unit_ids || []);
      for (const unitId of cluster.unit_ids) {
        const shouldExclude = !retained.has(unitId);
        if (shouldExclude && !(profile.corpus?.excluded_unit_ids || []).includes(unitId)) addError(errors, `evidence_bundle.decisions.${cluster.cluster_id}`, `决定排除但 profile 未排除：${unitId}`);
      }
    }
  }
  const openingDecisionIds = (decisions.repeated_opening_decisions || []).map((item) => item.candidate_id);
  if (new Set(openingDecisionIds).size !== openingDecisionIds.length) addError(errors, "evidence_bundle.decisions.repeated_opening_decisions", "每个 opening candidate 必须恰有一个决定");
  const openingDecisionMap = new Map((decisions.repeated_opening_decisions || []).map((item) => [item.candidate_id, item]));
  for (const [index] of (health?.repeated_opening_groups || []).entries()) {
    const candidateId = `opening-candidate-${String(index + 1).padStart(2, "0")}`;
    if (!openingDecisionMap.has(candidateId)) unresolved.push(`repeated_opening_decisions:${candidateId}:missing`);
  }
  if (requireResolved && unresolved.length > 0) {
    for (const item of unresolved) addError(errors, "evidence_bundle.decisions", `存在未决样本决定：${item}`);
  }
  if (requireResolved && (decisions.duplicate_decisions?.length || decisions.repeated_opening_decisions?.length) > 0 && unresolved.length === 0) {
    if (decisions.reviewer_type !== "human" || !nonEmptyString(decisions.record_id) || !nonEmptyString(decisions.approved_by) || !isIsoTimestamp(decisions.approved_at)) {
      addError(errors, "evidence_bundle.decisions", "已解决的样本取舍必须有 human、record_id、reviewer 和 ISO 8601 时间");
    }
  }
  return { units, manifestUnitIds, unresolved };
};

const readBoundArtifact = (artifacts, pathKey, digestKey, baseDir, errors, location, { json = false, required = true } = {}) => {
  const relativePath = artifacts?.[pathKey];
  const expectedDigest = artifacts?.[digestKey];
  if (!nonEmptyString(relativePath) || !SHA256_FINGERPRINT.test(expectedDigest || "")) {
    if (required) addError(errors, location, `缺少 ${pathKey}/${digestKey}`);
    return null;
  }
  if (!baseDir) {
    addError(errors, location, "缺少 generation test 文件目录，无法重算 artifact digest");
    return null;
  }
  const resolved = path.resolve(baseDir, relativePath);
  const relativeToSuite = path.relative(path.resolve(baseDir), resolved);
  if (relativeToSuite.startsWith("..") || path.isAbsolute(relativeToSuite)) {
    addError(errors, `${location}.${pathKey}`, "artifact 必须位于 generation test 目录内");
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    addError(errors, `${location}.${pathKey}`, `artifact 不存在：${relativePath}`);
    return null;
  }
  const actualDigest = sha256File(resolved);
  if (actualDigest !== expectedDigest) addError(errors, `${location}.${digestKey}`, "与实际 artifact SHA-256 不一致");
  if (!json) return { path: resolved, digest: actualDigest, text: fs.readFileSync(resolved, "utf8") };
  try {
    return { path: resolved, digest: actualDigest, value: JSON.parse(fs.readFileSync(resolved, "utf8")) };
  } catch {
    addError(errors, `${location}.${pathKey}`, "artifact 不是有效 UTF-8 JSON");
    return null;
  }
};

const mapRelationValues = (items, errors, location) => {
  if (!Array.isArray(items)) {
    addError(errors, location, "必须是数组");
    return new Map();
  }
  const map = new Map();
  items.forEach((item, index) => {
    const itemLocation = `${location}[${index}]`;
    validateExactKeys(item, new Set(["relation", "value"]), errors, itemLocation);
    if (!isObject(item) || !nonEmptyString(item.relation) || item.value === undefined) {
      addError(errors, itemLocation, "需要 relation 和 value");
      return;
    }
    if (map.has(item.relation)) addError(errors, `${itemLocation}.relation`, "relation 重复");
    map.set(item.relation, item.value);
  });
  return map;
};

const outputPosition = (start, length) => {
  const ratio = length > 0 ? start / length : 0;
  return ratio < 0.2 ? "entry" : ratio < 0.8 ? "body" : "close";
};

const validateCaseArtifacts = (profile, generationCase, baseDir, referenceCorpus, errors, warnings, { strict = false } = {}) => {
  const location = `generation_test.cases[${generationCase.__index}]`;
  const artifacts = generationCase.artifacts;
  if (!isObject(artifacts)) {
    addError(errors, `${location}.artifacts`, "缺少 artifact 绑定");
    return { selection: null, patternIds: new Set(), avoidTriggered: new Set() };
  }
  const input = readBoundArtifact(artifacts, "input_path", "input_sha256", baseDir, errors, `${location}.artifacts`);
  const contractFile = readBoundArtifact(artifacts, "content_contract_path", "content_contract_sha256", baseDir, errors, `${location}.artifacts`, { json: true });
  const contract = contractFile?.value;
  if (!isObject(contract)) return { selection: null, patternIds: new Set(), avoidTriggered: new Set() };
  validateExactKeys(contract, CONTENT_CONTRACT_KEYS, errors, `${location}.content_contract`);
  if (contract.schema_version !== "1.0" || contract.case_id !== generationCase.case_id || !isObject(contract.content)) {
    addError(errors, `${location}.content_contract`, "需要 schema_version=1.0、匹配 case_id 和 content 对象");
  }
  if (!nonEmptyString(contract.contract_id) || !SHA256_FINGERPRINT.test(contract.input_sha256 || "")) {
    addError(errors, `${location}.content_contract`, "缺少稳定 contract_id 或有效 input_sha256");
  }
  if (input && contract.input_sha256 !== input.digest) addError(errors, `${location}.content_contract.input_sha256`, "必须绑定实际 input artifact");

  const selection = resolveFrameworkSelection(profile, contract.content || {});
  const expected = generationCase.expected_selection;
  if (!isObject(expected) || expected.abstained !== selection.abstained || (expected.content_type_id ?? null) !== selection.content_type_id || (expected.framework_id ?? null) !== selection.framework_id) {
    addError(errors, `${location}.expected_selection`, `与确定性 selector 结果不一致：${JSON.stringify(selection)}`);
  }
  if (generationCase.case_type === "positive" || generationCase.case_type === "fallback") {
    if (selection.abstained) addError(errors, `${location}.case_type`, "正例/fallback 不得 abstain");
    if (generationCase.target_framework_id !== selection.framework_id) addError(errors, `${location}.target_framework_id`, "必须等于 selector 选中的 framework");
    if (generationCase.case_type === "fallback") {
      const framework = (profile.frameworks || []).find((item) => item.id === selection.framework_id);
      const beatIds = new Set((framework?.beats || []).map((item) => item.id));
      for (const beatId of generationCase.fallback_beat_ids || []) if (!beatIds.has(beatId)) addError(errors, `${location}.fallback_beat_ids`, `引用未知 beat：${beatId}`);
    }
  }
  if (generationCase.case_type === "excluded") {
    if (!nonEmptyString(generationCase.target_framework_id)) addError(errors, `${location}.target_framework_id`, "excluded case 必须声明目标 framework");
    if (selection.framework_id === generationCase.target_framework_id) addError(errors, `${location}.expected_selection`, "excluded case 仍选中了被测 framework");
  }
  if (generationCase.case_type === "abstain" && !selection.abstained) addError(errors, `${location}.case_type`, "abstain case 必须实际 abstain");

  const selectedRuleIds = generationCase.applied_controls || {};
  validateExactKeys(selectedRuleIds, APPLIED_CONTROL_KEYS, errors, `${location}.applied_controls`);
  const eligible = (item) => profile.status === "approved" ? item.status === "approved" : ["candidate", "approved"].includes(item.status);
  for (const [key, collection] of [
    ["persona_rule_ids", profile.communication_persona || []],
    ["strategy_rule_ids", profile.content_strategy || []],
    ["attention_stage_ids", profile.attention_rhythm?.stages || []],
  ]) {
    const ids = validateStringArray(selectedRuleIds[key], errors, `${location}.applied_controls.${key}`);
    const index = new Map(collection.map((item) => [item.id, item]));
    for (const id of ids) if (!index.has(id) || !eligible(index.get(id))) addError(errors, `${location}.applied_controls.${key}`, `不可应用 observation/未知控制项：${id}`);
  }
  if (selection.abstained && Object.values(selectedRuleIds).some((ids) => Array.isArray(ids) && ids.length > 0)) {
    addError(errors, `${location}.applied_controls`, "selector abstain 后不得应用 persona/strategy/attention 控制");
  }

  const outputRequired = ["positive", "fallback"].includes(generationCase.case_type);
  if (!outputRequired && ["output_path", "output_sha256", "output_audit_path", "output_audit_sha256"].some((key) => artifacts[key] !== null)) {
    addError(errors, `${location}.artifacts`, "abstain/excluded case 不得产生输出或输出审计");
  }
  const output = readBoundArtifact(artifacts, "output_path", "output_sha256", baseDir, errors, `${location}.artifacts`, { required: outputRequired });
  const auditFile = readBoundArtifact(artifacts, "output_audit_path", "output_audit_sha256", baseDir, errors, `${location}.artifacts`, { json: true, required: outputRequired });
  if (!outputRequired) return { selection, patternIds: new Set(), avoidTriggered: new Set() };
  const audit = auditFile?.value;
  if (!output || !isObject(audit)) return { selection, patternIds: new Set(), avoidTriggered: new Set() };
  validateExactKeys(audit, OUTPUT_AUDIT_KEYS, errors, `${location}.output_audit`);
  if (!new Set(["1.0-draft", "1.0-reviewed"]).has(audit.schema_version) || audit.case_id !== generationCase.case_id || audit.output_sha256 !== output.digest) {
    addError(errors, `${location}.output_audit`, "audit 必须绑定 case_id 和实际 output SHA-256");
  }
  if (strict && (audit.schema_version !== "1.0-reviewed" || !validHumanReviewer(audit.reviewer_type, audit.reviewer) || !isIsoTimestamp(audit.reviewed_at))) {
    addError(errors, `${location}.output_audit`, "reviewed suite 的 output audit 必须有真实 human 记录；validator 只能校验声明格式，不能证明现实身份");
  }
  for (const key of ["new_fact_findings", "style_source_fact_findings"]) if (!Array.isArray(audit[key])) addError(errors, `${location}.output_audit.${key}`, "必须是数组");

  const contractValues = mapRelationValues(contract.immutable_values, errors, `${location}.content_contract.immutable_values`);
  const observedValues = mapRelationValues(audit.relation_observations, errors, `${location}.output_audit.relation_observations`);
  for (const relation of profile.rewrite_interface?.immutable_relations || []) {
    if (!contractValues.has(relation) || !observedValues.has(relation)) addError(errors, `${location}.content_lock`, `缺少 relation：${relation}`);
    else if (sha256Json(contractValues.get(relation)) !== sha256Json(observedValues.get(relation))) addError(errors, `${location}.content_lock.${relation}`, "权威 content contract 与 output audit 不一致");
  }

  const patternIndex = new Map((profile.patterns || []).map((item) => [item.id, item]));
  const patternIds = new Set();
  const applications = Array.isArray(audit.pattern_applications) ? audit.pattern_applications : [];
  if (!Array.isArray(audit.pattern_applications)) addError(errors, `${location}.output_audit.pattern_applications`, "必须是数组");
  const byPattern = new Map();
  for (const [index, application] of applications.entries()) {
    const applicationLocation = `${location}.output_audit.pattern_applications[${index}]`;
    validateExactKeys(application, new Set(["pattern_id", "start", "end"]), errors, applicationLocation);
    const pattern = patternIndex.get(application?.pattern_id);
    if (!pattern || !eligible(pattern)) addError(errors, `${applicationLocation}.pattern_id`, "未知或不可应用的 pattern");
    if (!Number.isInteger(application?.start) || !Number.isInteger(application?.end) || application.start < 0 || application.end <= application.start || application.end > output.text.length) {
      addError(errors, applicationLocation, "span 必须落在绑定 output 内");
      continue;
    }
    if (!pattern) continue;
    patternIds.add(pattern.id);
    byPattern.set(pattern.id, [...(byPattern.get(pattern.id) || []), application]);
    if ((pattern.avoid_when || []).some((id) => selection.evaluated_signals[id] === true)) {
      addError(errors, applicationLocation, `${pattern.id} 命中 avoid_when，不能应用`);
    }
    const allowed = new Set(pattern.application_control?.positions || []);
    const actualPosition = outputPosition(application.start, output.text.length);
    if (!allowed.has("any") && !allowed.has(actualPosition)) addError(errors, applicationLocation, `位置 ${actualPosition} 不在 pattern 预算内`);
  }
  for (const pattern of (profile.patterns || []).filter(eligible)) {
    const patternApplications = byPattern.get(pattern.id) || [];
    const blocked = (pattern.avoid_when || []).some((id) => selection.evaluated_signals[id] === true);
    if (!blocked && (patternApplications.length < pattern.application_control.min_per_script || patternApplications.length > pattern.application_control.max_per_script)) {
      addError(errors, `${location}.output_audit.pattern_applications`, `${pattern.id} 使用次数超出预算`);
    }
    if (blocked && patternApplications.length > 0) addError(errors, `${location}.output_audit.pattern_applications`, `${pattern.id} 命中 avoid_when 后仍被使用`);
    if (pattern.application_control.avoid_adjacent_repeat && patternApplications.length > 1) {
      const ordered = [...applications].sort((a, b) => a.start - b.start);
      for (let index = 1; index < ordered.length; index += 1) {
        if (ordered[index - 1].pattern_id === pattern.id && ordered[index].pattern_id === pattern.id) addError(errors, `${location}.output_audit.pattern_applications`, `${pattern.id} 出现相邻重复`);
      }
    }
  }

  const avoidIndex = new Map((profile.avoid_patterns || []).map((item) => [item.id, item]));
  const avoidTriggered = new Set();
  const findings = Array.isArray(audit.avoidance_findings) ? audit.avoidance_findings : [];
  if (!Array.isArray(audit.avoidance_findings)) addError(errors, `${location}.output_audit.avoidance_findings`, "必须是数组");
  const findingIds = new Set();
  for (const finding of findings) {
    validateExactKeys(finding, new Set(["avoid_pattern_id", "violations"]), errors, `${location}.output_audit.avoidance_findings`);
    const rule = avoidIndex.get(finding?.avoid_pattern_id);
    if (!rule || !eligible(rule)) addError(errors, `${location}.output_audit.avoidance_findings`, `未知或不可应用 avoid pattern：${finding?.avoid_pattern_id}`);
    if (findingIds.has(finding?.avoid_pattern_id)) addError(errors, `${location}.output_audit.avoidance_findings`, "avoid pattern 检查重复");
    findingIds.add(finding?.avoid_pattern_id);
    if (!Array.isArray(finding?.violations)) addError(errors, `${location}.output_audit.avoidance_findings`, "violations 必须是数组");
    else if (finding.violations.length > 0) addError(errors, `${location}.output_audit.avoidance_findings`, `${finding.avoid_pattern_id} 存在违规`);
    if ((rule?.trigger_signals || []).every((id) => selection.evaluated_signals[id] === true)) avoidTriggered.add(rule.id);
  }
  if ((audit.new_fact_findings || []).length > 0) addError(errors, `${location}.output_audit.new_fact_findings`, "审计发现新增事实");
  if ((audit.style_source_fact_findings || []).length > 0) addError(errors, `${location}.output_audit.style_source_fact_findings`, "审计发现来源风格事实污染");
  if (strict) {
    for (const rule of (profile.avoid_patterns || []).filter(eligible)) if (!findingIds.has(rule.id)) addError(errors, `${location}.output_audit.avoidance_findings`, `缺少 avoid pattern 审计：${rule.id}`);
  }

  const prohibitedAudienceMeta = new Set([
    ...REQUIRED_META_PHRASES,
    ...(profile.rewrite_interface?.prohibited_audience_meta_phrases || []),
  ]);
  for (const phrase of prohibitedAudienceMeta) if (output.text.includes(phrase)) addError(errors, `${location}.output`, `包含过程性元话语：${phrase}`);
  if (referenceCorpus) {
    const leakage = scanLeakage(referenceCorpus, { generated_output: output.text }, { minLength: 20, sensitiveMinLength: 4 });
    if (!leakage.ok) addError(errors, `${location}.output`, `命中 reference-corpus 泄漏扫描：${leakage.match_count}`);
    const auditNotesLeakage = scanLeakage(referenceCorpus, { output_audit_notes: audit.notes || [] }, { minLength: 20, sensitiveMinLength: 4 });
    if (!auditNotesLeakage.ok) addError(errors, `${location}.output_audit.notes`, `命中 reference-corpus 泄漏扫描：${auditNotesLeakage.match_count}`);
  } else if (strict) addError(errors, `${location}.output`, "reviewed suite 必须提供 reference corpus 做输出泄漏扫描");

  return { selection, patternIds, avoidTriggered };
};

export const validateGenerationTest = (profile, generationTest, { generationTestPath = null, referenceCorpus = null, requireReviewed = false } = {}) => {
  const errors = [];
  const warnings = [];
  if (!new Set(["1.1-draft", "1.1-approved"]).has(profile?.schema_version)) return { ok: false, errors: ["generation_test: 仅支持精确的 1.1-draft/1.1-approved profile"], warnings, summary: {} };
  if (!isObject(generationTest)) return { ok: false, errors: ["generation_test: 必须是对象"], warnings, summary: {} };
  validateExactKeys(generationTest, GENERATION_TEST_KEYS, errors, "generation_test");
  if (!new Set(["1.1-draft", "1.1-reviewed"]).has(generationTest.schema_version)) addError(errors, "generation_test.schema_version", "必须是 1.1-draft 或 1.1-reviewed");
  for (const key of ["test_id", "profile_id", "profile_schema_version", "candidate_profile_sha256", "mode", "state"]) {
    if (!nonEmptyString(generationTest[key])) addError(errors, `generation_test.${key}`, "必填字符串缺失");
  }
  if (generationTest.profile_id !== profile.profile_id) addError(errors, "generation_test.profile_id", "与 profile 不一致");
  if (generationTest.profile_schema_version !== "1.1-draft") addError(errors, "generation_test.profile_schema_version", "必须绑定 1.1-draft candidate");
  if (generationTest.candidate_profile_sha256 !== profileCandidateSha256(profile)) addError(errors, "generation_test.candidate_profile_sha256", "与当前 candidate profile digest 不一致");
  if (generationTest.mode !== "evaluation_only") addError(errors, "generation_test.mode", "只能是 evaluation_only");
  if (!new Set(["draft", "reviewed"]).has(generationTest.state)) addError(errors, "generation_test.state", "必须是 draft 或 reviewed");
  if ((generationTest.state === "draft" && generationTest.schema_version !== "1.1-draft") || (generationTest.state === "reviewed" && generationTest.schema_version !== "1.1-reviewed")) {
    addError(errors, "generation_test.schema_version", "schema version 必须与 state 精确对应");
  }
  const strict = requireReviewed || generationTest.state === "reviewed";
  if (strict && (generationTest.state !== "reviewed" || generationTest.schema_version !== "1.1-reviewed")) addError(errors, "generation_test.state", "正式批准必须使用 reviewed suite");
  if (!Array.isArray(generationTest.cases) || generationTest.cases.length === 0) addError(errors, "generation_test.cases", "至少需要一个 case");

  const caseIds = new Set();
  const caseResults = [];
  for (const [index, rawCase] of (generationTest.cases || []).entries()) {
    const location = `generation_test.cases[${index}]`;
    if (!isObject(rawCase)) {
      addError(errors, location, "case 必须是对象");
      continue;
    }
    validateExactKeys(rawCase, GENERATION_CASE_KEYS, errors, location);
    const generationCase = { ...rawCase, __index: index };
    if (!nonEmptyString(generationCase.case_id) || caseIds.has(generationCase.case_id)) addError(errors, `${location}.case_id`, "case_id 缺失或重复");
    caseIds.add(generationCase.case_id);
    if (!ALLOWED_CASE_TYPES.has(generationCase.case_type)) addError(errors, `${location}.case_type`, "未知 case_type");
    validateExactKeys(generationCase.expected_selection, EXPECTED_SELECTION_KEYS, errors, `${location}.expected_selection`);
    validateExactKeys(generationCase.applied_controls, APPLIED_CONTROL_KEYS, errors, `${location}.applied_controls`);
    validateExactKeys(generationCase.artifacts, CASE_ARTIFACT_KEYS, errors, `${location}.artifacts`);
    if (generationCase.case_type === "fallback") validateStringArray(generationCase.fallback_beat_ids, errors, `${location}.fallback_beat_ids`, { allowEmpty: false });
    else if (Array.isArray(generationCase.fallback_beat_ids) && generationCase.fallback_beat_ids.length > 0) addError(errors, `${location}.fallback_beat_ids`, "仅 fallback case 可以声明 fallback beat");
    if (["positive", "fallback", "excluded"].includes(generationCase.case_type) && !nonEmptyString(generationCase.target_framework_id)) addError(errors, `${location}.target_framework_id`, "该 case 必须声明被测 framework");
    if (generationCase.case_type === "abstain" && generationCase.target_framework_id !== null) addError(errors, `${location}.target_framework_id`, "abstain case 的 target_framework_id 必须为 null");
    caseResults.push({ case: generationCase, ...validateCaseArtifacts(profile, generationCase, generationTestPath ? path.dirname(path.resolve(generationTestPath)) : null, referenceCorpus, errors, warnings, { strict }) });
  }

  if (isObject(generationTest.human_review)) {
    validateExactKeys(generationTest.human_review, HUMAN_REVIEW_KEYS, errors, "generation_test.human_review");
    if (!Array.isArray(generationTest.human_review.case_reviews)) addError(errors, "generation_test.human_review.case_reviews", "必须是数组");
    else {
      const reviewIds = new Set();
      generationTest.human_review.case_reviews.forEach((review, index) => {
        const location = `generation_test.human_review.case_reviews[${index}]`;
        validateExactKeys(review, CASE_REVIEW_KEYS, errors, location);
        if (!isObject(review) || !nonEmptyString(review.case_id) || reviewIds.has(review.case_id)) addError(errors, `${location}.case_id`, "case_id 缺失或重复");
        else if (!caseIds.has(review.case_id)) addError(errors, `${location}.case_id`, "引用未知 generation case");
        reviewIds.add(review?.case_id);
      });
    }
    validateStringArray(generationTest.human_review.notes, errors, "generation_test.human_review.notes");
  } else addError(errors, "generation_test.human_review", "必须是对象");

  if (strict) {
    if (!isObject(generationTest.human_review) || generationTest.human_review.state !== "reviewed" || !validHumanReviewer(generationTest.human_review.reviewer_type, generationTest.human_review.reviewer) || !isIsoTimestamp(generationTest.human_review.reviewed_at)) {
      addError(errors, "generation_test.human_review", "必须有真实 human reviewed 记录；格式校验不能代替现实身份确认");
    }
    const reviews = generationTest.human_review?.case_reviews;
    const reviewMap = new Map((Array.isArray(reviews) ? reviews : []).map((item) => [item.case_id, item]));
    for (const result of caseResults.filter((item) => ["positive", "fallback"].includes(item.case.case_type))) {
      const review = reviewMap.get(result.case.case_id);
      for (const key of ["no_new_facts", "no_style_source_facts", "style_similarity_accepted", "overfit_absent"]) {
        if (review?.[key] !== true) addError(errors, "generation_test.human_review.case_reviews", `${result.case.case_id} 缺少人工 true：${key}`);
      }
    }

    const formal = profile.status === "approved";
    const eligible = (item) => formal ? item.status === "approved" : ["candidate", "approved"].includes(item.status);
    for (const framework of (profile.frameworks || []).filter(eligible)) {
      const targeted = caseResults.filter((item) => item.case.target_framework_id === framework.id);
      if (!targeted.some((item) => item.case.case_type === "positive")) addError(errors, "generation_test.coverage", `${framework.id} 缺少 positive case`);
      if (!targeted.some((item) => ["excluded", "abstain"].includes(item.case.case_type))) addError(errors, "generation_test.coverage", `${framework.id} 缺少 excluded/abstain case`);
      if (!targeted.some((item) => item.case.case_type === "fallback")) addError(errors, "generation_test.coverage", `${framework.id} 缺少 fallback case`);
    }
    for (const pattern of (profile.patterns || []).filter(eligible)) {
      const maxProbed = caseResults.some((item) => {
        if ((pattern.avoid_when || []).some((id) => item.selection?.evaluated_signals?.[id] === true)) return false;
        const auditPath = item.case.artifacts?.output_audit_path;
        if (!auditPath || !generationTestPath) return false;
        try {
          const audit = JSON.parse(fs.readFileSync(path.resolve(path.dirname(path.resolve(generationTestPath)), auditPath), "utf8"));
          return (audit.pattern_applications || []).filter((application) => application.pattern_id === pattern.id).length === pattern.application_control.max_per_script;
        } catch { return false; }
      });
      if (!maxProbed) addError(errors, "generation_test.coverage", `${pattern.id} 缺少 max budget probe`);
    }
    for (const avoidPattern of (profile.avoid_patterns || []).filter(eligible)) {
      if (!caseResults.some((item) => item.avoidTriggered.has(avoidPattern.id))) addError(errors, "generation_test.coverage", `${avoidPattern.id} 缺少 trigger probe`);
    }
  } else {
    if (generationTest.human_review?.state !== "pending" || generationTest.human_review?.reviewer_type !== null || generationTest.human_review?.reviewer !== null || generationTest.human_review?.reviewed_at !== null) {
      addError(errors, "generation_test.human_review", "draft suite 必须保持 pending，且不得预填 reviewer/reviewed_at");
    }
    warnings.push("generation test 尚未人工 reviewed；只能作为评测草稿，不能支持 profile approval。 ");
  }

  if (referenceCorpus) {
    const suiteLeakage = scanLeakage(referenceCorpus, generationTest, { minLength: 20, sensitiveMinLength: 4 });
    if (!suiteLeakage.ok) addError(errors, "generation_test", `suite 元数据命中 reference-corpus 泄漏：${suiteLeakage.match_count}`);
  }
  return { ok: errors.length === 0, errors, warnings, summary: { test_id: generationTest.test_id, state: generationTest.state, case_count: generationTest.cases?.length || 0 } };
};

const validateApprovalRecord = (profile, approvalRecord, evidenceBundle, generationTest, errors) => {
  if (profile.status !== "approved") return;
  if (!isObject(approvalRecord)) {
    addError(errors, "approval_record", "approved profile 必须提供独立人工批准记录");
    return;
  }
  validateExactKeys(approvalRecord, APPROVAL_RECORD_KEYS, errors, "approval_record");
  if (approvalRecord.record_id !== profile.approval?.record_id) addError(errors, "approval_record.record_id", "与 profile approval.record_id 不一致");
  if (approvalRecord.profile_id !== profile.profile_id) addError(errors, "approval_record.profile_id", "与 profile_id 不一致");
  if (approvalRecord.generation_test_id !== profile.approval?.generation_test_id || approvalRecord.generation_test_id !== generationTest?.test_id) addError(errors, "approval_record.generation_test_id", "必须绑定同一 generation test");
  if (approvalRecord.decision !== "approved" || !validHumanReviewer(approvalRecord.reviewer_type, approvalRecord.reviewer) || approvalRecord.decision_source !== "user_explicit_confirmation") {
    addError(errors, "approval_record", "批准记录必须声明 user_explicit_confirmation 且 reviewer 不得是 AI/assistant/model；格式校验不能证明现实身份");
  }
  if (!nonEmptyString(approvalRecord.reviewer) || !isIsoTimestamp(approvalRecord.decided_at) || !nonEmptyString(approvalRecord.change_reason)) {
    addError(errors, "approval_record", "缺少 reviewer、ISO 时间或 change_reason");
  }
  const expectedDigests = {
    candidate_profile_sha256: profileCandidateSha256(profile),
    approved_control_state_sha256: approvedControlStateSha256(profile),
    evidence_bundle_sha256: evidenceBundle ? evidenceBundleSha256(evidenceBundle) : null,
    generation_test_sha256: generationTest ? generationTestSha256(generationTest) : null,
    generation_output_set_sha256: generationTest ? generationOutputSetSha256(generationTest) : null,
  };
  for (const [key, expected] of Object.entries(expectedDigests)) {
    if (!SHA256_FINGERPRINT.test(approvalRecord[key] || "") || approvalRecord[key] !== expected) addError(errors, `approval_record.${key}`, "未绑定当前获批 artifact digest");
    if (profile.approval?.[key] !== expected) addError(errors, `profile.approval.${key}`, "必须与当前 artifact digest 一致");
  }
  const checklist = approvalRecord.checklist;
  if (!isObject(checklist)) {
    addError(errors, "approval_record.checklist", "缺少人工确认清单");
  } else {
    const keys = Object.keys(checklist);
    const missing = REQUIRED_APPROVAL_CHECKS.filter((key) => checklist[key] !== true);
    const unknown = keys.filter((key) => !REQUIRED_APPROVAL_CHECKS.includes(key));
    if (missing.length > 0 || unknown.length > 0) addError(errors, "approval_record.checklist", `必须完整且仅包含规定项 true；missing=${missing.join(",")}; unknown=${unknown.join(",")}`);
  }
};

export const validateProfile = (profile, {
  evidenceBundle = null,
  approvalRecord = null,
  generationTest = null,
  generationTestPath = null,
  referenceCorpus = null,
} = {}) => {
  const errors = [];
  const warnings = [];
  if (!isObject(profile)) return { ok: false, errors: ["profile: 必须是对象"], warnings, summary: {} };
  scanForbiddenKeys(profile, errors);
  for (const key of ["schema_version", "profile_id", "display_name", "domain", "status"]) {
    if (!nonEmptyString(profile[key])) addError(errors, `profile.${key}`, "必填字符串缺失");
  }
  const allowedSchemaVersions = new Set(["1.0-draft", "1.1-draft", "1.1-approved"]);
  if (!allowedSchemaVersions.has(profile.schema_version)) addError(errors, "profile.schema_version", "仅支持 1.0-draft、1.1-draft、1.1-approved");
  const v11 = isV11Profile(profile);
  const allowedTopLevel = v11 ? V11_TOP_LEVEL_KEYS : V10_TOP_LEVEL_KEYS;
  for (const key of Object.keys(profile)) if (!allowedTopLevel.has(key)) addError(errors, `profile.${key}`, "未知顶层字段；纯文本 profile 禁止扩展视觉/未声明命名空间");
  if (profile.domain !== "zh-short-video-spoken") addError(errors, "profile.domain", "V1 仅支持 zh-short-video-spoken");
  if (!["draft", "approved"].includes(profile.status)) addError(errors, "profile.status", "必须是 draft 或 approved");
  if (profile.status === "draft" && !new Set(["1.0-draft", "1.1-draft"]).has(profile.schema_version)) addError(errors, "profile.schema_version", "draft 状态与 schema version 不一致");
  if (profile.status === "approved" && profile.schema_version !== "1.1-approved") addError(errors, "profile.schema_version", "只有 1.1-approved 可以批准；1.0 永远是 legacy draft");
  if (profile.schema_version === "1.0-draft") warnings.push("legacy 1.0 draft：可回读但不具备生成控制层，不能批准。 ");

  if (!isObject(profile.approval)) {
    addError(errors, "profile.approval", "缺少审批对象");
  } else if (profile.status === "draft") {
    if (v11) validateExactKeys(profile.approval, V11_APPROVAL_KEYS, errors, "profile.approval");
    if (profile.approval.state !== "draft" || profile.approval.requires_human_approval !== true) {
      addError(errors, "profile.approval", "draft 必须保持人工审批门");
    }
    if (v11) {
      for (const key of ["approved_by", "approved_at", "change_reason", "record_id", "generation_test_id", "candidate_profile_sha256", "approved_control_state_sha256", "evidence_bundle_sha256", "generation_test_sha256", "generation_output_set_sha256"]) {
        if (profile.approval[key] !== null) addError(errors, `profile.approval.${key}`, "draft 审批字段必须保持 null");
      }
    }
  } else {
    if (v11) validateExactKeys(profile.approval, V11_APPROVAL_KEYS, errors, "profile.approval");
    if (profile.approval.state !== "approved" || profile.approval.requires_human_approval !== false) {
      addError(errors, "profile.approval", "approved 状态不一致");
    }
    for (const key of ["approved_by", "change_reason", "record_id", "generation_test_id", "candidate_profile_sha256", "approved_control_state_sha256", "evidence_bundle_sha256", "generation_test_sha256", "generation_output_set_sha256"]) {
      if (!nonEmptyString(profile.approval[key])) addError(errors, `profile.approval.${key}`, "批准档案必须有真实人工记录");
    }
    if (!isIsoTimestamp(profile.approval.approved_at)) addError(errors, "profile.approval.approved_at", "必须是 ISO 8601 UTC 时间");
  }

  let corpusIndex = null;
  if (!isObject(profile.corpus)) {
    addError(errors, "profile.corpus", "缺少 corpus");
  } else {
    if (!nonEmptyString(profile.corpus.corpus_id)) addError(errors, "profile.corpus.corpus_id", "必填字符串缺失");
    for (const key of ["raw_unit_count", "independent_cluster_count"]) {
      if (!Number.isInteger(profile.corpus[key]) || profile.corpus[key] < 0) addError(errors, `profile.corpus.${key}`, "必须是非负整数");
    }
    for (const key of ["included_unit_ids", "excluded_unit_ids", "unresolved_decisions", "independence_clusters"]) {
      if (!Array.isArray(profile.corpus[key])) addError(errors, `profile.corpus.${key}`, "必须是数组");
    }
    const includedUnitIds = new Set(profile.corpus.included_unit_ids || []);
    const excludedUnitIds = new Set(profile.corpus.excluded_unit_ids || []);
    if (includedUnitIds.size !== (profile.corpus.included_unit_ids || []).length) addError(errors, "profile.corpus.included_unit_ids", "unit ID 不得重复");
    if (excludedUnitIds.size !== (profile.corpus.excluded_unit_ids || []).length) addError(errors, "profile.corpus.excluded_unit_ids", "unit ID 不得重复");
    for (const unitId of includedUnitIds) if (excludedUnitIds.has(unitId)) addError(errors, "profile.corpus", `unit 不能同时 included/excluded：${unitId}`);
    if (Number.isInteger(profile.corpus.raw_unit_count) && profile.corpus.raw_unit_count !== includedUnitIds.size + excludedUnitIds.size) {
      addError(errors, "profile.corpus.raw_unit_count", "必须等于 included + excluded unit 数");
    }
    const clusterByUnit = new Map();
    const clusterIds = new Set();
    for (const [index, cluster] of (profile.corpus.independence_clusters || []).entries()) {
      const clusterLocation = `profile.corpus.independence_clusters[${index}]`;
      if (!isObject(cluster) || !nonEmptyString(cluster.id) || !Array.isArray(cluster.unit_ids) || cluster.unit_ids.length === 0) {
        addError(errors, clusterLocation, "cluster 需要 id 和非空 unit_ids");
        continue;
      }
      if (clusterIds.has(cluster.id)) addError(errors, `${clusterLocation}.id`, "cluster ID 重复");
      clusterIds.add(cluster.id);
      for (const unitId of cluster.unit_ids) {
        if (!includedUnitIds.has(unitId)) addError(errors, `${clusterLocation}.unit_ids`, `cluster 引用了非 included unit：${unitId}`);
        if (clusterByUnit.has(unitId)) addError(errors, `${clusterLocation}.unit_ids`, `unit 只能属于一个 cluster：${unitId}`);
        clusterByUnit.set(unitId, cluster.id);
      }
    }
    for (const unitId of includedUnitIds) if (!clusterByUnit.has(unitId)) addError(errors, "profile.corpus.independence_clusters", `included unit 缺少 cluster：${unitId}`);
    if (Number.isInteger(profile.corpus.independent_cluster_count) && profile.corpus.independent_cluster_count !== clusterIds.size) {
      addError(errors, "profile.corpus.independent_cluster_count", "必须等于 independence_clusters 数量");
    }
    corpusIndex = { includedUnitIds, clusterByUnit };
    if (profile.status === "approved" && profile.corpus.unresolved_decisions?.length > 0) {
      addError(errors, "profile.corpus.unresolved_decisions", "批准档案不能有未决样本决定");
    }
  }

  const requireResolvedDecisions = containsCandidateOrApproved(profile) || profile.status === "approved";
  const requireEvidenceBundle = requireResolvedDecisions || containsEvidenceClaims(profile);
  if (requireEvidenceBundle && !evidenceBundle) addError(errors, "evidence_bundle", "candidate/approved 必须同时校验 manifest、health、decisions 和 annotations");
  if (requireResolvedDecisions && (profile.corpus?.unresolved_decisions || []).length > 0) addError(errors, "profile.corpus.unresolved_decisions", "存在 candidate/approved 时不得有未决样本决定");
  const evidenceIndex = buildEvidenceIndex(profile, evidenceBundle, errors, { requireResolved: requireResolvedDecisions });
  if (!generationTest && profile.status === "approved") addError(errors, "generation_test", "approved profile 必须提供 reviewed generation test suite");
  if (generationTest) {
    const generationReport = validateGenerationTest(profile, generationTest, { generationTestPath, referenceCorpus, requireReviewed: profile.status === "approved" });
    for (const item of generationReport.errors) addError(errors, "generation_test", item);
    for (const item of generationReport.warnings) warnings.push(`generation_test: ${item}`);
  }
  validateApprovalRecord(profile, approvalRecord, evidenceBundle, generationTest, errors);
  if (profile.status === "approved" && isObject(approvalRecord)) {
    if (profile.approval.approved_by !== approvalRecord.reviewer) addError(errors, "profile.approval.approved_by", "必须与独立批准记录一致");
    if (profile.approval.approved_at !== approvalRecord.decided_at) addError(errors, "profile.approval.approved_at", "必须与独立批准记录一致");
    if (profile.approval.change_reason !== approvalRecord.change_reason) addError(errors, "profile.approval.change_reason", "必须与独立批准记录一致");
  }

  let signalIds = new Set();
  if (v11) {
    signalIds = validateSignalCatalog(profile.selector_signals, errors, "profile.selector_signals");
    if (!Array.isArray(profile.communication_persona)) addError(errors, "profile.communication_persona", "必须是数组");
    else profile.communication_persona.forEach((item, index) => validateGenerationControlRule(item, errors, `profile.communication_persona[${index}]`, "dimension", ALLOWED_PERSONA_DIMENSIONS, corpusIndex, evidenceIndex));
    if (!Array.isArray(profile.content_strategy)) addError(errors, "profile.content_strategy", "必须是数组");
    else profile.content_strategy.forEach((item, index) => validateGenerationControlRule(item, errors, `profile.content_strategy[${index}]`, "category", ALLOWED_STRATEGY_CATEGORIES, corpusIndex, evidenceIndex));
  }

  const contentTypeIds = new Set();
  if (!Array.isArray(profile.content_types)) addError(errors, "profile.content_types", "必须是数组");
  else profile.content_types.forEach((item, index) => {
    const location = `profile.content_types[${index}]`;
    validateRuleLike(item, errors, location, corpusIndex, evidenceIndex);
    if (!nonEmptyString(item?.definition)) addError(errors, `${location}.definition`, "必填字符串缺失");
    if (v11) {
      if (!nonEmptyString(item?.generation_goal)) addError(errors, `${location}.generation_goal`, "1.1 必须声明 generation_goal");
      validateSelector(item?.selector, errors, `${location}.selector`, { signalIds });
    }
    if (contentTypeIds.has(item?.id)) addError(errors, `${location}.id`, "content type ID 重复");
    if (nonEmptyString(item?.id)) contentTypeIds.add(item.id);
  });
  const frameworkIds = new Set();
  if (!Array.isArray(profile.frameworks)) addError(errors, "profile.frameworks", "必须是数组");
  else profile.frameworks.forEach((item, index) => {
    const location = `profile.frameworks[${index}]`;
    validateFramework(item, errors, location, corpusIndex, evidenceIndex, v11, signalIds);
    if (nonEmptyString(item?.content_type_id) && !contentTypeIds.has(item.content_type_id)) addError(errors, `${location}.content_type_id`, "引用了不存在的 content type");
    if (frameworkIds.has(item?.id)) addError(errors, `${location}.id`, "framework ID 重复");
    if (nonEmptyString(item?.id)) frameworkIds.add(item.id);
  });
  if (v11) {
    if (!isObject(profile.attention_rhythm)) addError(errors, "profile.attention_rhythm", "必须是对象");
    else {
      if (!ALLOWED_ATTENTION_BASES.has(profile.attention_rhythm.basis)) addError(errors, "profile.attention_rhythm.basis", "未知 basis");
      if (!Array.isArray(profile.attention_rhythm.stages)) addError(errors, "profile.attention_rhythm.stages", "必须是数组");
      let previousStart = -Infinity;
      for (const [index, item] of (profile.attention_rhythm.stages || []).entries()) {
        const location = `profile.attention_rhythm.stages[${index}]`;
        validateRuleLike(item, errors, location, corpusIndex, evidenceIndex);
        for (const key of ["audience_state", "objective", "mechanism", "generation_instruction", "risk"]) if (!nonEmptyString(item?.[key])) addError(errors, `${location}.${key}`, "必填字符串缺失");
        if (!Array.isArray(item?.relative_range) || item.relative_range.length !== 2 || item.relative_range.some((value) => typeof value !== "number" || value < 0 || value > 1) || item.relative_range[0] > item.relative_range[1]) {
          addError(errors, `${location}.relative_range`, "必须是 0–1 的有序二元区间");
        } else {
          if (item.relative_range[0] < previousStart) addError(errors, `${location}.relative_range`, "stage 必须按起点排序");
          previousStart = item.relative_range[0];
        }
        if (!ALLOWED_ATTENTION_INTENSITIES.has(item?.intensity)) addError(errors, `${location}.intensity`, "必须是 low/medium/high/unknown");
        if (profile.attention_rhythm.basis === "textual_function_inference" && /speed|pause|语速|停顿|实测情绪|retention/i.test(`${item?.mechanism || ""}${item?.audience_state || ""}`)) {
          addError(errors, location, "纯文本 basis 不得声称语速、停顿、留存或真实情绪已验证");
        }
      }
    }
  }
  const patternIds = new Set();
  if (!Array.isArray(profile.patterns)) addError(errors, "profile.patterns", "必须是数组");
  else profile.patterns.forEach((item, index) => {
    const location = `profile.patterns[${index}]`;
    validateRuleLike(item, errors, location, corpusIndex, evidenceIndex);
    for (const key of ["category", "formula", "applicability", "non_applicability", "risk"]) {
      if (!nonEmptyString(item?.[key])) addError(errors, `profile.patterns[${index}].${key}`, "必填字符串缺失");
    }
    if (!Array.isArray(item?.input_slots)) addError(errors, `profile.patterns[${index}].input_slots`, "必须是数组");
    if (!Array.isArray(item?.preserve)) addError(errors, `profile.patterns[${index}].preserve`, "必须是数组");
    if (v11) {
      if (!nonEmptyString(item?.generation_instruction)) addError(errors, `${location}.generation_instruction`, "1.1 必须是命令式生成动作");
      validateApplicationControl(item?.application_control, errors, `${location}.application_control`, item?.status);
      const avoidWhen = validateStringArray(item?.avoid_when, errors, `${location}.avoid_when`);
      for (const signal of avoidWhen) if (!signalIds.has(signal)) addError(errors, `${location}.avoid_when`, `引用未知 selector signal：${signal}`);
    }
    if (patternIds.has(item?.id)) addError(errors, `${location}.id`, "pattern ID 重复");
    if (nonEmptyString(item?.id)) patternIds.add(item.id);
  });
  if (v11) {
    const avoidIds = new Set();
    if (!Array.isArray(profile.avoid_patterns)) addError(errors, "profile.avoid_patterns", "必须是数组");
    else profile.avoid_patterns.forEach((item, index) => {
      const location = `profile.avoid_patterns[${index}]`;
      validateRuleLike(item, errors, location, corpusIndex, evidenceIndex);
      for (const key of ["trigger", "avoid_instruction", "rationale"]) if (!nonEmptyString(item?.[key])) addError(errors, `${location}.${key}`, "必填字符串缺失");
      if (!ALLOWED_AVOID_BASES.has(item?.basis)) addError(errors, `${location}.basis`, "未知 evidence basis");
      const triggerSignals = validateStringArray(item?.trigger_signals, errors, `${location}.trigger_signals`, { allowEmpty: false });
      for (const signal of triggerSignals) if (!signalIds.has(signal)) addError(errors, `${location}.trigger_signals`, `引用未知 selector signal：${signal}`);
      if (item?.basis === "absence_with_coverage" && !(profile.limitations || []).some((value) => /coverage|覆盖/.test(value))) addError(errors, location, "absence_with_coverage 必须在 limitations 说明覆盖范围");
      if (avoidIds.has(item?.id)) addError(errors, `${location}.id`, "avoid pattern ID 重复");
      if (nonEmptyString(item?.id)) avoidIds.add(item.id);
    });
  }
  if (!Array.isArray(profile.boundaries) || profile.boundaries.length < 2) addError(errors, "profile.boundaries", "至少需要两条来源/事实边界");
  if (!Array.isArray(profile.limitations)) addError(errors, "profile.limitations", "必须是数组");

  if (!isObject(profile.rewrite_interface)) {
    addError(errors, "profile.rewrite_interface", "缺少下游接口");
  } else {
    if (profile.rewrite_interface.observations_selectable !== false) {
      addError(errors, "profile.rewrite_interface.observations_selectable", "observation 必须不可选");
    }
    for (const key of ["required_content_fields", "immutable_relations", "prohibited_audience_meta_phrases"]) {
      validateStringArray(profile.rewrite_interface[key], errors, `profile.rewrite_interface.${key}`);
    }
    const phrases = new Set(profile.rewrite_interface.prohibited_audience_meta_phrases || []);
    for (const phrase of REQUIRED_META_PHRASES) {
      if (!phrases.has(phrase)) addError(errors, "profile.rewrite_interface.prohibited_audience_meta_phrases", `缺少 ${phrase}`);
    }
  }
  if (v11) {
    if (!isObject(profile.generation_interface)) addError(errors, "profile.generation_interface", "缺少 generation interface");
    else {
      if (profile.generation_interface.forward_test_required_before_approval !== true) addError(errors, "profile.generation_interface.forward_test_required_before_approval", "必须为 true");
      if (profile.generation_interface.selector_abstention_required !== true) addError(errors, "profile.generation_interface.selector_abstention_required", "必须为 true");
      if (profile.generation_interface.fact_lock_source !== "external_content_contract_and_output_audit") addError(errors, "profile.generation_interface.fact_lock_source", "必须绑定外部 content contract 与 output audit");
      if (profile.generation_interface.conflict_policy !== "fail_closed") addError(errors, "profile.generation_interface.conflict_policy", "必须 fail_closed");
      if (JSON.stringify(profile.generation_interface.control_precedence) !== JSON.stringify(CONTROL_PRECEDENCE)) addError(errors, "profile.generation_interface.control_precedence", "必须使用固定控制优先级");
      const checks = validateStringArray(profile.generation_interface.required_checks, errors, "profile.generation_interface.required_checks");
      const missing = REQUIRED_GENERATION_CHECKS.filter((key) => !checks.includes(key));
      const unknown = checks.filter((key) => !REQUIRED_GENERATION_CHECKS.includes(key));
      if (missing.length > 0 || unknown.length > 0) addError(errors, "profile.generation_interface.required_checks", `检查集不完整；missing=${missing.join(",")}; unknown=${unknown.join(",")}`);
    }
  }

  if ((profile.frameworks || []).length === 0) warnings.push("尚无框架；档案只能作为空骨架。 ");
  if ((profile.patterns || []).length === 0) warnings.push("尚无句式/节奏/说服规则。 ");
  if ((profile.corpus?.independent_cluster_count || 0) < 3) warnings.push("独立样本簇少于 3；不要宣称稳定 IP DNA。 ");
  if (profile.status === "draft") {
    for (const [collectionName, collection] of [
      ["communication_persona", profile.communication_persona],
      ["content_strategy", profile.content_strategy],
      ["content_types", profile.content_types],
      ["frameworks", profile.frameworks],
      ["attention_rhythm.stages", profile.attention_rhythm?.stages],
      ["patterns", profile.patterns],
      ["avoid_patterns", profile.avoid_patterns],
    ]) {
      if ((collection || []).some((item) => item.status === "approved" || item.availability === "selectable")) {
        addError(errors, `profile.${collectionName}`, "draft profile 不能包含 approved/selectable 条目");
      }
    }
  } else if (profile.status === "approved") {
    for (const [collectionName, collection] of [
      ["communication_persona", profile.communication_persona],
      ["content_strategy", profile.content_strategy],
      ["content_types", profile.content_types],
      ["frameworks", profile.frameworks],
      ["attention_rhythm.stages", profile.attention_rhythm?.stages],
      ["patterns", profile.patterns],
      ["avoid_patterns", profile.avoid_patterns],
    ]) {
      if ((collection || []).some((item) => item.status === "candidate" || item.availability === "profile_approval_required")) {
        addError(errors, `profile.${collectionName}`, "approved profile 不得残留 candidate/profile_approval_required；未批准项应降为 observation 或移除");
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      profile_id: profile.profile_id,
      status: profile.status,
      content_type_count: profile.content_types?.length || 0,
      framework_count: profile.frameworks?.length || 0,
      pattern_count: profile.patterns?.length || 0,
      generation_control_count: additionalControlItems(profile).length,
    },
  };
};

const collectScannableProfileStrings = (profile, root = "profile") => {
  const results = [];
  const skipKeys = new Set(["unit_id", "anchor_id", "independence_cluster_id", "profile_id", "corpus_id", "record_id"]);
  const allowedStaticStrings = new Set([
    "只学习表达形态，不导入来源项目、收益、案例、账号、资料、平台操作或 CTA 关键词。",
    "下游新稿只能使用目标内容另行提供的事实、数据、步骤、证据与 CTA。",
    "不保存来源事实。",
    "下游只使用目标内容事实。",
    ...REQUIRED_META_PHRASES,
  ].map(normalizeText));
  const walk = (value, location) => {
    if (typeof value === "string") {
      if (!allowedStaticStrings.has(normalizeText(value))) results.push({ location, value });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${location}[${index}]`));
      return;
    }
    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (!skipKeys.has(key)) walk(child, `${location}.${key}`);
    }
  };
  walk(profile, root);
  return results.filter((item) => normalizeText(item.value).length > 0);
};

const fingerprintMatch = ({ unitId, sourceKind, offset, length, fragment, profileLocation, matchKind }) => ({
  unit_id: unitId,
  source_kind: sourceKind,
  normalized_offset: offset,
  length,
  profile_location: profileLocation,
  match_kind: matchKind,
  fingerprint: crypto.createHash("sha256").update(fragment).digest("hex"),
});

const canReconstructFromFields = (text, fieldStrings, minSegmentLength = 6) => {
  if (text.length < minSegmentLength) return false;
  const reachable = new Array(text.length + 1).fill(false);
  reachable[0] = true;
  for (let start = 0; start < text.length; start += 1) {
    if (!reachable[start]) continue;
    for (let end = start + minSegmentLength; end <= text.length; end += 1) {
      const fragment = text.slice(start, end);
      if (fieldStrings.some((field) => field.includes(fragment))) reachable[end] = true;
    }
  }
  return reachable[text.length];
};

export const scanLeakage = (corpus, profile, { minLength = 20, sensitiveMinLength = 4, annotations = null } = {}) => {
  if (!Number.isInteger(minLength) || minLength < 12) throw new Error("minLength 至少为 12。 ");
  if (!Number.isInteger(sensitiveMinLength) || sensitiveMinLength < 4) throw new Error("sensitiveMinLength 至少为 4。 ");
  const fields = [
    ...collectScannableProfileStrings(profile),
    ...(annotations ? collectScannableProfileStrings(annotations, "annotations") : []),
  ].map((item) => ({ ...item, normalized: normalizeText(item.value) }));
  const joinedProfile = fields.map((item) => item.normalized).join("");
  const matches = [];
  const seenFingerprints = new Set();
  const sensitiveSourcePattern = /\d|[￥¥]|公众号|关键词|私信|扫码|微信号/;
  const sensitiveFragmentPattern = /\d|[￥¥]|公众号|关键词|私信|扫码|微信号/;

  for (const unit of corpus.units) {
    const sourceParts = [
      { kind: "title", value: unit.title || "" },
      { kind: "body", value: unit.text || "" },
    ];
    for (const sourcePart of sourceParts) {
      const normalized = normalizeText(sourcePart.value);
      for (const field of fields) {
        if (normalized.length < minLength || field.normalized.length < minLength) continue;
        const fieldGrams = new Set();
        for (let index = 0; index <= field.normalized.length - minLength; index += 1) fieldGrams.add(field.normalized.slice(index, index + minLength));
        for (let index = 0; index <= normalized.length - minLength; index += 1) {
          const fragment = normalized.slice(index, index + minLength);
          if (!fieldGrams.has(fragment)) continue;
          const fingerprint = crypto.createHash("sha256").update(fragment).digest("hex");
          if (!seenFingerprints.has(fingerprint)) {
            seenFingerprints.add(fingerprint);
            matches.push(fingerprintMatch({ unitId: unit.id, sourceKind: sourcePart.kind, offset: index, length: minLength, fragment, profileLocation: field.location, matchKind: "long_exact" }));
          }
          break;
        }
      }

      if (sensitiveSourcePattern.test(normalized) && normalized.length >= sensitiveMinLength) {
        for (let index = 0; index <= normalized.length - sensitiveMinLength; index += 1) {
          const fragment = normalized.slice(index, index + sensitiveMinLength);
          if (!sensitiveFragmentPattern.test(fragment)) continue;
          const field = fields.find((item) => {
            if (!item.normalized.includes(fragment)) return false;
            if (/^profile\.(boundaries|rewrite_interface)/.test(item.location) && !/\d|[￥¥]/.test(fragment)) return false;
            return true;
          });
          const crossField = !field && joinedProfile.includes(fragment);
          if (!field && !crossField) continue;
          const fingerprint = crypto.createHash("sha256").update(fragment).digest("hex");
          if (!seenFingerprints.has(fingerprint)) {
            seenFingerprints.add(fingerprint);
            matches.push(fingerprintMatch({ unitId: unit.id, sourceKind: sourcePart.kind, offset: index, length: sensitiveMinLength, fragment, profileLocation: field?.location || "profile.semantic_fields(joined)", matchKind: crossField ? "sensitive_cross_field" : "sensitive_exact" }));
          }
          break;
        }
      }

      const sourceSegments = sourcePart.kind === "title"
        ? [normalized]
        : String(sourcePart.value).split(/[。！？!?；;\n]+/).map(normalizeText).filter(Boolean);
      for (const segment of sourceSegments) {
        const windows = segment.length <= 240
          ? [segment]
          : Array.from({ length: Math.max(1, Math.ceil((segment.length - 80) / 40) + 1) }, (_, index) => segment.slice(index * 40, index * 40 + 80)).filter((item) => item.length >= minLength);
        for (const window of windows) {
          if (window.length < minLength) continue;
          const existsInOneField = fields.some((item) => item.normalized.includes(window));
          if (existsInOneField || !canReconstructFromFields(window, fields.map((item) => item.normalized), 6)) continue;
          const fingerprint = crypto.createHash("sha256").update(window).digest("hex");
          if (!seenFingerprints.has(fingerprint)) {
            seenFingerprints.add(fingerprint);
            matches.push(fingerprintMatch({ unitId: unit.id, sourceKind: sourcePart.kind, offset: 0, length: window.length, fragment: window, profileLocation: "profile.semantic_fields(reconstructed)", matchKind: "cross_field_reconstruction" }));
          }
        }
      }
    }
  }
  return {
    ok: matches.length === 0,
    min_length: minLength,
    sensitive_min_length: sensitiveMinLength,
    match_count: matches.length,
    matches,
    limitation: "确定性扫描只发现精确片段、标题和敏感短片段；改写后的事实泄漏仍需人工审阅。",
  };
};

const evidenceLabel = (item) => `${item.unit_id}/${item.anchor_id}/${item.independence_cluster_id}`;

export const renderProfileMarkdown = (profile) => {
  const lines = [
    `# ${profile.display_name}｜Style DNA`,
    "",
    `- Profile: ${profile.profile_id}`,
    `- Status: ${profile.status}`,
    `- Domain: ${profile.domain}`,
    `- Human approval required: ${profile.approval?.requires_human_approval === true ? "yes" : "no"}`,
    "",
  ];
  if (isV11Profile(profile)) {
    const renderControls = (title, items, discriminatorKey) => {
      lines.push(`## ${title}`, "");
      if (!items?.length) lines.push("- 暂无证据型控制规则。", "");
      for (const item of items || []) {
        lines.push(`### ${item.name}（${item[discriminatorKey]} / ${item.status}）`, "", `- 定义：${item.definition}`, `- 生成动作：${item.generation_instruction}`, `- 适用：${item.applicability}`, `- 不适用：${item.non_applicability}`, `- 风险：${item.risk}`, `- Evidence: ${(item.evidence || []).map(evidenceLabel).join("；") || "无"}`, "");
      }
    };
    renderControls("叙事位置与沟通人格（可观察行为）", profile.communication_persona, "dimension");
    renderControls("内容策略（含认知推进与机会包装）", profile.content_strategy, "category");
  }
  lines.push("## 内容类型", "");
  if (!profile.content_types?.length) lines.push("- 暂无，等待标注。", "");
  for (const item of profile.content_types || []) {
    lines.push(`### ${item.name}（${item.status}）`, "", item.definition || "", "", `- Availability: ${item.availability}`);
    if (isV11Profile(profile)) lines.push(`- 生成目标：${item.generation_goal}`, `- Selector required：${(item.selector?.requires_all || []).join("、") || "无"}`, `- Selector excluded：${(item.selector?.excludes_any || []).join("、") || "无"}`, `- Selector priority：${item.selector?.priority}`);
    lines.push(`- Evidence: ${(item.evidence || []).map(evidenceLabel).join("；") || "无"}`, "");
  }
  lines.push("## 内容类型框架", "");
  if (!profile.frameworks?.length) lines.push("- 暂无，等待标注。", "");
  for (const framework of profile.frameworks || []) {
    lines.push(`### ${framework.name}（${framework.status}）`, "", `- 适用：${framework.when_to_use}`, `- 不适用：${framework.do_not_use}`, `- Availability: ${framework.availability}`);
    if (isV11Profile(profile)) lines.push(`- Selector required：${(framework.selector?.requires_all || []).join("、") || "无"}`, `- Selector excluded：${(framework.selector?.excludes_any || []).join("、") || "无"}`, `- Selector priority：${framework.selector?.priority}`);
    lines.push("", "节拍：", "");
    framework.beats.forEach((beat, index) => {
      lines.push(`${index + 1}. ${beat.role}：${beat.purpose}（${beat.required ? "必需" : "可选"}）`);
      if (isV11Profile(profile)) lines.push(`   - 生成动作：${beat.generation_instruction}`, `   - 受众意图：${beat.audience_effect}`);
    });
    lines.push("", `证据路径：${framework.evidence_paths.map((item) => `${item.unit_id}/${item.independence_cluster_id}`).join("；") || "无"}`, "");
  }
  lines.push("## 表达规则", "");
  if (!profile.patterns?.length) lines.push("- 暂无，等待标注。", "");
  for (const item of profile.patterns || []) {
    lines.push(`### ${item.name}（${item.category} / ${item.status}）`, "", `- 公式：${item.formula}`, `- 适用：${item.applicability}`, `- 不适用：${item.non_applicability}`);
    if (isV11Profile(profile)) lines.push(`- 生成动作：${item.generation_instruction}`, `- 使用预算：${item.application_control?.min_per_script}–${item.application_control?.max_per_script} 次；位置 ${(item.application_control?.positions || []).join("、") || "无"}`, `- Avoid when：${(item.avoid_when || []).join("、") || "无"}`);
    lines.push(`- 风险：${item.risk}`, `- Evidence: ${(item.evidence || []).map(evidenceLabel).join("；") || "无"}`, "");
  }
  if (isV11Profile(profile)) {
    lines.push("## 注意力节奏（文本意图）", "", `- Basis: ${profile.attention_rhythm?.basis}`);
    if (!profile.attention_rhythm?.stages?.length) lines.push("- 暂无。", "");
    for (const stage of profile.attention_rhythm?.stages || []) lines.push(`- ${stage.name} ${stage.relative_range.join("–")}：${stage.objective}；动作：${stage.generation_instruction}（${stage.status}）`);
    lines.push("", "## 负面风格", "");
    if (!profile.avoid_patterns?.length) lines.push("- 暂无足够证据，不从缺席推断。", "");
    for (const item of profile.avoid_patterns || []) lines.push(`- ${item.name}（${item.status}）：${item.avoid_instruction}；依据 ${item.basis}；触发 ${(item.trigger_signals || []).join("、")}`);
    lines.push("", "## 生成接口状态", "", "- selector 无唯一匹配时必须 abstain。", "- 内容锁以外部 content contract 与人工确认的 output audit 为准。", "- pattern/avoid span 审计是绑定输出的 bookkeeping，不能单独证明语义正确。", "- 纯文本档案不包含 IP 视觉风格。", "");
  }
  lines.push("## 来源与事实边界", "", ...(profile.boundaries || []).map((item) => `- ${item}`), "", "## 局限", "", ...((profile.limitations || []).length ? profile.limitations.map((item) => `- ${item}`) : ["- 暂无记录。"]), "", "## 人工确认", "", "- [ ] 样本取舍已确认", "- [ ] 规则和框架证据已逐项确认", "- [ ] 来源事实与 CTA 未进入 DNA", "- [ ] 隔离 generation suite 已覆盖正例、拒绝例、fallback、pattern 上限与 avoid trigger", "- [ ] 用户明确批准后才可另建 approved 版本", "");
  return lines.join("\n");
};

const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) throw new Error(`无法识别参数：${token}`);
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s);
    if (inlineValue !== undefined) options[rawKey] = inlineValue;
    else if (rest[index + 1] && !rest[index + 1].startsWith("--")) options[rawKey] = rest[++index];
    else options[rawKey] = true;
  }
  return { command, options };
};

const requireOption = (options, key) => {
  if (!nonEmptyString(options[key])) throw new Error(`缺少 --${key}`);
  return options[key];
};

const writeFileSafely = (filePath, content, force = false) => {
  const resolved = path.resolve(filePath);
  if (fs.existsSync(resolved) && !force) throw new Error(`文件已存在；如确认覆盖请加 --force：${resolved}`);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, "utf8");
  return resolved;
};

const writeJsonSafely = (filePath, value, force) => writeFileSafely(filePath, `${JSON.stringify(value, null, 2)}\n`, force);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const evidenceBundleFromOptions = (options) => {
  const keys = ["manifest", "health", "decisions", "annotations"];
  const present = keys.filter((key) => nonEmptyString(options[key]));
  if (present.length === 0) return null;
  if (present.length !== keys.length) throw new Error("证据闭环必须同时提供 --manifest、--health、--decisions、--annotations");
  return Object.fromEntries(keys.map((key) => [key, readJson(options[key])]));
};
const referenceCorpusFromOptions = (options, evidenceBundle, fallbackCorpusId = "generation-reference") => {
  const source = nonEmptyString(options["reference-source"]) ? options["reference-source"] : evidenceBundle?.manifest?.source_root;
  if (!nonEmptyString(source) || !fs.existsSync(path.resolve(source))) return null;
  return readCorpus(source, { corpusId: evidenceBundle?.manifest?.corpus_id || fallbackCorpusId });
};

const usage = () => `Usage:
  spoken-style-tool.mjs scaffold --source <file|dir> --corpus-id <id> --out <dir> [--force]
  spoken-style-tool.mjs validate --profile <json> [--manifest <json> --health <json> --decisions <json> --annotations <json>] [--generation-test <json> --reference-source <file|dir>] [--approval-record <json>]
  spoken-style-tool.mjs validate-generation-test --profile <json> --test <json> --manifest <json> --health <json> --decisions <json> --annotations <json> --reference-source <file|dir> [--require-reviewed]
  spoken-style-tool.mjs leakage --source <file|dir> --profile <json> [--annotations <json>] [--corpus-id <id>] [--min <n>]
  spoken-style-tool.mjs render --profile <json> --out <md> [--manifest <json> --health <json> --decisions <json> --annotations <json>] [--generation-test <json> --reference-source <file|dir>] [--approval-record <json>] [--force]`;

export const runCli = (argv) => {
  const { command, options } = parseArgs(argv);
  if (!command || command === "help" || options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (command === "scaffold") {
    const source = requireOption(options, "source");
    const corpusId = requireOption(options, "corpus-id");
    const out = path.resolve(requireOption(options, "out"));
    const corpus = readCorpus(source, { corpusId });
    const health = assessHealth(corpus);
    const { decisions, annotations } = buildScaffold(corpus, health);
    const force = options.force === true;
    const outputs = [
      writeJsonSafely(path.join(out, "corpus-manifest.json"), publicManifest(corpus), force),
      writeJsonSafely(path.join(out, "sample-health.json"), health, force),
      writeJsonSafely(path.join(out, "sample-decisions.draft.json"), decisions, force),
      writeJsonSafely(path.join(out, "annotations.draft.json"), annotations, force),
    ];
    process.stdout.write(`${JSON.stringify({ ok: true, unit_count: corpus.units.length, health: health.grade, outputs }, null, 2)}\n`);
    return 0;
  }
  if (command === "validate") {
    const profile = readJson(requireOption(options, "profile"));
    const evidenceBundle = evidenceBundleFromOptions(options);
    const approvalRecord = nonEmptyString(options["approval-record"]) ? readJson(options["approval-record"]) : null;
    const generationTestPath = nonEmptyString(options["generation-test"]) ? options["generation-test"] : null;
    const generationTest = generationTestPath ? readJson(generationTestPath) : null;
    const referenceCorpus = referenceCorpusFromOptions(options, evidenceBundle);
    const report = validateProfile(profile, { evidenceBundle, approvalRecord, generationTest, generationTestPath, referenceCorpus });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 1;
  }
  if (command === "validate-generation-test") {
    const profile = readJson(requireOption(options, "profile"));
    const evidenceBundle = evidenceBundleFromOptions(options);
    const profileReport = validateProfile(profile, { evidenceBundle });
    if (!profileReport.ok) {
      process.stderr.write(`${JSON.stringify(profileReport, null, 2)}\n`);
      return 1;
    }
    const generationTestPath = requireOption(options, "test");
    const generationTest = readJson(generationTestPath);
    const referenceCorpus = referenceCorpusFromOptions(options, evidenceBundle);
    const report = validateGenerationTest(profile, generationTest, { generationTestPath, referenceCorpus, requireReviewed: options["require-reviewed"] === true });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 1;
  }
  if (command === "leakage") {
    const source = requireOption(options, "source");
    const profile = readJson(requireOption(options, "profile"));
    const annotations = nonEmptyString(options.annotations) ? readJson(options.annotations) : null;
    const corpus = readCorpus(source, { corpusId: options["corpus-id"] || "leakage-scan" });
    const report = scanLeakage(corpus, profile, { minLength: options.min ? Number(options.min) : 20, annotations });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.ok ? 0 : 1;
  }
  if (command === "render") {
    const profile = readJson(requireOption(options, "profile"));
    const evidenceBundle = evidenceBundleFromOptions(options);
    const approvalRecord = nonEmptyString(options["approval-record"]) ? readJson(options["approval-record"]) : null;
    const generationTestPath = nonEmptyString(options["generation-test"]) ? options["generation-test"] : null;
    const generationTest = generationTestPath ? readJson(generationTestPath) : null;
    const referenceCorpus = referenceCorpusFromOptions(options, evidenceBundle);
    const report = validateProfile(profile, { evidenceBundle, approvalRecord, generationTest, generationTestPath, referenceCorpus });
    if (!report.ok) {
      process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
      return 1;
    }
    const output = writeFileSafely(requireOption(options, "out"), renderProfileMarkdown(profile), options.force === true);
    process.stdout.write(`${JSON.stringify({ ok: true, output }, null, 2)}\n`);
    return 0;
  }
  throw new Error(`未知命令：${command}\n${usage()}`);
};

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

export const makeTemporaryDirectoryForTests = () => fs.mkdtempSync(path.join(os.tmpdir(), "spoken-style-profiler-"));
