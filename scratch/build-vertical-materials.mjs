import fs from 'node:fs';
import path from 'node:path';

const mPath = 'D:/项目仓库/remotion视频制作/ips/xianyu-fanshen/assets/manifest.json';
const manifest = JSON.parse(fs.readFileSync(mPath, 'utf8'));

const tasks = [
  { topic: '减脂计划', slug: 'jianzhi-jihua', skin: 'black-yellow-v2', o: 'v' },
  { topic: '电影票代买', slug: 'dianyingpiao-daimai', skin: 'lime-capsule', o: 'v' },
  { topic: '海底捞券', slug: 'haidilao-quan', skin: 'signature-wall', o: 'v' },
  { topic: '网盘拉新', slug: 'wangpan-laxin', skin: 'ledger-desk', o: 'v' },
  { topic: '戏曲资源', slug: 'xiqu-ziyuan', skin: 'blueprint', o: 'v' },
  { topic: 'C盘清理', slug: 'c-pan-qing-li', skin: 'pixel-arcade', o: 'v' },
];

for (const t of tasks) {
  const baseName = `20261011-${t.topic}-${t.skin}-${t.o}`;
  const txtPath = `Z:/素材生成库/ai文案/待审文案/${t.topic}/${baseName}.txt`;
  const matPath = `Z:/素材生成库/ai文案/待审文案/${t.topic}/${baseName}.素材.md`;
  const localMatPath = `research-runs/每日/20261011-${t.topic}/${baseName}.素材.md`;

  const lines = fs.readFileSync(txtPath, 'utf8').trim().split('\n').filter(Boolean);
  const imgs = (manifest.images || []).filter(img => img.path?.includes(t.slug));

  let md = `# ${t.topic} 短视频素材对照\nfilmId: ${t.slug}\n稿件: ${baseName}.txt\n画幅: 竖屏 9:16\n\n`;
  md += `| 句 | 原句 | 画面素材（manifest 里的 path） | 为什么用这张 |\n`;
  md += `|---|---|---|---|\n`;

  lines.forEach((line, idx) => {
    const num = idx + 1;
    let img = null;
    let reason = '对应讲解内容画面演示';

    if (num <= 2 && imgs.length > 0) {
      img = imgs[0].path;
      reason = '展示闲鱼搜索大盘与真实想要数据';
    } else if (num === 3 && imgs.length > 1) {
      img = imgs[1].path;
      reason = '展示买家需求痛点与咨询场景';
    } else if (num === 4 || num === 5) {
      if (imgs.length > 2) {
        img = imgs[2].path;
        reason = '展示产品交付形态与工具详情';
      }
    } else if (num === 7 || num === 8) {
      if (imgs.length > 3) {
        img = imgs[3].path;
        reason = '展示多规格定价与出单细节';
      }
    } else if (num >= lines.length - 3) {
      img = '（无，口播收拢与品牌包装）';
      reason = '';
    } else {
      const pick = imgs[num % imgs.length];
      if (pick) {
        img = pick.path;
        reason = '补充实操与商品细节证据';
      } else {
        img = '（无，口播讲解）';
        reason = '';
      }
    }

    md += `| ${num} | ${line} | ${img || '（无，口播过渡）'} | ${reason} |\n`;
  });

  md += `\n## 缺图\n- 无\n`;

  fs.writeFileSync(matPath, md, 'utf8');
  fs.writeFileSync(localMatPath, md, 'utf8');
  console.log('Created .素材.md for', t.topic);
}
