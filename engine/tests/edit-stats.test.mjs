import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  statForFile, buildStats, dailySummary, renderMarkdown, dateStr, modelOf, listFiles,
} from '../return/edit-stats.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-stats-test-'));
const write = (name, s) => { const p = path.join(tmp, name); fs.writeFileSync(p, s, 'utf8'); return p; };

// ───────────────────────── dateStr / modelOf ─────────────────────────

test('dateStr: 本地时区 YYYY-MM-DD', () => {
  assert.equal(dateStr(new Date(2026, 8, 25, 23, 59)), '2026-09-25');
  assert.equal(dateStr(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
});

test('modelOf: 登记表有模型字段就用，没有就"未知"', () => {
  assert.equal(modelOf({ id: 'x' }), '未知');
  assert.equal(modelOf({ id: 'x', 写稿模型: 'gpt-5' }), 'gpt-5');
  assert.equal(modelOf({ id: 'x', 模型: 'claude' }), 'claude');
  assert.equal(modelOf(null), '未知');
});

// ───────────────────────── listFiles ─────────────────────────

test('listFiles: 只列文件不列子目录，按名字排序', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-stats-dir-'));
  fs.writeFileSync(path.join(dir, 'b.txt'), '');
  fs.writeFileSync(path.join(dir, 'a.txt'), '');
  fs.mkdirSync(path.join(dir, 'sub'));
  assert.deepEqual(listFiles(dir), ['a.txt', 'b.txt']);
});

// ───────────────────────── statForFile / buildStats ─────────────────────────

const srcText = [
  '你在闲鱼上搜苹果多开分身，第一页三十条链接。',
  '你要是照这个价去算，肯定觉得这门生意没法做。',
  '从同行那里买一串卡密要一两块，挂到闲鱼上卖不到四块。',
  '干货非常多，建议先点赞收藏。',
  '苹果的多开你自己做不出来，所以只能找同行买卡密。',
].join('\n');
const srcAbs = write('src.txt', srcText);
const registry = [
  { id: 'T-v1', 选题: '苹果多开分身', filmId: 'f1', 稿件路径: srcAbs, 写稿模型: 'gpt-5' },
  { id: 'T-v2', 选题: '别的选题', filmId: 'f2', 稿件路径: write('src2.txt', '完全不相干的另一篇内容。\n没有任何重合的句子在这里。\n') },
];

test('statForFile: 认出源稿并算出改动句数与改动率', () => {
  const retText = [
    '你在闲鱼上搜苹果多开分身，第一页三十条链接。',
    '你要是照这个价去算，一定会觉得这门生意没法做。',
    '从同行那里买一串卡密要一两块，挂到闲鱼上卖不到四块。',
    '苹果的多开你自己做不出来，所以只能找同行买卡密。',
  ].join('\n');
  const r = statForFile({ name: 'x.txt', mtimeDate: new Date(2026, 8, 20), text: retText }, registry);
  assert.equal(r.recognized, true);
  assert.equal(r.row.id, 'T-v1');
  assert.equal(r.row.model, 'gpt-5');
  assert.equal(r.row.srcCount, 5);
  assert.equal(r.row.删, 1, '删掉了「干货非常多」那句');
  assert.equal(r.row.换词, 1, '肯定→一定会');
  assert.ok(r.row.rate > 0 && r.row.rate < 1);
});

test('statForFile: 认不出时给出原因，不抛错', () => {
  const r = statForFile({ name: 'y.txt', mtimeDate: new Date(2026, 8, 20), text: '今天天气很好，我们一起去公园散步吧。' }, registry);
  assert.equal(r.recognized, false);
  assert.equal(r.name, 'y.txt');
  assert.ok(r.reason.length > 0);
});

test('buildStats: 按日期升序排列，认出/认不出分开', () => {
  const files = [
    { name: 'later.txt', mtimeDate: new Date(2026, 8, 22), text: srcText },
    { name: 'earlier.txt', mtimeDate: new Date(2026, 8, 18), text: srcText },
    { name: 'unknown.txt', mtimeDate: new Date(2026, 8, 19), text: '毫不相关的一段话在这里出现。' },
  ];
  const { rows, unrecognized } = buildStats(files, registry);
  assert.deepEqual(rows.map((r) => r.file), ['earlier.txt', 'later.txt']);
  assert.equal(unrecognized.length, 1);
  assert.equal(unrecognized[0].name, 'unknown.txt');
});

// ───────────────────────── dailySummary ─────────────────────────

test('dailySummary: 同一天多篇算平均，日期升序', () => {
  const rows = [
    { date: '2026-09-20', file: 'a', changed: 4, rate: 0.4 },
    { date: '2026-09-20', file: 'b', changed: 2, rate: 0.2 },
    { date: '2026-09-18', file: 'c', changed: 10, rate: 1 },
  ];
  const daily = dailySummary(rows);
  assert.deepEqual(daily.map((d) => d.date), ['2026-09-18', '2026-09-20']);
  const d20 = daily.find((d) => d.date === '2026-09-20');
  assert.equal(d20.count, 2);
  assert.equal(d20.avgChanged, 3);
  assert.ok(Math.abs(d20.avgRate - 0.3) < 1e-9);
});

test('dailySummary: srcCount 为 0（rate=null）的行不拉低平均改动率', () => {
  const rows = [
    { date: '2026-09-20', changed: 5, rate: null },
    { date: '2026-09-20', changed: 1, rate: 0.5 },
  ];
  const daily = dailySummary(rows);
  assert.equal(daily[0].avgRate, 0.5);
});

// ───────────────────────── renderMarkdown ─────────────────────────

test('renderMarkdown: 三段都在，含表头与认不出小节', () => {
  const rows = [{ date: '2026-09-20', file: 'a.txt', id: 'T-v1', topic: '苹果多开分身', model: 'gpt-5', srcCount: 5, changed: 2, 换词: 1, 改通顺: 0, 增: 0, 删: 1, 挪位置: 0, rate: 0.4 }];
  const unrecognized = [{ dateStr: '2026-09-21', name: 'b.txt', reason: '最高只有 10.0%，低于门槛 30%' }];
  const daily = dailySummary(rows);
  const md = renderMarkdown({ rows, unrecognized, daily, since: '2026-09-01', nasDir: '\\\\nas\\已审' });
  assert.match(md, /# 员工改稿计数/);
  assert.match(md, /逐篇明细/);
  assert.match(md, /每日汇总/);
  assert.match(md, /认不出源稿/);
  assert.match(md, /a\.txt/);
  assert.match(md, /b\.txt/);
  assert.match(md, /40\.0%/);
});

test('renderMarkdown: 空数据不报错，给占位行', () => {
  const md = renderMarkdown({ rows: [], unrecognized: [], daily: [] });
  assert.match(md, /没有认出源稿的稿子/);
  assert.match(md, /（没有）/);
});
