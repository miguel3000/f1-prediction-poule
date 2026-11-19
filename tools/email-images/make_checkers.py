#!/usr/bin/env python3
"""Draws the checkered flag strip under the banner of the race weekend preview mail.

  frontend/public/email-checkers.png     2 rows of 33 squares, our yellow and dark blue

The mail shows it at full width, so the squares keep their shape on any screen: about 18 px at
the mail's 600 px, about 11 px on a phone. It is an image (not table cells) because a fluid table
cannot keep squares square; a client that blocks images shows the dark blue behind it instead.

The strip sits between the yellow banner and the dark blue hero, so the yellow squares of the top
row and the dark blue squares of the bottom row melt into them: what you see is a dark blue square
hanging from the banner over a yellow square rising from the hero, in every other column. There is
an odd number of columns and the first column is one of those, so the left end and the right end
are exactly the same.

  python3 -m venv /tmp/circuit-venv && /tmp/circuit-venv/bin/pip install pillow
  /tmp/circuit-venv/bin/python tools/email-images/make_checkers.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'frontend', 'public', 'email-checkers.png')
YELLOW, NAVY = (255, 216, 26), (0, 82, 119)  # BRAND_YELLOW, BRAND_NAVY in services/emailService.ts
COLS, ROWS, SQUARE = 33, 2, 40  # odd, so both ends are the same

im = Image.new('RGB', (COLS * SQUARE, ROWS * SQUARE), NAVY)
for row in range(ROWS):
    for col in range(COLS):
        if (row + col) % 2 == 1:  # top row: dark blue first (a visible square under the banner), bottom row: yellow first
            im.paste(YELLOW, (col * SQUARE, row * SQUARE, (col + 1) * SQUARE, (row + 1) * SQUARE))
im.quantize(colors=2, dither=Image.Dither.NONE).save(OUT, optimize=True)
print(f'wrote {os.path.relpath(OUT, ROOT)} ({im.width}x{im.height}, {os.path.getsize(OUT)} bytes)')
