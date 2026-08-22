import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { checkSourceLeakage, readDocx } from '../leakage/check-source-leakage.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const read = (ip, name) => readFileSync(join(repo, 'ips', ip, 'outputs', name), 'utf8');

// --- 内联小语料：逻辑单测，不依赖仓库外的语料 ---

test('literal reuse from the source is caught', () => {
  const corpus = '前面来源无关的一段。我爱这个魔幻的世界，鸡蛋卷问号从头到尾。';
  const drafts = { 'x/a': '仿写开头。我爱这个魔幻的世界，鸡蛋卷问号我这么写了。' };
  const r = checkSourceLeakage(corpus, drafts, { n: 12 });
  assert.equal(r.passed, false);
  assert.equal(r.results[0].hitCount, 1);
  assert.ok(r.results[0].longest.len >= 12);
});

test('protected factual enumerations do not count as leakage', () => {
  const corpus = '券散在企业福利、银行联名、会员专属这些口子里的原文表述。';
  const drafts = { 'x/a': '这些券藏在企业福利、银行联名、会员专属这些地方，得自己找。' };
  const r = checkSourceLeakage(corpus, drafts, {
    n: 12,
    protectedPhrases: ['企业福利、银行联名、会员专属']
  });
  assert.equal(r.passed, true);
  assert.equal(r.results[0].hitCount, 0);
});

test('n is adjustable: an 18-char lift passes at n=20 but fails at n=12', () => {
  const lifted = '这是一段刚好十八个字的照抄片段示例哈'; // 恰好 18 字
  assert.equal(lifted.length, 18);
  const corpus = `甲甲甲甲甲。${lifted}乙乙乙乙乙。`;
  const drafts = { 'x/a': `丙丙丙丙丙。${lifted}丁丁丁丁丁。` };
  assert.equal(checkSourceLeakage(corpus, drafts, { n: 12 }).passed, false, 'n=12 应抓到 18 字照抄');
  assert.equal(checkSourceLeakage(corpus, drafts, { n: 20 }).passed, true, 'n=20 应放过（正是旧阈值的漏洞）');
});

test('completely unrelated text yields zero hits', () => {
  const corpus = '来源讲的是养号选品出单的一整套方法论和话术设计。';
  const drafts = { 'x/a': '这篇稿子从头到尾说的是别的事情，用词也完全不一样呢。' };
  const r = checkSourceLeakage(corpus, drafts, { n: 12 });
  assert.equal(r.passed, true);
  assert.equal(r.results[0].hitCount, 0);
  assert.equal(r.results[0].longest.len, 0);
});

// --- 条件测试：语料在仓库外，缺失则 skip；存在则对实际产出稿断言 0 命中 ---

const fmt = (res) =>
  res.segments.map((s) => `${s.len}字「${s.text}」`).join(' / ') || '(无)';

const QIAN_DOCX = 'C:\\Users\\admin\\Downloads\\钱十七-闲鱼文案拆解.docx';

test('钱十七 shipped drafts carry no 12-char lift from the source docx', (t) => {
  if (!existsSync(QIAN_DOCX)) return t.skip('来源 docx 不在本机');
  const corpus = readDocx(QIAN_DOCX);
  const drafts = {
    '钱十七/长视频版': read('钱十七', '闲鱼餐饮券-长视频版.md'),
    '钱十七/短视频版': read('钱十七', '闲鱼餐饮券-短视频版.md')
  };
  const r = checkSourceLeakage(corpus, drafts, { n: 12 });
  const bad = r.results.filter((x) => x.hitCount > 0).map((x) => `${x.name}: ${fmt(x)}`);
  assert.equal(r.passed, true, `钱十七产出稿含来源照抄片段:\n${bad.join('\n')}`);
});

const BANFO_CORPUS = join(repo, '仿写案例库', '半佛', 'extracted_texts');

test('半佛 shipped video drafts carry no 12-char lift from the corpus', (t) => {
  if (!existsSync(BANFO_CORPUS)) return t.skip('半佛语料目录不在本机');
  const files = readdirSync(BANFO_CORPUS)
    .filter((f) => ['.txt', '.md'].includes(extname(f).toLowerCase()))
    .map((f) => join(BANFO_CORPUS, f))
    .filter((p) => statSync(p).isFile());
  const corpus = files.map((p) => readFileSync(p, 'utf8')).join('\n');
  // 只查长/短视频版，不含图文版。
  const drafts = {
    '半佛/长视频版': read('半佛', '闲鱼餐饮券-长视频版.md'),
    '半佛/短视频版': read('半佛', '闲鱼餐饮券-短视频版.md')
  };
  const r = checkSourceLeakage(corpus, drafts, { n: 12 });
  const bad = r.results.filter((x) => x.hitCount > 0).map((x) => `${x.name}: ${fmt(x)}`);
  assert.equal(r.passed, true, `半佛产出稿含来源照抄片段:\n${bad.join('\n')}`);
});
