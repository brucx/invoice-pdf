import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { computeTotals, formatMoney } from './invoice.js';
import { labels, fontFamily } from './i18n.js';
import { getHb, subsetFontBytes } from './subset.js';

const INK = rgb(24 / 255, 33 / 255, 47 / 255);
const MUTED = rgb(110 / 255, 120 / 255, 135 / 255);
const ACCENT = rgb(37 / 255, 99 / 255, 235 / 255);
const RULE = rgb(226 / 255, 230 / 255, 236 / 255);
const HEAD_BG = rgb(246 / 255, 248 / 255, 251 / 255);

const PAGE_W = 595.28; // A4 portrait, pt
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Standard Helvetica (WinAnsi) can't encode the rupee sign.
const PDF_CURRENCY_OVERRIDE = { INR: 'Rs. ' };

const FONT_FILES = {
  sc: ['/fonts/NotoSansSC-Regular.ttf', '/fonts/NotoSansSC-Bold.ttf'],
  jp: ['/fonts/NotoSansJP-Regular.ttf', '/fonts/NotoSansJP-Bold.ttf'],
};

async function fetchAsset(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`asset fetch failed: ${res.status} ${path}`);
  return new Uint8Array(await res.arrayBuffer());
}
const fetchWasm = () => fetchAsset('/hb-subset.wasm');

// Every character the document can draw, so the font subset is complete.
// Labels are also drawn uppercased; money strings add symbols/separators.
function charCorpus(inv, L) {
  const parts = [
    '0123456789.,-—%()/: #',
    ...Object.values(L),
    inv.number, inv.issueDate, inv.dueDate,
    inv.fromName, inv.fromDetails, inv.toName, inv.toDetails, inv.notes,
    ...inv.items.flatMap((it) => [String(it.desc ?? ''), String(it.qty ?? ''), String(it.price ?? '')]),
    formatMoney(0, inv.currency),
  ];
  const corpus = parts.join('');
  return corpus + corpus.toUpperCase();
}

// Wraps text to maxWidth; falls back to per-character breaks for CJK/long words.
function wrapText(text, font, size, maxWidth) {
  const lines = [];
  for (const raw of String(text).split('\n')) {
    let line = '';
    for (const word of raw.split(/(\s+)/)) {
      if (font.widthOfTextAtSize(line + word, size) <= maxWidth) {
        line += word;
        continue;
      }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      let chunk = word.trimStart();
      while (font.widthOfTextAtSize(chunk, size) > maxWidth) {
        let i = chunk.length;
        while (i > 1 && font.widthOfTextAtSize(chunk.slice(0, i), size) > maxWidth) i--;
        lines.push(chunk.slice(0, i));
        chunk = chunk.slice(i);
      }
      line = chunk;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

// Builds the invoice PDF and returns its bytes.
// opts.loadFont/loadWasm let Node callers (smoke test) read files from disk.
export async function buildPdf(inv, { loadFont = fetchAsset, loadWasm = fetchWasm } = {}) {
  const doc = await PDFDocument.create();
  const fam = fontFamily(inv.lang);
  const L = labels(inv.lang);
  let font, bold;
  if (fam === 'latin') {
    font = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  } else {
    doc.registerFontkit(fontkit);
    const [regPath, boldPath] = FONT_FILES[fam];
    const corpus = charCorpus(inv, L);
    const [hb, regBytes, boldBytes] = await Promise.all([
      getHb(loadWasm), loadFont(regPath), loadFont(boldPath),
    ]);
    // Subset to the document's characters ourselves (HarfBuzz), then embed
    // whole: fontkit's { subset: true } corrupts CJK glyphs.
    [font, bold] = await Promise.all([
      doc.embedFont(subsetFontBytes(hb, regBytes, corpus), { subset: false }),
      doc.embedFont(subsetFontBytes(hb, boldBytes, corpus), { subset: false }),
    ]);
  }
  const { subtotal, discount, tax, total } = computeTotals(inv);
  const money = (v) => {
    const s = formatMoney(v, inv.currency);
    const override = fam === 'latin' && PDF_CURRENCY_OVERRIDE[inv.currency];
    return override ? s.replace(/^[^\d-]+/, override) : s;
  };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  // y is measured from the top of the page (baseline position).
  let y = 0;
  const text = (str, x, yTop, { f = font, size = 10, color = INK, align = 'left' } = {}) => {
    let tx = x;
    if (align === 'right') tx = x - f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: tx, y: PAGE_H - yTop, size, font: f, color });
  };
  const hline = (yTop, x1 = MARGIN, x2 = PAGE_W - MARGIN, color = RULE) =>
    page.drawLine({ start: { x: x1, y: PAGE_H - yTop }, end: { x: x2, y: PAGE_H - yTop }, thickness: 1, color });
  const ensureRoom = (needed) => {
    if (y + needed > PAGE_H - 60) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = 60;
    }
  };

  // Header
  text(L.title, MARGIN, 72, { f: bold, size: 24 });
  const meta = [
    [L.invoiceNo, inv.number || '—'],
    [L.issueDate, inv.issueDate || '—'],
    ...(inv.dueDate ? [[L.dueDate, inv.dueDate]] : []),
  ];
  meta.forEach(([k, v], i) => {
    const my = 56 + i * 14;
    text(k, PAGE_W - MARGIN - 110, my, { size: 9, color: MUTED, align: 'right' });
    text(String(v), PAGE_W - MARGIN, my, { size: 9, align: 'right' });
  });
  hline(96);

  // Parties
  const colW = CONTENT_W / 2;
  y = 120;
  const party = (label, name, details, x) => {
    text(label.toUpperCase(), x, y, { f: bold, size: 9, color: ACCENT });
    const nameLines = wrapText(name || '—', bold, 11, colW - 20);
    nameLines.forEach((ln, i) => text(ln, x, y + 16 + i * 14, { f: bold, size: 11 }));
    const detailsTop = y + 16 + nameLines.length * 14;
    const lines = wrapText(details || '', font, 9.5, colW - 20);
    lines.forEach((ln, i) => text(ln, x, detailsTop + i * 12, { size: 9.5, color: MUTED }));
    return detailsTop + lines.length * 12;
  };
  const endFrom = party(L.from, inv.fromName, inv.fromDetails, MARGIN);
  const endTo = party(L.billTo, inv.toName, inv.toDetails, MARGIN + colW);
  y = Math.max(endFrom, endTo, y + 46) + 24;

  // Items table
  const COLS = [
    { key: 'desc', w: CONTENT_W - 50 - 90 - 90, align: 'left', label: L.description },
    { key: 'qty', w: 50, align: 'right', label: L.qty },
    { key: 'price', w: 90, align: 'right', label: L.unitPrice },
    { key: 'amount', w: 90, align: 'right', label: L.amount },
  ];
  const colX = [];
  COLS.reduce((x, c) => { colX.push(x); return x + c.w; }, MARGIN);
  const cellText = (str, col, yTop, opts = {}) => {
    const pad = 8;
    const x = COLS[col].align === 'right' ? colX[col] + COLS[col].w - pad : colX[col] + pad;
    text(str, x, yTop, { align: COLS[col].align, ...opts });
  };

  // header row
  ensureRoom(30);
  page.drawRectangle({ x: MARGIN, y: PAGE_H - y - 8, width: CONTENT_W, height: 24, color: HEAD_BG });
  COLS.forEach((c, i) => cellText(c.label, i, y + 8, { f: bold, size: 8.5, color: MUTED }));
  y += 26;

  const rows = inv.items.filter((it) => it.desc || Number(it.qty) || Number(it.price));
  for (const it of rows) {
    const descLines = wrapText(it.desc || '—', font, 10, COLS[0].w - 16);
    const rowH = Math.max(descLines.length * 13, 13) + 10;
    ensureRoom(rowH);
    descLines.forEach((ln, i) => cellText(ln, 0, y + 10 + i * 13, { size: 10 }));
    cellText(String(Number(it.qty) || 0), 1, y + 10, { size: 10 });
    cellText(money(it.price), 2, y + 10, { size: 10 });
    cellText(money((Number(it.qty) || 0) * (Number(it.price) || 0)), 3, y + 10, { size: 10 });
    y += rowH;
    hline(y - 2);
  }

  // Totals
  y += 18;
  const totalsX1 = PAGE_W - MARGIN - 220;
  const totalRow = (label, value, isGrand = false) => {
    ensureRoom(24);
    text(label, totalsX1, y, {
      f: isGrand ? bold : font,
      size: isGrand ? 12 : 10,
      color: isGrand ? INK : MUTED,
    });
    text(value, PAGE_W - MARGIN, y, { f: isGrand ? bold : font, size: isGrand ? 12 : 10, align: 'right' });
    y += isGrand ? 22 : 18;
  };
  totalRow(L.subtotal, money(subtotal));
  if (Number(inv.discount) > 0) totalRow(`${L.discount} (${inv.discount}%)`, `-${money(discount)}`);
  if (Number(inv.taxRate) > 0) totalRow(`${L.tax} (${inv.taxRate}%)`, money(tax));
  hline(y - 10, totalsX1, PAGE_W - MARGIN);
  y += 4;
  totalRow(L.totalDue, money(total), true);

  // Notes
  if (inv.notes) {
    y += 14;
    const noteLines = wrapText(inv.notes, font, 9.5, CONTENT_W);
    ensureRoom(20 + noteLines.length * 12);
    text(L.notes.toUpperCase(), MARGIN, y, { f: bold, size: 9, color: ACCENT });
    noteLines.forEach((ln, i) => text(ln, MARGIN, y + 14 + i * 12, { size: 9.5, color: MUTED }));
  }

  return doc.save();
}

export async function downloadPdf(inv) {
  const bytes = await buildPdf(inv);
  const name = (inv.number || 'invoice').replace(/[^\w.-]+/g, '-');
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
