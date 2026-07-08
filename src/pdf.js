import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { computeTotals, formatMoney } from './invoice.js';

const INK = [24, 33, 47];
const MUTED = [110, 120, 135];
const ACCENT = [37, 99, 235];
const RULE = [226, 230, 236];
const MARGIN = 48;

// Builds the invoice PDF and returns the jsPDF document.
export function buildPdf(inv) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const { subtotal, discount, tax, total } = computeTotals(inv);
  const money = (v) => formatMoney(v, inv.currency);

  // Header
  doc.setFont('helvetica', 'bold').setFontSize(26).setTextColor(...INK);
  doc.text('INVOICE', MARGIN, 72);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED);
  const meta = [
    [`Invoice #`, inv.number || '—'],
    [`Issue date`, inv.issueDate || '—'],
    ...(inv.dueDate ? [[`Due date`, inv.dueDate]] : []),
  ];
  meta.forEach(([k, v], i) => {
    const y = 58 + i * 14;
    doc.text(k, pageW - MARGIN - 150, y);
    doc.setTextColor(...INK).text(String(v), pageW - MARGIN, y, { align: 'right' });
    doc.setTextColor(...MUTED);
  });

  doc.setDrawColor(...RULE).setLineWidth(1).line(MARGIN, 96, pageW - MARGIN, 96);

  // From / Bill To
  const colW = (pageW - MARGIN * 2) / 2;
  let y = 120;
  const party = (label, name, details, x) => {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACCENT);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(11).setTextColor(...INK);
    doc.text(name || '—', x, y + 16);
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTED);
    const lines = doc.splitTextToSize(details || '', colW - 20);
    doc.text(lines, x, y + 30);
    return y + 30 + lines.length * 12;
  };
  const endFrom = party('From', inv.fromName, inv.fromDetails, MARGIN);
  const endTo = party('Bill to', inv.toName, inv.toDetails, MARGIN + colW);
  y = Math.max(endFrom, endTo, y + 46) + 16;

  // Items table
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Description', 'Qty', 'Unit price', 'Amount']],
    body: inv.items
      .filter((it) => it.desc || Number(it.qty) || Number(it.price))
      .map((it) => [
        it.desc || '—',
        String(Number(it.qty) || 0),
        money(it.price),
        money((Number(it.qty) || 0) * (Number(it.price) || 0)),
      ]),
    styles: { font: 'helvetica', fontSize: 10, textColor: INK, cellPadding: 8 },
    headStyles: { fillColor: [246, 248, 251], textColor: MUTED, fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      1: { halign: 'right', cellWidth: 50 },
      2: { halign: 'right', cellWidth: 90 },
      3: { halign: 'right', cellWidth: 90 },
    },
    alternateRowStyles: { fillColor: false },
    tableLineColor: RULE,
    tableLineWidth: 0,
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) data.cell.styles.halign = 'right';
    },
  });

  // Totals
  let ty = doc.lastAutoTable.finalY + 20;
  const totalRow = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
      .setFontSize(bold ? 12 : 10)
      .setTextColor(...(bold ? INK : MUTED));
    doc.text(label, pageW - MARGIN - 200, ty);
    doc.setTextColor(...INK).text(value, pageW - MARGIN, ty, { align: 'right' });
    ty += bold ? 22 : 18;
  };
  totalRow('Subtotal', money(subtotal));
  if (Number(inv.discount) > 0) totalRow(`Discount (${inv.discount}%)`, `-${money(discount)}`);
  if (Number(inv.taxRate) > 0) totalRow(`Tax (${inv.taxRate}%)`, money(tax));
  doc.setDrawColor(...RULE).line(pageW - MARGIN - 200, ty - 10, pageW - MARGIN, ty - 10);
  ty += 4;
  totalRow('Total due', money(total), true);

  // Notes
  if (inv.notes) {
    ty += 14;
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACCENT);
    doc.text('NOTES', MARGIN, ty);
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(inv.notes, pageW - MARGIN * 2), MARGIN, ty + 14);
  }

  return doc;
}

export function downloadPdf(inv) {
  const name = (inv.number || 'invoice').replace(/[^\w.-]+/g, '-');
  buildPdf(inv).save(`${name}.pdf`);
}
