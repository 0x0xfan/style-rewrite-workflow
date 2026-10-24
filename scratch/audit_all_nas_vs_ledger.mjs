import fs from 'fs';
import path from 'path';

// 1. 读取台账
const ledgerContent = fs.readFileSync('docs/每日/账号选题台账.md', 'utf8');
const ledgerLines = ledgerContent.split('\n');

let currentSection = '';
const ledgerRecords = []; // { account, date, topic, filename }

for (const line of ledgerLines) {
  if (line.startsWith('### ')) {
    currentSection = line.replace('### ', '').trim();
  } else if (line.startsWith('|') && line.includes('2026-')) {
    const parts = line.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 4) {
      ledgerRecords.push({
        account: currentSection,
        date: parts[0],
        topic: parts[1],
        topicSlug: parts[2],
        filename: parts[3]
      });
    }
  }
}

console.log(`台账现有记录数: ${ledgerRecords.length}`);

// 2. 扫描 NAS 待审文案
const nasRoot = 'Z:/素材生成库/ai文案/待审文案';
const nasFiles = []; // { topicDir, filename, date, skin, orientation, topic }

const skins = [
  'black-yellow-v2', 'lime-capsule', 'signature-wall',
  'ledger-desk', 'blueprint', 'pixel-arcade', 'chat', 'selfie'
];

function parseNasFile(topicDir, f) {
  if (!f.endsWith('.txt')) return null;
  // 忽略一些明显不是正稿的文件
  if (f.endsWith('.台词.txt') || f.endsWith('.素材.txt')) return null;
  
  // 匹配形如: 20261009-网盘拉新-black-yellow-v2-h.txt
  // 或 20261017-电影票代买-selfie-01.txt
  const m = f.match(/^(\d{8})-([^-]+)-([^\.]+)\.txt$/);
  if (!m) return null;
  
  const dateStr = `${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6,8)}`;
  const topic = m[2];
  const suffix = m[3];
  
  return {
    topicDir,
    filename: f,
    date: dateStr,
    topic,
    suffix
  };
}

for (const sub of fs.readdirSync(nasRoot)) {
  const p = path.join(nasRoot, sub);
  if (fs.statSync(p).isDirectory()) {
    for (const f of fs.readdirSync(p)) {
      const parsed = parseNasFile(sub, f);
      if (parsed) nasFiles.push(parsed);
    }
  }
}

console.log(`NAS 待审文案扫描到的稿件数: ${nasFiles.length}`);

// 3. 对比：哪些 NAS 稿件在台账中完全不存在？
const missingInLedger = [];
for (const nf of nasFiles) {
  const inLedger = ledgerRecords.some(lr => lr.filename === nf.filename || (lr.date === nf.date && lr.topic === nf.topic && nf.filename.includes(lr.topicSlug)));
  if (!inLedger) {
    missingInLedger.push(nf);
  }
}

console.log(`\n=== 存在于 NAS 但台账中完全缺失的稿件 (${missingInLedger.length} 篇) ===`);
missingInLedger.sort((a,b) => a.date.localeCompare(b.date) || a.filename.localeCompare(b.filename));
missingInLedger.forEach(m => {
  console.log(`- [${m.date}] 选题: ${m.topic} | 文件: ${m.filename}`);
});
