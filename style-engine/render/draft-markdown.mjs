import { SPOKEN_DNA_LAYERS } from "../contracts/spoken-dna.mjs";

const ruleLine = (rule) => [
  `### ${rule.id}｜${rule.name}`,
  "",
  `- 候选规则：${rule.statement}`,
  ...(rule.formula ? [`- 句式公式：${rule.formula}`] : []),
  `- 适用：${rule.applicability}`,
  `- 不适用：${rule.non_applicability}`,
  `- 证据锚点：${rule.evidence_unit_ids.join("、")}`,
  `- 置信度：${rule.confidence.label}（${rule.confidence.value}；覆盖 ${Math.round(rule.confidence.support_ratio * 100)}% 样本）`,
  `- 风险等级：${rule.risk}`,
  "",
].join("\n");

export const renderDraftMarkdown = (dna) => {
  const rulesByLayer = Object.groupBy(dna.rules, ({ layer }) => layer);
  const sections = SPOKEN_DNA_LAYERS.map(({ id, name }) => {
    const rules = rulesByLayer[id] || [];
    const l0Metrics = id === "L0"
      ? [`- 估算单条时长：${dna.layers.L0.estimated_seconds.min}–${dna.layers.L0.estimated_seconds.max} 秒，均值 ${dna.layers.L0.estimated_seconds.average} 秒。`, `- 平均句长：${dna.layers.L0.average_sentence_characters} 个字符。`, `- 限制：${dna.layers.L0.note}`, ""].join("\n")
      : "";
    return [`## ${id} ${name}`, "", l0Metrics, rules.length > 0 ? rules.map(ruleLine).join("\n") : "- 当前样本不足以形成至少两条证据支撑的候选规则。", ""].join("\n");
  });
  return [
    `# ${dna.display_name}｜口播 DNA（待人工确认）`,
    "",
    `- 状态：${dna.approval.state}`,
    `- 人工确认必需：${dna.approval.requires_human_approval ? "是" : "否"}`,
    `- 样本单元：${dna.corpus.unit_count}`,
    `- 样本总字符：${dna.corpus.total_characters}`,
    `- 健康状态：${dna.sample_health.grade}`,
    "",
    "## 使用边界",
    "",
    ...dna.source_boundary.map((item) => `- ${item}`),
    "",
    "## 审阅前注意",
    "",
    ...dna.limitations.map((item) => `- ${item}`),
    "",
    ...sections,
    "## 口播框架库",
    "",
    ...(dna.frameworks || []).flatMap((framework) => [
      `### ${framework.id}｜${framework.name}（${framework.status}）`,
      "",
      `- 证据锚点：${framework.evidence_unit_ids.join("、")}`,
      `- 适用：${framework.when_to_use}`,
      `- 不适用：${framework.do_not_use}`,
      "- 节拍：",
      ...framework.beats.map((beat, index) => `  ${index + 1}. ${beat.role}：${beat.purpose}`),
      "",
    ]),
    "## 人工确认清单",
    "",
    "- [ ] 已审阅近重复和模板警告。",
    "- [ ] 已确认每条候选规则的证据锚点与适用条件。",
    "- [ ] 已确认没有来源事实、收益、账号、资料关键词或 CTA 被写入 DNA。",
    "- [ ] 仅在上述三项完成后，才允许另建 approved 版本。",
    "",
  ].join("\n");
};
