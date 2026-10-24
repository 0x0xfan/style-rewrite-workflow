const cp = require('child_process');

const articles = [
  { topic: '三角洲', file: 'Z:/素材生成库/ai文案/待审文案/三角洲/20261015-三角洲-black-yellow-v2-h.txt' },
  { topic: 'PPT模板', file: 'Z:/素材生成库/ai文案/待审文案/PPT模板/20261015-PPT模板-lime-capsule-h.txt' },
  { topic: '拼豆图纸', file: 'Z:/素材生成库/ai文案/待审文案/拼豆图纸/20261015-拼豆图纸-signature-wall-h.txt' },
  { topic: 'Hermes部署', file: 'Z:/素材生成库/ai文案/待审文案/Hermes部署/20261015-Hermes部署-ledger-desk-h.txt' },
  { topic: '苹果多开分身', file: 'Z:/素材生成库/ai文案/待审文案/苹果多开分身/20261015-苹果多开分身-blueprint-h.txt' },
  { topic: '高质量人生指南', file: 'Z:/素材生成库/ai文案/待审文案/高质量人生指南/20261015-高质量人生指南-pixel-arcade-h.txt' }
];

for (const a of articles) {
  try {
    const res = cp.execSync(`npm run check:draft -- "${a.file}" --topic ${a.topic} --topic-type 虚拟`, { encoding: 'utf8' });
    const match = res.match(/退回级命中 (\d+) 条/);
    console.log(a.topic, '-> 退回级命中:', match ? match[1] : 'unknown');
  } catch (e) {
    const out = e.stdout || '';
    const match = out.match(/退回级命中 (\d+) 条/);
    console.log(a.topic, '-> 退回级命中:', match ? match[1] : 'error');
    out.split('\n').forEach(line => {
      if (line.includes('退回') && !line.includes('通过') && !line.includes('没跑') && !line.includes('人工')) {
        console.log('   ', line);
      }
    });
  }
}
