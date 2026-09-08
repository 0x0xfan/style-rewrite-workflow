// corpus-pack.mjs —— 真人语料包（docs/真人语料包/总表.json）的读取 / 过滤 / 抽样 / 渲染 / 写回
// build-brief.mjs（抽范文进配料包）和 mark-used.mjs（定稿后写回"用过的期"）共用。
//
// 总表结构：{ openings: [...], sayings: [...], voices: [...], authors: [...], 写回顺序?: [...] }
//   openings 每条：id / 切入方式 / 切入大类 / 结构 / 步数 / 口播要压缩 / 适合 / 品类 / 作者 / 出处 / 用过的期
//     切入大类：merge-pack 按 engine/corpus-pack/opening-types.json 贴的十几个大类名（没归到的是"待定"）；切入方式是抽取人各自起的原名
//   sayings  每条：id / 原句 / 作者 / 文章 / 场景 A–J / 子场景（E 才有）/ 亲历 / 品类 / 口播 / 含收入数字 / 立场? / 用过的期
//   voices   每条：id / 谁说的 / 原句 / 情境 / 品类 / 出处 / 含收入数字 /（用过的期，写回后才有）
//   写回顺序：mark-used 维护的期号列表，按写回先后；"最近两期"按它算。没有这个键时按各条"用过的期"出现顺序推。
//
// 抽样要可复现：同样参数同样结果。做法是稳定排序（先按优先级档，再按 hash(episode|id)），不用随机数。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_PACK = 'docs/真人语料包/总表.json';

export const SCENE_NAMES = {
  A: '以前怎么做、现在怎么做',
  B: '报一个数',
  C: '讲退款、售后',
  D: '讲定价',
  E: '劝新手',
  F: '替读者提问，然后接一句',
  G: '转场',
  H: '块尾收口',
  I: '结尾和资料钩子',
  J: '讲虚拟品怎么交付、券和资料的规矩',
};

export function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
}

// ───────────────────────── 读 / 写 ─────────────────────────

/** 读总表并校验顶层结构；出错抛 Error。返回 { abs, data, rawText }。 */
export function loadPack(p = DEFAULT_PACK) {
  const abs = resolvePath(p);
  if (!fs.existsSync(abs)) throw new Error(`真人语料包文件不存在：${abs}`);
  const rawText = fs.readFileSync(abs, 'utf8');
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    throw new Error(`真人语料包不是合法 JSON：${abs}（${e.message}）`);
  }
  for (const k of ['openings', 'sayings', 'voices']) {
    if (!Array.isArray(data[k])) throw new Error(`真人语料包缺 ${k} 数组：${abs}`);
  }
  const seen = new Set();
  for (const layer of ['openings', 'sayings', 'voices']) {
    data[layer].forEach((e, i) => {
      if (!e || typeof e.id !== 'string' || !e.id) throw new Error(`真人语料包 ${layer} 第 ${i + 1} 条没有 id`);
      if (seen.has(e.id)) throw new Error(`真人语料包里编号重复：${e.id}`);
      seen.add(e.id);
    });
  }
  return { abs, data, rawText };
}

/** 猜原文件的缩进宽度（合表脚本写的是 1），猜不出来返回 fallback。 */
export function detectIndent(rawText, fallback = 2) {
  const m = rawText.match(/^\{\r?\n( +)"/);
  return m ? m[1].length : fallback;
}

/** 按 id 找条目；返回 { entry, layer } 或 null。 */
export function findById(data, id) {
  for (const layer of ['openings', 'sayings', 'voices']) {
    const entry = data[layer].find((e) => e.id === id);
    if (entry) return { entry, layer };
  }
  return null;
}

/**
 * 把 episode 追加进这些条目的"用过的期"，同时维护顶层"写回顺序"。
 * 只改内存对象，不落盘。返回 { touched: [id...], already: [id...] }。
 * 找不到的 id 先整体报错（抛 Error），一条都不改。
 */
export function markUsed(data, episode, ids) {
  const missing = ids.filter((id) => !findById(data, id));
  if (missing.length) throw new Error(`真人语料包里找不到这些编号：${missing.join('、')}`);
  const touched = [];
  const already = [];
  for (const id of ids) {
    const { entry } = findById(data, id);
    if (!Array.isArray(entry.用过的期)) entry.用过的期 = [];
    if (entry.用过的期.includes(episode)) { already.push(id); continue; }
    entry.用过的期.push(episode);
    touched.push(id);
  }
  if (!Array.isArray(data.写回顺序)) data.写回顺序 = deriveEpisodeOrder(data);
  if (!data.写回顺序.includes(episode)) data.写回顺序.push(episode);
  return { touched, already };
}

/** 没有"写回顺序"键时，按各条"用过的期"在文件里出现的先后推一个顺序。 */
export function deriveEpisodeOrder(data) {
  const order = [];
  for (const layer of ['openings', 'sayings', 'voices']) {
    for (const e of data[layer]) {
      for (const ep of e.用过的期 || []) if (!order.includes(ep)) order.push(ep);
    }
  }
  return order;
}

/**
 * 本 episode 生成时要避开的期：本期 + 最近写回的两期（不含本期）。
 */
export function recentEpisodes(data, episode) {
  const order = Array.isArray(data.写回顺序) ? data.写回顺序 : deriveEpisodeOrder(data);
  const others = order.filter((ep) => ep !== episode);
  const avoid = new Set(others.slice(-2));
  if (episode) avoid.add(episode);
  return avoid;
}

// ───────────────────────── 确定性打乱 ─────────────────────────

/** FNV-1a 32 位，对 UTF-8 字节算。同样的字符串永远同样的数。 */
export function fnv1a(str) {
  const bytes = Buffer.from(String(str), 'utf8');
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 按 (tier, hash(seed|id), id) 稳定排序。tierOf(entry) 越小越优先。 */
export function stableOrder(entries, seed, tierOf = () => 0) {
  return entries
    .map((e) => ({ e, tier: tierOf(e), h: fnv1a(`${seed}|${e.id}`) }))
    .sort((a, b) => a.tier - b.tier || a.h - b.h || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0))
    .map((x) => x.e);
}

// ───────────────────────── 过滤 ─────────────────────────

/**
 * 三层共用的硬过滤。返回 null = 留下；返回字符串 = 剔除原因。
 * opts: { topicType: '虚拟'|'实物'|'', avoidEpisodes: Set, dropIncome: bool }
 */
export function rejectReason(entry, opts) {
  const { topicType, avoidEpisodes, dropIncome } = opts;
  if (topicType === '虚拟') {
    if (entry.品类 === '实物专用') return '品类=实物专用（虚拟选题剔除）';
    if (entry.立场 === '反虚拟') return '立场=反虚拟（虚拟选题剔除）';
  } else if (topicType === '实物') {
    if (entry.品类 === '虚拟专用') return '品类=虚拟专用（实物选题剔除）';
  }
  if (entry.口播 === '图文腔') return '口播=图文腔';
  if (dropIncome && entry.含收入数字 === true) return '含收入数字';
  const used = Array.isArray(entry.用过的期) ? entry.用过的期 : [];
  if (avoidEpisodes && used.some((ep) => avoidEpisodes.has(ep))) return '用过的期含本期或最近两期';
  return null;
}

function applyFilter(entries, opts) {
  const kept = [];
  const dropped = {};
  for (const e of entries) {
    const r = rejectReason(e, opts);
    if (r) dropped[r] = (dropped[r] || 0) + 1;
    else kept.push(e);
  }
  return { kept, dropped };
}

/** 说法 / 原声的优先级档：口播 ✅ 先于 ？；亲历 纯措辞 先于 含亲历。 */
function sayingTier(e) {
  const koubo = e.口播 === '✅' ? 0 : 1;
  const qinli = e.亲历 === '纯措辞' ? 0 : 1;
  return koubo * 2 + qinli;
}

// ───────────────────────── 抽样 ─────────────────────────

function normType(s) {
  return String(s || '').replace(/[“”"]/g, '').replace(/\s+/g, '').toLowerCase();
}

/** 总表开头层里出现过的切入大类名（去重、按出现顺序），给报错和 --help 用。 */
export function openingTypeNames(data) {
  const out = [];
  for (const e of data.openings || []) { const t = e.切入大类; if (t && !out.includes(t)) out.push(t); }
  return out;
}

/**
 * 按切入大类 / 切入方式抽开头结构。匹配顺序：
 *   1. 请求名 == 总表"切入大类"（精确，忽略空格和引号）→ "大类精确匹配"
 *   2. 请求名是总表"切入方式"的子串 → "包含匹配"（旧行为，兼容没归类的名字）
 *   3. 按 " + " 拆成片段，任一片段包含匹配 → "部分匹配"
 * 返回 { picked, dropped, perType: [{type, mode, candidates, got}], unmatched: [type...] }
 */
export function pickOpenings(data, { types, n, seed, topicType, avoidEpisodes }) {
  const { kept, dropped } = applyFilter(data.openings, { topicType, avoidEpisodes, dropIncome: false });
  const tierOf = (e) => (e.口播要压缩 === true || Number(e.步数) > 5 ? 1 : 0);
  const pools = [];
  const unmatched = [];
  for (const type of types) {
    const key = normType(type);
    let mode = '大类精确匹配';
    let cands = kept.filter((e) => e.切入大类 && normType(e.切入大类) === key);
    if (!cands.length) {
      mode = '包含匹配';
      cands = kept.filter((e) => normType(e.切入方式).includes(key));
    }
    if (!cands.length) {
      const pieces = String(type).split(/\s*\+\s*/).map(normType).filter((s) => s.length >= 2);
      if (pieces.length > 1) {
        cands = kept.filter((e) => pieces.some((p) => normType(e.切入方式).includes(p)));
        mode = `部分匹配（按"${pieces.join('" / "')}"任一片段）`;
      }
    }
    if (!cands.length) { unmatched.push(type); pools.push({ type, mode: '无匹配', candidates: 0, list: [], got: 0 }); continue; }
    pools.push({ type, mode, candidates: cands.length, list: stableOrder(cands, `${seed}|opening|${type}`, tierOf), got: 0 });
  }
  // 轮转分配：按请求顺序每个切入方式各取一条，取满 n 或全空为止
  const picked = [];
  const taken = new Set();
  let progress = true;
  while (picked.length < n && progress) {
    progress = false;
    for (const pool of pools) {
      if (picked.length >= n) break;
      while (pool.list.length) {
        const e = pool.list.shift();
        if (taken.has(e.id)) continue;
        taken.add(e.id);
        picked.push({ ...e, _matchedType: pool.type });
        pool.got++;
        progress = true;
        break;
      }
    }
  }
  return {
    picked,
    dropped,
    perType: pools.map(({ type, mode, candidates, got }) => ({ type, mode, candidates, got })),
    unmatched,
    poolSize: kept.length,
  };
}

/** "E:动作" → { scene: 'E', sub: '动作' }；"B" → { scene: 'B', sub: '' } */
export function parseSceneSpec(spec) {
  const [scene, sub = ''] = String(spec).trim().split(/[:：]/);
  return { scene: scene.trim().toUpperCase(), sub: sub.trim(), label: sub ? `${scene.trim().toUpperCase()}:${sub.trim()}` : scene.trim().toUpperCase() };
}

/**
 * 按场景均分抽说法。n 条按场景数均分，余数给排前面的场景；某场景不够的名额轮给别的场景。
 * 返回 { picked（带 _sceneSpec）, dropped, perScene: [{label, candidates, quota, got}], poolSize }
 */
export function pickSayings(data, { scenes, n, seed, topicType, avoidEpisodes, authors }) {
  let base = data.sayings;
  let droppedAuthor = 0;
  if (authors && authors.length) {
    const set = new Set(authors);
    const before = base.length;
    base = base.filter((e) => set.has(e.作者));
    droppedAuthor = before - base.length;
  }
  const { kept, dropped } = applyFilter(base, { topicType, avoidEpisodes, dropIncome: true });
  if (droppedAuthor) dropped['作者不在 --authors 里'] = droppedAuthor;

  const specs = scenes.map(parseSceneSpec);
  const pools = specs.map((s) => {
    const cands = kept.filter((e) => e.场景 === s.scene && (!s.sub || e.子场景 === s.sub));
    return { ...s, candidates: cands.length, list: stableOrder(cands, `${seed}|saying|${s.label}`, sayingTier), quota: 0, got: 0 };
  });
  const k = pools.length;
  if (k) {
    const basePer = Math.floor(n / k);
    let rem = n - basePer * k;
    for (const p of pools) { p.quota = basePer + (rem > 0 ? 1 : 0); if (rem > 0) rem--; }
  }
  const picked = [];
  const taken = new Set();
  const takeOne = (pool) => {
    while (pool.list.length) {
      const e = pool.list.shift();
      if (taken.has(e.id)) continue;
      taken.add(e.id);
      picked.push({ ...e, _sceneSpec: pool.label });
      pool.got++;
      return true;
    }
    return false;
  };
  // 第一轮：各按配额取
  for (const pool of pools) while (pool.got < pool.quota && takeOne(pool));
  // 第二轮：没取满的名额轮给还有货的场景
  let progress = true;
  while (picked.length < n && progress) {
    progress = false;
    for (const pool of pools) {
      if (picked.length >= n) break;
      if (takeOne(pool)) progress = true;
    }
  }
  return {
    picked,
    dropped,
    perScene: pools.map(({ label, candidates, quota, got }) => ({ label, candidates, quota, got })),
    poolSize: kept.length,
  };
}

/** 抽原声。含收入数字的可以进，但标注；优先不含收入数字的。 */
export function pickVoices(data, { n, seed, topicType, avoidEpisodes }) {
  const { kept, dropped } = applyFilter(data.voices, { topicType, avoidEpisodes, dropIncome: false });
  const ordered = stableOrder(kept, `${seed}|voice`, (e) => (e.含收入数字 === true ? 1 : 0));
  return { picked: ordered.slice(0, n), dropped, poolSize: kept.length };
}

// ───────────────────────── 渲染 ─────────────────────────

function cell(s) {
  return String(s ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

export function renderOpenings(picked) {
  const head = '| 编号 | 大类 | 切入方式 | 结构（⓪ = 自报家门 / 合同句的位置） | 步数 | 适合讲什么 | 作者 |\n|---|---|---|---|---|---|---|';
  const rows = picked.map((e) => {
    const steps = `${e.步数 ?? ''}${e.口播要压缩 === true || Number(e.步数) > 5 ? '，口播要压缩' : ''}`;
    return `| ${cell(e.id)} | ${cell(e.切入大类 || '')} | ${cell(e.切入方式)} | ${cell(e.结构)} | ${cell(steps)} | ${cell(e.适合)} | ${cell(e.作者)} |`;
  });
  return `${head}\n${rows.join('\n')}`;
}

function qinliMark(e) {
  if (e.亲历 === '纯措辞') return '纯措辞';
  if (e.亲历 === '本人亲历') return '本人亲历（圣矾旧期的事，不许引旧期，事要换成本期的）';
  return '含作者亲历（里面的事要换成圣矾的）';
}

export function renderSayings(picked, sceneLabels) {
  const groups = new Map();
  for (const label of sceneLabels) groups.set(label, []);
  for (const e of picked) {
    if (!groups.has(e._sceneSpec)) groups.set(e._sceneSpec, []);
    groups.get(e._sceneSpec).push(e);
  }
  const out = [];
  for (const [label, list] of groups) {
    const { scene, sub } = parseSceneSpec(label);
    const title = `### 场景 ${scene} · ${SCENE_NAMES[scene] || ''}${sub ? `（子场景：${sub}）` : ''}（${list.length} 条）`;
    if (!list.length) { out.push(`${title}\n\n（过滤后没剩下能用的。）`); continue; }
    const head = '| 编号 | 原句 | 作者 | 亲历标记 | 场景 |\n|---|---|---|---|---|';
    const rows = list.map((e) => {
      const koubo = e.口播 === '？' ? '；口播拿不准，念一遍再用' : '';
      return `| ${cell(e.id)} | ${cell(e.原句)} | ${cell(e.作者)} | ${cell(qinliMark(e) + koubo)} | ${cell(e.场景 + (e.子场景 ? ' · ' + e.子场景 : ''))} |`;
    });
    out.push(`${title}\n\n${head}\n${rows.join('\n')}`);
  }
  return out.join('\n\n');
}

export function renderVoices(picked) {
  const head = '| 编号 | 谁说的 | 原句 | 情境 | 出处 |\n|---|---|---|---|---|';
  const rows = picked.map((e) => {
    const income = e.含收入数字 === true ? '（含收入数字，只学引原话的形）' : '';
    return `| ${cell(e.id)} | ${cell(e.谁说的)} | ${cell(e.原句)}${income} | ${cell(e.情境)} | ${cell(e.出处)} |`;
  });
  return `${head}\n${rows.join('\n')}`;
}

/** 过滤统计 → 一行文字，如 "品类=实物专用 7 / 用过的期 3" */
export function droppedSummary(dropped) {
  const ks = Object.keys(dropped);
  return ks.length ? ks.map((k) => `${k} ${dropped[k]}`).join(' / ') : '无';
}
