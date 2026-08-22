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

test('the shipped Qian17 draft passes platform compliance', () => {
  const copy = readFileSync(join(repo, 'ips', '钱十七', 'outputs', '闲鱼餐饮券-口播版.md'), 'utf8');
  const r = checkCopy(copy);
  assert.equal(r.passed, true, JSON.stringify(r.findings, null, 2));
});
