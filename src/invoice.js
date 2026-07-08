// Shared invoice model + money math. Used by the UI, the PDF generator and the smoke test.

export const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥', AUD: '$', CAD: '$', INR: '₹',
};

export function defaultInvoice(today = new Date().toISOString().slice(0, 10)) {
  return {
    number: 'INV-0001',
    issueDate: today,
    dueDate: '',
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
  const digits = currency === 'JPY' ? 0 : 2;
  const n = (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${symbol}${n}`;
}
