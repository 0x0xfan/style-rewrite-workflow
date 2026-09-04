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
    // 先剔除 HTML 注释（可跨行），如文件头的轴注释 <!-- 开头:… -->，
    // 否则会被当成正文，抬高两两比例并刷出假的"原样复用"命中。
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => !l.startsWith('#') && !l.startsWith('>') && l.trim() !== '---')
    .join('')
    .replace(/\s/g, '');

// 选题主干：去掉路径 IP 段与 -长视频版/-短视频版/-图文版 后缀。
// "闲鱼餐饮券-长视频版" 与 "闲鱼餐饮券-短视频版" 主干相同=同选题；
// "01-二手书回收转卖" 与 "02-账号养号基础" 主干不同=不同选题。
const topicOf = (key) => {
  const seg = key.split('/').slice(1).join('/') || key;
  return seg.replace(/-?(长视频版|短视频版|图文版)$/, '');
};

// 跨稿三条规则（两两比例 / 12 字原样复用 / 骨架撞句）共用的白名单：
//   protectedPhrases —— 受保护的事实串（事实该一致，硬换措辞会扭曲事实）；
//   contractPhrases  —— 合同固定句 / 同 IP 签名句（视频方合同 §E 要求每篇必有「我是圣矾。」，
//                       可选口号「做闲鱼，找圣矾。」一字不改）。这几句每篇必然逐字相同，
//                       不算重复、不算撞骨架——不放进白名单，整批稿会因为它恒 FAIL。
// 长的先替换，避免「我是圣矾」先命中、把「我是圣矾。做闲鱼，找圣矾。」切碎。
export function protectedPhrasesOf(rules = RULES) {
  const all = [...(rules.protectedPhrases || []), ...(rules.contractPhrases || [])];
  return [...new Set(all)].sort((a, b) => b.length - a.length);
}

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
  const prot = protectedPhrasesOf(rules);
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
      // 同 IP 且同选题（长/短/图文版）才是同一内容的多个时长，允许更高重合；
      // 同 IP 不同选题本该产出不同文本，走跨选题的 pairMaxRatio。
      const sameIp = a.split('/')[0] === b.split('/')[0];
      const sameTopic = sameIp && topicOf(a) === topicOf(b);
      const cap = sameTopic ? sameIpPairMaxRatio : pairMaxRatio;
      pairs.push({ a, b, shared, ratio, cap, sameIp, sameTopic, over: ratio > cap });
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


// --- 跨稿骨架撞句（AI味治理-外部对照 §4a-R1 / U1）---
// 与上面的 n-gram 比例是两件事：那个查「两篇整体重合多少」，这条查「同一个功能位上是不是
// 同一句骨架只换了名词」。五篇样本里「这是推算，不是订单数 / 不是实数 / 不是实测」这一族，
// 字面重合率低到不会触发任何比例阈值，但听感上就是同一个模子——必须归一化后再比。

const CN_DIGITS = '零一二三四五六七八九十百千万两〇';

// 句子归一化：数字→#、拉丁字母/数字→@、平台品牌名→〇、句末尾词→〇，再去标点空白。
export function normalizeSkeleton(sentence, cfg) {
  let s = String(sentence).trim();
  // 尾词归一必须在去标点之前做（要靠句末位置定位）。
  if (cfg.tailPattern) {
    s = s.replace(new RegExp(cfg.tailPattern), (m, kw) => kw + '〇');
  }
  for (const b of cfg.brands || []) s = s.split(b).join('〇');
  s = s.replace(/[0-9]+(\.[0-9]+)?/g, '#');
  s = s.replace(new RegExp(`[${CN_DIGITS}]{1,8}`, 'g'), '#');
  s = s.replace(/[A-Za-z]+/g, '@');
  s = s.replace(/[\s，,。．！!？?、；;：:"'“”‘’（）()【】《》…—\-·]/g, '');
  return s;
}

const sentencesOfBody = (text) =>
  bodyOf2(text).split(/[。！？!?\n]/).map((x) => x.trim()).filter(Boolean);

// 骨架比对用的正文口径：保留标点（尾词归一要用句末位置），只剔标题/注释/引用/分隔线。
const bodyOf2 = (text) =>
  String(text)
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => !l.startsWith('#') && !l.startsWith('>') && l.trim() !== '---')
    .join('\n');

const gramSet = (s, n) => {
  const set = new Set();
  for (let i = 0; i + n <= s.length; i++) set.add(s.slice(i, i + n));
  return set;
};

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return inter / (a.size + b.size - inter);
};

// docs = { 稿件名: 全文 }。返回 { passed, pairs, count, threshold, maxPairs }。
// pairs 里每条给两篇的原句 + 归一化后的骨架 + Jaccard，供人工核对误伤。
export function checkSkeletonCollision(docs, rules = RULES) {
  const cfg = rules.skeleton;
  if (!cfg) return { passed: true, pairs: [], count: 0, skipped: '未配置 skeleton 规则' };
  // 白名单 = 骨架层专属白名单 ∪ 顶层合同固定句（同一份，不许两处各抄一份）。
  // 归一化后短于 5 字的白名单项丢掉：那种短串（「我是〇」）拿去做 includes 会误伤大片正常句子；
  // 而合同固定句本身都是 <10 字的短句，早就被下面的 minLen 过滤掉了，不靠白名单也不会误报。
  const wl = [...(cfg.whitelist || []), ...(rules.contractPhrases || [])]
    .map((w) => normalizeSkeleton(w, cfg))
    .filter((w) => w.length >= 5);
  const names = Object.keys(docs);
  const per = {};
  for (const n of names) {
    per[n] = sentencesOfBody(docs[n])
      .map((raw) => ({ raw, norm: normalizeSkeleton(raw, cfg) }))
      // 门槛卡「归一化前」的原句长度：归一化会把数字与尾词压成一个字符，
      // 「这是推算，不是订单数」归一化后只剩 7 字，卡归一化后长度会把这一族最典型的撞骨架整个漏掉。
      .filter((x) => x.raw.replace(/\s/g, '').length >= cfg.minLen && x.norm.length >= cfg.gram)
      // 归一化后几乎全是占位符的句子（「##个人点了想要」）是报数，不是修辞骨架——两篇都报数当然像，跳过。
      .filter((x) => x.norm.replace(/[#〇@]/g, '').length >= (cfg.minContentLen || 0))
      .filter((x) => !wl.some((w) => w && x.norm.includes(w)))
      .map((x) => ({ ...x, grams: gramSet(x.norm, cfg.gram) }));
  }

  const pairs = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      for (const sa of per[a]) {
        for (const sb of per[b]) {
          const jv = jaccard(sa.grams, sb.grams);
          if (jv >= cfg.jaccardMin) {
            pairs.push({ a, b, jaccard: +jv.toFixed(3), aSentence: sa.raw, bSentence: sb.raw, skeleton: sa.norm });
          }
        }
      }
    }
  }
  pairs.sort((x, y) => y.jaccard - x.jaccard);
  return {
    passed: pairs.length <= cfg.maxPairs,
    level: cfg.level || 'warn',
    pairs, count: pairs.length,
    maxPairs: cfg.maxPairs, threshold: cfg.jaccardMin
  };
}

// 批次账本：写下一篇前，先看前面几篇已经用过什么。
// 开头句、结尾句和跨稿重句是重复的三个高发位置。
export function buildLedger(docs, rules = RULES) {
  // 合同固定句（我是圣矾。做闲鱼，找圣矾。）每篇都得逐字一样，不该被记成「跨稿重句」。
  // 与 checkRepetition / checkSkeletonCollision 读同一份白名单。
  const prot = protectedPhrasesOf(rules);
  const sentencesOf = (text) =>
    bodyOf(text)
      .split(/[。！？]/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 8)
      .filter((x) => !prot.some((p) => p.replace(/[。，]/g, '') === x || x === p));
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
  const skeletonMode = argv.includes('--skeleton');
  const files = argv.filter((a) => a !== '--ledger' && a !== '--skeleton');
  if (files.length < 2) {
    console.error('用法: node engine/variation/check-repetition.mjs [--ledger|--skeleton] <稿件1> <稿件2> [...]');
    console.error('  --skeleton  跨稿骨架撞句：句子归一化（数字/品牌/尾词）后取 5-gram 算 Jaccard，报「同一骨架只换名词」的句对。');
    process.exit(2);
  }
  const docs = {};
  for (const f of files) {
    const parts = f.split(String.fromCharCode(92)).join('/').split('/');
    const ip = parts.includes('ips') ? parts[parts.indexOf('ips') + 1] : 'batch';
    // 文件名是 script.txt / copy.md 这种通用名时（remotion 侧 films/<filmId>/copy/<style>/script.txt），
    // 用文件名当 key 会让整批稿子互相覆盖成一篇。此时往上找一个有区分度的目录名当 key。
    let label = basename(f, '.md');
    if (/^(script|copy|index|storyboard)(\.[a-z]+)?$/i.test(label)) {
      const fi = parts.indexOf('films');
      label = fi >= 0 && parts[fi + 1] ? parts[fi + 1] : (parts[parts.length - 2] || label);
    }
    let key = `${ip}/${label}`;
    let n = 2;
    while (docs[key]) key = `${ip}/${label}#${n++}`;
    docs[key] = readFileSync(f, 'utf8');
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
  if (skeletonMode) {
    const s = checkSkeletonCollision(docs);
    console.log(`跨稿骨架撞句（归一化 ${RULES.skeleton.gram}-gram，Jaccard ≥ ${s.threshold}，上限 ${s.maxPairs} 对）`);
    console.log(`批次共 ${files.length} 篇，撞骨架 ${s.count} 对\n`);
    for (const p of s.pairs.slice(0, 40)) {
      console.log(`  [${p.jaccard}] ${p.a} × ${p.b}`);
      console.log(`      A: ${p.aSentence}`);
      console.log(`      B: ${p.bSentence}`);
      console.log(`      骨架: ${p.skeleton}`);
    }
    if (s.pairs.length > 40) console.log(`  …（另有 ${s.pairs.length - 40} 对未列出）`);
    console.log(`\n结果: ${s.passed ? 'PASS' : `FAIL（${s.level} 级）`}`);
    process.exit(s.passed ? 0 : 1);
  }
  const r = checkRepetition(docs);
  console.log(`批次共 ${files.length} 篇\n`);
  console.log('两两重合：');
  for (const p of r.pairs) {
    const flag = p.over ? 'FAIL' : ' ok ';
    const scope = p.sameTopic ? ' [同选题]' : '';
    console.log(`  [${flag}] ${p.a} vs ${p.b}  ${p.shared} 处  ${(p.ratio * 100).toFixed(1)}% (上限 ${(p.cap * 100).toFixed(0)}%)${scope}`);
  }
  if (r.overusedPhrases.length) {
    console.log(`\n原样复用片段（出现在 ${RULES.sharedPhraseMaxDocs} 篇及以上）：`);
    for (const o of r.overusedPhrases) console.log(`  ${o.docs.length}篇  ${o.phrase}`);
  }
  console.log(`\n结果: ${r.passed ? 'PASS' : 'FAIL'}`);
  process.exit(r.passed ? 0 : 1);
}
