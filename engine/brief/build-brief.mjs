#!/usr/bin/env node
// build-brief.mjs —— 配料包生成器
//
// 把写一篇口播稿要用的"配料"从各个大文件里按编号抽出来，拼成一份配料包给写手，
// 代替让写手自己读二十万字。
//
// 用法见 docs/配料包规范.md。
//
// 规矩：
//   - 缺参数 → 跳过那一节，在末尾"缺项"里列出（不报错）
//   - 编号找不到 → 报错退出 1（不许静默漏）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadTable as loadWordTable, filterByTopic, renderMarkdown as renderWordTable,
  countBySource, DEFAULT_TABLE as DEFAULT_WORD_TABLE, USER_SOURCES as USER_WORD_SOURCES,
} from './word-table.mjs';
import {
  loadPack, recentEpisodes, pickOpenings, pickSayings, pickVoices,
  renderOpenings, renderSayings, renderVoices, droppedSummary, parseSceneSpec,
  openingTypeNames, DEFAULT_PACK,
} from './corpus-pack.mjs';

// ───────────────────────── 基础工具 ─────────────────────────

// 本文件在 <repo>/engine/brief/ 下，往上两级就是仓库根
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function die(msg) {
  process.stderr.write(`\n[build-brief] 错误：${msg}\n\n`);
  process.exit(1);
}

/** 相对仓库根或绝对路径 → 绝对路径 */
function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.resolve(REPO_ROOT, p);
}

function readFileOrDie(p, label) {
  const abs = resolvePath(p);
  if (!fs.existsSync(abs)) die(`${label} 文件不存在：${abs}`);
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch (e) {
    die(`${label} 文件读不出来：${abs}（${e.message}）`);
  }
  return { abs, text, lines: text.replace(/\r\n/g, '\n').split('\n') };
}

/** 逗号分隔编号 → 去空去重数组 */
function splitIds(raw) {
  return [...new Set(String(raw).split(/[,，]/).map((s) => s.trim()).filter(Boolean))];
}

function countHanzi(s) {
  const m = s.match(/[一-鿿]/g);
  return m ? m.length : 0;
}

// ───────────────────────── markdown 解析 ─────────────────────────

/**
 * 抽一整节：从命中 headingRe 的那行起，到下一个同级或更高级 ## 标题为止。
 * 返回 null 表示没找到。
 */
function extractSection(lines, headingRe) {
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start === -1) return null;
  const startLevel = (lines[start].match(/^#+/) || ['##'])[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= startLevel) { end = i; break; }
  }
  // 去掉尾部的空行和分隔线
  let out = lines.slice(start, end);
  while (out.length && (out[out.length - 1].trim() === '' || out[out.length - 1].trim() === '---')) out.pop();
  return out.join('\n');
}

/** 抽角度小节：从 `## 角度 X ·` 起，到下一条独占一行的 `---` 为止（不含）。 */
function extractAngle(lines, letter) {
  const re = new RegExp(`^##\\s*角度\\s*${letter}\\s*[·・\\.]`);
  const start = lines.findIndex((l) => re.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= 2) { end = i; break; }
  }
  let out = lines.slice(start, end);
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}

const SEP_RE = /^\|\s*:?-{2,}/;

/** 从表格行往上找它所属表的「表头行 + 分隔行」；找不到返回 null。 */
function findTableHeader(lines, rowIdx) {
  for (let i = rowIdx - 1; i >= 0 && i >= rowIdx - 200; i--) {
    const l = lines[i];
    if (SEP_RE.test(l)) {
      const head = lines[i - 1];
      if (head && head.trim().startsWith('|')) return { header: head, sep: l, headerIdx: i - 1 };
      return null;
    }
    if (!l.trim().startsWith('|') && l.trim() !== '') return null; // 走出这张表了
  }
  return null;
}

/** 从表格行往上找最近的 ## / ### 标题文字 */
function findNearestHeading(lines, rowIdx) {
  for (let i = rowIdx - 1; i >= 0; i--) {
    const m = lines[i].match(/^#{2,3}\s+(.*)$/);
    if (m) return m[1].trim();
  }
  return '';
}

/**
 * 按编号抽表格整行。matchFirstCell(cellText) → 命中的编号（字符串）或 null。
 * 返回 { hits: Map<id, [{line, idx}]>, blocks: [{heading, header, sep, rows}] }
 */
function pickTableRows(lines, wantedIds, matchFirstCell) {
  const hits = new Map();
  const picked = []; // {idx, line, id}
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim().startsWith('|')) continue;
    if (SEP_RE.test(l)) continue;
    const cells = l.split('|');
    if (cells.length < 3) continue;
    const first = cells[1].trim();
    const id = matchFirstCell(first);
    if (id === null || id === undefined) continue;
    if (!wantedIds.includes(id)) continue;
    if (!hits.has(id)) hits.set(id, []);
    hits.get(id).push(i);
    picked.push({ idx: i, line: l, id });
  }
  // 按表头分组，保持文档顺序
  const blocks = [];
  for (const p of picked) {
    const h = findTableHeader(lines, p.idx);
    const key = h ? h.headerIdx : -1;
    let b = blocks.find((x) => x.key === key);
    if (!b) {
      b = {
        key,
        heading: findNearestHeading(lines, p.idx),
        header: h ? h.header : null,
        sep: h ? h.sep : null,
        rows: [],
      };
      blocks.push(b);
    }
    b.rows.push(p.line);
  }
  return { hits, blocks };
}

function renderBlocks(blocks) {
  return blocks
    .map((b) => {
      const head = b.header ? `${b.header}\n${b.sep}\n` : '';
      const title = b.heading ? `*（出自：${b.heading}）*\n\n` : '';
      return `${title}${head}${b.rows.join('\n')}`;
    })
    .join('\n\n');
}

function assertAllFound(hits, wanted, what, file) {
  const missing = wanted.filter((id) => !hits.has(id) || hits.get(id).length === 0);
  if (missing.length) {
    die(`${what} 里找不到这些编号：${missing.join('、')}\n        文件：${file}\n        （不允许静默漏配料，请核对编号后重跑）`);
  }
}

// ───────────────────────── 命令行 ─────────────────────────

const KNOWN = new Set([
  'style', 'factcard', 'facts', 'chain', 'links', 'angles', 'angle',
  'stories', 'story-ids', 'experiences', 'exp-ids', 'topic', 'topic-type', 'words', 'out', 'help',
  'pack', 'episode', 'opening-types', 'n-openings', 'scenes', 'n-sayings', 'n-voices', 'authors',
  'lean',
]);
/** 不带值的开关参数 */
const FLAGS = new Set(['help', 'lean']);

// --lean（写手版）只嵌风格说明书的这几节（按 "## 节号、" 匹配）
const LEAN_STYLE_SECTIONS = ['三', '四', '七', '八', '十三', '十四', '十五', '十七'];
// --lean 用户校准词表只嵌这几类里"用户点名 / 员工修改"的条目
const LEAN_WORD_TYPES = ['内部术语', '借用错', '用词不当'];

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) die(`看不懂的参数：${t}`);
    const key = t.slice(2);
    if (!KNOWN.has(key)) die(`不认识的参数：--${key}\n        可用参数：${[...KNOWN].map((k) => '--' + k).join(' ')}`);
    if (FLAGS.has(key)) { a[key] = true; continue; }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) die(`--${key} 后面缺值`);
    a[key] = val;
    i++;
  }
  return a;
}

const USAGE = `
用法：
  node engine/brief/build-brief.mjs \\
    --style docs/人设说明书-钱十七.md \\
    --factcard <事实卡.md> --facts A2,A5,B1,B3 \\
    --chain <事实链.md> --links 2,3,4 \\
    --angles docs/开头角度清单-xxx.md --angle C \\
    --stories docs/圣矾真实经历清单.md --story-ids 91,65 \\
    --experiences docs/闲鱼经验库/总表.json --exp-ids X-风控-014,X-心态-002 \\
    --pack ${DEFAULT_PACK} --episode <期标识> \\
    --opening-types "反常识揭晓,命令你现在做一个动作" --n-openings 5 \\
    --scenes "A,B,D,H,G,E:动作" --n-sayings 30 --n-voices 5 \\
    --authors "一鱼,陈陈,策主" \\
    --topic "闲鱼卖京东家政券" --topic-type 虚拟 \\
    --out <输出.md>

  --topic-type 虚拟|实物：决定用户校准词表里"实物专用"那一类要不要进配料包（虚拟选题才进）；
                          同时决定真人语料包剔掉"实物专用"（虚拟）还是"虚拟专用"（实物）。
  --words <词表.json>：用户校准词表路径，默认 ${DEFAULT_WORD_TABLE}。
  --pack <总表.json>：真人语料包；给了才出"真人开头结构 / 真人说法 / 原声"三节。
  --episode <期标识>：本篇期号或 filmId。用来轮换（用过的期里含本期或最近两期的不进）和做抽样种子；
                     定稿后 node engine/brief/mark-used.mjs 写回。
  --opening-types：切入大类名，逗号分隔（大类清单见 engine/corpus-pack/opening-types.json 或 docs/配料包规范.md）。
                   先按"切入大类"精确匹配；匹配不到再退到旧的"切入方式"包含匹配。--n-openings 默认 5。
  --scenes：场景字母，逗号分隔，E 可写 E:动作 指定子场景。--n-sayings 默认 30，按场景均分。
  --n-voices：原声条数，默认 5。
  --authors：说法层只取这些作者（可选）。
  --lean：写手版（不带值）。说明书只嵌 ${LEAN_STYLE_SECTIONS.join('、')} 八节；词表只嵌 ${LEAN_WORD_TYPES.join(' / ')}
          三类里用户点名 / 员工修改的"禁 → 换"两列；不嵌机器查表和事实链第五节；
          --n-openings / --n-sayings / --n-voices 默认改为 3 / 15 / 3（显式给了按给的）。目标四万字符以内。

路径相对仓库根或绝对皆可。缺哪个参数就跳过那一节，并在配料包末尾"缺项"里列出。
编号找不到会报错退出 1。
`;

// ───────────────────────── 主流程 ─────────────────────────

const args = parseArgs(process.argv.slice(2));
if (args.help) { process.stdout.write(USAGE); process.exit(0); }

const missing = [];   // 缺项说明
const stats = [];     // 给报告用的条数统计
const parts = [];     // 输出的各节

const topic = args.topic || '（未给 --topic）';
const today = new Date().toISOString().slice(0, 10);

const topicType = args['topic-type'] ? args['topic-type'].trim() : '';
if (topicType && !['虚拟', '实物'].includes(topicType)) die(`--topic-type 只能是 虚拟 或 实物，现在是：${topicType}`);
const checkCmd = `node engine/brief/check-words.mjs <稿件.txt> --topic-type ${topicType || '虚拟|实物'}`;
const leakCorpus = (args.pack || DEFAULT_PACK).replace(/\.json$/i, '.md');
const leakCmd = `node engine/leakage/check-source-leakage.mjs --corpus ${leakCorpus} --drafts <稿件.txt>`;
const episode = args.episode ? args.episode.trim() : '';
const lean = !!args.lean;

// ── 1. 抬头 ──────────────────────────────────────────────
const machineCheckLine = lean
  ? `- 交稿前跑 \`node engine/brief/check-all.mjs <稿件.txt> --rules docs/写稿规则.json --topic-type ${topicType || '虚拟|实物'}\`，它把词表、机器查表、连抄一起查，命中即打回。`
  : '- 交稿前先自己过一遍第十节那张机器查表，命中即打回。';
parts.push(`# 配料包 · ${topic}${lean ? '（写手版）' : ''}

> 生成时间：${today}　·　生成器：\`engine/brief/build-brief.mjs${lean ? ' --lean' : ''}\`
> **这份文件就是你写这篇稿要用的全部配料。不要再去翻别的大文件，也不要自己补配料。**${lean ? `
> 写手版：风格说明书只嵌 ${LEAN_STYLE_SECTIONS.length} 节、词表只嵌最常撞的三类、机器查表交给脚本。完整说明书见 \`${args.style || 'docs/人设说明书-钱十七.md'}\`，写手不用读。` : ''}

**写稿公式**

\`\`\`
一篇口播稿 = 项目事实（固定，第七节）+ 故事（第八节）+ 一批闲鱼经验（第九节）
风格固定（第二节说明书），开头角度按第三节走，措辞照第四、五、六节的真人语料走。
三个来源打架时的顺序：节奏听风格说明书，措辞听真人语料，事实听事实链。
\`\`\`

**落盘要求**

- 口播五分钟，一千三到一千五百个汉字。
- 一句一行。
- 单句不超过五十字。
- 全部用汉字数字，不出现阿拉伯数字、百分号、英文字母；零头取整加"多"（如"九千八百多件"）。
${machineCheckLine}
- 交稿前先跑 \`${checkCmd}\`，命中即改，报告里贴输出。第十一节那张"禁 → 换"表${lean ? '是它查的词表里写手最常撞的一部分' : '就是它查的词表'}，写的时候先别往上撞。
- 交稿前再跑 \`${leakCmd}\`，真人语料十二字连抄命中即打回。第四、五、六节是拿来学措辞的，不是拿来搬的。
`);

// ── 2. 风格说明书 ────────────────────────────────────────
let styleDoc = null;
if (args.style) {
  styleDoc = readFileOrDie(args.style, '风格说明书（--style）');
  if (lean) {
    const secs = [];
    for (const n of LEAN_STYLE_SECTIONS) {
      const sec = extractSection(styleDoc.lines, new RegExp(`^##\\s*${n}、`));
      if (!sec) die(`风格说明书里找不到第${n}节（"## ${n}、..."），--lean 要嵌它\n        文件：${styleDoc.abs}`);
      secs.push(sec);
    }
    const body = secs.join('\n\n');
    parts.push(`---

# 二、风格说明书（写手版：只嵌 ${LEAN_STYLE_SECTIONS.map((n) => `§${n}`).join(' ')}，照着写）

<!-- 来源：${args.style}　--lean -->

> 完整说明书见 \`${args.style}\`，写手不用读。下面八节是开头、每一块、词表、数字、句子、结尾、绝不做、红线，原样节选。

${body}`);
    stats.push(['风格说明书', `写手版嵌 ${LEAN_STYLE_SECTIONS.length} 节，${countHanzi(body)} 汉字（全文 ${countHanzi(styleDoc.text)}）`]);
  } else {
    parts.push(`---

# 二、风格说明书（原样全文，照着写）

<!-- 来源：${args.style} -->

${styleDoc.text.trim()}`);
    stats.push(['风格说明书', `全文嵌入，${countHanzi(styleDoc.text)} 汉字`]);
  }
} else {
  missing.push('**风格说明书**：没给 `--style`，第二节和第十节都空着。写手拿不到风格标准，等于白写。');
}

// ── 3. 开头 ──────────────────────────────────────────────
if (args.angles && args.angle) {
  const doc = readFileOrDie(args.angles, '开头角度清单（--angles）');
  const sec = extractAngle(doc.lines, args.angle.trim());
  if (!sec) {
    die(`开头角度清单里找不到「角度 ${args.angle}」这一节\n        文件：${doc.abs}\n        （标题格式应为 "## 角度 X · ..."）`);
  }
  parts.push(`---

# 三、开头（本篇用角度 ${args.angle.trim()}）

<!-- 来源：${args.angles} -->

> 开头示意是"可直接听"的示范，不是逐字稿。可以改词，但钩子类型、前三句要说清的三件事（卖什么、赚谁的钱、一单多少）、合同句、三块框架的顺序不许动。

${sec}`);
  stats.push(['开头角度', `角度 ${args.angle.trim()}，一节`]);
} else if (args.angles && !args.angle) {
  missing.push('**开头**：给了 `--angles` 但没给 `--angle`，不知道用哪个角度，第三节空着。');
} else if (!args.angles && args.angle) {
  missing.push('**开头**：给了 `--angle` 但没给 `--angles`，没有角度清单文件，第三节空着。');
} else {
  missing.push('**开头**：没给 `--angles` / `--angle`，第三节空着。开头得自己定角度。');
}

// ── 4/5/6. 真人语料包：开头结构 / 说法 / 原声 ─────────────
const usedIds = [];   // 本包选用的语料编号，文末列出给 mark-used 用
const packStats = []; // 给报告用：各层过滤掉多少、按什么原因
if (args.pack) {
  let pack;
  try { pack = loadPack(args.pack); } catch (e) { die(e.message); }
  const seed = episode || topic;
  const avoid = episode ? recentEpisodes(pack.data, episode) : null;
  const avoidNote = episode
    ? `轮换：避开"用过的期"含 ${[...avoid].join('、')} 的条目（本期 + 最近写回的两期）。`
    : '没给 `--episode`，不做轮换，抽样种子用选题名代替。';
  if (!episode) missing.push('**真人语料包**：没给 `--episode`，"用过的期"没法轮换，也没法写回。定稿前补上再生成一次。');
  if (!topicType) missing.push('**真人语料包**：没给 `--topic-type`，"实物专用 / 虚拟专用 / 反虚拟"没法剔，第四、五、六节照列了，写手自己看选题避开。');

  const nOpen = args['n-openings'] !== undefined ? Number(args['n-openings']) : (lean ? 3 : 5);
  const nSay = args['n-sayings'] !== undefined ? Number(args['n-sayings']) : (lean ? 15 : 30);
  const nVoice = args['n-voices'] !== undefined ? Number(args['n-voices']) : (lean ? 3 : 5);
  for (const [k, v] of [['--n-openings', nOpen], ['--n-sayings', nSay], ['--n-voices', nVoice]]) {
    if (!Number.isInteger(v) || v < 0) die(`${k} 要是非负整数，现在是：${v}`);
  }
  const authors = args.authors ? splitIds(args.authors) : [];
  const commonTail = `<!-- 来源：${args.pack}${topicType ? `　--topic-type ${topicType}` : ''}${episode ? `　--episode ${episode}` : ''} -->`;

  // 4. 真人开头结构
  if (args['opening-types']) {
    const types = splitIds(args['opening-types']);
    const r = pickOpenings(pack.data, { types, n: nOpen, seed, topicType, avoidEpisodes: avoid });
    usedIds.push(...r.picked.map((e) => e.id));
    const perType = r.perType.map((t) => `${t.type}：${t.mode}，候选 ${t.candidates}，取 ${t.got}`).join('；');
    if (r.unmatched.length) {
      const names = openingTypeNames(pack.data).filter((t) => t !== '待定');
      missing.push(`**真人开头结构**：这些名字既不是总表的切入大类、也在"切入方式"里包含匹配不到：${r.unmatched.join('、')}。总表现有的切入大类：${names.join('、') || '（总表没有切入大类字段，先跑 merge-pack.mjs）'}。`);
      process.stderr.write(`[build-brief] 提醒：切入大类 / 切入方式匹配不到：${r.unmatched.join('、')}\n`);
    }
    if (r.picked.length < nOpen) missing.push(`**真人开头结构**：要 ${nOpen} 条只抽到 ${r.picked.length} 条（候选不够或被过滤）。`);
    parts.push(`---

# 四、真人开头结构（学结构，不抄句）

${commonTail}

> 这些是别的闲鱼博主开头的**结构**，不是句子。学的是"每一步干什么、⓪ 放哪儿"，句子自己写。
> ${avoidNote}
> 匹配情况：${perType}。

${r.picked.length ? renderOpenings(r.picked) : '（一条都没抽到，见缺项。）'}

> **超过五步的要压缩。开头预算八句，含合同句和框架。**`);
    stats.push(['真人开头结构', `${r.picked.length} 条（要 ${nOpen}）；候选池 ${r.poolSize}，过滤：${droppedSummary(r.dropped)}`]);
    packStats.push(['openings', r.dropped, r.perType]);
  } else {
    missing.push('**真人开头结构**：给了 `--pack` 但没给 `--opening-types`，第四节空着。');
    parts.push(`---\n\n# 四、真人开头结构（学结构，不抄句）\n\n（没给 \`--opening-types\`，空着。）`);
  }

  // 5. 真人说法
  if (args.scenes) {
    const scenes = splitIds(args.scenes);
    const bad = scenes.map(parseSceneSpec).filter((s) => !/^[A-J]$/.test(s.scene));
    if (bad.length) die(`--scenes 只认 A–J（E 可写 E:子场景），看不懂：${bad.map((s) => s.label).join('、')}`);
    const r = pickSayings(pack.data, { scenes, n: nSay, seed, topicType, avoidEpisodes: avoid, authors });
    usedIds.push(...r.picked.map((e) => e.id));
    const perScene = r.perScene.map((s) => `${s.label} 候选 ${s.candidates} 配额 ${s.quota} 取 ${s.got}`).join('；');
    if (r.picked.length < nSay) missing.push(`**真人说法**：要 ${nSay} 条只抽到 ${r.picked.length} 条（候选不够或被过滤）。`);
    parts.push(`---

# 五、真人说法（措辞照走，内容换成我们的事实；整句搬会被连抄检查打回）

${commonTail}

> 学的是句式、口气、连接方式。**里面的品、数、人、事全换成第七节的事实和第八节的故事。**
> 亲历标记写"含作者亲历 / 本人亲历"的，事必须换成圣矾本期的；"纯措辞"的可以直接学句式。
> 交稿前跑 \`${leakCmd}\`，和总表连着十二个字一样就打回。
> ${avoidNote}${authors.length ? `\n> 作者限定：${authors.join('、')}。` : ''}
> 分配：${perScene}。

${renderSayings(r.picked, scenes.map((s) => parseSceneSpec(s).label))}`);
    stats.push(['真人说法', `${r.picked.length} 条（要 ${nSay}）；候选池 ${r.poolSize}，过滤：${droppedSummary(r.dropped)}`]);
    packStats.push(['sayings', r.dropped, r.perScene]);
  } else {
    missing.push('**真人说法**：给了 `--pack` 但没给 `--scenes`，第五节空着。');
    parts.push(`---\n\n# 五、真人说法（措辞照走，内容换成我们的事实；整句搬会被连抄检查打回）\n\n（没给 \`--scenes\`，空着。）`);
  }

  // 6. 原声
  {
    const r = pickVoices(pack.data, { n: nVoice, seed, topicType, avoidEpisodes: avoid });
    usedIds.push(...r.picked.map((e) => e.id));
    if (r.picked.length < nVoice) missing.push(`**原声**：要 ${nVoice} 条只抽到 ${r.picked.length} 条（候选不够或被过滤）。`);
    parts.push(`---

# 六、原声（学"引一句原话"的做法，原话本身不许当我们的）

${commonTail}

> 看的是别人怎么把买家、学员、家人的一句话嵌进稿里（先给情境、再引原话、再接自己一句）。
> **原话本身是别人的买家说的，不许写成我们的买家说的。** 标了"含收入数字"的只学引原话的形。
> ${avoidNote}

${r.picked.length ? renderVoices(r.picked) : '（一条都没抽到，见缺项。）'}`);
    stats.push(['原声', `${r.picked.length} 条（要 ${nVoice}）；候选池 ${r.poolSize}，过滤：${droppedSummary(r.dropped)}`]);
    packStats.push(['voices', r.dropped, null]);
  }
} else {
  missing.push('**真人语料包**：没给 `--pack`，第四、五、六节（真人开头结构 / 真人说法 / 原声）空着。写手没有措辞范本，容易写成 AI 腔。');
  parts.push(`---\n\n# 四、真人开头结构（学结构，不抄句）\n\n（没给 \`--pack\`，空着。）`);
  parts.push(`---\n\n# 五、真人说法（措辞照走，内容换成我们的事实；整句搬会被连抄检查打回）\n\n（没给 \`--pack\`，空着。）`);
  parts.push(`---\n\n# 六、原声（学"引一句原话"的做法，原话本身不许当我们的）\n\n（没给 \`--pack\`，空着。）`);
}

// ── 7. 项目事实 ──────────────────────────────────────────
const factParts = [];

// 4a/4b/4d/4e：事实链
if (args.chain) {
  const doc = readFileOrDie(args.chain, '事实链（--chain）');

  const sec2 = extractSection(doc.lines, /^##\s*二、/);
  if (!sec2) die(`事实链里找不到第二节（"## 二、..."）\n        文件：${doc.abs}`);
  factParts.push(`## 7.1　生意句三个数（原样）\n\n${sec2.replace(/^##\s*/, '### ')}`);
  stats.push(['事实链第二节', '生意句三个数，一节']);

  if (args.links) {
    const wanted = splitIds(args.links);
    const sec3Full = extractSection(doc.lines, /^##\s*三、/);
    if (!sec3Full) die(`事实链里找不到第三节链条环节表（"## 三、..."）\n        文件：${doc.abs}`);
    const sec3Lines = sec3Full.split('\n');
    const { hits, blocks } = pickTableRows(sec3Lines, wanted, (cell) => {
      const m = cell.match(/^\*\*(\d+)\./);
      return m ? m[1] : null;
    });
    assertAllFound(hits, wanted, `事实链第三节链条环节表（--links）`, doc.abs);
    const rendered = blocks
      .map((b) => `${b.header}\n${b.sep}\n${b.rows.join('\n')}`)
      .join('\n\n');
    factParts.push(`## 7.2　本篇要讲的链条环节（第 ${wanted.join('、')} 环）

> 规则：每条事实只挂一个环节。引某条事实，就只能用它在本表里这一格的用途。第四列"常见的写错"逐条对照。

${rendered}`);
    stats.push(['事实链环节', `${wanted.length} 环（${wanted.join('、')}）`]);
  } else {
    missing.push('**链条环节**：没给 `--links`，第 7.2 小节空着（不知道本篇讲哪几环）。');
  }
} else {
  missing.push('**事实链**：没给 `--chain`，缺"生意句三个数"、链条环节表、"不许入稿"、"一跳规则"四样。这是最硬的四样，别裸写。');
}

// 4c：事实卡
if (args.factcard && args.facts) {
  const doc = readFileOrDie(args.factcard, '事实卡（--factcard）');
  const wanted = splitIds(args.facts);
  const { hits, blocks } = pickTableRows(doc.lines, wanted, (cell) => {
    const m = cell.replace(/\*/g, '').match(/^([ABCSZ]\d+)$/);
    return m ? m[1] : null;
  });
  assertAllFound(hits, wanted, '事实卡（--facts）', doc.abs);
  factParts.push(`## 7.3　本篇能用的事实（${wanted.length} 条）

<!-- 来源：${args.factcard} -->

> A 段 = 实采，可直接引用，价格必须标采集时点（"九月初"这类说法）；B 段 = 用户本人那一期的口播/抽帧，历史经验，稿里说"我之前看的时候"，**不报期数**。
> **只能用这里列出的这几条。** 事实卡里别的编号本篇不给，就是不许写。

${renderBlocks(blocks)}`);
  stats.push(['事实卡', `${wanted.length} 条（${wanted.join('、')}）`]);
} else if (args.factcard && !args.facts) {
  missing.push('**事实卡**：给了 `--factcard` 但没给 `--facts`，第 7.3 小节空着。');
} else if (!args.factcard && args.facts) {
  missing.push('**事实卡**：给了 `--facts` 但没给 `--factcard`，没有事实卡文件，第 7.3 小节空着。');
} else {
  missing.push('**事实卡**：没给 `--factcard` / `--facts`，第 7.3 小节空着，稿里不该出现任何具体数字。');
}

// 4d/4e：不许入稿 + 一跳规则
if (args.chain) {
  const doc = readFileOrDie(args.chain, '事实链（--chain）');
  const sec4 = extractSection(doc.lines, /^##\s*四、/);
  if (!sec4) die(`事实链里找不到第四节"不许入稿"（"## 四、..."）\n        文件：${doc.abs}`);
  factParts.push(`## 7.4　不许入稿（原样，逐条对）\n\n${sec4.replace(/^##\s*/, '### ')}`);
  if (lean) {
    factParts.push(`## 7.5　允许的推理跳数\n\n（写手版不嵌。规矩一句话：只用 7.3 每条事实写明用途的那一跳，不往前推第二步；要看全文见 \`${args.chain}\` 第五节。）`);
    stats.push(['事实链第四节', '不许入稿，一节（--lean 不嵌第五节一跳规则）']);
  } else {
    const sec5 = extractSection(doc.lines, /^##\s*五、/);
    if (!sec5) die(`事实链里找不到第五节"允许的推理跳数"（"## 五、..."）\n        文件：${doc.abs}`);
    factParts.push(`## 7.5　允许的推理跳数（原样，写完自己走一遍）\n\n${sec5.replace(/^##\s*/, '### ')}`);
    stats.push(['事实链第四/五节', '不许入稿 + 一跳规则，各一节']);
  }
}

parts.push(`---

# 七、项目事实（固定部分，每篇都一样）

${factParts.length ? factParts.join('\n\n') : '（这一节整个空着，见第十二节缺项。）'}`);

// ── 8. 故事 ──────────────────────────────────────────────
if (args.stories && args['story-ids']) {
  const doc = readFileOrDie(args.stories, '经历清单（--stories）');
  const wanted = splitIds(args['story-ids']);
  const { hits, blocks } = pickTableRows(doc.lines, wanted, (cell) => {
    const m = cell.replace(/\*/g, '').match(/^(\d+)$/);
    return m ? m[1] : null;
  });
  assertAllFound(hits, wanted, '经历清单（--story-ids）', doc.abs);
  const dupNote = wanted
    .filter((id) => hits.get(id).length > 1)
    .map((id) => `${id}（${hits.get(id).length} 处）`);
  parts.push(`---

# 八、故事（本篇用 ${wanted.length} 条）

<!-- 来源：${args.stories} -->

> **本人经历，写成"我"，只用原话的意思，不加工、不演绎成"我以为"。**
> 不给它加心理活动、不给它补前因后果、不把它写得比原话更惨或更好。末列写 ⚠️ 的按末列说明剥掉数字再用。
${dupNote.length ? `>\n> （编号在原文件里出现多处，下面都列出来了：${dupNote.join('、')}）\n` : ''}
${renderBlocks(blocks)}`);
  stats.push(['故事', `${wanted.length} 个编号（${wanted.join('、')}），命中 ${[...hits.values()].reduce((a, b) => a + b.length, 0)} 行`]);
} else if (args.stories || args['story-ids']) {
  missing.push('**故事**：`--stories` 和 `--story-ids` 要一起给，只给了一半，第八节空着。');
} else {
  missing.push('**故事**：没给 `--stories` / `--story-ids`，第八节空着。没有故事就只剩干条，稿会很硬。');
}

// ── 9. 闲鱼经验 ──────────────────────────────────────────
if (args.experiences && args['exp-ids']) {
  const p = resolvePath(args.experiences);
  if (!fs.existsSync(p)) die(`闲鱼经验总表（--experiences）文件不存在：${p}`);
  let db;
  try {
    db = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    die(`闲鱼经验总表不是合法 JSON：${p}（${e.message}）`);
  }
  if (!Array.isArray(db)) die(`闲鱼经验总表顶层应该是数组：${p}`);
  const wanted = splitIds(args['exp-ids']);
  const byId = new Map(db.map((x) => [String(x.id), x]));
  const notFound = wanted.filter((id) => !byId.has(id));
  if (notFound.length) {
    die(`闲鱼经验总表里找不到这些编号：${notFound.join('、')}\n        文件：${p}\n        （不允许静默漏配料，请核对编号后重跑）`);
  }
  const rows = wanted.map((id) => {
    const e = byId.get(id);
    const bei = (e.备注 || '').trim();
    return `| ${e.id} | ${(e.经验 || '').trim()} | ${e.环节 || ''} · ${e.类型 || ''} | ${e.支持数 ?? ''} | ${e.标记 || ''} | ${bei || '—'} |`;
  });
  const flagged = wanted.filter((id) => /⚠️|🚫/.test(byId.get(id).标记 || ''));
  parts.push(`---

# 九、闲鱼经验（本篇用 ${wanted.length} 条）

<!-- 来源：${args.experiences} -->

> **同行经验，只能写成"有人这么做 / 行业里一般这么看 / 做闲鱼的都知道"，不写成亲历，不带收入数字。**
> ⚠️ 的按"备注"那一列剥掉数字再用；🚫 的不用。
> "支持数"是多少份原始资料撑着这条，数越大越敢往稿里写。

| 编号 | 经验 | 环节 · 类型 | 支持数 | 标记 | 备注（怎么剥） |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}${flagged.length ? `\n\n**要剥的**：${flagged.join('、')}——按上表"备注"列处理，别原样搬。` : ''}`);
  stats.push(['闲鱼经验', `${wanted.length} 条（${wanted.join('、')}），其中带标记 ${flagged.length} 条`]);
} else if (args.experiences || args['exp-ids']) {
  missing.push('**闲鱼经验**：`--experiences` 和 `--exp-ids` 要一起给，只给了一半，第九节空着。');
} else {
  missing.push('**闲鱼经验**：没给 `--experiences` / `--exp-ids`，第九节空着。没有同行经验，正文会薄。');
}

// ── 10. 交稿前机器查 ──────────────────────────────────────
if (styleDoc && lean) {
  parts.push(`---

# 十、交稿前机器查一遍

（写手版不嵌这张表。交稿前跑抬头里那条 \`check-all.mjs\`，它按 \`docs/写稿规则.json\` 把压缩词、书面词、空悬念、免责句、阿拉伯数字全查一遍，命中即打回，自己勾的不算。）`);
  stats.push(['机器查表', '--lean 不嵌（交给 check-all.mjs）']);
} else if (styleDoc) {
  const sec = extractSection(styleDoc.lines, /^##\s*十八、/);
  if (!sec) die(`风格说明书里找不到"交稿前机器查一遍"那一节（"## 十八、..."）\n        文件：${styleDoc.abs}`);
  parts.push(`---

# 十、交稿前机器查一遍（重复列一次，写手最容易漏这节）

${sec.replace(/^##\s*/, '## ')}

> 这一节上面第二节里已经有一份，这里再列一次是因为写手总漏。**交稿前用程序跑，命中即打回，自己勾的不算。**`);
  stats.push(['机器查表', '一节（说明书 §十八）']);
}

// ── 11. 用户校准词表 ──────────────────────────────────────
{
  let wt;
  try { wt = loadWordTable(args.words || DEFAULT_WORD_TABLE); } catch (e) { die(e.message); }
  const filtered = filterByTopic(wt.entries, topicType);
  const c = countBySource(filtered);
  const topicNote = topicType
    ? `本篇是**${topicType}**选题${topicType === '虚拟' ? '，"实物专用"那一类生效：退货、运费、快递这些词一个都不许出现（"退款"可以）' : '，"实物专用"那一类已剔掉'}。`
    : '没给 `--topic-type`，"实物专用"那一类照列但没法替你判断生不生效，写手自己看选题定。';
  if (lean) {
    const leanRows = filtered.filter((e) => LEAN_WORD_TYPES.includes(e.类型) && USER_WORD_SOURCES.includes(e.录入));
    const esc = (s) => String(s ?? '').replace(/\|/g, '｜').replace(/\r?\n/g, ' ');
    const table = leanRows.length
      ? ['| 禁 | 换成 |', '| --- | --- |', ...leanRows.map((r) => `| ${esc(r.位置 === '第一行' ? `${r.禁}（只查第一句）` : r.禁)} | ${esc(r.换)} |`)].join('\n')
      : '（这三类里没有用户点名 / 员工修改的条目。）';
    parts.push(`---

# 十一、用户校准词表（写手版：禁 → 换）

<!-- 来源：${args.words || DEFAULT_WORD_TABLE}${topicType ? `　--topic-type ${topicType}` : ''}　--lean -->

> 全表 ${c.total} 条交稿时 \`check-words.mjs\` 全查；这里只列写手最常撞的三类（${LEAN_WORD_TYPES.join(' / ')}）里用户亲口纠正或员工改过的 ${leanRows.length} 条。**左列不许出现，右列是该怎么说。**
> ${topicNote}

${table}`);
    stats.push(['用户校准词表', `写手版 ${leanRows.length} 条（全表 ${c.total}：用户点名 ${c.users} / 员工修改 ${c.staff} / 预防性 ${c.preventive}）${topicType ? `，选题类型 ${topicType}` : '，未给 --topic-type'}`]);
    if (!topicType) missing.push('**选题类型**：没给 `--topic-type`，交稿前跑 check-words 时自己补 `--topic-type 虚拟|实物`。');
  } else {
  parts.push(`---

# 十一、用户校准词表（禁 → 换）

<!-- 来源：${args.words || DEFAULT_WORD_TABLE}${topicType ? `　--topic-type ${topicType}` : ''} -->

> 这张表每一条都是用户对稿子的一次字句纠正（"用户点名"），或主线程从同一病根推出来的同类词（"预防性"）。**左列的词不许出现，右列是稿里该怎么说。**
> ${topicNote}
> 交稿前跑 \`${checkCmd}\`，命中即改，报告里贴输出。本表 ${c.total} 条（用户点名 ${c.users} / 员工修改 ${c.staff} / 预防性 ${c.preventive}）。

${renderWordTable(filtered, { topicType })}`);
  stats.push(['用户校准词表', `${c.total} 条（用户点名 ${c.users} / 员工修改 ${c.staff} / 预防性 ${c.preventive}）${topicType ? `，选题类型 ${topicType}` : '，未给 --topic-type'}`]);
  if (!topicType) missing.push('**选题类型**：没给 `--topic-type`，第十一节"实物专用"那一类没法过滤，交稿前跑 check-words 时自己补 `--topic-type 虚拟|实物`。');
  }
}

// ── 12. 缺项 ──────────────────────────────────────────────
parts.push(`---

# 十二、缺项

${missing.length
    ? missing.map((m) => `- ${m}`).join('\n')
    : '（无。这份配料包是齐的：风格、开头、真人语料三节、事实、故事、经验、机器查表、用户校准词表都在。）'}`);

// ── 13. 本包选用的语料编号 ──────────────────────────────
if (args.pack) {
  const markCmd = `node engine/brief/mark-used.mjs --pack ${args.pack} --episode ${episode || '<期标识>'} --ids ${usedIds.length ? usedIds.join(',') : '<编号>'}`;
  parts.push(`---

# 十三、本包选用的语料编号

> 定稿后跑下面这条，把本期写回这些条目的"用过的期"（只写回真正用上的也行，把没用的编号删掉再跑）：
>
> \`${markCmd}\`

${usedIds.length ? usedIds.join(',') : '（一条都没抽到）'}`);
  stats.push(['本包选用的语料编号', `${usedIds.length} 条`]);
}

// ───────────────────────── 落盘 ─────────────────────────

const output = parts.join('\n\n') + '\n';

if (args.out) {
  const outAbs = resolvePath(args.out);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, output, 'utf8');
  const hanzi = countHanzi(output);
  process.stdout.write(`[build-brief] 已写出：${outAbs}${lean ? '　（--lean 写手版）' : ''}\n`);
  process.stdout.write(`[build-brief] 汉字数：${hanzi}　总字符：${output.length}${lean && output.length > 40000 ? '　⚠️ 写手版超过四万字符' : ''}\n`);
  for (const [k, v] of stats) process.stdout.write(`[build-brief]   ${k}：${v}\n`);
  for (const [layer, dropped, detail] of packStats) {
    process.stdout.write(`[build-brief]   语料包 ${layer} 过滤：${droppedSummary(dropped)}\n`);
    if (detail) for (const d of detail) process.stdout.write(`[build-brief]     ${JSON.stringify(d)}\n`);
  }
  process.stdout.write(`[build-brief] 缺项：${missing.length ? missing.length + ' 条（见配料包第十二节）' : '无'}\n`);
} else {
  process.stdout.write(output);
}
