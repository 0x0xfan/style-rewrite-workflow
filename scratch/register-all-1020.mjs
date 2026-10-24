import fs from 'node:fs';
import path from 'node:path';
import { loadRegistry } from '../engine/return/lib.mjs';
import { saveRegistry } from '../engine/return/registry.mjs';

const entries = loadRegistry();

const items = [
  {
    id: "20261020-直播贴片图-black-yellow-v2-h",
    topic: "直播贴片图",
    film: "topic-mvdgxamn",
    style: "小Lin",
    version: "直播贴片图-black-yellow-v2-h",
    draft: "Z:/素材生成库/ai文案/待审文案/直播贴片图/20261020-直播贴片图-black-yellow-v2-h.txt",
    angle: "风格-小Lin",
    date: "2026-10-20",
    note: "风格 小Lin；黑黄 横版 5.5min；1694字"
  },
  {
    id: "20261020-装修避坑-lime-capsule-h",
    topic: "装修避坑",
    film: "topic-mvdh3c79",
    style: "嘴替",
    version: "装修避坑-lime-capsule-h",
    draft: "Z:/素材生成库/ai文案/待审文案/装修避坑/20261020-装修避坑-lime-capsule-h.txt",
    angle: "风格-嘴替",
    date: "2026-10-20",
    note: "风格 嘴替；荧光绿 横版 4.5min；1294字"
  },
  {
    id: "20261020-儿童英语-signature-wall-h",
    topic: "儿童英语",
    film: "topic-mvdgyi8c",
    style: "老友",
    version: "儿童英语-signature-wall-h",
    draft: "Z:/素材生成库/ai文案/待审文案/儿童英语/20261020-儿童英语-signature-wall-h.txt",
    angle: "风格-老友",
    date: "2026-10-20",
    note: "风格 老友；署名墙横版 6.5min；1990字"
  },
  {
    id: "20261020-剧本杀-ledger-desk-h",
    topic: "剧本杀",
    film: "topic-mvdh4epr",
    style: "钱十七",
    version: "剧本杀-ledger-desk-h",
    draft: "Z:/素材生成库/ai文案/待审文案/剧本杀/20261020-剧本杀-ledger-desk-h.txt",
    angle: "风格-钱十七",
    date: "2026-10-20",
    note: "风格 钱十七；对账台横版 5.0min；1498字"
  },
  {
    id: "20261020-键盘皮肤（美化包）-blueprint-h",
    topic: "键盘皮肤（美化包）",
    film: "topic-mvc6l59j",
    style: "老王",
    version: "键盘皮肤（美化包）-blueprint-h",
    draft: "Z:/素材生成库/ai文案/待审文案/键盘皮肤（美化包）/20261020-键盘皮肤（美化包）-blueprint-h.txt",
    angle: "风格-老王",
    date: "2026-10-20",
    note: "风格 老王；蓝图拆解横版 7.5min；2247字"
  },
  {
    id: "20261020-隐藏的图画-pixel-arcade-h",
    topic: "隐藏的图画",
    film: "topic-mvbpcuf9",
    style: "半佛",
    version: "隐藏的图画-pixel-arcade-h",
    draft: "Z:/素材生成库/ai文案/待审文案/隐藏的图画/20261020-隐藏的图画-pixel-arcade-h.txt",
    angle: "风格-半佛",
    date: "2026-10-20",
    note: "风格 半佛；像素街机横版 8.5min；2331字"
  },
  {
    id: "20261020-数独-black-yellow-v2-v",
    topic: "数独",
    film: "topic-mvc6wzpk",
    style: "常规",
    version: "数独-black-yellow-v2-v",
    draft: "Z:/素材生成库/ai文案/待审文案/数独/20261020-数独-black-yellow-v2-v.txt",
    angle: "A1痛点反常识",
    date: "2026-10-20",
    note: "黑黄 竖版 1.5min；417字"
  },
  {
    id: "20261020-做饭-lime-capsule-v",
    topic: "做饭",
    film: "topic-mvc6jxug",
    style: "常规",
    version: "做饭-lime-capsule-v",
    draft: "Z:/素材生成库/ai文案/待审文案/做饭/20261020-做饭-lime-capsule-v.txt",
    angle: "A1痛点反常识",
    date: "2026-10-20",
    note: "荧光绿 竖版 2.5min；668字"
  },
  {
    id: "20261020-表情包-signature-wall-v",
    topic: "表情包",
    film: "topic-mvc6n2x4",
    style: "常规",
    version: "表情包-signature-wall-v",
    draft: "Z:/素材生成库/ai文案/待审文案/表情包/20261020-表情包-signature-wall-v.txt",
    angle: "A1痛点反常识",
    date: "2026-10-20",
    note: "署名墙 竖版 1.0min；312字"
  },
  {
    id: "20261020-名著动画+测试-ledger-desk-v",
    topic: "名著动画+测试",
    film: "topic-mvc6r6r6",
    style: "常规",
    version: "名著动画+测试-ledger-desk-v",
    draft: "Z:/素材生成库/ai文案/待审文案/名著动画+测试/20261020-名著动画+测试-ledger-desk-v.txt",
    angle: "A1痛点反常识",
    date: "2026-10-20",
    note: "对账台 竖版 2.0min；565字"
  },
  {
    id: "20261020-美团饿了么大额优惠券-blueprint-v",
    topic: "美团饿了么大额优惠券",
    film: "coupon-003",
    style: "常规",
    version: "美团饿了么大额优惠券-blueprint-v",
    draft: "Z:/素材生成库/ai文案/待审文案/美团饿了么大额优惠券/20261020-美团饿了么大额优惠券-blueprint-v.txt",
    angle: "A1反差型+信息差反常识钩子",
    date: "2026-10-20",
    note: "蓝图拆解 竖版 1.5min；477字"
  },
  {
    id: "20261020-拼豆图纸-pixel-arcade-v",
    topic: "拼豆图纸",
    film: "pindou-tuzhi",
    style: "常规",
    version: "拼豆图纸-pixel-arcade-v",
    draft: "Z:/素材生成库/ai文案/待审文案/拼豆图纸/20261020-拼豆图纸-pixel-arcade-v.txt",
    angle: "A1反差型+数据冲击钩子",
    date: "2026-10-20",
    note: "像素街机 竖版 2.0min；592字"
  },
  {
    id: "20261020-买家问售后能不能加微信聊该怎么回-chat-v",
    topic: "买家问售后能不能加微信聊该怎么回",
    film: "maijia-wen-shouhou-neng-bu-neng-jia-weixin",
    style: "聊天记录",
    version: "买家问售后能不能加微信聊该怎么回-chat-v",
    draft: "Z:/素材生成库/ai文案/待审文案/买家问售后能不能加微信聊该怎么回/20261020-买家问售后能不能加微信聊该怎么回-chat-v.txt",
    angle: "对话型引流避坑",
    date: "2026-10-20",
    note: "聊天记录 竖版 1.5min；430字"
  },
  {
    id: "20261020-戏曲资源-selfie-01",
    topic: "戏曲资源",
    film: "xiqu-ziyuan",
    style: "常规",
    version: "戏曲资源-selfie-01",
    draft: "Z:/素材生成库/ai文案/待审文案/戏曲资源/20261020-戏曲资源-selfie-01.txt",
    angle: "A1+1痛点反常识",
    date: "2026-10-20",
    note: "真人出镜 selfie-01 1.5min；406字"
  },
  {
    id: "20261020-盘点闲鱼上宝妈最舍得掏钱买的这三种启蒙益智虚拟品-selfie-02",
    topic: "盘点闲鱼上宝妈最舍得掏钱买的这三种启蒙益智虚拟品",
    film: "pandian-baoma-qimeng-yizhi",
    style: "常规",
    version: "盘点闲鱼上宝妈最舍得掏钱买的这三种启蒙益智虚拟品-selfie-02",
    draft: "Z:/素材生成库/ai文案/待审文案/盘点闲鱼上宝妈最舍得掏钱买的这三种启蒙益智虚拟品/20261020-盘点闲鱼上宝妈最舍得掏钱买的这三种启蒙益智虚拟品-selfie-02.txt",
    angle: "B1+1痛点反常识",
    date: "2026-10-20",
    note: "真人出镜 selfie-02 2.0min；575字"
  },
  {
    id: "20261020-闲鱼新号上架前到底要不要养号怎么养号最有效-selfie-03",
    topic: "闲鱼新号上架前到底要不要养号怎么养号最有效",
    film: "xianyu-xinhao-yanghao",
    style: "常规",
    version: "闲鱼新号上架前到底要不要养号怎么养号最有效-selfie-03",
    draft: "Z:/素材生成库/ai文案/待审文案/闲鱼新号上架前到底要不要养号怎么养号最有效/20261020-闲鱼新号上架前到底要不要养号怎么养号最有效-selfie-03.txt",
    angle: "B3+1痛点反常识",
    date: "2026-10-20",
    note: "真人出镜 selfie-03 2.5min；656字"
  }
];

let added = 0;
for (const it of items) {
  if (entries.some(e => e.id === it.id)) {
    console.log(`跳过已存在: ${it.id}`);
    continue;
  }
  entries.push({
    id: it.id,
    选题: it.topic,
    filmId: it.film,
    风格: it.style,
    版本: it.version,
    稿件路径: it.draft,
    配料包: "",
    事实链: "",
    事实卡: "",
    素材目录: "",
    开头角度: it.angle,
    交付日期: it.date,
    状态: "已交付待回稿",
    备注: it.note
  });
  added++;
}

saveRegistry(entries);
console.log(`成功新增登记: ${added} 条，当前总计 ${entries.length} 条。`);
