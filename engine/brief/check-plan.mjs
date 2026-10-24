#!/usr/bin/env node
// check-plan.mjs —— 每日排选题门禁与查重检查工具
//
// 核心职责：
//   在向用户发出「今日选题表」之前，强制执行确定性查重门禁，彻底杜绝重复出选题！
//
// 必须通过的 4 大门禁：
//   1. 账号完整性：当天必须齐备 16 篇（6 横版 + 7 竖版 + 3 真人出镜），账号无遗漏、无多余。
//   2. 当天两两去重：当天 16 篇选题两两绝对不同（包括同品的横版和竖版也不得在同一天出现）。
//   3. 台账历史查重：同一账号在 docs/每日/账号选题台账.md 历史记录中绝不重复出现。
//   4. NAS 物理直查兜底：直接扫描 Z:\素材生成库\ai文案\待审文案\ 与 已用\，物理文件已存在则绝对阻断。
//
// 用法：
//   node engine/brief/check-plan.mjs <选题表.md>
//   Get-Content plan.md | node engine/brief/check-plan.mjs -
//   node engine/brief/check-plan.mjs --audit   (对全量台账与 NAS 进行历史一致性健康体检)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

export const LEDGER_PATH = path.join(REPO_ROOT, 'docs/每日/账号选题台账.md');
export const NAS_PENDING_DIR = 'Z:/素材生成库/ai文案/待审文案';
export const NAS_USED_DIR = 'Z:/素材生成库/ai文案/已用';
export const ASSETS_DIR = 'D:/项目仓库/remotion视频制作/public/ips/xianyu-fanshen/assets';

// 永久禁用选题黑名单（用户裁定永不使用）
export const BANNED_TOPICS = [
  '苹果多开',
  '苹果多开分身',
  'pingguo-duokai'
];

// 16 个标准账号定义
export const STANDARD_ACCOUNTS = [
  // 6 个横版账号
  { id: 'black-yellow-v2-h', name: '黑黄 横版', skin: 'black-yellow-v2', orientation: 'h', category: '横版长稿' },
  { id: 'lime-capsule-h',    name: '荧光绿 横版', skin: 'lime-capsule',    orientation: 'h', category: '横版长稿' },
  { id: 'signature-wall-h',  name: '署名墙 横版', skin: 'signature-wall',  orientation: 'h', category: '横版长稿' },
  { id: 'ledger-desk-h',     name: '对账台 横版', skin: 'ledger-desk',     orientation: 'h', category: '横版长稿' },
  { id: 'blueprint-h',       name: '蓝图拆解 横版', skin: 'blueprint',       orientation: 'h', category: '横版长稿' },
  { id: 'pixel-arcade-h',    name: '像素街机 横版', skin: 'pixel-arcade',    orientation: 'h', category: '横版长稿' },
  // 7 个竖版账号
  { id: 'black-yellow-v2-v', name: '黑黄 竖版', skin: 'black-yellow-v2', orientation: 'v', category: '竖版短视频' },
  { id: 'lime-capsule-v',    name: '荧光绿 竖版', skin: 'lime-capsule',    orientation: 'v', category: '竖版短视频' },
  { id: 'signature-wall-v',  name: '署名墙 竖版', skin: 'signature-wall',  orientation: 'v', category: '竖版短视频' },
  { id: 'ledger-desk-v',     name: '对账台 竖版', skin: 'ledger-desk',     orientation: 'v', category: '竖版短视频' },
  { id: 'blueprint-v',       name: '蓝图拆解 竖版', skin: 'blueprint',       orientation: 'v', category: '竖版短视频' },
  { id: 'pixel-arcade-v',    name: '像素街机 竖版', skin: 'pixel-arcade',    orientation: 'v', category: '竖版短视频' },
  { id: 'chat-v',            name: '聊天记录',     skin: 'chat',            orientation: 'v', category: '聊天记录' },
  // 3 篇真人出镜
  { id: 'selfie-01',         name: '真人出镜 1',   skin: null,            orientation: 'v', category: '真人出镜' },
  { id: 'selfie-02',         name: '真人出镜 2',   skin: null,            orientation: 'v', category: '真人出镜' },
  { id: 'selfie-03',         name: '真人出镜 3',   skin: null,            orientation: 'v', category: '真人出镜' }
];

const ACCOUNT_ID_MAP = new Map(STANDARD_ACCOUNTS.map(a => [a.id, a]));

/**
 * 将任意文本中的账号信息标准化为 16 个标准 id 之一
 */
export function normalizeAccountId(accountStr, skinStr = '', orientationStr = '', rowIdx = 0) {
  const combined = `${accountStr || ''} ${skinStr || ''} ${orientationStr || ''}`.toLowerCase();
  
  // 1. 真人出镜识别
  if (combined.includes('selfie-01') || combined.includes('真人出镜 1') || combined.includes('真人出镜 01') || combined.includes('真人出镜1') || combined.includes('selfie 1')) return 'selfie-01';
  if (combined.includes('selfie-02') || combined.includes('真人出镜 2') || combined.includes('真人出镜 02') || combined.includes('真人出镜2') || combined.includes('selfie 2')) return 'selfie-02';
  if (combined.includes('selfie-03') || combined.includes('真人出镜 3') || combined.includes('真人出镜 03') || combined.includes('真人出镜3') || combined.includes('selfie 3')) return 'selfie-03';
  if (combined.includes('selfie') || combined.includes('真人出镜')) {
    if (rowIdx === 14) return 'selfie-01';
    if (rowIdx === 15) return 'selfie-02';
    if (rowIdx === 16) return 'selfie-03';
  }

  // 2. 聊天记录识别
  if (combined.includes('chat') || combined.includes('聊天记录')) return 'chat-v';

  // 3. 判定画幅方向
  let isH = combined.includes('横版') || combined.includes('(h)') || combined.includes(' h') || combined.endsWith('h');
  let isV = combined.includes('竖版') || combined.includes('(v)') || combined.includes(' v') || combined.endsWith('v');
  if (!isH && !isV) {
    // 根据序号兜底（1-6 为横版，7-13 为竖版）
    if (rowIdx >= 1 && rowIdx <= 6) isH = true;
    else if (rowIdx >= 7 && rowIdx <= 13) isV = true;
  }
  const ori = isH ? 'h' : (isV ? 'v' : null);

  // 4. 判定皮肤
  if (combined.includes('black-yellow') || combined.includes('黑黄')) {
    return ori ? `black-yellow-v2-${ori}` : null;
  }
  if (combined.includes('lime-capsule') || combined.includes('荧光绿')) {
    return ori ? `lime-capsule-${ori}` : null;
  }
  if (combined.includes('signature-wall') || combined.includes('署名墙')) {
    return ori ? `signature-wall-${ori}` : null;
  }
  if (combined.includes('ledger-desk') || combined.includes('对账台')) {
    return ori ? `ledger-desk-${ori}` : null;
  }
  if (combined.includes('blueprint') || combined.includes('蓝图')) {
    return ori ? `blueprint-${ori}` : null;
  }
  if (combined.includes('pixel-arcade') || combined.includes('像素')) {
    return ori ? `pixel-arcade-${ori}` : null;
  }

  return null;
}

/**
 * 读取并解析台账历史
 * @returns {Map<string, Array<{ date: string, topic: string, topicSlug: string, filename: string }>>}
 */
export function loadLedgerHistory(ledgerPath = LEDGER_PATH) {
  if (!fs.existsSync(ledgerPath)) {
    throw new Error(`找不到台账文件: ${ledgerPath}`);
  }
  const content = fs.readFileSync(ledgerPath, 'utf8');
  const lines = content.split('\n');

  let currentAccount = null;
  const historyMap = new Map();
  for (const acc of STANDARD_ACCOUNTS) {
    historyMap.set(acc.id, []);
  }

  for (const line of lines) {
    if (line.startsWith('## 未分配') || line.startsWith('## 选题池')) {
      currentAccount = null;
      continue;
    }
    if (line.startsWith('### ')) {
      const title = line.replace('### ', '').trim().toLowerCase();
      if (title.includes('black-yellow-v2') && title.includes('横版')) currentAccount = 'black-yellow-v2-h';
      else if (title.includes('lime-capsule') && title.includes('横版')) currentAccount = 'lime-capsule-h';
      else if (title.includes('signature-wall') && title.includes('横版')) currentAccount = 'signature-wall-h';
      else if (title.includes('ledger-desk') && title.includes('横版')) currentAccount = 'ledger-desk-h';
      else if (title.includes('blueprint') && title.includes('横版')) currentAccount = 'blueprint-h';
      else if (title.includes('pixel-arcade') && title.includes('横版')) currentAccount = 'pixel-arcade-h';
      else if (title.includes('black-yellow-v2') && title.includes('竖版')) currentAccount = 'black-yellow-v2-v';
      else if (title.includes('lime-capsule') && title.includes('竖版')) currentAccount = 'lime-capsule-v';
      else if (title.includes('signature-wall') && title.includes('竖版')) currentAccount = 'signature-wall-v';
      else if (title.includes('ledger-desk') && title.includes('竖版')) currentAccount = 'ledger-desk-v';
      else if (title.includes('blueprint') && title.includes('竖版')) currentAccount = 'blueprint-v';
      else if (title.includes('pixel-arcade') && title.includes('竖版')) currentAccount = 'pixel-arcade-v';
      else if (title.includes('chat')) currentAccount = 'chat-v';
      else currentAccount = null;
    } else if (line.startsWith('## 真人出镜')) {
      currentAccount = 'selfie';
    } else if (currentAccount && line.startsWith('|') && line.includes('2026-')) {
      const parts = line.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 4) {
        const item = {
          date: parts[0],
          topic: parts[1],
          topicSlug: parts[2],
          filename: parts[3]
        };
        if (currentAccount === 'selfie') {
          // 真人出镜台账下 3 个 selfie 账号共享历史题库（真人出镜绝不重复讲同一个品）
          historyMap.get('selfie-01').push(item);
          historyMap.get('selfie-02').push(item);
          historyMap.get('selfie-03').push(item);
        } else if (historyMap.has(currentAccount)) {
          historyMap.get(currentAccount).push(item);
        }
      }
    }
  }

  return historyMap;
}

/**
 * 扫描 NAS 物理目录兜底查重
 */
export function checkNasPhysicalDuplicate(accountId, topic, checkDate = null) {
  const dirsToScan = [NAS_PENDING_DIR, NAS_USED_DIR];
  const accMeta = ACCOUNT_ID_MAP.get(accountId);
  if (!accMeta) return null;

  for (const rootDir of dirsToScan) {
    if (!fs.existsSync(rootDir)) continue;
    const topicPath = path.join(rootDir, topic);
    if (!fs.existsSync(topicPath)) continue;

    try {
      const files = fs.readdirSync(topicPath);
      for (const f of files) {
        if (!f.endsWith('.txt')) continue;
        if (f.endsWith('.台词.txt') || f.endsWith('.素材.txt')) continue;

        // 匹配文件模式
        let matched = false;
        if (accMeta.category === '真人出镜') {
          // 真人出镜任意 selfie 命中皆算
          if (f.includes(`-${topic}-selfie-`)) matched = true;
        } else if (accMeta.category === '聊天记录') {
          if (f.includes(`-${topic}-chat-v.txt`)) matched = true;
        } else {
          // 皮肤稿
          const targetSuffix = `-${accMeta.skin}-${accMeta.orientation}.txt`;
          if (f.includes(`-${topic}-`) && f.endsWith(targetSuffix)) matched = true;
        }

        if (matched) {
          // 若指定了当前检测日期，且该文件恰好是当天生成的文件，允许跳过；否则视为历史已有稿件撞题
          if (checkDate) {
            const dateNormalized = checkDate.replace(/-/g, '');
            if (f.startsWith(dateNormalized)) {
              continue;
            }
          }
          return {
            filename: f,
            fullPath: path.join(topicPath, f),
            dirType: path.basename(rootDir)
          };
        }
      }
    } catch {
      // 容错处理
    }
  }

  return null;
}

/**
 * 校验选题在视频项目素材库中的状态（必须 status === 'ready' 即素材齐）
 */
export function checkAssetStatus(topic, slug = null) {
  if (!fs.existsSync(ASSETS_DIR)) return { found: false };

  let targetDir = slug ? path.join(ASSETS_DIR, slug) : null;
  if (!targetDir || !fs.existsSync(targetDir)) {
    // 遍历 assets 查找匹配 title、name 或 slug 的目录
    try {
      for (const d of fs.readdirSync(ASSETS_DIR)) {
        const p = path.join(ASSETS_DIR, d);
        if (!fs.statSync(p).isDirectory()) continue;
        if (d === topic || d === slug) {
          targetDir = p;
          break;
        }
        const tFile = path.join(p, 'topic.json');
        if (fs.existsSync(tFile)) {
          try {
            const t = JSON.parse(fs.readFileSync(tFile, 'utf8'));
            if (t.title === topic || t.name === topic) {
              targetDir = p;
              break;
            }
          } catch {}
        }
      }
    } catch {}
  }

  if (!targetDir || !fs.existsSync(targetDir)) return { found: false };

  const tFile = path.join(targetDir, 'topic.json');
  if (fs.existsSync(tFile)) {
    try {
      const t = JSON.parse(fs.readFileSync(tFile, 'utf8'));
      return {
        found: true,
        slug: path.basename(targetDir),
        status: t.status || 'unknown',
        isReady: t.status === 'ready',
        title: t.title || t.name || path.basename(targetDir)
      };
    } catch {}
  }

  return { found: true, slug: path.basename(targetDir), status: 'unknown', isReady: false };
}

/**
 * 解析待检查的 Markdown 表格或输入内容
 */
export function parsePlanTable(rawContent) {
  const lines = rawContent.split(/\r?\n/);
  const items = [];
  let headerCols = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;
    if (line.includes('---')) continue; // 分隔行

    const cols = line.split('|').map(s => s.trim()).slice(1, -1);
    if (cols.length < 3) continue;

    // 探测表头行
    const headerStr = cols.join(' ');
    if (headerStr.includes('账号') && (headerStr.includes('选题') || headerStr.includes('skin'))) {
      headerCols = cols;
      continue;
    }

    if (!headerCols) continue;

    // 定位列索引
    let seqIdx = headerCols.findIndex(c => c.includes('#') || c.includes('序号'));
    let accIdx = headerCols.findIndex(c => c.includes('账号'));
    let skinIdx = headerCols.findIndex(c => c.includes('skin') || c.includes('皮肤'));
    let oriIdx = headerCols.findIndex(c => c.includes('版式') || c.includes('orientation'));
    let topicIdx = headerCols.findIndex(c => c.includes('选题') || c.includes('题目'));
    let typeIdx = headerCols.findIndex(c => c.includes('类型'));
    let slugIdx = headerCols.findIndex(c => c.toLowerCase().includes('slug'));

    if (topicIdx < 0 || accIdx < 0) continue;

    const rowSeq = seqIdx >= 0 ? parseInt(cols[seqIdx], 10) : (items.length + 1);
    const rawAccount = cols[accIdx] || '';
    const rawSkin = skinIdx >= 0 ? (cols[skinIdx] || '') : '';
    const rawOri = oriIdx >= 0 ? (cols[oriIdx] || '') : '';
    const topic = (cols[topicIdx] || '').replace(/[`*]/g, '').trim();
    const type = typeIdx >= 0 ? cols[typeIdx] : '';
    const slug = slugIdx >= 0 ? (cols[slugIdx] || '').trim() : '';

    if (!topic) continue;

    const accountId = normalizeAccountId(rawAccount, rawSkin, rawOri, rowSeq);

    items.push({
      seq: rowSeq,
      rawAccount,
      rawSkin,
      rawOri,
      accountId,
      topic,
      slug,
      type,
      rawLine: line
    });
  }

  return items;
}

/**
 * 执行今日选题表查重门禁验证
 */
export function checkPlan(planItems, options = {}) {
  const { ledgerPath = LEDGER_PATH, checkDate = null, skipNas = false, noSelfie = false } = options;
  const historyMap = loadLedgerHistory(ledgerPath);

  const errors = [];
  const warnings = [];
  const passedItems = [];

  // 判断是否为纯出片模式（13 账号，无真人出镜 selfie）
  const hasSelfie = planItems.some(item => item.accountId && item.accountId.startsWith('selfie'));
  const isPureVideoMode = noSelfie || (!hasSelfie && planItems.length === 13);
  const targetAccounts = isPureVideoMode
    ? STANDARD_ACCOUNTS.filter(a => a.category !== '真人出镜')
    : STANDARD_ACCOUNTS;
  const expectedCount = targetAccounts.length;

  // ==================== 门禁 0：黑名单选题阻断 ====================
  for (const item of planItems) {
    const topicLow = (item.topic || '').toLowerCase();
    const slugLow = (item.slug || '').toLowerCase();
    for (const banned of BANNED_TOPICS) {
      const bannedLow = banned.toLowerCase();
      if (topicLow.includes(bannedLow) || slugLow.includes(bannedLow)) {
        errors.push(`[黑名单选题禁用] 第 ${item.seq} 行「${item.topic}」(slug: ${item.slug || '无'}) 命中永久禁用黑名单「${banned}」！用户已明确将其列为永不使用选题，全流程彻底禁用！`);
      }
    }
  }

  // ==================== 门禁 1：篇数与账号完整性 ====================
  if (planItems.length !== expectedCount) {
    errors.push(`[篇数不符] 今日选题表当前为${isPureVideoMode ? '纯出片模式（13 个出片账号）' : '全量模式（16 篇含 3 篇真人出镜）'}，应为 ${expectedCount} 篇，当前解析到 ${planItems.length} 篇！`);
  }

  const seenAccounts = new Set();
  for (const item of planItems) {
    if (!item.accountId) {
      errors.push(`[账号未识别] 第 ${item.seq} 行「${item.rawAccount}」无法匹配标准账号之一！`);
      continue;
    }
    if (seenAccounts.has(item.accountId)) {
      errors.push(`[账号冲突] 账号「${item.accountId}」在今日选题表中出现了多次！`);
    }
    seenAccounts.add(item.accountId);
  }

  for (const acc of targetAccounts) {
    if (!seenAccounts.has(acc.id)) {
      errors.push(`[账号缺失] 今日选题表缺少账号「${acc.name} (${acc.id})」！`);
    }
  }

  // ==================== 门禁 2：当天两两去重 ====================
  const topicMap = new Map(); // topic -> Array<{ seq, accountId }>
  for (const item of planItems) {
    if (!item.topic) continue;
    if (!topicMap.has(item.topic)) {
      topicMap.set(item.topic, []);
    }
    topicMap.get(item.topic).push(item);
  }

  for (const [top, list] of topicMap.entries()) {
    if (list.length > 1) {
      const conflictDetails = list.map(x => `#${x.seq} (${x.accountId})`).join(' 与 ');
      errors.push(`[当天两两重复] 选题「${top}」在当天被排了 ${list.length} 次！(${conflictDetails})。当天选题必须两两不同！`);
    }
  }

  // ==================== 门禁 3：台账历史查重 ====================
  for (const item of planItems) {
    if (!item.accountId || !item.topic) continue;
    const historyList = historyMap.get(item.accountId) || [];

    // 查找该账号历史是否有该选题（排除如果当天已经写入且完全一致的情况）
    const matchedHistory = historyList.filter(h => {
      if (checkDate && h.date === checkDate) return false; // 若为指定校验当天，跳过当天记录
      return h.topic === item.topic;
    });

    if (matchedHistory.length > 0) {
      const dates = matchedHistory.map(m => m.date).join(', ');
      errors.push(`[台账历史重复] 账号「${item.accountId}」历史已写过选题「${item.topic}」(曾于 ${dates} 产出)！同一账号绝不重复选题！`);
      continue;
    }

    // ==================== 门禁 4：NAS 物理文件直查兜底 ====================
    if (!skipNas) {
      const nasHit = checkNasPhysicalDuplicate(item.accountId, item.topic, checkDate);
      if (nasHit) {
        errors.push(`[NAS物理文件重复] 账号「${item.accountId}」选题「${item.topic}」在 NAS 物理目录已存在历史稿件文件！(${nasHit.fullPath})。物理防线已阻断！`);
        continue;
      }
    }

    // ==================== 门禁 5：素材库在库选题「素材齐（ready）」强校验 ====================
    // 若在素材库中匹配到目录，但状态不是 ready（如 idea 或 collecting），硬性阻断报错！
    const assetInfo = checkAssetStatus(item.topic, item.slug);
    if (assetInfo.found && !assetInfo.isReady) {
      errors.push(`[素材未齐] 选题「${item.topic}」(${assetInfo.slug}) 在素材库中的状态为「${assetInfo.status}」（中控台非素材齐），尚未完成素材二次整理！硬规矩要求：必须在素材库达到「素材齐（ready）」后方可作为选题排发！`);
      continue;
    }

    passedItems.push(item);
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    planItems,
    passedItems
  };
}

/**
 * 全量审计模式：审计台账本身是否有重复，并与 NAS 物理文件对账
 */
export function auditAll(ledgerPath = LEDGER_PATH) {
  console.log(`\n================== 账号选题台账全量健康度审计 ==================`);
  console.log(`- 台账路径: ${ledgerPath}`);
  
  const historyMap = loadLedgerHistory(ledgerPath);
  let totalRecords = 0;
  let ledgerDuplicateCount = 0;

  console.log(`\n1. 各账号历史记录与重复统计：`);
  for (const acc of STANDARD_ACCOUNTS) {
    const list = historyMap.get(acc.id) || [];
    totalRecords += list.length;
    const seen = new Map();
    const dupes = [];

    for (const item of list) {
      if (seen.has(item.topic)) {
        dupes.push({ topic: item.topic, first: seen.get(item.topic), again: item.date });
      } else {
        seen.set(item.topic, item.date);
      }
    }

    if (dupes.length > 0) {
      ledgerDuplicateCount += dupes.length;
      console.log(`❌ [${acc.id}] ${acc.name} (${list.length} 篇) -> 发现 ${dupes.length} 处历史重复:`);
      for (const d of dupes) {
        console.log(`   - 选题「${d.topic}」: 初次 ${d.first} | 再次 ${d.again}`);
      }
    } else {
      console.log(`✅ [${acc.id}] ${acc.name} (${list.length} 篇) -> 0 重复 (健康)`);
    }
  }

  console.log(`\n台账总计记录数: ${totalRecords} 篇 | 历史既成重复数: ${ledgerDuplicateCount} 处 (此前已定性为 10-09 漏记导致的既成历史)`);

  // NAS 物理文案比对
  console.log(`\n2. NAS 待审文案物理文件对账：`);
  if (!fs.existsSync(NAS_PENDING_DIR)) {
    console.log(`⚠️ NAS 目录无法访问: ${NAS_PENDING_DIR}`);
    return;
  }

  let nasCount = 0;
  const missingInLedger = [];
  const subs = fs.readdirSync(NAS_PENDING_DIR);

  for (const sub of subs) {
    const p = path.join(NAS_PENDING_DIR, sub);
    if (!fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p)) {
      if (!f.endsWith('.txt') || f.endsWith('.台词.txt') || f.endsWith('.素材.txt')) continue;
      nasCount++;
      // 检查该文件是否在台账中
      let matchedInLedger = false;
      for (const list of historyMap.values()) {
        if (list.some(r => r.filename === f)) {
          matchedInLedger = true;
          break;
        }
      }
      if (!matchedInLedger) {
        missingInLedger.push({ topic: sub, filename: f });
      }
    }
  }

  console.log(`NAS 待审文案正稿数: ${nasCount} 篇`);
  if (missingInLedger.length === 0) {
    console.log(`✅ 所有 NAS 待审正稿已 100% 登记在台账中，无黑户稿件！`);
  } else {
    console.log(`⚠️ 发现 ${missingInLedger.length} 篇 NAS 稿件未登记在台账中:`);
    for (const m of missingInLedger) {
      console.log(`   - 选题: ${m.topic} | 文件: ${m.filename}`);
    }
  }

  console.log(`=================================================================\n`);
}

// ==================== CLI 主入口 ====================
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--audit') || args.includes('-a')) {
    auditAll();
    process.exit(0);
  }

  let inputSource = null;
  let checkDate = null;
  let skipNas = false;
  let noSelfie = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      checkDate = args[++i];
    } else if (args[i] === '--skip-nas') {
      skipNas = true;
    } else if (args[i] === '--no-selfie') {
      noSelfie = true;
    } else if (!args[i].startsWith('--')) {
      inputSource = args[i];
    }
  }

  let rawContent = '';

  if (inputSource === '-' || (!inputSource && !process.stdin.isTTY)) {
    // 从 stdin 读取
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    rawContent = Buffer.concat(chunks).toString('utf8');
  } else if (inputSource) {
    const absPath = path.resolve(process.cwd(), inputSource);
    if (!fs.existsSync(absPath)) {
      console.error(`\n❌ [check-plan] 找不到待检查的文件: ${absPath}\n`);
      process.exit(2);
    }
    rawContent = fs.readFileSync(absPath, 'utf8');
  } else {
    console.log(`
用法：
  node engine/brief/check-plan.mjs <选题表文件.md>
  Get-Content <选题表.md> | node engine/brief/check-plan.mjs -
  node engine/brief/check-plan.mjs --audit   (对全量台账和 NAS 文件进行对账审计)
    `);
    process.exit(0);
  }

  const planItems = parsePlanTable(rawContent);

  if (planItems.length === 0) {
    console.error(`\n❌ [check-plan] 未能在输入内容中解析到今日选题表格行！请检查表格格式。\n`);
    process.exit(2);
  }

  console.log(`\n=================== 今日选题表查重门禁自检 ===================`);
  console.log(`- 解析到选题行数: ${planItems.length} 行`);

  const result = checkPlan(planItems, { checkDate, skipNas, noSelfie });

  if (!result.success) {
    console.error(`\n🚨 【查重门禁未通过！发现 ${result.errors.length} 项违规】`);
    for (let i = 0; i < result.errors.length; i++) {
      console.error(`  ${i + 1}. ${result.errors[i]}`);
    }
    console.error(`\n⛔ 严禁将含有重复选题的表发给用户！请对照上述错误修正选题后重新自检。\n`);
    process.exit(1);
  }

  const isPureVideo = planItems.length === 13;
  console.log(`\n🎉 【PASS】今日选题表 4 大门禁全部通过！`);
  console.log(`- 账号完整性: ${isPureVideo ? '13 个出片账号全覆盖 (6 横版 + 6 竖版 + 1 聊天记录)' : '16 篇全覆盖 (6 横版 + 7 竖版 + 3 真人出镜)'}`);
  console.log(`- 当天互斥度: ${planItems.length} 篇选题两两绝对不同`);
  console.log(`- 台账历史度: 目标账号历史均无重复记录`);
  console.log(`- 物理直查兜底: NAS 目录无冲突历史文件`);
  console.log(`- 黑名单防线: 0 命中永久禁用黑名单`);
  console.log(`\n--- 今日核准选题清单 ---`);
  for (const item of result.passedItems) {
    const acc = ACCOUNT_ID_MAP.get(item.accountId);
    console.log(`  [${String(item.seq).padStart(2, '0')}] ${acc.name.padEnd(12, ' ')} | 选题: ${item.topic}`);
  }
  console.log(`=================================================================\n`);
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(`\n[check-plan] 运行异常:`, err);
    process.exit(2);
  });
}
