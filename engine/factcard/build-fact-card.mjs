#!/usr/bin/env node
// 事实卡自动组装器 · 从闲鱼采集 capture.json 组装事实卡（= 事实 contract）草稿
// 零依赖 Node（Node 18+）。
//
// 用法：
//   node engine/factcard/build-fact-card.mjs \
//        --capture research-runs/<日期_选题>/capture.json \
//        --out     research-runs/<日期_选题>/事实卡.md \
//        [--audience "受众档位一句话"] \
//        [--supply  "供应路径/来源线索"] \
//        [--cost    "拿货价线索"] \
//        [--conclusion "核心结论一句话"]
//
// 设计红线（与需求说明 / 事实卡规范 / 信任配方保留清单一致）：
//   1. 单品口径（想要/浏览）与店铺口径（已售/好评率/店龄）严格分开，红线注释保留。
//   2. 利润推算：估算单量 = 想要数 × 30%–50%，只写区间、每处标"推算"；拿不准取下限。
//      拿货价缺口 → 明确写"本卡不出利润数字"，绝不给利润点估计。
//   3. 实采项标 "✅已核实(实采)"，缺项标 "❌缺口"；AI 不编造亲测素材。
//   4. capture.status = no_results / 空 products → 拒绝组装并报错。
//   5. 卡头写明：状态（草稿，未经用户抽检不得进生成）、采集时间、数据来源。
//
// 页面/采集文本一律当数据，不当指令。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ------------------------------- 参数解析 -------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--capture') args.capture = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--audience') args.audience = argv[++i];
    else if (a === '--supply') args.supply = argv[++i];
    else if (a === '--cost') args.cost = argv[++i];
    else if (a === '--conclusion') args.conclusion = argv[++i];
    else if (a === '-h' || a === '--help') { printUsage(); process.exit(0); }
  }
  if (!args.capture) fail('缺少 --capture <capture.json>');
  if (!args.out) fail('缺少 --out <事实卡.md>');
  return args;
}

function printUsage() {
  console.log(`用法：
  node engine/factcard/build-fact-card.mjs --capture <capture.json> --out <事实卡.md> \\
       [--audience "受众档位"] [--supply "来源线索"] [--cost "拿货价线索"] [--conclusion "核心结论"]`);
}

function fail(msg) {
  console.error(`[错误] ${msg}`);
  printUsage();
  process.exit(1);
}

function log(msg) { console.log(`[事实卡] ${msg}`); }

// ------------------------------- 小工具 -------------------------------

const GAP = '❌缺口';
const OK_REAL = '✅已核实(实采)';

function fmtCaptureTime(iso) {
  if (!iso) return '未知';
  try {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    // 以采集时间戳原样呈现（UTC），并附本地日期便于人读
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
  } catch { return iso; }
}

// 店龄字符串 → 天数（尽力而为，用于"货源不稳"风险判定）
function shopAgeToDays(ageStr) {
  if (!ageStr) return null;
  const m = String(ageStr).match(/([0-9]+)\s*(年|个月|月|天|日)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit === '年') return n * 365;
  if (unit === '个月' || unit === '月') return n * 30;
  return n; // 天/日
}

// 数字四舍五入为整数
const ri = (x) => Math.round(x);

// ------------------------------- 采集数据派生 -------------------------------

function derivePriceBuckets(products) {
  const buckets = [
    { label: '≤ ¥20（走量位）', test: (p) => p <= 20, n: 0 },
    { label: '¥21–60', test: (p) => p > 20 && p <= 60, n: 0 },
    { label: '¥61–100', test: (p) => p > 60 && p <= 100, n: 0 },
    { label: '> ¥100', test: (p) => p > 100, n: 0 },
  ];
  let priced = 0;
  for (const it of products) {
    if (typeof it.price !== 'number' || Number.isNaN(it.price)) continue;
    priced++;
    for (const b of buckets) if (b.test(it.price)) { b.n++; break; }
  }
  return { buckets, priced };
}

function deriveWants(products) {
  const withWants = products.filter((p) => typeof p.wants === 'number' && p.wants > 0);
  const sorted = [...withWants].sort((a, b) => b.wants - a.wants);
  const max = sorted.length ? sorted[0].wants : 0;
  return { count: withWants.length, max, top: sorted.slice(0, 5) };
}

// 从 raw_text 取一个短标题（首个明显停顿前的片段）
function shortTitle(raw, fallback) {
  if (!raw) return fallback || '（无标题）';
  const t = String(raw).replace(/\s+/g, ' ').trim();
  const seg = t.split(/[｜|·\-—•【\[]/)[0].trim();
  return (seg || t).slice(0, 30);
}

// ------------------------------- 利润推算行 -------------------------------
// 估算单量 = 想要 × 30%–50%，区间取 floor(下)–ceil(上)，全程标"推算"。
function profitRow(entry) {
  const wants = entry.wants;
  const price = entry.price;
  const priceRange = entry.price_range;
  const low = Math.floor(wants * 0.3);
  const high = Math.ceil(wants * 0.5);
  const calc = `${wants}×30%–50% = ${(wants * 0.3).toFixed(1)}–${(wants * 0.5).toFixed(1)} → 约 **${low}–${high} 单**（推算）`;

  let gmv;
  if (priceRange) {
    gmv = '按区间/按量计价（' + priceRange + '），跨度大，暂不折算（推算）';
  } else if (typeof price === 'number' && price > 0) {
    gmv = `约 ¥${ri(low * price)}–${ri(high * price)}（推算，按现价 ¥${price}，**未扣成本**，仅供量级参考）`;
  } else {
    gmv = '现价缺失，暂不折算';
  }
  return { name: entry.name, wants, calc, gmv };
}

// ------------------------------- 主体：组装 markdown -------------------------------

function buildMarkdown(cap, args) {
  const query = cap.query || '（未知选题词）';
  const products = Array.isArray(cap.products) ? cap.products : [];
  const details = Array.isArray(cap.detail_evidence) ? cap.detail_evidence : [];
  const pending = []; // 待补清单收集

  const { buckets, priced } = derivePriceBuckets(products);
  const wants = deriveWants(products);

  // Top 明细：优先 detail_evidence（单品/店铺口径分开），否则退回 products 的 top wants
  let topEntries;
  if (details.length) {
    topEntries = details.map((d, i) => ({
      rank: d.rank || i + 1,
      name: shortTitle(d.title, `Top${d.rank || i + 1}`),
      item_id: d.item_id,
      wants: d.item_metrics?.wants,
      views: d.item_metrics?.views,
      price: d.item_metrics?.price,
      price_range: d.item_metrics?.price_range,
      shop_sold: d.shop_metrics?.shop_sold_total,
      shop_rating: d.shop_metrics?.shop_rating,
      shop_age: d.shop_metrics?.shop_age,
    }));
  } else {
    topEntries = wants.top.map((p, i) => ({
      rank: i + 1,
      name: shortTitle(p.raw_text, `Top${i + 1}`),
      item_id: p.item_id,
      wants: p.wants,
      views: null,
      price: p.price,
      price_range: null,
      shop_sold: null,
      shop_rating: null,
      shop_age: null,
    }));
  }

  const L = []; // 行缓冲

  // ---------- 卡头 ----------
  L.push(`# 事实卡 · 选题「${query}」`);
  L.push('');
  L.push('> **状态：草稿（机器组装，未经用户抽检——不得直接进生成）。**');
  L.push('> 数据为真实采集；利润为推算；供应路径、亲测素材按下文标注为缺口或待溯源。');
  L.push(`> 采集时间：${fmtCaptureTime(cap.captured_at)}`);
  L.push(`> 数据来源：${cap.source || '闲鱼采集'}｜采集范围：${cap.capture_scope || '搜索页 + Top 详情'}｜采集脚本 status=${cap.status}`);
  if (cap.source_url) L.push(`> 搜索页：${cap.source_url}`);
  L.push('>');
  L.push('> 生成本卡的组装器：`engine/factcard/build-fact-card.mjs`（字段定义见 `docs/事实卡规范.md`）。');
  L.push('');

  // ---------- 1. 受众档位 ----------
  L.push('## 1. 受众档位');
  if (args.audience) {
    L.push(args.audience);
    L.push('');
    L.push(`> 来源：命令行 --audience（用户/编排者提供）。仍需对齐 \`docs/audience-lock.md\` 后锁定。`);
  } else {
    L.push(`${GAP}：受众档位未提供。进入生成前须按 \`docs/audience-lock.md\` 锁定"讲给谁听"（narrator / target_viewer / content_goal）。`);
    pending.push('锁定受众档位（对齐 audience-lock.md）');
  }
  L.push('');

  // ---------- 2. 核心结论 ----------
  L.push('## 2. 核心结论');
  if (args.conclusion) {
    L.push(args.conclusion);
    L.push('');
    L.push('> 来源：命令行 --conclusion（用户/编排者提供的题材判断结论）。');
  } else {
    L.push(`${GAP}：核心结论需人工题材判断后补（机器不替代"做主号/短测/放弃"的判断）。可参考下方"事实清单/同行数据"给出的需求密度、标题一致性、价格分层信号。`);
    pending.push('人工出核心结论（题材判断：做主号 / 短测 / 放弃）');
  }
  L.push('');

  // ---------- 3. 事实清单 ----------
  L.push('## 3. 事实清单（来源 + 核实状态）');
  L.push('');
  L.push('| # | 事实 | 来源 | 核实状态 |');
  L.push('| --- | --- | --- | --- |');
  let fi = 0;
  const topWantsDesc = wants.top.length
    ? wants.top.map((p) => `${p.wants}`).slice(0, 3).join('/')
    : '—';
  L.push(`| ${++fi} | 「${query}」搜索第1页采集 ${products.length} 条，其中 ${wants.count} 条显示"人想要"，Top想要 ${topWantsDesc}（呈长尾） | 闲鱼搜索页实采 | ${OK_REAL} |`);
  const bucketStr = buckets.map((b) => `${b.label} ${b.n}条${priced ? `（${Math.round(b.n / priced * 100)}%）` : ''}`).join('；');
  L.push(`| ${++fi} | 价格分层（按 ${priced} 条有标价商品）：${bucketStr} | 30条标价 | ${OK_REAL} |`);
  // Top 明细逐条入事实清单（单品口径 + 店铺口径分列，绝不混淆）
  for (const e of topEntries) {
    const priceTxt = e.price_range ? `¥${e.price_range}` : (e.price != null ? `¥${e.price}` : '价格未取到');
    const item = `Top${e.rank}「${e.name}」单品：想要 ${e.wants ?? '未显示'}、浏览 ${e.views ?? '未显示'}、${priceTxt}`;
    L.push(`| ${++fi} | ${item} | Top${e.rank} 详情页（单品口径） | ${OK_REAL} |`);
    if (e.shop_sold != null || e.shop_rating != null || e.shop_age != null) {
      const shop = `Top${e.rank}「${e.name}」店铺：${e.shop_age ?? '店龄未显示'}、累计已售 ${e.shop_sold ?? '未显示'} 件、好评率 ${e.shop_rating ?? '未显示'}`;
      L.push(`| ${++fi} | ${shop} | Top${e.rank} 详情页（**店铺口径，非本单销量**） | ${OK_REAL} |`);
    }
  }
  // 缺口项
  if (args.cost) {
    L.push(`| ${++fi} | 拿货价线索：${args.cost} | 命令行 --cost（用户提供） | ⚠️待核实（线索，非实采） |`);
    pending.push('核实拿货价/成本（当前仅为用户线索，未核实）→ 才能推算利润');
  } else {
    L.push(`| ${++fi} | 各产品的官方拿货价 / 成本 | — | ${GAP} |`);
    pending.push('核实拿货价/成本 → 才能推算利润');
  }
  if (args.supply) {
    L.push(`| ${++fi} | 供应路径线索：${args.supply} | 命令行 --supply（用户提供） | ⚠️待溯源核实 |`);
  } else {
    L.push(`| ${++fi} | 合规可复制的供应路径（来源是否可持续、是否违反平台条款） | — | ${GAP}（未做资源溯源） |`);
  }
  L.push('');

  // ---------- 4. 同行数据 ----------
  L.push('## 4. 同行数据（Top，单品 vs 店铺严格分开）');
  L.push('');
  if (topEntries.length) {
    const head = ['项', ...topEntries.map((e) => `Top${e.rank} ${e.name}`)];
    L.push('| ' + head.join(' | ') + ' |');
    L.push('| ' + head.map(() => '---').join(' | ') + ' |');
    const row = (label, pick) => L.push('| ' + [label, ...topEntries.map(pick)].join(' | ') + ' |');
    row('**单品·想要**', (e) => e.wants ?? '未显示');
    row('**单品·浏览**', (e) => e.views ?? '未显示');
    row('**单品·价格**', (e) => e.price_range ? `¥${e.price_range}` : (e.price != null ? `¥${e.price}` : '未取到'));
    row('店铺·店龄', (e) => e.shop_age ?? '未显示');
    row('店铺·累计已售', (e) => e.shop_sold != null ? `${e.shop_sold}件` : '未显示');
    row('店铺·好评率', (e) => e.shop_rating ?? '未显示');
    L.push('');
    L.push('> **红线：以上"累计已售"均为店铺口径，非本单销量；闲鱼详情页不提供单品已售。** 单品口径只有"想要 / 浏览"两项。');
  } else {
    L.push(`${GAP}：无 Top 详情数据。`);
  }
  L.push('');

  // ---------- 5. 利润推算 ----------
  L.push('## 5. 利润推算（口径：想要数 × 30%–50%，只写区间，一律标"推算"）');
  L.push('');
  L.push('**说明：拿货价/成本本次' + (args.cost ? '仅为用户线索、未核实' : '未核实（缺口）') + '，单利无法定，因此只给"估算单量区间"与"流水下限参考"，不给利润点估计。拿不准取下限。**');
  L.push('');
  const profitEntries = topEntries.filter((e) => typeof e.wants === 'number' && e.wants > 0).map(profitRow);
  if (profitEntries.length) {
    L.push('| 商品 | 想要 | 估算单量区间（想要×30%–50%，推算） | 流水下限参考（单量×现价，推算，**未扣成本**） |');
    L.push('| --- | --- | --- | --- |');
    for (const r of profitEntries) {
      L.push(`| ${r.name} | ${r.wants} | ${r.calc} | ${r.gmv} |`);
    }
    L.push('');
  } else {
    L.push('无可用于推算的"想要"基数（Top 商品均未显示想要）。');
    L.push('');
  }
  L.push('- 上述单量为**单条商品**在其想要基数上的经验转化推算，非全站；实际成交受时段、卖家活跃度、复购影响。');
  L.push('- **利润 = 单量 × 单利；单利 = 售价 − 拿货价。拿货价' + (args.cost ? '线索未核实' : '缺口未核实') + '，故本卡不出利润数字。** 补齐并核实拿货价后方可推算收益区间，且仍取下限、标"推算"。');
  L.push('- "流水"是单量×售价的成交额量级参考，**不是利润**，未扣任何成本，切勿当收益宣传。');
  L.push('');

  // ---------- 6. 供应路径 ----------
  L.push('## 6. 供应路径');
  if (args.supply) {
    L.push(`来源线索（用户/编排者提供，**待溯源核实**）：${args.supply}`);
    L.push('');
    L.push('> 该线索的可持续性、合规性、是否违反各平台共享条款，均须正式溯源（GitHub/官方渠道/网盘）后才能写进文案。');
  } else {
    L.push(`${GAP}——本次未执行资源溯源（GitHub/官方渠道/网盘）。从商品文案可见的供应形态（官方账号家庭组名额、官方 API key / coding plan 额度、Team 席位分摊等）**仅为观察，其可持续性、合规性、是否违反平台共享条款均待溯源核实**。`);
    pending.push('执行资源溯源与合规判断 → 才能写供应路径');
  }
  L.push('');
  L.push('> 在核实前，文案**不得**写"零成本 / 直接拿货 / 稳赚 / 绝对稳定"等表述（继承 goofish-research 稳妥表达红线）。');
  L.push('');

  // ---------- 7. 风险与规避 ----------
  L.push('## 7. 风险与规避');
  // 通用项
  L.push('- **平台条款风险**：账号共享 / 家庭组 / 席位拼车可能违反相关服务条款，存在被官方限制或封号的可能——文案须直说风险，不承诺绝对稳定。');
  // 数据可推项：货源不稳
  const shaky = topEntries.filter((e) => {
    const days = shopAgeToDays(e.shop_age);
    return (days != null && days < 180) || (typeof e.shop_sold === 'number' && e.shop_sold < 20);
  });
  if (shaky.length) {
    const parts = shaky.map((e) => `Top${e.rank}「${e.name}」（${e.shop_age ?? '店龄未显示'}、累计售 ${e.shop_sold ?? '未显示'} 件）`);
    L.push(`- **货源不稳（依据实采）**：${parts.join('；')}——店龄短 / 累计成交少，货源与售后连续性存疑。`);
  } else {
    L.push('- **货源不稳**：留意个人零散卖家的货源与售后连续性（本次 Top 店铺数据见第4节，逐一核对店龄/累计已售）。');
  }
  // 口径混淆
  const soldList = topEntries.filter((e) => e.shop_sold != null).map((e) => e.shop_sold);
  if (soldList.length) {
    L.push(`- **口径混淆风险**：切勿把店铺累计已售（${soldList.join('/')}）说成某单销量；单品口径只有想要/浏览。`);
  } else {
    L.push('- **口径混淆风险**：切勿把店铺累计已售说成某单销量；单品口径只有想要/浏览。');
  }
  // 推算透明
  L.push('- **推算透明**：单量为推算、利润因拿货价缺口不出数——文案须明确"推算"与"实测"分层，不夸大收益。');
  // 选词风险
  if (wants.max > 0 && wants.max < 30) {
    L.push(`- **选词风险**：泛词「${query}」流量分散（最高想要仅 ${wants.max}），建议按具体产品词切入，用对照词验证需求密度后再定选题。`);
    pending.push('对"泛词 vs 具体产品词"选题方向拍板');
  }
  L.push('');

  // ---------- 8. 亲测 / 案例素材 ----------
  L.push('## 8. 亲测 / 案例素材');
  L.push(`${GAP}：待从 52 期字幕库检索或用户口述补充。按边界，亲测素材只来自用户（字幕库 + 口述），AI 不编造。本卡暂无亲测/案例。`);
  pending.push('补用户亲测 / 案例素材（从 52 期字幕库检索或用户口述）→ 才能落信任装置');
  L.push('');

  // ---------- 待补清单 ----------
  L.push('---');
  L.push('### 待补清单（进入生成前必须闭合）');
  const seen = new Set();
  let ci = 0;
  for (const p of pending) {
    if (seen.has(p)) continue;
    seen.add(p);
    L.push(`${++ci}. ${p}`);
  }
  if (!ci) L.push('（无——但仍须经用户抽检确认后方可进生成。）');
  L.push('');
  L.push('> 终审抽检依据：`docs/信任配方-保留清单.md`（真实数据先行、推算透明、风险直说、保守口径、不夸大收益）。');
  L.push('');

  return { md: L.join('\n'), stats: { products: products.length, wantsCount: wants.count, tops: topEntries.length, pending: ci } };
}

// ------------------------------- 主流程 -------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const capturePath = path.resolve(args.capture);
  let cap;
  try {
    cap = JSON.parse(readFileSync(capturePath, 'utf8'));
  } catch (e) {
    fail(`读取/解析 capture.json 失败：${e.message}`);
  }

  // 拒绝组装的情形
  if (cap.status === 'no_results') {
    console.error(`[拒绝组装] capture.status = no_results：「${cap.query}」在闲鱼无搜索结果，无可用同行数据。`);
    console.error(`[提示] ${cap.status_note || '换等价具体产品词重新采集后再组装。'}`);
    process.exit(2);
  }
  if (!Array.isArray(cap.products) || cap.products.length === 0) {
    console.error(`[拒绝组装] capture.products 为空（status=${cap.status}），无同行数据可组装。`);
    if (cap.status_note) console.error(`[提示] ${cap.status_note}`);
    process.exit(2);
  }
  if (cap.status && cap.status !== 'ok' && cap.status !== 'verified') {
    log(`警告：capture.status = ${cap.status}（非 ok），已有 ${cap.products.length} 条商品，继续组装但请人工确认采集完整性。`);
  }

  const { md, stats } = buildMarkdown(cap, args);

  const outPath = path.resolve(args.out);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, md, 'utf8');

  log(`已组装：${outPath}`);
  log(`采集商品 ${stats.products} 条｜显示想要 ${stats.wantsCount} 条｜Top 明细 ${stats.tops} 项｜待补 ${stats.pending} 项`);
  log('状态：草稿——未经用户抽检不得进生成。');
}

main();
