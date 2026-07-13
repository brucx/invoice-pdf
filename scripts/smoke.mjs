// Runtime smoke test: generate real PDFs in Node across languages and sanity-check bytes.
// min/max bound the PDF size: embedded font subsets push CJK cases well past
// Helvetica-only output, so the bounds catch "font silently not embedded".
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
  { lang: 'en', inv: base, max: 15_000 },
  { lang: 'es', inv: { ...base, notes: 'Pago por transferencia. ¡Gracias! Año fiscal 2026.' }, max: 15_000 },
  { lang: 'nl', inv: { ...base, notes: 'Betaling binnen 14 dagen. Bedankt!' }, max: 15_000 },
  { lang: 'it', inv: { ...base, notes: 'Pagamento entro 14 giorni. Già fatturato più volte.' }, max: 15_000 },
  { lang: 'pt-en', inv: { ...base, currency: 'BRL', notes: 'Pagamento em até 14 dias. Obrigado!' }, max: 15_000 },
  {
    lang: 'zh',
    inv: {
      ...base, currency: 'CNY',
      fromName: '深圳市恒发贸易有限公司',
      fromDetails: '广东省深圳市福田区深南大道 1000 号\ninfo@hengfa.example.cn',
      toName: 'Müller GmbH',
      items: [
        { desc: '不锈钢保温杯 500ml（定制 Logo）', qty: 500, price: 18.5 },
        { desc: '海运费及保险 Ocean freight & insurance', qty: 1, price: 3200 },
      ],
      notes: '付款方式：电汇 T/T。收到货款后 15 个工作日内发货。',
    },
    min: 20_000,
  },
  { lang: 'en-zh', inv: { ...base, toName: '上海进出口有限公司' }, min: 20_000 },
  {
    lang: 'ja-en',
    inv: { ...base, fromName: '株式会社山田商事', notes: 'お支払いは銀行振込でお願いします。' },
    min: 20_000,
  },
  {
    lang: 'zh-ja',
    inv: {
      ...base, currency: 'JPY',
      fromName: '株式会社山田商事',
      fromDetails: '東京都千代田区丸の内1-1-1',
      toName: '北京商贸有限公司',
      items: [{ desc: '電子部品 电子元件 A-100', qty: 1000, price: 120 }],
      notes: 'お支払いは銀行振込でお願いします。',
    },
    min: 20_000,
  },
  {
    lang: 'ko',
    inv: {
      ...base, currency: 'KRW',
      fromName: '주식회사 한빛무역',
      fromDetails: '서울특별시 강남구 테헤란로 123\ntrade@hanbit.example.kr',
      toName: 'Pacific Imports LLC',
      items: [{ desc: '화장품 세트 (기획전용)', qty: 200, price: 45000 }],
      notes: '결제는 계좌이체로 부탁드립니다.',
    },
    min: 15_000,
  },
  {
    lang: 'vi',
    inv: {
      ...base, currency: 'VND',
      fromName: 'Công ty TNHH Thương mại Hòa Phát',
      fromDetails: 'Số 25 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
      toName: '深圳市恒发贸易有限公司',
      items: [{ desc: 'Cà phê hạt rang xay đặc biệt', qty: 1000, price: 250000 }],
      notes: 'Thanh toán chuyển khoản trong vòng 14 ngày.',
    },
    min: 15_000, // Vietnamese labels + the Chinese buyer name pull in NotoSans + SC
  },
  {
    // Mixed-script pair: Korean labels/content + Chinese content in one document.
    lang: 'zh-ko',
    inv: {
      ...base,
      fromName: '青岛出口贸易有限公司',
      toName: '주식회사 서울상사',
      items: [{ desc: '农产品 농산물 A급', qty: 50, price: 900 }],
      notes: '감사합니다 谢谢惠顾',
    },
    min: 30_000,
  },
  {
    // Regression: Chinese content on an English invoice must not crash Helvetica.
    lang: 'en',
    label: 'en+cjk-content',
    inv: { ...base, fromName: '深圳市恒发贸易有限公司 Hengfa Trading' },
    min: 20_000,
  },
];

// money math still correct
const totals = computeTotals(base);
const expectSubtotal = 12 * 150 + 2 * 4800 + 29.99;
const expectTotal = expectSubtotal * 0.9 * 1.085;
if (Math.abs(totals.subtotal - expectSubtotal) > 0.001) throw new Error(`subtotal wrong: ${totals.subtotal}`);
if (Math.abs(totals.total - expectTotal) > 0.001) throw new Error(`total wrong: ${totals.total}`);

for (const { lang, inv, min = 2_000, max = 500_000, label = lang } of CASES) {
  const bytes = Buffer.from(await buildPdf({ ...inv, lang }, { loadFont, loadWasm }));
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`${label}: not a PDF`);
  if (bytes.length < min) throw new Error(`${label}: too small (${bytes.length}B < ${min}) — font not embedded?`);
  if (bytes.length > max) throw new Error(`${label}: too large (${bytes.length}B > ${max}) — subsetting broken?`);
  console.log(`smoke OK [${label}]: ${(bytes.length / 1024).toFixed(1)} KB`);
}
console.log('all smoke cases passed');
