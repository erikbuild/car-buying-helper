// ABOUTME: Checks startedAsCommand, which tells a module whether Node was started with it.
// ABOUTME: Runs small scripts in a temporary folder, by their own path, through a symlink, and imported by another.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const commandLineUrl = new URL('../../tools/command-line.js', import.meta.url).href;

// Writes report.js, which prints whether Node was started with it, and imports-report.js, which only imports it, into
// a temporary folder. Returns the folder's path and a path to the same folder through a symlink.
function makeScripts(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'command-line-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const scripts = path.join(dir, 'scripts');
  mkdirSync(scripts);
  writeFileSync(path.join(scripts, 'package.json'), '{ "type": "module" }\n');
  writeFileSync(path.join(scripts, 'report.js'), [
    `import { startedAsCommand } from '${commandLineUrl}';`,
    'console.log(startedAsCommand(import.meta.url));',
    '',
  ].join('\n'));
  writeFileSync(path.join(scripts, 'imports-report.js'), "import './report.js';\n");
  const link = path.join(dir, 'link');
  symlinkSync(scripts, link);
  return { scripts, link };
}

function run(scriptPath) {
  return execFileSync(process.execPath, [scriptPath], { encoding: 'utf8' });
}

test('a module Node was started with is started as a command', (t) => {
  const { scripts } = makeScripts(t);
  assert.equal(run(path.join(scripts, 'report.js')), 'true\n');
});

test("a module Node was started with through a symlink is started as a command, as in macOS's /tmp", (t) => {
  const { link } = makeScripts(t);
  assert.equal(run(path.join(link, 'report.js')), 'true\n');
});

test('a module that another one imports is not started as a command', (t) => {
  const { scripts } = makeScripts(t);
  assert.equal(run(path.join(scripts, 'imports-report.js')), 'false\n');
});
