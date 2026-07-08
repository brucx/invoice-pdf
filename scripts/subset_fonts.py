#!/usr/bin/env python3
"""Subset Noto Sans SC/JP (Regular+Bold) as TrueType for PDF embedding.

Pipeline: Google Fonts variable TTF -> instancer (wght 400/700) -> pyftsubset.
TrueType (glyf) outlines are required: @pdf-lib/fontkit's runtime subsetting
corrupts CID-keyed CFF (Noto OTF), but handles glyf reliably.

Coverage: Latin-1 + general/CJK punctuation + fullwidth forms, plus
GB2312 for SC and JIS X 0208 (via Shift_JIS) + kana for JP.

Usage: python3 scripts/subset_fonts.py <dir with NotoSansSC-var.ttf / NotoSansJP-var.ttf>
Sources:
  https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf
  https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf
"""
import subprocess
import sys
import tempfile
from pathlib import Path

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'fonts'
OUT.mkdir(parents=True, exist_ok=True)

COMMON = set(chr(c) for c in range(0x20, 0x7F))          # ASCII
COMMON |= set(chr(c) for c in range(0xA0, 0x100))        # Latin-1
COMMON |= set(chr(c) for c in range(0x100, 0x250))       # Latin Ext-A/B (vi, eu names)
COMMON |= set(chr(c) for c in range(0x1E00, 0x1F00))     # Latin Ext Additional (vi)
COMMON |= set(chr(c) for c in range(0x20A0, 0x20D0))     # currency symbols (₩ ₫ ₹ €)
COMMON |= set('–—‘’“”†‡•…‰′″‹›™©®°±×÷')                   # common punct/symbols
COMMON |= set(chr(c) for c in range(0x3000, 0x3040))     # CJK punctuation
COMMON |= set(chr(c) for c in range(0xFF00, 0xFFF0))     # fullwidth forms


def gb2312_chars():
    chars = set()
    for b1 in range(0xA1, 0xF8):
        for b2 in range(0xA1, 0xFF):
            try:
                chars.add(bytes([b1, b2]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return chars


def big5_chars():
    chars = set()
    for b1 in range(0xA4, 0xFA):
        for b2 in list(range(0x40, 0x7F)) + list(range(0xA1, 0xFF)):
            try:
                chars.add(bytes([b1, b2]).decode('big5'))
            except UnicodeDecodeError:
                pass
    return chars


def jis_chars():
    chars = set(chr(c) for c in range(0x3040, 0x3100))   # hiragana + katakana
    chars |= set(chr(c) for c in range(0x31F0, 0x3200))  # katakana ext
    for cp in range(0x4E00, 0xA000):                     # kanji in JIS X 0208
        ch = chr(cp)
        try:
            ch.encode('shift_jis')
            chars.add(ch)
        except UnicodeEncodeError:
            pass
    return chars


def hangul_chars():
    chars = set(chr(c) for c in range(0x3130, 0x3190))   # compat jamo
    for cp in range(0xAC00, 0xD7A4):                     # KS X 1001 syllables
        ch = chr(cp)
        try:
            ch.encode('euc_kr')
            chars.add(ch)
        except UnicodeEncodeError:
            pass
    return chars


# SC also covers JIS + Big5 codepoints (mainland glyph style): it serves the
# zh-ja bilingual mode and traditional-Chinese input, which GB2312 alone lacks.
# NotoSans (plain) is the small Latin/Vietnamese font for invoices without CJK.
# Extra axes beyond wght (NotoSans has wdth) are pinned to their defaults.
JOBS = [
    ('NotoSansSC-var.ttf', 'NotoSansSC', lambda: gb2312_chars() | jis_chars() | big5_chars()),
    ('NotoSansJP-var.ttf', 'NotoSansJP', jis_chars),
    ('NotoSansKR-var.ttf', 'NotoSansKR', hangul_chars),
    ('NotoSans-var.ttf', 'NotoSans', set),
]
WEIGHTS = [('Regular', 400), ('Bold', 700)]

with tempfile.TemporaryDirectory() as tmp:
    for var_name, family, extra in JOBS:
        chars = COMMON | extra()
        text_file = Path(tmp) / f'{family}.chars.txt'
        text_file.write_text(''.join(sorted(chars)), encoding='utf-8')
        from fontTools.ttLib import TTFont
        axes = [a.axisTag for a in TTFont(str(SRC / var_name), lazy=True)['fvar'].axes]
        for weight_name, wght in WEIGHTS:
            static = Path(tmp) / f'{family}-{weight_name}.ttf'
            extra = [f'{a}=drop' for a in axes if a != 'wght']
            subprocess.run([
                'python3', '-m', 'fontTools.varLib.instancer',
                str(SRC / var_name), f'wght={wght}', *extra, '-o', str(static), '--quiet',
            ], check=True)
            out = OUT / f'{family}-{weight_name}.ttf'
            subprocess.run([
                'pyftsubset', str(static),
                f'--text-file={text_file}',
                f'--output-file={out}',
                '--layout-features=kern',
                '--no-hinting',
                '--name-IDs=1,2,3,4,6',
            ], check=True)
            print(f'{out.name}: {out.stat().st_size / 1024 / 1024:.2f} MB, {len(chars)} chars')
