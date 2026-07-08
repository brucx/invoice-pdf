// One-off generator for public/og.png (1200x630). Run: node scripts/og-image.mjs
// Uses system DejaVu Sans via librsvg/fontconfig.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#eef1f6"/>
  <rect x="0" y="0" width="1200" height="8" fill="#2563eb"/>

  <!-- text block -->
  <text x="80" y="270" font-family="DejaVu Sans" font-weight="bold" font-size="76" fill="#18212f">Invoice PDF</text>
  <text x="80" y="340" font-family="DejaVu Sans" font-size="34" fill="#2563eb" font-weight="bold">Free Invoice Generator</text>
  <text x="80" y="410" font-family="DejaVu Sans" font-size="24" fill="#6e7887">No sign-up. No watermark.</text>
  <text x="80" y="448" font-family="DejaVu Sans" font-size="24" fill="#6e7887">Your data never leaves your browser.</text>
  <text x="80" y="545" font-family="DejaVu Sans" font-size="22" fill="#98a1af">invoices-generator.net</text>

  <!-- invoice paper mockup -->
  <g transform="translate(760, 95)">
    <rect x="8" y="12" width="340" height="440" rx="10" fill="#18212f" opacity="0.08"/>
    <rect x="0" y="0" width="340" height="440" rx="10" fill="#ffffff" stroke="#e2e6ec"/>
    <text x="32" y="58" font-family="DejaVu Sans" font-weight="bold" font-size="26" fill="#18212f">INVOICE</text>
    <text x="238" y="58" font-family="DejaVu Sans" font-size="14" fill="#6e7887">INV-0042</text>
    <line x1="32" y1="80" x2="308" y2="80" stroke="#e2e6ec" stroke-width="2"/>
    <rect x="32" y="102" width="90" height="10" rx="5" fill="#dbe3ee"/>
    <rect x="32" y="122" width="120" height="10" rx="5" fill="#eceff4"/>
    <rect x="200" y="102" width="90" height="10" rx="5" fill="#dbe3ee"/>
    <rect x="200" y="122" width="108" height="10" rx="5" fill="#eceff4"/>
    <rect x="32" y="170" width="276" height="30" rx="4" fill="#f6f8fb"/>
    <rect x="32" y="214" width="180" height="10" rx="5" fill="#eceff4"/>
    <rect x="268" y="214" width="40" height="10" rx="5" fill="#dbe3ee"/>
    <rect x="32" y="240" width="150" height="10" rx="5" fill="#eceff4"/>
    <rect x="268" y="240" width="40" height="10" rx="5" fill="#dbe3ee"/>
    <rect x="32" y="266" width="164" height="10" rx="5" fill="#eceff4"/>
    <rect x="268" y="266" width="40" height="10" rx="5" fill="#dbe3ee"/>
    <line x1="32" y1="310" x2="308" y2="310" stroke="#e2e6ec" stroke-width="2"/>
    <text x="32" y="345" font-family="DejaVu Sans" font-size="15" fill="#6e7887">Total due</text>
    <text x="308" y="345" text-anchor="end" font-family="DejaVu Sans" font-weight="bold" font-size="19" fill="#18212f">$4,890.00</text>
    <rect x="32" y="380" width="276" height="36" rx="8" fill="#2563eb"/>
    <text x="170" y="404" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="16" fill="#ffffff">Download PDF</text>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(new URL('../public/og.png', import.meta.url), png);
console.log(`og.png written, ${png.length} bytes`);
