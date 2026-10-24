import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const all16 = [
  // Batch 1: Horizontal 6
  {
    id: '20261012-拼多多砍价-black-yellow-v2-h',
    topic: '拼多多砍价',
    slug: 'pin-duo-duo-kan-jia',
    skin: 'black-yellow-v2',
    o: 'h',
    sectionHeader: '### 黑黄 · black-yellow-v2 · 横版（h）',
    fileName: '20261012-拼多多砍价-black-yellow-v2-h.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/拼多多砍价/20261012-拼多多砍价-black-yellow-v2-h.txt',
    style: '小Lin',
    angle: '电商平台拉新心理博弈与一元代砍差价',
    note: '横版长稿5min；账号 black-yellow-v2-h；风格 小Lin；NAS Z:/素材生成库/ai文案/待审文案/拼多多砍价/20261012-拼多多砍价-black-yellow-v2-h.txt'
  },
  {
    id: '20261012-减脂计划-lime-capsule-h',
    topic: '减脂计划',
    slug: 'jianzhi-jihua',
    skin: 'lime-capsule',
    o: 'h',
    sectionHeader: '### 荧光绿 · lime-capsule · 横版（h）',
    fileName: '20261012-减脂计划-lime-capsule-h.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/减脂计划/20261012-减脂计划-lime-capsule-h.txt',
    style: '嘴替',
    angle: '专治减脂幻想撕开遮羞布与两规格轻交付',
    note: '横版长稿5min；账号 lime-capsule-h；风格 嘴替；NAS Z:/素材生成库/ai文案/待审文案/减脂计划/20261012-减脂计划-lime-capsule-h.txt'
  },
  {
    id: '20261012-老照片修复-signature-wall-h',
    topic: '老照片修复',
    slug: 'lao-zhao-pian-xiu-fu',
    skin: 'signature-wall',
    o: 'h',
    sectionHeader: '### 署名墙 · signature-wall · 横版（h）',
    fileName: '20261012-老照片修复-signature-wall-h.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/老照片修复/20261012-老照片修复-signature-wall-h.txt',
    style: '老友',
    angle: '像老朋友拉家常掏心窝子聊老照片岁月回忆人情小生意',
    note: '横版长稿5min；账号 signature-wall-h；风格 老友；NAS Z:/素材生成库/ai文案/待审文案/老照片修复/20261012-老照片修复-signature-wall-h.txt'
  },
  {
    id: '20261012-电影票代买-ledger-desk-h',
    topic: '电影票代买',
    slug: 'dianyingpiao-daimai',
    skin: 'ledger-desk',
    o: 'h',
    sectionHeader: '### 对账台 · ledger-desk · 横版（h）',
    fileName: '20261012-电影票代买-ledger-desk-h.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/电影票代买/20261012-电影票代买-ledger-desk-h.txt',
    style: '钱十七',
    angle: '在闲鱼上帮人代买电影票能赚钱',
    note: '横版长稿5min；账号 ledger-desk-h；风格 钱十七；NAS Z:/素材生成库/ai文案/待审文案/电影票代买/20261012-电影票代买-ledger-desk-h.txt'
  },
  {
    id: '20261012-codex安装-blueprint-h',
    topic: 'codex安装',
    slug: 'codex-anzhuang',
    skin: 'blueprint',
    o: 'h',
    sectionHeader: '### 蓝图拆解 · blueprint · 横版（h）',
    fileName: '20261012-codex安装-blueprint-h.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/codex安装/20261012-codex安装-blueprint-h.txt',
    style: '老王',
    angle: '极客工程拆解软件环境部署与标准化交付',
    note: '横版长稿5min；账号 blueprint-h；风格 老王；NAS Z:/素材生成库/ai文案/待审文案/codex安装/20261012-codex安装-blueprint-h.txt'
  },
  {
    id: '20261012-网盘拉新-pixel-arcade-h',
    topic: '网盘拉新',
    slug: 'wangpan-laxin',
    skin: 'pixel-arcade',
    o: 'h',
    sectionHeader: '### 像素街机 · pixel-arcade · 横版（h）',
    fileName: '20261012-网盘拉新-pixel-arcade-h.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/网盘拉新/20261012-网盘拉新-pixel-arcade-h.txt',
    style: '半佛',
    angle: '荒诞魔幻拆解互联网大厂拉新九元补贴管道生意',
    note: '横版长稿5min；账号 pixel-arcade-h；风格 半佛；NAS Z:/素材生成库/ai文案/待审文案/网盘拉新/20261012-网盘拉新-pixel-arcade-h.txt'
  },

  // Batch 2: Vertical 6 skin
  {
    id: '20261012-城市年鉴-black-yellow-v2-v',
    topic: '城市年鉴',
    slug: 'chengshi-nianjian',
    skin: 'black-yellow-v2',
    o: 'v',
    sectionHeader: '### 黑黄 · black-yellow-v2 · 竖版（v）',
    fileName: '20261012-城市年鉴-black-yellow-v2-v.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/城市年鉴/20261012-城市年鉴-black-yellow-v2-v.txt',
    style: '常规',
    angle: '高校论文数据现成表格一块五进货转卖',
    note: '竖版短视频1-2min；账号 black-yellow-v2-v；NAS Z:/素材生成库/ai文案/待审文案/城市年鉴/20261012-城市年鉴-black-yellow-v2-v.txt'
  },
  {
    id: '20261012-驾考资料-lime-capsule-v',
    topic: '驾考资料',
    slug: 'jiakao-ziliao',
    skin: 'lime-capsule',
    o: 'v',
    sectionHeader: '### 荧光绿 · lime-capsule · 竖版（v）',
    fileName: '20261012-驾考资料-lime-capsule-v.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/驾考资料/20261012-驾考资料-lime-capsule-v.txt',
    style: '常规',
    angle: '科一科四摩托车速记口诀自动发货铺品',
    note: '竖版短视频1-2min；账号 lime-capsule-v；NAS Z:/素材生成库/ai文案/待审文案/驾考资料/20261012-驾考资料-lime-capsule-v.txt'
  },
  {
    id: '20261012-苹果多开分身-signature-wall-v',
    topic: '苹果多开分身',
    slug: 'pingguo-duokai',
    skin: 'signature-wall',
    o: 'v',
    sectionHeader: '### 署名墙 · signature-wall · 竖版（v）',
    fileName: '20261012-苹果多开分身-signature-wall-v.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/苹果多开分身/20261012-苹果多开分身-signature-wall-v.txt',
    style: '常规',
    angle: '苹果微信多开进一块卖八块系统壁垒刚需',
    note: '竖版短视频1-2min；账号 signature-wall-v；NAS Z:/素材生成库/ai文案/待审文案/苹果多开分身/20261012-苹果多开分身-signature-wall-v.txt'
  },
  {
    id: '20261012-海底捞券-ledger-desk-v',
    topic: '海底捞券',
    slug: 'haidilao-quan',
    skin: 'ledger-desk',
    o: 'v',
    sectionHeader: '### 对账台 · ledger-desk · 竖版（v）',
    fileName: '20261012-海底捞券-ledger-desk-v.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/海底捞券/20261012-海底捞券-ledger-desk-v.txt',
    style: '常规',
    angle: '海底捞打折领券链接无本买卖秒级发货',
    note: '竖版短视频1-2min；账号 ledger-desk-v；NAS Z:/素材生成库/ai文案/待审文案/海底捞券/20261012-海底捞券-ledger-desk-v.txt'
  },
  {
    id: '20261012-抖音续火花代充-blueprint-v',
    topic: '抖音续火花代充',
    slug: 'douyin-xuhuohua',
    skin: 'blueprint',
    o: 'v',
    sectionHeader: '### 蓝图拆解 · blueprint · 竖版（v）',
    fileName: '20261012-抖音续火花代充-blueprint-v.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/抖音续火花代充/20261012-抖音续火花代充-blueprint-v.txt',
    style: '常规',
    angle: '年轻人社交连续性一毛进两块五卖差价',
    note: '竖版短视频1-2min；账号 blueprint-v；NAS Z:/素材生成库/ai文案/待审文案/抖音续火花代充/20261012-抖音续火花代充-blueprint-v.txt'
  },
  {
    id: '20261012-戏曲资源-pixel-arcade-v',
    topic: '戏曲资源',
    slug: 'xiqu-ziyuan',
    skin: 'pixel-arcade',
    o: 'v',
    sectionHeader: '### 像素街机 · pixel-arcade · 竖版（v）',
    fileName: '20261012-戏曲资源-pixel-arcade-v.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/戏曲资源/20261012-戏曲资源-pixel-arcade-v.txt',
    style: '常规',
    angle: '银发群体长辈经典老戏名家唱段网盘发货',
    note: '竖版短视频1-2min；账号 pixel-arcade-v；NAS Z:/素材生成库/ai文案/待审文案/戏曲资源/20261012-戏曲资源-pixel-arcade-v.txt'
  },

  // Batch 3: Chat + 3 Selfies
  {
    id: '20261012-买家一开口就问最低多少该怎么回-chat-v',
    topic: '买家一开口就问最低多少该怎么回',
    slug: 'maijia-yikaikou-zuidi-01',
    skin: 'chat',
    o: 'v',
    sectionHeader: '### 聊天记录 · chat · 竖版（v）',
    fileName: '20261012-买家一开口就问最低多少该怎么回-chat-v.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/买家一开口就问最低多少该怎么回/20261012-买家一开口就问最低多少该怎么回-chat-v.txt',
    style: '常规',
    angle: '聊天记录反问确认需求送赠品幽默拒绝屠龙刀',
    note: '聊天记录短视频1-2min；账号 chat-v；NAS Z:/素材生成库/ai文案/待审文案/买家一开口就问最低多少该怎么回/20261012-买家一开口就问最低多少该怎么回-chat-v.txt'
  },
  {
    id: '20261012-商品发布地址到底该定在哪个城市-selfie-01',
    topic: '商品发布地址到底该定在哪个城市',
    slug: '无',
    skin: 'selfie-01',
    o: 'v',
    sectionHeader: '### 真人出镜 1 · selfie-01 · 竖版（v）',
    fileName: '20261012-商品发布地址到底该定在哪个城市-selfie-01.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/商品发布地址到底该定在哪个城市/20261012-商品发布地址到底该定在哪个城市-selfie-01.txt',
    style: '常规',
    angle: '真人出镜同城推荐权重与产业带城市匹配',
    note: '真人出镜1-2min；账号 selfie-01；不出片；NAS Z:/素材生成库/ai文案/待审文案/商品发布地址到底该定在哪个城市/20261012-商品发布地址到底该定在哪个城市-selfie-01.txt'
  },
  {
    id: '20261012-新手做闲鱼别碰烂大街的这四个冷门品类直接做-selfie-02',
    topic: '新手做闲鱼别碰烂大街的这四个冷门品类直接做',
    slug: '无',
    skin: 'selfie-02',
    o: 'v',
    sectionHeader: '### 真人出镜 2 · selfie-02 · 竖版（v）',
    fileName: '20261012-新手做闲鱼别碰烂大街的这四个冷门品类直接做-selfie-02.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/新手做闲鱼别碰烂大街的这四个冷门品类直接做/20261012-新手做闲鱼别碰烂大街的这四个冷门品类直接做-selfie-02.txt',
    style: '老王',
    angle: '真人出镜老王多品盘点式四个冷门虚拟品类',
    note: '真人出镜1-2min；账号 selfie-02；老王多品盘点式；不出片；NAS Z:/素材生成库/ai文案/待审文案/新手做闲鱼别碰烂大街的这四个冷门品类直接做/20261012-新手做闲鱼别碰烂大街的这四个冷门品类直接做-selfie-02.txt'
  },
  {
    id: '20261012-新手怎么通过同行店铺顺藤摸瓜找爆款-selfie-03',
    topic: '新手怎么通过同行店铺顺藤摸瓜找爆款',
    slug: '无',
    skin: 'selfie-03',
    o: 'v',
    sectionHeader: '### 真人出镜 3 · selfie-03 · 竖版（v）',
    fileName: '20261012-新手怎么通过同行店铺顺藤摸瓜找爆款-selfie-03.txt',
    draft: 'Z:/素材生成库/ai文案/待审文案/新手怎么通过同行店铺顺藤摸瓜找爆款/20261012-新手怎么通过同行店铺顺藤摸瓜找爆款-selfie-03.txt',
    style: '常规',
    angle: '真人出镜顺藤摸瓜看同行店铺第二梯队新品',
    note: '真人出镜1-2min；账号 selfie-03；不出片；NAS Z:/素材生成库/ai文案/待审文案/新手怎么通过同行店铺顺藤摸瓜找爆款/20261012-新手怎么通过同行店铺顺藤摸瓜找爆款-selfie-03.txt'
  }
];

// Step 1: Register in registry
console.log('=== Registering all 16 articles in registry.mjs ===');
for (const item of all16) {
  const cmd = `node engine/return/registry.mjs add --id "${item.id}" --version v1 --topic "${item.topic}" --film "${item.slug}" --draft "${item.draft}" --angle "${item.angle}" --date 2026-10-12 --style "${item.style}" --note "${item.note}" --force`;
  console.log(`Registering: ${item.id}`);
  const out = execSync(cmd, { encoding: 'utf8' });
  console.log(`  -> ${out.trim().split('\n').slice(-1)[0]}`);
}

// Step 2: Update docs/每日/账号选题台账.md
console.log('\n=== Updating docs/每日/账号选题台账.md ===');
const ledgerPath = 'docs/每日/账号选题台账.md';
let ledger = fs.readFileSync(ledgerPath, 'utf8');

for (const item of all16) {
  const row = `| 2026-10-12 | ${item.topic} | ${item.slug} | ${item.fileName} | 存稿 |`;
  
  // Find the section
  const secIdx = ledger.indexOf(item.sectionHeader);
  if (secIdx === -1) {
    console.error(`Section not found: ${item.sectionHeader}`);
    continue;
  }

  // Find the next section or next table end
  const nextSecIdx = ledger.indexOf('### ', secIdx + item.sectionHeader.length);
  const searchEnd = nextSecIdx === -1 ? ledger.length : nextSecIdx;
  const secText = ledger.slice(secIdx, searchEnd);

  // Check if already in section
  if (secText.includes(item.fileName)) {
    console.log(`Already in ledger: ${item.fileName}`);
    continue;
  }

  // Find the last row of the table in this section
  const lines = secText.split('\n');
  let lastRowIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().startsWith('|') && !lines[i].trim().startsWith('|---|')) {
      lastRowIdx = i;
      break;
    }
  }

  if (lastRowIdx !== -1) {
    lines.splice(lastRowIdx + 1, 0, row);
    const newSecText = lines.join('\n');
    ledger = ledger.slice(0, secIdx) + newSecText + ledger.slice(searchEnd);
    console.log(`Appended to ledger [${item.sectionHeader}]: ${row}`);
  } else {
    console.error(`Could not find table rows in section: ${item.sectionHeader}`);
  }
}

fs.writeFileSync(ledgerPath, ledger, 'utf8');
console.log('\nUpdated docs/每日/账号选题台账.md successfully!');
