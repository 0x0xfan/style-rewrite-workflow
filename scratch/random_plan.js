const fs = require('fs');

const ledger = fs.readFileSync('docs/每日/账号选题台账.md', 'utf8');

const pureClassicProducts = [
  'AIu盘', 'AI中转站', 'AI代写', 'AI代部署', 'AI提示词', 'AI漫剧',
  'AI账号代充', 'AI账号拼车', 'codex安装', 'C盘清理', 'Hermes部署', 'mac微信多开',
  'Obsidian模板', '三角洲', '京东家政券', '公众号排版', '减脂计划', '创业计划书',
  '剪映工程培训', '城市年鉴', '安卓多开', '戏曲资源', '投屏软件', '抖音续火花代充',
  '拼多多砍价', '明星写真', '春招', '植物大战僵尸', '海底捞券', '淘客截流',
  '玄学寻物', '电影票代买', '网盘拉新', '美国公司注册', '老照片修复', '聊天记录导出',
  '苹果ID共享', '苹果多开分身', '苹果手表', '营业执照代办', '谷歌浏览器', '酒店代订',
  '韩剧老片转卖', '驾考资料'
];

const newProducts = ['高质量人生指南', 'PPT模板', '四六级词汇', '笔刷', '拼豆图纸', '捏脸'];

// Exclude topics used yesterday (2026-10-14) to avoid same-topic fatigue across adjacent days
const usedYesterday = new Set();
for (const l of ledger.split('\n')) {
  const cols = l.split('|').map(s => s.trim());
  if (cols.length >= 4 && cols[1] === '2026-10-14') {
    usedYesterday.add(cols[2]);
  }
}

const availableClassic = pureClassicProducts.filter(t => !usedYesterday.has(t));

const accounts = [
  { id: 1, name: '黑黄 横版', skin: 'black-yellow-v2', h_v: 'h', style: '小Lin', sec: '黑黄 · black-yellow-v2 · 横版（h）' },
  { id: 2, name: '荧光绿 横版', skin: 'lime-capsule', h_v: 'h', style: '嘴替', sec: '荧光绿 · lime-capsule · 横版（h）' },
  { id: 3, name: '署名墙 横版', skin: 'signature-wall', h_v: 'h', style: '老友', sec: '署名墙 · signature-wall · 横版（h）' },
  { id: 4, name: '对账台 横版', skin: 'ledger-desk', h_v: 'h', style: '钱十七', sec: '对账台 · ledger-desk · 横版（h）' },
  { id: 5, name: '蓝图拆解 横版', skin: 'blueprint', h_v: 'h', style: '老王', sec: '蓝图拆解 · blueprint · 横版（h）' },
  { id: 6, name: '像素街机 横版', skin: 'pixel-arcade', h_v: 'h', style: '半佛', sec: '像素街机 · pixel-arcade · 横版（h）' },
  { id: 7, name: '黑黄 竖版', skin: 'black-yellow-v2', h_v: 'v', style: '常规', sec: '黑黄 · black-yellow-v2 · 竖版（v）' },
  { id: 8, name: '荧光绿 竖版', skin: 'lime-capsule', h_v: 'v', style: '常规', sec: '荧光绿 · lime-capsule · 竖版（v）' },
  { id: 9, name: '署名墙 竖版', skin: 'signature-wall', h_v: 'v', style: '常规', sec: '署名墙 · signature-wall · 竖版（v）' },
  { id: 10, name: '对账台 竖版', skin: 'ledger-desk', h_v: 'v', style: '常规', sec: '对账台 · ledger-desk · 竖版（v）' },
  { id: 11, name: '蓝图拆解 竖版', skin: 'blueprint', h_v: 'v', style: '常规', sec: '蓝图拆解 · blueprint · 竖版（v）' },
  { id: 12, name: '像素街机 竖版', skin: 'pixel-arcade', h_v: 'v', style: '常规', sec: '像素街机 · pixel-arcade · 竖版（v）' }
];

const usedMap = {};
for (const acc of accounts) {
  const parts = ledger.split('### ' + acc.sec);
  const used = new Set();
  if (parts.length > 1) {
    const lines = parts[1].split('###')[0].split('\n');
    for (const l of lines) {
      const cols = l.split('|').map(s => s.trim());
      if (cols.length >= 4 && cols[1] && cols[1].startsWith('2026-')) {
        used.add(cols[2]);
      }
    }
  }
  usedMap[acc.id] = used;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

for (let iter = 0; iter < 1000; iter++) {
  // Let new topics be randomly assigned across both H and V: e.g. 3 in H, 3 in V
  const hSlots = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3);
  const vSlots = shuffle([6, 7, 8, 9, 10, 11]).slice(0, 3);
  const newSlots = [...hSlots, ...vSlots];
  const shuffledNew = shuffle(newProducts);
  
  const currentPlan = new Array(12);
  let possible = true;
  for (let i = 0; i < 6; i++) {
    const slot = newSlots[i];
    const top = shuffledNew[i];
    if (usedMap[accounts[slot].id].has(top)) {
      possible = false;
      break;
    }
    currentPlan[slot] = { acc: accounts[slot], topic: top, isNew: true };
  }
  if (!possible) continue;
  
  const remainingSlots = [0,1,2,3,4,5,6,7,8,9,10,11].filter(s => !newSlots.includes(s));
  const shuffledClassic = shuffle(availableClassic);
  const pickedClassic = new Set();
  for (const slot of remainingSlots) {
    const acc = accounts[slot];
    const found = shuffledClassic.find(t => !pickedClassic.has(t) && !usedMap[acc.id].has(t));
    if (!found) {
      possible = false;
      break;
    }
    pickedClassic.add(found);
    currentPlan[slot] = { acc, topic: found, isNew: false };
  }
  
  if (possible) {
    console.log('RANDOMIZED_PLAN_SUCCESS');
    console.log(JSON.stringify(currentPlan, null, 2));
    break;
  }
}
