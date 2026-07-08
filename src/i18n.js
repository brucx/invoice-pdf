// Invoice-content label translations. UI stays English; these localize the
// invoice itself (preview + PDF). Bilingual options join both languages.

const STRINGS = {
  en: {
    title: 'INVOICE',
    invoiceNo: 'Invoice #',
    issueDate: 'Issue date',
    dueDate: 'Due date',
    from: 'From',
    billTo: 'Bill to',
    description: 'Description',
    qty: 'Qty',
    unitPrice: 'Unit price',
    amount: 'Amount',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    totalDue: 'Total due',
    notes: 'Notes',
  },
  zh: {
    title: '商业发票',
    invoiceNo: '发票编号',
    issueDate: '开票日期',
    dueDate: '付款期限',
    from: '卖方',
    billTo: '买方',
    description: '项目描述',
    qty: '数量',
    unitPrice: '单价',
    amount: '金额',
    subtotal: '小计',
    discount: '折扣',
    tax: '税额',
    totalDue: '应付总额',
    notes: '备注',
  },
  ja: {
    title: '請求書',
    invoiceNo: '請求書番号',
    issueDate: '発行日',
    dueDate: '支払期限',
    from: '請求元',
    billTo: '請求先',
    description: '品目',
    qty: '数量',
    unitPrice: '単価',
    amount: '金額',
    subtotal: '小計',
    discount: '割引',
    tax: '税額',
    totalDue: '合計金額',
    notes: '備考',
  },
};

// labels('en-zh').invoiceNo === 'Invoice # / 发票编号'
export function labels(lang) {
  const parts = String(lang || 'en').split('-').filter((p) => STRINGS[p]);
  if (!parts.length) parts.push('en');
  const out = {};
  for (const key of Object.keys(STRINGS.en)) {
    out[key] = parts.map((p) => STRINGS[p][key]).join(' / ');
  }
  return out;
}

// True if the selected language needs a CJK-capable font in the PDF.
export function needsCjk(lang) {
  return /zh|ja/.test(String(lang || ''));
}

// Which embedded font family covers this language selection.
export function fontFamily(lang) {
  if (!needsCjk(lang)) return 'latin';
  return /zh/.test(lang) ? 'sc' : 'jp'; // zh-ja uses SC (JP glyph variants acceptable)
}
