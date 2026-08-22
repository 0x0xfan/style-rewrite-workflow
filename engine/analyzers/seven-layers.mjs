import { confidenceForSupport } from "../contracts/spoken-dna.mjs";
import { normalizeForComparison } from "../corpus/segment-markdown.mjs";

const sentenceParts = (text) => text.split(/[。！？!?；;\n]+/).map((part) => part.trim()).filter(Boolean);
const unitIdsMatching = (units, predicate) => units.filter(predicate).map((unit) => unit.id);
const mean = (values) => values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));

const addCandidate = (rules, totalUnits, { id, layer, name, statement, unitIds, applicability, formula = null, risk = "low" }) => {
  if (unitIds.length < 2) return;
  rules.push({
    id,
    layer,
    name,
    statement,
    formula,
    applicability,
    non_applicability: "证据不足或不属于同一口播类型时，不得强行套用。",
    evidence_unit_ids: unitIds,
    confidence: confidenceForSupport(unitIds.length, totalUnits),
    risk,
    status: "candidate",
  });
};

export const analyzeSevenLayers = (corpus) => {
  const units = corpus.units;
  const totalUnits = units.length;
  const rules = [];
  const numberedMarker = /第[一二三四五六七八九十0-9]+(?:点|种|步)?/;
  const sentenceLengths = units.flatMap((unit) => sentenceParts(unit.text).map((sentence) => normalizeForComparison(sentence).length));
  const firstWindows = new Map(units.map((unit) => [unit.id, normalizeForComparison(unit.text).slice(0, 220)]));
  const lastWindows = new Map(units.map((unit) => [unit.id, normalizeForComparison(unit.text).slice(-260)]));
  const contains = (unit, pattern) => pattern.test(normalizeForComparison(unit.text));

  const l0 = {
    estimated_seconds: {
      min: Math.min(...units.map((unit) => unit.estimated_seconds)),
      average: mean(units.map((unit) => unit.estimated_seconds)),
      max: Math.max(...units.map((unit) => unit.estimated_seconds)),
    },
    average_sentence_characters: mean(sentenceLengths),
    note: "时长是按配置的口播字速估算，需在拥有真实音频后再校准。",
  };

  const painOrResultHooks = units.filter((unit) => /新手|不会|不知道|无从下手|踩坑|赚|收入|结果|问题/.test(firstWindows.get(unit.id))).map((unit) => unit.id);
  const promiseHooks = units.filter((unit) => /今天|教你|分享|讲|告诉你|整理/.test(firstWindows.get(unit.id))).map((unit) => unit.id);
  const closingAction = units.filter((unit) => /点赞|关注|回复|领取|下期|下个视频|下期见/.test(lastWindows.get(unit.id))).map((unit) => unit.id);
  const lifestyleResultIds = unitIdsMatching(units, (unit) => contains(unit, /一顿.{0,12}(饭|面|餐)|一杯.{0,12}(奶茶|咖啡)|生活费|零花钱/));
  addCandidate(rules, totalUnits, { id: "L1-R01", layer: "L1", name: "痛点或结果型开场", statement: "开场优先给新手卡点、结果落差或问题，让观众立刻知道继续观看的理由。", unitIds: painOrResultHooks, applicability: "入门、选品、项目拆解等实操型口播。", risk: "medium" });
  addCandidate(rules, totalUnits, { id: "L1-R02", layer: "L1", name: "开场承诺", statement: "在开场窗口内补充本期会讲清、会分享或会给出路径的承诺，再进入正文。", unitIds: promiseHooks, applicability: "需要完整方法教学的口播。" });
  addCandidate(rules, totalUnits, { id: "L1-R03", layer: "L1", name: "行动型结尾", statement: "结尾以互动、资料承接或下一期预告完成收束；只复用动作形态，不复用来源渠道或关键词。", unitIds: closingAction, applicability: "需要互动或后续内容承接的口播。", risk: "medium" });
  addCandidate(rules, totalUnits, { id: "L1-R04", layer: "L1", name: "生活化消费阶梯式结果对比", statement: "不用抽象的大数字硬压，而是把结果翻译成观众熟悉的日常消费或生活状态落差，让收益感更具体、更有画面。", formula: "把 [用户有证据的变化] 翻译为 [较紧的日常参照] → [更有余裕的日常参照]；参照必须是新稿自己的表达，不能复用来源比喻。", unitIds: lifestyleResultIds, applicability: "用户拥有可核验的结果，且允许使用克制的结果表达时。", risk: "high" });

  const frameworkIds = unitIdsMatching(units, (unit) => contains(unit, /分为|几个部分|[一二三四五六七八九十0-9]+个(部分|维度|关键点|方法)|第一[，、]/));
  const warningIds = unitIdsMatching(units, (unit) => contains(unit, /排雷|不要|不选|不做|避坑|注意/));
  const numberedIds = unitIdsMatching(units, (unit) => contains(unit, numberedMarker));
  const interactionIds = unitIdsMatching(units, (unit) => contains(unit, /点赞|收藏|截图|关注/));
  const warningBeforeMethodIds = unitIdsMatching(units, (unit) => {
    const normalized = normalizeForComparison(unit.text);
    const warningIndex = normalized.search(/排雷|不要|不选|不做|避坑|注意/);
    const methodIndex = normalized.search(numberedMarker);
    return warningIndex >= 0 && methodIndex >= 0 && warningIndex < methodIndex;
  });
  addCandidate(rules, totalUnits, { id: "L2-R01", layer: "L2", name: "框架后编号推进", statement: "先给出本期框架，再按编号逐点推进；每一点应承担一个明确动作。", unitIds: frameworkIds.filter((id) => numberedIds.includes(id)), applicability: "教程、清单、项目拆解类口播。" });
  addCandidate(rules, totalUnits, { id: "L2-R02", layer: "L2", name: "先排雷再给方法", statement: "涉及副业、选品或操作建议时，先说明风险和不建议项，再进入方法。", unitIds: warningBeforeMethodIds, applicability: "带有商业、平台或操作风险的主题。", risk: "high" });
  addCandidate(rules, totalUnits, { id: "L2-R03", layer: "L2", name: "中段互动节点", statement: "在一段高密度方法后插入一次与内容价值绑定的互动或保存提醒。", unitIds: interactionIds, applicability: "存在清单、步骤或可保存资料时。", risk: "medium" });

  const transitionTerms = ["今天", "接下来", "这里", "重点", "一定要", "记住", "最后"];
  const transitionCounts = Object.fromEntries(transitionTerms.map((term) => [term, units.reduce((sum, unit) => sum + (normalizeForComparison(unit.text).match(new RegExp(term, "g")) || []).length, 0)]));
  const contrastIds = unitIdsMatching(units, (unit) => contains(unit, /不是.{0,18}而是|很多人以为.{0,24}(其实|但)/));
  addCandidate(rules, totalUnits, { id: "L3-R01", layer: "L3", name: "口语推进词", statement: "用少量口语化推进词把段落串起来，避免书面长段落直接堆叠。", unitIds: unitIdsMatching(units, (unit) => transitionTerms.some((term) => normalizeForComparison(unit.text).includes(term))), applicability: "口播解释、编号方法之间的过渡。" });
  addCandidate(rules, totalUnits, { id: "L3-R02", layer: "L3", name: "反差解释句", statement: "用“不是…而是…”或“很多人以为…其实…”压缩解释，形成直接的口播反差。", unitIds: contrastIds, applicability: "纠正常见误解或解释判断标准时。" });

  const stanceIds = unitIdsMatching(units, (unit) => contains(unit, /底层逻辑|原因很简单|说白了|你想想|重点/));
  const lowBarrierIds = unitIdsMatching(units, (unit) => contains(unit, /新手|简单|直接|照着|一步|小白/));
  addCandidate(rules, totalUnits, { id: "L4-R01", layer: "L4", name: "先解释再行动", statement: "先用简短理由或底层逻辑解释“为什么”，随后给出下一步动作，避免只下结论。", unitIds: stanceIds, applicability: "判断、规则或方法建议。" });
  addCandidate(rules, totalUnits, { id: "L4-R02", layer: "L4", name: "降低新手行动门槛", statement: "面向新手时把复杂任务拆成可执行的小动作，并提示常见卡点。", unitIds: lowBarrierIds, applicability: "新手教学与流程拆解。" });

  const proofIds = unitIdsMatching(units, (unit) => contains(unit, /图片|截图|数据|榜单|表格|关键词|销量|搜索/));
  const saveIds = unitIdsMatching(units, (unit) => contains(unit, /暂停截图保存|截图保存|表格|清单/));
  addCandidate(rules, totalUnits, { id: "L5-R01", layer: "L5", name: "证据与操作素材提示", statement: "样本常在方法段调用数据、截图、榜单或表格等素材提示；改写时必须把每个素材明确绑定到其要证明的主张。", unitIds: proofIds, applicability: "出现事实主张、判断标准或操作路径时。", risk: "high" });
  addCandidate(rules, totalUnits, { id: "L5-R02", layer: "L5", name: "可保存素材位", statement: "只有清单、关键词、表格或步骤真正可操作时，才使用截图保存提示。", unitIds: saveIds, applicability: "清单式或表格式信息出现时。", risk: "medium" });

  const riskIds = unitIdsMatching(units, (unit) => contains(unit, /稳定赚|躺赚|收益|月入|翻倍|自动成交|多开账号|禁售|违规|假货|减肥/));
  addCandidate(rules, totalUnits, { id: "L6-R01", layer: "L6", name: "高风险语料隔离", statement: "样本中多次出现收益、平台、敏感操作、健康或侵权相关信号；这些只触发风险审阅，绝不构成可复用的新稿事实。", unitIds: riskIds, applicability: "所有商业、平台、健康、侵权或收益相关主题。", risk: "high" });

  return {
    layers: {
      L0: l0,
      L1: { pain_or_result_hook_unit_ids: painOrResultHooks, promise_hook_unit_ids: promiseHooks, action_closing_unit_ids: closingAction, lifestyle_result_unit_ids: lifestyleResultIds },
      L2: { framework_unit_ids: frameworkIds, warning_unit_ids: warningIds, warning_before_method_unit_ids: warningBeforeMethodIds, numbered_method_unit_ids: numberedIds, interaction_unit_ids: interactionIds },
      L3: { transition_term_counts: transitionCounts, contrast_unit_ids: contrastIds },
      L4: { explanation_first_unit_ids: stanceIds, low_barrier_unit_ids: lowBarrierIds },
      L5: { proof_cue_unit_ids: proofIds, save_cue_unit_ids: saveIds },
      L6: { risk_review_unit_ids: riskIds },
    },
    rules,
  };
};
