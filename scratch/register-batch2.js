const { execSync } = require('child_process');

const list = [
  { id: '20261006-AI账号拼车-black-yellow-v2-v', topic: 'AI账号拼车', film: 'ai-pinche', draft: 'scratch/每日/20261006-批2/20261006-AI账号拼车-black-yellow-v2-v.txt', angle: 'A1闲鱼搜词硬数据', skin: 'black-yellow-v2' },
  { id: '20261006-苹果多开分身-lime-capsule-v', topic: '苹果多开分身', film: 'pingguo-duokai', draft: 'scratch/每日/20261006-批2/20261006-苹果多开分身-lime-capsule-v.txt', angle: 'A1闲鱼搜词硬数据', skin: 'lime-capsule' },
  { id: '20261006-AI中转站-signature-wall-v', topic: 'AI中转站', film: 'ai-zhongzhuanzhan', draft: 'scratch/每日/20261006-批2/20261006-AI中转站-signature-wall-v.txt', angle: 'A1闲鱼搜词硬数据', skin: 'signature-wall' },
  { id: '20261006-Hermes部署-ledger-desk-v', topic: 'Hermes部署', film: 'hermes-bushu', draft: 'scratch/每日/20261006-批2/20261006-Hermes部署-ledger-desk-v.txt', angle: 'A1闲鱼点名卖东西能赚钱', skin: 'ledger-desk' },
  { id: '20261006-AI漫剧-blueprint-v', topic: 'AI漫剧', film: 'ai-manju', draft: 'scratch/每日/20261006-批2/20261006-AI漫剧-blueprint-v.txt', angle: 'A1闲鱼搜词硬数据', skin: 'blueprint' },
  { id: '20261006-虚拟玩法盘点-pixel-arcade-v', topic: '虚拟玩法盘点', film: 'xuni-wanfa-pandian', draft: 'scratch/每日/20261006-批2/20261006-虚拟玩法盘点-pixel-arcade-v.txt', angle: 'A1闲鱼搜词硬数据', skin: 'pixel-arcade' }
];

for (const item of list) {
  const note = `短稿；账号 ${item.skin}-v；lengthTarget 1-2min；NAS Z:/素材生成库/ai文案/待审文案/${item.topic}/${item.id}.txt`;
  const cmd = `node engine/return/registry.mjs add --id "${item.id}" --version v1 --topic "${item.topic}" --film "${item.film}" --draft "${item.draft}" --angle "${item.angle}" --date 2026-10-06 --style "常规" --note "${note}"`;
  console.log('Running:', item.id);
  const out = execSync(cmd, { encoding: 'utf8' });
  console.log(out.trim());
}
