#!/usr/bin/env node
// screen-check.mjs —— 分镜上屏字过用户校准词表（2026-09-12 起回稿流程必跑）
//
// 为什么要有它：视频项目的分镜生成器会自己编上屏标签（标题、卡片字），不过我们的词表。
// 2026-09-12 两期实测：电影票「三件事讲完 / 九成九好评 / 最后一块」，苹果多开「三件事说清 /
// 先卖后进货 / 开鱼小铺」——口播稿是对的，屏幕上的字把用户判过的词又带回来了。
//
// 用法：node engine/return/screen-check.mjs --film <filmId> [--video-repo <路径>] [--topic-type 虚拟|实物] [--topic <选题>]
// 做法：抽 src/by2/films/<film>/slices/Scene*.tsx 里所有含汉字的字面量（跳过注释行），
//       逐条过 check-words（只看词表命中，不看结构规则），另查分段词「三件事 / 第几块 / 最后一块」。
// 退出码：0 无命中；1 有命中（逐条打印 场景｜上屏字｜换成）；2 用法错。
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, '..', '..');
const a = process.argv.slice(2); const opt = { videoRepo: 'D:/项目仓库/remotion视频制作', topicType: '虚拟' };
for (let i = 0; i < a.length; i++) {
  const k = a[i], v = a[i + 1];
  if (k === '--film') { opt.film = v; i++; } else if (k === '--video-repo') { opt.videoRepo = v; i++; }
  else if (k === '--topic-type') { opt.topicType = v; i++; } else if (k === '--topic') { opt.topic = v; i++; }
  else { console.error(`不认识的参数：${k}`); process.exit(2); }
}
if (!opt.film) { console.error('用法：--film <filmId> [--video-repo <路径>] [--topic-type 虚拟|实物] [--topic <选题>]'); process.exit(2); }
const dir = path.join(opt.videoRepo, 'src', 'by2', 'films', opt.film, 'slices');
if (!fs.existsSync(dir)) { console.error(`找不到分镜目录：${dir}`); process.exit(2); }
const rows = [];
for (const f of fs.readdirSync(dir).filter((x) => /^Scene\d+\.tsx$/.test(x)).sort()) {
  const seen = new Set();
  for (const l of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue;
    for (const m of l.matchAll(/[\u4e00-\u9fff][\u4e00-\u9fff0-9A-Za-z，。、！？：；“”‘’（）·\-— ]*/g)) {
      const t = m[0].trim(); if (t.length < 2 || seen.has(t)) continue; seen.add(t); rows.push({ scene: f.replace('.tsx', ''), text: t });
    }
  }
}
const tmp = path.join(os.tmpdir(), `screen-check-${opt.film}.txt`);
fs.writeFileSync(tmp, rows.map((r) => r.text).join('\n') + '\n');
const args = [path.join(ROOT, 'engine/brief/check-words.mjs'), tmp, '--table', path.join(ROOT, 'docs/用户校准词表.json'), '--topic-type', opt.topicType];
if (opt.topic) args.push('--topic', opt.topic);
const out = spawnSync(process.execPath, args, { encoding: 'utf8' }).stdout || '';
const hits = [];
for (const line of out.split('\n')) {
  const m = line.match(/^第\s*(\d+)\s*行\s+(命中「.*)$/); if (!m) continue;
  const r = rows[Number(m[1]) - 1]; if (r) hits.push(`${r.scene}｜${r.text}｜${m[2]}`);
}
for (const r of rows) if (/[一二两三四五六七八九十几]件事|第[一二三四五]块|最后一块|[二三四五]块[，：、]|妥妥的/.test(r.text)) hits.push(`${r.scene}｜${r.text}｜分段词/装置词：用"点"，不用"块/三件事"；"妥妥的"不用`);
console.log(`[screen-check] ${opt.film}：上屏字 ${rows.length} 条，命中 ${hits.length} 条`);
for (const h of hits) console.log('  ' + h);
process.exit(hits.length ? 1 : 0);
