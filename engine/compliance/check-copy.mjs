#!/usr/bin/env node
// 小红书 / 抖音 内容合规预检。
// 保守启发式，不是平台官方规则；通过不等于一定能发出去。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(here, 'platform-rules.json'), 'utf8'));

export function checkCopy(text, rules = RULES) {
  // 标题行和分隔线不计入正文密度，但仍参与违禁词匹配。
  const body = text
    .split('\n')
    .filter((l) => !l.startsWith('#') && l.trim() !== '---')
    .join('\n');
  const chars = body.replace(/\s/g, '').length;

  const findings = [];
  // 去空白后再匹配，避免 '一天 100 单' 这类写法绕过模式。
  const flat = text.replace(/\s/g, '');
  const scan = (groups, level) => {
    for (const g of groups) {
      for (const p of g.patterns) {
        const re = new RegExp(p, 'gi');
        const hits = [...flat.matchAll(re)].map((m) => m[0]);
        if (hits.length) {
          findings.push({ level, group: g.id, reason: g.reason, pattern: p, hits });
        }
      }
    }
  };
  scan(rules.block, 'block');
  scan(rules.warn, 'warn');

  const d = rules.density;
  let moneyHits = 0;
  const termCounts = {};
  for (const t of d.terms) {
    const n = (body.match(new RegExp(t, 'g')) || []).length;
    if (n) termCounts[t] = n;
    moneyHits += n * t.length;
  }
  const ratio = chars ? moneyHits / chars : 0;
  const densityOver = ratio > d.max_ratio;
  if (densityOver) {
    findings.push({
      level: 'block',
      group: d.id,
      reason: d.reason,
      pattern: `ratio ${(ratio * 100).toFixed(2)}% > ${(d.max_ratio * 100).toFixed(2)}%`,
      hits: Object.entries(termCounts).map(([k, v]) => `${k}x${v}`)
    });
  }

  const blocks = findings.filter((f) => f.level === 'block');
  return {
    passed: blocks.length === 0,
    chars,
    densityRatio: ratio,
    findings,
    blockCount: blocks.length,
    warnCount: findings.length - blocks.length
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: node engine/compliance/check-copy.mjs <文案文件>');
    process.exit(2);
  }
  const r = checkCopy(readFileSync(file, 'utf8'));
  console.log(`文件: ${file}`);
  console.log(`正文有效字符: ${r.chars}`);
  console.log(`赚钱类词密度: ${(r.densityRatio * 100).toFixed(2)}% (上限 ${(RULES.density.max_ratio * 100).toFixed(2)}%)`);
  console.log(`结果: ${r.passed ? 'PASS' : 'FAIL'}  block=${r.blockCount} warn=${r.warnCount}`);
  for (const f of r.findings) {
    console.log(`  [${f.level}] ${f.group}: ${f.hits.join(', ')}  <- ${f.reason}`);
  }
  console.log(`\n注意: ${RULES.disclaimer}`);
  process.exit(r.passed ? 0 : 1);
}
