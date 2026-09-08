#!/usr/bin/env node
// check-words.mjs —— 交稿前用用户校准词表查一遍口播稿
//
// 用法：
//   node engine/brief/check-words.mjs <稿件.txt> [--table docs/用户校准词表.json] [--topic-type 虚拟|实物]
//
// 逐行扫描，命中就打印：行号、命中词、换成什么、类型、用户哪天说的、用户点名还是预防性。
//   - --topic-type 虚拟 时才启用「实物专用」那一类
//   - 内置三条结构检查：第一行以「今天给大家分享一个」开头；连续三行都以「我」开头；阿拉伯数字 / 英文字母 / 百分号
//   - 有命中退出 1，末尾打印「词表 N 条，命中 M 处（用户点名 x / 预防性 y）」
//   - 实物专用词前面带否定（不需要囤货 / 不用发快递）只算「提醒」，不计命中、不影响退出码，人自己判断

import fs from 'node:fs';
import { loadTable, filterByTopic, countBySource, resolvePath, DEFAULT_TABLE } from './word-table.mjs';

function die(msg) {
  process.stderr.write(`\n[check-words] 错误：${msg}\n\n`);
  process.exit(2);
}

const USAGE = `
用法：
  node engine/brief/check-words.mjs <稿件.txt> [--table docs/用户校准词表.json] [--topic-type 虚拟|实物]

  --table       词表路径，默认 ${DEFAULT_TABLE}
  --topic-type  虚拟 / 实物。给「虚拟」才查实物专用词；不给就不查那一类并提醒一句

退出码：0 没命中；1 有命中；2 参数或文件出错。
`;

// ───────────────────────── 参数 ─────────────────────────

function parseArgs(argv) {
  const a = { file: null, table: DEFAULT_TABLE, topicType: '' };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') { process.stdout.write(USAGE); process.exit(0); }
    if (t === '--table' || t === '--topic-type') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) die(`${t} 后面缺值`);
      if (t === '--table') a.table = v; else a.topicType = v;
      i++;
      continue;
    }
    if (t.startsWith('--')) die(`不认识的参数：${t}${USAGE}`);
    if (a.file) die(`只能给一个稿件文件，多给了：${t}`);
    a.file = t;
  }
  if (!a.file) die(`缺稿件路径${USAGE}`);
  if (a.topicType && !['虚拟', '实物'].includes(a.topicType)) die(`--topic-type 只能是 虚拟 或 实物，现在是：${a.topicType}`);
  return a;
}

// ───────────────────────── 匹配 ─────────────────────────

const NEGATION_RE = /(不需要|不用|不必|没有|无需|不发|不走|不靠|不压|不管|不存在|不涉及|用不着|省了|省掉|不是)[^，。；！？、,.!?]{0,4}$/;

function entryRegex(e) {
  const src = e.正则 ? e.正则 : e.禁.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(src, 'gu');
}

/**
 * 扫一行。返回命中数组 {entry, term, start, end, negated}。
 * 长词优先：短词落在已命中的长词范围里就不再报（运费险 vs 运费，七天无理由退货 vs 退货，挂红条 vs 红条）。
 */
function scanLine(line, entries) {
  const found = [];
  for (const e of entries) {
    const re = entryRegex(e);
    let m;
    while ((m = re.exec(line)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }
      found.push({ entry: e, term: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  found.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const kept = [];
  for (const f of found) {
    const covered = kept.some((k) => k.entry.类型 === f.entry.类型 && f.start >= k.start && f.end <= k.end);
    if (!covered) kept.push(f);
  }
  kept.sort((a, b) => a.start - b.start);
  for (const f of kept) {
    f.negated = f.entry.类型 === '实物专用' && NEGATION_RE.test(line.slice(0, f.start));
  }
  return kept;
}

function snippet(line, start, end, span = 14) {
  const a = Math.max(0, start - span);
  const b = Math.min(line.length, end + span);
  return `${a > 0 ? '…' : ''}${line.slice(a, start)}【${line.slice(start, end)}】${line.slice(end, b)}${b < line.length ? '…' : ''}`;
}

function sourceLabel(e) {
  return e.录入 === '用户点名' ? `用户 ${e.日期} 点名` : `主线程 ${e.日期} 预防性`;
}

// ───────────────────────── 主流程 ─────────────────────────

const args = parseArgs(process.argv.slice(2));

let table;
try { table = loadTable(args.table); } catch (e) { die(e.message); }

const fileAbs = resolvePath(args.file);
if (!fs.existsSync(fileAbs)) die(`稿件不存在：${fileAbs}`);
const raw = fs.readFileSync(fileAbs, 'utf8').replace(/^﻿/, '');
const lines = raw.replace(/\r\n/g, '\n').split('\n');

const active = args.topicType ? filterByTopic(table.entries, args.topicType) : table.entries.filter((e) => e.类型 !== '实物专用');
const lineEntries = active.filter((e) => e.位置 !== '第一行');
const firstLineEntries = active.filter((e) => e.位置 === '第一行');

const out = [];
const hits = [];       // 词表命中（计数）
const reminders = [];  // 否定豁免的实物词（不计数）
const structural = []; // 结构检查命中（计数）

// 1. 词表逐行
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const entries = i === 0 ? [...firstLineEntries, ...lineEntries] : lineEntries;
  for (const f of scanLine(line, entries)) {
    if (f.entry.位置 === '第一行' && f.start !== 0) continue;
    (f.negated ? reminders : hits).push({ line: i + 1, ...f });
  }
}

// 2. 结构检查
const firstNonEmpty = lines.findIndex((l) => l.trim());
if (firstNonEmpty !== -1 && /^今天给大家分享一个/.test(lines[firstNonEmpty].trim())) {
  const dup = hits.some((h) => h.line === firstNonEmpty + 1 && h.entry.位置 === '第一行');
  if (!dup) structural.push({ line: firstNonEmpty + 1, what: '第一句是「今天给大家分享一个」', fix: '换成故事或画面切入（开头角度清单里六个第一句全不同）' });
}

let run = 0;
for (let i = 0; i <= lines.length; i++) {
  const startsWo = i < lines.length && /^\s*我/.test(lines[i]);
  if (startsWo) { run++; continue; }
  if (run >= 3) structural.push({ line: i - run + 1, what: `连续 ${run} 行都以「我」开头（第 ${i - run + 1}–${i} 行）`, fix: '换起句，别一排「我」' });
  run = 0;
}

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/[0-9０-９A-Za-zＡ-Ｚａ-ｚ%％]+/g);
  if (m) structural.push({ line: i + 1, what: `出现阿拉伯数字 / 英文字母 / 百分号：${[...new Set(m)].join(' ')}`, fix: '全用汉字数字，百分数念「百分之」，英文改中文说法' });
}
structural.sort((a, b) => a.line - b.line);

// ───────────────────────── 输出 ─────────────────────────

const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
out.push(`[check-words] 稿件：${fileAbs}`);
out.push(`[check-words] 词表：${table.abs}（${table.entries.length} 条）　选题类型：${args.topicType || '未给（实物专用那一类没查）'}　本次启用 ${active.length} 条`);
out.push('');

if (hits.length) {
  out.push('── 词表命中 ──');
  for (const h of hits) {
    const e = h.entry;
    out.push(`第 ${pad(String(h.line), 3)} 行  命中「${h.term}」 → 换成：${e.换}`);
    out.push(`         ［${e.类型}］ ${sourceLabel(e)}（${e.id}）　${snippet(lines[h.line - 1], h.start, h.end)}`);
  }
  out.push('');
}
if (structural.length) {
  out.push('── 结构检查命中 ──');
  for (const s of structural) out.push(`第 ${pad(String(s.line), 3)} 行  ${s.what} → ${s.fix}`);
  out.push('');
}
if (reminders.length) {
  out.push('── 提醒（实物词前面带否定，可能是在说「不需要」，自己判断，不计命中） ──');
  for (const h of reminders) {
    out.push(`第 ${pad(String(h.line), 3)} 行  「${h.term}」（${h.entry.id}）　${snippet(lines[h.line - 1], h.start, h.end)}`);
  }
  out.push('');
}

const c = countBySource(table.entries);
const userHits = hits.filter((h) => h.entry.录入 === '用户点名').length;
const preHits = hits.length - userHits;
const total = hits.length + structural.length;
out.push(`词表 ${c.total} 条（用户点名 ${c.users} / 预防性 ${c.preventive}），命中 ${hits.length} 处（用户点名 ${userHits} / 预防性 ${preHits}），结构检查命中 ${structural.length} 处${reminders.length ? `，提醒 ${reminders.length} 处` : ''}`);
out.push(total ? '结论：有命中，打回改。' : '结论：没命中。');

process.stdout.write(out.join('\n') + '\n');
process.exit(total ? 1 : 0);
