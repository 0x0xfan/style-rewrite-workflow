import { normalizeForComparison } from "../corpus/segment-markdown.mjs";

const grams = (text, size = 4) => {
  const normalized = normalizeForComparison(text);
  const result = new Set();
  for (let index = 0; index <= normalized.length - size; index += 1) result.add(normalized.slice(index, index + size));
  return result;
};

const jaccard = (left, right) => {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
};

const percentile = (numbers, ratio) => {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
};

export const assessSpokenSampleHealth = (corpus, { nearDuplicateThreshold = 0.52, openingLength = 18 } = {}) => {
  const unitGrams = corpus.units.map((unit) => ({ id: unit.id, grams: grams(unit.text) }));
  const nearDuplicatePairs = [];
  for (let left = 0; left < unitGrams.length; left += 1) {
    for (let right = left + 1; right < unitGrams.length; right += 1) {
      const similarity = Number(jaccard(unitGrams[left].grams, unitGrams[right].grams).toFixed(3));
      if (similarity >= nearDuplicateThreshold) {
        nearDuplicatePairs.push({ left_unit_id: unitGrams[left].id, right_unit_id: unitGrams[right].id, similarity });
      }
    }
  }

  const openingGroups = new Map();
  for (const unit of corpus.units) {
    const key = normalizeForComparison(unit.text).slice(0, openingLength);
    if (!key) continue;
    openingGroups.set(key, [...(openingGroups.get(key) || []), unit.id]);
  }
  const repeatedOpeningGroups = [...openingGroups.values()]
    .filter((unitIds) => unitIds.length >= 2)
    .map((unitIds) => ({ unit_ids: unitIds, count: unitIds.length }));

  const lengths = corpus.units.map((unit) => unit.character_count);
  const tooShortUnitIds = corpus.units.filter((unit) => unit.character_count < 180).map((unit) => unit.id);
  const warnings = [];
  if (nearDuplicatePairs.length > 0) warnings.push("发现近重复口播单元；需人工决定是否保留为不同版本或剔除其一。");
  if (tooShortUnitIds.length > 0) warnings.push("存在过短单元；它们不能单独支撑稳定风格结论。");
  if (corpus.units.length < 3) warnings.push("样本少于 3 条，只能生成探索性观察。");

  return {
    unit_count: corpus.units.length,
    character_distribution: {
      min: Math.min(...lengths),
      p50: percentile(lengths, 0.5),
      max: Math.max(...lengths),
      total: lengths.reduce((sum, value) => sum + value, 0),
    },
    near_duplicate_pairs: nearDuplicatePairs,
    repeated_opening_groups: repeatedOpeningGroups,
    too_short_unit_ids: tooShortUnitIds,
    grade: nearDuplicatePairs.length > 0 || tooShortUnitIds.length > 1 ? "warning" : "healthy",
    warnings,
    human_decision_required: nearDuplicatePairs.length > 0 || repeatedOpeningGroups.length > 0,
  };
};
