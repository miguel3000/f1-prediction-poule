import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Images the mails load from the live site (tools/email-images/make_checkers.py)
const PUBLIC_DIR = path.resolve(__dirname, '../../../../frontend/public'); // from dist/services/__tests__

// A tiny reader for the palette PNGs the tools write (any filter type, 1 to 8 bits per pixel), so the
// pattern of the strip can be checked pixel by pixel without a image library.
const readPalettePng = (file: string) => {
  const png = fs.readFileSync(file);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a PNG');
  let width = 0, height = 0, depth = 0, palette: number[][] = [];
  const idat: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const type = png.subarray(at + 4, at + 8).toString('ascii');
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      assert.equal(data[9], 3, 'expected a palette PNG');
    } else if (type === 'PLTE') {
      palette = Array.from({ length: length / 3 }, (_, i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]);
    } else if (type === 'IDAT') idat.push(data);
    at += 12 + length;
  }
  const rowBytes = Math.ceil((width * depth) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (rowBytes + 1)];
    const line = Buffer.from(raw.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1)));
    const up = y > 0 ? rows[y - 1] : Buffer.alloc(rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      const left = i > 0 ? line[i - 1] : 0;
      const upLeft = i > 0 ? up[i - 1] : 0;
      let add = 0;
      if (filter === 1) add = left;
      else if (filter === 2) add = up[i];
      else if (filter === 3) add = (left + up[i]) >> 1;
      else if (filter === 4) {
        const p = left + up[i] - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up[i]), pc = Math.abs(p - upLeft);
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up[i] : upLeft;
      }
      line[i] = (line[i] + add) & 0xff;
    }
    rows.push(line);
  }
  const colour = (x: number, y: number): string => {
    const bit = x * depth;
    const index = (rows[y][bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
    return palette[index].join(',');
  };
  return { width, height, size: png.length, colour };
};

const YELLOW = '255,216,26'; // BRAND_YELLOW
const NAVY = '0,82,119'; // BRAND_NAVY
const COLS = 33; // an odd number of squares: the left end and the right end are the same
const SQUARE = 40;

test('the_checkered_strip_is_a_small_png_made_of_whole_squares', () => {
  const strip = readPalettePng(path.join(PUBLIC_DIR, 'email-checkers.png'));
  assert.equal(strip.width, COLS * SQUARE, 'width: 33 squares of 40 px');
  assert.equal(strip.height, 2 * SQUARE, 'height: 2 rows of 40 px');
  assert.ok(strip.size < 2_000, `${strip.size} bytes: a two-colour strip should be tiny`);
});

test('every_square_of_the_strip_is_one_solid_yellow_or_dark_blue_and_neighbours_alternate', () => {
  const strip = readPalettePng(path.join(PUBLIC_DIR, 'email-checkers.png'));
  const squareColour = (col: number, row: number) => {
    const seen = new Set<string>();
    // all four corners, the middle and the edges of the square: no square is cut in two colours
    for (const dx of [0, SQUARE / 2, SQUARE - 1]) {
      for (const dy of [0, SQUARE / 2, SQUARE - 1]) seen.add(strip.colour(col * SQUARE + dx, row * SQUARE + dy));
    }
    assert.equal(seen.size, 1, `square ${col},${row} is not one colour`);
    const [only] = [...seen];
    assert.ok(only === YELLOW || only === NAVY, `square ${col},${row} is ${only}`);
    return only;
  };
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < COLS; col++) {
      if (col + 1 < COLS) assert.notEqual(squareColour(col, row), squareColour(col + 1, row), `${col},${row} next to its right neighbour`);
      if (row + 1 < 2) assert.notEqual(squareColour(col, row), squareColour(col, row + 1), `${col},${row} above its neighbour`);
    }
  }
});

test('the_left_end_of_the_strip_is_the_same_as_the_right_end', () => {
  const strip = readPalettePng(path.join(PUBLIC_DIR, 'email-checkers.png'));
  // the strip sits between a yellow banner and a dark blue hero, so the dark blue squares of the top row and the
  // yellow squares of the bottom row are the ones you see: both ends must start and finish with those
  for (const row of [0, 1]) {
    for (let col = 0; col < COLS; col++) {
      assert.equal(strip.colour(col * SQUARE + 5, row * SQUARE + 5), strip.colour((COLS - 1 - col) * SQUARE + 5, row * SQUARE + 5), `square ${col},${row} has no mirror image`);
    }
  }
  for (const col of [0, COLS - 1]) {
    assert.equal(strip.colour(col * SQUARE + 5, 5), NAVY, `top row, column ${col}: a dark blue square under the banner`);
    assert.equal(strip.colour(col * SQUARE + 5, SQUARE + 5), YELLOW, `bottom row, column ${col}: a yellow square above the hero`);
  }
});
