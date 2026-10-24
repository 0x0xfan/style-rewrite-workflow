import fs from 'fs';

const filePath = 'docs/每日/账号选题台账.md';
let content = fs.readFileSync(filePath, 'utf8');

const patches = [
  {
    target: '| 2026-10-08 | 海底捞券 | haidilao-quan | 20261008-海底捞券-black-yellow-v2-h.txt | 存稿 |',
    insert: '| 2026-10-09 | 网盘拉新 | wangpan-laxin | 20261009-网盘拉新-black-yellow-v2-h.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | AI漫剧 | ai-manju | 20261008-AI漫剧-lime-capsule-h.txt | 存稿 |',
    insert: '| 2026-10-09 | 减脂计划 | jianzhi-jihua | 20261009-减脂计划-lime-capsule-h.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 抖音续火花代充 | douyin-xuhuohua | 20261008-抖音续火花代充-signature-wall-h.txt | 存稿 |',
    insert: '| 2026-10-09 | 老照片修复 | lao-zhao-pian-xiu-fu | 20261009-老照片修复-signature-wall-h.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 京东家政券 | jingdong-jiazheng | 20261008-京东家政券-ledger-desk-h.txt | 存稿 |',
    insert: '| 2026-10-09 | 电影票代买 | dianyingpiao-daimai | 20261009-电影票代买-ledger-desk-h.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 城市年鉴 | chengshi-nianjian | 20261008-城市年鉴-blueprint-h.txt | 存稿 |',
    insert: '| 2026-10-09 | codex安装 | codex-anzhuang | 20261009-codex安装-blueprint-h.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 苹果多开分身 | pingguo-duokai | 20261008-苹果多开分身-pixel-arcade-h.txt | 存稿 |',
    insert: '| 2026-10-09 | 拼多多砍价 | pin-duo-duo-kan-jia | 20261009-拼多多砍价-pixel-arcade-h.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 驾考资料 | jiakao-ziliao | 20261008-驾考资料-black-yellow-v2-v.txt | 存稿 |',
    insert: '| 2026-10-09 | 投屏软件 | touping-ruanjian | 20261009-投屏软件-black-yellow-v2-v.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | AI提示词 | ai-tishici | 20261008-AI提示词-lime-capsule-v.txt | 存稿 |',
    insert: '| 2026-10-09 | 城市年鉴 | chengshi-nianjian | 20261009-城市年鉴-lime-capsule-v.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 投屏软件 | touping-ruanjian | 20261008-投屏软件-signature-wall-v.txt | 存稿 |',
    insert: '| 2026-10-09 | 苹果多开分身 | pingguo-duokai | 20261009-苹果多开分身-signature-wall-v.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 戏曲资源 | xiqu-ziyuan | 20261008-戏曲资源-ledger-desk-v.txt | 存稿 |',
    insert: '| 2026-10-09 | 驾考资料 | jiakao-ziliao | 20261009-驾考资料-ledger-desk-v.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 聊天记录导出 | liaotian-jilu-daochu | 20261008-聊天记录导出-blueprint-v.txt | 存稿 |',
    insert: '| 2026-10-09 | 海底捞券 | haidilao-quan | 20261009-海底捞券-blueprint-v.txt | 存稿 |'
  },
  {
    target: '| 2026-10-08 | 减脂计划 | jianzhi-jihua | 20261008-减脂计划-pixel-arcade-v.txt | 存稿 |',
    insert: '| 2026-10-09 | AI账号代充 | ai-zhanghao-daichong | 20261009-AI账号代充-pixel-arcade-v.txt | 存稿 |'
  }
];

let applied = 0;
for (const p of patches) {
  if (content.includes(p.target)) {
    content = content.replace(p.target, `${p.target}\n${p.insert}`);
    applied++;
  } else {
    console.error(`未找到目标定位行: ${p.target}`);
  }
}

console.log(`成功应用补丁: ${applied} / ${patches.length}`);
fs.writeFileSync(filePath, content, 'utf8');
