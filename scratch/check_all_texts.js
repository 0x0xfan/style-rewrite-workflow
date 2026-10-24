import fs from 'node:fs';

const content = fs.readFileSync('scratch/build-horizontal-20261012.mjs', 'utf8');

const texts = [];
const re = /text:\s*`([\s\S]*?)`\s*\n\s*\}/g;
let m;
while ((m = re.exec(content)) !== null) {
  texts.push(m[1]);
}
console.log('Extracted texts count:', texts.length);

texts.forEach((txt, i) => {
  console.log(`\n--- Article ${i + 1} ---`);
  const lines = txt.split('\n');
  let contractLine = -1;
  lines.forEach((l, idx) => {
    const s = l.trim();
    if (s.length > 50) {
      console.log(`  [>50 chars] Line ${idx + 1} (${s.length}): ${s}`);
    }
    if (s === '我是圣矾。') {
      contractLine = idx + 1;
    }
    const forbidden = ['无条件', '收货', '运行', '百分之百', '稳赚', '躺赚', '暴利'];
    for (const w of forbidden) {
      if (s.includes(w)) {
        console.log(`  [Forbidden: ${w}] Line ${idx + 1}: ${s}`);
      }
    }
  });
  console.log(`  Contract line: ${contractLine} ${contractLine <= 10 ? 'OK' : 'LATE!'}`);
});
