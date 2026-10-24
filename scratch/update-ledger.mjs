import fs from 'node:fs';
import path from 'node:path';

const ledgerPath = path.resolve('docs/每日/账号选题台账.md');
let content = fs.readFileSync(ledgerPath, 'utf8');

const replacements = [
  {
    target: "| 2026-10-19 | 高质量人生指南 | gaozhiliang-rensheng-zhinan | 20261019-高质量人生指南-black-yellow-v2-h.txt | 存稿 |",
    add: "| 2026-10-20 | 直播贴片图 | topic-mvdgxamn | 20261020-直播贴片图-black-yellow-v2-h.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | AI提示词 | ai-tishici | 20261019-AI提示词-lime-capsule-h.txt | 存稿 |",
    add: "| 2026-10-20 | 装修避坑 | topic-mvdh3c79 | 20261020-装修避坑-lime-capsule-h.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | 笔刷 | bishua | 20261019-笔刷-signature-wall-h.txt | 存稿 |",
    add: "| 2026-10-20 | 儿童英语 | topic-mvdgyi8c | 20261020-儿童英语-signature-wall-h.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | 拼多多砍价 | pin-duo-duo-kan-jia | 20261019-拼多多砍价-ledger-desk-h.txt | 存稿 |",
    add: "| 2026-10-20 | 剧本杀 | topic-mvdh4epr | 20261020-剧本杀-ledger-desk-h.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | AI中转站 | ai-zhongzhuanzhan | 20261019-AI中转站-blueprint-h.txt | 存稿 |",
    add: "| 2026-10-20 | 键盘皮肤（美化包） | topic-mvc6l59j | 20261020-键盘皮肤（美化包）-blueprint-h.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | AIu盘 | ai-upan | 20261019-AIu盘-pixel-arcade-h.txt | 存稿 |",
    add: "| 2026-10-20 | 隐藏的图画 | topic-mvbpcuf9 | 20261020-隐藏的图画-pixel-arcade-h.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | 公众号排版 | gongzhonghao-paiban | 20261019-公众号排版-black-yellow-v2-v.txt | 存稿 |",
    add: "| 2026-10-20 | 数独 | topic-mvc6wzpk | 20261020-数独-black-yellow-v2-v.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | 投屏软件 | touping-ruanjian | 20261019-投屏软件-lime-capsule-v.txt | 存稿 |",
    add: "| 2026-10-20 | 做饭 | topic-mvc6jxug | 20261020-做饭-lime-capsule-v.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | 营业执照代办 | yingye-zhizhao | 20261019-营业执照代办-signature-wall-v.txt | 存稿 |",
    add: "| 2026-10-20 | 表情包 | topic-mvc6n2x4 | 20261020-表情包-signature-wall-v.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | 苹果手表 | pingguo-shoubiao | 20261019-苹果手表-ledger-desk-v.txt | 存稿 |",
    add: "| 2026-10-20 | 名著动画+测试 | topic-mvc6r6r6 | 20261020-名著动画+测试-ledger-desk-v.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | codex安装 | codex-anzhuang | 20261019-codex安装-blueprint-v.txt | 存稿 |",
    add: "| 2026-10-20 | 美团饿了么大额优惠券 | coupon-003 | 20261020-美团饿了么大额优惠券-blueprint-v.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | 明星写真 | mingxing-xiezhen | 20261019-明星写真-pixel-arcade-v.txt | 存稿 |",
    add: "| 2026-10-20 | 拼豆图纸 | pindou-tuzhi | 20261020-拼豆图纸-pixel-arcade-v.txt | 存稿 |"
  },
  {
    target: "| 2026-10-19 | 买家问能不能微信聊该怎么回 | maijia-wen-neng-bu-neng-weixin-liao | 20261019-买家问能不能微信聊该怎么回-chat-v.txt | 存稿 |",
    add: "| 2026-10-20 | 买家问售后能不能加微信聊该怎么回 | maijia-wen-shouhou-neng-bu-neng-jia-weixin | 20261020-买家问售后能不能加微信聊该怎么回-chat-v.txt | 存稿 |"
  },
  {
    target: "| 2026-10-18 | 新手做闲鱼第一单到底该怎么快速破零建立正反馈 | — | 20261018-新手做闲鱼第一单到底该怎么快速破零建立正反馈-selfie-03.txt | 存稿 |",
    add: `| 2026-10-20 | 戏曲资源 | xiqu-ziyuan | 20261020-戏曲资源-selfie-01.txt | 存稿 |\n| 2026-10-20 | 盘点闲鱼上宝妈最舍得掏钱买的这三种启蒙益智虚拟品 | pandian-baoma-qimeng-yizhi | 20261020-盘点闲鱼上宝妈最舍得掏钱买的这三种启蒙益智虚拟品-selfie-02.txt | 存稿 |\n| 2026-10-20 | 闲鱼新号上架前到底要不要养号怎么养号最有效 | xianyu-xinhao-yanghao | 20261020-闲鱼新号上架前到底要不要养号怎么养号最有效-selfie-03.txt | 存稿 |`
  }
];

for (const { target, add } of replacements) {
  if (!content.includes(target)) {
    throw new Error(`Target not found in ledger: ${target}`);
  }
  content = content.replace(target, `${target}\n${add}`);
}

fs.writeFileSync(ledgerPath, content, 'utf8');
console.log('成功向 docs/每日/账号选题台账.md 追加 16 条 2026-10-20 记录！');
