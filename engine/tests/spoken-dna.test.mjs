import assert from "node:assert/strict";
import test from "node:test";
import { segmentMarkdownSpokenCorpus } from "../corpus/segment-markdown.mjs";
import { assessSpokenSampleHealth } from "../health/sample-health.mjs";
import { analyzeSevenLayers } from "../analyzers/seven-layers.mjs";
import { buildDraftSpokenDna } from "../fusion/build-draft-dna.mjs";

const sample = `# 文档标题不算样本

## 第一条

绝密原文句子甲。今天讲清楚新手为什么容易踩坑。第一，先看证据。建议暂停截图保存。

## 第二条

绝密原文句子乙。今天讲清楚新手为什么容易踩坑。第一，先看证据。建议暂停截图保存。

## 第三条

绝密原文句子丙。很多人不知道怎么开始。今天分享一个路径。第一，拆成小动作。下期见。`;

test("只把 H2 切成口播单元，H1 标题不计入", () => {
  const corpus = segmentMarkdownSpokenCorpus(sample, { corpusId: "fixture", sourcePath: "fixture.md" });
  assert.equal(corpus.units.length, 3);
  assert.equal(corpus.units[0].id, "fixture:u01");
});

test("近重复样本会进入健康报告", () => {
  const corpus = segmentMarkdownSpokenCorpus(sample, { corpusId: "fixture", sourcePath: "fixture.md" });
  const health = assessSpokenSampleHealth(corpus, { nearDuplicateThreshold: 0.35 });
  assert.ok(health.near_duplicate_pairs.some((pair) => pair.left_unit_id === "fixture:u01" && pair.right_unit_id === "fixture:u02"));
});

test("草稿 DNA 不含来源正文，且不能绕过人工确认", () => {
  const corpus = segmentMarkdownSpokenCorpus(sample, { corpusId: "fixture", sourcePath: "fixture.md" });
  const health = assessSpokenSampleHealth(corpus, { nearDuplicateThreshold: 0.35 });
  const analysis = analyzeSevenLayers(corpus);
  const dna = buildDraftSpokenDna({ corpus, health, analysis, styleId: "fixture", displayName: "测试口播" });
  const serialized = JSON.stringify(dna);
  assert.equal(dna.approval.state, "draft");
  assert.equal(dna.approval.requires_human_approval, true);
  assert.equal(serialized.includes("绝密原文句子甲"), false);
  assert.equal(serialized.includes("绝密原文句子乙"), false);
});

test("先排雷再给方法必须验证出现顺序，不能只因同时出现风险词和编号就成立", () => {
  const ordered = `## 先方法后提醒

第一，先执行动作。注意不要踩坑。

## 先提醒后方法甲

先排雷，不要直接开始。第一，执行动作。

## 先提醒后方法乙

先说避坑点。第一，执行动作。`;
  const corpus = segmentMarkdownSpokenCorpus(ordered, { corpusId: "ordered", sourcePath: "ordered.md" });
  const rule = analyzeSevenLayers(corpus).rules.find(({ id }) => id === "L2-R02");
  assert.deepEqual(rule.evidence_unit_ids, ["ordered:u02", "ordered:u03"]);
});

test("生活化结果对比会沉淀为句式公式，而不是保存原句", () => {
  const comparison = `## 对比甲

做对一个动作，让你的零花钱变成一杯咖啡。

## 对比乙

这个结果至少能补一点生活费，让日子更从容。`;
  const corpus = segmentMarkdownSpokenCorpus(comparison, { corpusId: "comparison", sourcePath: "comparison.md" });
  const rule = analyzeSevenLayers(corpus).rules.find(({ id }) => id === "L1-R04");
  assert.deepEqual(rule.evidence_unit_ids, ["comparison:u01", "comparison:u02"]);
  assert.match(rule.formula, /较紧的日常参照/);
  assert.equal(JSON.stringify(rule).includes("做对一个动作"), false);
});

test("候选框架必须有至少两条证据，观察框架可以保留单条样本", () => {
  const corpus = segmentMarkdownSpokenCorpus(sample, { corpusId: "fixture", sourcePath: "fixture.md" });
  const health = assessSpokenSampleHealth(corpus, { nearDuplicateThreshold: 0.35 });
  const analysis = analyzeSevenLayers(corpus);
  assert.throws(() => buildDraftSpokenDna({ corpus, health, analysis, styleId: "fixture", displayName: "测试口播", frameworks: [{ id: "bad", name: "错误框架", status: "candidate", evidence_unit_ids: ["fixture:u01"], beats: [{}, {}, {}] }] }));
  const dna = buildDraftSpokenDna({ corpus, health, analysis, styleId: "fixture", displayName: "测试口播", frameworks: [{ id: "observation", name: "观察框架", status: "observation", evidence_unit_ids: ["fixture:u01"], beats: [{}, {}, {}] }] });
  assert.equal(dna.frameworks.length, 1);
});
