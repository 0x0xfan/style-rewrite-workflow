import { parsePlanTable, checkPlan } from '../engine/brief/check-plan.mjs';

const todayTable = `
| # | 账号 | skin | 版式 | 选题 | 类型 | topicSlug |
|---|---|---|---|---|---|---|
| 1 | 黑黄 横版 | black-yellow-v2 | h | 做饭 | 产品 | topic-mvc6jxug |
| 2 | 荧光绿 横版 | lime-capsule | h | 名著动画+测试 | 产品 | topic-mvc6r6r6 |
| 3 | 署名墙 横版 | signature-wall | h | 数独 | 产品 | topic-mvc6wzpk |
| 4 | 对账台 横版 | ledger-desk | h | 表情包 | 产品 | topic-mvc6n2x4 |
| 5 | 蓝图拆解 横版 | blueprint | h | 键盘皮肤（美化包） | 产品 | topic-mvc6l59j |
| 6 | 像素街机 横版 | pixel-arcade | h | 隐藏的图画 | 产品 | topic-mvbpcuf9 |
| 7 | 黑黄 竖版 | black-yellow-v2 | v | 公众号排版 | 产品 | gongzhonghao-paiban |
| 8 | 荧光绿 竖版 | lime-capsule | v | 投屏软件 | 产品 | touping-ruanjian |
| 9 | 署名墙 竖版 | signature-wall | v | 营业执照代办 | 产品 | yingye-zhizhao |
| 10 | 对账台 竖版 | ledger-desk | v | 苹果手表 | 产品 | pingguo-shoubiao |
| 11 | 蓝图拆解 竖版 | blueprint | v | codex安装 | 产品 | codex-anzhuang |
| 12 | 像素街机 竖版 | pixel-arcade | v | 明星写真 | 产品 | mingxing-xiezhen |
| 13 | 聊天记录 | chat | v | 买家问能不能微信聊该怎么回 | 知识 | maijia-wen-neng-bu-neng-weixin-liao |
| 14 | 真人出镜 1 | selfie | v | 测试真人口播1 | 产品 | - |
| 15 | 真人出镜 2 | selfie | v | 测试真人口播2 | 知识 | - |
| 16 | 真人出镜 3 | selfie | v | 测试真人口播3 | 知识 | - |
`;

const items = parsePlanTable(todayTable);
const result = checkPlan(items, { skipNas: true, checkDate: '2026-10-19' });
console.log('结果 success:', result.success);
console.log('错误数:', result.errors.length);
result.errors.forEach((err, idx) => console.log(`${idx + 1}. ${err}`));
