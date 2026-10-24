import fs from 'fs';

const ledger = fs.readFileSync('docs/每日/账号选题台账.md', 'utf8');

const files1009 = [
  { acc: '黑黄 · black-yellow-v2 · 横版（h）', topic: '网盘拉新' },
  { acc: '荧光绿 · lime-capsule · 横版（h）', topic: '减脂计划' },
  { acc: '署名墙 · signature-wall · 横版（h）', topic: '老照片修复' },
  { acc: '对账台 · ledger-desk · 横版（h）', topic: '电影票代买' },
  { acc: '蓝图拆解 · blueprint · 横版（h）', topic: 'codex安装' },
  { acc: '像素街机 · pixel-arcade · 横版（h）', topic: '拼多多砍价' },
  { acc: '黑黄 · black-yellow-v2 · 竖版（v）', topic: '投屏软件' },
  { acc: '荧光绿 · lime-capsule · 竖版（v）', topic: '城市年鉴' },
  { acc: '署名墙 · signature-wall · 竖版（v）', topic: '苹果多开分身' },
  { acc: '对账台 · ledger-desk · 竖版（v）', topic: '驾考资料' },
  { acc: '蓝图拆解 · blueprint · 竖版（v）', topic: '海底捞券' },
  { acc: '像素街机 · pixel-arcade · 竖版（v）', topic: 'AI账号代充' },
];

console.log('=== 检查 10-09 未入台账的文案，在后续台账中是否被重复派发 ===\n');

for (const item of files1009) {
  // 在台账中找到该账号的章节
  const accIndex = ledger.indexOf(item.acc);
  if (accIndex === -1) {
    console.log(`未找到账号章节: ${item.acc}`);
    continue;
  }
  const nextSectionIndex = ledger.indexOf('### ', accIndex + item.acc.length);
  const sectionContent = nextSectionIndex !== -1 ? ledger.slice(accIndex, nextSectionIndex) : ledger.slice(accIndex);
  
  // 检查该章节中是否出现过该选题
  const matches = [];
  const lines = sectionContent.split('\n');
  for (const l of lines) {
    if (l.includes(`| ${item.topic} |`)) {
      matches.push(l.trim());
    }
  }
  
  if (matches.length > 0) {
    console.log(`🔴 [同账号重复命中] 账号: ${item.acc} | 选题: ${item.topic}`);
    console.log(`   10-09 已写过并交付 NAS（但漏记台账）`);
    matches.forEach(m => console.log(`   台账中记录的后续重复: ${m}`));
  } else {
    console.log(`🟢 [未重复] 账号: ${item.acc} | 选题: ${item.topic} (台账中后续未再出现)`);
  }
}
