import { execSync } from 'node:child_process';

const targets = [
  ['驾考资料', 'Z:/素材生成库/ai文案/待审文案/驾考资料/20261012-驾考资料-lime-capsule-v.txt'],
  ['苹果多开分身', 'Z:/素材生成库/ai文案/待审文案/苹果多开分身/20261012-苹果多开分身-signature-wall-v.txt'],
  ['抖音续火花代充', 'Z:/素材生成库/ai文案/待审文案/抖音续火花代充/20261012-抖音续火花代充-blueprint-v.txt']
];

for (const [t, f] of targets) {
  try {
    execSync(`npm run check:draft -- "${f}" --topic ${t} --topic-type 虚拟`, { encoding: 'utf8' });
  } catch (e) {
    const out = e.stdout || '';
    console.log(`=== ${t} ===`);
    out.split('\n').forEach((l, idx) => {
      if (l.includes('R012') || l.includes('R032') || l.includes('R036')) {
        console.log(l);
        console.log(out.split('\n').slice(idx+1, idx+3).join('\n'));
      }
    });
  }
}
