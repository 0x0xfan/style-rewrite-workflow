import fs from 'fs';
import path from 'path';

const pendingDir = 'Z:/素材生成库/ai文案/待审文案';
const subdirs = fs.readdirSync(pendingDir);

const files1009 = [];
for (const sub of subdirs) {
  const p = path.join(pendingDir, sub);
  if (fs.statSync(p).isDirectory()) {
    const list = fs.readdirSync(p);
    for (const f of list) {
      if (f.startsWith('20261009-') && f.endsWith('.txt')) {
        files1009.push({ topic: sub, file: f });
      }
    }
  }
}

console.log(`2026-10-09 生成并存放在 NAS 待审文案中的文件数: ${files1009.length}`);
files1009.forEach(x => console.log(`- 选题: ${x.topic} | 文件: ${x.file}`));
