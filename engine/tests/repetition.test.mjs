import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
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

test('HTML axis comments in the file header do not count as body', () => {
  // 两篇正文各异，但文件头轴注释相同且很长——若注释被当成正文，
  // 会刷出满屏原样复用并判 FAIL；bodyOf 剔除注释后应干净 PASS。
  const comment = '<!-- 开头:观众卡点|骨架:F2|推进:编号环节|收尾:互动提问|消费阶梯:升级型 -->';
  const a = `# 甲标题\n\n${comment}\n\n甲篇正文讲的是二手书回收转卖这条低门槛副业的具体做法。`;
  const b = `# 乙标题\n\n${comment}\n\n乙篇正文讲的是本地服务跑腿代办怎么接单又怎么定价。`;
  const r = checkRepetition({ '钱十七/01-二手书': a, '钱十七/05-本地服务': b });
  assert.equal(r.passed, true, JSON.stringify({ pairs: r.pairs, overused: r.overusedPhrases }, null, 2));
  assert.equal(r.overusedPhrases.length, 0, '轴注释仍被当成正文，刷出了假的原样复用');
});

test('same IP: same topic uses 15%, different topics use 8%', () => {
  // 构造一段刚好落在 8%–15% 之间的重合（实测约 9.8%）：
  // 同选题（长/短版）应放行，不同选题应判 FAIL。
  let pool = '';
  for (let c = 0x4e00; c < 0x4e00 + 400; c++) pool += String.fromCharCode(c);
  const shared = '共享连接壳段落两篇完全一致';
  const tailA = pool.slice(0, 55);
  const tailB = pool.slice(200, 255);

  const sameTopic = checkRepetition({
    '钱十七/餐饮券-长视频版': shared + tailA,
    '钱十七/餐饮券-短视频版': shared + tailB
  });
  const p1 = sameTopic.pairs[0];
  assert.ok(p1.ratio > 0.08 && p1.ratio < 0.15, `重合率应落在 8%–15% 之间，实为 ${(p1.ratio * 100).toFixed(1)}%`);
  assert.equal(p1.sameTopic, true, '长/短版应判为同选题');
  assert.equal(p1.cap, 0.15, '同 IP 同选题应用 15% 上限');
  assert.equal(sameTopic.passed, true, '同选题下 9.8% 应放行');

  const diffTopic = checkRepetition({
    '钱十七/二手书回收转卖': shared + tailA,
    '钱十七/账号养号基础': shared + tailB
  });
  const p2 = diffTopic.pairs[0];
  assert.equal(p2.sameIp, true, '两篇同 IP');
  assert.equal(p2.sameTopic, false, '不同选题不应判为同选题');
  assert.equal(p2.cap, 0.08, '同 IP 不同选题应用 8% 上限');
  assert.equal(diffTopic.passed, false, '同 IP 不同选题下 9.8% 应判 FAIL');
});

test('10-doc stress batch plus the existing short-video draft passes (regression lock)', (t) => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repo = join(here, '..', '..');
  const fixtureDir = join(repo, 'engine', 'fixtures', 'batch-test-20260822');
  if (!existsSync(fixtureDir)) {
    t.skip('压测目录 engine/fixtures/batch-test-20260822 不存在，跳过 10 篇回归锁');
    return;
  }
  const docs = {};
  // 全部落在同一 IP（钱十七/）下，触发"同 IP 不同选题 → 8%"这条新口径。
  for (const f of readdirSync(fixtureDir)) {
    if (!/^\d/.test(f) || !f.endsWith('.md')) continue; // 只取 01-…10- 十篇，跳过 README/report
    docs[`钱十七/${basename(f, '.md')}`] = readFileSync(join(fixtureDir, f), 'utf8');
  }
  docs['钱十七/闲鱼餐饮券-短视频版'] = readFileSync(
    join(repo, 'ips', '钱十七', 'outputs', '闲鱼餐饮券-短视频版.md'),
    'utf8'
  );
  assert.equal(Object.keys(docs).length, 11, `应有 11 篇，实为 ${Object.keys(docs).length}`);
  const r = checkRepetition(docs);
  // 全部同 IP、不同选题，走 8% 上限；报告实测正文最高重合 1.6%，应 PASS。
  assert.equal(r.passed, true, JSON.stringify({ failures: r.failures, overused: r.overusedPhrases }, null, 2));
});
