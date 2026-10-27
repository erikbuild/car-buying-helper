// ABOUTME: Checks the home-screen icons' pixel sizes, read from each PNG's IHDR chunk.
// ABOUTME: Also checks that the web app manifest opens the page full screen and lists the PNG icons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const siteDir = new URL('../../site/', import.meta.url);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngSize(file) {
  const bytes = readFileSync(new URL(file, siteDir));
  assert.deepEqual([...bytes.subarray(0, 8)], PNG_SIGNATURE, `${file} starts with the PNG signature`);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', `${file} starts with an IHDR chunk`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

for (const [file, size] of [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180]]) {
  test(`${file} is ${size}×${size}`, () => {
    assert.deepEqual(pngSize(file), { width: size, height: size });
  });
}

test('the manifest opens the page full screen and lists the 192 and 512 PNG icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', siteDir), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.deepEqual(manifest.icons, [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ]);
});
