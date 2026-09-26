import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pickExperience, renderMarkdown, normalizeSubtype, DEFAULT_TABLE, DEFAULT_TAGS,
} from '../brief/pick-experience.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ───────────────────────── 小样本 ─────────────────────────

const table = [
  { id: 'X-选品-001', 环节: '选品', 经验: '通用且含代办', 标记: '✅', 备注: '' },
  { id: 'X-选品-002', 环节: '选品', 经验: '实物专用', 标记: '✅', 备注: '' },
  { id: 'X-上架-001', 环节: '上架', 经验: '虚拟专用只给资料类', 标记: '✅', 备注: '' },
  { id: 'X-上架-002', 环节: '上架', 经验: '通用但是禁用', 标记: '🚫', 备注: '' },
  { id: 'X-售后-001', 环节: '售后', 经验: '带竖线|的经验', 标记: '⚠️', 备注: '剥掉天数' },
  { id: 'X-其他-001', 环节: '其他', 经验: '没贴标签', 标记: '✅', 备注: '' },
];
const tags = [
  { id: 'X-选品-001', 适用: '通用', 虚拟子类: ['代办服务类', '软件账号类'], 换说法: '上游代发→上家出货', 把握: '高' },
  { id: 'X-选品-002', 适用: '实物专用', 虚拟子类: [], 换说法: '', 把握: '高' },
  { id: 'X-上架-001', 适用: '虚拟专用', 虚拟子类: ['资料类'], 换说法: '', 把握: '高' },
  { id: 'X-上架-002', 适用: '通用', 虚拟子类: ['代办服务类'], 换说法: '', 把握: '高' },
  { id: 'X-售后-001', 适用: '虚拟专用', 虚拟子类: ['代办服务类'], 换说法: '', 把握: '低' },
];

test('normalizeSubtype: 带不带「类」都认，别的拒', () => {
  assert.equal(normalizeSubtype('代办服务'), '代办服务类');
  assert.equal(normalizeSubtype('资料类'), '资料类');
  assert.equal(normalizeSubtype('实物'), null);
});

test('pickExperience: 去实物专用、去子类不含、去🚫、去没标签', () => {
  const r = pickExperience(table, tags, { subtype: '代办服务类' });
  assert.deepEqual(r.items.map((x) => x.id), ['X-选品-001', 'X-售后-001']);
  assert.deepEqual(r.dropped, { 实物专用: 1, 子类不含: 1, 禁用: 1, 环节不选: 0, 无标签: 1 });
  assert.equal(r.items[0].换说法, '上游代发→上家出货');
});

test('pickExperience: --env 只留选的环节', () => {
  const r = pickExperience(table, tags, { subtype: '代办服务类', envs: ['售后'] });
  assert.deepEqual(r.items.map((x) => x.id), ['X-售后-001']);
  assert.equal(r.dropped.环节不选, 1);
});

test('pickExperience: 子类不对就抛错', () => {
  assert.throws(() => pickExperience(table, tags, { subtype: '实物类' }));
});

test('renderMarkdown: 按环节分节，竖线转全角，不出现被剔除的条目', () => {
  const md = renderMarkdown(pickExperience(table, tags, { subtype: '代办服务类' }));
  assert.match(md, /## 选品（1 条）/);
  assert.match(md, /## 售后（1 条）/);
  assert.match(md, /带竖线｜的经验/);
  assert.doesNotMatch(md, /X-选品-002|X-上架-002|X-上架-001|X-其他-001/);
});

// ───────────────────────── 真库 ─────────────────────────

test('真库 · 代办服务类：没有实物专用、没有🚫', () => {
  const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const T = readJson(DEFAULT_TABLE);
  const G = readJson(DEFAULT_TAGS);
  const tagById = new Map(G.map((t) => [t.id, t]));
  const r = pickExperience(T, G, { subtype: '代办服务类' });
  assert.ok(r.items.length > 0);
  for (const it of r.items) {
    assert.notEqual(tagById.get(it.id).适用, '实物专用', it.id);
    assert.ok(tagById.get(it.id).虚拟子类.includes('代办服务类'), it.id);
    assert.ok(!it.标记.includes('🚫'), it.id);
  }
});
