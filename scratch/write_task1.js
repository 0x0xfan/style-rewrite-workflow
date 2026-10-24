const fs = require('fs');
const path = require('path');

const localDir1 = path.resolve('research-runs/每日/20261023-手抄报模板');
fs.mkdirSync(localDir1, { recursive: true });

const txt1 = [
'在闲鱼卖中小学手抄报模板，单品标价一块到三块钱，日均搜索两千多次。',
'头部店铺靠这种纯电子版资料，在闲鱼卖出一万多单，全套合集还能卖九块九。',
'买这个产品的主要是年轻家长，平时上班忙，一到节假日学校就留手抄报作业。',
'很多家长和孩子都不擅长画画，网上找的素材全是水印，根本没法直接用。',
'要是陪着孩子从头画，常常折腾到半夜两三点，家长累得够呛，孩子也直掉眼泪。',
'闲鱼卖家卖的就是整理好的节日与安全教育黑白线稿，花两三块钱就能打包带走。',
'家长拿普通打印纸直接印出来，孩子照着线稿描边涂色，半个小时就能轻松交差。',
'货源不需要你自己画，在闲鱼花几毛钱买断同行的无水印母库就能整理出来。',
'把节日、节气和校园科普分类存到网盘，挂上自动发货，拍下秒级履约。',
'做这个品最关键的做法，是主图一定要放黑白线稿与涂色效果对比图，突出清晰打印。',
'你在详情页写清楚纯电子版可打印线稿、不发纸质画，就能彻底避免退款扯皮。',
'新手做这个第一步，先去闲鱼搜手抄报模板，看排在前三名的店铺是怎么按主题分类的。',
'把家长的痛点接住，把线稿分类理顺，挂上自动发货就是一门省心的长久生意。',
'我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。',
'学闲鱼，找圣矾。'
].join('\n');

const meta1 = JSON.stringify({
  skin: 'black-yellow-v2',
  orientation: 'v',
  lengthTarget: '1.5min',
  date: '2026-10-23',
  topicSlug: 'topic-mv97gi1y',
  title: '手抄报模板',
  style: '常规'
}, null, 2);

const material1 = `# 手抄报模板 短视频素材对照
filmId: topic-mv97gi1y
稿件: 20261023-手抄报模板-black-yellow-v2-v.txt
画幅: 竖屏 9:16

| 句 | 原句 | 画面素材（manifest 里的 path） | 为什么用这张 |
|---|---|---|---|
| 1 | 在闲鱼卖中小学手抄报模板，单品标价一块到三块钱，日均搜索两千多次。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/market/02-top1-detail.clean.png | 单品标价与日均刚需，清晰展现标价一块到三块钱真实界面 |
| 2 | 头部店铺靠这种纯电子版资料，在闲鱼卖出一万多单，全套合集还能卖九块九。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/seller/02-seller-credit-badge.clean.png | 头部卖家全店成交真实信用页面，印证卖出一万多单大盘数据 |
| 3 | 买这个产品的主要是年轻家长，平时上班忙，一到节假日学校就留手抄报作业。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/demand/04-xianyu-search-dropdown.clean.png | 闲鱼搜索下拉框热词，反映小学生手抄报黑白线稿精准家长搜索需求 |
| 4 | 很多家长和孩子都不擅长画画，网上找的素材全是水印，根本没法直接用。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/market/01-search-results.png | 闲鱼搜索结果列表，体现家长对清晰无水印打印素材的迫切刚需 |
| 5 | 要是陪着孩子从头画，常常折腾到半夜两三点，家长累得够呛，孩子也直掉眼泪。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/market/03-top2-detail.clean.png | 同行商品展示，反衬家长熬夜辅导手抄报作业的深层痛点 |
| 6 | 闲鱼卖家卖的就是整理好的节日与安全教育黑白线稿，花两三块钱就能打包带走。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/supply/02-seller-deliverable-prod-1.png | 卖家交付物黑白线稿模板缩略图，展示纯黑白线稿即打即涂设计 |
| 7 | 家长拿普通打印纸直接印出来，孩子照着线稿描边涂色，半个小时就能轻松交差。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/tutorial/01-item-detail-scroll1.png | 宝贝详情页实操图，展示线稿打印及孩子涂色半小时交差实录 |
| 8 | 货源不需要你自己画，在闲鱼花几毛钱买断同行的无水印母库就能整理出来。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/supply/02-seller-deliverable-prod-2.png | 交付资源库目录截图，展示公版整理与以买代采的源头母库 |
| 9 | 把节日、节气和校园科普分类存到网盘，挂上自动发货，拍下秒级履约。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/supply/02-seller-deliverable-thumb-2.png | 网盘分类文件夹结构与自动发货提示，印证全天候秒级履约 |
| 10 | 做这个品最关键的做法，是主图一定要放黑白线稿与涂色效果对比图，突出清晰打印。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/supply/02-seller-deliverable-prod-3.png | 黑白线稿与彩色成品样稿对比图，直观展现主图视觉反差效果 |
| 11 | 你在详情页写清楚纯电子版可打印线稿、不发纸质画，就能彻底避免退款扯皮。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/tutorial/03-item-detail-scroll3.png | 宝贝详情页底部说明，大字提示电子版不发实物纸质画防退款 |
| 12 | 新手做这个第一步，先去闲鱼搜手抄报模板，看排在前三名的店铺是怎么按主题分类的。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/market/01-search-results.png | 闲鱼大盘综合排序前三名店铺列表，指引新手对标观察分类 |
| 13 | 把家长的痛点接住，把线稿分类理顺，挂上自动发货就是一门省心的长久生意。 | ips/xianyu-fanshen/assets/topic-mv97gi1y/seller/01-shop-home-shelves.clean.png | 头部优质卖家整齐店铺货架，体现轻资产长尾省心生意闭环 |
| 14 | 我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。 | （无，口播人物卡镜头） | 自我包装口播收尾 |
| 15 | 学闲鱼，找圣矾。 | （无，品牌尾帧标板） | 品牌统一口号标板 |

## 缺图
- 无缺图，全篇 15 句均已严格匹配资产库内切实存在的真实截图。
`;

const desc1 = `# 手抄报模板 竖版短视频交付说明

## 稿件基本信息表

| 序号 | 选题 | 素材路径 | 骨架 | 开头结构 | 开头依据 | 结尾 | 字数（汉字） | check 结果 |
|---|---|---|---|---|---|---|---|---|
| 1 | 手抄报模板 | ips/xianyu-fanshen/assets/topic-mv97gi1y/ | A1 痛点反差流 | 痛点揭秘+真实闲鱼数据切入 | 选题核心与 facts.json 实采数据 | 结尾三步规范收尾（新手第一步+收拢+自我包装+口号） | 443 汉字（全篇 15 行） | check:compliance PASS (block=0, warn=0); check:draft 退回级 0 命中（长稿结构项忽略） |

## 最小闭环五要素对应句数
1. ① 什么生意、钱从哪来：第 1 句交代在闲鱼卖中小学手抄报模板，单品标价一块到三块钱、日均搜索两千多次；第 2 句交代头部店铺卖出一万多单、全套合集卖九块九；第 6 句交代整理好的节日与安全教育黑白线稿花两三块钱打包。
2. ② 谁买、为什么：第 3 句交代家里有小学生的年轻家长平时上班忙、节假日留作业；第 4 句交代家长孩子不擅长画画、网上素材全水印；第 5 句交代从头画折腾到半夜两三点、大人累孩子哭；第 7 句交代拿普通打印纸直接印出涂色半小时交差。
3. ③ 货从哪来怎么交付：第 8 句交代在闲鱼花几毛钱买断同行的无水印母库；第 9 句交代按主题分类存入网盘，挂自动发货拍下秒级履约。
4. ④ 一个关键做法（重点）：第 10 句交代主图放黑白线稿与涂色效果对比图突出清晰打印；第 11 句交代详情页写清楚纯电子版可打印线稿不发纸质画防退款。
5. ⑤ 新手第一步：第 12 句交代新手第一步先去闲鱼搜手抄报模板，看排在前三名的店铺怎么按主题分类。

## 结尾三步规范收尾
- 收拢一句：第 13 句（把家长的痛点接住，把线稿分类理顺，挂上自动发货就是一门省心的长久生意。）
- 自我包装：第 14 句（我是圣矾，一个在闲鱼摸爬滚打多年的老卖家。）
- 口号收尾：第 15 句（学闲鱼，找圣矾。）

## 先钉理解自检
1. **开头的生意 = 选题核心那一句吗？**
   答：完全一致。开头第 1 句直截了当点明“在闲鱼卖中小学手抄报模板”，与选题核心“中小学节假日、安全、科普手抄报黑白线稿模板，打印涂色手绘稿合集”严格吻合。
2. **有没有一句默认观众已经在做？**
   答：没有。全文站在向外行小白客观拆解一门副业的立场，通篇不预设观众已经在闲鱼开店。
3. **前后矛盾检查：**
   答：无矛盾。前面讲几块钱单品与九块九合集、网盘自动秒发，后面讲买断同行母库整理分类与主图对比，前后商业与履约逻辑完全一致。

## 超出原文的推断句与待确认事实
- **超出原文的推断句**：无。所有价格、单量、交付方式均严格来自选题核心与 facts.json。
- **待用户确认的事实**：无。

## dbs 原始诊断与审稿记录

### 1. dbs-hook 诊断
| 诊断维度 | 评估结果 | 诊断说明 |
|---|---|---|
| 独立性 | 优 | 前两句脱离上下文完全能独立看懂，直接点明平台、品类与核心数据 |
| Hook强度 | 优 | 揭秘中小学手抄报模板在闲鱼日均搜索两千多次、头部店铺卖出一万多单，打破认知 |
| 悬念制造 | 优 | 用家长辅导手抄报作业折腾到半夜的痛点切入，共鸣极其强烈 |
| 可信度 | 优 | 给出单品标价一块到三块钱、日均搜索两千多次、卖出一万多单的真实数据佐证 |
| 口播友好 | 优 | 单句短促，全汉字数字，断句自然，无生硬书面词 |
| 匹配度 | 优 | 开头钩子的问题正是后文拆解的黑白线稿打印涂色与主图对比做法 |

**备选开头表：**
1. 在闲鱼卖中小学手抄报模板，单品标价一块到三块钱，日均搜索两千多次。（采用）
2. 很多年轻家长不知道，闲鱼上卖的中小学手抄报模板，单品标价一块到三块钱，日均搜索两千多次。
3. 网上随处可见的黑白手抄报线稿，在闲鱼上单品标价一块到三块钱，全店竟然卖出了一万多单。

### 2. dbs-script-flow 诊断
- **段落结构**：
  - 第 1–2 句：钩子开场与真实闲鱼数据佐证。
  - 第 3–5 句：年轻家长辅导手抄报作业熬夜折腾痛点。
  - 第 6–7 句：黑白线稿即打即涂解决方案与省时交差价值。
  - 第 8–9 句：闲鱼以买代采同行母库、网盘分类与自动秒发。
  - 第 10–11 句：主图涂色前后对比与详情页防退款说明。
  - 第 12 句：新手第一步。
  - 第 13–15 句：收拢一句、自我包装与品牌口号收尾。
- **问题清单与优化**：
  - 优化点：剔除任何英文缩写与可能引发歧义的代码词，全部使用口语人话。
  - 采纳建议：在主图部分强化黑白线稿与涂色成品反差对比，突出清晰无水印直接打印的核心卖点。
  - 否掉建议：否掉了“建议增加学员月入过万案例”的建议（违反 R035、R039 硬规矩）。
`;

fs.writeFileSync(path.join(localDir1, '20261023-手抄报模板-black-yellow-v2-v.txt'), txt1, 'utf8');
fs.writeFileSync(path.join(localDir1, '20261023-手抄报模板-black-yellow-v2-v.meta.json'), meta1, 'utf8');
fs.writeFileSync(path.join(localDir1, '20261023-手抄报模板-black-yellow-v2-v.素材.md'), material1, 'utf8');
fs.writeFileSync(path.join(localDir1, '1023-black-yellow-v2-v-说明.md'), desc1, 'utf8');

// 同时写入 NAS 路径
const nasDraftDir1 = 'Z:/素材生成库/ai文案/待审文案/手抄报模板';
const nasInfoDir1 = 'Z:/素材生成库/ai文案/资料/手抄报模板';
fs.mkdirSync(nasDraftDir1, { recursive: true });
fs.mkdirSync(nasInfoDir1, { recursive: true });

fs.writeFileSync(path.join(nasDraftDir1, '20261023-手抄报模板-black-yellow-v2-v.txt'), txt1, 'utf8');
fs.writeFileSync(path.join(nasDraftDir1, '20261023-手抄报模板-black-yellow-v2-v.meta.json'), meta1, 'utf8');
fs.writeFileSync(path.join(nasDraftDir1, '20261023-手抄报模板-black-yellow-v2-v.素材.md'), material1, 'utf8');
fs.writeFileSync(path.join(nasInfoDir1, '1023-black-yellow-v2-v-说明.md'), desc1, 'utf8');

console.log('Task 1 files written successfully to local and NAS.');
