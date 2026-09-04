// 提示词组装。把风格 DNA 全文 + 信任配方 + 去 AI 味规则 + 学结构不学词 + 受众锁 +
// 事实卡全文 + 工单 points/assetsHint 全部拼进系统提示，并写死红线与招牌话术硬拦截名单。
import { readFileSync, existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { resolveStyle, locateFactCard, readRepoDoc, REPO_ROOT, LENGTH_PRESETS, DEFAULT_LENGTH_PRESET } from './inputs.mjs';
import { loadHints } from '../../engine/naturalness/check-lexicon.mjs';
import { DEVICE_RULES, buildUsedDeviceList } from '../../engine/variation/check-devices.mjs';
import { AI_FLAVOR_RULES, fillerWordsFor } from '../../engine/naturalness/check-ai-flavor.mjs';
import { STYLE_FLOOR_RULES } from '../../engine/naturalness/check-style-floor.mjs';

// 口播词域词表：唯一来源是 engine/naturalness/lexicon-hints.json（block/warn 两级 + 口语替换候选）。
// gates.mjs 的门禁与本文件的提示词清单都从这里读，禁止在别处另抄一份。
export function loadWrittenWords(hintsObj) {
  const h = hintsObj || loadHints();
  const ww = h.writtenWords || { block: [], warn: [] };
  const hints = h.hints || {};
  const spokenFor = (w) => (hints[w] && hints[w].length ? hints[w] : []);
  return {
    block: (ww.block || []).map((w) => ({ word: w, level: 'block', spoken: spokenFor(w) })),
    warn: (ww.warn || []).map((w) => ({ word: w, level: 'warn', spoken: spokenFor(w) })),
    all: [...(ww.block || []), ...(ww.warn || [])].map((w) => ({
      word: w, level: (ww.block || []).includes(w) ? 'block' : 'warn', spoken: spokenFor(w)
    }))
  };
}

// ============================================================================
// 范文段（2026-09-04 路线：提示词改范文优先）
//
// 为什么要有这一节（DECISIONS.md 2026-09-04 第三条）：连续三轮「没有钱十七的味」，每一轮
// 我们都用「再加一条规则」回应，写法本身没换。模型模仿**范文**远强于遵守几十条抽象规则；
// 语料只有 2.3 万字，整段放得下。所以本节**排在所有负面清单/规则清单之前**（紧跟任务描述），
// 后面那些「少做什么」的清单全部后置、内容一个字不改。
//
// 三类范文：
//   1. 这个 IP 的**同体裁原文**（authoritative corpus 按篇切分后，按工单选 3–5 期）；
//   2. 用户明确说过「还可以」的参照稿（mac 微信多开，在 remotion 仓库里）；
//   3. 用户明确说过「差不多了」的餐饮券短稿（本仓库 ips/ 下）。
//
// 路径全部走下面的常量 / 环境变量；任何一份读不到就跳过它并记一条中文说明，绝不抛错。
// ============================================================================

// 每份范文源都可以用环境变量顶掉路径（测试与换机用）。relative=true 表示相对仓库根。
export const STYLE_EXAMPLE_SOURCES = {
  钱十七: {
    corpus: {
      label: '钱十七权威语料（12 期整段原文）',
      env: 'STYLE_EXAMPLE_CORPUS',
      relative: true,
      path: 'research-runs/2026-07-27_codex代安装_refresh/style-application-20260730/qian17-authoritative-corpus.txt'
    },
    approved: [
      {
        key: 'jingdong',
        label: '京东家政长视频稿（用户 2026-09-04 定稿）',
        env: 'STYLE_EXAMPLE_JINGDONG_SCRIPT',
        relative: false,
        path: 'D:/项目仓库/remotion视频制作/ips/xianyu-fanshen/films/jingdong-jiazheng/copy/qian17/script.txt',
        note: '用户 2026-09-04 定稿（原话「算是可以吧」）：教程文体 + 六层 + 盲测四改 + 口语还原，钱按用户本人算法（单利约十块 × 店铺单量往下折）。这是长稿的达标线。'
      },
      {
        key: 'mac',
        label: 'mac 微信多开长视频稿（用户原话「还可以」）',
        env: 'STYLE_EXAMPLE_MAC_SCRIPT',
        relative: false,
        path: 'D:/项目仓库/remotion视频制作/ips/xianyu-fanshen/films/mac-weixin-duokai/script.txt',
        note: '这是我们自己写、用户读完说「还可以」的一篇，是目前的达标线。'
      },
      {
        key: 'canyinquan',
        label: '闲鱼餐饮券短视频稿（用户原话「差不多了」）',
        env: 'STYLE_EXAMPLE_CANYINQUAN',
        relative: true,
        path: 'ips/钱十七/outputs/闲鱼餐饮券-短视频版.md',
        note: '短稿的达标线。文件首行的 # 标题只是文件名，不是口播。'
      }
    ]
  }
};

// 语料按篇切分的边界（这三条是本文件唯一的切分口径，改了要同步改 engine/tests 的用例）：
//   A. 编号行：整行是「3.」「4、」这类 1–2 位数字加句点/顿号（后面可跟标题），且整行不超过 TITLE_MAX 字；
//   B. 抬头行：整行以「钱十七-」开头（语料里的分册抬头），且整行不超过 TITLE_MAX 字；
//   C. 裸标题行：整行不超过 TITLE_MAX 字，且**紧接的下一非空行**长度 ≥ BLOB_MIN（这一期整篇挤在一行里）。
// 三条都不命中的行一律算正文。空行忽略。一条边界都不命中时，整份语料当成一期返回。
const EPISODE_TITLE_MAX = 120;
// 800 字是「整期挤在一行」与「普通正文段」之间的安全带：语料里最长的正文段 285 字，
// 最短的整期一行 1140 字，中间没有别的东西，随便怎么挪都不会切错。
const EPISODE_BLOB_MIN = 800;
const EPISODE_NUM_MARKER = /^\d{1,2}\s*[.、．]\s*(.*)$/;
const EPISODE_HEAD_MARKER = /^钱十七\s*[-－—]\s*(.+)$/;

export function splitCorpusEpisodes(text) {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > EPISODE_TITLE_MAX) continue; // 正文行一定超长，先排掉，省得数字开头的正文被误判
    let title = null;
    const num = EPISODE_NUM_MARKER.exec(line);
    const head = EPISODE_HEAD_MARKER.exec(line);
    if (num) title = num[1].trim();
    else if (head) title = head[1].trim();
    else if (lines[i + 1] && lines[i + 1].length >= EPISODE_BLOB_MIN) title = line;
    if (title !== null) starts.push({ at: i, title });
  }
  if (!starts.length) {
    const body = lines.join('\n');
    return [{ index: 0, title: '（整份语料未切分）', body, chars: body.length, opening: body.slice(0, 400) }];
  }

  const eps = [];
  for (let k = 0; k < starts.length; k++) {
    const from = starts[k].at + 1;
    const to = k + 1 < starts.length ? starts[k + 1].at : lines.length;
    const body = lines.slice(from, to).join('\n');
    if (!body) continue;
    const title = starts[k].title || body.slice(0, 40);
    eps.push({ index: eps.length, title, body, chars: body.length, opening: body.slice(0, 400) });
  }
  return eps;
}

// 语料期号目录。probe 是这一期独有的一小段原文，用它认期比用下标认期稳（语料重排也不会错位）。
// genre='tutorial' 是教程体，'list' 是纯清单体（39 货源 / 月份表）——清单体只在工单提示为清单型时进池。
// preferred=true 的四期是默认池：卖虚拟·状元笔记 / 考研资料 / 减肥监督 / AI 壁纸。
export const QIAN17_EPISODE_CATALOG = [
  { key: 'yanghao', label: '养号｜五分钟讲透闲鱼无货源怎么养号', genre: 'tutorial', probe: '芝麻信用分共分为五个等级' },
  { key: 'xuanpin', label: '选品｜六做六不做', genre: 'tutorial', probe: '不做莆田货' },
  { key: 'xuni-zhuangyuan', label: '卖虚拟·状元笔记', genre: 'tutorial', probe: '状元笔记', preferred: true },
  { key: 'jianfei', label: '减肥监督', genre: 'tutorial', probe: '减肥监督', preferred: true },
  { key: 'kaoyan', label: '考研资料', genre: 'tutorial', probe: '拆解的虚拟产品是考研资料', preferred: true },
  { key: 'genzong', label: '选品跟踪｜别人的产品红到发紫', genre: 'tutorial', probe: '别人的产品红到发紫' },
  { key: 'xuni-10qi', label: '虚拟资源·十期合集', genre: 'tutorial', probe: '超级好玩的副业10期' },
  { key: 'huoyuan39', label: '39 个神仙货源（纯清单体）', genre: 'list', probe: '39个神仙货源' },
  { key: 'yuefen', label: '月份选品表（纯清单体）', genre: 'list', probe: '月份选品表' },
  { key: 'ai-bizhi', label: 'AI 壁纸', genre: 'tutorial', probe: '19999张4K壁纸', preferred: true },
  { key: 'xiaoqinglv', label: '小情侣卖虚拟一年四五十万', genre: 'tutorial', probe: '一年四五十万' }
];

// 把切出来的期对上目录（认不出来的期不进池，避免拿一段来路不明的文本当范文）。
// 一期只能对上一条目录（先到先得），免得切分出岔子时同一段文本被当成两期塞两遍。
export function tagCorpusEpisodes(episodes, catalog = QIAN17_EPISODE_CATALOG) {
  const out = [];
  const taken = new Set();
  catalog.forEach((entry, order) => {
    const hit = episodes.find((e) => !taken.has(e.index) && e.body.includes(entry.probe));
    if (!hit) return;
    taken.add(hit.index);
    out.push({ ...hit, ...entry, catalogOrder: order });
  });
  return out;
}

// 工单是不是「清单型」。命中即把纯清单体两期也放进候选池。
const LIST_TYPE_HINTS = ['清单', '盘点', '榜单', '合集', '汇总', '大全', '目录', '一次性', '整理了', '列表', '表格', '排行', '一览'];
export function isListTypeOrder(order = {}) {
  const hay = [order.topic || '', ...(order.points || []), order.assetsHint || ''].join(' ');
  if (LIST_TYPE_HINTS.some((h) => hay.includes(h))) return true;
  return /\d+\s*(个|条|种|类|款|家)/.test(hay) && /(货源|渠道|工具|网站|方法|品类|平台|资源)/.test(hay);
}

// 词重合打分用的二字切片。中文没现成分词就用二元切片，够用且不引依赖（jieba 在 python 侧，这里不调）。
const STOP_BIGRAM = new Set([
  '我们', '大家', '这个', '那个', '可以', '就是', '什么', '怎么', '的话', '一个',
  '没有', '不是', '如果', '然后', '所以', '一下', '这样', '这些', '知道', '很多'
]);
export function orderKeywordGrams(order = {}) {
  const raw = [order.topic || '', ...(order.points || [])].join(' ');
  const grams = new Set();
  for (const tok of raw.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, ' ').split(/\s+/).filter(Boolean)) {
    if (/^[a-zA-Z0-9]+$/.test(tok)) { if (tok.length >= 2) grams.add(tok.toLowerCase()); continue; }
    for (let i = 0; i + 2 <= tok.length; i++) {
      const g = tok.slice(i, i + 2);
      if (!STOP_BIGRAM.has(g)) grams.add(g);
    }
  }
  return grams;
}

// 选期：候选池 = 默认四期教程体（+ 清单型工单时再加两期清单体），按工单词与各期首段的重合数排序取前 N。
// 打平时按目录顺序，保证同一工单每次选出来的是同几期（提示词要可复现）。
export const DEFAULT_STYLE_EXAMPLE_COUNT = 3;
export const MAX_STYLE_EXAMPLE_COUNT = 5;
export function styleExampleCount(env = process.env) {
  const n = Number.parseInt((env.STYLE_EXAMPLE_COUNT || '').trim(), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_STYLE_EXAMPLE_COUNT;
  return Math.min(n, MAX_STYLE_EXAMPLE_COUNT);
}

export function pickCorpusEpisodes(tagged, order = {}, opts = {}) {
  const count = opts.count || styleExampleCount(opts.env || process.env);
  const listType = opts.listType === undefined ? isListTypeOrder(order) : opts.listType;
  let pool = tagged.filter((e) => e.preferred);
  if (listType) pool = pool.concat(tagged.filter((e) => e.genre === 'list'));
  if (!pool.length) pool = tagged.slice();
  const grams = orderKeywordGrams(order);
  const scored = pool.map((e) => {
    let score = 0;
    for (const g of grams) if (e.opening.includes(g)) score++;
    return { ...e, score };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.catalogOrder - b.catalogOrder));
  return { picked: scored.slice(0, count), listType, count, poolSize: pool.length };
}

// 范文里的 Markdown 标题行会在系统提示里变成假的一级小节，把提纲搅乱（餐饮券短稿首行就是 # 标题）。
// 只剥掉行首的 # 号，正文一个字不动。
export function sanitizeExampleText(text) {
  return String(text || '').replace(/^\s{0,3}#{1,6}\s+/gm, '');
}

// 读一份范文源；读不到就返回 null（调用方记一条中文说明后跳过）。绝不抛错。
function readExampleFile(src, env) {
  const raw = (src.env && env[src.env] && env[src.env].trim()) || src.path;
  const abs = src.relative && !isAbsolute(raw) ? join(REPO_ROOT, raw) : raw;
  try {
    if (!existsSync(abs)) return { abs, text: null };
    const text = readFileSync(abs, 'utf8');
    return { abs, text: text.trim() ? text : null };
  } catch {
    return { abs, text: null };
  }
}

// 组装本期要注入的范文清单。返回 { examples, notes, listType }；examples 为空时不注入范文段。
export function loadStyleExamples(order = {}, ipName, opts = {}) {
  const env = opts.env || process.env;
  const sources = (opts.sources || STYLE_EXAMPLE_SOURCES)[ipName];
  const notes = [];
  const examples = [];
  if (!sources) {
    return { examples, notes: [`「${ipName}」没配范文源，本期不注入范文段（只有配了原文语料的 IP 才走范文优先）。`], listType: false };
  }

  let listType = false;
  if (sources.corpus) {
    const { abs, text } = readExampleFile(sources.corpus, env);
    if (!text) {
      notes.push(`语料读不到，已跳过同体裁原文：${abs}`);
    } else {
      const tagged = tagCorpusEpisodes(splitCorpusEpisodes(text), opts.catalog || QIAN17_EPISODE_CATALOG);
      if (!tagged.length) {
        notes.push('语料切分后一期都没对上目录，已跳过同体裁原文（切分口径或语料变了，去 splitCorpusEpisodes 的注释核对）。');
      } else {
        const r = pickCorpusEpisodes(tagged, order, opts);
        listType = r.listType;
        for (const e of r.picked) {
          examples.push({ kind: 'corpus', key: e.key, label: e.label, title: e.title, chars: e.chars, score: e.score, text: e.body });
        }
      }
    }
  }

  for (const src of sources.approved || []) {
    const { abs, text } = readExampleFile(src, env);
    if (!text) { notes.push(`参照稿读不到，已跳过：${abs}`); continue; }
    const body = sanitizeExampleText(text).trim();
    examples.push({ kind: 'approved', key: src.key, label: src.label, title: src.label, chars: body.length, note: src.note || '', text: body });
  }

  return { examples, notes, listType };
}

// 范文段正文。这一节的指令文字是本轮的核心产出，改它等于改路线，改前先看 DECISIONS.md 2026-09-04。
export function buildStyleExampleSection(examples = [], notes = [], ipName = '') {
  if (!examples.length) {
    return '';
  }
  const corpus = examples.filter((e) => e.kind === 'corpus');
  const approved = examples.filter((e) => e.kind === 'approved');
  const block = (e, i) => `### 范文 ${i + 1}｜${e.label}（约 ${e.chars} 字）\n${e.note ? `\n> ${e.note}\n` : ''}\n${e.text}\n`;
  const parts = [];

  parts.push(`# 范文（先读这一节 · 这是本次唯一的语感来源）

下面是${ipName ? `「${ipName}」` : '这个 IP'}**本人的整段原文**，以及我们自己写过、**用户读完点过头**的几篇稿。
后面还有几十条「少做什么」的规则清单，那些是护栏；**这一节才是你要模仿的东西**。护栏管的是别写砸，范文管的是写得像。

怎么用（三条，硬要求）：

1. **动笔前从头到尾通读一遍范文。** 不是扫一眼标题，是真的读完，读到你脑子里有这个人说话的调子。
2. **每写一块之前，回头再读一遍最像那一块的那一段。** 要写开场就回去读范文的开场，要写讲步骤就回去读范文讲步骤那几段，要写收口就回去读收口。凭记忆写会越写越像通用 AI，回读一次就拉回来一次。
3. **学的是说话方式，不是句子。** 学他怎么起头、怎么把一件事一口气说完、怎么从这一块领到下一块、怎么把价钱算成一笔钱、怎么一边讲一边催、怎么把话说死。

**红线：一句都不许抄。** 与范文**连续 12 个字以上雷同即为废稿**（这道门还在，没撤）。换几个名词、把语序倒一下再交，同样算抄。范文里的具体商品、具体价格、具体渠道、具体人名一律**不许搬进本期稿子**——本期的事实只能来自后面的事实卡。范文里的招牌原句（点赞收藏那几句）也在硬拦截名单里，形制可学、原句不许出现。

范文里如果出现 Markdown 标题行、文件名、编号抬头，那些是文件格式，不是口播，不要学。`);

  if (corpus.length) {
    parts.push(`## 一、${ipName || '本人'}原文（同体裁，本期挑了 ${corpus.length} 期）\n\n这几期是按本期选题跟各期开头的词重合度挑的，最像本期要写的东西。**这是他本人的原话，不是我们整理过的版本。**\n\n${corpus.map(block).join('\n')}`);
  }
  if (approved.length) {
    parts.push(`## 二、用户点过头的稿（我们自己写的，达标线在这里）\n\n这几篇不是原文，是我们写的、**用户读完明确说过还行或定稿**的稿子。它们证明了这个调子是够得着的。写不出上面原文那种劲头时，至少要写到这几篇的水平。\n\n${approved.map((e, i) => block(e, corpus.length + i)).join('\n')}`);
  }
  if (notes.length) {
    parts.push(`## 范文加载说明\n\n${notes.map((n) => `- ${n}`).join('\n')}`);
  }
  parts.push(`**读完了再往下看。** 下面开始是规则与护栏；规则和范文冲突时，先按范文的说话方式写，再回头用规则检查有没有踩线。`);
  return parts.join('\n\n');
}

// 新系列铁律（硬规则，与 §叙述者身份 同级）。来源：用户 2026-09-03 原话
// 「不要默认之前写过，你需要重新写，你引用的都不是一个系列的」。
export function buildNewSeriesSection(rules = DEVICE_RULES) {
  const labels = (rules.seriesReference || []).map((r) => `「${r.label}」`).join('、');
  return `# 新系列铁律（硬规则 · 违反即打回重写）

- **这篇是一个全新系列的第一次讲述。在这个系列里，你没有"上一期"。** 稿子里绝不许出现任何指向旧系列的话：${labels}。
- 具体禁止：期号与计号（第N期 / 第N计）、系列名（闲鱼虚拟搞钱一百零八计 / 108计）、"上次讲过 / 上次拆过 / 我当时录 / 那会儿录 / 那一期 / 上一期 / 下一计 / 私信我N计 / 那期画面里"。
- **亲历照讲，只是不许挂期号。** 事实卡里标了真素材的亲历，用"我自己做过 / 我之前试过 / 我踩过这个坑 / 我买过一次"来讲；把"我第38期拆过这个题"改写成"这个题我自己做过一轮"。
- 素材视频里能看到的画面照用，但不许说成"那一期的画面"——说"这张图是我自己录的"或直接描述画面内容。
- 收口不许说"下一计见""咱们第N计再聊"，用"下期见""咱们下期接着拆这一关"。`;
}

// 口播词域（硬规则）。清单与替换候选来自 lexicon-hints.json，与门禁同源。
export function buildSpokenLexiconSection(writtenWords) {
  const ww = writtenWords || loadWrittenWords();
  const line = (e) => `  - ${e.word} → ${e.spoken.length ? e.spoken.join(' / ') : '（换成口语说法）'}`;
  return `# 口播词域（硬规则 · block 级出现即打回重写）

你写的是**一个人对着镜头说的话**，不是分析报告、不是财报注解。下面这些是书面/报告词，念出来立刻露馅。用户原话：**「『落在』，人类没有用这个词来写文章的」**。

- **禁用（出现即打回，必须换成右边的口语说法）**：
${ww.block.map(line).join('\n')}
- **少用（出现会进终审报告，能换就换）**：
${ww.warn.map(line).join('\n')}
- 判断办法：把这句话念出来，想象你在跟一个坐对面的朋友说。凡是"只会在 PPT 和研报里出现"的词，一律换掉。
- 同理禁止：把口语连词写成书面连词（"因此/故而/综上/由此可见"），把动作写成名词（"进行验证"→"去验一下"）。`;
}

// 装置轮换（硬规则）。装置每条给 ≥3 种表面写法；scope=banned 的装置（受众分流三类人）单独列「停用」段。
// usedList 为「近期已用句式清单」（从历史稿池提取，拿不到时给出为什么拿不到）。
export function buildDeviceRotationSection(usedList = [], poolNote = '', rules = DEVICE_RULES) {
  const banned = (rules.devices || []).filter((d) => d.scope === 'banned');
  const active = (rules.devices || []).filter((d) => d.scope !== 'banned');

  const devLines = active.map((d) => {
    const head = `### ${d.name}${d.mandatory ? '（必留装置：' + d.trustRule + '）' : '（可选手法，不是必用）'}`;
    const rot = (d.rotations || []).map((r, i) => `  ${i + 1}. ${r}`).join('\n');
    const scope = d.scope === 'device'
      ? '  轮换口径：**整个手法**近期用过就别再用，换下面的替代写法。'
      : '  轮换口径：装置本身每期都要在，但**同一句表面写法不得连着两期出现**，从下面挑一种没用过的说法。';
    // mustChoose：这一组的菜单里没有「本期可以不做」的出口。2026-09-03 删掉了四个这样的出口
    // （诊断 §3 R6/R7）——轮换的是**说法**，不是**做不做**；三个位置各留一个出口，整层就空了。
    const must = d.mustChoose
      ? `\n  **这一组必须选一种，没有「本期不做」的出口。**${d.slots ? '固定位置：' + d.slots.join('；') + '。' : ''}`
      : '';
    return `${head}\n${scope}${must}\n${rot}`;
  }).join('\n\n');

  const sigRep = (rules.signatureReplacements || []).map((s) => {
    const alt = s.alternatives.map((a) => `「${a}」`).join('／');
    return `- 「${s.blocked}」（${s.slot}）→ ${alt}${s.note ? `　※ ${s.note}` : ''}`;
  }).join('\n');

  const bannedLines = banned.map((d) => {
    const rot = (d.rotations || []).map((r, i) => `${i + 1}. ${r}`).join('\n');
    return `### ${d.name} —— **停用（写了就是废稿）**\n\n停用理由：${d.bannedReason || '该手法已停用。'}\n\n这个位置改放下面任意一条：\n${rot}`;
  }).join('\n\n');

  const used = usedList.length
    ? usedList.map((u) => `- ${u.deviceName}｜近 ${u.docs.length} 篇用过：${u.samples.map((s) => `「${s}」`).join('；')}`).join('\n')
    : `- （空）${poolNote ? '原因：' + poolNote : ''}`;

  return `# 装置轮换（硬规则 · 违反即打回重写）

用户原话：**「我发现基本上你每一期都在用这种内容来点这3类人，虽然说风格都一样，但不应该每次都这样」**。

结论分三层，别混：
- **装置要保留**（信任配方那几条是内容层硬规则，删了就掉信任）；
- **表面写法必须每期轮换**（同一句式跨期复用＝机械落地，观众一听就知道是模板）；
- **有一个手法已经停用**（见下面「停用装置」），不是轮换，是一次都不许再写。

## 停用装置（一次都不许写，命中即打回）

${bannedLines}

需要给观众"我该听哪段"的导航时，可以从下面挑一条**与近期不同**的，也可以干脆不做导航：
${(rules.navigationAlternatives || []).map((n, i) => `${i + 1}. ${n}`).join('\n')}

## 近期已用句式清单（本期禁止复用）

下面是这个 IP 最近几篇在**同一功能位**上用过的实际句子。你这一篇在这些位置**必须换一套骨架——换名词不算换骨架**。

${used}

## 招牌话术的替代说法（原句仍然一个字都不许出现，但这一层必须写）

上面铁律 8 拦的那几句是账号资产，拦对了。**但拦掉原句不等于这一层不写**——它们里有 5 句正好是这个 IP 互动指令层的全部典型表面形，上一批稿子因为没有替代清单，模型的安全解是整层不写，结果这一层掉到了真人的 12%。左边一个字都不许出现，右边是同功能的新说法（也可以按同形制自造，但别跨期复用同一句）：

${sigRep}

## 各装置的可选表面写法（每条至少三种，挑一种没用过的）

${devLines}

## 两条附加硬规则

1. **同一日期戳全篇最多出现 2 次。** 采集日期（如"九月二号"）第一次出现要交代清楚"这是我几号看到的盘面"，之后一律用"当天""那天""我看的那次"回指，不许每段重念一遍日期。
2. **编号结构必须自洽。** 说了"拆成四步"，正文就**只**按这四步走，编号一一对上；某段内容不在这四步里（比如"需求真不真"），要么把它并进编号（改成五步 / 把它算作第一步），要么把它放在编号宣告**之前**当铺垫，绝不许宣告了四步却先讲一个编号之外的段落。同理"三关""两条路"。`;
}

// 去 AI 味 · 正向配额 + 负面配额（硬规则）。
// 来源：docs/AI味治理-外部对照.md §4b（改动 B1/B2）+ 主线程 2026-09-03 对 §6 四问的裁定。
// 为什么要有「正向配额」：现有 docs/de-ai-writing.md 几乎全是「少做什么」，模型的安全解就是全都不做，
// 于是九个密度指标被优化到 0.00，比真人还干净——这本身就是 AI 味（调研 §4a-R0）。
// lengthPreset 只影响免责句上限（long ≤3 / 其余 ≤2），与 check-ai-flavor 的 disclaimerCount 同口径。
// ipName 决定「这个 IP 张嘴就来的话」到底是哪张表——2026-09-03 之前这里写死了一串**圣矾**的口头禅
// （说白了 / 最起码 / 等等等等 / 大错特错 / 卖就完了 / 我跟你讲），并配了「至少 3 处」的正向配额，
// 而那六个词在钱十七 20,199 字语料里一次都没出现过（诊断 §1.4）。现在改成从 ai-flavor-rules.json
// 的 profiles[ip].fillerWords 现取——与门禁同一份表，禁止在这里另抄一串。
export function buildAntiAiQuotaSection(lengthPreset = DEFAULT_LENGTH_PRESET, ipName) {
  const disclaimerMax = lengthPreset === 'long' ? 3 : 2;
  const profile = (ipName && AI_FLAVOR_RULES.profiles[ipName]) || null;
  const fillers = fillerWordsFor(profile, AI_FLAVOR_RULES);
  const foreign = ((AI_FLAVOR_RULES.foreignFillerWordsByIp || {})[ipName] || []);
  // 有专属词表才说「这个 IP 张嘴就来的是……」；没有就明说这只是通用口语赘词的兜底，
  // 免得把一张不属于他的词表当成「他的口头禅」硬塞进稿子——上一轮就是这么塞进另一个人的口音的。
  const fillerLine = (profile && profile.fillerWords && profile.fillerWords.length)
    ? `这个 IP 张嘴就来的是「${fillers.join(' / ')}」（这张表是从他本人语料里数出来的，不是拍的）`
    : `这个 IP 的口头禅表还没配（未指定 IP 或该 IP 无专属词表），先用通用口语赘词兜底：「${fillers.join(' / ')}」；更要紧的是按你听过的这个人的说话习惯来，别硬塞别人的词`;
  const foreignLine = foreign.length
    ? `\n   - **下面这些不是这个 IP 的话，一个都不许写**（它们是另一个人的口头禅，写进去等于换了个人在说）：${foreign.join('、')}。`
    : '';
  return `# 去 AI 味 · 配额（硬规则 · 这些是「必须做到的量」和「不许超的量」，不是建议）

下面这一节比后面那份《去 AI 味规则》文档优先级更高。那份文档讲的是「少做什么」，这一节讲的是**必须做到多少**——只躲不做，稿子会干净到不像人写的。

## 一、正向配额（交稿前自己数一遍）

1. **口头禅至少 3 处。** ${fillerLine}。一个都不用，比用多了更不像他。放在你自己讲到一半要换气的地方。**同一段里同一个口头禅只能用一次**，一段甩两次就是在凑数。${foreignLine}
2. **句长要有落差。** 上限仍然是**单句不超过 50 字**（这是视频方合同的字幕硬约束，不能破），但**不许全篇都是 35 到 50 字的整齐句**。硬要求：全篇 5 到 15 字的短句占比不低于四分之一；每十句里至少有一句短到能砸下去（8 字以内），至少有一句把一件事真正铺开（40 字上下）。判断一句该不该拆，看的**不是字数，是从句层数**——一口气塞了三层以上的因果或条件就拆开。
3. **只有这件事才有的细节至少 2 处。** 具体的人、具体的场景、具体的数。「很多人栽在这上面」不算，「我老婆开了京东会员，京东送了她一张家政券」才算。
4. **讲述者必须有立场：全篇至少一句明确的「我的看法是做 / 不做 / 怎么做」。** 你可以保守报数字，但不能整篇没有态度。真人的信任来自「敢说坏话 + 敢承认自己踩过坑 + 数字保守」，我们不能只剩最后一项。**判断句后面不许挂退让尾巴**——不许跟「你自己判断 / 你自己定 / 我不替你下结论 / 信哪句你自己看」。要给选择权，就用「我要是你我会先小批量试」这种带立场的说法。
5. **允许不完美。** 可以有一句话说到一半改口（「这家店……算了，先说第二家」），可以有一处自我纠正。真人口播本来就有。

## 二、负面配额（这些是上限）

6. **空报幕全篇最多 1 句。** 不许说「这里得讲清楚一件事」「我插一句」「两个词先说清楚」「还有一条我要单独说」「接下来这段最重要」——这些是**报了幕却没交付新结构**。想讲什么直接讲：「两个词先说清楚。TF 就是 TestFlight」→「TF 就是 TestFlight，苹果给测试版用的那条通道」。
   - **注意：带清单的预告报幕不算，它是这个 IP 的招牌，该写。** 报幕的同一句里就把清单交出来：「我给你总结了四条，分别是：一、……二、……三、……四、……」——这种每期 1 到 4 处，写。详见下面「风格标志」一节。
7. **空标签全篇最多 2 次。** 不许说「这段最值钱」「重点听」「全篇最长的一段」——这些是**标了重要却没跟着给内容**。
   - **注意：「标签 + 立刻交付」不算，它也是这个 IP 的招牌，该写。**「最关键的是 X，因为 Y，所以你得 Z」这种形制每期 2 到 6 处，写。详见下面「风格标志」一节。
8. **显式免责句全篇最多 ${disclaimerMax} 处，且绝不许连着说三句。** 「没核实 / 我不装懂 / 我不给你报 / 你自己再核 / 我不替你下结论」这类整句声明，集中在一处说完。其余位置改用**词级压低**：「按最保守的算」「就算按……算」「往少了算」「取下限」。
   - 反面（段级声明堆叠，禁止）：「拿货价我没核实到，一分钱净利我都不给你报。」
   - 正面（词级压低）：「拿货价我这回没问到，所以下面这个数你按最保守的算。」
   - **但「词级压低」不等于「把迟疑撒满全篇」。** 上一轮就栽在这儿：段级免责数确实降下来了，模型把 2–3 句集中免责换成了散布全篇的几十处词级迟疑，门禁指标降了、实际语气比以前更虚。硬量化：**迟疑词（可能／大概／说不准／我没查到／我不给你／另说／多半／估计／听个大概）全篇出现的句子数，不得超过确定句的三分之二**——换句话说，含确定词的句子必须比含迟疑词的句子多出至少一半（确定 ÷ 迟疑 ≥ 1.5）。缺口该认还得认，但**一处集中说完，其余位置别每段挂一条尾巴**。
   - **数字可以给区间，判断不许给区间。**「三成到五成，我说不准落哪」——数字部分对，「我说不准」这句尾巴删掉。
9. **不许自己替观众提问再自己回答**（「有人会想…」「你肯定想问…」），全篇最多 1 次。
10. **口径澄清（单品 vs 店铺）全篇讲清楚一次就够。** 后面直接用「这条链接的想要数」「全店累计」这类限定词带过，不再重复解释定义。
11. **对仗金句全篇最多 2 句**，且必须带新信息。把上一句换个说法再对仗一遍的，删掉。
12. **不许用「数据表明 / 研究表明 / 按经验 / 业内认为 / 网上给的判断」这种没有主体的说法**（全篇最多 1 次）。找到那个人：「按经验，三成到五成」→「我前面几次都是按三到五成折的」。

## 三、这些词一个都不许出现（黑话与讲义腔）

赋能、闭环、抓手、链路、触达、心智、对齐、拉通、破圈、赛道、破局、降维打击、认知升级、护城河、生态位、仪式感、长期主义、降本增效、全方位、多维度、助力、彰显、凸显、加持、顶层设计；以及「值得注意的是 / 需要指出的是 / 综上所述 / 总而言之 / 由此可见 / 与此同时 / 更重要的是 / 不难发现 / 显而易见 / 在一定程度上 / 总的来说」这类讲义腔路标词；以及「深入地 / 全面地 / 系统性地 / 有效地 / 高效地 / 充分地」这类空副词。`;
}

// 风格标志段（硬规则 · 优先级高于上面所有「少做什么」的清单）。
//
// 为什么要有这一节（钱十七风格流失诊断 §4.c）：提示词里原本**根本没有「风格标志段」**——
// 这个 IP 的风格全靠 DNA 文档（542 行）整篇注入，而它后面紧跟着四大段「少做什么」
// （学结构不学词 / 去 AI 味配额 / 去 AI 味细则 / 信任配方 + 铁律）。位置靠前、篇幅巨大、
// 语气是描述性的 DNA，打不过位置靠后、语气是命令式的负面清单。用户读完五篇的评价是
// 「ai 味少了点，但是没有钱十七的风格感觉了」。
//
// 所以这一节**注入在所有负面清单之后**（buildDeviceRotationSection 之后、事实卡之前），
// 标题写成硬规则同级，并明写「与上面冲突时以这一节为准」。
//
// 阈值全部从 engine/naturalness/style-floor-rules.json 现取（与 check-style-floor 同一份数），
// 词表从 ai-flavor-rules.json 现取（与 check-ai-flavor 同一份表）——两处都禁止在这里另写一套数字。
// 没有风格标志档的 IP 返回空串（不注入），绝不拿钱十七的标志去要求别人。
export function buildQian17SignatureSection(ipName, opts = {}) {
  const floorRules = opts.floorRules || STYLE_FLOOR_RULES;
  const aiRules = opts.aiRules || AI_FLAVOR_RULES;
  const deviceRules = opts.deviceRules || DEVICE_RULES;
  const fp = ipName && floorRules.profiles ? floorRules.profiles[ipName] : null;
  if (!fp || fp.scope === 'skip') return '';

  const M = fp.metrics || {};
  const pct = (x) => `${Math.round(x * 100)}%`;
  const aiProfile = (aiRules.profiles || {})[ipName] || null;
  const fillers = fillerWordsFor(aiProfile, aiRules);
  const foreign = fp.foreignIpFillerWords || (aiRules.foreignFillerWordsByIp || {})[ipName] || [];
  const a7 = (deviceRules.devices || []).find((d) => d.id === 'a7-action-instruction');
  const a7Rot = a7 ? a7.rotations : [];
  const blocked = SIGNATURE_BLOCKLIST.slice(0, 8);
  const announceMax = ((aiProfile && aiProfile.metrics && aiProfile.metrics.announceCount) || {}).max || 4;
  const selfLabelMax = ((aiProfile && aiProfile.metrics && aiProfile.metrics.selfLabelCount) || {}).max || 6;

  return `# ${ipName}风格标志（硬规则 · 这一节的优先级高于上面所有「少做什么」的清单）

上面那些清单管的是「别写得像 AI」。**这一节管的是「写得像${ipName}」。两者冲突时，以这一节为准。**
判据只有一句：**${ipName}的老观众听完，听不出换了人。**

交稿前这九项自己数一遍——它们有一道叫「风格标志下限门」的机器检查，数不够会被打回重写：

| 要数的东西 | 下限 |
|---|---|
| 含动作指令的句子 | 不低于全篇句数的 ${pct(M.actionInstructionRatio.warnMin || M.actionInstructionRatio.min)}（低于 ${pct(M.actionInstructionRatio.min)} 直接打回） |
| 含确定词的句子 | 不低于全篇句数的 ${pct(M.assertiveRatio.min)} |
| 确定句 ÷ 迟疑句 | 不低于 ${M.assertiveHedgeRatio.warnMin || M.assertiveHedgeRatio.min}（低于 ${M.assertiveHedgeRatio.min} 直接打回） |
| 含方向词的句子 | 不低于全篇句数的 ${pct(M.numberedProgressRatio.min)} |
| 含利益词的句子 | 不低于全篇句数的 ${pct(M.benefitRatio.min)} |
| 教学承诺句 | 至少 ${M.coachVoiceCount.min} 处 |
| 自标重要性 + 带清单报幕 | 至少 ${M.signatureFrameCount.min} 处（目标 2 到 ${selfLabelMax} 处） |
| 长句（超过 35 字） | 不低于全篇句数的 ${pct(M.longSentenceRatio.min)} |
| 带「你 / 咱 / 大家」的句子 | 不低于全篇句数的 ${pct(M.secondPersonRatio.min)} |

## 一、他是教练，不是记者（这一条定全篇的姿态）

${ipName}全程站在「我知道内情、我教你怎么做」的位置上，不是「我去查了查、这是我看到的」。

- 每一段的落点是**你该怎么做**，不是**我看到了什么**。
- 全篇至少 ${M.coachVoiceCount.min} 处明确的教学承诺句：「这一块我给你讲透」「我教你一个最省事的办法」「这份表格我给你整理好了」「照着这三步做就行」。
- 反面（上一批稿子的通病，一律改掉）：整篇都是「我数了三十条」「我翻的时候就这两条」「我这回没问到人」——那是记者的稿子。

## 二、边讲边催（他最强的标志）

${ipName}是**一边讲一边催**的：催你点赞、催你收藏、催你截图、催你别错过、催你现在就动手。真人语料里**每九句就有一句**在催。

三个固定位置，**每期至少占到两个**：
1. **开场承诺之后**：把「值得听」和「先做个动作」扣在一起。
2. **干货密集处**（清单、公式、几个数一起出现时）：绑住「这块值得留存」。
3. **结尾收口前**：关注 / 互动 / 资源。

**下面这 ${blocked.length} 句是他的原句，是账号资产，一个字都不许照搬**：${blocked.join('、')}。

**但「不许照搬原句」不等于「这层不写」。自己新造，形制照下面这几种（每期换说法，别跨期复用同一句）**：
${a7Rot.map((r) => `- ${r}`).join('\n')}

## 三、用确定句推进

他的语气是**说定了**：「就是」「一定要」「肯定」「绝对」「必须」「妥妥的」「很简单」「照着做就行」。

- 保守报数照旧（信任配方规则 3/4/7 不变，缺口该认还得认），但**保守是给数字的，不是给语气的**。
- **数字可以给区间，判断不许给区间。**「三成到五成，我说不准落哪」——数字部分对，「我说不准」这句尾巴删掉。
- 迟疑词（可能／大概／说不准／我没查到／我不给你／另说／多半／估计）**全篇不超过确定词的三分之二**。一处集中说完缺口，其余位置别每段挂一条尾巴。
- 反面（上一批的 jingdong 篇，确定句只有迟疑句的 0.29 倍，等于把这个人的语气反过来了）：「我没拿到准数，所以城市数我这回不给你」「利润我就不往下算了」「我也不帮人找群」「这个我不讲，也不建议你碰」——四句连着都在往回缩。

## 四、编号推进 + 预告报幕 + 自标重要性（这三样是他的招牌，不是 AI 味）

**上面「空报幕最多 1 句」和「空标签最多 2 次」两条负面配额，对这个 IP 按下面执行：**

1. **预告式报幕是他的开场标准件，每期 1 到 ${announceMax} 处，写。** 形制：「这期我给你讲透三件事：一是……二是……三是……」「这里我给你总结了四条，分别是……」「接下来我围绕这四点讲通讲透」。
   - 被禁的是**空报幕**（「这里得讲清楚一件事」「我插一句」「还有一条我要单独说」）——报了幕却没交付新结构。
   - 允许的是**带清单的报幕**——报幕的同时把清单交出来（「分别是：一、二、三、四」）。**这两种的差别就是他和 AI 的差别。**
2. **自标重要性每期 2 到 ${selfLabelMax} 处，写。** 形制：「最重要的地方就是货源」「最关键的是这个号可以无限复制」「这里有个重点要注意」「这一条一定要认真看，九成新手栽在这」。
   - 被禁的是**空标签**（「这段最值钱」「重点听」）——标了重要却没跟着给内容。
   - 允许的是**标签 + 立刻交付**——「最关键的是 X，因为 Y，所以你得 Z」。
3. **方向词密度不低于全篇句子的 ${pct(M.numberedProgressRatio.min)}**：先看、接下来、第一、第二、最后、这里注意、说回、回过头。他每四句就有一句带方向词，观众是被牵着走的。

## 五、他的口头禅（这些才是「张嘴就来」的话，全篇至少 3 处）

**${fillers.join(' / ')}**

（「我们」是教练式的「我们」——「我们先看第一步」，不是公司的「我们」。）

${foreign.length ? `**下面这些不是${ipName}的话，一个都不许写**（它们是另一个人的口头禅，写进去等于换了个人在说）：\n${foreign.join('、')}。` : ''}

## 六、句长（他的句子比你以为的长得多）

真人均句长 40 字、长句占六成；上一批五篇稿均句长 17.7 字、长句一成二，全篇一句一行地平推，**这是最直接的「听着不像他」**。

- 单句上限 50 字（字幕硬约束）不变。
- **但长句（35 到 50 字）占比不得低于 ${pct(M.longSentenceRatio.min)}。** 长句扛信息（把一件事一口气说完），短句砸判断（「这就是差价」「过不去这关，前面白学」）。
- 短句下限（5 到 15 字 ≥25%）和长句下限**同时成立，不冲突**——要的是落差，不是全篇一个长度。
- 判断标准：念一遍。他说话是一段一段涌出来的，不是一条一条列出来的。

## 七、别的 IP 的形制不许借

这个 IP 的互动方式是**动作指令**（催完播、催收藏、催三连），不是**弹幕问答**（「大家都用什么做笔记」「你用苹果还是安卓」「买过的扣个一」）——后者是另一个人的做法，一个是要互动数据，一个是催完播＋催收藏，功能不同、语气不同。唯一保留的另一个人的形制只有**身份句**（「我是圣矾。做闲鱼，找圣矾。」，视频方合同 §E），那是讲述者身份，不是风格。`;
}

// 篇幅与形态段：注入目标口播字数区间；short 档额外注入短视频形态的诱导形式转换硬要求。
// 纯函数、无文件 IO，便于单测断言组装文本。口径同 docs/platform-compliance.md 与 docs/generation-intake.md。
export function buildLengthFormSection(lengthPreset) {
  const p = LENGTH_PRESETS[lengthPreset] || LENGTH_PRESETS[DEFAULT_LENGTH_PRESET];
  const range = `${p.min}–${p.max} 字（约 ${p.minutes}，按每分钟约 300 字口播折算）`;
  // G. 压缩顺序硬规则：命门段与开场钩子是这个 IP 的定义性段落，压字数时最后才动、且一律不许砍。
  // short 相对长稿、standard 相对长视频带都是压缩档，都要挂这条；long 是满带，不挂。
  const compressionRule = `\n- **压缩顺序（硬规则）**：要压字数时，压缩顺序是——先砍案例枚举，再砍重复论证，再砍低预算辅助模式；**命门段（货源 / 封号 / 掉签 / 合规）与开场反差钩子一个字都不许砍**。它们是这个 IP 的定义性段落，压缩是「定向删辅助」，不是等比缩短、更不是先削命门。`;
  if (p.shortForm) {
    return `# 篇幅与形态（本期为短视频形态 · 硬要求）

- 目标口播字数：${range}。全篇口播连起来落在这个区间，是按短视频形态重写，**不是截短**长稿。
- **诱导形式转换（不是截短、不是删诱导）**：本版面向小红书 / 抖音发布。诱导设计一条都不能少，但要**换形式**做——把收益数字、收益推算、资源 CTA 这类诱导，改写成悬念、反差、信息缺口、损失厌恶、互动钩子、消费阶梯。
- 诱导的能量来自「我想知道后面是什么」「我怕踩坑」「做下去我的生活会变成什么样」，不是「我能赚多少」。前三者不受平台约束，最后一个受。
- 因此本版**禁止**出现具体收益数字、收益推算、暴富话术、绝对化承诺、站外导流——成稿后要过平台合规门禁（check-copy），不过会被打回重写。消费阶梯只报生活侧事实、把数字留给观众自己推，讲述者一个数都不报。${compressionRule}`;
  }
  const base = `# 篇幅与形态（本期为长视频形态）

- 目标口播字数：${range}。硬要求：交稿前自查总字数，超出区间回头删减或补足，宁短勿超。
- 长视频形态照旧：诱导设计（收益数字、收益推算、资源 CTA）按风格 DNA 与信任配方正常使用，本版不走短视频合规层。`;
  return p.id === 'standard' ? base + compressionRule : base;
}

// 写作规程（基准稿共同纪律）：四条跨模式硬纪律 + 叙述者身份硬规则。纯函数，便于单测断言文本。
// 注入位置在「风格 DNA」之后，故可引用上面的框架库 F1/F2/F3。narratorName 恒为「圣矾」（讲述者身份）。
const NARRATOR_NAME = '圣矾';
export function buildWritingDiscipline(styleName) {
  return `# 写作规程（基准稿共同纪律 · 四条，违反即改写）

1. **框架单选并整篇贯彻。** 从上面「风格 DNA」的框架库（F1 项目/机会全路径拆解 / F2 筛选判断教程 / F3 高密度查询目录）里**明确选定一条**，整篇按它的 beat 顺序搭骨架；无唯一匹配就 abstain（宁可不出稿）。在成稿的**第一行**用一行 HTML 注释声明你选了哪条，例如 \`<!-- 框架：F1 -->\`——这行只给复核用，落盘时会被自动剥掉，不进口播。
2. **命门置顶讲透。** 本期的货源 / 封号 / 掉签 / 合规命门，要写成全篇**最厚实的一段（不少于全篇篇幅的八分之一）**，绝不许一句话带过。事实卡该栏是缺口时，命门段照写，但用**诚实缺口表述**（如实说这块还没核实到、口径给读者自己去验证），而不是跳过命门。开头若用了「最后一关才是货源/合规」这类悬念绑定，末尾必须真把这一关讲透兑现，不许预告了不兑现。
3. **开场第一拳＝强反差数字钩子。** 开头第一句先甩一个反直觉判断或强反差数字（参照信任配方规则 1：先给事实卡里的真实数字），一拳把人打住；**禁用「这句你得听准了 / 先把口径说清楚」这类口径澄清式开场**。口径澄清可以有，但只能排在钩子之后，不能占掉开场那一拳。
4. **收口＝第一单里程碑 + 克制 CTA。** 结尾用「第一单里程碑」降门槛（第一笔小到读者找不出理由做不到，参照 DNA 的 P8 里程碑型；里程碑参照物从目标观众画像现取，不搬来源原文的奶茶之类），再跟一个克制的互动 / 资源 CTA，不逼单。
   - **收口的动作序列必须换。**「打开闲鱼 → 搜 X → 数第一页 → 写评论区 → 零成本」这个五拍序列在这个 IP 的前几篇已经连用了五次，本期不许照着走：换动作、换验证对象、换交回给听众的形式，或者干脆不给动作、只给里程碑。

# 叙述者身份（硬规则 · 违反即打回重写）

- 讲述者永远是**${NARRATOR_NAME}**本人。你学的是「${styleName}」的**结构与打法**，但**绝不把自己的名字说成「${styleName}」**——不写「我是${styleName}」「我叫${styleName}」「这里是${styleName}」这类自称，落款与自我介绍一律用${NARRATOR_NAME}的身份。
- 第三人称提到「${styleName}」（如「${styleName}讲过这套」）是允许的；只有把自称说成「${styleName}」才违规。
- **自我介绍形制（视频方合同 §E，硬规则）**：口播开场附近（数据钩子的第一或第二句之后）须有**且只有一句**以「我是${NARRATOR_NAME}」起头的独立自我介绍句（如「我是${NARRATOR_NAME}。」），句内不夹带本期主题承诺或受众描述——那些另起一句；可选紧跟一句口号「做闲鱼，找圣矾。」（含则一字不改）。**结尾落款不得再出现「我是${NARRATOR_NAME}」类自称句**，用「下期见」「咱们下期接着拆」等收口。`;
}

// 改写模式三步硬流程（fix A）：原稿只作事实来源，禁止继承其结构与句子。纯函数，便于单测。
export function buildRewriteBlock(sourceText) {
  return `\n## 改写模式（mode=rewrite）· 三步硬流程

本次给你一份既有原稿（见下方「待改写原稿」）。**原稿只是事实来源，不是让你润色的底稿。** 严格按三步走：

1. **先提炼事实与信息点清单。** 从原稿里抽出「它到底说了哪些事实、数字、渠道、步骤要点、结论」，在心里列成一张干净清单——只留「说了什么」，把「怎么说」全部丢掉。
2. **彻底丢弃原稿的骨架。** 原稿的段落顺序、重点分配、句子构造、开场句、核心判断句、收口序列、具体措辞——**一律不得继承**。与原稿**连续 12 字以上照搬即为废稿**；「换几个词逃检」也算继承骨架，同样废稿。
3. **按所选风格 DNA 的框架重搭骨架成稿。** 用你在「写作规程」里选定的那条框架（F1/F2/F3）重新排 beat，再把第 1 步的事实清单回填进去。命门置顶、开场强反差、收口里程碑，全按这个 IP 的打法重来，而不是照着原稿顺序走。

原稿全文如下——**仅供提取事实，禁止继承其结构与句子**：

### 待改写原稿（仅供提取事实，禁止继承结构与句子）
${sourceText}
`;
}

// 钱十七 8 条招牌互动话术 + 跨 IP 来源原句：这些是账号资产 / 来源原句，风格可学、原句不能搬。
// 与 engine/tests/platform-compliance.test.mjs 的 LIFTED 名单同源。生成时硬拦截，出现即打回。
export const SIGNATURE_BLOCKLIST = [
  '先点赞后观看',
  '以免后面找不到了',
  '暂停截图保存',
  '动动发财的小手',
  '点赞是我更新的动力',
  '一键三连',
  '谈钱不伤感情',
  '打在公屏上',
  // 跨 IP 来源原句 / 借用身份
  '我爱这个魔幻的世界',
  '我是半佛',
  '鸡蛋卷'
];

// 平台合规 / 信任红线里的硬禁词（出现即违信任配方规则 8 / 收入话术红线）。
// 注意「零成本」本身不列——它在受众锁里是被允许的正当表达（如「零成本的第一步」「试错成本几乎为零」）；
// 真正红线是把它当供应/收益承诺的搭配，故只收「零成本拿货 / 直接拿货」这类危险搭配。
export const REDLINE_WORDS = [
  '零成本拿货', '直接拿货', '稳赚不亏', '稳赚', '绝对稳定', '百分百', '100%稳',
  '一把过', '绝对不掉', '月入过万', '月入破万', '躺赚', '轻松月入', '包出单'
];

// 组装系统提示。返回 { system, factCard, style, usedDevices, historyNote }。
// opts.history —— 历史稿池 { 稿件名: 全文 }（inputs.loadHistoryPool 的 docs）；用于抽「近期已用句式清单」。
// opts.historyNote —— 拿不到池子时的中文原因，原样写进提示词，让模型知道机器没在跨期比对。
export function buildSystemPrompt(order, opts = {}) {
  const style = resolveStyle(order.styleId);
  const fc = locateFactCard(order);
  const factCard = readFileSync(fc.path, 'utf8');

  const dna = readFileSync(style.dnaPath, 'utf8');
  const trust = readRepoDoc('docs/信任配方-保留清单.md');
  const deAi = readRepoDoc('docs/de-ai-writing.md');
  const structure = readRepoDoc('docs/structure-not-words.md');
  const audience = readRepoDoc('docs/audience-lock.md');

  const points = order.points.length
    ? order.points.map((p, i) => `${i + 1}. ${p}`).join('\n')
    : '（工单未指定必谈要点，按事实卡与 DNA 自主组织。）';

  const rewriteBlock = order.mode === 'rewrite'
    ? buildRewriteBlock(readFileSync(order._sourceAbs, 'utf8'))
    : '';

  const history = opts.history || {};
  const usedDevices = buildUsedDeviceList(history);
  const historyNote = opts.historyNote || '';
  const writtenWords = loadWrittenWords();
  // 风格标志段：注入位置在所有负面清单之后（装置轮换之后、事实卡之前）。
  // 没有风格标志档的 IP 返回空串，整节不注入。
  const sig = buildQian17SignatureSection(style.ip);
  const signatureSection = sig ? sig + '\n\n' : '';

  // 范文段（2026-09-04 路线：范文优先）。位置在任务描述 + 叙述者身份之后、**所有规则清单之前**。
  // 任何一份范文读不到都只跳过它并记一条中文说明（notes 进 stdout 日志），绝不因此拦稿。
  const ex = opts.styleExamples || loadStyleExamples(order, style.ip, opts);
  const exampleSection = buildStyleExampleSection(ex.examples, ex.notes, style.ip);
  if (!opts.quiet) {
    for (const e of ex.examples) console.log(`      范文注入：${e.label}（约 ${e.chars} 字）`);
    for (const n of ex.notes) console.log(`      范文说明：${n}`);
    if (!ex.examples.length) console.log('      范文注入：无（本期未注入范文段）');
  }

  const system = `你是「文案工坊」的口播稿生成器，为「${style.name}」这个 IP 按其风格 DNA 出一篇画面驱动分段稿。你产出的永远是**草稿**，最终由用户终审。

讲述者永远是**${NARRATOR_NAME}**本人；你学的是「${style.name}」的说话方式，绝不自称「${style.name}」。完整的叙述者身份规则见下面「叙述者身份」一节。

${exampleSection ? exampleSection + '\n\n' : ''}# 铁律（违反任一条即为废稿）

1. **事实只来自事实卡。** 数字、同行数据、案例、渠道、结论一律引事实卡；事实卡里没有的事实，绝不自己编、不外部补。
2. **推算必须带链条并标「推算」。** 任何估算（如单量=想要×三到五成）要把算式说给观众听，只给区间不给点估计，拿不准取下限。
3. **没核实拿货价就不出利润数字。** 事实卡标了拿货价缺口，就只讲差价逻辑成立、讲流水量级（注明未扣成本、不是利润），一分钱净利都不报。
4. **亲测/踩坑只用事实卡里标了的真素材。** 事实卡标缺口的亲测项，绝不编造。
5. **收入话术禁入。** 不写「月入过万 / 月入几万 / 轻松赚 / 躺赚 / 百分百出单」这类承诺；讲述者收入若要提，必须归属其本人、紧跟下调预期、说清取决于什么。
6. **单品口径与店铺口径严格分开。** 想要/浏览是单品；店龄/累计已售/好评率是店铺。累计已售是店铺历史总量，绝不能说成某个链接的销量。
7. **受众锁不漂移。** 面向「想找副业、还没开始做」的人写，不预设观众已入行、已有货源。
8. **招牌话术硬拦截。** 下列原句一个都不许出现（它们是账号资产或来源原句，风格可学、原句不能搬）：${SIGNATURE_BLOCKLIST.join('、')}。**但「原句不许搬」不等于「这层不写」**——这 8 句里有 5 句正好是这个 IP 互动指令层的典型表面形，上一批稿子因为没给替代说法，把整层都删了。替代说法清单见下面「装置轮换 · 招牌话术的替代说法」，形制照写、说法自造。
9. **不暴露生产过程。** 不说「根据你提供的、资料里写着、事实卡显示」这类话，不暴露截图/检索/审稿过程。
10. **合规红线词禁用：** ${REDLINE_WORDS.join('、')}。
11. **这是全新系列的第一次讲述，没有"上一期"。** 不许出现期号/计号/系列名/「上次讲过」「我当时录」「那一期」「私信我N计」——亲历改用「我自己做过 / 我之前试过」讲。详见下面「新系列铁律」。
12. **书面词禁入口播：** ${writtenWords.block.map((e) => e.word).join('、')} 一律换口语说法；同一个信任装置的**同一句表面写法不得跨期复用**。详见下面「口播词域」与「装置轮换」。
13. **「受众分流三类人」已彻底停用，一次都不许写。** 不许出现「先分个流」「没用过闲鱼的从头听」「卖过闲置没做过项目的」「在几个副业里挑的」这一族。真人 12 期一次都没这么写过，这段是我们自己发明并固化的模板。**这个位置改放一句这个 IP 自己的动作指令**（比如「这一期数字有点密，先点个关注，回头你还得翻回来对着看」），从「装置轮换」里 A7 互动指令层的轮换池挑一种。**不要放弹幕问答式的互动钩子**（「大家都用什么做笔记」「你用苹果还是安卓」「买过的扣个一」）——那是另一个 IP 的形制，一个是要互动数据，一个是催完播＋催收藏，功能和语气都不是一回事。详见下面「装置轮换 · 停用装置」与「风格标志」。
14. **讲述者必须有立场。** 全篇至少有一句明确的「我的看法是做 / 不做 / 怎么做」，判断句后面不许挂「你自己判断 / 我不替你下结论」这类退让尾巴。保守报数 ≠ 没有态度。详见下面「去 AI 味 · 配额」。

${buildLengthFormSection(order.lengthPreset)}

# 风格 DNA（怎么说——只学结构，不搬来源具体名词）

${dna}

# 学结构不学词（硬规则）

${structure}

${buildAntiAiQuotaSection(order.lengthPreset, style.ip)}

# 去 AI 味规则（负面清单细则，上面那节配额优先级更高）

${deAi}

# 信任配方（必须保留的十条硬规则）

${trust}

# 受众锁（项目级事实，所有赚钱项目稿生成前先对齐）

${audience}

${buildWritingDiscipline(style.name)}

${buildNewSeriesSection()}

${buildSpokenLexiconSection(writtenWords)}

${buildDeviceRotationSection(usedDevices, historyNote)}

${signatureSection}
# 本期事实卡（唯一事实凭据，全文如下）

${factCard}
${rewriteBlock}
# 本期工单

- 选题：${order.topic}
- 受众档位：${order.audience}
- 必谈要点（points）：
${points}
- 素材提示（assetsHint）：${order.assetsHint || '（无）'}

# 输出格式（严格遵守，我会用脚本解析）

只输出分段稿的**段落块序列**，不要标题、不要前言、不要结语、不要 markdown 代码围栏。每段严格是这四行结构：

\`\`\`
### ① 段名（大致时间区间）
**画面** 该段配的画面/证据描述（用事实卡与素材提示里的画面，一句话）
**口播** 这一段要念出来的话，纯口播，中文标点，数字写成能直接念的样子（区间用「到」，钱用「元」，绝不用破折号——）。单句上限 50 字（字幕条硬约束），但**句长必须有落差**：全篇 5 到 15 字的短句占比不低于四分之一，不许全篇都是 35 到 50 字的整齐句。
**目的** 一句话说明这段用了 DNA 的哪条控制、满足哪条信任规则（给人复核用，不会进视频）。
\`\`\`

要求：
- 段的编号用 ①②③…；段数由内容真实结构决定。
- **口播** 字段是最终要进 TTS 的字，必须干净：不含画面提示、不含注释、不含书名号外的标点花样、不含破折号。
- 全篇口播连起来要是一个「${style.name}」本人在说话的完整长视频稿，不是要点罗列。`;

  return {
    system, factCard, factCardPath: fc.path, factCardSource: fc.source, factCardDraft: !!fc.draft, style,
    usedDevices, historyNote, historyDocCount: Object.keys(history).length,
    // 范文清单（只带标题与字数，绝不把原文再传出去——报告里也只记这两样）。
    styleExamples: ex.examples.map((e) => ({ kind: e.kind, key: e.key, label: e.label, chars: e.chars })),
    styleExampleNotes: ex.notes
  };
}
