# Invoice PDF

Free in-browser invoice generator at [invoices-generator.net](https://invoices-generator.net). Fill in the form, see a live preview, download a professional PDF — no sign-up, no server, your data never leaves the device (drafts autosave to `localStorage`).

Supports multilingual invoice content for cross-border trade: English, Chinese, Japanese, and bilingual modes (EN+ZH, EN+JA, ZH+JA) with dual-language labels like "Amount / 金额".

## Stack

- Vanilla JS + [Vite](https://vitejs.dev/) — static MPA build, no framework
- [pdf-lib](https://pdf-lib.js.org/) + fontkit — client-side PDF generation
- [HarfBuzz wasm](https://github.com/harfbuzz/harfbuzzjs) — per-document font subsetting (`src/subset.js`); fontkit's own `subset: true` corrupts CJK glyphs, so fonts are HB-subsetted to the invoice's exact characters and embedded whole
- Noto Sans SC/JP pre-subsets in `public/fonts/` (SC: GB2312 ∪ JIS ∪ Big5; JP: JIS) — regenerate with `scripts/subset_fonts.py` (needs `fonttools`)
- Cloudflare Workers static assets — hosting (`wrangler.jsonc`; tiny worker entry for www→apex 301)

## Develop

```sh
npm install
npm run dev      # local dev server
npm run smoke    # generate sample PDFs (en/zh/en-zh/zh-ja) in Node and validate
npm run build    # static build to dist/
```

Browser e2e (drives the real app and verifies the downloaded PDF):

```sh
CHROME_PATH=/path/to/chrome node scripts/e2e-download.mjs                                  # against vite preview
CHROME_PATH=... E2E_URL=https://invoices-generator.net node scripts/e2e-download.mjs       # against production
```

## Deploy

```sh
npm run deploy   # vite build && wrangler deploy
```

## Known limitations

- Generates commercial/proforma invoices — not a Chinese tax fapiao (发票), not a Japanese qualified invoice (適格請求書).
- Characters outside GB2312/Big5/JIS (rare ideographs, emoji) won't render in the PDF.
- Single fixed template; no logo upload yet.
