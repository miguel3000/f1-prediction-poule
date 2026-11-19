import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// Images the mails load from the live site (tools/email-images/make_checkers.py)
const PUBLIC_DIR = path.resolve(__dirname, '../../../../frontend/public'); // from dist/services/__tests__

test('the_checkered_strip_is_a_small_png_of_the_agreed_size', () => {
  const png = fs.readFileSync(path.join(PUBLIC_DIR, 'email-checkers.png'));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a PNG');
  assert.equal(png.readUInt32BE(16), 1280, 'width: 32 squares of 40 px');
  assert.equal(png.readUInt32BE(20), 80, 'height: 2 rows of 40 px');
  assert.ok(png.length < 2_000, `${png.length} bytes: a two-colour strip should be tiny`);
});
