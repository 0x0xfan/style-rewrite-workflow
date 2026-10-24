import fs from 'fs';

const content = fs.readFileSync('docs/每日/账号选题台账.md', 'utf8');
const lines = content.split('\n');

console.log('=== 查找 2026-10-09 在台账中的行 ===');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('2026-10-09')) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}
