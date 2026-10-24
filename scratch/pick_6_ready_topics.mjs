import fs from 'fs';
import path from 'path';
import { loadLedgerHistory } from '../engine/brief/check-plan.mjs';

const assetsDir = 'D:/项目仓库/remotion视频制作/public/ips/xianyu-fanshen/assets';
const historyMap = loadLedgerHistory();

// 当天已占用的 7 个竖版选题
const todayOccupied = new Set([
  '公众号排版', 'gongzhonghao-paiban',
  '投屏软件', 'touping-ruanjian',
  '营业执照代办', 'yingye-zhizhao',
  '苹果手表', 'pingguo-shoubiao',
  'codex安装', 'codex-anzhuang',
  '明星写真', 'mingxing-xiezhen',
  '买家问能不能微信聊该怎么回'
]);

// 收集所有 status === 'ready' 的选题
const readyTopics = [];
for (const d of fs.readdirSync(assetsDir)) {
  const p = path.join(assetsDir, d);
  if (!fs.statSync(p).isDirectory()) continue;
  const tFile = path.join(p, 'topic.json');
  if (fs.existsSync(tFile)) {
    try {
      const t = JSON.parse(fs.readFileSync(tFile, 'utf8'));
      if (t.status === 'ready') {
        let facts = null;
        const fFile = path.join(p, 'facts.json');
        if (fs.existsSync(fFile)) {
          facts = JSON.parse(fs.readFileSync(fFile, 'utf8'));
        }
        readyTopics.push({
          slug: d,
          title: t.title || t.name || d,
          desc: t.description || '',
          facts
        });
      }
    } catch {}
  }
}

console.log('可用 ready 选题总数:', readyTopics.length);

const hAccounts = [
  { id: 'black-yellow-v2-h', name: '黑黄 横版', style: '小Lin' },
  { id: 'lime-capsule-h',    name: '荧光绿 横版', style: '嘴替' },
  { id: 'signature-wall-h',  name: '署名墙 横版', style: '老友' },
  { id: 'ledger-desk-h',     name: '对账台 横版', style: '钱十七' },
  { id: 'blueprint-h',       name: '蓝图拆解 横版', style: '老王' },
  { id: 'pixel-arcade-h',    name: '像素街机 横版', style: '半佛' }
];

for (const acc of hAccounts) {
  const history = historyMap.get(acc.id) || [];
  const historyTopics = new Set(history.map(h => h.topic));
  const available = readyTopics.filter(r => !todayOccupied.has(r.title) && !todayOccupied.has(r.slug) && !historyTopics.has(r.topic) && !historyTopics.has(r.slug));
  console.log(`\n[${acc.name}] 可用候选数: ${available.length}`);
  console.log(available.slice(0, 10).map(x => `${x.title} (${x.slug})`).join(', '));
}
