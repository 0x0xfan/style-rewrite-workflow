#!/usr/bin/env node
// registry.mjs —— 稿件登记表：每交出去一篇稿登记一条，回稿闭环靠它认稿、找配料包/事实链/素材目录
//
// 用法：
//   node engine/return/registry.mjs add --id C-v6 --topic 京东家政券 --film jingdong-jiazheng --draft <稿件路径>
//        [--brief <配料包>] [--chain <事实链>] [--factcard <事实卡>] [--assets <素材目录>] [--angle <开头角度>]
//        [--version v6] [--date 2026-09-08] [--status 已交付待回稿] [--note ...] [--style 钱十七] [--force]
//   node engine/return/registry.mjs update --id C-v6 [--status ...] [--note ...] [--returned <回稿路径>] [--changed <改动句数>] [--diff <对照表路径>]
//   node engine/return/registry.mjs list
//   node engine/return/registry.mjs render          # 只按 json 重渲染 md
//
// add 会核实 --draft / --brief / --chain / --factcard / --assets 都存在，不存在就报错（--force 跳过）。
// 每次 add / update 之后都重渲染 docs/稿件登记.md。退出码：0 成功；2 参数或文件出错。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePath, parseArgs, loadRegistry, cell, today, DEFAULT_REGISTRY } from './lib.mjs';

export const FIELDS = ['id', '选题', 'filmId', '风格', '版本', '稿件路径', '配料包', '事实链', '事实卡', '素材目录', '开头角度', '交付日期', '状态', '备注'];
const PATH_FIELDS = ['稿件路径', '配料包', '事实链', '事实卡', '素材目录'];

const USAGE = `
用法：
  node engine/return/registry.mjs add --id <id> --topic <选题> --film <filmId> --draft <稿件路径>
       [--brief <配料包>] [--chain <事实链>] [--factcard <事实卡>] [--assets <素材目录>] [--angle <开头角度>]
       [--version v6] [--date 2026-09-08] [--status 已交付待回稿] [--note ...] [--style 钱十七] [--force]
  node engine/return/registry.mjs update --id <id> [--status ...] [--note ...] [--returned <回稿路径>] [--changed <改动句数>] [--diff <对照表>]
  node engine/return/registry.mjs list
  node engine/return/registry.mjs render
  可加 --registry <json 路径>，默认 ${DEFAULT_REGISTRY}
`;

function die(msg) {
  process.stderr.write(`\n[registry] 错误：${msg}\n\n`);
  process.exit(2);
}

export function renderMd(entries) {
  const cols = ['id', '选题', 'filmId', '版本', '开头角度', '交付日期', '状态', '稿件路径', '配料包', '事实链', '事实卡', '素材目录', '回稿路径', '改动句数', '备注'];
  const out = [];
  out.push('# 稿件登记表');
  out.push('');
  out.push(`> 由 \`engine/return/registry.mjs\` 从 \`docs/稿件登记.json\` 渲染，别手改本文件。共 ${entries.length} 条。`);
  out.push('> 每交出去一篇稿登记一条；回稿回来后 `identify` 拿它认稿，`script-return` 技能完成后把状态改成「已回稿并交付」。');
  out.push('');
  out.push(`| ${cols.join(' | ')} |`);
  out.push(`| ${cols.map(() => '---').join(' | ')} |`);
  for (const e of entries) out.push(`| ${cols.map((c) => cell(e[c] ?? '')).join(' | ')} |`);
  out.push('');
  return out.join('\n');
}

export function saveRegistry(entries, p = DEFAULT_REGISTRY) {
  const abs = resolvePath(p);
  fs.writeFileSync(abs, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  const md = abs.replace(/\.json$/i, '.md');
  fs.writeFileSync(md, renderMd(entries), 'utf8');
  return { json: abs, md };
}

/** 把一条登记的相对路径解析成绝对路径，列出不存在的 */
export function missingPaths(entry) {
  const miss = [];
  for (const f of PATH_FIELDS) {
    const v = entry[f];
    if (!v) continue;
    if (!fs.existsSync(resolvePath(v))) miss.push(`${f}：${v}`);
  }
  return miss;
}

export function addEntry(entries, opts) {
  const { id, topic, film, draft } = opts;
  if (!id) throw new Error('缺 --id');
  if (!topic) throw new Error('缺 --topic（选题）');
  if (!film) throw new Error('缺 --film（filmId）');
  if (!draft) throw new Error('缺 --draft（稿件路径）');
  if (entries.some((e) => e.id === id)) throw new Error(`id 已登记过：${id}（要改用 update）`);
  const version = opts.version || (id.includes('-') ? id.slice(id.indexOf('-') + 1) : '');
  const entry = {
    id,
    选题: topic,
    filmId: film,
    风格: opts.style || '钱十七',
    版本: version,
    稿件路径: draft,
    配料包: opts.brief || '',
    事实链: opts.chain || '',
    事实卡: opts.factcard || '',
    素材目录: opts.assets || '',
    开头角度: opts.angle || '',
    交付日期: opts.date || today(),
    状态: opts.status || '已交付待回稿',
    备注: opts.note || '',
  };
  const miss = missingPaths(entry);
  if (miss.length && !opts.force) throw new Error(`这些路径不存在（核对后再登记，或加 --force）：\n  ${miss.join('\n  ')}`);
  entries.push(entry);
  return entry;
}

export function updateEntry(entries, opts) {
  const e = entries.find((x) => x.id === opts.id);
  if (!e) throw new Error(`登记表里没有这个 id：${opts.id}`);
  if (opts.status) e.状态 = opts.status;
  if (opts.note) e.备注 = opts.note;
  if (opts.returned) e.回稿路径 = opts.returned;
  if (opts.diff) e.对照表 = opts.diff;
  if (opts.changed !== undefined && opts.changed !== '') {
    const n = Number(opts.changed);
    if (!Number.isInteger(n) || n < 0) throw new Error(`--changed 要是非负整数，现在是：${opts.changed}`);
    e.改动句数 = n;
  }
  return e;
}

export function formatList(entries) {
  const pad = (s, w) => { s = String(s ?? ''); return s + ' '.repeat(Math.max(0, w - s.length)); };
  const rows = entries.map((e) => `${pad(e.id, 8)} ${pad(e.选题, 10)} ${pad(e.filmId, 22)} ${pad(e.状态, 10)} ${pad(e.交付日期, 12)} ${e.稿件路径}`);
  return [`共 ${entries.length} 条`, ...rows].join('\n');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const a = parseArgs(process.argv.slice(2), { flags: ['force', 'help'] });
  if (a.help || !a.positional.length) { process.stdout.write(USAGE); process.exit(a.help ? 0 : 2); }
  const cmd = a.positional[0];
  const regPath = a.registry || DEFAULT_REGISTRY;
  let entries;
  try {
    entries = fs.existsSync(resolvePath(regPath)) ? loadRegistry(regPath) : [];
  } catch (e) { die(e.message); }
  try {
    if (cmd === 'add') {
      const e = addEntry(entries, a);
      const { json, md } = saveRegistry(entries, regPath);
      process.stdout.write(`已登记 ${e.id}（${e.选题} / ${e.filmId} / ${e.版本}）\n写入：${json}\n渲染：${md}\n`);
    } else if (cmd === 'update') {
      if (!a.id) die('缺 --id');
      const e = updateEntry(entries, a);
      const { json, md } = saveRegistry(entries, regPath);
      const extra = [e.回稿路径 ? `回稿=${e.回稿路径}` : '', e.改动句数 !== undefined ? `改动句数=${e.改动句数}` : ''].filter(Boolean).join('，');
      process.stdout.write(`已更新 ${e.id}：状态=${e.状态}${extra ? '，' + extra : ''}\n写入：${json}\n渲染：${md}\n`);
    } else if (cmd === 'list') {
      process.stdout.write(formatList(entries) + '\n');
    } else if (cmd === 'render') {
      const { md } = saveRegistry(entries, regPath);
      process.stdout.write(`渲染：${md}\n`);
    } else die(`不认识的子命令：${cmd}${USAGE}`);
  } catch (e) { die(e.message); }
}
