import test from 'node:test';
import assert from 'node:assert/strict';
import { computeImageWaitResult } from '../collect/goofish-collect.mjs';

// 只测纯函数部分：不启动浏览器、不联网、不碰真实闲鱼页面。
// 背景：商品卡片图走懒加载，截图前要等 <img> 全部 complete && naturalWidth>0，
// 有超时上限；这个函数负责把轮询到的 {total, loaded} 状态整理成落盘字段，
// 超时未加载完也要如实记录未加载张数，不能假装全部加载成功。

test('computeImageWaitResult：全部加载完成时 unloaded=0', () => {
  const r = computeImageWaitResult({ total: 8, loaded: 8 }, 1200);
  assert.deepEqual(r, {
    images_total: 8,
    images_loaded: 8,
    images_unloaded: 0,
    images_wait_ms: 1200,
  });
});

test('computeImageWaitResult：超时仍有未加载图片时如实记录数量', () => {
  const r = computeImageWaitResult({ total: 10, loaded: 6 }, 15000);
  assert.equal(r.images_total, 10);
  assert.equal(r.images_loaded, 6);
  assert.equal(r.images_unloaded, 4);
  assert.equal(r.images_wait_ms, 15000);
});

test('computeImageWaitResult：页面没有 img（total=0）不报负数/不报错', () => {
  const r = computeImageWaitResult({ total: 0, loaded: 0 }, 300);
  assert.equal(r.images_total, 0);
  assert.equal(r.images_unloaded, 0);
});

test('computeImageWaitResult：loaded 异常大于 total 时钳制到 0（不给负数）', () => {
  const r = computeImageWaitResult({ total: 5, loaded: 9 }, 500);
  assert.equal(r.images_unloaded, 0);
});

test('computeImageWaitResult：status 缺字段/为 null 时按 0 处理', () => {
  const r = computeImageWaitResult(null, 100);
  assert.deepEqual(r, {
    images_total: 0,
    images_loaded: 0,
    images_unloaded: 0,
    images_wait_ms: 100,
  });
});
