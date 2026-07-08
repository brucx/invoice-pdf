// Runtime smoke test: generate a real PDF from sample data in Node and sanity-check the bytes.
import { buildPdf } from '../src/pdf.js';
import { computeTotals } from '../src/invoice.js';

const sample = {
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

const totals = computeTotals(sample);
const expectSubtotal = 12 * 150 + 2 * 4800 + 29.99;
if (Math.abs(totals.subtotal - expectSubtotal) > 0.001) {
  throw new Error(`subtotal wrong: ${totals.subtotal} != ${expectSubtotal}`);
}
const expectTotal = (expectSubtotal * 0.9) * 1.085;
if (Math.abs(totals.total - expectTotal) > 0.001) {
  throw new Error(`total wrong: ${totals.total} != ${expectTotal}`);
}

const doc = buildPdf(sample);
const bytes = Buffer.from(doc.output('arraybuffer'));
if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
  throw new Error('output is not a PDF');
}
if (bytes.length < 2000) {
  throw new Error(`PDF suspiciously small: ${bytes.length} bytes`);
}

console.log(`smoke OK: valid PDF, ${bytes.length} bytes, total ${totals.total.toFixed(2)}`);
