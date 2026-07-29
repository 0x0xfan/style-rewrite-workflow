# codex代安装：闲鱼项目事实采集

- 采集时间：2026-07-27T06:53:37.662Z
- 数据来源：已登录 Chrome 的闲鱼页面
- 采集状态：partial_real_browser_capture
- 页面标识：1/50
- 实际截图：2 张（均已解码与哈希校验）

## 本次可复核事实

- 记录商品卡片：10 条；这只是采样数，不是搜索结果总量。
- 可见价格范围：7.90—29.00 元；中位价格 11.89 元。
- 明确显示‘人想要’的卡片：8 张；可见数值合计 2775，最高 1541。
- ‘人想要’仅是卡片显示的兴趣信号，不能写成订单、销量或总市场需求。

## 截图证据

- `screenshots/search_overview.png`：codex代安装搜索结果首屏与1/50页标识（2545×906，SHA-256 `53442f941b4c3b1e23e5a6b75f82979c5d7c5abf669c5a1d99beab7e709cd052`）
- `screenshots/top_product_detail.png`：19.90元商品详情、1543人想要与1万浏览（2560×855，SHA-256 `d4412a106d81cc18f8d2ca0a31296303b2bea300550783fe9bfda73d57db506b`）

## 边界

- Visible wants are interest signals, not sales or orders.
- Sampled card count is not the platform's total result count.
- Seller delivery times and outcomes are seller-authored claims.
- Dynamic values may differ between search and detail pages. This package reused one collection-record timestamp for both screenshots, so the exact per-page capture times and their order were not recorded separately; 1541 and 1543 are kept bound to their respective screenshot carriers only.
