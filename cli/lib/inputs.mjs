// 输入解析层：工单 json、风格→IP 档案定位、事实卡定位。
// 全部路径解析基于仓库根（cli/ 的上一级），不依赖 cwd（面板 spawn 时 cwd 不定）。
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, isAbsolute, basename } from 'node:path';
import { autoCollectFactCard, findCardInDir, classifyFactCard, CollectError } from './collect.mjs';
import { LENGTH_PRESETS, DEFAULT_LENGTH_PRESET } from './length-presets.mjs';

export { CollectError };

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(here, '..', '..');
export const CLI_ROOT = resolve(here, '..');

// 风格注册表（styles.json 已存在，只读）。id → { ip 中文名, dnaPath 相对仓库根 }。
// styles.json 只有 id/name，DNA 路径按约定拼；这里显式写死两条，避免猜路径。
const STYLE_TABLE = {
  qian17: { ip: '钱十七', dna: 'ips/钱十七/dna/钱十七-DNA-重构版.md' },
  banfo: { ip: '半佛', dna: 'ips/半佛/dna/半佛-DNA-可执行版.md' }
};

// 已注册风格 IP 的中文名单（供叙述者身份硬拦截用：产出不得自称任何一个）。
export const STYLE_IP_NAMES = Object.values(STYLE_TABLE).map((m) => m.ip);

export class InputError extends Error {}

// 篇幅档位 → 目标口播字数（按 ~300 字/分钟）与形态标记。
// short 触发短视频形态（诱导形式转换 + 平台合规门禁）；standard/long 走长视频形态，照旧不走合规层。
// 三档数字的唯一来源在 ./length-presets.mjs（AI 味门禁也要按档取免责句上限，两边共读同一份），这里只转出去。
export { LENGTH_PRESETS, DEFAULT_LENGTH_PRESET, inferLengthPreset } from './length-presets.mjs';

// 解析篇幅档位（向后兼容）。合法值原样返回；缺省→standard；未识别→standard 且带一条中文 warn，绝不抛错。
export function resolveLengthPreset(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { preset: DEFAULT_LENGTH_PRESET, warn: null };
  }
  if (Object.prototype.hasOwnProperty.call(LENGTH_PRESETS, raw)) {
    return { preset: raw, warn: null };
  }
  return {
    preset: DEFAULT_LENGTH_PRESET,
    warn: `工单 lengthPreset「${raw}」不是可识别档位（short / standard / long），已按 standard 处理。`
  };
}

// 读 styles.json，校验 styleId 已注册且档案文件在。返回 { id, ip, name, status, dnaPath, lexiconPath }。
export function resolveStyle(styleId) {
  const stylesPath = join(REPO_ROOT, 'styles.json');
  let reg;
  try {
    reg = JSON.parse(readFileSync(stylesPath, 'utf8'));
  } catch (e) {
    throw new InputError(`读不到风格注册表 styles.json：${e.message}`);
  }
  const entry = (reg.styles || []).find((s) => s.id === styleId);
  if (!entry) {
    const known = (reg.styles || []).map((s) => s.id).join('、') || '（空）';
    throw new InputError(`风格 id「${styleId}」不在注册表里。已注册的风格：${known}`);
  }
  const meta = STYLE_TABLE[styleId];
  if (!meta) {
    throw new InputError(`风格「${styleId}」还没接上 DNA 档案路径，暂不能出稿。请联系维护者在 cli/lib/inputs.mjs 登记。`);
  }
  const dnaPath = join(REPO_ROOT, meta.dna);
  if (!existsSync(dnaPath)) {
    throw new InputError(`风格「${entry.name}」的 DNA 档案不存在：${dnaPath}`);
  }
  const lexiconPath = join(REPO_ROOT, 'ips', meta.ip, 'corpus', 'lexicon.json');
  return { id: styleId, ip: meta.ip, name: entry.name, status: entry.status, dnaPath, lexiconPath };
}

// 读并校验工单 json。返回规范化 order 对象。
export function loadOrder(orderPath) {
  const abs = isAbsolute(orderPath) ? orderPath : resolve(process.cwd(), orderPath);
  if (!existsSync(abs)) throw new InputError(`工单文件不存在：${abs}`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    throw new InputError(`工单不是合法 json：${e.message}`);
  }
  const order = {
    filmId: raw.filmId,
    styleId: raw.styleId,
    topic: raw.topic,
    points: Array.isArray(raw.points) ? raw.points : [],
    assetsHint: raw.assetsHint || '',
    audience: raw.audience || '起步期',
    mode: raw.mode || 'topic',
    sourcePath: raw.rewriteSourcePath ?? raw.sourcePath,
    factCardPath: raw.factCardPath,
    // 可选：本期知识包路径（三输入之一，见 cli/lib/knowledge.mjs）。不给时按 filmId 找现成包，
    // 再没有就现建（调 engine/knowledge/build_knowledge_pack.py）。相对路径按工单文件所在目录解析。
    knowledgePackPath: raw.knowledgePackPath,
    // 可选：现建知识包时用的检索关键词（数组或逗号分隔字符串）。不给时由 topic + points 拼。
    knowledgeKeywords: raw.knowledgeKeywords,
    // 可选：装置轮换门禁的历史稿对比池目录（字符串或数组，指向存 script.txt 的目录）。
    // 不给时由 loadHistoryPool 按 STYLE_HISTORY_DIR / --out 落点反推，见该函数注释。
    historyDir: raw.historyDir,
    _path: abs
  };
  const lp = resolveLengthPreset(raw.lengthPreset);
  order.lengthPreset = lp.preset;      // 恒为 short/standard/long 之一
  order._lengthPresetWarn = lp.warn;   // 未识别时的中文 warn（generate.mjs 打到 stdout），否则 null
  if (!order.filmId || typeof order.filmId !== 'string') throw new InputError('工单缺 filmId（影片稳定键，小写 kebab）。');
  if (!order.styleId || typeof order.styleId !== 'string') throw new InputError('工单缺 styleId（风格 id，如 qian17）。');
  if (!order.topic || typeof order.topic !== 'string') throw new InputError('工单缺 topic（本期选题一句话）。');
  if (order.mode !== 'topic' && order.mode !== 'rewrite') {
    throw new InputError(`工单 mode 只能是 "topic" 或 "rewrite"，收到「${order.mode}」。`);
  }
  if (order.mode === 'rewrite') {
    if (!order.sourcePath) throw new InputError('mode=rewrite 必须附 rewriteSourcePath（要改写的原稿路径）。');
    const sabs = isAbsolute(order.sourcePath) ? order.sourcePath : resolve(dirname(abs), order.sourcePath);
    if (!existsSync(sabs)) throw new InputError(`改写原稿不存在：${sabs}`);
    order._sourceAbs = sabs;
  }
  return order;
}

// 事实卡定位。优先 order.factCardPath；否则查 film-index.json 映射到采集目录；
// 再否则在 research-runs 下模糊找目录名含 filmId 的。
// 仍找不到 → 自动跑采集+事实卡流水线现造一张（opts.autoCollect=false 时退回抛错，供单测/离线用）。
// 接受「终版候选」及以上，也接受纯机器草稿卡（draft=true，报告会加醒目警示）。
// 返回 { path, source, draft } —— source 说明命中方式，draft 说明是否机器草稿。
export function locateFactCard(order, opts = {}) {
  const autoCollect = opts.autoCollect !== false;

  // 1) 工单显式指定
  if (order.factCardPath) {
    const p = isAbsolute(order.factCardPath)
      ? order.factCardPath
      : resolve(dirname(order._path), order.factCardPath);
    if (existsSync(p)) {
      const { draft } = classifyFactCard(readFileSync(p, 'utf8'));
      return { path: p, source: '工单 factCardPath 显式指定', draft };
    }
    throw new InputError(`工单 factCardPath 指向的事实卡不存在：${p}`);
  }

  const researchRoot = join(REPO_ROOT, 'research-runs');
  const indexPath = join(CLI_ROOT, 'film-index.json');
  let mapEntry;
  try {
    const idx = JSON.parse(readFileSync(indexPath, 'utf8'));
    mapEntry = (idx.map || {})[order.filmId];
  } catch (e) {
    throw new InputError(`读不到 filmId 映射表 cli/film-index.json：${e.message}`);
  }

  // 2) 映射表命中 → 该目录里按优先级找卡（终版 > 终版候选 > 机器底稿 > 事实卡.md）
  // 映射值可为字符串（目录名）或对象 {dir, frozen, reason}；frozen=true 的选题禁止生成（用户级冻结）。
  if (mapEntry) {
    const entryObj = typeof mapEntry === 'string' ? { dir: mapEntry } : mapEntry;
    if (entryObj.frozen) {
      throw new InputError(
        `该选题（filmId=${order.filmId}）已被用户冻结，暂停生成。原因：${entryObj.reason || '未注明'}。请联系老板解冻后再试。`
      );
    }
    const hit = findCardInDir(join(researchRoot, entryObj.dir));
    if (hit) return { path: hit.path, source: `film-index.json 映射「${order.filmId}」→「${entryObj.dir}」`, draft: hit.draft };
    // 映射在、卡还没出：落到自动采集（下方），不再直接抛错
  }

  // 3) 模糊兜底：目录名含 filmId 的
  if (existsSync(researchRoot)) {
    for (const d of readdirSync(researchRoot)) {
      const full = join(researchRoot, d);
      if (!statSync(full).isDirectory()) continue;
      if (d.includes(order.filmId)) {
        const hit = findCardInDir(full);
        if (hit) return { path: hit.path, source: `research-runs 目录名模糊匹配「${d}」`, draft: hit.draft };
      }
    }
  }

  // 4) 仍无事实卡 → 自动采集流水线现造一张（第二档）
  if (autoCollect) {
    return autoCollectFactCard(order);
  }

  throw new InputError(
    `该选题（filmId=${order.filmId}）还没有事实卡素材，且已关闭自动采集（autoCollect=false）。\n` +
    `（已查：工单 factCardPath 未给；cli/film-index.json 无可用卡；research-runs 下也没有名字含「${order.filmId}」的可用卡。）\n` +
    '开启自动采集或先在 cli/film-index.json 登记 filmId → 采集目录名 的映射。'
  );
}

// 历史稿池（装置轮换门禁 + 「近期已用句式清单」注入的对比池）。
//
// 为什么要有这个：跨稿重复门禁（engine/variation/check-repetition.mjs）一直是**离线批量工具**，
// 由人拿几个文件跑，从没接进 generate.mjs——所以生成时没有任何「历史稿池」可用。本函数补上这一环。
//
// 取池优先级（三档，全部拿不到就返回空池 + 中文原因，绝不抛错、绝不拦稿）：
//   1. 工单 historyDir（字符串或数组）——显式指定，最高优先。
//   2. 环境变量 STYLE_HISTORY_DIR——多个目录用 ; 或 : 分隔。
//   3. 从 --out 落点反推同风格的兄弟影片：交接口规范定死落点是
//      `<...>/films/<filmId>/copy/<styleId>/`，于是 films/ 下每个兄弟目录的
//      `copy/<styleId>/script.txt` 就是同风格的历史稿。排除本期 filmId。
//
// 返回 { docs: { 稿件名: 全文 }, source, count, dirs }。docs 为空时 source 说明为什么空。
export function loadHistoryPool(order, opts = {}) {
  const styleId = order.styleId || opts.styleId;
  const limit = opts.limit || 12;
  const empty = (reason) => ({ docs: {}, source: reason, count: 0, dirs: [] });

  const readScripts = (dirs, source) => {
    const docs = {};
    const used = [];
    for (const d of dirs) {
      const f = join(d, 'script.txt');
      if (!existsSync(f)) continue;
      try {
        const t = readFileSync(f, 'utf8');
        if (t.trim()) { docs[basename(resolve(d, '..', '..'))] = t; used.push(d); }
      } catch { /* 读不了就跳过，历史池是尽力而为，不许拦稿 */ }
    }
    return { docs, source, count: Object.keys(docs).length, dirs: used };
  };

  // 1) 工单显式指定
  const explicit = opts.historyDir ?? order.historyDir;
  if (explicit) {
    const list = (Array.isArray(explicit) ? explicit : [explicit]).map((p) =>
      isAbsolute(p) ? p : resolve(dirname(order._path || REPO_ROOT), p));
    const r = readScripts(list, `工单 historyDir 显式指定（${list.length} 个目录）`);
    return r.count ? r : empty(`工单 historyDir 指定的目录里没找到 script.txt：${list.join('、')}`);
  }

  // 2) 环境变量
  const env = opts.env ?? process.env.STYLE_HISTORY_DIR;
  if (env) {
    const list = env.split(/[;:](?![\\/])/).map((s) => s.trim()).filter(Boolean);
    const r = readScripts(list, `环境变量 STYLE_HISTORY_DIR（${list.length} 个目录）`);
    return r.count ? r : empty(`STYLE_HISTORY_DIR 指定的目录里没找到 script.txt：${list.join('、')}`);
  }

  // 3) 从 --out 反推兄弟影片
  const outDir = opts.outDir;
  if (!outDir) return empty('未接历史稿池：工单没给 historyDir、环境变量 STYLE_HISTORY_DIR 未设、也没拿到 --out 落点。装置轮换只能靠提示词自律，机器不做跨期比对。');
  const norm = String(outDir).split('\\').join('/').replace(/\/+$/, '');
  const parts = norm.split('/');
  const iFilms = parts.lastIndexOf('films');
  // 期望形如 .../films/<filmId>/copy/<styleId>
  if (iFilms < 0 || parts[iFilms + 2] !== 'copy' || parts.length < iFilms + 4) {
    return empty(`未接历史稿池：--out「${outDir}」不是交接口规范的 films/<filmId>/copy/<styleId> 落点，反推不出兄弟影片目录。可在工单加 historyDir 或设 STYLE_HISTORY_DIR。`);
  }
  const filmsRoot = parts.slice(0, iFilms + 1).join('/');
  const selfFilm = parts[iFilms + 1];
  const sid = parts[iFilms + 3] || styleId;
  if (!existsSync(filmsRoot)) return empty(`未接历史稿池：影片根目录不存在（${filmsRoot}）。`);
  let siblings;
  try {
    siblings = readdirSync(filmsRoot).filter((d) => d !== selfFilm);
  } catch (e) {
    return empty(`未接历史稿池：读不了影片根目录（${filmsRoot}）：${e.message}`);
  }
  const dirs = siblings
    .map((d) => join(filmsRoot, d, 'copy', sid))
    .filter((d) => existsSync(d))
    .slice(-limit);
  if (!dirs.length) return empty(`未接历史稿池：${filmsRoot} 下没有别的影片存过「${sid}」风格的稿（本期是这个风格在该目录的第一篇）。`);
  const r = readScripts(dirs, `--out 反推兄弟影片（${filmsRoot}，风格 ${sid}）`);
  return r.count ? r : empty(`未接历史稿池：${filmsRoot} 下「${sid}」风格的兄弟目录都没有 script.txt。`);
}

// 读取一个仓库内治理文档（相对仓库根）；缺失即抛错（这些是出稿的硬前提）。
export function readRepoDoc(relPath) {
  const p = join(REPO_ROOT, relPath);
  if (!existsSync(p)) throw new InputError(`出稿依赖的治理文档缺失：${relPath}（${p}）`);
  return readFileSync(p, 'utf8');
}
