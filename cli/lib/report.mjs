// 生成报告 generation-report.md：门禁结果 / 用词层警告 / 信任配方自查 / 事实卡来源路径。
// 报告头写明「待用户终审」——产出永远是草稿态。
//
// 2026-09-03 补齐（上一轮加了新系列/书面词/装置轮换三道门，但没进报告）：
// 门禁五 新系列铁律、门禁六 装置轮换（含停用装置）、门禁七 口播词域、
// 门禁八 篇章层（跨稿骨架撞句 + 句长节奏）、门禁九 LLM 二审。
import { AI_FLAVOR_LABELS, aiFlavorWarnLines, styleFloorWarnLines } from './gates.mjs';
import { STYLE_FLOOR_LABELS } from '../../engine/naturalness/check-style-floor.mjs';
import { REVIEW_TYPE_LABEL } from './review.mjs';

const fmt = (n) => Number(n).toFixed(2);

export function renderReport(ctx) {
  const {
    order, style, factCardPath, factCardSource, factCardDraft, mode,
    aiFlavor, styleFloor, lexicon, trust, overlong, retries, consistency, model, provider, stamp,
    preset, compliance, series, deviceReuse, written, skeleton, review,
    knowledge, knowledgeInjected
  } = ctx;

  const lines = [];
  lines.push(`# 生成报告 · ${order.topic}〔待用户终审 · 草稿态〕`);
  lines.push('');
  if (factCardDraft) {
    lines.push('> ## ⚠️ 事实卡为机器草稿，终审时请重点核对数字');
    lines.push('> 本稿依据的事实卡是**自动采集流水线现造的机器底稿**（未经人工抽检）：受众为工单回填、');
    lines.push('> 核心结论为占位「待终审时确认」、供应/需求层多为自动线索或缺口。**所有数字、口径、结论');
    lines.push('> 必须逐条回到事实卡与采集证据核对**，尤其单品/店铺口径与利润推算。');
    lines.push('');
  }
  lines.push('> **本稿为草稿，未经用户终审不得发布。** 十道门禁只保证「不违规/不重复/不像 AI/没把这个 IP 的标志删干净」；');
  lines.push('> 「可不可信、成不成交、像不像本人」由用户按 `docs/信任配方-保留清单.md` 十条逐条抽检终审。');
  lines.push('');
  lines.push('## 生成参数');
  lines.push(`- 生成时间：${stamp}`);
  lines.push(`- filmId：${order.filmId}`);
  lines.push(`- 风格：${style.name}（${style.id}，注册状态 ${style.status}）`);
  lines.push(`- 模式：${mode}${mode === 'rewrite' ? '（风格改写）' : '（选题成稿）'}`);
  lines.push(`- 受众档位：${order.audience}`);
  if (preset) {
    lines.push(`- 篇幅档位：${preset.label}｜目标口播 ${preset.min}–${preset.max} 字｜形态 ${preset.shortForm ? '短视频（走平台合规门禁）' : '长视频（照旧，不走合规层）'}`);
  }
  lines.push(`- 模型：${model}${provider ? `（provider=${provider}）` : '（dry-run 内置 fixture，未调模型）'}`);
  lines.push(`- AI 味重写重试次数：${retries}`);
  lines.push('');
  lines.push('## 事实卡来源');
  lines.push(`- 路径：\`${factCardPath}\``);
  lines.push(`- 命中方式：${factCardSource}`);
  lines.push(`- 事实卡成熟度：${factCardDraft ? '⚠️ 机器草稿（未经人工抽检，终审重点核数）' : '终版候选及以上'}`);
  lines.push('- 说明：本稿事实只应引自该事实卡；请终审时抽查数字与口径（尤其单品/店铺口径）。');
  lines.push('');

  // 知识包使用（2026-09-04 恢复强制知识包 · DECISIONS.md 同日条目）。
  // 出稿三输入之三。知识包**只负责丰富解释与方法，不负责提供事实**——终审时按这一节回查：
  // 稿子里出现的每个数字都该在事实卡里找得到，在知识包里找到的那个不算数。
  lines.push('## 知识包使用（三输入之三 · 只负责讲透方法，不负责提供事实）');
  if (!knowledge) {
    lines.push('- （无结果记录）');
  } else {
    const d = knowledge.relationDistribution || {};
    lines.push(`- 包路径：\`${knowledge.path}\``);
    lines.push(`- 命中方式：${knowledge.source}${knowledge.built ? '（本次现建）' : ''}`);
    lines.push(`- 条目数：${knowledge.resultCount}（可用 ${knowledge.usableCount}）｜schema ${knowledge.schemaVersion}`);
    lines.push(`- relation 分布：support ${d.support || 0} / supplement ${d.supplement || 0} / counterevidence ${d.counterevidence || 0}`);
    lines.push(`- primary_term_hits（真正命中主题/主关键词本身的条目）：${knowledge.primaryTermHits === null ? '（该版包未记录）' : knowledge.primaryTermHits}`);
    if (knowledge.coverageWarning) {
      lines.push(`- ⚠️ 覆盖度告警：${knowledge.coverageWarning}`);
    }
    const injected = knowledgeInjected || [];
    lines.push(`- 提示词里注入的条目（${injected.length} 条）：`);
    if (injected.length) {
      for (const t of injected) lines.push(`  - ${t}`);
    } else {
      lines.push('  - （无）');
    }
    lines.push('- 终审要点：知识包里的数字、案例、收益、平台结论**一律不得出现在口播稿里**；');
    lines.push('  稿中每个数字都要能在上面那张事实卡里查到。counterevidence 条目只用于讲风险，不得当成核心方法。');
  }
  lines.push('');

  // 门禁：AI 味
  lines.push('## 门禁一 · AI 味（block 必须为 0）');
  lines.push(`- 档位：${aiFlavor.ip}｜正文有效字符 ${aiFlavor.chars}｜句数 ${aiFlavor.sentenceCount}`);
  lines.push(`- 结果：${aiFlavor.passed ? 'PASS' : 'FAIL'}  block=${aiFlavor.blockCount} warn=${aiFlavor.warnCount}`);
  const M = aiFlavor.metrics;
  const row = (label, id) => {
    const mt = M[id];
    if (!mt) return;
    const f = (aiFlavor.findings || []).find((x) => x.metric === id);
    const tag = f ? (f.level === 'block' ? 'BLOCK' : 'warn') : (mt.level === 'info' ? 'info' : 'ok');
    const bound = mt.kind === 'range' ? `${mt.min}~${mt.max}` : (mt.kind === 'min' ? `≥${mt.min}` : `≤${mt.max}`);
    lines.push(`  - [${tag}] ${label}：${fmt(mt.value)} / ${bound}`);
  };
  for (const [label, id] of [
    ['破折号/千字', 'dashPer1000'], ['总结壳/千字', 'summaryShellPer1000'],
    ['悬空「的」句/篇', 'danglingDeCount'], ['最长连续反问', 'consecutiveQuestions'],
    ['不是X是Y/篇', 'notButShellCount'], ['冒号/千字', 'colonPer1000'],
    ['引号/千字', 'quotePer1000'], ['问号/千字', 'questionPer1000'],
    ['口头禅/千字', 'fillerPer1000'], ['黑名单命中', 'blacklistCount'],
    ['黑话软名单（人工判断）', 'blacklistSoftCount'], ['报幕句/篇', 'announceCount'],
    ['自贴重要性标签/篇', 'selfLabelCount'], ['连续免责句串', 'disclaimerRun'],
    ['显式免责句/篇', 'disclaimerCount'], ['替观众提问/篇', 'strawmanObjection'],
    ['假无生命主语/篇', 'fakeInanimateSubject'], ['骑墙不表态/篇', 'fenceSitting'],
    ['期号回指/千字', 'episodeBackrefPer1000'], ['同段口头禅两甩', 'perParagraphOnceCount'],
    ['短句(≤15字)占比', 'shortSentenceRatio'], ['长句(>35字)占比', 'longSentenceRatio'],
    ['句长CV', 'sentenceCvMin'],
    ['「的」字/千字', 'dePer1000']
  ]) row(label, id);
  for (const [label, id] of [['带清单报幕（豁免不计）', 'announceCount'], ['标签+立刻交付（豁免不计）', 'selfLabelCount']]) {
    const mt = M[id];
    if (mt && mt.exemptedCount) {
      lines.push(`  - [info] ${label}：${mt.exemptedCount} 处　例：` + (mt.exemptedSamples || []).map((s) => String(s).slice(0, 26)).join(' / '));
    }
  }
  if (M.danglingDeCount.samples && M.danglingDeCount.samples.length) {
    lines.push('  - 悬空「的」命中句：' + M.danglingDeCount.samples.join(' / '));
  }
  if (aiFlavor.blacklist && aiFlavor.blacklist.block.length) {
    lines.push('  - 黑名单命中：' + aiFlavor.blacklist.block.map((b) => `[${b.group}]${b.term}x${b.count}`).join('、'));
  }
  if (aiFlavor.blacklist && aiFlavor.blacklist.soft.length) {
    lines.push('  - 软名单（电商语境可能是真实用词，人工确认）：' + aiFlavor.blacklist.soft.map((b) => `${b.term}x${b.count}`).join('、'));
  }
  for (const id of ['announceCount', 'selfLabelCount', 'disclaimerCount', 'strawmanObjection', 'fakeInanimateSubject', 'fenceSitting']) {
    const mt = M[id];
    if (mt && mt.samples && mt.samples.length && (aiFlavor.findings || []).some((f) => f.metric === id)) {
      lines.push(`  - ${AI_FLAVOR_LABELS[id].split('（')[0]} 命中句：` + mt.samples.map((s) => String(s).slice(0, 34)).join(' / '));
    }
  }
  const warns = aiFlavorWarnLines(aiFlavor);
  if (warns.length) {
    lines.push('- ⚠️ warn 级（不拦稿，需终审逐条过目）：');
    for (const w of warns) lines.push('  ' + w);
  }
  lines.push('');

  // 门禁十：风格标志下限（与门禁一方向相反，排在它后面便于对照）
  lines.push('## 门禁十 · 风格标志下限（block 必须为 0；这道门查的是「像不像这个 IP」，不是「像不像 AI」）');
  lines.push('> 上面门禁一全是**上限**（不许超），这道门全是**下限**（不许低于）。');
  lines.push('> 2026-09-03 之前只有上限门，模型的安全解就是「什么都不做」——五篇稿子九道门全绿，');
  lines.push('> 用户读完的评价是「ai 味少了点，但是没有钱十七的风格感觉了」。依据见 `docs/钱十七风格流失诊断-20260903.md` §4.b。');
  if (!styleFloor) {
    lines.push('- （无结果记录）');
  } else if (styleFloor.skipped) {
    lines.push(`- 跳过：${styleFloor.reason}`);
  } else {
    lines.push(`- 档位：${styleFloor.ip}｜正文有效字符 ${styleFloor.chars}｜句数 ${styleFloor.sentenceCount}`);
    lines.push(`- 结果：${styleFloor.passed ? 'PASS' : 'FAIL'}  block=${styleFloor.blockCount} warn=${styleFloor.warnCount}`);
    const F = styleFloor.metrics || {};
    for (const [label, id] of [
      ['动作指令句占比', 'actionInstructionRatio'], ['确定句占比', 'assertiveRatio'],
      ['确定÷迟疑', 'assertiveHedgeRatio'], ['方向词句占比', 'numberedProgressRatio'],
      ['利益句占比', 'benefitRatio'], ['教学承诺句/篇', 'coachVoiceCount'],
      ['自标+带清单报幕/篇', 'signatureFrameCount'], ['本人口头禅/千字', 'ipFillerPer1000'],
      ['长句(>35字)占比', 'longSentenceRatio'], ['第二人称句占比', 'secondPersonRatio'],
      ['外来 IP 口头禅', 'foreignIpFillerCount']
    ]) {
      const mt = F[id];
      if (!mt) continue;
      const f = (styleFloor.findings || []).find((x) => x.metric === id);
      const tag = f ? (f.level === 'block' ? 'BLOCK' : 'warn') : 'ok';
      const bound = mt.max !== undefined ? `≤${mt.max}` : `≥${mt.min}${mt.warnMin !== undefined ? `（目标 ≥${mt.warnMin}）` : ''}`;
      const v = Number.isFinite(mt.value) ? fmt(mt.value) : '∞';
      lines.push(`  - [${tag}] ${label}：${v} / ${bound}`);
    }
    if (styleFloor.foreign && styleFloor.foreign.count) {
      lines.push('  - ❌ **写进了别的 IP 的口头禅**：' + Object.entries(styleFloor.foreign.hits).map(([k, v]) => `「${k}」x${v}`).join('、')
        + '　← 这些词在本 IP 的语料里一次都没出现过，写进去等于换了个人在说。');
    }
    for (const f of (styleFloor.findings || []).filter((x) => x.level === 'block')) {
      lines.push(`  - BLOCK ${STYLE_FLOOR_LABELS[f.metric] || f.metric}`);
    }
    const fw = styleFloorWarnLines(styleFloor);
    if (fw.length) {
      lines.push('- ⚠️ warn 级（不拦稿，需终审逐条过目——这些是「写得还不够像他」，不是「写错了」）：');
      for (const w of fw) lines.push('  ' + w);
    }
  }
  lines.push('');

  // 用词层
  lines.push('## 门禁二 · 用词层（warn 级，只报不拦，需人工逐条过目）');
  if (!lexicon.available) {
    lines.push(`- 跳过：${lexicon.reason}`);
  } else {
    lines.push(`- 分词后端：${lexicon.segmenter === 'jieba' ? 'jieba' : `回退 MFM（${lexicon.fallbackReason || '未分词'}）`}`);
    lines.push(`- 业务词命中：${lexicon.businessHitTypes} 种 / ${lexicon.businessHitTotal} 次`);
    lines.push(`- 可疑用词（语料 0 出现）：${lexicon.suspiciousTypes} 种 / ${lexicon.suspiciousTotal} 次。前 15：`);
    for (const s of lexicon.suspiciousList.slice(0, 15)) {
      const sug = s.suggest ? `  → 建议 ${s.suggest.options.join(' / ')}` : '';
      lines.push(`  - ${s.term} x${s.count}${sug}`);
    }
    if (!lexicon.suspiciousList.length) lines.push('  - （无可疑用词）');
  }
  lines.push('');

  // 信任配方自查
  lines.push('## 门禁三 · 信任配方自查');
  lines.push(`- 合规红线词：${trust.redlineHits.length ? '❌ 命中 ' + trust.redlineHits.join('、') : '✅ 未命中'}`);
  lines.push(`- 招牌话术/来源原句硬拦截：${trust.signatureHits.length ? '❌ 命中 ' + trust.signatureHits.join('、') : '✅ 未命中'}`);
  lines.push(`- 收入话术粗筛：${trust.incomeHits.length ? '⚠️ 疑似 ' + trust.incomeHits.join('、') + '（人工确认归属/下调预期）' : '✅ 未见'}`);
  lines.push('- 以下十条须用户逐条终审（机器无法替判）：');
  const checklist = [
    '规则1 开场先甩事实卡真实数字',
    '规则2 单品/店铺数据没说混',
    '规则3 收益推算是区间+标推算+口径保守',
    '规则4 没核实拿货价处没出利润数字',
    '规则5 风险直说并紧跟规避',
    '规则6 亲测/案例全真、缺口没编',
    '规则7 话没说满、没打包票',
    '规则8 没踩合规红线词',
    '规则9 先讲需求成立、面向没开始做的人',
    '规则10 CTA 先给料再要三连、不逼单'
  ];
  for (const c of checklist) lines.push(`  - [ ] ${c}`);
  lines.push('');

  // 门禁四：短视频平台合规（仅 short 档跑；长视频形态不适用）
  lines.push('## 门禁四 · 短视频平台合规（仅 short 档跑，block 必须为 0）');
  if (!preset || !preset.shortForm) {
    lines.push('- 不适用：本期为长视频形态（standard / long），合规层不走，诱导设计照旧保留。');
  } else if (compliance && compliance.skipped) {
    lines.push('- 跳过：dry-run 使用长稿 fixture，合规层跳过（真实出稿会对短视频稿强制过此门禁）。');
  } else if (compliance) {
    lines.push(`- 结果：${compliance.passed ? 'PASS' : 'FAIL'}  block=${compliance.blockCount} warn=${compliance.warnCount}｜赚钱类词密度 ${(compliance.densityRatio * 100).toFixed(2)}%`);
    for (const f of compliance.findings) {
      lines.push(`  - [${f.level}] ${f.group}：${f.hits.join('、')}  <- ${f.reason}`);
    }
    if (!compliance.findings.length) lines.push('  - （无命中）');
  } else {
    lines.push('- （无合规结果记录）');
  }
  lines.push('');

  // 门禁五：新系列铁律
  lines.push('## 门禁五 · 新系列铁律（全新系列的第一次讲述，不许有「上一期」）');
  if (!series) {
    lines.push('- （无结果记录）');
  } else if (series.clean) {
    lines.push('- 结果：PASS ✅ 未出现期号/计号/系列名/「上次讲过」「我当时录」「那一期」「私信我N计」。');
  } else {
    lines.push(`- 结果：FAIL ❌ 命中 ${series.hits.length} 类旧系列引用：`);
    for (const h of series.hits) lines.push(`  - [${h.label}] 「${h.match}」 ← ${h.sentence}`);
  }
  lines.push('');

  // 门禁六：装置轮换 + 停用装置
  lines.push('## 门禁六 · 装置轮换（装置保留，表面写法必须每期换）');
  if (!deviceReuse) {
    lines.push('- （无结果记录）');
  } else {
    lines.push(`- 历史对比池：${deviceReuse.historyDocCount} 篇${deviceReuse.historyDocCount ? '' : '（池子为空时轮换判定恒 PASS，但「停用装置」照拦）'}`);
    lines.push(`- 结果：${deviceReuse.clean ? 'PASS ✅' : 'FAIL ❌'}`);
    const banned = deviceReuse.banned || [];
    if (banned.length) {
      lines.push('- ❌ 命中**停用装置**（与历史池无关，写了就是废稿）：');
      for (const b of banned) {
        lines.push(`  - 【${b.deviceName}】命中「${b.match}」 ← ${b.sentence}`);
        lines.push(`    停用理由：${b.reason}`);
      }
    } else {
      lines.push('- 停用装置（受众分流三类人）：✅ 未命中');
    }
    if (deviceReuse.reused && deviceReuse.reused.length) {
      lines.push('- ❌ 跨期复用的表面写法：');
      for (const r of deviceReuse.reused) {
        lines.push(`  - 【${r.deviceName}】${r.scope === 'device' ? '整个手法近期用过' : '同一句表面写法复用'}：「${r.match}」，历史里也有：${r.docs.join('、')}`);
      }
    } else {
      lines.push('- 跨期复用：✅ 无');
    }
    if (deviceReuse.current && deviceReuse.current.length) {
      lines.push(`- 本期用到的装置指纹 ${deviceReuse.current.length} 处：${deviceReuse.current.map((c) => c.deviceName + '/' + c.patternId).join('、')}`);
    }
  }
  lines.push('');

  // 门禁七：口播词域（书面词）
  lines.push('## 门禁七 · 口播词域（书面/报告词禁入口播）');
  if (!written) {
    lines.push('- （无结果记录）');
  } else {
    lines.push(`- 结果：${written.passed ? 'PASS ✅' : 'FAIL ❌'}  block=${written.blockCount} warn=${written.warnCount}`);
    if (written.blockHits.length) {
      lines.push('- ❌ block 级（出现即打回）：');
      for (const h of written.blockHits) lines.push(`  - 「${h.word}」x${h.count} → ${h.spoken.length ? h.spoken.join(' / ') : '换成口语说法'}`);
    }
    if (written.warnHits.length) {
      lines.push('- ⚠️ warn 级（入报告不拦稿，能换就换）：');
      for (const h of written.warnHits) lines.push(`  - 「${h.word}」x${h.count} → ${h.spoken.length ? h.spoken.join(' / ') : '换成口语说法'}`);
    }
    if (!written.blockHits.length && !written.warnHits.length) lines.push('- ✅ 无书面词命中');
  }
  lines.push('');

  // 门禁八：篇章层（跨稿骨架撞句 + 句长节奏）
  lines.push('## 门禁八 · 篇章层（跨稿骨架撞句 + 句长节奏，warn 级只报不拦）');
  if (!skeleton || skeleton.skipped) {
    lines.push(`- 跨稿骨架撞句：跳过（${(skeleton && skeleton.reason) || '无历史稿池'}）`);
  } else {
    lines.push(`- 跨稿骨架撞句：${skeleton.passed ? 'PASS ✅' : 'warn ⚠️'} 本期 vs 历史共 ${skeleton.count} 对（上限 ${skeleton.maxPairs}，归一化 5-gram Jaccard ≥ ${skeleton.threshold}）`);
    for (const p of (skeleton.pairs || []).slice(0, 6)) {
      const other = p.a === '本期' ? p.b : p.a;
      const mine = p.a === '本期' ? p.aSentence : p.bSentence;
      const theirs = p.a === '本期' ? p.bSentence : p.aSentence;
      lines.push(`  - [${p.jaccard}] 「${mine}」 ← 撞《${other}》的「${theirs}」`);
    }
  }
  if (aiFlavor.rhythm) {
    const R = aiFlavor.rhythm;
    lines.push(`- 句长节奏：均长 ${fmt(R.mean)} 字｜CV ${fmt(R.cv)}｜短句(≤15字) ${(R.shortRatio * 100).toFixed(1)}%｜极短句(<10字) ${(R.veryShortRatio * 100).toFixed(1)}%｜长句(>35字) ${(R.longRatio * 100).toFixed(1)}%｜最长 ${R.maxLen} 字`);
    lines.push(`- 段级口径：${R.paragraphCount} 段（${R.paragraphMode === 'window8' ? '一句一行稿，段级指标改用 8 句滑动块' : '按空行切段'}）`);
    if (R.ceilingTruncated) {
      lines.push('  - ⚠️ 疑似被 50 字硬上限削平：[45,50] 区间有 ' + R.nearCeiling + ' 句且无一句超 50。句长分布被右侧截断，是「读着太齐」的直接来源。');
    }
  }
  lines.push('');

  // 门禁九：LLM 二审
  lines.push('## 门禁九 · LLM 二审（空洞金句 / 讲述者立场 / 撞骨架，warn 级只报不拦）');
  if (!review) {
    lines.push('- （无结果记录）');
  } else if (review.skipped) {
    lines.push(`- 跳过：${review.reason || '未开启'}`);
  } else if (!review.ran) {
    lines.push(`- 未跑成：${review.error || '未知原因'}（二审是加分项，跑不成不拦稿）`);
  } else if (review.verdict === 'unparsed') {
    lines.push(`- ⚠️ 模型输出解析失败：${review.parseError}`);
  } else if (review.verdict === 'pass' && !review.issues.length) {
    lines.push('- 结果：PASS ✅ 空洞金句 / 讲述者立场 / 撞骨架 三项均无命中。');
  } else {
    lines.push(`- 结果：⚠️ 命中 ${review.issues.length} 条${review.rewritten ? '（已做过一次定向重写，下列为重写后仍在的）' : ''}：`);
    for (const i of review.issues) {
      lines.push(`  - 【${REVIEW_TYPE_LABEL[i.type] || i.type}】「${i.quote}」`);
      if (i.why) lines.push(`    问题：${i.why}`);
      if (i.fix) lines.push(`    建议：${i.fix}`);
    }
    lines.push('  - 说明：这三条正则判不了，交模型判；命中只入报告，由用户终审定夺，不拦稿。');
  }
  lines.push('');

  // 落盘自查
  lines.push('## 落盘自查');
  lines.push(`- 口播↔script 一致性（脚本比对，去空白）：✅ 通过，共 ${consistency.segCount} 段`);
  if (overlong.length) {
    lines.push(`- ⚠️ 超 60 字长句 ${overlong.length} 处（字幕条可能排不下，建议人工再拆）：`);
    for (const o of overlong.slice(0, 5)) lines.push(`  - ${o.len}字：${o.text.slice(0, 60)}…`);
  } else {
    lines.push('- 单句长度：✅ 均在 60 字内');
  }
  lines.push('');
  lines.push('---');
  lines.push('终审抽检依据：`docs/信任配方-保留清单.md`。交付视频管线依据：`docs/交接口规范.md` + remotion `film-input-spec.md`。');
  lines.push('');
  return lines.join('\n');
}
