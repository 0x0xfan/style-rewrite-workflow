import fs from 'fs';

const content = fs.readFileSync('docs/每日/账号选题台账.md', 'utf8');
const lines = content.split('\n');

let currentAccount = null;
const accountRecords = {}; // accountId -> [{ date, topic, filename }]

for (const line of lines) {
  if (line.startsWith('## 未分配') || line.startsWith('## 选题池')) {
    currentAccount = null;
    continue;
  }
  if (line.startsWith('### ')) {
    const title = line.replace('### ', '').trim();
    if (title.includes('black-yellow-v2') && title.includes('h')) currentAccount = 'black-yellow-v2-h';
    else if (title.includes('lime-capsule') && title.includes('h')) currentAccount = 'lime-capsule-h';
    else if (title.includes('signature-wall') && title.includes('h')) currentAccount = 'signature-wall-h';
    else if (title.includes('ledger-desk') && title.includes('h')) currentAccount = 'ledger-desk-h';
    else if (title.includes('blueprint') && title.includes('h')) currentAccount = 'blueprint-h';
    else if (title.includes('pixel-arcade') && title.includes('h')) currentAccount = 'pixel-arcade-h';
    else if (title.includes('black-yellow-v2') && title.includes('v')) currentAccount = 'black-yellow-v2-v';
    else if (title.includes('lime-capsule') && title.includes('v')) currentAccount = 'lime-capsule-v';
    else if (title.includes('signature-wall') && title.includes('v')) currentAccount = 'signature-wall-v';
    else if (title.includes('ledger-desk') && title.includes('v')) currentAccount = 'ledger-desk-v';
    else if (title.includes('blueprint') && title.includes('v')) currentAccount = 'blueprint-v';
    else if (title.includes('pixel-arcade') && title.includes('v')) currentAccount = 'pixel-arcade-v';
    else if (title.includes('chat')) currentAccount = 'chat-v';
    else currentAccount = null;
    if (currentAccount && !accountRecords[currentAccount]) accountRecords[currentAccount] = [];
  } else if (line.startsWith('## 真人出镜')) {
    currentAccount = 'selfie';
    if (!accountRecords[currentAccount]) accountRecords[currentAccount] = [];
  } else if (currentAccount && line.startsWith('|') && line.includes('2026-')) {
    const parts = line.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 4) {
      accountRecords[currentAccount].push({
        date: parts[0],
        topic: parts[1],
        topicSlug: parts[2],
        filename: parts[3]
      });
    }
  }
}

console.log('解析到的账号列表与记录数:');
for (const [acc, recs] of Object.entries(accountRecords)) {
  console.log(`- ${acc}: ${recs.length} 篇`);
  const seen = {};
  for (const r of recs) {
    if (seen[r.topic]) {
      console.log(`  [历史重复] 选题: ${r.topic} (初次: ${seen[r.topic]}, 再次: ${r.date})`);
    } else {
      seen[r.topic] = r.date;
    }
  }
}
