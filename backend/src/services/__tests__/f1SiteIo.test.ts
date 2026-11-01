import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchF1Page } from '../f1SiteIo';

const URL_OK = 'https://www.formula1.com/en/results/2026/races/1298/mexico/starting-grid';

test('a_page_is_returned_as_text', async () => {
  assert.equal(await fetchF1Page(URL_OK, async () => ({ status: 200, data: '<html>grid</html>' })), '<html>grid</html>');
});

test('a_page_formula1_com_does_not_have_is_null_not_an_error', async () => {
  assert.equal(await fetchF1Page(URL_OK, async () => ({ status: 404, data: 'Not found' })), null);
});

test('an_error_from_the_network_is_passed_on', async () => {
  await assert.rejects(
    () =>
      fetchF1Page(URL_OK, async () => {
        throw new Error('connect ETIMEDOUT');
      }),
    /ETIMEDOUT/
  );
});

test('a_url_outside_formula1_com_is_refused_before_anything_is_requested', async () => {
  let requests = 0;
  const http = async () => {
    requests++;
    return { status: 200, data: '' };
  };
  for (const url of ['http://www.formula1.com/en/results', 'https://evil.example/x', 'https://www.formula1.com.evil.example/x', 'file:///etc/passwd', 'not a url']) {
    await assert.rejects(() => fetchF1Page(url, http), /not a formula1\.com url/i, url);
  }
  assert.equal(requests, 0);
});
