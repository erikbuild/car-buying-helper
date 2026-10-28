// ABOUTME: Checks the release stamp that the deploy writes into the offline cache's script.
// ABOUTME: Covers stampRelease on offline.js text and the command line that edits site/offline.js in place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampRelease } from '../../tools/stamp-release.js';

const offlineScriptPath = fileURLToPath(new URL('../../site/offline.js', import.meta.url));
const toolPath = fileURLToPath(new URL('../../tools/stamp-release.js', import.meta.url));
const PLACEHOLDER = "const RELEASE = 'development';";

function occurrences(text, part) {
  return text.split(part).length - 1;
}

// Copies the stamp tool and site/offline.js into a temporary folder laid out like the repo, and returns
// a path to that folder through a symlink, as macOS's temporary folder is. Running the copied tool
// edits the copy of offline.js.
function makeRepoCopy(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'stamp-release-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, 'repo');
  mkdirSync(path.join(repo, 'tools'), { recursive: true });
  mkdirSync(path.join(repo, 'site'));
  writeFileSync(path.join(repo, 'package.json'), '{ "type": "module" }\n');
  copyFileSync(toolPath, path.join(repo, 'tools', 'stamp-release.js'));
  copyFileSync(offlineScriptPath, path.join(repo, 'site', 'offline.js'));
  const link = path.join(dir, 'link');
  symlinkSync(repo, link);
  return link;
}

test('stamping offline.js with abc123 leaves exactly one release line, naming abc123', () => {
  const offlineScript = readFileSync(offlineScriptPath, 'utf8');
  const stamped = stampRelease(offlineScript, 'abc123');
  assert.equal(occurrences(stamped, "const RELEASE = 'abc123';"), 1);
  assert.equal(occurrences(stamped, PLACEHOLDER), 0);
  assert.equal(stamped, offlineScript.replace(PLACEHOLDER, "const RELEASE = 'abc123';"));
});

test('text without the release placeholder throws', () => {
  assert.throws(() => stampRelease("const RELEASE = 'abc123';\n", 'def456'), {
    message: `Expected "${PLACEHOLDER}" exactly once, found 0`,
  });
});

test('text with the release placeholder twice throws', () => {
  assert.throws(() => stampRelease(`${PLACEHOLDER}\n${PLACEHOLDER}\n`, 'abc123'), {
    message: `Expected "${PLACEHOLDER}" exactly once, found 2`,
  });
});

test('the command line stamps site/offline.js in place', (t) => {
  const repo = makeRepoCopy(t);
  execFileSync(process.execPath, [path.join(repo, 'tools', 'stamp-release.js'), 'abc123'], { stdio: 'pipe' });
  const expected = readFileSync(offlineScriptPath, 'utf8').replace(PLACEHOLDER, "const RELEASE = 'abc123';");
  assert.equal(readFileSync(path.join(repo, 'site', 'offline.js'), 'utf8'), expected);
});

test('the command line without a release exits with an error and leaves site/offline.js alone', (t) => {
  const repo = makeRepoCopy(t);
  const result = spawnSync(process.execPath, [path.join(repo, 'tools', 'stamp-release.js')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'Usage: node tools/stamp-release.js <release>\n');
  assert.equal(readFileSync(path.join(repo, 'site', 'offline.js'), 'utf8'), readFileSync(offlineScriptPath, 'utf8'));
});
