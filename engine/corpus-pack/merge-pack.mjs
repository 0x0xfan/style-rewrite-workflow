#!/usr/bin/env node
// 合并五份真人语料包分表 → docs/真人语料包/总表.json + 总表.md
// 用法：node engine/corpus-pack/merge-pack.mjs [--dump <dir>]
//   --dump 把待人工复核的清单（场景 E 粗分、效果倍数候选、收入数字候选、立场候选、品类改判）写到目录里
// 人工裁定放在同目录 manual-overrides.json（子场景、立场、效果倍数保留/追加删除、收入数字改判）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PACK_DIR = path.join(ROOT, 'docs', '真人语料包');
const PARTS = [
  ['part-1', 'part-1.md'],
  ['part-2', 'part-2.md'],
  ['part-3', 'part-3.md'],
  ['part-4', 'part-4.md'],
  ['part-5', 'part-5-圣矾本人.md'],
];
const OVERRIDES_PATH = path.join(__dirname, 'manual-overrides.json');
const overrides = fs.existsSync(OVERRIDES_PATH)
  ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'))
  : { subscene: {}, stance: {}, effectKeep: [], effectDelete: [], incomeTrue: [], incomeFalse: [], categoryOverride: {} };

const args = process.argv.slice(2);
const dumpDir = args.includes('--dump') ? args[args.indexOf('--dump') + 1] : null;

// ---------- 1. 防审查写法还原（做法 8） ----------
// 顺序有讲究：长的先换。每条 [正则, 替换, 说明]
const DECENSOR = [
  [/流💧/g, '流量', '流💧→流量'],
  [/限💧/g, '限流', '限💧→限流'],
  [/💧/g, '流量', '💧→流量'],
  [/🔗/g, '链接', '🔗→链接'],
  [/💰/g, '钱', '💰→钱'],
  [/lian接/g, '链接', 'lian接→链接'],
  [/L接/g, '链接', 'L接→链接'],
  [/one件dai发/g, '一件代发', 'one件dai发→一件代发'],
  [/P台/g, '平台', 'P台→平台'],
  [/D铺/g, '店铺', 'D铺→店铺'],
  [/quan重/g, '权重', 'quan重→权重'],
  [/Q重/g, '权重', 'Q重→权重'],
  [/bao光/g, '曝光', 'bao光→曝光'],
  [/bao了/g, '爆了', 'bao了→爆了'],
  [/liu量/g, '流量', 'liu量→流量'],
  [/琉liang/g, '流量', '琉liang→流量'],
  [/限liu/g, '限流', '限liu→限流'],
  [/feng控/g, '风控', 'feng控→风控'],
  [/feng/g, '封', 'feng→封'],
  [/Qin Quan/g, '侵权', 'Qin Quan→侵权'],
  [/题cheng|题成/g, '提成', '题cheng/题成→提成'],
  [/Li闰/g, '利润', 'Li闰→利润'],
  [/贝兼/g, '赚', '贝兼→赚'],
  [/([一-鿿])L[iI](?![a-zA-Z])/g, '$1利', 'Li→利'],
  [/L[iI]([一-鿿])/g, '利$1', 'Li→利'],
  [/([一-鿿\d])dan(?![a-zA-Z])/g, '$1单', 'dan→单'],
  [/dan([一-鿿])/g, '单$1', 'dan→单'],
  [/低jian选/g, '低价选', '低jian→低价'],
  [/低jia/g, '低价', 'jia→价'],
  [/([一-鿿])jia(?![a-zA-Z])/g, '$1价', 'jia→价'],
  [/下zhu祈/g, '下注祈', 'zhu→注'],
  [/活物gua了/g, '活物挂了', 'gua→挂'],
  [/证ban的/g, '证办的', 'ban→办'],
  [/前ke的/g, '前科的', 'ke→科'],
  [/从liang了/g, '从良了', 'liang→良'],
  [/wu点/g, '污点', 'wu→污'],
  [/拉hei/g, '拉黑', 'hei→黑'],
  [/mai卖/g, '买卖', 'mai→买'],
  [/运ying/g, '运营', 'ying→营'],
  [/kou"1"/g, '扣"1"', 'kou→扣'],
  [/kou1/g, '扣1', 'kou→扣'],
  [/F图/g, '副图', 'F图→副图'],
  [/微马扁/g, '微骗', '马扁→骗'],
  [/马扁/g, '骗', '马扁→骗'],
  [/红现/g, '红线', '红现→红线'],
  [/板权/g, '版权', '板权→版权'],
  [/年茹/g, '年入', '年茹→年入'],
  [/2yi/g, '2亿', '2yi→2亿'],
];
const decensorStats = new Map();
function decensor(s) {
  if (!s) return s;
  let out = s;
  for (const [re, rep, label] of DECENSOR) {
    const n = (out.match(re) || []).length;
    if (n) {
      decensorStats.set(label, (decensorStats.get(label) || 0) + n);
      out = out.replace(re, rep);
    }
  }
  return out;
}

// ---------- 2. 解析 markdown 表格 ----------
function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}
function parsePart(partName, file) {
  const text = fs.readFileSync(path.join(PACK_DIR, file), 'utf8');
  const lines = text.split(/\r?\n/);
  let h2 = '', h3 = '', header = null, layer = null;
  const out = { openings: [], sayings: [], voices: [], authorsRaw: [] };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^## /.test(line)) { h2 = line.replace(/^## /, ''); h3 = ''; header = null;
      layer = /开头层/.test(h2) ? 'openings' : /说法层/.test(h2) ? 'sayings' : /原声层/.test(h2) ? 'voices' : /作者档案/.test(h2) ? 'authors' : null;
      continue; }
    if (/^### /.test(line)) { h3 = line.replace(/^### /, ''); header = null; continue; }
    if (!line.startsWith('|')) { header = null; continue; }
    if (!layer) continue;
    const cells = splitRow(line);
    if (!header) { header = cells; continue; }
    if (/^:?-+:?$/.test(cells[0])) continue;
    if (cells.length !== header.length) throw new Error(`${file}:${i + 1} 列数不对 ${cells.length}≠${header.length}`);
    const row = {}; header.forEach((h, k) => { row[h] = cells[k]; });
    row.__line = i + 1;
    if (layer === 'openings') out.openings.push(row);
    else if (layer === 'sayings') { const m = h3.match(/场景\s*([A-J])/); row.__scene = m ? m[1] : '?'; out.sayings.push(row); }
    else if (layer === 'voices') out.voices.push(row);
    else if (layer === 'authors') { row.__header = header; out.authorsRaw.push(row); }
  }
  return out;
}

// ---------- 3. 字段规整 ----------
function normAuthor(a) {
  if (!a) return a;
  let s = a.replace(/（.*$/, '').replace(/\(.*$/, '').trim();
  if (/^百万\*/.test(s)) return '阿拉丁';
  if (s === '圣矾') return '圣矾本人';
  if (s === 'KK') return '猫KK';
  return s;
}
function authorFromId(id) {
  const m = id.match(/^K-(?:开头|说-[A-J]|声)-(.+?)-\d+(\*?)$/);
  if (!m) return null;
  return m[2] === '*' ? '阿拉丁' : normAuthor(m[1]);
}
function normCategory(c) {
  const s = (c || '').trim();
  const base = s.replace(/[（(].*$/, '').trim();
  const note = s.length > base.length ? s.slice(base.length).replace(/^[（(]|[）)]$/g, '') : '';
  return [base || '通用', note];
}
function normSpoken(c) {
  const s = (c || '').trim();
  let base = '？';
  if (s.startsWith('✅')) base = '✅';
  else if (s.startsWith('图文腔')) base = '图文腔';
  else if (/^[？?]/.test(s)) base = '？';
  else base = s;
  const note = s.replace(/^(✅|图文腔|[？?])\s*/, '').replace(/^[（(]|[）)]$/g, '');
  return [base, note];
}
function normSteps(s) {
  const m = (s || '').match(/\d+/);
  return [m ? Number(m[0]) : null, /压缩/.test(s || '')];
}
function fixArticle(a) {
  const s = (a || '').trim();
  if (!s) return s;
  return /^《/.test(s) ? s : `《${s}》`;
}
function fixSource(src) {
  return (src || '').replace(/^百万\*/, '阿拉丁').replace(/^圣矾本人/, '圣矾本人');
}

// ---------- 4. 判定规则 ----------
const PHYS_WORDS = ['七天无理由退货', '七天无理由', '7天无理由', '运费险', '退货', '运费', '快递', '物流', '品控', '面单', '囤货', '包邮', '签收', '破损', '发货慢', '补发', '瑕疵', '碎了', '裂了', '色差', '到货', '收货', '邮费', '现货', '进货', '批发', '拿货', '样品', '验货', '自提', '退换', '包装', '运输', '次品', '划痕', '漏气', '材质', '做工', '易碎', '易损', '重货', '大件', '桌子', '冰柜', '手机壳']; // 2026-09-08 主线程把一看就是实物的线索词升为判定词
const NEG = /(不|没|无|别|免|非|零|勿)/;
// 不在用户词表里、但一看就是实物场景的词：只作线索（实物线索字段 + 报告），不改品类
const PHYS_HINT = ['瑕疵', '碎了', '裂了', '摔', '规格', '尺寸', '色差', '发货', '到货', '收货', '收到货', '邮费', '库存', '现货', '进货', '批发', '拿货', '样品', '验货', '自提', '退换', '包装', '运输', '装卸', '桌子', '冰柜', '手机壳', '次品', '划痕', '漏气', '材质', '做工', '易碎', '易损', '重货', '大件'];
function physHints(text) { const t = text || ''; return PHYS_HINT.filter((w) => t.includes(w)); }
// 返回 {hits:[{w,neg}], phys:boolean}
function judgePhysical(text) {
  const hits = [];
  const t = text || '';
  for (const w of PHYS_WORDS) {
    let idx = 0;
    while ((idx = t.indexOf(w, idx)) !== -1) {
      const before = t.slice(Math.max(0, idx - 4), idx);
      hits.push({ w, neg: NEG.test(before) });
      idx += w.length;
    }
  }
  return { hits, phys: hits.some((h) => !h.neg) };
}

const EFFECT_RE = [
  /翻(了)?(一|两|几|[0-9]+)?(倍|番)/,
  /(差|高|涨|多|快|低|少|贵|强|大|长|提升|提高|增长|增加|下降|降低|减少|翻|是|出|有)[了出到]?\s*(不下于|不止|将近|接近|近|约|大概|好几|几|数|[0-9]+|[一二两三四五六七八九十百千]+)\s*倍/,
  /[0-9一二两三四五六七八九十]+\s*倍/,
  /(涨|升|提|降|掉|增|减|长)了?\s*[一二两三四五六七八九十几0-9]+\s*成/,
  /从\s*[0-9一二两三四五六七八九十百千万几]+[^，。；！？]{0,6}?(干|拉|涨|升|提|降|掉|做|冲|变|跌|干)到\s*[0-9一二两三四五六七八九十百千万几]/,
  /[0-9一二两三四五六七八九十百千万几]+\s*[wW%个]?\s*(拉|涨|升|提|降|掉|冲|跌)到\s*[0-9一二两三四五六七八九十百千万几]/,
  /(曝光|流量|咨询|转化率?|成交|销量|访客|点击)[^，。；！？]{0,8}(破万|翻|暴涨|飙|上万|直接破)/,
];
function effectCandidate(text) {
  for (const re of EFFECT_RE) { const m = (text || '').match(re); if (m) return m[0]; }
  return null;
}

const NUM = '(?:[0-9０-９]+(?:[.,，][0-9]+)?|[一二两三四五六七八九十百千万亿几]+)';
const INCOME_RE = [
  new RegExp(`(赚|挣|收入|收益|利润|净利|净赚|到手|月入|日入|年入|营收|销售额|变现|成交额|流水|入账|进账|回本|GMV|挣了|卖了|赚了|盈利)[^，。；！？"”]{0,10}?${NUM}\\s*(块|元|万|w|W|k|K|位数|百|千|个w|个W)`),
  new RegExp(`${NUM}\\s*(块|元|万|w|W|k|K)[^，。；！？"”]{0,4}?(的)?(利润|收入|收益|净利|纯利|到手|流水|营收|提成)`),
  /(月入|日入|年入|月过|月赚|日赚|年赚|月挣|日挣|年挣)\s*(过|破|上|超)?\s*[0-9一二两三四五六七八九十百千万几wWkK]+/,
  new RegExp(`(一单|一件|一份|一天|一个月|每天|每月|一年|半年|这个月|上个月|本月)[^，。；！？"”]{0,6}?(赚|挣|利润|收入|收益|净赚|到手|纯利)[^，。；！？"”]{0,4}?${NUM}`),
  /(六位数|七位数|五位数|六位数)/,
];
function incomeCandidate(text) {
  for (const re of INCOME_RE) { const m = (text || '').match(re); if (m) return m[0]; }
  return null;
}

// 场景 E 子场景粗分（关键词打分；人工裁定在 manual-overrides.json 的 subscene 里）
const SUBSCENE_KW = {
  '风险与合规': ['封号', '违规', '风控', '合规', '规则', '新规', '举报', '侵权', '版权', '违禁', '审核', '限流', '骗子', '骗', '套路', '被封', '禁', '申诉', '处罚', '账号安全', '资质', '执照', '报税', '发票', '红线', '拉黑区', '高危', '雷', '坑', '灰产', '站外', '引流'],
  '客服与成交': ['客户', '买家', '客服', '回复', '回消息', '话术', '聊天', '咨询', '成交', '砍价', '议价', '讲价', '好评', '差评', '退款', '售后', '拒绝', '拉黑', '响应', '转化', '订单', '下单', '成交率', '还价', '沟通', '答复'],
  '选品判断': ['选品', '品类', '类目', '货源', '厂家', '拿货', '一件代发', '同行', '需求', '市场', '冷门', '爆款', '利润空间', '复购', '供应链', '批发', '拼多多', '1688', '测品', '孤品', '竞争', '蓝海', '红海', '产品', '这个品', '重货', '小件', '标品', '非标', '进货', '产地', '刚需', '信息差'],
  '上架与文案': ['标题', '主图', '文案', '详情页', '详情', '关键词', '图片', '拍图', '描述', '卖点', 'SKU', '实拍', '图', '发布', '标签', '价格带', '定价', '标价', '一口价', '定位'],
  '动作': ['先干', '干就完了', '先做', '开始', '行动', '每天', '每日', '上架', '执行', '动手', '开店', '注册', '养号', '设备', '手机', '网络', 'WiFi', '流量卡', '擦亮', '上下架', '下架', '链接', '曝光', '权重', '账号', '店铺', '多店', '铺品', '铺店', '裂变', '起步', '第一步', '一步', '测试', '复盘', '数据', '时间', '小时', '做起来', '去做', '学'],
  '心态': ['坚持', '别急', '着急', '急', '贪', '放弃', '心态', '焦虑', '耐心', '慢慢', '沉下心', '熬', '一夜暴富', '暴富', '躺赚', '轻松', '鸡血', '怕', '信心', '稳', '三个月', '半年', '周期', '正反馈', '大钱', '小钱', '风口', '捷径', '积累', '长期', '努力', '成功', '失败', '借口', '梦', '相信', '认真', '踏实', '不想', '想太多', '犹豫', '拖', '副业', '上班', '打工', '自由', '人生', '赚钱', '挣钱', '心', '内向', '社恐', '性格', '适合', '人'],
};
const SUBSCENE_ORDER = ['风险与合规', '客服与成交', '选品判断', '上架与文案', '动作', '心态'];
function coarseSubscene(text) {
  const scores = {};
  for (const [k, words] of Object.entries(SUBSCENE_KW)) {
    let s = 0;
    for (const w of words) { const n = text.split(w).length - 1; if (n) s += n * (w.length >= 2 ? 2 : 1); }
    scores[k] = s;
  }
  let best = '其他', bestScore = 0;
  for (const k of SUBSCENE_ORDER) { if (scores[k] > bestScore) { best = k; bestScore = scores[k]; } }
  return best;
}

function dedupeKey(s) {
  return (s || '').replace(/[\p{P}\p{S}\s]/gu, '').replace(/咸鱼/g, '闲鱼');
}

// ---------- 5. 主流程 ----------
const stats = { before: {}, after: {}, dedupe: [], effectDeleted: [], categoryChanged: [], incomeSayings: [], virtualWithPhys: [], colMismatch: [] };
const openings = [], sayings = [], voices = [], authorsBlocks = [];

for (const [partName, file] of PARTS) {
  const p = parsePart(partName, file);
  stats.before[partName] = { openings: p.openings.length, sayings: p.sayings.length, voices: p.voices.length, authors: p.authorsRaw.length };

  for (const r of p.openings) {
    const id = r['编号'];
    const [steps, compress] = normSteps(r['原文句数'] ?? r['步数']);
    const [cat, catNote] = normCategory(r['品类']);
    const structure = decensor(r['结构：每句干什么（⓪ = 自报家门的位置）'] ?? r['结构：每句干什么（⓪ = 自报家门位置）'] ?? r['结构：每句干什么（⓪ = 合同句位置）'] ?? Object.entries(r).find(([k]) => k.startsWith('结构'))?.[1] ?? '');
    openings.push({
      id, 切入方式: r['切入方式'], 结构: structure, 步数: steps, 口播要压缩: compress,
      适合: r['适合讲什么'], 品类: cat, 品类_分表原标: cat, 品类_注: catNote || undefined,
      作者: authorFromId(id), 出处: fixSource(r['出处']), 用过的期: [], 来源分表: partName,
    });
  }

  for (const r of p.sayings) {
    const id = r['编号'];
    const raw = r['原句'];
    const restored = decensor(raw);
    let author, article;
    if (r['作者'] !== undefined) { author = normAuthor(r['作者']); article = fixArticle(r['文章']); }
    else { const m = (r['出处'] || '').match(/^([^《]+)(《.*)$/); author = normAuthor(m ? m[1].trim() : r['出处']); article = m ? m[2].trim() : ''; }
    if (/\*$/.test(id)) author = '阿拉丁';
    const [cat, catNote] = normCategory(r['品类']);
    const [spoken, spokenNote] = normSpoken(r['口播']);
    const e = {
      id, 原句: restored, 作者: author, 文章: article, 场景: r.__scene,
      亲历: (r['亲历'] ?? r['亲历标记'] ?? '').replace(/（.*$/, ''),
      品类: cat, 品类_分表原标: cat, 品类_注: catNote || undefined,
      口播: spoken, 口播_注: spokenNote || undefined,
      含收入数字: false, 用过的期: [], 来源分表: partName,
    };
    if (restored !== raw) e.原句_原样 = raw;
    sayings.push(e);
  }

  for (const r of p.voices) {
    const id = r['编号'];
    const raw = r['原句'];
    const restored = decensor(raw);
    const [cat, catNote] = normCategory(r['品类'] ?? '通用');
    const e = {
      id, 谁说的: r['谁说的'], 原句: restored, 情境: decensor(r['情境']), 品类: cat, 品类_分表原标: cat, 品类_注: catNote || undefined,
      出处: fixSource(r['出处']), 含收入数字: false, 来源分表: partName,
    };
    if (restored !== raw) e.原句_原样 = raw;
    voices.push(e);
  }

  // 作者档案
  if (partName === 'part-5') {
    const lines = p.authorsRaw.map((r) => `${r['项']}：${r['内容']}`);
    authorsBlocks.push({ 作者: '圣矾本人', 来源分表: partName, 栏目: Object.fromEntries(p.authorsRaw.map((r) => [r['项'], r['内容']])), 档案: lines.join('\n') });
  } else {
    for (const r of p.authorsRaw) {
      const name = normAuthor(r['作者']);
      const cols = r.__header.filter((h) => h !== '作者');
      const 栏目 = Object.fromEntries(cols.map((h) => [h, r[h]]));
      authorsBlocks.push({ 作者: name, 作者_原写法: r['作者'] !== name ? r['作者'] : undefined, 来源分表: partName, 栏目, 档案: cols.map((h) => `${h}：${r[h]}`).join('\n') });
    }
  }
}

// ---- 编号撞车：同一作者在两份分表里各自从 01 编起（一鱼 / 韩九 / 凯迪 / 远方哥 在 part-4 重编）。
// 规则：按"编号去掉末尾序号"分组，组内出现多于一份分表的，非首份的全部条目编号后缀 ·pN，原编号另存。
{
  const groups = new Map();
  for (const e of [...openings, ...sayings, ...voices]) {
    const stem = e.id.replace(/-\d+\*?$/, '');
    if (!groups.has(stem)) groups.set(stem, new Set());
    groups.get(stem).add(e.来源分表);
  }
  stats.idSuffixed = [];
  for (const e of [...openings, ...sayings, ...voices]) {
    const stem = e.id.replace(/-\d+\*?$/, '');
    const parts = [...groups.get(stem)];
    if (parts.length > 1 && parts[0] !== e.来源分表) {
      e.原编号 = e.id;
      e.id = `${e.id}·p${e.来源分表.replace('part-', '')}`;
      stats.idSuffixed.push(e.id);
    }
  }
}

// ---- 做法 3/4：品类重判 ----
function rejudge(list, textOf) {
  for (const e of list) {
    const old = e.品类;
    if (overrides.categoryOverride?.[e.id]) {
      e.品类 = overrides.categoryOverride[e.id];
      const hs = physHints(textOf(e)); if (e.品类 === '通用' && hs.length) e.实物线索 = hs;
      if (e.品类 !== old) stats.categoryChanged.push({ id: e.id, from: old, to: e.品类, hits: ['人工改判'] });
      continue;
    }
    const j = judgePhysical(textOf(e));
    let next;
    if (old === '虚拟专用') { next = '虚拟专用'; if (j.phys) stats.virtualWithPhys.push({ id: e.id, hits: j.hits.filter((h) => !h.neg).map((h) => h.w) }); }
    else next = j.phys ? '实物专用' : '通用';
    e.品类 = next;
    e.实物词 = j.hits.length ? j.hits.map((h) => (h.neg ? `¬${h.w}` : h.w)) : undefined;
    if (next === '通用') { const hs = physHints(textOf(e)); if (hs.length) e.实物线索 = hs; }
    if (next !== old) stats.categoryChanged.push({ id: e.id, from: old, to: next, hits: e.实物词 });
  }
}
rejudge(openings, (e) => `${e.切入方式} ${e.结构} ${e.适合}`);
rejudge(sayings, (e) => e.原句);
rejudge(voices, (e) => `${e.原句} ${e.情境}`);

// ---- 做法 2：效果倍数 ----
const effectCands = [];
for (const e of sayings) {
  const m = effectCandidate(e.原句);
  if (m) effectCands.push({ id: e.id, match: m, 原句: e.原句 });
}
for (const e of voices) {
  const m = effectCandidate(e.原句);
  if (m) effectCands.push({ id: e.id, match: m, 原句: e.原句, layer: 'voice' });
}
const effectKeep = new Set(overrides.effectKeep || []);
const effectDelete = new Set(overrides.effectDelete || []);
const toDelete = new Set();
for (const c of effectCands) { if (!effectKeep.has(c.id)) toDelete.add(c.id); }
for (const id of effectDelete) toDelete.add(id);
function pruneEffect(list, layer) {
  return list.filter((e) => {
    if (!toDelete.has(e.id)) return true;
    const c = effectCands.find((x) => x.id === e.id);
    stats.effectDeleted.push({ id: e.id, layer, match: c ? c.match : '(人工追加)', 原句: e.原句, 来源分表: e.来源分表 });
    return false;
  });
}
const sayingsKept = pruneEffect(sayings, 'sayings');
const voicesKept = pruneEffect(voices, 'voices');

// ---- 做法 6：收入数字 ----
const incomeTrue = new Set(overrides.incomeTrue || []);
const incomeFalse = new Set(overrides.incomeFalse || []);
const incomeCands = [];
for (const e of [...sayingsKept, ...voicesKept]) {
  const m = incomeCandidate(e.原句);
  let flag = !!m;
  if (incomeTrue.has(e.id)) flag = true;
  if (incomeFalse.has(e.id)) flag = false;
  e.含收入数字 = flag;
  if (m || flag) incomeCands.push({ id: e.id, match: m, flag, 原句: e.原句 });
}

// ---- 场景 E 子场景 ----
for (const e of sayingsKept) {
  if (e.场景 !== 'E') continue;
  e.子场景_粗分 = coarseSubscene(e.原句);
  e.子场景 = overrides.subscene?.[e.id] || e.子场景_粗分;
}
// ---- 立场 ----
for (const e of sayingsKept) { if (overrides.stance?.[e.id]) e.立场 = overrides.stance[e.id]; }

// ---- 去重 ----
function dedupe(list, keyOf, layer) {
  const seen = new Map();
  const out = [];
  for (const e of list) {
    const k = keyOf(e);
    if (!k) { out.push(e); continue; }
    if (seen.has(k)) {
      const first = seen.get(k);
      first.合并自 = first.合并自 || [];
      first.合并自.push(`${e.id}（${e.来源分表}${e.场景 ? '，场景 ' + e.场景 : ''}）`);
      if (e.场景 && e.场景 !== first.场景) { first.其他场景 = first.其他场景 || []; if (!first.其他场景.includes(e.场景)) first.其他场景.push(e.场景); }
      if (!first.来源分表.split('+').includes(e.来源分表)) first.来源分表 += '+' + e.来源分表;
      stats.dedupe.push({ layer, kept: first.id, dropped: e.id, sameScene: first.场景 === e.场景, 原句: e.原句 ?? e.出处 });
      continue;
    }
    seen.set(k, e);
    out.push(e);
  }
  return out;
}
const openingsFinal = dedupe(openings, (e) => dedupeKey(e.出处), 'openings');
const sayingsFinal = dedupe(sayingsKept, (e) => dedupeKey(e.原句), 'sayings');
const voicesFinal = dedupe(voicesKept, (e) => dedupeKey(e.谁说的 + '|' + e.原句), 'voices');

// ---- 作者档案合并 ----
const authorMap = new Map();
for (const b of authorsBlocks) {
  if (!authorMap.has(b.作者)) authorMap.set(b.作者, { 作者: b.作者, 档案: '', 来源分表: '', 分表档案: [] });
  const a = authorMap.get(b.作者);
  a.分表档案.push({ 来源分表: b.来源分表, 作者_原写法: b.作者_原写法, 栏目: b.栏目, 档案: b.档案 });
}
const authorsFinal = [...authorMap.values()].map((a) => {
  a.来源分表 = a.分表档案.map((x) => x.来源分表).join('+');
  a.档案 = a.分表档案.map((x) => `【${x.来源分表}${x.作者_原写法 ? '，原写作 ' + x.作者_原写法 : ''}】\n${x.档案}`).join('\n\n');
  return a;
});

// ---- id 唯一性 ----
const idSet = new Set();
for (const e of [...openingsFinal, ...sayingsFinal, ...voicesFinal]) { if (idSet.has(e.id)) throw new Error('id 重复：' + e.id); idSet.add(e.id); }

// ---- 统计 ----
const countBy = (list, f) => list.reduce((m, e) => { const k = f(e); m[k] = (m[k] || 0) + 1; return m; }, {});
stats.after = { openings: openingsFinal.length, sayings: sayingsFinal.length, voices: voicesFinal.length, authors: authorsFinal.length };
stats.sayingsByScene = countBy(sayingsFinal, (e) => e.场景);
stats.sayingsByCategory = countBy(sayingsFinal, (e) => e.品类);
stats.voicesByCategory = countBy(voicesFinal, (e) => e.品类);
stats.openingsByCategory = countBy(openingsFinal, (e) => e.品类);
stats.sayingsByAuthor = countBy(sayingsFinal, (e) => e.作者);
stats.subsceneE = countBy(sayingsFinal.filter((e) => e.场景 === 'E'), (e) => e.子场景);
stats.income = { sayings: sayingsFinal.filter((e) => e.含收入数字).length, voices: voicesFinal.filter((e) => e.含收入数字).length };
stats.incomeSayings = sayingsFinal.filter((e) => e.含收入数字).map((e) => ({ id: e.id, 原句: e.原句 }));
stats.stance = countBy(sayingsFinal.filter((e) => e.立场), (e) => e.立场);
stats.aladdin = { openings: openingsFinal.filter((e) => e.作者 === '阿拉丁').length, sayings: sayingsFinal.filter((e) => e.作者 === '阿拉丁').length, voices: voicesFinal.filter((e) => e.作者 === '阿拉丁' || /^阿拉丁/.test(e.出处)).length };
stats.decensor = Object.fromEntries([...decensorStats.entries()].sort((a, b) => b[1] - a[1]));
stats.decensorTotal = [...decensorStats.values()].reduce((a, b) => a + b, 0);
stats.restoredEntries = [...sayingsFinal, ...voicesFinal].filter((e) => e.原句_原样).length;
stats.physHintCount = [...openingsFinal, ...sayingsFinal, ...voicesFinal].filter((e) => e.实物线索).length;
stats.physHintFlipped = stats.categoryChanged.filter((d) => d.to === '通用' && [...openingsFinal, ...sayingsFinal, ...voicesFinal].find((e) => e.id === d.id)?.实物线索).length;

// ---------- 6. 输出 JSON ----------
const strip = (e) => { const o = {}; for (const [k, v] of Object.entries(e)) { if (v === undefined || k.startsWith('__')) continue; o[k] = v; } return o; };
const json = {
  生成时间: new Date().toISOString().slice(0, 10),
  说明: '由 engine/corpus-pack/merge-pack.mjs 合并五份分表生成；原句字段已还原防审查写法，原句_原样保留分表原文；品类按 2026-09-08 八条统一做法重判。',
  统计: stats.after,
  openings: openingsFinal.map(strip),
  sayings: sayingsFinal.map(strip),
  voices: voicesFinal.map(strip),
  authors: authorsFinal.map((a) => ({ 作者: a.作者, 档案: a.档案, 来源分表: a.来源分表, 分表档案: a.分表档案 })),
};
fs.writeFileSync(path.join(PACK_DIR, '总表.json'), JSON.stringify(json, null, 1), 'utf8');

// ---------- 7. 输出 MD ----------
const cell = (v) => (v === undefined || v === null ? '' : String(Array.isArray(v) ? v.join('、') : v).replace(/\|/g, '｜').replace(/\r?\n/g, ' '));
const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const SCENE_NAME = { A: '以前怎么做、现在怎么做', B: '报一个数', C: '讲退款、售后', D: '讲定价', E: '劝新手', F: '替读者提问，然后接一句', G: '转场', H: '块尾收口', I: '结尾和资料钩子', J: '讲虚拟品怎么交付、券和资料的规矩' };
const SUBSCENE_LIST = ['心态', '动作', '选品判断', '上架与文案', '客服与成交', '风险与合规', '其他'];

let md = [];
md.push('# 真人语料包 · 总表');
md.push('');
md.push(`> 由五份分表（part-1 … part-5）机械合并再人工过一遍生成，脚本 \`engine/corpus-pack/merge-pack.mjs\`，人工裁定在 \`engine/corpus-pack/manual-overrides.json\`。机器读 \`总表.json\`。生成日期 ${json.生成时间}。`);
md.push('');
md.push('## 使用须知');
md.push('');
md.push('1. **借形不借句**：说法层、原声层是给写手学措辞和句式的，不许整句搬；交稿时整个语料包进十二字连抄检查的对照库（对照库用还原后的"原句"）。');
md.push('2. **亲历要换**：标"含作者亲历 / 本人亲历"的，只许学句式，里面的事必须换成圣矾自己的。');
md.push('3. **优先级**：节奏听风格说明书，措辞听语料包，事实听事实链；冲突按这个顺序。');
md.push('4. **品类**：只有三个值。通用 / 实物专用（句子里出现非否定的：退货、运费、快递、物流、品控、面单、囤货、包邮、运费险、七天无理由退货、签收、破损、发货慢、补发）/ 虚拟专用（仅 part-5）。"售后"不算实物词；否定句里的实物词（"不需要囤货""不用发快递"）算通用。虚拟选题配料时剔掉实物专用。');
md.push('5. **立场**：标了 `反虚拟` 的条目站在实物立场贬虚拟，虚拟选题不能用。');
md.push('6. **效果倍数一律不收**（曝光差几倍、流量涨十倍、翻倍）；分表里已收的这次删掉，清单见文末。自嘲式小数字（"第一个月只赚三百"）保留，亲历标"含作者亲历"。');
md.push('7. **含收入数字**：原声层带收入数字的留着并标 true；说法层按口径不该有，若标了 true 的请人工看一眼（清单见文末）。同行链接的想要数、浏览量不算收入。');
md.push('8. **防审查写法已还原**（🔗→链接、💧→流量、dan→单、Li→利、feng→封 / 风控、bao光→曝光、lian接 / L接→链接、liu量→流量、马扁→骗、红现→红线、板权→版权 等）；原样在 JSON 的 `原句_原样` 字段。W / K / w 当数量词（1W、几K）的没动。');
md.push('9. **用过的期**：初始为空，同一条隔几期才能再用。');
md.push('10. **作者归属**：按分表的公众号归堆；part-3 编号带 `*` 的三篇（文内署名阿拉丁）改归阿拉丁，编号保留原样。');
md.push('');

// 开头层
md.push('## 一、开头层（结构，不抄原文）');
md.push('');
md.push(`共 ${openingsFinal.length} 条，按切入方式排序。⓪ = 自报家门 / 合同句的位置。`);
md.push('');
const openSorted = [...openingsFinal].sort((a, b) => a.切入方式.localeCompare(b.切入方式, 'zh-Hans-CN') || a.id.localeCompare(b.id));
md.push(table(['编号', '切入方式', '结构：每句干什么', '步数', '适合讲什么', '品类', '作者', '出处', '来源分表', '用过的期'],
  openSorted.map((e) => [e.id, e.切入方式, e.结构, e.步数 == null ? '' : `${e.步数}${e.口播要压缩 ? '，口播要压缩' : ''}`, e.适合, e.品类, e.作者, e.出处, e.来源分表, ''])));
md.push('');

// 说法层
md.push('## 二、说法层（原句照录，防审查写法已还原）');
md.push('');
for (const sc of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
  const rows = sayingsFinal.filter((e) => e.场景 === sc);
  if (!rows.length) continue;
  md.push(`### 场景 ${sc} · ${SCENE_NAME[sc]}（${rows.length} 条）`);
  md.push('');
  if (sc === 'E') {
    for (const sub of SUBSCENE_LIST) {
      const r2 = rows.filter((e) => e.子场景 === sub);
      if (!r2.length) continue;
      md.push(`#### E · ${sub}（${r2.length} 条）`);
      md.push('');
      md.push(table(['编号', '原句', '作者', '文章', '亲历', '品类', '口播', '立场', '含收入数字', '来源分表', '用过的期'],
        r2.map((e) => [e.id, e.原句, e.作者, e.文章, e.亲历, e.品类, e.口播, e.立场 || '', e.含收入数字 ? 'true' : '', e.来源分表, ''])));
      md.push('');
    }
  } else {
    md.push(table(['编号', '原句', '作者', '文章', '亲历', '品类', '口播', '立场', '含收入数字', '来源分表', '用过的期'],
      rows.map((e) => [e.id, e.原句, e.作者, e.文章, e.亲历, e.品类, e.口播, e.立场 || '', e.含收入数字 ? 'true' : '', e.来源分表, ''])));
    md.push('');
  }
}

// 原声层
md.push(`## 三、原声层（${voicesFinal.length} 条）`);
md.push('');
md.push(table(['编号', '谁说的', '原句', '情境', '品类', '出处', '含收入数字', '来源分表'],
  voicesFinal.map((e) => [e.id, e.谁说的, e.原句, e.情境, e.品类, e.出处, e.含收入数字 ? 'true' : '', e.来源分表])));
md.push('');

// 作者档案
md.push('## 四、作者档案');
md.push('');
for (const a of authorsFinal) {
  md.push(`### ${a.作者}（来源：${a.来源分表}）`);
  md.push('');
  for (const x of a.分表档案) {
    md.push(`**${x.来源分表}${x.作者_原写法 ? `（分表里写作"${x.作者_原写法}"）` : ''}**`);
    md.push('');
    for (const [k, v] of Object.entries(x.栏目)) md.push(`- ${k}：${v}`);
    md.push('');
  }
}

// 附录
md.push('## 附录 · 统计与清单');
md.push('');
md.push('### 条数');
md.push('');
md.push(table(['层', ...PARTS.map((p) => p[0]), '合并前合计', '合并后'], [
  ['开头层', ...PARTS.map((p) => stats.before[p[0]].openings), openings.length, openingsFinal.length],
  ['说法层', ...PARTS.map((p) => stats.before[p[0]].sayings), sayings.length, sayingsFinal.length],
  ['原声层', ...PARTS.map((p) => stats.before[p[0]].voices), voices.length, voicesFinal.length],
  ['作者档案', ...PARTS.map((p) => stats.before[p[0]].authors), authorsBlocks.length, authorsFinal.length],
]));
md.push('');
md.push('说法层按场景：' + Object.entries(stats.sayingsByScene).sort().map(([k, v]) => `${k} ${v}`).join(' · '));
md.push('');
md.push('说法层按品类：' + Object.entries(stats.sayingsByCategory).map(([k, v]) => `${k} ${v}`).join(' · ') + '；原声层按品类：' + Object.entries(stats.voicesByCategory).map(([k, v]) => `${k} ${v}`).join(' · ') + '；开头层按品类：' + Object.entries(stats.openingsByCategory).map(([k, v]) => `${k} ${v}`).join(' · '));
md.push('');
md.push('场景 E 子场景：' + SUBSCENE_LIST.map((k) => `${k} ${stats.subsceneE[k] || 0}`).join(' · '));
md.push('');
md.push(`含收入数字：说法层 ${stats.income.sayings} 条，原声层 ${stats.income.voices} 条。立场标记：${Object.entries(stats.stance).map(([k, v]) => `${k} ${v}`).join('、') || '无'}。阿拉丁：开头 ${stats.aladdin.openings} / 说法 ${stats.aladdin.sayings} / 原声 ${stats.aladdin.voices}。`);
md.push('');
md.push(`防审查写法还原：共 ${stats.decensorTotal} 处，涉及 ${stats.restoredEntries} 条。` + Object.entries(stats.decensor).map(([k, v]) => `${k} ${v}`).join('，'));
md.push('');
md.push(`### 去重（${stats.dedupe.length} 条）`);
md.push('');
md.push(stats.dedupe.length ? table(['层', '保留', '删掉', '同场景', '原句'], stats.dedupe.map((d) => [d.layer, d.kept, d.dropped, d.sameScene ? '是' : '否', d.原句])) : '无');
md.push('');
md.push(`### 效果倍数删除清单（${stats.effectDeleted.length} 条）`);
md.push('');
md.push(stats.effectDeleted.length ? table(['编号', '层', '命中', '原句', '来源分表'], stats.effectDeleted.map((d) => [d.id, d.layer, d.match, d.原句, d.来源分表])) : '无');
md.push('');
md.push(`### 说法层含收入数字（${stats.incomeSayings.length} 条，请人工看）`);
md.push('');
md.push(stats.incomeSayings.length ? table(['编号', '原句'], stats.incomeSayings.map((d) => [d.id, d.原句])) : '无');
md.push('');
md.push(`### 品类改判（${stats.categoryChanged.length} 条）`);
md.push('');
md.push(stats.categoryChanged.length ? table(['编号', '分表原标', '改为', '实物词命中（¬ = 否定句里）'], stats.categoryChanged.map((d) => [d.id, d.from, d.to, (d.hits || []).join('、')])) : '无');
md.push('');
fs.writeFileSync(path.join(PACK_DIR, '总表.md'), md.join('\n') + '\n', 'utf8');

// ---------- 8. dump 复核清单 ----------
if (dumpDir) {
  fs.mkdirSync(dumpDir, { recursive: true });
  const w = (name, obj) => fs.writeFileSync(path.join(dumpDir, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1), 'utf8');
  w('E-subscene.txt', sayingsKept.filter((e) => e.场景 === 'E').map((e) => `${e.id}\t${e.子场景}\t${e.原句}`).join('\n'));
  w('effect-candidates.txt', effectCands.map((c) => `${c.id}\t[${c.match}]\t${c.原句}`).join('\n'));
  w('income-candidates.txt', incomeCands.map((c) => `${c.id}\t[${c.match}]\t${c.原句}`).join('\n'));
  w('stance-candidates.txt', sayingsKept.filter((e) => /虚拟|资料|课程|网盘|卡券|软件/.test(e.原句) && e.作者 !== '圣矾本人').map((e) => `${e.id}\t${e.作者}\t${e.原句}`).join('\n'));
  w('category-changed.txt', stats.categoryChanged.map((d) => `${d.id}\t${d.from}→${d.to}\t${(d.hits || []).join('、')}\t${[...sayings, ...voices, ...openings].find((e) => e.id === d.id)?.原句 || ''}`).join('\n'));
  w('virtual-with-phys.txt', stats.virtualWithPhys.map((d) => `${d.id}\t${d.hits.join('、')}\t${sayings.find((e) => e.id === d.id)?.原句 || ''}`).join('\n'));
  w('dedupe.txt', stats.dedupe.map((d) => `${d.layer}\t${d.kept}\t${d.dropped}\t${d.sameScene}\t${d.原句}`).join('\n'));
  w('restored.txt', [...sayings, ...voices].filter((e) => e.原句_原样).map((e) => `${e.id}\n  原：${e.原句_原样}\n  新：${e.原句}`).join('\n'));
  w('stats.json', stats);
}

console.log(JSON.stringify({ before: stats.before, after: stats.after, dedupe: stats.dedupe.length, effectDeleted: stats.effectDeleted.length, categoryChanged: stats.categoryChanged.length, subsceneE: stats.subsceneE, income: stats.income, stance: stats.stance, aladdin: stats.aladdin, decensorTotal: stats.decensorTotal, restoredEntries: stats.restoredEntries, virtualWithPhys: stats.virtualWithPhys.length }, null, 1));
