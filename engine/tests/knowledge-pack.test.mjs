// 知识包接入生成链路的单元测试（2026-09-04「恢复强制知识包」）。
// 跑：node --test engine/tests/knowledge-pack.test.mjs
//
// 覆盖：显式路径命中 / 映射目录命中 / 空包被拒 / 构建器退出 1 与 2 的硬停（mock 子进程）/
//       dry-run 夹具包 / 提示词注入位置与红线文字 / 报告小节。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadOrder, REPO_ROOT } from '../../cli/lib/inputs.mjs';
import {
  KnowledgeError, validateKnowledgePack, readKnowledgePack, resolveKnowledgePack,
  buildKnowledgePack, knowledgeKeywords, knowledgeOutDirName, knowledgeLogLine,
  resolveKnowledgePython, BUILDER_REL
} from '../../cli/lib/knowledge.mjs';
import {
  buildKnowledgeSection, knowledgeInjectedTitles, KNOWLEDGE_INJECT_MAX, buildSystemPrompt
} from '../../cli/lib/prompt.mjs';
import { fixtureKnowledgePack } from '../../cli/lib/fixture.mjs';
import { renderReport } from '../../cli/lib/report.mjs';
import { runAiFlavor, runStyleFloor, runSeriesReference, runDeviceReuse, runWrittenWords, runSkeleton, trustSelfCheck } from '../../cli/lib/gates.mjs';
import { LENGTH_PRESETS } from '../../cli/lib/length-presets.mjs';

// 仓库里已有的两份夹具包：正例（两条来源）与空包（sources: []）。
const FIXTURE_DIR = join(REPO_ROOT, 'engine/fixtures/writer-tests/test-case-001');
const GOOD_PACK = join(FIXTURE_DIR, 'knowledge-pack.json');
const EMPTY_PACK = join(FIXTURE_DIR, 'adversarial-empty-knowledge-pack.json');

// 造一份最小工单（带事实卡），返回工单路径。
function makeOrder(dir, extra = {}) {
  const cardPath = join(dir, 'fact-card.md');
  if (!existsSync(cardPath)) {
    writeFileSync(cardPath, '# 事实卡 · 测试〔终版候选〕\n\n- 想要数：八百二十九\n', 'utf8');
  }
  const orderPath = join(dir, `order-${Math.random().toString(36).slice(2, 8)}.json`);
  writeFileSync(orderPath, JSON.stringify({
    filmId: 'knowledge-pack-test', styleId: 'qian17', topic: '京东家政券',
    points: ['券从哪来', '封号风险'], audience: '起步期', mode: 'topic',
    lengthPreset: 'long', factCardPath: cardPath, ...extra
  }), 'utf8');
  return orderPath;
}

// --- 校验层：非空包放行、空包硬停 ---
test('validateKnowledgePack：正例夹具放行并数出 relation 分布', () => {
  const k = readKnowledgePack(GOOD_PACK);
  assert.equal(k.resultCount, 2);
  assert.equal(k.usableCount, 2);
  assert.equal(k.sources.length, 2);
  // 1.0 版夹具没有 retrieval，回退按 sources 数；relation 缺失一律记 supplement
  assert.equal(k.relationDistribution.supplement, 2);
  assert.equal(k.primaryTermHits, null, '老版包没有这个字段，应如实记 null 而不是编个 0');
});

test('validateKnowledgePack：空包夹具必须被拒（零结果不得空包放行）', () => {
  assert.throws(() => readKnowledgePack(EMPTY_PACK), (e) =>
    e instanceof KnowledgeError && /空包/.test(e.message) && /不得空包放行/.test(e.message));
  // result_count 谎报也拦得住：字段说有 5 条，sources 是空的
  assert.throws(
    () => validateKnowledgePack({ retrieval: { result_count: 5, usable_source_count: 5 }, sources: [] }),
    (e) => e instanceof KnowledgeError && /空包/.test(e.message)
  );
  // usable_source_count 为 0 同样拒
  assert.throws(
    () => validateKnowledgePack({ retrieval: { result_count: 3, usable_source_count: 0 }, sources: [{ title: 'x' }] }),
    (e) => e instanceof KnowledgeError
  );
});

test('validateKnowledgePack：2.0 版包的 retrieval 字段被原样采信', () => {
  const k = validateKnowledgePack(fixtureKnowledgePack(), '（夹具）');
  assert.equal(k.resultCount, 3);
  assert.equal(k.primaryTermHits, 1);
  assert.deepEqual(k.relationDistribution, { support: 1, supplement: 1, counterevidence: 1 });
  assert.equal(k.schemaVersion, '2.0');
});

test('readKnowledgePack：文件不存在 / 不是 json 都是硬停', () => {
  assert.throws(() => readKnowledgePack(join(tmpdir(), '绝不存在的知识包.json')),
    (e) => e instanceof KnowledgeError && /不存在/.test(e.message));
  const dir = mkdtempSync(join(tmpdir(), 'kp-bad-'));
  const p = join(dir, 'k.json');
  writeFileSync(p, '{ 这不是 json', 'utf8');
  assert.throws(() => readKnowledgePack(p), (e) => e instanceof KnowledgeError && /不是合法 json/.test(e.message));
});

// --- 定位层：显式路径 / 映射目录 / 现建 ---
test('定位：工单 knowledgePackPath 显式指定命中，且不起 python', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kp-explicit-'));
  const orderPath = makeOrder(dir, { knowledgePackPath: GOOD_PACK });
  const k = resolveKnowledgePack(loadOrder(orderPath), {
    runBuilder: () => assert.fail('显式路径命中时不该调构建器')
  });
  assert.equal(k.path, GOOD_PACK);
  assert.match(k.source, /knowledgePackPath/);
  assert.equal(k.built, false);
  assert.equal(k.resultCount, 2);
});

test('定位：工单 knowledgePackPath 指错路径 → 硬停，不回退现建', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kp-explicit2-'));
  const orderPath = makeOrder(dir, { knowledgePackPath: join(dir, '没有这个包.json') });
  assert.throws(() => resolveKnowledgePack(loadOrder(orderPath), {
    runBuilder: () => assert.fail('显式路径写错时不该偷偷改去现建')
  }), (e) => e instanceof KnowledgeError && /knowledgePackPath/.test(e.message));
});

test('定位：filmId 在 film-index 映射目录下的现成包命中（不调构建器）', () => {
  // research-runs 是 gitignore 的私有证据目录，别往里写测试文件——用临时目录顶掉映射表与证据根。
  const tmp = mkdtempSync(join(tmpdir(), 'kp-mapped-'));
  const researchRoot = join(tmp, 'research-runs');
  const runDir = join(researchRoot, '2026-09-04_测试选题_采集');
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, 'knowledge-pack.json'), JSON.stringify(fixtureKnowledgePack()), 'utf8');
  const filmIndexPath = join(tmp, 'film-index.json');
  writeFileSync(filmIndexPath, JSON.stringify({ map: { 'mapped-film': '2026-09-04_测试选题_采集' } }), 'utf8');

  const orderPath = makeOrder(tmp, { filmId: 'mapped-film' });
  const k = resolveKnowledgePack(loadOrder(orderPath), {
    researchRoot, filmIndexPath,
    runBuilder: () => assert.fail('映射目录已有包时不该调构建器')
  });
  assert.equal(k.path, join(runDir, 'knowledge-pack.json'));
  assert.match(k.source, /film-index\.json 映射/);
  assert.equal(k.built, false);
  assert.equal(k.resultCount, 3);
});

test('定位：映射不在、但 research-runs 里有同名 filmId 的目录带包 → 模糊兜底命中', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kp-fuzzy-'));
  const researchRoot = join(tmp, 'research-runs');
  const runDir = join(researchRoot, 'workshop-2026-09-04_fuzzy-film');
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, 'knowledge-pack.json'), JSON.stringify(fixtureKnowledgePack()), 'utf8');
  const filmIndexPath = join(tmp, 'film-index.json');
  writeFileSync(filmIndexPath, JSON.stringify({ map: {} }), 'utf8');

  const orderPath = makeOrder(tmp, { filmId: 'fuzzy-film' });
  const k = resolveKnowledgePack(loadOrder(orderPath), {
    researchRoot, filmIndexPath,
    runBuilder: () => assert.fail('模糊目录里已有包时不该调构建器')
  });
  assert.equal(k.path, join(runDir, 'knowledge-pack.json'));
  assert.equal(k.built, false);
});

test('定位：映射目录里的包是空包 → 硬停，不会「找不到就现建」绕过去', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kp-mapped-empty-'));
  const researchRoot = join(tmp, 'research-runs');
  const runDir = join(researchRoot, 'run');
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, 'knowledge-pack.json'), JSON.stringify({ schema_version: '1.0', sources: [] }), 'utf8');
  const filmIndexPath = join(tmp, 'film-index.json');
  writeFileSync(filmIndexPath, JSON.stringify({ map: { 'empty-film': 'run' } }), 'utf8');
  const orderPath = makeOrder(tmp, { filmId: 'empty-film' });
  assert.throws(() => resolveKnowledgePack(loadOrder(orderPath), {
    researchRoot, filmIndexPath,
    runBuilder: () => assert.fail('空包应该直接硬停，不许改去现建')
  }), (e) => e instanceof KnowledgeError && /空包/.test(e.message));
});

test('定位：映射目录命中的路径拼法（不依赖本机 research-runs）', () => {
  // 上一条要真有文件才跑得到；这条只钉「落点目录名怎么算出来的」，任何机器都能跑。
  assert.equal(knowledgeOutDirName({ filmId: 'mac-weixin-duokai' }), '2026-08-27_mac微信多开_净采4',
    '有映射时现建也要落进映射目录，别再造一个新目录');
  const fresh = knowledgeOutDirName({ filmId: 'brand-new-film' });
  assert.match(fresh, /^workshop-\d{4}-\d{2}-\d{2}_brand-new-film$/, '没映射时按采集流水线的 workshop-<日期>_<filmId> 约定');
});

test('定位：都没有 → 现建，命令行按规范拼（build --topic --keywords --out）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kp-build-'));
  const orderPath = makeOrder(dir, { filmId: 'never-mapped-film', knowledgeKeywords: ['家政券', '京东'] });
  let seen = null;
  const logs = [];
  // 让 mock 构建器真把包写到它被告知的 out 路径上，走通「建完再读」这一段。
  // repoRoot 指到临时目录，产物不落进用户的 research-runs。
  const k = resolveKnowledgePack(loadOrder(orderPath), {
    log: (m) => logs.push(m),
    repoRoot: dir,
    filmIndexPath: join(dir, '不存在的-film-index.json'),
    researchRoot: join(dir, 'research-runs'),
    runBuilder: (call) => {
      seen = call;
      const abs = join(dir, call.outRel);
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, JSON.stringify(fixtureKnowledgePack()), 'utf8');
      return { status: 0, stdout: abs, stderr: '' };
    }
  });
  assert.ok(seen, '应真的调了构建器');
  assert.equal(seen.topic, '京东家政券');
  assert.deepEqual(seen.keywords, ['家政券', '京东'], '工单 knowledgeKeywords 优先');
  assert.ok(seen.args.includes(BUILDER_REL));
  assert.ok(seen.args.includes('build') && seen.args.includes('--topic') && seen.args.includes('--out'));
  assert.match(seen.outRel, /^research-runs\/workshop-\d{4}-\d{2}-\d{2}_never-mapped-film\/knowledge-pack\.json$/);
  assert.equal(k.built, true);
  assert.equal(k.resultCount, 3);
  assert.ok(logs.some((m) => /未找到，正在检索知识库/.test(m)), '现建时要先打一行「正在检索知识库…」');
});

// --- 构建器退出码：1 零结果 / 2 知识库不可访问 / 其他 ---
test('构建器退出 1（零结果）→ 硬停，中文原因带补救办法', () => {
  assert.throws(
    () => buildKnowledgePack({
      topic: '毫无覆盖的选题', keywords: ['甲', '乙'], outRel: 'research-runs/x/knowledge-pack.json',
      runBuilder: () => ({ status: 1, stdout: '', stderr: '[FAIL] 检索零结果：知识库对该选题无可用覆盖。' })
    }),
    (e) => e instanceof KnowledgeError
      && /零结果/.test(e.message)
      && /停止生成/.test(e.message)
      && /knowledgeKeywords/.test(e.message)
      && /毫无覆盖的选题/.test(e.message)
  );
});

test('构建器退出 2（知识库不可访问）→ 硬停，并告诉人怎么装', () => {
  assert.throws(
    () => buildKnowledgePack({
      topic: 't', keywords: [], outRel: 'research-runs/x/knowledge-pack.json',
      runBuilder: () => ({ status: 2, stdout: '', stderr: '[FAIL] 无法导入闲鱼知识库 API' })
    }),
    (e) => e instanceof KnowledgeError
      && /知识库不可访问/.test(e.message)
      && /venv/.test(e.message)
      && /KNOWLEDGE_PACK_PYTHON/.test(e.message)
  );
});

test('构建器退出 0 却没写出文件 → 也算硬停（不许假成功）', () => {
  assert.throws(
    () => buildKnowledgePack({
      topic: 't', keywords: [], outRel: 'research-runs/绝不存在的目录/knowledge-pack.json',
      runBuilder: () => ({ status: 0, stdout: '', stderr: '' })
    }),
    (e) => e instanceof KnowledgeError && /没写出文件/.test(e.message)
  );
});

test('构建器其他非 0 退出码 → 硬停', () => {
  assert.throws(
    () => buildKnowledgePack({
      topic: 't', keywords: [], outRel: 'research-runs/x/knowledge-pack.json',
      runBuilder: () => ({ status: 9, stdout: '', stderr: 'boom' })
    }),
    (e) => e instanceof KnowledgeError && /退出码 9/.test(e.message)
  );
});

test('python 解释器：KNOWLEDGE_PACK_PYTHON 可覆盖；缺省指仓库根 .venv', () => {
  const over = resolveKnowledgePython({ KNOWLEDGE_PACK_PYTHON: 'D:/some/python.exe' });
  assert.equal(over.python, 'D:/some/python.exe');
  assert.match(over.source, /KNOWLEDGE_PACK_PYTHON/);
  const def = resolveKnowledgePython({});
  assert.match(def.python.split('\\').join('/'), /\.venv\/Scripts\/python\.exe$/);
  assert.match(def.source, /\.venv/);
});

test('python 不存在且要现建 → 按「知识库不可访问」硬停并给安装提示', () => {
  assert.throws(
    () => buildKnowledgePack({
      topic: 't', keywords: [], outRel: 'research-runs/x/knowledge-pack.json',
      env: { KNOWLEDGE_PACK_PYTHON: join(tmpdir(), '绝不存在的-python.exe') }
    }),
    (e) => e instanceof KnowledgeError && /知识库不可访问/.test(e.message) && /python -m venv/.test(e.message)
  );
});

// --- 关键词 ---
test('检索关键词：工单 knowledgeKeywords 优先（数组或逗号串），否则由 topic+points 拼', () => {
  assert.deepEqual(knowledgeKeywords({ knowledgeKeywords: ['甲', '乙'] }), ['甲', '乙']);
  assert.deepEqual(knowledgeKeywords({ knowledgeKeywords: '甲，乙, 丙' }), ['甲', '乙', '丙']);
  const derived = knowledgeKeywords({ topic: '京东家政券', points: ['券从哪来', '这一条太长了长到不该当检索词用的程度'] });
  assert.deepEqual(derived, ['京东家政券', '券从哪来'], '超过 12 字的要点不进检索词');
});

// --- dry-run 夹具 ---
test('dry-run 夹具包：字段齐全、能过校验、三种 relation 各有一条', () => {
  const pack = fixtureKnowledgePack();
  const k = validateKnowledgePack(pack, '（夹具）');
  assert.equal(k.resultCount, 3);
  assert.equal(k.relationDistribution.counterevidence, 1, '夹具要留一条反证，才能验到「讲坑」那一段');
  assert.ok(Array.isArray(pack.hard_rules) && pack.hard_rules.length === 4, '硬规则清单要随包下发');
  for (const s of pack.sources) {
    assert.ok(s.title && s.excerpt && s.relation, '每条都要有标题/摘录/关系');
  }
  assert.match(knowledgeLogLine({ ...k, path: 'p' }), /知识包：p（3 条，support 1 \/ supplement 1 \/ counter 1）/);
});

// --- CLI 端到端：--dry-run 走夹具包；显式指定空包时 --dry-run 也照拦、且不落盘 ---
test('CLI --dry-run：走内置夹具包，全门禁 PASS 且报告含「知识包使用」', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kp-cli-'));
  const out = join(dir, 'out');
  const orderPath = makeOrder(dir, { filmId: 'kp-cli-dryrun' });
  const r = spawnSync(process.execPath, [
    join(REPO_ROOT, 'cli', 'generate.mjs'),
    '--style', 'qian17', '--order', orderPath, '--out', out, '--dry-run'
  ], { encoding: 'utf8', cwd: REPO_ROOT, timeout: 300000 });
  assert.equal(r.status, 0, `dry-run 应成功：\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /知识包：（--dry-run 内置夹具包/);
  assert.match(r.stdout, /3 条，support 1 \/ supplement 1 \/ counter 1/);
  const report = readFileSync(join(out, 'generation-report.md'), 'utf8');
  assert.match(report, /## 知识包使用/);
  assert.match(report, /提示词里注入的条目（3 条）/);
});

test('CLI --dry-run：工单点名空包时照样硬停、非 0 退出、一个文件都不落', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kp-cli-empty-'));
  const out = join(dir, 'out');
  const orderPath = makeOrder(dir, { filmId: 'kp-cli-empty', knowledgePackPath: EMPTY_PACK });
  const r = spawnSync(process.execPath, [
    join(REPO_ROOT, 'cli', 'generate.mjs'),
    '--style', 'qian17', '--order', orderPath, '--out', out, '--dry-run'
  ], { encoding: 'utf8', cwd: REPO_ROOT, timeout: 300000 });
  assert.notEqual(r.status, 0, '空包必须非 0 退出，--dry-run 不是绕过校验的后门');
  assert.match(r.stderr, /知识包这一关没过/);
  assert.match(r.stderr, /空包/);
  assert.equal(existsSync(out), false, '硬停发生在落盘之前，输出目录都不该被建出来');
});

// --- 提示词注入 ---
test('提示词：背景知识段写死红线（数字不得进稿、事实只来自事实卡），反证条目单独标出', () => {
  const s = buildKnowledgeSection(fixtureKnowledgePack());
  assert.match(s, /# 背景知识/);
  assert.match(s, /任何数字、案例、收益、平台结论，都不得写进口播稿/);
  assert.match(s, /口播稿的事实只能来自后面那张事实卡/);
  assert.match(s, /反证 \/ 风险条目/);
  assert.match(s, /只能用来讲「坑」，不能变成核心方法/);
  assert.match(s, /一律以事实卡为准/);
  // 条目正文真的进去了
  assert.match(s, /代订类目的渠道差价是怎么来的/);
  assert.match(s, /冒用身份走协议价被查的教训/);
  // 没包 → 整节不注入
  assert.equal(buildKnowledgeSection(null), '');
  assert.equal(buildKnowledgeSection({ sources: [] }), '');
});

test('提示词：注入条目上限与报告口径同源（不许两处写死两个数）', () => {
  const many = { sources: Array.from({ length: 20 }, (_, i) => ({ title: `条目${i}`, excerpt: 'x', relation: 'supplement' })) };
  const titles = knowledgeInjectedTitles(many);
  assert.equal(titles.length, KNOWLEDGE_INJECT_MAX);
  const s = buildKnowledgeSection(many);
  assert.ok(s.includes(`条目${KNOWLEDGE_INJECT_MAX - 1}`));
  assert.equal(s.includes(`条目${KNOWLEDGE_INJECT_MAX}`), false, '超出上限的条目不该进提示词');
});

test('提示词：背景知识段排在范文之后、所有规则小节之前、事实卡之前', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kp-prompt-'));
  const orderPath = makeOrder(dir);
  const built = buildSystemPrompt(loadOrder(orderPath), { quiet: true, knowledge: fixtureKnowledgePack() });
  const s = built.system;
  const at = (h) => {
    const i = s.indexOf(h);
    assert.ok(i >= 0, `系统提示里找不到「${h}」`);
    return i;
  };
  const knowledgeAt = at('# 背景知识（');
  const exampleAt = s.indexOf('# 范文（先读这一节');
  if (exampleAt >= 0) {
    assert.ok(exampleAt < knowledgeAt, '范文段仍排第一，背景知识跟在它后面');
  }
  for (const h of [
    '# 铁律（违反任一条即为废稿）',
    '# 去 AI 味 · 配额',
    '# 信任配方（必须保留的十条硬规则）',
    '# 装置轮换（硬规则',
    '# 本期事实卡'
  ]) {
    assert.ok(knowledgeAt < at(h), `背景知识段必须排在「${h}」之前`);
  }
  // 不传包时整节不注入（老调用方不受影响）
  const plain = buildSystemPrompt(loadOrder(makeOrder(dir)), { quiet: true });
  assert.equal(plain.system.includes('# 背景知识（'), false);
});

// --- 报告 ---
test('generation-report：「知识包使用」小节齐全（路径/条数/分布/primary_term_hits/注入清单）', () => {
  const text = '我是圣矾。做闲鱼，找圣矾。这条链接八百二十九个人想要。';
  const pack = fixtureKnowledgePack();
  const k = { ...validateKnowledgePack(pack, 'p'), path: 'D:/x/knowledge-pack.json', source: '现建（research-runs/x）', built: true };
  const md = renderReport({
    order: { topic: 't', filmId: 'f', audience: 'a' },
    style: { name: '钱十七', id: 'qian17', status: '定版', ip: '钱十七' },
    factCardPath: 'p', factCardSource: 's', factCardDraft: false, mode: 'topic',
    aiFlavor: runAiFlavor(text, '钱十七'), styleFloor: runStyleFloor(text, '钱十七'),
    lexicon: { available: false, reason: '测试跳过' }, trust: trustSelfCheck(text),
    overlong: [], retries: 0, consistency: { segCount: 1 },
    model: 'm', provider: '', stamp: 'now', preset: LENGTH_PRESETS.long, compliance: null,
    series: runSeriesReference(text), deviceReuse: runDeviceReuse(text, {}),
    written: runWrittenWords(text), skeleton: runSkeleton(text, {}),
    review: { skipped: true, reason: '测试' },
    knowledge: k, knowledgeInjected: knowledgeInjectedTitles(pack)
  });
  assert.match(md, /## 知识包使用/);
  assert.match(md, /D:\/x\/knowledge-pack\.json/);
  assert.match(md, /条目数：3（可用 3）/);
  assert.match(md, /relation 分布：support 1 \/ supplement 1 \/ counterevidence 1/);
  assert.match(md, /primary_term_hits[^：]*：1/);
  assert.match(md, /提示词里注入的条目（3 条）/);
  assert.match(md, /代订类目的渠道差价是怎么来的/);
  assert.match(md, /一律不得出现在口播稿里/);
  // 没记录时也要有小节（不许整段消失）
  const none = renderReport({
    order: { topic: 't', filmId: 'f', audience: 'a' },
    style: { name: '钱十七', id: 'qian17', status: '定版', ip: '钱十七' },
    factCardPath: 'p', factCardSource: 's', factCardDraft: false, mode: 'topic',
    aiFlavor: runAiFlavor(text, '钱十七'), styleFloor: runStyleFloor(text, '钱十七'),
    lexicon: { available: false, reason: '测试跳过' }, trust: trustSelfCheck(text),
    overlong: [], retries: 0, consistency: { segCount: 1 },
    model: 'm', provider: '', stamp: 'now', preset: LENGTH_PRESETS.long, compliance: null,
    series: runSeriesReference(text), deviceReuse: runDeviceReuse(text, {}),
    written: runWrittenWords(text), skeleton: runSkeleton(text, {}), review: { skipped: true, reason: '测试' }
  });
  assert.match(none, /## 知识包使用/);
  assert.match(none, /（无结果记录）/);
});
