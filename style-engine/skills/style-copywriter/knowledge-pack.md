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
      "allowed_uses": ["explanation", "method", "mechanism", "risk"]
    }
  ]
}
```

`schema_version` 当前固定为 `1.0`。`query` 必须至少保留一个非空的检索信号（如场景、产品类型或 tags）；它是人工回读“为什么检索这批来源”的最小审计线索。每个 `allowed_uses` 必须是 `explanation`、`method`、`mechanism` 或 `risk` 之一，且至少有一个值。

## 强制规则

1. 每次生成都先检索知识库，再写出知识包；不得用模型记忆冒充检索结果。
2. `sources` 至少包含 1 条可回读、与主题相关且有非空摘要的来源；建议长稿筛选 2–4 条，避免堆砌。
3. 只把知识用于解释、方法、机制和必要边界。知识中的数字、收益、案例、时效、平台规则或效果结论，必须先核实并写入 contract 才能进入观众稿。只要 `output_excerpt` 中有数值或结果主张，它的数字连同可识别的单位/时间表达，以及 `四位数`、`百分之X`、`X倍`、`翻倍`、`当天出单` 等定量结果短语，必须已能在 contract 中回读。
4. 为每条实际使用的知识在 `generation-metadata.json` 记录 `source_id`、`section`、`output_excerpt` 和 `use_as`。`source_id` 必须精确匹配本包来源，`use_as` 必须出现在该来源的 `allowed_uses` 内。
5. `output_excerpt` 必须是观众稿中真实存在的片段。来源说明只留在知识包和元数据，不写进观众稿。
6. 缺少知识包、检索失败、零结果、来源不可回读或没有实际使用记录时停止生成；不要降级成“事实 + 风格”双输入。

## 边界

- contract 决定“哪些项目事实可以说”。
- knowledge pack 决定“可以补充哪些解释和方法”。
- Style DNA 决定“用什么表达方式说”。

三者冲突时以 contract 的事实锁和风险边界为最高优先级；知识不能覆盖 contract，风格不能改变知识含义。
