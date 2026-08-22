import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkCopy } from '../compliance/check-copy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

test('clean explanatory copy passes', () => {
  const r = checkCopy('这些券是品牌方分散释放的，普通人不容易找到。只拿能说清出处的券。');
  assert.equal(r.passed, true);
  assert.equal(r.blockCount, 0);
});

test('income promises are blocked', () => {
  for (const bad of ['月入过万是能摸到的', '轻松破万', '日赚300不是问题', '年入百万']) {
    assert.equal(checkCopy(bad).passed, false, bad);
  }
});

test('income math is blocked even when spaced out', () => {
  const r = checkCopy('一天 100 单就是 800，一个月两万四。');
  assert.equal(r.passed, false);
  assert.ok(r.findings.some((f) => f.group === 'income-math'));
});

test('get-rich and absolute claims are blocked', () => {
  for (const bad of ['躺赚', '稳赚不赔', '零风险', '保证赚到钱', '包教包会']) {
    assert.equal(checkCopy(bad).passed, false, bad);
  }
});

test('off-platform traffic diversion is blocked', () => {
  for (const bad of ['加微信领资料', '私信我发你', '评论区扣1', '主页链接自取']) {
    assert.equal(checkCopy(bad).passed, false, bad);
  }
});

test('money-term density is capped even when every single term is allowed', () => {
  const r = checkCopy('赚钱赚钱收益利润差价变现副业出单回本提成。');
  assert.equal(r.passed, false);
  assert.ok(r.findings.some((f) => f.group === 'money-density'));
});

test('recruitment tone warns but does not block', () => {
  const r = checkCopy('我带你做，手把手带，跟着我做就行。这是一段足够长的正常说明文字，用来把密度稀释到阈值以下，避免触发密度规则而不是招徕规则。');
  assert.equal(r.blockCount, 0);
  assert.ok(r.warnCount > 0);
});

const SHORT = [
  ['钱十七', '闲鱼餐饮券-短视频版.md'],
  ['半佛', '闲鱼餐饮券-短视频版.md']
];
const LONG = [
  ['钱十七', '闲鱼餐饮券-长视频版.md'],
  ['半佛', '闲鱼餐饮券-长视频版.md']
];
const read = (ip, name) => readFileSync(join(repo, 'ips', ip, 'outputs', name), 'utf8');

for (const [ip, name] of SHORT) {
  test(`shipped short-video draft passes platform compliance: ${ip}`, () => {
    const r = checkCopy(read(ip, name));
    assert.equal(r.passed, true, JSON.stringify(r.findings, null, 2));
  });
}

// 长视频稿不受这层约束，诱导设计照旧保留。这组断言锁住作用域，
// 防止以后有人把合规层当成全局规则把长视频稿也洗一遍。
for (const [ip, name] of LONG) {
  test(`long-video draft stays exempt and keeps its hooks: ${ip}`, () => {
    const r = checkCopy(read(ip, name));
    assert.equal(r.passed, false, `${ip} 长视频稿应保留收益类诱导，不应被合规层洗掉`);
  });
}
// 90 秒档位：按 240 字/分钟，控制在 75-115 秒。checkCopy 已经算好了正文字数。
for (const [ip, name] of SHORT) {
  test(`short-video draft stays near 90 seconds: ${ip}`, () => {
    const seconds = (checkCopy(read(ip, name)).chars / 240) * 60;
    assert.ok(seconds >= 75 && seconds <= 115, `${ip} 实测 ${seconds.toFixed(0)} 秒`);
  });
}
