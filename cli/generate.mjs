#!/usr/bin/env node
// 文案工坊 · 生成 CLI（第一档：已有事实卡的 filmId 直接成稿）。
//
// 用法：
//   node cli/generate.mjs --style <styleId> --order <工单json路径> --out <输出目录> [--dry-run]
//
// 契约：零交互、日志走 stdout/stderr（中文）、退出码 0=成功 / 非0=失败且 stderr 给人话原因、
//       幂等（同工单重跑覆盖输出）。模型密钥读环境变量 STYLE_LLM_API_KEY。
//
// 产出到 --out：script.txt（纯口播）+ storyboard.md（画面驱动分段稿，口播与 script 逐字一致）
//              + generation-report.md（门禁结果/用词层警告/信任配方自查/事实卡来源）。
//
// 质量铁律：事实卡不存在 → 非0退出（拒绝裸生成）；产出永远是草稿态（报告头写明「待用户终审」）。
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, isAbsolute, resolve as pathResolve } from 'node:path';
import { loadOrder, resolveStyle, loadHistoryPool, InputError, CollectError, LENGTH_PRESETS, DEFAULT_LENGTH_PRESET } from './lib/inputs.mjs';
import { buildSystemPrompt, knowledgeInjectedTitles } from './lib/prompt.mjs';
import { resolveLlmConfig, describeConfig, callModel, LlmError } from './lib/llm.mjs';
import { fixtureRaw, fixtureKnowledgePack } from './lib/fixture.mjs';
import { resolveKnowledgePack, validateKnowledgePack, knowledgeLogLine, KnowledgeError } from './lib/knowledge.mjs';
import {
  parseSegments, normalizeSpoken, splitToSentences,
  renderStoryboard, renderScript, verifyConsistency, overlongSentences, SpokenError
} from './lib/spoken.mjs';
import {
  runAiFlavor, aiFlavorFeedback, runStyleFloor, styleFloorFeedback,
  runLexicon, trustSelfCheck, runCompliance, complianceFeedback,
  checkSelfIdentity, selfIdentityFeedback,
  runSeriesReference, seriesReferenceFeedback, runDeviceReuse, deviceReuseFeedback,
  runWrittenWords, writtenWordFeedback, runSkeleton, skeletonFeedback
} from './lib/gates.mjs';
import { runLlmReview, reviewFeedback } from './lib/review.mjs';
import { renderReport } from './lib/report.mjs';

const MAX_RETRIES = 3;
const log = (...a) => console.log(...a);
const err = (...a) => console.error(...a);

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--style') out.style = argv[++i];
    else if (a === '--order') out.order = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--no-llm-review') out.noLlmReview = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else throw new InputError(`未知参数：${a}`);
  }
  return out;
}

const USAGE = `用法: node cli/generate.mjs --style <styleId> --order <工单json路径> --out <输出目录> [--dry-run] [--no-llm-review]
  --style     风格 id（如 qian17 / banfo），须与工单 styleId 一致。
  --order     工单 json 路径。字段：filmId, styleId, topic, points[], assetsHint, audience, mode(topic|rewrite, rewrite附rewriteSourcePath), 可选 factCardPath, 可选 lengthPreset(short|standard|long, 缺省 standard)。
  --out       输出目录（会创建；同工单重跑覆盖 script.txt / storyboard.md / generation-report.md）。
  --dry-run   不调模型，用内置 fixture 走完全链路（无密钥自测 / 联调）。dry-run 一律跳过 LLM 二审。
  --no-llm-review  关掉 LLM 二审（门禁九）。二审只在本地八道门全过后跑一次，命中最多做一次定向重写，仍命中只入报告不拦稿。
环境变量：STYLE_LLM_API_KEY(必填) STYLE_LLM_BASE_URL(可选) STYLE_LLM_MODEL(可选) STYLE_LLM_PROVIDER(anthropic默认|openai)。`;

// 一次「解析→规范化→拆句」，返回 { segs（含 sentences）, scriptText }。
function assemble(rawOutput) {
  const parsed = parseSegments(rawOutput);
  const segs = parsed.map((s) => {
    const norm = normalizeSpoken(s.kou);
    const sentences = splitToSentences(norm);
    return { ...s, sentences };
  });
  const scriptText = renderScript(segs);
  return { segs, scriptText };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { log(USAGE); process.exit(0); }
  if (!args.style || !args.order || !args.out) {
    err('缺参数。\n' + USAGE);
    process.exit(2);
  }

  // 1) 工单 + 风格一致性
  const order = loadOrder(args.order);
  if (order.styleId && order.styleId !== args.style) {
    throw new InputError(`--style「${args.style}」与工单 styleId「${order.styleId}」不一致。请对齐后重跑。`);
  }
  const styleId = args.style;
  order.styleId = styleId;
  if (order._lengthPresetWarn) log(`⚠️ ${order._lengthPresetWarn}`);

  const preset = LENGTH_PRESETS[order.lengthPreset] || LENGTH_PRESETS[DEFAULT_LENGTH_PRESET];
  const shortForm = preset.shortForm;

  // 2) 组装系统提示（内部完成 风格档案定位 + 事实卡定位；事实卡不存在会在此抛错 → 非0退出）
  log(`[1/6] 读取工单、事实卡与知识包…（filmId=${order.filmId}, 风格=${styleId}, 模式=${order.mode}）`);
  // 落点先算出来：装置轮换门禁要靠它反推同风格的兄弟影片当历史对比池（见 loadHistoryPool 注释）。
  const outDir = isAbsolute(args.out) ? args.out : pathResolve(process.cwd(), args.out);
  const history = loadHistoryPool(order, { outDir, styleId });
  log(`      历史稿对比池：${history.count ? `${history.count} 篇（${history.source}）` : '空 —— ' + history.source}`);

  // 2.5) 知识包（三输入之三，2026-09-04 恢复强制 —— 见 DECISIONS.md 同日条目）。
  // 硬停口径：零结果 / 知识库不可访问 / 空包，一律非 0 退出，且**在落盘之前**——这里还没写任何文件。
  // --dry-run 走内置夹具包，绝不起 python（联调机器上多半没有 .venv、也没有知识库）。
  let knowledge;
  try {
    if (args.dryRun && order.knowledgePackPath) {
      // dry-run 但工单点名了包：照读照验（读本地文件不用起 python），别让 --dry-run 变成绕开校验的后门。
      knowledge = resolveKnowledgePack(order, { log: (m) => log(`      ${m}`) });
    } else if (args.dryRun) {
      const pack = fixtureKnowledgePack();
      knowledge = {
        ...validateKnowledgePack(pack, '（--dry-run 内置夹具包）'),
        path: '（--dry-run 内置夹具包，未检索真实知识库）',
        source: 'dry-run 内置夹具',
        built: false
      };
    } else {
      knowledge = resolveKnowledgePack(order, { log: (m) => log(m.startsWith('  ') ? m : `      ${m}`) });
    }
  } catch (e) {
    if (e instanceof KnowledgeError) {
      err('✗ 知识包这一关没过，已停止生成（未落任何稿件文件）：\n' + e.message);
      process.exit(1);
    }
    throw e;
  }
  log(`      ${knowledgeLogLine(knowledge)}`);
  if (knowledge.coverageWarning) {
    log(`      ⚠️ 知识包覆盖度告警：${knowledge.coverageWarning}`);
  }
  const knowledgeInjected = knowledgeInjectedTitles(knowledge.pack);

  const built = buildSystemPrompt(order, {
    history: history.docs, historyNote: history.count ? '' : history.source, knowledge: knowledge.pack
  });
  if (built.usedDevices.length) {
    log(`      近期已用句式：${built.usedDevices.length} 条已注入提示词（本期禁止复用）。`);
  }
  log(`      事实卡命中：${built.factCardSource}`);
  log(`      事实卡路径：${built.factCardPath}`);
  if (built.factCardDraft) {
    log('      ⚠️ 事实卡为机器草稿，终审时请重点核对数字（报告顶部已加警示）。');
  }
  if (built.style.status !== '定版') {
    log(`      ⚠️ 风格「${built.style.name}」注册状态为「${built.style.status}」，产出仅供内部试用。`);
  }
  log(`      篇幅档位：${preset.label}｜目标口播 ${preset.min}–${preset.max} 字｜形态：${shortForm ? '短视频（走平台合规门禁）' : '长视频（照旧，不走合规层）'}`);

  const nowStamp = new Date().toLocaleString('zh-CN', { hour12: false });

  // 3) 取分段稿：dry-run 用 fixture；否则调模型（带 AI 味重写重试）
  let rawOutput;
  let assembled;
  let aiFlavor;
  let styleFloor = null;   // 风格标志下限门（门禁十）：全是下限，与 AI 味门方向相反
  let compliance = null;   // 短视频合规门禁结果（仅 short 档；dry-run 长稿 fixture 记 { skipped:true }）
  let series = null;       // 新系列铁律结果（模型路径硬拦截；dry-run 只报不拦）
  let written = null;      // 口播词域结果（block 级硬拦截）
  let deviceReuse = null;  // 装置轮换结果（历史池为空时恒 PASS）
  let retries = 0;
  let modelLabel;
  let providerLabel = '';

  let skeleton = null;      // 跨稿骨架撞句（warn 级，只入报告）
  let review = { skipped: true, reason: '未跑', verdict: 'skipped', issues: [] };  // LLM 二审（门禁九）
  let llmCfg = null;

  if (args.dryRun) {
    log('[2/6] --dry-run：使用内置 fixture 稿件（不调模型）。');
    rawOutput = fixtureRaw();
    assembled = assemble(rawOutput);
    aiFlavor = runAiFlavor(assembled.scriptText, built.style.ip, order.lengthPreset);
    modelLabel = 'dry-run fixture';
    log(`[3/6] AI 味门禁：${aiFlavor.passed ? 'PASS' : 'FAIL'}（block=${aiFlavor.blockCount} warn=${aiFlavor.warnCount}）`);
    if (!aiFlavor.passed) {
      err('内置 fixture 竟未过 AI 味门禁，属程序问题：\n' + aiFlavorFeedback(aiFlavor));
      process.exit(1);
    }
    styleFloor = runStyleFloor(assembled.scriptText, built.style.ip);
    log(`      风格标志下限门：${styleFloor.skipped ? '跳过（' + styleFloor.reason + '）' : (styleFloor.passed ? 'PASS' : 'FAIL') + `（block=${styleFloor.blockCount} warn=${styleFloor.warnCount}）`}`);
    if (!styleFloor.skipped && !styleFloor.passed) {
      err('内置 fixture 未过风格标志下限门，属程序问题（夹具要跟着规则一起改）：\n' + styleFloorFeedback(styleFloor));
      process.exit(1);
    }
    if (shortForm) {
      log('      短视频合规门禁：dry-run 使用长稿 fixture，合规层跳过。');
      compliance = { skipped: true };
    }
    // 新系列/装置轮换/书面词：内置 fixture 2026-09-03 已按全部新规则重写，这三道门必须真过。
    // 过不了就是夹具与规则脱节（"名不副实"），属程序问题，直接非 0 退出，别让 --dry-run 假绿。
    series = runSeriesReference(assembled.scriptText);
    written = runWrittenWords(assembled.scriptText);
    deviceReuse = runDeviceReuse(assembled.scriptText, history.docs);
    skeleton = runSkeleton(assembled.scriptText, history.docs);
    log(`      新系列铁律：${series.clean ? 'PASS' : 'FAIL'}${series.clean ? '' : ' 命中：' + series.hits.map((h) => h.match).join('、')}`);
    log(`      口播词域：${written.passed ? 'PASS' : 'FAIL'}${written.passed ? '' : ' 命中：' + written.blockHits.map((h) => h.word).join('、')}`);
    log(`      装置轮换：${deviceReuse.clean ? 'PASS' : 'FAIL'}（对比池 ${deviceReuse.historyDocCount} 篇）${deviceReuse.clean ? '' : '，命中停用装置/复用：' + [...deviceReuse.banned.map((b) => b.deviceName), ...deviceReuse.reused.map((r) => r.deviceName)].join('、')}`);
    log(`      跨稿骨架撞句：${skeleton.skipped ? '跳过（' + skeleton.reason + '）' : (skeleton.passed ? 'PASS' : 'warn') + ` ${skeleton.count} 对`}`);
    // 硬失败只认「夹具自己的毛病」：旧系列引用、书面词、命中停用装置——这三条与历史池无关，
    // 夹具过不了就是夹具没跟着规则改。跨期复用是池子相关的（真实 out 目录里有兄弟影片时才会命中），
    // 那不是夹具的错，只 warn。
    const dryFails = [];
    if (!series.clean) dryFails.push('新系列铁律：\n' + seriesReferenceFeedback(series));
    if (!written.passed) dryFails.push('口播词域：\n' + writtenWordFeedback(written));
    if (deviceReuse.banned.length) dryFails.push('命中停用装置：\n' + deviceReuseFeedback(deviceReuse));
    if (deviceReuse.reused.length) {
      log('      ⚠ 装置句式与历史池有重合（夹具是固定样例，与本次对比池撞上属正常，dry-run 不拦）。');
    }
    if (dryFails.length) {
      err('内置 fixture 未过门禁，属程序问题（夹具要跟着规则一起改）：\n' + dryFails.join('\n'));
      process.exit(1);
    }
    review = { skipped: true, reason: 'dry-run 不调模型，LLM 二审跳过', verdict: 'skipped', issues: [] };
    log('      LLM 二审：跳过（dry-run 不调模型）。');
  } else {
    const cfg = resolveLlmConfig({ dryRun: false });
    llmCfg = cfg;
    providerLabel = cfg.provider;
    modelLabel = cfg.model || (cfg.provider === 'claude-code' ? '默认（本机 Claude Code）' : cfg.model);
    log('[2/6] ' + describeConfig(cfg));
    const messages = [{ role: 'user', content: '请严格按系统提示的风格 DNA、信任配方、受众锁与事实卡，产出完整的画面驱动分段稿。只输出分段块，格式照系统提示。' }];
    // AI 味门禁 + （short 档）短视频合规门禁，共享同一 3 次重写上限。
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      log(`      调用模型（第 ${attempt} 次）…`);
      rawOutput = await callModel({ cfg, system: built.system, messages });
      assembled = assemble(rawOutput);
      aiFlavor = runAiFlavor(assembled.scriptText, built.style.ip, order.lengthPreset);
      log(`[3/6] AI 味门禁（第 ${attempt} 次）：${aiFlavor.passed ? 'PASS' : 'FAIL'}（block=${aiFlavor.blockCount} warn=${aiFlavor.warnCount}）`);
      // 风格标志下限门：AI 味门查「有没有写出 AI 腔」（全是上限），这道门查「这个 IP 的标志
      // 动作有没有被删干净」（全是下限）。两道门必须一起过——只过 AI 味门的稿子就是上一批
      // 那五篇：block=0 / warn=0 全绿，风格没了。
      styleFloor = runStyleFloor(assembled.scriptText, built.style.ip);
      log(`      风格标志下限门（第 ${attempt} 次）：${styleFloor.skipped ? '跳过（' + styleFloor.reason + '）' : (styleFloor.passed ? 'PASS' : 'FAIL') + `（block=${styleFloor.blockCount} warn=${styleFloor.warnCount}）${styleFloor.passed ? '' : '，缺：' + styleFloor.findings.filter((x) => x.level === 'block').map((x) => x.metric).join('、')}`}`);
      if (shortForm) {
        compliance = runCompliance(assembled.scriptText);
        log(`      短视频合规门禁（第 ${attempt} 次）：${compliance.passed ? 'PASS' : 'FAIL'}（block=${compliance.blockCount} warn=${compliance.warnCount}，赚钱类词密度 ${(compliance.densityRatio * 100).toFixed(2)}%）`);
      }
      // 叙述者身份硬拦截：产出自称目标 IP 名即打回，并入本重写循环。
      const identity = checkSelfIdentity(assembled.scriptText);
      log(`      叙述者身份硬拦截（第 ${attempt} 次）：${identity.clean ? 'PASS' : 'FAIL'}${identity.clean ? '' : `（自称命中：${identity.hits.join('、')}）`}`);
      // 新系列铁律：全新系列不许带期号/系列名/「上次讲过」。命中即打回。
      series = runSeriesReference(assembled.scriptText);
      log(`      新系列铁律（第 ${attempt} 次）：${series.clean ? 'PASS' : 'FAIL'}${series.clean ? '' : `（旧系列引用：${series.hits.map((h) => h.match).join('、')}）`}`);
      // 口播词域：书面/报告词 block 级名单。
      written = runWrittenWords(assembled.scriptText);
      log(`      口播词域（第 ${attempt} 次）：${written.passed ? 'PASS' : 'FAIL'}（block=${written.blockCount} warn=${written.warnCount}）${written.passed ? '' : `命中：${written.blockHits.map((h) => h.word).join('、')}`}`);
      // 装置轮换：同一装置的同一句表面写法跨期复用即打回；历史池为空时恒 PASS。
      deviceReuse = runDeviceReuse(assembled.scriptText, history.docs);
      const devHit = [...deviceReuse.banned.map((b) => b.deviceName + '（已停用）'), ...deviceReuse.reused.map((r) => r.deviceName)];
      log(`      装置轮换（第 ${attempt} 次）：${deviceReuse.clean ? 'PASS' : 'FAIL'}（对比池 ${deviceReuse.historyDocCount} 篇）${deviceReuse.clean ? '' : `命中：${devHit.join('、')}`}`);
      // 跨稿骨架撞句：warn 级，只入报告，不参与 gatesPassed（调研点名它误伤风险中高，稳定后再考虑升 block）。
      skeleton = runSkeleton(assembled.scriptText, history.docs);
      log(`      跨稿骨架撞句（第 ${attempt} 次）：${skeleton.skipped ? '跳过（' + skeleton.reason + '）' : `${skeleton.count} 对（上限 ${skeleton.maxPairs}，warn 级不拦稿）`}`);
      const gatesPassed = aiFlavor.passed && styleFloor.passed && (!shortForm || compliance.passed) && identity.clean
        && series.clean && written.passed && deviceReuse.clean;
      if (gatesPassed) break;
      retries = attempt;
      if (attempt > MAX_RETRIES) {
        const reasons = [];
        if (!aiFlavor.passed) reasons.push(`AI 味（block=${aiFlavor.blockCount}）：\n${aiFlavorFeedback(aiFlavor)}`);
        if (!styleFloor.passed) reasons.push(`风格标志下限（block=${styleFloor.blockCount}）：\n${styleFloorFeedback(styleFloor)}`);
        if (shortForm && !compliance.passed) reasons.push(`短视频合规（block=${compliance.blockCount}）：\n${complianceFeedback(compliance)}`);
        if (!identity.clean) reasons.push(`叙述者身份自称（${identity.hits.join('、')}）：\n${selfIdentityFeedback(identity)}`);
        if (!series.clean) reasons.push(`旧系列引用（${series.hits.map((h) => h.match).join('、')}）：\n${seriesReferenceFeedback(series)}`);
        if (!written.passed) reasons.push(`书面词混进口播（${written.blockHits.map((h) => h.word).join('、')}）：\n${writtenWordFeedback(written)}`);
        if (!deviceReuse.clean) reasons.push(`装置句式跨期复用（${deviceReuse.reused.map((r) => r.deviceName).join('、')}）：\n${deviceReuseFeedback(deviceReuse)}`);
        err(`门禁连续 ${MAX_RETRIES} 次重写仍未通过。已放弃，未落盘成稿。超标项：\n${reasons.join('\n')}`);
        process.exit(1);
      }
      const fb = [];
      if (!aiFlavor.passed) fb.push(`【AI 味硬伤】请修正：\n${aiFlavorFeedback(aiFlavor)}`);
      if (!styleFloor.passed) fb.push(`【风格标志缺失】这一版不是写多了，是**写少了**——这个 IP 的标志动作被删掉了。按提示词「风格标志」那一节把下面几层加回去（加，不是删）：\n${styleFloorFeedback(styleFloor)}`);
      if (shortForm && !compliance.passed) {
        fb.push('【短视频合规硬伤】把下列命中的收益数字 / 收益推算 / 暴富话术 / 绝对化承诺 / 站外导流，改写成悬念、反差、信息缺口、损失厌恶、互动钩子、消费阶梯（是换形式，不是删诱导、不是截短）：\n' + complianceFeedback(compliance));
      }
      if (!identity.clean) fb.push(`【叙述者身份硬伤】请修正：\n${selfIdentityFeedback(identity)}`);
      if (!series.clean) fb.push(`【新系列铁律硬伤】请修正：\n${seriesReferenceFeedback(series)}`);
      if (!written.passed) fb.push(`【口播词域硬伤】请修正：\n${writtenWordFeedback(written)}`);
      if (!deviceReuse.clean) fb.push(`【装置轮换硬伤】装置保留、写法必须换：\n${deviceReuseFeedback(deviceReuse)}`);
      log('      门禁未过，反馈模型重写…');
      messages.push({ role: 'assistant', content: rawOutput });
      messages.push({ role: 'user', content: `上一版未过门禁，请修正后**重出完整分段稿**（保持事实卡口径与格式不变）：\n${fb.join('\n\n')}` });
    }

    // --- 门禁九 · LLM 二审（本地各门全过之后才跑，省 token）---
    // 判三件正则判不了的事：空洞金句 / 讲述者有没有立场 / 与历史稿撞骨架。
    // 命中做**最多一次**定向重写（不进上面的 3 次循环）；重写后仍命中就只写进报告，不 fail、不拦稿。
    if (args.noLlmReview) {
      review = { skipped: true, reason: '已用 --no-llm-review 关闭', verdict: 'skipped', issues: [] };
      log('      LLM 二审：已用 --no-llm-review 关闭。');
    } else {
      log('      LLM 二审（门禁九）：调用一次…');
      review = await runLlmReview({ cfg: llmCfg, scriptText: assembled.scriptText, history: history.docs });
      if (!review.ran) {
        log(`      LLM 二审：未跑成（${review.error || '未知原因'}）。二审是加分项，不拦稿，继续落盘。`);
      } else if (review.verdict === 'unparsed') {
        log(`      LLM 二审：模型输出解析失败（${review.parseError}）。只入报告，不拦稿。`);
      } else if (!review.issues.length) {
        log('      LLM 二审：PASS（空洞金句 / 讲述者立场 / 撞骨架 三项均无命中）。');
      } else {
        log(`      LLM 二审：命中 ${review.issues.length} 条，做一次定向重写（只改这几处，不进 3 次循环）…`);
        try {
          const beforeRaw = rawOutput;
          const beforeAssembled = assembled;
          messages.push({ role: 'assistant', content: rawOutput });
          messages.push({ role: 'user', content: `本稿已过全部本地门禁，只剩终审读者挑出来的几处问题。请**只改这几处**、重出完整分段稿（格式与事实卡口径不变）：\n${reviewFeedback(review)}` });
          const fixedRaw = await callModel({ cfg: llmCfg, system: built.system, messages });
          const fixedAssembled = assemble(fixedRaw);
          // 定向重写不许把本地门禁改坏：改坏了就退回重写前那版。
          const f = {
            ai: runAiFlavor(fixedAssembled.scriptText, built.style.ip, order.lengthPreset),
            sf: runStyleFloor(fixedAssembled.scriptText, built.style.ip),
            id: checkSelfIdentity(fixedAssembled.scriptText),
            sr: runSeriesReference(fixedAssembled.scriptText),
            ww: runWrittenWords(fixedAssembled.scriptText),
            dr: runDeviceReuse(fixedAssembled.scriptText, history.docs),
            cp: shortForm ? runCompliance(fixedAssembled.scriptText) : { passed: true }
          };
          const ok = f.ai.passed && f.sf.passed && f.id.clean && f.sr.clean && f.ww.passed && f.dr.clean && f.cp.passed;
          if (ok) {
            rawOutput = fixedRaw;
            assembled = fixedAssembled;
            aiFlavor = f.ai; styleFloor = f.sf; series = f.sr; written = f.ww; deviceReuse = f.dr;
            if (shortForm) compliance = f.cp;
            skeleton = runSkeleton(assembled.scriptText, history.docs);
            log('      LLM 二审定向重写：已采用（重写版仍过全部本地门禁）。复判一次…');
            const again = await runLlmReview({ cfg: llmCfg, scriptText: assembled.scriptText, history: history.docs });
            review = again.ran && again.verdict !== 'unparsed'
              ? { ...again, rewritten: true }
              : { ...review, rewritten: true, recheckFailed: again.error || again.parseError };
            log(`      LLM 二审复判：${review.issues.length ? `仍有 ${review.issues.length} 条，warn 入报告，不拦稿` : 'PASS'}`);
          } else {
            rawOutput = beforeRaw;
            assembled = beforeAssembled;
            review = { ...review, rewritten: false, rewriteRejected: '定向重写版把本地门禁改坏了，已退回重写前那版' };
            log('      LLM 二审定向重写：已丢弃（重写版反而没过本地门禁），保留重写前那版，二审命中项 warn 入报告。');
          }
        } catch (e) {
          review = { ...review, rewritten: false, rewriteRejected: `定向重写没跑成：${e && e.message ? e.message : e}` };
          log(`      LLM 二审定向重写没跑成（${e && e.message ? e.message : e}），二审命中项 warn 入报告，不拦稿。`);
        }
      }
    }
  }

  // 4) 用词层（warn）+ 信任配方自查
  log('[4/6] 用词层与信任配方自查…');
  // 口播词域命中并进用词层结果，保证它们无条件出现在 generation-report.md 的用词层小节（warn 入报告）。
  const writtenFinal = written || runWrittenWords(assembled.scriptText);
  const lexicon = runLexicon(assembled.scriptText, built.style, writtenFinal);
  if (writtenFinal.warnCount) {
    log(`      ⚠️ 书面词（warn 级，入报告不拦稿）：${writtenFinal.warnHits.map((h) => `${h.word}x${h.count}`).join('、')}`);
  }
  const trust = trustSelfCheck(assembled.scriptText);
  if (!trust.clean) {
    log('      ⚠️ 信任自查有命中（详见报告，需人工终审）：'
      + (trust.redlineHits.length ? ` 红线词[${trust.redlineHits.join('、')}]` : '')
      + (trust.signatureHits.length ? ` 招牌话术[${trust.signatureHits.join('、')}]` : '')
      + (trust.incomeHits.length ? ` 收入话术[${trust.incomeHits.join('、')}]` : ''));
  }
  // 招牌话术是硬拦截：出现即打回（非 dry-run 才拦，dry-run fixture 已保证干净）
  if (trust.signatureHits.length) {
    err(`产出命中招牌话术/来源原句硬拦截名单：${trust.signatureHits.join('、')}。已打回，未落盘。`);
    process.exit(1);
  }

  // 5) 落盘（幂等覆盖）
  log('[5/6] 落盘 script.txt / storyboard.md / generation-report.md…');
  mkdirSync(outDir, { recursive: true });

  const storyboardText = renderStoryboard(assembled.segs, {
    styleName: built.style.name, topic: order.topic, stamp: nowStamp, factCardSource: built.factCardSource
  });
  const scriptText = renderScript(assembled.segs);
  writeFileSync(join(outDir, 'script.txt'), scriptText, 'utf8');
  writeFileSync(join(outDir, 'storyboard.md'), storyboardText, 'utf8');

  // 6) 脚本级一致性校验（重读已写文件比对）
  log('[6/6] 口播↔script 一致性校验（脚本比对）…');
  const consistency = verifyConsistency(
    readFileSync(join(outDir, 'storyboard.md'), 'utf8'),
    readFileSync(join(outDir, 'script.txt'), 'utf8')
  );
  const overlong = overlongSentences(assembled.segs);

  const report = renderReport({
    order, style: built.style, factCardPath: built.factCardPath, factCardSource: built.factCardSource,
    factCardDraft: built.factCardDraft,
    mode: order.mode, aiFlavor, styleFloor, lexicon, trust, overlong, retries, consistency,
    model: modelLabel, provider: providerLabel, stamp: nowStamp,
    preset, compliance, series, deviceReuse, written: writtenFinal, skeleton, review,
    knowledge, knowledgeInjected
  });
  writeFileSync(join(outDir, 'generation-report.md'), report, 'utf8');

  const flat = scriptText.replace(/\s/g, '').length;
  if (!args.dryRun && (flat < preset.min || flat > preset.max)) {
    log(`      ⚠ 口播约 ${flat} 字，超出「${preset.label}」目标区间 ${preset.min}–${preset.max} 字（warn 级不拦稿，终审时留意篇幅）。`);
  }
  log(`\n✅ 完成（草稿态，待用户终审）。输出目录：${outDir}`);
  log(`   script.txt：${consistency.segCount} 段 / 约 ${flat} 字；AI 味 block=0 warn=${aiFlavor.warnCount}；` +
    `用词可疑 ${lexicon.available ? lexicon.suspiciousTypes + ' 种' : '（未跑）'}；重写重试 ${retries} 次。`);
  process.exit(0);
}

main().catch((e) => {
  if (e instanceof InputError || e instanceof LlmError || e instanceof SpokenError || e instanceof CollectError) {
    err(`✗ ${e.message}`);
    process.exit(1);
  }
  err('✗ 生成失败（未预期错误）：' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
