import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkRepetition, buildLedger } from '../variation/check-repetition.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const read = (ip, name) => readFileSync(join(repo, 'ips', ip, 'outputs', name), 'utf8');

const BATCH = {
  '钱十七/长视频版': read('钱十七', '闲鱼餐饮券-长视频版.md'),
  '钱十七/短视频版': read('钱十七', '闲鱼餐饮券-短视频版.md'),
  '半佛/长视频版': read('半佛', '闲鱼餐饮券-长视频版.md'),
  '半佛/短视频版': read('半佛', '闲鱼餐饮券-短视频版.md')
};

test('the shipped batch passes cross-draft repetition checks', () => {
  const r = checkRepetition(BATCH);
  assert.equal(r.passed, true, JSON.stringify({ failures: r.failures, overused: r.overusedPhrases }, null, 2));
});

test('every draft in the batch has a distinct opening and closing', () => {
  const l = buildLedger(BATCH);
  const openings = Object.values(l.per).map((v) => v.opening);
  const closings = Object.values(l.per).map((v) => v.closing);
  assert.equal(new Set(openings).size, openings.length, '开头句重复');
  assert.equal(new Set(closings).size, closings.length, '结尾句重复');
});

test('no sentence is reused across drafts', () => {
  const l = buildLedger(BATCH);
  assert.deepEqual(l.repeated, [], JSON.stringify(l.repeated, null, 2));
});

test('two different IPs on one topic must not converge', () => {
  const r = checkRepetition(BATCH);
  const cross = r.pairs.filter((p) => !p.sameIp);
  for (const p of cross) {
    assert.ok(p.ratio <= p.cap, `${p.a} vs ${p.b} 重合 ${(p.ratio * 100).toFixed(1)}%，超过 ${(p.cap * 100).toFixed(0)}%`);
  }
});

test('protected factual phrases are exempt from the repetition count', () => {
  const facts = '券散在企业福利、银行联名、会员专属这些口子里。';
  const r = checkRepetition({ 'a/x': facts + '前面这段是甲写的。', 'b/y': facts + '后面这段是乙写的。' });
  assert.equal(r.passed, true);
});

test('literal reuse across a batch is caught', () => {
  const shared = '这一步不花钱，也不用你先想好到底做不做，先去搜一遍看看价格带在哪里。';
  const r = checkRepetition({
    'a/1': shared + '甲的其余内容各不相同各不相同。',
    'b/2': shared + '乙的其余内容各不相同各不相同。',
    'c/3': shared + '丙的其余内容各不相同各不相同。'
  });
  assert.equal(r.passed, false);
});
