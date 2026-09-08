#!/usr/bin/env node
// 新采集同行文章 · 入库分堆（kb-intake skill 第 ①② 步用）
// 读 D:\项目仓库\闲鱼知识库\cleaned\ 全目录 + docs/真人语料包/intake-ledger.json，列出未入库文件并按规则粗分。
//
// 用法：
//   node engine/corpus-pack/intake-triage.mjs                       列未入库文件 + 粗分（不写文件）
//   node engine/corpus-pack/intake-triage.mjs --since 2026-09-10    只看该日期之后改动的文件（也可 --since last = 台账「更新」日期）
//   node engine/corpus-pack/intake-triage.mjs --write-ledger        把粗分结果写进台账 pending 区（同名文件覆盖）
//   node engine/corpus-pack/intake-triage.mjs --finalize --part part-inbox-2026-09-10
//                                                                    执行者改完 pending 里的 pile/author/reason 后，把 pending 全部转正到 entries
//                                                                    （pile=可用 → 已入库 + part；其余 → 已丢弃）。pile 还带「?」的拒绝转正
//   node engine/corpus-pack/intake-triage.mjs --spotcheck docs/真人语料包/part-inbox-2026-09-10.md [--n 10]
//                                                                    从该分表说法层 + 原声层随机抽 n 条原句回原文核对（第 ⑤ 步）
//   --all        忽略台账，全部文件都跑一遍粗分（校准规则用）
//   --json       机器格式输出
//   --cleaned <dir> / --ledger <file>   改路径
//
// 粗分规则（按顺序命中即停）：
//   内部        source=local_archive；或文件名/标题像模板、导出、日报、朋友圈复盘、运营方案、纯日期
//   重复        文件名带 v2/_full/index；标题或 source_ref 或正文哈希跟台账 / 本批别的文件撞；正文不足 150 字
//   招生晒收入?  标题 + 开头 300 字里招生/晒收入词打分 ≥3，或正文不足 300 字 —— 只是「疑似」，执行者逐篇读开头 200 字定夺
//   可用        其余
// 作者猜测：正文开头「大家好我是 XX」/「我是 XX」→ 别名归一；没有就按公众号 __biz 查台账里同号的已知作者。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = (name) => args.includes(name);

const CLEANED = opt('--cleaned', 'D:/项目仓库/闲鱼知识库/cleaned');
const LEDGER_PATH = opt('--ledger', path.join(ROOT, 'docs', '真人语料包', 'intake-ledger.json'));
const PACK_DIR = path.join(ROOT, 'docs', '真人语料包');
const today = () => new Date().toISOString().slice(0, 10);

// ---------- 读文章 ----------
function readArticle(file) {
  const full = path.join(CLEANED, file);
  const t = fs.readFileSync(full, 'utf8');
  const h = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (h) for (const l of h[1].split(/\r?\n/)) { const k = l.match(/^(\w+):\s*"?(.*?)"?\s*$/); if (k) fm[k[1]] = k[2]; }
  const body = (t.split(/^## 清洗正文\s*$/m)[1] || t.replace(/^---[\s\S]*?---/, '')).trim();
  const title = (fm.title || file.replace(/-[0-9a-f]{12}-[0-9a-f]{10}\.md$/, '').replace(/\.md$/, '')).replace(/\\\\n/g, ' ');
  return {
    file, title, source: fm.source || '', source_ref: fm.source_ref || '',
    biz: ((fm.source_ref || '').match(/__biz=([^&]+)/) || [])[1] || '',
    han: (body.match(/[\u4e00-\u9fff]/g) || []).length,
    body, bodyHash: crypto.createHash('sha1').update(body.replace(/\s+/g, '')).digest('hex').slice(0, 12),
    mtime: fs.statSync(full).mtime,
  };
}
const normTitle = (s) => (s || '').replace(/[\p{P}\p{S}\s]/gu, '').replace(/咸鱼/g, '闲鱼').toLowerCase();

// ---------- 作者猜测 ----------
const ALIAS = { 'KK': '猫KK', '猫kk': '猫KK', '郭耀天': '郭少', '百万Sir': '百万', '百万sir': '百万' };
const BAD_NAME = /^(不是|一个|个|从|在|做|怎么|谁|这|那|你|他|她|它|做了|一名|一位)/;
function guessAuthorFromBody(body) {
  const head = body.slice(0, 500);
  let m = head.match(/大家好[，,、\s]*我是([^，。,.!！?？\s、:：（(「"”]{1,8})/);
  if (!m) m = head.match(/(?:^|[。！？!?\n]\s*)我是([^，。,.!！?？\s、:：（(「"”]{2,5})(?=[，。,、\s]|$)/);
  if (!m) return '';
  let name = m[1].replace(/(老师|本人|啊|呀)$/, '');
  if (BAD_NAME.test(name)) return '';
  return ALIAS[name] || name;
}
function bizMap(ledger) {
  const m = new Map();
  for (const e of [...(ledger.entries || []), ...(ledger.pending || [])]) {
    const a = e.authorGuess || e.author;
    if (!e.biz || !a || a === '匿名' || a === '匿名甲') continue;
    if (!m.has(e.biz)) m.set(e.biz, new Map());
    m.get(e.biz).set(a, (m.get(e.biz).get(a) || 0) + 1);
  }
  const out = new Map();
  for (const [biz, cnt] of m) out.set(biz, [...cnt.entries()].sort((x, y) => y[1] - x[1])[0][0]);
  return out;
}

// ---------- 粗分 ----------
const INTERNAL_FILE = /^(_template|index|download_summary|rendered-|wechat-|xiaoyu-)/i;
const INTERNAL_TITLE = /模板|日报|朋友圈|运营方案|工作流|训练记录|学习记录|方法论|栏目系统|供给地图|收入分析|主题雷达|标题样本|去AI味|后台数据/;
const DUP_FILE = /(-v2\b|_v2\b|_full\b|\bindex\b)/i;
const RECRUIT_TITLE = ['闪光学员', '学员', '出单', '报喜', '陪跑', '拉新', '赚了', '赚到', '招募', '合伙', '课程', '收益', '日入', '月入', '年入', '实操营', '训练营', '名额', '报名', '培训', '福利', '案例', '爆单', '利润', '卖了', '干了', '学费', '跑路', '社群', '私教', '包赔', '过时不候', '最后', '免费加入', '战绩', '破万', '过万'];
const RECRUIT_BODY = ['学员', '陪跑', '报名', '名额', '合伙人', '课程', '训练营', '学费', '群里', '晒单', '报喜', '私教', '社群', '收益', '拉新', '交付', '包赔', '加入', '伙伴', '战绩', '截图', '案例'];
const MONEY_NUM = /\d+\s*(多|个)?\s*(万|w|W|k|K|块|元|单|\+)/;
const MONEY_NUM_G = /\d+\s*(多|个)?\s*(万|w|W|k|K|块|元|单|\+)/g;
const HOOK_HEAD =/(关注|加我|私信|回复).{0,12}(送|领|拿|获取|免费|资料|项目)/; // 招生头（"关注我送你五个项目"），可用堆里要剥掉的
function coarse(a, ctx) {
  if (a.source === 'local_archive') return ['内部', 'source=local_archive'];
  if (INTERNAL_FILE.test(a.file)) return ['内部', '文件名像模板 / 导出 / 索引'];
  if (/^\d{4}-\d{2}-\d{2}$/.test(a.title.trim())) return ['内部', '标题是纯日期（日报 / 朋友圈复盘）'];
  if (INTERNAL_TITLE.test(a.title)) return ['内部', '标题像内部文件'];
  if (DUP_FILE.test(a.file.replace(/-[0-9a-f]{12}-[0-9a-f]{10}\.md$/, ''))) return ['重复', '文件名带 v2 / _full / index'];
  const nt = normTitle(a.title);
  if (nt && ctx.titles.has(nt) && ctx.titles.get(nt) !== a.file) return ['重复', `标题与 ${ctx.titles.get(nt)} 相同`];
  if (a.source_ref && ctx.refs.has(a.source_ref) && ctx.refs.get(a.source_ref) !== a.file) return ['重复', `source_ref 与 ${ctx.refs.get(a.source_ref)} 相同`];
  if (ctx.hashes.has(a.bodyHash) && ctx.hashes.get(a.bodyHash) !== a.file) return ['重复', `正文与 ${ctx.hashes.get(a.bodyHash)} 相同`];
  if (a.han < 80) return ['重复', `正文只有 ${a.han} 字，截断或空壳`];
  if (a.han < 150) return ['招生晒收入?', `正文只有 ${a.han} 字的短帖，多半是晒单 / 日记 —— 请读一眼定夺`];
  const head = a.body.slice(0, 300);
  const th = RECRUIT_TITLE.filter((w) => a.title.includes(w));
  const bh = RECRUIT_BODY.filter((w) => head.includes(w));
  const titleMoney = MONEY_NUM.test(a.title);                       // 标题里带钱数 / 单数（"卖了40多万""3天出单""月2万"）
  const headMoney = (head.match(MONEY_NUM_G) || []).length;          // 开头 300 字里的钱数 / 单数个数
  const score = th.length * 2 + bh.length + (titleMoney ? 2 : 0) + (headMoney >= 2 ? 1 : 0) + (a.han < 300 ? 2 : 0) + (/^\d+[，,]/.test(a.body) ? 1 : 0);
  if (score >= 3) return ['招生晒收入?', `打分 ${score}（标题：${[...th, titleMoney ? '钱数' : ''].filter(Boolean).join('、') || '无'}；开头：${[...bh, headMoney >= 2 ? `钱数×${headMoney}` : ''].filter(Boolean).join('、') || '无'}${a.han < 300 ? '；短帖' : ''}）—— 请读开头 200 字定夺`];
  const notes = [];
  if (HOOK_HEAD.test(head)) notes.push('开头有招生头，抽时剥掉');
  if (HOOK_HEAD.test(a.body.slice(-300))) notes.push('结尾有招生尾，抽时剥掉');
  return ['可用', notes.join('；') || ''];
}

// ---------- 台账 ----------
function loadLedger() {
  if (!fs.existsSync(LEDGER_PATH)) return { 说明: [], 更新: '', 分表: [], entries: [], pending: [] };
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}
function saveLedger(l) { fs.writeFileSync(LEDGER_PATH, JSON.stringify(l, null, 1), 'utf8'); }

// ---------- --finalize ----------
if (flag('--finalize')) {
  const part = opt('--part', null);
  const ledger = loadLedger();
  if (!ledger.pending.length) { console.log('pending 为空，没有可转正的。'); process.exit(0); }
  const bad = ledger.pending.filter((p) => !['内部', '重复', '招生晒收入', '可用'].includes(p.pile));
  if (bad.length) { console.error(`有 ${bad.length} 条 pile 还没定（带「?」或不在四个值里），先改 pending 再来：\n` + bad.map((b) => `  ${b.pile}\t${b.file}`).join('\n')); process.exit(1); }
  if (ledger.pending.some((p) => p.pile === '可用') && !part) { console.error('pending 里有「可用」的，必须给 --part <分表名，如 part-inbox-2026-09-10>'); process.exit(1); }
  const d = today();
  const moved = { 已入库: 0, 已丢弃: 0 };
  for (const p of ledger.pending) {
    const e = { file: p.file, title: p.title, author: p.author || '', biz: p.biz || '', source: p.source || '', han: p.han, date: d, pile: p.pile };
    if (p.authorGuess) e.authorGuess = p.authorGuess;
    if (p.pile === '可用') { e.status = '已入库'; e.part = part; if (p.note) e.note = p.note; moved.已入库++; }
    else { e.status = '已丢弃'; e.reason = p.reason || ''; moved.已丢弃++; }
    ledger.entries.push(e);
  }
  ledger.pending = [];
  ledger.更新 = d;
  if (part && !ledger.分表.includes(part)) ledger.分表.push(part);
  saveLedger(ledger);
  console.log(`已转正：入库 ${moved.已入库} 篇（${part || '-'}），丢弃 ${moved.已丢弃} 篇；台账更新为 ${d}，entries 共 ${ledger.entries.length}。`);
  process.exit(0);
}

// ---------- --spotcheck ----------
if (flag('--spotcheck')) {
  const partFile = opt('--spotcheck', null);
  const n = Number(opt('--n', 10));
  if (!partFile) { console.error('--spotcheck 后面要跟分表路径'); process.exit(1); }
  const text = fs.readFileSync(path.resolve(ROOT, partFile), 'utf8');
  const lines = text.split(/\r?\n/);
  const splitRow = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
  // 附录 简称 → 文件
  const alias = new Map();
  let layer = null, header = null;
  const rows = [];
  for (const line of lines) {
    if (/^## /.test(line)) { layer = /说法层/.test(line) ? 'say' : /原声层/.test(line) ? 'voice' : /附录|简称/.test(line) ? 'alias' : null; header = null; continue; }
    if (/^### /.test(line)) { header = null; continue; }
    if (!line.startsWith('|')) { header = null; continue; }
    const cells = splitRow(line);
    if (!header) { header = cells; continue; }
    if (/^:?-+:?$/.test(cells[0])) continue;
    const row = {}; header.forEach((h, k) => { row[h] = cells[k]; });
    if (layer === 'alias') { const f = row['文件'] || Object.values(row).find((v) => /\.md$/.test(v || '')); const s = row['简称'] || cells[0]; if (f && s) alias.set(s.replace(/[《》]/g, ''), f.replace(/`/g, '')); }
    else if ((layer === 'say' || layer === 'voice') && row['原句']) rows.push({ layer, id: row['编号'], 原句: row['原句'], ref: row['文章'] || row['出处'] || '' });
  }
  if (!rows.length) { console.error('分表里没读到说法层 / 原声层的行'); process.exit(1); }
  const files = fs.readdirSync(CLEANED).filter((f) => f.endsWith('.md'));
  const norm = (s) => (s || '').replace(/[\p{P}\p{S}\s]/gu, '');
  const cache = new Map();
  const bodyOf = (f) => { if (!cache.has(f)) cache.set(f, norm(readArticle(f).body)); return cache.get(f); };
  function locate(ref) {
    const m = ref.match(/《([^》]+)》/); const short = m ? m[1] : ref.replace(/^[^《]*/, '');
    if (alias.has(short)) return [alias.get(short)];
    const key = normTitle(short).slice(0, 12);
    return files.filter((f) => normTitle(f).includes(key)).slice(0, 5);
  }
  const pick = [...rows].sort(() => Math.random() - 0.5).slice(0, n);
  let ok = 0;
  for (const r of pick) {
    const cands = locate(r.ref);
    const needle = norm(r.原句);
    const hit = cands.find((f) => bodyOf(f).includes(needle));
    // 原句可能是拼接的两三句或作者加了引号，退一步查最长的连续 12 字
    let partial = null;
    if (!hit && needle.length >= 12) { for (const f of cands) { for (let i = 0; i + 12 <= needle.length; i += 6) { if (bodyOf(f).includes(needle.slice(i, i + 12))) { partial = f; break; } } if (partial) break; } }
    const status = hit ? '✅ 整句在原文' : partial ? '△ 只对上片段（可能拼句 / 改字），人工看' : cands.length ? '✗ 原文里找不到' : '? 定位不到原文（附录没写文件名）';
    if (hit) ok++;
    console.log(`${status}\t${r.id}\t${r.ref}\t${cands[0] ? cands[0].slice(0, 40) : '-'}\n\t${r.原句.slice(0, 80)}`);
  }
  console.log(`\n抽查 ${pick.length} 条：整句命中 ${ok}，需人工看 ${pick.length - ok}。`);
  process.exit(ok === pick.length ? 0 : 2);
}

// ---------- 主流程：列未入库 + 粗分 ----------
const ledger = loadLedger();
const known = new Set(ledger.entries.map((e) => e.file));
const pendingByFile = new Map(ledger.pending.map((p) => [p.file, p]));
let since = opt('--since', null);
if (since === 'last') since = ledger.更新 || null;
const sinceTs = since ? new Date(since).getTime() : null;
if (since && Number.isNaN(sinceTs)) { console.error('--since 要给 YYYY-MM-DD 或 last'); process.exit(1); }

const all = fs.readdirSync(CLEANED).filter((f) => f.endsWith('.md'));
const articles = all.map(readArticle);
const ctx = { titles: new Map(), refs: new Map(), hashes: new Map() };
for (const e of ledger.entries) { const nt = normTitle(e.title); if (nt && !ctx.titles.has(nt)) ctx.titles.set(nt, e.file); }
for (const a of articles) {
  const nt = normTitle(a.title);
  if (nt && !ctx.titles.has(nt)) ctx.titles.set(nt, a.file);
  if (a.source_ref && !ctx.refs.has(a.source_ref)) ctx.refs.set(a.source_ref, a.file);
  if (!ctx.hashes.has(a.bodyHash)) ctx.hashes.set(a.bodyHash, a.file);
}
const bizAuthor = bizMap(ledger);

let targets = flag('--all') ? articles : articles.filter((a) => !known.has(a.file));
if (sinceTs) targets = targets.filter((a) => a.mtime.getTime() >= sinceTs);

const result = targets.map((a) => {
  const [pile, reason] = coarse(a, ctx);
  let author = guessAuthorFromBody(a.body);
  let authorHow = author ? '正文自报' : '';
  if (!author && a.biz && bizAuthor.has(a.biz)) { author = bizAuthor.get(a.biz); authorHow = '同公众号'; }
  const r = { file: a.file, title: a.title.slice(0, 80), author, authorHow, biz: a.biz, source: a.source, han: a.han, pile, reason, mtime: a.mtime.toISOString().slice(0, 10) };
  if (pendingByFile.has(a.file)) r.alreadyPending = pendingByFile.get(a.file).pile;
  return r;
});

const ORDER = ['可用', '招生晒收入?', '重复', '内部'];
result.sort((x, y) => ORDER.indexOf(x.pile) - ORDER.indexOf(y.pile) || (x.author || '～').localeCompare(y.author || '～', 'zh-Hans-CN') || x.file.localeCompare(y.file));

if (flag('--json')) {
  console.log(JSON.stringify({ cleaned: all.length, known: known.size, pending: ledger.pending.length, listed: result.length, byPile: Object.fromEntries(ORDER.map((p) => [p, result.filter((r) => r.pile === p).length])), items: result }, null, 1));
} else {
  console.log(`cleaned/ 共 ${all.length} 个 .md；台账 entries ${known.size} 篇（更新 ${ledger.更新 || '-'}），pending ${ledger.pending.length} 篇${since ? `；--since ${since}` : ''}${flag('--all') ? '；--all 忽略台账' : ''}`);
  console.log(`未入库 ${result.length} 篇` + (result.length ? '：' + ORDER.map((p) => `${p} ${result.filter((r) => r.pile === p).length}`).join(' · ') : '。'));
  for (const p of ORDER) {
    const rows = result.filter((r) => r.pile === p);
    if (!rows.length) continue;
    console.log(`\n== ${p}（${rows.length}）==`);
    for (const r of rows) console.log(`${(r.author || '(作者?)').padEnd(6)}\t${String(r.han).padStart(5)} 字\t${r.title.slice(0, 44)}\n\t${r.file}${r.reason ? `\n\t↳ ${r.reason}` : ''}${r.authorHow === '同公众号' ? '\n\t↳ 作者按公众号 ID 猜的，正文没自报' : ''}${r.alreadyPending ? `\n\t↳ 已在 pending（${r.alreadyPending}）` : ''}`);
  }
}

if (flag('--write-ledger')) {
  const d = today();
  for (const r of result) {
    const p = { file: r.file, title: r.title, author: r.author, authorHow: r.authorHow, biz: r.biz, source: r.source, han: r.han, pile: r.pile, reason: r.reason, triagedAt: d };
    pendingByFile.set(r.file, p);
  }
  ledger.pending = [...pendingByFile.values()];
  saveLedger(ledger);
  console.log(`\n已写入 pending ${result.length} 条（pending 共 ${ledger.pending.length}）→ ${path.relative(ROOT, LEDGER_PATH)}。执行者把「招生晒收入?」逐篇定成 招生晒收入 / 可用，改好 author，写一句 reason，再 --finalize。`);
}
