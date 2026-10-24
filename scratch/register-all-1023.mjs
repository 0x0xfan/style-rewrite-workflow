import fs from 'node:fs';
import path from 'node:path';
import { loadRegistry } from '../engine/return/lib.mjs';
import { saveRegistry } from '../engine/return/registry.mjs';

const entries = loadRegistry();

const items = [
  {
    id: "20261023-AI账号拼车-black-yellow-v2-h",
    topic: "AI账号拼车",
    film: "ai-pinche-qian17",
    style: "小Lin",
    version: "AI账号拼车-black-yellow-v2-h",
    draft: "Z:/素材生成库/ai文案/待审文案/AI账号拼车/20261023-AI账号拼车-black-yellow-v2-h.txt",
    angle: "风格-小Lin",
    date: "2026-10-23",
    note: "风格 小Lin；黑黄 横版 5.5min；1687字",
    accountHeader: "### 黑黄 · black-yellow-v2 · 横版（h）"
  },
  {
    id: "20261023-商业计划书BP代写-lime-capsule-h",
    topic: "商业计划书BP代写",
    film: "chuangye-jihuashu",
    style: "嘴替",
    version: "商业计划书BP代写-lime-capsule-h",
    draft: "Z:/素材生成库/ai文案/待审文案/商业计划书BP代写/20261023-商业计划书BP代写-lime-capsule-h.txt",
    angle: "风格-嘴替",
    date: "2026-10-23",
    note: "风格 嘴替；荧光绿 横版 4.5min；1251字",
    accountHeader: "### 荧光绿 · lime-capsule · 横版（h）"
  },
  {
    id: "20261023-钩织-signature-wall-h",
    topic: "钩织",
    film: "topic-mvel3b4v",
    style: "老友",
    version: "钩织-signature-wall-h",
    draft: "Z:/素材生成库/ai文案/待审文案/钩织/20261023-钩织-signature-wall-h.txt",
    angle: "风格-老友",
    date: "2026-10-23",
    note: "风格 老友；署名墙 横版 6.5min；1994字",
    accountHeader: "### 署名墙 · signature-wall · 横版（h）"
  },
  {
    id: "20261023-微信聊天记录导出-ledger-desk-h",
    topic: "微信聊天记录导出",
    film: "liaotian-jilu-daochu",
    style: "钱十七",
    version: "微信聊天记录导出-ledger-desk-h",
    draft: "Z:/素材生成库/ai文案/待审文案/微信聊天记录导出/20261023-微信聊天记录导出-ledger-desk-h.txt",
    angle: "风格-钱十七",
    date: "2026-10-23",
    note: "风格 钱十七；对账台 横版 5.0min；1394字",
    accountHeader: "### 对账台 · ledger-desk · 横版（h）"
  },
  {
    id: "20261023-安卓连点器-blueprint-h",
    topic: "安卓连点器",
    film: "topic-mveyf9yv",
    style: "老王",
    version: "安卓连点器-blueprint-h",
    draft: "Z:/素材生成库/ai文案/待审文案/安卓连点器/20261023-安卓连点器-blueprint-h.txt",
    angle: "风格-老王",
    date: "2026-10-23",
    note: "风格 老王；蓝图拆解 横版 7.5min；2239字",
    accountHeader: "### 蓝图拆解 · blueprint · 横版（h）"
  },
  {
    id: "20261023-民间鬼故事-pixel-arcade-h",
    topic: "民间鬼故事",
    film: "topic-mveydvi9",
    style: "半佛",
    version: "民间鬼故事-pixel-arcade-h",
    draft: "Z:/素材生成库/ai文案/待审文案/民间鬼故事/20261023-民间鬼故事-pixel-arcade-h.txt",
    angle: "风格-半佛",
    date: "2026-10-23",
    note: "风格 半佛；像素街机 横版 8.5min；2507字",
    accountHeader: "### 像素街机 · pixel-arcade · 横版（h）"
  },
  {
    id: "20261023-手抄报模板-black-yellow-v2-v",
    topic: "手抄报模板",
    film: "topic-mv97gi1y",
    style: "常规",
    version: "手抄报模板-black-yellow-v2-v",
    draft: "Z:/素材生成库/ai文案/待审文案/手抄报模板/20261023-手抄报模板-black-yellow-v2-v.txt",
    angle: "A1痛点反差流",
    date: "2026-10-23",
    note: "黑黄 竖版 1.5min；443字",
    accountHeader: "### 黑黄 · black-yellow-v2 · 竖版（v）"
  },
  {
    id: "20261023-拍照姿势-lime-capsule-v",
    topic: "拍照姿势",
    film: "topic-mvarsxuz",
    style: "常规",
    version: "拍照姿势-lime-capsule-v",
    draft: "Z:/素材生成库/ai文案/待审文案/拍照姿势/20261023-拍照姿势-lime-capsule-v.txt",
    angle: "A1痛点反差流",
    date: "2026-10-23",
    note: "荧光绿 竖版 2.0min；514字",
    accountHeader: "### 荧光绿 · lime-capsule · 竖版（v）"
  },
  {
    id: "20261023-证件照换底换衣服-signature-wall-v",
    topic: "证件照换底换衣服",
    film: "topic-mv97kgtz",
    style: "常规",
    version: "证件照换底换衣服-signature-wall-v",
    draft: "Z:/素材生成库/ai文案/待审文案/证件照换底换衣服/20261023-证件照换底换衣服-signature-wall-v.txt",
    angle: "A1反差型+闲鱼数据钩子",
    date: "2026-10-23",
    note: "署名墙 竖版 1.0min；322字",
    accountHeader: "### 署名墙 · signature-wall · 竖版（v）"
  },
  {
    id: "20261023-四六级词汇-ledger-desk-v",
    topic: "四六级词汇",
    film: "siliuji-cihui",
    style: "常规",
    version: "四六级词汇-ledger-desk-v",
    draft: "Z:/素材生成库/ai文案/待审文案/四六级词汇/20261023-四六级词汇-ledger-desk-v.txt",
    angle: "A1反差型+闲鱼数据钩子",
    date: "2026-10-23",
    note: "对账台 竖版 2.5min；717字",
    accountHeader: "### 对账台 · ledger-desk · 竖版（v）"
  },
  {
    id: "20261023-网盘扩容-blueprint-v",
    topic: "网盘扩容",
    film: "topic-mveycs7q",
    style: "常规",
    version: "网盘扩容-blueprint-v",
    draft: "Z:/素材生成库/ai文案/待审文案/网盘扩容/20261023-网盘扩容-blueprint-v.txt",
    angle: "A3拆一个细节型+信息差开头",
    date: "2026-10-23",
    note: "蓝图拆解 竖版 1.5min；476字",
    accountHeader: "### 蓝图拆解 · blueprint · 竖版（v）"
  },
  {
    id: "20261023-解压视频-pixel-arcade-v",
    topic: "解压视频",
    film: "topic-mv97f2ll",
    style: "常规",
    version: "解压视频-pixel-arcade-v",
    draft: "Z:/素材生成库/ai文案/待审文案/解压视频/20261023-解压视频-pixel-arcade-v.txt",
    angle: "A3拆一个细节型+信息差开头",
    date: "2026-10-23",
    note: "像素街机 竖版 2.0min；585字",
    accountHeader: "### 像素街机 · pixel-arcade · 竖版（v）"
  },
  {
    id: "20261023-电脑投屏软件-chat-v",
    topic: "电脑投屏软件",
    film: "touping-ruanjian",
    style: "常规",
    version: "电脑投屏软件-chat-v",
    draft: "Z:/素材生成库/ai文案/待审文案/电脑投屏软件/20261023-电脑投屏软件-chat-v.txt",
    angle: "聊天记录-产品拆解",
    date: "2026-10-23",
    note: "聊天记录 竖版 1.5min；443字；产品拆解",
    accountHeader: "### 聊天记录 · chat · 竖版（v）"
  }
];

let added = 0;
for (const it of items) {
  if (entries.some(e => e.id === it.id)) {
    console.log(`跳过已存在: ${it.id}`);
    continue;
  }
  entries.push({
    id: it.id,
    选题: it.topic,
    filmId: it.film,
    风格: it.style,
    版本: it.version,
    稿件路径: it.draft,
    配料包: "",
    事实链: "",
    事实卡: "",
    素材目录: "",
    开头角度: it.angle,
    交付日期: it.date,
    状态: "已交付待回稿",
    备注: it.note
  });
  added++;
}

saveRegistry(entries);
console.log(`成功新增登记: ${added} 条，当前总计 ${entries.length} 条。`);

// 更新 docs/每日/账号选题台账.md
const ledgerPath = path.resolve('docs/每日/账号选题台账.md');
let ledger = fs.readFileSync(ledgerPath, 'utf8');

for (const it of items) {
  const lineToAdd = `| 2026-10-23 | ${it.topic} | ${it.film} | ${path.basename(it.draft)} | 存稿 |`;
  if (ledger.includes(path.basename(it.draft))) {
    console.log(`台账已包含: ${path.basename(it.draft)}`);
    continue;
  }
  
  const headerIdx = ledger.indexOf(it.accountHeader);
  if (headerIdx === -1) {
    console.error(`未找到表头: ${it.accountHeader}`);
    continue;
  }

  // 找到该表头后的下一个表格最后一行（即下一个 --- 或空行或下一个 ##/### 前）
  const nextSectionIdx = ledger.indexOf('\n---', headerIdx);
  if (nextSectionIdx === -1) {
    console.error(`未找到下一节分隔符: ${it.accountHeader}`);
    continue;
  }

  // 在 nextSectionIdx 前插入行
  const before = ledger.slice(0, nextSectionIdx).trimEnd();
  const after = ledger.slice(nextSectionIdx);
  ledger = `${before}\n${lineToAdd}\n${after}`;
  console.log(`台账成功追加: [${it.accountHeader}] -> ${it.topic}`);
}

fs.writeFileSync(ledgerPath, ledger, 'utf8');
console.log('台账文件更新完成！');
