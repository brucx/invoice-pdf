import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { computeTotals, formatMoney } from './invoice.js';
import { labels, LANG_FONT } from './i18n.js';
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

const FONT_FILES = {
  sc: ['/fonts/NotoSansSC-Regular.ttf', '/fonts/NotoSansSC-Bold.ttf'],
  jp: ['/fonts/NotoSansJP-Regular.ttf', '/fonts/NotoSansJP-Bold.ttf'],
  kr: ['/fonts/NotoSansKR-Regular.ttf', '/fonts/NotoSansKR-Bold.ttf'],
  vn: ['/fonts/NotoSans-Regular.ttf', '/fonts/NotoSans-Bold.ttf'], // Latin + Vietnamese + currency signs
};

async function fetchAsset(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`asset fetch failed: ${res.status} ${path}`);
  return new Uint8Array(await res.arrayBuffer());
}
const fetchWasm = () => fetchAsset('/hb-subset.wasm');

// --- script classification -------------------------------------------------

// Codepoints WinAnsi (built-in Helvetica) can render beyond Latin-1.
const WINANSI_EXTRA = new Set([
  0x152, 0x153, 0x160, 0x161, 0x178, 0x17D, 0x17E, 0x192, 0x2C6, 0x2DC,
  0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E,
  0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203A, 0x20AC, 0x2122,
]);

const STRENGTH = { latin: 0, ext: 1, cjk: 2, kana: 3, hangul: 4 };

function classOf(cp) {
  if ((cp >= 0xAC00 && cp <= 0xD7A3) || (cp >= 0x1100 && cp <= 0x11FF) || (cp >= 0x3130 && cp <= 0x318F)) return 'hangul';
  if ((cp >= 0x3040 && cp <= 0x30FF) || (cp >= 0x31F0 && cp <= 0x31FF)) return 'kana';
  if ((cp >= 0x3400 && cp <= 0x9FFF) || (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0x3000 && cp <= 0x303F) || (cp >= 0xFF00 && cp <= 0xFFEF)) return 'cjk';
  if (cp <= 0xFF || WINANSI_EXTRA.has(cp)) return 'latin';
  return 'ext'; // Vietnamese diacritics, ₩/₫/₹, other Latin-Ext
}

// Every character the document can draw, so the font subsets are complete.
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

// Which font families to embed, ordered: the selected languages' fonts first,
// then whatever the actual content needs (so e.g. a Chinese company name on an
// English invoice still renders instead of crashing Helvetica's encoder).
function planFamilies(langParts, corpus) {
  const fams = [];
  const add = (f) => { if (f && !fams.includes(f)) fams.push(f); };
  for (const p of langParts) add(LANG_FONT[p]);
  const classes = new Set();
  for (const ch of new Set(corpus)) classes.add(classOf(ch.codePointAt(0)));
  if (classes.has('hangul')) add('kr');
  if ((classes.has('cjk') || classes.has('kana')) && !fams.includes('sc') && !fams.includes('jp')) add('sc');
  if (classes.has('ext') && !fams.some((f) => ['vn', 'sc', 'kr'].includes(f))) add('vn');
  return fams;
}

// Builds a text styler that measures/draws strings word-by-word, picking a
// font per word by script (fontkit can't fall back mid-string on its own).
async function makeStyler(doc, inv, L, loadFont, loadWasm) {
  const langParts = String(inv.lang || 'en').split('-');
  const corpus = charCorpus(inv, L);
  const fams = planFamilies(langParts, corpus);

  const embedded = {};
  if (fams.length) {
    doc.registerFontkit(fontkit);
    const hb = await getHb(loadWasm);
    await Promise.all(fams.map(async (fam) => {
      const [regBytes, boldBytes] = await Promise.all(FONT_FILES[fam].map(loadFont));
      // Subset to the document's characters ourselves (HarfBuzz), then embed
      // whole: fontkit's { subset: true } corrupts CJK glyphs.
      const [reg, bold] = await Promise.all([
        doc.embedFont(subsetFontBytes(hb, regBytes, corpus), { subset: false }),
        doc.embedFont(subsetFontBytes(hb, boldBytes, corpus), { subset: false }),
      ]);
      embedded[fam] = { reg, bold };
    }));
  }
  const helv = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const base = embedded[LANG_FONT[langParts[0]]] ?? (fams.length ? embedded[fams[0]] : helv);

  const pick = (...cands) => cands.find((f) => embedded[f]);
  const famFor = {
    hangul: () => pick('kr'),
    kana: () => pick('jp', 'sc'),
    cjk: () => pick('sc', 'jp'),
    ext: () => pick('vn', 'sc', 'kr', 'jp'),
  };

  const fontFor = (token, bold) => {
    let cls = 'latin';
    for (const ch of token) {
      const c = classOf(ch.codePointAt(0));
      if (STRENGTH[c] > STRENGTH[cls]) cls = c;
    }
    const pair = (famFor[cls] && embedded[famFor[cls]()]) || base;
    return bold ? pair.bold : pair.reg;
  };

  const tokens = (str) => String(str).split(/(\s+)/).filter(Boolean);

  const width = (str, size, bold = false) =>
    tokens(str).reduce((w, t) => w + fontFor(t, bold).widthOfTextAtSize(t, size), 0);

  const draw = (page, str, x, yTop, { size = 10, bold = false, color = INK, align = 'left' } = {}) => {
    let tx = align === 'right' ? x - width(str, size, bold) : x;
    for (const t of tokens(str)) {
      const f = fontFor(t, bold);
      page.drawText(t, { x: tx, y: PAGE_H - yTop, size, font: f, color });
      tx += f.widthOfTextAtSize(t, size);
    }
  };

  return { width, draw };
}

// Wraps text to maxWidth; falls back to per-character breaks for CJK/long words.
function wrapText(text, styler, size, maxWidth, bold = false) {
  const lines = [];
  for (const raw of String(text).split('\n')) {
    let line = '';
    for (const word of raw.split(/(\s+)/)) {
      if (styler.width(line + word, size, bold) <= maxWidth) {
        line += word;
        continue;
      }
      if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
      let chunk = word.trimStart();
      while (styler.width(chunk, size, bold) > maxWidth) {
        let i = chunk.length;
        while (i > 1 && styler.width(chunk.slice(0, i), size, bold) > maxWidth) i--;
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
  const L = labels(inv.lang);
  const styler = await makeStyler(doc, inv, L, loadFont, loadWasm);
  const { subtotal, discount, tax, total } = computeTotals(inv);
  const money = (v) => formatMoney(v, inv.currency);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  // y is measured from the top of the page (baseline position).
  let y = 0;
  const text = (str, x, yTop, opts = {}) => styler.draw(page, str, x, yTop, opts);
  const hline = (yTop, x1 = MARGIN, x2 = PAGE_W - MARGIN, color = RULE) =>
    page.drawLine({ start: { x: x1, y: PAGE_H - yTop }, end: { x: x2, y: PAGE_H - yTop }, thickness: 1, color });
  const ensureRoom = (needed) => {
    if (y + needed > PAGE_H - 60) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = 60;
    }
  };

  // Shrinks type until it fits — long bilingual labels (e.g. Vietnamese titles)
  // otherwise collide with neighboring content.
  const fitSize = (str, baseSize, maxW, bold = false) => {
    let s = baseSize;
    while (s > 7.5 && styler.width(str, s, bold) > maxW) s -= 0.5;
    return s;
  };

  // Header — reserve however much the widest meta label + value actually needs
  const meta = [
    [L.invoiceNo, inv.number || '—'],
    [L.issueDate, inv.issueDate || '—'],
    ...(inv.dueDate ? [[L.dueDate, inv.dueDate]] : []),
  ];
  const metaLabelW = Math.max(...meta.map(([k]) => styler.width(k, 9)));
  text(L.title, MARGIN, 72, {
    bold: true,
    size: fitSize(L.title, 24, CONTENT_W - metaLabelW - 110 - 24, true),
  });
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
    text(label.toUpperCase(), x, y, { bold: true, size: 9, color: ACCENT });
    const nameLines = wrapText(name || '—', styler, 11, colW - 20, true);
    nameLines.forEach((ln, i) => text(ln, x, y + 16 + i * 14, { bold: true, size: 11 }));
    const detailsTop = y + 16 + nameLines.length * 14;
    const lines = wrapText(details || '', styler, 9.5, colW - 20);
    lines.forEach((ln, i) => text(ln, x, detailsTop + i * 12, { size: 9.5, color: MUTED }));
    return detailsTop + lines.length * 12;
  };
  const endFrom = party(L.from, inv.fromName, inv.fromDetails, MARGIN);
  const endTo = party(L.billTo, inv.toName, inv.toDetails, MARGIN + colW);
  y = Math.max(endFrom, endTo, y + 46) + 24;

  // Items table
  const COLS = [
    { w: CONTENT_W - 50 - 90 - 90, align: 'left', label: L.description },
    { w: 50, align: 'right', label: L.qty },
    { w: 90, align: 'right', label: L.unitPrice },
    { w: 90, align: 'right', label: L.amount },
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
  COLS.forEach((c, i) => cellText(c.label, i, y + 8, { bold: true, size: 8.5, color: MUTED }));
  y += 26;

  const rows = inv.items.filter((it) => it.desc || Number(it.qty) || Number(it.price));
  for (const it of rows) {
    const descLines = wrapText(it.desc || '—', styler, 10, COLS[0].w - 16);
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
  const totalsW = 250;
  const totalsX1 = PAGE_W - MARGIN - totalsW;
  const totalRow = (label, value, isGrand = false) => {
    ensureRoom(24);
    let size = isGrand ? 12 : 10;
    while (size > 7.5 &&
      styler.width(label, size, isGrand) + styler.width(value, size, isGrand) + 12 > totalsW) {
      size -= 0.5;
    }
    text(label, totalsX1, y, { bold: isGrand, size, color: isGrand ? INK : MUTED });
    text(value, PAGE_W - MARGIN, y, { bold: isGrand, size, align: 'right' });
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
    const noteLines = wrapText(inv.notes, styler, 9.5, CONTENT_W);
    ensureRoom(20 + noteLines.length * 12);
    text(L.notes.toUpperCase(), MARGIN, y, { bold: true, size: 9, color: ACCENT });
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
