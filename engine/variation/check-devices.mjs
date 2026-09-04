#!/usr/bin/env node
// 装置轮换 / 新系列铁律检查器。
//
// 与既有两把尺子的分工：
//   check-repetition.mjs —— 查"几篇产出之间字面重不重"（n-gram 比例）。
//   check-source-leakage —— 查"和原文重不重"。
//   本文件            —— 查"同一个信任装置的同一句表面写法，是不是每期都在用"，
//                       以及"稿子里有没有把新系列写成老系列的第 N 计/第 N 期"。
//
// 起因（用户 2026-09-03 对五篇钱十七草稿的原话反馈）：
//   1. "价钱比我当时录第四十一计那会儿还往上抬了一截" —— 新片是全新系列，不许带期号/系列名/上次讲过。
//   2. "我发现基本上你每一期都在用这种内容来点这3类人" —— 装置要保留，表面写法必须每期换。
//
// 判定口径：
//   seriesReference —— 命中任一条即 fail（硬阻断，进重写循环）。
//   devices.scope=phrase —— 同一 patternId 在当前稿与任一历史稿里都命中 → fail（同一句式跨期复用）。
//   devices.scope=device —— 同一 deviceId 在当前稿与任一历史稿里都命中 → fail（整个导航手法该换）。
//   devices.scope=banned —— 整个手法已停用，**不看历史池，命中即 fail**。
//
// 2026-09-03 追加（主线程对 docs/AI味治理-外部对照.md §6 第 3 问的裁定）：
//   「受众分流三类人」从「轮换」改为「彻底停用」（scope=banned）。理由是真人 12 期一次都没用过
//   （docs/用户文案模式研究.md §3.1），真人在那个位置放的是弹幕互动小钩子；五篇仿写却篇篇都有。
//   另新增「收口动作序列」（打开闲鱼→搜→数→评论区）作 phrase 级轮换（同上文 §3.5）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DEVICE_RULES = JSON.parse(readFileSync(join(here, 'device-rules.json'), 'utf8'));

// 正文提取：与 check-repetition 同口径（剔 HTML 注释、markdown 标题/引用/分隔线），但**保留标点**，
// 因为本层的指纹是句式（带逗号、顿号），去掉标点会漏判。只压掉空白。
export function bodyOf(text) {
  return String(text)
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => !l.startsWith('#') && !l.startsWith('>') && l.trim() !== '---')
    .join('\n')
    .replace(/[ \t\r]+/g, '');
}

// 命中处所在的整句（供人工核对误伤 + 回给模型重写）。
function sentenceAt(body, index, maxLen = 46) {
  const seps = '。！？\n';
  let start = index;
  while (start > 0 && !seps.includes(body[start - 1])) start--;
  let end = index;
  while (end < body.length && !seps.includes(body[end])) end++;
  const s = body.slice(start, end).trim();
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
}

// --- 新系列铁律 ---
// 返回 { clean, hits:[{id,label,match,sentence}] }。
export function checkSeriesReference(text, rules = DEVICE_RULES) {
  const body = bodyOf(text);
  const hits = [];
  for (const r of rules.seriesReference || []) {
    const re = new RegExp(r.pattern, 'g');
    for (const m of body.matchAll(re)) {
      hits.push({ id: r.id, label: r.label, match: m[0], sentence: sentenceAt(body, m.index) });
    }
  }
  // 同一条规则只报第一处，避免刷屏；不同规则各报一处。
  const seen = new Set();
  const uniq = hits.filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)));
  return { clean: uniq.length === 0, hits: uniq, totalHits: hits.length };
}

// --- 装置指纹 ---
// 返回 [{ deviceId, deviceName, scope, patternId, match, sentence }]，同一 patternId 只留第一处。
export function matchDevices(text, rules = DEVICE_RULES) {
  const body = bodyOf(text);
  const out = [];
  const seen = new Set();
  for (const d of rules.devices || []) {
    for (const p of d.patterns || []) {
      const re = new RegExp(p.pattern, 'g');
      const m = re.exec(body);
      if (!m) continue;
      const key = `${d.id}::${p.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        deviceId: d.id, deviceName: d.name, scope: d.scope, mandatory: !!d.mandatory,
        patternId: p.id, patternLabel: p.label || '', match: m[0], sentence: sentenceAt(body, m.index)
      });
    }
  }
  return out;
}

// 停用装置（scope=banned）：不看历史池，命中即 fail。
// 返回 { clean, hits:[{deviceId,deviceName,patternId,match,sentence,reason,rotations}] }。
export function checkBannedDevices(text, rules = DEVICE_RULES) {
  const hits = matchDevices(text, rules)
    .filter((h) => h.scope === 'banned')
    .map((h) => {
      const dev = (rules.devices || []).find((d) => d.id === h.deviceId) || {};
      return { ...h, reason: dev.bannedReason || '该手法已停用', rotations: dev.rotations || [] };
    });
  // 同一个停用装置只报一次（报第一处命中即可，避免刷屏）。
  const seen = new Set();
  const uniq = hits.filter((h) => (seen.has(h.deviceId) ? false : (seen.add(h.deviceId), true)));
  return { clean: uniq.length === 0, hits: uniq };
}

// 当前稿 vs 历史稿池。history = { 稿件名: 全文 }。
// 返回 { clean, reused:[{deviceId,deviceName,scope,patternId,match,sentence,docs:[]}], banned, current }。
// clean 同时要求「没有跨期复用」且「没命中停用装置」——停用那条与历史池无关，池子为空也拦。
export function checkDeviceReuse(text, history = {}, rules = DEVICE_RULES) {
  const current = matchDevices(text, rules);
  const histHits = {};   // name -> matchDevices 结果
  for (const [name, doc] of Object.entries(history)) histHits[name] = matchDevices(doc, rules);

  const reused = [];
  for (const cur of current) {
    if (cur.scope === 'banned') continue;   // 停用装置走 checkBannedDevices，不按「复用」判
    const docs = [];
    for (const [name, hits] of Object.entries(histHits)) {
      const same = cur.scope === 'device'
        ? hits.some((h) => h.deviceId === cur.deviceId)
        : hits.some((h) => h.patternId === cur.patternId);
      if (same) docs.push(name);
    }
    if (docs.length) {
      const dev = (rules.devices || []).find((d) => d.id === cur.deviceId);
      reused.push({ ...cur, docs, rotations: (dev && dev.rotations) || [] });
    }
  }
  const banned = checkBannedDevices(text, rules);
  return {
    clean: reused.length === 0 && banned.clean,
    reused, banned: banned.hits, current,
    historyDocCount: Object.keys(history).length
  };
}

// --- 规则自审（结构性误伤体检） ---
//
// 2026-09-03 三改的起因：a7-action-instruction 是 mandatory + mustChoose + scope=phrase，
// 「每篇必写」，但它的 4 条粗 pattern 把自家 16 条轮换池里的 14 条都拦了下来
// —— 于是任意两篇只要都按规矩从池子里挑说法，就必然撞同一个 patternId，checkDeviceReuse
// 判 FAIL，五篇里没有一篇可能 PASS。**pattern 拦的是解药，不是病。**
//
// 这个函数把那条病灶写成可执行的不变量，engine/tests/device-rotation.test.mjs 每次 npm test 都跑：
//
//   规则 A（所有组）：一个组的轮换池（rotations，即「我们叫作者改成这么写」）
//                     不许命中该组自己的 pattern（即「我们判作者写旧了」）。
//                     命中 = 我们一边发药一边判它是病，作者无路可走。
//   规则 B（patternsCoverRotations=true 的组，目前只有 a7）：pattern 与 rotations 一一对应
//                     —— 每条池子恰好命中一条自家 pattern，且不同池子命中不同 pattern（双射）。
//                     这正是「五篇各取不同池条目 → PASS，两篇取同一条 → FAIL」的充要条件。
//
// 返回 { clean, problems:[{deviceId, kind, detail}] }。
export function auditDeviceRules(rules = DEVICE_RULES) {
  const problems = [];
  for (const d of rules.devices || []) {
    // 规则 C：scope=device（「这个装置近期用过就换别的」）与 mustChoose（「每期必须选一种」）不能并存
    // —— 合起来是「每期必写、写了就判复用」，恒 FAIL。同 a7 的病，走 deviceId 那条路。
    if (d.scope === 'device' && d.mustChoose) {
      problems.push({
        deviceId: d.id, kind: 'scope-mustchoose-conflict',
        detail: 'scope=device（装置级复用判定）与 mustChoose=true（每期必写）打架：每期必写 ⇒ 装置必然出现在历史池里 ⇒ 恒 FAIL。要么改 scope=phrase（轮换说法），要么去掉 mustChoose。'
      });
    }

    const pats = d.patterns || [];
    const rots = d.rotations || [];
    if (!rots.length || !pats.length) continue;

    if (d.patternsCoverRotations) {
      // 规则 B：双射。
      if (pats.length !== rots.length) {
        problems.push({
          deviceId: d.id, kind: 'cover-count',
          detail: `patternsCoverRotations 组要求 pattern 数 = 轮换池条数，现在是 ${pats.length} vs ${rots.length}`
        });
      }
      const usedBy = new Map();  // patternId -> 轮换池下标
      rots.forEach((rot, i) => {
        const hit = pats.filter((p) => new RegExp(p.pattern).test(rot));
        if (hit.length !== 1) {
          problems.push({
            deviceId: d.id, kind: 'cover-not-one',
            detail: `轮换池第 ${i + 1} 条命中 ${hit.length} 条自家 pattern（应恰好 1 条）：${rot.slice(0, 28)}… → [${hit.map((h) => h.id).join(',') || '无'}]`
          });
          return;
        }
        const id = hit[0].id;
        if (usedBy.has(id)) {
          problems.push({
            deviceId: d.id, kind: 'cover-collision',
            detail: `pattern ${id} 同时命中轮换池第 ${usedBy.get(id) + 1} 条与第 ${i + 1} 条——两条池子共用一个 patternId，作者按规矩换说法也会被判复用`
          });
        } else usedBy.set(id, i);
      });
    } else {
      // 规则 A：轮换池不许自撞。
      rots.forEach((rot, i) => {
        for (const p of pats) {
          if (!new RegExp(p.pattern).test(rot)) continue;
          problems.push({
            deviceId: d.id, kind: 'rotation-self-hit',
            detail: `轮换池第 ${i + 1} 条命中自家 pattern ${p.id}：${rot.slice(0, 34)}…`
          });
        }
      });
    }
  }
  return { clean: problems.length === 0, problems };
}

// 历史稿池 → 「近期已用句式清单」（注入提示词用）。
// 返回 [{ deviceId, deviceName, scope, patternId, sentence, docs:[] }]，按命中篇数降序（越常用越该躲开）。
export function buildUsedDeviceList(history = {}, rules = DEVICE_RULES, limit = 30) {
  const agg = new Map();  // key -> 记录
  for (const [name, doc] of Object.entries(history)) {
    for (const h of matchDevices(doc, rules)) {
      if (h.scope === 'banned') continue;  // 停用装置在提示词里单独有「禁用」段，不进「已用清单」
      const key = h.scope === 'device' ? `dev::${h.deviceId}` : `pat::${h.patternId}`;
      if (!agg.has(key)) agg.set(key, { ...h, docs: [], samples: [] });
      const rec = agg.get(key);
      if (!rec.docs.includes(name)) rec.docs.push(name);
      if (rec.samples.length < 2 && !rec.samples.includes(h.sentence)) rec.samples.push(h.sentence);
    }
  }
  return [...agg.values()]
    .sort((a, b) => (b.docs.length - a.docs.length) || a.deviceId.localeCompare(b.deviceId))
    .slice(0, limit);
}

// --- CLI ---
// 用法: node engine/variation/check-devices.mjs <当前稿> [--history <历史稿...>]
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const cur = [];
  const hist = [];
  let bucket = cur;
  for (const a of argv) {
    if (a === '--history') { bucket = hist; continue; }
    bucket.push(a);
  }
  if (!cur.length) {
    console.error('用法: node engine/variation/check-devices.mjs <当前稿> [--history <历史稿...>]');
    console.error('  查两件事：① 新系列铁律（期号/系列名/上次讲过 → 硬阻断）；② 装置表面写法跨期复用。');
    process.exit(2);
  }
  const text = readFileSync(cur[0], 'utf8');
  const history = {};
  for (const f of hist) history[basename(dirname(dirname(dirname(f)))) || basename(f)] = readFileSync(f, 'utf8');

  const audit = auditDeviceRules();
  if (!audit.clean) {
    console.log('规则自审: FAIL（device-rules.json 结构性误伤，先修规则再看稿）');
    for (const p of audit.problems) console.log(`  [RULES] ${p.deviceId} / ${p.kind}：${p.detail}`);
    console.log('');
  }

  const sr = checkSeriesReference(text);
  console.log(`当前稿: ${cur[0]}`);
  console.log(`\n新系列铁律: ${sr.clean ? 'PASS' : 'FAIL'}`);
  for (const h of sr.hits) console.log(`  [FAIL] ${h.label}：命中「${h.match}」\n         原句: ${h.sentence}`);

  const dr = checkDeviceReuse(text, history);
  console.log(`\n装置轮换（对比池 ${dr.historyDocCount} 篇）: ${dr.clean ? 'PASS' : 'FAIL'}`);
  for (const b of dr.banned) {
    console.log(`  [FAIL] ${b.deviceName}（已停用，与历史池无关）命中「${b.match}」`);
    console.log(`         原句: ${b.sentence}`);
    console.log(`         停用理由: ${b.reason}`);
    if (b.rotations.length) console.log(`         改用: ${b.rotations[0]}`);
  }
  for (const r of dr.reused) {
    console.log(`  [FAIL] ${r.deviceName}（${r.scope === 'device' ? '整个装置该换' : '同一句式复用'}）命中「${r.match}」`);
    console.log(`         原句: ${r.sentence}`);
    if (r.patternLabel) console.log(`         撞的池条: ${r.patternLabel}`);
    console.log(`         历史里也有: ${r.docs.join('、')}`);
  }
  if (!hist.length) console.log('  （未给历史稿，仅做当期指纹清点）');
  console.log(`\n本期用到的装置指纹 ${dr.current.length} 处：${dr.current.map((c) => c.deviceName + '/' + c.patternId).join('、') || '（无）'}`);
  console.log(`\n结果: ${sr.clean && dr.clean ? 'PASS' : 'FAIL'}`);
  process.exit(sr.clean && dr.clean ? 0 : 1);
}
