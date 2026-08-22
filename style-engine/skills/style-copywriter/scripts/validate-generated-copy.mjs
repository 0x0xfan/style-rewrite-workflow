#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const DEFAULT_FORBIDDEN_TERMS = [
  '原稿里', '原文里', '文案里', '飞书里', '资料里', '材料中', '根据你提供的',
  '知识库里', '根据知识库', '下面这版', '另一张截图里', '截图显示', '计算器显示',
  '参考数据更新至', '结算数据更新至'
];

const ALLOWED_KNOWLEDGE_USES = new Set(['explanation', 'method', 'mechanism', 'risk']);
const ALLOWED_LITERAL_SURFACES = new Set(['spoken', 'visual', 'audit']);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  for (const required of ['contract', 'knowledge', 'metadata', 'copy', 'report']) {
    if (!args[required]) throw new Error(`Required option --${required} is missing`);
  }
  return args;
}

function parseJsonDocument(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${error.message}`);
  }
}

function normalize(value) {
  return value
    .normalize('NFKC')
    .replace(/\s+/gu, '')
    .replace(/[\p{P}\p{S}]/gu, '')
    .toLowerCase();
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function spokenParagraphs(text) {
  return text.split(/\r?\n/gu)
    .map(line => line.trim())
    .filter(line => line
      && !line.startsWith('#')
      && !/^\[(?:插图|录屏)：/u.test(line));
}

function paragraphContaining(paragraphs, excerpt, startAt = 0) {
  const needle = normalize(excerpt || '');
  if (!needle) return -1;
  for (let index = Math.max(0, startAt); index < paragraphs.length; index += 1) {
    if (normalize(paragraphs[index]).includes(needle)) return index;
  }
  return -1;
}

function parseValidationSpec(contractText) {
  const match = contractText.match(/<!--\s*style-copywriter-validation\s*([\s\S]*?)-->/u);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch (error) {
    throw new Error(`Invalid style-copywriter-validation JSON: ${error.message}`);
  }
}

function occurrence(text, needle) {
  const start = text.indexOf(needle);
  return start >= 0 ? start : null;
}

function extractNumericClaims(text) {
  const claims = [];
  const pattern = /\d{1,2}:\d{2}|\d+(?:\.\d+)?\s*(?:[%％]|小时|分钟|元(?:一个月)?|单复购|家门店|张表|条(?:预约消息)?|位(?:到店顾客)?|天|月|年|次|步|个|类)/gu;
  for (const match of text.matchAll(pattern)) claims.push(normalize(match[0]));
  return [...new Set(claims)];
}

function extractKnowledgeClaims(text) {
  const claims = extractNumericClaims(text);
  const chineseQuantitativePatterns = [
    /[一二三四五六七八九十百千万两零〇0-9]+位数/gu,
    /百分之[一二三四五六七八九十百千万两零〇0-9]+/gu,
    /[一二三四五六七八九十百千万两零〇0-9]+倍/gu,
    /翻倍/gu,
    /当天出单/gu
  ];
  for (const pattern of chineseQuantitativePatterns) {
    for (const match of text.matchAll(pattern)) claims.push(normalize(match[0]));
  }
  return [...new Set(claims)];
}

function collectLeakage(copyText, referenceText, windowSize, allowed = []) {
  const copy = normalize(copyText);
  const reference = normalize(referenceText);
  const permitted = new Set((allowed || []).map(normalize));
  const findings = [];
  const seen = new Set();
  for (let index = 0; index <= copy.length - windowSize; index += 1) {
    const fragment = copy.slice(index, index + windowSize);
    if (permitted.has(fragment) || seen.has(fragment)) continue;
    const referenceIndex = occurrence(reference, fragment);
    if (referenceIndex === null) continue;
    seen.add(fragment);
    findings.push({ fragment, copy_offset: index, reference_offset: referenceIndex });
    if (findings.length >= 10) break;
  }
  return findings;
}

function literalSurface(item) {
  if (typeof item === 'string') return 'spoken';
  return typeof item?.surface === 'string' && item.surface.trim() ? item.surface.trim() : 'spoken';
}

function literalValue(item) {
  if (typeof item === 'string') return item;
  return typeof item?.value === 'string' ? item.value : '';
}

function collectSpeechSurfaceFindings(copyText, speechSurface) {
  if (speechSurface?.mode !== 'tts' || speechSurface?.forbid_raw_technical_tokens !== true) return [];
  const findings = [];
  const patterns = [
    ['package_handle', /@[a-z0-9_.-]+\/[a-z0-9_.-]+(?:@[a-z0-9_.-]+)?/giu],
    ['url', /https?:\/\/[^\s)\]}]+/giu],
    ['windows_path', /\b[a-z]:\\[^\s]+/giu],
    ['cli_flag', /(^|\s)--[a-z][a-z0-9-]*/gimu],
    ['inline_code', /`[^`\n]+`/gu],
    ['semantic_version', /\b(?:[a-z][a-z0-9-]*\s+)?v?\d+\.\d+(?:\.\d+)+\b/giu],
    ['long_hash', /\b[a-f0-9]{32,}\b/giu]
  ];
  for (const [kind, pattern] of patterns) {
    for (const match of copyText.matchAll(pattern)) {
      findings.push({ kind, token: match[0].trim() });
      if (findings.length >= 20) return findings;
    }
  }
  for (const term of speechSurface.forbidden_raw_terms || []) {
    if (typeof term !== 'string' || !term.trim()) continue;
    if (normalize(copyText).includes(normalize(term))) findings.push({ kind: 'forbidden_raw_term', token: term.trim() });
  }
  return findings;
}

function markdownList(items, empty = '无') {
  return items.length ? items.map(item => `- ${item}`).join('\n') : `- ${empty}`;
}

function displayPath(absolutePath) {
  if (!absolutePath) return null;
  const pathFromCwd = relative(process.cwd(), absolutePath);
  const displayValue = pathFromCwd && !pathFromCwd.startsWith('..') ? pathFromCwd : absolutePath;
  return displayValue.split(sep).join('/');
}

function formatReport({ status, contractPath, knowledgePath, metadataPath, copyPath, referencePath, passed, warnings, failures, suggestions, summary }) {
  return `# Generation Validation Report

## 状态

- 状态：${status}
- Contract：\`${contractPath}\`
- Knowledge Pack：\`${knowledgePath}\`
- Metadata：\`${metadataPath}\`
- 生成稿：\`${copyPath}\`
- 风格样本引用源：${referencePath ? `\`${referencePath}\`` : '未提供'}

## 汇总

| 检查项 | 结果 |
|---|---|
${summary.map(row => `| ${row.name} | ${row.result} |`).join('\n')}

## ✅ 通过项

${markdownList(passed)}

## ⚠️ 警告项

${markdownList(warnings)}

## ❌ 失败项

${markdownList(failures)}

## 建议修改

${markdownList(suggestions)}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contractPath = resolve(args.contract);
  const knowledgePath = resolve(args.knowledge);
  const metadataPath = resolve(args.metadata);
  const copyPath = resolve(args.copy);
  const reportPath = resolve(args.report);
  const referencePath = args.reference ? resolve(args.reference) : null;
  const [contractText, knowledgeText, metadataText, copyText, referenceText] = await Promise.all([
    readFile(contractPath, 'utf8'),
    readFile(knowledgePath, 'utf8'),
    readFile(metadataPath, 'utf8'),
    readFile(copyPath, 'utf8'),
    referencePath ? readFile(referencePath, 'utf8') : Promise.resolve(null)
  ]);

  const spec = parseValidationSpec(contractText);
  const knowledgePack = parseJsonDocument(knowledgeText, 'knowledge-pack');
  const metadata = parseJsonDocument(metadataText, 'generation-metadata');
  const passed = [];
  const warnings = [];
  const failures = [];
  const suggestions = [];
  const summary = [];
  const normalizedCopy = normalize(copyText);
  const paragraphs = spokenParagraphs(copyText);

  let styleLocks = null;
  let styleLocksText = null;
  let styleLocksPath = null;
  let styleLockLoadError = null;
  if (metadata.requires_style_acceptance_audit === true) {
    try {
      const lockPath = metadata.style_acceptance_lock?.path;
      if (typeof lockPath !== 'string' || !lockPath.trim()) throw new Error('metadata 缺少 style_acceptance_lock.path');
      styleLocksPath = resolve(dirname(metadataPath), lockPath);
      styleLocksText = await readFile(styleLocksPath, 'utf8');
      styleLocks = parseJsonDocument(styleLocksText, 'style-acceptance-locks');
    } catch (error) {
      styleLockLoadError = error.message;
    }
  }

  const knowledgeSources = Array.isArray(knowledgePack.sources) ? knowledgePack.sources : [];
  const validQuery = knowledgePack.query && typeof knowledgePack.query === 'object'
    && !Array.isArray(knowledgePack.query)
    && Object.values(knowledgePack.query).some(value => (
      typeof value === 'string' ? value.trim() : Array.isArray(value) && value.some(item => typeof item === 'string' && item.trim())
    ));
  const invalidMinimumUsedSources = !Number.isInteger(knowledgePack.minimum_used_sources)
    || knowledgePack.minimum_used_sources < 1;
  const invalidKnowledgeSources = knowledgeSources.filter(source => (
    !source || typeof source.id !== 'string' || !source.id.trim()
    || typeof source.title !== 'string' || !source.title.trim()
    || typeof source.locator !== 'string' || !source.locator.trim()
    || typeof source.excerpt !== 'string' || !source.excerpt.trim()
    || !Array.isArray(source.allowed_uses) || !source.allowed_uses.length
    || source.allowed_uses.some(use => !ALLOWED_KNOWLEDGE_USES.has(use))
  ));
  const sourceIds = knowledgeSources.map(source => source?.id?.trim()).filter(Boolean);
  const duplicateSourceIds = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index);

  if (knowledgePack.schema_version !== '1.0' || !validQuery || invalidMinimumUsedSources
    || !knowledgeSources.length || invalidKnowledgeSources.length || duplicateSourceIds.length) {
    if (knowledgePack.schema_version !== '1.0') failures.push('Knowledge Pack 的 schema_version 必须为 1.0。');
    if (!validQuery) failures.push('Knowledge Pack 缺少可审计的检索 query。');
    if (invalidMinimumUsedSources) failures.push('Knowledge Pack 的 minimum_used_sources 必须是大于 0 的整数。');
    if (!knowledgeSources.length) failures.push('Knowledge Pack 没有有效来源，知识库不能作为强制输入参与生成。');
    if (invalidKnowledgeSources.length) failures.push(`Knowledge Pack 有 ${invalidKnowledgeSources.length} 条来源缺少 id、title、locator、excerpt 或合法 allowed_uses。`);
    if (duplicateSourceIds.length) failures.push(`Knowledge Pack 存在重复来源 ID：${[...new Set(duplicateSourceIds)].join('、')}。`);
    suggestions.push('重新检索知识库并写出至少 1 条可回读、与主题相关的完整来源。');
    summary.push({ name: '知识输入', result: '失败' });
  } else {
    passed.push(`Knowledge Pack 包含 ${knowledgeSources.length} 条可审计来源。`);
    summary.push({ name: '知识输入', result: '通过' });
  }

  const minimumUsedSources = invalidMinimumUsedSources ? 1 : knowledgePack.minimum_used_sources;
  const knowledgeUsage = Array.isArray(metadata.knowledge_sources_used) ? metadata.knowledge_sources_used : [];
  const sourceById = new Map(knowledgeSources.map(source => [source?.id?.trim(), source]));
  const unknownUsage = knowledgeUsage.filter(item => (
    !item || typeof item.source_id !== 'string' || !sourceIds.includes(item.source_id.trim())
  ));
  const invalidUsageRecords = knowledgeUsage.filter(item => {
    if (!item || typeof item.source_id !== 'string' || !item.source_id.trim()
      || typeof item.section !== 'string' || !item.section.trim()
      || typeof item.use_as !== 'string' || !item.use_as.trim()) return true;
    const source = sourceById.get(item.source_id.trim());
    return !source || !source.allowed_uses.includes(item.use_as);
  });
  const missingOutputExcerpts = knowledgeUsage.filter(item => (
    !item || typeof item.output_excerpt !== 'string'
    || !normalize(item.output_excerpt).length
    || !normalizedCopy.includes(normalize(item.output_excerpt))
  ));
  const uniqueUsedSources = new Set(knowledgeUsage
    .map(item => typeof item?.source_id === 'string' ? item.source_id.trim() : null)
    .filter(id => sourceIds.includes(id)));
  const ungroundedNumericUsage = [];
  for (const item of knowledgeUsage) {
    if (!item || typeof item.output_excerpt !== 'string') continue;
    const knowledgeClaims = extractKnowledgeClaims(item.output_excerpt);
    const unsupported = knowledgeClaims.filter(claim => !normalize(contractText).includes(claim));
    if (unsupported.length) ungroundedNumericUsage.push(`${item.source_id || 'unknown'}:${unsupported.join('/')}`);
  }

  if (uniqueUsedSources.size < minimumUsedSources || unknownUsage.length || invalidUsageRecords.length
    || missingOutputExcerpts.length || ungroundedNumericUsage.length) {
    if (uniqueUsedSources.size < minimumUsedSources) failures.push(`实际使用的知识来源不足：要求至少 ${minimumUsedSources} 条，当前可验证 ${uniqueUsedSources.size} 条。`);
    if (unknownUsage.length) failures.push(`元数据引用了不存在的知识来源：${unknownUsage.map(item => item?.source_id || 'missing').join('、')}。`);
    if (invalidUsageRecords.length) failures.push(`有 ${invalidUsageRecords.length} 条知识使用记录缺少 section/use_as，或 use_as 不在来源允许用途内。`);
    if (missingOutputExcerpts.length) failures.push(`有 ${missingOutputExcerpts.length} 条知识使用记录无法在观众稿中定位 output_excerpt。`);
    if (ungroundedNumericUsage.length) failures.push(`知识补充片段含未进入 Contract 的数值或定量结果主张：${ungroundedNumericUsage.join('、')}。`);
    suggestions.push('为实际使用的知识记录有效 source_id 和正文原句；知识中的数值或定量结果先核实并写入 Contract。');
    summary.push({ name: '知识实际使用', result: '失败' });
  } else {
    passed.push(`已在正文中核验 ${uniqueUsedSources.size} 条知识来源的使用片段。`);
    summary.push({ name: '知识实际使用', result: '通过' });
  }

  if (metadata.requires_style_application_audit === true) {
    const requiredStyleControls = Array.isArray(metadata.required_style_controls)
      ? metadata.required_style_controls.filter(item => typeof item === 'string' && item.trim())
      : [];
    const declaredRules = Array.isArray(metadata.rules_applied)
      ? metadata.rules_applied.filter(item => typeof item === 'string' && item.trim())
      : [];
    const styleControls = Array.isArray(metadata.style_application?.controls)
      ? metadata.style_application.controls
      : [];
    const invalidStyleControls = styleControls.filter(item => (
      !item || typeof item.rule_id !== 'string' || !item.rule_id.trim()
      || typeof item.purpose !== 'string' || !item.purpose.trim()
      || typeof item.output_excerpt !== 'string' || !normalize(item.output_excerpt).length
      || !normalizedCopy.includes(normalize(item.output_excerpt))
    ));
    const tracedRuleIds = new Set(styleControls
      .map(item => typeof item?.rule_id === 'string' ? item.rule_id.trim() : null)
      .filter(Boolean));
    const missingRequiredControls = requiredStyleControls.filter(id => !tracedRuleIds.has(id));
    const missingDeclaredRules = declaredRules.filter(id => !tracedRuleIds.has(id));

    if (!requiredStyleControls.length || !styleControls.length || invalidStyleControls.length
      || missingRequiredControls.length || missingDeclaredRules.length) {
      if (!requiredStyleControls.length) failures.push('Style application audit 未声明 required_style_controls。');
      if (!styleControls.length) failures.push('Style application audit 没有任何可回读的正文控制记录。');
      if (invalidStyleControls.length) failures.push(`有 ${invalidStyleControls.length} 条风格控制缺少 rule_id/purpose，或 output_excerpt 无法在正文定位。`);
      if (missingRequiredControls.length) failures.push(`缺少必需风格控制的正文锚点：${missingRequiredControls.join('、')}。`);
      if (missingDeclaredRules.length) failures.push(`rules_applied 中有规则未绑定正文片段：${missingDeclaredRules.join('、')}。`);
      suggestions.push('为每个实际使用的稳定控制和辅助规则记录正文原句；元数据声明不能替代可回读的应用证据。');
      summary.push({ name: '风格实际应用', result: '失败' });
    } else {
      passed.push(`已在正文中核验 ${styleControls.length} 条风格控制锚点，覆盖 ${requiredStyleControls.length} 个必需控制。`);
      summary.push({ name: '风格实际应用', result: '通过（仅证明已落位，不证明人工相似度）' });
    }
  }

  if (metadata.requires_style_acceptance_audit === true) {
    const expectedLockHash = metadata.style_acceptance_lock?.sha256;
    const preserveExact = Array.isArray(styleLocks?.preserve_exact) ? styleLocks.preserve_exact : [];
    const preserveSemantic = Array.isArray(styleLocks?.preserve_semantic) ? styleLocks.preserve_semantic : [];
    const rejectedExact = Array.isArray(styleLocks?.rejected_exact) ? styleLocks.rejected_exact : [];
    const forbiddenPatterns = Array.isArray(styleLocks?.forbidden_patterns) ? styleLocks.forbidden_patterns : [];
    const hookDuties = Array.isArray(styleLocks?.hook_duties) ? styleLocks.hook_duties : [];
    const lockShapeOk = !styleLockLoadError
      && styleLocks?.schema_version === '1.0'
      && typeof styleLocks?.lock_id === 'string' && styleLocks.lock_id.trim()
      && styleLocks.lock_id === metadata.style_acceptance_lock?.lock_id
      && typeof expectedLockHash === 'string'
      && sha256(styleLocksText || '') === expectedLockHash
      && preserveExact.length > 0
      && rejectedExact.length > 0
      && hookDuties.length > 0;
    const missingExact = preserveExact.filter(item => (
      !item || typeof item.id !== 'string' || !item.id.trim()
      || typeof item.text !== 'string' || !item.text.trim()
      || !copyText.includes(item.text)
    ));
    const missingSemantic = preserveSemantic.filter(item => (
      !item || typeof item.id !== 'string' || !item.id.trim()
      || !Array.isArray(item.all_of) || !item.all_of.length
      || item.all_of.some(term => typeof term !== 'string' || !term.trim()
        || !normalizedCopy.includes(normalize(term)))
    ));
    const rejectedHits = rejectedExact.filter(item => (
      item && typeof item.text === 'string' && item.text.trim()
      && normalizedCopy.includes(normalize(item.text))
    ));
    const invalidPatterns = [];
    const patternHits = [];
    for (const item of forbiddenPatterns) {
      if (!item || typeof item.id !== 'string' || !item.id.trim()
        || typeof item.pattern !== 'string' || !item.pattern.trim()) {
        invalidPatterns.push(item?.id || 'unnamed_pattern');
        continue;
      }
      try {
        const flags = typeof item.flags === 'string' ? item.flags : 'u';
        const expression = new RegExp(item.pattern, flags.includes('g') ? flags : `${flags}g`);
        const count = [...copyText.matchAll(expression)].length;
        const maximum = Number.isInteger(item.max_occurrences) ? item.max_occurrences : 0;
        if (count > maximum) patternHits.push(`${item.id}:${count}>${maximum}`);
      } catch {
        invalidPatterns.push(item.id);
      }
    }

    const invalidHookDuties = [];
    for (const duty of hookDuties) {
      const maximumGap = duty?.max_paragraph_gap;
      if (!duty || typeof duty.id !== 'string' || !duty.id.trim()
        || typeof duty.hook_excerpt !== 'string' || !duty.hook_excerpt.trim()
        || typeof duty.delivery_excerpt !== 'string' || !duty.delivery_excerpt.trim()
        || !Number.isInteger(maximumGap) || maximumGap < 0
        || !Array.isArray(duty.evidence_ids) || !duty.evidence_ids.length) {
        invalidHookDuties.push(`${duty?.id || 'unnamed_hook'}:invalid_shape`);
        continue;
      }
      const hookIndex = paragraphContaining(paragraphs, duty.hook_excerpt);
      const deliveryIndex = hookIndex >= 0
        ? paragraphContaining(paragraphs, duty.delivery_excerpt, hookIndex)
        : -1;
      if (hookIndex < 0 || deliveryIndex < hookIndex || deliveryIndex - hookIndex > maximumGap) {
        invalidHookDuties.push(`${duty.id}:missing_or_unfulfilled`);
      }
    }

    if (!lockShapeOk || missingExact.length || missingSemantic.length || rejectedHits.length
      || invalidPatterns.length || patternHits.length || invalidHookDuties.length) {
      if (styleLockLoadError) failures.push(`人工校准锁文件不可读：${styleLockLoadError}。`);
      if (!lockShapeOk) failures.push('人工校准锁文件结构、lock_id 或 SHA-256 与 metadata 不一致。');
      if (missingExact.length) failures.push(`已通过表达被删除或改写：${missingExact.map(item => item?.id || 'unknown').join('、')}。`);
      if (missingSemantic.length) failures.push(`语义保留锁未满足：${missingSemantic.map(item => item?.id || 'unknown').join('、')}。`);
      if (rejectedHits.length) failures.push(`重新出现用户已拒绝的表达：${rejectedHits.map(item => item.id || item.text).join('、')}。`);
      if (invalidPatterns.length) failures.push(`AI 句壳规则无效：${invalidPatterns.join('、')}。`);
      if (patternHits.length) failures.push(`AI 句壳超过预算：${patternHits.join('、')}。`);
      if (invalidHookDuties.length) failures.push(`钩子没有在限定段落内兑现：${invalidHookDuties.join('、')}。`);
      suggestions.push('恢复人工通过表达；让每个主要钩子由已锁事实支撑，并在同段或后续限定段落内立即兑现。');
      summary.push({ name: '人工风格硬锁', result: '失败' });
    } else {
      passed.push(`人工校准锁通过：保留 ${preserveExact.length} 条原句、${preserveSemantic.length} 条语义关系，并兑现 ${hookDuties.length} 个主要钩子职责。`);
      summary.push({ name: '人工风格硬锁', result: '通过（不等于用户已批准整稿）' });
    }

    const allocationRule = styleLocks?.content_allocation;
    if (allocationRule) {
      const supportingExcerpts = metadata.content_allocation_audit?.supporting_excerpts;
      const maximumShare = allocationRule.max_supporting_share;
      const missingSupportingExcerpts = !Array.isArray(supportingExcerpts)
        ? ['missing_supporting_excerpts']
        : supportingExcerpts.filter(excerpt => typeof excerpt !== 'string' || !excerpt.trim()
          || !normalizedCopy.includes(normalize(excerpt)));
      const supportingUnits = Array.isArray(supportingExcerpts)
        ? supportingExcerpts.reduce((total, excerpt) => total + normalize(excerpt || '').length, 0)
        : 0;
      const totalUnits = normalize(paragraphs.join('')).length;
      const share = totalUnits ? supportingUnits / totalUnits : 1;
      if (typeof maximumShare !== 'number' || maximumShare <= 0 || maximumShare >= 1
        || missingSupportingExcerpts.length || share > maximumShare) {
        failures.push(`辅助内容占比门禁失败：${supportingUnits}/${totalUnits}=${(share * 100).toFixed(1)}%，上限为 ${typeof maximumShare === 'number' ? `${(maximumShare * 100).toFixed(1)}%` : '未配置'}。`);
        summary.push({ name: '内容占比', result: '失败' });
      } else {
        passed.push(`辅助内容占比为 ${supportingUnits}/${totalUnits}（${(share * 100).toFixed(1)}%），未超过 ${(maximumShare * 100).toFixed(1)}%。`);
        summary.push({ name: '内容占比', result: '通过' });
      }
    }
  }

  if (metadata.requires_listener_progression_audit === true) {
    const progression = metadata.listener_progression;
    const beats = Array.isArray(progression?.beats) ? progression.beats : [];
    const requiredFields = [
      'id', 'question_before', 'information_revealed', 'meaning_for_viewer',
      'expected_judgment_after', 'next_question', 'output_excerpt'
    ];
    const invalidBeats = beats.filter(beat => (
      !beat || requiredFields.some(field => typeof beat[field] !== 'string' || !beat[field].trim())
      || !normalizedCopy.includes(normalize(beat.output_excerpt))
    ));
    const duplicateBeatIds = beats
      .map(beat => beat?.id)
      .filter((id, index, ids) => typeof id === 'string' && ids.indexOf(id) !== index);
    if (typeof progression?.core_question !== 'string' || !progression.core_question.trim()
      || !beats.length || invalidBeats.length || duplicateBeatIds.length) {
      if (typeof progression?.core_question !== 'string' || !progression.core_question.trim()) {
        failures.push('听众推进计划缺少 core_question。');
      }
      if (!beats.length) failures.push('听众推进计划没有任何 beat。');
      if (invalidBeats.length) failures.push(`听众推进计划有 ${invalidBeats.length} 个 beat 字段不完整，或 output_excerpt 无法在正文定位。`);
      if (duplicateBeatIds.length) failures.push(`听众推进计划存在重复 beat ID：${[...new Set(duplicateBeatIds)].join('、')}。`);
      suggestions.push('先写“当前疑问 → 本段揭晓 → 对观众的意义 → 预期判断变化 → 下一问题”，再绑定真实正文片段。');
      summary.push({ name: '听众推进计划', result: '失败' });
    } else {
      passed.push(`已在正文中核验 ${beats.length} 个听众推进 beat；该结果只证明计划落位，不证明真实注意力或风格相似度。`);
      summary.push({ name: '听众推进计划', result: '通过（仅证明落位）' });
    }
  }

  if (metadata.requires_baseline_enhanced_comparison === true) {
    const comparison = metadata.comparison_audit;
    const comparisonFailures = [];
    let baselineText = null;
    let enhancedText = null;
    if (!comparison || comparison.status !== 'completed_pending_user_review'
      || comparison.selected_output !== 'enhanced'
      || !Array.isArray(comparison.dimensions) || comparison.dimensions.length < 4
      || metadata.style_acceptance_status !== 'pending_user_review') {
      comparisonFailures.push('invalid_comparison_record');
    }
    try {
      const baselinePath = resolve(dirname(metadataPath), comparison?.baseline_path || '');
      const enhancedPath = resolve(dirname(metadataPath), comparison?.enhanced_path || '');
      [baselineText, enhancedText] = await Promise.all([
        readFile(baselinePath, 'utf8'),
        readFile(enhancedPath, 'utf8')
      ]);
      if (sha256(baselineText) !== comparison.baseline_sha256) comparisonFailures.push('baseline_hash_mismatch');
      if (sha256(enhancedText) !== comparison.enhanced_sha256) comparisonFailures.push('enhanced_hash_mismatch');
      if (sha256(copyText) !== comparison.enhanced_sha256) comparisonFailures.push('validated_copy_is_not_enhanced');
      if (normalize(baselineText) === normalize(enhancedText)) comparisonFailures.push('baseline_and_enhanced_identical');
    } catch (error) {
      comparisonFailures.push(`comparison_file_error:${error.message}`);
    }
    if (comparisonFailures.length) {
      failures.push(`Baseline/Enhanced 对照未闭合：${[...new Set(comparisonFailures)].join('、')}。`);
      suggestions.push('结构性改稿后重新生成两份输出、记录新 SHA-256，并把风格验收保持为 pending_user_review。');
      summary.push({ name: 'Baseline/Enhanced 对照', result: '失败' });
    } else {
      passed.push('本轮 Baseline/Enhanced 文件、摘要和当前验证稿已闭合；最终相似度仍等待用户判断。');
      summary.push({ name: 'Baseline/Enhanced 对照', result: '通过（待用户验收）' });
    }
  }

  if (copyText.trim().length < 120) {
    failures.push('生成稿少于 120 个字符，无法作为完整口播稿审阅。');
    suggestions.push('补齐完整的开头、主体和收束后重新生成。');
    summary.push({ name: '可读长度', result: '失败' });
  } else {
    passed.push(`生成稿长度为 ${copyText.trim().length} 个字符。`);
    summary.push({ name: '可读长度', result: '通过' });
  }

  const forbiddenTerms = [...new Set([...DEFAULT_FORBIDDEN_TERMS, ...(spec?.forbidden_terms || [])])];
  const forbiddenHits = forbiddenTerms.filter(term => normalizedCopy.includes(normalize(term)));
  if (forbiddenHits.length) {
    failures.push(`命中面向观众稿的禁用词：${forbiddenHits.join('、')}。`);
    suggestions.push('删除审计、来源、截图或改写过程元话语。');
    summary.push({ name: '禁用词', result: '失败' });
  } else {
    passed.push('未命中观众稿禁用词。');
    summary.push({ name: '禁用词', result: '通过' });
  }

  if (!spec) {
    warnings.push('Contract 未提供 style-copywriter-validation 清单；未执行数据保留与数据主体关系的机器核对。');
    suggestions.push('在 contract 中补充 required_literals 与 required_groups，再重跑验证。');
    summary.push({ name: '事实锁', result: '警告：未提供清单' });
  } else {
    const literalRecords = Array.isArray(spec.required_literals) ? spec.required_literals : [];
    const invalidLiteralRecords = literalRecords.filter(item => (
      !literalValue(item).trim() || !ALLOWED_LITERAL_SURFACES.has(literalSurface(item))
    ));
    const spokenLiterals = literalRecords.filter(item => literalSurface(item) === 'spoken');
    const missingLiterals = spokenLiterals.filter(item => !normalizedCopy.includes(normalize(literalValue(item))));
    if (invalidLiteralRecords.length) {
      failures.push(`required_literals 有 ${invalidLiteralRecords.length} 项缺少 value，或 surface 不是 spoken/visual/audit。`);
      suggestions.push('为每个字面值声明输出面：spoken 才要求进入口播；visual/audit 只保留在画面或私有审计。');
    }
    if (missingLiterals.length) {
      failures.push(`缺少锁定口播字面值：${missingLiterals.map(item => typeof item === 'string' ? item : `${item.id}=${item.value}`).join('、')}。`);
      suggestions.push('恢复缺失的数据、单位、条件或 CTA，且不要改变它们的含义。');
      summary.push({ name: '数据保留', result: '失败' });
    } else {
      passed.push(`已保留 ${spokenLiterals.length} 项锁定口播字面值；${literalRecords.length - spokenLiterals.length} 项 visual/audit 值未被强迫写进口播。`);
      summary.push({ name: '数据保留', result: invalidLiteralRecords.length ? '失败' : '通过' });
    }

    const missingGroups = (spec.required_groups || []).filter(group => (group.all_of || []).some(term => !normalizedCopy.includes(normalize(term))));
    if (missingGroups.length) {
      failures.push(`以下数据主体或关系不完整：${missingGroups.map(group => group.id || group.label || '未命名关系').join('、')}。`);
      suggestions.push('让每组数据紧邻其主体、范围或触发条件，不要把案例、讲述者和店铺数据混写。');
      summary.push({ name: '数据主体与关系', result: '失败' });
    } else {
      passed.push(`已保留 ${(spec.required_groups || []).length} 组数据主体与关系。`);
      summary.push({ name: '数据主体与关系', result: '通过' });
    }

    const speechFindings = collectSpeechSurfaceFindings(copyText, spec.speech_surface);
    if (speechFindings.length) {
      failures.push(`合成口播仍含原始技术字符串：${speechFindings.map(item => `${item.kind}:${item.token}`).join('、')}。`);
      suggestions.push('把包名、版本、命令、路径和密钥名移到 visual/audit 面；口播改用自然中文或已批准的发音别名。');
      summary.push({ name: 'TTS 可朗读性', result: '失败' });
    } else if (spec.speech_surface?.mode === 'tts') {
      passed.push('合成口播未命中已配置的原始技术字符串门禁。');
      summary.push({ name: 'TTS 可朗读性', result: '通过' });
    }
  }

  if (referenceText === null) {
    warnings.push('未提供风格样本原文，未执行 20 字连续引用泄漏扫描。');
    suggestions.push('提供已获准读取的风格样本原文路径后重跑。');
    summary.push({ name: '20 字引用泄漏', result: '警告：未扫描' });
  } else {
    const windowSize = Number.isInteger(spec?.reference_overlap_window) ? spec.reference_overlap_window : 20;
    const findings = collectLeakage(copyText, referenceText, windowSize, spec?.allowed_reference_overlap || []);
    if (findings.length) {
      failures.push(`发现 ${findings.length} 处至少 ${windowSize} 字的连续引用重合。`);
      suggestions.push('重写命中片段；只保留目标 contract 中自己的事实，不复用风格样本表达。');
      summary.push({ name: `${windowSize} 字引用泄漏`, result: '失败' });
    } else {
      passed.push(`未发现至少 ${windowSize} 字的连续引用重合。`);
      summary.push({ name: `${windowSize} 字引用泄漏`, result: '通过' });
    }
  }

  const status = failures.length ? 'failed' : warnings.length ? 'warning' : 'passed';
  const report = formatReport({
    status,
    contractPath: displayPath(contractPath),
    knowledgePath: displayPath(knowledgePath),
    metadataPath: displayPath(metadataPath),
    copyPath: displayPath(copyPath),
    referencePath: displayPath(referencePath),
    passed,
    warnings,
    failures,
    suggestions,
    summary
  });
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report, 'utf8');
  console.log(JSON.stringify({ status, report_path: displayPath(reportPath), passed: passed.length, warnings: warnings.length, failures: failures.length }));
  process.exitCode = status === 'failed' ? 1 : 0;
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'error', message: error.message }));
  process.exitCode = 2;
});
