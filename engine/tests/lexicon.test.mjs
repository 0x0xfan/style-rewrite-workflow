import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkLexicon, fragmentsOf, inferIp, loadLexicon, segmentWithJieba } from '../naturalness/check-lexicon.mjs';

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

// 以下 6 条锁定 MFM 回退路径（noJieba:true），既验证回退逻辑，也覆盖"分词器缺失时不崩"。
test('未知词报告：语料 0 出现的片段进可疑清单（MFM 回退）', () => {
  // 词表只在 IP 语料词间断句/断词处能切出干净词；散文里"找货""散在"会落进
  // 相邻未知字聚成的片段（span）里。可疑清单是给人逐句过目的 span 视图，
  // 因此断言"某可疑片段含该词"，而非要求切出孤立的两字词。
  const r = checkLexicon('第一个坎是找货，券散在各种口子。', { lexicon, hints, noJieba: true });
  const terms = r.suspiciousList.map((s) => s.term);
  assert.ok(terms.some((t) => t.includes('找货')), '应有含"找货"的可疑片段');
  assert.ok(terms.some((t) => t.includes('散在')), '应有含"散在"的可疑片段（单字"散"藏其中不被误删）');
  assert.equal(r.blockCount, 0, '纯报告工具：永不 block');
  assert.equal(r.passed, true);
});

test('已知业务词计数：命中词表业务词只加分计数', () => {
  const r = checkLexicon('先搞清楚货源和渠道，货源要稳。', { lexicon, hints, noJieba: true });
  const biz = Object.fromEntries(r.businessList.map((b) => [b.term, b.count]));
  assert.equal(biz['货源'], 2, '货源出现 2 次');
  assert.equal(biz['渠道'], 1, '渠道出现 1 次');
  assert.equal(r.businessHitTypes, 2);
  assert.equal(r.businessHitTotal, 3);
});

test('hints 替换建议：含 hints key 的可疑片段给出替换参考', () => {
  // 已知词"货源"把句子切开，"找货"落在独立片段里；hints 子串命中给出替换。
  const r = checkLexicon('货源难找，找货就是第一关。', { lexicon, hints, noJieba: true });
  const hit = r.suspiciousList.find((s) => s.term.includes('找货'));
  assert.ok(hit, '应有含"找货"的可疑片段');
  assert.ok(hit.suggest, '找货 应带替换建议');
  assert.equal(hit.suggest.source, 'hints');
  assert.ok(hit.suggest.options.includes('找货源'));
});

test('hints 子串命中：长片段含 hints key 也给建议', () => {
  const r = checkLexicon('说不说得清打哪来。', { lexicon, hints, noJieba: true });
  const hit = r.suspiciousList.find((s) => s.term.includes('打哪来'));
  assert.ok(hit, '应捕获含"打哪来"的片段');
  assert.ok(hit.suggest && hit.suggest.source === 'hints');
  assert.ok(hit.suggest.options.includes('从哪来'));
});

test('lexicon-neighbor 建议：无 hints 时按同字近邻给参考', () => {
  // "货款"词表无，但与"货源"同首字"货" → 近邻建议应含 货源。
  const r = checkLexicon('货款，货源要稳。', { lexicon, hints: { hints: {} }, noJieba: true });
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
  const r = checkLexicon('餐饮券要说清出处。', { lexicon, hints, noJieba: true });
  const terms = r.suspiciousList.map((s) => s.term);
  assert.ok(!terms.includes('餐饮券'), '餐饮券在词表 → 不应可疑');
  assert.ok(!terms.includes('出处'), '出处在词表 → 不应可疑');
});

// ① jieba 切词后端可用（条件：python/jieba 缺失则跳过）——验证切出的是完整词、已去单字。
test('segmentWithJieba：可用时返回完整词（条件）', () => {
  const seg = segmentWithJieba('核销门店范围要写清货源。');
  if (!seg.ok) { console.log(`  [跳过] jieba 不可用：${seg.reason}`); return; }
  assert.ok(Array.isArray(seg.tokens) && seg.tokens.length > 0, '应返回非空 tokens');
  assert.ok(seg.tokens.every((t) => t.word.length >= 2), '已去单字（每词 ≥2 字）');
  assert.ok(seg.tokens.every((t) => 'nva'.includes(t.flag[0])), '只留 n/v/a 词性');
  const words = seg.tokens.map((t) => t.word);
  assert.ok(words.some((w) => ['核销', '门店', '货源', '范围'].includes(w)), '切出完整业务词');
});

// ① jieba 完整词路径（用显式 tokens 注入，路径确定、不依赖 python）——完整词判定 + 原句上下文。
test('token 路径：完整词不在词表→可疑，附所在原句', () => {
  const tokens = [
    { word: '货源', flag: 'n' }, { word: '核销', flag: 'v' }, { word: '门店', flag: 'n' }
  ];
  const r = checkLexicon('券要说清货源，核销靠门店范围。', { lexicon, hints, tokens });
  assert.equal(r.segmenter, 'jieba', '有 tokens → 走 jieba 完整词路径');
  const terms = r.suspiciousList.map((s) => s.term);
  assert.ok(!terms.includes('货源'), '货源在词表 → 不可疑');
  assert.ok(terms.includes('核销') && terms.includes('门店'), '完整词不在词表 → 可疑');
  const hit = r.suspiciousList.find((s) => s.term === '门店');
  assert.ok(hit.sentence && hit.sentence.includes('门店'), '可疑词应附所在原句');
});

// ② allowlist 生效：事实性专名不算陌生用词。
test('allowlist 生效：事实性专名剔除，非白名单陌生词仍报', () => {
  const tokens = [
    { word: '闲鱼', flag: 'n' }, { word: '车厘子', flag: 'n' }, { word: '核销', flag: 'v' }
  ];
  const r = checkLexicon('闲鱼上换车厘子，先过核销这关。', {
    lexicon, hints: { hints: {}, allowlist: ['闲鱼', '车厘子'] }, tokens
  });
  const terms = r.suspiciousList.map((s) => s.term);
  assert.ok(!terms.includes('闲鱼') && !terms.includes('车厘子'), 'allowlist 词被剔除');
  assert.ok(terms.includes('核销'), '非 allowlist 的陌生词仍报');
});

// 通用过滤：数字/量词组合不算陌生用词。
test('数字/量词组合不进可疑清单', () => {
  const tokens = [{ word: '三天', flag: 'm' }, { word: '一周', flag: 'm' }, { word: '核销', flag: 'v' }];
  const r = checkLexicon('三天一周就要核销。', { lexicon, hints, tokens });
  const terms = r.suspiciousList.map((s) => s.term);
  assert.ok(!terms.includes('三天') && !terms.includes('一周'), '数字/量词组合剔除');
});

// ③ 回退路径不崩：强制 MFM，结构完整、恒不 block。
test('回退路径不崩：noJieba 强制 MFM，结构完整恒不 block', () => {
  const r = checkLexicon('第一个坎是找货，券散在各种口子。', { lexicon, hints, noJieba: true });
  assert.equal(r.segmenter, 'mfm', '标注回退：未分词');
  assert.ok(r.fallbackReason, '带回退原因');
  assert.equal(r.blockCount, 0);
  assert.equal(r.passed, true);
  assert.ok(Array.isArray(r.suspiciousList));
  assert.ok(typeof r.businessHitTotal === 'number');
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
    console.log(`  [词表] ${ip}/${name}（${r.segmenter}）: 业务词 ${r.businessHitTypes}种/${r.businessHitTotal}次  可疑 ${r.suspiciousTypes}种/${r.suspiciousTotal}次`);
  }
});
