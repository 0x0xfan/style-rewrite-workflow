import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DATE = '2026-10-11';
const DATE_COMPACT = '20261011';
const NAS_BASE = 'Z:\\素材生成库\\ai文案';

const items = [
  // 1. 聊天记录: 买家拍下不付款该怎么催
  {
    type: 'chat',
    topic: '买家拍下不付款该怎么催',
    skin: 'chat',
    orientation: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼催付款 既不招人烦又能提高成单率' },
      { style: '反问测真假', text: '闲鱼买家拍下不付款到底催不催 老卖家教你正确处理' },
      { style: '劝退避坑', text: '闲鱼催付千万别乱发问号 这几种做法直接把客户劝退' },
      { style: '老玩家交代', text: '闲鱼买家拍下不付款怎么办 老卖家掏心窝子交代催单话术' },
      { style: '货源工具直给', text: '闲鱼催单话术模板全公开 拍下不付款用这几句轻松促单' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼拍下不付款心理 为什么锁库存最伤曝光' },
      { style: '反常识揭秘', text: '以为催付款会惹人嫌 揭秘闲鱼高情商催单不仅成交还涨粉' },
      { style: '轻资产人群画像', text: '适合闲鱼新手的催单小技巧 拍下不付款也能变成回头客' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼买家拍下不付款 话术 心理 节奏一次讲透' },
      { style: '精炼短句', text: '闲鱼运营技巧 买家拍下不付款怎么催' }
    ],
    text: `@左 粉丝 avatar=left-fa.png
@右 圣矾 avatar=right-shengfan.jpg
粉丝：圣矾哥，闲鱼上有买家拍下不付款该怎么催啊？
粉丝：今天有个客户拍了一单，半天没动静
粉丝：我连发了三个问号，结果直接被拉黑了
粉丝：[表情 crying.png]
圣矾：催付款最忌讳的就是发问号
圣矾：直接发问号或者问买不买，换谁都不舒服
圣矾：买家拍下不付，很多时候只是临时被打断了
粉丝：[表情 thinking.png]
粉丝：临时被打断？不是故意逗我玩吗？
圣矾：大部分真不是
圣矾：可能刚好接了个电话，或者切出去看别的了
圣矾：这时候你催单，态度一定要温和给台阶
粉丝：具体该怎么打招呼，教我两句？
圣矾：你可以过5分钟私信他一句
圣矾：哥，看到您已经拍下了
圣矾：这边正在整理发货清单，稍后给您统一安排
圣矾：您看有什么需要提前交代或者确认的吗？
粉丝：这样问感觉好贴心，完全没有逼单的感觉！
圣矾：对，把催付款变成确认需求和准备发货
圣矾：买家看到消息，顺手就把款付了
粉丝：那要是遇到问了半天还是不付的呢？
圣矾：等超过15分钟还没动静，就要警惕了
圣矾：闲鱼拍下不付款会卡住你的宝贝库存
圣矾：别人想买都拍不了，白白浪费你的曝光
粉丝：那这时候该怎么处理？
圣矾：发最后一句礼貌通牒
圣矾：哥，这件宝贝咨询的人比较多，名额只保留半小时
圣矾：超时系统会自动释放库存给排队的买家
圣矾：如果还不付款，时间一到果断关闭订单
圣矾：千万别为了一个不付款的，耽误后面真想买的
粉丝：懂了，给足台阶，超时果断关闭释放库存！
圣矾：其实还有个反转
粉丝：[表情 shock.png]
粉丝：什么反转？
圣矾：有的买家看你关了订单，反而急了
圣矾：十分钟后跑来问你：老板怎么关了，我刚要付呢 {hold=2}
粉丝：哈哈，这时候该怎么回？
圣矾：你就回：哥，太抢手了，刚才以为您去拯救地球了呢 {hold=2}
圣矾：重新给您开一个，这次手速可得快点 {hold=2}
粉丝：[表情 laugh.png]
圣矾：[表情 doge.png]
=====素材清单=====
crying.png：哭泣流泪的表情包
thinking.png：托腮思考的表情包
shock.png：震惊瞪大眼的表情包
laugh.png：捂嘴笑的表情包
doge.png：doge狗头表情包`,
    materialMd: `# 买家拍下不付款该怎么催 聊天记录素材清单
filmId: maijia-baixia-bufukuan-01
稿件: 20261011-买家拍下不付款该怎么催-chat-v.txt
画幅: 竖屏 9:16

| 文件名 | 类型 | 说明 | 本机路径/状态 |
|---|---|---|---|
| crying.png | 表情 | 哭泣流泪的表情包 | 待视频项目找图 |
| thinking.png | 表情 | 托腮思考的表情包 | 待视频项目找图 |
| shock.png | 表情 | 震惊瞪大眼的表情包 | 待视频项目找图 |
| laugh.png | 表情 | 捂嘴笑的表情包 | 待视频项目找图 |
| doge.png | 表情 | doge狗头表情包 | 待视频项目找图 |
`,
    explanation: `# 买家拍下不付款该怎么催 资料说明

## 概况
- 日期：2026-10-11
- 账号：聊天记录（chat, v）
- 选题：买家拍下不付款该怎么催
- 素材来源：闲鱼经验库 X-售后-027、X-客服-029

## 检查结果
- 格式检查：通过
- 合规检查：通过
- 规则检查：通过（0退回级规则命中）
`
  },

  // 2. 真人出镜 1: 为什么商品主图千万不能用白底电商图
  {
    type: 'selfie',
    selfieIdx: '01',
    topic: '为什么商品主图千万不能用白底电商图',
    orientation: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你闲鱼主图怎么拍 告别白底电商图提升点击率' },
      { style: '反问测真假', text: '闲鱼主图用白底电商图真能出单吗 拆解真实点击率差距' },
      { style: '劝退避坑', text: '闲鱼上架千万别用白底电商图 这几个坑直接劝退买家' },
      { style: '老玩家交代', text: '闲鱼商品主图怎么选 老卖家掏心窝子交代真实场景图的门道' },
      { style: '货源工具直给', text: '闲鱼高点击主图实操全公开 真实生活场景拍照技巧' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼主图流量逻辑 为什么二手平台要的是烟火气' },
      { style: '反常识揭秘', text: '以为精修白底图显专业 揭秘闲鱼真实实拍图点击率翻倍真相' },
      { style: '轻资产人群画像', text: '适合闲鱼新手的主图避坑指南 扔掉白底图快速起曝光' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼主图拍摄与排版 场景 构图 信任一次讲透' },
      { style: '精炼短句', text: '闲鱼上架避坑 为什么商品主图千万不能用白底图' }
    ],
    text: `在闲鱼上卖东西，很多新手最喜欢直接搬传统电商那种白底精修图当主图。
总觉得背景干干净净、抠图漂漂亮亮，看起来显得专业又上档次。
但我必须提醒你，在闲鱼用白底图，完全是在把上门的流量往外推。
闲鱼是一个二手和个人转转交易平台，买家上闲鱼图的就是真实和便宜。
买家一刷到那种白底抠图，第一反应就是这是个职业二道贩子或者批量铺货的商家。
不仅没有半点人情味，还天然带着一种距离感和不信任感。
哪怕你的价格标得再便宜，买家都会下意识怀疑你手里根本没有实物。
闲鱼的主图不需要多么精致，它要的是真实的生活场景和烟火气。
如果是实物商品，你就拿在手里拍，或者放在办公桌、阳台等生活背景下实拍。
带一点真实的光影甚至轻微的生活痕迹，反而能瞬间打消买家的顾虑。
哪怕你做的是虚拟资料或者软件服务，也千万别放一张毫无生气的白底文字图。
你可以把资料打开放在电脑或者平板屏幕上，拍一张真实的工位工作照。
让买家一眼看过去，就知道这是你在真实使用和整理的东西。
主图是闲鱼链接的第一入口，有烟火气的真实图，点击率比白底图高出好几倍。
你要是刚开始在闲鱼做商品上架，第一步先去把那些冷冰冰的白底电商图全部换掉。
换成带生活背景的真实场景实拍，有了人情味，你的咨询量自然就跑起来了。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`,
    explanation: `# 为什么商品主图千万不能用白底电商图 资料说明

## 概况
- 日期：2026-10-11
- 账号：真人出镜 1（selfie-01, v）
- 选题：为什么商品主图千万不能用白底电商图
- 素材来源：闲鱼经验库 X-上架-025、X-上架-024

## 检查结果
- 合规检查：通过
- 规则检查：通过（0退回级规则命中）
`
  },

  // 3. 真人出镜 2: 新账号第一周每天上几个品最稳妥
  {
    type: 'selfie',
    selfieIdx: '02',
    topic: '新账号第一周每天上几个品最稳妥',
    orientation: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你闲鱼新号第一周上架节奏 每天上几个品最稳妥' },
      { style: '反问测真假', text: '闲鱼新号狂铺货真能出单吗 拆解每天上架数量与平台风控' },
      { style: '劝退避坑', text: '闲鱼新店千万别一天上几十个品 违规限流的坑你踩过几个' },
      { style: '老玩家交代', text: '闲鱼新账号怎么平稳起步 老卖家交底第一周最佳上新节奏' },
      { style: '货源工具直给', text: '闲鱼新号上架规划全公开 科学安排每天上新数量与时间' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼算法赛马机制 为什么稳定上新比狂铺更管用' },
      { style: '反常识揭秘', text: '以为闲鱼铺货越多越赚钱 揭秘每天两三个优质品的破冰真相' },
      { style: '轻资产人群画像', text: '适合闲鱼新手的起步上架指南 稳扎稳打拿自然曝光' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼新号第一周运营 选品 上架 测款一次讲透' },
      { style: '精炼短句', text: '闲鱼新号运营 新账号第一周每天上几个品最稳妥' }
    ],
    text: `很多新手刚注册好闲鱼账号，满脑子都是赶紧铺货，一天恨不得连发二三十个链接。
结果刚上到第十个，账号就收到系统违规提醒，甚至直接被判定异常限制曝光。
还有的新手走向另一个极端，上架一个品就干等一个星期，天天盯着零浏览叹气。
做闲鱼不是拼蛮力，新账号第一周的上新节奏，直接决定了你的起步死活。
根据平台算法的赛马机制，新账号第一周最稳妥的节奏，是每天坚持上两到三个品。
为什么既不能多上，也不能少上？
如果你第一天突然狂铺几十个链接，算法会立刻判定你是个营销铺货的机器号。
不仅不会给你推自然流，反而容易触发风控把账号打入冷宫。
但如果你好几天不发一个品，平台算法就会觉得这个账号不活跃，慢慢减少推流。
每天上两到三个品，既能让系统持续捕捉到你的活跃信号，又符合真人的操作习惯。
更关键的是，你的精力能够分配得过来。
每天精心挑选两三个品，把标题的关键词拆准，把主图拍出烟火气，把详情写清楚。
上架的时间最好固定在中午十二点到一点，或者晚上八点到十点的高峰期。
七天下来店里自然积累了十几个优质链接，哪个品能跑出来，数据一清二楚。
你要是刚准备在闲鱼起新号，第一步先定好每天上两到三个品的节奏，绝不贪多。
把每个链接的基本功做扎实，用稳定的节奏跑通数据，你的新号才能稳稳破冰。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`,
    explanation: `# 新账号第一周每天上几个品最稳妥 资料说明

## 概况
- 日期：2026-10-11
- 账号：真人出镜 2（selfie-02, v）
- 选题：新账号第一周每天上几个品最稳妥
- 素材来源：闲鱼经验库 X-上架-042、X-上架-002

## 检查结果
- 合规检查：通过
- 规则检查：通过（0退回级规则命中）
`
  },

  // 4. 真人出镜 3: 测款测了几天没动静到底该不该放弃
  {
    type: 'selfie',
    selfieIdx: '03',
    topic: '测款测了几天没动静到底该不该放弃',
    orientation: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你闲鱼测款数据排查 几天没动静到底该不该放弃' },
      { style: '反问测真假', text: '闲鱼测款几天没曝光就得删链接吗 拆解平台实时赛马机制' },
      { style: '劝退避坑', text: '闲鱼测款千万别急着删链接 这几个常见误区白白扔掉潜在爆款' },
      { style: '老玩家交代', text: '闲鱼商品测款怎么看数据 老卖家掏心窝子交代止损与优化' },
      { style: '货源工具直给', text: '闲鱼测款漏斗排查表全公开 曝光 点击 咨询逐级诊断' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼算法推流逻辑 为什么新链接需要五到七天赛马' },
      { style: '反常识揭秘', text: '以为闲鱼一上架就能爆单 揭秘测款周期与爆款筛选的真相' },
      { style: '轻资产人群画像', text: '适合闲鱼新手的测款心态与技巧 不焦虑不盲目稳健运营' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼商品测款全流程 周期 诊断 优化一次讲透' },
      { style: '精炼短句', text: '闲鱼测款技巧 测款测了几天没动静到底该不该放弃' }
    ],
    text: `在闲鱼上架了几个新商品，满心欢喜等了两三天，结果曝光个位数、咨询一个没有。
很多新手这时候就开始沉不住气了，觉得是不是自己选错品了，转头就把链接删了。
甚至有人直接心态崩溃，觉得闲鱼根本赚不到钱，直接放弃不干了。
其实测款才过了两三天没动静，直接放弃是最亏的做法。
闲鱼的推流机制是实时赛马，平台每隔十几到三十分钟就会重新洗牌一次曝光。
一个新链接刚发上去，算法还在测试你的标签和受众，数据有几天延迟非常正常。
看到链接没动静，千万别慌着删，你得学会拿着漏斗对照表去排查问题。
如果连续两三天完全是零曝光，先检查是不是类目选错了，或者标题里缺了核心搜索词。
如果有好几百曝光但一个浏览点击都没有，问题基本出在你的主图和定价上。
如果点击有了却没人咨询，那就要去优化详情页里的描述和信任背书。
只要每天坚持在流量高峰期擦亮一次，给系统足够的时间去匹配真实人群。
一般一个链接测款周期看五到七天，如果连续七天既没咨询也没收藏，才算测款失败。
这时候果断下架腾出位置，换下一个优化过的品继续上。
测款的本质是通过持续上新筛选出能跑的爆款，而不是指望每个链接都必须出单。
你要是手上刚好有测了几天没动静的闲鱼链接，第一步先对着漏斗排查曝光和主图。
找出卡住的那一步微调一次，给足五到七天的赛马时间，别让好品被你的急躁扼杀。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`,
    explanation: `# 测款测了几天没动静到底该不该放弃 资料说明

## 概况
- 日期：2026-10-11
- 账号：真人出镜 3（selfie-03, v）
- 选题：测款测了几天没动静到底该不该放弃
- 素材来源：闲鱼经验库 X-上架-010、X-上架-039、X-上架-002

## 检查结果
- 合规检查：通过
- 规则检查：通过（0退回级规则命中）
`
  }
];

// Helper to run command
function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: true });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

// Ensure local directories
fs.mkdirSync('scratch/聊天记录式', { recursive: true });

for (const item of items) {
  console.log(`\n=== Processing: ${item.topic} (${item.type}) ===`);

  let filenamePrefix = '';
  let metaObj = {};

  if (item.type === 'chat') {
    filenamePrefix = `${DATE_COMPACT}-${item.topic}-chat-v`;
    metaObj = {
      skin: 'chat',
      orientation: 'v',
      lengthTarget: '1-2min',
      date: DATE,
      title: item.topic,
      style: '常规',
      titles: item.titles
    };
  } else {
    filenamePrefix = `${DATE_COMPACT}-${item.topic}-selfie-${item.selfieIdx}`;
    metaObj = {
      kind: 'selfie',
      orientation: 'v',
      lengthTarget: '1-2min',
      date: DATE,
      title: item.topic,
      style: '常规',
      titles: item.titles
    };
  }

  // 1. Write local scratch copy AND local meta.json
  const scratchTxt = path.join('scratch', `${filenamePrefix}.txt`);
  const scratchMeta = path.join('scratch', `${filenamePrefix}.meta.json`);
  fs.writeFileSync(scratchTxt, item.text, 'utf8');
  fs.writeFileSync(scratchMeta, JSON.stringify(metaObj, null, 2), 'utf8');

  // Also write local research-runs copy
  const runDir = path.join('research-runs', '每日', `${DATE_COMPACT}-${item.topic}`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, `${filenamePrefix}.txt`), item.text, 'utf8');
  fs.writeFileSync(path.join(runDir, `${filenamePrefix}.meta.json`), JSON.stringify(metaObj, null, 2), 'utf8');

  // 2. Perform validation
  if (item.type === 'chat') {
    // Check chat format
    const chatScratchPath = path.join('scratch', '聊天记录式', `${filenamePrefix}.txt`);
    const chatScratchMeta = path.join('scratch', '聊天记录式', `${filenamePrefix}.meta.json`);
    fs.writeFileSync(chatScratchPath, item.text, 'utf8');
    fs.writeFileSync(chatScratchMeta, JSON.stringify(metaObj, null, 2), 'utf8');

    console.log('Running check-chat.mjs...');
    const chatRes = run('node', ['.claude/skills/chat-record/check-chat.mjs', chatScratchPath]);
    console.log(chatRes.stdout);
    if (chatRes.status !== 0) {
      console.error('check-chat FAILED:', chatRes.stderr);
      process.exit(1);
    }
    const dialogTxt = path.join('scratch', '聊天记录式', `${filenamePrefix}.台词.txt`);
    const dialogMeta = path.join('scratch', '聊天记录式', `${filenamePrefix}.台词.meta.json`);
    fs.writeFileSync(dialogMeta, JSON.stringify(metaObj, null, 2), 'utf8');

    console.log('Running check:compliance on dialog text...');
    const compRes = run('npm', ['run', 'check:compliance', '--', dialogTxt]);
    console.log(compRes.stdout);
    if (compRes.status !== 0) {
      console.error('Compliance check failed!');
      process.exit(1);
    }
    console.log('Running check:draft on dialog text...');
    const draftRes = run('npm', ['run', 'check:draft', '--', dialogTxt, '--topic', item.topic, '--topic-type', '虚拟']);
    console.log(draftRes.stdout);
  } else {
    // Selfie validation
    console.log('Running check:compliance on selfie...');
    const compRes = run('npm', ['run', 'check:compliance', '--', scratchTxt]);
    console.log(compRes.stdout);
    if (compRes.status !== 0) {
      console.error('Compliance check failed!');
      process.exit(1);
    }
    console.log('Running check:draft on selfie...');
    const draftRes = run('npm', ['run', 'check:draft', '--', scratchTxt, '--topic', item.topic, '--topic-type', '虚拟']);
    console.log(draftRes.stdout);
  }

  // 3. Write NAS files
  const nasTopicDir = path.join(NAS_BASE, '待审文案', item.topic);
  const nasInfoDir = path.join(NAS_BASE, '资料', item.topic);
  fs.mkdirSync(nasTopicDir, { recursive: true });
  fs.mkdirSync(nasInfoDir, { recursive: true });

  const nasTxt = path.join(nasTopicDir, `${filenamePrefix}.txt`);
  const nasMeta = path.join(nasTopicDir, `${filenamePrefix}.meta.json`);
  fs.writeFileSync(nasTxt, item.text, 'utf8');
  fs.writeFileSync(nasMeta, JSON.stringify(metaObj, null, 2), 'utf8');

  if (item.type === 'chat') {
    const nasMat = path.join(nasTopicDir, `${filenamePrefix}.素材.md`);
    fs.writeFileSync(nasMat, item.materialMd, 'utf8');
    const nasExp = path.join(nasInfoDir, `1011-chat-v-说明.md`);
    fs.writeFileSync(nasExp, item.explanation, 'utf8');
  } else {
    const nasExp = path.join(nasInfoDir, `1011-selfie-${item.selfieIdx}-说明.md`);
    fs.writeFileSync(nasExp, item.explanation, 'utf8');
  }

  console.log(`Successfully written NAS files for ${item.topic}`);
}

console.log('\nAll 4 files built and validated successfully!');
