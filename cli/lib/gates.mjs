// 门禁层：本地跑 check-ai-flavor（block 拦，反馈重写）+ check-lexicon（warn 报告）。
// 复用 engine/naturalness 的既有检查器，口径与项目其余环节完全一致。
import { checkAiFlavor } from '../../engine/naturalness/check-ai-flavor.mjs';
import { checkStyleFloor, STYLE_FLOOR_LABELS } from '../../engine/naturalness/check-style-floor.mjs';
import { checkLexicon, loadLexicon, loadHints } from '../../engine/naturalness/check-lexicon.mjs';
import { checkCopy } from '../../engine/compliance/check-copy.mjs';
import { SIGNATURE_BLOCKLIST, REDLINE_WORDS, loadWrittenWords } from './prompt.mjs';
import { STYLE_IP_NAMES } from './inputs.mjs';
import { checkSeriesReference, checkDeviceReuse } from '../../engine/variation/check-devices.mjs';
import { checkSkeletonCollision } from '../../engine/variation/check-repetition.mjs';

// 对纯口播文本跑 AI 味门禁。ip = 中文档名（钱十七/半佛）；lengthPreset 决定免责句上限。
export function runAiFlavor(scriptText, ip, lengthPreset) {
  return checkAiFlavor(scriptText, { ip, lengthPreset });
}

// AI 味指标的人话名字。block 进重写反馈，warn 进报告，两处共用一份，别在别处再抄。
export const AI_FLAVOR_LABELS = {
  dashPer1000: '破折号太多（基本别用破折号——）',
  summaryShellPer1000: '总结壳/讲义腔路标词太多（这就是/一句话/核心是/由此可见/综上所述 之类，删壳直接说）',
  danglingDeCount: '出现悬空「的」字句（句尾吞了中心词，把宾语补回来）',
  consecutiveQuestions: '连续反问太多（反问之间夹陈述句喘气）',
  notButShellCount: '「不是X是Y」句壳超标',
  colonPer1000: '冒号太多（冒号列点腔，口播是连着说）',
  quotePer1000: '引号太多（别拿引号框金句）',
  questionPer1000: '问号太密',
  ellipsisPer1000: '省略号太多',
  fillerPer1000: '口头禅密度不在真人区间（低于下限＝比真人还干净，高于上限＝机械堆口头禅凑数）',
  sentenceCvMin: '句长太齐（长短句没有落差，这是「读着像 AI」最强的结构信号）',
  blacklistCount: '命中黑名单词（互联网黑话 / 空副词 / 模板句式 / citation 泄漏），一个都不许留',
  blacklistSoftCount: '命中电商语境软名单词（复盘/沉淀/赛道/链路/触达/底层逻辑），人工确认是不是真实行业用词',
  announceCount: '报幕句超标（「这里得讲清楚一件事」「两个词先说清楚」这类，删掉直接讲内容）',
  selfLabelCount: '自贴重要性标签超标（「这段最值钱」「最要紧的一关」，删标签让内容自己重）',
  disclaimerRun: '免责句连着说了三句以上（硬规则：不许连三句，合并到一处说完）',
  disclaimerCount: '全篇显式免责句偏多（其余位置改用词级压低：最起码 / 按最保守的算 / 就算按……算）',
  strawmanObjection: '自己替观众提问再自己答（「有人会想…」「你肯定想问…」）超标',
  fakeInanimateSubject: '假无生命主语（数据表明/按经验/业内认为）超标，把那个人说出来',
  fenceSitting: '骑墙不表态（你自己判断 / 我不替你下结论）超标，判断句后面不许挂退让尾巴',
  episodeBackrefPer1000: '「第 X 期 / 第 X 计」回指过密',
  perParagraphOnceCount: '同一段里同一个口头禅甩了两次（口头禅要有，但一段一次）',
  shortSentenceRatio: '短句太少（5 到 15 字的短句占比不足四分之一，全篇整齐句）',
  longSentenceRatio: '长句太少（超过 35 字、把一件事一口气说完的句子不到三成，全篇一句一行地平推）',
  dePer1000: '「的」字密度不在真人区间（偏高＝欧化定语堆叠，偏低＝躲成电报体）'
};

const fmtFinding = (f) => {
  const label = AI_FLAVOR_LABELS[f.metric] || f.metric;
  const cmp = f.comparator === '<' ? '下限' : '上限';
  let detail = `- ${label}：当前 ${Number(f.value).toFixed(2)}，${cmp} ${f.threshold}`;
  if (f.samples && f.samples.length) {
    const s = f.samples.slice(0, 3).map((x) => (typeof x === 'string' ? x : (x.term || x.word || JSON.stringify(x))));
    detail += `。命中：${s.join(' / ')}`;
  }
  return detail;
};

// 把 AI 味 block findings 变成给模型的重写反馈（人话，指名超标指标 + 样例）。
export function aiFlavorFeedback(result) {
  return result.findings.filter((x) => x.level === 'block').map(fmtFinding).join('\n');
}

// warn 级 findings（不拦稿，进 generation-report 供终审逐条过目）。
export function aiFlavorWarnLines(result) {
  return result.findings.filter((x) => x.level === 'warn').map(fmtFinding);
}

// 风格标志下限门（门禁十，block 拦，反馈重写）。与 AI 味门方向相反：那边全是「不许超」，
// 这边全是「不许低于」。没有风格标志档的 IP 整道门跳过（恒 PASS），绝不拿别人的下限卡它。
// 来源：docs/钱十七风格流失诊断-20260903.md §4.b。
export function runStyleFloor(scriptText, ip) {
  return checkStyleFloor(scriptText, { ip });
}

const fmtFloorFinding = (f) => {
  const label = STYLE_FLOOR_LABELS[f.metric] || f.metric;
  const v = Number.isFinite(f.value) ? Number(f.value).toFixed(2) : '∞';
  if (f.comparator === '>') return `- ${label}：当前 ${v}，上限 ${f.threshold}`;
  return `- ${label}：当前 ${v}，下限 ${f.threshold}${f.tier === 'warnMin' ? '（目标值，未到打回线）' : ''}`;
};

// 把风格标志 block findings 变成给模型的重写反馈。
// 这里的反馈跟别的门不一样：别的门是「把这句删掉」，这道门是「这一层你没写，去把它写出来」，
// 所以要连**怎么写**一起给（形制 + 命中样例），不然模型只会知道数不够、不知道往哪儿加。
export function styleFloorFeedback(result) {
  if (!result || result.skipped) return `- （跳过：${(result && result.reason) || '无风格标志档'}）`;
  const blocks = result.findings.filter((x) => x.level === 'block');
  if (!blocks.length) return '- （风格标志下限全部达标）';
  const lines = [
    '- 这一版**AI 味是干净的，但这个 IP 的标志动作被删干净了**。下面几项是「写得不够」，不是「写多了」，',
    '  按提示词里「风格标志」那一节的形制**加回去**（不是删东西）：'
  ];
  for (const f of blocks) lines.push('  ' + fmtFloorFinding(f).slice(2));
  if (result.foreign && result.foreign.count) {
    lines.push(`  - 另外：稿子里写进了**别的 IP 的口头禅** ${Object.entries(result.foreign.hits).map(([k, v]) => `「${k}」x${v}`).join('、')}，全部换成这个 IP 自己的说法。`);
  }
  lines.push('  注意：加回来的动作指令句**不许照搬招牌话术原句**（先点赞后观看 / 暂停截图保存 / 打在公屏上 那 8 句），');
  lines.push('  从提示词「招牌话术的替代说法」与「A7 互动指令层」的轮换池里挑，或按同形制自造。');
  return lines.join('\n');
}

// warn 级 findings（不拦稿，进 generation-report 供终审逐条过目）。
export function styleFloorWarnLines(result) {
  if (!result || result.skipped) return [];
  return result.findings.filter((x) => x.level === 'warn').map(fmtFloorFinding);
}

// 短视频平台合规门禁（block 拦，反馈重写）。仅 short 档跑，对纯口播文本。
export function runCompliance(scriptText) {
  return checkCopy(scriptText);
}

// 把合规 block findings 变成给模型的重写反馈（人话，指名命中类别与原词）。
export function complianceFeedback(result) {
  const lines = [];
  for (const f of result.findings.filter((x) => x.level === 'block')) {
    lines.push(`- [${f.group}] ${f.reason}：命中「${f.hits.join('、')}」`);
  }
  if (!lines.length) lines.push('- （无 block 级命中）');
  return lines.join('\n');
}

// 口播词域门禁：书面/报告词混进口播。词表唯一来源 engine/naturalness/lexicon-hints.json。
// 与 runLexicon 的分工：runLexicon 查"这个 IP 语料里没出现过的词"（统计口径，会漏掉 IP 自己也写过的书面词）；
// 本函数是确定性名单，不管语料里有没有，出现就报。block 级进重写循环，warn 级只入报告。
export function runWrittenWords(scriptText, table) {
  const t = table || loadWrittenWords();
  const flat = String(scriptText).replace(/\s/g, '');
  const scan = (entries) => entries
    .map((e) => ({ ...e, count: flat.split(e.word).length - 1 }))
    .filter((e) => e.count > 0);
  const blockHits = scan(t.block);
  const warnHits = scan(t.warn);
  return {
    blockHits, warnHits,
    blockCount: blockHits.length, warnCount: warnHits.length,
    passed: blockHits.length === 0
  };
}

// 把书面词命中变成给模型的重写反馈（人话，逐词给口语替换）。
export function writtenWordFeedback(result) {
  if (!result.blockHits.length) return '- （无书面词命中）';
  const lines = ['- 下面这些是书面/报告词，念出来不像人说话，逐个换成口语说法（右边是候选，可自己另想更顺的）：'];
  for (const h of result.blockHits) {
    lines.push(`  - 「${h.word}」出现 ${h.count} 次 → ${h.spoken.length ? h.spoken.join(' / ') : '换成口语说法'}`);
  }
  return lines.join('\n');
}

// 新系列铁律硬拦截：稿子是全新系列的第一次讲述，不许带期号/系列名/「上次讲过」。命中即打回。
export function runSeriesReference(scriptText) {
  return checkSeriesReference(scriptText);
}

export function seriesReferenceFeedback(result) {
  if (result.clean) return '- （无旧系列引用）';
  const lines = ['- 这篇是**全新系列的第一次讲述**，不存在"上一期"。下列旧系列引用必须全删或改写：'];
  for (const h of result.hits) {
    lines.push(`  - [${h.label}] 命中「${h.match}」 ← 原句：${h.sentence}`);
  }
  lines.push('  改法：亲历照讲但去掉期号（"我第38期拆过这个题"→"这个题我自己做过一轮"）；');
  lines.push('  "那一期的画面"→"这张图是我自己录的"；收口用"下期见"，不许用"下一计见"。');
  return lines.join('\n');
}

// 装置轮换门禁：同一个信任装置的同一句表面写法跨期复用即打回。history = { 稿件名: 全文 }。
// 历史池为空时恒 PASS（并在结果里注明），绝不因为拿不到池子就拦稿。
export function runDeviceReuse(scriptText, history = {}) {
  return checkDeviceReuse(scriptText, history);
}

export function deviceReuseFeedback(result) {
  if (result.clean) return '- （无跨期复用的装置句式，也没碰停用装置）';
  const lines = [];
  for (const b of result.banned || []) {
    lines.push(`- 【${b.deviceName}】**这个手法已经停用，一次都不许写**（与历史稿无关）：命中「${b.match}」`);
    lines.push(`    原句：${b.sentence}`);
    lines.push(`    停用理由：${b.reason}`);
    if (b.rotations && b.rotations.length) {
      lines.push(`    这个位置改放：${b.rotations.slice(0, 2).map((x, i) => `${i + 1}) ${x}`).join('  ')}`);
    }
  }
  if (!result.reused.length) return lines.join('\n');
  lines.push('- 下面这些句式在近期稿里已经用过，**装置要保留，写法必须换一种**：');
  for (const r of result.reused) {
    lines.push(`  - 【${r.deviceName}】${r.scope === 'device' ? '整个手法近期用过，换成别的导航方式' : '同一句表面写法复用'}：命中「${r.match}」`);
    lines.push(`    原句：${r.sentence}`);
    lines.push(`    历史里也有：${r.docs.join('、')}`);
    if (r.rotations && r.rotations.length) {
      lines.push(`    换成（挑一种，或自己另造）：${r.rotations.slice(0, 3).map((x, i) => `${i + 1}) ${x}`).join('  ')}`);
    }
  }
  return lines.join('\n');
}

// 跨稿骨架撞句（warn 级，只报不拦）。history = { 稿件名: 全文 }；本稿以「本期」为名并进批次两两比对。
// 与 runDeviceReuse 的分工：那条查「这句表面写法上一期用过没有」（正则指纹，只认预先写好的装置）；
// 本条查「同一功能位上是不是同一个骨架只换了名词」（统计口径，抓的是没写进装置表的模板句）。
export function runSkeleton(scriptText, history = {}) {
  const names = Object.keys(history);
  if (!names.length) {
    return { skipped: true, reason: '历史稿池为空，无法跨稿比对', passed: true, pairs: [], count: 0 };
  }
  const docs = { 本期: scriptText };
  for (const n of names) docs[n] = history[n];
  const r = checkSkeletonCollision(docs);
  // 只关心「本期 vs 历史」的撞句；历史稿彼此之间撞不撞是上一批的账，不该拦本期。
  const pairs = r.pairs.filter((p) => p.a === '本期' || p.b === '本期');
  return { ...r, pairs, count: pairs.length, passed: pairs.length <= r.maxPairs, skipped: false };
}

export function skeletonFeedback(result) {
  if (!result || result.skipped) return `- （跳过：${(result && result.reason) || '无历史稿池'}）`;
  if (result.passed && !result.count) return '- （无跨稿撞骨架）';
  const lines = [`- 下面这些句子和历史稿是**同一个骨架只换了名词**（归一化 ${result.threshold} 以上），同一功能位每篇必须换一套说法，换名词不算换骨架：`];
  for (const p of result.pairs.slice(0, 6)) {
    const other = p.a === '本期' ? p.b : p.a;
    const mine = p.a === '本期' ? p.aSentence : p.bSentence;
    const theirs = p.a === '本期' ? p.bSentence : p.aSentence;
    lines.push(`  - [${p.jaccard}] 本期「${mine}」 ← 撞《${other}》的「${theirs}」`);
  }
  return lines.join('\n');
}

// 用词层（warn，不 block）。python/jieba 不可用会自动回退 MFM，仍只报不拦。
// 口播词域命中会并进 suspiciousList，好让它们无条件出现在 generation-report.md 的用词层小节里
// （统计口径可能压根不认为它们可疑——IP 自己也写过——但用户已明确点名，必须让终审看到）。
export function runLexicon(scriptText, style, writtenWordResult) {
  let lexicon;
  try {
    lexicon = loadLexicon(style.ip);
  } catch (e) {
    return { available: false, reason: e.message };
  }
  const hints = loadHints();
  const r = checkLexicon(scriptText, { lexicon, hints });
  const ww = writtenWordResult || runWrittenWords(scriptText);
  const extra = [];
  for (const h of [...ww.blockHits, ...ww.warnHits]) {
    const tag = h.level === 'block' ? '书面词·口播禁用' : '书面词·建议换口语';
    const term = `${h.word}（${tag}）`;
    extra.push({
      term, count: h.count, writtenWord: true, level: h.level,
      suggest: { source: 'written-words', options: h.spoken.length ? h.spoken : ['换成口语说法'] }
    });
  }
  // 同一个词若统计口径也报了，去掉重复那条，只留带级别标注的这条。
  const words = new Set([...ww.blockHits, ...ww.warnHits].map((h) => h.word));
  const rest = (r.suspiciousList || []).filter((s) => !words.has(s.term));
  const suspiciousList = [...extra, ...rest];
  return {
    available: true, ...r,
    suspiciousList,
    suspiciousTypes: suspiciousList.length,
    suspiciousTotal: suspiciousList.reduce((a, b) => a + (b.count || 0), 0),
    writtenWords: ww
  };
}

// 叙述者身份硬拦截：讲述者是圣矾，产出不得自称任何注册风格 IP 名（我是/我叫/我就是/这里是/大家好我是 + IP名）。
// 只拦「自称」句式，不拦第三人称提及（「钱十七讲过」照放）。命中即打回，并入生成主循环的重写反馈。
export function checkSelfIdentity(scriptText, ipNames = STYLE_IP_NAMES) {
  const flat = scriptText.replace(/\s/g, '');
  const hits = [];
  for (const name of ipNames) {
    const re = new RegExp(`(?:我就是|我是|我叫|这里是)${name}`, 'g');
    for (const m of flat.matchAll(re)) hits.push(m[0]);
  }
  return { hits: [...new Set(hits)], clean: hits.length === 0 };
}

// 把身份自称命中变成给模型的重写反馈（人话）。
export function selfIdentityFeedback(result) {
  if (!result.hits.length) return '- （无自称命中）';
  return `- 叙述者身份跑偏：出现自称「${result.hits.join('、')}」。讲述者永远是圣矾，你学的是这个 IP 的结构与打法，绝不把自己的名字说成它。把这些自称改成圣矾的身份、或直接删掉自我介绍句；第三人称提及（如「钱十七讲过」）不受影响。`;
}

// 信任配方 / 红线的可自动化自查（其余交人工终审）。
export function trustSelfCheck(scriptText) {
  const flat = scriptText.replace(/\s/g, '');
  const hitRedline = REDLINE_WORDS.filter((w) => flat.includes(w));
  const hitSignature = SIGNATURE_BLOCKLIST.filter((w) => flat.includes(w));
  // 收入话术粗筛
  const incomeRe = /月入[0-9一二三四五六七八九十百千万]/g;
  const incomeHits = [...flat.matchAll(incomeRe)].map((m) => m[0]);
  return {
    redlineHits: hitRedline,
    signatureHits: hitSignature,
    incomeHits: [...new Set(incomeHits)],
    clean: hitRedline.length === 0 && hitSignature.length === 0 && incomeHits.length === 0
  };
}
