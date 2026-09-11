// build-brief --lean（写手版）与 capture-summary 的断言：
//   - lean 只嵌说明书八节，不嵌其余节、不嵌 §十八 机器查表
//   - lean 词表只嵌 内部术语/借用错/用词不当 里用户点名/员工修改 的"禁 → 换"两列
//   - lean 默认 n-openings/n-sayings/n-voices = 3/15/3（这里只验默认值写进包头统计）
//   - 非 lean 行为不变：全文嵌入、§十八 在、词表全表
//   - capture-summary 输出 ≤ 60 行，关键字段都在
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILD = path.join(REPO, 'engine', 'brief', 'build-brief.mjs');
const SUMMARY = path.join(REPO, 'engine', 'brief', 'capture-summary.mjs');

const NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九'];
const LEAN_KEEP = ['三', '四', '七', '八', '十三', '十四', '十五', '十七'];

function makeFixtures() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-lean-'));
  const style = ['# 说明书 · 测试', ''];
  for (const n of NUMS) style.push(`## ${n}、第${n}节标题`, '', `第${n}节正文 SEC-${n}-BODY`, '');
  fs.writeFileSync(path.join(dir, 'style.md'), style.join('\n'), 'utf8');
  const words = [
    { id: 'U1', 禁: 'BAN-内部-用户', 换: 'OK-1', 类型: '内部术语', 日期: '2026-09-01', 录入: '用户点名', 用户原话: '别这么说' },
    { id: 'U2', 禁: 'BAN-内部-预防', 换: 'OK-2', 类型: '内部术语', 日期: '2026-09-01', 录入: '主线程预防性' },
    { id: 'U3', 禁: 'BAN-用词-员工', 换: 'OK-3', 类型: '用词不当', 日期: '2026-09-01', 录入: '员工修改', 用户原话: '原→改' },
    { id: 'U4', 禁: 'BAN-借用-用户', 换: 'OK-4', 类型: '借用错', 日期: '2026-09-01', 录入: '用户点名', 用户原话: '借错了' },
    { id: 'U5', 禁: 'BAN-书面-用户', 换: 'OK-5', 类型: '书面词', 日期: '2026-09-01', 录入: '用户点名', 用户原话: '太书面' },
  ];
  fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify(words, null, 2), 'utf8');
  const capture = {
    schema_version: '1.3', query: '测试词', captured_at: '2026-09-02T07:06:32.767Z', status: 'ok',
    notes_field_semantics: { wants: '单品数据：X人想要', views: '单品数据：详情页浏览量', shop_age: '店铺数据：来闲鱼时长（店龄）' },
    products: Array.from({ length: 40 }, (_, i) => ({ rank: i + 1, item_id: String(i), price: (i % 5) + 1, wants: i % 3 ? i * 7 : null, raw_text: `商品${i} 很长的标题`.repeat(5) })),
    detail_evidence: [{
      item_id: '0', rank: 1, title: 'Top 商品标题',
      item_metrics: { price: 5, price_range: '5-30', wants: 1154, views: 6101 },
      shop_metrics: { shop_sold_total: 15366, shop_rating: '98%', shop_age: '来闲鱼7年' },
      shop_page: { shop_metrics: { on_sale_count: 28 } },
    }],
    screenshots: [{ id: 'a', file: 'a.png' }],
  };
  fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify(capture), 'utf8');
  return dir;
}

function run(script, argv) {
  const r = spawnSync(process.execPath, [script, ...argv], { cwd: REPO, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('build-brief --lean 只嵌说明书八节，不嵌 §十八 和其余节', () => {
  const dir = makeFixtures();
  const r = run(BUILD, ['--style', path.join(dir, 'style.md'), '--words', path.join(dir, 'words.json'), '--topic-type', '虚拟', '--lean']);
  assert.equal(r.code, 0, r.err);
  for (const n of LEAN_KEEP) assert.match(r.out, new RegExp(`^## ${n}、第${n}节标题$`, 'm'), `lean 应嵌第${n}节`);
  for (const n of NUMS.filter((x) => !LEAN_KEEP.includes(x))) {
    assert.doesNotMatch(r.out, new RegExp(`SEC-${n}-BODY`), `lean 不该嵌第${n}节`);
  }
  assert.doesNotMatch(r.out, /SEC-十八-BODY/, 'lean 不嵌机器查表');
  assert.match(r.out, /写手不用读/);
  assert.match(r.out, /# 十、交稿前机器查一遍\n\n（写手版不嵌/);
});

test('build-brief --lean 词表只嵌三类里用户点名/员工修改的禁→换两列', () => {
  const dir = makeFixtures();
  const r = run(BUILD, ['--style', path.join(dir, 'style.md'), '--words', path.join(dir, 'words.json'), '--topic-type', '虚拟', '--lean']);
  assert.equal(r.code, 0, r.err);
  const sec = r.out.split('# 十一、')[1].split('# 十二、')[0];
  assert.match(sec, /\| 禁 \| 换成 \|/);
  assert.match(sec, /\| BAN-内部-用户 \| OK-1 \|/);
  assert.match(sec, /\| BAN-用词-员工 \| OK-3 \|/);
  assert.match(sec, /\| BAN-借用-用户 \| OK-4 \|/);
  assert.doesNotMatch(sec, /BAN-内部-预防/, '预防性条目不进写手版');
  assert.doesNotMatch(sec, /BAN-书面-用户/, '三类以外不进写手版');
  assert.doesNotMatch(sec, /别这么说|原→改/, '写手版不带用户原话');
  assert.match(sec, /只列写手最常撞的三类（内部术语 \/ 借用错 \/ 用词不当）里用户亲口纠正或员工改过的 3 条/);
});

test('build-brief 不加 --lean 时行为不变：全文嵌入、§十八 在、词表全表带原话', () => {
  const dir = makeFixtures();
  const r = run(BUILD, ['--style', path.join(dir, 'style.md'), '--words', path.join(dir, 'words.json'), '--topic-type', '虚拟']);
  assert.equal(r.code, 0, r.err);
  for (const n of NUMS) assert.match(r.out, new RegExp(`SEC-${n}-BODY`), `全文版应含第${n}节`);
  assert.match(r.out, /# 十、交稿前机器查一遍（重复列一次/);
  assert.match(r.out, /BAN-内部-预防/);
  assert.match(r.out, /BAN-书面-用户/);
  assert.match(r.out, /别这么说/);
});

test('build-brief --lean 说明书缺要嵌的节 → 退出 1', () => {
  const dir = makeFixtures();
  const broken = fs.readFileSync(path.join(dir, 'style.md'), 'utf8').replace('## 十四、第十四节标题', '## 十四·第十四节标题');
  fs.writeFileSync(path.join(dir, 'style-broken.md'), broken, 'utf8');
  const r = run(BUILD, ['--style', path.join(dir, 'style-broken.md'), '--words', path.join(dir, 'words.json'), '--lean']);
  assert.equal(r.code, 1);
  assert.match(r.err, /找不到第十四节/);
});

test('capture-summary 一屏以内，关键字段都在', () => {
  const dir = makeFixtures();
  const r = run(SUMMARY, [path.join(dir, 'capture.json')]);
  assert.equal(r.code, 0, r.err);
  const lines = r.out.trimEnd().split('\n');
  assert.ok(lines.length <= 60, `应 ≤ 60 行，实际 ${lines.length}`);
  assert.match(r.out, /query：测试词/);
  assert.match(r.out, /captured_at：2026-09-02T07:06:32.767Z/);
  assert.match(r.out, /列表 40 条（看前 30）· 详情 1 条 · 截图 1 张/);
  assert.match(r.out, /价格分布.*¥1 ×6 · ¥2 ×6 · ¥3 ×6 · ¥4 ×6 · ¥5 ×6/);
  assert.match(r.out, /想要数前十/);
  assert.match(r.out, /价格 ¥5-30 · 想要 1154 · 浏览 6101 · 店龄 来闲鱼7年 · 店铺累计卖出 15366 · 好评率 98% · 在售 28/);
  assert.match(r.out, /wants：单品数据：X人想要/);
  // --top 限定范围
  const r2 = run(SUMMARY, [path.join(dir, 'capture.json'), '--top', '10']);
  assert.match(r2.out, /列表 40 条（看前 10）/);
  assert.match(r2.out, /¥1 ×2 · ¥2 ×2 · ¥3 ×2 · ¥4 ×2 · ¥5 ×2/);
});
