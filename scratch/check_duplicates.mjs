import fs from 'fs';

const content = fs.readFileSync('docs/每日/账号选题台账.md', 'utf8');
const lines = content.split('\n');

let currentSection = '';
const accountTopics = {};

for (const line of lines) {
  if (line.startsWith('### ')) {
    currentSection = line.replace('### ', '').trim();
    if (!accountTopics[currentSection]) accountTopics[currentSection] = [];
  } else if (line.startsWith('|') && line.includes('2026-')) {
    const parts = line.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const date = parts[0];
      const topic = parts[1];
      accountTopics[currentSection].push({ date, topic, line });
    }
  }
}

console.log('=== 检查账号选题台账同账号重复 ===');
let foundDup = false;
for (const [acc, items] of Object.entries(accountTopics)) {
  const seen = new Map();
  for (const item of items) {
    if (seen.has(item.topic)) {
      foundDup = true;
      console.log(`[同账号重复] 账号: ${acc} | 选题: ${item.topic} | 先前日期: ${seen.get(item.topic)} | 重复日期: ${item.date}`);
    } else {
      seen.set(item.topic, item.date);
    }
  }
}
if (!foundDup) {
  console.log('台账中无任何同账号重复记录！');
}

// 检查同一天是否有跨账号重复
console.log('\n=== 检查同天跨账号重复 ===');
const dayTopics = {};
for (const [acc, items] of Object.entries(accountTopics)) {
  for (const item of items) {
    if (!dayTopics[item.date]) dayTopics[item.date] = [];
    dayTopics[item.date].push({ acc, topic: item.topic });
  }
}

let foundDayDup = false;
for (const [date, items] of Object.entries(dayTopics)) {
  const seen = new Map();
  for (const item of items) {
    if (seen.has(item.topic)) {
      foundDayDup = true;
      console.log(`[同天重复] 日期: ${date} | 选题: ${item.topic} | 账号1: ${seen.get(item.topic)} | 账号2: ${item.acc}`);
    } else {
      seen.set(item.topic, item.acc);
    }
  }
}
if (!foundDayDup) {
  console.log('台账中无同天重复记录！');
}
