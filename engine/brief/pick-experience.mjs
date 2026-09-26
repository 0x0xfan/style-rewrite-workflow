#!/usr/bin/env node
// pick-experience.mjs —— 按本期虚拟子类，从闲鱼经验库里挑出写手能看的经验，出一份候选清单（干货单的原料）
//
// 用法：
//   node engine/brief/pick-experience.mjs --subtype 代办服务类 [--env 选品,上架,...] --out <file.md>
//        [--table docs/闲鱼经验库/总表.json] [--tags docs/闲鱼经验库/适用标签.json]
//
// 过滤（2026-09-26 用户定）：
//   ① 适用标签只留「通用」「虚拟专用」，实物专用一条不出；
//   ② 「虚拟子类」里要包含本期子类（资料类 / 代办服务类 / 软件账号类）；
//   ③ 进稿标记 🚫 的直接剔除；
//   ④ 给了 --env 就只留这些环节。
//   没贴标签的条目也不出（没法判断能不能用），数量写在清单抬头。
// 输出：markdown，按环节分节，每条带 编号 / 经验 / 标记 / 换说法 / 备注（⚠️ 剥了什么）/ 标签把握。
// 只读两份库文件，不改它们。退出码：0 成功；2 参数或文件出错。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_TABLE = 'docs/闲鱼经验库/总表.json';
export const DEFAULT_TAGS = 'docs/闲鱼经验库/适用标签.json';
export const SUBTYPES = ['资料类', '代办服务类', '软件账号类'];
export const ENVS = ['选品', '养号', '上架', '引流', '客服话术', '交付', '售后', '合规违禁', '账号风控', '运营心态', '其他'];

const USAGE = `
用法：
  node engine/brief/pick-experience.mjs --subtype <${SUBTYPES.join('|')}> [--env 选品,上架,...] --out <file.md>
       [--table ${DEFAULT_TABLE}] [--tags ${DEFAULT_TAGS}]

  --subtype  本期虚拟子类（核心卡上写的那个）；写「代办服务」不带「类」也认
  --env      只看这些环节，逗号分隔：${ENVS.join('、')}；不给就全看
  --out      写到这个 md 文件；不给就打 stdout
`;

export function normalizeSubtype(s) {
  const t = String(s || '').trim();
  if (SUBTYPES.includes(t)) return t;
  const withLei = t + '类';
  return SUBTYPES.includes(withLei) ? withLei : null;
}

/** 核心过滤。table = 总表.json 数组，tags = 适用标签.json 数组。 */
export function pickExperience(table, tags, { subtype, envs = [] } = {}) {
  const sub = normalizeSubtype(subtype);
  if (!sub) throw new Error(`子类必须是 ${SUBTYPES.join(' / ')} 之一，收到：${subtype}`);
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const envSet = new Set(envs);
  const dropped = { 实物专用: 0, 子类不含: 0, 禁用: 0, 环节不选: 0, 无标签: 0 };
  const items = [];
  for (const e of table) {
    const tag = tagById.get(e.id);
    if (!tag) { dropped.无标签++; continue; }
    if (tag.适用 !== '通用' && tag.适用 !== '虚拟专用') { dropped.实物专用++; continue; }
    if (!(tag.虚拟子类 || []).includes(sub)) { dropped.子类不含++; continue; }
    if (String(e.标记 || '').includes('🚫')) { dropped.禁用++; continue; }
    if (envSet.size && !envSet.has(e.环节)) { dropped.环节不选++; continue; }
    items.push({
      id: e.id, 环节: e.环节, 类型: e.类型 || '', 经验: e.经验 || '', 标记: e.标记 || '',
      备注: e.备注 || '', 支持数: e.支持数 ?? '', 适用: tag.适用, 换说法: tag.换说法 || '', 把握: tag.把握 || '',
    });
  }
  return { subtype: sub, envs: [...envSet], items, dropped, total: table.length };
}

const cell = (s) => String(s ?? '').replace(/\|/g, '｜').replace(/\r?\n/g, ' ');

export function renderMarkdown({ subtype, envs, items, dropped, total }) {
  const out = [];
  out.push(`# 经验候选清单 · ${subtype}${envs.length ? ` · 环节：${envs.join('、')}` : ''}`);
  out.push('');
  out.push(`经验库 ${total} 条 → 本期能看 ${items.length} 条。去掉的：实物专用 ${dropped.实物专用}、子类不含本期 ${dropped.子类不含}、🚫 ${dropped.禁用}、环节不选 ${dropped.环节不选}、没贴标签 ${dropped.无标签}。`);
  out.push('');
  out.push('怎么用（写干货单前读一遍）：');
  out.push('- 这份只是候选。先拿核心卡筛：跟本期主推相反的去掉；提醒"主推做法里要小心的坑"的留下。');
  out.push('- 经验里的数字（天数、条数、比例、效果）一个都不带进稿。');
  out.push('- ⚠️ 的条目看备注，剥掉的东西不能回到稿里；剥完意思不成立就不用。');
  out.push('- "换说法"一栏有内容的，进稿时把左边的实物词换成右边的说法。');
  out.push('- 把握写"低"的，标签还在等用户确认，能不用就不用；要用，在干货单里写明。');
  out.push('- 有些条目互相冲突（比如做冷门还是做热门），见 `docs/闲鱼经验库/总表.md` 第 2 节冲突表，同一篇不要两边都用。');
  out.push('');
  const byEnv = new Map();
  for (const it of items) { if (!byEnv.has(it.环节)) byEnv.set(it.环节, []); byEnv.get(it.环节).push(it); }
  const order = [...ENVS, ...[...byEnv.keys()].filter((k) => !ENVS.includes(k))];
  for (const env of order) {
    const list = byEnv.get(env);
    if (!list?.length) continue;
    out.push(`## ${env}（${list.length} 条）`);
    out.push('');
    out.push('| 编号 | 经验 | 标记 | 换说法 | 备注 | 把握 |');
    out.push('|---|---|---|---|---|---|');
    for (const it of list) {
      out.push(`| ${cell(it.id)} | ${cell(it.经验)} | ${cell(it.标记)} | ${cell(it.换说法)} | ${cell(it.备注)} | ${cell(it.把握)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

function readJson(p) {
  const abs = path.isAbsolute(p) ? p : path.resolve(ROOT, p);
  return JSON.parse(fs.readFileSync(abs, 'utf8').replace(/^﻿/, ''));
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') { a.help = true; continue; }
    if (t.startsWith('--')) { a[t.slice(2)] = argv[i + 1] ?? ''; i++; }
  }
  return a;
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) { process.stdout.write(USAGE); return; }
  const sub = normalizeSubtype(a.subtype);
  if (!sub) { process.stderr.write(`[pick-experience] --subtype 必须是 ${SUBTYPES.join(' / ')} 之一\n${USAGE}`); process.exit(2); }
  const envs = a.env ? a.env.split(/[,，、]/).map((s) => s.trim()).filter(Boolean) : [];
  const bad = envs.filter((e) => !ENVS.includes(e));
  if (bad.length) { process.stderr.write(`[pick-experience] 没有这个环节：${bad.join('、')}（可选：${ENVS.join('、')}）\n`); process.exit(2); }
  let table, tags;
  try {
    table = readJson(a.table || DEFAULT_TABLE);
    tags = readJson(a.tags || DEFAULT_TAGS);
  } catch (e) { process.stderr.write(`[pick-experience] 读库文件出错：${e.message}\n`); process.exit(2); }
  const res = pickExperience(table, tags, { subtype: sub, envs });
  const md = renderMarkdown(res);
  if (a.out) {
    const outAbs = path.resolve(a.out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, md + '\n', 'utf8');
    process.stdout.write(`[pick-experience] ${sub}：${res.total} 条 → ${res.items.length} 条，写入：${outAbs}\n`);
  } else {
    process.stdout.write(md + '\n');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
