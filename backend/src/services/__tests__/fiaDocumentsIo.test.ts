import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fetchFiaPdfText, pdfBufferToText, MAX_PDF_BYTES } from '../fiaDocumentsIo';

const FIXTURES = path.resolve(__dirname, '../../../src/services/__tests__/fixtures/fia');
const FIA_URL = 'https://www.fia.com/system/files/decision-document/2026_mexico_city_grand_prix_-_decision_-_driver_change_tgr_haas_f1_team.pdf';
const hasPdftotext = !spawnSync('pdftotext', ['-v']).error;

test('the_real_pdf_gives_its_text', { skip: hasPdftotext ? false : 'pdftotext (poppler) is not installed' }, async () => {
  const pdf = fs.readFileSync(path.join(FIXTURES, 'driver_change.pdf'));
  const text = await fetchFiaPdfText(FIA_URL, async () => pdf);
  assert.match(text, /Ryo Hirakawa/);
  assert.match(text.replace(/\s+/g, ' '), /in place of Esteban Ocon/);
});

test('a_non_pdf_body_is_rejected', async () => {
  await assert.rejects(() => fetchFiaPdfText(FIA_URL, async () => Buffer.from('<html>Access denied</html>')), /not a pdf/i);
});

test('a_missing_tool_is_an_error_not_a_hang', async () => {
  const started = Date.now();
  await assert.rejects(() => pdfBufferToText(Buffer.from('%PDF-1.4'), 'definitely-not-an-installed-tool'), /ENOENT|not found/i);
  assert.ok(Date.now() - started < 3000);
});

test('a_download_over_the_cap_is_rejected', async () => {
  const big = Buffer.alloc(MAX_PDF_BYTES + 1, 0x41);
  big.write('%PDF-');
  await assert.rejects(() => fetchFiaPdfText(FIA_URL, async () => big), /too large/i);
});

test('a_url_outside_fia_is_refused_before_anything_is_downloaded', async () => {
  let downloads = 0;
  const download = async () => {
    downloads++;
    return Buffer.from('%PDF-1.4');
  };
  for (const url of ['http://localhost/x.pdf', 'https://evil.example/x.pdf', 'https://www.fia.com.evil.example/x.pdf', 'file:///etc/passwd', 'not a url']) {
    await assert.rejects(() => fetchFiaPdfText(url, download), /not an fia document url/i, url);
  }
  assert.equal(downloads, 0);
});
