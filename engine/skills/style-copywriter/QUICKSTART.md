# Style Copywriter 快速使用

## 所需文件

准备三份独立文件：

- `source-contract.md`：本次要讲的项目事实、数据、步骤、边界和 CTA。
- `knowledge-pack.json`：本次主题从知识库检索并筛选出的相关解释、方法和边界；不得为空。
- Style DNA：本次要使用的风格规则。

不要把原始文案、参考文案和风格样本混进 contract。

## 最小配置

```json
{
  "contract_path": "./source-contract.md",
  "knowledge_pack_path": "./knowledge-pack.json",
  "style_dna_path": "./style-dna.json",
  "generation_config": {
    "framework": "auto",
    "intensity": 0.6,
    "target_length": "auto"
  }
}
```

## 执行顺序

1. 读取 contract，锁定所有事实关系。
2. 检索并读取知识包；缺失、零结果或无法映射到正文时停止。
3. 读取 Style DNA；若 selector 无唯一匹配，停止，不猜测 framework。
4. 根据 beats 重组内容，融入相关知识；仅使用可用且未超预算的 pattern。
5. 输出 `generated-copy.md` 和带 `knowledge_sources_used` 的 `generation-metadata.json`。每条记录都必须有精确的 source ID、允许的 `use_as`、章节和能在正文找到的 `output_excerpt`；知识引入的数值或受支持的定量/结果主张必须已锁进 contract。
6. 运行：

   ```powershell
   node scripts/validate-generated-copy.mjs `
     --contract './source-contract.md' `
     --knowledge './knowledge-pack.json' `
     --metadata './generation-metadata.json' `
     --copy './generated-copy.md' `
     --report './generation-validation-report.md' `
     --reference '<可选：风格样本原文>'
   ```

7. 只有报告通过时，将元数据更新为 `validation_status: passed`；否则按报告逐项修改，再重新生成和验证。

## 产物边界

`generated-copy.md` 只能是口播稿。数据来源、使用规则、框架选择、事实比对和任何待审计项都写在元数据或内部报告，不能进入观众稿。

验证器拒绝空包、缺失 query、不可回读来源、伪造 source ID、未获允许的用途和正文中找不到的使用片段。它只能检查字面与结构；仍须人工确认知识与目标主题实际相关。
