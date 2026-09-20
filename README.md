# Douyin Creator Collector

**抖店达人采集助手** · A lightweight Tampermonkey userscript for collecting and managing creator details on the Douyin e-commerce creator marketplace.

`JavaScript` · `Tampermonkey` · `Browser automation` · `DOM parsing` · `CSV export`

> An independent, unofficial project. Not affiliated with Douyin, Jinritemai, or their operators. Use it only for information you are authorized to access and process, in accordance with applicable site terms.

## What it does / 功能

- Displays a draggable panel on the **creator square** and **creator profile** pages; it does not display on unrelated site pages. Expand/collapse and panel positions are preserved locally.
- On an opened creator profile, captures **creator name, Douyin ID, creator level, settlement total, and profile-page URL**.
- Supports settlement ranges (e.g. `2,500-5,000`) and shows `未授权` when the page says `达人未授权`. Currency symbols are removed from recorded amounts.
- Saves records in your browser, updates an existing record when its Douyin ID is collected again, and lets you view/delete records or export a batch CSV.
- Displays **打开主页** instead of a long URL in the panel; CSV retains the complete profile URL.

> **Manual step:** If the site's QR tooltip cannot be opened by simulated hover, move your pointer over the QR icon on the profile page. The script waits for the Douyin ID to appear before continuing. It does not perform unattended bulk crawling.

## Installation / 安装

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/) in your browser.
2. Open [`douyin-creator-collector.user.js`](./douyin-creator-collector.user.js), copy its **entire contents** into a new userscript in Tampermonkey, then save and enable it. Alternatively, install the raw `.user.js` file using your userscript manager if supported.
3. Sign in to an account that can access the relevant pages on `buyin.jinritemai.com`.
4. Open the creator marketplace at `https://buyin.jinritemai.com/dashboard/servicehall/daren-square`; open a creator profile and click **采集当前达人**.
5. If prompted, hover over the profile QR icon. Use **查看已采集数据** to review or delete records, and **导出 CSV** to export a single batch file.

The floating panel is initially expanded on the two supported page types. Drag its title bar to reposition it or click **收起** to collapse it into a draggable button. On the marketplace listing page you can review or export data; collection itself requires opening a creator profile.

## Supported pages / 支持的页面

The userscript is enabled on `buyin.jinritemai.com`, but the panel is **shown only** for these pathnames:

| Page | Path |
| --- | --- |
| Creator marketplace / 达人广场 | `/dashboard/servicehall/daren-square` |
| Creator detail / 达人详情 | `/dashboard/servicehall/daren-profile` |

The `uid` and other ordinary query parameters vary per creator and **are not hard-coded**. The site is a single-page application; the script checks page-path changes to show/hide the panel.

## Data & privacy / 数据说明

Records live in your browser's **`localStorage` for `buyin.jinritemai.com`**. They are not synced across devices or browsers. This script does not implement a remote upload service; clicking CSV export creates a local download. The page URL in each record may include creator identifiers and tracking parameters.

- **Back up regularly:** export CSV before clearing site data, changing browsers, or reinstalling. Deleting browser site data can remove saved records.
- **Do not commit** exported CSV files, creator IDs, real profile URLs, screenshots containing user/account details, or any logged-in page data to a public repository.
- Browser storage has a limited quota. There is no promised maximum number of records.
- This project uses selectors from one observed site layout. Site UI changes, account permissions, or unavailable profile details may affect results. Verify the captured fields before using them.

## Project layout

```text
douyin-creator-collector/
├── douyin-creator-collector.user.js   # Installable userscript
├── tests/script.test.cjs             # Offline smoke tests, Node.js built-ins only
├── .github/workflows/test.yml        # Run tests on push / PR
├── README.md
├── LICENSE
├── CHANGELOG.md
├── PUBLISH_WITH_CODEX.md             # Instructions for preparing the GitHub upload
└── .gitignore
```

Run `node --test tests/script.test.cjs` to execute offline smoke tests. They exercise page detection, settlement parsing, and local-storage behavior using mock DOM elements; **they do not replace a live test on the actual website**.

## Screenshots / 截图

For a public showcase, consider adding a sanitized screenshot of the floating panel and a sanitized screenshot of the records table. Use authorized demo data, hide account information and complete page URLs, and double-check browser tabs, QR tooltips and query parameters before publishing.

## License

MIT. See [LICENSE](./LICENSE).

## Development-history note / 开发历史说明

The early Git history for this repository was **reconstructed from saved, versioned code snapshots**. Those commits were created during repository preparation, not at the dates on which the original versions were discussed or tested. The versioned code changes are real; the Git commit timestamps are not original development timestamps.

早期 Git 提交由已保存的各版源码快照整理而成；提交时间对应整理历史的时间，并非当时逐次开发的原始 Git 提交时间。
