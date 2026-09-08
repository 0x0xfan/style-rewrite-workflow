import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { identify } from '../return/identify.mjs';
import { diffSentences, similarity, numbersDiffer } from '../return/diff-sentences.mjs';
import { toScript, splitLong, verifyAgainst } from '../return/to-script.mjs';
import { addEntry, updateEntry, renderMd } from '../return/registry.mjs';
import { loadRegistry, splitSentences } from '../return/lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'return-test-'));
const write = (name, s) => { const p = path.join(tmp, name); fs.writeFileSync(p, s, 'utf8'); return p; };

// ───────────────────────── identify ─────────────────────────

const registry = loadRegistry(path.join(repo, 'docs', '稿件登记.json'));
const pEntry = registry.find((e) => e.id === 'P-v2');
const pAbs = pEntry ? path.join(repo, pEntry.稿件路径) : '';
const pExists = !!pAbs && fs.existsSync(pAbs);

test('identify: P-v2 稿本身能认出 P-v2', { skip: !pExists && 'research-runs 里没有 P-v2 稿（不进 git）' }, () => {
  const text = fs.readFileSync(pAbs, 'utf8');
  const r = identify(text, registry);
  assert.equal(r.recognized, true);
  assert.equal(r.best.entry.id, 'P-v2');
  assert.ok(r.best.ratio > 0.95, `重合率 ${r.best.ratio}`);
  assert.ok(r.ranking[1].ratio < 0.3, `第二名 ${r.ranking[1].entry.id} 重合率 ${r.ranking[1].ratio} 应该远低于门槛`);
});

test('identify: 改了三句的副本仍认出 P-v2', { skip: !pExists && 'research-runs 里没有 P-v2 稿（不进 git）' }, () => {
  const lines = fs.readFileSync(pAbs, 'utf8').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
  lines[0] = '你去闲鱼搜一下苹果多开分身，头一页三十条，二十八条标价都不到四块。';
  lines[3] = '我一开始也是这么算的，后来才想明白，不到四块只是引流价。';
  lines[20] = '这一句是员工整个重写的，跟原来一点关系都没有了。';
  const r = identify(lines.join('\n'), registry);
  assert.equal(r.recognized, true);
  assert.equal(r.best.entry.id, 'P-v2');
  assert.ok(r.best.ratio > 0.8, `重合率 ${r.best.ratio}`);
});

test('identify: 不相干的文本认不出', () => {
  const r = identify('今天天气很好，我们一起去公园散步吧。晚上回来吃饭。', registry);
  assert.equal(r.recognized, false);
});

// ───────────────────────── diff-sentences ─────────────────────────

test('diff-sentences: 八句样例分类正确（删 / 加 / 换词 / 改通顺 / 挪位置 / 改事实?）', () => {
  const src = [
    '你在闲鱼上搜苹果多开分身，第一页三十条链接。',          // 1 未动
    '你要是照这个价去算，肯定觉得这门生意没法做。',            // 2 换词：肯定→一定会
    '从同行那里买一串卡密要一两块，挂到闲鱼上卖不到四块。',    // 3 未动 + 数字改：四块→五块 → 换词，改事实?
    '这期一共讲三点，卡密从哪里买、怎么分规格挂、退款怎么办。', // 4 删句
    '干货非常多，建议先点赞收藏。',                            // 5 未动
    '我之前看的时候，有一家开了八年的老店，累计卖出三万七千多件。', // 6 改通顺（大改）
    '先说第一点，卡密从哪里买。',                              // 7 挪位置：挪到最前面
    '苹果的多开你自己做不出来，所以只能找同行买卡密。',        // 8 未动
  ];
  const ret = [
    '先说第一点，卡密从哪里买。',
    '你在闲鱼上搜苹果多开分身，第一页三十条链接。',
    '你要是照这个价去算，一定会觉得这门生意没法做。',
    '从同行那里买一串卡密要一两块，挂到闲鱼上卖不到五块。',
    '干货非常多，建议先点赞收藏。',
    '这一点很多人没想到。',                                    // 加句（「一点」不算数字）
    '我以前看到过一家老店，开了八年，卖出去三万七千多件。',
    '苹果的多开你自己做不出来，所以只能找同行买卡密。',
  ];
  const r = diffSentences(src, ret);
  const byType = (t) => r.rows.filter((x) => x.type === t);
  assert.equal(r.stats.未动, 3, JSON.stringify(r.rows.map((x) => [x.type, x.src, x.ret]), null, 2));
  assert.equal(r.stats.换词, 2);
  assert.equal(r.stats.改通顺, 1);
  assert.equal(r.stats.删句, 1);
  assert.equal(r.stats.加句, 1);
  assert.equal(r.stats.挪位置, 1);
  assert.equal(r.stats.员工改动句数, 6);
  assert.equal(byType('删句')[0].src, src[3]);
  assert.equal(byType('加句')[0].ret, ret[5]);
  assert.equal(byType('加句')[0].note, '', '「一点」不该当成数字');
  assert.equal(byType('挪位置')[0].src, src[6]);
  assert.equal(byType('改通顺')[0].ret, ret[6]);
  // 改事实?：只有 四块→五块 那一对
  assert.equal(r.stats['改事实?'], 1);
  assert.equal(r.factFlags[0].src, src[2]);
  assert.equal(r.factFlags[0].ret, ret[3]);
});

test('diff-sentences: 相似度与数字比较', () => {
  assert.equal(similarity('我是圣矾。', '我是圣矾。'), 1);
  assert.ok(similarity('你要是照这个价去算，肯定觉得这门生意没法做。', '你要是照这个价去算，一定会觉得这门生意没法做。') >= 0.8);
  assert.ok(similarity('完全不同的一句话。', '苹果多开分身。') < 0.5);
  assert.equal(numbersDiffer('一单赚六块。', '一单赚六块。'), false);
  assert.equal(numbersDiffer('一单赚六块。', '一单赚八块。'), true);
  assert.equal(numbersDiffer('好评率99%。', '好评率98%。'), true);
  assert.equal(numbersDiffer('这一点很重要。', '这很重要。'), false);
});

test('diff-sentences: 只改标点算未动，切句保留问号', () => {
  const s = splitSentences('上游定下来了，那么价格怎么挂呢？第二点，怎么分规格挂。');
  assert.deepEqual(s.map((x) => x.text), ['上游定下来了，那么价格怎么挂呢？', '第二点，怎么分规格挂。']);
  const r = diffSentences(['今天，很好。'], ['今天很好。']);
  assert.equal(r.rows[0].type, '未动');
});

// ───────────────────────── to-script ─────────────────────────

test('to-script: 六十字长句从最靠近中点的逗号拆，不改字', () => {
  const s = '这个品就是苹果多开分身，你自己是做不出来的，只能从同行手里花一两块钱买卡密，然后挂到闲鱼上分规格卖出去，赚的就是中间的这一点差价而已。';
  assert.ok(s.replace(/[，。]/g, '').length >= 55);
  const parts = splitLong(s, 50);
  assert.ok(parts.length >= 2, JSON.stringify(parts));
  assert.equal(parts.join('').replace(/[，。]/g, ''), s.replace(/[，。]/g, ''), '拆句不能改字');
  for (const p of parts) { assert.ok(/[。？！]$/.test(p)); assert.ok(!/的。$/.test(p), `不能以裸「的」收尾：${p}`); }
  const text = `${s}\n我是圣矾。\n做闲鱼，找圣矾。`;
  const r = toScript(text, { max: 50 });
  assert.deepEqual(r.errors, []);
  assert.equal(r.splits.length, 1);
  assert.ok(r.stats.最长句字数 <= 50);
});

test('to-script: 「我是圣矾」两次报错；不独占一句报错', () => {
  const r = toScript('第一句话。\n我是圣矾。\n做闲鱼找圣矾。\n最后再说一遍我是圣矾。');
  assert.ok(r.errors.some((e) => e.includes('我是圣矾') && e.includes('2 次')), r.errors.join('\n'));
  const r2 = toScript('第一句话。\n我是圣矾，做闲鱼找圣矾。');
  assert.ok(r2.errors.some((e) => e.includes('独占一句')), r2.errors.join('\n'));
  const ok = toScript('第一句话。\n我是圣矾。\n做闲鱼，找圣矾。');
  assert.deepEqual(ok.errors, []);
});

test('to-script: 阿拉伯数字 / 字母 / 百分号报出来，CLI 退出码 2 且不写文件', () => {
  const r = toScript('第一页有30条链接。\n好评率99%。\n我是圣矾。');
  const all = r.errors.join('\n');
  assert.ok(all.includes('「30」') && all.includes('「99」') && all.includes('「%」'), all);
  const input = write('digits.txt', '第一页有30条链接。\n我是圣矾。\n');
  const out = path.join(tmp, 'digits-script.txt');
  const p = spawnSync(process.execPath, [path.join(repo, 'engine', 'return', 'to-script.mjs'), input, '--out', out], { encoding: 'utf8' });
  assert.equal(p.status, 2, p.stderr);
  assert.ok(!fs.existsSync(out), '有错不该写 script');
});

test('to-script: 去掉 markdown 与画面标注，普通括号保留并报告', () => {
  const md = ['# 成稿 · 测试', '> 讲述者：圣矾', '', '### ①开场', '', '**画面**：`market/01.png`', '', '**口播**：', '你在闲鱼上搜一下（画面：搜索页）这个东西。', '【切到详情页】这一条一万九千多人想要（取整）。', '我是圣矾。', '', '**目的**：立题'].join('\n');
  const r = toScript(md);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.sentences, ['你在闲鱼上搜一下这个东西。', '这一条一万九千多人想要（取整）。', '我是圣矾。']);
  assert.deepEqual(r.kept, ['（取整）']);
  assert.ok(r.dropped.includes('（画面：搜索页）'));
  assert.ok(r.dropped.includes('【切到详情页】'));
});

test('to-script --verify: storyboard 口播段与 script 逐字比对', () => {
  const sb = ['### ①开场', '', '**画面**：x.png', '', '**口播**：', '第一句。', '我是圣矾。', '', '**目的**：立题', '', '### ②第一点', '', '**口播**：第二段第一句。', '第二段第二句。', ''].join('\n');
  assert.equal(verifyAgainst('第一句。\n我是圣矾。\n第二段第一句。\n第二段第二句。\n', sb).ok, true);
  const bad = verifyAgainst('第一句。\n我是圣矾。\n第二段第一句。\n第二段第三句。\n', sb);
  assert.equal(bad.ok, false);
  assert.ok(bad.pos > 0);
});

// ───────────────────────── registry ─────────────────────────

test('registry: add 校验路径、拒绝重复 id；update 记回稿与改动句数；md 转义竖线', () => {
  const entries = [];
  const draft = write('draft.txt', '我是圣矾。\n');
  assert.throws(() => addEntry(entries, { id: 'X-v1', topic: 'T', film: 'f', draft: path.join(tmp, '不存在.txt') }), /路径不存在/);
  const e = addEntry(entries, { id: 'X-v1', topic: 'T|1', film: 'f', draft });
  assert.equal(e.版本, 'v1');
  assert.equal(e.状态, '已交付待回稿');
  assert.throws(() => addEntry(entries, { id: 'X-v1', topic: 'T', film: 'f', draft }), /已登记过/);
  updateEntry(entries, { id: 'X-v1', status: '已回稿并交付', returned: 'docs/回稿/x.txt', changed: '5' });
  assert.equal(entries[0].改动句数, 5);
  assert.throws(() => updateEntry(entries, { id: 'X-v1', changed: '-1' }), /非负整数/);
  assert.ok(renderMd(entries).includes('T\\|1'));
});
