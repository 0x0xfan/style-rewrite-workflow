import { DNA_SCHEMA_VERSION, DRAFT_APPROVAL, SOURCE_BOUNDARY, assertDraftShape, assertFrameworkMap } from "../contracts/spoken-dna.mjs";

export const buildDraftSpokenDna = ({ corpus, health, analysis, styleId, displayName, frameworks = [] }) => {
  assertFrameworkMap(frameworks);
  const dna = {
    schema_version: DNA_SCHEMA_VERSION,
    profile_id: styleId,
    display_name: displayName,
    content_type: "中文短视频口播",
    status: "draft",
    approval: { ...DRAFT_APPROVAL },
    source_boundary: [...SOURCE_BOUNDARY],
    corpus: {
      corpus_id: corpus.corpus_id,
      unit_count: corpus.units.length,
      total_characters: corpus.units.reduce((sum, unit) => sum + unit.character_count, 0),
      segmentation_strategy: corpus.segmentation.strategy,
    },
    sample_health: health,
    layers: analysis.layers,
    rules: analysis.rules,
    frameworks,
    limitations: [
      "当前结论来自这一份口播语料；不同主题和时期需要补样本后再判断稳定性。",
      "估算时长不是音频测量结果，真实口播语速需以后续音频校准。",
      "候选规则只说明表达模式，不证明来源事实、合规性、效果或作者身份。",
    ],
  };
  assertDraftShape(dna);
  return dna;
};
