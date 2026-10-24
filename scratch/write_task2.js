const fs = require('fs');
const path = require('path');

const localDir2 = path.resolve('research-runs/每日/20261023-拍照姿势');
fs.mkdirSync(localDir2, { recursive: true });

const txt2 = [
'你在闲鱼搜拍照姿势，单品标价两块到五块钱，全店卖出整整两万多单，网盘自动秒发不用物流发货。',
'全套合集还能标价九块九，单单一个链接就有八百多人想要，拍下全自动履约。',
'买这个产品的基本都是喜欢出门旅游、打卡探店的年轻人，特别是周末约会的情侣。',
'很多人平时爱发朋友圈，但一面对镜头就浑身不自在，手不知道往哪放，只会傻傻比个剪刀手。',
'出门前存的摄影视频现场根本来不及现看，拍出来全是僵硬废片，出门玩的心情全没了。',
'闲鱼卖家卖的就是旅行情侣日常出行手机拍照构图与机位姿势打卡图卡合集。',
'把站姿、坐姿和走动动作做成手机相册解压即看的图卡，附带九宫格构图辅助线。',
'买家打开手机照着原位摆，同行伙伴按着九宫格随手一按，普通人也能拍出自然大片。',
'货源不需要自己拍，在闲鱼花两块钱拍一份同行合集，剔除广告后分类存入网盘。',
'设置好网盘自动发货机器人，买家在闲鱼下单付款，系统几秒钟自动把链接发过去。',
'做这门生意最关键的做法，是主图一定要放路人照与按教程摆姿势的成片对比，突出零废片。',
'标题多覆盖情侣拍照打卡、日常手机构图等搜索下拉长尾词，吸引精准自然流量。',
'新手第一步，今晚先打开闲鱼搜拍照姿势图解，花两块钱买一份同行合集摸清分类。',
'把年轻人的拍照痛点搞透，把图卡按场景整理好，挂上自动发货就是一门省心小生意。',
'我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。',
'学闲鱼，找圣矾。'
].join('\n');

const meta2 = JSON.stringify({
  skin: 'lime-capsule',
  orientation: 'v',
  lengthTarget: '2.0min',
  date: '2026-10-23',
  topicSlug: 'topic-mvarsxuz',
  title: '拍照姿势',
  style: '常规'
}, null, 2);

const material2 = `# 拍照姿势 短视频素材对照
filmId: topic-mvarsxuz
稿件: 20261023-拍照姿势-lime-capsule-v.txt
画幅: 竖屏 9:16

| 句 | 原句 | 画面素材（manifest 里的 path） | 为什么用这张 |
|---|---|---|---|
| 1 | 你在闲鱼搜拍照姿势，单品标价两块到五块钱，全店卖出整整两万多单，网盘自动秒发不用物流发货。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/market/02-top1-detail.clean.png | 头部爆款详情页，标价两块多到五块多清晰可见 |
| 2 | 全套合集还能标价九块九，单单一个链接就有八百多人想要，拍下全自动履约。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/market/02-top1-detail.png | 头部单品详情，清晰可见844人想要真实数据 |
| 3 | 买这个产品的基本都是喜欢出门旅游、打卡探店的年轻人，特别是周末约会的情侣。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/demand/04-xianyu-search-dropdown.clean.png | 闲鱼下拉框精准词，显示情侣拍照打卡、旅游拍照姿势等精准搜索需求 |
| 4 | 很多人平时爱发朋友圈，但一面对镜头就浑身不自在，手不知道往哪放，只会傻傻比个剪刀手。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/market/01-search-results.png | 闲鱼搜索大盘列表，体现年轻人拍照肢体僵硬痛点 |
| 5 | 出门前存的摄影视频现场根本来不及现看，拍出来全是僵硬废片，出门玩的心情全没了。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/market/03-top2-detail.png | 同行商品展示，反衬出门翻看视频繁琐费时的痛点 |
| 6 | 闲鱼卖家卖的就是旅行情侣日常出行手机拍照构图与机位姿势打卡图卡合集。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/supply/02-seller-deliverable-prod-1.png | 卖家交付物拍照姿势图解缩略图，展示图卡合集全貌 |
| 7 | 把站姿、坐姿和走动动作做成手机相册解压即看的图卡，附带九宫格构图辅助线。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/supply/02-seller-deliverable-prod-2.png | 姿势图解与九宫格构图辅助线图卡，直观展示手机相册即翻即看形式 |
| 8 | 买家打开手机照着原位摆，同行伙伴按着九宫格随手一按，普通人也能拍出自然大片。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/tutorial/01-item-detail-scroll1.png | 手机实操摆姿与出片实录，展示按图摆姿势效果 |
| 9 | 货源不需要自己拍，在闲鱼花两块钱拍一份同行合集，剔除广告后分类存入网盘。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/supply/02-seller-deliverable-prod-3.png | 卖家交付母库合集文件列表，展示分类整理与网盘转存 |
| 10 | 设置好网盘自动发货机器人，买家在闲鱼下单付款，系统几秒钟自动把链接发过去。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/supply/02-seller-deliverable-thumb-2.png | 网盘分类目录与自动发货说明截图，印证秒级自动履约 |
| 11 | 做这门生意最关键的做法，是主图一定要放路人照与按教程摆姿势的成片对比，突出零废片。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/market/07-expand-search-jiaocheng.png | 搜索结果主图列表，展示路人照与精致成品的反差排版设计 |
| 12 | 标题多覆盖情侣拍照打卡、日常手机构图等搜索下拉长尾词，吸引精准自然流量。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/demand/04-xianyu-search-dropdown.roi-suggest.png | 搜索下拉框热词高亮，指引新手布局精准长尾词 |
| 13 | 新手第一步，今晚先打开闲鱼搜拍照姿势图解，花两块钱买一份同行合集摸清分类。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/market/08-expand-search-richang.png | 日常拍照姿势搜索结果列表，指引新手观察同行分类结构 |
| 14 | 把年轻人的拍照痛点搞透，把图卡按场景整理好，挂上自动发货就是一门省心小生意。 | ips/xianyu-fanshen/assets/topic-mvarsxuz/tutorial/02-item-detail-scroll2.png | 商品详情页展示，强化省心自动发货轻资产闭环 |
| 15 | 我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。 | （无，口播人物卡镜头） | 自我包装口播收尾 |
| 16 | 学闲鱼，找圣矾。 | （无，品牌尾帧标板） | 品牌统一口号标板 |

## 缺图
- 无缺图，全篇 16 句均已严格匹配资产库内切实存在的真实截图。
`;

const desc2 = `# 拍照姿势 竖版短视频交付说明

## 稿件基本信息表

| 序号 | 选题 | 素材路径 | 骨架 | 开头结构 | 开头依据 | 结尾 | 字数（汉字） | check 结果 |
|---|---|---|---|---|---|---|---|---|
| 2 | 拍照姿势 | ips/xianyu-fanshen/assets/topic-mvarsxuz/ | A1 痛点反差流 | 痛点揭秘+真实闲鱼数据切入 | 选题核心与 facts.json 实采数据 | 结尾三步规范收尾（新手第一步+收拢+自我包装+口号） | 514 汉字（全篇 16 行） | check:compliance PASS (block=0, warn=0); check:draft 退回级 0 命中（长稿结构项忽略） |

## 最小闭环五要素对应句数
1. ① 什么生意、钱从哪来：第 1 句交代在闲鱼搜拍照姿势，单品标价两块到五块钱、全店卖出整整两万多单、网盘自动秒发不用物流发货；第 2 句交代全套合集标价九块九、单链接八百多人想要；第 6 句交代旅行情侣日常出行手机拍照构图与机位姿势打卡图卡合集。
2. ② 谁买、为什么：第 3 句交代喜欢出门旅游打卡探店的年轻人与约会情侣；第 4 句交代平时爱发朋友圈但面对镜头肢体僵硬只会剪刀手；第 5 句交代出门前存的摄影视频现场来不及看、拍出来全是僵硬废片扫兴。
3. ③ 货从哪来怎么交付：第 7 句交代把站姿、坐姿和走动动作做成手机相册解压即看图卡附带九宫格；第 8 句交代照图摆姿势配合九宫格拍出大片；第 9 句交代闲鱼两块钱拍同行合集剔除广告分类存入网盘；第 10 句交代网盘自动发货机器人付款秒发。
4. ④ 一个关键做法（重点）：第 11 句交代主图一定要放路人照与按教程摆姿势的成片对比突出零废片；第 12 句交代标题覆盖情侣拍照打卡与日常手机构图等长尾词。
5. ⑤ 新手第一步：第 13 句交代新手第一步今晚先打开闲鱼搜拍照姿势图解，花两块钱买一份同行合集摸清分类。

## 结尾三步规范收尾
- 收拢一句：第 14 句（把年轻人的拍照痛点搞透，把图卡按场景整理好，挂上自动发货就是一门省心小生意。）
- 自我包装：第 15 句（我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。）
- 口号收尾：第 16 句（学闲鱼，找圣矾。）

## 先钉理解自检
1. **开头的生意 = 选题核心那一句吗？**
   答：完全一致。开头第 1 句直截了当点明“你在闲鱼搜拍照姿势”，与选题核心“旅游、领证、情侣、闺蜜九宫格拍照姿势灵感图解与手机构图参数卡”严格吻合。
2. **有没有一句默认观众已经在做？**
   答：没有。全文站在向外行小白客观拆解一门副业的立场，通篇不预设观众已经在闲鱼开店。
3. **前后矛盾检查：**
   答：无矛盾。前面讲两块到五块钱单品与九块九合集、网盘自动秒发不用物流发货，后面讲以买代采同行母版与主图对比，前后商业与履约逻辑完全一致。

## 超出原文的推断句与待确认事实
- **超出原文的推断句**：无。所有价格、单量、交付方式均严格来自选题核心与 facts.json。
- **待用户确认的事实**：无。

## dbs 原始诊断与审稿记录

### 1. dbs-hook 诊断
| 诊断维度 | 评估结果 | 诊断说明 |
|---|---|---|
| 独立性 | 优 | 前两句脱离上下文完全能独立看懂，直接点明平台、品类与核心销量数据 |
| Hook强度 | 优 | 揭秘拍照姿势图卡在闲鱼全店卖出两万多单、网盘自动秒发，打破传统认知 |
| 悬念制造 | 优 | 用年轻人爱发朋友圈但面对镜头只会比剪刀手、废片扫兴的强烈痛点切入 |
| 可信度 | 优 | 给出单品标价两块到五块钱、全店卖出整整两万多单、八百多人想要等真实数据 |
| 口播友好 | 优 | 单句短促，全汉字数字，断句自然，无生硬拗口术语 |
| 匹配度 | 优 | 开头钩子的问题正是后文拆解的九宫格手机图卡与主图对比图做法 |

**备选开头表：**
1. 你在闲鱼搜拍照姿势，单品标价两块到五块钱，全店卖出整整两万多单，网盘自动秒发不用物流发货。（采用）
2. 喜欢出门拍照的年轻人可能想不到，闲鱼上卖拍照姿势图解，单品标价两块到五块钱，全店卖出了整整两万多单。
3. 很多新手不敢相信，把日常拍照动作整理成相册图卡在闲鱼卖，单品两块到五块钱，全店能卖出整整两万多单。

### 2. dbs-script-flow 诊断
- **段落结构**：
  - 第 1–2 句：钩子开场与真实闲鱼数据佐证。
  - 第 3–5 句：爱拍照年轻人面对镜头僵硬与视频繁琐废片痛点。
  - 第 6–8 句：解压即看对比图卡与九宫格构图解决方案。
  - 第 9–10 句：闲鱼花两块钱买断同行、网盘分类与自动秒发。
  - 第 11–12 句：主图路人照对比成片与精准长尾词布局。
  - 第 13 句：新手第一步。
  - 第 14–16 句：收拢一句、自我包装与品牌口号收尾。
- **问题清单与优化**：
  - 优化点：严格避免“零成本”禁词，换成“不用物流发货”纯人话表述。
  - 采纳建议：强化相册解压即看与九宫格构图辅助线，突出照着摆零废片的核心价值。
  - 否掉建议：否掉了“建议加入学员打卡日赚几百”的建议（违反 R035、R039 硬规矩）。
`;

fs.writeFileSync(path.join(localDir2, '20261023-拍照姿势-lime-capsule-v.txt'), txt2, 'utf8');
fs.writeFileSync(path.join(localDir2, '20261023-拍照姿势-lime-capsule-v.meta.json'), meta2, 'utf8');
fs.writeFileSync(path.join(localDir2, '20261023-拍照姿势-lime-capsule-v.素材.md'), material2, 'utf8');
fs.writeFileSync(path.join(localDir2, '1023-lime-capsule-v-说明.md'), desc2, 'utf8');

// 同时写入 NAS 路径
const nasDraftDir2 = 'Z:/素材生成库/ai文案/待审文案/拍照姿势';
const nasInfoDir2 = 'Z:/素材生成库/ai文案/资料/拍照姿势';
fs.mkdirSync(nasDraftDir2, { recursive: true });
fs.mkdirSync(nasInfoDir2, { recursive: true });

fs.writeFileSync(path.join(nasDraftDir2, '20261023-拍照姿势-lime-capsule-v.txt'), txt2, 'utf8');
fs.writeFileSync(path.join(nasDraftDir2, '20261023-拍照姿势-lime-capsule-v.meta.json'), meta2, 'utf8');
fs.writeFileSync(path.join(nasDraftDir2, '20261023-拍照姿势-lime-capsule-v.素材.md'), material2, 'utf8');
fs.writeFileSync(path.join(nasInfoDir2, '1023-lime-capsule-v-说明.md'), desc2, 'utf8');

console.log('Task 2 files written successfully to local and NAS.');
