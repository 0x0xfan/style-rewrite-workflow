#!/usr/bin/env node
// 按时间点从用户原视频截图 · 给每日写稿流程用
//
// 用法：
//   node engine/collect/srt-frames.mjs --video <mp4> --times "00:01:23,00:02:05" --out <目录> [--offset 0.5]
//
// 背景：写稿 agent 从字幕（.srt）里挑出讲到价格、闲鱼页面、后台、交付过程的时间点，
// 调用本命令截图，截图跟稿子一起交给视频项目当素材。
//
// 设计：
//   - 只用本机 ffmpeg/ffprobe：先 ffprobe 拿视频总时长做边界检查，再逐个时间点用
//     ffmpeg 截一帧（时间点之后加 --offset 秒，躲开字幕切换那一刻的转场/半帧）。
//   - 截帧同一条 ffmpeg 命令顺带用 signalstats 量一下这帧的亮度分布宽度（YHIGH-YLOW）
//     和均值（YAVG），思路借自视频仓库 scripts/render/scan-blank-frames.mjs 判黑帧/白帧
//     的做法（亮度分布很窄 = 画面接近纯色，常见于转场或黑场）——但门槛更松，只做提醒，
//     不做视频仓库那套「连续帧突变」的严格判定。
//   - 每张截图落盘后独立解码校验（magic + IHDR 宽高 + 重新算一遍 SHA-256），复用
//     engine/collect/topic-scan.mjs 里已经测过的 verifyPngFile / verifyPng，不重复写一份。
//   - 视频不存在、任一时间点超出时长、任一 ffmpeg 调用失败：整批失败，非 0 退出，
//     不留下部分截图或看起来像成功的清单文件（先做完全部边界检查再落盘，中途失败
//     就把这次已经写出的文件清掉）。
//   - 第一版不自动打码、不做人脸/文字识别（假装能识别隐私是骗人）。每一帧清单里都
//     标"待人看一眼：昵称、头像、订单号、手机号、浏览器地址栏里的 userId、书签栏"，人工确认要不要打码。

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { verifyPngFile } from './topic-scan.mjs';

// 亮度分布宽度（YHIGH-YLOW）不超过这个值，或均值贴近纯黑/纯白，就标"疑似黑帧或转场"。
// 门槛照抄视频仓库 render/scan-blank-frames.mjs 的默认 FLAT_ABS=12（同一套"整屏接近纯色"判据），
// 均值上下限（10/245）是本脚本自己加的兜底，防止 signalstats 解析不到 YLOW/YHIGH 时漏判。
export const FLAT_SPREAD_ABS = 12;
export const YAVG_LOW = 10;
export const YAVG_HIGH = 245;

// ------------------------------- 参数解析 -------------------------------

export function parseArgs(argv) {
  const args = { offset: 0.5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--video') args.video = argv[++i];
    else if (a === '--times') args.times = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--offset') args.offset = Number(argv[++i]);
  }
  if (!args.video) throw new Error('缺少 --video <mp4>');
  if (!args.times) throw new Error('缺少 --times "00:01:23,00:02:05"');
  if (!args.out) throw new Error('缺少 --out <目录>');
  if (!Number.isFinite(args.offset)) throw new Error('--offset 必须是数字（秒）');
  args.timeList = args.times.split(',').map((s) => s.trim()).filter(Boolean);
  if (!args.timeList.length) throw new Error('--times 解析后没有有效时间点');
  return args;
}

function fail(msg) {
  console.error(`[srt-frames][错误] ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[srt-frames] ${msg}`);
}

// ------------------------------- 时间解析（纯函数） -------------------------------

// 支持 "HH:MM:SS"、"HH:MM:SS.ms"、"MM:SS"、"MM:SS.ms"。不认识的格式直接报错，不猜。
export function parseTimeToSeconds(str) {
  const s = String(str).trim();
  let m = s.match(/^(\d+):([0-5]?\d):([0-5]?\d(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = s.match(/^([0-5]?\d):([0-5]?\d(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^\d+(?:\.\d+)?$/);
  if (m) return Number(s);
  throw new Error(`时间点格式不认识：「${str}」（要 HH:MM:SS 或 MM:SS）`);
}

// 秒数 → 文件名安全的 HH-MM-SS（丢小数，文件名不需要那么精），用来拼 帧-<时分秒>.png。
export function formatClockForFilename(totalSeconds) {
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}-${pad(m)}-${pad(s)}`;
}

// ------------------------------- signalstats 解析（纯函数，输入是 ffmpeg metadata=print 的文本） -------------------------------

// 单帧场景只有一个 frame: 块，取里面的 YLOW/YHIGH/YAVG。解析不到就返回 null 各字段，
// 上层按"没量到"处理（不臆造，宁可漏判也不假装量到了）。
export function parseSignalstats(text) {
  const out = { ylow: null, yhigh: null, yavg: null };
  if (!text) return out;
  for (const line of text.split(/\r?\n/)) {
    const km = line.match(/^lavfi\.signalstats\.([A-Z]+)=(-?[\d.]+)$/);
    if (!km) continue;
    if (km[1] === 'YLOW') out.ylow = Number(km[2]);
    else if (km[1] === 'YHIGH') out.yhigh = Number(km[2]);
    else if (km[1] === 'YAVG') out.yavg = Number(km[2]);
  }
  return out;
}

// 判"疑似黑帧或转场"：亮度分布很窄（画面接近纯色），或均值贴近纯黑/纯白。
// 量不到（ylow/yhigh/yavg 都是 null）时不判疑似，只在原因里说明"未量到亮度数据"。
export function judgeSuspectFrame({ ylow, yhigh, yavg }) {
  if (ylow == null && yhigh == null && yavg == null) {
    return { suspect: false, reason: '未量到亮度数据（signalstats 解析失败），未判定' };
  }
  const spread = ylow != null && yhigh != null ? yhigh - ylow : null;
  if (spread != null && spread <= FLAT_SPREAD_ABS) {
    return { suspect: true, reason: `亮度分布很窄（YHIGH-YLOW=${spread.toFixed(1)} ≤ ${FLAT_SPREAD_ABS}），画面接近纯色，像转场或黑场` };
  }
  if (yavg != null && yavg <= YAVG_LOW) {
    return { suspect: true, reason: `画面均值很暗（YAVG=${yavg.toFixed(1)} ≤ ${YAVG_LOW}），像黑场` };
  }
  if (yavg != null && yavg >= YAVG_HIGH) {
    return { suspect: true, reason: `画面均值很亮（YAVG=${yavg.toFixed(1)} ≥ ${YAVG_HIGH}），像白场/闪光转场` };
  }
  return { suspect: false, reason: null };
}

// ------------------------------- 清单渲染（纯函数） -------------------------------

export function buildManifestJson({ video, offset, frames }) {
  return {
    schema_version: '1.0',
    video,
    offset_seconds: offset,
    generated_at: new Date().toISOString(),
    privacy_note: '待人看一眼：昵称、头像、订单号、手机号、浏览器地址栏里的 userId、书签栏（本脚本不做人脸/文字识别，不自动打码）',
    frames,
  };
}

export function buildManifestMarkdown({ video, offset, frames }) {
  const lines = [];
  lines.push(`# 截图清单 · ${path.basename(video)}`);
  lines.push('');
  lines.push('> **人工检查项**：下面每一帧都待人看一眼——有没有昵称、头像、订单号、手机号、浏览器地址栏里的 userId、书签栏，要不要打码。本脚本不做人脸/文字识别，不会自动打码。');
  lines.push('');
  lines.push(`- 视频：\`${video}\``);
  lines.push(`- 偏移：时间点之后 +${offset}s 截图（躲开字幕切换那一刻的转场）`);
  lines.push('');
  lines.push('| 时间点 | 实际截图时刻 | 文件名 | 宽×高 | 疑似黑帧/转场 | 可能要打码 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const f of frames) {
    const dim = f.width && f.height ? `${f.width}×${f.height}` : '（校验失败，无数据）';
    const suspectCell = f.suspect_blank_or_transition ? `是 — ${f.suspect_reason}` : '否';
    lines.push(`| ${f.requested_time} | ${f.captured_at_seconds.toFixed(2)}s | ${f.file} | ${dim} | ${suspectCell} | 待人工确认 |`);
  }
  return lines.join('\n');
}

// ------------------------------- ffmpeg/ffprobe 调用 -------------------------------

function requireTool(bin) {
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) {
    fail(`PATH 里找不到 ${bin}，装了 ffmpeg 全家桶再试`);
    return false;
  }
  return true;
}

function probeDuration(video) {
  const r = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', video,
  ], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) return null;
  const v = Number(String(r.stdout).trim());
  return Number.isFinite(v) && v > 0 ? v : null;
}

// 抽一帧 + 顺带量亮度分布。stats 文件路径用相对名，cwd 设成截图所在目录，躲开
// Windows 盘符冒号/中文路径把 filter 串解析搞崩的坑（同样的坑视频仓库那边也踩过、
// 也是这么绕开的，见 scripts/render/scan-blank-frames.mjs 里的注释）。
function extractOneFrame({ video, seconds, outPngPath, statsFileName }) {
  const outDir = path.dirname(outPngPath);
  const vf = `signalstats,metadata=print:file=${statsFileName}`;
  const r = spawnSync('ffmpeg', [
    '-hide_banner', '-nostdin', '-y',
    '-ss', String(Math.max(0, seconds)),
    '-i', video,
    '-frames:v', '1',
    '-vf', vf,
    '-q:v', '2',
    path.basename(outPngPath),
  ], { cwd: outDir, encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26 });
  return { ok: r.status === 0 && existsSync(outPngPath), status: r.status, stderr: r.stderr };
}

// ------------------------------- 主流程 -------------------------------

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    fail(e.message);
    return;
  }

  if (!requireTool('ffmpeg') || !requireTool('ffprobe')) return;

  const video = path.resolve(args.video);
  if (!existsSync(video)) {
    fail(`视频不存在：${video}`);
    return;
  }

  const duration = probeDuration(video);
  if (duration == null) {
    fail(`ffprobe 读不到视频时长：${video}（文件可能损坏或不是视频）`);
    return;
  }
  log(`视频时长 ${duration.toFixed(2)}s`);

  // 1) 先把全部时间点解析 + 边界检查过一遍，任何一个不合法就整批不落盘。
  let requests;
  try {
    requests = args.timeList.map((t) => {
      const base = parseTimeToSeconds(t);
      if (base < 0 || base >= duration) {
        throw new Error(`时间点「${t}」（${base.toFixed(2)}s）超出视频时长（${duration.toFixed(2)}s）`);
      }
      let target = base + args.offset;
      let clampedNote = null;
      if (target >= duration) {
        target = Math.max(base, duration - 0.05);
        clampedNote = `offset 顶到片尾，实际截图时刻改为 ${target.toFixed(2)}s`;
      }
      return { requestedTime: t, baseSeconds: base, targetSeconds: target, clampedNote };
    });
  } catch (e) {
    fail(e.message);
    return;
  }

  const outDir = path.resolve(args.out);
  mkdirSync(outDir, { recursive: true });

  // 2) 逐个截图；任一步失败就整批判失败，把这次写出的文件清掉，不留半成品。
  const written = [];
  const frames = [];
  let hardFail = null;
  for (const req of requests) {
    const fileBase = `帧-${formatClockForFilename(req.baseSeconds)}`;
    const pngPath = path.join(outDir, `${fileBase}.png`);
    const statsPath = path.join(outDir, `.${fileBase}.stats.txt`);
    log(`截「${req.requestedTime}」→ ${req.targetSeconds.toFixed(2)}s → ${path.basename(pngPath)}`);
    if (req.clampedNote) log(`  [提醒] ${req.clampedNote}`);

    const res = extractOneFrame({ video, seconds: req.targetSeconds, outPngPath: pngPath, statsFileName: path.basename(statsPath) });
    if (!res.ok) {
      hardFail = `ffmpeg 截「${req.requestedTime}」失败（退出码 ${res.status}）：${String(res.stderr || '').slice(-500)}`;
      break;
    }
    written.push(pngPath);
    if (existsSync(statsPath)) written.push(statsPath);

    const verify = verifyPngFile(pngPath);
    if (!verify.ok) {
      hardFail = `「${req.requestedTime}」截图校验失败：${verify.reason}`;
      break;
    }

    const statsText = existsSync(statsPath) ? readFileSync(statsPath, 'utf8') : '';
    const stats = parseSignalstats(statsText);
    const judged = judgeSuspectFrame(stats);

    frames.push({
      requested_time: req.requestedTime,
      requested_seconds: Number(req.baseSeconds.toFixed(3)),
      captured_at_seconds: req.targetSeconds,
      offset_applied: args.offset,
      offset_note: req.clampedNote,
      file: `${fileBase}.png`,
      width: verify.width,
      height: verify.height,
      bytes: verify.bytes,
      sha256: verify.sha256,
      luma: stats,
      suspect_blank_or_transition: judged.suspect,
      suspect_reason: judged.reason,
      needs_manual_privacy_check: true,
    });
  }

  // 清掉 ffmpeg 产的 stats 临时文件（不管成功失败都不需要留在产物目录里）
  for (const p of written) {
    if (p.endsWith('.stats.txt') && existsSync(p)) {
      try { rmSync(p); } catch { /* 清不掉不影响主结果，不因此报错 */ }
    }
  }

  if (hardFail) {
    // 整批失败：把这次写出的截图也清掉，不留下"看起来完整但其实没截完"的目录。
    for (const p of written) {
      if (existsSync(p)) {
        try { rmSync(p); } catch { /* 忽略清理失败，报错信息已经足够 */ }
      }
    }
    fail(`${hardFail}\n本次已截的 ${frames.length} 张一并撤回，不留半成品。`);
    return;
  }

  const manifestJson = buildManifestJson({ video, offset: args.offset, frames });
  const manifestMd = buildManifestMarkdown({ video, offset: args.offset, frames });
  writeFileSync(path.join(outDir, '帧清单.json'), JSON.stringify(manifestJson, null, 2), 'utf8');
  writeFileSync(path.join(outDir, '帧清单.md'), manifestMd, 'utf8');

  const suspectCount = frames.filter((f) => f.suspect_blank_or_transition).length;
  log(`完成：${frames.length} 张截图，${suspectCount} 张疑似黑帧/转场（清单已标注）`);
  log(`产物写出：${path.join(outDir, '帧清单.json')}`);
  log(`产物写出：${path.join(outDir, '帧清单.md')}`);
  process.exit(0);
}

const isMain = (() => {
  try {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] || '');
  } catch {
    return false;
  }
})();
if (isMain) {
  main().catch((e) => {
    console.error('[srt-frames][致命]', e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
