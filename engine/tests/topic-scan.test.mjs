import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  parseArgs,
  verifyPng,
  pickTopProducts,
  buildDetailItems,
  buildSummaryMarkdown,
} from '../collect/topic-scan.mjs';

// 只测纯函数部分：不启动浏览器、不联网、不碰真实闲鱼页面。

test('parseArgs：解析 --keyword/--out/--top，缺必填项报错', () => {
  const a = parseArgs(['--keyword', '京东家政券', '--out', 'scratch/x', '--top', '5']);
  assert.equal(a.keyword, '京东家政券');
  assert.equal(a.out, 'scratch/x');
  assert.equal(a.top, 5);

  const b = parseArgs(['--keyword', 'abc', '--out', 'x']);
  assert.equal(b.top, 3, '未给 --top 时默认 3');

  assert.throws(() => parseArgs(['--out', 'x']), /--keyword/);
  assert.throws(() => parseArgs(['--keyword', 'x']), /--out/);
});

test('parseArgs：非法 --top 落回默认值 3', () => {
  const a = parseArgs(['--keyword', 'x', '--out', 'y', '--top', 'abc']);
  assert.equal(a.top, 3);
  const b = parseArgs(['--keyword', 'x', '--out', 'y', '--top', '0']);
  assert.equal(b.top, 3);
});

function makePng(width, height) {
  // 造一个结构合法（magic + IHDR 宽高）但内容不完整的 PNG，够 verifyPng 校验用。
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const lenBuf = Buffer.alloc(4); // IHDR chunk 长度（占位，不影响本函数校验路径）
  lenBuf.writeUInt32BE(13, 0);
  const ihdrType = Buffer.from('IHDR', 'ascii');
  const dims = Buffer.alloc(8);
  dims.writeUInt32BE(width, 0);
  dims.writeUInt32BE(height, 4);
  const rest = Buffer.alloc(5); // bit depth/color type/compression/filter/interlace 占位
  return Buffer.concat([header, lenBuf, ihdrType, dims, rest]);
}

test('verifyPng：合法 PNG 头返回宽高、字节数和 SHA-256', () => {
  const buf = makePng(800, 600);
  const r = verifyPng(buf);
  assert.equal(r.ok, true);
  assert.equal(r.width, 800);
  assert.equal(r.height, 600);
  assert.equal(r.bytes, buf.length);
  assert.equal(r.sha256, createHash('sha256').update(buf).digest('hex'));
});

test('verifyPng：空文件 / 非 PNG / 尺寸为 0 都判失败并给出原因', () => {
  assert.equal(verifyPng(Buffer.alloc(0)).ok, false);
  assert.equal(verifyPng(Buffer.from('not a png at all, just text')).ok, false);
  const zeroDim = makePng(0, 100);
  const r = verifyPng(zeroDim);
  assert.equal(r.ok, false);
  assert.match(r.reason, /解码尺寸异常/);
});

test('verifyPng：IHDR 块缺失判失败', () => {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const junk = Buffer.alloc(20, 0);
  const r = verifyPng(Buffer.concat([header, junk]));
  assert.equal(r.ok, false);
  assert.match(r.reason, /IHDR/);
});

test('pickTopProducts：按想要数降序取前 N，来源标 search_page', () => {
  const products = [
    { item_id: '1', price: 10, wants: 3 },
    { item_id: '2', price: 20, wants: 50 },
    { item_id: '3', price: 30, wants: null },
    { item_id: '4', price: 40, wants: 20 },
  ];
  const top = pickTopProducts(products, 2);
  assert.equal(top.length, 2);
  assert.equal(top[0].item_id, '2');
  assert.equal(top[1].item_id, '4');
  assert.equal(top[0].wants_source, 'search_page');
  assert.equal(top[0].price_source, 'search_page');
});

test('pickTopProducts：全部没有想要数时按原序取前 N，不报错', () => {
  const products = [
    { item_id: 'a', price: 1, wants: null },
    { item_id: 'b', price: 2, wants: null },
  ];
  const top = pickTopProducts(products, 5);
  assert.equal(top.length, 2);
  assert.equal(top[0].item_id, 'a');
});

test('pickTopProducts：空输入不报错', () => {
  assert.deepEqual(pickTopProducts(null, 3), []);
  assert.deepEqual(pickTopProducts(undefined, 3), []);
});

test('buildDetailItems：单品口径、店铺栏口径、店铺主页口径分别标来源，不合并', () => {
  const evidence = [{
    item_id: '1', rank: 1, title: 'x', source_url: 'https://x',
    item_metrics: { price: 99, price_range: null, wants: 12, views: 300 },
    shop_metrics: { shop_sold_total: 500, shop_rating: '99%' },
    shop_page: { url: 'https://shop', shop_metrics: { on_sale_count: 30, followers: 10 } },
  }];
  const out = buildDetailItems(evidence);
  assert.equal(out[0].item_metrics.source, 'detail_page');
  assert.equal(out[0].shop_metrics.source, 'detail_page_shop_panel');
  assert.equal(out[0].shop_page.source, 'shop_homepage');
  assert.equal(out[0].shop_page.on_sale_count, 30);
});

test('buildDetailItems：字段缺失时不臆造，原样置 null', () => {
  const out = buildDetailItems([{ item_id: '1', rank: 1, title: 'x', source_url: 'u', error: '详情页解析失败' }]);
  assert.equal(out[0].item_metrics, null);
  assert.equal(out[0].shop_metrics, null);
  assert.equal(out[0].shop_page, null);
  assert.equal(out[0].error, '详情页解析失败');
});

test('buildSummaryMarkdown：只列有证据（截图+来源）的数字，附口径提醒', () => {
  const md = buildSummaryMarkdown({
    keyword: '京东家政券',
    capturedAt: '2026-09-25T00:00:00.000Z',
    queryNote: null,
    topProducts: [{ item_id: '1', price: 88, wants: 15 }],
    detailItems: [{
      item_id: '1',
      item_metrics: { price: 88, price_range: null, wants: 15, views: 200 },
      shop_metrics: { shop_sold_total: 300, shop_rating: '98%' },
    }],
    validShots: [
      { type: 'search_results', file: 'shots/01-搜索结果页.png', item_id: null, source_url: 'u1', width: 1600, height: 900, bytes: 12345, sha256: 'a'.repeat(64) },
      { type: 'product_detail', file: 'shots/02-Top1详情.png', item_id: '1', source_url: 'u2', width: 1600, height: 1200, bytes: 23456, sha256: 'b'.repeat(64) },
    ],
    rejectedShots: [{ id: '03-店铺', reason: '截图被判废（遮挡）：登录弹窗' }],
  });
  assert.match(md, /京东家政券/);
  assert.match(md, /88/);
  assert.match(md, /15 人想要/);
  assert.match(md, /shots\/01-搜索结果页\.png/);
  assert.match(md, /未通过校验、已排除的截图/);
  assert.match(md, /人想要」是单品兴趣信号/);
});
