#!/usr/bin/env node
/**
 * build-phrasebook.mjs — mechanical recurring-phrase extractor for an IP corpus.
 *
 * DATA TOOL ONLY. Not wired into npm scripts, tests or gates. Run by hand:
 *   node engine/corpus/build-phrasebook.mjs
 *   DUMP=1 node engine/corpus/build-phrasebook.mjs      # print candidate grams, write nothing
 *
 * What it does (see METHOD below for the exact knobs):
 *   1. slices the corpus into episodes by 1-indexed line ranges
 *   2. masks self-reference / brand spans (SELF_REF) so no phrase can span them
 *   3. takes character n-grams n=2..8 over Chinese-only runs
 *   4. keeps grams covering >= MIN_EPISODES distinct episodes (catchphrase-shaped
 *      grams get a lower bar; bigrams need BIGRAM_MIN_EPISODES + the allow list)
 *   5. grows each survivor left/right while its episode coverage holds, so a
 *      sliding window of overlapping grams folds into the one repeated line
 *   6. collapses a gram into any longer kept gram that contains it with the
 *      same-or-higher episode coverage
 *   7. tags each survivor with position(s) and a tier, from occurrence
 *      statistics + the keyword tables below
 *   8. writes phrasebook.json + phrasebook.md, plus a density table and a
 *      separate list of the self-reference lines that were masked out
 *
 * To run it for another IP: change IP / CORPUS / EPISODE_RANGES / SELF_REF /
 * DUPLICATE_PAIR / COMPARISON, and re-tune the keyword tables.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DUMP = !!process.env.DUMP;

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

const IP = '钱十七';

const CORPUS = 'research-runs/2026-07-27_codex代安装_refresh/style-application-20260730/qian17-authoritative-corpus.txt';

/** 1-indexed inclusive line ranges of the body text of each episode. */
const EPISODE_RANGES = [
  [2, 21],   // 1  闲鱼无货源怎么养号
  [22, 42],  // 2  闲鱼无货源怎么选品
  [44, 59],  // 3  闲鱼卖虚拟
  [61, 61],  // 4  粉丝投稿
  [63, 63],  // 5
  [65, 65],  // 6
  [67, 67],  // 7  (shares its opening with episode 3)
  [69, 69],  // 8
  [71, 71],  // 9  按季节选品
  [73, 73],  // 10 AI 壁纸
  [75, 75],  // 11 小情侣卖虚拟产品
];

/**
 * Episodes 3 and 7 (1-indexed, i.e. corpus lines 44-59 and line 67) are NOT
 * merely a shared opening paragraph: measured on the punctuation-free
 * projection they overlap ~97% at a 12-character bar and ~87% at a 30-character
 * bar, i.e. they are two transcripts of essentially the same script. Coverage is
 * still counted per distinct episode, but a phrase whose >=3-episode coverage
 * disappears once the overlap is removed gets flagged.
 */
const DUPLICATE_PAIR = [3, 7];
const DUPLICATE_MIN_SHARED_CHARS = 12;
const DUPLICATE_MAX_SHARED_CHARS = 400;

const COMPARISON = {
  label: '口播稿-钱十七-v7-20260904（我方仿写稿，对照行）',
  file: 'research-runs/2026-08-31_41_京东家政券_重制/口播稿-钱十七-v7-20260904.txt',
};

const OUT_DIR = `ips/${IP}/corpus`;

const MIN_N = 2;
const MAX_N = 8;
const MIN_EPISODES = 3;
const BIGRAM_MIN_EPISODES = 6;
const CATCHPHRASE_MIN_EPISODES = 2;
const MAX_EXAMPLES = 3;
const EXAMPLE_MAX_CHARS = 120;

const SELF_REF_MIN_EPISODES = 2;

/**
 * Bigrams are only kept when they clear BIGRAM_MIN_EPISODES *and* appear on this
 * allow list. Everything else at that bar was one of: a grammar particle pair
 * (的是 / 就是 / 可以 / 我们 …), a bare topic noun of the niche (闲鱼 / 商品 /
 * 账号 / 流量 …), or a fragment of a longer phrase (到这 / 是我 / 的小 …); see
 * BIGRAM_DROPPED_SAMPLE for what was thrown away.
 */
const BIGRAM_ALLOWLIST = [
  '我是', '分享', '比如', '直接', '一定', '注意', '建议', '推荐', '关键', '核心',
  '重要', '简单', '容易', '免费', '有用', '更多', '今天', '每天', '一天', '一期',
  '总结', '首先', '然后', '最后', '第一', '第二', '第三', '只要', '只需', '想要',
  '通过', '准备', '教你', '帮你', '打开', '点击', '搜索', '复制', '找到', '喜欢',
  '新手', '别人', '赚钱', '成本', '价格', '收藏', '事项', '先点', '选择', '流程',
  '逻辑', '方法',
];

/** Recorded for the method block: representative bigrams dropped at that bar. */
const BIGRAM_DROPPED_SAMPLE = {
  语法虚词与代词: [
    '一个', '我们', '他们', '这个', '那个', '这些', '这里', '就是', '可以', '如果',
    '需要', '非常', '很多', '什么', '怎么', '因为', '而且', '还有', '那么', '不是',
    '不会', '不能', '没有', '知道', '看到', '觉得', '自己', '你的', '这种', '两个',
    '三个', '时间', '东西', '问题', '可能', '出来', '在这', '这是', '都是', '都能',
    '一下', '一点', '以及', '所有', '开始', '只有', '其他', '他的', '一样',
  ],
  更长短语的碎片: [
    '们下', '们可', '们的', '到这', '到的', '到你', '到一', '要的', '要在', '要注',
    '是我', '是一', '是你', '有一', '有个', '了一', '的一', '的是', '的时', '的人',
    '的小', '的方', '的点', '的流', '用的', '品的', '品就', '品都', '号的', '大的',
    '上的', '来的', '给你', '得有', '卖的', '单的', '多人', '个人', '个月', '就有',
    '就能', '不到', '家好', '每一', '每个', '一位', '博主', '目的', '多多', '这一',
  ],
  品类名词非风格词: [
    '闲鱼', '咸鱼', '商品', '账号', '流量', '平台', '用户', '电商', '图片', '手机',
    '渠道', '工具', '项目', '资料', '视频', '回复', '上架', '发布', '发货', '出单',
    '引流', '成交', '购买', '自动', '一个月', '价格', '成本',
  ],
};

/** Anything matching these is our narrator-unusable self-reference / brand. */
const SELF_REF = [
  '公众号', '前十期', '钱十七', '钱17', '17', '十七', '谈钱不伤感情', '学员',
  '一键领取', '选品表',
];

/** tier rules, checked top to bottom; first hit wins. */
const CATCHPHRASE_PATTERNS = [
  '醒醒', '不香', '巨坑', '信息差', '懂的都懂', '毫无保留', '俗话说得好', '躺赚',
  '妥妥', '韭菜', '干货', '保姆级', '秘诀', '套路', '红到发紫', '鸡贼',
  '一片红海', '闷声', '不夸张', '暴利', '玩法', '路子', '亲测', '手把手',
  '不吹不黑', '注意看', '这个男人', '兰州拉面', '牛排', '养家糊口', '闭眼',
  '真香', '白菜价', '小白', '大佬', '同行', '爆款', '蓝海', '红海', '风口',
  '空手套白狼', '海底捞', '踩坑', '爆单', '零成本', '副业', '内卷', '现金流',
  '轻资产', '神器', '巨量',
];

const ENUMERATOR_PATTERNS = [
  '第一', '第二', '第三', '第四', '第五', '第六', '第七', '最后', '首先', '其次',
  '再来', '接下来', '下面', '一种方法', '第一步', '第二步', '第三步', '第一点',
  '最后一点', '这里有个重点', '先说', '再说', '说完', '刚说', '总结',
];

const FIXED_LINE_PATTERNS = [
  '点赞', '收藏', '关注', '三连', '动动', '发财', '小手指', '评论区', '私信',
  '主页', '回复', '领取', '整理了', '分享给大家', '毫无保留', '注意事项',
  '回复话术', '货源渠道', '保姆级', '下个视频见', '看到这里', '觉得有用',
  '别忘了', '不要忘记', '有需要的', '免费', '无偿', '点个赞', '个赞', '本期视频',
  '下个视频', '这些资料', '有需要', '分享给', '到这里', '这期视频', '希望这个视频',
  '帮到你', '更新的动力', '省时又省力', '一份', '给大家准备',
];

/** position rules: content keywords (regex source strings) -> position tag. */
const POSITION_RULES = [
  ['催动作(点赞收藏关注)', /点赞|个赞|收藏|关注|三连|动动|发财|小手|一键|支持一下|更新的动力/],
  ['资料钩子', /资料|表格|文档|整理了|分享给|领取|评论区|私信|主页|回复|免费|无偿|素材/],
  ['自我介绍', /我是|自由职业|全职|做了.{0,3}年|七年|五年|一名|一位|博主|我的粉丝/],
  ['路线图', /个视频|这一期|这期|下期|下一期|下个视频|系列|分成|讲清楚怎么|会讲|接下来会|全部讲/],
  ['指图读屏', /图中|如图|看图|画面|屏幕|大家看|注意看|截图|这张|图上|上图|图片|页面|界面|首页|榜单|销量图|可以看到|你会看到/],
  ['算账', /利润|成本|收入|赚|客单|价格|售价|进价|差价|块钱|毛利|月入|日入|营业额|流水/],
  ['步骤讲解', /第一步|第二步|第三步|步骤|操作|设置|点击|搜索|上架|发布|复制|下载|注册|授权|绑定|工具/],
  ['坑与警告', /坑|不要|不建议|不做|不选|禁|风险|违规|封号|亏|警惕|别|避免|问题|失败/],
  ['贴士强调', /一定要|注意|重点|切记|记住|建议|千万|关键|核心|秘诀|技巧|小技巧/],
  ['转场枚举', /第一|第二|第三|第四|第五|第六|最后|首先|其次|接下来|下面|再来|说完/],
];

const POSITION_ORDER = [
  '开场', '自我介绍', '路线图', '铺垫引导', '转场枚举', '指图读屏', '算账',
  '步骤讲解', '贴士强调', '坑与警告', '催动作(点赞收藏关注)', '资料钩子', '收尾',
];
const TIER_ORDER = ['招牌口头禅', '固定话术', '结构信号词', '口水连接词'];

const OPENING_SHARE = 0.5;   // >= this share of hits in the first 10% => 开场
const CLOSING_SHARE = 0.5;   // >= this share of hits in the last 10%  => 收尾
const DECILE = 0.1;
const CONTEXT_STRONG_SHARE = 0.7; // a context rule this dominant is tagged outright
const CONTEXT_MIN_SHARE = 0.35;   // otherwise the single leading context rule, if it clears this

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const NON_CJK_RUN = /[^一-鿿]+/;

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
const cjkOnly = (s) => (s.match(/[一-鿿]/g) || []).join('');

function splitSentences(text) {
  const out = [];
  let buf = '';
  for (const ch of text) {
    buf += ch;
    if ('。！？!?\n；;'.includes(ch)) {
      if (cjkOnly(buf).length) out.push(buf.trim());
      buf = '';
    }
  }
  if (cjkOnly(buf).length) out.push(buf.trim());
  return out;
}

const isSelfRef = (s) => SELF_REF.some((p) => s.includes(p));
const anyHit = (s, list) => list.some((p) => s.includes(p));

/**
 * Self-reference / brand spans are replaced by a single non-CJK marker so that
 * no n-gram can span or straddle them; this stops fragments such as 众号 or
 * 键领 from surviving as phrases. Length of the text is preserved sentence-wise
 * (only characters inside a span are collapsed), so masked sentences stay
 * index-aligned with the original ones used for the examples.
 */
const MASK = '※';
function maskSelfRef(text) {
  let out = text;
  for (const p of SELF_REF) out = out.split(p).join(MASK);
  return out;
}

// ---------------------------------------------------------------------------
// load episodes
// ---------------------------------------------------------------------------

const corpusLines = read(CORPUS).split('\n');
const episodes = EPISODE_RANGES.map(([a, b], i) => {
  const raw = corpusLines.slice(a - 1, b).join('\n');
  const text = maskSelfRef(raw);
  const sentencesRaw = splitSentences(raw);
  const sentences = sentencesRaw.map(maskSelfRef);
  return {
    index: i + 1,
    lines: [a, b],
    raw,
    text,
    chars: cjkOnly(text).length,
    sentencesRaw,
    sentences,
  };
});

// ---- shared opening paragraph between the duplicate pair ----
// Punctuation differs between the two copies, so the overlap is found on the
// punctuation-free projection: any run of >= DUPLICATE_MIN_SHARED_CHARS
// characters present in both episodes marks those offsets as duplicated.
const [dupA, dupB] = DUPLICATE_PAIR;
function sharedRanges(a, b) {
  const ranges = [];
  let i = 0;
  while (i < a.length) {
    let len = 0;
    while (
      i + len < a.length &&
      len < DUPLICATE_MAX_SHARED_CHARS &&
      b.includes(a.slice(i, i + len + 1))
    ) len += 1;
    if (len >= DUPLICATE_MIN_SHARED_CHARS) {
      ranges.push([i, i + len]);
      i += len;
    } else {
      i += 1;
    }
  }
  return ranges;
}
const projA = cjkOnly(episodes[dupA - 1].text);
const projB = cjkOnly(episodes[dupB - 1].text);
const dupRanges = new Map([
  [dupA, sharedRanges(projA, projB)],
  [dupB, sharedRanges(projB, projA)],
]);
const longestSpans = (proj, ranges) =>
  ranges
    .map(([x, y]) => proj.slice(x, y))
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);
const duplicateSpans = {
  [`episode_${dupA}_longest_spans`]: longestSpans(projA, dupRanges.get(dupA)),
  [`episode_${dupB}_longest_spans`]: longestSpans(projB, dupRanges.get(dupB)),
};
const duplicateCoveredChars = {
  [`episode_${dupA}`]: dupRanges.get(dupA).reduce((n, [x, y]) => n + (y - x), 0),
  [`episode_${dupB}`]: dupRanges.get(dupB).reduce((n, [x, y]) => n + (y - x), 0),
};
const inDuplicate = (epIndex, offset) =>
  (dupRanges.get(epIndex) || []).some(([a, b]) => offset >= a && offset < b);

// ---------------------------------------------------------------------------
// n-gram counting
// ---------------------------------------------------------------------------

/**
 * Per episode we walk the Chinese-only projection of the text so that offsets
 * line up with the density measurement; n-grams may not cross a non-CJK run,
 * so runs are tracked separately.
 */
/** episode index -> array of Chinese-only runs of that episode's text */
const runsOf = (list) => list.map((ep) => ep.text.split(NON_CJK_RUN).filter(Boolean));
const episodeRuns = runsOf(episodes);
const rawRuns = episodes.map((ep) => ep.raw.split(NON_CJK_RUN).filter(Boolean));

function countGrams(runsPerEpisode) {
  const map = new Map(); // phrase -> { total, eps:Map(ep->count), offsets:[{ep,off}] }
  runsPerEpisode.forEach((runs, epIdx) => {
    const epNo = epIdx + 1;
    let cursor = 0; // offset into the Chinese-only projection of this episode
    for (const run of runs) {
      for (let n = MIN_N; n <= MAX_N; n++) {
        for (let i = 0; i + n <= run.length; i++) {
          const g = run.slice(i, i + n);
          let rec = map.get(g);
          if (!rec) map.set(g, (rec = { total: 0, eps: new Map(), offsets: [] }));
          rec.total += 1;
          rec.eps.set(epNo, (rec.eps.get(epNo) || 0) + 1);
          rec.offsets.push({ ep: epNo, off: cursor + i });
        }
      }
      cursor += run.length;
    }
  });
  return map;
}

const grams = countGrams(episodeRuns);

/**
 * Occurrence count of an arbitrary string (used past MAX_N by the maximal
 * extension step below).
 */
function measure(phrase, runsPerEpisode) {
  const eps = new Map();
  const offsets = [];
  let total = 0;
  runsPerEpisode.forEach((runs, epIdx) => {
    const epNo = epIdx + 1;
    let cursor = 0;
    for (const run of runs) {
      let i = run.indexOf(phrase);
      while (i !== -1) {
        total += 1;
        eps.set(epNo, (eps.get(epNo) || 0) + 1);
        offsets.push({ ep: epNo, off: cursor + i });
        i = run.indexOf(phrase, i + 1);
      }
      cursor += run.length;
    }
  });
  return { total, eps, offsets };
}

const MAX_EXPANDED_CHARS = 40;
/**
 * Maximal extension: grow a gram one character left/right (choosing the most
 * frequent neighbour) as long as the extended string still covers the same
 * number of distinct episodes. This folds the sliding window of overlapping
 * MAX_N grams over a long repeated line into that one line.
 */
function expand(phrase, rec, runsPerEpisode) {
  let cur = phrase;
  let curRec = rec;
  for (let guard = 0; guard < MAX_EXPANDED_CHARS; guard++) {
    let best = null;
    for (const side of ['right', 'left']) {
      const counts = new Map();
      runsPerEpisode.forEach((runs) => {
        for (const run of runs) {
          let i = run.indexOf(cur);
          while (i !== -1) {
            const ch = side === 'right' ? run[i + cur.length] : run[i - 1];
            if (ch) counts.set(ch, (counts.get(ch) || 0) + 1);
            i = run.indexOf(cur, i + 1);
          }
        }
      });
      for (const [ch] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 1)) {
        const cand = side === 'right' ? cur + ch : ch + cur;
        if (cand.length > MAX_EXPANDED_CHARS) continue;
        const m = measure(cand, runsPerEpisode);
        if (m.eps.size >= curRec.eps.size) best = { cand, m };
      }
      if (best) break;
    }
    if (!best) break;
    cur = best.cand;
    curRec = best.m;
  }
  return { phrase: cur, rec: curRec };
}

// ---------------------------------------------------------------------------
// keep / drop
// ---------------------------------------------------------------------------

const isCatchphrase = (g) => anyHit(g, CATCHPHRASE_PATTERNS);

const kept = new Map();

for (const [g, rec] of grams) {
  const eps = rec.eps.size;
  const bar = isCatchphrase(g) ? CATCHPHRASE_MIN_EPISODES : MIN_EPISODES;
  if (eps < bar) continue;
  if (g.length === 2 && !isCatchphrase(g)) {
    if (eps < BIGRAM_MIN_EPISODES) continue;
    if (!BIGRAM_ALLOWLIST.includes(g)) continue;
  }
  if (isSelfRef(g)) continue; // masked out upstream; belt and braces
  kept.set(g, rec);
}

// maximal extension, then de-duplicate
const expanded = new Map();
for (const [g, rec] of kept) {
  const e = expand(g, rec, episodeRuns);
  const prev = expanded.get(e.phrase);
  if (!prev || prev.eps.size < e.rec.eps.size) expanded.set(e.phrase, e.rec);
}
kept.clear();
for (const [g, rec] of expanded) {
  if (isSelfRef(g)) continue;
  kept.set(g, rec);
}

// collapse: drop g when a longer kept gram contains it with >= episode coverage
const byLength = [...kept.keys()].sort((a, b) => b.length - a.length);
const dropped = new Set();
for (const short of kept.keys()) {
  const sEps = kept.get(short).eps.size;
  for (const long of byLength) {
    if (long.length <= short.length) break;
    if (dropped.has(long)) continue;
    if (long.includes(short) && kept.get(long).eps.size >= sEps) {
      dropped.add(short);
      break;
    }
  }
}
for (const g of dropped) kept.delete(g);

// ---- self-reference / brand list: same pipeline over the UNMASKED text ----
const rawGrams = countGrams(rawRuns);
const selfRefRaw = new Map();
for (const [g, rec] of rawGrams) {
  if (!isSelfRef(g)) continue;
  if (rec.eps.size < SELF_REF_MIN_EPISODES) continue;
  selfRefRaw.set(g, rec);
}
const selfRefExpanded = new Map();
for (const [g, rec] of selfRefRaw) {
  const e = expand(g, rec, rawRuns);
  if (!isSelfRef(e.phrase)) continue;
  const prev = selfRefExpanded.get(e.phrase);
  if (!prev || prev.eps.size < e.rec.eps.size) selfRefExpanded.set(e.phrase, e.rec);
}
const excludedKept = [];
for (const [phrase, rec] of [...selfRefExpanded].sort((a, b) => b[0].length - a[0].length)) {
  if (excludedKept.some((k) => k.phrase.includes(phrase) && k.episodes >= rec.eps.size)) continue;
  excludedKept.push({ phrase, episodes: rec.eps.size, total: rec.total });
}
excludedKept.sort((a, b) => b.episodes - a.episodes || b.total - a.total);

// ---------------------------------------------------------------------------
// tag
// ---------------------------------------------------------------------------

function tierOf(phrase) {
  if (isCatchphrase(phrase)) return '招牌口头禅';
  if (anyHit(phrase, ENUMERATOR_PATTERNS)) return '结构信号词';
  if (anyHit(phrase, FIXED_LINE_PATTERNS) || phrase.length >= 6) return '固定话术';
  return '口水连接词';
}

/** offset (Chinese-only projection) -> index of the sentence containing it */
const sentenceStarts = episodes.map((ep) => {
  const starts = [];
  let off = 0;
  for (const s of ep.sentences) {
    starts.push(off);
    off += cjkOnly(s).length;
  }
  return starts;
});
function sentenceAt(epNo, off) {
  const starts = sentenceStarts[epNo - 1];
  let lo = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i] <= off) lo = i;
  return episodes[epNo - 1].sentences[lo] || '';
}

function positionsOf(phrase, rec) {
  const rel = rec.offsets.map(({ ep, off }) => off / (episodes[ep - 1].chars || 1));
  const mean = rel.reduce((a, b) => a + b, 0) / rel.length;
  const openShare = rel.filter((r) => r < DECILE).length / rel.length;
  const closeShare = rel.filter((r) => r > 1 - DECILE).length / rel.length;

  const tags = new Set();
  if (openShare >= OPENING_SHARE) tags.add('开场');
  if (closeShare >= CLOSING_SHARE) tags.add('收尾');

  // (a) rules matching the phrase itself — strongest signal
  const direct = POSITION_RULES.filter(([, re]) => re.test(phrase)).map(([t]) => t);
  // (b) otherwise, a vote over the sentences the phrase actually sits in
  const votes = new Map();
  for (const { ep, off } of rec.offsets) {
    const s = sentenceAt(ep, off);
    for (const [tag, re] of POSITION_RULES) if (re.test(s)) votes.set(tag, (votes.get(tag) || 0) + 1);
  }
  const n = rec.offsets.length;
  const ranked = [...votes].sort((a, b) => b[1] - a[1]).map(([tag, c]) => [tag, c / n]);

  let content = [];
  if (direct.length) {
    content = direct.slice(0, 2);
  } else {
    const strong = ranked.filter(([, share]) => share >= CONTEXT_STRONG_SHARE).slice(0, 2);
    if (strong.length) content = strong.map(([t]) => t);
    else if (ranked.length && ranked[0][1] >= CONTEXT_MIN_SHARE) content = [ranked[0][0]];
  }
  for (const t of content) tags.add(t);
  if (tags.size === 0) tags.add('铺垫引导');
  return {
    tags: POSITION_ORDER.filter((p) => tags.has(p)),
    mean_position: Number(mean.toFixed(3)),
    opening_share: Number(openShare.toFixed(2)),
    closing_share: Number(closeShare.toFixed(2)),
    context_votes: Object.fromEntries(ranked.slice(0, 3).map(([t, s]) => [t, Number(s.toFixed(2))])),
  };
}

function examplesOf(phrase) {
  const out = [];
  const seenEp = new Set();
  for (const pass of [0, 1]) {
    for (const ep of episodes) {
      for (let i = 0; i < ep.sentences.length; i++) {
        if (out.length >= MAX_EXAMPLES) return out;
        if (!ep.sentences[i].includes(phrase)) continue;
        if (pass === 0 && seenEp.has(ep.index)) continue;
        const sentence = trim(ep.sentencesRaw[i]);
        if (out.some((o) => o.sentence === sentence)) continue;
        seenEp.add(ep.index);
        out.push({ episode: ep.index, sentence });
      }
    }
  }
  return out;
}
const trim = (s) => {
  const t = s.replace(/\s+/g, '');
  return t.length > EXAMPLE_MAX_CHARS ? `${t.slice(0, EXAMPLE_MAX_CHARS)}…` : t;
};

const entries = [...kept.entries()].map(([phrase, rec]) => {
  const epList = [...rec.eps.keys()].sort((a, b) => a - b);
  const epsOutsideDup = new Set(
    rec.offsets.filter((o) => !inDuplicate(o.ep, o.off)).map((o) => o.ep),
  );
  const pos = positionsOf(phrase, rec);
  return {
    phrase,
    episodes: epList.length,
    episode_list: epList,
    total: rec.total,
    tier: tierOf(phrase),
    position: pos.tags,
    mean_position: pos.mean_position,
    opening_share: pos.opening_share,
    closing_share: pos.closing_share,
    duplicate_paragraph_dependent:
      epList.length >= MIN_EPISODES && epsOutsideDup.size < MIN_EPISODES,
    examples: examplesOf(phrase),
  };
});

entries.sort((a, b) => b.episodes - a.episodes || b.total - a.total || b.phrase.length - a.phrase.length);

if (DUMP) {
  for (const e of entries) {
    console.log(`${e.episodes}\t${e.total}\t${e.tier}\t${e.position.join('/')}\t${e.phrase}`);
  }
  console.log(`--- ${entries.length} kept, ${excludedKept.length} self-ref excluded`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// density
// ---------------------------------------------------------------------------

const phraseSet = entries.map((e) => e.phrase).sort((a, b) => b.length - a.length);

function density(text) {
  const runs = text.split(NON_CJK_RUN).filter(Boolean);
  const chars = runs.reduce((a, r) => a + r.length, 0);
  let hits = 0;
  const distinct = new Set();
  for (const run of runs) {
    let i = 0;
    while (i < run.length) {
      let matched = null;
      for (let n = MAX_N; n >= MIN_N; n--) {
        if (i + n > run.length) continue;
        const cand = run.slice(i, i + n);
        if (kept.has(cand)) { matched = cand; break; }
      }
      if (matched) { hits += 1; distinct.add(matched); i += matched.length; }
      else i += 1;
    }
  }
  return {
    chars,
    hits,
    per_1000_chars: Number(((hits / (chars || 1)) * 1000).toFixed(1)),
    distinct_phrases: distinct.size,
  };
}

const densityRows = episodes.map((ep) => ({
  source: `episode ${ep.index}`,
  lines: `${ep.lines[0]}-${ep.lines[1]}`,
  ...density(ep.text),
}));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Number(((s[m - 1] + s[m]) / 2).toFixed(1));
};
const comparisonRow = {
  source: COMPARISON.label,
  lines: COMPARISON.file,
  ...density(read(COMPARISON.file)),
};

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------


const json = {
  ip: IP,
  generated_by: 'engine/corpus/build-phrasebook.mjs',
  generated_at_note: '数据文件，由脚本机械生成；不含解读性文字。',
  method: {
    corpus: CORPUS,
    episode_ranges_1indexed: EPISODE_RANGES,
    episode_count: episodes.length,
    ngram: { min_n: MIN_N, max_n: MAX_N, unit: '字符（仅 CJK 连续段，遇非中文字符断开）' },
    thresholds: {
      min_episodes: MIN_EPISODES,
      bigram_min_episodes: BIGRAM_MIN_EPISODES,
      catchphrase_min_episodes: CATCHPHRASE_MIN_EPISODES,
    },
    self_ref_masking: `自称/品牌片段先替换为 ${MASK}（非中文字符），使任何短语都不会跨越或包含它们；被替换的原文另做一遍统计，见 excluded_selfref`,
    maximal_extension: `入选串向左右各扩一字（取最常见的相邻字），只要覆盖集数不下降就继续扩，上限 ${MAX_EXPANDED_CHARS} 字；用于把同一句长台词的滑动窗口合并成一条`,
    collapse_rule: '若存在更长的入选串包含该串且覆盖集数不低于它，则丢弃该短串',
    bigram_allowlist: BIGRAM_ALLOWLIST,
    bigram_dropped_sample: BIGRAM_DROPPED_SAMPLE,
    self_ref_filters: SELF_REF,
    duplicate_paragraph: {
      episodes: DUPLICATE_PAIR,
      min_shared_chars: DUPLICATE_MIN_SHARED_CHARS,
      shared_spans: duplicateSpans,
      shared_chars: duplicateCoveredChars,
      flag_field: 'duplicate_paragraph_dependent',
      overlap_ratio: {
        [`episode_${dupA}`]: Number((duplicateCoveredChars[`episode_${dupA}`] / (episodes[dupA - 1].chars || 1)).toFixed(3)),
        [`episode_${dupB}`]: Number((duplicateCoveredChars[`episode_${dupB}`] / (episodes[dupB - 1].chars || 1)).toFixed(3)),
      },
      note: '第3集（行44-59）与第7集（行67）并非只共用开场段，而是同一稿的两份转写：12字为界重合约97%，30字为界约87%。覆盖集数仍按不同集计，但去掉重合部分后覆盖不足3集的条目已打标 duplicate_paragraph_dependent。',
    },
    position_tagging: {
      positional: `首尾各 ${DECILE * 100}% 字符位置；开场阈值 ${OPENING_SHARE}，收尾阈值 ${CLOSING_SHARE}（按出现次数占比）`,
      content_rules: POSITION_RULES.map(([tag, re]) => ({ tag, regex: re.source })),
      selection: `短语自身命中的规则优先（最多 2 条）；否则用该短语所有出现处的句子投票，占比 >= ${CONTEXT_STRONG_SHARE} 的取前 2 条，再否则取占比 >= ${CONTEXT_MIN_SHARE} 的第一名`,
      fallback: '无命中则记为 铺垫引导',
    },
    tier_rules: {
      招牌口头禅: CATCHPHRASE_PATTERNS,
      结构信号词: ENUMERATOR_PATTERNS,
      固定话术: `命中固定话术词表，或长度 >= 6 字：${FIXED_LINE_PATTERNS.join('、')}`,
      口水连接词: '以上皆不命中',
      order: '招牌口头禅 > 结构信号词 > 固定话术 > 口水连接词，先命中先归类',
    },
    density_rule: '在中文连续段上做最长优先、不重叠的贪心匹配，hits/1000 中文字符',
  },
  density: {
    episodes: densityRows,
    episode_median: {
      per_1000_chars: median(densityRows.map((r) => r.per_1000_chars)),
      distinct_phrases: median(densityRows.map((r) => r.distinct_phrases)),
    },
    episode_median_excluding_duplicate_twin: {
      note: `去掉第${dupB}集（与第${dupA}集近乎同稿）后的中位数`,
      per_1000_chars: median(densityRows.filter((_, i) => i + 1 !== dupB).map((r) => r.per_1000_chars)),
      distinct_phrases: median(densityRows.filter((_, i) => i + 1 !== dupB).map((r) => r.distinct_phrases)),
    },
    comparison: comparisonRow,
  },
  totals: {
    kept_phrases: entries.length,
    excluded_selfref: excludedKept.length,
    by_tier: Object.fromEntries(
      TIER_ORDER.map((t) => [t, entries.filter((e) => e.tier === t).length]),
    ),
    by_position: Object.fromEntries(
      POSITION_ORDER.map((p) => [p, entries.filter((e) => e.position.includes(p)).length]),
    ),
    duplicate_paragraph_dependent: entries.filter((e) => e.duplicate_paragraph_dependent).length,
  },
  phrases: entries,
  excluded_selfref: excludedKept,
};

fs.mkdirSync(path.join(ROOT, OUT_DIR), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, OUT_DIR, 'phrasebook.json'),
  `${JSON.stringify(json, null, 2)}\n`,
  'utf8',
);

// ---- markdown ----
const md = [];
md.push(`# ${IP} 口头语料表（phrase book）`);
md.push('');
md.push('机械提取的复现短语表，按“出现位置 / 层级”分组。只做提取、计数、举例，不含解读。');
md.push(`生成脚本：\`engine/corpus/build-phrasebook.mjs\`；语料：\`${CORPUS}\`（${episodes.length} 集）。`);
md.push('');
md.push('## 密度基线');
md.push('');
md.push('| 来源 | 中文字数 | 命中次数 | 每千字命中 | 不同短语数 |');
md.push('| --- | ---: | ---: | ---: | ---: |');
for (const r of densityRows) {
  md.push(`| 第${r.source.replace('episode ', '')}集（行 ${r.lines}） | ${r.chars} | ${r.hits} | ${r.per_1000_chars} | ${r.distinct_phrases} |`);
}
md.push(`| **本人语料中位数** | | | **${json.density.episode_median.per_1000_chars}** | **${json.density.episode_median.distinct_phrases}** |`);
md.push(`| **去掉第${dupB}集后的中位数** | | | **${json.density.episode_median_excluding_duplicate_twin.per_1000_chars}** | **${json.density.episode_median_excluding_duplicate_twin.distinct_phrases}** |`);
md.push(`| ${comparisonRow.source} | ${comparisonRow.chars} | ${comparisonRow.hits} | **${comparisonRow.per_1000_chars}** | **${comparisonRow.distinct_phrases}** |`);
md.push('');
md.push(`注：第${dupA}集与第${dupB}集是同一稿的两份转写（12字为界重合约97%，30字为界约87%），两行密度都偏高。`);
md.push('');
md.push(`共保留 ${entries.length} 条短语；自称/品牌类另列 ${excludedKept.length} 条于文末。标 ⚠ 者去掉第${dupA}/${dupB}集的重合部分后覆盖不足 ${MIN_EPISODES} 集，请当作 2 集证据看待。`);
md.push('');

for (const pos of POSITION_ORDER) {
  const inPos = entries.filter((e) => e.position.includes(pos));
  if (!inPos.length) continue;
  md.push(`## ${pos}（${inPos.length} 条）`);
  md.push('');
  for (const tier of TIER_ORDER) {
    const list = inPos.filter((e) => e.tier === tier).sort((a, b) => b.episodes - a.episodes || b.total - a.total);
    if (!list.length) continue;
    md.push(`### ${tier}`);
    md.push('');
    for (const e of list) {
      const flag = e.duplicate_paragraph_dependent ? ' ⚠' : '';
      const ex = [...e.examples].sort((a, b) => a.sentence.length - b.sentence.length)[0];
      md.push(`- **${e.phrase}**（${e.episodes}集/${e.total}次）${flag}`);
      if (ex) md.push(`  - 例（第${ex.episode}集）：${ex.sentence}`);
    }
    md.push('');
  }
}

md.push('## 排除：自称/品牌类（圣矾不可直接使用，仅作“他的签名句”参考）');
md.push('');
for (const e of excludedKept) {
  md.push(`- ${e.phrase}（${e.episodes}集/${e.total}次）`);
}
md.push('');

fs.writeFileSync(path.join(ROOT, OUT_DIR, 'phrasebook.md'), `${md.join('\n')}\n`, 'utf8');

console.log(`kept ${entries.length} phrases, excluded ${excludedKept.length} self-ref entries`);
console.log(`episode median: ${json.density.episode_median.per_1000_chars}/1000 chars, ${json.density.episode_median.distinct_phrases} distinct`);
console.log(`comparison    : ${comparisonRow.per_1000_chars}/1000 chars, ${comparisonRow.distinct_phrases} distinct`);
console.log(`wrote ${OUT_DIR}/phrasebook.json and ${OUT_DIR}/phrasebook.md`);
