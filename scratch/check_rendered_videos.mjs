import fs from 'fs';
import path from 'path';

function findMp4(dir, list = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        findMp4(full, list);
      } else if (ent.name.toLowerCase().endsWith('.mp4')) {
        list.push({ path: full, name: ent.name });
      }
    }
  } catch (e) {}
  return list;
}

const videos = findMp4('Z:/素材生成库/视频');
console.log(`视频总数: ${videos.length}`);

// 分析视频文件名，通常格式形如:
// 20261016-苹果手表-lime-capsule-h.mp4 或包含 选题 和 皮肤
const bySkinAndTopic = {};

for (const v of videos) {
  // 提取可能的皮肤和选题
  // 比如 20261004-淘客截流-ledger-desk-v.mp4
  const m = v.name.match(/(?:(\d{8})-)?([^\-]+)-([^\.]+)\.mp4$/);
  // 或者打印所有名字
}

// 统计文件名在不同路径下的完全同名或近似同名
const nameMap = new Map();
for (const v of videos) {
  if (!nameMap.has(v.name)) {
    nameMap.set(v.name, []);
  }
  nameMap.get(v.name).push(v.path);
}

console.log('\n=== 完全同名视频文件重复出现 ===');
for (const [name, paths] of nameMap.entries()) {
  if (paths.length > 1) {
    console.log(`[同名文件] ${name} (出现了 ${paths.length} 次)`);
    paths.forEach(p => console.log(`   ${p}`));
  }
}

// 提取选题 + 皮肤
// 格式通常是: [日期]-[选题]-[皮肤]-[版式].mp4
// 或 [选题]-[皮肤]
const parseMap = new Map();
for (const v of videos) {
  // 尝试匹配常见命名规则
  // 例如: 20261016-四六级词汇-black-yellow-v2-h.mp4
  // 皮肤通常包含: black-yellow-v2, lime-capsule, signature-wall, ledger-desk, blueprint, pixel-arcade, chat, selfie
  const skins = ['black-yellow-v2', 'lime-capsule', 'signature-wall', 'ledger-desk', 'blueprint', 'pixel-arcade', 'chat', 'selfie-01', 'selfie-02', 'selfie-03'];
  let foundSkin = null;
  let orientation = null;
  for (const s of skins) {
    if (v.name.includes(s)) {
      foundSkin = s;
      if (v.name.includes(`${s}-h`)) orientation = 'h';
      else if (v.name.includes(`${s}-v`)) orientation = 'v';
      break;
    }
  }
  
  if (foundSkin) {
    // 提取选题: 假设文件名去掉 日期前缀 和 -[skin]...
    let clean = v.name.replace(/\.mp4$/i, '');
    clean = clean.replace(/^\d{8}-/, '');
    clean = clean.replace(new RegExp(`-${foundSkin}.*$`), '');
    const topic = clean;
    const key = `${foundSkin}__${orientation || 'unknown'}__${topic}`;
    if (!parseMap.has(key)) parseMap.set(key, []);
    parseMap.get(key).push({ path: v.path, name: v.name });
  }
}

console.log('\n=== 同一皮肤同一版式同一选题生成了多个视频 ===');
let foundSkinTopicDup = false;
for (const [key, items] of parseMap.entries()) {
  if (items.length > 1) {
    foundSkinTopicDup = true;
    console.log(`[皮肤+选题重复] key: ${key}`);
    items.forEach(it => console.log(`   ${it.path}`));
  }
}
if (!foundSkinTopicDup) {
  console.log('未检测到同一皮肤同一版式同一选题的重复视频！');
}
