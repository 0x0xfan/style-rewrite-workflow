#!/usr/bin/env node
// AI 味量化预检。把三份调研（docs/research/de-ai-flavor-20260823.md、
// docs/research/ai-flavor-diagnosis-20260823.md、docs/AI味治理-外部对照.md）里能程序化的指标做成闸门。
// 与合规/重复/泄漏三层是并列的第四层：那三层查"能不能发/重不重/抄没抄"，
// 这层查"读起来像不像 AI"。阈值按 IP 分档，取自诊断报告的真人基线。
//
// 2026-09-03 大改（依据 docs/AI味治理-外部对照.md §4 + 主线程对 §6 四问的裁定）：
//   1. 「说白了」从 summaryShells 移到 fillerWords（真人换气口头禅，不是贴帽子）。
//   2. summaryShells 由 10 扩到 28（U6 讲义腔路标词），上限同步 0.6→0.9。
//   3. 新增黑名单硬拦（空副词/黑话/模板句式/citation 泄漏）。
//   4. 新增正则组：报幕句、自贴重要性（block）；稻草人、假无生命主语、骑墙、期号回指（warn）。
//   5. 免责：连续三句即 block（硬规则）；全篇计数按篇幅档 warn（long ≤3 / 其余 ≤2）。
//   6. 句长节奏：短句占比下限、句长 CV 对钱十七由 info 升 warn、削顶诊断。
//   7. 单边上限改区间：只对能从真人基线算出下限的指标补下限（baseline/qian17-baseline.json）。
//   8. 「的」字密度（中文特有指标），warn 级，阈值按真人基线 ±。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
// 篇幅三档（免责句上限按档取）与工单解析层共读同一份常量，禁止在本文件另写一套数字。
// cli/lib/length-presets.mjs 是个无副作用的叶子模块，不会把整条 CLI 依赖进来。
import { LENGTH_PRESETS, inferLengthPreset } from '../../cli/lib/length-presets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(here, 'ai-flavor-rules.json'), 'utf8'));
// 提示词层（cli/lib/prompt.mjs）要拿同一份词表往稿子里正向注入口头禅——**必须是同一份**，
// 上一轮的事故就是词表在门禁和提示词两处各写了一遍、而且都写成了另一个 IP 的口头禅。
export { RULES as AI_FLAVOR_RULES };

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

// 段切分。五篇样本里两篇是「一句一行」（AI味治理-外部对照 §3.7），那种稿子按 \n 切段
// 会让段级指标退化成句级、恒等于句级指标。故：块数 ≥3 且平均每块 <2 句时，改用 8 句滑动块。
export function paragraphsOf(body) {
  const blocks = body.split(/\n+/).map((b) => b.trim()).filter(Boolean);
  const sentences = splitSentences(body);
  const oneLinePerSentence = blocks.length >= 3 && sentences.length / blocks.length < 2;
  if (!oneLinePerSentence) return { paragraphs: blocks, mode: 'block' };
  const chunk = 8;
  const out = [];
  for (let i = 0; i < sentences.length; i += chunk) {
    out.push(sentences.slice(i, i + chunk).map((s) => s.text).join('。'));
  }
  return { paragraphs: out, mode: 'window8' };
}

const countMatches = (s, re) => (s.match(re) || []).length;

// 悬空"的"：句末以"的"收尾（其后为 。！？），且"的"前 window 字内无中心词后缀。
// 豁免：
//  1) "是…的"判断句——同句内出现系动词"是"（含"不是/就是/算是/才是/也是"等复合形式）
//     时，视为中文正常的"是…的"结构，不判悬空（"这券是真的。""它不是躺着来的。"）。
//  2) 疑问代词收尾——句末"的"前 3 字内含"谁/什么/哪/啥/咋/怎么"时，是"听谁的/算谁
//     的/凭什么的/怎么说的"这类口语省略疑问句，视为完整表达。
//  3) "说/来/捡/弄/整 + 数量 + 形容词 + 的"惯用语——如"说两句实在的""来点实际的"
//     "捡现成的"，是固定口语搭配，视为完整表达。
//  4) "…的话。"条件句——句末天然以"话"结尾（不进入本函数的候选），此处不需额外处理，
//     记录于此便于回顾。
const QUESTION_PRONOUNS = ['谁', '什么', '哪', '啥', '咋', '怎么'];
const IDIOM_DE_RE = /(说|来|捡|弄|整)(两句|几句|一句|点儿?|些|个)[^，。！？,]{0,4}的[。！？]?$/;
function danglingDeSentences(sentences, cfg) {
  const hits = [];
  for (const { text } of sentences) {
    if (!text.endsWith('的')) continue;
    const body = text.slice(0, -1); // 去掉句末"的"再看句中是否有系动词
    if (body.includes('是')) continue; // "是…的"判断句豁免
    const qWindow = text.slice(-4, -1); // "的"前 3 字
    if (QUESTION_PRONOUNS.some((q) => qWindow.includes(q))) continue; // 疑问代词收尾豁免
    if (IDIOM_DE_RE.test(text)) continue; // "说/来+点+形容词+的"惯用语豁免
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

// 最长连续「命中同一个正则」的句串长度（免责堆叠用）。
function longestSentenceRun(sentences, re) {
  let max = 0;
  let cur = 0;
  for (const { text } of sentences) {
    if (re.test(text)) { cur++; max = Math.max(max, cur); }
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

// 黑名单扫描。返回 { block:[{group,term,count,samples}], soft:[...] }。
function scanBlacklist(body, flat, bl) {
  const block = [];
  const soft = [];
  const pushWords = (group, words, bucket) => {
    for (const w of words || []) {
      const n = flat.split(w).length - 1;
      if (n) bucket.push({ group, term: w, count: n });
    }
  };
  pushWords('空副词', bl.emptyAdverbs, block);
  pushWords('互联网黑话', bl.jargon, block);
  for (const p of bl.templateSentences || []) {
    const m = body.match(new RegExp(p, 'g'));
    if (m && m.length) block.push({ group: '模板句式', term: p, count: m.length, samples: m.slice(0, 2) });
  }
  for (const p of bl.citationLeak || []) {
    const m = body.match(new RegExp(p, 'gi'));
    if (m && m.length) block.push({ group: 'citation 泄漏', term: p, count: m.length, samples: m.slice(0, 2) });
  }
  pushWords('电商语境需人工判断', bl.soft, soft);
  return { block, soft };
}

// 取指标配置：profile 覆盖优先，否则用 metricDefaults；都没有返回 null（该指标不参与门禁）。
function metricCfg(profile, rules, id) {
  return (profile.metrics && profile.metrics[id]) || (rules.metricDefaults && rules.metricDefaults[id]) || null;
}

// 词表按 IP 分档（2026-09-03，钱十七风格流失诊断 §4.a）：profile 有自己的表就用自己的，
// 没有才回落根级那张通用表。**不再全 IP 共用一张**——上一轮把圣矾的九个口头禅配进钱十七档，
// 还给它配了 min=1.3 的下限门，等于拿门禁逼稿子写进另一个人的口音。
export function fillerWordsFor(profile, rules = RULES) {
  return (profile && profile.fillerWords) || rules.fillerWords || [];
}
export function perParagraphOnceFor(profile, rules = RULES) {
  return (profile && profile.perParagraphOnce) || rules.perParagraphOnce || [];
}

export function checkAiFlavor(text, opts = {}) {
  const rules = opts.rules || RULES;
  const ip = opts.ip;
  const profileKey = ip && rules.profiles[ip] ? ip : 'default';
  const profile = rules.profiles[profileKey];
  const cfg = (id) => metricCfg(profile, rules, id);

  const body = bodyOf(text);
  const flat = body.replace(/\s/g, '');
  const chars = flat.length;
  const per1000 = (n) => (chars ? (n / chars) * 1000 : 0);

  // 篇幅档位：调用方给了就用（工单里的目标档是合同口径，优先）；没给就按实际去空白字数反推，
  // 口径与 cli/lib/length-presets.mjs 的 LENGTH_PRESETS 同源（long ≥1800 / standard ≥900 / 其余 short）。
  // 不这么做的话，一篇 2854 字的长稿会被默认当 standard 判，免责句上限被错按 ≤2 收紧。
  const explicitPreset = opts.lengthPreset && LENGTH_PRESETS[opts.lengthPreset] ? opts.lengthPreset : null;
  const lengthPreset = explicitPreset || inferLengthPreset(chars);
  const lengthPresetSource = explicitPreset ? '调用方指定' : `按 ${chars} 字反推`;

  const sentences = splitSentences(body);
  const lengths = sentences.map((s) => s.text.length).filter((n) => n > 0);
  const { mean, std, cv } = stats(lengths);
  const { paragraphs, mode: paragraphMode } = paragraphsOf(body);

  // --- 原始计数 ---
  const dashCount = countMatches(body, /——/g);
  const colonCount = countMatches(body, /[：:]/g);
  const quoteCount = countMatches(body, /[“”‘’"]/g);
  const questionCount = countMatches(body, /[？?]/g);
  const ellipsisCount = countMatches(body, /…+|\.{3,}/g);
  const deCount = countMatches(body, /的/g);
  const deHeavySentences = sentences.filter((s) => countMatches(s.text, /的/g) >= 3).length;

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

  const fillerWords = fillerWordsFor(profile, rules);
  let fillerCount = 0;
  const fillerHits = {};
  for (const p of fillerWords) {
    const n = countMatches(body, new RegExp(p, 'g'));
    if (n) { fillerHits[p] = n; fillerCount += n; }
  }

  // 每段最多一次的口头禅：同一段里出现 ≥2 次即记一处。
  const perParagraphOnceHits = [];
  for (const w of perParagraphOnceFor(profile, rules)) {
    for (const p of paragraphs) {
      const n = p.split(w).length - 1;
      if (n >= 2) perParagraphOnceHits.push({ word: w, count: n, sample: p.slice(0, 40) });
    }
  }

  // 正则组：how=sentence 按命中句计数并留样例；how=match 按次计数。
  // exemptPattern（2026-09-03 新增，诊断 §4.c/§4.d）：命中主正则但**同时**命中豁免正则的句子不计入。
  // 用来切「空报幕 vs 带清单报幕」「空标签 vs 标签+立刻交付」——这两组在钱十七那里是签名手法，
  // 在 AI 那里是坏毛病，差别不在有没有报幕/贴标签，在同一句里有没有把内容交出来。
  const groups = {};
  for (const [id, g] of Object.entries(rules.regexGroups || {})) {
    if (g.how === 'match') {
      const m = body.match(new RegExp(g.pattern, 'g')) || [];
      groups[id] = { count: m.length, samples: [...new Set(m)].slice(0, 3), label: g.label, fix: g.fix };
    } else {
      const re = new RegExp(g.pattern);
      const ex = g.exemptPattern ? new RegExp(g.exemptPattern) : null;
      const all = sentences.filter((s) => re.test(s.text));
      const hit = ex ? all.filter((s) => !ex.test(s.text)) : all;
      const exempted = ex ? all.filter((s) => ex.test(s.text)) : [];
      groups[id] = {
        count: hit.length, samples: hit.slice(0, 3).map((s) => s.text),
        exemptedCount: exempted.length, exemptedSamples: exempted.slice(0, 3).map((s) => s.text),
        label: g.label, fix: g.fix
      };
    }
  }
  const disclaimerRe = new RegExp(rules.regexGroups.disclaimerCount.pattern);
  const disclaimerRun = longestSentenceRun(sentences, disclaimerRe);

  const blacklist = scanBlacklist(body, flat, rules.blacklist || {});
  const blacklistCount = blacklist.block.reduce((a, b) => a + b.count, 0);
  const blacklistSoftCount = blacklist.soft.reduce((a, b) => a + b.count, 0);

  // 句长节奏
  const shortRatio = lengths.length ? lengths.filter((n) => n <= 15).length / lengths.length : 0;
  const veryShortRatio = lengths.length ? lengths.filter((n) => n < 10).length / lengths.length : 0;
  const longRatio = lengths.length ? lengths.filter((n) => n > 35).length / lengths.length : 0;
  const maxLen = lengths.length ? Math.max(...lengths) : 0;
  const nearCeiling = lengths.filter((n) => n >= 45 && n <= 50).length;
  const ceilingTruncated = nearCeiling >= 3 && maxLen <= 50;

  // --- 指标表（value + 阈值 + 判定） ---
  const withCfg = (id, extra) => ({ ...extra, ...(cfg(id) || {}), id });
  const metrics = {
    dashPer1000: withCfg('dashPer1000', { value: per1000(dashCount), raw: dashCount }),
    summaryShellPer1000: withCfg('summaryShellPer1000', { value: per1000(summaryShellCount), raw: summaryShellCount, hits: summaryShellHits }),
    danglingDeCount: withCfg('danglingDeCount', { value: danglingHits.length, samples: danglingHits }),
    consecutiveQuestions: withCfg('consecutiveQuestions', { value: maxQuestionRun }),
    notButShellCount: withCfg('notButShellCount', { value: notButCount }),
    colonPer1000: withCfg('colonPer1000', { value: per1000(colonCount), raw: colonCount }),
    quotePer1000: withCfg('quotePer1000', { value: per1000(quoteCount), raw: quoteCount }),
    questionPer1000: withCfg('questionPer1000', { value: per1000(questionCount), raw: questionCount }),
    ellipsisPer1000: withCfg('ellipsisPer1000', { value: per1000(ellipsisCount), raw: ellipsisCount }),
    fillerPer1000: withCfg('fillerPer1000', { value: per1000(fillerCount), raw: fillerCount, hits: fillerHits }),
    sentenceCvMin: withCfg('sentenceCvMin', { value: cv, mean, std }),
    // 新增（2026-09-03）
    blacklistCount: withCfg('blacklistCount', { value: blacklistCount, samples: blacklist.block.slice(0, 6) }),
    blacklistSoftCount: withCfg('blacklistSoftCount', { value: blacklistSoftCount, samples: blacklist.soft.slice(0, 6) }),
    announceCount: withCfg('announceCount', { value: groups.announceCount.count, samples: groups.announceCount.samples, exemptedCount: groups.announceCount.exemptedCount, exemptedSamples: groups.announceCount.exemptedSamples }),
    selfLabelCount: withCfg('selfLabelCount', { value: groups.selfLabelCount.count, samples: groups.selfLabelCount.samples, exemptedCount: groups.selfLabelCount.exemptedCount, exemptedSamples: groups.selfLabelCount.exemptedSamples }),
    disclaimerRun: withCfg('disclaimerRun', { value: disclaimerRun, samples: groups.disclaimerCount.samples }),
    disclaimerCount: withCfg('disclaimerCount', { value: groups.disclaimerCount.count, samples: groups.disclaimerCount.samples }),
    strawmanObjection: withCfg('strawmanObjection', { value: groups.strawmanObjection.count, samples: groups.strawmanObjection.samples }),
    fakeInanimateSubject: withCfg('fakeInanimateSubject', { value: groups.fakeInanimateSubject.count, samples: groups.fakeInanimateSubject.samples }),
    fenceSitting: withCfg('fenceSitting', { value: groups.fenceSitting.count, samples: groups.fenceSitting.samples }),
    episodeBackrefPer1000: withCfg('episodeBackrefPer1000', { value: per1000(groups.episodeBackrefPer1000.count), raw: groups.episodeBackrefPer1000.count, samples: groups.episodeBackrefPer1000.samples }),
    perParagraphOnceCount: withCfg('perParagraphOnceCount', { value: perParagraphOnceHits.length, samples: perParagraphOnceHits.slice(0, 3) }),
    shortSentenceRatio: withCfg('shortSentenceRatio', { value: shortRatio }),
    // 长句下限（2026-09-03 新增）：只卡短句下限、不卡长句下限，是模型全篇平推短句的直接许可。
    // 与 rhythm.longRatio 同一个值（>35 字），配置只在配了 longSentenceRatio 的 profile 上生效。
    longSentenceRatio: withCfg('longSentenceRatio', { value: longRatio }),
    dePer1000: withCfg('dePer1000', { value: per1000(deCount), raw: deCount, deHeavySentences })
  };

  // 免责计数上限按篇幅档取（long ≤3 / standard、short ≤2）。
  if (metrics.disclaimerCount.byLengthPreset && metrics.disclaimerCount.byLengthPreset[lengthPreset] !== undefined) {
    metrics.disclaimerCount = { ...metrics.disclaimerCount, max: metrics.disclaimerCount.byLengthPreset[lengthPreset] };
  }
  // 句长 CV：profile.gateSentenceCV=false 时不 block（钱十七转写标点伪影），但仍出 warn。
  metrics.sentenceCvMin.gated = profile.gateSentenceCV !== false;
  if (!metrics.sentenceCvMin.gated && metrics.sentenceCvMin.level === 'block') {
    metrics.sentenceCvMin = { ...metrics.sentenceCvMin, level: 'warn' };
  }

  const findings = [];
  const minApplies = (mt) => !mt.minAppliesTo || mt.minAppliesTo.includes(lengthPreset);
  for (const [id, mt] of Object.entries(metrics)) {
    if (!mt || mt.level === undefined) continue;
    const kind = mt.kind || 'max';
    if ((kind === 'max' || kind === 'range') && mt.level !== 'info' && mt.max !== undefined && mt.value > mt.max) {
      findings.push({
        level: mt.level, metric: id, value: mt.value, threshold: mt.max, comparator: '>',
        samples: mt.samples, hits: mt.hits, label: (rules.regexGroups[id] || {}).label
      });
    }
    if ((kind === 'min' || kind === 'range') && mt.min !== undefined && minApplies(mt)) {
      const lvl = mt.minLevel || mt.level;
      if (lvl !== 'info' && mt.value < mt.min) {
        findings.push({ level: lvl, metric: id, value: mt.value, threshold: mt.min, comparator: '<' });
      }
    }
  }

  const blockCount = findings.filter((f) => f.level === 'block').length;
  return {
    passed: blockCount === 0,
    ip: profileKey,
    ipRequested: ip,
    lengthPreset,
    lengthPresetSource,
    chars,
    sentenceCount: lengths.length,
    metrics,
    groups,
    blacklist,
    rhythm: {
      mean, std, cv,
      shortRatio, veryShortRatio, longRatio, maxLen, nearCeiling, ceilingTruncated,
      paragraphCount: paragraphs.length, paragraphMode
    },
    filler: { perThousand: per1000(fillerCount), count: fillerCount, hits: fillerHits },
    de: { perThousand: per1000(deCount), count: deCount, heavySentences: deHeavySentences },
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
  let presetFlag;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ip') { ipFlag = argv[++i]; continue; }
    if (argv[i] === '--preset' || argv[i] === '--length') { presetFlag = argv[++i]; continue; }
    files.push(argv[i]);
  }
  if (!files.length) {
    console.error('用法: node engine/naturalness/check-ai-flavor.mjs [--ip 钱十七|半佛] [--preset short|standard|long] <文案文件> [更多文件...]');
    console.error('  篇幅档: --preset 优先（--length 是兼容别名）；不给就按去空白字数反推（口径同 cli/lib/length-presets.mjs：≥1800 long / ≥900 standard / 其余 short）。');
    console.error('  IP 识别: --ip 优先；否则从路径 ips/<IP>/ 推断；再否则用 default 档。');
    process.exit(2);
  }

  const fmt = (n) => Number(n).toFixed(2);
  let anyFail = false;
  for (const file of files) {
    const ip = ipFlag || inferIp(file);
    const r = checkAiFlavor(readFileSync(file, 'utf8'), { ip, lengthPreset: presetFlag });
    if (!r.passed) anyFail = true;
    const prof = RULES.profiles[r.ip];
    console.log(`\n文件: ${file}`);
    console.log(`IP 档位: ${r.ip}（${prof.label}）${ip && !RULES.profiles[ip] ? ` [请求的 ${ip} 无专属档，回落 default]` : ''}  篇幅档: ${r.lengthPreset}（${r.lengthPresetSource}）`);
    console.log(`正文有效字符: ${r.chars}  句数: ${r.sentenceCount}  段数: ${r.rhythm.paragraphCount}（${r.rhythm.paragraphMode}）`);
    console.log(`结果: ${r.passed ? 'PASS' : 'FAIL'}  block=${r.blockCount} warn=${r.warnCount}`);
    console.log('指标（值 / 阈值）：');
    const order = [
      ['破折号/千字', 'dashPer1000'], ['总结壳/千字', 'summaryShellPer1000'],
      ['悬空"的"句/篇', 'danglingDeCount'], ['最长连续反问', 'consecutiveQuestions'],
      ['不是X是Y/篇', 'notButShellCount'], ['冒号/千字', 'colonPer1000'],
      ['引号/千字', 'quotePer1000'], ['问号/千字', 'questionPer1000'],
      ['省略号/千字', 'ellipsisPer1000'], ['口头禅/千字', 'fillerPer1000'],
      ['黑名单命中', 'blacklistCount'], ['黑话软名单', 'blacklistSoftCount'],
      ['报幕句/篇', 'announceCount'], ['自贴标签/篇', 'selfLabelCount'],
      ['连续免责句串', 'disclaimerRun'], ['免责句/篇', 'disclaimerCount'],
      ['稻草人/篇', 'strawmanObjection'], ['假无生命主语/篇', 'fakeInanimateSubject'],
      ['骑墙不表态/篇', 'fenceSitting'], ['期号回指/千字', 'episodeBackrefPer1000'],
      ['口头禅一段两甩', 'perParagraphOnceCount'], ['短句(≤15字)占比', 'shortSentenceRatio'],
      ['长句(>35字)占比', 'longSentenceRatio'],
      ['句长CV', 'sentenceCvMin'], ['"的"字/千字', 'dePer1000']
    ];
    for (const [label, id] of order) {
      const mt = r.metrics[id];
      if (!mt) continue;
      const f = r.findings.find((x) => x.metric === id);
      const tag = f ? (f.level === 'block' ? 'BLOCK' : 'warn ') : (mt.level === 'info' ? ' info' : '  ok ');
      const bound = mt.kind === 'range' ? `${mt.min}~${mt.max}` : (mt.kind === 'min' ? `≥${mt.min}` : `≤${mt.max}`);
      console.log(`  [${tag}] ${label.padEnd(16)} ${fmt(mt.value).padStart(7)} / ${bound}`);
    }
    console.log(`  [ info] ${'长句(>35字)占比'.padEnd(16)} ${fmt(r.rhythm.longRatio).padStart(7)}  均长 ${fmt(r.rhythm.mean)} 最长 ${r.rhythm.maxLen}` +
      `${r.rhythm.ceilingTruncated ? '  ⚠ 疑似被 50 字硬上限削平（[45,50] 有 ' + r.rhythm.nearCeiling + ' 句且无一句超 50）' : ''}`);
    console.log(`  [ info] ${'单句"的"≥3 的句数'.padEnd(16)} ${String(r.de.heavySentences).padStart(7)}`);
    for (const id of ['announceCount', 'selfLabelCount']) {
      const mt = r.metrics[id];
      if (mt && mt.exemptedCount) {
        console.log(`  [ info] ${(id === 'announceCount' ? '带清单报幕（豁免不计）' : '标签+交付（豁免不计）').padEnd(16)} ${String(mt.exemptedCount).padStart(7)}  例：${(mt.exemptedSamples || []).map((s) => s.slice(0, 22)).join(' / ')}`);
      }
    }
    if (r.metrics.danglingDeCount.samples.length) {
      console.log('  悬空"的"命中句：');
      for (const s of r.metrics.danglingDeCount.samples) console.log(`     - ${s}`);
    }
    if (r.blacklist.block.length) {
      console.log('  黑名单命中：' + r.blacklist.block.map((b) => `[${b.group}]${b.samples ? b.samples[0] : b.term}x${b.count}`).join('、'));
    }
    if (Object.keys(r.metrics.summaryShellPer1000.hits).length) {
      console.log(`  总结壳命中：${Object.entries(r.metrics.summaryShellPer1000.hits).map(([k, v]) => `${k}x${v}`).join('、')}`);
    }
    for (const f of r.findings) {
      const g = RULES.regexGroups[f.metric];
      if (g && f.samples && f.samples.length) {
        console.log(`  ${g.label} 命中句：${f.samples.map((s) => String(s).slice(0, 32)).join(' / ')}`);
      }
    }
  }
  console.log(`\n注意: ${RULES.disclaimer}`);
  process.exit(anyFail ? 1 : 0);
}
