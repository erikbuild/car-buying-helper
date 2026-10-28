// ABOUTME: Checks that the offline cache's file list in site/offline.js matches the files in site/.
// ABOUTME: Also checks that offline.js holds the release placeholder that the deploy replaces exactly once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = fileURLToPath(new URL('../../site/', import.meta.url));
const RELEASE_PLACEHOLDER = "const RELEASE = 'development';";

function readOfflineScript() {
  return readFileSync(path.join(siteDir, 'offline.js'), 'utf8');
}

// Reads the FILES array out of the worker script's text, since the worker can't run in Node.
function cachedFiles(offlineScript) {
  const list = offlineScript.match(/const FILES = \[([^\]]*)\];/)?.[1];
  assert.ok(list !== undefined, 'offline.js has no FILES array');
  return [...list.matchAll(/'([^']+)'/g)].map(([, file]) => file);
}

// Lists every file under site/ as a path relative to site/.
function siteFiles() {
  return readdirSync(siteDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(siteDir, path.join(entry.parentPath, entry.name)));
}

test('FILES lists every site file', () => {
  const expected = ['./', ...siteFiles().filter((file) => file !== 'offline.js')].sort();
  assert.deepEqual(cachedFiles(readOfflineScript()).sort(), expected);
});

test('release placeholder appears once', () => {
  assert.equal(readOfflineScript().split(RELEASE_PLACEHOLDER).length - 1, 1);
});
