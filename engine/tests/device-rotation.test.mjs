// A7 互动指令层轮换池 × 跨稿复用判定的回归测试。
//
// 起因（2026-09-03，五个 worker 一致报告的同一条误伤）：
//   devices[a7-action-instruction] 是 mandatory + mustChoose + scope=phrase —— 每篇必写。
//   但它只有 4 条粗粒度 pattern，而轮换池有 16 条（开场5/干货5/结尾6），
//   16 条里有 14 条会命中那 4 条粗 pattern 中的某一条。
//   checkDeviceReuse 按 patternId 判跨稿复用 ⇒ 任意两篇只要都按规矩从池子里挑说法，
//   就必然撞同一个 patternId ⇒ 五篇里没有任何一篇可能 PASS。**pattern 拦的是解药，不是病。**
//
// 修法 (a)：pattern 拆到与 16 条轮换池一一对应，正则只匹配该条的骨架。
// 本文件锁三件事：
//   ① 规则结构自审（auditDeviceRules）干净 —— 这条同时体检其余所有 mandatory / mustChoose 组；
//   ② 五篇各取不同池条目 → A7 组判 PASS；
//   ③ 两篇取同一条池条目 → A7 组判 FAIL，且报出的 patternId 就是那一条。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_RULES, matchDevices, checkDeviceReuse, auditDeviceRules
} from '../variation/check-devices.mjs';

const A7 = DEVICE_RULES.devices.find((d) => d.id === 'a7-action-instruction');

// 轮换池条目 → 去掉「开场位：」这类槽位前缀，得到作者实际会写进稿子的句子。
const poolLine = (i) => A7.rotations[i].replace(/^[^：]*：/, '');

// 只看 A7 组的复用判定（其余装置组由 repetition / 各自的测试覆盖）。
const a7Reused = (text, history) =>
  checkDeviceReuse(text, history).reused.filter((r) => r.deviceId === 'a7-action-instruction');

// 一篇最小可用的稿：三个位置各挑一条池条目，外加一点无关正文。
function draft({ open, mid, end }) {
  return [
    '闲鱼上搜这个词，第一页三十条里有十一条想要过百。',
    poolLine(open),
    '这一段是推算，不是实数，拿货价我没核实，一分钱净利都不报给你。',
    poolLine(mid),
    '这里头最硬的一条风险是掉签，上架就把话说明白。',
    poolLine(end),
  ].join('\n');
}

test('device-rules 结构自审：轮换池不许命中自家 pattern，A7 的 pattern 与池子一一对应', () => {
  const { clean, problems } = auditDeviceRules();
  assert.equal(clean, true, '规则自审有问题:\n' + problems.map((p) => `  ${p.deviceId} / ${p.kind}: ${p.detail}`).join('\n'));
});

test('A7 pattern 数与轮换池条数一致，且 id 命名与槽位对齐', () => {
  assert.equal(A7.patterns.length, 16);
  assert.equal(A7.rotations.length, 16);
  assert.equal(A7.mandatory, true);
  assert.equal(A7.mustChoose, true);
  assert.equal(A7.scope, 'phrase');
  const ids = A7.patterns.map((p) => p.id);
  assert.deepEqual(ids.slice(0, 5), ['a7-open-1', 'a7-open-2', 'a7-open-3', 'a7-open-4', 'a7-open-5']);
  assert.deepEqual(ids.slice(5, 10), ['a7-mid-1', 'a7-mid-2', 'a7-mid-3', 'a7-mid-4', 'a7-mid-5']);
  assert.deepEqual(ids.slice(10), ['a7-end-1', 'a7-end-2', 'a7-end-3', 'a7-end-4', 'a7-end-5', 'a7-end-6']);
  // 每条 pattern 都带 label（FAIL 报告里要打印「撞的池条」）。
  for (const p of A7.patterns) assert.ok(p.label && p.label.length > 6, `${p.id} 缺 label`);
});

test('每条池条目都能被指纹认出来，且只认成它自己那一条', () => {
  for (let i = 0; i < 16; i++) {
    const hits = matchDevices(poolLine(i)).filter((h) => h.deviceId === 'a7-action-instruction');
    assert.equal(hits.length, 1, `轮换池第 ${i + 1} 条命中 ${hits.length} 条 A7 pattern：${poolLine(i)}`);
    assert.equal(hits[0].patternId, A7.patterns[i].id, `轮换池第 ${i + 1} 条认成了 ${hits[0].patternId}`);
  }
});

test('五篇各取不同池条目 → A7 组 PASS（这就是修复前必然 FAIL 的那一档）', () => {
  // 开场取池内第 1–5 条、干货取第 6–10 条、结尾取第 11–15 条，正是五个 worker 的实际取法。
  const names = ['甲', '乙', '丙', '丁', '戊'];
  const drafts = names.map((n, k) => [n, draft({ open: k, mid: 5 + k, end: 10 + k })]);
  for (const [name, text] of drafts) {
    const history = Object.fromEntries(drafts.filter(([n]) => n !== name));
    const reused = a7Reused(text, history);
    assert.deepEqual(reused, [], `${name} 篇被误判复用：${JSON.stringify(reused.map((r) => r.patternId))}`);
    // 每篇仍然留下三处 A7 指纹（装置在，不是靠"写没写"蒙混过关）。
    const fp = matchDevices(text).filter((h) => h.deviceId === 'a7-action-instruction');
    assert.equal(fp.length, 3, `${name} 篇 A7 指纹应为 3 处`);
  }
});

test('两篇取同一条池条目 → A7 组 FAIL，且指出撞的是哪一条', () => {
  const a = draft({ open: 0, mid: 5, end: 10 });
  const b = draft({ open: 1, mid: 6, end: 10 });   // 结尾撞第 11 条（a7-end-1）
  const reused = a7Reused(a, { 乙: b });
  assert.equal(reused.length, 1);
  assert.equal(reused[0].patternId, 'a7-end-1');
  assert.deepEqual(reused[0].docs, ['乙']);
  assert.match(reused[0].patternLabel, /结尾位1/);
});

test('三个位置全撞 → 三条 FAIL 全报出来', () => {
  const a = draft({ open: 2, mid: 7, end: 12 });
  const reused = a7Reused(a, { 乙: draft({ open: 2, mid: 7, end: 12 }) });
  assert.deepEqual(reused.map((r) => r.patternId).sort(), ['a7-end-3', 'a7-mid-3', 'a7-open-3']);
});

test('没有任何组同时是 scope=device 与 mustChoose（每期必写 + 装置级复用判定 = 恒 FAIL）', () => {
  // 修复前：nav-save-progress 就是这一对。因为五篇的干货位实际都从 A7 池里挑说法，
  // 这条一直潜伏没爆；一旦哪篇真写了「先收藏一下」，从第二篇起就永远 FAIL。
  for (const d of DEVICE_RULES.devices) {
    assert.equal(d.scope === 'device' && !!d.mustChoose, false, `${d.id} 同时是 scope=device 与 mustChoose`);
  }
  const nav = DEVICE_RULES.devices.find((d) => d.id === 'nav-save-progress');
  assert.equal(nav.scope, 'phrase');
  assert.equal(nav.mustChoose, true, '「每期必须给个干货位动作」这个决定要保住，改的只是判定口径');
});

test('mustChoose 组的轮换池自撞已修：free-homework / closing-action-sequence', () => {
  // 修复前：free-homework 轮换池第 1 条结尾「数完在评论区报个数」命中自家 hw-comment-report，
  //         closing-action-sequence 第 6 条「去数第一页有几条过百」命中自家 close-count-first-page。
  // 两组都是 mustChoose=true（每期必须选一种），自撞 = 两篇按规矩挑同一条就互判复用。
  for (const id of ['free-homework', 'closing-action-sequence']) {
    const dev = DEVICE_RULES.devices.find((d) => d.id === id);
    assert.equal(dev.mustChoose, true);
    for (const rot of dev.rotations) {
      for (const p of dev.patterns) {
        assert.equal(new RegExp(p.pattern).test(rot), false, `${id} 轮换池自撞 ${p.id}：${rot.slice(0, 30)}`);
      }
    }
  }
});
