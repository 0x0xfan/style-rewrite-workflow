// 文案工坊 · 第二档：工单 filmId 无事实卡时，自动跑「闲鱼采集 → 百度需求佐证 → GitHub 供应线索 → 事实卡组装 → 自动补完 → 登记」流水线。
//
// 被 cli/lib/inputs.mjs 的 locateFactCard 在「事实卡不存在」抛错之前调用。
// 全程同步（spawnSync）：子进程日志用 stdio:inherit 实时透传到本进程 stdout/stderr（P013 管道进面板 SSE）。
// 全流程 8 分钟硬超时；采不出合格素材 → 抛 CollectError（人话原因），generate.mjs 捕获后非0退出。
//
// 只依赖 Node 内建；不 import inputs.mjs，避免与其形成循环依赖。
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '..', '..');
const NODE = process.execPath;
// jieba 分词后端（与词表构建、用词检查、采集切词同一 python 通道）。
const SEGMENT_PY = resolve(REPO_ROOT, 'engine', 'naturalness', 'segment.py');

// 选题中文核心词 → 常见英译（GitHub 仓库名/描述多为英文，靠此表建立可命中的桥）。
// 覆盖不了就算了（宁缺勿滥：没映射到 = 不强行匹配 = 更容易判「未检出」）。
const CN_EN_KEYWORDS = {
  微信: ['wechat', 'weixin'], 多开: ['multi', 'multiopen', 'multiinstance', 'multiaccount'],
  简历: ['resume', 'cv'], 模板: ['template'], 定制: ['custom'],
  拼车: ['carpool', 'pinche', 'share'], 视频: ['video'], 图片: ['image', 'photo'],
  表格: ['excel', 'sheet', 'spreadsheet'], 文档: ['doc', 'document'], 翻译: ['translate', 'translation'],
  爬虫: ['crawler', 'spider', 'scraper'], 机器人: ['bot', 'robot'], 助手: ['assistant', 'helper'],
  插件: ['plugin', 'extension'], 教程: ['tutorial', 'course'], 面试: ['interview'],
  驾考: ['driving', 'driver'], 酒店: ['hotel'], 代订: ['booking', 'order'],
  会员: ['member', 'vip'], 账号: ['account'], 直播: ['live', 'stream'],
  小程序: ['miniprogram', 'miniapp'], 公众号: ['official', 'mp'], 安装: ['install', 'setup'],
};

// 敏感兜底黑名单（政治/成人/违规等）：命中即丢弃，哪怕关键词相关。不求全，求兜底。
const SENSITIVE_WORDS = [
  'dictatorship', 'communis', 'ccp', 'falun', 'tiananmen', 'politic', 'propaganda',
  'porn', 'nsfw', 'sex', 'xxx', 'erotic', 'adult', 'hentai', 'nude', 'gambling',
  'casino', 'betting', 'crack', 'keygen', 'nulled', 'exploit',
  '政治', '色情', '成人', '赌博', '博彩', '法轮', '反共', '民运', '裸',
];

// 全流程硬超时（含闲鱼采集 5 分钟登录轮询 + 百度 + 组装）。
export const COLLECT_TIMEOUT_MS = 8 * 60 * 1000;

// locateFactCard 会把这个类当 InputError 一样处理（generate.mjs 也识别）。
export class CollectError extends Error {}

const log = (...a) => console.log(...a);

// ---------------------------------------------------------------------------
// 纯函数：闲鱼采集 capture.status → 人话报错（null=可继续组装）。可单测。
// ---------------------------------------------------------------------------
export function captureStatusToError(capture) {
  const status = capture && capture.status;
  const note = (capture && capture.status_note) || '';
  if (status === 'no_results') {
    return '闲鱼搜不到这个选题的商品，请换个说法或走人工流程。'
      + (note ? `（采集器：${note}）` : '');
  }
  if (status === 'blocked_login') {
    return '闲鱼登录已失效，需人工在风格仿写侧重新登录后重试。'
      + '（采集专用 Chrome 已停在登录页，扫码后重跑本工单即可。）';
  }
  if (status === 'blocked_captcha') {
    return '闲鱼弹出人机验证（滑块/验证码），需人工在风格仿写侧完成后重试。'
      + '（采集专用 Chrome 窗口已保留，完成验证后重跑本工单。）';
  }
  if (status === 'error') {
    return `闲鱼采集中断：${note || '未知错误'}。请稍后重试或走人工流程。`;
  }
  if (status !== 'ok' && status !== 'verified') {
    return `闲鱼采集状态异常（status=${status || '空'}），无法确保素材完整。请人工核实后重试。`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 纯函数：判定一张事实卡是「机器草稿」还是「终版候选及以上」。可单测。
// draft=true → generation-report 顶部要加醒目警示。
// ---------------------------------------------------------------------------
export function classifyFactCard(text) {
  const head = String(text || '').slice(0, 600);
  // 显式人工终版/已抽检标记 → 非草稿
  if (/状态[：:][^\n]*(已抽检|终版|人工(核|终审)|已终审)/.test(head)) {
    return { draft: false, reason: '卡头标注已抽检/终版' };
  }
  // 机器组装器写的固定卡头
  if (/机器组装|机器草稿|机器底稿|待终审时确认/.test(text.slice(0, 1200))) {
    return { draft: true, reason: '卡头为机器组装草稿（含"待终审时确认"占位）' };
  }
  // 受众档位 / 核心结论 仍是缺口 → 机器草稿
  if (/##\s*1\.?\s*受众[\s\S]{0,400}?❌缺口/.test(text) || /##\s*2\.?\s*核心结论[\s\S]{0,400}?❌缺口/.test(text)) {
    return { draft: true, reason: '受众档位或核心结论仍为缺口' };
  }
  return { draft: false, reason: '未见机器草稿特征，按终版候选处理' };
}

// ---------------------------------------------------------------------------
// 纯函数：在一个采集目录里按优先级找事实卡文件。返回 { path, draft } 或 null。可单测。
// ---------------------------------------------------------------------------
const CARD_FILENAMES = ['事实卡-终版.md', '事实卡-终版候选.md', '事实卡-机器底稿.md', '事实卡.md'];
export function findCardInDir(dir) {
  for (const name of CARD_FILENAMES) {
    const p = join(dir, name);
    if (existsSync(p)) {
      const { draft } = classifyFactCard(readFileSync(p, 'utf8'));
      return { path: p, draft };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// film-index.json 幂等登记：map[filmId] = dirName。返回 { changed }。可单测。
// ---------------------------------------------------------------------------
export function registerFilmIndex(indexPath, filmId, dirName) {
  let idx = { note: 'filmId → 采集运行目录名 的映射表。', map: {} };
  if (existsSync(indexPath)) {
    try { idx = JSON.parse(readFileSync(indexPath, 'utf8')); } catch { /* 损坏则重建 */ }
  }
  if (!idx.map || typeof idx.map !== 'object') idx.map = {};
  if (idx.map[filmId] === dirName) return { changed: false };
  idx.map[filmId] = dirName;
  idx.updated = new Date().toISOString().slice(0, 10);
  writeFileSync(indexPath, JSON.stringify(idx, null, 2) + '\n', 'utf8');
  return { changed: true };
}

// 日期戳 YYYY-MM-DD
function dateStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function timeoutError() {
  return new CollectError(
    '自动采集超过 8 分钟硬超时仍未完成，已中止。可能是闲鱼在等人工扫码/验证，'
    + '或网络太慢。请到风格仿写侧确认采集专用 Chrome 状态后重跑本工单。'
  );
}

// 跑一个 node 子进程步骤；deadline 为全局截止时间戳。capture=true 时截获 stdout。
function runStep(argv, { deadline, capture = false }) {
  const remain = deadline - Date.now();
  if (remain <= 0) throw timeoutError();
  const res = spawnSync(NODE, argv, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: remain,
    maxBuffer: 64 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (res.error && (res.error.code === 'ETIMEDOUT' || res.signal === 'SIGTERM')) throw timeoutError();
  return res;
}

// jieba 分词取选题实义词；python/jieba 不可用返回 []（上层回退启发式）。
function jiebaKeywords(q) {
  if (!existsSync(SEGMENT_PY)) return [];
  const candidates = [];
  if (process.env.PYTHON) candidates.push(process.env.PYTHON);
  const venvPy = resolve(REPO_ROOT, '.venv', 'Scripts', 'python.exe');
  if (existsSync(venvPy)) candidates.push(venvPy);
  candidates.push('python', 'py', 'python3');
  for (const bin of candidates) {
    const res = spawnSync(bin, [SEGMENT_PY], { input: Buffer.from(q, 'utf8'), maxBuffer: 8 * 1024 * 1024 });
    if (res.error) continue;
    if (res.status !== 0) return [];
    const out = (res.stdout ? res.stdout.toString('utf8') : '').trim();
    if (!out) return [];
    return out.split('\n').map((line) => { const t = line.indexOf('\t'); return t < 0 ? line : line.slice(0, t); }).filter(Boolean);
  }
  return [];
}

// 启发式切词（jieba 不可用时）：按空白/标点切，保留 ASCII token 与 ≥2 字中文段。
function heuristicKeywords(q) {
  const parts = String(q).split(/[\s,，、。/\\|:：;；()（）\[\]【】"'`~!！?？的了在与和]+/).filter(Boolean);
  const out = [];
  for (const p of parts) {
    for (const a of (p.match(/[a-zA-Z0-9]{2,}/g) || [])) out.push(a.toLowerCase());
    const zh = p.replace(/[a-zA-Z0-9]+/g, '');
    if ([...zh].length >= 2) out.push(zh);
  }
  return [...new Set(out)];
}

// 从选题抽实义关键词集合：jieba（或启发式）中文词 + 原文 ASCII token + CN→EN 映射扩展。可单测。
export function extractKeywords(topic) {
  const zh = jiebaKeywords(topic);
  const base = zh.length ? zh : heuristicKeywords(topic);
  const kws = new Set();
  for (const w of base) {
    const t = String(w).trim().toLowerCase();
    if (!t) continue;
    if (/^[a-z0-9]+$/.test(t)) { if (t.length >= 2) kws.add(t); }
    else if ([...t].length >= 2) kws.add(t); // 中文 ≥2 字（单字噪音丢弃）
  }
  for (const m of (String(topic).toLowerCase().match(/[a-z0-9]{2,}/g) || [])) kws.add(m);
  for (const [cn, ens] of Object.entries(CN_EN_KEYWORDS)) {
    if (topic.includes(cn)) for (const e of ens) kws.add(e);
  }
  return [...kws];
}

// 关键词是否命中文本：短 ASCII（≤3）走词边界避免误伤（cv 不匹配 service），中文/长词走子串。
function hayHasKeyword(hay, k) {
  const kk = String(k).toLowerCase();
  if (!kk) return false;
  if (/^[a-z0-9]+$/.test(kk)) {
    if (kk.length <= 3) return new RegExp(`(^|[^a-z0-9])${kk}([^a-z0-9]|$)`).test(hay);
    return hay.includes(kk);
  }
  return hay.includes(kk);
}

// 纯函数：对 GitHub 原始仓库列表做相关性淘汰 + 敏感兜底，保留 Top3。可单测。
// rawItems: [{ name|full_name, stars|stargazers_count, desc|description, topics? }]
// 返回 { ok:true, items:[{name,stars,desc}], keywords } 或 { ok:false, reason:'自动溯源未检出相关仓库', keywords }。
export function filterGithubRepos(topic, rawItems) {
  const kws = extractKeywords(topic);
  const kept = [];
  let droppedSensitive = 0, droppedIrrelevant = 0;
  for (const it of (rawItems || [])) {
    const name = it.full_name || it.name || '';
    const desc = (it.desc || it.description || '');
    const topics = Array.isArray(it.topics) ? it.topics : [];
    const hay = [name, desc, topics.join(' ')].join(' ').toLowerCase();
    if (SENSITIVE_WORDS.some((w) => hay.includes(w))) { droppedSensitive++; continue; }
    if (!kws.some((k) => hayHasKeyword(hay, k))) { droppedIrrelevant++; continue; }
    kept.push({ name, stars: it.stars ?? it.stargazers_count ?? 0, desc: desc.replace(/\s+/g, ' ').slice(0, 120) });
    if (kept.length >= 3) break;
  }
  if (!kept.length) {
    return { ok: false, reason: '自动溯源未检出相关仓库', keywords: kws, droppedSensitive, droppedIrrelevant };
  }
  return { ok: true, items: kept, keywords: kws, droppedSensitive, droppedIrrelevant };
}

// GitHub 供应线索（无鉴权 search API）。拉 Top15 候选 → filterGithubRepos 相关性/敏感淘汰 → 留 Top3。
// 返回 { ok, items?, reason?, keywords? }。失败/未检出不抛，交调用方降级。
function githubSupplyClues(topic, deadline) {
  const remain = Math.min(deadline - Date.now(), 15000);
  if (remain <= 0) return { ok: false, reason: '超时预算耗尽，跳过' };
  const snippet = `
const q = process.argv[1] || '';
const url = 'https://api.github.com/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&order=desc&per_page=15';
const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 12000);
fetch(url, { signal: ac.signal, headers: { 'User-Agent':'workshop-collect', 'Accept':'application/vnd.github.mercy-preview+json' } })
  .then(r => r.ok
    ? r.json().then(j => {
        const raw = (j.items||[]).slice(0,15).map(it => ({ name: it.full_name, stars: it.stargazers_count, desc: (it.description||'').replace(/\\s+/g,' ').slice(0,200), topics: it.topics||[] }));
        console.log(JSON.stringify({ ok:true, raw }));
      })
    : console.log(JSON.stringify({ ok:false, reason:'HTTP '+r.status })))
  .catch(e => console.log(JSON.stringify({ ok:false, reason: e && e.name==='AbortError' ? '请求超时' : (e && e.message || String(e)) })))
  .finally(() => clearTimeout(timer));
`;
  const res = spawnSync(NODE, ['-e', snippet, topic], { encoding: 'utf8', timeout: remain, maxBuffer: 8 * 1024 * 1024 });
  if (res.error) return { ok: false, reason: res.error.code === 'ETIMEDOUT' ? '请求超时' : res.error.message };
  const out = (res.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
  let parsed;
  try { parsed = JSON.parse(out); } catch { return { ok: false, reason: '返回不可解析' }; }
  if (!parsed.ok) return { ok: false, reason: parsed.reason || '检索失败' };
  // 相关性淘汰 + 敏感兜底（纯函数，可单测）
  return filterGithubRepos(topic, parsed.raw || []);
}

// rewrite 模式：把原文案作为「来源文案宣称（未核实）」层。骨架版：整段引入并标未核实；
// 逐条结构化事实抽取「下批交付」。
function sourceClaimSection(order) {
  if (order.mode !== 'rewrite' || !order._sourceAbs || !existsSync(order._sourceAbs)) return '';
  let src = '';
  try { src = readFileSync(order._sourceAbs, 'utf8'); } catch { return ''; }
  const quoted = src.split('\n').map((l) => `> ${l}`).join('\n');
  return [
    '',
    '## 附 · 来源文案宣称（未核实，rewrite 模式）',
    '> 下列内容来自待改写原稿，**均为来源方宣称、未经本轮采集核实**。写稿时事实一律以本卡上方实采数据为准；',
    '> 原稿中的数字若与实采冲突，以实采为准，原稿数字不得直接引用。逐条结构化事实抽取为 **rewrite 自动档下批交付**。',
    '',
    quoted,
    '',
  ].join('\n');
}

// 需求层（百度）与供应线索（GitHub）的补完记录段。
function autoAppendSections({ demand, supply }) {
  const L = [];
  L.push('');
  L.push('## 附 · 需求层（百度公开检索，自动采集）');
  if (demand && demand.ok) {
    L.push(`- 已采：下拉联想 / 结果页 / 相关搜索三图 + demand-manifest.md，落 \`${demand.relDir}\`。`);
    if (demand.related && demand.related.length) L.push(`- 相关搜索词：${demand.related.slice(0, 12).join('、')}`);
    if (demand.resultCount) L.push(`- 百度相关结果约 ${demand.resultCount} 个（需求密度信号，供终审参考）。`);
    L.push('- 说明：以上为公开检索佐证，未做人工需求判断；是否成立由终审拍板。');
  } else {
    L.push(`❌缺口（需求层）：百度需求采集未完成（${(demand && demand.reason) || '未执行'}）。此项不致命，进入生成前建议人工补需求佐证。`);
  }
  L.push('');
  L.push('## 附 · 供应线索（自动检索，未人工核实）');
  if (supply && supply.ok) {
    L.push('- 来源：GitHub search API（无鉴权，按 star 排序 Top3），**自动检索线索，未人工核实**，仅供溯源起点：');
    for (const it of supply.items) L.push(`  - ${it.name}（★${it.stars}）：${it.desc || '（无描述）'}`);
    L.push('- 说明：能否作为合规、可持续的供应路径须人工溯源核实；核实前文案不得写"零成本/直接拿货/稳赚/绝对稳定"。');
  } else {
    L.push(`❌缺口（供应线索）：${(supply && supply.reason) || '未执行'}（GitHub 自动检索，未人工核实）。不致命，供应路径仍以第6节缺口为准，待人工溯源。`);
  }
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// 主流程：a 闲鱼采集 → b 状态判定 → c 百度需求 → d GitHub 供应 → e 组装+补完 → f 登记。
// 返回 { path, source, draft }。
// ---------------------------------------------------------------------------
export function autoCollectFactCard(order) {
  const deadline = Date.now() + COLLECT_TIMEOUT_MS;
  const stamp = dateStamp();
  const dirName = `workshop-${stamp}_${order.filmId}`;
  const runDir = join(REPO_ROOT, 'research-runs', dirName);
  const capturePath = join(runDir, 'capture.json');
  const cardPath = join(runDir, '事实卡-机器底稿.md');
  const indexPath = join(REPO_ROOT, 'cli', 'film-index.json');
  mkdirSync(runDir, { recursive: true });

  log('');
  log('════════════════════════════════════════════════════════════');
  log(`[自动采集] 该选题（filmId=${order.filmId}）暂无事实卡，启动自动采集流水线。`);
  log(`[自动采集] 搜索词（工单 topic）：「${order.topic}」`);
  log(`[自动采集] 产出目录：${runDir}`);
  log(`[自动采集] 全程 8 分钟硬超时；日志实时透传。`);
  log('════════════════════════════════════════════════════════════');

  // ---- a) 闲鱼采集（切词兜底由采集器自带）----
  log('');
  log('[1/6] 闲鱼直采（goofish-collect）…');
  const collectScript = join(REPO_ROOT, 'engine', 'collect', 'goofish-collect.mjs');
  runStep([collectScript, '--query', order.topic, '--out', runDir], { deadline });

  if (!existsSync(capturePath)) {
    throw new CollectError('闲鱼采集没有产出 capture.json（采集器可能异常退出）。请到风格仿写侧看采集日志后重试。');
  }
  let capture;
  try { capture = JSON.parse(readFileSync(capturePath, 'utf8')); }
  catch (e) { throw new CollectError(`闲鱼采集产出的 capture.json 解析失败：${e.message}`); }

  // ---- b) 状态判定（no_results / blocked_login / blocked_captcha / error）----
  const statusErr = captureStatusToError(capture);
  if (statusErr) throw new CollectError(statusErr);
  log(`[1/6] 闲鱼采集完成：status=${capture.status}，商品 ${(capture.products || []).length} 条` +
    (capture.query_used && capture.query_used !== capture.query_original ? `（切词兜底实采词「${capture.query_used}」）` : ''));

  // ---- c) 百度需求层（不致命）----
  log('');
  log('[2/6] 百度需求佐证（baidu-demand，失败不致命）…');
  let demand = { ok: false, reason: '未执行' };
  try {
    const baiduScript = join(REPO_ROOT, 'engine', 'collect', 'baidu-demand.mjs');
    const demandDir = join(runDir, 'demand-src');
    const res = runStep([baiduScript, '--query', order.topic, '--out', demandDir], { deadline, capture: true });
    const mani = join(demandDir, 'demand-manifest.md');
    if (res.status === 0 && existsSync(mani)) {
      demand = { ok: true, relDir: `research-runs/${dirName}/demand-src` };
      // 从 _capture-log.json 抽 related / resultCount 作卡内摘要
      const logPath = join(demandDir, '_capture-log.json');
      if (existsSync(logPath)) {
        try {
          const dl = JSON.parse(readFileSync(logPath, 'utf8'));
          const rp = (dl.results || []).find((r) => r.kind === 'result') || {};
          demand.related = rp.related || [];
          demand.resultCount = rp.resultCount || null;
        } catch { /* 忽略 */ }
      }
      log('[2/6] 百度需求采集完成（三图 + demand-manifest.md）。');
    } else {
      demand = { ok: false, reason: `采集未产出 manifest（exit=${res.status}）` };
      log(`[2/6] 百度需求采集未成（${demand.reason}）→ 记为需求层缺口，继续。`);
    }
  } catch (e) {
    if (e instanceof CollectError) throw e; // 超时要中止
    demand = { ok: false, reason: e.message };
    log(`[2/6] 百度需求采集异常（${e.message}）→ 记为需求层缺口，继续。`);
  }

  // ---- d) GitHub 供应线索（不致命）----
  log('');
  log('[3/6] GitHub 供应线索检索（自动，未人工核实；失败不致命）…');
  const supply = githubSupplyClues(order.topic, deadline);
  if (supply.ok) {
    log(`[3/6] GitHub 相关性过滤后 Top${supply.items.length}（关键词：${(supply.keywords || []).join('/')}）：${supply.items.map((i) => `${i.name}(★${i.stars})`).join('、')}`);
  } else {
    log(`[3/6] GitHub 供应线索：${supply.reason}（关键词：${(supply.keywords || []).join('/') || '—'}）→ 记为供应线索缺口，继续。`);
  }

  // ---- e) 组装机器卡 + 自动补完 ----
  log('');
  log('[4/6] 组装事实卡机器底稿（build-fact-card）…');
  const buildScript = join(REPO_ROOT, 'engine', 'factcard', 'build-fact-card.mjs');
  const buildArgs = [buildScript, '--capture', capturePath, '--out', cardPath,
    '--audience', order.audience,
    '--conclusion', '待终审时确认（机器未判定"做主号/短测/放弃"，终审时人工补）'];
  if (supply.ok) {
    const supplyLine = 'GitHub 自动检索线索（未人工核实）：' + supply.items.map((i) => `${i.name}(★${i.stars})`).join('；');
    buildArgs.push('--supply', supplyLine);
  }
  const buildRes = runStep(buildArgs, { deadline });
  if (buildRes.status !== 0 || !existsSync(cardPath)) {
    throw new CollectError(`事实卡组装失败（build-fact-card exit=${buildRes.status}）。请到风格仿写侧看采集日志后重试。`);
  }

  // 自动补完：追加 需求层 / 供应线索 / （rewrite）来源宣称 段
  log('[5/6] 事实卡自动补完（受众回填、结论占位、需求/供应层补记）…');
  let cardText = readFileSync(cardPath, 'utf8');
  cardText += autoAppendSections({ demand, supply });
  cardText += sourceClaimSection(order);
  writeFileSync(cardPath, cardText, 'utf8');

  // ---- f) 登记 film-index ----
  log('[6/6] 登记 cli/film-index.json（filmId → 采集目录）…');
  const reg = registerFilmIndex(indexPath, order.filmId, dirName);
  log(`[6/6] film-index ${reg.changed ? '已登记' : '已存在（幂等）'}：${order.filmId} → ${dirName}`);

  const { draft } = classifyFactCard(cardText);
  log('');
  log(`[自动采集] ✅ 流水线完成，产出机器底稿事实卡：${cardPath}`);
  log(`[自动采集] 该卡为机器草稿，进入生成后报告会加醒目警示，终审时请重点核对数字。`);
  log('════════════════════════════════════════════════════════════');
  log('');

  return {
    path: cardPath,
    source: `自动采集流水线新建（闲鱼 status=${capture.status}｜需求层${demand.ok ? '已采' : '缺口'}｜供应线索${supply.ok ? '已采' : '缺口'}）`,
    draft,
  };
}
