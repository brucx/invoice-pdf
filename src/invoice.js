// Shared invoice model + money math. Used by the UI, the PDF generator and the smoke test.

export const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥', AUD: '$', CAD: '$', INR: '₹',
  KRW: '₩', VND: '₫', IDR: 'Rp ', SGD: 'S$', BRL: 'R$', CHF: 'CHF ',
};

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR']);
const SYMBOL_AFTER = new Set(['VND']); // 10,000 ₫
const NUMBER_LOCALE = { CHF: 'de-CH' }; // Swiss grouping: 1’000.00

export function defaultInvoice(today = new Date().toISOString().slice(0, 10)) {
  return {
    number: 'INV-0001',
    issueDate: today,
    dueDate: '',
    lang: 'en',
    currency: 'USD',
    taxRate: 0,
    discount: 0,
    fromName: '',
    fromDetails: '',
    toName: '',
    toDetails: '',
    items: [{ desc: '', qty: 1, price: 0 }],
    notes: '',
  };
}

export function computeTotals(inv) {
  const subtotal = inv.items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const discount = subtotal * ((Number(inv.discount) || 0) / 100);
  const taxable = subtotal - discount;
  const tax = taxable * ((Number(inv.taxRate) || 0) / 100);
  return { subtotal, discount, tax, total: taxable + tax };
}

export function formatMoney(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const n = (Number(amount) || 0).toLocaleString(NUMBER_LOCALE[currency] || 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return SYMBOL_AFTER.has(currency) ? `${n} ${symbol}` : `${symbol}${n}`;
}
