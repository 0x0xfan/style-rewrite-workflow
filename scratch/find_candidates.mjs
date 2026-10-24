import fs from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR, STANDARD_ACCOUNTS, loadLedgerHistory, checkNasPhysicalDuplicate, BANNED_TOPICS } from '../engine/brief/check-plan.mjs';

const historyMap = loadLedgerHistory();
const assetDirs = fs.readdirSync(ASSETS_DIR);
const readyAssets = [];

for (const d of assetDirs) {
  const p = path.join(ASSETS_DIR, d);
  if (!fs.statSync(p).isDirectory()) continue;
  const tFile = path.join(p, 'topic.json');
  if (!fs.existsSync(tFile)) continue;
  try {
    const t = JSON.parse(fs.readFileSync(tFile, 'utf8'));
    if (t.status === 'ready') {
      const topicName = t.title || t.name || d;
      const isBanned = BANNED_TOPICS.some(b => topicName.includes(b) || d.includes(b));
      if (!isBanned) {
        readyAssets.push({
          slug: d,
          title: topicName,
          hasFacts: fs.existsSync(path.join(p, 'facts.json')),
          hasDeconstruct: fs.existsSync(path.join(p, 'deconstruct.json'))
        });
      }
    }
  } catch {}
}

console.log(`==== 素材库 Ready 状态资产（排除黑名单）：共 ${readyAssets.length} 个 ====`);

const targetAccounts = STANDARD_ACCOUNTS.filter(a => a.category !== '真人出镜');

console.log('\n==== 13 个出片账号各账号可用的 Ready 选题池 ====');
for (const acc of targetAccounts) {
  const usedList = historyMap.get(acc.id) || [];
  const usedTopics = new Set(usedList.map(u => u.topic));
  
  const available = readyAssets.filter(asset => {
    if (usedTopics.has(asset.title)) return false;
    const nasDup = checkNasPhysicalDuplicate(acc.id, asset.title);
    if (nasDup) return false;
    return true;
  });

  console.log(`[${acc.id}] ${acc.name} (${acc.category}): 可选 ${available.length} 个`);
  for (const a of available) {
    console.log(`   - ${a.title} (${a.slug}) [facts: ${a.hasFacts}]`);
  }
}
