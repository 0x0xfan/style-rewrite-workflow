import { execSync } from 'child_process';

const items = [
  { id: '20261013-AI账号代充-black-yellow-v2-h', topic: 'AI账号代充', film: 'ai-zhanghao-daichong', style: '小Lin', draft: 'Z:/素材生成库/ai文案/待审文案/AI账号代充/20261013-AI账号代充-black-yellow-v2-h.txt', note: '黑黄横版5min；小Lin风格；模板tpl-10-dark-wood-car 3行' },
  { id: '20261013-苹果多开分身-lime-capsule-h', topic: '苹果多开分身', film: 'pingguo-duokai', style: '嘴替', draft: 'Z:/素材生成库/ai文案/待审文案/苹果多开分身/20261013-苹果多开分身-lime-capsule-h.txt', note: '荧光绿横版5min；嘴替风格；模板tpl-09-camera-lightning 4行' },
  { id: '20261013-城市年鉴-signature-wall-h', topic: '城市年鉴', film: 'chengshi-nianjian', style: '老友', draft: 'Z:/素材生成库/ai文案/待审文案/城市年鉴/20261013-城市年鉴-signature-wall-h.txt', note: '署名墙横版5min；老友风格；模板tpl-02-yellow-paper 4行' },
  { id: '20261013-投屏软件-ledger-desk-h', topic: '投屏软件', film: 'touping-ruanjian', style: '钱十七', draft: 'Z:/素材生成库/ai文案/待审文案/投屏软件/20261013-投屏软件-ledger-desk-h.txt', note: '对账台横版5min；钱十七风格；模板tpl-05-dark-gold-badge 2行' },
  { id: '20261013-AI漫剧-blueprint-h', topic: 'AI漫剧', film: 'ai-manju', style: '老王', draft: 'Z:/素材生成库/ai文案/待审文案/AI漫剧/20261013-AI漫剧-blueprint-h.txt', note: '蓝图拆解横版5min；老王风格；模板tpl-03-neon-code 3行' },
  { id: '20261013-海底捞券-pixel-arcade-h', topic: '海底捞券', film: 'haidilao-quan', style: '半佛', draft: 'Z:/素材生成库/ai文案/待审文案/海底捞券/20261013-海底捞券-pixel-arcade-h.txt', note: '像素街机横版5min；半佛风格；模板tpl-07-night-cartoon 3行' },
  { id: '20261013-抖音续火花代充-black-yellow-v2-v', topic: '抖音续火花代充', film: 'douyin-xuhuohua', style: '常规', draft: 'Z:/素材生成库/ai文案/待审文案/抖音续火花代充/20261013-抖音续火花代充-black-yellow-v2-v.txt', note: '黑黄竖版1-2min；常规风格' },
  { id: '20261013-网盘拉新-lime-capsule-v', topic: '网盘拉新', film: 'wangpan-laxin', style: '常规', draft: 'Z:/素材生成库/ai文案/待审文案/网盘拉新/20261013-网盘拉新-lime-capsule-v.txt', note: '荧光绿竖版1-2min；常规风格' },
  { id: '20261013-电影票代买-signature-wall-v', topic: '电影票代买', film: 'dianyingpiao-daimai', style: '常规', draft: 'Z:/素材生成库/ai文案/待审文案/电影票代买/20261013-电影票代买-signature-wall-v.txt', note: '署名墙竖版1-2min；常规风格' },
  { id: '20261013-驾考资料-ledger-desk-v', topic: '驾考资料', film: 'jiakao-ziliao', style: '常规', draft: 'Z:/素材生成库/ai文案/待审文案/驾考资料/20261013-驾考资料-ledger-desk-v.txt', note: '对账台竖版1-2min；常规风格' },
  { id: '20261013-减脂计划-blueprint-v', topic: '减脂计划', film: 'jianzhi-jihua', style: '常规', draft: 'Z:/素材生成库/ai文案/待审文案/减脂计划/20261013-减脂计划-blueprint-v.txt', note: '蓝图拆解竖版1-2min；常规风格' },
  { id: '20261013-京东家政券-pixel-arcade-v', topic: '京东家政券', film: 'jingdong-jiazheng', style: '常规', draft: 'Z:/素材生成库/ai文案/待审文案/京东家政券/20261013-京东家政券-pixel-arcade-v.txt', note: '像素街机竖版1-2min；常规风格' },
  { id: '20261013-买家收到货挑刺找茬要补偿该怎么回-chat-v', topic: '买家收到货挑刺找茬要补偿该怎么回', film: '无', style: '常规', draft: 'Z:/素材生成库/ai文案/待审文案/买家收到货挑刺找茬要补偿该怎么回/20261013-买家收到货挑刺找茬要补偿该怎么回-chat-v.txt', note: '聊天记录账号1-2min；手机聊天记录格式；无配音' },
  { id: '20261013-闲鱼新手前七天最容易踩的这三个违规坑-selfie-01', topic: '闲鱼新手前七天最容易踩的这三个违规坑', film: '无', style: '常规', draft: 'Z:/素材生成库/ai文案/待审文案/闲鱼新手前七天最容易踩的这三个违规坑/20261013-闲鱼新手前七天最容易踩的这三个违规坑-selfie-01.txt', note: '真人出镜1-2min；账号selfie-01；不出片' },
  { id: '20261013-在闲鱼上一个人就能做起来的这三个高利润虚拟品-selfie-02', topic: '在闲鱼上一个人就能做起来的这三个高利润虚拟品', film: '无', style: '老王', draft: 'Z:/素材生成库/ai文案/待审文案/在闲鱼上一个人就能做起来的这三个高利润虚拟品/20261013-在闲鱼上一个人就能做起来的这三个高利润虚拟品-selfie-02.txt', note: '真人出镜1-2min；账号selfie-02；老王盘点3个虚拟品；不出片' },
  { id: '20261013-在闲鱼上常年闷声出单的这五种冷门刚需小工具-selfie-03', topic: '在闲鱼上常年闷声出单的这五种冷门刚需小工具', film: '无', style: '老王', draft: 'Z:/素材生成库/ai文案/待审文案/在闲鱼上常年闷声出单的这五种冷门刚需小工具/20261013-在闲鱼上常年闷声出单的这五种冷门刚需小工具-selfie-03.txt', note: '真人出镜1-2min；账号selfie-03；老王盘点5个小工具；不出片' }
];

for (const it of items) {
  const cmd = `node engine/return/registry.mjs add --id "${it.id}" --topic "${it.topic}" --film "${it.film}" --draft "${it.draft}" --style "${it.style}" --date 2026-10-13 --note "${it.note}" --force`;
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to add:', it.id, e.message);
  }
}

execSync('node engine/return/registry.mjs render', { stdio: 'inherit' });
console.log('All 16 registered and rendered!');
