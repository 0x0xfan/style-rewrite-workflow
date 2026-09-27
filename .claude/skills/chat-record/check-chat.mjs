#!/usr/bin/env node
// check-chat.mjs —— 聊天记录式文案交付前自检（chat-record 技能用）
//
// 用法：
//   node .claude/skills/chat-record/check-chat.mjs <稿件.txt> [--text-out <台词纯文本.txt>]
//
// 做三件事：
//   1. 用视频仓库的真解析器 D:\项目仓库\remotion视频制作\scripts\chat\parse.mjs 解析第一块（=====素材清单===== 之上）。
//      解析器会写 script.json，所以先把它复制到系统临时目录再跑，视频仓库一个字节都不动；跑完删掉临时目录。
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
const SEP = '=====素材清单=====';
const LEFT_OK = ['学员', '粉丝'];
const RIGHT_NAME = '圣矾';
const RIGHT_AVATAR = 'right-shengfan.jpg';
const LEFT_AVATAR = 'left-fa.png';

const args = process.argv.slice(2);
const draft = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--text-out');
if (!draft) {
  console.error('用法：node .claude/skills/chat-record/check-chat.mjs <稿件.txt> [--text-out <台词纯文本.txt>]');
  process.exit(2);
}
if (!fs.existsSync(draft)) { console.error(`找不到稿件：${draft}`); process.exit(2); }
if (!fs.existsSync(PARSER)) { console.error(`找不到视频仓库解析器：${PARSER}`); process.exit(2); }
const textOut = outIdx >= 0 ? args[outIdx + 1] : draft.replace(/\.txt$/i, '') + '.台词.txt';

const errors = [];
const warns = [];

// ── 拆两块 ──
const raw = fs.readFileSync(draft, 'utf8').replace(/^\uFEFF/, '');
const allLines = raw.split(/\r?\n/);
const sepAt = allLines.findIndex((l) => l.trim() === SEP);
if (sepAt < 0) errors.push(`没有「${SEP}」分隔行（交付件必须带素材清单，没用到图也要写「无」）`);
const chatLines = sepAt < 0 ? allLines : allLines.slice(0, sepAt);
const assetLines = sepAt < 0 ? [] : allLines.slice(sepAt + 1).map((l) => l.trim()).filter(Boolean);

// ── 用真解析器解析（在临时目录里跑） ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-record-check-'));
let script;
try {
  const p = path.join(tmp, 'scripts', 'chat');
  fs.mkdirSync(p, { recursive: true });
  fs.copyFileSync(PARSER, path.join(p, 'parse.mjs'));
  const input = path.join(tmp, 'input.txt');
  fs.writeFileSync(input, chatLines.join('\n'), 'utf8');
  const r = spawnSync(process.execPath, [path.join(p, 'parse.mjs'), 'check', input], { encoding: 'utf8' });
  if (r.status !== 0) {
    const out = (r.stderr || '') + (r.stdout || '');
    const msg = out.split('\n').find((l) => /^\s*Error:/.test(l))?.trim() || out.split('\n').find((l) => /找不到|用法/.test(l))?.trim() || out.trim();
    errors.push(`解析器报错：${msg}`);
  } else {
    script = JSON.parse(fs.readFileSync(path.join(tmp, 'src', 'chat', 'films', 'check', 'script.json'), 'utf8'));
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
