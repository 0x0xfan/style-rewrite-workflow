// lib.mjs —— 回稿闭环四个脚本共用的小工具：读文件、切句、数汉字、表格转义、简单参数解析
import fs from 'node:fs';
import path from 'node:path';
import { resolvePath } from '../brief/word-table.mjs';

export { resolvePath };

export const DEFAULT_REGISTRY = 'docs/稿件登记.json';

/** 读文本：去 BOM、统一换行。文件不存在抛 Error（调用方决定退出码）。 */
export function readText(p) {
  const abs = resolvePath(p);
  if (!fs.existsSync(abs)) throw new Error(`文件不存在：${abs}`);
  return fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function writeText(p, s) {
  const abs = resolvePath(p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, s, 'utf8');
  return abs;
}

const CJK_G = /[\u4e00-\u9fff]/g;
export const cjkCount = (s) => (String(s).match(CJK_G) || []).length;

/** 句子字数：去掉标点和空白后的字符数（汉字、数字、字母都算一个） */
export const sentenceLen = (s) => String(s).replace(/[\s，。？！、；：""''「」『』（）()《》〈〉…—\-·,.?!;:"'\[\]【】]/g, '').length;

/**
 * 把一段文本切成句子：按 。？！ 切（切完保留标点），换行也当句界；
 * 没有句末标点的行尾片段也算一句。返回 [{ text, line }]，line 是 1 起的源行号。
 */
export function splitSentences(text) {
  const out = [];
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((line, i) => {
    for (const piece of line.split(/(?<=[。？！])/)) {
      const t = piece.trim();
      if (t) out.push({ text: t, line: i + 1 });
    }
  });
  return out;
}

/** md 表格单元格：| 转义、换行压成空格 */
export const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

/**
 * 通用参数解析：--key value 形式（布尔开关写进 flags 列表）；裸参数进 positional。
 * spec: { flags: ['json'], multi: ['against'] }
 */
export function parseArgs(argv, spec = {}) {
  const flags = new Set(spec.flags || []);
  const multi = new Set(spec.multi || []);
  const a = { positional: [] };
  for (const m of multi) a[m] = [];
  let cur = null;
  for (const t of argv) {
    if (t === '--help' || t === '-h') { a.help = true; continue; }
    if (t.startsWith('--')) {
      const k = t.slice(2);
      if (flags.has(k)) { a[k] = true; cur = null; continue; }
      cur = k;
      if (!multi.has(k)) a[k] = a[k] ?? '';
      continue;
    }
    if (cur) {
      if (multi.has(cur)) a[cur].push(t); else { a[cur] = t; cur = null; }
      continue;
    }
    a.positional.push(t);
  }
  return a;
}

export function loadRegistry(p = DEFAULT_REGISTRY) {
  const abs = resolvePath(p);
  if (!fs.existsSync(abs)) throw new Error(`稿件登记表不存在：${abs}`);
  let data;
  try { data = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { throw new Error(`稿件登记表不是合法 JSON：${abs}（${e.message}）`); }
  if (!Array.isArray(data)) throw new Error(`稿件登记表顶层应该是数组：${abs}`);
  return data;
}

export const today = () => new Date().toISOString().slice(0, 10);
