# Invoice PDF

Free in-browser invoice generator. Fill in the form, see a live preview, download a professional PDF — no sign-up, no server, your data never leaves the device (drafts autosave to `localStorage`).

## Stack

- Vanilla JS + [Vite](https://vitejs.dev/) — static build, no framework
- [jsPDF](https://github.com/parallax/jsPDF) + jspdf-autotable — client-side PDF generation
- Cloudflare Workers static assets — hosting (`wrangler.jsonc`, assets-only)

## Develop

```sh
npm install
npm run dev      # local dev server
npm run smoke    # generate a sample PDF in Node and validate the bytes
npm run build    # static build to dist/
```

## Deploy

```sh
npm run deploy   # vite build && wrangler deploy
```

## Known limitations

- PDF output uses jsPDF built-in Helvetica: Latin scripts only. CJK invoices need an embedded font (planned).
- Single fixed template; no logo upload yet.
