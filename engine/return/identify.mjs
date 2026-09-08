#!/usr/bin/env node
// identify.mjs —— 认稿：员工改回来的稿，和稿件登记表里每一篇比八字汉字窗口，重合最高的就是源稿
//
// 用法：
//   node engine/return/identify.mjs <回稿文件> [--registry docs/稿件登记.json] [--n 8] [--min 0.3] [--json]
//
// 算法：两边都只留汉字（复用 check-repeat 的 normalizeLine，顺便剔掉「我是圣矾 / 做闲鱼找圣矾」这类
//       每篇都有的合同句），一行一句切 n 字窗口；重合率 = 回稿的窗口里能在源稿窗口集合里找到的比例。
// 判定：最高分 ≥ --min（默认 0.3）才算认出；否则报「认不出，请用户指认」。
// 输出：前三名（id、选题、版本、重合率）+ 判定 + 源稿的全部登记信息（供后续步骤用）。--json 时只打 JSON。
// 退出码：0 认出；2 认不出，或参数/文件出错。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLine, loadTemplates } from '../brief/check-repeat.mjs';
import { resolvePath, readText, parseArgs, loadRegistry, DEFAULT_REGISTRY } from './lib.mjs';

export const DEFAULT_N = 8;
export const DEFAULT_MIN = 0.3;

const USAGE = `
用法：
  node engine/return/identify.mjs <回稿文件> [--registry ${DEFAULT_REGISTRY}] [--n ${DEFAULT_N}] [--min ${DEFAULT_MIN}] [--json]

  --registry  稿件登记表
  --n         汉字窗口长度，默认 ${DEFAULT_N}
  --min       认出的最低重合率，默认 ${DEFAULT_MIN}
  --json      只打 JSON（给脚本用）

退出码：0 认出；2 认不出，或参数/文件出错。
`;

function die(msg) {
  process.stderr.write(`\n[identify] 错误：${msg}\n\n`);
  process.exit(2);
}

/** 文本 → 窗口集合（每行独立，窗口不跨行） */
export function gramSet(text, n, tp) {
  const set = new Set();
  let total = 0;
  const grams = [];
  for (const line of String(text).split('\n')) {
    const s = normalizeLine(line, tp);
    for (let i = 0; i + n <= s.length; i++) {
      const g = s.slice(i, i + n);
      if (g.includes('|')) continue;
      grams.push(g);
      set.add(g);
      total++;
    }
  }
  return { set, grams, total };
}

/** 回稿的窗口有多少比例落在源稿里 */
export function overlapRatio(returnedGrams, sourceSet) {
  if (!returnedGrams.grams.length) return 0;
  let hit = 0;
  for (const g of returnedGrams.grams) if (sourceSet.has(g)) hit++;
  return hit / returnedGrams.grams.length;
}

/**
 * 认稿主函数。entries 是登记表数组；返回 { ranking:[{entry, ratio, missing}], best, recognized, n, min }。
 * 稿件路径不存在的条目记 missing=true、ratio=0，不抛。
 */
export function identify(returnedText, entries, { n = DEFAULT_N, min = DEFAULT_MIN } = {}) {
  let tp = { templates: [], phrases: [] };
  try { const t = loadTemplates(undefined, n); tp = { templates: t.templates, phrases: [] }; } catch { /* 说明书读不到就只剔内置 */ }
  const rg = gramSet(returnedText, n, tp);
  const ranking = [];
  for (const entry of entries) {
    const abs = entry.稿件路径 ? resolvePath(entry.稿件路径) : '';
    if (!abs || !fs.existsSync(abs)) { ranking.push({ entry, ratio: 0, missing: true }); continue; }
    const src = readText(abs);
    const sg = gramSet(src, n, tp);
    ranking.push({ entry, ratio: overlapRatio(rg, sg.set), missing: false });
  }
  ranking.sort((a, b) => b.ratio - a.ratio);
  const best = ranking[0] || null;
  const recognized = !!best && !best.missing && best.ratio >= min && rg.grams.length > 0;
  return { ranking, best, recognized, n, min, returnedWindows: rg.grams.length };
}

export function formatIdentify(r, { fileAbs = '' } = {}) {
  const out = [];
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  if (fileAbs) out.push(`[identify] 回稿：${fileAbs}`);
  out.push(`[identify] 登记表 ${r.ranking.length} 篇，窗口 ${r.n} 字，回稿窗口 ${r.returnedWindows} 个，认出门槛 ${pct(r.min)}`);
  out.push('');
  out.push('── 重合率前三 ──');
  r.ranking.slice(0, 3).forEach((x, i) => {
    out.push(`${i + 1}. ${x.entry.id}　${x.entry.选题}　${x.entry.版本}　${x.missing ? '（源稿文件不存在）' : pct(x.ratio)}`);
  });
  out.push('');
  if (r.recognized) {
    const e = r.best.entry;
    out.push(`判定：认出，是 ${e.id}（${e.选题} ${e.版本}，重合 ${pct(r.best.ratio)}）`);
    out.push('');
    out.push('── 源稿登记信息 ──');
    for (const [k, v] of Object.entries(e)) out.push(`${k}：${v ?? ''}`);
  } else {
    const reason = !r.returnedWindows ? '回稿里没有够长的汉字句子' : r.best && r.best.missing ? '登记表里的源稿文件读不到' : `最高只有 ${r.best ? pct(r.best.ratio) : '0%'}，低于门槛`;
    out.push(`判定：认不出，请用户指认（${reason}）`);
  }
  return out.join('\n');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const a = parseArgs(process.argv.slice(2), { flags: ['json', 'help'] });
  if (a.help) { process.stdout.write(USAGE); process.exit(0); }
  if (a.positional.length !== 1) die(`要给一个回稿文件${USAGE}`);
  const n = a.n ? Number(a.n) : DEFAULT_N;
  const min = a.min ? Number(a.min) : DEFAULT_MIN;
  if (!Number.isInteger(n) || n < 3) die('--n 要是 ≥3 的整数');
  if (!(min > 0 && min <= 1)) die('--min 要在 0 到 1 之间');
  const fileAbs = resolvePath(a.positional[0]);
  let text, entries;
  try { text = readText(fileAbs); entries = loadRegistry(a.registry || DEFAULT_REGISTRY); } catch (e) { die(e.message); }
  if (!entries.length) die('登记表是空的，先用 registry.mjs add 登记');
  const r = identify(text, entries, { n, min });
  if (a.json) {
    process.stdout.write(JSON.stringify({
      recognized: r.recognized,
      best: r.recognized ? r.best.entry : null,
      ratio: r.best ? r.best.ratio : 0,
      top3: r.ranking.slice(0, 3).map((x) => ({ id: x.entry.id, 选题: x.entry.选题, 版本: x.entry.版本, ratio: x.ratio, missing: x.missing })),
    }, null, 2) + '\n');
  } else {
    process.stdout.write(formatIdentify(r, { fileAbs }) + '\n');
  }
  process.exit(r.recognized ? 0 : 2);
}
