import { execSync } from 'node:child_process';

const files = [
  ['城市年鉴', 'Z:\\素材生成库\\ai文案\\待审文案\\城市年鉴\\20261012-城市年鉴-black-yellow-v2-v.txt'],
  ['驾考资料', 'Z:\\素材生成库\\ai文案\\待审文案\\驾考资料\\20261012-驾考资料-lime-capsule-v.txt'],
  ['苹果多开分身', 'Z:\\素材生成库\\ai文案\\待审文案\\苹果多开分身\\20261012-苹果多开分身-signature-wall-v.txt'],
  ['海底捞券', 'Z:\\素材生成库\\ai文案\\待审文案\\海底捞券\\20261012-海底捞券-ledger-desk-v.txt'],
  ['抖音续火花代充', 'Z:\\素材生成库\\ai文案\\待审文案\\抖音续火花代充\\20261012-抖音续火花代充-blueprint-v.txt'],
  ['戏曲资源', 'Z:\\素材生成库\\ai文案\\待审文案\\戏曲资源\\20261012-戏曲资源-pixel-arcade-v.txt']
];

for (const [topic, f] of files) {
  try {
    const compCmd = `npm run check:compliance -- "${f}"`;
    const compOut = execSync(compCmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`[COMPLIANCE PASS] ${topic}`);
  } catch (e) {
    console.log(`[COMPLIANCE FAIL] ${topic}:`, e.stdout || e.message);
  }

  try {
    // Note: vertical short videos ignore long-form rules R002-R007, R010, R011
    const cmd = `npm run check:draft -- "${f}" --topic ${topic} --topic-type 虚拟`;
    execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`[DRAFT PASS 0 hits] ${topic}`);
  } catch (e) {
    const out = e.stdout || '';
    const m = out.match(/退回级命中\s*(\d+)\s*条规则/);
    console.log(`[DRAFT RESULT] ${topic}: 退回级命中 ${m ? m[1] : 'unknown'} 条`);
    out.split('\n').forEach((l, idx) => {
      if (l.includes('退回') && (l.includes('命中') || l.includes('打回') || l.includes('未通过'))) {
        console.log('   ->', l);
      }
    });
  }
}
