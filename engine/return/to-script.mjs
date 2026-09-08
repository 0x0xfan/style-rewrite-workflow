#!/usr/bin/env node
// to-script.mjs —— 把回稿转成视频方要的纯口播稿 script.txt；或校验 storyboard 口播段与 script 逐字一致
//
// 用法：
//   node engine/return/to-script.mjs <回稿> --out <script.txt> [--max 50] [--hard 60]
//   node engine/return/to-script.mjs --verify <script.txt> --storyboard <storyboard.md>
//
// 转换：
//   1. 去掉一切不念的：markdown 记号（# 标题、> 引用、**粗体**、`代码`、---、列表点）、行首「画面 / 目的 / 备注」段、
//      「（画面：…）」「【…】」这类明显的画面标注；普通括号里的内容保留并列出来让人看。空行合并。
//   2. 阿拉伯数字、英文字母、百分号：不自动改，逐条列出并退出码 2（念法要人定）。
//   3. 单句超 --max 字：只把句内逗号 / 分号升成句号做最小拆分（从最靠近中点的逗号拆），不改字；
//      拆出来的前半句不能以裸「的」收尾，会换相邻的逗号；拆完仍超 --max 的列出来（超 --hard 报错）。
//   4. 「我是圣矾」必须恰好出现一次且独占一句，否则报错。
//   输出一句一行、句末是 。？！ 之一。打印字数、句数、最长句、拆了哪几句。
// 校验（--verify）：把 storyboard 里所有「**口播**：」段落拼起来，与 script 去空白后逐字比对，不一致打印第一处差异。
// 退出码：0 成功；1 校验不一致；2 需要人来改（数字 / 字母 / 圣矾 / 超硬上限）或参数文件出错。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePath, readText, writeText, splitSentences, sentenceLen, cjkCount, parseArgs } from './lib.mjs';

export const DEFAULT_MAX = 50;
export const DEFAULT_HARD = 60;
export const SELF_INTRO = '我是圣矾';

const USAGE = `
用法：
  node engine/return/to-script.mjs <回稿> --out <script.txt> [--max ${DEFAULT_MAX}] [--hard ${DEFAULT_HARD}]
  node engine/return/to-script.mjs --verify <script.txt> --storyboard <storyboard.md>

  --out         script.txt 落点（有错不写）
  --max         单句字数上限，超了拆逗号，默认 ${DEFAULT_MAX}
  --hard        拆完仍超这个数就报错，默认 ${DEFAULT_HARD}（视频方硬上限）
  --verify      要校验的 script.txt，配 --storyboard

退出码：0 成功；1 校验不一致；2 要人来改（数字/字母/百分号、我是圣矾不对、句子超硬上限）或参数文件出错。
`;

function die(msg, code = 2) {
  process.stderr.write(`\n[to-script] 错误：${msg}\n\n`);
  process.exit(code);
}

// ───────────────────────── 清洗 ─────────────────────────

const DROP_LINE = [
  /^\s*#/,                                        // 标题
  /^\s*>/,                                        // 引用（成稿头部的说明）
  /^\s*-{3,}\s*$/,                                // 分隔线
  /^\s*(\*\*)?(画面|目的|备注|标题|段名|时长|素材)(\*\*)?\s*[:：]/,   // 段字段
  /^\s*【[^】]*】\s*$/,                            // 整行方括号标注
  /^\s*[（(]\s*画面[:：][^）)]*[）)]\s*$/,          // 整行画面提示
];

/**
 * 回稿文本 → { lines, kept, dropped }：lines 是要念的行（已去 markdown），kept 是保留下来的普通括号，
 * dropped 是删掉的画面标注 / 段字段行（给人看）。
 */
export function cleanText(text) {
  const kept = [];
  const dropped = [];
  const lines = [];
  for (const raw of String(text).split('\n')) {
    let line = raw;
    if (!line.trim()) continue;
    if (DROP_LINE.some((re) => re.test(line))) { dropped.push(raw.trim()); continue; }
    line = line.replace(/^\s*(\*\*)?口播(\*\*)?\s*[:：]\s*/, '');           // 「**口播**：」前缀
    line = line.replace(/^\s*(?:[-*+]|\d+[.、)])\s+/, '');                  // 列表点
    line = line.replace(/[（(]\s*画面[:：][^）)]*[）)]/g, (m) => { dropped.push(m); return ''; });
    line = line.replace(/【[^】]*】/g, (m) => { dropped.push(m); return ''; });
    line = line.replace(/\*\*|__|`/g, '');
    for (const m of line.match(/（[^）]*）|\([^)]*\)/g) || []) kept.push(m);
    line = line.trim();
    if (line) lines.push(line);
  }
  return { lines, kept, dropped };
}

/** 找出要人定念法的东西：阿拉伯数字、英文字母、百分号 */
export function findUnreadable(sentences) {
  const out = [];
  sentences.forEach((s, k) => {
    for (const m of s.match(/\d+(?:\.\d+)?|[A-Za-z]+|[%％]/g) || []) out.push({ index: k + 1, what: m, sentence: s });
  });
  return out;
}

// ───────────────────────── 拆句 ─────────────────────────

const END = /[。？！]$/;
const normalizeEnd = (s) => (END.test(s) ? s : s.replace(/[，、；：,;:]+$/, '') + '。');

/**
 * 一句超 max：在 ，； 里挑离中点最近的一个，把它升成句号；前半句不能以「的」收尾（换相邻逗号）。
 * 递归到每段都 ≤ max 或没逗号可拆。返回 [句子...]。
 */
export function splitLong(sentence, max) {
  if (sentenceLen(sentence) <= max) return [sentence];
  const positions = [];
  for (let i = 0; i < sentence.length - 1; i++) if (sentence[i] === '，' || sentence[i] === '；') positions.push(i);
  if (!positions.length) return [sentence];
  const mid = sentence.length / 2;
  positions.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  for (const pos of positions) {
    const left = sentence.slice(0, pos);
    const right = sentence.slice(pos + 1).trim();
    if (!left.trim() || !right) continue;
    if (/的$/.test(left)) continue;                     // 裸「的」收尾会触发悬空「的」门禁
    return [...splitLong(left + '。', max), ...splitLong(normalizeEnd(right), max)];
  }
  return [sentence];
}

/**
 * 主转换。返回 { sentences, errors, warnings, splits, kept, dropped, stats }。
 * errors 非空就不该写文件。
 */
export function toScript(text, { max = DEFAULT_MAX, hard = DEFAULT_HARD } = {}) {
  const { lines, kept, dropped } = cleanText(text);
  const raw = splitSentences(lines.join('\n')).map((s) => normalizeEnd(s.text));
  const errors = [];
  const warnings = [];

  const unreadable = findUnreadable(raw);
  if (unreadable.length) {
    errors.push(`有 ${unreadable.length} 处阿拉伯数字 / 英文字母 / 百分号，念法要人定，改成汉字再来：`);
    for (const u of unreadable) errors.push(`  第 ${u.index} 句「${u.what}」：${u.sentence}`);
  }

  const sentences = [];
  const splits = [];
  for (const s of raw) {
    const parts = splitLong(s, max);
    if (parts.length > 1) splits.push({ from: s, to: parts });
    sentences.push(...parts);
  }
  const still = sentences.filter((s) => sentenceLen(s) > max);
  for (const s of still) {
    const len = sentenceLen(s);
    if (len > hard) errors.push(`这句拆完还有 ${len} 字，超硬上限 ${hard}，要人改：${s}`);
    else warnings.push(`这句拆完还有 ${len} 字（上限 ${max}，硬上限 ${hard}），没逗号可拆：${s}`);
  }

  const intro = sentences.filter((s) => s.includes(SELF_INTRO));
  const introCount = (sentences.join('').match(new RegExp(SELF_INTRO, 'g')) || []).length;
  if (introCount !== 1) errors.push(`「${SELF_INTRO}」要恰好出现一次，现在 ${introCount} 次${intro.length ? '：\n  ' + intro.join('\n  ') : ''}`);
  else if (intro[0].replace(/[。？！]$/, '') !== SELF_INTRO) errors.push(`「${SELF_INTRO}」要独占一句，现在是：${intro[0]}`);

  let longest = '';
  for (const s of sentences) if (sentenceLen(s) > sentenceLen(longest)) longest = s;
  const stats = { 字数: cjkCount(sentences.join('')), 句数: sentences.length, 最长句字数: sentenceLen(longest), 最长句: longest, 拆句数: splits.length };
  return { sentences, errors, warnings, splits, kept, dropped, stats };
}

// ───────────────────────── 校验 ─────────────────────────

/** 从 storyboard 里抽所有「**口播**：」段落（该行之后到空行 / 下一个 ** 字段 / 下一个标题为止） */
export function extractNarration(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const chunks = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\s*\*\*口播\*\*\s*[:：]\s*(.*)$/);
    if (m) { cur = []; if (m[1].trim()) cur.push(m[1].trim()); chunks.push(cur); continue; }
    if (!cur) continue;
    if (!line.trim() || /^\s*\*\*[^*]+\*\*\s*[:：]/.test(line) || /^\s*#/.test(line) || /^\s*-{3,}\s*$/.test(line)) { cur = null; continue; }
    cur.push(line.trim());
  }
  return chunks.map((c) => c.join(''));
}

export function verifyAgainst(scriptText, storyboardMd) {
  const a = String(scriptText).replace(/\s+/g, '');
  const chunks = extractNarration(storyboardMd);
  const b = chunks.join('').replace(/\s+/g, '');
  if (!chunks.length) return { ok: false, reason: 'storyboard 里没找到「**口播**：」段落', chunks: 0 };
  if (a === b) return { ok: true, chunks: chunks.length, length: a.length };
  let k = 0;
  while (k < a.length && k < b.length && a[k] === b[k]) k++;
  const ctx = (s) => s.slice(Math.max(0, k - 15), k) + '▶' + s.slice(k, k + 20);
  return { ok: false, chunks: chunks.length, pos: k, scriptLen: a.length, storyboardLen: b.length, scriptCtx: ctx(a), storyboardCtx: ctx(b) };
}

// ───────────────────────── CLI ─────────────────────────

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const a = parseArgs(process.argv.slice(2), { flags: ['help'] });
  if (a.help) { process.stdout.write(USAGE); process.exit(0); }

  if (a.verify) {
    if (!a.storyboard) die(`--verify 要配 --storyboard${USAGE}`);
    let s, b;
    try { s = readText(a.verify); b = readText(a.storyboard); } catch (e) { die(e.message); }
    const r = verifyAgainst(s, b);
    if (r.ok) { process.stdout.write(`[to-script] 校验通过：storyboard ${r.chunks} 段口播与 script 逐字一致（去空白 ${r.length} 字）\n`); process.exit(0); }
    if (r.reason) die(r.reason, 1);
    process.stdout.write(`[to-script] 校验不通过：第 ${r.pos + 1} 个字开始不一样（script ${r.scriptLen} 字，storyboard ${r.chunks} 段共 ${r.storyboardLen} 字）\n  script    ：…${r.scriptCtx}…\n  storyboard：…${r.storyboardCtx}…\n`);
    process.exit(1);
  }

  if (a.positional.length !== 1) die(`要给一个回稿文件${USAGE}`);
  if (!a.out) die(`缺 --out${USAGE}`);
  const max = a.max ? Number(a.max) : DEFAULT_MAX;
  const hard = a.hard ? Number(a.hard) : DEFAULT_HARD;
  if (!Number.isInteger(max) || max < 10) die('--max 要是 ≥10 的整数');
  if (!Number.isInteger(hard) || hard < max) die('--hard 要是 ≥ --max 的整数');
  let text;
  try { text = readText(a.positional[0]); } catch (e) { die(e.message); }
  const r = toScript(text, { max, hard });
  const out = [];
  if (r.dropped.length) { out.push(`删掉的标注 / 字段行 ${r.dropped.length} 处：`); for (const d of r.dropped) out.push(`  ${d}`); }
  if (r.kept.length) { out.push(`保留的普通括号 ${r.kept.length} 处（确认要不要念）：`); for (const k of r.kept) out.push(`  ${k}`); }
  if (r.splits.length) {
    out.push(`拆了 ${r.splits.length} 句：`);
    for (const s of r.splits) out.push(`  原（${sentenceLen(s.from)} 字）：${s.from}\n  → ${s.to.join(' ／ ')}`);
  }
  for (const w of r.warnings) out.push(`提示：${w}`);
  out.push(`字数 ${r.stats.字数}　句数 ${r.stats.句数}　最长句 ${r.stats.最长句字数} 字：${r.stats.最长句}`);
  process.stdout.write(out.join('\n') + '\n');
  if (r.errors.length) die(`有 ${r.errors.length} 处要人来改，script 没写：\n${r.errors.join('\n')}`);
  const abs = writeText(a.out, r.sentences.join('\n') + '\n');
  process.stdout.write(`[to-script] 已写：${abs}\n`);
}
