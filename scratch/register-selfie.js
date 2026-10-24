const { execSync } = require('child_process');

const selfieList = [
  { id: '20261006-新手起步为什么别做没人做的蓝海-selfie-01', topic: '新手起步为什么别做没人做的蓝海', film: 'xinfu-lanhai-01', angle: 'B1真人出镜蓝海死海', idx: '01' },
  { id: '20261006-遇到买家大刀砍价怎么回-selfie-02', topic: '遇到买家大刀砍价怎么回', film: 'dadao-kanjia-02', angle: 'B1真人出镜砍价应对', idx: '02' },
  { id: '20261006-为什么擦亮了还是没有曝光-selfie-03', topic: '为什么擦亮了还是没有曝光', film: 'caliang-baoguang-03', angle: 'B1真人出镜擦亮曝光', idx: '03' }
];

for (const s of selfieList) {
  const draft = `scratch/每日/20261006-批3/${s.id}.txt`;
  const note = `真人出镜；账号 selfie-${s.idx}；lengthTarget 1-2min；NAS Z:/素材生成库/ai文案/待审文案/${s.topic}/${s.id}.txt`;
  const cmd = `node engine/return/registry.mjs add --id "${s.id}" --version v1 --topic "${s.topic}" --film "${s.film}" --draft "${draft}" --angle "${s.angle}" --date 2026-10-06 --style "常规" --note "${note}"`;
  console.log('Registering:', s.id);
  const out = execSync(cmd, { encoding: 'utf8' });
  console.log(out.trim());
}
