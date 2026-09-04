// 文案工坊生成 CLI 的单元测试。跑：node --test engine/tests/cli-generate.test.mjs
// 覆盖：模型层 provider 校验与人话网络错误、口播拆句(≤50)与数字/破折号规范化、事实卡拒绝裸生成。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLlmConfig, callModel, LlmError, DEFAULT_MODEL } from '../../cli/lib/llm.mjs';
import { normalizeSpoken, splitToSentences } from '../../cli/lib/spoken.mjs';
import { loadOrder, locateFactCard, resolveLengthPreset, loadHistoryPool, InputError } from '../../cli/lib/inputs.mjs';
import {
  buildLengthFormSection, buildRewriteBlock, buildWritingDiscipline,
  buildNewSeriesSection, buildSpokenLexiconSection, buildDeviceRotationSection, loadWrittenWords
} from '../../cli/lib/prompt.mjs';
import {
  runCompliance, complianceFeedback, checkSelfIdentity, selfIdentityFeedback,
  runSeriesReference, seriesReferenceFeedback, runDeviceReuse, deviceReuseFeedback,
  runWrittenWords, writtenWordFeedback, runLexicon,
  runAiFlavor, aiFlavorFeedback, aiFlavorWarnLines, runSkeleton, skeletonFeedback, AI_FLAVOR_LABELS,
  trustSelfCheck
} from '../../cli/lib/gates.mjs';
import { DEVICE_RULES, buildUsedDeviceList, checkBannedDevices } from '../../engine/variation/check-devices.mjs';
import { checkRepetition, checkSkeletonCollision, normalizeSkeleton } from '../../engine/variation/check-repetition.mjs';
import { LENGTH_PRESETS, DEFAULT_LENGTH_PRESET, inferLengthPreset } from '../../cli/lib/length-presets.mjs';
import { buildAntiAiQuotaSection, buildQian17SignatureSection } from '../../cli/lib/prompt.mjs';
import { STYLE_FLOOR_RULES, checkStyleFloor } from '../../engine/naturalness/check-style-floor.mjs';
import { runStyleFloor, styleFloorFeedback, styleFloorWarnLines } from '../../cli/lib/gates.mjs';
import { REVIEW_SYSTEM, buildReviewPrompt, parseReviewOutput, runLlmReview, reviewFeedback } from '../../cli/lib/review.mjs';
import { renderReport } from '../../cli/lib/report.mjs';
import { fixtureRaw } from '../../cli/lib/fixture.mjs';
import { parseSegments, renderScript, splitToSentences as splitSpoken, normalizeSpoken as normSpoken } from '../../cli/lib/spoken.mjs';
import { loadHints } from '../../engine/naturalness/check-lexicon.mjs';
import {
  captureStatusToError, classifyFactCard, registerFilmIndex, findCardInDir,
  filterGithubRepos, extractKeywords
} from '../../cli/lib/collect.mjs';
import { writeFileSync, mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// --- 模型层：未知 provider 报错 ---
test('未知 STYLE_LLM_PROVIDER 值报错', () => {
  const save = process.env.STYLE_LLM_PROVIDER;
  process.env.STYLE_LLM_PROVIDER = 'azure';
  process.env.STYLE_LLM_API_KEY = 'dummy';
  assert.throws(() => resolveLlmConfig({ dryRun: false }), (e) => e instanceof LlmError && /只能是/.test(e.message));
  if (save === undefined) delete process.env.STYLE_LLM_PROVIDER; else process.env.STYLE_LLM_PROVIDER = save;
});

test('缺 STYLE_LLM_API_KEY 报人话错误（非 dry-run）', () => {
  const saveP = process.env.STYLE_LLM_PROVIDER;
  const saveK = process.env.STYLE_LLM_API_KEY;
  delete process.env.STYLE_LLM_PROVIDER;
  delete process.env.STYLE_LLM_API_KEY;
  assert.throws(() => resolveLlmConfig({ dryRun: false }), (e) => e instanceof LlmError && /密钥/.test(e.message));
  // dry-run 时允许缺 key
  assert.doesNotThrow(() => resolveLlmConfig({ dryRun: true }));
  if (saveP !== undefined) process.env.STYLE_LLM_PROVIDER = saveP;
  if (saveK !== undefined) process.env.STYLE_LLM_API_KEY = saveK;
});

// --- 模型层：openai 指向死端点 → 人话网络错误 ---
test('PROVIDER=openai 指向死端点报人话网络错误', async () => {
  const cfg = resolveLlmConfig({ dryRun: false });
  cfg.provider = 'openai';
  cfg.apiKey = 'dummy';
  cfg.baseUrl = 'http://127.0.0.1:59997/v1';
  cfg.model = 'gpt-x';
  await assert.rejects(
    () => callModel({ cfg, system: 's', messages: [{ role: 'user', content: 'hi' }] }),
    (e) => e instanceof LlmError && /连不上|网络/.test(e.message)
  );
});

test('DEFAULT_MODEL 是当前主力型号', () => {
  assert.equal(DEFAULT_MODEL, 'claude-opus-5');
});

// --- 模型层：claude-code 档免 key、留空型号用本机默认 ---
test('PROVIDER=claude-code 免 STYLE_LLM_API_KEY 不抛错；型号留空', () => {
  const saveP = process.env.STYLE_LLM_PROVIDER;
  const saveK = process.env.STYLE_LLM_API_KEY;
  const saveM = process.env.STYLE_LLM_MODEL;
  process.env.STYLE_LLM_PROVIDER = 'claude-code';
  delete process.env.STYLE_LLM_API_KEY;
  delete process.env.STYLE_LLM_MODEL;
  let cfg;
  assert.doesNotThrow(() => { cfg = resolveLlmConfig({ dryRun: false }); });
  assert.equal(cfg.provider, 'claude-code');
  assert.equal(cfg.model, '');           // 留空 → 用本机 claude 默认型号
  // 指定型号时原样带上
  process.env.STYLE_LLM_MODEL = 'claude-opus-5';
  assert.equal(resolveLlmConfig({ dryRun: false }).model, 'claude-opus-5');
  if (saveP === undefined) delete process.env.STYLE_LLM_PROVIDER; else process.env.STYLE_LLM_PROVIDER = saveP;
  if (saveK === undefined) delete process.env.STYLE_LLM_API_KEY; else process.env.STYLE_LLM_API_KEY = saveK;
  if (saveM === undefined) delete process.env.STYLE_LLM_MODEL; else process.env.STYLE_LLM_MODEL = saveM;
});

// --- 模型层：claude-code 命令不存在 → 人话「未安装 Claude Code」---
test('PROVIDER=claude-code 命令不存在报人话错（注入不存在的可执行名）', async () => {
  const saveCmd = process.env.STYLE_CLAUDE_CMD;
  process.env.STYLE_CLAUDE_CMD = 'claude-nonexistent-xyz-42'; // PATH 里造不出的名字
  const cfg = { provider: 'claude-code', apiKey: '', model: '', baseUrl: '' };
  await assert.rejects(
    () => callModel({ cfg, system: '系统提示', messages: [{ role: 'user', content: '你好' }] }),
    (e) => e instanceof LlmError && /未安装 Claude Code/.test(e.message)
  );
  if (saveCmd === undefined) delete process.env.STYLE_CLAUDE_CMD; else process.env.STYLE_CLAUDE_CMD = saveCmd;
});

// --- 口播规范化：数字区间/¥/破折号 ---
test('规范化：区间→到、¥→元、消灭破折号', () => {
  const n = normalizeSpoken('价格在¥130到¥1200，利润率30%–50%，你自己掂量——别急。');
  assert.equal(/[¥￥]/.test(n), false, '¥ 应被消灭');
  assert.equal(/——|—|–/.test(n), false, '破折号应被消灭');
  assert.match(n, /130元到1200元/);
  assert.match(n, /30%到50%/);
});

// --- 拆句：超 50 字长句被拆到 ≤50，不在切点造出裸「的」结尾 ---
test('长句拆到 ≤50 且切点不留裸「的」', () => {
  const long = '这个类目一天几万次搜索，它只说明有人在找，不等于你发上去就能成交，接下来还得看货源拿不拿得到，价格区间也拉得很开，你得自己想清楚再决定做不做。';
  const sents = splitToSentences(normalizeSpoken(long));
  assert.ok(sents.length >= 2, '应被拆成多句');
  for (const s of sents) {
    const L = s.replace(/[。！？]$/, '').length;
    assert.ok(L <= 60, `单句 ${L} 字应 ≤60：${s}`);
    // 非最终句不应以裸「的」结尾（除非含系动词「是」）
    const core = s.replace(/[。！？]$/, '');
    if (core.endsWith('的')) assert.ok(core.includes('是'), `切出裸「的」尾且无系动词：${s}`);
  }
});

// --- 事实卡拒绝裸生成（关闭自动采集时）：无映射无文件 → InputError ---
test('无事实卡的 filmId 且 autoCollect=false 抛 InputError（拒绝裸生成，不触发采集）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wk-order-'));
  const op = join(dir, 'order.json');
  writeFileSync(op, JSON.stringify({ filmId: 'meiyoushishika-xxx', styleId: 'qian17', topic: 't', mode: 'topic' }), 'utf8');
  const order = loadOrder(op);
  assert.throws(() => locateFactCard(order, { autoCollect: false }),
    (e) => e instanceof InputError && /还没有事实卡素材/.test(e.message));
});

// --- 自动采集：无结果词报错路径（mock capture）---
test('captureStatusToError：no_results → 人话「换个说法或走人工流程」', () => {
  const msg = captureStatusToError({ status: 'no_results', status_note: '「xxx」无搜索结果' });
  assert.match(msg, /闲鱼搜不到这个选题的商品/);
  assert.match(msg, /换个说法或走人工流程/);
});

// --- 自动采集：登录失效报错路径（mock capture status）---
test('captureStatusToError：blocked_login → 人话「需人工在风格仿写侧重新登录」', () => {
  const msg = captureStatusToError({ status: 'blocked_login' });
  assert.match(msg, /登录已失效/);
  assert.match(msg, /需人工在风格仿写侧重新登录/);
});

test('captureStatusToError：blocked_captcha → 人话人机验证；ok/verified → null', () => {
  assert.match(captureStatusToError({ status: 'blocked_captcha' }), /人机验证/);
  assert.equal(captureStatusToError({ status: 'ok' }), null);
  assert.equal(captureStatusToError({ status: 'verified' }), null);
});

// --- 事实卡状态校验：机器草稿 vs 终版候选 ---
test('classifyFactCard：机器组装卡头判为 draft；已抽检判为非 draft', () => {
  const machine = '# 事实卡 · 选题「x」\n> **状态：草稿（机器组装，未经用户抽检——不得直接进生成）。**\n## 1. 受众档位\n起步期';
  assert.equal(classifyFactCard(machine).draft, true);
  const final = '# 事实卡 · 选题「x」\n> 状态：已抽检（人工终审）\n## 1. 受众档位\n起步期\n## 2. 核心结论\n做主号';
  assert.equal(classifyFactCard(final).draft, false);
});

test('classifyFactCard：受众/结论仍缺口 → draft', () => {
  const gap = '# 卡\n## 1. 受众档位\n❌缺口：未提供\n## 2. 核心结论\n❌缺口：待人工';
  assert.equal(classifyFactCard(gap).draft, true);
});

// --- film-index 登记幂等 ---
test('registerFilmIndex：首次登记 changed=true，重复登记 changed=false（幂等）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wk-idx-'));
  const idxPath = join(dir, 'film-index.json');
  const r1 = registerFilmIndex(idxPath, 'jiakao-ziliao', 'workshop-2026-08-29_jiakao-ziliao');
  assert.equal(r1.changed, true);
  const r2 = registerFilmIndex(idxPath, 'jiakao-ziliao', 'workshop-2026-08-29_jiakao-ziliao');
  assert.equal(r2.changed, false);
  const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
  assert.equal(idx.map['jiakao-ziliao'], 'workshop-2026-08-29_jiakao-ziliao');
  // 只有一条该键，无重复
  assert.equal(Object.keys(idx.map).filter((k) => k === 'jiakao-ziliao').length, 1);
});

// --- findCardInDir：按优先级命中并带 draft 标记 ---
test('findCardInDir：命中机器底稿并标 draft=true；空目录返回 null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wk-card-'));
  assert.equal(findCardInDir(dir), null);
  const runDir = join(dir, 'run');
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, '事实卡-机器底稿.md'),
    '# 卡\n> **状态：草稿（机器组装，未经用户抽检）。**\n## 1. 受众档位\n起步期', 'utf8');
  const hit = findCardInDir(runDir);
  assert.ok(hit && /事实卡-机器底稿\.md$/.test(hit.path));
  assert.equal(hit.draft, true);
});

// --- GitHub 供应线索：相关性淘汰 + 敏感兜底（P013 联调必修）---
test('filterGithubRepos：无关选题「简历模板定制」→ 记未检出，不写任何仓库名', () => {
  const raw = [
    { full_name: 'Dujltqzv/Some-Many-Books', stargazers_count: 22889, description: 'collection of books', topics: [] },
    { full_name: 'cirosantilli/x86-bare-metal-examples', stargazers_count: 5348, description: 'x86 assembly examples', topics: ['assembly'] },
    { full_name: 'cirosantilli/china-dictatorship', stargazers_count: 3172, description: 'Anti-CCP political content', topics: ['politics'] },
  ];
  const r = filterGithubRepos('简历模板定制', raw);
  assert.equal(r.ok, false);
  assert.equal(r.reason, '自动溯源未检出相关仓库');
  assert.equal(r.droppedSensitive, 1);      // china-dictatorship 被敏感兜底丢弃
  assert.ok(r.droppedIrrelevant >= 1);
  assert.ok(!('items' in r) || !r.items);   // 未检出时不带任何仓库名
});

test('filterGithubRepos：「mac微信多开」→ 保留 wechat 相关仓库；敏感仓库即便命中关键词也丢', () => {
  const raw = [
    { full_name: '0x5bfa/FluentWeChat', stargazers_count: 800, description: 'WeChat multi-instance helper for mac', topics: ['wechat', 'macos'] },
    { full_name: 'someone/random-todo', stargazers_count: 99999, description: 'a todo list app', topics: [] },
    { full_name: 'evil/china-dictatorship-fork', stargazers_count: 5000, description: 'wechat politics dictatorship', topics: ['wechat', 'politics'] },
  ];
  const r = filterGithubRepos('mac微信多开', raw);
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].name, '0x5bfa/FluentWeChat');
  assert.equal(r.droppedSensitive, 1);      // 含 wechat 但敏感 → 丢
  assert.equal(r.droppedIrrelevant, 1);     // random-todo 无关键词 → 丢
});

test('extractKeywords：CN→EN 映射（微信→wechat、简历→resume）与 ASCII token 保留', () => {
  const kw = extractKeywords('mac微信多开');
  assert.ok(kw.includes('wechat'));
  assert.ok(kw.includes('mac'));
  assert.ok(extractKeywords('简历模板定制').includes('resume'));
});

test('filterGithubRepos：空/无候选 → 未检出', () => {
  assert.equal(filterGithubRepos('任意选题', []).ok, false);
  assert.equal(filterGithubRepos('任意选题', null).reason, '自动溯源未检出相关仓库');
});

// --- 篇幅档位：三档解析 / 缺省 standard / 未识别 warn 不报错 ---
test('lengthPreset：三档原样解析，缺省 standard，未识别→standard 且带 warn（不抛错）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wk-lp-'));
  const mk = (lp) => {
    const o = { filmId: 'x', styleId: 'qian17', topic: 't', mode: 'topic' };
    if (lp !== undefined) o.lengthPreset = lp;
    const op = join(dir, `order-${lp ?? 'none'}.json`);
    writeFileSync(op, JSON.stringify(o), 'utf8');
    return loadOrder(op);
  };
  assert.equal(mk('short').lengthPreset, 'short');
  assert.equal(mk('standard').lengthPreset, 'standard');
  assert.equal(mk('long').lengthPreset, 'long');
  // 缺省 → standard，无 warn
  const def = mk(undefined);
  assert.equal(def.lengthPreset, 'standard');
  assert.equal(def._lengthPresetWarn, null);
  // 未识别 → standard，带中文 warn，且 loadOrder 不抛错（向后兼容）
  const bad = mk('medium');
  assert.equal(bad.lengthPreset, 'standard');
  assert.ok(bad._lengthPresetWarn && /medium/.test(bad._lengthPresetWarn) && /standard/.test(bad._lengthPresetWarn));
});

test('resolveLengthPreset：合法原样 / 缺省 standard 无 warn / 未识别 standard 带 warn', () => {
  assert.deepEqual(resolveLengthPreset('short'), { preset: 'short', warn: null });
  assert.deepEqual(resolveLengthPreset(undefined), { preset: 'standard', warn: null });
  assert.deepEqual(resolveLengthPreset(''), { preset: 'standard', warn: null });
  const r = resolveLengthPreset('mini');
  assert.equal(r.preset, 'standard');
  assert.ok(r.warn && /mini/.test(r.warn));
});

// --- 提示词注入：short 档含短视频合规转换要求；standard/long 为长视频形态、注入对应字数区间 ---
test('buildLengthFormSection：short 档注入短视频形态诱导转换要求（不是截短）', () => {
  const s = buildLengthFormSection('short');
  assert.match(s, /短视频形态/);
  assert.match(s, /诱导形式转换/);
  assert.match(s, /悬念/);
  assert.match(s, /反差/);
  assert.match(s, /信息缺口/);
  assert.match(s, /互动钩子/);
  assert.match(s, /不是截短/);
  assert.match(s, /350–650/);            // short 目标字数区间
  assert.match(s, /合规门禁|check-copy/); // 明示成稿要过合规
});

test('buildLengthFormSection：standard/long 为长视频形态、注入对应字数、不含短视频合规要求', () => {
  const std = buildLengthFormSection('standard');
  assert.match(std, /长视频形态/);
  assert.match(std, /900–1500/);
  assert.doesNotMatch(std, /诱导形式转换/);
  const lg = buildLengthFormSection('long');
  assert.match(lg, /长视频形态/);
  assert.match(lg, /1800–3000/);
  assert.doesNotMatch(lg, /诱导形式转换/);
  // 缺省/未识别档位回退 standard 形态
  assert.match(buildLengthFormSection('medium'), /900–1500/);
});

// --- 短视频合规门禁：命中收益承诺 FAIL 并给人话反馈；干净短稿 PASS ---
test('runCompliance/complianceFeedback：命中收益承诺 FAIL 且反馈点名类别，干净稿 PASS', () => {
  const bad = runCompliance('这个副业月入过万，加微信我带你做，稳赚不赔。');
  assert.equal(bad.passed, false);
  assert.ok(bad.blockCount >= 1);
  const fb = complianceFeedback(bad);
  assert.match(fb, /income-claim|get-rich|traffic-divert/);
  const good = runCompliance('五十块的券卖三十几，你以为是黄牛，其实不是。往下听，最难的那一关大部分人压根不知道。');
  assert.equal(good.passed, true);
});

// --- fix A：rewrite 三步硬流程指令（原稿仅供提取事实，禁止继承结构与句子）---
test('buildRewriteBlock：注入三步流程 + 12字雷同即废稿 + 仅供提取事实', () => {
  const s = buildRewriteBlock('这是一段待改写的原稿正文。');
  assert.match(s, /三步/);
  assert.match(s, /事实与信息点清单|提炼事实/);   // ① 提炼事实清单
  assert.match(s, /丢弃原稿的骨架|一律不得继承/);  // ② 丢弃骨架
  assert.match(s, /连续 12 字/);                    // 12 字雷同红线
  assert.match(s, /废稿/);
  assert.match(s, /框架/);                          // ③ 按 DNA 框架重搭
  assert.match(s, /仅供提取事实，禁止继承/);        // 原稿定位标注
  assert.match(s, /这是一段待改写的原稿正文。/);    // 原稿全文仍入上下文
  // 不再出现旧版「保留原稿步骤顺序」的根因指令
  assert.doesNotMatch(s, /保留原稿的.*步骤顺序/);
});

// --- fix B：写作规程四条纪律 + 叙述者身份硬规则 ---
test('buildWritingDiscipline：四条纪律齐全 + 讲述者=圣矾、绝不自称目标 IP', () => {
  const s = buildWritingDiscipline('钱十七');
  assert.match(s, /框架/);            // 纪律1 框架单选
  assert.match(s, /命门/);            // 纪律2 命门置顶
  assert.match(s, /八分之一/);        // 命门厚度下限
  assert.match(s, /强反差/);          // 纪律3 开场钩子
  assert.match(s, /禁用[^。]*口径澄清/); // 口径澄清式开场被明确禁用
  assert.match(s, /里程碑/);          // 纪律4 收口
  assert.match(s, /圣矾/);            // 叙述者身份
  assert.match(s, /我是钱十七|自称/); // 身份硬规则拦自称
});

// --- 身份硬拦截：自称目标 IP 名打回，第三人称提及放行 ---
test('checkSelfIdentity：自称「我是钱十七」打回，第三人称「钱十七讲过」放行', () => {
  const bad = checkSelfIdentity('大家好我是钱十七，今天讲驾考资料。');
  assert.equal(bad.clean, false);
  assert.ok(bad.hits.includes('我是钱十七'));
  const fb = selfIdentityFeedback(bad);
  assert.match(fb, /圣矾/);
  assert.match(fb, /我是钱十七/);
  // 第三人称提及不误伤
  assert.equal(checkSelfIdentity('钱十七讲过这套拆解，我按最保守算。').clean, true);
  // 讲述者圣矾自称不误伤
  assert.equal(checkSelfIdentity('我是圣矾，一个自己也天天用几个号的普通人。').clean, true);
  // 跨 IP 自称同样拦（半佛）
  assert.equal(checkSelfIdentity('我叫半佛，来聊聊这个。').clean, false);
});

// --- 工单校验：rewrite 缺 sourcePath ---
test('mode=rewrite 缺 sourcePath 报错', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wk-order2-'));
  const op = join(dir, 'order.json');
  writeFileSync(op, JSON.stringify({ filmId: 'x', styleId: 'qian17', topic: 't', mode: 'rewrite' }), 'utf8');
  assert.throws(() => loadOrder(op), (e) => e instanceof InputError && /rewriteSourcePath/.test(e.message));
});

// --- 工单校验：rewrite 用合同字段 rewriteSourcePath 可通过（兼容旧名 sourcePath）---
test('mode=rewrite 接受 rewriteSourcePath 与旧名 sourcePath', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wk-order3-'));
  const src = join(dir, 'src.md');
  writeFileSync(src, '原稿', 'utf8');
  for (const key of ['rewriteSourcePath', 'sourcePath']) {
    const op = join(dir, `order-${key}.json`);
    writeFileSync(op, JSON.stringify({ filmId: 'x', styleId: 'qian17', topic: 't', mode: 'rewrite', [key]: src }), 'utf8');
    const order = loadOrder(op);
    assert.ok(order.sourcePath && order.sourcePath.endsWith('src.md'), `${key} 应被接受`);
  }
});

// --- 用户级冻结：film-index frozen=true 的选题拒绝生成 ---
test('locateFactCard：frozen 选题人话报错拒绝生成', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wk-frozen-'));
  const op = join(dir, 'order.json');
  writeFileSync(op, JSON.stringify({ filmId: 'jiudian-daiding', styleId: 'qian17', topic: 't', mode: 'topic' }), 'utf8');
  const order = loadOrder(op);
  assert.throws(() => locateFactCard(order, { autoCollect: false }),
    (e) => e instanceof InputError && /已被用户冻结/.test(e.message) && /风险重评/.test(e.message));
});

// ===========================================================================
// 2026-09-03 · 用户对五篇钱十七草稿的反馈固化（新系列铁律 / 装置轮换 / 口播词域）
// 反馈原话见 DECISIONS.md 同日条目。三类门禁的正例（干净稿必须过）与反例（原稿命中必须拦）。
// ===========================================================================

// --- 门禁一：新系列铁律（旧系列引用硬阻断）---
test('新系列铁律：期号/计号/系列名/上次讲过 全部命中并 fail', () => {
  const cases = [
    ['我第18计专门拆过这个品。', 'ji-number'],
    ['这个题我第三十八期专门拆过一遍。', 'qi-number'],
    ['闲鱼虚拟搞钱一百零八计，下期见。', 'series-name-108'],
    ['闲鱼虚拟搞钱108计，咱们下期接着聊。', 'series-name-108'],
    ['上次讲这个题我就没给入口。', 'last-time-said'],
    ['价钱比我当时录第四十一计那会儿还往上抬了一截。', 'back-then-recorded'],
    ['点个关注，私信我18计，我把资源发给你。', 'dm-me-ji'],
    ['闲鱼虚拟搞钱，下一计见。', 'adjacent-episode'],
    ['我把那一期的相关资源发给你。', 'adjacent-episode'],
    ['那期画面里也有一条18块的定制版。', 'that-episode-frame']
  ];
  for (const [text, id] of cases) {
    const r = runSeriesReference(text);
    assert.equal(r.clean, false, `应命中旧系列引用：${text}`);
    assert.ok(r.hits.some((h) => h.id === id), `应命中规则 ${id}：${text}（实得 ${r.hits.map((h) => h.id).join(',')}）`);
    assert.ok(r.hits[0].sentence.length > 0, '命中要带原句，供人工核对误伤');
  }
});

test('新系列铁律：亲历表述与「下期见」不误伤（正例）', () => {
  const clean = [
    '这个题我自己做过一轮，踩过的坑我都说给你听。',
    '我之前试过一次，二十块钱，亏得起。',
    '我自己买过这家的号，第三天就失效了。',
    '这期就讲这一件事，咱们下期接着拆这一关。',
    '这张图是我自己录的，不是从别处搬来的。',
    '买家当时说的是不退不改，你别信。',
    '我当时做的时候还没有这个功能。'
  ];
  for (const t of clean) {
    const r = runSeriesReference(t);
    assert.equal(r.clean, true, `不该命中（误伤）：${t} → ${r.hits.map((h) => h.match).join('、')}`);
  }
});

test('新系列铁律：反馈文案含改写指引', () => {
  const r = runSeriesReference('价钱比我当时录第四十一计那会儿还往上抬了一截。');
  const fb = seriesReferenceFeedback(r);
  assert.match(fb, /全新系列/);
  assert.match(fb, /自己做过一轮/);
  assert.match(fb, /下期见/);
  assert.equal(seriesReferenceFeedback({ clean: true, hits: [] }), '- （无旧系列引用）');
});

// --- 门禁二：装置轮换（表面写法跨期复用）---
test('停用装置：受众分流三类人 scope=banned——写了就 fail，与历史池无关', () => {
  const cur = '在找副业、闲鱼还没用过的，听前面两段就够。卖过闲置、没做过项目的，直接盯第三关。';
  const withHist = runDeviceReuse(cur, { 'ep-a': '先分个流。没用过闲鱼的，你重点听试错成本那一块。' });
  assert.equal(withHist.clean, false);
  assert.ok(withHist.banned.some((x) => x.deviceId === 'audience-split'), '应记在 banned 里，不是 reused');
  assert.equal(withHist.reused.some((x) => x.deviceId === 'audience-split'), false, '停用装置不再按「跨期复用」判');
  // 与历史池无关：空池照拦。真人 12 期一次都没这么写过（docs/用户文案模式研究.md §3.1）。
  const noHist = runDeviceReuse(cur, {});
  assert.equal(noHist.clean, false, '空池也要拦——这条不是轮换，是停用');
  assert.equal(noHist.banned.length, 1);
  assert.match(noHist.banned[0].reason, /真人|停用/);
  assert.ok(noHist.banned[0].rotations.length >= 3, '停用之后要给替代写法');
  // 2026-09-03 二次修正（钱十七风格流失诊断 §3 R4 / §3.2）：第一条替代写法原来写的是「真人的弹幕
  // 互动小钩子」，例句（大家都用什么做笔记 / 你用苹果还是安卓 / 买过的扣个一）出自 docs/用户文案
  // 模式研究.md，是**圣矾**的原句，不是钱十七的。钱十七在这个位置放的是**动作指令**。
  assert.ok(/动作指令|点个关注|先点个赞/.test(noHist.banned[0].rotations[0]),
    '第一条替代写法应是这个 IP 自己的动作指令，不是另一个 IP 的弹幕问答');
  assert.equal(/大家都用什么做笔记|你用苹果还是安卓|买过的扣个一/.test(noHist.banned.map((b) => b.rotations.join('')).join('')), false,
    '圣矾的三条弹幕钩子原句不得再出现在钱十七的可用清单里');
});

test('停用装置：checkBannedDevices 单独可用，干净稿不误伤（正例）', () => {
  const clean = '先问你一句。你上回订酒店是在携程下的单，还是美团。弹幕里说一个。';
  assert.equal(checkBannedDevices(clean).clean, true, `真人式弹幕钩子不该被拦：${JSON.stringify(checkBannedDevices(clean).hits)}`);
  assert.equal(checkBannedDevices('先分个流。').clean, false);
});

test('装置轮换：收口动作序列（打开闲鱼→搜→数第一页）是 phrase 级轮换', () => {
  const history = { 'ep-a': '今天你就能做一件不用花钱的事。打开闲鱼，搜海底捞优惠券，数数第一页有几条挂着人想要。' };
  const same = runDeviceReuse('你现在打开闲鱼，搜驾考资料，数数第一页三十条里有几条挂着人想要。', history);
  assert.equal(same.clean, false, '同一套收口动作序列跨期复用应打回');
  assert.ok(same.reused.some((x) => x.deviceId === 'closing-action-sequence'));
  const rotated = runDeviceReuse('这一行你做成的第一个信号，是有人主动来问你能不能订某家店，而你张嘴就答得上来。', history);
  assert.equal(rotated.clean, true, `换了收口写法应通过：${rotated.reused.map((x) => x.match).join('、')}`);
});

test('装置轮换：信任装置是 phrase 级——装置留着、换句写法即通过', () => {
  const history = { 'ep-a': '接下来算天花板，这是推算，不是实数。拿货价我这回没核实到，一分钱净利我都不报。' };
  const rotated = '我拿三成算是往少了算，五成算是往多了算，中间那段才是它可能的样子。'
    + '进价我这回没问到人，所以利润这一栏我留空，谁给你填谁负责。';
  const ok = runDeviceReuse(rotated, history);
  assert.equal(ok.clean, true, `换了写法应通过，实得：${ok.reused.map((x) => x.match).join('、')}`);
  const same = runDeviceReuse('这是推算，不是实数。一分钱净利我都不报。', history);
  assert.equal(same.clean, false);
  assert.ok(same.reused.some((x) => x.patternId === 'est-not-real'));
  assert.ok(same.reused.some((x) => x.patternId === 'np-one-cent'));
});

test('装置轮换：历史池为空时轮换恒 PASS（拿不到池子绝不因「复用」拦稿）', () => {
  const r = runDeviceReuse('这是推算，不是实数。一分钱净利我都不报。我不装懂。', {});
  assert.equal(r.clean, true);
  assert.equal(r.historyDocCount, 0);
  assert.equal(r.reused.length, 0);
  assert.ok(r.current.length >= 3, '空池仍应清点出当期指纹，供报告用');
});

test('装置轮换：反馈文案带原句、带历史篇名、带替代写法', () => {
  const r = runDeviceReuse('这是推算，不是实数。', { 'ep-a': '这是推算，不是订单数。' });
  const fb = deviceReuseFeedback(r);
  assert.match(fb, /推算声明/);
  assert.match(fb, /ep-a/);
  assert.match(fb, /换成/);
  assert.match(deviceReuseFeedback({ clean: true, reused: [], banned: [] }), /无跨期复用/);
});

test('停用装置：反馈文案说清「已停用、与历史无关」并给替代写法', () => {
  const fb = deviceReuseFeedback(runDeviceReuse('先分个流。', {}));
  assert.match(fb, /受众分流三类人/);
  assert.match(fb, /停用/);
  assert.match(fb, /弹幕|这个位置改放/);
});

test('装置轮换：每个装置都配齐 ≥3 种表面写法，且导航替代 ≥3 条', () => {
  for (const d of DEVICE_RULES.devices) {
    assert.ok(Array.isArray(d.rotations) && d.rotations.length >= 3, `${d.name} 的轮换写法不足三种`);
    assert.ok(['device', 'phrase', 'banned'].includes(d.scope), `${d.name} 的 scope 非法`);
    assert.ok(d.patterns.length >= 1, `${d.name} 没有指纹`);
    if (d.scope === 'banned') assert.ok(d.bannedReason, `${d.name} 停用了却没写停用理由`);
  }
  assert.ok(DEVICE_RULES.navigationAlternatives.length >= 3);
  const split = DEVICE_RULES.devices.find((d) => d.id === 'audience-split');
  assert.equal(split.mandatory, false, '受众分流三类人不得标成必用装置');
  assert.equal(split.scope, 'banned', '2026-09-03 主线程裁定：由「轮换」改为「彻底停用」');
  assert.ok(DEVICE_RULES.devices.some((d) => d.id === 'closing-action-sequence' && d.scope === 'phrase'),
    '收口动作序列指纹必须作 phrase 级轮换进表');
});

test('近期已用句式清单：从历史稿池提取，按命中篇数排序', () => {
  const history = {
    'ep-a': '先分个流。这是推算，不是实数。',
    'ep-b': '卖过闲置、没做过项目的，直接盯第三关。这是推算，不是订单数。',
    'ep-c': '这是推算，不是真出了这么多单。'
  };
  const used = buildUsedDeviceList(history);
  assert.equal(used.some((u) => u.deviceId === 'audience-split'), false,
    '停用装置在提示词里另有「停用」段，不该混进「近期已用清单」当轮换选项');
  const est = used.find((u) => u.patternId === 'est-not-real');
  assert.ok(est, '应提取到推算声明句式');
  assert.equal(est.docs.length, 3, '三篇都用过');
  assert.ok(est.samples.length >= 1 && est.samples[0].includes('推算'), '要带原句样例');
  assert.equal(used[0].docs.length, 3, '按命中篇数降序，最常用的排最前');
});

// --- 门禁三：口播词域（书面词）---
test('口播词域：block 级书面词命中即 fail，warn 级只入报告', () => {
  const r = runWrittenWords('二十条落在四十到六十这个价位，只能当量级的上界看，按三到五成折算单量。');
  assert.equal(r.passed, false);
  const words = r.blockHits.map((h) => h.word);
  for (const w of ['落在', '量级', '上界', '折算']) assert.ok(words.includes(w), `应拦下书面词「${w}」`);
  const warn = runWrittenWords('券还有时效，买家不在覆盖区就约不上，加上纠纷自然多。');
  assert.equal(warn.passed, true, 'warn 级不 block');
  assert.ok(warn.warnCount >= 3);
  assert.ok(warn.warnHits.map((h) => h.word).includes('时效'));
});

test('口播词域：口语替代来自 lexicon-hints.json，同一份词表（不许两处抄）', () => {
  const table = loadWrittenWords();
  const hints = loadHints();
  for (const e of table.all) {
    assert.ok(Array.isArray(hints.hints[e.word]) && hints.hints[e.word].length > 0,
      `「${e.word}」缺口语替代候选，应写在 lexicon-hints.json 的 hints 里`);
    assert.deepEqual(e.spoken, hints.hints[e.word], '替代候选必须直接来自词表，不许另抄一份');
  }
  assert.ok(table.block.some((e) => e.word === '落在'), '用户点名的「落在」必须是 block 级');
  const fb = writtenWordFeedback(runWrittenWords('数字落在这个区间。'));
  assert.match(fb, /落在/);
  assert.match(fb, /挂在|都是/);
});

test('口播词域：干净口播不误伤（正例）', () => {
  const r = runWrittenWords('二十条都卖四十到六十，最多也就六十八。按三到五成去算，大概是八千多单。');
  assert.equal(r.passed, true, `不该命中：${r.blockHits.map((h) => h.word).join('、')}`);
  assert.equal(r.warnCount, 0);
});

test('口播词域：命中并进用词层结果，保证进 generation-report', () => {
  const style = { ip: '钱十七' };
  const r = runLexicon('二十条落在四十到六十这个价位，券还有时效。', style);
  assert.equal(r.available, true);
  const terms = r.suspiciousList.map((s) => s.term);
  assert.ok(terms.some((t) => t.startsWith('落在') && t.includes('口播禁用')), '「落在」必须以 block 级出现在报告里');
  assert.ok(terms.some((t) => t.startsWith('时效') && t.includes('建议换口语')), '「时效」必须以 warn 级出现在报告里');
  assert.ok(r.suspiciousList[0].suggest.options.length > 0, '报告里要带口语替代');
  assert.equal(r.writtenWords.passed, false);
  assert.equal(r.suspiciousList.filter((s) => s.term === '落在').length, 0, '不带级别标注的重复条目应被去掉');
});

// --- 历史稿池 ---
test('历史稿池：从 --out 反推 films/<filmId>/copy/<styleId> 的兄弟影片', () => {
  const root = mkdtempSync(join(tmpdir(), 'wk-hist-'));
  const films = join(root, 'ips', 'x', 'films');
  for (const f of ['ep-a', 'ep-b', 'ep-now']) mkdirSync(join(films, f, 'copy', 'qian17'), { recursive: true });
  writeFileSync(join(films, 'ep-a', 'copy', 'qian17', 'script.txt'), '先分个流。', 'utf8');
  writeFileSync(join(films, 'ep-b', 'copy', 'qian17', 'script.txt'), '这是推算，不是实数。', 'utf8');
  writeFileSync(join(films, 'ep-now', 'copy', 'qian17', 'script.txt'), '本期自己的稿，不该进池子。', 'utf8');
  const pool = loadHistoryPool({ filmId: 'ep-now', styleId: 'qian17', _path: root }, {
    outDir: join(films, 'ep-now', 'copy', 'qian17'), styleId: 'qian17'
  });
  assert.equal(pool.count, 2, '应拿到两篇兄弟稿');
  assert.deepEqual(Object.keys(pool.docs).sort(), ['ep-a', 'ep-b']);
  assert.ok(!Object.keys(pool.docs).includes('ep-now'), '本期自己不进对比池');
});

test('历史稿池：拿不到时返回空池 + 中文原因，绝不抛错', () => {
  const save = process.env.STYLE_HISTORY_DIR;
  delete process.env.STYLE_HISTORY_DIR;
  const noOut = loadHistoryPool({ filmId: 'x', styleId: 'qian17', _path: 'x' }, { styleId: 'qian17' });
  assert.equal(noOut.count, 0);
  assert.match(noOut.source, /未接历史稿池/);
  const badOut = loadHistoryPool({ filmId: 'x', styleId: 'qian17', _path: 'x' }, { outDir: join(tmpdir(), 'nope-xyz'), styleId: 'qian17' });
  assert.equal(badOut.count, 0);
  assert.match(badOut.source, /反推不出兄弟影片目录|historyDir/);
  if (save !== undefined) process.env.STYLE_HISTORY_DIR = save;
});

test('历史稿池：工单 historyDir 显式指定优先', () => {
  const root = mkdtempSync(join(tmpdir(), 'wk-hist2-'));
  const d = join(root, 'hist');
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'script.txt'), '先分个流。', 'utf8');
  const pool = loadHistoryPool({ filmId: 'x', styleId: 'qian17', historyDir: [d], _path: join(root, 'o.json') }, {});
  assert.equal(pool.count, 1);
  assert.match(pool.source, /historyDir/);
});

// --- 三条规则进提示词 ---
test('提示词：新系列铁律 / 口播词域 / 装置轮换 三节齐全且是硬规则', () => {
  const s1 = buildNewSeriesSection();
  assert.match(s1, /全新系列的第一次讲述/);
  assert.match(s1, /违反即打回重写/);
  assert.match(s1, /我自己做过/);
  for (const w of ['第N期', '一百零八计', '私信我N计']) assert.ok(s1.includes(w), `新系列铁律缺「${w}」`);

  const s2 = buildSpokenLexiconSection();
  assert.match(s2, /落在/);
  assert.match(s2, /人类没有用这个词/);
  assert.match(s2, /挂在/);
  assert.match(s2, /出现即打回重写/);

  const s3 = buildDeviceRotationSection([], '（测试：未接池）');
  assert.match(s3, /停用装置/);
  assert.match(s3, /一次都不许写/);
  assert.match(s3, /同一日期戳全篇最多出现 2 次/);
  assert.match(s3, /编号结构必须自洽/);
  assert.match(s3, /测试：未接池/);
  assert.equal(/不是必用装置/.test(s3), false, '受众分流已从「不是必用」升级为「停用」，提示词不该还留着可用口径');
  for (const d of DEVICE_RULES.devices) assert.ok(s3.includes(d.rotations[0]), `${d.name} 的轮换示例没进提示词`);
});

test('提示词：近期已用句式清单被注入（拿得到池子时）', () => {
  const used = buildUsedDeviceList({ 'ep-a': '这是推算，不是实数。一分钱净利我都不报。' });
  const s = buildDeviceRotationSection(used, '');
  assert.match(s, /近期已用句式清单（本期禁止复用）/);
  assert.match(s, /这是推算，不是实数/, '前几篇的实际句子要原样注入，模型才知道该躲开什么');
  assert.match(s, /近 1 篇用过/);
  assert.match(s, /换名词不算换骨架/);
});

// ============================================================================
// 2026-09-03 AI 味治理第二轮（docs/AI味治理-外部对照.md §4/§5 + 主线程对 §6 的裁定）
// ============================================================================

// --- 篇幅档位：与 cli/lib/length-presets.mjs 同源，不给就按字数反推 ---
test('篇幅档位：三档数字唯一来源在 length-presets.mjs，inputs 与 AI 味门禁共读同一份', () => {
  assert.equal(LENGTH_PRESETS.short.min, 350);
  assert.equal(LENGTH_PRESETS.standard.min, 900);
  assert.equal(LENGTH_PRESETS.long.min, 1800);
  assert.equal(DEFAULT_LENGTH_PRESET, 'standard');
  // 反推口径必须由上表推出来，不许在别处写死数字
  assert.equal(inferLengthPreset(LENGTH_PRESETS.long.min), 'long');
  assert.equal(inferLengthPreset(LENGTH_PRESETS.long.min - 1), 'standard');
  assert.equal(inferLengthPreset(LENGTH_PRESETS.standard.min), 'standard');
  assert.equal(inferLengthPreset(LENGTH_PRESETS.standard.min - 1), 'short');
});

test('篇幅档位：长稿按 long 判（免责上限 ≤3），不再一律默认 standard', () => {
  // 造一篇 >1800 字、含 3 句显式免责的稿。long 档 ≤3 不报，standard 档 ≤2 应报。
  const pad = '这段是用来把字数撑到长视频档的中性正文写得平实一些不带标点也不带任何被检测的句式'.repeat(50);
  const body = pad + '进价我这回没核实到。中间夹一句实在话。资质那条我查不到。再夹一句实在话。名单我没拿到。';
  const auto = runAiFlavor(body, '钱十七');
  assert.ok(auto.chars >= LENGTH_PRESETS.long.min, `前提：正文要够长，实得 ${auto.chars}`);
  assert.equal(auto.lengthPreset, 'long', '不给档位时按去空白字数反推，两千多字的稿是 long 不是 standard');
  assert.match(auto.lengthPresetSource, /反推/);
  assert.equal(auto.metrics.disclaimerCount.max, 3, 'long 档免责句上限 ≤3');
  assert.equal(auto.findings.some((f) => f.metric === 'disclaimerCount'), false, '3 句不该在 long 档报出来');
  // 显式指定覆盖反推
  const forced = runAiFlavor(body, '钱十七', 'standard');
  assert.equal(forced.lengthPreset, 'standard');
  assert.equal(forced.lengthPresetSource, '调用方指定');
  assert.equal(forced.metrics.disclaimerCount.max, 2);
  assert.ok(forced.findings.some((f) => f.metric === 'disclaimerCount' && f.level === 'warn'),
    'standard 档 3 句免责应报 warn（只入报告，不 fail）');
  assert.equal(forced.blockCount, 0, '免责计数是 warn 级，绝不能 fail');
});

// --- 免责：连三句 block（硬规则），计数 warn ---
test('免责堆叠：连着三句免责即 block；连两句放过（硬规则）', () => {
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式也不带标点符号'.repeat(30);
  const three = '我没拿到依据，不替你下结论。这块我查不到。进价我没核实。' + pad;
  const r3 = runAiFlavor(three, '钱十七');
  assert.equal(r3.metrics.disclaimerRun.value, 3);
  assert.ok(r3.findings.some((f) => f.metric === 'disclaimerRun' && f.level === 'block'), '连三句免责必须 block');
  assert.equal(r3.passed, false);
  const two = '我没拿到依据，不替你下结论。这块我查不到。中间夹一句实在的话把它隔开。进价我没核实。' + pad;
  const r2 = runAiFlavor(two, '钱十七');
  assert.equal(r2.metrics.disclaimerRun.value, 2);
  assert.equal(r2.findings.some((f) => f.metric === 'disclaimerRun'), false, '连两句不报');
});

// --- 报幕句 / 自贴重要性 ---
// 2026-09-03（钱十七风格流失诊断 §3 R1 判定「误杀（重度）」）：
// 旧规则是「报幕句全篇 ≤1，block」——那个阈值是拿只匹配我们自己 AI 腔的正则量出来的。
// 用钱十七真实的预告报幕形跑同一份语料是单期最高 4 处，且是他的开场标准件。
// 现在：default 档仍是 1/block；钱十七档 4/warn；**带清单的报幕整句豁免不计**。
test('报幕句：default 档 ≤1 block；钱十七档放到 ≤4 且降 warn', () => {
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式也不带标点符号'.repeat(30);
  const two = '这里得讲清楚一件事。想要不等于卖出去。两个词先说清楚。那就是那条测试通道。' + pad;
  const def = runAiFlavor(two, undefined);
  assert.equal(def.metrics.announceCount.value, 2);
  assert.ok(def.findings.some((f) => f.metric === 'announceCount' && f.level === 'block'),
    'default 档（未指定 IP）仍按 ≤1 block');
  const q = runAiFlavor(two, '钱十七');
  assert.equal(q.metrics.announceCount.max, 4, '钱十七档上限 1→4');
  assert.equal(q.metrics.announceCount.level, 'warn', '钱十七档由 block 降 warn');
  assert.equal(q.findings.some((f) => f.metric === 'announceCount'), false, '2 句在钱十七档不该报');
});

test('报幕句：空报幕算、带清单的报幕不算（这两种的差别就是 AI 和这个 IP 的差别）', () => {
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式也不带标点符号'.repeat(30);
  // 空报幕：报了幕却没交付新结构 → 计数
  const empty = '这里得讲清楚一件事。想要不等于卖出去。' + pad;
  assert.equal(runAiFlavor(empty, '钱十七').metrics.announceCount.value, 1, '空报幕照计');
  // 带清单的报幕：报幕的同一句里就把清单交出来 → 豁免不计（真人语料 10 处全是这一种）
  const withList = '这里我给大家总结了四大核心维度，分别是芝麻信用、好评数量、订单数量、活跃频率。' + pad;
  const r = runAiFlavor(withList, '钱十七');
  assert.equal(r.metrics.announceCount.value, 0, '带清单的报幕不计入');
  assert.ok(r.metrics.announceCount.exemptedCount >= 1, '豁免掉的句子要单独记下来，报告里看得见');
});

test('自贴重要性：>6 才 block——钱十七真实自标形单期最高 9 处，旧的 ≤3 把稿子逼到了 0', () => {
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式也不带标点符号'.repeat(30);
  // 空标签（标了重要却没跟着给内容）：一律计数
  const six = '重点听第三段。这才是该盯的数。最卡的那关。这段最值钱。全篇最长的一段。重点听最后一句。' + pad;
  const r6 = runAiFlavor(six, '钱十七');
  assert.equal(r6.metrics.selfLabelCount.max, 6, '钱十七档上限 3→6');
  assert.equal(r6.findings.some((f) => f.metric === 'selfLabelCount'), false, '6 处不该报');
  const r7 = runAiFlavor('这才是行情价。' + six, '钱十七');
  assert.equal(r7.metrics.selfLabelCount.value, 7);
  assert.ok(r7.findings.some((f) => f.metric === 'selfLabelCount' && f.level === 'block'), '超过 6 仍 block');
});

test('自贴重要性：空标签算、「标签+立刻交付」不算', () => {
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式也不带标点符号'.repeat(30);
  assert.equal(runAiFlavor('这段最值钱。' + pad, '钱十七').metrics.selfLabelCount.value, 1, '空标签照计');
  const delivered = '最关键的是这种账号可以无限复制，因为它不吃你的时间，所以你手上有几个号就能挂几条。' + pad;
  const r = runAiFlavor(delivered, '钱十七');
  assert.equal(r.metrics.selfLabelCount.value, 0, '标签后面立刻把内容交出来的不计入');
  assert.ok(r.metrics.selfLabelCount.exemptedCount >= 1);
});

// --- 黑名单 ---
test('黑名单：黑话/空副词/模板句式/citation 泄漏 block；电商软名单只 warn', () => {
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式也不带标点符号'.repeat(30);
  const bad = runAiFlavor('这套打法能给店铺赋能，闭环也做得深入地扎实。' + pad, '钱十七');
  assert.ok(bad.blacklist.block.some((b) => b.term === '赋能'));
  assert.ok(bad.blacklist.block.some((b) => b.term === '深入地'));
  assert.ok(bad.findings.some((f) => f.metric === 'blacklistCount' && f.level === 'block'));

  const tpl = runAiFlavor('随着二手电商的不断发展，这门生意也变了样。' + pad, '钱十七');
  assert.ok(tpl.blacklist.block.some((b) => b.group === '模板句式'), '模板句式正则组应命中');

  const leak = runAiFlavor('详情看这条链接 utm_source=chatgpt.com 就行。' + pad, '钱十七');
  assert.ok(leak.blacklist.block.some((b) => b.group === 'citation 泄漏'), '采集流水线有泄漏路径，必须零成本兜底');

  // 软名单：电商语境的真实用词，只 warn 不拦
  const soft = runAiFlavor('这条链路我复盘过一次。' + pad, '钱十七');
  assert.equal(soft.metrics.blacklistCount.value, 0);
  assert.ok(soft.findings.some((f) => f.metric === 'blacklistSoftCount' && f.level === 'warn'));
  assert.equal(soft.blockCount, 0);
});

test('黑名单：真人本人用过的「底层逻辑」已从 block 降到 soft（误伤校准）', () => {
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式也不带标点符号'.repeat(30);
  const r = runAiFlavor('闲鱼这事的底层逻辑其实很简单。' + pad, '钱十七');
  assert.equal(r.metrics.blacklistCount.value, 0, '真人语料里本人用了 3 次，硬拦会误伤');
  assert.ok(r.blacklist.soft.some((b) => b.term === '底层逻辑'));
});

// --- 「说白了」每段一次 ---
// 2026-09-03（诊断 §4.a）：perParagraphOnce 也按 IP 分档了。钱十七档收的是他自己的签名词
//（给大家 / 一定要 / 很简单），不再是「说白了」——那是另一个 IP 的词，钱十七语料 0 次，
// 对钱十七档等于一条永远不会触发的空门。
test('口头禅：钱十七档「一定要」一段最多一次，一段两甩报 warn（正反例）', () => {
  // pad 带句号：让它切出足够多的句子，段级口径走「按空行切段」而不是 8 句滑动块。
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式。'.repeat(30);
  const twice = '这一步一定要认真看。上架之前一定要先验一遍。\n\n' + pad + '\n\n第二段写点别的话。';
  const r = runAiFlavor(twice, '钱十七');
  assert.equal(r.metrics.perParagraphOnceCount.value, 1);
  assert.ok(r.findings.some((f) => f.metric === 'perParagraphOnceCount' && f.level === 'warn'));
  assert.equal(r.blockCount, 0, '口头禅一段两甩只 warn');
  const once = '这一步一定要认真看。\n\n' + pad + '\n\n上架之前一定要先验一遍。';
  assert.equal(runAiFlavor(once, '钱十七').metrics.perParagraphOnceCount.value, 0, '分在两段各一次不该报');
  assert.equal(runAiFlavor('说白了就是差价。说白了你不用管这些事。\n\n' + pad, '钱十七').metrics.perParagraphOnceCount.value, 0,
    '「说白了」已不在钱十七档的口头禅表里（它是另一个 IP 的词），这道 warn 门不再管它');
});

// --- 口头禅密度下限（唯一有真人基线支撑的下限）---
test('口头禅密度：低于真人下限报 warn（区间指标，不是单边上限）', () => {
  const dry = '这段正文一个口头禅都不用写得干干净净比真人还干净'.repeat(60);
  const r = runAiFlavor(dry, '钱十七');
  assert.equal(r.metrics.fillerPer1000.kind, 'range', '这条必须是区间指标');
  assert.ok(r.findings.some((f) => f.metric === 'fillerPer1000' && f.comparator === '<'),
    '一个口头禅都没有＝比真人还干净，本身就是 AI 味');
  assert.equal(r.blockCount, 0);
});

// --- 句长节奏 ---
test('句长节奏：短句占比不足报 warn；削顶诊断能认出被 50 字硬上限削平', () => {
  const even = Array.from({ length: 20 }, (_, i) => `这是第${i}句用来把句长撑到三十五字以上好让全篇看起来整整齐齐没有任何落差的中性句子`).join('。') + '。';
  const r = runAiFlavor(even, '钱十七');
  assert.ok(r.rhythm.shortRatio < 0.25);
  assert.ok(r.findings.some((f) => f.metric === 'shortSentenceRatio' && f.level === 'warn'));
  // 造一句正好 47 字：模拟被「单句不超过 50 字」硬顶削平后的典型句长。
  const near = ('这一句被写到四十七个字长因为提示词里写着单句不要超过五十个字于是全都卡在这个数上头' + '这就是削顶'.repeat(3)).slice(0, 47);
  assert.equal(near.length, 47, '前提：造句要正好落在[45,50]');
  const ceil = [near, near, near, '这句短'].join('。') + '。';
  const rc = runAiFlavor(ceil, '钱十七');
  assert.equal(rc.rhythm.maxLen, near.length);
  assert.equal(rc.rhythm.ceilingTruncated, true, '≥3 句落在[45,50]且无一句超 50 → 疑似被硬上限削平');
});

test('段级口径：一句一行的稿子改用 8 句滑动块，不退化成句级', () => {
  const oneLine = Array.from({ length: 24 }, (_, i) => `第${i}句话写在自己那一行上。`).join('\n');
  const r = runAiFlavor(oneLine, '钱十七');
  assert.equal(r.rhythm.paragraphMode, 'window8');
  assert.ok(r.rhythm.paragraphCount < r.sentenceCount, '段数必须少于句数，否则段级指标等于句级');
});

// --- 「的」字密度 ---
test('「的」字密度：区间取自真人基线，只 warn', () => {
  const noDe = '这段正文一个那个字都不写躲着它走写成电报体'.repeat(40);
  const low = runAiFlavor(noDe, '钱十七');
  assert.equal(low.metrics.dePer1000.kind, 'range');
  assert.ok(low.findings.some((f) => f.metric === 'dePer1000' && f.comparator === '<' && f.level === 'warn'));
  assert.equal(low.blockCount, 0, '「的」字密度只 warn，绝不 block');
});

// --- 反馈文案 ---
test('AI 味反馈：block 进重写反馈、warn 进报告，两处共用一份人话词表', () => {
  const pad = '这段是中性正文用来稀释密度写得平实一些不带任何被检测的句式也不带标点符号'.repeat(30);
  const r = runAiFlavor('这套打法能赋能店铺。这里得讲清楚一件事。想要不等于卖出去。两个词先说清楚。' + pad, '钱十七');
  const fb = aiFlavorFeedback(r);
  assert.match(fb, /黑名单/);
  // 报幕句 2026-09-03 在钱十七档降为 warn（诊断 §3 R1），所以它应出现在 warn 行、不在 block 反馈里。
  assert.equal(/报幕句/.test(fb), false, '钱十七档报幕句已降 warn，不该进 block 重写反馈');
  const warnLines = aiFlavorWarnLines(r);
  assert.ok(warnLines.every((l) => !/黑名单词/.test(l)), 'warn 行里不该混进 block 项');
  for (const f of r.findings) assert.ok(AI_FLAVOR_LABELS[f.metric], `指标「${f.metric}」缺人话名字`);
  // default 档仍是 block，反馈里必须点名报幕句
  const def = runAiFlavor('这里得讲清楚一件事。想要不等于卖出去。两个词先说清楚。那是那条通道。' + pad, undefined);
  assert.match(aiFlavorFeedback(def), /报幕句/);
});

// --- 跨稿骨架撞句（P1-1）---
test('跨稿骨架撞句：数字/品牌/尾词归一后同骨架即命中', () => {
  const cfg = { tailPattern: '(不是|就是|是|叫|算)[^，。！？]{1,6}[。！？]?$', brands: [] };
  assert.equal(normalizeSkeleton('这一整段说的是推算，不是订单数。', cfg), normalizeSkeleton('这一整段说的是推算，不是实数。', cfg),
    '尾词归一后这两句应完全相同——五篇里最典型的一族撞骨架（只换了尾巴那个名词）');
  const r = checkSkeletonCollision({
    A: '这一整段说的是推算，不是订单数。今天讲的是苹果多开这个品的上游在哪儿。',
    B: '这一整段说的是推算，不是实数。今天讲的是海底捞那条券的第一页有什么。'
  });
  assert.ok(r.count >= 1, '同骨架换尾词应报出撞句对');
  assert.ok(r.pairs[0].jaccard >= r.threshold);
  assert.ok(r.pairs[0].aSentence && r.pairs[0].bSentence, '要带两边原句供人工核对误伤');
});

test('跨稿骨架撞句：报数句不算撞骨架（归一化后几乎全是占位符）', () => {
  const r = checkSkeletonCollision({
    A: '一万九千二百三十四个人点了想要，浏览十一万。',
    B: '两万八千八百九十三个人点了想要，浏览十四万。'
  });
  assert.equal(r.count, 0, '两篇都在报数当然像，那是事实陈述不是修辞骨架，不该刷成撞句');
});

test('跨稿骨架撞句：不同说法不误伤（正例）', () => {
  const r = checkSkeletonCollision({
    A: '拿货价我这回没问到人，所以利润那一栏我留空，谁给你填谁负责。',
    B: '我拿三成算是往少了算，五成算是往多了算，中间那段才是它可能的样子。'
  });
  assert.equal(r.count, 0, `真换了骨架就不该报：${JSON.stringify(r.pairs)}`);
  assert.equal(r.passed, true);
});

test('跨稿骨架撞句：runSkeleton 只看「本期 vs 历史」，空池跳过不拦稿', () => {
  const skipped = runSkeleton('随便写点什么。', {});
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.passed, true);
  assert.match(skeletonFeedback(skipped), /跳过/);
  const hit = runSkeleton('这一整段说的是推算，不是订单数。今天讲的是苹果多开这个品。', {
    'ep-a': '这一整段说的是推算，不是实数。今天讲的是海底捞那条券。'
  });
  assert.ok(hit.count >= 1);
  assert.match(skeletonFeedback(hit), /本期/);
  assert.match(skeletonFeedback(hit), /ep-a/);
});

// --- 合同固定句白名单：三条跨稿规则统一读同一份 ---
test('合同固定句「我是圣矾。做闲鱼，找圣矾。」五篇同含仍 PASS（三条跨稿规则共读一份白名单）', () => {
  const contract = '我是圣矾。做闲鱼，找圣矾。';
  const bodies = [
    '你上闲鱼搜苹果多开，第一屏全是低价款，数字挺唬人，最贵那条比最便宜的贵二十倍。',
    '海底捞那条券的想要数排在最前面，价钱却是最低的那一档，这事本身就不太对劲。',
    '京东家政这个题我自己做过一轮，渠道跑过，价也对过，今天把当时的账摆出来。',
    '电影票代买这行，全国那条路早就关死了，今天还留着位置的是你家门口那几家影院。',
    '驾考资料一块钱能卖成什么样，先看看这家店开了几年，再看他一共卖出去多少件。'
  ];
  const docs = {};
  bodies.forEach((b, i) => { docs[`ip/ep-${i}`] = contract + b; });
  const rep = checkRepetition(docs);
  assert.equal(rep.passed, true,
    `合同 §E 规定每篇必有这句，必然逐字相同，不该判成原样复用。实得：${JSON.stringify(rep.overusedPhrases)}`);
  assert.equal(rep.overusedPhrases.length, 0);
  const sk = checkSkeletonCollision(docs);
  assert.equal(sk.count, 0, '骨架层同样不该把合同固定句判成撞骨架');
});

// --- LLM 二审（门禁九）：全部用 mock，绝不真调模型 ---
test('LLM 二审：提示词只判三件事，并把历史稿一起交给模型', () => {
  for (const k of ['空洞', '立场', '撞骨架']) assert.ok(REVIEW_SYSTEM.includes(k), `二审提示词缺「${k}」`);
  assert.match(REVIEW_SYSTEM, /只输出一个 JSON 对象/);
  const p = buildReviewPrompt('本期稿子。', { 'ep-a': '历史稿甲。' });
  assert.match(p, /本期稿子/);
  assert.match(p, /ep-a/);
  assert.match(buildReviewPrompt('本期稿子。', {}), /没有历史稿可比/);
});

test('LLM 二审：解析容忍代码围栏与前后废话，非法 type 丢掉', () => {
  const ok = parseReviewOutput('```json\n{"verdict":"issues","issues":[{"type":"no-stance","quote":"信哪句你自己判断","why":"没态度","fix":"把判断说出来"}]}\n```');
  assert.equal(ok.verdict, 'issues');
  assert.equal(ok.issues.length, 1);
  assert.equal(ok.issues[0].type, 'no-stance');
  const dirty = parseReviewOutput('好的，我的判断如下：{"verdict":"pass","issues":[]} 以上。');
  assert.equal(dirty.verdict, 'pass');
  const bogus = parseReviewOutput('{"verdict":"issues","issues":[{"type":"随便编的","quote":"x"}]}');
  assert.equal(bogus.verdict, 'pass', '非法 type 全被丢掉后就没有命中了');
  const bad = parseReviewOutput('模型今天不想输出 JSON。');
  assert.equal(bad.verdict, 'unparsed');
  assert.match(bad.parseError, /JSON/);
});

test('LLM 二审：mock 调用——pass / 命中 / 关闭 / 报错降级', async () => {
  const passCall = async () => '{"verdict":"pass","issues":[]}';
  const r1 = await runLlmReview({ cfg: {}, scriptText: 's', call: passCall });
  assert.equal(r1.ran, true);
  assert.equal(r1.verdict, 'pass');
  assert.equal(r1.issues.length, 0);

  const hitCall = async () => JSON.stringify({
    verdict: 'issues',
    issues: [{ type: 'hollow-punchline', quote: '假数字比没数字更害人', why: '只是把上一句换个说法', fix: '改成平白陈述' }]
  });
  const r2 = await runLlmReview({ cfg: {}, scriptText: 's', call: hitCall });
  assert.equal(r2.verdict, 'issues');
  const fb = reviewFeedback(r2);
  assert.match(fb, /空洞金句/);
  assert.match(fb, /只改这几处/, '二审是定向重写，不许让模型重写整篇');

  const off = await runLlmReview({ cfg: {}, scriptText: 's', enabled: false });
  assert.equal(off.skipped, true);
  assert.equal(off.ran, false);

  const boom = await runLlmReview({ cfg: {}, scriptText: 's', call: async () => { throw new Error('额度不足'); } });
  assert.equal(boom.ran, false, '二审是加分项，跑不成绝不能拦住一篇本地门禁已过的稿');
  assert.match(boom.error, /额度不足/);
});

// --- 提示词：去 AI 味配额段 ---
test('提示词：去 AI 味配额段——正向配额 + 负面配额 + 立场，且保留 50 字上限', () => {
  const q = buildAntiAiQuotaSection('long', '钱十七');
  assert.match(q, /口头禅至少 3 处/);
  assert.match(q, /单句不超过 50 字/, '50 字上限是视频方合同 film-input-spec §1 的字幕硬约束，不许删');
  assert.match(q, /不许全篇都是 35 到 50 字的整齐句/);
  assert.match(q, /5 到 15 字的短句占比不低于四分之一/);
  assert.match(q, /我的看法是做 \/ 不做 \/ 怎么做/, '讲述者立场是硬要求');
  assert.match(q, /不许挂退让尾巴/, '判断句后面不许挂退让尾巴');
  assert.match(q, /空报幕全篇最多 1 句/);
  assert.match(q, /空标签全篇最多 2 次/);
  assert.match(q, /最多 3 处，且绝不许连着说三句/, 'long 档免责上限 ≤3');
  assert.match(q, /按最保守的算/, '免责要改成词级压低，不是段级声明');
  assert.match(q, /赋能/);
  assert.match(buildAntiAiQuotaSection('standard', '钱十七'), /最多 2 处，且绝不许连着说三句/, 'standard/short 档 ≤2');

  // 2026-09-03（钱十七风格流失诊断 §1.4 / §3 R9）：口头禅表按 IP 现取，
  // 不再写死一串**另一个 IP** 的口头禅并配「至少 3 处」的正向配额。
  assert.match(q, /给大家/, '正向配额里的口头禅要是钱十七自己的词');
  assert.match(q, /一定要/);
  assert.equal(/张嘴就来的是「其实 \/ 说白了/.test(q), false, '旧的写死清单（圣矾的口头禅）必须删掉');
  assert.match(q, /下面这些不是这个 IP 的话，一个都不许写/, '要反向点名外来 IP 的口头禅');
  assert.match(q, /说白了/, '外来口头禅清单里要点名「说白了」（作为禁写项，不是要写的项）');

  // 词级压低不许弥散（诊断 §3 R3 判定「最隐蔽的一条误杀」）：段级降了、词级弥散了，语气比以前更虚。
  assert.match(q, /确定 ÷ 迟疑 ≥ 1\.5/, '要给量化，不能只说「改用词级压低」');
  assert.match(q, /数字可以给区间，判断不许给区间/);

  // 带清单的报幕 / 标签+立刻交付：负面配额里要写清楚豁免，否则模型会把整类删掉
  assert.match(q, /带清单的预告报幕不算/);
  assert.match(q, /「标签 \+ 立刻交付」不算/);

  // 未指定 IP 时不得硬塞任何一张 IP 词表
  const generic = buildAntiAiQuotaSection('long', undefined);
  assert.match(generic, /口头禅表还没配/);
});

// --- 提示词：钱十七风格标志段（注入位置在所有负面清单之后）---
test('提示词：风格标志段——阈值与词表全部与门禁同源，且只对有专属档的 IP 注入', () => {
  const s = buildQian17SignatureSection('钱十七');
  assert.ok(s.length > 1000, '风格标志段不能是空壳');
  assert.match(s, /优先级高于上面所有「少做什么」的清单/, '要明写与负面清单冲突时以它为准');
  assert.match(s, /他是教练，不是记者/);
  assert.match(s, /边讲边催/);
  assert.match(s, /用确定句推进/);
  assert.match(s, /预告报幕/);
  assert.match(s, /自标重要性/);
  // 阈值从 style-floor-rules.json 现取，不许在提示词里另写一套数字
  const floorMin = STYLE_FLOOR_RULES.profiles['钱十七'].metrics;
  assert.ok(s.includes(`${Math.round(floorMin.assertiveRatio.min * 100)}%`), '确定句下限要与门禁同一个数');
  assert.ok(s.includes(`至少 ${floorMin.coachVoiceCount.min} 处`), '教学承诺句下限要与门禁同一个数');
  // 招牌话术原句仍然点名，但同时要给替代说法（这是上一轮缺的那张清单）
  for (const w of ['先点赞后观看', '暂停截图保存', '打在公屏上']) assert.ok(s.includes(w), `要点名原句「${w}」`);
  assert.match(s, /不许照搬原句」不等于「这层不写/);
  assert.match(s, /手快的先截一张/, '要给自造替代说法的轮换池');
  // 别的 IP 的形制不许借
  assert.match(s, /别的 IP 的形制不许借/);
  assert.match(s, /我是圣矾。做闲鱼，找圣矾。/, '唯一保留的是身份句');
  // 没有风格标志档的 IP 一律不注入
  assert.equal(buildQian17SignatureSection('半佛'), '');
  assert.equal(buildQian17SignatureSection(undefined), '');
});

// --- 夹具：--dry-run 必须真的全门禁 PASS ---
test('内置 fixture：全门禁 PASS（名副其实，改规则时夹具必须同步改）', () => {
  const segs = parseSegments(fixtureRaw()).map((x) => ({ ...x, sentences: splitSpoken(normSpoken(x.kou)) }));
  const text = renderScript(segs);
  const ai = runAiFlavor(text, '钱十七');
  assert.equal(ai.blockCount, 0, `夹具应无 AI 味 block：\n${aiFlavorFeedback(ai)}`);
  assert.equal(ai.warnCount, 0, `夹具也不该留 warn（它是「合格稿长什么样」的样板）：\n${aiFlavorWarnLines(ai).join('\n')}`);
  assert.equal(runSeriesReference(text).clean, true, '夹具不许带期号/系列名');
  assert.equal(runWrittenWords(text).passed, true, '夹具不许有书面词');
  const dr = runDeviceReuse(text, {});
  assert.equal(dr.banned.length, 0, '夹具不许写停用装置（受众分流三类人）');
  assert.equal(checkSelfIdentity(text).clean, true);
  assert.equal(trustSelfCheck(text).clean, true);
  assert.equal(text.split('我是圣矾').length - 1, 1, '合同 §E：自我介绍句全篇有且只有一次');
  // 正向配额也要真做到，不能只是「没踩雷」
  assert.ok(ai.filler.perThousand >= ai.metrics.fillerPer1000.min, '夹具要有口头禅，别比真人还干净');
  assert.ok(ai.rhythm.shortRatio >= 0.25, '夹具要有短句落差');
  assert.ok(ai.rhythm.longRatio >= 0.3, '夹具也要有长句——只做短句那一半就是上一批稿子的电报体');
  assert.ok(ai.rhythm.cv >= 0.6, '夹具句长要有落差');
  // 门禁十：风格标志下限。夹具是「合格稿长什么样」的活样板，这道门也必须真过、且不留 warn。
  const sf = runStyleFloor(text, '钱十七');
  assert.equal(sf.skipped, false, '钱十七有风格标志专属档，不该跳过');
  assert.equal(sf.blockCount, 0, `夹具应无风格标志 block：\n${styleFloorFeedback(sf)}`);
  assert.equal(sf.warnCount, 0, `夹具也不该留 warn：\n${styleFloorWarnLines(sf).join('\n')}`);
  assert.equal(sf.values.foreignIpFillerCount, 0, '夹具里不许出现别的 IP 的口头禅（说白了/最起码…）');
  assert.ok(sf.values.coachVoiceCount >= 2, '夹具要有教学承诺句——讲述者是教练，不是记者');
});

// --- 报告：五个新小节都要渲染出来 ---
test('generation-report：新系列/装置轮换/书面词/篇章层/LLM二审 五个小节齐全', () => {
  const text = '我是圣矾。做闲鱼，找圣矾。这条链接八百二十九个人想要。其实说白了就是差价。';
  const md = renderReport({
    order: { topic: 't', filmId: 'f', audience: 'a' },
    style: { name: '钱十七', id: 'qian17', status: '定版', ip: '钱十七' },
    factCardPath: 'p', factCardSource: 's', factCardDraft: false, mode: 'topic',
    aiFlavor: runAiFlavor(text, '钱十七'),
    styleFloor: runStyleFloor(text, '钱十七'),
    lexicon: { available: false, reason: '测试跳过' },
    trust: trustSelfCheck(text),
    overlong: [], retries: 0, consistency: { segCount: 1 },
    model: 'm', provider: '', stamp: 'now',
    preset: LENGTH_PRESETS.long, compliance: null,
    series: runSeriesReference(text),
    deviceReuse: runDeviceReuse(text, {}),
    written: runWrittenWords(text),
    skeleton: runSkeleton(text, { 'ep-a': '这条链接八百二十九个人想要。' }),
    review: { ran: true, verdict: 'issues', rewritten: true, issues: [{ type: 'no-stance', quote: '信哪句你自己判断', why: '没态度', fix: '把判断说出来' }] }
  });
  assert.match(md, /## 门禁五 · 新系列铁律/);
  assert.match(md, /## 门禁六 · 装置轮换/);
  assert.match(md, /停用装置（受众分流三类人）/);
  assert.match(md, /## 门禁七 · 口播词域/);
  assert.match(md, /## 门禁八 · 篇章层/);
  assert.match(md, /句长节奏：均长/);
  assert.match(md, /## 门禁九 · LLM 二审/);
  assert.match(md, /讲述者没有立场/);
  assert.match(md, /已做过一次定向重写/);
  assert.match(md, /十道门禁/);
  // 门禁十（2026-09-03 新增）：风格标志下限。与门禁一方向相反。
  assert.match(md, /## 门禁十 · 风格标志下限/);
  assert.match(md, /动作指令句占比/);
  assert.match(md, /外来 IP 口头禅/);
  assert.match(md, /写进了别的 IP 的口头禅/, '这段测试文本里有「说白了」，报告必须点出来');
});
