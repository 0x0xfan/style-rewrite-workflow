#!/usr/bin/env node
// mark-used.mjs —— 定稿后把本期期号写回真人语料包的"用过的期"
//
// 用法：
//   node engine/brief/mark-used.mjs --pack docs/真人语料包/总表.json --episode <期标识> --ids K-开头-xxx,K-说-xxx,...
//
// 配料包末尾"本包选用的语料编号"那一节就是给这条命令用的。
// 规矩：
//   - 任何一个编号找不到 → 整体不写，退出 1
//   - 已经含本期的编号跳过不重复追加
//   - 其它字段原样不动；顶层追加 / 维护"写回顺序"（按写回先后的期号列表，"最近两期"按它算）
//   - 缩进默认跟原文件一致（合表脚本写的是 1），--indent 2 可以指定

import fs from 'node:fs';
import { loadPack, markUsed, detectIndent, DEFAULT_PACK } from './corpus-pack.mjs';

function die(msg) {
  process.stderr.write(`\n[mark-used] 错误：${msg}\n\n`);
  process.exit(1);
}

const USAGE = `
用法：
  node engine/brief/mark-used.mjs --pack ${DEFAULT_PACK} --episode <期标识> --ids K-开头-xxx,K-说-xxx,...

  --pack     真人语料包总表 .json（默认 ${DEFAULT_PACK}）
  --episode  本篇的期号或 filmId，会追加进每条的"用过的期"
  --ids      逗号分隔的编号，开头 / 说法 / 原声混着给都行
  --indent   写回的 JSON 缩进，默认 auto（跟原文件一致）
  --dry-run  只检查不落盘
`;

const KNOWN = new Set(['pack', 'episode', 'ids', 'indent', 'dry-run', 'help']);
const FLAGS = new Set(['dry-run', 'help']);

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) die(`看不懂的参数：${t}`);
    const key = t.slice(2);
    if (!KNOWN.has(key)) die(`不认识的参数：--${key}\n        可用参数：${[...KNOWN].map((k) => '--' + k).join(' ')}`);
    if (FLAGS.has(key)) { a[key] = true; continue; }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) die(`--${key} 后面缺值`);
    a[key] = val;
    i++;
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) { process.stdout.write(USAGE); process.exit(0); }
if (!args.episode || !args.episode.trim()) die('缺 --episode');
if (!args.ids || !args.ids.trim()) die('缺 --ids');

const episode = args.episode.trim();
const ids = [...new Set(args.ids.split(/[,，]/).map((s) => s.trim()).filter(Boolean))];

let pack;
try { pack = loadPack(args.pack || DEFAULT_PACK); } catch (e) { die(e.message); }

let result;
try { result = markUsed(pack.data, episode, ids); } catch (e) { die(e.message); }

const indent = !args.indent || args.indent === 'auto' ? detectIndent(pack.rawText, 2) : Number(args.indent);
if (!Number.isInteger(indent) || indent < 0) die(`--indent 要是非负整数或 auto，现在是：${args.indent}`);

if (!args['dry-run']) {
  fs.writeFileSync(pack.abs, JSON.stringify(pack.data, null, indent) + '\n', 'utf8');
}

process.stdout.write(`[mark-used] ${args['dry-run'] ? '（试跑，未落盘）' : '已写回：' + pack.abs}\n`);
process.stdout.write(`[mark-used] 期号：${episode}　追加 ${result.touched.length} 条，已含本期跳过 ${result.already.length} 条\n`);
if (result.touched.length) process.stdout.write(`[mark-used]   追加：${result.touched.join('、')}\n`);
if (result.already.length) process.stdout.write(`[mark-used]   跳过：${result.already.join('、')}\n`);
process.stdout.write(`[mark-used] 写回顺序：${pack.data.写回顺序.join(' → ')}\n`);
