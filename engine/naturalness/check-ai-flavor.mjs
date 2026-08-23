#!/usr/bin/env node
// AI 味量化预检。把两份调研（docs/research/de-ai-flavor-20260823.md、
// docs/research/ai-flavor-diagnosis-20260823.md）里能程序化的指标做成闸门。
// 与合规/重复/泄漏三层是并列的第四层：那三层查"能不能发/重不重/抄没抄"，
// 这层查"读起来像不像 AI"。阈值按 IP 分档，取自诊断报告的真人基线。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(here, 'ai-flavor-rules.json'), 'utf8'));

// 正文 = 去标题行 / HTML 注释 / 分隔线。与 check-repetition 的口径一致（那里还去引用行，
// 但 AI 味按调研只去标题/注释/分隔线，引用行仍是正文的一部分）。
export function bodyOf(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => !l.startsWith('#') && l.trim() !== '---')
    .join('\n');
}

const TERMINATORS = new Set(['。', '！', '？', '!', '?']);
const QUESTION_END = new Set(['？', '?']);

// 按 。！？!? 切句，段落换行也作句界。返回 { text, end } 列表；
// text 为去空白去句末标点后的内容，end 为句末终止符（无则空串）。
export function splitSentences(body) {
  const out = [];
  let buf = '';
  const flush = (end) => {
    const clean = buf.replace(/\s/g, '');
    if (clean.length) out.push({ text: clean, end });
    buf = '';
  };
  for (const ch of body) {
    if (ch === '\n') { flush(''); continue; }
    if (TERMINATORS.has(ch)) { flush(ch); continue; }
    buf += ch;
  }
  flush('');
  return out;
}

const countMatches = (s, re) => (s.match(re) || []).length;

// 悬空"的"：句末以"的"收尾（其后为 。！？），且"的"前 window 字内无中心词后缀。
// 豁免：
//  1) "是…的"判断句——同句内出现系动词"是"（含"不是/就是/算是/才是/也是"等复合形式）
//     时，视为中文正常的"是…的"结构，不判悬空（"这券是真的。""它不是躺着来的。"）。
//  2) "…的话。"条件句——句末天然以"话"结尾（不进入本函数的候选），此处不需额外处理，
//     记录于此便于回顾。
function danglingDeSentences(sentences, cfg) {
  const hits = [];
  for (const { text } of sentences) {
    if (!text.endsWith('的')) continue;
    const body = text.slice(0, -1); // 去掉句末"的"再看句中是否有系动词
    if (body.includes('是')) continue; // "是…的"判断句豁免
    const before = text.slice(-1 - cfg.nounSuffixWindow, -1); // "的"前 window 字
    const anchored = cfg.nounSuffixes.some((n) => before.includes(n));
    if (!anchored) hits.push(text + '。');
  }
  return hits;
}

// 最长连续以"？"收尾的句串长度。
function longestQuestionRun(sentences) {
  let max = 0;
  let cur = 0;
  for (const { end } of sentences) {
    if (QUESTION_END.has(end)) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

function stats(nums) {
  if (!nums.length) return { mean: 0, std: 0, cv: 0 };
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  const std = Math.sqrt(variance);
  return { mean, std, cv: mean ? std / mean : 0 };
}

// 解析 ips/<IP>/ 路径段推断 IP；找不到返回 undefined。
export function inferIp(path, rules = RULES) {
  const parts = path.split(String.fromCharCode(92)).join('/').split('/');
  const i = parts.indexOf('ips');
  const cand = i >= 0 ? parts[i + 1] : undefined;
  return cand && rules.profiles[cand] ? cand : undefined;
}

export function checkAiFlavor(text, opts = {}) {
  const rules = opts.rules || RULES;
  const ip = opts.ip;
  const profileKey = ip && rules.profiles[ip] ? ip : 'default';
  const profile = rules.profiles[profileKey];
  const m = profile.metrics;

  const body = bodyOf(text);
  const flat = body.replace(/\s/g, '');
  const chars = flat.length;
  const per1000 = (n) => (chars ? (n / chars) * 1000 : 0);

  const sentences = splitSentences(body);
  const lengths = sentences.map((s) => s.text.length).filter((n) => n > 0);
  const { mean, std, cv } = stats(lengths);

  // --- 原始计数 ---
  const dashCount = countMatches(body, /——/g);
  const colonCount = countMatches(body, /[：:]/g);
  const quoteCount = countMatches(body, /[“”‘’"]/g);
  const questionCount = countMatches(body, /[？?]/g);
  const ellipsisCount = countMatches(body, /…+|\.{3,}/g);

  let summaryShellCount = 0;
  const summaryShellHits = {};
  for (const p of rules.summaryShells) {
    const n = countMatches(body, new RegExp(p, 'g'));
    if (n) { summaryShellHits[p] = n; summaryShellCount += n; }
  }

  // "不是X是Y"：换行先当句界，避免跨段误配。
  const notButCount = countMatches(body.replace(/\n/g, '。'), new RegExp(rules.notButShellPattern, 'g'));

  const danglingHits = danglingDeSentences(sentences, rules.danglingDe);
  const maxQuestionRun = longestQuestionRun(sentences);

  let fillerCount = 0;
  const fillerHits = {};
  for (const p of rules.fillerWords) {
    const n = countMatches(body, new RegExp(p, 'g'));
    if (n) { fillerHits[p] = n; fillerCount += n; }
  }

  // --- 指标表（value + 阈值 + 判定） ---
  const metrics = {
    dashPer1000: { value: per1000(dashCount), raw: dashCount, ...m.dashPer1000, kind: 'max' },
    summaryShellPer1000: { value: per1000(summaryShellCount), raw: summaryShellCount, hits: summaryShellHits, ...m.summaryShellPer1000, kind: 'max' },
    danglingDeCount: { value: danglingHits.length, samples: danglingHits, ...m.danglingDeCount, kind: 'max' },
    consecutiveQuestions: { value: maxQuestionRun, ...m.consecutiveQuestions, kind: 'max' },
    notButShellCount: { value: notButCount, ...m.notButShellCount, kind: 'max' },
    colonPer1000: { value: per1000(colonCount), raw: colonCount, ...m.colonPer1000, kind: 'max' },
    quotePer1000: { value: per1000(quoteCount), raw: quoteCount, ...m.quotePer1000, kind: 'max' },
    questionPer1000: { value: per1000(questionCount), raw: questionCount, ...m.questionPer1000, kind: 'max' },
    ellipsisPer1000: { value: per1000(ellipsisCount), raw: ellipsisCount, ...m.ellipsisPer1000, kind: 'max' },
    sentenceCvMin: { value: cv, mean, std, ...m.sentenceCvMin, kind: 'min', gated: profile.gateSentenceCV }
  };

  const findings = [];
  for (const [id, mt] of Object.entries(metrics)) {
    if (mt.level === 'info') continue;
    if (mt.kind === 'max') {
      if (mt.value > mt.max) {
        findings.push({ level: mt.level, metric: id, value: mt.value, threshold: mt.max, comparator: '>', samples: mt.samples, hits: mt.hits });
      }
    } else {
      // min（目前仅句长 CV）：只在 gated 时门禁；未 gated 只报不判。
      if (mt.gated && mt.value < mt.min) {
        findings.push({ level: mt.level, metric: id, value: mt.value, threshold: mt.min, comparator: '<' });
      }
    }
  }

  const blockCount = findings.filter((f) => f.level === 'block').length;
  return {
    passed: blockCount === 0,
    ip: profileKey,
    ipRequested: ip,
    chars,
    sentenceCount: lengths.length,
    metrics,
    filler: { perThousand: per1000(fillerCount), count: fillerCount, hits: fillerHits },
    findings,
    blockCount,
    warnCount: findings.length - blockCount
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
    files.push(argv[i]);
  }
  if (!files.length) {
    console.error('用法: node engine/naturalness/check-ai-flavor.mjs [--ip 钱十七|半佛] <文案文件> [更多文件...]');
    console.error('  IP 识别: --ip 优先；否则从路径 ips/<IP>/ 推断；再否则用 default 档。');
    process.exit(2);
  }

  const fmt = (n) => Number(n).toFixed(2);
  let anyFail = false;
  for (const file of files) {
    const ip = ipFlag || inferIp(file);
    const r = checkAiFlavor(readFileSync(file, 'utf8'), { ip });
    if (!r.passed) anyFail = true;
    const prof = RULES.profiles[r.ip];
    console.log(`\n文件: ${file}`);
    console.log(`IP 档位: ${r.ip}（${prof.label}）${ip && !RULES.profiles[ip] ? ` [请求的 ${ip} 无专属档，回落 default]` : ''}`);
    console.log(`正文有效字符: ${r.chars}  句数: ${r.sentenceCount}`);
    console.log(`结果: ${r.passed ? 'PASS' : 'FAIL'}  block=${r.blockCount} warn=${r.warnCount}`);
    console.log('指标（值 / 阈值）：');
    const rows = [
      ['破折号/千字', r.metrics.dashPer1000],
      ['总结壳/千字', r.metrics.summaryShellPer1000],
      ['悬空"的"句/篇', r.metrics.danglingDeCount],
      ['最长连续反问', r.metrics.consecutiveQuestions],
      ['不是X是Y/篇', r.metrics.notButShellCount],
      ['冒号/千字', r.metrics.colonPer1000],
      ['引号/千字', r.metrics.quotePer1000],
      ['问号/千字', r.metrics.questionPer1000],
      ['省略号/千字', r.metrics.ellipsisPer1000]
    ];
    for (const [label, mt] of rows) {
      const over = mt.value > mt.max;
      const tag = over ? (mt.level === 'block' ? 'BLOCK' : 'warn ') : '  ok ';
      console.log(`  [${tag}] ${label.padEnd(14)} ${fmt(mt.value).padStart(6)} / ≤${mt.max}`);
    }
    const cvm = r.metrics.sentenceCvMin;
    const cvUnder = cvm.value < cvm.min;
    const cvTag = cvm.gated ? (cvUnder ? (cvm.level === 'block' ? 'BLOCK' : 'warn ') : '  ok ') : ' info';
    console.log(`  [${cvTag}] ${'句长CV(下限)'.padEnd(14)} ${fmt(cvm.value).padStart(6)} / ≥${cvm.min}  (均长 ${fmt(cvm.mean)} 字, 标准差 ${fmt(cvm.std)})${cvm.gated ? '' : ' [该 IP 不门禁句长]'}`);
    console.log(`  [ info] ${'口语赘词/千字'.padEnd(14)} ${fmt(r.filler.perThousand).padStart(6)}  (只报不门禁)`);
    if (r.metrics.danglingDeCount.samples.length) {
      console.log('  悬空"的"命中句：');
      for (const s of r.metrics.danglingDeCount.samples) console.log(`     - ${s}`);
    }
    if (Object.keys(r.metrics.summaryShellPer1000.hits).length) {
      console.log(`  总结壳命中：${Object.entries(r.metrics.summaryShellPer1000.hits).map(([k, v]) => `${k}x${v}`).join('、')}`);
    }
  }
  console.log(`\n注意: ${RULES.disclaimer}`);
  process.exit(anyFail ? 1 : 0);
}
