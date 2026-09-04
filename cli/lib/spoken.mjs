// 口播抽取与落盘：解析模型分段稿 → 规范化口播（数字可念/消灭破折号）→ 按句长≤50 拆句 →
// 拼 script.txt（纯口播）+ 重建 storyboard.md（口播与 script 逐字一致）→ 脚本级一致性校验。
// 依据：D:/项目仓库/remotion视频制作/docs/handoff/film-input-spec.md §1 + docs/交接口规范.md。

const MAX_SENT = 50;   // 单句目标上限
const HARD_SENT = 60;  // 硬上限

export class SpokenError extends Error {}

// 解析模型输出为分段结构 [{ header, hua, kou, mu }]。
// 段以「### 」开头；段内认 **画面** / **口播** / **目的** 三个字段（口播为一段话，可能跨行）。
export function parseSegments(raw) {
  // 去掉可能的代码围栏
  const text = raw.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
  const lines = text.split('\n');
  const segs = [];
  let cur = null;
  let field = null; // 'hua'|'kou'|'mu'
  const push = () => { if (cur && (cur.kou || '').trim()) segs.push(cur); };
  const fieldOf = (line) => {
    if (/^\s*\*\*\s*画面\s*\*\*/.test(line)) return { key: 'hua', rest: line.replace(/^\s*\*\*\s*画面\s*\*\*\s*/, '') };
    if (/^\s*\*\*\s*口播\s*\*\*/.test(line)) return { key: 'kou', rest: line.replace(/^\s*\*\*\s*口播\s*\*\*\s*/, '') };
    if (/^\s*\*\*\s*目的\s*\*\*/.test(line)) return { key: 'mu', rest: line.replace(/^\s*\*\*\s*目的\s*\*\*\s*/, '') };
    return null;
  };
  for (const line of lines) {
    if (/^\s*###/.test(line)) {
      // 段头（### ...）
      push();
      cur = { header: line.replace(/^\s*#+\s*/, '').trim(), hua: '', kou: '', mu: '' };
      field = null;
      continue;
    }
    if (!cur) continue;
    const f = fieldOf(line);
    if (f) { field = f.key; cur[field] = (cur[field] ? cur[field] + '' : '') + f.rest.trim(); continue; }
    // 续行：并入当前字段（口播续行拼接，不加空格）
    if (field && line.trim()) cur[field] += line.trim();
  }
  push();
  if (!segs.length) throw new SpokenError('模型输出里没解析出任何合规分段（缺 ### 段头或 **口播** 字段）。');
  return segs;
}

// 规范化一段口播文字，产出可直接进 TTS 的纯口播。
export function normalizeSpoken(s) {
  let t = s;
  // 去掉残留 markdown 记号与书名号外的星号
  t = t.replace(/\*\*/g, '').replace(/`/g, '');
  // 数字/百分比区间：130–1200 / 30%–50% → 130到1200 / 30%到50%（en/em dash 与 ~）
  t = t.replace(/([0-9]+(?:\.[0-9]+)?%?)\s*[–—~〜]\s*([0-9]+(?:\.[0-9]+)?%?)/g, '$1到$2');
  // 人民币符号：¥20.21 / ￥20 → 20.21元
  t = t.replace(/[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/g, '$1元');
  // 消灭一切破折号（——、—、–、-连接号夹在中文间的）：转成顿号/逗号更安全，这里统一转逗号
  t = t.replace(/——|—|–/g, '，');
  // 半角括号内容一般是画面备注，口播不该有；但不武断删除，保留由人工复核
  // 收尾空白与重复标点
  t = t.replace(/\s+/g, '').replace(/，{2,}/g, '，').replace(/。{2,}/g, '。');
  return t.trim();
}

const TERM = new Set(['。', '！', '？']);
const SPLIT_PUNC = new Set(['，', '；', ',', ';']);

// 把一段规范化口播拆成 ≤50 字的句子数组。只把逗号/分号升级为句号，不改词序不增删字。
// 避坑：升级后的分句不以裸「的」收尾（触发悬空「的」门禁），若会则换个切点。
export function splitToSentences(seg) {
  // 先按现有终止符切成整句
  const rawSents = [];
  let buf = '';
  for (const ch of seg) {
    buf += ch;
    if (TERM.has(ch)) { rawSents.push(buf); buf = ''; }
  }
  if (buf.trim()) rawSents.push(buf);

  const out = [];
  for (const sent of rawSents) {
    if (visualLen(sent) <= MAX_SENT) { out.push(sent); continue; }
    out.push(...breakLong(sent));
  }
  return out.filter((s) => s.trim());
}

// 句子可视长度：去掉句末终止符再数（终止符不占字幕宽度关键）
function visualLen(s) {
  return s.replace(/[。！？]$/, '').length;
}

// 拆一个超长句：在逗号/分号处升级为句号，贪心累积到 ≤50，附「的」尾避让。
function breakLong(sentence) {
  const endPunc = /[。！？]$/.test(sentence) ? sentence.slice(-1) : '';
  const core = endPunc ? sentence.slice(0, -1) : sentence;
  // 按切点拆成子句（保留切点符号在子句尾）
  const clauses = [];
  let b = '';
  for (const ch of core) {
    b += ch;
    if (SPLIT_PUNC.has(ch)) { clauses.push(b); b = ''; }
  }
  if (b) clauses.push(b);

  const pieces = [];
  let acc = '';
  const flush = (isLast) => {
    if (!acc) return;
    // 收尾：非最后一段把末尾切点符号换成句号；最后一段用原句终止符
    let piece = acc;
    if (isLast) {
      piece = piece.replace(/[，；,;]$/, '') + (endPunc || '。');
    } else {
      piece = piece.replace(/[，；,;]$/, '。');
      if (!/[。！？]$/.test(piece)) piece += '。';
    }
    pieces.push(piece);
    acc = '';
  };
  for (let i = 0; i < clauses.length; i++) {
    const next = acc + clauses[i];
    const nextLen = next.replace(/[，；,;]$/, '').length;
    if (acc && nextLen > MAX_SENT) {
      // 若当前 acc 以「的」收尾且不含系动词「是」，别在这切，续接一个子句再说
      const trimmed = acc.replace(/[，；,;]$/, '');
      if (trimmed.endsWith('的') && !trimmed.includes('是')) {
        acc = next; // 强行并入，宁可略超（后面硬上限兜底）
        continue;
      }
      flush(false);
      acc = clauses[i];
    } else {
      acc = next;
    }
  }
  flush(true);
  return pieces;
}

// 由结构 + 元信息生成 storyboard.md 全文（口播用拆句后的多句、句间不换行）。
export function renderStoryboard(segs, meta) {
  const head = `# 成稿 · ${meta.styleName}风格 × ${meta.topic}〔待用户终审草稿〕

<!-- 由 cli/generate.mjs 生成，${meta.stamp}。事实卡来源：${meta.factCardSource}。
本文件为草稿态，最终由用户终审抽检（信任配方十条 + 六道门禁）。
口播字段与 script.txt 对应片段逐字一致（去空白后，脚本比对）。 -->
`;
  const blocks = segs.map((s) => {
    const kou = s.sentences.join('');
    return `### ${s.header}\n\n**画面** ${s.hua || '（待配画面）'}\n\n**口播** ${kou}\n\n**目的** ${s.mu || '（未标注）'}`;
  });
  return head + '\n' + blocks.join('\n\n') + '\n';
}

// 由结构生成 script.txt（每段口播一块，块间空行；块内句子直接相连）。
export function renderScript(segs) {
  return segs.map((s) => s.sentences.join('')).join('\n\n') + '\n';
}

// 脚本级一致性：重新解析已写出的 storyboard.md，逐段比对口播与 script 段（去空白）。
export function verifyConsistency(storyboardText, scriptText) {
  const segs = parseSegments(storyboardText);
  const kous = segs.map((s) => s.kou.replace(/\s/g, ''));
  const scriptSegs = scriptText.split(/\n\s*\n/).map((b) => b.replace(/\s/g, '')).filter(Boolean);
  if (kous.length !== scriptSegs.length) {
    throw new SpokenError(`一致性校验失败：storyboard 段数(${kous.length}) ≠ script 段数(${scriptSegs.length})。`);
  }
  for (let i = 0; i < kous.length; i++) {
    if (kous[i] !== scriptSegs[i]) {
      throw new SpokenError(`一致性校验失败：第 ${i + 1} 段口播与 script 不一致。\n  storyboard: ${kous[i].slice(0, 60)}…\n  script:     ${scriptSegs[i].slice(0, 60)}…`);
    }
  }
  return { segCount: kous.length };
}

// 句长自查：返回超 HARD_SENT 的句子（供报告 warn，不阻断）。
export function overlongSentences(segs) {
  const bad = [];
  for (const s of segs) {
    for (const sent of s.sentences) {
      const L = visualLen(sent);
      if (L > HARD_SENT) bad.push({ len: L, text: sent });
    }
  }
  return bad;
}
