import fs from 'fs';
import path from 'path';

const targets = [
  '做饭',
  '名著动画+测试',
  '数独',
  '表情包',
  '键盘皮肤（美化包）',
  '隐藏的图画'
];

console.log('=== 1. 清理 NAS 待审文案与资料目录 ===');
const nasPending = 'Z:/素材生成库/ai文案/待审文案';
const nasDoc = 'Z:/素材生成库/ai文案/资料';

for (const t of targets) {
  const p1 = path.join(nasPending, t);
  if (fs.existsSync(p1)) {
    fs.rmSync(p1, { recursive: true, force: true });
    console.log(`✅ 已删除 NAS 待审目录: ${p1}`);
  }
  const p2 = path.join(nasDoc, t);
  if (fs.existsSync(p2)) {
    fs.rmSync(p2, { recursive: true, force: true });
    console.log(`✅ 已删除 NAS 资料目录: ${p2}`);
  }
}

console.log('\n=== 2. 清理 docs/每日/账号选题台账.md ===');
const ledgerPath = 'docs/每日/账号选题台账.md';
let ledgerContent = fs.readFileSync(ledgerPath, 'utf8');
const ledgerLines = ledgerContent.split('\n');
const newLedgerLines = ledgerLines.filter(line => {
  if (line.includes('2026-10-19') && targets.some(t => line.includes(t))) {
    console.log(`- 移除台账行: ${line.trim()}`);
    return false;
  }
  return true;
});
fs.writeFileSync(ledgerPath, newLedgerLines.join('\n'), 'utf8');
console.log('✅ 台账更新完毕');

console.log('\n=== 3. 清理 docs/每日/故事登记.md ===');
const storyPath = 'docs/每日/故事登记.md';
let storyContent = fs.readFileSync(storyPath, 'utf8');
const storyLines = storyContent.split('\n');
const newStoryLines = storyLines.filter(line => {
  if (line.includes('2026-10-19') && targets.some(t => line.includes(t))) {
    console.log(`- 移除故事行: ${line.trim()}`);
    return false;
  }
  return true;
});
fs.writeFileSync(storyPath, newStoryLines.join('\n'), 'utf8');
console.log('✅ 故事登记更新完毕');

console.log('\n=== 4. 清理 docs/稿件登记.json ===');
const regPath = 'docs/稿件登记.json';
let reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
const oldLen = reg.length;
reg = reg.filter(r => !targets.some(t => (r.title && r.title.includes(t)) || (r.id && r.id.includes(t)) || (r.file && r.file.includes(t))));
console.log(`- 稿件登记原记录 ${oldLen} 条，清理后 ${reg.length} 条（移除了 ${oldLen - reg.length} 条）`);
fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + '\n', 'utf8');

console.log('\n=== 5. 清理本地选题核心文件 ===');
for (const t of targets) {
  const p = path.join('docs/每日/选题核心', `${t}.md`);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`✅ 已删除选题核心文件: ${p}`);
  }
}

console.log('\n清理完成！');
