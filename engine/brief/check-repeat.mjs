#!/usr/bin/env node
// check-repeat.mjs —— 跨期重复检查：一篇新稿对着已定稿，查三样
//
// 用法：
//   node engine/brief/check-repeat.mjs <稿件> --against <已定稿文件或目录...> [--n 8] [--style docs/人设说明书-钱十七.md]
//
// 查三样：
//   1. 与已定稿的连续重合（默认 8 个汉字；先剔掉合同句、固定收尾句、资料钩子模板、催点赞句——模板句从说明书
//      第三、十四节的反引号句和引号句里取；再剔掉说明书第七节里长度 ≥ 窗口的可照抄短语。标点不算字，一行一句比）。
//   2. 本方自造的名字：「收券三看 / 详情页三件套 / 代约四步 / 两个口子 / 三类人」这类「（名）+ 数字 + 量词」的命名，
//      和已定稿里出现过的比，重了就报（用户 2026-09-03 原话：「我发现基本上你每一期都在用这种内容来点这3类人」）。
//   3. 口头禅和收口句：说明书第七节那些短语允许跨期照抄，短于窗口的短语本身触发不了第 1 条；
//      「妥妥的够你忙一阵」「做闲鱼的都知道……」这类整句（≥8 字）与已定稿重合按第 1 条报。
//
// 输出每处：行号、重合内容、撞了哪一篇。有「退回」级命中退出 1；只有提示退出 0；参数错退出 2。
// 起因：用户 2026-09-06「我并不希望里面有很多重复的，你有素材，有事实逻辑，应该能够完全写一篇新的」；
//       2026-09-05「还是差不多啊，要完全不一样才行」。
//
// 也是模块：check-all.mjs import 这里的 checkRepeat / collectAgainst / loadTemplates。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePath } from './word-table.mjs';

export const DEFAULT_STYLE = 'docs/人设说明书-钱十七.md';
export const DEFAULT_N = 8;

// 说明书读不到时的兜底模板（与第三、十四节一致）。
const BUILTIN_TEMPLATES = [
  '我是圣矾', '做闲鱼找圣矾', '做闲鱼，找圣矾',
  '这期就到这儿，做闲鱼找圣矾，我们下个视频见',
  // 用户 2026-09-08 裁定 A、C（员工改稿 P-v2）：口号改「学闲鱼」，收尾句 / 催赞句带「视频」；旧句保留
  '学闲鱼找圣矾', '学闲鱼，找圣矾',
  '这期视频就到这儿，学闲鱼找圣矾，我们下个视频见', '这期视频干货非常多',
  '最后圣矾给大家整理了一份', '这些资料圣矾无条件分享给大家', '有需要的同学在评论区扣个', '圣矾看见就发给你',
  '视频比较干货', '建议先点赞后观看', '以免后面找不到了',
];
// 说明书第四节写死的贴士句式，也是可照抄的。
export const BUILTIN_PHRASES = ['这里特别强调一点', '这里有个重点要注意', '这里给大家一个小建议', '这里给大家总结了',
  // 用户 2026-09-08 定的标尺句和人话换法，跨期照用不算撞
  '开单之后如果你的执行力不到位，那么你的退款率会很高', '不是到你手里的利润', '这部分不需要你负责',
  // 说明书第三节催赞句与第四节进度回收句式，属可照抄
  '这期干货非常多', '这期视频干货非常多，建议先点赞收藏', '视频比较干货，建议先点赞后观看，以免后面找不到了', '到了这一步',
  // 报数的固定说法
  '好评率百分之九十九', '好评率百分之九十', '全店累计卖出', '店铺累计卖出', '排最前面那条链接', '排最前面那家', '排在最前面那',
  // 说明书第十四节的合规提醒句、块名与用户标尺句的变体
  '上架前自己去搜一下平台规则', '上架前你自己去搜一下平台规则', '那么你的退款就会很多', '那么退款就会很多', '卖出去以后', '开单之后如果你的',
  // 说明书第十四节交底段的两句固定说法（合规提醒 + 流水免责），四篇并行时必然同句
  '算不算违规', '上架之前自己去搜一下平台规则', '上架之前你自己去搜一下平台规则', '上架之前你自己去搜一下闲鱼的规则', '推算出来的流水', '折算出来的流水', '推算的流水', '没扣成本'];
// 校准词表「换」一列里 ≥8 个汉字的说法也是用户定的，跨期照用不算撞
function wordTablePhrases(n) {
  try {
    const t = JSON.parse(fs.readFileSync(resolvePath('docs/用户校准词表.json'), 'utf8'));
    const out = [];
    for (const e of t) for (const f of String(e.换 || '').split(/[^一-鿿]+/)) if (f.length >= n) out.push(f);
    return out;
  } catch { return []; }
}

const CJK_RE = /[一-鿿]/;
const NUM = '[二三四五六七八九十两]';   // 「一」不算：到这一步 / 一件事 是普通话，不是名字

// 自造命名：稀有量词裸用就是名字（三看 / 三件套 / 两个口子 / 三类人）；常见量词要带前缀才算名字（收券三看 / 代约四步）。
const RARE_CLS = ['看', '件套', '板斧', '类人', '个口子', '字诀', '条来路', '句硬话', '不一只'];
const COMMON_CLS = ['步', '条路', '招', '个坑', '件事'];
const HINT_CLS = ['步', '条路', '招', '件事'];        // 裸骨架（没带名）只对这几个报提示
// 前缀里这些词不是名字的一部分（拆成三块、一共四步、就两条路）。
const PREFIX_STOP = ['不', '它', '大家', '圣矾', '我们', '咱们', '你们', '他们', '这个', '那个', '这些', '那些', '一共', '总结了', '归成', '拆成', '分成', '管它叫', '给大家', '做对了', '就是', '第', '这', '那', '有', '共', '成', '了', '是', '就', '把', '的', '一', '叫', '讲', '哪', '你', '我', '来', '前', '后', '里', '中', '每', '说', '走', '完', '另', '头', '再', '只', '到', '出', '好', '为', '什', '么', '着', '过', '和', '与', '跟', '用', '按', '照', '看', '还', '也', '都', '要', '在', '个', '几', '其', '实', '会', '能', '得', '可', '以', '整', '共'];

// ───────────────────────── 模板句 / 可照抄短语 ─────────────────────────

function sectionText(md, headingPrefix) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(headingPrefix));
  if (start < 0) return '';
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

function cjkFragments(s, minLen = 4) {
  return s.split(/[^一-鿿…]+/).map((x) => x.replace(/…/g, '')).filter((x) => x.length >= minLen);
}

/**
 * 从说明书取：合同句、收尾句、资料钩子模板、催点赞句（第三、十四节）→ templates；
 * 第七节 + 第四节贴士句式里长度 ≥ n 的可照抄短语 → phrases。读不到就用内置。
 */
export function loadTemplates(stylePath = DEFAULT_STYLE, n = DEFAULT_N) {
  const abs = resolvePath(stylePath);
  const templates = new Set(BUILTIN_TEMPLATES);
  // 内置短语是人挑的，不受窗口长度限制；词表换法按窗口长度过滤
  const phrases = new Set([...BUILTIN_PHRASES, ...wordTablePhrases(n).filter((p) => p.length >= n)]);
  let source = '内置';
  if (fs.existsSync(abs)) {
    const md = fs.readFileSync(abs, 'utf8');
    const s3 = sectionText(md, '## 三、');
    const s14 = sectionText(md, '## 十四、');
    const s7 = sectionText(md, '## 七、');
    for (const sec of [s3, s14]) {
      for (const m of sec.matchAll(/`([^`\n]+)`/g)) for (const f of cjkFragments(m[1], 2)) templates.add(f);
      for (const m of sec.matchAll(/[""「]([^""」\n]{6,})[""」]/g)) for (const f of cjkFragments(m[1], 4)) templates.add(f);
    }
    for (const f of cjkFragments(s7, 2)) if (f.length >= n) phrases.add(f);
    if (s3 || s14 || s7) source = abs;
  }
  return { templates: [...templates].sort((a, b) => b.length - a.length), phrases: [...phrases].sort((a, b) => b.length - a.length), source };
}

// ───────────────────────── 归一化 ─────────────────────────

const isBodyLine = (l) => l.trim() && !l.startsWith('#') && !l.startsWith('>') && l.trim() !== '---';

/** 一行 → 去模板、去可照抄短语、只留汉字；被剔的位置用 | 做隔断，窗口不跨过。 */
export function normalizeLine(line, { templates = [], phrases = [] } = {}) {
  let s = line;
  for (const t of templates) s = s.split(t).join('|');
  for (const p of phrases) s = s.split(p).join('|');
  return s.replace(/[^一-鿿|]/g, '').replace(/\|+/g, '|');
}

function grams(s, n) {
  const out = [];
  for (let i = 0; i + n <= s.length; i++) {
    const g = s.slice(i, i + n);
    if (!g.includes('|')) out.push({ g, i });
  }
  return out;
}

// ───────────────────────── 自造命名 ─────────────────────────

const STOPS_LONG_FIRST = [...PREFIX_STOP].sort((a, b) => b.length - a.length);

function stripLeading(p) {
  let changed = true;
  while (changed && p) {
    changed = false;
    for (const s of STOPS_LONG_FIRST) {
      if (p.startsWith(s)) { p = p.slice(s.length); changed = true; break; }
    }
  }
  return p;
}

/**
 * 从数字前面的几个字里取名字。名字必须紧贴数字（收券三看 / 代约四步）；
 * 数字前面是停用词（交付一共四步 / 拆成四步 / 就两条路）就不是名字，返回空串。
 */
function stripPrefix(prefix) {
  let p = stripLeading(prefix);
  if (!p) return '';
  if (STOPS_LONG_FIRST.some((s) => p.endsWith(s))) return '';
  if (p.length > 3) p = stripLeading(p.slice(-3));
  if (STOPS_LONG_FIRST.some((s) => p.endsWith(s))) return '';
  return p.length >= 2 ? p : '';
}

/** 抓一行里的命名。返回 [{ key, bare, text, level }]，level: 退回（带名）| 提示（裸骨架）。 */
export function findCoinages(line) {
  const out = [];
  const cls = [...RARE_CLS, ...COMMON_CLS].sort((a, b) => b.length - a.length).join('|');
  const re = new RegExp(`([\\u4e00-\\u9fff]{0,6}?)(${NUM})(${cls})`, 'g');
  let m;
  while ((m = re.exec(line)) !== null) {
    const [, rawPrefix, num, c] = m;
    const before = line[m.index - 1] || '';
    if ((rawPrefix === '' && before === '第') || /第$/.test(rawPrefix)) continue;   // 第三步 是序数，不是名字
    const bare = num + c;
    if (RARE_CLS.includes(c)) {
      out.push({ key: bare, bare, cls: c, prefix: stripPrefix(rawPrefix), text: line.slice(m.index, m.index + m[0].length), level: '退回' });
      continue;
    }
    const prefix = stripPrefix(rawPrefix);
    if (prefix.length >= 2) out.push({ key: prefix + bare, bare, cls: c, prefix, text: prefix + bare, level: '退回' });
    else if (HINT_CLS.includes(c)) out.push({ key: bare, bare, cls: c, prefix: '', text: bare, level: '提示' });
  }
  return out;
}

// ───────────────────────── 已定稿收集 ─────────────────────────

const READABLE = new Set(['.txt', '.md']);
const DIR_READABLE = new Set(['.txt']);   // 目录递归只读 .txt：.md 多半是报告和素材清单，不是稿

/**
 * 收集已定稿。paths 可以是文件、目录（递归只读 .txt）、或带 * 的模式（films/*\/copy/*\/script.txt）。
 * excludeAbs 里的绝对路径剔掉（别拿稿件自己当已定稿）。返回 { docs: [{ name, abs, lines }], missing: [] }。
 */
export function collectAgainst(paths, { excludeAbs = [] } = {}) {
  const docs = [];
  const missing = [];
  const ex = new Set(excludeAbs.map((p) => path.resolve(p)));
  const walk = (p, fromDir = false) => {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) { missing.push(p); return; }
    if (fs.statSync(abs).isDirectory()) {
      for (const f of fs.readdirSync(abs)) walk(path.join(abs, f), true);
      return;
    }
    if (!(fromDir ? DIR_READABLE : READABLE).has(path.extname(abs).toLowerCase())) return;
    if (ex.has(abs)) return;
    const raw = fs.readFileSync(abs, 'utf8').replace(/^﻿/, '');
    docs.push({ name: docName(abs), abs, lines: raw.replace(/\r\n/g, '\n').split('\n') });
  };
  for (const p of paths) {
    if (/[*?]/.test(p)) {
      const hits = expandGlob(resolvePath(p));
      if (!hits.length) missing.push(p);
      for (const h of hits) walk(h);
    } else walk(resolvePath(p));
  }
  return { docs, missing };
}

/** 只支持段内 * 和 ?（films/*\/copy/*\/script.txt），不支持 **。 */
export function expandGlob(pattern) {
  const segs = pattern.split(/[\\/]+/).filter(Boolean);
  const isWin = /^[A-Za-z]:$/.test(segs[0]);
  let cur = [isWin ? segs[0] + path.sep : path.sep];
  for (const seg of segs.slice(isWin ? 1 : 0)) {
    const next = [];
    if (/[*?]/.test(seg)) {
      const re = new RegExp('^' + seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      for (const base of cur) {
        if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) continue;
        for (const f of fs.readdirSync(base)) if (re.test(f)) next.push(path.join(base, f));
      }
    } else {
      for (const base of cur) next.push(path.join(base, seg));
    }
    cur = next;
  }
  return cur.filter((p) => fs.existsSync(p));
}

function docName(abs) {
  const parts = abs.split(/[\\/]/);
  const i = parts.indexOf('films');
  if (i >= 0 && parts.length > i + 3) return `${parts[i + 1]}/${parts[i + 3]}`;
  return path.basename(abs, path.extname(abs));
}

// ───────────────────────── 主检查 ─────────────────────────

/**
 * draftLines: 稿件行数组；docs: collectAgainst 的 docs；opts: { n, templates, phrases }。
 * 返回 { n, overlaps:[{line, text, len, files}], coinages:[{line, key, text, hits:[{file,line,text}]}],
 *        hints:[{line, key, text, hits}], returned: boolean, docs:[name...] }
 */
export function checkRepeat(draftLines, docs, opts = {}) {
  const n = opts.n || DEFAULT_N;
  const tp = { templates: opts.templates || [], phrases: opts.phrases || [] };

  // 已定稿：gram → Set(file)；命名 key → [{file,line,text}]
  const gramMap = new Map();
  const nameMap = new Map();
  const named = [];   // 已定稿里带名的命名（收券三看 / 代约四步），供「同一个名换了写法」的提示用
  for (const d of docs) {
    d.lines.forEach((l, i) => {
      if (!isBodyLine(l)) return;
      for (const { g } of grams(normalizeLine(l, tp), n)) {
        if (!gramMap.has(g)) gramMap.set(g, new Set());
        gramMap.get(g).add(d.name);
      }
      for (const c of findCoinages(l)) {
        const k = c.level === '退回' ? c.key : `~${c.bare}`;
        if (!nameMap.has(k)) nameMap.set(k, []);
        const list = nameMap.get(k);
        if (!list.some((x) => x.file === d.name && x.line === i + 1)) list.push({ file: d.name, line: i + 1, text: l.trim() });
        if (c.level === '退回' && c.prefix && !named.some((x) => x.key === c.key && x.file === d.name && x.line === i + 1)) named.push({ ...c, file: d.name, line: i + 1, lineText: l.trim() });
      }
    });
  }

  const overlaps = [];
  const coinages = [];
  const hints = [];
  const seenName = new Set();
  draftLines.forEach((l, i) => {
    if (!isBodyLine(l)) return;
    const norm = normalizeLine(l, tp);
    // 逐窗命中 → 合并相邻窗口成片段
    let cur = null;
    const flush = () => {
      if (!cur) return;
      overlaps.push({ line: i + 1, text: norm.slice(cur.start, cur.end), len: cur.end - cur.start, files: [...cur.files].sort() });
      cur = null;
    };
    for (const { g, i: pos } of grams(norm, n)) {
      const files = gramMap.get(g);
      if (!files) { flush(); continue; }
      if (cur && pos <= cur.end) { cur.end = pos + n; for (const f of files) cur.files.add(f); }
      else { flush(); cur = { start: pos, end: pos + n, files: new Set(files) }; }
    }
    flush();

    for (const c of findCoinages(l)) {
      const k = c.level === '退回' ? c.key : `~${c.bare}`;
      const tag = `${i + 1}:${k}`;
      if (seenName.has(tag)) continue;
      seenName.add(tag);
      const hit = nameMap.get(k);
      if (hit) {
        (c.level === '退回' ? coinages : hints).push({ line: i + 1, key: c.level === '退回' ? c.key : c.bare, text: c.text, hits: hit });
        continue;
      }
      // 没有一字不差的，再看有没有「同一个量词 + 名字沾一个字」的（约单三步 vs 代约四步）→ 提示
      if (c.level === '退回' && c.prefix) {
        const near = named.filter((nm) => nm.cls === c.cls && nm.key !== c.key && [...c.prefix].some((ch) => nm.prefix.includes(ch)));
        if (near.length) hints.push({ line: i + 1, key: c.key, text: `${c.text}（疑似同一个名换了写法）`, hits: near.map((nm) => ({ file: nm.file, line: nm.line, text: nm.lineText })) });
      }
    }
  });

  return { n, overlaps, coinages, hints, returned: overlaps.length > 0 || coinages.length > 0, docs: docs.map((d) => d.name) };
}

/** 渲染成人看的报告行。 */
export function formatRepeat(r, { fileAbs = '', templateInfo = '' } = {}) {
  const out = [];
  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
  if (fileAbs) out.push(`[check-repeat] 稿件：${fileAbs}`);
  out.push(`[check-repeat] 已定稿 ${r.docs.length} 篇：${r.docs.join('，') || '（无）'}　窗口 ${r.n} 字${templateInfo ? `　${templateInfo}` : ''}`);
  out.push('');
  if (r.overlaps.length) {
    out.push(`── 与已定稿连续重合（≥${r.n} 字，退回）──`);
    for (const o of r.overlaps) out.push(`第 ${pad(String(o.line), 3)} 行  「${o.text}」（${o.len} 字）　撞：${o.files.join('、')}`);
    out.push('');
  }
  if (r.coinages.length) {
    out.push('── 自造命名撞已定稿（退回）──');
    for (const c of r.coinages) {
      out.push(`第 ${pad(String(c.line), 3)} 行  「${c.key}」`);
      for (const h of c.hits) out.push(`         撞：${h.file} 第 ${h.line} 行「${h.text}」`);
    }
    out.push('');
  }
  if (r.hints.length) {
    out.push('── 提示：数字骨架同已定稿（裸「N 步 / N 条路」这类，不退回，自己看是不是同一个名）──');
    for (const c of r.hints) {
      out.push(`第 ${pad(String(c.line), 3)} 行  「${c.text}」`);
      for (const h of c.hits.slice(0, 3)) out.push(`         同：${h.file} 第 ${h.line} 行「${h.text}」`);
    }
    out.push('');
  }
  out.push(`连续重合 ${r.overlaps.length} 处，命名撞 ${r.coinages.length} 处，提示 ${r.hints.length} 处`);
  out.push(r.returned ? '结论：有退回级命中，打回改。' : '结论：没有退回级命中。');
  return out.join('\n');
}

// ───────────────────────── CLI ─────────────────────────

const USAGE = `
用法：
  node engine/brief/check-repeat.mjs <稿件> --against <已定稿文件或目录...> [--n 8] [--style ${DEFAULT_STYLE}]

  --against  已定稿文件 / 目录（递归只读 .txt）/ 带 * 的模式，可多个；稿件自己会自动剔掉。
  --n        连续重合窗口（汉字数），默认 ${DEFAULT_N}
  --style    说明书路径，从第三、十四节取模板句，第七节取可照抄短语

退出码：0 没退回级命中；1 有；2 参数或文件出错。
`;

function die(msg) {
  process.stderr.write(`\n[check-repeat] 错误：${msg}\n\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const a = { file: null, against: [], n: DEFAULT_N, style: DEFAULT_STYLE };
  let cur = null;
  for (const t of argv) {
    if (t === '--help' || t === '-h') { process.stdout.write(USAGE); process.exit(0); }
    if (t === '--against') { cur = 'against'; continue; }
    if (t === '--n' || t === '--style') { cur = t.slice(2); continue; }
    if (t.startsWith('--')) die(`不认识的参数：${t}${USAGE}`);
    if (cur === 'against') { a.against.push(t); continue; }
    if (cur === 'n') { a.n = Number(t); cur = null; if (!Number.isInteger(a.n) || a.n < 3) die('--n 要是 ≥3 的整数'); continue; }
    if (cur === 'style') { a.style = t; cur = null; continue; }
    if (a.file) die(`只能给一个稿件文件，多给了：${t}`);
    a.file = t;
  }
  if (!a.file) die(`缺稿件路径${USAGE}`);
  if (!a.against.length) die(`缺 --against${USAGE}`);
  return a;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  const fileAbs = resolvePath(args.file);
  if (!fs.existsSync(fileAbs)) die(`稿件不存在：${fileAbs}`);
  const draftLines = fs.readFileSync(fileAbs, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const { docs, missing } = collectAgainst(args.against, { excludeAbs: [fileAbs] });
  if (missing.length) die(`已定稿路径不存在：${missing.join(', ')}`);
  if (!docs.length) die('已定稿一篇都没读到');
  const { templates, phrases, source } = loadTemplates(args.style, args.n);
  const r = checkRepeat(draftLines, docs, { n: args.n, templates, phrases });
  process.stdout.write(formatRepeat(r, { fileAbs, templateInfo: `模板句 ${templates.length} 条、可照抄短语 ${phrases.length} 条已剔除（${source === '内置' ? '内置' : '取自说明书'}）` }) + '\n');
  process.exit(r.returned ? 1 : 0);
}
