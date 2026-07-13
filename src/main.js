import './style.css';
import { defaultInvoice, computeTotals, formatMoney } from './invoice.js';
import { labels, LANGS } from './i18n.js';

const STORAGE_KEY = 'invoice-pdf:draft';

const form = document.getElementById('invoice-form');
const itemsList = document.getElementById('items-list');
const preview = document.getElementById('preview');

let inv = loadDraft();

// Landing pages deep-link with ?lang=de or ?lang=en-zh to preselect the
// invoice language; the rest of the draft is left untouched.
const urlLang = new URLSearchParams(location.search).get('lang');
if (urlLang) {
  const parts = urlLang.split('-');
  if (parts.length <= 2 && new Set(parts).size === parts.length && parts.every((p) => LANGS.includes(p))) {
    inv.lang = urlLang;
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.items) && saved.items.length) {
        return { ...defaultInvoice(), ...saved };
      }
    }
  } catch { /* corrupted draft — start fresh */ }
  return defaultInvoice();
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inv));
}

// --- form <-> state ---

const SCALAR_FIELDS = [
  'number', 'issueDate', 'dueDate', 'currency', 'taxRate', 'discount',
  'fromName', 'fromDetails', 'toName', 'toDetails', 'notes',
];

// inv.lang is a composed code ('zh' or 'en-zh'); the UI exposes it as a
// required primary language plus an optional secondary one.
function composedLang() {
  const l1 = form.elements.lang1.value;
  const l2 = form.elements.lang2.value;
  return l2 && l2 !== l1 ? `${l1}-${l2}` : l1;
}

function syncLangSelects() {
  const [l1, l2 = ''] = String(inv.lang || 'en').split('-');
  form.elements.lang1.value = l1;
  form.elements.lang2.value = l2;
}

function syncFormFromState() {
  for (const name of SCALAR_FIELDS) form.elements[name].value = inv[name] ?? '';
  syncLangSelects();
  renderItems();
}

function renderItems() {
  itemsList.innerHTML = '';
  inv.items.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <input type="text" data-i="${i}" data-k="desc" placeholder="Service or product" aria-label="Item ${i + 1} description" />
      <input type="number" data-i="${i}" data-k="qty" min="0" step="any" aria-label="Item ${i + 1} quantity" />
      <input type="number" data-i="${i}" data-k="price" min="0" step="any" aria-label="Item ${i + 1} unit price" />
      <span class="item-amount"></span>
      <button type="button" class="btn-remove" data-remove="${i}" title="Remove item">×</button>
    `;
    row.querySelector('[data-k="desc"]').value = it.desc;
    row.querySelector('[data-k="qty"]').value = it.qty;
    row.querySelector('[data-k="price"]').value = it.price;
    itemsList.appendChild(row);
  });
  updateItemAmounts();
}

function updateItemAmounts() {
  itemsList.querySelectorAll('.item-row').forEach((row, i) => {
    const it = inv.items[i];
    row.querySelector('.item-amount').textContent =
      formatMoney((Number(it.qty) || 0) * (Number(it.price) || 0), inv.currency);
  });
}

form.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.k !== undefined) {
    inv.items[Number(el.dataset.i)][el.dataset.k] =
      el.dataset.k === 'desc' ? el.value : el.value === '' ? '' : Number(el.value);
    updateItemAmounts();
  } else if (el.name === 'lang1' || el.name === 'lang2') {
    if (form.elements.lang2.value === form.elements.lang1.value) form.elements.lang2.value = '';
    inv.lang = composedLang();
  } else if (SCALAR_FIELDS.includes(el.name)) {
    inv[el.name] = el.type === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value;
    if (el.name === 'currency') updateItemAmounts();
  }
  saveDraft();
  renderPreview();
});

itemsList.addEventListener('click', (e) => {
  const idx = e.target.dataset.remove;
  if (idx === undefined) return;
  inv.items.splice(Number(idx), 1);
  if (!inv.items.length) inv.items.push({ desc: '', qty: 1, price: 0 });
  saveDraft();
  renderItems();
  renderPreview();
});

document.getElementById('btn-add-item').addEventListener('click', () => {
  inv.items.push({ desc: '', qty: 1, price: 0 });
  saveDraft();
  renderItems();
  renderPreview();
  itemsList.querySelector('.item-row:last-child input').focus();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('Clear the whole invoice and start over?')) return;
  inv = defaultInvoice();
  localStorage.removeItem(STORAGE_KEY);
  syncFormFromState();
  renderPreview();
});

// jsPDF is ~85% of the bundle; load it only when the user actually downloads.
const btnDownload = document.getElementById('btn-download');
btnDownload.addEventListener('click', async () => {
  btnDownload.disabled = true;
  try {
    const { downloadPdf } = await import('./pdf.js');
    downloadPdf(inv);
  } finally {
    btnDownload.disabled = false;
  }
});

// --- live preview ---

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escML = (s) => esc(s).replace(/\n/g, '<br>');

function renderPreview() {
  const { subtotal, discount, tax, total } = computeTotals(inv);
  const money = (v) => formatMoney(v, inv.currency);
  const L = labels(inv.lang);
  const rows = inv.items
    .filter((it) => it.desc || Number(it.qty) || Number(it.price))
    .map((it) => `
      <tr>
        <td>${esc(it.desc) || '—'}</td>
        <td class="num">${Number(it.qty) || 0}</td>
        <td class="num">${money(it.price)}</td>
        <td class="num">${money((Number(it.qty) || 0) * (Number(it.price) || 0))}</td>
      </tr>`).join('');

  preview.innerHTML = `
    <div class="pv-head">
      <div class="pv-title">${esc(L.title)}</div>
      <div class="pv-meta">
        <div><span>${esc(L.invoiceNo)}</span><b>${esc(inv.number) || '—'}</b></div>
        <div><span>${esc(L.issueDate)}</span><b>${esc(inv.issueDate) || '—'}</b></div>
        ${inv.dueDate ? `<div><span>${esc(L.dueDate)}</span><b>${esc(inv.dueDate)}</b></div>` : ''}
      </div>
    </div>
    <hr>
    <div class="pv-parties">
      <div><h3>${esc(L.from)}</h3><b>${esc(inv.fromName) || '—'}</b><p>${escML(inv.fromDetails)}</p></div>
      <div><h3>${esc(L.billTo)}</h3><b>${esc(inv.toName) || '—'}</b><p>${escML(inv.toDetails)}</p></div>
    </div>
    <table class="pv-table">
      <thead><tr><th>${esc(L.description)}</th><th class="num">${esc(L.qty)}</th><th class="num">${esc(L.unitPrice)}</th><th class="num">${esc(L.amount)}</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="pv-empty">No items yet</td></tr>'}</tbody>
    </table>
    <div class="pv-totals">
      <div><span>${esc(L.subtotal)}</span><span>${money(subtotal)}</span></div>
      ${Number(inv.discount) > 0 ? `<div><span>${esc(L.discount)} (${esc(inv.discount)}%)</span><span>-${money(discount)}</span></div>` : ''}
      ${Number(inv.taxRate) > 0 ? `<div><span>${esc(L.tax)} (${esc(inv.taxRate)}%)</span><span>${money(tax)}</span></div>` : ''}
      <div class="pv-grand"><span>${esc(L.totalDue)}</span><span>${money(total)}</span></div>
    </div>
    ${inv.notes ? `<div class="pv-notes"><h3>${esc(L.notes)}</h3><p>${escML(inv.notes)}</p></div>` : ''}
  `;
}

syncFormFromState();
renderPreview();
