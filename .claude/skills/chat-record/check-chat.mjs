#!/usr/bin/env node
// check-chat.mjs —— 聊天记录式文案交付前自检（chat-record 技能用）
//
// 用法：
//   node .claude/skills/chat-record/check-chat.mjs <稿件.txt> [--text-out <台词纯文本.txt>] [--assets <图片目录>]
//
// 做三件事：
//   1. 用视频仓库的真解析器 D:\项目仓库\remotion视频制作\scripts\chat\parse.mjs 解析第一块（=====素材清单===== 之上）。
//      解析器和它依赖的本地文件（相对 import 递归扫描出来的，比如 scripts/assets/lib/ocr.mjs 及其同目录的
//      ocr-win.ps1）都先复制到系统临时目录、按原有相对目录结构摆好再跑，视频仓库一个字节都不动；跑完删掉临时目录。
//      稿子里用了 `圈=` / `放大` 的 `[图片 …]` 标签时，解析器要读真实图片算像素/跑 OCR：先试视频仓库自带的
//      `public/chat/images/`（已交付的产出图，只读），没有的话用 `--assets <目录>` 里的图（按素材清单说明里的
//      文件名/路径提示去 <目录> 下递归找同名文件）。两处都没找到就报错提示交清楚是缺图还是没给 --assets，不
//      去硬跑解析器崩一堆 OCR 报错。
//   2. 按 chat-record 规矩查：角色声明、第一条是左边提问、左边不是买家、条数、图片表情个数、素材清单对得上、
//      方括号标签写错（解析器会把写错的标签静默当成普通台词）。
//   3. 把所有文字气泡和系统灰字抽成一行一句的纯文本（默认 <稿件>.台词.txt），给 check-words / check:compliance / check:draft 用。
//
// 退出码：0 没有错误（可能有提醒）；1 有错误；2 参数、文件或解析器找不到。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PARSER = 'D:/项目仓库/remotion视频制作/scripts/chat/parse.mjs';
const VIDEO_REPO_ROOT = path.resolve(path.dirname(PARSER), '..', '..'); // parse.mjs 自己也是这么算 REPO_ROOT 的
const SEP = '=====素材清单=====';
const LEFT_OK = ['学员', '粉丝'];
const RIGHT_NAME = '圣矾';
const RIGHT_AVATAR = 'right-shengfan.jpg';
const LEFT_AVATAR = 'left-fa.png';

const args = process.argv.slice(2);
const draft = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--text-out');
const assetsIdx = args.indexOf('--assets');
if (!draft) {
  console.error('用法：node .claude/skills/chat-record/check-chat.mjs <稿件.txt> [--text-out <台词纯文本.txt>] [--assets <图片目录>]');
  process.exit(2);
}
if (!fs.existsSync(draft)) { console.error(`找不到稿件：${draft}`); process.exit(2); }
if (!fs.existsSync(PARSER)) { console.error(`找不到视频仓库解析器：${PARSER}`); process.exit(2); }
const textOut = outIdx >= 0 ? args[outIdx + 1] : draft.replace(/\.txt$/i, '') + '.台词.txt';
const assetsDir = assetsIdx >= 0 ? path.resolve(args[assetsIdx + 1]) : null;
if (assetsDir && !fs.existsSync(assetsDir)) { console.error(`--assets 目录不存在：${assetsDir}`); process.exit(2); }

const errors = [];
const warns = [];

// ── 拆两块 ──
const raw = fs.readFileSync(draft, 'utf8').replace(/^\uFEFF/, '');
const allLines = raw.split(/\r?\n/);
const sepAt = allLines.findIndex((l) => l.trim() === SEP);
if (sepAt < 0) errors.push(`没有「${SEP}」分隔行（交付件必须带素材清单，没用到图也要写「无」）`);
const chatLines = sepAt < 0 ? allLines : allLines.slice(0, sepAt);
const assetLines = sepAt < 0 ? [] : allLines.slice(sepAt + 1).map((l) => l.trim()).filter(Boolean);

// ── 依赖递归扫描：从 parse.mjs 出发，找它相对 import 的本地文件，以及同目录被字符串字面量引用的旁系文件
//    （比如 ocr.mjs 里 join(HERE, 'ocr-win.ps1') 这种不是 import、但运行时要读的文件）──
const resolveImportTarget = (fromFile, spec) => {
  let target = path.resolve(path.dirname(fromFile), spec);
  if (!fs.existsSync(target)) {
    for (const ext of ['.mjs', '.js', '/index.mjs', '/index.js']) {
      if (fs.existsSync(target + ext)) { target = target + ext; break; }
    }
  }
  return target;
};

const collectDeps = (entry) => {
  const visited = new Set();
  const files = new Set();
  const queue = [entry];
  while (queue.length) {
    const f = queue.shift();
    if (visited.has(f)) continue;
    visited.add(f);
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) continue;
    files.add(f);
    if (!/\.(mjs|js|cjs)$/i.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    for (const re of [/\bfrom\s+['"](\.[^'"]+)['"]/g, /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g]) {
      let m;
      while ((m = re.exec(src))) queue.push(resolveImportTarget(f, m[1]));
    }
    // 同目录旁系文件：源码里引用的本地文件字面量（.ps1/.json/.cjs/.txt），非 import 但运行时要读
    const litRe = /['"]([\w.-]+\.(?:ps1|json|cjs|txt))['"]/g;
    let lm;
    while ((lm = litRe.exec(src))) {
      const sib = path.join(path.dirname(f), lm[1]);
      if (fs.existsSync(sib)) files.add(sib);
    }
  }
  return files;
};

// ── 图片依赖：扫稿子里所有 [图片 …] 标签，挑出用了 圈=/放大（要读真实像素/跑 OCR）的那些 ──
const imgTagRe = /\[图片\s+([^\]]+)\]/g;
const imageNeeds = new Map(); // file -> needsReal(bool)
{
  let m;
  const chatText = chatLines.join('\n');
  while ((m = imgTagRe.exec(chatText))) {
    const tokens = m[1].trim().split(/\s+/);
    const file = tokens[0];
    const needsReal = tokens.slice(1).some((t) => t.startsWith('圈=') || /^放大/.test(t));
    imageNeeds.set(file, (imageNeeds.get(file) || false) || needsReal);
  }
}
// 素材清单里每个文件名对应的说明文字（用来从说明里的本机路径/真实文件名猜到 --assets 目录下该找哪个文件）
const assetDescByFile = new Map();
for (const l of assetLines) {
  const idx = l.search(/[:：]/);
  if (idx < 0) continue;
  assetDescByFile.set(l.slice(0, idx).trim(), l.slice(idx + 1));
}

const findFileRecursive = (dir, basename) => {
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name === basename) return full;
    }
  }
  return null;
};

// ── 用真解析器解析（在临时目录里跑） ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-record-check-'));
let script;
try {
  // 1) 复制 parse.mjs 及其全部本地依赖，按相对视频仓库根目录的原路径摆好
  const deps = collectDeps(PARSER);
  for (const dep of deps) {
    const rel = path.relative(VIDEO_REPO_ROOT, dep);
    const dest = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(dep, dest);
  }

  // 2) 备齐 [图片 …] 里带 圈=/放大 需要真实图片的文件：先找视频仓库自带产出图（只读，不动它），
  //    再找 --assets 目录（按素材清单说明里出现的文件名提示递归找）
  const missingImages = [];
  for (const [file, needsReal] of imageNeeds) {
    let src = null;
    const prodPath = path.join(VIDEO_REPO_ROOT, 'public', 'chat', 'images', file);
    if (fs.existsSync(prodPath)) src = prodPath;
    if (!src && assetsDir) {
      const desc = assetDescByFile.get(file) || '';
      const hinted = [...desc.matchAll(/[\w.\-/\u4e00-\u9fa5]+\.(?:png|jpe?g)/gi)].map((h) => h[0].split(/[\\/]/).pop());
      const candidates = [...new Set([...hinted, file])];
      for (const cand of candidates) {
        const found = findFileRecursive(assetsDir, cand);
        if (found) { src = found; break; }
      }
    }
    if (src) {
      const destDir = path.join(tmp, 'public', 'chat', 'images');
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, path.join(destDir, file));
    } else if (needsReal) {
      missingImages.push(file);
    }
  }
  if (missingImages.length) {
    if (!assetsDir) {
      errors.push(`稿子里「${missingImages.join('、')}」用了 圈=/放大，需要读真实图片，但视频仓库产出图里没有、也没给 --assets：加上 --assets <图片所在目录> 重新跑（图片目录一般是 research-runs/.../素材/shots 或素材池截图目录）`);
    } else {
      errors.push(`--assets ${assetsDir} 下找不到「${missingImages.join('、')}」对应的图（按素材清单里写的文件名/路径核对一下是不是放错目录了）`);
    }
  } else {
    const p = path.join(tmp, 'scripts', 'chat', 'parse.mjs');
    const input = path.join(tmp, 'input.txt');
    fs.writeFileSync(input, chatLines.join('\n'), 'utf8');
    const r = spawnSync(process.execPath, [p, 'check', input], { encoding: 'utf8' });
    if (r.status !== 0) {
      const out = (r.stderr || '') + (r.stdout || '');
      const msg = out.split('\n').find((l) => /^\s*Error:/.test(l))?.trim() || out.split('\n').find((l) => /找不到|用法/.test(l))?.trim() || out.trim();
      errors.push(`解析器报错：${msg}`);
    } else {
      script = JSON.parse(fs.readFileSync(path.join(tmp, 'src', 'chat', 'films', 'check', 'script.json'), 'utf8'));
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (script) {
  const { speakers, messages } = script;
  const declared = [];
  for (const l of chatLines.map((x) => x.trim()).filter(Boolean)) {
    const m = /^@(左|右)\s+(\S+?)(?:\s+avatar=(\S+))?$/.exec(l);
    if (!m) break;
    declared.push({ side: m[1] === '左' ? 'left' : 'right', name: m[2], avatar: m[3] });
  }
  const left = declared.filter((d) => d.side === 'left');
  const right = declared.filter((d) => d.side === 'right');

  // 角色
  if (left.length !== 1) errors.push(`@左 要正好声明一个角色，现在 ${left.length} 个`);
  if (right.length !== 1) errors.push(`@右 要正好声明一个角色，现在 ${right.length} 个`);
  for (const d of left) {
    if (!LEFT_OK.includes(d.name)) errors.push(`左边角色名「${d.name}」不对：只能是 ${LEFT_OK.join(' / ')}（左边绝不是买家）`);
    if (d.avatar !== LEFT_AVATAR) warns.push(`左边头像是「${d.avatar ?? '（没写）'}」，默认应为 ${LEFT_AVATAR}（用户另指定的除外）`);
  }
  for (const d of right) {
    if (d.name !== RIGHT_NAME) errors.push(`右边角色名「${d.name}」不对：应为 ${RIGHT_NAME}`);
    if (d.avatar !== RIGHT_AVATAR) errors.push(`右边头像是「${d.avatar ?? '（没写）'}」，应为 ${RIGHT_AVATAR}`);
  }
  const declaredNames = new Set(declared.map((d) => d.name));
  for (const s of speakers) {
    if (!declaredNames.has(s.id)) errors.push(`出现没声明的角色「${s.id}」（解析器会默默把它放到左边）：多半是冒号前写错了字`);
  }

  // 第一条
  const first = messages[0];
  const leftName = left[0]?.name;
  if (!first || first.type !== 'text' || first.from !== leftName) {
    errors.push('第一条消息必须是左边角色发的文字提问');
  } else if (!/[？?]|吗|呢|怎么|多少|哪|什么|能不能|是不是|咋/.test(first.text)) {
    warns.push(`第一条「${first.text}」看着不像提问，确认一下`);
  }

  // 条数、图片表情、字数、写错的标签
  if (messages.length < 25 || messages.length > 60) warns.push(`共 ${messages.length} 条消息，提示词要求 25–60 条`);
  const media = messages.filter((m) => m.type === 'sticker' || m.type === 'image');
  if (media.length > 6) errors.push(`表情包 + 图片共 ${media.length} 个，提示词要求不超过 6 个`);
  messages.forEach((m, i) => {
    if (m.type === 'text' && /^\[/.test(m.text)) errors.push(`第 ${i + 1} 条「${m.text}」像是方括号标签写错了，解析器把它当成了普通台词`);
    if (m.type === 'text' && m.text.replace(/\s/g, '').length > 30) warns.push(`第 ${i + 1} 条超过 30 字，拆成几条：${m.text}`);
    if (m.type === 'transfer') warns.push(`第 ${i + 1} 条是转账：学员/粉丝提问的题材里一般用不到，确认金额出自选题卡或用户字幕`);
  });

  // 素材清单对照
  if (sepAt >= 0) {
    const used = new Set(media.map((m) => m.src.split('/').pop()));
    const listed = new Set();
    const noneOnly = assetLines.length === 1 && assetLines[0] === '无';
    if (!noneOnly) {
      for (const l of assetLines) {
        const idx = l.search(/[:：]/);
        if (idx < 0) { errors.push(`素材清单这行缺「文件名：说明」：${l}`); continue; }
        listed.add(l.slice(0, idx).trim());
      }
    }
    for (const f of used) if (!listed.has(f)) errors.push(`文案用了「${f}」，素材清单里没写`);
    for (const f of listed) if (!used.has(f)) warns.push(`素材清单写了「${f}」，文案里没用到`);
    if (noneOnly && used.size) errors.push('素材清单写了「无」，但文案里用了图片或表情');
  }

  // 抽台词纯文本
  const texts = messages.filter((m) => m.type === 'text' || m.type === 'failed' || m.type === 'system').map((m) => m.text);
  fs.writeFileSync(textOut, texts.join('\n') + '\n', 'utf8');
  console.log(`解析通过：${speakers.length} 个角色，${messages.length} 条消息（图片/表情 ${media.length} 个）`);
  console.log(`台词纯文本已写到：${textOut}`);
}

for (const e of errors) console.log(`错误：${e}`);
for (const w of warns) console.log(`提醒：${w}`);
console.log(errors.length ? `结论：${errors.length} 处错误，改完再交。` : `结论：格式和角色都过了${warns.length ? `（${warns.length} 条提醒要人看）` : ''}。`);
process.exit(errors.length ? 1 : 0);
