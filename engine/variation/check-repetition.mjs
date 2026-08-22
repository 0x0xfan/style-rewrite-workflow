#!/usr/bin/env node
// 跨稿重复检测。批量产出时，防止多篇之间原样复用表达。
// 与来源泄漏扫描是两件事：那个查"和原文重不重"，这个查"几篇产出之间重不重"。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(here, 'repetition-rules.json'), 'utf8'));

const bodyOf = (text) =>
  text
    .split('\n')
    .filter((l) => !l.startsWith('#') && !l.startsWith('>') && l.trim() !== '---')
    .join('')
    .replace(/\s/g, '');

// 受保护的事实串不计入重复：事实该一致，硬换措辞会扭曲事实。
const stripProtected = (s, protectedPhrases) => {
  let out = s;
  for (const p of protectedPhrases) out = out.split(p).join('\u0000');
  return out;
};

const gramsOf = (s, n) => {
  const set = new Set();
  for (let i = 0; i + n <= s.length; i++) {
    const g = s.slice(i, i + n);
    if (!g.includes('\u0000')) set.add(g);
  }
  return set;
};

export function checkRepetition(docs, rules = RULES) {
  const { gram, pairMaxRatio, sameIpPairMaxRatio, sharedPhraseMinLen, sharedPhraseMaxDocs } = rules;
  const prot = rules.protectedPhrases || [];
  const names = Object.keys(docs);
  const bodies = {};
  for (const n of names) bodies[n] = stripProtected(bodyOf(docs[n]), prot);

  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      const ga = gramsOf(bodies[a], gram), gb = gramsOf(bodies[b], gram);
      let shared = 0;
      for (const g of ga) if (gb.has(g)) shared++;
      const denom = Math.max(1, Math.min(ga.size, gb.size));
      const ratio = shared / denom;
      // 同 IP 的长短版本是同一内容的两个时长，允许更高重合。
      const sameIp = a.split('/')[0] === b.split('/')[0];
      const cap = sameIp ? sameIpPairMaxRatio : pairMaxRatio;
      pairs.push({ a, b, shared, ratio, cap, sameIp, over: ratio > cap });
    }
  }

  // 长片段出现在过多篇里 = 原样复用，不论比例。
  const counts = new Map();
  for (const n of names) {
    for (const g of gramsOf(bodies[n], sharedPhraseMinLen)) {
      if (!counts.has(g)) counts.set(g, new Set());
      counts.get(g).add(n);
    }
  }
  const overused = [];
  for (const [g, docSet] of counts) {
    if (docSet.size >= sharedPhraseMaxDocs) overused.push({ phrase: g, docs: [...docSet] });
  }
  // 合并重叠片段，只报最长的那些
  overused.sort((x, y) => x.phrase.localeCompare(y.phrase));
  const mergedPhrases = [];
  for (const o of overused) {
    const prev = mergedPhrases[mergedPhrases.length - 1];
    if (prev && o.phrase.slice(0, -1) === prev.phrase.slice(-(sharedPhraseMinLen - 1))) {
      prev.phrase += o.phrase.slice(-1);
    } else mergedPhrases.push({ ...o });
  }

  const failures = pairs.filter((p) => p.over);
  return {
    passed: failures.length === 0 && mergedPhrases.length === 0,
    pairs,
    failures,
    overusedPhrases: mergedPhrases
  };
}


// 批次账本：写下一篇前，先看前面几篇已经用过什么。
// 开头句、结尾句和跨稿重句是重复的三个高发位置。
export function buildLedger(docs) {
  const sentencesOf = (text) =>
    bodyOf(text)
      .split(/[。！？]/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 8);
  const per = {};
  const seen = new Map();
  for (const [name, text] of Object.entries(docs)) {
    const ss = sentencesOf(text);
    per[name] = { opening: ss[0] || '', closing: ss[ss.length - 1] || '', count: ss.length };
    for (const x of ss) {
      if (!seen.has(x)) seen.set(x, []);
      seen.get(x).push(name);
    }
  }
  const repeated = [...seen.entries()]
    .filter(([, ds]) => ds.length >= 2)
    .map(([sentence, ds]) => ({ sentence, docs: ds }));
  return { per, repeated };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const ledgerMode = argv.includes('--ledger');
  const files = argv.filter((a) => a !== '--ledger');
  if (files.length < 2) {
    console.error('用法: node engine/variation/check-repetition.mjs <稿件1> <稿件2> [...]');
    process.exit(2);
  }
  const docs = {};
  for (const f of files) {
    const parts = f.split(String.fromCharCode(92)).join('/').split('/');
    const ip = parts.includes('ips') ? parts[parts.indexOf('ips') + 1] : 'batch';
    docs[`${ip}/${basename(f, '.md')}`] = readFileSync(f, 'utf8');
  }
  if (ledgerMode) {
    const l = buildLedger(docs);
    console.log('批次账本（写下一篇前先读这里）');
    console.log('');
    console.log('已用开头句：');
    for (const [n, v] of Object.entries(l.per)) console.log(`  ${n}: ${v.opening}`);
    console.log('');
    console.log('已用结尾句：');
    for (const [n, v] of Object.entries(l.per)) console.log(`  ${n}: ${v.closing}`);
    console.log('');
    if (l.repeated.length) {
      console.log('已出现在多篇里的句子（下一篇禁用）：');
      for (const r2 of l.repeated) console.log(`  [${r2.docs.length}篇] ${r2.sentence}`);
    } else {
      console.log('无跨稿重句。');
    }
    process.exit(0);
  }
  const r = checkRepetition(docs);
  console.log(`批次共 ${files.length} 篇\n`);
  console.log('两两重合：');
  for (const p of r.pairs) {
    const flag = p.over ? 'FAIL' : ' ok ';
    console.log(`  [${flag}] ${p.a} vs ${p.b}  ${p.shared} 处  ${(p.ratio * 100).toFixed(1)}% (上限 ${(p.cap * 100).toFixed(0)}%)`);
  }
  if (r.overusedPhrases.length) {
    console.log(`\n原样复用片段（出现在 ${RULES.sharedPhraseMaxDocs} 篇及以上）：`);
    for (const o of r.overusedPhrases) console.log(`  ${o.docs.length}篇  ${o.phrase}`);
  }
  console.log(`\n结果: ${r.passed ? 'PASS' : 'FAIL'}`);
  process.exit(r.passed ? 0 : 1);
}
