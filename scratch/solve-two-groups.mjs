import fs from 'node:fs';
import { loadLedgerHistory, STANDARD_ACCOUNTS, checkPlan, parsePlanTable } from '../engine/brief/check-plan.mjs';

const history = loadLedgerHistory();
const accountUsed = {};
for (const acc of STANDARD_ACCOUNTS) {
  accountUsed[acc.id] = new Set((history.get(acc.id) || []).map(x => x.topic));
}

function isAvailable(accId, topic) {
  return !accountUsed[accId].has(topic);
}

console.log('Testing candidates...');

// Group 1 candidate proposals:
// 横版产品优先利用全新的 S0 资产
// 1. black-yellow-v2-h: 钩织 (topic-mvel3b4v) -> 小Lin商业拆解，全店8112单
// 2. lime-capsule-h: 安卓连点器 (topic-mveyf9yv) -> 嘴替拆解，全店12128单，抢单抢票工具
// 3. signature-wall-h: 民间鬼故事 (topic-mveydvi9) -> 老友拉家常，全店54754单，讲故事音频合集
// 4. ledger-desk-h: 网盘扩容 (topic-mveycs7q) -> 钱十七算账，全店19217单，扩容不爆盘
// 5. blueprint-h: Excel函数模板 (excel) -> 老王极客拆解，自动化表格与函数公式
// 6. pixel-arcade-h: MBTI性格测试 (mbti) -> 半佛魔幻讽刺，当代年轻人性格测试执念

// 竖版轻产品/服务
// 7. black-yellow-v2-v: 证件照换底换衣服 (topic-mv97kgtz)
// 8. lime-capsule-v: 手抄报模板 (topic-mv97gi1y)
// 9. signature-wall-v: 钢琴琴谱 (topic-mvarvk18)
// 10. ledger-desk-v: 拍照姿势 (topic-mvarsxuz)
// 11. blueprint-v: 解压视频 (topic-mv97f2ll)
// 12. pixel-arcade-v: 穿搭 (topic-mv97b7ol)

// 聊天记录
// 13. chat-v: 买家问降价能不能便宜点该怎么回 (经验库 X-沟通-028)

// 真人出镜 (2 产品/盘点 + 1 经验)
// 14. selfie-01: 头像水印 (topic-mvarxw8j, 产品型)
// 15. selfie-02: 盘点闲鱼上常年被大学生买爆的这三种低门槛虚拟品 (经验库 X-选品-029)
// 16. selfie-03: 闲鱼新店前三单到底该怎么快速破零建立买家信任 (经验库 X-起步-012)

const g1 = [
  { acc: 'black-yellow-v2-h', topic: '钩织' },
  { acc: 'lime-capsule-h', topic: '安卓连点器' },
  { acc: 'signature-wall-h', topic: '民间鬼故事' },
  { acc: 'ledger-desk-h', topic: '网盘扩容' },
  { acc: 'blueprint-h', topic: 'Excel函数模板' },
  { acc: 'pixel-arcade-h', topic: 'MBTI性格测试' },
  { acc: 'black-yellow-v2-v', topic: '证件照换底换衣服' },
  { acc: 'lime-capsule-v', topic: '手抄报模板' },
  { acc: 'signature-wall-v', topic: '钢琴琴谱' },
  { acc: 'ledger-desk-v', topic: '拍照姿势' },
  { acc: 'blueprint-v', topic: '解压视频' },
  { acc: 'pixel-arcade-v', topic: '穿搭' },
  { acc: 'chat-v', topic: '买家问降价能不能便宜点该怎么回' },
  { acc: 'selfie-01', topic: '头像水印' },
  { acc: 'selfie-02', topic: '盘点闲鱼上常年被大学生买爆的这三种低门槛虚拟品' },
  { acc: 'selfie-03', topic: '闲鱼新店前三单到底该怎么快速破零建立买家信任' }
];

console.log('--- Checking Group 1 ---');
for (const item of g1) {
  const ok = isAvailable(item.acc, item.topic);
  console.log(item.acc.padEnd(20), item.topic.padEnd(25), ok ? 'OK' : 'DUPLICATE IN LEDGER');
}
