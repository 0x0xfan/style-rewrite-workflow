const cp = require('child_process');
const f = 'Z:/素材生成库/ai文案/待审文案/三角洲/20261015-三角洲-black-yellow-v2-h.txt';
try {
  const res = cp.execSync(`npm run check:draft -- "${f}" --topic 三角洲 --topic-type 虚拟`, { encoding: 'utf8' });
  console.log(res);
} catch (e) {
  console.log('EXIT CODE:', e.status);
  console.log('STDOUT:\n', e.stdout);
  console.log('STDERR:\n', e.stderr);
}
