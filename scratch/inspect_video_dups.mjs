import fs from 'fs';
import path from 'path';

// 读取 publish.json
let publish = null;
try {
  publish = JSON.parse(fs.readFileSync('D:/项目仓库/remotion视频制作/tools/console/publish.json', 'utf8'));
} catch (e) {
  console.log('无法读取 publish.json:', e.message);
}

// 检查那几个被点名的重复视频:
// 1. 署名墙 老照片修复
// 2. 荧光绿 减脂计划
// 3. 对账台 电影票代买
// 4. 荧光绿 苹果多开分身
// 5. 署名墙 苹果多开分身
// 6. 荧光绿 聊天记录导出
// 7. 对账台 拼多多砍价

const dupList = [
  { skin: 'signature-wall', skinName: '署名墙', topic: '老照片修复' },
  { skin: 'lime-capsule', skinName: '荧光绿', topic: '减脂计划' },
  { skin: 'ledger-desk', skinName: '对账台', topic: '电影票代买' },
  { skin: 'lime-capsule', skinName: '荧光绿', topic: '苹果多开分身' },
  { skin: 'signature-wall', skinName: '署名墙', topic: '苹果多开分身' },
  { skin: 'lime-capsule', skinName: '荧光绿', topic: '聊天记录导出' },
  { skin: 'ledger-desk', skinName: '对账台', topic: '拼多多砍价' },
];

console.log('=== 分析重复选题在文案库、台账及出片中的记录 ===\n');

for (const item of dupList) {
  console.log(`\n======================================================`);
  console.log(`【皮肤】: ${item.skinName} (${item.skin}) | 【选题】: ${item.topic}`);
  console.log(`======================================================`);
  
  // 1. 查 NAS 待审文案目录下该选题的所有稿件
  const topicDir = path.join('Z:/素材生成库/ai文案/待审文案', item.topic);
  if (fs.existsSync(topicDir)) {
    const files = fs.readdirSync(topicDir).filter(f => f.includes(item.skin));
    console.log(`1. NAS 待审文案 (${topicDir}) 中该皮肤的文件:`);
    files.forEach(f => console.log(`   - ${f}`));
  } else {
    console.log(`1. NAS 待审文案目录不存在: ${topicDir}`);
  }

  // 2. 查视频库中的 mp4 文件
  const videoRoot = 'Z:/素材生成库/视频';
  const matchedVideos = [];
  const dates = fs.readdirSync(videoRoot);
  for (const d of dates) {
    const sub = path.join(videoRoot, d);
    if (fs.statSync(sub).isDirectory()) {
      const vfiles = fs.readdirSync(sub);
      for (const vf of vfiles) {
        if (vf.includes(item.skinName) && vf.includes(item.topic) && vf.endsWith('.mp4')) {
          const full = path.join(sub, vf);
          const stat = fs.statSync(full);
          matchedVideos.push({ file: full, size: (stat.size / 1024 / 1024).toFixed(1) + 'MB', mtime: stat.mtime });
        }
      }
    }
  }
  console.log(`2. 视频库 (Z:/素材生成库/视频) 中的视频文件:`);
  matchedVideos.forEach(v => console.log(`   - [${v.mtime.toISOString().slice(0,10)}] ${v.file} (${v.size})`));
}
