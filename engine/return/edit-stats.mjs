#!/usr/bin/env node
// edit-stats.mjs —— 员工改稿计数：扫 NAS 已审目录里所有稿，认出源稿、逐句对照，算改动率，看趋势是不是往下走
//
// 用法：
//   node engine/return/edit-stats.mjs [--since YYYY-MM-DD] [--out <md路径>] [--nas <已审目录>]
//        [--registry docs/稿件登记.json] [--n 8] [--min 0.3] [--threshold 0.5]
//
// 做法：读 NAS 已审目录下所有文件（按已审文件的最后修改时间算"哪天改完的"）→ 对每篇跑
//       identify.mjs 的认稿算法找出对应原稿 → 跑 diff-sentences.mjs 的对照算法算改动句数（换词/改通顺/
//       增/删/挪位置分开数）→ 改动率 = 改动句数 / 原稿句数。
// 输出三段：① 按日期排的表（日期/稿件/写稿模型/原稿句数/改动句数/换词/改通顺/增/删/改动率）
//          ② 每日汇总（篇数/平均改动句数/平均改动率）
//          ③ 认不出源稿的单列出来，不猜
// 只读 NAS 和登记表，不写 NAS、不改登记表。默认打 stdout；--out 时写 markdown 文件。
// 退出码：0 成功（含"有认不出的"，那不是错误）；2 参数或目录出错。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identify, formatIdentify } from './identify.mjs';
import { diffSentences, CHANGED_TYPES } from './diff-sentences.mjs';
import { readText, splitSentences, parseArgs, loadRegistry, cell, resolvePath, DEFAULT_REGISTRY } from './lib.mjs';

export const DEFAULT_NAS_DIR = '\\\\Zqkj_nas\\一楼4t\\素材生成库\\ai文案\\已审';
export const DEFAULT_N = 8;
export const DEFAULT_MIN = 0.3;
export const DEFAULT_THRESHOLD = 0.5;
const MODEL_FIELDS = ['写稿模型', '模型', 'AI模型', 'model'];

const USAGE = `
用法：
  node engine/return/edit-stats.mjs [--since YYYY-MM-DD] [--out <md路径>] [--nas <已审目录>]
       [--registry ${DEFAULT_REGISTRY}] [--n ${DEFAULT_N}] [--min ${DEFAULT_MIN}] [--threshold ${DEFAULT_THRESHOLD}]

  --since      只统计已审文件最后修改时间 ≥ 这天的稿
  --out        写 markdown 文件；不给就打 stdout
  --nas        已审目录，默认 NAS 已审（一楼4t）
  --registry   稿件登记表
  --n / --min  认稿窗口与门槛，同 identify.mjs
  --threshold  对照相似度阈值，同 diff-sentences.mjs

退出码：0 成功；2 参数或目录出错。
`;

function die(msg) {
  process.stderr.write(`\n[edit-stats] 错误：${msg}\n\n`);
  process.exit(2);
}

/** YYYY-MM-DD，本地时区 */
export function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function modelOf(entry) {
  if (!entry) return '未知';
  for (const f of MODEL_FIELDS) if (entry[f]) return entry[f];
  return '未知';
}

/**
 * 列出目录下的普通文件名（不含子目录），按文件名排序。纯 IO 包装，方便测试时替换。
 */
export function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();
}

/**
 * 对一篇已审稿算统计。file: { name, mtimeDate(Date), text(string) }
 * 返回 { recognized:true, row } 或 { recognized:false, name, dateStr, reason }
 */
export function statForFile(file, registry, { n = DEFAULT_N, min = DEFAULT_MIN, threshold = DEFAULT_THRESHOLD } = {}) {
  const ds = dateStr(file.mtimeDate);
  const idr = identify(file.text, registry, { n, min });
  if (!idr.recognized) {
    const reason = !idr.returnedWindows
      ? '稿子里没有够长的汉字句子'
      : idr.best && idr.best.missing
        ? '登记表里的源稿文件读不到'
        : `最高只有 ${idr.best ? (idr.best.ratio * 100).toFixed(1) : '0'}%，低于门槛 ${(min * 100).toFixed(0)}%`;
    return { recognized: false, name: file.name, dateStr: ds, reason };
  }
  const entry = idr.best.entry;
  const srcAbs = resolvePath(entry.稿件路径);
  const srcText = readText(srcAbs);
  const src = splitSentences(srcText).map((s) => s.text);
  const ret = splitSentences(file.text).map((s) => s.text);
  const d = diffSentences(src, ret, { threshold });
  const srcCount = d.stats.源稿句数;
  const changed = d.stats.员工改动句数;
  const rate = srcCount > 0 ? changed / srcCount : null;
  return {
    recognized: true,
    row: {
      date: ds,
      file: file.name,
      id: entry.id,
      topic: entry.选题 || '',
      model: modelOf(entry),
      srcCount,
      changed,
      换词: d.stats.换词,
      改通顺: d.stats.改通顺,
      增: d.stats.加句,
      删: d.stats.删句,
      挪位置: d.stats.挪位置,
      rate,
      ratio: idr.best.ratio,
    },
  };
}

/** files: [{name, mtimeDate, text}]；返回 { rows, unrecognized }，rows 按日期升序 */
export function buildStats(files, registry, opts = {}) {
  const rows = [];
  const unrecognized = [];
  for (const f of files) {
    const r = statForFile(f, registry, opts);
    if (r.recognized) rows.push(r.row); else unrecognized.push(r);
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.file.localeCompare(b.file)));
  unrecognized.sort((a, b) => (a.dateStr < b.dateStr ? -1 : a.dateStr > b.dateStr ? 1 : a.name.localeCompare(b.name)));
  return { rows, unrecognized };
}

/** 每日汇总：{date, count, avgChanged, avgRate}[]，按日期升序 */
export function dailySummary(rows) {
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  const dates = [...byDate.keys()].sort();
  return dates.map((date) => {
    const list = byDate.get(date);
    const avgChanged = list.reduce((s, r) => s + r.changed, 0) / list.length;
    const withRate = list.filter((r) => r.rate !== null);
    const avgRate = withRate.length ? withRate.reduce((s, r) => s + r.rate, 0) / withRate.length : null;
    return { date, count: list.length, avgChanged, avgRate };
  });
}

const pct = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);
const n1 = (x) => (x === null || x === undefined ? '—' : x.toFixed(1));

export function renderMarkdown({ rows, unrecognized, daily, since = '', nasDir = '' }) {
  const out = [];
  out.push('# 员工改稿计数');
  out.push('');
  out.push(`> 扫描：${nasDir || 'NAS 已审目录'}${since ? `　起始日期：${since}` : ''}　生成：${dateStr(new Date())}`);
  out.push('> 改动率 = 员工改动句数（换词+改通顺+增+删+挪位置）/ 原稿句数；数越低说明离"不用人改"越近。');
  out.push('');
  out.push('## 逐篇明细（按日期）');
  out.push('');
  out.push('| 日期 | 稿件 | 认出源稿 | 写稿模型 | 原稿句数 | 改动句数 | 换词 | 改通顺 | 增 | 删 | 挪位置 | 改动率 |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    out.push(`| ${r.date} | ${cell(r.file)} | ${cell(`${r.id}（${r.topic}）`)} | ${cell(r.model)} | ${r.srcCount} | ${r.changed} | ${r.换词} | ${r.改通顺} | ${r.增} | ${r.删} | ${r.挪位置} | ${pct(r.rate)} |`);
  }
  if (!rows.length) out.push('| （没有认出源稿的稿子） | | | | | | | | | | | |');
  out.push('');
  out.push('## 每日汇总（看趋势是不是往下走）');
  out.push('');
  out.push('| 日期 | 篇数 | 平均改动句数 | 平均改动率 |');
  out.push('| --- | --- | --- | --- |');
  for (const d of daily) out.push(`| ${d.date} | ${d.count} | ${n1(d.avgChanged)} | ${pct(d.avgRate)} |`);
  if (!daily.length) out.push('| （无） | | | |');
  out.push('');
  out.push('## 认不出源稿的稿子（不猜，人工指认）');
  out.push('');
  if (!unrecognized.length) {
    out.push('（没有）');
  } else {
    out.push('| 日期 | 文件 | 原因 |');
    out.push('| --- | --- | --- |');
    for (const u of unrecognized) out.push(`| ${u.dateStr} | ${cell(u.name)} | ${cell(u.reason)} |`);
  }
  out.push('');
  return out.join('\n');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const a = parseArgs(process.argv.slice(2), { flags: ['help'] });
  if (a.help) { process.stdout.write(USAGE); process.exit(0); }
  const nasDir = a.nas || DEFAULT_NAS_DIR;
  const n = a.n ? Number(a.n) : DEFAULT_N;
  const min = a.min ? Number(a.min) : DEFAULT_MIN;
  const threshold = a.threshold ? Number(a.threshold) : DEFAULT_THRESHOLD;
  if (!Number.isInteger(n) || n < 3) die('--n 要是 ≥3 的整数');
  if (!(min > 0 && min <= 1)) die('--min 要在 0 到 1 之间');
  if (!(threshold > 0 && threshold < 1)) die('--threshold 要在 0 到 1 之间');
  if (a.since && !/^\d{4}-\d{2}-\d{2}$/.test(a.since)) die('--since 要是 YYYY-MM-DD');
  if (!fs.existsSync(nasDir)) die(`已审目录读不到：${nasDir}`);

  let registry;
  try { registry = loadRegistry(a.registry || DEFAULT_REGISTRY); } catch (e) { die(e.message); }

  let names;
  try { names = listFiles(nasDir); } catch (e) { die(`列目录失败：${e.message}`); }

  const files = [];
  for (const name of names) {
    const abs = path.join(nasDir, name);
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (!st.isFile()) continue;
    const ds = dateStr(st.mtime);
    if (a.since && ds < a.since) continue;
    let text;
    try { text = readText(abs); } catch (e) { process.stderr.write(`[edit-stats] 跳过读不到的文件：${name}（${e.message}）\n`); continue; }
    files.push({ name, mtimeDate: st.mtime, text });
  }

  const { rows, unrecognized } = buildStats(files, registry, { n, min, threshold });
  const daily = dailySummary(rows);
  const md = renderMarkdown({ rows, unrecognized, daily, since: a.since || '', nasDir });

  if (a.out) {
    const outAbs = resolvePath(a.out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, md, 'utf8');
    process.stdout.write(`[edit-stats] 已扫 ${files.length} 篇（认出 ${rows.length}，认不出 ${unrecognized.length}），写入：${outAbs}\n`);
  } else {
    process.stdout.write(md + '\n');
  }
}
