# Capture Schema

## 目录

1. 根字段
2. 商品字段
3. 截图字段
4. 状态

## 根字段

```json
{
  "schema_version": "1.0",
  "source": "logged_in_chrome_goofish",
  "query": "产品搜索词",
  "source_url": "https://www.goofish.com/search?q=...",
  "page_indicator": "1/50",
  "captured_at": "ISO-8601",
  "status": "real_browser_capture",
  "products": [],
  "detail_evidence": [],
  "screenshots": []
}
```

## 商品字段

每个商品至少包含：

```json
{
  "rank": 1,
  "item_id": "纯数字闲鱼商品 ID",
  "url": "https://www.goofish.com/item?id=...",
  "price": 19.9,
  "wants": 1541,
  "raw_text": "页面可见卡片文本"
}
```

`wants` 不可见时使用 `null`，不要写 `0`。`raw_text` 保留页面原始可见文本，供人工复核。

## 截图字段

截图路径相对于 `capture.json` 所在目录：

```json
{
  "id": "search_overview",
  "type": "search_results",
  "path": "raw/browser/search-overview.png",
  "source_url": "https://www.goofish.com/search?q=...",
  "description": "搜索结果首屏与页码"
}
```

构建器会把真实图片复制到 `screenshots/`，并补充 SHA-256、宽度、高度和字节数。不存在或不能解码的图片会让构建失败。

## 状态

- `real_browser_capture`：目标范围内的数据和截图均成功。
- `partial_real_browser_capture`：部分关键词、详情或截图缺失，但现有事实是真实读取。
- `blocked_screenshot`：数据已读到但没有任何真实截图，不得标为完成。
- `blocked_browser`：浏览器、登录态或页面读取失败。

禁止使用 `mock`、`simulation`、`placeholder` 或随机生成的商品进入正式证据包。
