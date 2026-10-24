import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DATE = '2026-10-12';
const DATE_COMPACT = '20261012';
const NAS_BASE = 'Z:\\素材生成库\\ai文案';

const items = [
  // 13. 聊天记录: 买家一开口就问最低多少该怎么回
  {
    type: 'chat',
    topic: '买家一开口就问最低多少该怎么回',
    skin: 'chat',
    orientation: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼回复最低多少 既不降价又能促成成交' },
      { style: '反问测真假', text: '闲鱼买家问最低多少到底降不降 老卖家教你化解压价' },
      { style: '劝退避坑', text: '闲鱼买家问最低多少千万别直接亮底牌 这几种回复直接把利润亏光' },
      { style: '老玩家交代', text: '闲鱼买家开口砍价怎么办 老卖家掏心窝子交代高情商话术' },
      { style: '货源工具直给', text: '闲鱼砍价回复话术模板全公开 留住话头轻松守住利润' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼买家试探心理 为什么开口问最低的往往最想买' },
      { style: '反常识揭秘', text: '以为直接降价能促单 揭秘闲鱼不降价反而成交更快的秘密' },
      { style: '轻资产人群画像', text: '适合闲鱼新手的客服话术指南 一招应对开口压价' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼买家议价应对 试探 赠品 逼单一次讲透' },
      { style: '精炼短句', text: '闲鱼客服技巧 买家一开口问最低多少怎么回' }
    ],
    text: `@左 粉丝 avatar=left-fa.png
@右 圣矾 avatar=right-shengfan.jpg
粉丝：圣矾哥，闲鱼上有买家一开口就问最低多少，到底该怎么回啊？
粉丝：我今天碰到好几个，上来就一句最低多少钱出
粉丝：我老老实实降了10块钱报过去，结果人家扭头就跑了
粉丝：[表情 crying.png]
圣矾：买家一问最低多少，你千万不能直接降价报底牌
圣矾：很多新手第一反应是报个低价留住人，其实正相反
粉丝：[表情 thinking.png]
粉丝：为什么呀？他不是嫌贵想便宜吗？
圣矾：买家问最低多少，绝大多数是在探你的心理底线
圣矾：你直接降价，他会觉得你标价本来就虚，还能砍更多
圣矾：而且你不问需求直接降价，显得你的货根本不值钱
粉丝：那第一句话到底该怎么接啊？
圣矾：第一步先反问确认诚意，把话题从价格拉回产品
圣矾：你可以回：哥，咱家这款标价已经很实惠了
圣矾：您主要是在什么场景用，看中哪个配置？
圣矾：如果您今天诚心要，我看看能不能给您送个实用赠品
粉丝：这样回感觉主动权完全在自己手里！
圣矾：对，第二步如果客户还是咬着价格不放，再给阶梯让步
圣矾：比如：哥，单件真降不了，如果您带两件我给您申请省5块
圣矾：或者：价格是平台统一的，您今天下单我给您优先安排顺丰
圣矾：把价格让步变成价值附加，买家就会觉得占到了大便宜
粉丝：懂了，用赠品和服务挡住直接砍价！
粉丝：那要是遇到砍半价的屠龙刀大爷呢？
圣矾：遇到砍半价的，回他一句幽默拒绝直接过
圣矾：哥，这价格我要是卖给您，回去得被我妈打断腿 {hold=2}
粉丝：哈哈，这招太绝了，既幽默还不伤和气！
粉丝：[表情 laugh.png]
圣矾：做闲鱼心态要稳，守住价格才能守住利润
圣矾：[表情 doge.png]
=====素材清单=====
crying.png：哭泣流泪的表情包
thinking.png：托腮思考的表情包
laugh.png：捂嘴笑的表情包
doge.png：doge狗头表情包`,
    materialMd: `# 买家一开口就问最低多少该怎么回 聊天记录素材清单
filmId: maijia-yikaikou-zuidi-01
稿件: 20261012-买家一开口就问最低多少该怎么回-chat-v.txt
画幅: 竖屏 9:16

| 文件名 | 类型 | 说明 | 本机路径/状态 |
|---|---|---|---|
| crying.png | 表情 | 哭泣流泪的表情包 | 待视频项目找图 |
| thinking.png | 表情 | 托腮思考的表情包 | 待视频项目找图 |
| laugh.png | 表情 | 捂嘴笑的表情包 | 待视频项目找图 |
| doge.png | 表情 | doge狗头表情包 | 待视频项目找图 |
`,
    explanation: `# 买家一开口就问最低多少该怎么回 资料说明

## 概况
- 日期：2026-10-12
- 账号：聊天记录（chat, v）
- 选题：买家一开口就问最低多少该怎么回
- 素材来源：经验库 X-客服-008、X-客服-014、X-客服-011

## 检查结果
- 格式检查：通过
- 合规检查：通过
- 规则检查：通过（0退回级规则命中）
`
  },

  // 14. 真人出镜 1: 商品发布地址到底该定在哪个城市
  {
    type: 'selfie',
    selfieIdx: '01',
    topic: '商品发布地址到底该定在哪个城市',
    orientation: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你闲鱼发货地址怎么定 选对核心城市曝光翻倍' },
      { style: '反问测真假', text: '闲鱼发布地址随便填真能有流量吗 拆解同城算法权重' },
      { style: '劝退避坑', text: '闲鱼上架地址千万别乱填 这几个定位陷阱直接吃掉流量' },
      { style: '老玩家交代', text: '闲鱼商品定位怎么选 老卖家掏心窝子交代大城市选址门道' },
      { style: '货源工具直给', text: '闲鱼高曝光城市定位推荐 产业带与一线大城市定位技巧' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼同城推荐机制 为什么一线城市搜索池更大' },
      { style: '反常识揭秘', text: '以为人在哪就定在哪 揭秘闲鱼全国定点城市的曝光真相' },
      { style: '轻资产人群画像', text: '适合闲鱼新手的定位指南 选对发布地址轻松起流量' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼商品定位选择 产业带 同城 虚拟品一次讲透' },
      { style: '精炼短句', text: '闲鱼运营技巧 商品发布地址到底该定在哪个城市' }
    ],
    text: `很多新手在闲鱼上架商品，第一步就卡在发货地址到底该填自己老家还是填大城市。
随手选个自己所在的县城或者小乡镇，结果上架一个星期连十个浏览量都没有。
我告诉你，闲鱼的推荐算法里有一个非常核心的权重，就是同城推荐与区域搜索池。
如果你人在偏远小地方，买家在搜同城或者附近宝贝的时候，你的商品池子天然就非常小。
所以定发布地址，必须严格按照你的品类特征来匹配。
如果你卖的是数码或者小家电实物，最好定在深圳或者广州，买家潜意识里觉得那是数码源头。
如果你卖的是生活百货或者日用品，直接定在义乌或者杭州，自带货源地和便宜的心理暗示。
而如果你做的是虚拟资料、软件服务或者电子模板，直接无脑定在北上广深。
一线城市的年轻白领和大学生数量庞大，在闲鱼搜索电子类和职场工具的频次极高。
系统会优先把同城活跃买家的搜索流量，分配给同城或者周边的高权重卖家。
这里必须提醒一句，千万别今天定在北京、明天定在拉萨，频繁异地乱跳容易被系统判定账号异常。
选定两到三个适合你品类的一线或者产业带城市，长期稳定深耕。
想做的话，第一步先根据你卖的商品属性，去闲鱼搜索同行看看销量高的老卖家大多定在哪个城市。
把你的新链接发布地址直接对标过去，基础曝光池立刻就能大上好几倍。
把平台的算法规则研究透，做闲鱼其实每一步都有迹可循。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`,
    explanation: `# 商品发布地址到底该定在哪个城市 资料说明

## 概况
- 日期：2026-10-12
- 账号：真人出镜 1（selfie-01, v）
- 选题：商品发布地址到底该定在哪个城市
- 素材来源：经验库 X-上架-004、X-上架-005

## 检查结果
- 合规检查：通过
- 规则检查：通过（0退回级规则命中）
`
  },

  // 15. 真人出镜 2: 新手做闲鱼别碰烂大街的这四个冷门品类直接做 (老王多品盘点式)
  {
    type: 'selfie',
    selfieIdx: '02',
    topic: '新手做闲鱼别碰烂大街的这四个冷门品类直接做',
    orientation: 'v',
    titles: [
      { style: '手把手实操', text: '手把手盘点闲鱼四个冷门虚拟品类 别碰红海直接照着做' },
      { style: '反问测真假', text: '新手在闲鱼做虚拟资料真能出单吗 拆解四个蓝海品类真实空间' },
      { style: '劝退避坑', text: '新手做闲鱼千万别碰烂大街的红海资料 这四个冷门品类直接做' },
      { style: '老玩家交代', text: '闲鱼虚拟品类怎么选 老卖家一次性盘点四个闷声出单的方向' },
      { style: '货源工具直给', text: '闲鱼四个冷门蓝海品类全公开 现成资料自动发货直接跑通' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼冷门虚拟品商业逻辑 为什么小众刚需转化率更高' },
      { style: '反常识揭秘', text: '以为闲鱼虚拟品只能卖烂大街影视课程 揭秘四个冷门赛道高复购真相' },
      { style: '轻资产人群画像', text: '适合闲鱼新手的冷门选品清单 四个低门槛轻资产方向' },
      { style: '一期讲透通关', text: '一期视频盘点透闲鱼四个冷门虚拟赛道 选品 定价 交付一次讲透' },
      { style: '精炼短句', text: '闲鱼选品盘点 新手别碰烂大街的这四个冷门品类直接做' }
    ],
    text: `新手在闲鱼做虚拟项目，千万别去碰那些烂大街的考研大课或者全网通用的影视资源。
大机构天天盯着版权投诉，同行多到打一分钱价格战，新手进去连个响动都听不见。
今天圣矾专门出一条视频，用快节奏给新手盘点四个目前还能稳稳收钱的冷门蓝海品类。
第一个品类是备考速记口诀与易错题库，比如科目一速记口诀、教资易错考点或者摩托车题库。
买家面对上千道厚题库背不下来，花两三块钱买个顺手的口诀省时间，自动发货零纠纷。
第二个品类是生活卡券与打折领券链接，比如餐饮代金券、外卖满减券或者家政保洁券。
买家吃顿饭去结账，花几块钱买个领券链接能立减几十块，他们觉得非常划算，秒拍秒付。
第三个品类是办公与日常实用小工具教程，比如聊天记录备份导出工具或者常用格式转换工具。
普通人换手机或者做备份经常卡在技术门槛上，花十块钱买现成工具和视频指导，买的是省心。
第四个品类是经典公版音视频资源，比如经典名家戏曲唱段合集或者经典老评书音频。
银发群体的长辈在手机上不会搜，儿女为了尽孝花十几块钱买个整套，只要选公版老戏就没有版权风险。
新手起步的第一步，别四个都做，先挑一个你最容易看懂的方向去闲鱼搜排在前面的两三个同行。
照着同行的商品标题和规格上架你的第一条链接，只要方向避开红海，出单是自然而然的事情。
把小众刚需做到位，普通人在闲鱼也能拿到细水长流的稳定收益。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`,
    explanation: `# 新手做闲鱼别碰烂大街的这四个冷门品类直接做 资料说明

## 概况
- 日期：2026-10-12
- 账号：真人出镜 2（selfie-02, v）
- 选题：新手做闲鱼别碰烂大街的这四个冷门品类直接做
- 风格：老王多品盘点式（参考 docs/风格/老王/05-别碰烂大街的.txt）
- 素材来源：用户反馈定制老王多品盘点格式，涵盖备考口诀、生活卡券、实用工具、经典公版音视频四大冷门虚拟品

## 检查结果
- 合规检查：通过
- 规则检查：通过（0退回级规则命中）
`
  },

  // 16. 真人出镜 3: 新手怎么通过同行店铺顺藤摸瓜找爆款
  {
    type: 'selfie',
    selfieIdx: '03',
    topic: '新手怎么通过同行店铺顺藤摸瓜找爆款',
    orientation: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼抄同行找爆款 顺藤摸瓜三步锁定蓝海品' },
      { style: '反问测真假', text: '在闲鱼抄同行真能找到爆款吗 拆解顺藤摸瓜选品逻辑' },
      { style: '劝退避坑', text: '闲鱼选品千万别拍脑袋凭空想 这套顺藤摸瓜方法少走半年弯路' },
      { style: '老玩家交代', text: '闲鱼新手怎么找爆款 老卖家掏心窝子交代挖同行店铺的绝招' },
      { style: '货源工具直给', text: '闲鱼顺藤摸瓜选品全流程公开 从对标店铺到复制上架' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼爆款复制逻辑 为什么看第二梯队链接最赚钱' },
      { style: '反常识揭秘', text: '以为选品要抄第一大爆款 揭秘闲鱼老卖家专门挖腰部新品的门道' },
      { style: '轻资产人群画像', text: '适合闲鱼新手的跟品实操指南 顺藤摸瓜轻松出单' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼同行店铺顺藤摸瓜 搜索 拆解 测款一次讲透' },
      { style: '精炼短句', text: '闲鱼选品技巧 新手怎么通过同行店铺顺藤摸瓜找爆款' }
    ],
    text: `很多新手在闲鱼上架卖东西，最大的毛病就是坐在家里拍脑袋凭空想。
总觉得自己想出来的点子独一无二，结果辛辛苦苦上架十几个品，连一个咨询都没有。
做闲鱼最聪明的捷径，从来不是自己闭门造车，而是在优质同行的店铺里顺藤摸瓜。
第一步，先搜一个你稍微感兴趣的品类大词，找到排在搜索前几名、全店销量几千件的老同行。
第二步，直接点进同行的个人主页，去看他的在售宝贝列表。
这里有个极其关键的技巧，千万不要去抄他店里那条卖得最好的超级大爆款。
因为那种大爆款同行已经积累了几万浏览和几千条好评，权重太高你根本打不过。
你要看的是他最近一个月新上架、并且已经开始陆陆续续出单的第二梯队新品。
老同行能上架这些新品，说明他的货源渠道和市场测试早就替你跑通了。
第三步，点开这些新品的评价区，看看买家都在夸什么、问什么，把买家的真实痛点记录下来。
新手想做，第一步挑出两三个这样的优质腰部商品，把同行的标题分词和主图要点提炼出来。
换成你自己的实拍或者重新排版，以稍低一点的价格上架测款，你的出单速度会比自己瞎摸快好几倍。
跟着已经拿到结果的人走，做闲鱼才能少走弯路。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`,
    explanation: `# 新手怎么通过同行店铺顺藤摸瓜找爆款 资料说明

## 概况
- 日期：2026-10-12
- 账号：真人出镜 3（selfie-03, v）
- 选题：新手怎么通过同行店铺顺藤摸瓜找爆款
- 素材来源：经验库 X-选品-001、X-选品-002、X-选品-004

## 检查结果
- 合规检查：通过
- 规则检查：通过（0退回级规则命中）
`
  }
];

// Pre-checks
console.log('=== Checking Batch 3 (Chat + 3 Selfies) ===');
let allPassed = true;

items.forEach((item, idx) => {
  console.log(`\nChecking Batch 3 Item ${idx + 1}: ${item.topic} (${item.type})`);
  const lines = item.text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  
  if (item.type === 'selfie') {
    const hanCount = item.text.replace(/[^一-龥]/g, '').length;
    console.log(`  Lines: ${lines.length}, Han characters: ${hanCount}`);
    if (hanCount < 300 || hanCount > 600) {
      console.error(`  [FAIL] Han count ${hanCount} not in [300, 600]!`);
      allPassed = false;
    }

    // First 2 lines must contain 闲鱼
    if (!lines[0].includes('闲鱼') && !lines[1].includes('闲鱼')) {
      console.error(`  [FAIL] Lines 1-2 missing 闲鱼!`);
      allPassed = false;
    }

    // Lines <= 50 and single period
    lines.forEach((l, i) => {
      if (l.length > 50) {
        console.error(`  [FAIL] Line ${i + 1} length ${l.length} > 50: ${l}`);
        allPassed = false;
      }
      const periods = (l.match(/[。！？]/g) || []).length;
      if (periods > 1 || (!l.endsWith('。') && !l.endsWith('！'))) {
        console.error(`  [FAIL] Line ${i + 1} punctuation invalid: ${l}`);
        allPassed = false;
      }
    });

    // Non-Han characters (no English letters or Arabic digits in selfies)
    const nonHan = item.text.match(/[a-zA-Z0-9%]/g);
    if (nonHan) {
      console.error(`  [FAIL] Selfie contains non-Han characters:`, nonHan);
      allPassed = false;
    }
  }

  // Forbidden words
  const forbidden = ['拼多多', '无条件', '收货', '运行', '躺赚', '稳赚', '百分之百', '暴利', 'SKU'];
  forbidden.forEach(w => {
    if (item.text.includes(w)) {
      console.error(`  [FAIL] Contains forbidden word: ${w}`);
      allPassed = false;
    }
  });

  // Titles
  if (!item.titles || item.titles.length !== 10) {
    console.error(`  [FAIL] Titles count ${item.titles?.length} !== 10`);
    allPassed = false;
  }
  item.titles.forEach(t => {
    if (/[:：]/.test(t.text)) {
      console.error(`  [FAIL] Title contains colon: ${t.text}`);
      allPassed = false;
    }
    if (!t.text.includes('闲鱼')) {
      console.error(`  [FAIL] Title missing 闲鱼: ${t.text}`);
      allPassed = false;
    }
  });
});

if (!allPassed) {
  console.error('\nBatch 3 pre-checks failed! Please fix before writing.');
  process.exit(1);
}

console.log('\nAll Batch 3 items passed static pre-checks!');

// Write to NAS and Local
for (const item of items) {
  const isChat = item.type === 'chat';
  const baseName = isChat 
    ? `${DATE_COMPACT}-${item.topic}-${item.skin}-${item.orientation}`
    : `${DATE_COMPACT}-${item.topic}-selfie-${item.selfieIdx}`;

  const runDir = `research-runs/每日/${DATE_COMPACT}-${item.topic}`;
  fs.mkdirSync(runDir, { recursive: true });

  const nasTopicDir = path.join(NAS_BASE, '待审文案', item.topic);
  fs.mkdirSync(nasTopicDir, { recursive: true });

  const nasDocDir = path.join(NAS_BASE, '资料', item.topic);
  fs.mkdirSync(nasDocDir, { recursive: true });

  const txtFileLocal = path.join(runDir, `${baseName}.txt`);
  const metaFileLocal = path.join(runDir, `${baseName}.meta.json`);

  const txtFileNas = path.join(nasTopicDir, `${baseName}.txt`);
  const metaFileNas = path.join(nasTopicDir, `${baseName}.meta.json`);

  const metaData = isChat ? {
    skin: 'chat',
    orientation: 'v',
    lengthTarget: '1-2min',
    date: DATE,
    topicSlug: 'maijia-yikaikou-zuidi-01',
    title: item.topic,
    style: '常规',
    titles: item.titles
  } : {
    kind: 'selfie',
    orientation: 'v',
    lengthTarget: '1-2min',
    date: DATE,
    title: item.topic,
    style: item.topic.includes('四个冷门') ? '老王' : '常规',
    titles: item.titles
  };

  fs.writeFileSync(txtFileLocal, item.text.trim() + '\n', 'utf8');
  fs.writeFileSync(metaFileLocal, JSON.stringify(metaData, null, 2) + '\n', 'utf8');

  fs.writeFileSync(txtFileNas, item.text.trim() + '\n', 'utf8');
  fs.writeFileSync(metaFileNas, JSON.stringify(metaData, null, 2) + '\n', 'utf8');

  if (isChat && item.materialMd) {
    const matFileLocal = path.join(runDir, `${baseName}.素材.md`);
    const matFileNas = path.join(nasTopicDir, `${baseName}.素材.md`);
    fs.writeFileSync(matFileLocal, item.materialMd, 'utf8');
    fs.writeFileSync(matFileNas, item.materialMd, 'utf8');
  }

  if (item.explanation) {
    const expFileNas = path.join(nasDocDir, `${DATE_COMPACT.slice(4)}-${isChat ? 'chat-v' : `selfie-${item.selfieIdx}`}-说明.md`);
    fs.writeFileSync(expFileNas, item.explanation, 'utf8');
  }

  console.log(`Delivered Batch 3 item to NAS: ${txtFileNas}`);
}

console.log('\nBatch 3 successfully delivered to NAS and local!');
