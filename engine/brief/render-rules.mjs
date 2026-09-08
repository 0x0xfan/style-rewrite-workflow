#!/usr/bin/env node
// render-rules.mjs —— 从 docs/写稿规则.json 生成 docs/写稿规则.md（按类别分节 + 旧门禁处置表）
//
// 用法：node engine/brief/render-rules.mjs [--rules docs/写稿规则.json] [--out docs/写稿规则.md]
// JSON 是唯一真身，.md 别手改；改了 JSON 重跑一遍。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePath } from './word-table.mjs';

export const DEFAULT_RULES = 'docs/写稿规则.json';
export const CATEGORY_ORDER = ['结构', '逻辑', '口播', '味道', '术语', '用户校准', '合规', '跨期'];
export const METHODS = ['words', 'structure', 'leakage', 'repeat', 'compliance', 'manual'];
export const LEVELS = ['退回', '提示'];

/** 读规则表并校验；出错抛 Error。返回 { abs, data, rules }。 */
export function loadRules(p = DEFAULT_RULES) {
  const abs = resolvePath(p);
  if (!fs.existsSync(abs)) throw new Error(`规则表不存在：${abs}`);
  let data;
  try { data = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { throw new Error(`规则表不是合法 JSON：${abs}（${e.message}）`); }
  const rules = Array.isArray(data) ? data : data.规则;
  if (!Array.isArray(rules)) throw new Error(`规则表缺「规则」数组：${abs}`);
  const seen = new Set();
  rules.forEach((r, i) => {
    const where = `第 ${i + 1} 行（${r && r.id ? r.id : '无 id'}）`;
    for (const k of ['id', '类别', '规则', '查法', '来源', '级别']) {
      if (!r || typeof r[k] !== 'string' || !r[k].trim()) throw new Error(`规则表${where}缺字段「${k}」`);
    }
    if (seen.has(r.id)) throw new Error(`规则编号重复：${r.id}`);
    seen.add(r.id);
    if (!CATEGORY_ORDER.includes(r.类别)) throw new Error(`规则表${where}类别不认识：${r.类别}（可用：${CATEGORY_ORDER.join('|')}）`);
    if (!METHODS.includes(r.查法)) throw new Error(`规则表${where}查法不认识：${r.查法}（可用：${METHODS.join('|')}）`);
    if (!LEVELS.includes(r.级别)) throw new Error(`规则表${where}级别只能是 ${LEVELS.join(' / ')}`);
    if (r.参数 !== undefined && (typeof r.参数 !== 'object' || r.参数 === null)) throw new Error(`规则表${where}参数要是对象`);
  });
  return { abs, data, rules };
}

const esc = (s) => String(s ?? '').replace(/\|/g, '｜').replace(/\r?\n/g, ' ');
const paramText = (p) => {
  if (!p || !Object.keys(p).length) return '—';
  return esc(JSON.stringify(p, null, 0).replace(/^\{|\}$/g, '').replace(/","/g, '", "').replace(/"([^"]+)":/g, '$1: '));
};

export function renderRules({ data, rules }) {
  const out = [];
  out.push('# 写稿规则');
  out.push('');
  out.push(`> 由 \`engine/brief/render-rules.mjs\` 从 \`docs/写稿规则.json\` 生成，**别手改这份**，改 JSON 再重跑。建立于 ${data.建立 || '—'}。`);
  out.push('>');
  out.push(`> ${esc(data.说明 || '')}`);
  out.push('');
  out.push('交稿前一条命令：');
  out.push('');
  out.push('```');
  out.push('node engine/brief/check-all.mjs <稿件> --rules docs/写稿规则.json --topic <选题名> --topic-type 虚拟|实物 --chain <事实链> --against <已定稿...>');
  out.push('```');
  out.push('');

  const total = rules.length;
  const byCat = CATEGORY_ORDER.map((c) => ({ c, rows: rules.filter((r) => r.类别 === c) })).filter((g) => g.rows.length);
  out.push(`共 ${total} 条：${byCat.map((g) => `${g.c} ${g.rows.length}`).join(' / ')}；退回 ${rules.filter((r) => r.级别 === '退回').length} / 提示 ${rules.filter((r) => r.级别 === '提示').length}；机器查 ${rules.filter((r) => r.查法 !== 'manual').length} / 人工 ${rules.filter((r) => r.查法 === 'manual').length}。`);
  out.push('');

  byCat.forEach((g, gi) => {
    out.push(`## ${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][gi]}、${g.c}（${g.rows.length} 条）`);
    out.push('');
    out.push('| 编号 | 规则 | 查法 | 参数 | 来源 | 级别 |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const r of g.rows) out.push(`| ${r.id} | ${esc(r.规则)} | ${r.查法} | ${paramText(r.参数)} | ${esc(r.来源)} | **${r.级别}** |`);
    out.push('');
  });

  const disp = data.旧门禁处置 || [];
  out.push(`## ${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][byCat.length]}、旧门禁处置表`);
  out.push('');
  out.push('十道旧门各自现在的地位。`npm test` 里对应的测试全部不动，脚本本身也不删。');
  out.push('');
  out.push('| 门 | 脚本 | 处置 | 现在的地位 | npm test / scripts |');
  out.push('| --- | --- | --- | --- | --- |');
  for (const d of disp) out.push(`| ${esc(d.门)} | \`${esc(d.脚本)}\` | **${esc(d.处置)}** | ${esc(d.现在的地位)} | ${esc(d['npm test'])} |`);
  out.push('');
  return out.join('\n');
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  let rulesPath = DEFAULT_RULES;
  let outPath = 'docs/写稿规则.md';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--rules') rulesPath = argv[++i];
    else if (argv[i] === '--out') outPath = argv[++i];
    else { process.stderr.write(`不认识的参数：${argv[i]}\n`); process.exit(2); }
  }
  let loaded;
  try { loaded = loadRules(rulesPath); } catch (e) { process.stderr.write(`[render-rules] 错误：${e.message}\n`); process.exit(2); }
  const md = renderRules(loaded);
  const outAbs = resolvePath(outPath);
  fs.writeFileSync(outAbs, md + '\n', 'utf8');
  process.stdout.write(`[render-rules] ${loaded.rules.length} 条规则 → ${outAbs}\n`);
}
