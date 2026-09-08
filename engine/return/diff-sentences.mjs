#!/usr/bin/env node
// diff-sentences.mjs —— 修改对照表：源稿 vs 员工改回来的稿，句子级对齐，每句标改动类型
//
// 用法：
//   node engine/return/diff-sentences.mjs --source <源稿> --returned <回稿> --out <对照表.md> [--json <对照表.json>]
//        [--threshold 0.5] [--trend docs/回稿/趋势.md --label <id>]
//
// 做法：两边按 。？！ 切句；相似度 = 字符二元组 Dice；先按顺序做加权 LCS 对齐（相似度 ≥ 阈值才配对），
//       再对没配上的两边做一轮二次匹配，配上的算「挪位置」。
// 类型六种：未动（一字不差）／换词（相似度 ≥0.8）／改通顺（阈值到 0.8）／删句（源有回稿无）／加句（回稿有源无）／挪位置。
//       任何一对里汉字数字或阿拉伯数字不一样的，追加标「改事实?」（只标，不判；核事实链是主线程的活）。
// 文末统计：总句数、各类型数、员工改动句数（换词+改通顺+删句+加句+挪位置）、所有标了「改事实?」的句子。
// --trend：追加一行到趋势表（选题 × 轮次 × 改动句数）。退出码：0 成功；2 参数或文件出错。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePath, readText, writeText, splitSentences, parseArgs, cell, today } from './lib.mjs';

export const DEFAULT_THRESHOLD = 0.5;
export const WORD_LEVEL = 0.8;
export const TYPES = ['未动', '换词', '改通顺', '删句', '加句', '挪位置'];
export const CHANGED_TYPES = ['换词', '改通顺', '删句', '加句', '挪位置'];

const USAGE = `
用法：
  node engine/return/diff-sentences.mjs --source <源稿> --returned <回稿> --out <对照表.md> [--json <对照表.json>]
       [--threshold ${DEFAULT_THRESHOLD}] [--trend docs/回稿/趋势.md --label <id>]

  --source     我方交出去的稿
  --returned   员工改回来的稿
  --out        对照表 md 落点
  --json       同时写一份 JSON（给登记表 / 后续脚本用）
  --threshold  两句算「同一句」的最低相似度，默认 ${DEFAULT_THRESHOLD}
  --trend      趋势表路径，配合 --label（一般写登记表 id）追加一行

退出码：0 成功；2 参数或文件出错。
`;

function die(msg) {
  process.stderr.write(`\n[diff-sentences] 错误：${msg}\n\n`);
  process.exit(2);
}

// ───────────────────────── 相似度 ─────────────────────────

const STRIP = /[\s，。？！、；：""''「」『』（）()《》〈〉…—\-·,.?!;:"'\[\]【】]/g;
export const core = (s) => String(s).replace(STRIP, '');

function bigrams(s) {
  const m = new Map();
  if (s.length === 1) { m.set(s, 1); return m; }
  for (let i = 0; i + 2 <= s.length; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

/** 字符二元组 Dice 相似度（去标点后算），0–1 */
export function similarity(a, b) {
  const x = core(a), y = core(b);
  if (!x.length || !y.length) return x === y ? 1 : 0;
  if (x === y) return 1;
  const A = bigrams(x), B = bigrams(y);
  let inter = 0, na = 0, nb = 0;
  for (const v of A.values()) na += v;
  for (const v of B.values()) nb += v;
  for (const [g, c] of A) if (B.has(g)) inter += Math.min(c, B.get(g));
  return (2 * inter) / (na + nb);
}

// ───────────────────────── 数字 ─────────────────────────

const HANZI_NUM_RE = /[零一二三四五六七八九十百千万亿两]+/g;
const ARABIC_RE = /\d+(?:\.\d+)?/g;
// 「一下 / 一样 / 一起 …」这类里的「一」是词，不是数
const ONE_WORD_NEXT = new Set(['下', '些', '样', '起', '直', '般', '切', '边', '旦', '味', '会', '定', '共', '致', '律', '时', '半', '路', '再', '心', '生', '方', '点', '阵', '声', '眼', '番', '堆', '大', '早', '向', '贯', '概', '并', '举', '来', '开', '看', '听', '说', '问', '手', '口', '身', '头', '模', '系列', '辈子']);

/** 取一句里的数字（汉字数字串 + 阿拉伯数字），返回排序后的数组 */
export function extractNumbers(s) {
  const t = String(s);
  const out = [];
  let m;
  const re = new RegExp(HANZI_NUM_RE.source, 'g');
  while ((m = re.exec(t)) !== null) {
    const v = m[0];
    const next = t[m.index + v.length] || '';
    if (v === '一' && ONE_WORD_NEXT.has(next)) continue;
    out.push(v);
  }
  for (const a of t.match(ARABIC_RE) || []) out.push(a);
  return out.sort();
}

export function numbersDiffer(a, b) {
  const x = extractNumbers(a), y = extractNumbers(b);
  if (x.length !== y.length) return true;
  return x.some((v, i) => v !== y[i]);
}

// ───────────────────────── 对齐 ─────────────────────────

/**
 * 加权 LCS：dp[i][j] = 两边前 i / 前 j 句的最佳配对得分和。只有相似度 ≥ 阈值的才能配对。
 * 返回按顺序的配对 [{ i, j, sim }]。
 */
function alignInOrder(src, ret, threshold) {
  const n = src.length, m = ret.length;
  const sim = Array.from({ length: n }, () => new Float64Array(m));
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) sim[i][j] = similarity(src[i], ret[j]);
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = Math.max(dp[i - 1][j], dp[i][j - 1]);
      const s = sim[i - 1][j - 1];
      if (s >= threshold) best = Math.max(best, dp[i - 1][j - 1] + s);
      dp[i][j] = best;
    }
  }
  const pairs = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const s = sim[i - 1][j - 1];
    if (s >= threshold && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + s)) < 1e-12) { pairs.push({ i: i - 1, j: j - 1, sim: s }); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return pairs.reverse();
}

function classifyPair(a, b, sim) {
  if (core(a) === core(b) && a.trim() === b.trim()) return '未动';
  if (core(a) === core(b)) return '未动';          // 只有标点不同也算没动（转 script 时会统一标点）
  return sim >= WORD_LEVEL ? '换词' : '改通顺';
}

/**
 * 主函数：源句数组、回稿句数组（字符串）→ { rows, stats, factFlags }
 * rows 按源稿顺序走，加句插在它前一个配对句之后。
 */
export function diffSentences(srcSentences, retSentences, { threshold = DEFAULT_THRESHOLD } = {}) {
  const src = srcSentences.map(String);
  const ret = retSentences.map(String);
  const pairs = alignInOrder(src, ret, threshold);
  const srcMatched = new Map(pairs.map((p) => [p.i, p]));
  const retMatched = new Map(pairs.map((p) => [p.j, p]));

  // 二次匹配：没配上的两边，相似度 ≥ 阈值的配成「挪位置」（贪心取最高分）
  const moved = [];
  const freeSrc = src.map((_, i) => i).filter((i) => !srcMatched.has(i));
  const freeRet = ret.map((_, j) => j).filter((j) => !retMatched.has(j));
  const cands = [];
  for (const i of freeSrc) for (const j of freeRet) { const s = similarity(src[i], ret[j]); if (s >= threshold) cands.push({ i, j, sim: s }); }
  cands.sort((a, b) => b.sim - a.sim);
  const usedI = new Set(), usedJ = new Set();
  for (const c of cands) {
    if (usedI.has(c.i) || usedJ.has(c.j)) continue;
    usedI.add(c.i); usedJ.add(c.j);
    moved.push(c);
  }
  const movedBySrc = new Map(moved.map((p) => [p.i, p]));
  const movedRet = new Set(moved.map((p) => p.j));

  // 生成行：走源稿顺序；回稿里独有的句子（加句）按回稿顺序插到前一个配对句后面
  const rows = [];
  let retCursor = 0;   // 回稿已经「消费」到哪一句
  const emitAdded = (upto) => {
    for (; retCursor < upto; retCursor++) {
      const j = retCursor;
      if (retMatched.has(j) || movedRet.has(j)) continue;
      rows.push({ type: '加句', src: '', ret: ret[j], i: -1, j, fact: false, note: '' });
    }
  };
  for (let i = 0; i < src.length; i++) {
    const p = srcMatched.get(i);
    if (p) {
      emitAdded(p.j);
      const type = classifyPair(src[i], ret[p.j], p.sim);
      const fact = type !== '未动' && numbersDiffer(src[i], ret[p.j]);
      rows.push({ type, src: src[i], ret: ret[p.j], i, j: p.j, sim: p.sim, fact, note: type === '未动' ? '' : `相似度 ${p.sim.toFixed(2)}` });
      retCursor = Math.max(retCursor, p.j + 1);
      continue;
    }
    const mv = movedBySrc.get(i);
    if (mv) {
      const fact = numbersDiffer(src[i], ret[mv.j]);
      const sub = core(src[i]) === core(ret[mv.j]) ? '原句照搬' : mv.sim >= WORD_LEVEL ? '顺带换词' : '顺带改通顺';
      rows.push({ type: '挪位置', src: src[i], ret: ret[mv.j], i, j: mv.j, sim: mv.sim, fact, note: `挪到回稿第 ${mv.j + 1} 句，${sub}（相似度 ${mv.sim.toFixed(2)}）` });
      continue;
    }
    rows.push({ type: '删句', src: src[i], ret: '', i, j: -1, fact: false, note: '' });
  }
  emitAdded(ret.length);

  // 「加句 / 删句」里带数字的也提示一下，但不算 改事实?（那是给配对句用的）
  for (const r of rows) {
    if (r.type === '加句' && extractNumbers(r.ret).length) r.note = '新句里有数字，核一下事实链';
    if (r.type === '删句' && extractNumbers(r.src).length) r.note = '删掉的句子里有数字';
  }

  const stats = { 源稿句数: src.length, 回稿句数: ret.length, 总句数: rows.length };
  for (const t of TYPES) stats[t] = rows.filter((r) => r.type === t).length;
  stats['改事实?'] = rows.filter((r) => r.fact).length;
  stats.员工改动句数 = CHANGED_TYPES.reduce((s, t) => s + stats[t], 0);
  const factFlags = rows.filter((r) => r.fact);
  return { rows, stats, factFlags };
}

// ───────────────────────── 渲染 ─────────────────────────

export function renderMd(result, { sourcePath = '', returnedPath = '', label = '' } = {}) {
  const { rows, stats, factFlags } = result;
  const out = [];
  out.push(`# 修改对照表${label ? ` · ${label}` : ''}`);
  out.push('');
  out.push(`> 源稿：\`${sourcePath}\`　回稿：\`${returnedPath}\`　生成：${today()}`);
  out.push('> 类型：未动 / 换词 / 改通顺 / 删句 / 加句 / 挪位置；「改事实?」只标数字不一样的句子，对不对要回事实链核。');
  out.push('');
  out.push('| 序号 | 原句 | 改后 | 改动类型 | 备注 |');
  out.push('| --- | --- | --- | --- | --- |');
  rows.forEach((r, k) => {
    const type = r.fact ? `${r.type}，改事实?` : r.type;
    out.push(`| ${k + 1} | ${cell(r.src)} | ${cell(r.ret)} | ${type} | ${cell(r.note)} |`);
  });
  out.push('');
  out.push('## 统计');
  out.push('');
  out.push(`- 总句数（对照表行数）：${stats.总句数}（源稿 ${stats.源稿句数} 句，回稿 ${stats.回稿句数} 句）`);
  for (const t of TYPES) out.push(`- ${t}：${stats[t]}`);
  out.push(`- 改事实?：${stats['改事实?']}`);
  out.push(`- **员工改动句数**（换词+改通顺+删句+加句+挪位置）：**${stats.员工改动句数}**`);
  out.push('');
  out.push('## 标了「改事实?」的句子');
  out.push('');
  if (!factFlags.length) out.push('（没有）');
  else factFlags.forEach((r) => out.push(`- 原：${r.src}\n  改：${r.ret}`));
  out.push('');
  return out.join('\n');
}

export const TREND_HEADER = '| 日期 | 稿件 | 源稿句数 | 回稿句数 | 员工改动句数 | 换词 | 改通顺 | 删句 | 加句 | 挪位置 | 改事实? | 对照表 |';

export function appendTrend(trendPath, label, stats, outPath = '') {
  const abs = resolvePath(trendPath);
  let text = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  if (!text.trim()) {
    text = ['# 员工改动句数趋势', '', '> 每篇回稿处理完由 `diff-sentences.mjs --trend` 追加一行。只看趋势不做门（用户 2026-09-08 D4）。', '', TREND_HEADER, '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |', ''].join('\n');
  }
  if (!text.endsWith('\n')) text += '\n';
  text += `| ${today()} | ${cell(label)} | ${stats.源稿句数} | ${stats.回稿句数} | ${stats.员工改动句数} | ${stats.换词} | ${stats.改通顺} | ${stats.删句} | ${stats.加句} | ${stats.挪位置} | ${stats['改事实?']} | ${cell(outPath)} |\n`;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
  return abs;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const a = parseArgs(process.argv.slice(2), { flags: ['help'] });
  if (a.help) { process.stdout.write(USAGE); process.exit(0); }
  if (!a.source) die(`缺 --source${USAGE}`);
  if (!a.returned) die(`缺 --returned${USAGE}`);
  if (!a.out) die(`缺 --out${USAGE}`);
  if (a.trend && !a.label) die('--trend 要配 --label');
  const threshold = a.threshold ? Number(a.threshold) : DEFAULT_THRESHOLD;
  if (!(threshold > 0 && threshold < 1)) die('--threshold 要在 0 到 1 之间');
  let srcText, retText;
  try { srcText = readText(a.source); retText = readText(a.returned); } catch (e) { die(e.message); }
  const src = splitSentences(srcText).map((s) => s.text);
  const ret = splitSentences(retText).map((s) => s.text);
  if (!src.length) die('源稿切不出句子');
  if (!ret.length) die('回稿切不出句子');
  const r = diffSentences(src, ret, { threshold });
  const mdAbs = writeText(a.out, renderMd(r, { sourcePath: a.source, returnedPath: a.returned, label: a.label || '' }));
  const lines = [`[diff-sentences] 对照表：${mdAbs}`];
  if (a.json) {
    const jAbs = writeText(a.json, JSON.stringify({ source: a.source, returned: a.returned, label: a.label || '', stats: r.stats, rows: r.rows }, null, 2) + '\n');
    lines.push(`[diff-sentences] JSON：${jAbs}`);
  }
  if (a.trend) lines.push(`[diff-sentences] 趋势表追加：${appendTrend(a.trend, a.label, r.stats, a.out)}`);
  const s = r.stats;
  lines.push(`总句数 ${s.总句数}（源 ${s.源稿句数} / 回 ${s.回稿句数}）　未动 ${s.未动}　换词 ${s.换词}　改通顺 ${s.改通顺}　删句 ${s.删句}　加句 ${s.加句}　挪位置 ${s.挪位置}　改事实? ${s['改事实?']}`);
  lines.push(`员工改动句数：${s.员工改动句数}`);
  if (r.factFlags.length) {
    lines.push('标了「改事实?」的句子：');
    for (const f of r.factFlags) lines.push(`  原：${f.src}\n  改：${f.ret}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}
