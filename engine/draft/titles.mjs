#!/usr/bin/env node
// engine/draft/titles.mjs —— 10 种风格备选标题生成与校验工具
// 用户 2026-10-10 定：写稿时必须同步产出 10 个不同风格标题存入同名 .meta.json 的 titles 字段；
// 【2026-10-10 用户最新铁律】：标题生成严禁放入文案正文（.txt），文案里一律不许有，全都删掉！只保留纯净口播正文。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate10CoverOptions } from './cover-titles.mjs';

export const TITLE_STYLES = [
  '手把手实操',
  '反问测真假',
  '劝退避坑',
  '老玩家交代',
  '货源工具直给',
  '底层逻辑拆解',
  '反常识揭秘',
  '轻资产人群画像',
  '一期讲透通关',
  '精炼短句'
];

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
 * 为指定选题生成 10 种风格备选标题
 */
export function generate10Titles(topicName, options = {}) {
  const isKnowledge = options.isKnowledge ?? isKnowledgeTopic(topicName);

  if (isKnowledge) {
    return [
      { style: '手把手实操', text: `手把手教你解决闲鱼${topicName} 保姆级排查方法快速见效` },
      { style: '反问测真假', text: `闲鱼${topicName}真的有用吗 很多人从第一步就彻底做错了` },
      { style: '劝退避坑', text: `新手做闲鱼遇到${topicName} 先听我一句劝 千万别盲目乱动` },
      { style: '老玩家交代', text: `做闲鱼遇到${topicName}怎么破 老玩家教你几招 快速稳住店铺流量` },
      { style: '货源工具直给', text: `闲鱼${topicName}核心底层逻辑 应对技巧与避坑指南全盘交代` },
      { style: '底层逻辑拆解', text: `深度拆解闲鱼平台机制 为什么会遇到${topicName}的本质原因` },
      { style: '反常识揭秘', text: `别再病急乱投医了 揭秘闲鱼${topicName}背后的真实算法逻辑` },
      { style: '轻资产人群画像', text: `新手做闲鱼起步最容易踩的坑 ${topicName}全流程应对指南` },
      { style: '一期讲透通关', text: `一期视频彻底讲透闲鱼${topicName} 平台机制与实战干货一次说清` },
      { style: '精炼短句', text: `闲鱼${topicName}应对实战指南 新手直接抄作业` }
    ];
  }

  // 产品 / 项目类
  return [
    { style: '手把手实操', text: `手把手教你在闲鱼做${topicName} 从找货源到自动出单全流程拆解` },
    { style: '反问测真假', text: `在闲鱼卖${topicName}真的能赚钱吗 拆解这门小生意的真实利润和门槛` },
    { style: '劝退避坑', text: `新手想在闲鱼做${topicName} 先听我一句劝 搞懂这几点再碰少踩坑` },
    { style: '老玩家交代', text: `在闲鱼做${topicName}怎么起步 老玩家交底 做好这几步少走半年弯路` },
    { style: '货源工具直给', text: `闲鱼${topicName}无货源去哪找货源 渠道和出单链路全盘交代` },
    { style: '底层逻辑拆解', text: `为什么有人在闲鱼卖${topicName}闷声赚钱 深度拆解背后的差价逻辑` },
    { style: '反常识揭秘', text: `以为${topicName}太冷门没人要 揭秘闲鱼这类虚拟项目稳定出单的玩法` },
    { style: '轻资产人群画像', text: `不用压货不用囤货 适合打工人和普通人起步的闲鱼${topicName}副业` },
    { style: '一期讲透通关', text: `一期视频讲透闲鱼${topicName}怎么做 渠道 选品 定价一次性给你讲透` },
    { style: '精炼短句', text: `闲鱼${topicName}实操全流程拆解 新手直接抄作业` }
  ];
}

/**
 * 校验标题列表是否合法：
 * 1. 数量必须为 10
 * 2. 严禁出现冒号（:，：）
 * 3. 必须包含关键词（闲鱼）
 */
export function validateTitles(titles) {
  const errors = [];
  if (!Array.isArray(titles) || titles.length < 10) {
    errors.push(`备选标题数量不足 10 条（当前 ${Array.isArray(titles) ? titles.length : 0} 条）`);
  }
  (titles || []).forEach((t, i) => {
    const text = typeof t === 'string' ? t : (t.text || '');
    if (/[:：]/u.test(text)) {
      errors.push(`标题 #${i + 1} 含有冒号（禁止冒号，必须用空格自然断句）：${text}`);
    }
    if (!text.includes('闲鱼')) {
      errors.push(`标题 #${i + 1} 缺少平台搜索关键词「闲鱼」：${text}`);
    }
  });
  return errors;
}

/**
 * 为指定稿件文件及其 .meta.json 同步写入 10 个标题
 * 注意：【用户 2026-10-10 铁律】标题只写入 .meta.json，文案 .txt 严禁存放任何标题！
 * 若 .txt 中有历史遗留的备选标题块，自动清除并保存纯净正文。
 */
export function attachTitlesToFile(txtPath, topicName = '') {
  const absTxt = path.resolve(txtPath);
  const metaPath = absTxt.replace(/\.txt$/, '.meta.json');

  let topic = topicName;
  let meta = null;
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (!topic && meta.title) topic = meta.title;
    } catch {}
  }
  if (!topic) {
    topic = path.basename(path.dirname(absTxt));
  }

  const titles = (meta && Array.isArray(meta.titles) && meta.titles.length === 10) ? meta.titles : generate10Titles(topic);

  // 用户 2026-10-11 定：只有分配了封面的横版视频（h）才带封面文案，未分配封面的竖版/真人/聊天不带
  const isHorizontalCover = meta?.orientation === 'h' && meta?.kind !== 'selfie' && meta?.skin !== 'chat';
  let coverOptions = null;
  let coverConfirmed = null;

  if (isHorizontalCover) {
    coverOptions = (meta && Array.isArray(meta.coverOptions) && meta.coverOptions.length === 10)
      ? meta.coverOptions
      : generate10CoverOptions(topic, { skin: meta?.skin });
    coverConfirmed = (meta && meta.coverConfirmed && meta.coverConfirmed.title)
      ? meta.coverConfirmed
      : {
          confirmed: false,
          templateId: coverOptions[0].templateId,
          updatedAt: new Date().toISOString(),
          style: coverOptions[0].style,
          lines: coverOptions[0].lines,
          title: coverOptions[0].title,
          highlight: coverOptions[0].highlight,
          sub: coverOptions[0].sub
        };
  }

  // 1. 更新 meta.json
  if (!meta) meta = { title: topic };
  meta.titles = titles;
  if (isHorizontalCover) {
    meta.coverOptions = coverOptions;
    meta.coverConfirmed = coverConfirmed;
  } else {
    delete meta.coverOptions;
    delete meta.coverConfirmed;
  }
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  // 2. 清洗 txt 文件（严禁保留备选标题块）
  if (fs.existsSync(absTxt)) {
    let txt = fs.readFileSync(absTxt, 'utf8');
    const cut = txt.search(/(?:\r?\n|^)={3,}\s*备选标题\s*={3,}/u);
    if (cut >= 0) {
      const baseTxt = txt.slice(0, cut).trimEnd() + '\n';
      fs.writeFileSync(absTxt, baseTxt, 'utf8');
    }
  }

  return titles;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [,, target, ...rest] = process.argv;
  if (!target || target === '-h' || target === '--help') {
    console.log(`用法: node engine/draft/titles.mjs <稿件.txt | 选题名> [--topic 选题]`);
    process.exit(0);
  }

  if (target.endsWith('.txt')) {
    const topicArgIdx = rest.indexOf('--topic');
    const topic = topicArgIdx >= 0 ? rest[topicArgIdx + 1] : '';
    const titles = attachTitlesToFile(target, topic);
    const errors = validateTitles(titles);
    console.log(`已成功为 ${target} 生成并写入 10 个备选标题至 .meta.json（.txt 保持纯净）：`);
    titles.forEach((t, i) => console.log(`  ${i + 1}. [${t.style}] ${t.text}`));
    if (errors.length) {
      console.error(`校验警告:`, errors);
      process.exit(1);
    }
  } else {
    // 纯生成打印
    const titles = generate10Titles(target);
    console.log(`【${target}】10 种风格备选标题：`);
    titles.forEach((t, i) => console.log(`  ${i + 1}. [${t.style}] ${t.text}`));
  }
}
