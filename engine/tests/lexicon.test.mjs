import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkLexicon, fragmentsOf, inferIp, loadLexicon } from '../naturalness/check-lexicon.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

// 内联小词表：内容词 + 业务词子表，模拟 lexicon.json 结构。
const lexicon = {
  ip: '测试',
  corpus_id: 'test-v1',
  built: '2026-08-23',
  doc_count: 2,
  business: [
    { term: '货源', freq: 5, docs: 2 },
    { term: '渠道', freq: 3, docs: 2 }
  ],
  terms: [
    { term: '货源', freq: 5, docs: 2 },
    { term: '渠道', freq: 3, docs: 2 },
    { term: '出处', freq: 2, docs: 1 },
    { term: '餐饮券', freq: 4, docs: 2 }
  ]
};

const hints = {
  hints: {
    '找货': ['找货源'],
    '散在': ['都在', '藏在'],
    '打哪来': ['从哪来', '哪来的']
  }
};

test('未知词报告：语料 0 出现的片段进可疑清单', () => {
  // 词表只在 IP 语料词间断句/断词处能切出干净词；散文里"找货""散在"会落进
  // 相邻未知字聚成的片段（span）里。可疑清单是给人逐句过目的 span 视图，
  // 因此断言"某可疑片段含该词"，而非要求切出孤立的两字词。
  const r = checkLexicon('第一个坎是找货，券散在各种口子。', { lexicon, hints });
  const terms = r.suspiciousList.map((s) => s.term);
  assert.ok(terms.some((t) => t.includes('找货')), '应有含"找货"的可疑片段');
  assert.ok(terms.some((t) => t.includes('散在')), '应有含"散在"的可疑片段（单字"散"藏其中不被误删）');
  assert.equal(r.blockCount, 0, '纯报告工具：永不 block');
  assert.equal(r.passed, true);
});

test('已知业务词计数：命中词表业务词只加分计数', () => {
  const r = checkLexicon('先搞清楚货源和渠道，货源要稳。', { lexicon, hints });
  const biz = Object.fromEntries(r.businessList.map((b) => [b.term, b.count]));
  assert.equal(biz['货源'], 2, '货源出现 2 次');
  assert.equal(biz['渠道'], 1, '渠道出现 1 次');
  assert.equal(r.businessHitTypes, 2);
  assert.equal(r.businessHitTotal, 3);
});

test('hints 替换建议：含 hints key 的可疑片段给出替换参考', () => {
  // 已知词"货源"把句子切开，"找货"落在独立片段里；hints 子串命中给出替换。
  const r = checkLexicon('货源难找，找货就是第一关。', { lexicon, hints });
  const hit = r.suspiciousList.find((s) => s.term.includes('找货'));
  assert.ok(hit, '应有含"找货"的可疑片段');
  assert.ok(hit.suggest, '找货 应带替换建议');
  assert.equal(hit.suggest.source, 'hints');
  assert.ok(hit.suggest.options.includes('找货源'));
});

test('hints 子串命中：长片段含 hints key 也给建议', () => {
  const r = checkLexicon('说不说得清打哪来。', { lexicon, hints });
  const hit = r.suspiciousList.find((s) => s.term.includes('打哪来'));
  assert.ok(hit, '应捕获含"打哪来"的片段');
  assert.ok(hit.suggest && hit.suggest.source === 'hints');
  assert.ok(hit.suggest.options.includes('从哪来'));
});

test('lexicon-neighbor 建议：无 hints 时按同字近邻给参考', () => {
  // "货款"词表无，但与"货源"同首字"货" → 近邻建议应含 货源。
  const r = checkLexicon('货款，货源要稳。', { lexicon, hints: { hints: {} } });
  const hit = r.suspiciousList.find((s) => s.term.includes('货'));
  assert.ok(hit, '应有含"货"的可疑片段');
  assert.ok(hit.suggest && hit.suggest.source === 'lexicon-neighbor');
  assert.ok(hit.suggest.options.includes('货源'));
});

test('fragmentsOf：剥两端助词、丢单字与高频黏合词', () => {
  assert.deepEqual(fragmentsOf('的券'), [], '剥掉"的"后仅剩单字"券"→丢弃');
  assert.deepEqual(fragmentsOf('这个'), [], '整段为高频黏合词→丢弃');
  assert.deepEqual(fragmentsOf('散在'), ['散在'], '"在"非助词，"散在"保留');
  assert.deepEqual(fragmentsOf('找货'), ['找货']);
});

test('业务词不进可疑清单：命中词表即算已出现', () => {
  const r = checkLexicon('餐饮券要说清出处。', { lexicon, hints });
  const terms = r.suspiciousList.map((s) => s.term);
  assert.ok(!terms.includes('餐饮券'), '餐饮券在词表 → 不应可疑');
  assert.ok(!terms.includes('出处'), '出处在词表 → 不应可疑');
});

test('inferIp：从 ips/<IP>/ 路径推断', () => {
  assert.equal(inferIp('ips/钱十七/outputs/闲鱼餐饮券-短视频版.md'), '钱十七');
  assert.equal(inferIp('ips\\半佛\\outputs\\x.md'), '半佛');
  assert.equal(inferIp('engine/fixtures/x.md'), undefined);
});

// 条件测试：真实 lexicon.json 存在时，对四篇交付稿各跑一遍，只验证不报错、结构完整、恒不 block。
test('真实词表存在时对四稿跑通（条件）', () => {
  const drafts = [
    ['钱十七', '闲鱼餐饮券-长视频版.md'],
    ['钱十七', '闲鱼餐饮券-短视频版.md'],
    ['半佛', '闲鱼餐饮券-长视频版.md'],
    ['半佛', '闲鱼餐饮券-短视频版.md']
  ];
  for (const [ip, name] of drafts) {
    const lexPath = join(repo, 'ips', ip, 'corpus', 'lexicon.json');
    const draftPath = join(repo, 'ips', ip, 'outputs', name);
    if (!existsSync(lexPath) || !existsSync(draftPath)) {
      console.log(`  [跳过] ${ip}/${name}（lexicon 或稿件缺失）`);
      continue;
    }
    const lex = loadLexicon(ip, { repoRoot: repo });
    const hintObj = JSON.parse(readFileSync(join(repo, 'engine', 'naturalness', 'lexicon-hints.json'), 'utf8'));
    const r = checkLexicon(readFileSync(draftPath, 'utf8'), { lexicon: lex, hints: hintObj });
    assert.equal(r.blockCount, 0, '词表检查恒不 block');
    assert.equal(r.passed, true);
    assert.ok(Array.isArray(r.suspiciousList));
    assert.ok(typeof r.businessHitTotal === 'number');
    console.log(`  [词表] ${ip}/${name}: 业务词 ${r.businessHitTypes}种/${r.businessHitTotal}次  可疑 ${r.suspiciousTypes}种/${r.suspiciousTotal}次`);
  }
});
