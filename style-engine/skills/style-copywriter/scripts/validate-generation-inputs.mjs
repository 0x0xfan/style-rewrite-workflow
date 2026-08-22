#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const EVIDENCE_STATES = new Set([
  'verified', 'bounded_verified', 'test_only', 'unverified', 'rejected'
]);
const KNOWLEDGE_STANCES = new Set([
  'support', 'counterevidence', 'supplement', 'conflict'
]);
const ALLOWED_KNOWLEDGE_USES = new Set([
  'explanation', 'method', 'mechanism', 'risk'
]);
const ACCEPTED_STATES = new Set(['accepted', 'approved', 'passed']);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    args[token.slice(2)] = value;
    index += 1;
  }
  for (const key of ['task', 'contract', 'knowledge', 'metadata', 'report']) {
    if (!args[key]) throw new Error(`Required option --${key} is missing`);
  }
  return args;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${error.message}`);
  }
}

function parseAlignment(contractText) {
  const match = contractText.match(/<!--\s*style-copywriter-task-alignment\s*([\s\S]*?)-->/u);
  if (!match) return null;
  return parseJson(match[1].trim(), 'style-copywriter-task-alignment');
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameObject(left, right) {
  return canonical(left) === canonical(right);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function displayPath(pathValue) {
  const fromCwd = relative(process.cwd(), pathValue);
  const shown = fromCwd && !fromCwd.startsWith('..') ? fromCwd : pathValue;
  return shown.split(sep).join('/');
}

function list(items, empty = '无') {
  return items.length ? items.map(item => `- ${item}`).join('\n') : `- ${empty}`;
}

function reportText({ status, paths, passed, warnings, failures, summary }) {
  return `# Generation Input Preflight Report

## 状态

- 状态：${status}
- Task Brief：\`${displayPath(paths.task)}\`
- Contract：\`${displayPath(paths.contract)}\`
- Knowledge Pack：\`${displayPath(paths.knowledge)}\`
- Metadata：\`${displayPath(paths.metadata)}\`

## 汇总

| 检查项 | 结果 |
|---|---|
${summary.map(row => `| ${row.name} | ${row.result} |`).join('\n')}

## ✅ 通过项

${list(passed)}

## ⚠️ 警告项

${list(warnings)}

## ❌ 失败项

${list(failures)}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = Object.fromEntries(['task', 'contract', 'knowledge', 'metadata', 'report']
    .map(key => [key, resolve(args[key])]));
  const [taskText, contractText, knowledgeText, metadataText] = await Promise.all([
    readFile(paths.task, 'utf8'),
    readFile(paths.contract, 'utf8'),
    readFile(paths.knowledge, 'utf8'),
    readFile(paths.metadata, 'utf8')
  ]);
  const task = parseJson(taskText, 'task-brief');
  const knowledge = parseJson(knowledgeText, 'knowledge-pack');
  const metadata = parseJson(metadataText, 'generation-metadata');
  const alignment = parseAlignment(contractText);
  const taskDigest = sha256(taskText);
  const lockReference = task.style_acceptance_lock;
  let styleLocks = null;
  let styleLocksText = null;
  let styleLocksPath = null;
  let calibrationText = null;
  let calibrationPath = null;
  let styleLockLoadError = null;
  if (nonempty(lockReference?.path)) {
    styleLocksPath = resolve(dirname(paths.task), lockReference.path);
    try {
      styleLocksText = await readFile(styleLocksPath, 'utf8');
      styleLocks = parseJson(styleLocksText, 'style-acceptance-locks');
      if (nonempty(styleLocks?.calibration_source?.path)) {
        calibrationPath = resolve(dirname(styleLocksPath), styleLocks.calibration_source.path);
        calibrationText = await readFile(calibrationPath, 'utf8');
      }
    } catch (error) {
      styleLockLoadError = error.message;
    }
  }
  const passed = [];
  const warnings = [];
  const failures = [];
  const summary = [];

  const role = task.narrative_role_lock;
  const viewer = role?.target_viewer;
  const taskShapeOk = task.schema_version === '1.0'
    && nonempty(task.task_id)
    && nonempty(task.user_requirement?.verbatim)
    && nonempty(task.content_mode)
    && nonempty(task.selected_framework)
    && role && typeof role === 'object'
    && nonempty(role.narrator)
    && viewer && typeof viewer === 'object'
    && nonempty(viewer.goal)
    && viewer.starting_state && typeof viewer.starting_state === 'object'
    && Object.keys(viewer.starting_state).length > 0
    && Array.isArray(viewer.excluded_assumptions)
    && viewer.excluded_assumptions.length > 0
    && nonempty(role.content_goal);
  if (taskShapeOk) {
    passed.push('Task Brief 含用户原话、内容模式和带初始能力状态的叙事角色锁。');
    summary.push({ name: '任务结构', result: '通过' });
  } else {
    failures.push('Task Brief 缺少用户原话、内容模式、selected framework，或结构化叙事角色字段。');
    summary.push({ name: '任务结构', result: '失败' });
  }

  const metadataAlignment = metadata.task_alignment;
  const alignmentOk = alignment
    && alignment.task_id === task.task_id
    && alignment.task_brief_sha256 === taskDigest
    && alignment.content_mode === task.content_mode
    && alignment.selected_framework === task.selected_framework
    && sameObject(alignment.narrative_role_lock, task.narrative_role_lock)
    && metadataAlignment
    && metadataAlignment.task_id === task.task_id
    && metadataAlignment.task_brief_sha256 === taskDigest
    && metadataAlignment.content_mode === task.content_mode
    && metadataAlignment.selected_framework === task.selected_framework
    && sameObject(metadataAlignment.narrative_role_lock, task.narrative_role_lock);
  if (alignmentOk) {
    passed.push('用户任务、事实契约与生成计划的角色/能力状态完全一致。');
    summary.push({ name: '任务语义锁', result: '通过' });
  } else {
    failures.push('任务语义锁不一致：contract 或 metadata 未逐字段绑定 Task Brief 及其 SHA-256。');
    summary.push({ name: '任务语义锁', result: '失败' });
  }

  const evidence = Array.isArray(task.evidence_registry) ? task.evidence_registry : [];
  const evidenceIds = evidence.map(item => item?.id).filter(nonempty);
  const evidenceById = new Map(evidence.map(item => [item?.id, item]));
  const evidenceOk = evidence.length > 0
    && evidenceIds.length === evidence.length
    && new Set(evidenceIds).size === evidenceIds.length
    && evidence.every(item => EVIDENCE_STATES.has(item.status)
      && nonempty(item.locator) && Array.isArray(item.supports));
  if (evidenceOk) {
    passed.push(`证据登记表含 ${evidence.length} 条唯一、带状态和 locator 的记录。`);
    summary.push({ name: '证据登记', result: '通过' });
  } else {
    failures.push('证据登记表为空、ID 重复，或缺少合法状态、locator、supports。');
    summary.push({ name: '证据登记', result: '失败' });
  }

  const hasCalibrationEvidence = evidence.some(item => /calibration|人工校准/iu
    .test(`${item?.id || ''} ${item?.locator || ''}`));
  const styleLockRequired = task.requires_style_acceptance_lock === true || hasCalibrationEvidence;
  const metadataLock = metadata.style_acceptance_lock;
  const preserveExact = Array.isArray(styleLocks?.preserve_exact) ? styleLocks.preserve_exact : [];
  const rejectedExact = Array.isArray(styleLocks?.rejected_exact) ? styleLocks.rejected_exact : [];
  const hookDuties = Array.isArray(styleLocks?.hook_duties) ? styleLocks.hook_duties : [];
  const styleLockOk = !styleLockRequired || (
    !styleLockLoadError
    && styleLocks?.schema_version === '1.0'
    && nonempty(styleLocks?.lock_id)
    && nonempty(lockReference?.sha256)
    && sha256(styleLocksText || '') === lockReference.sha256
    && metadataLock?.lock_id === styleLocks.lock_id
    && metadataLock?.sha256 === lockReference.sha256
    && nonempty(styleLocks?.calibration_source?.path)
    && nonempty(styleLocks?.calibration_source?.sha256)
    && calibrationText !== null
    && sha256(calibrationText) === styleLocks.calibration_source.sha256
    && preserveExact.length > 0
    && rejectedExact.length > 0
    && hookDuties.length > 0
  );
  if (styleLockOk) {
    if (styleLockRequired) {
      passed.push(`人工校准已绑定锁文件、原始校准摘要、${preserveExact.length} 条保留表达和 ${hookDuties.length} 个钩子职责。`);
      summary.push({ name: '人工校准硬锁', result: '通过' });
    }
  } else {
    if (styleLockLoadError) failures.push(`人工校准锁文件不可读：${styleLockLoadError}。`);
    failures.push('存在人工校准证据，但 Task Brief、Metadata、锁文件或校准原文的 SHA-256 未闭合，或保留/拒绝/钩子职责为空。');
    summary.push({ name: '人工校准硬锁', result: '失败' });
  }

  const draftProfile = /draft|review_only/iu.test(`${task.style_profile_status || ''} ${metadata.style_status || ''}`);
  const comparisonPlan = task.comparison_plan;
  const metadataPlan = metadata.comparison_plan;
  const comparisonPlanOk = !draftProfile || (
    metadata.requires_baseline_enhanced_comparison === true
    && nonempty(comparisonPlan?.baseline_output)
    && nonempty(comparisonPlan?.enhanced_output)
    && comparisonPlan?.baseline_output !== comparisonPlan?.enhanced_output
    && metadataPlan?.baseline_output === comparisonPlan.baseline_output
    && metadataPlan?.enhanced_output === comparisonPlan.enhanced_output
    && metadataPlan?.status === 'planned'
    && metadata.validation_status === 'pending'
    && metadata.style_acceptance_status === 'pending_user_review'
  );
  if (comparisonPlanOk) {
    if (draftProfile) {
      passed.push('Draft/review-only profile 已安排本轮新鲜 Baseline/Enhanced 对照，旧验收结果不得复用。');
      summary.push({ name: '对照计划', result: '通过' });
    }
  } else {
    failures.push('Draft/review-only profile 缺少本轮 Baseline/Enhanced 输出计划，metadata 未按 planned 状态回显，或旧 validation/style acceptance 状态未重置。');
    summary.push({ name: '对照计划', result: '失败' });
  }

  const gate = task.framework_gate;
  const requiredSlots = Array.isArray(gate?.required_slots) ? gate.required_slots : [];
  const slots = Array.isArray(gate?.slots) ? gate.slots : [];
  const slotsById = new Map(slots.map(slot => [slot?.id, slot]));
  const slotFailures = [];
  for (const requirement of requiredSlots) {
    const slot = slotsById.get(requirement?.id);
    const allowedStates = Array.isArray(requirement?.allowed_states) ? requirement.allowed_states : [];
    if (!slot || !allowedStates.includes(slot.state)) {
      slotFailures.push(requirement?.id || 'unnamed_slot');
      continue;
    }
    if (!Array.isArray(slot.evidence_ids) || slot.evidence_ids.length === 0) {
      slotFailures.push(`${requirement.id}:missing_evidence`);
      continue;
    }
    for (const evidenceId of slot.evidence_ids) {
      const item = evidenceById.get(evidenceId);
      if (!item || !item.supports.includes(requirement.id)) {
        slotFailures.push(`${requirement.id}:${evidenceId}`);
      }
    }
  }
  const gateDigest = sha256(canonical(gate || null));
  const gateEchoOk = metadata.framework_used === task.selected_framework
    && metadata.framework_gate_sha256 === gateDigest;
  if (requiredSlots.length > 0 && slots.length > 0 && slotFailures.length === 0 && gateEchoOk) {
    passed.push(`Framework ${task.selected_framework} 的 ${requiredSlots.length} 个必需 slot 均满足证据等级。`);
    summary.push({ name: 'Framework 准入', result: '通过' });
  } else {
    if (slotFailures.length) failures.push(`Framework slot 不满足准入：${[...new Set(slotFailures)].join('、')}。`);
    if (!gateEchoOk) failures.push('Metadata 未绑定 selected framework 或 framework gate SHA-256。');
    if (!requiredSlots.length || !slots.length) failures.push('Task Brief 未声明 framework required_slots/slots。');
    summary.push({ name: 'Framework 准入', result: '失败' });
  }

  const sources = Array.isArray(knowledge.sources) ? knowledge.sources : [];
  const sourceById = new Map(sources.map(source => [source?.id, source]));
  const usages = Array.isArray(metadata.knowledge_sources_used) ? metadata.knowledge_sources_used : [];
  const knowledgeFailures = [];
  if (knowledge.schema_version !== '1.0' || !sources.length || !usages.length) {
    knowledgeFailures.push('missing_pack_or_usage');
  }
  for (const usage of usages) {
    const source = sourceById.get(usage?.source_id);
    const relevance = source?.relevance;
    const allowedStances = relevance?.allowed_stances || [];
    const allowedSections = relevance?.allowed_sections || [];
    if (!source || !ALLOWED_KNOWLEDGE_USES.has(usage?.use_as)
      || !source.allowed_uses?.includes(usage.use_as)
      || !KNOWLEDGE_STANCES.has(usage?.stance)
      || relevance?.task_brief_sha256 !== taskDigest
      || !allowedStances.includes(usage.stance)
      || !allowedSections.includes(usage.section)) {
      knowledgeFailures.push(usage?.source_id || 'unknown_source');
      continue;
    }
    if ((usage.stance === 'conflict' || usage.stance === 'counterevidence')
      && usage.use_as !== 'risk') {
      knowledgeFailures.push(`${usage.source_id}:stance_misuse`);
    }
    if (relevance.core_claim_compatible === false && usage.section === 'core_claim') {
      knowledgeFailures.push(`${usage.source_id}:core_claim_forbidden`);
    }
  }
  if (knowledgeFailures.length === 0) {
    passed.push(`已验证 ${usages.length} 条知识使用计划的立场、落位和任务摘要绑定。`);
    summary.push({ name: '知识语义相关性', result: '通过' });
  } else {
    failures.push(`知识使用计划与任务角度、立场或落位不一致：${[...new Set(knowledgeFailures)].join('、')}。`);
    summary.push({ name: '知识语义相关性', result: '失败' });
  }

  const acceptance = metadata.acceptance_status;
  const hasApproval = nonempty(metadata.approval_record);
  const rejected = acceptance === 'failed_user_rejected'
    || metadata.delivery_status === 'rejected_by_user';
  if (rejected) {
    failures.push('元数据仍处于用户拒绝状态，不得作为新的生成计划继续。');
    summary.push({ name: '验收状态', result: '失败' });
  } else if (ACCEPTED_STATES.has(acceptance) && !hasApproval) {
    failures.push('元数据宣称已接受/批准，但没有外部 approval record。');
    summary.push({ name: '验收状态', result: '失败' });
  } else {
    passed.push('验收状态未把技术预检冒充用户批准。');
    summary.push({ name: '验收状态', result: '通过' });
  }

  const status = failures.length ? 'failed' : warnings.length ? 'warning' : 'passed';
  const report = reportText({ status, paths, passed, warnings, failures, summary });
  await mkdir(dirname(paths.report), { recursive: true });
  await writeFile(paths.report, report, 'utf8');
  console.log(JSON.stringify({ status, report_path: displayPath(paths.report), passed: passed.length, warnings: warnings.length, failures: failures.length }));
  process.exitCode = failures.length ? 1 : 0;
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'error', message: error.message }));
  process.exitCode = 2;
});
