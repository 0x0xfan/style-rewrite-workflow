export const DNA_SCHEMA_VERSION = "2.0-draft";

export const SPOKEN_DNA_LAYERS = Object.freeze([
  { id: "L0", name: "口播规格" },
  { id: "L1", name: "钩子与落点" },
  { id: "L2", name: "结构路径" },
  { id: "L3", name: "口语与节奏" },
  { id: "L4", name: "说服与关系" },
  { id: "L5", name: "证据与素材位" },
  { id: "L6", name: "边界与风险" },
]);

export const DRAFT_APPROVAL = Object.freeze({
  state: "draft",
  requires_human_approval: true,
  approved_at: null,
  approved_by: null,
  note: "草稿只能用于人工审阅，不能作为正式仿写依据。",
});

export const SOURCE_BOUNDARY = Object.freeze([
  "DNA 只保存抽象规则、统计结果、置信度和单元锚点 ID。",
  "DNA 不保存来源原文段落、收益数字、案例、账号名、资料关键词、CTA 或平台操作事实。",
  "新稿只能使用用户另行提供并确认的事实、证据、素材与 CTA。",
]);

export const isApprovedDna = (dna) => dna?.approval?.state === "approved" && dna?.approval?.requires_human_approval === false;

export const confidenceForSupport = (supportCount, totalUnits) => {
  const ratio = totalUnits > 0 ? supportCount / totalUnits : 0;
  if (supportCount < 2) return { label: "待验证", value: 0.25, support_ratio: ratio };
  if (ratio >= 0.75) return { label: "高", value: 0.8, support_ratio: ratio };
  if (ratio >= 0.5) return { label: "中", value: 0.6, support_ratio: ratio };
  return { label: "低", value: 0.4, support_ratio: ratio };
};

export const assertDraftShape = (dna) => {
  if (dna?.approval?.state !== "draft" || dna?.approval?.requires_human_approval !== true) {
    throw new Error("口播 DNA 在人工确认前必须保持 draft 且 requires_human_approval=true。");
  }
  if (!Array.isArray(dna?.rules)) throw new Error("DNA 缺少规则列表。");
  for (const rule of dna.rules) {
    if (rule.status === "candidate" && rule.evidence_unit_ids.length < 2) {
      throw new Error(`候选规则 ${rule.id} 缺少至少两个证据锚点。`);
    }
  }
  return true;
};

export const assertFrameworkMap = (frameworks) => {
  if (!Array.isArray(frameworks)) throw new Error("框架库必须是数组。 ");
  for (const framework of frameworks) {
    if (!framework.id || !framework.name || !Array.isArray(framework.beats) || framework.beats.length < 3) {
      throw new Error("每个口播框架都必须有 ID、名称和至少三个节拍。 ");
    }
    if (framework.status === "candidate" && (!Array.isArray(framework.evidence_unit_ids) || framework.evidence_unit_ids.length < 2)) {
      throw new Error(`候选框架 ${framework.id} 缺少至少两个证据锚点。`);
    }
  }
  return true;
};
