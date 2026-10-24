import fs from 'node:fs';

const oldText = fs.readFileSync('research-runs/每日/20261018-拼豆图纸/20261018-拼豆图纸-ledger-desk-v.txt', 'utf8');

const script = {
  "slug": "pindou-tuzhi",
  "selectedAngle": {
    "id": "ANGLE_1_PASSIVE_DELIVERY",
    "title": "轻资产网盘秒发流 (大众低门槛躺赚)",
    "rationale": "针对零基础副业与手工新手，以十二万多单全店累销与全自动网盘秒发为核心爆点，突出宝可梦等高清单色号对照图纸刚需，完播率与信任度最高。"
  },
  "scenes": [
    {
      "sceneId": "S01",
      "role": "HOOK_BREAK_BIAS",
      "voiceover": "你在闲鱼搜拼豆图纸，同行单链接就有数千人想要，标价从一块八到八块八不等。\n只要买家付款，系统就会自动发货秒发，属于典型的零边际成本赚纯利生意。\n很多人想不到，这里卖的是宝可梦等高清单色号对照拼豆图纸合集包。",
      "visualAsset": "ips/xianyu-fanshen/assets/pindou-tuzhi/market/01-search-results.png",
      "highlightTarget": null,
      "estimatedDurationSec": 15.0,
      "emotionTone": "颠覆、紧迫、打破偏见"
    },
    {
      "sceneId": "S02",
      "role": "MARKET_VALIDATION",
      "voiceover": "为什么会有人为电子版图纸买单？\n查一下百度大盘指数，全网每天有两千八百多人专门检索拼豆图纸。\n这群买家主要是手作爱好者和年轻宝妈，自己给孩子拼图案时，最怕网上搜来的图片模糊不清。\n一旦色号对照出错，整幅作品就很容易拼错报废。\n花两三块钱直接买下整理好的文件，能省掉到处找图试色的大把精力。",
      "visualAsset": "ips/xianyu-fanshen/assets/pindou-tuzhi/demand/01-baidu-index-pindou.clean.png",
      "highlightTarget": "facts.baiduTrend",
      "estimatedDurationSec": 25.0,
      "emotionTone": "权威、大盘数据、刚需确权"
    },
    {
      "sceneId": "S03",
      "role": "COMMERCIAL_PROOF_AND_NICHES",
      "voiceover": "看闲鱼上这家店铺，全店靠纯数字合集总共卖出十二万多单。\n如果你打算进场，千万别去跟大卖家硬抢泛关键词。\n仔细看闲鱼搜索下拉发现，像立体款、定制以及拼豆生成器，搜索热度都非常高。\n把这些带着购买意图的长尾细分词排入标题，进店的流量就会更加精准。",
      "visualAsset": "ips/xianyu-fanshen/assets/pindou-tuzhi/market/06-item-1075697629297.clean.png",
      "highlightTarget": "facts.shopScale",
      "estimatedDurationSec": 26.0,
      "emotionTone": "揭秘、细分长尾、商业空间"
    },
    {
      "sceneId": "S04",
      "role": "SOURCING_AND_AUTO_DELIVERY",
      "voiceover": "很多人关心货源与交付怎么做。\n你可以直接把网上的公版高清图纸与色号对照表分类打包，做成独立的合集包。\n按热门动漫和不同形象分好文件夹，主图放上带颗粒数与单色号的实机对照效果图。\n然后在后台对接自动发货机器人，把对应网盘提取链接预先设置好。\n客户一旦拍下付款，后台零点一秒自动把网盘链接秒发给买家，完全不用人工值守。",
      "visualAsset": "ips/xianyu-fanshen/assets/pindou-tuzhi/market/03-item-1046105892371.clean.png",
      "highlightTarget": "facts.autoDelivery",
      "estimatedDurationSec": 28.0,
      "emotionTone": "解密、极速履约、实操交付"
    },
    {
      "sceneId": "S05",
      "role": "CALL_TO_ACTION",
      "voiceover": "必须要提醒的是，我们只卖电子版数字图纸，绝不去碰假冒的塑料实物。\n新手开启的第一步，先挑选一套热门动漫的色号对照图纸，把文件夹层级建清晰。\n把图纸分类整理顺畅，主图对比交代到位，这个品就能全自动为你持续出单。\n我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。\n学闲鱼，找圣矾。",
      "visualAsset": "ips/xianyu-fanshen/assets/pindou-tuzhi/supply/02-seller-deliverable-thumb-2.clean.png",
      "highlightTarget": null,
      "estimatedDurationSec": 24.0,
      "emotionTone": "笃定、升华、号召行动"
    }
  ]
};

const scriptPath = 'research-runs/每日/20261020-拼豆图纸/pindou-tuzhi-script.json';
fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2), 'utf8');

const txtPath = 'research-runs/每日/20261020-拼豆图纸/20261020-拼豆图纸-pixel-arcade-v.txt';
const lines = script.scenes.map(s => s.voiceover.trim()).join('\n').split('\n').filter(Boolean);
fs.writeFileSync(txtPath, lines.join('\n') + '\n', 'utf8');

const meta = {
  "skin": "pixel-arcade",
  "orientation": "v",
  "lengthTarget": "2.0min",
  "date": "2026-10-20",
  "topicSlug": "pindou-tuzhi",
  "title": "拼豆图纸",
  "style": "常规",
  "scriptJsonPath": "research-runs/每日/20261020-拼豆图纸/pindou-tuzhi-script.json",
  "titles": [
    { "style": "手把手实操", "text": "手把手教你在闲鱼卖拼豆图纸 从分类打包到自动发货全流程" },
    { "style": "反问测真假", "text": "在闲鱼卖电子版拼豆图纸真的有人买吗 拆解十二万单真实需求" },
    { "style": "劝退避坑", "text": "想在闲鱼卖拼豆图纸先听劝 只做电子图纸千万别碰塑料实物" },
    { "style": "老玩家交代", "text": "在闲鱼做拼豆图纸怎么起步 老玩家交底 做好这几步少走弯路" },
    { "style": "货源工具直给", "text": "闲鱼拼豆图纸去哪找货源 公版高清素材与色号对照全盘交代" },
    { "style": "底层逻辑拆解", "text": "为什么简单的拼豆图纸在闲鱼能卖十二万单 深度拆解交付逻辑" },
    { "style": "反常识揭秘", "text": "以为做手工必须自己拼豆发货 揭秘闲鱼电子图纸纯利打法" },
    { "style": "轻资产人群画像", "text": "零库存不用自己拼 适合宝妈与新手的闲鱼拼豆图纸轻资产副业" },
    { "style": "一期讲透通关", "text": "一期短视频讲透闲鱼拼豆图纸怎么做 高清图纸与自动发货一次讲透" },
    { "style": "精炼短句", "text": "闲鱼拼豆图纸实操全流程 电子合集与自动发货变现教程" }
  ]
};
const metaPath = 'research-runs/每日/20261020-拼豆图纸/20261020-拼豆图纸-pixel-arcade-v.meta.json';
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

let hanzi = 0;
lines.forEach((l, idx) => {
  const m = l.match(/[\u4e00-\u9fa5]/g);
  const h = m ? m.length : 0;
  hanzi += h;
  console.log(`${idx + 1}: len=${l.length}, hanzi=${h} -> ${l}`);
});
console.log(`\nTotal lines: ${lines.length}, Total hanzi: ${hanzi}`);
