import fs from 'node:fs';
import { loadLedgerHistory, STANDARD_ACCOUNTS } from '../engine/brief/check-plan.mjs';

const history = loadLedgerHistory();
const accountUsed = {};
for (const acc of STANDARD_ACCOUNTS) {
  accountUsed[acc.id] = new Set((history.get(acc.id) || []).map(x => x.topic));
}

function isAvail(accId, topic) {
  return !accountUsed[accId].has(topic);
}

// Group 2 candidate allocation:
// 1. black-yellow-v2-h (小Lin): 中国地图 (topic-mvarwowx) -> 小Lin拆解地理地图刚需与视觉降维
// 2. lime-capsule-h (嘴替): 剧本杀 (topic-mvdh4epr) -> 嘴替毒舌撕开线下实体店割肉、线上几块钱聚会
// 3. signature-wall-h (老友): 做饭 (topic-mvc6jxug) -> 老友拉家常讲家常菜谱与烘焙配方长青
// 4. ledger-desk-h (钱十七): 儿童英语 (topic-mvdgyi8c) -> 钱十七算账拆解母婴幼教启蒙
// 5. blueprint-h (老王): 直播贴片图 (topic-mvdgxamn) -> 老王极客拆解直播背景与贴片组件自动化
// 6. pixel-arcade-h (半佛): 装修避坑 (topic-mvdh3c79) -> 半佛魔幻讽刺当代人买房装修被套路与避坑指南

// 竖版轻产品
// 7. black-yellow-v2-v: 隐藏的图画 (topic-mvbpcuf9)
// 8. lime-capsule-v: 键盘皮肤（美化包） (topic-mvc6l59j)
// 9. signature-wall-v: 数独 (topic-mvc6wzpk)
// 10. ledger-desk-v: 表情包 (topic-mvc6n2x4)
// 11. blueprint-v: 拼豆图纸 (pindou-tuzhi) -> Wait, blueprint-v history?
// 12. pixel-arcade-v: 美团饿了么大额优惠券 (coupon-003) -> Wait, pixel-arcade-v history?

// 13. chat-v: 买家问资料能不能试看一段该怎么回 (经验库 X-客服-012)
// 14. selfie-01: 描红字帖 (topic-mv97i0hg)
// 15. selfie-02: 盘点闲鱼上开店小微商家常年回购的这三种刚需设计模版 (经验库 X-选品-046)
// 16. selfie-03: 闲鱼商品有曝光却没人点进来看到底是主图还是价格出了问题 (经验库 X-上架-010)

const g2 = [
  { acc: 'black-yellow-v2-h', topic: '中国地图' },
  { acc: 'lime-capsule-h', topic: '剧本杀' },
  { acc: 'signature-wall-h', topic: '做饭' },
  { acc: 'ledger-desk-h', topic: '儿童英语' },
  { acc: 'blueprint-h', topic: '直播贴片图' },
  { acc: 'pixel-arcade-h', topic: '装修避坑' },
  { acc: 'black-yellow-v2-v', topic: '隐藏的图画' },
  { acc: 'lime-capsule-v', topic: '键盘皮肤（美化包）' },
  { acc: 'signature-wall-v', topic: '数独' },
  { acc: 'ledger-desk-v', topic: '表情包' },
  { acc: 'blueprint-v', topic: '拼豆图纸' },
  { acc: 'pixel-arcade-v', topic: '美团饿了么大额优惠券' },
  { acc: 'chat-v', topic: '买家问资料能不能试看一段该怎么回' },
  { acc: 'selfie-01', topic: '描红字帖' },
  { acc: 'selfie-02', topic: '盘点闲鱼上开店小微商家常年回购的这三种刚需设计模版' },
  { acc: 'selfie-03', topic: '闲鱼商品有曝光却没人点进来看到底是主图还是价格出了问题' }
];

console.log('--- Checking Group 2 ---');
for (const item of g2) {
  const ok = isAvail(item.acc, item.topic);
  console.log(item.acc.padEnd(20), item.topic.padEnd(25), ok ? 'OK' : 'DUPLICATE IN LEDGER');
}
