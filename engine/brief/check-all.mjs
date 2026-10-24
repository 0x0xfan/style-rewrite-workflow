#!/usr/bin/env node
// check-all.mjs —— 交稿前一条命令：按 docs/写稿规则.json 逐条跑，输出一张表
//
// 用法：
//   node engine/brief/check-all.mjs <稿件> [--rules docs/写稿规则.json] [--topic 京东家政] [--topic-type 虚拟|实物] [--type 产品|经验]
//        [--chain <事实链.md>] [--against <已定稿文件/目录/带*模式...>] [--corpus docs/真人语料包/总表.md]
//        [--words docs/用户校准词表.json] [--style docs/人设说明书-钱十七.md] [--n 8]
//
// 每条规则按「查法」分发：
//   words      → check-words 的 scanDraft（词表只跑一遍；带「词表类型」参数的行认领同类型命中，剩下归 R034）
//   structure  → 本文件自带的位置 / 形状检查（参数.check 指定哪一条）
//   leakage    → engine/leakage/check-source-leakage.mjs 的 checkSourceLeakage，对真人语料总表 + 已定稿，十二字
//   repeat     → engine/brief/check-repeat.mjs 的 checkRepeat，对已定稿，八字 + 自造命名
//   compliance → engine/compliance/check-copy.mjs 的 checkCopy，按参数.组 认领 findings
//   manual     → 不跑，标「人工」，把该看的东西列出来（事实链 §四 清单、标尺句、命令）
//
// 退出码：0 没有退回级命中；1 有退回级命中，或退回级规则因缺输入没跑（如缺 --against）；2 参数或文件出错。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTable, resolvePath, DEFAULT_TABLE } from './word-table.mjs';
import { readLines, activeEntries, scanDraft, structuralChecks, snippet, sourceLabel } from './check-words.mjs';
import { collectAgainst, loadTemplates, checkRepeat, DEFAULT_STYLE, DEFAULT_N, BUILTIN_PHRASES } from './check-repeat.mjs';
import { loadRules, DEFAULT_RULES } from './render-rules.mjs';
import { checkSourceLeakage, readSourceFile } from '../leakage/check-source-leakage.mjs';
import { checkCopy } from '../compliance/check-copy.mjs';

const USAGE = `
用法：
  node engine/brief/check-all.mjs <稿件> [--rules ${DEFAULT_RULES}] [--topic 选题名] [--topic-type 虚拟|实物] [--type 产品|经验]
       [--chain <事实链.md>] [--against <已定稿...>] [--corpus docs/真人语料包/总表.md]
       [--words ${DEFAULT_TABLE}] [--style ${DEFAULT_STYLE}] [--n ${DEFAULT_N}]

  --rules       规则表，默认 ${DEFAULT_RULES}
  --topic       选题名，词表里「选题红线」按它生效
  --topic-type  虚拟 / 实物，词表里「实物专用」只在虚拟选题查
  --type        稿件类型 产品 / 经验（核心卡「稿件类型」一行），经验稿不查带「经验稿不查」参数的规则（R002），默认产品
  --chain       事实链，manual 行把 §四 不入稿清单列出来给主线程对
  --against     已定稿文件 / 目录（递归只读 .txt）/ 带 * 的模式，可多个；稿件自己自动剔掉
  --corpus      真人语料总表，默认取规则表 R040 参数里的路径
  --style       说明书，跨期检查从里面取模板句
  --n           跨期连续重合窗口，默认取规则表参数

退出码：0 没退回级命中；1 有退回级命中或退回级规则没跑；2 参数或文件出错。
`;

function die(msg) {
  process.stderr.write(`\n[check-all] 错误：${msg}\n\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const a = { file: null, rules: DEFAULT_RULES, topic: '', topicType: '', type: '', chain: '', against: [], corpus: '', words: DEFAULT_TABLE, style: DEFAULT_STYLE, n: 0 };
  let cur = null;
  for (const t of argv) {
    if (t === '--help' || t === '-h') { process.stdout.write(USAGE); process.exit(0); }
    if (t === '--against') { cur = 'against'; continue; }
    if (['--rules', '--topic', '--topic-type', '--type', '--chain', '--corpus', '--words', '--style', '--n'].includes(t)) { cur = t.slice(2); continue; }
    if (t.startsWith('--')) die(`不认识的参数：${t}${USAGE}`);
    if (cur === 'against') { a.against.push(t); continue; }
    if (cur) {
      const key = cur === 'topic-type' ? 'topicType' : cur;
      a[key] = cur === 'n' ? Number(t) : t;
      cur = null;
      continue;
    }
    if (a.file) die(`只能给一个稿件文件，多给了：${t}`);
    a.file = t;
  }
  if (!a.file) die(`缺稿件路径${USAGE}`);
  if (a.topicType && !['虚拟', '实物'].includes(a.topicType)) die(`--topic-type 只能是 虚拟 或 实物，现在是：${a.topicType}`);
  if (a.type && !['产品', '经验'].includes(a.type)) die(`--type 只能是 产品 或 经验，现在是：${a.type}`);
  if (a.n && (!Number.isInteger(a.n) || a.n < 3)) die('--n 要是 ≥3 的整数');
  return a;
}

// ───────────────────────── 工具 ─────────────────────────

const CJK_G = /[一-鿿]/g;
const cjkCount = (s) => (s.match(CJK_G) || []).length;
const HANZI_NUM = '[一二三四五六七八九十百千万两零]+';
const isBody = (l) => l.trim() && !l.startsWith('#') && !l.startsWith('>') && l.trim() !== '---';
const hit = (line, text) => ({ line, text });

/** 正文行：[{ i(0 起), line(1 起), text }] */
function bodyLines(lines) {
  const out = [];
  lines.forEach((l, i) => { if (isBody(l)) out.push({ i, line: i + 1, text: l.trim() }); });
  return out;
}

// ───────────────────────── structure 检查 ─────────────────────────

const STRUCTURE = {
  firstLine(lines, p) {
    const b = bodyLines(lines);
    if (!b.length) return [hit(1, '稿件是空的')];
    const re = new RegExp(p.禁 || '^今天给大家分享一个');
    return re.test(b[0].text) ? [hit(b[0].line, `第一句：${b[0].text}`)] : [];
  },

  // 某个词一篇里最多出现几次（妥妥的 ≤1）
  maxCount(lines, p) {
    const b = bodyLines(lines);
    const w = p.词; const cap = p.上限 ?? 1;
    const where = b.filter((x) => x.text.includes(w));
    return where.length > cap ? where.slice(cap).map((x) => hit(x.line, `「${w}」第 ${where.indexOf(x) + 1} 次（一篇最多 ${cap} 次）：${x.text.slice(0, 40)}`)) : [];
  },

  businessInFirst3(lines, p) {
    const b = bodyLines(lines).slice(0, p.句数 || 3);
    const joined = b.map((x) => x.text).join('');
    // 「几块到十几块」这类模糊量词也算钱数（用户授权口径里就这么说）
    const money = new RegExp(`一单[^，。]{0,8}(${HANZI_NUM}|几)|(${HANZI_NUM}|几)(块|元|毛)`).test(joined);
    const verb = (p.动作词 || ['卖', '收', '挂']).some((w) => joined.includes(w));
    const miss = [];
    if (!money) miss.push('没有「一单多少」的数');
    if (!verb) miss.push(`没有卖 / 收 / 挂这类动作词`);
    return miss.length ? [hit(b[0]?.line || 1, `前${p.句数 || 3}句${miss.join('；')}：${joined.slice(0, 60)}…`)] : [];
  },

  // 前两句里要有一个结果或数据：数挨着结果词（赚 / 搞到 / 卖出 / 已售 / 想要 / 一个月 / 一单 / 佣金……），同一个逗号句里；
  // 单独的商品售价不算。用户 2026-09-27：开头突出结果，用数据或结果留人。
  resultInFirst2(lines, p) {
    const b = bodyLines(lines).slice(0, p.句数 || 2);
    const words = p.结果词 || ['赚', '搞到', '卖出', '已售', '想要', '一个月', '一单', '佣金'];
    const span = p.挨着几个字内 ?? 10;
    const NUM = /\d|【[^】]{0,6}】|XXX|[一二三四五六七八九十百千万两零]{2,}|[一二三四五六七八九十两][块元毛万千百多成]|几/i;
    const ok = b.some((x) => x.text.split(/[，。？！；、,.?!;]/).some((clause) => words.some((w) => {
      let at = clause.indexOf(w);
      while (at >= 0) {
        const win = clause.slice(Math.max(0, at - span), at) + '｜' + clause.slice(at + w.length, at + w.length + span);
        if (NUM.test(win)) return true;
        at = clause.indexOf(w, at + 1);
      }
      return false;
    })));
    const joined = b.map((x) => x.text).join('');
    return ok ? [] : [hit(b[0]?.line || 1, `前${p.句数 || 2}句没有结果或数据（数要挨着 ${words.slice(0, 8).join(' / ')} 这类词，单独的售价不算）：${joined.slice(0, 60)}…`)];
  },

  contract(lines, p) {
    const [s1, s2] = p.句;
    const b = bodyLines(lines);
    const out = [];
    const i1 = b.findIndex((x) => x.text === s1);
    const i2 = b.findIndex((x) => x.text === s2);
    const core = s1.replace(/[。！？]/g, '');
    const count = b.filter((x) => x.text.includes(core)).length;
    if (i1 < 0) out.push(hit(1, `没有一行恰好是「${s1}」`));
    if (i2 < 0) out.push(hit(1, `没有一行恰好是「${s2}」`));
    if (i1 >= 0 && i2 >= 0 && i2 !== i1 + 1) out.push(hit(b[i1].line, `「${s1}」和「${s2}」不相邻（第 ${b[i1].line} / ${b[i2].line} 行）`));
    if (i1 >= 0 && i1 + 1 > (p.前几句内 || 8)) out.push(hit(b[i1].line, `合同句在第 ${i1 + 1} 句，超过前 ${p.前几句内 || 8} 句`));
    if (count > 1) out.push(hit(b[i1 >= 0 ? i1 : 0].line, `「${core}」出现 ${count} 次，只许一次`));
    return out;
  },

  ending(lines, p) {
    const b = bodyLines(lines);
    if (!b.length) return [];
    const last = b[b.length - 1];
    return last.text === p.句 ? [] : [hit(last.line, `最后一行不是固定收尾句：${last.text}`)];
  },

  roadmap(lines, p) {
    const b = bodyLines(lines);
    // 口号句从 R003 参数读（用户 2026-09-08 裁定 A 改为「学闲鱼，找圣矾。」）；读不到就两种口号都认
    const slogans = rules.find((r) => r.参数?.check === 'contract')?.参数?.句?.slice(1) || [];
    const i2 = b.findIndex((x) => slogans.includes(x.text) || /^[学做]闲鱼，找圣矾。$/.test(x.text));
    const start = i2 >= 0 ? i2 + 1 : 0;
    const win = b.slice(start, start + (p.合同句后几句内 || 4));
    const re = new RegExp(p.正则);
    return win.some((x) => re.test(x.text)) ? [] : [hit(b[start]?.line || 1, `合同句后 ${p.合同句后几句内 || 4} 句内没看到路线图（几块 / 几件事）`)];
  },

  endingOrder(lines, p) {
    const b = bodyLines(lines);
    const idx = (words) => { let k = -1; b.forEach((x, i) => { if (words.some((w) => x.text.includes(w))) k = i; }); return k; };
    const firstIdx = (words) => b.findIndex((x) => words.some((w) => x.text.includes(w)));
    const needComp = (p.合规词 || []).length > 0;
    const comp = needComp ? idx(p.合规词) : -1;
    const hook = firstIdx(p.钩子词);
    const out = [];
    if (needComp && comp < 0) out.push(hit(b[b.length - 1]?.line || 1, '没看到合规提醒句（平台规则 / 违规）'));
    if (hook < 0) out.push(hit(b[b.length - 1]?.line || 1, '没看到资料钩子（评论区）'));
    if (comp >= 0 && hook >= 0 && comp > hook) out.push(hit(b[comp].line, `合规提醒（第 ${b[comp].line} 行）在钩子（第 ${b[hook].line} 行）之后`));
    if (hook >= 0 && hook >= b.length - 1) out.push(hit(b[hook].line, '钩子在收尾句之后'));
    return out;
  },

  hook(lines, p) {
    const b = bodyLines(lines);
    const tail = b.slice(-(p.最后几句内 || 8));
    const out = [];
    const ok = tail.some((x) => (p.必须同一行 || []).every((w) => x.text.includes(w)));
    if (!ok) out.push(hit(tail[0]?.line || 1, `最后 ${p.最后几句内 || 8} 句里没有「${(p.必须同一行 || []).join(' + ')}」同在一行的钩子`));
    for (const x of b) for (const w of p.禁 || []) if (x.text.includes(w)) out.push(hit(x.line, `出现「${w}」：${x.text}`));
    return out;
  },

  maxLine(lines, p) {
    return bodyLines(lines).filter((x) => cjkCount(x.text) > (p.上限 || 50)).map((x) => hit(x.line, `${cjkCount(x.text)} 字：${x.text}`));
  },

  // 行中间的「？」放过：说明书第十三节「设问后自己接答」，问和答写在一行算一句。
  oneSentencePerLine(lines) {
    const out = [];
    for (const x of bodyLines(lines)) {
      const t = x.text.replace(/[」”』]+$/, '');
      const inner = [...t.matchAll(/[。！]/g)].filter((m) => m.index < t.length - 1);
      if (inner.length) out.push(hit(x.line, `一行里有 ${inner.length + (/[。！？]$/.test(t) ? 1 : 0)} 个句末标点：${x.text}`));
    }
    return out;
  },

  length(lines, p) {
    const n = bodyLines(lines).reduce((s, x) => s + cjkCount(x.text), 0);
    if (n < (p.min || 0)) return [hit(1, `全篇 ${n} 汉字，少于 ${p.min}`)];
    if (n > (p.max || Infinity)) return [hit(1, `全篇 ${n} 汉字，多于 ${p.max}`)];
    return [];
  },

  threeNumbers(lines, p) {
    const all = bodyLines(lines).map((x) => x.text).join('\n');
    const miss = Object.entries(p.组 || {}).filter(([, words]) => !words.some((w) => all.includes(w))).map(([k]) => k);
    return miss.length ? [hit(1, `稿里没见到：${miss.join('、')}（三个数要齐：卖价 / 进价 / 差价）`)] : [];
  },

  officialPrice(lines, p) {
    return bodyLines(lines)
      .filter((x) => p.官价词.some((w) => x.text.includes(w)) && p.收入词.some((w) => x.text.includes(w)) && !(p.豁免词 || []).some((w) => x.text.includes(w)))
      .map((x) => hit(x.line, `官价和赚 / 差价同一句：${x.text}`));
  },

  noDigits(lines) {
    return structuralChecks(lines).filter((s) => s.kind === 'digits').map((s) => hit(s.line, `${s.what}：${lines[s.line - 1].trim()}`));
  },

  percentRead(lines, p) {
    const out = [];
    const num = new RegExp(`^[^，。；！？]{0,8}?(${HANZI_NUM})`);
    for (const x of bodyLines(lines)) {
      for (const w of p.触发词 || []) {
        let from = 0;
        while (true) {
          const k = x.text.indexOf(w, from);
          if (k < 0) break;
          const rest = x.text.slice(k + w.length).split(/[，。；！？]/)[0];
          if (num.test(rest) && !rest.includes('百分之')) out.push(hit(x.line, `「${w}」后面的数没读成百分之几：${x.text}`));
          from = k + w.length;
        }
      }
    }
    return out;
  },

  consecutiveWo(lines) {
    return structuralChecks(lines).filter((s) => s.kind === 'consecutiveWo').map((s) => hit(s.line, s.what));
  },

  disclaimer(lines, p) {
    const rows = bodyLines(lines).filter((x) => (p.词 || []).some((w) => x.text.includes(w)));
    return rows.length > (p.上限 ?? 1) ? rows.map((x) => hit(x.line, `免责句（共 ${rows.length} 句，上限 ${p.上限 ?? 1}）：${x.text}`)) : [];
  },

  regexLines(lines, p) {
    const res = (p.正则 || []).map((r) => new RegExp(r));
    const out = [];
    for (const x of bodyLines(lines)) for (const re of res) { const m = x.text.match(re); if (m) { out.push(hit(x.line, `「${m[0]}」：${x.text}`)); break; } }
    return out;
  },

  slangStack(lines, p) {
    const out = [];
    for (const x of bodyLines(lines)) {
      const found = (p.词 || []).filter((w) => x.text.includes(w));
      if (found.length > (p.同一行上限 || 1)) out.push(hit(x.line, `一行 ${found.length} 个江湖词（${found.join('、')}）：${x.text}`));
    }
    return out;
  },

  candidateTitles(lines, p) {
    const out = [];
    const rawTxt = fs.readFileSync(fileAbs, 'utf8');
    if (rawTxt.includes('=====备选标题=====')) {
      out.push(hit(1, '【R056 违规】文案正文（.txt）中严禁包含备选标题！用户 2026-10-10 铁律：标题一律不得放在文案里，必须且只能写入同名 .meta.json 的 titles 字段。'));
    }

    const metaPath = fileAbs.replace(/\.txt$/, '.meta.json');
    let metaTitles = [];
    let meta = null;
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (Array.isArray(meta.titles)) metaTitles = meta.titles;
      } catch {}
    }

    if (!metaTitles.length) {
      out.push(hit(1, '同名 .meta.json 中未找到 titles 字段（每篇文案必须在 .meta.json 中提供 10 个不同风格备选标题）'));
      return out;
    }
    const reqCount = p['数量'] || 10;
    if (metaTitles.length < reqCount) {
      out.push(hit(1, '备选标题数量不足 10 条（当前 ' + metaTitles.length + ' 条）'));
    }
    metaTitles.forEach((t, i) => {
      const text = typeof t === 'string' ? t : (t.text || '');
      if (/[:：]/u.test(text)) {
        out.push(hit(1, '备选标题 #' + (i + 1) + ' 含有冒号（禁止冒号，必须用空格自然断句）：' + text));
      }
    });

    // 用户 2026-10-10 / 2026-10-11 铁律：横版长视频（orientation: 'h' 且非 selfie/chat）必须包含 10 套备选封面文案 coverOptions 与 coverConfirmed
    if (meta && meta.orientation === 'h' && meta.kind !== 'selfie' && meta.skin !== 'chat') {
      if (!Array.isArray(meta.coverOptions) || meta.coverOptions.length < 10) {
        out.push(hit(1, `【封面文案违规】横版长视频 .meta.json 必须包含 10 套备选封面文案 coverOptions（当前 ${Array.isArray(meta.coverOptions) ? meta.coverOptions.length : 0} 套）`));
      } else {
        meta.coverOptions.forEach((c, i) => {
          if (!c.title || !c.highlight || !c.sub) {
            out.push(hit(1, `备选封面方案 #${i + 1} 字段不完整（必须包含 title, highlight, sub）`));
          }
        });
      }
      if (!meta.coverConfirmed || !meta.coverConfirmed.title) {
        out.push(hit(1, '【封面文案违规】横版长视频 .meta.json 必须初始化 coverConfirmed（待确认封面文案）'));
      }
    }

    return out;
  },
};

// ───────────────────────── manual 行的辅助信息 ─────────────────────────

function chainSection(chainAbs, headingPrefix) {
  const md = fs.readFileSync(chainAbs, 'utf8').split(/\r?\n/);
  const s = md.findIndex((l) => l.startsWith(headingPrefix));
  if (s < 0) return [];
  const out = [];
  for (let i = s + 1; i < md.length; i++) { if (/^## /.test(md[i])) break; out.push(md[i]); }
  return out;
}

function chainBannedItems(chainAbs) {
  return chainSection(chainAbs, '## 四、')
    .filter((l) => /^\|\s*(【[^】]*】)?\s*\*\*/.test(l))
    .map((l) => {
      const cells = l.split('|').map((c) => c.trim());
      const name = (cells[1] || '').replace(/\*\*/g, '');
      return `${name.slice(0, 60)}${name.length > 60 ? '…' : ''}`;
    });
}

// ───────────────────────── 主流程 ─────────────────────────

const args = parseArgs(process.argv.slice(2));

let loaded;
try { loaded = loadRules(args.rules); } catch (e) { die(e.message); }
const rules = loaded.rules;

const fileAbs = resolvePath(args.file);
if (!fs.existsSync(fileAbs)) die(`稿件不存在：${fileAbs}`);
const lines = readLines(fileAbs);
const draftText = lines.join('\n');

// 结果：id → { status, hits:[{line,text}], notes:[] }
const results = new Map();
const R = (id) => { if (!results.has(id)) results.set(id, { status: '通过', hits: [], notes: [] }); return results.get(id); };
const notRun = [];   // 退回级没跑的

// ── words：跑一遍，按类型认领 ──
const wordRules = rules.filter((r) => r.查法 === 'words');
const claimers = rules.filter((r) => Array.isArray(r.参数?.词表类型));
// 参数.词条 = ["U151", …] 的行按词条 id 认领，优先于按类型认领（R052 只管两个词，不把整类降级）
const idClaimers = rules.filter((r) => Array.isArray(r.参数?.词条));
const catchAll = wordRules.find((r) => !Array.isArray(r.参数?.词表类型));
let table = null;
try { table = loadTable(args.words); } catch (e) { die(e.message); }
{
  const active = activeEntries(table.entries, args.topicType, args.topic);
  const { hits, reminders } = scanDraft(lines, active);
  for (const h of hits) {
    const owner = idClaimers.find((r) => r.参数.词条.includes(h.entry.id)) || claimers.find((r) => r.参数.词表类型.includes(h.entry.类型)) || catchAll;
    if (!owner) continue;
    R(owner.id).hits.push(hit(h.line, `「${h.term}」→ ${h.entry.换}　［${h.entry.类型}］${sourceLabel(h.entry)}（${h.entry.id}）　${snippet(lines[h.line - 1], h.start, h.end)}`));
  }
  for (const h of reminders) {
    const owner = claimers.find((r) => r.参数.词表类型.includes(h.entry.类型)) || catchAll;
    if (owner) R(owner.id).notes.push(`提醒（否定句里的实物词，不计命中）第 ${h.line} 行「${h.term}」　${snippet(lines[h.line - 1], h.start, h.end)}`);
  }
  for (const r of wordRules) {
    const res = R(r.id);
    if (r.参数?.词表类型?.includes('实物专用') && !args.topicType) res.notes.push('没给 --topic-type，实物专用那一类没查');
    if (r.参数?.词表类型?.includes('选题红线') && !args.topic) res.notes.push('没给 --topic，选题红线那一类没查');
    if (r === catchAll) res.notes.push(`词表 ${table.entries.length} 条，本次启用 ${active.length} 条；选题类型 ${args.topicType || '未给'}，选题 ${args.topic || '未给'}`);
  }
}

// ── structure ──
for (const r of rules.filter((x) => x.查法 === 'structure')) {
  const fn = STRUCTURE[r.参数?.check];
  const res = R(r.id);
  if (r.参数?.停用) { res.status = '停用'; res.notes.push(`停用：${r.参数.停用}`); continue; }
  if (r.参数?.经验稿不查 && args.type === '经验') { res.status = '跳过'; res.notes.push('经验稿不查（--type 经验）'); continue; }
  if (!fn) { res.status = '跳过'; res.notes.push(`不认识的 structure 检查：${r.参数?.check}`); if (r.级别 === '退回') notRun.push(r.id); continue; }
  const hs = fn(lines, r.参数 || {});
  // 词表已按类型报过的行不重复报（R001 的 U040、R019 的 U101–U104）
  const already = new Set(res.hits.map((h) => h.line));
  for (const h of hs) if (!already.has(h.line)) res.hits.push(h);
}

// ── against（repeat 和 leakage 共用）──
let against = { docs: [], missing: [] };
if (args.against.length) {
  against = collectAgainst(args.against, { excludeAbs: [fileAbs] });
  if (against.missing.length) die(`已定稿路径不存在：${against.missing.join(', ')}`);
}

// ── repeat ──
{
  const repeatRules = rules.filter((x) => x.查法 === 'repeat');
  if (repeatRules.length) {
    if (!against.docs.length) {
      for (const r of repeatRules) { const res = R(r.id); res.status = '没跑'; res.notes.push('没给 --against（或一篇已定稿都没读到）'); if (r.级别 === '退回') notRun.push(r.id); }
    } else {
      const nRule = repeatRules.find((r) => r.参数?.n)?.参数.n;
      const n = args.n || nRule || DEFAULT_N;
      const { templates, phrases, source } = loadTemplates(args.style, n);
      const rr = checkRepeat(lines, against.docs, { n, templates, phrases });
      const overlapRule = repeatRules.find((r) => r.参数?.n) || repeatRules[0];
      const nameRule = repeatRules.find((r) => r.参数?.查 === '命名') || overlapRule;
      const phraseRule = repeatRules.find((r) => r.参数?.白名单);
      for (const o of rr.overlaps) R(overlapRule.id).hits.push(hit(o.line, `「${o.text}」（${o.len} 字）撞：${o.files.join('、')}`));
      for (const c of rr.coinages) R(nameRule.id).hits.push(hit(c.line, `「${c.key}」撞：${c.hits.map((h) => `${h.file} 第 ${h.line} 行`).join('；')}`));
      for (const c of rr.hints) R(nameRule.id).notes.push(`提示 第 ${c.line} 行「${c.text}」同：${c.hits.slice(0, 2).map((h) => `${h.file} 第 ${h.line} 行「${h.text.slice(0, 40)}」`).join('；')}`);
      R(overlapRule.id).notes.push(`已定稿 ${rr.docs.length} 篇：${rr.docs.join('，')}；窗口 ${n} 字；模板句 ${templates.length} 条、可照抄短语 ${phrases.length} 条已剔除（${source === '内置' ? '内置' : '取自说明书'}）`);
      if (phraseRule) R(phraseRule.id).notes.push(`已剔除的可照抄短语 ${phrases.length} 条（${phrases.slice(0, 5).join(' / ')}${phrases.length > 5 ? ' / …' : ''}）；短于 ${n} 字的短语本身触发不了，整句重合已在 ${overlapRule.id} 报`);
    }
  }
}

// ── leakage ──
for (const r of rules.filter((x) => x.查法 === 'leakage')) {
  const res = R(r.id);
  const corpusPath = args.corpus || r.参数?.corpus;
  const corpusAbs = corpusPath ? resolvePath(corpusPath) : '';
  const texts = [];
  const names = [];
  if (corpusAbs && fs.existsSync(corpusAbs)) { texts.push(readSourceFile(corpusAbs)); names.push(corpusPath); }
  else res.notes.push(`真人语料总表不在本机（${corpusPath || '未给'}），只对已定稿查`);
  for (const d of against.docs) { texts.push(d.lines.join('\n')); names.push(d.name); }
  if (!texts.length) { res.status = '没跑'; res.notes.push('没有任何来源可对照'); if (r.级别 === '退回') notRun.push(r.id); continue; }
  // 受保护短语 = leakage-rules.json 里的 + 说明书第三、十四节的合同句 / 钩子模板（这些每篇逐字相同，不是照抄）
  let prot = [];
  const protPath = r.参数?.受保护短语 ? resolvePath(r.参数.受保护短语) : '';
  if (protPath && fs.existsSync(protPath)) { try { prot = JSON.parse(fs.readFileSync(protPath, 'utf8')).protectedPhrases || []; } catch { /* 读不出就只用模板 */ } }
  const { templates } = loadTemplates(args.style, 4);
  const protAll = [...([...new Set([...prot, ...templates])].sort((a, b) => b.length - a.length)), ...BUILTIN_PHRASES];
  const lr = checkSourceLeakage(texts.join('\n'), { draft: draftText }, { n: r.参数?.n || 12, protectedPhrases: protAll });
  const d = lr.results[0];
  // 定位行号：片段可能跨行（对照工具是整篇拼起来比的），按片段开头几个字找
  for (const s of d.segments) {
    const head = s.text.slice(0, Math.min(6, s.text.length));
    const li = lines.findIndex((l) => l.replace(/\s/g, '').includes(head));
    res.hits.push(hit(li >= 0 ? li + 1 : 0, `「${s.text}」（${s.len} 字）`));
  }
  res.notes.push(`来源 ${names.length} 份：${names.join('，')}；窗口 ${lr.n} 字；受保护短语 ${protAll.length} 条先剔除（leakage-rules ${prot.length} + 说明书模板 ${templates.length}）`);
}

// ── compliance ──
{
  const compRules = rules.filter((x) => x.查法 === 'compliance');
  if (compRules.length) {
    const cr = checkCopy(draftText);
    for (const r of compRules) {
      const res = R(r.id);
      const groups = r.参数?.组 || [];
      for (const f of cr.findings.filter((f) => groups.includes(f.group))) {
        for (const h of [...new Set(f.hits)]) {
          const li = lines.findIndex((l) => l.replace(/\s/g, '').includes(h));
          const line = li >= 0 ? lines[li].replace(/\s/g, '') : '';
          const at = line.indexOf(h);
          // 否定语境（别写百分百原题 / 不保证百分之百）只提示不退回：用户 #14 故事和事实链都要求这么说
          const negated = at >= 0 && /(不|别|没|非|不是|不保证|不写|不许|不要)[^。；]{0,6}$/.test(line.slice(Math.max(0, at - 8), at));
          if (negated) res.notes.push(`提示 第 ${li + 1} 行「${h}」在否定语境里（${f.group}），不计命中：${lines[li].trim()}`);
          else res.hits.push(hit(li >= 0 ? li + 1 : 0, `「${h}」（${f.group}：${f.reason}）${li >= 0 ? '：' + lines[li].trim() : ''}`));
        }
      }
      if (groups.includes('money-density')) res.notes.push(`赚钱类词密度 ${(cr.densityRatio * 100).toFixed(2)}%（check-copy 上限 2%，长稿只看）`);
    }
  }
}

// ── manual ──
for (const r of rules.filter((x) => x.查法 === 'manual')) {
  const res = R(r.id);
  res.status = '人工';
  const p = r.参数 || {};
  if (p.文件 && /§四/.test(p.文件)) {
    if (args.chain) {
      const chainAbs = resolvePath(args.chain);
      if (!fs.existsSync(chainAbs)) die(`事实链不存在：${chainAbs}`);
      const items = chainBannedItems(chainAbs);
      res.notes.push(`事实链 §四 不入稿 ${items.length} 条，逐条对：`);
      for (const it of items) res.notes.push(`  · ${it}`);
    } else res.notes.push('没给 --chain，清单没列出来');
  } else if (p.文件 && /§五/.test(p.文件)) {
    res.notes.push(args.chain ? `看事实链 §五（${args.chain}）` : '没给 --chain');
  }
  if (p.标尺句) res.notes.push(`标尺句：${p.标尺句}`);
  if (p.命令) res.notes.push(`手动跑：${p.命令}`);
  if (p.例) for (const [k, v] of Object.entries(p.例)) res.notes.push(`例：${k} → ${v}`);
}

// ───────────────────────── 输出 ─────────────────────────

const out = [];
const pad = (s, n) => { const w = [...String(s)].reduce((a, ch) => a + (/[一-鿿，。、（）「」【】！？：；]/.test(ch) ? 2 : 1), 0); return String(s) + ' '.repeat(Math.max(0, n - w)); };
out.push(`[check-all] 稿件：${fileAbs}`);
out.push(`[check-all] 规则表：${loaded.abs}（${rules.length} 条）　词表：${table.abs}（${table.entries.length} 条）　已定稿：${against.docs.length} 篇　选题：${args.topic || '未给'} / ${args.topicType || '未给'}`);
out.push('');
out.push(`${pad('规则', 6)} ${pad('类别', 8)} ${pad('级别', 4)} ${pad('查法', 10)} ${pad('结果', 8)} 规则`);
out.push('-'.repeat(100));

let returnedRules = 0;
let hintRules = 0;
for (const r of rules) {
  const res = R(r.id);
  let status = res.status;
  if (res.hits.length) status = `命中 ${res.hits.length}`;
  if (res.hits.length && r.级别 === '退回') returnedRules++;
  if (res.hits.length && r.级别 === '提示') hintRules++;
  out.push(`${pad(r.id, 6)} ${pad(r.类别, 8)} ${pad(r.级别, 4)} ${pad(r.查法, 10)} ${pad(status, 8)} ${r.规则.length > 44 ? r.规则.slice(0, 44) + '…' : r.规则}`);
  for (const h of res.hits) out.push(`         第 ${pad(String(h.line), 3)} 行  ${h.text}`);
  for (const n of res.notes) out.push(`         · ${n}`);
}
out.push('-'.repeat(100));
const manualCount = rules.filter((r) => r.查法 === 'manual').length;
out.push(`退回级命中 ${returnedRules} 条规则，提示级命中 ${hintRules} 条，人工审 ${manualCount} 条${notRun.length ? `，退回级没跑 ${notRun.length} 条（${notRun.join('、')}）` : ''}`);
const fail = returnedRules > 0 || notRun.length > 0;
out.push(fail ? (returnedRules ? '结论：有退回级命中，打回改。' : '结论：退回级规则没跑全，补齐参数再跑。') : '结论：退回级全部通过。');
process.stdout.write(out.join('\n') + '\n');
process.exit(fail ? 1 : 0);
