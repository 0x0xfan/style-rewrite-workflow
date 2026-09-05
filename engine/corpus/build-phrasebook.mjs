#!/usr/bin/env node
/**
 * build-phrasebook.mjs — mechanical recurring-phrase extractor for an IP corpus.
 *
 * DATA TOOL ONLY. Not wired into npm scripts, tests or gates. Run by hand:
 *   node engine/corpus/build-phrasebook.mjs                  # 钱十七 (default)
 *   node engine/corpus/build-phrasebook.mjs --ip=半佛         # ips/半佛/corpus/phrasebook.config.json
 *   node engine/corpus/build-phrasebook.mjs --config=<path>   # any config file
 *   DUMP=1 node engine/corpus/build-phrasebook.mjs --ip=半佛  # print candidate grams, write nothing
 *
 * Every IP-specific knob lives in `ips/<ip>/corpus/phrasebook.config.json`
 * (corpus source, unit boundaries, self-reference masks, keyword tables,
 * thresholds, comparison rows, output paths). The default with no arguments is
 * `--ip=钱十七`, which reproduces the pre-config behaviour byte for byte.
 *
 * What it does (see METHOD below for the exact knobs):
 *   1. slices the corpus into units — by 1-indexed line ranges (`source.mode:
 *      "line_ranges"`) or one file per unit with header/footer stripping and
 *      PDF line-wrap re-joining (`source.mode: "files"`)
 *   2. masks self-reference / brand spans (self_ref) so no phrase can span them
 *   3. takes character n-grams n=2..8 over Chinese-only runs
 *   4. keeps grams covering >= min_episodes distinct units (catchphrase-shaped
 *      grams get a lower bar; bigrams need bigram_min_episodes + the allow list)
 *   5. grows each survivor left/right while its unit coverage holds, so a
 *      sliding window of overlapping grams folds into the one repeated line
 *   6. collapses a gram into any longer kept gram that contains it with the
 *      same-or-higher unit coverage
 *   7. tags each survivor with position(s) and a tier, from occurrence
 *      statistics + the config's keyword tables
 *   8. writes phrasebook.json + phrasebook.md, plus a density table and a
 *      separate list of the self-reference lines that were masked out
 *
 * To run it for another IP: copy a config, point it at the corpus, and re-tune
 * the keyword tables. No code change should be needed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DUMP = !!process.env.DUMP;

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

const DEFAULT_IP = '钱十七';

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([a-zA-Z_][\w-]*)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith('--')) out[a.slice(2)] = true;
  }
  return out;
}
const ARGS = parseArgs(process.argv.slice(2));
const CONFIG_PATH = ARGS.config || `ips/${ARGS.ip || DEFAULT_IP}/corpus/phrasebook.config.json`;

const readAbs = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
const CFG = JSON.parse(readAbs(CONFIG_PATH));

const IP = CFG.ip;
const UNIT_WORD = CFG.unit_label || '集';
const OUT_DIR = CFG.out_dir || `ips/${IP}/corpus`;
const SOURCE = CFG.source;
const CORPUS = SOURCE.mode === 'line_ranges' ? SOURCE.file : SOURCE.dir;

const TH = CFG.thresholds || {};
const MIN_N = TH.min_n ?? 2;
const MAX_N = TH.max_n ?? 8;
const MIN_EPISODES = TH.min_episodes ?? 3;
const BIGRAM_MIN_EPISODES = TH.bigram_min_episodes ?? 6;
const CATCHPHRASE_MIN_EPISODES = TH.catchphrase_min_episodes ?? 2;
const MAX_EXAMPLES = TH.max_examples ?? 3;
const EXAMPLE_MAX_CHARS = TH.example_max_chars ?? 120;
const SELF_REF_MIN_EPISODES = TH.self_ref_min_episodes ?? 2;
const MAX_EXPANDED_CHARS = TH.max_expanded_chars ?? 40;

const COMPARISON = CFG.comparison;
const EXTRA_COMPARISONS = CFG.extra_comparisons || [];

/**
 * Bigrams are only kept when they clear BIGRAM_MIN_EPISODES *and* appear on the
 * allow list. Everything else at that bar was one of: a grammar particle pair,
 * a bare topic noun of the niche, or a fragment of a longer phrase; see
 * bigram_dropped_sample in the config for what was thrown away.
 */
const BIGRAM_ALLOWLIST = CFG.bigram_allowlist || [];
const BIGRAM_DROPPED_SAMPLE = CFG.bigram_dropped_sample || {};

/** Anything matching these is our narrator-unusable self-reference / brand. */
const SELF_REF = CFG.self_ref || [];

/** tier rules, checked top to bottom; first hit wins. */
const CATCHPHRASE_PATTERNS = CFG.catchphrase_patterns || [];
const ENUMERATOR_PATTERNS = CFG.enumerator_patterns || [];
const FIXED_LINE_PATTERNS = CFG.fixed_line_patterns || [];
const FIXED_MIN_CHARS = TH.fixed_line_min_chars ?? 6;

/** position rules: content keywords (regex source strings) -> position tag. */
const POSITION_RULES = (CFG.position_rules || []).map(([tag, src]) => [tag, new RegExp(src)]);
const POSITION_ORDER = CFG.position_order || [];
const TIER_ORDER = CFG.tier_order || ['招牌口头禅', '固定话术', '结构信号词', '口水连接词'];
const FALLBACK_POSITION = CFG.fallback_position || '铺垫引导';
const OPENING_TAG = CFG.opening_tag || '开场';
const CLOSING_TAG = CFG.closing_tag || '收尾';

const PT = CFG.position_thresholds || {};
const OPENING_SHARE = PT.opening_share ?? 0.5;   // >= this share of hits in the first 10% => 开场
const CLOSING_SHARE = PT.closing_share ?? 0.5;   // >= this share of hits in the last 10%  => 收尾
const DECILE = PT.decile ?? 0.1;
const CONTEXT_STRONG_SHARE = PT.context_strong_share ?? 0.7; // a context rule this dominant is tagged outright
const CONTEXT_MIN_SHARE = PT.context_min_share ?? 0.35;      // otherwise the single leading context rule, if it clears this

/**
 * Optional: two units that are two transcripts of the same script rather than
 * two distinct pieces. Coverage is still counted per distinct unit, but a
 * phrase whose >= MIN_EPISODES coverage disappears once the overlap is removed
 * gets flagged with `duplicate_paragraph_dependent`.
 */
const DUP = CFG.duplicate_pair || null;
const DUPLICATE_PAIR = DUP ? DUP.units : null;
const DUPLICATE_MIN_SHARED_CHARS = DUP?.min_shared_chars ?? 12;
const DUPLICATE_MAX_SHARED_CHARS = DUP?.max_shared_chars ?? 400;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const NON_CJK_RUN = /[^一-鿿]+/;

const read = readAbs;
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
// load units
// ---------------------------------------------------------------------------

/**
 * `source.mode: "files"` preprocessing — one plain-text file per unit, as
 * produced by a PDF text extractor:
 *   1. cut everything from `stop_at_line` onwards (the account footer)
 *   2. cut everything up to and including `drop_leading_lines_through` (the
 *      title / byline header)
 *   3. drop lines matching `drop_lines` (section numbers, page artefacts, blanks)
 *   4. re-join PDF line wraps: a line at least `min_wrap_chars` long that does
 *      not end in one of `line_end_terminators` is glued to the next line
 *
 * The header/footer cut in steps 1-2 is NOT discarded: it comes back as
 * `plumbing` and is fed to the self-reference pass only, so the account
 * boilerplate still lands in `excluded_selfref` without polluting extraction.
 */
function preprocessFile(text, p = {}) {
  let lines = text.split('\n').map((l) => l.replace(/ /g, ' ').trim());
  const plumbing = [];
  if (p.stop_at_line) {
    const re = new RegExp(p.stop_at_line);
    const i = lines.findIndex((l) => re.test(l));
    if (i >= 0) {
      plumbing.push(...lines.slice(i));
      lines = lines.slice(0, i);
    }
  }
  if (p.drop_leading_lines_through) {
    const re = new RegExp(p.drop_leading_lines_through);
    const i = lines.findIndex((l) => re.test(l));
    if (i >= 0) {
      plumbing.unshift(...lines.slice(0, i + 1));
      lines = lines.slice(i + 1);
    }
  }
  const dropRes = (p.drop_lines || []).map((s) => new RegExp(s));
  lines = lines.filter((l) => l && !dropRes.some((re) => re.test(l)));
  if (p.join_wrapped_lines) {
    const term = p.line_end_terminators || '。！？!?…”';
    const minWrap = p.min_wrap_chars ?? 40;
    const out = [];
    for (const l of lines) {
      const prev = out[out.length - 1];
      const wrapped =
        prev !== undefined &&
        [...prev].length >= minWrap &&
        !term.includes(prev.slice(-1));
      if (wrapped) out[out.length - 1] = prev + l;
      else out.push(l);
    }
    lines = out;
  }
  return { body: lines.join('\n'), plumbing: plumbing.filter(Boolean).join('\n') };
}

function loadUnits() {
  if (SOURCE.mode === 'line_ranges') {
    const corpusLines = read(SOURCE.file).split('\n');
    return SOURCE.ranges.map(([a, b], i) => ({
      index: i + 1,
      lines: [a, b],
      label: `${a}-${b}`,
      title: (SOURCE.titles || [])[i] || '',
      raw: corpusLines.slice(a - 1, b).join('\n'),
      plumbing: '',
    }));
  }
  if (SOURCE.mode === 'files') {
    return SOURCE.files.map((entry, i) => {
      const file = typeof entry === 'string' ? entry : entry.file;
      const rel = path.posix.join(SOURCE.dir, file);
      const { body, plumbing } = preprocessFile(read(rel), SOURCE.preprocess);
      return {
        index: i + 1,
        file: rel,
        label: typeof entry === 'string' ? file : entry.unit_id || file,
        title: typeof entry === 'string' ? file.replace(/\.txt$/, '') : entry.title || '',
        content_type: typeof entry === 'string' ? '' : entry.content_type || '',
        raw: body,
        plumbing,
      };
    });
  }
  throw new Error(`unknown source.mode: ${SOURCE.mode}`);
}

const episodes = loadUnits().map((u) => {
  const text = maskSelfRef(u.raw);
  const sentencesRaw = splitSentences(u.raw);
  return {
    ...u,
    text,
    chars: cjkOnly(text).length,
    sentencesRaw,
    sentences: sentencesRaw.map(maskSelfRef),
  };
});

// ---- shared opening paragraph between the duplicate pair ----
// Punctuation differs between the two copies, so the overlap is found on the
// punctuation-free projection: any run of >= DUPLICATE_MIN_SHARED_CHARS
// characters present in both units marks those offsets as duplicated.
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

let dupA = null;
let dupB = null;
let dupRanges = new Map();
let duplicateSpans = null;
let duplicateCoveredChars = null;
if (DUPLICATE_PAIR) {
  [dupA, dupB] = DUPLICATE_PAIR;
  const projA = cjkOnly(episodes[dupA - 1].text);
  const projB = cjkOnly(episodes[dupB - 1].text);
  dupRanges = new Map([
    [dupA, sharedRanges(projA, projB)],
    [dupB, sharedRanges(projB, projA)],
  ]);
  const longestSpans = (proj, ranges) =>
    ranges
      .map(([x, y]) => proj.slice(x, y))
      .sort((a, b) => b.length - a.length)
      .slice(0, 5);
  duplicateSpans = {
    [`episode_${dupA}_longest_spans`]: longestSpans(projA, dupRanges.get(dupA)),
    [`episode_${dupB}_longest_spans`]: longestSpans(projB, dupRanges.get(dupB)),
  };
  duplicateCoveredChars = {
    [`episode_${dupA}`]: dupRanges.get(dupA).reduce((n, [x, y]) => n + (y - x), 0),
    [`episode_${dupB}`]: dupRanges.get(dupB).reduce((n, [x, y]) => n + (y - x), 0),
  };
}
const inDuplicate = (epIndex, offset) =>
  (dupRanges.get(epIndex) || []).some(([a, b]) => offset >= a && offset < b);

// ---------------------------------------------------------------------------
// n-gram counting
// ---------------------------------------------------------------------------

/**
 * Per unit we walk the Chinese-only projection of the text so that offsets
 * line up with the density measurement; n-grams may not cross a non-CJK run,
 * so runs are tracked separately.
 */
/** unit index -> array of Chinese-only runs of that unit's text */
const runsOf = (list) => list.map((ep) => ep.text.split(NON_CJK_RUN).filter(Boolean));
const episodeRuns = runsOf(episodes);
/**
 * The self-reference pass runs over the unmasked body PLUS the header/footer
 * plumbing that was cut during preprocessing (empty for `line_ranges` corpora),
 * so the account boilerplate is catalogued in excluded_selfref even though it
 * never reaches the phrase extraction.
 */
const rawRuns = episodes.map((ep) =>
  `${ep.raw}\n${ep.plumbing || ''}`.split(NON_CJK_RUN).filter(Boolean));

function countGrams(runsPerEpisode) {
  const map = new Map(); // phrase -> { total, eps:Map(ep->count), offsets:[{ep,off}] }
  runsPerEpisode.forEach((runs, epIdx) => {
    const epNo = epIdx + 1;
    let cursor = 0; // offset into the Chinese-only projection of this unit
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

/**
 * Maximal extension: grow a gram one character left/right (choosing the most
 * frequent neighbour) as long as the extended string still covers the same
 * number of distinct units. This folds the sliding window of overlapping
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

// collapse: drop g when a longer kept gram contains it with >= unit coverage
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
  if (anyHit(phrase, FIXED_LINE_PATTERNS) || phrase.length >= FIXED_MIN_CHARS) return '固定话术';
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
  if (openShare >= OPENING_SHARE) tags.add(OPENING_TAG);
  if (closeShare >= CLOSING_SHARE) tags.add(CLOSING_TAG);

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
  if (tags.size === 0) tags.add(FALLBACK_POSITION);
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
  const pos = positionsOf(phrase, rec);
  const entry = {
    phrase,
    episodes: epList.length,
    episode_list: epList,
    total: rec.total,
    tier: tierOf(phrase),
    position: pos.tags,
    mean_position: pos.mean_position,
    opening_share: pos.opening_share,
    closing_share: pos.closing_share,
  };
  if (DUPLICATE_PAIR) {
    const epsOutsideDup = new Set(
      rec.offsets.filter((o) => !inDuplicate(o.ep, o.off)).map((o) => o.ep),
    );
    entry.duplicate_paragraph_dependent =
      epList.length >= MIN_EPISODES && epsOutsideDup.size < MIN_EPISODES;
  }
  entry.examples = examplesOf(phrase);
  return entry;
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
  lines: SOURCE.mode === 'line_ranges' ? `${ep.lines[0]}-${ep.lines[1]}` : ep.file,
  ...(SOURCE.mode === 'line_ranges' ? {} : { title: ep.title, content_type: ep.content_type }),
  ...density(ep.text),
}));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Number(((s[m - 1] + s[m]) / 2).toFixed(1));
};

/** markdown scaffolding stripper for comparison rows that point at a .md draft */
function stripMarkdown(text, opts = {}) {
  let t = text.replace(/<!--[\s\S]*?-->/g, '\n');
  const lines = t.split('\n').filter((l) => {
    const s = l.trim();
    if (/^#{1,6}\s/.test(s)) return false;          // ATX headers
    if (/^>/.test(s)) return false;                 // blockquotes
    if (/^[-*_]{3,}$/.test(s)) return false;        // horizontal rules
    if (/^\|/.test(s)) return false;                // table rows
    if (/^!\[/.test(s)) return false;               // images
    if (/^```/.test(s)) return false;               // fences
    return true;
  });
  let out = lines.join('\n').replace(/\*\*/g, '').replace(/`/g, '');
  if (opts.keep_blocks) {
    const { start, end } = opts.keep_blocks;
    const startRe = new RegExp(start);
    const endRe = new RegExp(end);
    const kept = [];
    let on = false;
    for (const l of out.split('\n')) {
      if (!on && startRe.test(l.trim())) { on = true; continue; }
      if (on && endRe.test(l.trim())) { on = false; continue; }
      if (on) kept.push(l);
    }
    out = kept.join('\n');
  }
  return out;
}

function comparisonRowOf(c) {
  let text = read(c.file);
  if (c.strip_markdown) text = stripMarkdown(text, c);
  return { source: c.label, lines: c.file, ...density(text) };
}
const comparisonRow = comparisonRowOf(COMPARISON);
const extraComparisonRows = EXTRA_COMPARISONS.map(comparisonRowOf);

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------

const methodSource = SOURCE.mode === 'line_ranges'
  ? { corpus: CORPUS, episode_ranges_1indexed: SOURCE.ranges }
  : {
      corpus: CORPUS,
      corpus_note: SOURCE.note || '',
      unit_sources: episodes.map((ep) => ({
        index: ep.index,
        unit_id: ep.label,
        title: ep.title,
        content_type: ep.content_type,
        file: ep.file,
        chars: ep.chars,
      })),
      preprocess: SOURCE.preprocess,
    };

const json = {
  ip: IP,
  generated_by: 'engine/corpus/build-phrasebook.mjs',
  generated_at_note: '数据文件，由脚本机械生成；不含解读性文字。',
  method: {
    ...methodSource,
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
    ...(DUPLICATE_PAIR ? {
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
        note: DUP.note,
      },
    } : {}),
    position_tagging: {
      positional: `首尾各 ${DECILE * 100}% 字符位置；开场阈值 ${OPENING_SHARE}，收尾阈值 ${CLOSING_SHARE}（按出现次数占比）`,
      content_rules: POSITION_RULES.map(([tag, re]) => ({ tag, regex: re.source })),
      selection: `短语自身命中的规则优先（最多 2 条）；否则用该短语所有出现处的句子投票，占比 >= ${CONTEXT_STRONG_SHARE} 的取前 2 条，再否则取占比 >= ${CONTEXT_MIN_SHARE} 的第一名`,
      fallback: `无命中则记为 ${FALLBACK_POSITION}`,
    },
    tier_rules: {
      招牌口头禅: CATCHPHRASE_PATTERNS,
      结构信号词: ENUMERATOR_PATTERNS,
      固定话术: `命中固定话术词表，或长度 >= ${FIXED_MIN_CHARS} 字：${FIXED_LINE_PATTERNS.join('、')}`,
      口水连接词: '以上皆不命中',
      order: '招牌口头禅 > 结构信号词 > 固定话术 > 口水连接词，先命中先归类',
    },
    density_rule: '在中文连续段上做最长优先、不重叠的贪心匹配，hits/1000 中文字符',
    config: CONFIG_PATH,
    // free-form, per-IP: anything the config wants recorded alongside the knobs
    ...(CFG.extra_method || {}),
  },
  density: {
    episodes: densityRows,
    episode_median: {
      per_1000_chars: median(densityRows.map((r) => r.per_1000_chars)),
      distinct_phrases: median(densityRows.map((r) => r.distinct_phrases)),
    },
    ...(DUPLICATE_PAIR ? {
      episode_median_excluding_duplicate_twin: {
        note: `去掉第${dupB}集（与第${dupA}集近乎同稿）后的中位数`,
        per_1000_chars: median(densityRows.filter((_, i) => i + 1 !== dupB).map((r) => r.per_1000_chars)),
        distinct_phrases: median(densityRows.filter((_, i) => i + 1 !== dupB).map((r) => r.distinct_phrases)),
      },
    } : {}),
    comparison: comparisonRow,
    ...(extraComparisonRows.length ? { extra_comparisons: extraComparisonRows } : {}),
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
    ...(DUPLICATE_PAIR ? {
      duplicate_paragraph_dependent: entries.filter((e) => e.duplicate_paragraph_dependent).length,
    } : {}),
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
md.push(`生成脚本：\`engine/corpus/build-phrasebook.mjs\`；语料：\`${CORPUS}\`（${episodes.length} ${UNIT_WORD}）。`);
if (CFG.md?.invocation) md.push(`重跑命令：\`${CFG.md.invocation}\`（配置：\`${CONFIG_PATH}\`）。`);
if (CFG.md?.intro_note) md.push(CFG.md.intro_note);
md.push('');
md.push('## 密度基线');
md.push('');
if (SOURCE.mode === 'line_ranges') {
  md.push('| 来源 | 中文字数 | 命中次数 | 每千字命中 | 不同短语数 |');
  md.push('| --- | ---: | ---: | ---: | ---: |');
  for (const r of densityRows) {
    md.push(`| 第${r.source.replace('episode ', '')}${UNIT_WORD}（行 ${r.lines}） | ${r.chars} | ${r.hits} | ${r.per_1000_chars} | ${r.distinct_phrases} |`);
  }
} else {
  md.push('| 来源 | 体裁 | 中文字数 | 命中次数 | 每千字命中 | 不同短语数 |');
  md.push('| --- | --- | ---: | ---: | ---: | ---: |');
  for (const r of densityRows) {
    md.push(`| 第${r.source.replace('episode ', '')}${UNIT_WORD}《${r.title}》 | ${r.content_type} | ${r.chars} | ${r.hits} | ${r.per_1000_chars} | ${r.distinct_phrases} |`);
  }
}
const spacer = SOURCE.mode === 'line_ranges' ? '' : ' |';
md.push(`| **本人语料中位数** |${spacer} | | **${json.density.episode_median.per_1000_chars}** | **${json.density.episode_median.distinct_phrases}** |`);
if (DUPLICATE_PAIR) {
  md.push(`| **去掉第${dupB}${UNIT_WORD}后的中位数** | | | **${json.density.episode_median_excluding_duplicate_twin.per_1000_chars}** | **${json.density.episode_median_excluding_duplicate_twin.distinct_phrases}** |`);
}
const cmpRow = (r) => (SOURCE.mode === 'line_ranges'
  ? `| ${r.source} | ${r.chars} | ${r.hits} | **${r.per_1000_chars}** | **${r.distinct_phrases}** |`
  : `| ${r.source} | — | ${r.chars} | ${r.hits} | **${r.per_1000_chars}** | **${r.distinct_phrases}** |`);
md.push(cmpRow(comparisonRow));
for (const r of extraComparisonRows) md.push(cmpRow(r));
md.push('');
if (DUPLICATE_PAIR) {
  md.push(`注：第${dupA}${UNIT_WORD}与第${dupB}${UNIT_WORD}是同一稿的两份转写（12字为界重合约97%，30字为界约87%），两行密度都偏高。`);
  md.push('');
}
if (CFG.md?.density_note) {
  md.push(CFG.md.density_note);
  md.push('');
}
md.push(`共保留 ${entries.length} 条短语；自称/品牌类另列 ${excludedKept.length} 条于文末。${DUPLICATE_PAIR ? `标 ⚠ 者去掉第${dupA}/${dupB}${UNIT_WORD}的重合部分后覆盖不足 ${MIN_EPISODES} ${UNIT_WORD}，请当作 2 ${UNIT_WORD}证据看待。` : ''}`);
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
      md.push(`- **${e.phrase}**（${e.episodes}${UNIT_WORD}/${e.total}次）${flag}`);
      if (ex) md.push(`  - 例（第${ex.episode}${UNIT_WORD}）：${ex.sentence}`);
    }
    md.push('');
  }
}

md.push(CFG.md?.excluded_heading || '## 排除：自称/品牌类（不可直接使用，仅作“他的签名句”参考）');
md.push('');
for (const e of excludedKept) {
  md.push(`- ${e.phrase}（${e.episodes}${UNIT_WORD}/${e.total}次）`);
}
md.push('');

fs.writeFileSync(path.join(ROOT, OUT_DIR, 'phrasebook.md'), `${md.join('\n')}\n`, 'utf8');

console.log(`[${IP}] kept ${entries.length} phrases, excluded ${excludedKept.length} self-ref entries`);
console.log(`unit median  : ${json.density.episode_median.per_1000_chars}/1000 chars, ${json.density.episode_median.distinct_phrases} distinct`);
console.log(`comparison   : ${comparisonRow.per_1000_chars}/1000 chars, ${comparisonRow.distinct_phrases} distinct`);
for (const r of extraComparisonRows) {
  console.log(`  extra      : ${r.source} → ${r.per_1000_chars}/1000 chars, ${r.distinct_phrases} distinct`);
}
console.log(`wrote ${OUT_DIR}/phrasebook.json and ${OUT_DIR}/phrasebook.md`);
