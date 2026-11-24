import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { llmsRouter } from '../llms';

const content = {
  version: 1,
  pages: [{
    path: '/',
    en: { title: 'Poule Position – F1 prediction game for friends', description: 'Predict the top 10 of every race.', blocks: [{ type: 'h1', text: 'Poule Position' }] },
    nl: { title: 'F1-poule spelen met vrienden – Poule Position', description: 'Voorspel de top 10 van elke race.', blocks: [{ type: 'h1', text: 'Poule Position' }] },
  }],
};

let server: Server;
let base = '';
let dir = '';
let emptyDir = '';
let withoutContent = '';

const serve = (frontendDir: string) =>
  new Promise<void>((resolve) => {
    const app = express();
    app.use(llmsRouter(frontendDir));
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-'));
  fs.writeFileSync(path.join(dir, 'seo-content.json'), JSON.stringify(content));
  emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-empty-'));
  withoutContent = emptyDir;
  await serve(dir);
});
after(() => {
  server.closeAllConnections();
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(emptyDir, { recursive: true, force: true });
});

test('llms_txt_is_served_as_plain_text_that_can_be_cached_for_an_hour', async () => {
  const res = await fetch(`${base}/llms.txt`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^text\/plain; charset=utf-8/);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=3600');
  const body = await res.text();
  assert.ok(body.startsWith('# Poule Position\n'));
  assert.ok(body.includes('](https://pouleposition.nl/nl)'));
});

test('llms_full_txt_is_served_too', async () => {
  const res = await fetch(`${base}/llms-full.txt`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^text\/plain/);
  assert.ok((await res.text()).includes('Source: https://pouleposition.nl/nl'));
});

test('without_a_content_file_both_are_a_plain_404_not_the_app_shell', async () => {
  server.close();
  await serve(withoutContent);
  for (const p of ['/llms.txt', '/llms-full.txt']) {
    const res = await fetch(`${base}${p}`);
    assert.equal(res.status, 404, p);
    assert.match(res.headers.get('content-type') ?? '', /text\/plain/);
  }
});
