// Runtime smoke test: generate real PDFs in Node across languages and sanity-check bytes.
import { readFile } from 'node:fs/promises';
import { buildPdf } from '../src/pdf.js';
import { computeTotals } from '../src/invoice.js';

const loadFont = (path) => readFile(new URL(`../public${path}`, import.meta.url));
const loadWasm = () => readFile(new URL('../public/hb-subset.wasm', import.meta.url));

const base = {
  number: 'INV-2026-042',
  issueDate: '2026-07-08',
  dueDate: '2026-07-22',
  currency: 'USD',
  taxRate: 8.5,
  discount: 10,
  fromName: 'Acme Inc.',
  fromDetails: '123 Main St\nSan Francisco, CA 94105\nbilling@acme.com',
  toName: 'Client LLC',
  toDetails: '456 Market St\nNew York, NY 10001',
  items: [
    { desc: 'Design work', qty: 12, price: 150 },
    { desc: 'Development sprint', qty: 2, price: 4800 },
    { desc: 'Hosting (July)', qty: 1, price: 29.99 },
  ],
  notes: 'Payment due within 14 days. Wire details attached separately.',
};

const CASES = [
  { lang: 'en', inv: base, wantFont: null },
  {
    lang: 'zh',
    inv: {
      ...base, lang: 'zh', currency: 'CNY',
      fromName: '深圳市恒发贸易有限公司',
      fromDetails: '广东省深圳市福田区深南大道 1000 号\ninfo@hengfa.example.cn',
      toName: 'Müller GmbH',
      items: [
        { desc: '不锈钢保温杯 500ml（定制 Logo）', qty: 500, price: 18.5 },
        { desc: '海运费及保险 Ocean freight & insurance', qty: 1, price: 3200 },
      ],
      notes: '付款方式：电汇 T/T。收到货款后 15 个工作日内发货。',
    },
    wantFont: 'NotoSansSC',
  },
  {
    lang: 'en-zh',
    inv: { ...base, lang: 'en-zh', toName: '上海进出口有限公司' },
    wantFont: 'NotoSansSC',
  },
  {
    lang: 'zh-ja',
    inv: {
      ...base, lang: 'zh-ja', currency: 'JPY',
      fromName: '株式会社山田商事',
      fromDetails: '東京都千代田区丸の内1-1-1',
      toName: '北京商贸有限公司',
      items: [{ desc: '電子部品 电子元件 A-100', qty: 1000, price: 120 }],
      notes: 'お支払いは銀行振込でお願いします。',
    },
    wantFont: 'NotoSansSC',
  },
];

// money math still correct
const totals = computeTotals(base);
const expectSubtotal = 12 * 150 + 2 * 4800 + 29.99;
const expectTotal = expectSubtotal * 0.9 * 1.085;
if (Math.abs(totals.subtotal - expectSubtotal) > 0.001) throw new Error(`subtotal wrong: ${totals.subtotal}`);
if (Math.abs(totals.total - expectTotal) > 0.001) throw new Error(`total wrong: ${totals.total}`);

for (const { lang, inv, wantFont } of CASES) {
  const bytes = Buffer.from(await buildPdf({ ...inv, lang }, { loadFont, loadWasm }));
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${lang}: not a PDF`);
  if (bytes.length < 2000) throw new Error(`${lang}: suspiciously small (${bytes.length}B)`);
  if (bytes.length > 500_000) throw new Error(`${lang}: too large (${bytes.length}B) — font subsetting broken?`);
  // CJK cases embed a TrueType subset (>=20KB); latin-only stays tiny on Helvetica.
  if (wantFont && bytes.length < 15_000) throw new Error(`${lang}: too small (${bytes.length}B) — CJK font not embedded?`);
  if (!wantFont && bytes.length > 15_000) throw new Error(`${lang}: too large (${bytes.length}B) — unexpected font embedded?`);
  console.log(`smoke OK [${lang}]: ${(bytes.length / 1024).toFixed(1)} KB`);
}
console.log('all smoke cases passed');
