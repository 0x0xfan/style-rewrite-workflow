// 知识包层：定位 / 现建 / 读取 / 校验 knowledge-pack.json。
//
// 为什么有这一层（DECISIONS.md 2026-09-04「恢复强制知识包」）：
// 出稿的三输入是「事实卡 + 知识包 + 风格档案」，缺一不可。事实卡与风格档案早就是硬输入
// （locateFactCard / resolveStyle 都会拦），只有知识包一直躺在 engine/knowledge/ 里没人调，
// 于是实际跑的是「事实 + 风格」两输入。用户 2026-09-04 明确裁定恢复强制：
// **每篇出稿前必须检索知识包，零结果或知识库不可访问就停止生成。**
//
// 红线（docs/知识包规范.md）：知识包只负责「丰富解释与方法」，**不负责提供事实**。
// 包里的数字、案例、收益、平台结论一律不得写进口播稿；口播稿的事实只能来自事实卡。
// 这条红线由 cli/lib/prompt.mjs 的「背景知识」段在提示词里钉死，本文件只负责把包拿到手并验真。
//
// 全部硬停都抛 KnowledgeError，由 generate.mjs 翻成一句中文 stderr + 非 0 退出，且不落任何稿件文件。
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, isAbsolute, dirname } from 'node:path';
import { REPO_ROOT, CLI_ROOT } from './inputs.mjs';

// 知识包相关的一切硬停都用这个错误类型（generate.mjs 据此给人话原因、非 0 退出）。
export class KnowledgeError extends Error {}

// 构建器脚本（相对仓库根）与默认 python 解释器（仓库根 .venv）。
export const BUILDER_REL = 'engine/knowledge/build_knowledge_pack.py';
const DEFAULT_VENV_PYTHON = join(REPO_ROOT, '.venv', 'Scripts', 'python.exe');

// 装 .venv 的人话提示：知识库不可访问 / python 缺失时一律附上，别让人对着退出码猜。
const INSTALL_HINT =
  '补救办法：\n' +
  `  1) 确认仓库根有 .venv：在 ${REPO_ROOT} 下跑 \`python -m venv .venv\`，再 \`.venv\\Scripts\\pip install jieba\`；\n` +
  '  2) 或者用环境变量 KNOWLEDGE_PACK_PYTHON 指到一台装了 jieba 的 python.exe；\n' +
  '  3) 确认闲鱼知识库在 D:/项目仓库/闲鱼知识库（路径写死在 engine/knowledge/build_knowledge_pack.py 顶部）。';

// 解析要用哪个 python：环境变量 KNOWLEDGE_PACK_PYTHON 优先，否则仓库根 .venv。
export function resolveKnowledgePython(env = process.env) {
  const override = (env.KNOWLEDGE_PACK_PYTHON || '').trim();
  if (override) return { python: override, source: '环境变量 KNOWLEDGE_PACK_PYTHON' };
  return { python: DEFAULT_VENV_PYTHON, source: '仓库根 .venv' };
}

// 本期的检索关键词。工单 knowledgeKeywords 优先；没给就用 topic + points 拼一份。
// points 太长的直接丢（整句进检索词只会零命中），只留 12 字以内的短语。
export function knowledgeKeywords(order = {}) {
  const explicit = order.knowledgeKeywords;
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.map((k) => String(k).trim()).filter(Boolean);
  }
  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit.split(/[,，、]/).map((k) => k.trim()).filter(Boolean);
  }
  const out = [];
  const push = (s) => {
    const t = String(s || '').trim();
    if (t && t.length <= 12 && !out.includes(t)) out.push(t);
  };
  push(order.topic);
  for (const p of order.points || []) push(p);
  return out;
}

// 校验一个已读到的知识包。不合格就抛 KnowledgeError（空包夹具必须被这里拒掉）。
// 兼容两代包：2.0 有 retrieval.*，1.0（engine/fixtures 里的老夹具）只有 sources[]，按 sources 长度回退。
export function validateKnowledgePack(pack, packPath = '（内存中的包）') {
  if (!pack || typeof pack !== 'object') {
    throw new KnowledgeError(`知识包不是合法对象：${packPath}`);
  }
  const sources = Array.isArray(pack.sources) ? pack.sources : [];
  const r = pack.retrieval && typeof pack.retrieval === 'object' ? pack.retrieval : {};
  const resultCount = Number.isFinite(r.result_count) ? r.result_count : sources.length;
  const usableCount = Number.isFinite(r.usable_source_count) ? r.usable_source_count : sources.length;

  if (!sources.length || resultCount < 1 || usableCount < 1) {
    throw new KnowledgeError(
      `知识包是空包，不予放行：${packPath}\n` +
      `  （条目 ${sources.length} 条，result_count=${resultCount}，usable_source_count=${usableCount}；` +
      '规范要求两者都 ≥ 1）\n' +
      '  按 docs/requirements.md：知识库零结果时停止生成，不得空包放行。\n' +
      '  补救办法：换更贴近商品的关键词重新检索（工单 knowledgeKeywords），或先向闲鱼知识库补充该题材内容。'
    );
  }

  // relation 分布：2.0 直接给；1.0 从条目上数（老夹具没有 relation，按 supplement 记）。
  const dist = { support: 0, supplement: 0, counterevidence: 0 };
  const given = r.relation_distribution;
  if (given && typeof given === 'object') {
    for (const k of Object.keys(dist)) if (Number.isFinite(given[k])) dist[k] = given[k];
  } else {
    for (const s of sources) {
      const rel = dist[s.relation] !== undefined ? s.relation : 'supplement';
      dist[rel] += 1;
    }
  }

  return {
    pack,
    sources,
    resultCount,
    usableCount,
    relationDistribution: dist,
    primaryTermHits: Number.isFinite(r.primary_term_hits) ? r.primary_term_hits : null,
    coverageWarning: r.coverage_warning || null,
    schemaVersion: pack.schema_version || '（未标注）'
  };
}

// 读一个知识包文件并校验。文件不在 / 不是 json / 空包，都是硬停。
export function readKnowledgePack(absPath) {
  if (!existsSync(absPath)) {
    throw new KnowledgeError(`知识包文件不存在：${absPath}`);
  }
  let pack;
  try {
    pack = JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (e) {
    throw new KnowledgeError(`知识包不是合法 json：${absPath}\n  ${e.message}`);
  }
  return { ...validateKnowledgePack(pack, absPath), path: absPath };
}

// 读 film-index.json 里 filmId 的映射目录名（拿不到就返回 null，不抛错——事实卡那边已经拦过一轮了）。
// indexPath / researchRoot 两个可选参数只给单测用：让「映射命中」这条分支能在临时目录里跑，
// 不必往用户的私有证据目录 research-runs/ 里写测试文件。
function mappedDir(filmId, indexPath = join(CLI_ROOT, 'film-index.json')) {
  try {
    const idx = JSON.parse(readFileSync(indexPath, 'utf8'));
    const entry = (idx.map || {})[filmId];
    if (!entry) return null;
    return typeof entry === 'string' ? entry : entry.dir || null;
  } catch {
    return null;
  }
}

// research-runs 下模糊找一个目录名含 filmId、且已经有 knowledge-pack.json 的目录。
function fuzzyPackDir(filmId, researchRoot = join(REPO_ROOT, 'research-runs')) {
  const root = researchRoot;
  if (!existsSync(root)) return null;
  let entries;
  try {
    entries = readdirSync(root);
  } catch {
    return null;
  }
  for (const d of entries) {
    const full = join(root, d);
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    if (!d.includes(filmId)) continue;
    if (existsSync(join(full, 'knowledge-pack.json'))) return d;
  }
  return null;
}

// 现建时的落点目录名：优先映射目录，否则按采集流水线的约定造一个 workshop-<日期>_<filmId>。
export function knowledgeOutDirName(order, opts = {}) {
  const mapped = mappedDir(order.filmId, opts.filmIndexPath);
  if (mapped) return mapped;
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `workshop-${stamp}_${order.filmId}`;
}

// 真正调构建器。默认 spawnSync 起 python；单测传 opts.runBuilder 顶掉，不起子进程。
// 退出码按 docs/知识包规范.md：0 已产出 / 1 零结果（或严格覆盖度未过）/ 2 知识库不可访问。
// repoRoot 只给单测用（把产物落到临时目录，别往用户的 research-runs 里写测试文件）。
export function buildKnowledgePack({ topic, keywords, outRel, env = process.env, runBuilder, repoRoot = REPO_ROOT } = {}) {
  const args = [
    '-X', 'utf8', BUILDER_REL,
    'build',
    '--topic', topic,
    '--keywords', (keywords || []).join(','),
    '--out', outRel
  ];

  let res;
  if (typeof runBuilder === 'function') {
    // 单测注入：直接给 { status, stdout, stderr }，不起子进程。
    res = runBuilder({ args, topic, keywords, outRel }) || {};
  } else {
    const { python, source } = resolveKnowledgePython(env);
    // 绝对路径必须真存在才 spawn（.venv 没装时先给人话，别让人对着 ENOENT 猜）；
    // 给的是 PATH 上的命令名（如 python）时交给 spawnSync 自己找。
    if (isAbsolute(python) && !existsSync(python)) {
      throw new KnowledgeError(
        '知识库不可访问：找不到跑知识包构建器的 python。\n' +
        `  （${source} → ${python}，该文件不存在）\n` + INSTALL_HINT
      );
    }
    res = spawnSync(python, args, { cwd: repoRoot, encoding: 'utf8', timeout: 300000 });
    if (res.error) {
      throw new KnowledgeError(
        `知识库不可访问：启动知识包构建器失败（${res.error.message}）。\n` + INSTALL_HINT
      );
    }
  }

  const status = res.status;
  const stderr = String(res.stderr || '').trim();
  if (status === 1) {
    throw new KnowledgeError(
      `知识库对选题「${topic}」零结果，按规则停止生成（不得空包放行）。\n` +
      `  检索词：${(keywords || []).join('、') || '（空）'}\n` +
      (stderr ? `  构建器原话：${stderr.split('\n').slice(-4).join('\n  ')}\n` : '') +
      '  补救办法：在工单里加 knowledgeKeywords，换更贴近商品的具体词重检；或先向闲鱼知识库补充该题材内容再出稿。'
    );
  }
  if (status === 2) {
    throw new KnowledgeError(
      '知识库不可访问，按规则停止生成（不得空包放行）。\n' +
      (stderr ? `  构建器原话：${stderr.split('\n').slice(-4).join('\n  ')}\n` : '') + INSTALL_HINT
    );
  }
  if (status !== 0) {
    throw new KnowledgeError(
      `知识包构建器异常退出（退出码 ${status}），按规则停止生成。\n` +
      (stderr ? `  构建器原话：${stderr.split('\n').slice(-6).join('\n  ')}\n` : '') + INSTALL_HINT
    );
  }

  const abs = isAbsolute(outRel) ? outRel : join(repoRoot, outRel);
  if (!existsSync(abs)) {
    throw new KnowledgeError(
      `知识包构建器报成功（退出码 0）却没写出文件：${abs}\n  这属程序问题，请把上面的日志贴给维护者。`
    );
  }
  return abs;
}

// 定位本期知识包。返回 { path, source, built, ...validateKnowledgePack 的字段 }。
// 顺序（与 docs/知识包规范.md 一致）：
//   1) 工单 knowledgePackPath 显式指定；
//   2) filmId 在 cli/film-index.json 映射目录下的 knowledge-pack.json（映射不在时按目录名模糊兜底）；
//   3) 都没有 → 现建（调 build_knowledge_pack.py）。
// 任何一步失败都抛 KnowledgeError（硬停），绝不返回空包。
export function resolveKnowledgePack(order, opts = {}) {
  const log = opts.log || (() => {});

  // 1) 工单显式指定（相对工单文件解析）
  if (order.knowledgePackPath) {
    const p = isAbsolute(order.knowledgePackPath)
      ? order.knowledgePackPath
      : resolve(dirname(order._path || REPO_ROOT), order.knowledgePackPath);
    if (!existsSync(p)) {
      throw new KnowledgeError(`工单 knowledgePackPath 指向的知识包不存在：${p}`);
    }
    return { ...readKnowledgePack(p), source: '工单 knowledgePackPath 显式指定', built: false };
  }

  // 2) 映射目录 / 模糊目录里的现成包
  const researchRoot = opts.researchRoot || join(REPO_ROOT, 'research-runs');
  const dirName = mappedDir(order.filmId, opts.filmIndexPath) || fuzzyPackDir(order.filmId, researchRoot);
  if (dirName) {
    const p = join(researchRoot, dirName, 'knowledge-pack.json');
    if (existsSync(p)) {
      return {
        ...readKnowledgePack(p),
        source: `film-index.json 映射「${order.filmId}」→「${dirName}」`,
        built: false
      };
    }
  }

  // 3) 现建
  const topic = order.topic;
  const keywords = knowledgeKeywords(order);
  const outDir = knowledgeOutDirName(order, opts);
  const outRel = `research-runs/${outDir}/knowledge-pack.json`;
  log('知识包：未找到，正在检索知识库…');
  log(`      检索选题「${topic}」，关键词：${keywords.join('、') || '（空）'}`);
  const abs = buildKnowledgePack({
    topic, keywords, outRel, env: opts.env, runBuilder: opts.runBuilder, repoRoot: opts.repoRoot
  });
  return { ...readKnowledgePack(abs), source: `现建（${outRel}）`, built: true };
}

// 一行 stdout 日志：知识包：<路径>（N 条，support x / supplement y / counter z）
export function knowledgeLogLine(k) {
  const d = k.relationDistribution || {};
  return `知识包：${k.path}（${k.resultCount} 条，support ${d.support || 0} / supplement ${d.supplement || 0} / counter ${d.counterevidence || 0}）`;
}
