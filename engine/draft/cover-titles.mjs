#!/usr/bin/env node
// engine/draft/cover-titles.mjs —— 封面模板自适应文案生成与维护工具
// 用户 2026-10-10 定：写稿时在 .meta.json 中同步生成 10 套备选封面文案，并在中控台提供【确认封面】输入框，出片时同步出封面图。
// 用户 2026-10-13 铁律：封面模板排版行数不一（2行 / 3行 / 4行），封面文案必须按皮肤定向绑定的模板槽位精准生成，彻底杜绝固定三段式导致的错位与缺行！

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const COVER_STYLES = [
  '收益爆点型',
  '零本实操型',
  '极简承诺型',
  '薄利多销型',
  '一手渠道型',
  '冷门搞钱型',
  '全自动交付',
  '适合新手型',
  '一期讲透型',
  '老玩家交底'
];

/**
 * 6 个横版账号皮肤与专属封面模板的严格绑定映射
 */
export const SKIN_TO_TEMPLATE = {
  'ledger-desk': 'tpl-05-dark-gold-badge',     // 对账台：2 行（主标题 + 底部胶囊）
  'blueprint': 'tpl-03-blue-capsule',          // 蓝图拆解：3 行（主标 + 收益大字 + 胶囊词）
  'black-yellow-v2': 'tpl-10-dark-wood-car',    // 黑黄：3 行（主标 + 爆点大字 + 底部黑条）
  'pixel-arcade': 'tpl-07-night-cartoon',      // 像素街机：3 行（主标 + 爆点词 + 行动词）
  'signature-wall': 'tpl-02-yellow-paper',     // 署名墙：4 行（主标 + 收益 + 人群 + 承诺）
  'lime-capsule': 'tpl-09-camera-lightning',   // 荧光绿：4 行（左上小标 + 核心词 + 行动词 + 胶囊）
};

/**
 * 判断是否为运营技巧/经验类选题
 */
export function isKnowledgeTopic(topicName) {
  return topicName.includes('为什么') ||
    topicName.includes('怎么') ||
    topicName.includes('会不会') ||
    topicName.includes('多少') ||
    topicName.includes('要不要') ||
    topicName.includes('如何') ||
    topicName.includes('还是') ||
    topicName.includes('吗');
}

/**
 * 针对具体模板槽位，为指定选题生成 10 套专属封面文案方案
 */
export function generate10CoverOptions(topicName, extra = {}) {
  const isKnowledge = extra.isKnowledge ?? isKnowledgeTopic(topicName);
  const skin = extra.skin || '';
  const templateId = extra.templateId || SKIN_TO_TEMPLATE[skin] || 'tpl-03-blue-capsule';
  const incomeStr = extra.income ? extra.income : '今日收入1178';
  const profitStr = extra.profit ? `一单只赚${extra.profit}元` : '一单只赚30元';

  // 1. 【2 行模板】tpl-05-dark-gold-badge（黑金双线框 · 对账台 ledger-desk）
  if (templateId === 'tpl-05-dark-gold-badge') {
    const list = [
      { style: '收益爆点型', l1: `闲鱼卖${topicName}`, l2: `${profitStr}` },
      { style: '零本实操型', l1: `闲鱼${topicName}`, l2: '零成本无货源' },
      { style: '极简承诺型', l1: `${topicName}实操`, l2: '7天之内必出单' },
      { style: '薄利多销型', l1: `闲鱼${topicName}`, l2: '秒出单靠走量' },
      { style: '一手渠道型', l1: `${topicName}拆解`, l2: '一手货源渠道' },
      { style: '冷门搞钱型', l1: '闷声发财副业', l2: `闲鱼卖${topicName}` },
      { style: '全自动交付', l1: `${topicName}代做`, l2: '自动发货系统' },
      { style: '适合新手型', l1: '适合新人的副业', l2: '零基础直接抄' },
      { style: '一期讲透型', l1: '一期全流程通关', l2: '选品定价全交代' },
      { style: '老玩家交底', l1: '闲鱼项目拆解', l2: '学闲鱼找圣矾' }
    ];
    return list.map((item, idx) => ({
      id: idx + 1,
      style: item.style,
      templateId,
      lines: [
        { slot: 'mainTitle', name: '主标题（金框内）', text: item.l1 },
        { slot: 'subBadge', name: '底部胶囊词', text: item.l2 }
      ],
      title: item.l1,
      highlight: item.l2,
      sub: item.l2,
      preview: `${item.l1} | ${item.l2}`
    }));
  }

  // 2. 【3 行模板】tpl-10-dark-wood-car（暗黑木纹白橙斜字 · 黑黄 black-yellow-v2）
  if (templateId === 'tpl-10-dark-wood-car') {
    const list = [
      { style: '收益爆点型', l1: '在闲鱼做副业', l2: `卖${topicName}`, l3: `${incomeStr}` },
      { style: '零本实操型', l1: '零成本无货源', l2: `闲鱼卖${topicName}`, l3: '全流程实操拆解' },
      { style: '极简承诺型', l1: '一部手机搞定', l2: `闲鱼${topicName}`, l3: '7天之内必出单' },
      { style: '薄利多销型', l1: '秒出单靠走量', l2: `闲鱼${topicName}`, l3: `${profitStr}` },
      { style: '一手渠道型', l1: '一手货源渠道', l2: `闲鱼${topicName}`, l3: '差价逻辑全交代' },
      { style: '冷门搞钱型', l1: '闷声发财副业', l2: `闲鱼${topicName}`, l3: '低调稳定出单' },
      { style: '全自动交付', l1: '搭建自动出单', l2: `闲鱼${topicName}`, l3: '不耽误日常上班' },
      { style: '适合新手型', l1: '新手第一步副业', l2: `闲鱼${topicName}`, l3: '零基础照着做' },
      { style: '一期讲透型', l1: '一期彻底讲透', l2: `闲鱼${topicName}`, l3: '渠道定价避坑指南' },
      { style: '老玩家交底', l1: '老玩家全盘交底', l2: `闲鱼${topicName}`, l3: '学闲鱼找圣矾' }
    ];
    return list.map((item, idx) => ({
      id: idx + 1,
      style: item.style,
      templateId,
      lines: [
        { slot: 'line1', name: '第一行主标（白+橙双色）', text: item.l1 },
        { slot: 'line2', name: '第二行超大爆点（白+橙双色）', text: item.l2 },
        { slot: 'bottomBar', name: '底部黑条内关键词', text: item.l3 }
      ],
      title: item.l1,
      highlight: item.l2,
      sub: item.l3,
      preview: `${item.l1} | ${item.l2} | ${item.l3}`
    }));
  }

  // 3. 【3 行模板】tpl-07-night-cartoon（夜景漫画点赞 · 像素街机 pixel-arcade）
  if (templateId === 'tpl-07-night-cartoon') {
    const list = [
      { style: '收益爆点型', l1: '在闲鱼做副业', l2: `${topicName}`, l3: `${incomeStr}` },
      { style: '零本实操型', l1: '零成本无货源', l2: `闲鱼${topicName}`, l3: '自动出单全流程' },
      { style: '极简承诺型', l1: '一部手机操作', l2: `闲鱼${topicName}`, l3: '7天之内必出单' },
      { style: '薄利多销型', l1: '秒出单靠走量', l2: `闲鱼${topicName}`, l3: `${profitStr}` },
      { style: '一手渠道型', l1: '一手渠道公开', l2: `闲鱼${topicName}`, l3: '差价逻辑全盘交代' },
      { style: '冷门搞钱型', l1: '闷声发财项目', l2: `闲鱼${topicName}`, l3: '很多人不知道的门道' },
      { style: '全自动交付', l1: '搭建自动系统', l2: `闲鱼${topicName}`, l3: '下班回家看后台' },
      { style: '适合新手型', l1: '适合新人起步', l2: `闲鱼${topicName}`, l3: '新手小白直接抄' },
      { style: '一期讲透型', l1: '一期全盘讲透', l2: `闲鱼${topicName}`, l3: '选品定价全流程' },
      { style: '老玩家交底', l1: '老玩家掏心窝', l2: `闲鱼${topicName}`, l3: '学闲鱼找圣矾' }
    ];
    return list.map((item, idx) => ({
      id: idx + 1,
      style: item.style,
      templateId,
      lines: [
        { slot: 'title1', name: '第一行主标短语', text: item.l1 },
        { slot: 'title2', name: '第二行超大爆点词', text: item.l2 },
        { slot: 'sub', name: '第三行行动号召', text: item.l3 }
      ],
      title: item.l1,
      highlight: item.l2,
      sub: item.l3,
      preview: `${item.l1} | ${item.l2} | ${item.l3}`
    }));
  }

  // 4. 【4 行模板】tpl-02-yellow-paper（黄底双色便签 · 署名墙 signature-wall）
  if (templateId === 'tpl-02-yellow-paper') {
    const list = [
      { style: '收益爆点型', l1: `闲鱼${topicName}`, l2: `${incomeStr}`, l3: '新手小白也能立即上手', l4: '7天之内必出单' },
      { style: '零本实操型', l1: `闲鱼${topicName}`, l2: '零成本无货源', l3: '出单全流程拆解', l4: '一部手机就能干' },
      { style: '极简承诺型', l1: `闲鱼${topicName}项目`, l2: '当天快速起步', l3: '不用囤货不用压款', l4: '新手首周必出单' },
      { style: '薄利多销型', l1: `闲鱼${topicName}`, l2: `${profitStr}`, l3: '秒出单靠走量', l4: '渠道差价月入稳定' },
      { style: '一手渠道型', l1: `闲鱼${topicName}`, l2: '一手稳定渠道', l3: '差价逻辑全盘交代', l4: '避免中间商赚差价' },
      { style: '冷门搞钱型', l1: '闷声发财小生意', l2: `闲鱼${topicName}`, l3: '很多人不知道的门道', l4: '低调稳定每天出单' },
      { style: '全自动交付', l1: '搭建自动化系统', l2: '网盘自动发货', l3: '出单秒发无需值守', l4: '不耽误日常上班' },
      { style: '适合新手型', l1: '适合新人的副业', l2: `闲鱼${topicName}`, l3: '零基础小白照着做', l4: '跟着步骤直接抄作业' },
      { style: '一期讲透型', l1: '一期全流程通关', l2: `闲鱼${topicName}`, l3: '选品定价引流讲透', l4: '避坑指南一次说清' },
      { style: '老玩家交底', l1: '闲鱼虚拟项目拆解', l2: `卖${topicName}`, l3: '老卖家掏心窝子交底', l4: '学闲鱼找圣矾' }
    ];
    return list.map((item, idx) => ({
      id: idx + 1,
      style: item.style,
      templateId,
      lines: [
        { slot: 'title1', name: '顶部项目大字/第一行', text: item.l1 },
        { slot: 'income', name: '核心收益爆点/第二行', text: item.l2 },
        { slot: 'sub1', name: '适合人群/第三行中字', text: item.l3 },
        { slot: 'sub2', name: '结果承诺/第四行中字', text: item.l4 }
      ],
      title: item.l1,
      highlight: item.l2,
      sub: `${item.l3} ${item.l4}`,
      preview: `${item.l1} | ${item.l2} | ${item.l3} | ${item.l4}`
    }));
  }

  // 5. 【4 行模板】tpl-09-camera-lightning（闪电立体撞色 · 荧光绿 lime-capsule）
  if (templateId === 'tpl-09-camera-lightning') {
    const list = [
      { style: '收益爆点型', l1: '闲鱼其实不难', l2: `${topicName}`, l3: `${incomeStr}`, l4: '小白必看' },
      { style: '零本实操型', l1: '零成本无货源', l2: `闲鱼${topicName}`, l3: '出单流程全拆解', l4: '极速上手' },
      { style: '极简承诺型', l1: '一部手机搞定', l2: `闲鱼${topicName}`, l3: '7天之内必出单', l4: '直接抄作业' },
      { style: '薄利多销型', l1: '秒出单靠走量', l2: `闲鱼${topicName}`, l3: `${profitStr}`, l4: '稳定出单' },
      { style: '一手渠道型', l1: '一手货源渠道', l2: `闲鱼${topicName}`, l3: '差价逻辑全交代', l4: '干货交底' },
      { style: '冷门搞钱型', l1: '闷声发财副业', l2: `闲鱼${topicName}`, l3: '少有人知道的路子', l4: '建议收藏' },
      { style: '全自动交付', l1: '无需人工值守', l2: '自动发货系统', l3: '不耽误日常上班', l4: '轻松省心' },
      { style: '适合新手型', l1: '新手首选副业', l2: `闲鱼${topicName}`, l3: '零基础小白直接做', l4: '保姆级教学' },
      { style: '一期讲透型', l1: '一期全盘讲透', l2: `闲鱼${topicName}`, l3: '选品定价一次说清', l4: '干货必看' },
      { style: '老玩家交底', l1: '老玩家掏心窝', l2: `闲鱼${topicName}`, l3: '做虚拟项目全流程', l4: '学闲鱼找圣矾' }
    ];
    return list.map((item, idx) => ({
      id: idx + 1,
      style: item.style,
      templateId,
      lines: [
        { slot: 'topTip', name: '左上角黄色小标', text: item.l1 },
        { slot: 'mainRow', name: '中间第一行撞色核心词', text: item.l2 },
        { slot: 'subRow', name: '中间第二行行动词', text: item.l3 },
        { slot: 'pill', name: '右下角圆角药丸词', text: item.l4 }
      ],
      title: item.l2,
      highlight: item.l3,
      sub: `${item.l1} / ${item.l4}`,
      preview: `${item.l1} | ${item.l2} | ${item.l3} | ${item.l4}`
    }));
  }

  // 6. 【3 行标准胶囊模板】默认 tpl-03-blue-capsule（蓝图拆解 blueprint 及通用）
  const list = [
    { style: '收益爆点型', l1: `在闲鱼卖${topicName}`, l2: `${incomeStr}`, l3: '小白也能立即上手' },
    { style: '零本实操型', l1: `闲鱼卖${topicName}`, l2: '零成本无货源', l3: '自动出单全流程' },
    { style: '极简承诺型', l1: `闲鱼${topicName}项目`, l2: '7天之内必出单', l3: '一部手机就能操作' },
    { style: '薄利多销型', l1: `闲鱼${topicName}`, l2: `${profitStr}`, l3: '秒出单靠走量' },
    { style: '一手渠道型', l1: `闲鱼${topicName}`, l2: '一手货源渠道', l3: '差价逻辑全盘交代' },
    { style: '冷门搞钱型', l1: '闷声发财小生意', l2: `闲鱼卖${topicName}`, l3: '很多人不知道的路子' },
    { style: '全自动交付', l1: '搭建自动化系统', l2: '网盘自动发货', l3: '不占用日常上班时间' },
    { style: '适合新手型', l1: '适合新人的副业', l2: `闲鱼${topicName}`, l3: '零基础小白直接照做' },
    { style: '一期讲透型', l1: '一期全流程通关', l2: `闲鱼${topicName}`, l3: '选品定价一次讲透' },
    { style: '老玩家交底', l1: '闲鱼虚拟项目拆解', l2: `卖${topicName}`, l3: '学闲鱼找圣矾' }
  ];

  return list.map((item, idx) => ({
    id: idx + 1,
    style: item.style,
    templateId,
    lines: [
      { slot: 'title1', name: '顶部项目大字/第一行', text: item.l1 },
      { slot: 'income', name: '核心收益大字/第二行', text: item.l2 },
      { slot: 'capsuleText', name: '底部胶囊药丸居中行动词', text: item.l3 }
    ],
    title: item.l1,
    highlight: item.l2,
    sub: item.l3,
    preview: `${item.l1} | ${item.l2} | ${item.l3}`
  }));
}

/**
 * 为指定 metaPath 生成并更新模板专属的 coverOptions 与 coverConfirmed
 */
export function updateMetaCoverData(metaPath, topicName = '', extra = {}) {
  let meta = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
      console.error(`Read error ${metaPath}:`, e.message);
    }
  }

  // 用户 2026-10-11 定：只有分配了封面的横版视频（h）才带封面文案，未分配封面的竖版/真人/聊天不带
  const isHorizontalCover = meta.orientation === 'h' && meta.kind !== 'selfie' && meta.skin !== 'chat';
  if (!isHorizontalCover) {
    delete meta.coverOptions;
    delete meta.coverConfirmed;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    return { coverOptions: [], coverConfirmed: null };
  }

  const topic = topicName || meta.title || path.basename(path.dirname(metaPath));
  const skin = meta.skin || extra.skin || '';
  const templateId = meta.templateId || extra.templateId || SKIN_TO_TEMPLATE[skin] || 'tpl-03-blue-capsule';

  const coverOptions = generate10CoverOptions(topic, {
    skin,
    templateId,
    income: extra.income,
    profit: extra.profit,
    isKnowledge: extra.isKnowledge
  });

  const opt0 = coverOptions[0];
  const coverConfirmed = (meta.coverConfirmed && Array.isArray(meta.coverConfirmed.lines) && meta.coverConfirmed.lines.length)
    ? meta.coverConfirmed
    : {
        confirmed: false,
        templateId,
        updatedAt: new Date().toISOString(),
        style: opt0.style,
        lines: opt0.lines,
        title: opt0.title,
        highlight: opt0.highlight,
        sub: opt0.sub
      };

  meta.templateId = templateId;
  meta.coverOptions = coverOptions;
  meta.coverConfirmed = coverConfirmed;

  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  return { coverOptions, coverConfirmed };
}
