import { execSync } from 'node:child_process';

const files = [
  ['拼多多砍价', 'Z:\\素材生成库\\ai文案\\待审文案\\拼多多砍价\\20261012-拼多多砍价-black-yellow-v2-h.txt'],
  ['减脂计划', 'Z:\\素材生成库\\ai文案\\待审文案\\减脂计划\\20261012-减脂计划-lime-capsule-h.txt'],
  ['老照片修复', 'Z:\\素材生成库\\ai文案\\待审文案\\老照片修复\\20261012-老照片修复-signature-wall-h.txt'],
  ['电影票代买', 'Z:\\素材生成库\\ai文案\\待审文案\\电影票代买\\20261012-电影票代买-ledger-desk-h.txt'],
  ['codex安装', 'Z:\\素材生成库\\ai文案\\待审文案\\codex安装\\20261012-codex安装-blueprint-h.txt'],
  ['网盘拉新', 'Z:\\素材生成库\\ai文案\\待审文案\\网盘拉新\\20261012-网盘拉新-pixel-arcade-h.txt']
];

for (const [topic, f] of files) {
  try {
    const cmd = `npm run check:draft -- "${f}" --topic ${topic} --topic-type 虚拟`;
    execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`[PASS 0 hits] ${topic}`);
  } catch (e) {
    const out = e.stdout || '';
    const m = out.match(/退回级命中\s*(\d+)\s*条规则/);
    const hints = out.match(/提示级命中\s*(\d+)\s*条/);
    console.log(`[RESULT] ${topic}: 退回级命中 ${m ? m[1] : 'unknown'} 条, 提示级命中 ${hints ? hints[1] : 'unknown'} 条`);
    if (m && parseInt(m[1]) > 0) {
      out.split('\n').forEach((l, idx) => {
        if (l.includes('退回') && (l.includes('命中') || l.includes('打回') || l.includes('未通过'))) {
          console.log('   ->', l);
          console.log('      detail:', out.split('\n').slice(idx + 1, idx + 4).join('\n      '));
        }
      });
    }
  }
}
