import { checkPlan, parsePlanTable } from '../engine/brief/check-plan.mjs';

const testTable = `
| 序号 | 账号 (皮肤) | 版式 | 选题 | 类型 | 风格 | 目标时长 | topicSlug | 核心要点 (卖什么 / 钱从哪来 / 主推做法) |
|---|---|---|---|---|---|---|---|---|
| 01 | 黑黄 横版 (black-yellow-v2) | 横版 | AI账号拼车 | 产品题 | 小Lin | 5.5min | ai-pinche-qian17 | 卖海外大模型算力拼车合租与卡密授权使用指南，标价九块九，全店一万九千多单，自动发货秒发 |
| 02 | 荧光绿 横版 (lime-capsule) | 横版 | 商业计划书BP代写 | 产品题 | 嘴替 | 4.5min | chuangye-jihuashu | 卖创业投资商业计划书BP模版合集与AI代写框架，标价六十八元，全店一万八千多单，自动发货秒发 |
| 03 | 署名墙 横版 (signature-wall) | 横版 | 钩织 | 产品题 | 老友 | 6.5min | topic-mvel3b4v | 卖热门玩偶包包高清钩织针法图纸与视频教程合集，单套两块到五块，全套九块九，自动发货零成本 |
| 04 | 对账台 横版 (ledger-desk) | 横版 | 微信聊天记录导出 | 产品题 | 钱十七 | 5.0min | liaotian-jilu-daochu | 卖换机数据迁移与微信聊天记录电脑端导出解析工具包，单品九毛九，全店三万一千多单，拍下秒发 |
| 05 | 蓝图拆解 横版 (blueprint) | 横版 | 安卓连点器 | 产品题 | 老王 | 7.5min | topic-mveyf9yv | 卖手机自动化打卡抢票脚本与免Root连点器工具包，单套三块到六块，全店两万多单，拍下秒发 |
| 06 | 像素街机 横版 (pixel-arcade) | 横版 | 民间鬼故事 | 产品题 | 半佛 | 8.5min | topic-mveydvi9 | 卖深夜民俗志怪故事全套高清音频与电子书合集，单套两块到五块，合集九块九，全店三万多单，拍下秒发 |
| 07 | 黑黄 竖版 (black-yellow-v2) | 竖版 | 手抄报模板 | 产品题 | 常规 | 1.5min | topic-mv97gi1y | 卖中小学生各节日手抄报黑白线稿与涂色线稿打印电子版，单品一块到三块，全店一万多单，自动发货 |
| 08 | 荧光绿 竖版 (lime-capsule) | 竖版 | 拍照姿势 | 产品题 | 常规 | 2.0min | topic-mvarsxuz | 卖旅行情侣日常出行手机拍照构图与机位姿势打卡图卡合集，单品两块到五块，全店两万多单，拍下秒发 |
| 09 | 署名墙 竖版 (signature-wall) | 竖版 | 证件照换底换衣服 | 产品题 | 常规 | 1.0min | topic-mv97kgtz | 卖一寸二寸红蓝底转换、换正装智能模板与简易操作教程，全店一万六千多单，单品三万人想要，拍下秒发 |
| 10 | 对账台 竖版 (ledger-desk) | 竖版 | 四六级词汇 | 产品题 | 常规 | 2.5min | siliuji-cihui | 卖大学四六级乱序高频冲刺词汇PDF与考前默写本合集，标价两块到五块，全店七万多单，拍下秒发 |
| 11 | 蓝图拆解 竖版 (blueprint) | 竖版 | 网盘扩容 | 产品题 | 常规 | 1.5min | topic-mveycs7q | 卖网盘大容量虚拟扩容技巧与防爆空间整理配置包，单套三块到六块，全店两万多单，拍下秒发 |
| 12 | 像素街机 竖版 (pixel-arcade) | 竖版 | 解压视频 | 产品题 | 常规 | 2.0min | topic-mv97f2ll | 卖修蹄挤痘洗车沉浸式4K无水印高清解压视频素材大合集，单品一块到三块，全店一万多单，拍下秒发 |
| 13 | 聊天记录 (chat) | 竖版 | 电脑投屏软件 | 产品题 | 产品拆解 | 1.5min | touping-ruanjian | 【产品拆解】粉丝甩截图发问两毛钱投屏软件卖两万九千多单，拆解大屏投屏刚需痛点、无广告工具包与网盘自动发货跑量机制 |
`;

const items = parsePlanTable(testTable);
console.log('解析到项目数:', items.length);
const res = checkPlan(items, { checkDate: '2026-10-23', noSelfie: true });
console.log('CheckPlan 结果:', res.success ? 'PASS' : 'FAIL');
if (!res.success) {
  console.error('Errors:', res.errors);
} else {
  console.log('🎉 全部门禁通过！');
}
