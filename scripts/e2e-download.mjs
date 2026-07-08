// Browser end-to-end: drive the real app, click Download PDF with a bilingual
// invoice, and verify the downloaded file is a valid PDF with an embedded font.
//
// Usage: CHROME_PATH=/path/to/chrome [E2E_URL=https://invoices-generator.net] node scripts/e2e-download.mjs
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const executablePath = process.env.CHROME_PATH;
if (!executablePath) throw new Error('Set CHROME_PATH to a Chrome/chrome-headless-shell binary');
const url = process.env.E2E_URL || 'http://localhost:4173';

const downloadPath = await mkdtemp(join(tmpdir(), 'invoice-e2e-'));
const browser = await puppeteer.launch({ executablePath, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
  await page.select('select[name="lang"]', 'en-zh');
  await page.type('input[name="fromName"]', '深圳市恒发贸易有限公司');
  await page.type('input[data-k="desc"]', '不锈钢保温杯 Stainless steel tumbler');
  await page.type('input[data-k="qty"]', '500');
  await page.type('input[data-k="price"]', '18.5');

  // Preview must localize immediately.
  const previewTitle = await page.$eval('.pv-title', (el) => el.textContent);
  if (!previewTitle.includes('商业发票')) throw new Error(`preview not localized: ${previewTitle}`);

  await page.click('#btn-download');

  // Font + wasm fetch can take a while on first load.
  let file;
  for (let i = 0; i < 120; i++) {
    const files = (await readdir(downloadPath)).filter((f) => f.endsWith('.pdf'));
    if (files.length) { file = files[0]; break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!file) throw new Error('no PDF downloaded within 60s');

  const bytes = await readFile(join(downloadPath, file));
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('downloaded file is not a PDF');
  if (bytes.length < 15_000) throw new Error(`PDF too small (${bytes.length}B) — CJK font missing?`);
  console.log(`e2e OK: ${file}, ${(bytes.length / 1024).toFixed(1)} KB, preview title "${previewTitle}"`);
} finally {
  await browser.close();
}
