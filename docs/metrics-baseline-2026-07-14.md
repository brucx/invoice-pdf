# 数据基线（2026-07-14 收录，作为后续对照标准）

覆盖区间：GSC 2026-07-08（上线日）~ 07-14（当天不完整，dataState=all）；GA4 自 07-13 晚埋点起。
**注意**：GA 数据含自测流量——Singapore 用户 ≈ 本 GCP VM（asia-southeast1）的 e2e/Lighthouse 无头浏览器；`pdf_download=1` 即 e2e 测试。对照时应剔除 SG 或按国家过滤。

## 时间线（对照时的变更节点）

| 日期 | 变更 |
|---|---|
| 07-08 | 上线（EN），当晚多语言 v1（en/zh/ja + 双语）|
| 07-12 | +ko/vi/es/de/fr/id 六语言 + 6 着陆页 |
| 07-13 | 全语言页本地语化 + nl/it/pt/zh/ja 五新页 + FAQPage LD + ?lang 深链 + GA 埋点 |
| 07-14 | A 层关键词段（11 页）+ 移动端排版 + GA 延迟加载（Lighthouse 桌面 100 / 移动 98~99）|

## GSC（07-08 ~ 07-14）

**总量：曝光 223，点击 10，CTR 4.5%**

按天：6 → 18 → 40(点击5) → 42 → 55(点击2) → 46(点击3) → 16(不完整)

按页面：

| 页面 | 曝光 | 点击 | 排名 |
|---|---|---|---|
| /german-invoice-template | 77 | 4 | 26.1 |
| /french-invoice-template | 48 | 1 | 25.8 |
| /korean-invoice-template | 43 | 3 | **8.4** |
| /bilingual-invoice-template | 27 | 0 | 28.7 |
| /spanish-invoice-template | 23 | 1 | 13.9 |
| /vietnamese-invoice-template | 6 | 0 | 13.5 |
| /indonesian-invoice-template | 3 | 1 | 15.0 |
| /（主页）| 3 | 0 | 62.0 |

英文模板页（invoice-template-pdf/blank/freelance）与 07-13 新页（zh/ja/nl/it/pt）曝光均为 0（新页未收录）。

设备：DESKTOP 194 曝光/8 点击（排名 23.3），MOBILE 29/2（排名 16.0）。
国家（点击）：印度 3、孟加拉/中国/德国/印尼/尼日利亚/波兰/俄罗斯 各 1。

查询词 Top（29 个可见）：invoice french 7、french invoice template 4、duitse factuur maken 3、invoice in german 3、korean invoice 3（排名 8.3）、rechnungsnr 2（排名 7）。
基线排名参照：korean invoice ~8、rechnungsnr(.) 6~7、德语本地词（rechnungsblatt/rechnungsbeispiel）仍在 85~100、hóa đơn song ngữ 51、英文账单模板 39。

## GA4（07-13 埋点 ~ 07-14，数据极早期）

- activeUsers 8 / sessions 8 / pageViews 9（含自测）
- 设备：mobile 6 / desktop 2；国家：SG 3（=自测 VM）、TW 1、US 1、未知 3
- 事件：page_view 9、first_visit 7、session_start 7、pdf_download 1（=e2e 测试）
- 自定义维度（invoice_language/invoice_currency）与指标（line_items）07-14 注册，仅对此后数据生效

## 对照时看什么（预设问题）

1. 德语本地词（rechnungsvorlage 系）排名是否从 70~100 进入前 30（07-13/14 本地化+关键词段的效果）
2. zh/ja/nl/it/pt 五个新页何时出现首批曝光；英文模板页是否仍为 0
3. "英文/双语"精确词（rechnungsvorlage englisch、영문 인보이스 양식 등）是否开始进词表
4. CTR 是否随排名前移而提升（基线 4.5%）；FAQ 富摘要是否出现
5. GA：剔除 SG 后的真实 pdf_download 数、语言/币种分布、着陆页→工具页转化
6. 移动端占比是否上升（移动排版优化 07-14 上线；基线 MOBILE 曝光占 13%）

拉数命令：GSC 走 ADC + searchconsole API；GA 走 `python3 ~/.config/gcloud/mint-ga-token.py analytics.readonly scope` + analyticsdata runReport（property 545451936）。
