#!/usr/bin/env node
// 用词层预检。前三层量标点/句长/结构，看不见"用了这个 IP 不会用的词"。
// 起因：去 AI 味重写后的稿子被点名三处圈外用词——"找货"(应"找货源")、"散在"(圈子不用"散")、
// "打哪来"(应"从哪来")。共性是缩略/生僻/硬装口语，标点句长指标一律照过。
// 本层拿"IP 自己的词表"(ips/<IP>/corpus/lexicon.json，由语料 jieba 统计而来)对稿子做
// 最大正向匹配切词：切得出的=语料里出现过；切不出的 2–4 字片段=可疑用词，逐个列给人过目。
// 语料小，"没出现≠错"，所以只 warn 不 block；退出码恒为 0（缺 lexicon 除外）。
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { bodyOf } from './check-ai-flavor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const HINTS_PATH = join(here, 'lexicon-hints.json');

const HAN = /[一-鿿]/;
// 连续非汉字（标点/数字/字母/空白）作为切割点：切词只在纯汉字串内进行。
const NON_HAN_RUN = /[^一-鿿]+/g;

// 解析 ips/<IP>/ 路径段推断 IP；找不到返回 undefined。与 check-ai-flavor 口径一致。
export function inferIp(path) {
  const parts = path.split(String.fromCharCode(92)).join('/').split('/');
  const i = parts.indexOf('ips');
  return i >= 0 ? parts[i + 1] : undefined;
}

export function lexiconPathFor(ip, repoRoot = join(here, '..', '..')) {
  return join(repoRoot, 'ips', ip, 'corpus', 'lexicon.json');
}

export function loadLexicon(ip, opts = {}) {
  const p = opts.path || lexiconPathFor(ip, opts.repoRoot);
  if (!existsSync(p)) {
    const err = new Error(`lexicon 缺失: ${p}`);
    err.code = 'LEXICON_MISSING';
    err.path = p;
    throw err;
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function loadHints(path = HINTS_PATH) {
  if (!existsSync(path)) return { hints: {} };
  return JSON.parse(readFileSync(path, 'utf8'));
}

// 把 lexicon 编成切词字典：term→{freq,docs,business}。
function buildDict(lexicon) {
  const dict = new Map();
  let maxLen = 2;
  const bizSet = new Set((lexicon.business || []).map((t) => t.term));
  for (const t of lexicon.terms || []) {
    dict.set(t.term, { freq: t.freq, docs: t.docs, business: bizSet.has(t.term) });
    if (t.term.length > maxLen) maxLen = t.term.length;
  }
  return { dict, maxLen, bizSet };
}

// 对单个汉字串做最大正向匹配。返回 { known:[{term,...}], unknownRuns:[str] }。
// 未匹配的连续单字聚成一段；单字本身不算词（词表已去单字），故聚段后再按 2–4 字切片。
function matchRun(run, dict, maxLen) {
  const known = [];
  const unknownRuns = [];
  let i = 0;
  let buf = '';
  const flushBuf = () => { if (buf) { unknownRuns.push(buf); buf = ''; } };
  while (i < run.length) {
    let hit = null;
    const cap = Math.min(maxLen, run.length - i);
    for (let L = cap; L >= 2; L--) {
      const cand = run.slice(i, i + L);
      if (dict.has(cand)) { hit = { term: cand, ...dict.get(cand) }; break; }
    }
    if (hit) { flushBuf(); known.push(hit); i += hit.term.length; }
    else { buf += run[i]; i += 1; }
  }
  flushBuf();
  return { known, unknownRuns };
}

// 语气/结构助词与指示词：只作句法黏合、不承载"用词"含义。词表按内容词建库已去掉它们，
// 于是它们全落进"切不出"的残串里刷屏。这里从残串两端剥掉，再判长度，把信号露出来。
// 注意：只收纯功能字（的了着过…、这那），不收"在/上/下/中"这类可入词的字，
// 以免误伤"散在""上架"式的圈外写法（用户点名的"散"就藏在"散在"里）。
const PARTICLE_EDGE = new Set('的了着过吗呢吧啊呀呗嘛哈哦噢咯啦么这那'.split(''));
// 整段等于这些高频黏合词时直接丢弃（它们是正常中文，不是"圈外用词"，只是词表没收）。
const COMMON_DROP = new Set([
  '就是', '还是', '但是', '一下', '来的', '的话', '什么', '怎么', '这样', '那样',
  '可以', '已经', '因为', '所以', '然后', '其实', '这么', '那么', '起来', '出来',
  '一个', '没有', '我们', '你们', '他们', '自己', '这些', '那些', '这里', '那里',
  '大家', '知道', '觉得', '现在', '时候', '不是', '就得', '还得', '也得', '还不',
  '也没', '就得', '得先', '得把', '得靠'
]);

function trimParticles(s) {
  let a = 0;
  let b = s.length;
  while (a < b && PARTICLE_EDGE.has(s[a])) a++;
  while (b > a && PARTICLE_EDGE.has(s[b - 1])) b--;
  return s.slice(a, b);
}

// 把未匹配长串切成 2–4 字片段：先剥两端助词；len≤4 整段；更长则按 4 字贪心切，
// 尾巴不足 2 字并入前一片。每片再剥一次助词、丢弃单字与高频黏合词。
export function fragmentsOf(run) {
  const trimmed = trimParticles(run);
  const n = trimmed.length;
  if (n < 2) return [];
  const raw = n <= 4 ? [trimmed] : (() => {
    const out = [];
    let i = 0;
    while (i < n) {
      let L = Math.min(4, n - i);
      if (n - i - L === 1) L = Math.min(3, L); // 避免留下长度 1 的尾巴
      out.push(trimmed.slice(i, i + L));
      i += L;
    }
    return out;
  })();
  const cleaned = [];
  for (const f of raw) {
    const t = trimParticles(f);
    if (t.length < 2) continue;
    if (COMMON_DROP.has(t)) continue;
    cleaned.push(t);
  }
  return cleaned;
}

// 给一个可疑片段找替换建议：先查 hints；再从词表找同首/同尾字的词（优先业务词、按频次）。
function suggestFor(frag, hints, lexicon, bizSet) {
  if (hints[frag] && hints[frag].length) return { source: 'hints', options: hints[frag] };
  // hints 里若有 key 是片段的子串（如片段"说不说得清打哪来"含"打哪来"），也采用。
  for (const key of Object.keys(hints)) {
    if (key.length >= 2 && frag.includes(key) && hints[key].length) {
      return { source: 'hints', options: hints[key] };
    }
  }
  if (frag.length > 3) return null; // 过长片段不做自动近似，交人工
  const first = frag[0];
  const last = frag[frag.length - 1];
  const cands = [];
  for (const t of lexicon.terms || []) {
    if (t.term === frag) continue;
    if (t.term.includes(first) || t.term.includes(last)) {
      cands.push({ term: t.term, freq: t.freq, biz: bizSet.has(t.term) });
    }
  }
  cands.sort((a, b) => (b.biz - a.biz) || (b.freq - a.freq));
  const options = cands.slice(0, 3).map((c) => c.term);
  return options.length ? { source: 'lexicon-neighbor', options } : null;
}

export function checkLexicon(text, { lexicon, hints } = {}) {
  const hintMap = (hints && hints.hints) || (hints || {});
  const { dict, maxLen, bizSet } = buildDict(lexicon);
  const body = bodyOf(text);

  const runs = body.replace(NON_HAN_RUN, '\n').split('\n').filter(Boolean);
  const suspicious = new Map();   // frag -> count
  const businessUsed = new Map(); // term -> count
  let knownTokenCount = 0;

  for (const run of runs) {
    if (!HAN.test(run)) continue;
    const { known, unknownRuns } = matchRun(run, dict, maxLen);
    for (const k of known) {
      knownTokenCount += 1;
      if (k.business) businessUsed.set(k.term, (businessUsed.get(k.term) || 0) + 1);
    }
    for (const ur of unknownRuns) {
      for (const frag of fragmentsOf(ur)) {
        suspicious.set(frag, (suspicious.get(frag) || 0) + 1);
      }
    }
  }

  const suspiciousList = [...suspicious.entries()]
    .map(([term, count]) => ({ term, count, ...(suggestFor(term, hintMap, lexicon, bizSet) ? { suggest: suggestFor(term, hintMap, lexicon, bizSet) } : {}) }))
    .sort((a, b) => (b.count - a.count) || (b.term.length - a.term.length) || a.term.localeCompare(b.term));

  const businessList = [...businessUsed.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count);

  return {
    ip: lexicon.ip,
    corpusId: lexicon.corpus_id,
    docCount: lexicon.doc_count,
    knownTokenCount,
    businessHitTypes: businessList.length,
    businessHitTotal: businessList.reduce((s, x) => s + x.count, 0),
    businessList,
    suspiciousTypes: suspiciousList.length,
    suspiciousTotal: [...suspicious.values()].reduce((a, b) => a + b, 0),
    suspiciousList,
    // 纯报告工具：无 block，warn=可疑片段种类数。
    warnCount: suspiciousList.length,
    blockCount: 0,
    passed: true
  };
}

// --- CLI ---
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  let ipFlag;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ip') { ipFlag = argv[++i]; continue; }
    if (argv[i] === '--drafts') { continue; } // 兼容 --drafts a b c 写法
    files.push(argv[i]);
  }
  if (!files.length) {
    console.error('用法: node engine/naturalness/check-lexicon.mjs [--ip 钱十七|半佛] --drafts <文案文件...>');
    console.error('  IP 识别: --ip 优先；否则从路径 ips/<IP>/ 推断。');
    console.error('  报告可疑用词（IP 语料一次没出现的片段，warn 级不 block）、业务词命中数、替换建议。');
    process.exit(2);
  }
  const hints = loadHints();
  const TOP = 15;
  for (const file of files) {
    const ip = ipFlag || inferIp(file);
    if (!ip) {
      console.error(`\n文件: ${file}\n  无法确定 IP（--ip 未给且路径无 ips/<IP>/ 段），跳过。`);
      continue;
    }
    let lexicon;
    try {
      lexicon = loadLexicon(ip);
    } catch (e) {
      console.error(`\n文件: ${file}\n  ${e.message}`);
      process.exit(3); // 唯一非 0 退出：lexicon 缺失
    }
    const r = checkLexicon(readFileSync(file, 'utf8'), { lexicon, hints });
    console.log(`\n文件: ${file}`);
    console.log(`IP: ${r.ip}  语料: ${r.corpusId}（${r.docCount} 篇）`);
    console.log(`业务词命中: ${r.businessHitTypes} 种 / ${r.businessHitTotal} 次` +
      (r.businessList.length ? `  [${r.businessList.slice(0, 10).map((b) => `${b.term}x${b.count}`).join('、')}${r.businessList.length > 10 ? '…' : ''}]` : ''));
    console.log(`可疑用词（语料 0 出现，warn 不 block）: ${r.suspiciousTypes} 种 / ${r.suspiciousTotal} 次。前 ${TOP}：`);
    for (const s of r.suspiciousList.slice(0, TOP)) {
      const sug = s.suggest ? `  → 建议: ${s.suggest.options.join(' / ')}（${s.suggest.source}）` : '';
      console.log(`  [warn] ${s.term}  x${s.count}${sug}`);
    }
  }
  process.exit(0); // 纯报告工具，恒 0
}
