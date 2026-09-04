#!/usr/bin/env node
// 风格标志下限门（style floor）。
//
// 现有九道门全是「不许超」，一道「不许低于」的都没有——这是 2026-09-03「钱十七风格流失」
// 事故能一路绿灯通过的结构性原因：五篇新稿在九道门上 block=0 / warn=0 全部 PASS，
// 用户读完的评价是「ai 味少了点，但是没有钱十七的风格感觉了」。
// 门禁全是上限时，模型的安全解就是**什么都不做**，于是这个 IP 的定义性动作被删干净了。
//
// 这道门量的是「像不像这个 IP」，不是「像不像 AI」。十一项指标、阈值与依据见
// engine/naturalness/style-floor-rules.json，测量口径来自
// docs/钱十七风格流失诊断-20260903.md §1（真人 9 期语料 + mac 参照稿 + 五篇新稿的实测对照）。
//
// 与 check-ai-flavor 的分工：那边查「有没有写出 AI 腔」（全是上限），这边查「有没有把这个 IP
// 的标志动作写出来」（全是下限）。两边有一处故意重叠——longSentenceRatio：AI 味那边的 0.30 是
// 生成层配额的镜像（warn，不承诺零误伤），这边的是按真人语料+两份人已认可的稿子校准过的硬下限。
//
// 没有专属档的 IP 一律跳过整道门（scope=skip），绝不拿钱十七的下限去卡别人。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { splitSentences, fillerWordsFor } from './check-ai-flavor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FLOOR_RULES = JSON.parse(readFileSync(join(here, 'style-floor-rules.json'), 'utf8'));
const AI_RULES = JSON.parse(readFileSync(join(here, 'ai-flavor-rules.json'), 'utf8'));
// 提示词层要照着同一份阈值写「至少多少处」，禁止在提示词里另写一套数字。
export { FLOOR_RULES as STYLE_FLOOR_RULES };

// 正文口径：在 check-ai-flavor.bodyOf 的基础上再去掉 [插图：…] / [画面：…] 这类画面标注行
// ——人工校准稿（qian17-styled-final-v2.md）是带插图标注的成稿，那些行不是口播。
export function floorBodyOf(text) {
  return String(text)
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => !l.startsWith('#') && l.trim() !== '---')
    .map((l) => l.replace(/[［[](插图|画面|字幕|图)[^\]］]*[\]］]/g, ''))
    .join('\n');
}

const ratio = (n, d) => (d ? n / d : 0);

// 该 IP 的口头禅表：与 AI 味门禁共读 ai-flavor-rules.json 的 profiles[ip].fillerWords，
// 禁止在本文件另抄一份（上一轮的事故就是同一张表在两处各写了一遍、且都写错了人）。
export function ipFillerWordsFor(ip, aiRules = AI_RULES) {
  const profile = (aiRules.profiles && aiRules.profiles[ip]) || null;
  return fillerWordsFor(profile, aiRules);
}

export function checkStyleFloor(text, opts = {}) {
  const rules = opts.rules || FLOOR_RULES;
  const ip = opts.ip;
  const profile = ip && rules.profiles[ip] ? rules.profiles[ip] : null;

  const body = floorBodyOf(text);
  const flat = body.replace(/\s/g, '');
  const chars = flat.length;
  const sentences = splitSentences(body).filter((s) => s.text.length > 0);
  const n = sentences.length;

  // --- 逐项计数（无论跑不跑门禁都算，报告要看到数）---
  const counts = {};
  const samples = {};
  for (const [id, g] of Object.entries(rules.patterns || {})) {
    const re = new RegExp(g.pattern);
    const hit = sentences.filter((s) => re.test(s.text));
    counts[id] = hit.length;
    samples[id] = hit.slice(0, 3).map((s) => s.text.slice(0, 40));
  }

  const fillerWords = ipFillerWordsFor(ip);
  let ipFillerCount = 0;
  const ipFillerHits = {};
  for (const w of fillerWords) {
    const c = flat.split(w).length - 1;
    if (c) { ipFillerHits[w] = c; ipFillerCount += c; }
  }

  const foreignWords = (profile && profile.foreignIpFillerWords) || [];
  let foreignCount = 0;
  const foreignHits = {};
  for (const w of foreignWords) {
    const c = flat.split(w).length - 1;
    if (c) { foreignHits[w] = c; foreignCount += c; }
  }

  const longCount = sentences.filter((s) => s.text.length > 35).length;

  const values = {
    actionInstructionRatio: ratio(counts.actionInstruction, n),
    assertiveRatio: ratio(counts.assertive, n),
    assertiveHedgeRatio: counts.hedge ? counts.assertive / counts.hedge : (counts.assertive ? Infinity : 0),
    numberedProgressRatio: ratio(counts.numberedProgress, n),
    benefitRatio: ratio(counts.benefit, n),
    coachVoiceCount: counts.coachVoice,
    signatureFrameCount: counts.signatureFrame,
    ipFillerPer1000: chars ? (ipFillerCount / chars) * 1000 : 0,
    longSentenceRatio: ratio(longCount, n),
    secondPersonRatio: ratio(counts.secondPerson, n),
    foreignIpFillerCount: foreignCount
  };

  if (!profile || profile.scope === 'skip') {
    return {
      skipped: true,
      reason: ip ? `IP「${ip}」没有风格标志下限档，整道门跳过（绝不拿别的 IP 的下限卡它）` : '未指定 IP，风格标志下限门跳过',
      passed: true, ip: ip || null, chars, sentenceCount: n,
      values, counts, samples, findings: [], blockCount: 0, warnCount: 0,
      ipFiller: { count: ipFillerCount, hits: ipFillerHits, words: fillerWords },
      foreign: { count: foreignCount, hits: foreignHits }
    };
  }

  const findings = [];
  const metrics = {};
  for (const [id, cfg] of Object.entries(profile.metrics || {})) {
    const value = values[id];
    metrics[id] = { ...cfg, id, value, samples: samples[(id.replace(/(Ratio|Count|Per1000)$/, ''))] };
    if (value === undefined) continue;
    const patLabel = (rules.patterns[id.replace(/(Ratio|Count|Per1000)$/, '')] || {}).label;
    if (cfg.min !== undefined && value < cfg.min) {
      findings.push({
        level: cfg.level || 'warn', metric: id, value, threshold: cfg.min, comparator: '<',
        label: patLabel, rationale: cfg.rationale
      });
    } else if (cfg.warnMin !== undefined && value < cfg.warnMin) {
      // 两档下限：block 那档取「11 份已认可文本的实测最小值」保证零误伤，warn 那档取诊断给的目标值。
      // 落在两档之间＝没到「删干净」的程度，但也没写够，只提醒，不拦稿。
      findings.push({
        level: 'warn', metric: id, value, threshold: cfg.warnMin, comparator: '<',
        label: patLabel, tier: 'warnMin', rationale: cfg.rationale
      });
    }
    if (cfg.max !== undefined && value > cfg.max) {
      findings.push({
        level: cfg.level || 'warn', metric: id, value, threshold: cfg.max, comparator: '>',
        label: (rules.patterns[id.replace(/(Ratio|Count|Per1000)$/, '')] || {}).label,
        hits: id === 'foreignIpFillerCount' ? foreignHits : undefined,
        rationale: cfg.rationale
      });
    }
  }

  const blockCount = findings.filter((f) => f.level === 'block').length;
  return {
    skipped: false, passed: blockCount === 0, ip, chars, sentenceCount: n,
    values, counts, samples, metrics, findings, blockCount,
    warnCount: findings.length - blockCount,
    ipFiller: { count: ipFillerCount, hits: ipFillerHits, words: fillerWords },
    foreign: { count: foreignCount, hits: foreignHits }
  };
}

// 报告/反馈用的人话名字。gates.mjs 与 report.mjs 共用，别在别处再抄。
export const STYLE_FLOOR_LABELS = {
  actionInstructionRatio: '动作指令句太少（边讲边催是这个 IP 最强的标志：催点赞、催收藏、催截图、催你现在就去验）',
  assertiveRatio: '确定句太少（他用确定句推进：就是 / 一定要 / 肯定 / 绝对 / 很简单；保守是给数字的，不是给语气的）',
  assertiveHedgeRatio: '迟疑句压过了确定句（语气反过来了：数字可以给区间，判断不许给区间）',
  numberedProgressRatio: '方向词密度太低（先看 / 接下来 / 第一 / 这里注意，他每四句就有一句在牵着人走）',
  benefitRatio: '利益话术太少（这个 IP 的定义第一个词就是「利益驱动」，每隔几句要落回赚钱这件事）',
  coachVoiceCount: '教学承诺句太少（他是教练不是记者：这一块我给你讲透 / 我教你一个最省事的办法 / 照着这三步做就行）',
  signatureFrameCount: '自标重要性 + 带清单报幕合计太少（「最关键的是 X，因为 Y」「我给你总结了四条，分别是……」是他的招牌推进方式）',
  ipFillerPer1000: '这个 IP 自己的口头禅太少（给大家 / 一定要 / 我们 / 大家 / 比如 / 建议 / 很简单 / 讲透）',
  longSentenceRatio: '长句太少（长句扛信息、短句砸判断；全篇 15–20 字平推是「听着不像他」最直接的一层）',
  secondPersonRatio: '第二人称叙事太少（整篇没有听众在场）',
  foreignIpFillerCount: '**写进了别的 IP 的口头禅**（说白了 / 最起码 / 等等等等 / 大错特错 / 卖就完了 / 我跟你讲 / 轻轻松松 / 没有之一 / 思路打开——这些是另一个人的话，写进去等于换了个人在说）'
};

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
    console.error('用法: node engine/naturalness/check-style-floor.mjs --ip 钱十七 <文案文件> [更多文件...]');
    console.error('  风格标志下限门：查「这个 IP 的标志动作有没有被删干净」，全是下限，与 check-ai-flavor 的上限门互补。');
    console.error('  没有专属档的 IP 会整道门跳过（PASS），不会拿别人的下限卡它。');
    process.exit(2);
  }
  const fmt = (n) => (Number.isFinite(n) ? Number(n).toFixed(2) : '∞');
  const ORDER = [
    ['动作指令句占比', 'actionInstructionRatio'], ['确定句占比', 'assertiveRatio'],
    ['确定/迟疑比', 'assertiveHedgeRatio'], ['方向词句占比', 'numberedProgressRatio'],
    ['利益句占比', 'benefitRatio'], ['教学承诺句/篇', 'coachVoiceCount'],
    ['自标+带清单报幕/篇', 'signatureFrameCount'], ['本人口头禅/千字', 'ipFillerPer1000'],
    ['长句(>35字)占比', 'longSentenceRatio'], ['第二人称句占比', 'secondPersonRatio'],
    ['外来 IP 口头禅', 'foreignIpFillerCount']
  ];
  let anyFail = false;
  for (const file of files) {
    const r = checkStyleFloor(readFileSync(file, 'utf8'), { ip: ipFlag });
    if (!r.passed) anyFail = true;
    console.log(`\n文件: ${file}`);
    if (r.skipped) { console.log(`跳过：${r.reason}`); continue; }
    console.log(`IP 档位: ${r.ip}｜正文有效字符 ${r.chars}｜句数 ${r.sentenceCount}`);
    console.log(`结果: ${r.passed ? 'PASS' : 'FAIL'}  block=${r.blockCount} warn=${r.warnCount}`);
    for (const [label, id] of ORDER) {
      const mt = r.metrics[id];
      if (!mt) continue;
      const f = r.findings.find((x) => x.metric === id);
      const tag = f ? (f.level === 'block' ? 'BLOCK' : 'warn ') : '  ok ';
      const bound = mt.max !== undefined ? `≤${mt.max}` : `≥${mt.min}${mt.warnMin !== undefined ? `（目标 ≥${mt.warnMin}）` : ''}`;
      console.log(`  [${tag}] ${label.padEnd(18)} ${fmt(mt.value).padStart(7)} / ${bound}`);
    }
    if (r.foreign.count) {
      console.log('  ❌ 外来 IP 口头禅命中：' + Object.entries(r.foreign.hits).map(([k, v]) => `${k}x${v}`).join('、'));
    }
    for (const f of r.findings) {
      const s = (r.samples[f.metric.replace(/(Ratio|Count|Per1000)$/, '')] || []);
      if (s.length) console.log(`  ${f.metric} 现有命中句：${s.join(' / ')}`);
    }
  }
  console.log(`\n注意: ${FLOOR_RULES.disclaimer}`);
  process.exit(anyFail ? 1 : 0);
}
