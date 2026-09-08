// word-table.mjs —— 用户校准词表的读取 / 过滤 / 渲染（check-words.mjs 与 build-brief.mjs 共用）
//
// 词表在 docs/用户校准词表.json，每条：
//   { id, 禁, 换, 类型, 日期, 用户原话, 来源稿, 录入, 正则?, 位置?, 说明? }
//   - 录入 只有两个值："用户点名" / "主线程预防性"，后者不许冒充前者
//   - 类型 "实物专用" 的条目只在虚拟选题（--topic-type 虚拟）时生效
//   - 正则 给了就按正则匹配，否则按 禁 字段做字面匹配
//   - 位置 "第一行" 表示只查稿件第一行

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_TABLE = 'docs/用户校准词表.json';

export const TYPES = [
  '内部术语', '压缩词', '自造对仗', '书面词', '整齐收口', '经验表用词',
  '套用错', '空包袱', '开头固定句', '旧系列引用', '实物专用',
, '内容判断', '半句话', '不通顺', '借用错', '来源不明', '选题红线', '用词不当'];
export const SOURCES = ['用户点名', '主线程预防性'];

export function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
}

/** 读词表并校验字段；出错抛 Error（调用方决定怎么退出）。 */
export function loadTable(p = DEFAULT_TABLE) {
  const abs = resolvePath(p);
  if (!fs.existsSync(abs)) throw new Error(`词表文件不存在：${abs}`);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    throw new Error(`词表不是合法 JSON：${abs}（${e.message}）`);
  }
  if (!Array.isArray(data)) throw new Error(`词表顶层应该是数组：${abs}`);
  const seen = new Set();
  data.forEach((e, i) => {
    const where = `第 ${i + 1} 条（${e && e.id ? e.id : '无 id'}）`;
    for (const k of ['id', '禁', '换', '类型', '日期', '录入']) {
      if (!e || typeof e[k] !== 'string' || !e[k].trim()) throw new Error(`词表${where}缺字段「${k}」`);
    }
    if (seen.has(e.id)) throw new Error(`词表编号重复：${e.id}`);
    seen.add(e.id);
    if (!TYPES.includes(e.类型)) throw new Error(`词表${where}类型不认识：${e.类型}（可用：${TYPES.join('|')}）`);
    if (!SOURCES.includes(e.录入)) throw new Error(`词表${where}录入只能是 ${SOURCES.join(' / ')}，现在是：${e.录入}`);
    if (e.录入 === '用户点名' && !(e.用户原话 || '').trim()) throw new Error(`词表${where}标了用户点名却没有用户原话`);
    if (e.正则) {
      try { new RegExp(e.正则, 'u'); } catch (err) { throw new Error(`词表${where}正则写错：${err.message}`); }
    }
  });
  return { abs, entries: data };
}

/** 按选题类型过滤：实物专用只对虚拟选题生效。topicType 为空则全留（由调用方标注）。 */
export function filterByTopic(entries, topicType, topicName = '') {
  // 选题红线：带「选题」字段的条目只对同名选题生效（例：京东家政 不写返利）
  let out = entries.filter((e) => !e.选题 || (topicName && topicName.includes(e.选题)));
  if (!topicType) return out;
  if (topicType === '虚拟') return out;
  return out.filter((e) => e.类型 !== '实物专用');
}

/** 把词表渲染成 markdown 表（按类型分组，文档顺序）。 */
export function renderMarkdown(entries, { topicType } = {}) {
  const groups = [];
  for (const e of entries) {
    let g = groups.find((x) => x.type === e.类型);
    if (!g) { g = { type: e.类型, rows: [] }; groups.push(g); }
    g.rows.push(e);
  }
  const esc = (s) => String(s ?? '').replace(/\|/g, '｜').replace(/\r?\n/g, ' ');
  const out = [];
  for (const g of groups) {
    const users = g.rows.filter((r) => r.录入 === '用户点名').length;
    const pre = g.rows.length - users;
    let title = `### ${g.type}（${g.rows.length} 条：用户点名 ${users} / 预防性 ${pre}）`;
    if (g.type === '实物专用') {
      title += topicType === '虚拟'
        ? '　—— 本篇是虚拟选题，这一类生效'
        : '　—— 只对虚拟选题生效';
    }
    out.push(title, '');
    out.push('| 编号 | 禁 | 换成 | 日期 | 录入 | 用户原话 | 来源稿 |');
    out.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const r of g.rows) {
      const ban = r.位置 === '第一行' ? `${r.禁}（只查第一句）` : r.禁;
      out.push(`| ${r.id} | ${esc(ban)} | ${esc(r.换)} | ${r.日期} | ${r.录入} | ${esc(r.用户原话) || '—'} | ${esc(r.来源稿) || '—'} |`);
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}

export function countBySource(entries) {
  const users = entries.filter((e) => e.录入 === '用户点名').length;
  return { total: entries.length, users, preventive: entries.length - users };
}
