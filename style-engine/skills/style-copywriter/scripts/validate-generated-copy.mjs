#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

const DEFAULT_FORBIDDEN_TERMS = [
  '原稿里', '原文里', '文案里', '飞书里', '资料里', '材料中', '根据你提供的',
  '知识库里', '根据知识库', '下面这版', '另一张截图里', '截图显示', '计算器显示',
  '参考数据更新至', '结算数据更新至'
];

const ALLOWED_KNOWLEDGE_USES = new Set(['explanation', 'method', 'mechanism', 'risk']);

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
    const missingLiterals = (spec.required_literals || []).filter(item => !normalizedCopy.includes(normalize(typeof item === 'string' ? item : item.value)));
    if (missingLiterals.length) {
      failures.push(`缺少锁定字面值：${missingLiterals.map(item => typeof item === 'string' ? item : `${item.id}=${item.value}`).join('、')}。`);
      suggestions.push('恢复缺失的数据、单位、条件或 CTA，且不要改变它们的含义。');
      summary.push({ name: '数据保留', result: '失败' });
    } else {
      passed.push(`已保留 ${(spec.required_literals || []).length} 项锁定字面值。`);
      summary.push({ name: '数据保留', result: '通过' });
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
