#!/usr/bin/env node
// capture-summary.mjs —— 闲鱼实采 capture.json 一屏摘要
//
// 用法：node engine/brief/capture-summary.mjs <capture.json> [--top 30]
//
// 建事实卡的人不用读整个 capture.json：打印 query、采集时间、结果条数、价格分布（按整数价分档）、
// 想要数前十、Top 详情（价格区间 / 想要 / 浏览 / 店龄 / 店铺累计卖出 / 好评率 / 在售数）。
// 字段含义按 capture.json 自己的 notes_field_semantics 打印，脚本不另编解释。
// 输出控制在 60 行以内。只读，不写任何文件。

import fs from 'node:fs';
import path from 'node:path';

const MAX_LINES = 60;

function die(msg) {
  process.stderr.write(`\n[capture-summary] 错误：${msg}\n\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const a = { top: 30 };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') { a.help = true; continue; }
    if (t === '--top') {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v <= 0) die(`--top 要是正整数，现在是：${argv[i]}`);
      a.top = v;
      continue;
    }
    if (t.startsWith('--')) die(`不认识的参数：${t}`);
    if (a.file) die(`只收一个文件，多给了：${t}`);
    a.file = t;
  }
  return a;
}

const USAGE = `用法：node engine/brief/capture-summary.mjs <capture.json> [--top 30]
  --top N   只看列表前 N 条（按 rank），默认 30。价格分布和"想要数前十"都在这 N 条里算。
`;

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.file) { process.stdout.write(USAGE); process.exit(args.help ? 0 : 1); }

const abs = path.resolve(args.file);
if (!fs.existsSync(abs)) die(`文件不存在：${abs}`);
let d;
try { d = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { die(`不是合法 JSON：${abs}（${e.message}）`); }

// ── 取值工具（不同 schema 版本字段位置不一样，缺了打 —，不臆造）──
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const show = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return [...t].slice(0, n).join('');
};
const fmtNum = (v) => (num(v) === null ? '—' : String(v));

const products = Array.isArray(d.products) ? d.products : [];
const details = Array.isArray(d.detail_evidence) ? d.detail_evidence : [];
const shots = Array.isArray(d.screenshots) ? d.screenshots : [];
const sem = d.notes_field_semantics && typeof d.notes_field_semantics === 'object' ? d.notes_field_semantics : {};

// 列表前 N 条（按 rank 排，没有 rank 的按原顺序）
const listed = products
  .map((p, i) => ({ ...p, _i: i }))
  .sort((a, b) => (num(a.rank) ?? a._i + 1) - (num(b.rank) ?? b._i + 1))
  .slice(0, args.top);

const lines = [];

// ── 抬头 ──
lines.push(`capture.json 摘要 · ${path.relative(process.cwd(), abs) || abs}`);
const qParts = [`query：${show(d.query ?? d.query_original)}`];
if (d.query_used && d.query_used !== (d.query_original ?? d.query)) qParts.push(`实际用词：${d.query_used}`);
if (Array.isArray(d.query_fallback_tried) && d.query_fallback_tried.length) qParts.push(`兜底试过：${d.query_fallback_tried.length} 个`);
qParts.push(`captured_at：${show(d.captured_at)}`);
qParts.push(`status：${show(d.status)}`);
lines.push(qParts.join('　'));
lines.push(`结果条数：列表 ${products.length} 条（看前 ${listed.length}）· 详情 ${details.length} 条 · 截图 ${shots.length} 张${d.capture_scope ? `　范围：${clip(d.capture_scope, 60)}` : ''}`);
if (d.source_url) lines.push(`来源：${d.source_url}`);

// ── 价格分布（按整数价分档）──
const buckets = new Map();
let noPrice = 0;
for (const p of listed) {
  const v = num(p.price);
  if (v === null) { noPrice++; continue; }
  const k = Math.floor(v);
  buckets.set(k, (buckets.get(k) || 0) + 1);
}
const bucketStr = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([k, c]) => `¥${k} ×${c}`).join(' · ');
lines.push('');
lines.push(`价格分布（列表前 ${listed.length} 条，按整数价，元）：${bucketStr || '（没有价格字段）'}${noPrice ? `　价缺 ×${noPrice}` : ''}`);
const priced = listed.map((p) => num(p.price)).filter((v) => v !== null).sort((a, b) => a - b);
if (priced.length) {
  const mid = priced[Math.floor(priced.length / 2)];
  lines.push(`　最低 ¥${priced[0]} · 中位 ¥${mid} · 最高 ¥${priced[priced.length - 1]}　想要数缺（null）：${listed.filter((p) => num(p.wants) === null).length} 条`);
}

// ── 想要数前十 ──
const byWants = listed
  .filter((p) => num(p.wants) !== null)
  .sort((a, b) => b.wants - a.wants || (num(a.rank) ?? 0) - (num(b.rank) ?? 0))
  .slice(0, 10);
lines.push('');
lines.push(`想要数前十（rank / 价 / 想要 / 标题前 30 字）：`);
if (!byWants.length) lines.push('　（列表里没有一条显示想要数）');
for (const p of byWants) {
  const title = p.title || p.raw_text || '';
  lines.push(`　#${show(p.rank)}　¥${show(num(p.price))}　想要 ${p.wants}　${clip(title, 30)}`);
}

// ── Top 详情 ──
lines.push('');
lines.push(`Top 详情（detail_evidence ${details.length} 条）：`);
if (!details.length) lines.push('　（没有详情页证据）');
for (const e of details) {
  const im = e.item_metrics || {};
  const sm = e.shop_metrics || {};
  const sp = (e.shop_page && e.shop_page.shop_metrics) || {};
  const price = im.price_range ? `¥${im.price_range}` : `¥${show(num(im.price ?? e.price))}`;
  const seller = sm.seller_name || sp.seller_name || '';
  lines.push(`　Top${show(e.rank)}　${clip(e.title || e.raw_text || '', 30)}${seller ? `　［${seller}］` : ''}`);
  lines.push(`　　价格 ${price} · 想要 ${fmtNum(im.wants ?? e.wants)} · 浏览 ${show(im.views ?? e.views ?? e.views_text)} · 店龄 ${show(sm.shop_age)} · 店铺累计卖出 ${fmtNum(sm.shop_sold_total ?? sm.shop_sold)} · 好评率 ${show(sm.shop_rating)} · 在售 ${fmtNum(sp.on_sale_count)}${e.shop_page && e.shop_page.skipped ? `　店铺页缺：${clip(e.shop_page.skipped, 20)}` : ''}`);
}

// ── 字段含义（照 capture.json 的 notes_field_semantics 原文）──
const wantKeys = ['wants', 'views', 'shop_sold', 'shop_rating', 'shop_age', 'wants_null', 'shop_page.shop_metrics.on_sale_count', 'shop_page.shop_metrics.sold_total'];
const semLines = wantKeys.filter((k) => sem[k]).map((k) => `　${k}：${clip(sem[k], 40)}`);
if (semLines.length) {
  lines.push('');
  lines.push('字段含义（capture.json 自带 notes_field_semantics）：');
  lines.push(...semLines);
}

// ── 一屏以内 ──
if (lines.length > MAX_LINES) {
  const keep = lines.slice(0, MAX_LINES - 1);
  keep.push(`　…（还有 ${lines.length - (MAX_LINES - 1)} 行没打，超一屏截掉）`);
  lines.length = 0;
  lines.push(...keep);
}
process.stdout.write(lines.join('\n') + '\n');
