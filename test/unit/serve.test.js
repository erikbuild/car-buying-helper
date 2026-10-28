// ABOUTME: Checks the Cache-Control header of the static server that the end-to-end tests serve the page with.
// ABOUTME: It's no-cache unless a test asks for another, such as the max-age=600 that GitHub Pages sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from '../serve.js';

// Serves a folder holding only index.html on a free port, with startServer's options, and returns the status and
// Cache-Control header of the page and of a file that isn't there.
async function pageAndMissingFile(t, options) {
  const dir = mkdtempSync(path.join(tmpdir(), 'serve-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html>\n');
  const server = await startServer(dir, 0, options);
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const pageUrl = `http://localhost:${server.address().port}/car-buying-helper/`;
  const responses = [await fetch(pageUrl), await fetch(`${pageUrl}missing.js`)];
  return Promise.all(responses.map(async (response) => {
    await response.text();
    return [response.status, response.headers.get('cache-control')];
  }));
}

test('the server sends Cache-Control: no-cache unless asked for another', async (t) => {
  assert.deepEqual(await pageAndMissingFile(t), [[200, 'no-cache'], [404, 'no-cache']]);
});

test("the server sends the Cache-Control it's asked for, such as GitHub Pages' max-age=600", async (t) => {
  assert.deepEqual(await pageAndMissingFile(t, { cacheControl: 'max-age=600' }), [
    [200, 'max-age=600'],
    [404, 'max-age=600'],
  ]);
});
