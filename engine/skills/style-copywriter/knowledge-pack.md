# Knowledge Pack 规则

`knowledge-pack.json` 是每次生成的强制输入。它保存本次主题从知识库检索并筛选出的相关内容，不保存风格样本，也不替代 `source-contract.md`。

## 最小格式

```json
{
  "schema_version": "1.0",
  "query": {
    "scenario": "video",
    "product_type": "虚拟服务",
    "tags": ["交付", "售后"]
  },
  "minimum_used_sources": 1,
  "sources": [
    {
      "id": "k01",
      "title": "知识条目标题",
      "locator": "可回读的文件路径或知识库记录 ID",
      "excerpt": "与本次主题直接相关的知识摘要",
      "allowed_uses": ["explanation", "method", "mechanism", "risk"],
      "relevance": {
        "task_brief_sha256": "...",
        "allowed_stances": ["support", "supplement"],
        "allowed_sections": ["learning_path"],
        "core_claim_compatible": true
      }
    }
  ]
}
```

`schema_version` 当前固定为 `1.0`。`query` 必须至少保留一个非空的检索信号（如场景、产品类型或 tags）；它是人工回读“为什么检索这批来源”的最小审计线索。每个 `allowed_uses` 必须是 `explanation`、`method`、`mechanism` 或 `risk` 之一，且至少有一个值。

## 强制规则

1. 每次生成都先检索知识库，再写出知识包；不得用模型记忆冒充检索结果。
2. `sources` 至少包含 1 条可回读、与主题相关且有非空摘要的来源；建议长稿筛选 2–4 条，避免堆砌。
3. 只把知识用于解释、方法、机制和必要边界。知识中的数字、收益、案例、时效、平台规则或效果结论，必须先核实并写入 contract 才能进入观众稿。只要 `output_excerpt` 中有数值或结果主张，它的数字连同可识别的单位/时间表达，以及 `四位数`、`百分之X`、`X倍`、`翻倍`、`当天出单` 等定量结果短语，必须已能在 contract 中回读。
4. 每条来源必须用 `relevance` 绑定本次 task brief SHA-256，并声明允许的 `stance`、章节和是否能支持核心主张。`stance` 只能是 `support`、`supplement`、`counterevidence` 或 `conflict`。
5. 在正文生成前，为每条计划使用的知识记录 `source_id`、`section`、`use_as` 和 `stance`。`source_id`、章节、用途和立场必须分别落在来源允许范围内；`counterevidence/conflict` 只能用于 `risk`，不能被改造成核心方法或正向证明。
6. 正文生成后，为每条实际使用的知识补上 `output_excerpt`。该片段必须在观众稿中真实存在。来源说明只留在知识包和元数据，不写进观众稿。
7. 缺少知识包、检索失败、零结果、来源不可回读或没有实际使用记录时停止生成；不要降级成“事实 + 风格”双输入。

## 边界

- contract 决定“哪些项目事实可以说”。
- knowledge pack 决定“可以补充哪些解释和方法”。
- Style DNA 决定“用什么表达方式说”。

三者冲突时以 contract 的事实锁和风险边界为最高优先级；知识不能覆盖 contract，风格不能改变知识含义。
