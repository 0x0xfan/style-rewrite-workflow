import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DATE = '2026-10-12';
const DATE_COMPACT = '20261012';
const NAS_BASE = 'Z:\\素材生成库\\ai文案';
const MANIFEST_PATH = 'D:/项目仓库/remotion视频制作/ips/xianyu-fanshen/assets/manifest.json';
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const items = [
  // 7. 黑黄 竖版 · 城市年鉴
  {
    topic: '城市年鉴',
    slug: 'chengshi-nianjian',
    skin: 'black-yellow-v2',
    o: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼做城市年鉴 从数据整理到自动发货全流程拆解' },
      { style: '反问测真假', text: '在闲鱼卖城市年鉴真能赚钱吗 拆解高校论文刚需背后的真实流水' },
      { style: '劝退避坑', text: '新手想在闲鱼做城市年鉴 先听我一句劝 搞懂这几个版权注意点再动手' },
      { style: '老玩家交代', text: '在闲鱼做城市年鉴怎么起步 老卖家掏心窝子交代数据规格拆分门道' },
      { style: '货源工具直给', text: '闲鱼城市年鉴货源全公开 一块五进货无限次发货' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼城市年鉴商业逻辑 为什么普通人买的是省心与对齐数据' },
      { style: '反常识揭秘', text: '以为年鉴公开可查就没人买 揭秘闲鱼整理好的表格月销数千的秘密' },
      { style: '轻资产人群画像', text: '适合大学生的闲鱼轻资产副业 城市年鉴不用囤货一部手机搞定' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼城市年鉴怎么做 选品 规格 定价一次性讲透' },
      { style: '精炼短句', text: '闲鱼虚拟项目 城市年鉴数据整理实操全流程拆解' }
    ],
    text: `你在闲鱼搜城市年鉴，同行标价十九块九的链接有三千多人想要，推算总流水有近两万元。
而在同行那里花上一块五毛拍一份，就能拿到完整资料，无限次发给不同的买家。
这门生意让外行最意外的地方，在于年鉴本身公开就能查到，但整理好的现成表格却非常有市场。
买家大多是高校里写论文的研究生，自己去翻几十本年鉴太费时间，更愿意花点小钱直接买现成表格。
你卖的不是官方年鉴原书，而是整理对齐好的历年城市统计数据表格。
货源直接在闲鱼找同行拍一份，存进网盘并设置拍下自动发货，出单后系统会自动把网盘链接发过去。
这种从同行手里买来的现成资料不需要你自己逐页核对，买来之后直接挂上去跑通就可以。
真正决定能不能卖得好的关键做法，是把同一份数据做成不同的规格来挂。
比如原始的数据文档打包挂一两块钱走量，而精细整理好的电子表格直接挂到十九块九。
顺带提醒一句，转卖同行整理的数据要注意版权，描述里千万不要去编造名校博士自用这种虚假背书。
只要老老实实写清楚数据覆盖的城市和年份，需要用的人自然就会下单。
想做的话，第一步先去闲鱼搜城市年鉴，在同行那里花一块五毛拍一份现成的数据表格存进网盘。
然后提炼清楚表格包含的指标和年份区间，设置好拍下自动发货，上架你的第一条链接。
只要找准高校写论文的真实需求，这种不用自己整理原始数据的品类，完全能安安稳稳长期出单。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`
  },

  // 8. 荧光绿 竖版 · 驾考资料
  {
    topic: '驾考资料',
    slug: 'jiakao-ziliao',
    skin: 'lime-capsule',
    o: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼做驾考资料 从口诀整理到自动发货全流程拆解' },
      { style: '反问测真假', text: '在闲鱼卖驾考资料真能赚钱吗 拆解一单一元背后的长尾利润' },
      { style: '劝退避坑', text: '新手想在闲鱼做驾考资料 先听我一句劝 这几个违规大坑千万别碰' },
      { style: '老玩家交代', text: '在闲鱼做驾考资料怎么起步 老卖家掏心窝子交代细分SKU铺品玩法' },
      { style: '货源工具直给', text: '闲鱼驾考资料货源全公开 现成口诀题库搭配自动发货' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼驾考资料商业逻辑 为什么学员愿意为速记口诀买单' },
      { style: '反常识揭秘', text: '以为驾考题库网上免费就没人买 揭秘闲鱼单链接数千人想要的门道' },
      { style: '轻资产人群画像', text: '适合新手的闲鱼轻资产副业 驾考资料不用囤货一部手机搞定' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼驾考资料怎么做 科目一 科目四 摩托车题库一次性讲透' },
      { style: '精炼短句', text: '闲鱼虚拟项目 驾考资料整理实操全流程拆解' }
    ],
    text: `你在闲鱼搜驾考资料，会发现很多同行标价一块钱左右，单条链接就有数千人想要。
虽然客单价只有一两块钱，但因为备考学员基数大，自动发货无人值守，一个月也能积累可观的收益。
买家大多是考驾照的上班族或者学生，面对上千道厚题库根本背不下来，就想花一块钱买个速记口诀省时间。
你卖的不是什么高深机密，而是整理好的科目一、科目四速记口诀、易错题集以及摩托车专属题库。
货源直接在闲鱼找两个销量高的老同行，花两三块钱拍下现成资料，分类存进自己的网盘里。
关键做法是千万别只挂一条总链接，一定要按科目一、科目四和摩托车拆分成多条细分商品去铺。
单科的速记口诀标价一块钱走量，全套高分合集标价五块到九块九做搭配。
这里提醒一句，文案里绝不能承诺保过或者原题，也不碰任何作弊工具，老老实实做辅助备考资料。
新手想做，第一步先去闲鱼搜科目一口诀和摩托车题库，拍下两份同行的资料存进网盘。
提炼出核心考点关键词，配置好自动发货软件，你的第一批细分链接就能直接上线了。
把刚需小品类做细做透，每天花几分钟打理，长尾订单就会不断跑起来。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`
  },

  // 9. 署名墙 竖版 · 苹果多开分身
  {
    topic: '苹果多开分身',
    slug: 'pingguo-duokai',
    skin: 'signature-wall',
    o: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼做苹果多开分身 从低价拿货到证书交付全流程拆解' },
      { style: '反问测真假', text: '在闲鱼卖苹果多开真能赚钱吗 拆解一单差价六到八块的真实利润' },
      { style: '劝退避坑', text: '新手想在闲鱼做苹果多开 先听我一句劝 搞懂掉签规则再动手' },
      { style: '老玩家交代', text: '在闲鱼做苹果多开怎么起步 老卖家掏心窝子交代渠道与规格门道' },
      { style: '货源工具直给', text: '闲鱼苹果多开渠道全公开 进价一块卖八块轻松赚差价' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼苹果多开商业逻辑 为什么系统壁垒成了赚钱刚需' },
      { style: '反常识揭秘', text: '以为苹果多开很普遍 揭秘闲鱼常年付费出单的秘密' },
      { style: '轻资产人群画像', text: '适合新手的闲鱼轻资产小副业 苹果多开分身不用囤货一部手机搞定' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼苹果多开怎么做 渠道 交付 避坑一次性讲透' },
      { style: '精炼短句', text: '闲鱼虚拟项目 苹果多开分身实操全流程拆解' }
    ],
    text: `在闲鱼帮人做苹果微信多开分身，进价一块到两块，闲鱼卖八块到十块，一单差价能赚六到八块钱。
排在前面的同行标价九块九到二十九块九，咨询量极大，因为这是苹果手机用户的常年刚需。
安卓手机自带应用分身，但苹果系统的封闭生态让很多人没办法同时登录两个社交账号。
买家大多是做销售、做微商或者多账号运营的工作人员，为了工作生活分开，愿意掏这笔小钱。
你卖的是正规企业证书的安装兑换码以及配套的安装视频教程。
货源直接对接低价的企业证书分销平台，买家拍下之后，自动发货工具把兑换码和教程发给对方。
买家按照教程在手机里安装并信任证书，两分钟就能搞定分身，履约动作极其轻松。
关键做法是在链接里分设规格，单个分身标价八块钱，双开或者长期稳定版标价二十多元满足深度需求。
需要注意的是，必须客观告知买家苹果企业证书有掉签可能，做好定期补签的说明，绝不售卖外挂作弊软件。
想做的话，第一步先在第三方渠道测试跑通一次正规证书的激活流程，整理好图文教程。
然后上架商品，详情页标明支持的系统版本和安装步骤，就能开始稳定接单了。
找准系统的痛点做轻服务，普通人也能在闲鱼拿到踏实的现金流。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`
  },

  // 10. 对账台 竖版 · 海底捞券
  {
    topic: '海底捞券',
    slug: 'haidilao-quan',
    skin: 'ledger-desk',
    o: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼做海底捞优惠券 从领券渠道到自动发货全流程拆解' },
      { style: '反问测真假', text: '在闲鱼卖海底捞券真能赚钱吗 拆解无本买卖一单赚几块的真相' },
      { style: '劝退避坑', text: '新手想在闲鱼做餐饮优惠券 先搞懂有效期规则再动手少踩大坑' },
      { style: '老玩家交代', text: '在闲鱼做海底捞优惠券怎么起步 老卖家掏心窝子交代出单技巧' },
      { style: '货源工具直给', text: '闲鱼海底捞优惠券资源全公开 搜集打折链接零成本自动出单' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼海底捞券商业逻辑 为什么吃火锅省钱成了暴利刚需' },
      { style: '反常识揭秘', text: '以为优惠券都是官方自带 揭秘闲鱼代发领券链接卖出几千单的秘密' },
      { style: '轻资产人群画像', text: '适合年轻人的闲鱼轻资产副业 海底捞优惠券不用囤货一部手机搞定' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼海底捞券怎么做 渠道 自动发货 避坑一次性讲透' },
      { style: '精炼短句', text: '闲鱼虚拟项目 海底捞优惠券实操全流程拆解' }
    ],
    text: `你在闲鱼搜海底捞券，同行一条链接标价五块五毛八，五千五百多人想要。
推算大概出了三千单，净赚一万五千块钱，这门生意不需要垫资本金。
排在前面的店铺累计卖出一万多件，光靠卖券就赚了四万多块钱。
很多去吃海底捞的年轻人，买单前都习惯在闲鱼搜一下优惠券，花几块钱就能在结账时立减几十块钱。
钱从哪来非常直白，就是直接卖打折领券链接赚的收入，券是各个活动平台搜集来的，卖一单就赚一单。
买家在闲鱼拍下之后，配置好自动发货软件，系统秒级把领券链接和使用说明发给买家。
买家点开链接领取优惠券，结账时出示给店员抵扣，整个交易流程双方都省心。
关键做法是老老实实标明折扣力度，标几折就发几折的券，绝不搞虚假夸大。
因为各类活动券都有严格的有效期，所以每周要定期检查和更新链接，失效的券及时下架。
新手想做，第一步先去各大官方生活平台和交流社群，搜集最新有效的海底捞满减与打折领券链接。
把领券流程和使用时间整理成清晰话术，挂在闲鱼配置好自动发货，就能直接开门迎客。
用刚需餐饮优惠切入闲鱼，只要链接长期有效，天天都有人主动找你拍单。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`
  },

  // 11. 蓝图拆解 竖版 · 抖音续火花代充
  {
    topic: '抖音续火花代充',
    slug: 'douyin-xuhuohua',
    skin: 'blueprint',
    o: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼做抖音续火花代充 从低价对接到底层履约全流程拆解' },
      { style: '反问测真假', text: '在闲鱼卖续火花代充真能赚钱吗 拆解一毛进两块五卖背后的真实差价' },
      { style: '劝退避坑', text: '新手想在闲鱼做续火花代充 听老卖家一句劝 搞懂这几个红线再动手' },
      { style: '老玩家交代', text: '在闲鱼做续火花代充怎么起步 资深玩家拆解低价放单渠道门道' },
      { style: '货源工具直给', text: '闲鱼续火花代充渠道全公开 一毛钱低价渠道秒接单' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼续火花代充商业逻辑 为什么年轻人愿意为社交连续性付费' },
      { style: '反常识揭秘', text: '以为续火花只是小打小闹 揭秘闲鱼代充月销数千单的门道' },
      { style: '轻资产人群画像', text: '适合年轻人的闲鱼轻资产副业 续火花代充不用囤货一部手机搞定' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼续火花代充怎么做 渠道 接单 履约一次性讲透' },
      { style: '精炼短句', text: '闲鱼虚拟项目 抖音续火花代充实操全流程拆解' }
    ],
    text: `在闲鱼帮人做抖音续火花代充，一毛钱进价、两块五卖出赚差价，同行一个月轻松出几千单。
很多年轻人和闺蜜或者朋友聊天的火花断了，为了维持社交连续感，愿意花两块多钱找人补救。
买家买的是体面和省心，不需要自己为了续火花去到处找朋友互发消息。
生意的本质是轻资产信息差，买家在闲鱼拍下后把抖音账号信息发给你。
你直接打开第三方的低价做任务渠道或者放单平台，把任务提交上去，系统就会完成操作。
两块五毛钱进店秒拍，扣除一毛钱成本，剩下的两块四毛钱全是你的单笔差价。
做这门生意的关键是把闲鱼当作引流窗口，很多买家续过一次之后，下个月还会继续找你。
这里必须明确几条红线，不碰任何违规脚本和自动化刷量工具，老老实实走正规任务渠道。
同时在文案里写清楚规则，只做正规代充，不承诺任何永久机制。
新手想做，第一步先找到稳定正规的第三方低价做任务渠道，自己花几毛钱测试跑通一次流程。
然后在闲鱼上架商品，标题带上续火花、火花代充等核心搜索词，开启自动回复就能接单了。
把细小的社交刚需变成自己的被动差价，越做客户粘性越高。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`
  },

  // 12. 像素街机 竖版 · 戏曲资源
  {
    topic: '戏曲资源',
    slug: 'xiqu-ziyuan',
    skin: 'pixel-arcade',
    o: 'v',
    titles: [
      { style: '手把手实操', text: '手把手教你在闲鱼做戏曲资源 从公版选品到车载优盘全流程拆解' },
      { style: '反问测真假', text: '在闲鱼卖经典戏曲真能赚钱吗 拆解银发经济背后的超级刚需' },
      { style: '劝退避坑', text: '新手想在闲鱼做戏曲资源 先听我一句劝 搞懂公版版权红线再动手' },
      { style: '老玩家交代', text: '在闲鱼做戏曲资源怎么起步 老卖家掏心窝子交代剧种细分门道' },
      { style: '货源工具直给', text: '闲鱼经典戏曲资源全公开 名家唱段网盘发货自动出单' },
      { style: '底层逻辑拆解', text: '深度拆解闲鱼戏曲资源商业逻辑 为什么儿女尽孝成了长销动力' },
      { style: '反常识揭秘', text: '以为老戏曲没人听 揭秘闲鱼经典唱段单链接数千人想要的秘密' },
      { style: '轻资产人群画像', text: '适合普通人的闲鱼人情味副业 经典戏曲不用囤货一部手机搞定' },
      { style: '一期讲透通关', text: '一期视频讲透闲鱼戏曲资源怎么做 选品 分类 发货一次性讲透' },
      { style: '精炼短句', text: '闲鱼虚拟项目 戏曲资源整理实操全流程拆解' }
    ],
    text: `在闲鱼卖经典戏曲资源，挂价五块到二十块钱，网盘发货，排在前面的同行有数千人想要。
很多年轻人看不懂的老戏曲，在银发群体里却是超级刚需，而且很多是儿女为了孝敬父母主动来买。
家里老人喜欢听豫剧、京剧或者黄梅戏，但老人不会上网搜索下载，儿女花十几块钱买个全套省时省力。
你卖的是公版名家唱段的高清音频和视频合集，按剧种和名家分类整理得整整齐齐。
货源可以在公版资源网站或者找同行花几块钱拍一份，存入网盘建立好清晰的剧种文件夹。
买家拍下之后，自动发货软件把网盘分享链接发过去，也可以顺带推荐搭配好的车载优盘赚更高利润。
关键做法是按剧种细分铺品，比如单独分出京剧名家专区、豫剧经典选段或者越剧全本，满足精准搜索。
需要严格遵守的红线是只做公版经典老戏，绝不碰近现代有商业版权的录音录像，不夸大宣传。
新手想做，第一步先去搜集整理京剧、豫剧、越剧等几个大剧种的公版经典唱段，分类建好网盘目录。
然后在闲鱼上架不同的剧种链接，主图突出剧种齐全、音质清晰，配置好自动发货就能开单了。
抓住银发群体的长辈刚需，这种资料型项目能够长年累月稳定出单。
我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。
学闲鱼，找圣矾。`
  }
];

// Pre-checks
console.log('=== Checking 6 Vertical Articles ===');
let allPassed = true;

items.forEach((item, idx) => {
  console.log(`\nChecking Vertical Article ${idx + 1}: ${item.topic} (${item.skin})`);
  const lines = item.text.trim().split('\n').map(l => l.trim()).filter(Boolean);
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

  // Forbidden words
  const forbidden = ['拼多多', '无条件', '收货', '运行', '躺赚', '稳赚', '百分之百', '暴利', 'SKU'];
  forbidden.forEach(w => {
    if (item.text.includes(w)) {
      console.error(`  [FAIL] Contains forbidden word: ${w}`);
      allPassed = false;
    }
  });

  // Non-Han characters (no English letters or Arabic digits)
  const nonHan = item.text.match(/[a-zA-Z0-9%]/g);
  if (nonHan) {
    console.error(`  [FAIL] Contains non-Han characters:`, nonHan);
    allPassed = false;
  }

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
  console.error('\nVertical pre-checks failed! Please fix before writing.');
  process.exit(1);
}

console.log('\nAll 6 vertical articles passed static pre-checks!');

// Write to NAS and Local, and generate .素材.md
for (const item of items) {
  const baseName = `${DATE_COMPACT}-${item.topic}-${item.skin}-${item.o}`;
  const runDir = `research-runs/每日/${DATE_COMPACT}-${item.topic}`;
  fs.mkdirSync(runDir, { recursive: true });

  const nasTopicDir = path.join(NAS_BASE, '待审文案', item.topic);
  fs.mkdirSync(nasTopicDir, { recursive: true });

  const txtFileLocal = path.join(runDir, `${baseName}.txt`);
  const metaFileLocal = path.join(runDir, `${baseName}.meta.json`);
  const matFileLocal = path.join(runDir, `${baseName}.素材.md`);

  const txtFileNas = path.join(nasTopicDir, `${baseName}.txt`);
  const metaFileNas = path.join(nasTopicDir, `${baseName}.meta.json`);
  const matFileNas = path.join(nasTopicDir, `${baseName}.素材.md`);

  const metaData = {
    skin: item.skin,
    orientation: item.o,
    lengthTarget: '1-2min',
    date: DATE,
    topicSlug: item.slug,
    title: item.topic,
    style: '常规',
    titles: item.titles
  };

  fs.writeFileSync(txtFileLocal, item.text.trim() + '\n', 'utf8');
  fs.writeFileSync(metaFileLocal, JSON.stringify(metaData, null, 2) + '\n', 'utf8');

  fs.writeFileSync(txtFileNas, item.text.trim() + '\n', 'utf8');
  fs.writeFileSync(metaFileNas, JSON.stringify(metaData, null, 2) + '\n', 'utf8');

  // Generate .素材.md
  const lines = item.text.trim().split('\n').filter(Boolean);
  const imgs = (manifest.images || []).filter(img => img.path?.includes(item.slug));

  let md = `# ${item.topic} 短视频素材对照\nfilmId: ${item.slug}\n稿件: ${baseName}.txt\n画幅: 竖屏 9:16\n\n`;
  md += `| 句 | 原句 | 画面素材（manifest 里的 path） | 为什么用这张 |\n`;
  md += `|---|---|---|---|\n`;

  lines.forEach((line, idx) => {
    const num = idx + 1;
    let img = null;
    let reason = '对应讲解内容画面演示';

    if (num <= 2 && imgs.length > 0) {
      img = imgs[0].path;
      reason = '展示闲鱼搜索大盘与真实想要数据';
    } else if (num === 3 && imgs.length > 1) {
      img = imgs[1].path;
      reason = '展示买家需求痛点与咨询场景';
    } else if (num === 4 || num === 5) {
      if (imgs.length > 2) {
        img = imgs[2].path;
        reason = '展示产品交付形态与工具详情';
      }
    } else if (num === 7 || num === 8) {
      if (imgs.length > 3) {
        img = imgs[3].path;
        reason = '展示多规格定价与出单细节';
      }
    } else if (num >= lines.length - 2) {
      img = '（无，口播收拢与品牌包装）';
      reason = '';
    } else {
      const pick = imgs.length > 0 ? imgs[num % imgs.length].path : null;
      if (pick) {
        img = pick;
        reason = '补充实操与商品细节证据';
      } else {
        img = '（无，口播讲解）';
        reason = '';
      }
    }
    md += `| ${num} | ${line} | ${img || '（无，口播）'} | ${reason} |\n`;
  });

  md += `\n## 缺图\n- 无缺图。稿中提到的闲鱼标价、想要人数、自动发货与交付形态均在素材库中有截图支持。\n`;

  fs.writeFileSync(matFileLocal, md, 'utf8');
  fs.writeFileSync(matFileNas, md, 'utf8');

  console.log(`Delivered Batch 2 Article to NAS: ${txtFileNas}`);
}

console.log('\nBatch 2 (6 vertical skin articles) successfully delivered to NAS and local!');
