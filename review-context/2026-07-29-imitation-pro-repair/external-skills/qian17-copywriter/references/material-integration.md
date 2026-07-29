# 图片和素材融合规则

## Visual Types

| 素材 | When to use | Script marker |
| --- | --- | --- |
| 销量/搜索/榜单截图 | Proving demand or market size | `[插图：XX平台销量/搜索截图]` |
| 成本-售价对比 | Proving information gap or profit spread | `[插图：成本价和售价对比图]` |
| 操作录屏 | Showing app/platform steps | `[录屏：从首页点击到XX页面]` |
| 关键词清单 | Teaching search/title/选品 | `[插图：关键词清单，建议暂停截图保存]` |
| 产品图/详情图 | Showing listing template or offer | `[插图：产品详情模板图]` |
| 表格/流程图 | Offering resource CTA | `[插图：表格目录/流程清单]` |

## Working Markers and Final Word

Markers are allowed only in the private working Markdown. The user-facing Word must contain the actual verified image, not the marker text.

For each selected visual, maintain an internal placement map:

```text
source_file -> supported_claim -> insert_after_paragraph -> crop_region -> alt_text
```

## Placement Rules

- Put a visual marker immediately after its setup sentence.
- Never let a visual replace explanation. Say what viewers should notice.
- Use screenshot-save language only for lists, templates, tables, keywords, or rules.
- For every 2-3 dense teaching points, consider one visual node.
- If user has no素材, recommend the minimum set: demand proof, price comparison, operation step, resource preview.
- In Word, use inline images for reliable layout. Do not add visible figure numbers, captions, source labels, or evidence notes unless the user explicitly asks for them.
- Write meaningful alt text that says what the image shows and why it matters. A filename alone is not adequate.
- Use each image once unless the same image proves two distinct claims and repetition materially improves comprehension.
- Do not stretch, crop away relevant evidence, or insert unrelated decorative images.
- If a required evidence image is missing, stop and request it. If the image is optional, omit it and record the gap privately; never leave a visible placeholder in the final Word.

## Ultra-Wide Screenshot Rule

- Preserve the full 21:9 or browser-viewport screenshot unchanged in the private evidence package.
- Do not shrink an entire ultra-wide screenshot into a portrait Word page. Create a deterministic crop or apply Word-native crop to the displayed copy.
- Detail-page crops should retain the product/title plus the exact price, wants, views, and service text used by the paragraph.
- Search-page crops should retain only the representative product cards, prices, wants, and relevant descriptions. Showing the entire browser viewport is unnecessary.
- Remove navigation bars, search chrome, floating toolbars, unrelated blank space, and off-topic cards from the displayed crop.
- If one crop still makes the evidence unreadable, split the source into two non-overlapping crops. Do not alter text, numbers, or pixels inside the retained region.

## Script Phrases

- `先来看这张图，你就知道这个需求有多大。`
- `这个地方建议暂停截图保存，后面你照着做就行。`
- `左边是成本，右边是闲鱼/平台售价，中间就是信息差。`
- `这里不要只看标题，重点看想要数、在售数和发布时间。`
- `我把关键词和模板放到一张表里，方便你直接照着抄。`

## Material Request Block

When assets are missing, ask for or mark:

- `[补充截图：平台销量/搜索结果]`
- `[补充截图：进货价或成本]`
- `[补充截图：目标平台售价/同行案例]`
- `[补充素材：产品实拍/详情页/表格目录]`
