#!/usr/bin/env node
// srt-find：按期号在 NAS 找用户自己视频的 SRT 和原片 mp4，把 SRT 转成带时间戳的纯文本 字幕.txt。
//
// 用法：
//   node engine/brief/srt-find.mjs --episode 47 --out "research-runs/每日/<工作目录>"
//   可选 --root <SRT 根目录>（默认 NAS 缩放-剪辑导出）
//
// 退出码：
//   0  找到唯一 SRT，字幕.txt 已写；mp4 找到唯一一个，或确实没有（会如实打印"没找到 mp4"）
//   1  参数错 / 找不到这一期的目录 / 目录有多个 / 没有 SRT / SRT 有多个 / SRT 解析不出内容
//   3  SRT 正常（字幕.txt 已写），但 mp4 有多个候选、没有和 SRT 同名的，不猜，列出来交人定
//
// 只读 NAS，只往 --out 写 字幕.txt。

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ROOT = '//Zqkj_nas/一楼4t/办公/B站方面/缩放-剪辑导出';

// ---------- 纯函数 ----------

export function parseArgs(argv) {
  const out = { episode: null, out: null, root: DEFAULT_ROOT };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--episode') { out.episode = v; i++; }
    else if (k === '--out') { out.out = v; i++; }
    else if (k === '--root') { out.root = v; i++; }
  }
  if (!out.episode || !/^\d+$/.test(String(out.episode).trim())) {
    throw new Error('缺 --episode <期号>（纯数字，例如 47）');
  }
  if (!out.out) throw new Error('缺 --out <工作目录>');
  out.episode = String(Number(out.episode.trim()));
  return out;
}

/** 目录名是不是这一期：`47.淘客`、`47淘客`、`47-淘客`、`47`；`147.x`、`4.x` 不算。 */
export function matchEpisodeName(name, episode) {
  const m = /^0*(\d+)/.exec(name);
  return !!m && m[1] === String(Number(episode));
}

/** 期名：去掉期号和分隔符。`47.淘客` → `淘客`。 */
export function episodeTitle(name) {
  return name.replace(/^0*\d+[.\-_ 、．\s]*/, '').trim() || name;
}

/** 按字节解码：UTF-8（含 BOM）/ UTF-16 LE/BE BOM / 不是合法 UTF-8 时退回 GBK。 */
export function decodeText(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) buf = buf.subarray(3);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('gbk').decode(buf);
  }
}

function tsToMs(h, m, s, ms) {
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(String(ms).padEnd(3, '0').slice(0, 3));
}

/** 解析 SRT 文本 → [{ index, startMs, endMs, text }]。多行字幕合成一行，去掉 <i> 之类标签和 {\an8} 之类样式。 */
export function parseSrt(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const blocks = src.split(/\n\s*\n/);
  const cues = [];
  const timeRe = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const ti = lines.findIndex((l) => timeRe.test(l));
    if (ti === -1) continue;
    const m = timeRe.exec(lines[ti]);
    const body = lines.slice(ti + 1)
      .map((l) => l.replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!body) continue;
    const idx = ti > 0 && /^\d+$/.test(lines[ti - 1]) ? Number(lines[ti - 1]) : cues.length + 1;
    cues.push({
      index: idx,
      startMs: tsToMs(m[1], m[2], m[3], m[4]),
      endMs: tsToMs(m[5], m[6], m[7], m[8]),
      text: body,
    });
  }
  return cues;
}

/** 毫秒 → `HH:MM:SS`（向下取整到秒）。 */
export function formatTs(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** cues → 字幕.txt 正文：一行一条 `[00:01:23] 原话`。 */
export function cuesToTranscript(cues) {
  return cues.map((c) => `[${formatTs(c.startMs)}] ${c.text}`).join('\n') + (cues.length ? '\n' : '');
}

/**
 * 在一期目录的文件列表里挑 SRT 和 mp4。
 * files：相对这一期目录的路径（正斜杠）。
 * 返回 { srt: {status:'ok'|'none'|'many', pick, candidates}, mp4: {status:'same-name'|'only-one'|'none'|'many', pick, candidates} }
 */
export function pickFiles(files) {
  const norm = files.map((f) => f.replace(/\\/g, '/'));
  const srts = norm.filter((f) => extname(f).toLowerCase() === '.srt');
  const mp4s = norm.filter((f) => extname(f).toLowerCase() === '.mp4');
  const srt = { status: 'none', pick: null, candidates: srts };
  if (srts.length === 1) { srt.status = 'ok'; srt.pick = srts[0]; }
  else if (srts.length > 1) srt.status = 'many';

  const mp4 = { status: 'none', pick: null, candidates: [] };
  if (srt.pick) {
    const dir = dirOf(srt.pick);
    const stem = stemOf(srt.pick);
    const same = mp4s.find((f) => dirOf(f) === dir && stemOf(f) === stem);
    const sameDir = mp4s.filter((f) => dirOf(f) === dir);
    if (same) { mp4.status = 'same-name'; mp4.pick = same; mp4.candidates = [same]; }
    else if (sameDir.length === 1) { mp4.status = 'only-one'; mp4.pick = sameDir[0]; mp4.candidates = sameDir; }
    else if (sameDir.length > 1) { mp4.status = 'many'; mp4.candidates = sameDir; }
    else if (mp4s.length) { mp4.status = 'many'; mp4.candidates = mp4s; } // 别的子目录里有 mp4，不猜
  } else {
    mp4.candidates = mp4s;
  }
  return { srt, mp4 };
}

function dirOf(p) { const i = p.lastIndexOf('/'); return i === -1 ? '' : p.slice(0, i); }
function stemOf(p) { const b = p.slice(p.lastIndexOf('/') + 1); const e = b.lastIndexOf('.'); return e === -1 ? b : b.slice(0, e); }

// ---------- 读 NAS ----------

function listFilesRecursive(dir, maxDepth = 4, prefix = '') {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (maxDepth > 1) out.push(...listFilesRecursive(join(dir, e.name), maxDepth - 1, rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function probeDurationSec(file) {
  try {
    const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8', timeout: 60000 });
    if (r.status !== 0) return null;
    const n = Number(String(r.stdout).trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function fmtDur(sec) {
  if (sec == null) return '未知';
  return `${formatTs(sec * 1000)}（约 ${Math.round(sec / 60)} 分钟）`;
}

export function run(argv, log = console.log, err = console.error) {
  let args;
  try { args = parseArgs(argv); } catch (e) { err(`参数错：${e.message}`); return 1; }
  const root = args.root;
  let top;
  try { top = readdirSync(root, { withFileTypes: true }); } catch (e) { err(`读不到 SRT 根目录：${root}（${e.message}）`); return 1; }

  const dirs = top.filter((e) => e.isDirectory() && matchEpisodeName(e.name, args.episode)).map((e) => e.name);
  const looseMp4 = top.filter((e) => e.isFile() && matchEpisodeName(e.name, args.episode) && extname(e.name).toLowerCase() === '.mp4').map((e) => e.name);

  if (dirs.length === 0) {
    err(`第 ${args.episode} 期：根目录下没有以"${args.episode}."开头的文件夹，找不到 SRT。`);
    if (looseMp4.length) err(`根目录下有这一期的 mp4（没有字幕）：\n  ${looseMp4.join('\n  ')}`);
    return 1;
  }
  if (dirs.length > 1) {
    err(`第 ${args.episode} 期：有 ${dirs.length} 个候选文件夹，不猜，请指定：\n  ${dirs.join('\n  ')}`);
    return 1;
  }

  const epDirName = dirs[0];
  const epDir = join(root, epDirName);
  const files = listFilesRecursive(epDir);
  const { srt, mp4 } = pickFiles(files);

  if (srt.status === 'none') {
    err(`第 ${args.episode} 期（${epDirName}）：文件夹里没有 .srt。`);
    if (mp4.candidates.length) err(`只有 mp4：\n  ${mp4.candidates.join('\n  ')}`);
    return 1;
  }
  if (srt.status === 'many') {
    err(`第 ${args.episode} 期（${epDirName}）：有 ${srt.candidates.length} 个 .srt，不猜，请人定：\n  ${srt.candidates.join('\n  ')}`);
    return 1;
  }

  const srtPath = `${root}/${epDirName}/${srt.pick}`;
  const cues = parseSrt(decodeText(readFileSync(srtPath)));
  if (cues.length === 0) { err(`SRT 解析不出任何字幕：${srtPath}`); return 1; }

  mkdirSync(args.out, { recursive: true });
  const txtPath = join(args.out, '字幕.txt');
  writeFileSync(txtPath, cuesToTranscript(cues), 'utf8');

  const srtDur = cues[cues.length - 1].endMs / 1000;
  const chars = cues.reduce((n, c) => n + c.text.replace(/\s/g, '').length, 0);

  log(`期号：${args.episode}`);
  log(`期名：${episodeTitle(epDirName)}（文件夹 ${epDirName}）`);
  log(`SRT：${srtPath}`);
  let code = 0;
  if (mp4.pick) {
    const mp4Path = `${root}/${epDirName}/${mp4.pick}`;
    const how = mp4.status === 'same-name' ? '和 SRT 同名' : '和 SRT 同目录唯一一个 mp4，名字不同，请核对';
    log(`mp4：${mp4Path}（${how}）`);
    log(`时长：SRT 最后一条 ${fmtDur(srtDur)}；mp4 ${fmtDur(probeDurationSec(mp4Path))}`);
  } else if (mp4.status === 'many') {
    log(`mp4：有 ${mp4.candidates.length} 个候选，没有和 SRT 同名的，不猜：`);
    for (const c of mp4.candidates) log(`  ${root}/${epDirName}/${c}`);
    log(`时长：SRT 最后一条 ${fmtDur(srtDur)}`);
    code = 3;
  } else {
    log('mp4：没找到（这一期文件夹里没有 mp4，不能从原片截图）');
    log(`时长：SRT 最后一条 ${fmtDur(srtDur)}`);
  }
  log(`字幕：${cues.length} 条，约 ${chars} 字 → ${resolve(txtPath)}`);
  return code;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) process.exitCode = run(process.argv.slice(2));
