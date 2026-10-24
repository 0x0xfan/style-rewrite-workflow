import fs from 'node:fs';

const script = {
  "slug": "coupon-003",
  "selectedAngle": {
    "id": "ANGLE_1_EXTREME_PRICE_GAP",
    "title": "悬殊差价冲击流 (立省几十上百)",
    "rationale": "面向每天点外卖的打工人和学生党，通过外卖满减立省与闲鱼领券链接极低标价切入，以全店累销数万单与全自动秒发为核心证据，转化与完播率最高。"
  },
  "scenes": [
    {
      "sceneId": "S01",
      "role": "HOOK_BREAK_BIAS",
      "voiceover": "很多人平时点外卖都不知道，在闲鱼卖外卖神券领取链接，标价几毛钱到两三块钱，全店能成交数万单。\n买家拍下后自动发货秒发，不压库存不垫资，完全是一门不用自己掏钱进货赚纯利的生意。",
      "visualAsset": "ips/xianyu-fanshen/assets/coupon-003/market/01-search-results.png",
      "highlightTarget": null,
      "estimatedDurationSec": 13.0,
      "emotionTone": "颠覆、紧迫、打破偏见"
    },
    {
      "sceneId": "S02",
      "role": "MARKET_VALIDATION",
      "voiceover": "你可能好奇，公开的优惠券到底谁会花钱买？\n看百度大盘真实数据，全网每天有三千四百多人急着搜索打折省钱攻略。\n很多每天点外卖的上班族和在校大学生，每顿都想省下几块钱。\n买家花几毛钱买个领券链接，一顿饭就能立减几块到十几块。\n这种公开正规的活动入口各大平台都有，普通买家平时根本不知道在哪找。",
      "visualAsset": "ips/xianyu-fanshen/assets/coupon-003/demand/01-baidu-index.clean.png",
      "highlightTarget": "facts.dailySearch",
      "estimatedDurationSec": 24.0,
      "emotionTone": "权威、大盘数据、刚需确权"
    },
    {
      "sceneId": "S03",
      "role": "COMMERCIAL_PROOF_AND_NICHES",
      "voiceover": "看闲鱼这家店铺，靠着外卖神券和生活权益，全店累计成交了整整二十一万单。\n新手入场做这个品，标题里带上外卖神券、大额立减等精准词，买家一搜就能进店。\n主图一定要放真实满减对比图，清晰展示领券前后的点餐省钱效果。",
      "visualAsset": "ips/xianyu-fanshen/assets/coupon-003/market/02-top1-detail.clean.png",
      "highlightTarget": "facts.shopSales",
      "estimatedDurationSec": 20.0,
      "emotionTone": "揭秘、细分长尾、商业空间"
    },
    {
      "sceneId": "S04",
      "role": "SOURCING_AND_AUTO_DELIVERY",
      "voiceover": "详情页客观说明券包使用规则与门槛限制，不虚假宣传，也不碰任何违规代充。\n接着在后台配置好自动发货软件，买家拍下后机器人零点一秒秒发领券链接。\n买家一键点进链接就能直接领券，全程不需要你守着手机人工回复。",
      "visualAsset": "ips/xianyu-fanshen/assets/coupon-003/supply/02-seller-deliverable-thumb-1.png",
      "highlightTarget": null,
      "estimatedDurationSec": 19.0,
      "emotionTone": "解密、极速履约、实操交付"
    },
    {
      "sceneId": "S05",
      "role": "CALL_TO_ACTION",
      "voiceover": "新手第一步，先整理出美团和饿了么正规公开的领券入口，把使用步骤理顺。\n把领券入口整理好，主图对比做清楚，这个品就能全天自动跑起来。\n我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。\n学闲鱼，找圣矾。",
      "visualAsset": "ips/xianyu-fanshen/assets/coupon-003/tutorial/01-item-detail-scroll1.png",
      "highlightTarget": null,
      "estimatedDurationSec": 18.0,
      "emotionTone": "笃定、升华、号召行动"
    }
  ]
};

const scriptPath = 'research-runs/每日/20261020-美团饿了么大额优惠券/coupon-003-script.json';
fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2), 'utf8');

const txtPath = 'research-runs/每日/20261020-美团饿了么大额优惠券/20261020-美团饿了么大额优惠券-blueprint-v.txt';
const lines = script.scenes.map(s => s.voiceover.trim()).join('\n').split('\n').filter(Boolean);
fs.writeFileSync(txtPath, lines.join('\n') + '\n', 'utf8');

const meta = {
  "skin": "blueprint",
  "orientation": "v",
  "lengthTarget": "1.5min",
  "date": "2026-10-20",
  "topicSlug": "coupon-003",
  "title": "美团饿了么大额优惠券",
  "style": "常规",
  "scriptJsonPath": "research-runs/每日/20261020-美团饿了么大额优惠券/coupon-003-script.json",
  "titles": [
    { "style": "手把手实操", "text": "手把手教你在闲鱼做外卖优惠券 从整理入口到自动秒发全流程" },
    { "style": "反问测真假", "text": "在闲鱼卖外卖神券真的能成交数万单吗 深度拆解打工人省钱刚需" },
    { "style": "劝退避坑", "text": "想做闲鱼外卖优惠券先听劝 只做正规活动入口千万别碰违规代充" },
    { "style": "老玩家交代", "text": "在闲鱼做外卖神券怎么起步 老玩家交底 做好主图满减对比少走弯路" },
    { "style": "货源工具直给", "text": "外卖神券领券入口去哪找 官方公开正规渠道与自动发货全盘交代" },
    { "style": "底层逻辑拆解", "text": "为什么公开的领券链接在闲鱼能卖数万单 深度拆解权益代订逻辑" },
    { "style": "反常识揭秘", "text": "点外卖不用再付原价 揭秘闲鱼几毛钱外卖神券自动秒发纯利打法" },
    { "style": "轻资产人群画像", "text": "不压库存不垫资 适合打工人与大学生的闲鱼外卖神券轻资产副业" },
    { "style": "一期讲透通关", "text": "一期短视频讲透闲鱼外卖优惠券怎么做 领券入口与自动发货一次搞懂" },
    { "style": "精炼短句", "text": "闲鱼外卖优惠券实操全流程 正规入口与自动发货变现教程" }
  ]
};
const metaPath = 'research-runs/每日/20261020-美团饿了么大额优惠券/20261020-美团饿了么大额优惠券-blueprint-v.meta.json';
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

let hanzi = 0;
lines.forEach((l, idx) => {
  const m = l.match(/[\u4e00-\u9fa5]/g);
  const h = m ? m.length : 0;
  hanzi += h;
  console.log(`${idx + 1}: len=${l.length}, hanzi=${h} -> ${l}`);
});
console.log(`\nTotal lines: ${lines.length}, Total hanzi: ${hanzi}`);
