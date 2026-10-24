import { parsePlanTable, checkPlan } from '../engine/brief/check-plan.mjs';

// 案例 1: 包含各种违规的测试表
const badTable = `
| # | 账号 | skin | 版式 | 选题 | 类型 |
|---|---|---|---|---|---|
| 1 | 黑黄 横版 | black-yellow-v2 | h | 玄学寻物 | 产品 |
| 2 | 荧光绿 横版 | lime-capsule | h | 穿搭 | 产品 |
| 3 | 署名墙 横版 | signature-wall | h | 穿搭 | 产品 |
| 4 | 对账台 横版 | ledger-desk | h | 电影票代买 | 产品 |
| 5 | 蓝图拆解 横版 | blueprint | h | 全新选题A | 产品 |
| 6 | 像素街机 横版 | pixel-arcade | h | 全新选题B | 产品 |
| 7 | 黑黄 竖版 | black-yellow-v2 | v | 全新选题C | 产品 |
| 8 | 荧光绿 竖版 | lime-capsule | v | 全新选题D | 产品 |
| 9 | 署名墙 竖版 | signature-wall | v | 全新选题E | 产品 |
| 10 | 对账台 竖版 | ledger-desk | v | 全新选题F | 产品 |
| 11 | 蓝图拆解 竖版 | blueprint | v | 全新选题G | 产品 |
| 12 | 像素街机 竖版 | pixel-arcade | v | 全新选题H | 产品 |
| 13 | 聊天记录 | chat | v | 全新选题I | 知识 |
| 14 | 真人出镜 1 | selfie | v | 全新选题J | 产品 |
| 15 | 真人出镜 2 | selfie | v | 全新选题K | 知识 |
| 16 | 真人出镜 3 | selfie | v | 淘客截流 | 知识 |
`;

console.log('--- 测试违规用例阻断 ---');
const badItems = parsePlanTable(badTable);
const badResult = checkPlan(badItems);
console.log('结果 success:', badResult.success);
console.log('捕获到的错误数:', badResult.errors.length);
badResult.errors.forEach((err, idx) => console.log(`${idx + 1}. ${err}`));

// 案例 2: 完全合规的 16 篇测试表（全新选题且两两不同）
const goodTable = `
| # | 账号 | skin | 版式 | 选题 | 类型 |
|---|---|---|---|---|---|
| 1 | 黑黄 横版 | black-yellow-v2 | h | 测试全新选题01 | 产品 |
| 2 | 荧光绿 横版 | lime-capsule | h | 测试全新选题02 | 产品 |
| 3 | 署名墙 横版 | signature-wall | h | 测试全新选题03 | 产品 |
| 4 | 对账台 横版 | ledger-desk | h | 测试全新选题04 | 产品 |
| 5 | 蓝图拆解 横版 | blueprint | h | 测试全新选题05 | 产品 |
| 6 | 像素街机 横版 | pixel-arcade | h | 测试全新选题06 | 产品 |
| 7 | 黑黄 竖版 | black-yellow-v2 | v | 测试全新选题07 | 产品 |
| 8 | 荧光绿 竖版 | lime-capsule | v | 测试全新选题08 | 产品 |
| 9 | 署名墙 竖版 | signature-wall | v | 测试全新选题09 | 产品 |
| 10 | 对账台 竖版 | ledger-desk | v | 测试全新选题10 | 产品 |
| 11 | 蓝图拆解 竖版 | blueprint | v | 测试全新选题11 | 产品 |
| 12 | 像素街机 竖版 | pixel-arcade | v | 测试全新选题12 | 产品 |
| 13 | 聊天记录 | chat | v | 测试全新选题13 | 知识 |
| 14 | 真人出镜 1 | selfie | v | 测试全新选题14 | 产品 |
| 15 | 真人出镜 2 | selfie | v | 测试全新选题15 | 知识 |
| 16 | 真人出镜 3 | selfie | v | 测试全新选题16 | 知识 |
`;

console.log('\n--- 测试合规用例放行 ---');
const goodItems = parsePlanTable(goodTable);
const goodResult = checkPlan(goodItems);
console.log('结果 success:', goodResult.success);
console.log('错误数:', goodResult.errors.length);
if (goodResult.success) {
  console.log('✅ 测试全部顺利通过！');
}
