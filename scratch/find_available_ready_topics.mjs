import fs from 'fs';
import path from 'path';
import { loadLedgerHistory, STANDARD_ACCOUNTS } from '../engine/brief/check-plan.mjs';

const assetsDir = 'D:/项目仓库/remotion视频制作/public/ips/xianyu-fanshen/assets';
const historyMap = loadLedgerHistory();

// 收集所有 ready 的 topic
const readyList = [];
for (const d of fs.readdirSync(assetsDir)) {
  const p = path.join(assetsDir, d);
  if (!fs.statSync(p).isDirectory()) continue;
  const tFile = path.join(p, 'topic.json');
  if (fs.existsSync(tFile)) {
    try {
      const t = JSON.parse(fs.readFileSync(tFile, 'utf8'));
      if (t.status === 'ready') {
        readyList.push({ slug: d, title: t.title || t.name || d });
      }
    } catch {}
  }
}

console.log(`素材库状态为 ready（素材齐）的品共 ${readyList.length} 个：`);

const hAccounts = [
  { id: 'black-yellow-v2-h', name: '黑黄 横版' },
  { id: 'lime-capsule-h',    name: '荧光绿 横版' },
  { id: 'signature-wall-h',  name: '署名墙 横版' },
  { id: 'ledger-desk-h',     name: '对账台 横版' },
  { id: 'blueprint-h',       name: '蓝图拆解 横版' },
  { id: 'pixel-arcade-h',    name: '像素街机 横版' }
];

for (const acc of hAccounts) {
  const history = historyMap.get(acc.id) || [];
  const historyTopics = new Set(history.map(h => h.topic));

  const available = readyList.filter(r => {
    // 排除历史写过的（包含模糊匹配）
    return !historyTopics.has(r.title) && !historyTopics.has(r.slug);
  });

  console.log(`\n【${acc.name} (${acc.id})】历史已写 ${history.length} 篇，当前可用且素材齐的品 (${available.length} 个):`);
  console.log(available.slice(0, 8).map(x => `「${x.title}」(${x.slug})`).join(', '));
}
