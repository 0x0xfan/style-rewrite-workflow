import fs from 'fs';

const tasks = JSON.parse(fs.readFileSync('Z:/素材生成库/待出片任务.json', 'utf8'));

console.log(`总任务数: ${tasks.length}`);

// 统计每个任务的 (skin, orientation, copyFilePath / topic)
const seen = new Map();
const duplicates = [];

for (const t of tasks) {
  // 解析选题
  // copyFilePath e.g. "Z:\\素材生成库\\ai文案\\待审文案\\淘客截流\\20261004-淘客截流-ledger-desk-v.txt"
  const match = t.copyFilePath ? t.copyFilePath.match(/待审文案[\\/]([^\\/]+)[\\/]/) : null;
  const topic = match ? match[1] : (t.title || 'unknown');
  const key = `${t.skin}__${t.orientation}__${topic}`;
  
  if (seen.has(key)) {
    duplicates.push({
      key,
      skin: t.skin,
      orientation: t.orientation,
      topic,
      first: seen.get(key),
      second: t
    });
  } else {
    seen.set(key, t);
  }
}

console.log(`\n=== 待出片任务.json 中同一个皮肤+同版式+同选题重复的任务 ===`);
console.log(`发现重复组数: ${duplicates.length}`);
for (const d of duplicates) {
  console.log(`[重复出片任务] 皮肤: ${d.skin} | 版式: ${d.orientation} | 选题: ${d.topic}`);
  console.log(`   第一次: no=${d.first.no}, file=${d.first.copyFilePath}, confirmedAt=${d.first.confirmedAt}`);
  console.log(`   第二次: no=${d.second.no}, file=${d.second.copyFilePath}, confirmedAt=${d.second.confirmedAt}`);
}

// 统计所有出片视频目录或者已完成出片
