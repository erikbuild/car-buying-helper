// ABOUTME: Guards the rule that every code file starts with two ABOUTME comment lines.
// ABOUTME: Walks the repo, skipping installed packages, test output and the JSON files that can't hold comments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// How each checked file type's two header lines begin. The exempt files, manifest.webmanifest,
// package.json and package-lock.json, are JSON, and JSON files aren't checked.
const HEADER_STARTS = {
  '.js': '// ABOUTME: ',
  '.mjs': '// ABOUTME: ',
  '.css': '/* ABOUTME: ',
  '.html': '<!-- ABOUTME: ',
  '.yml': '# ABOUTME: ',
  '.yaml': '# ABOUTME: ',
};
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'test-results', 'playwright-report', '.superpowers']);

// Lists the code files under rootDir whose first two lines aren't ABOUTME comments,
// as sorted paths relative to rootDir.
function missingHeaders(rootDir) {
  const missing = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          visit(entryPath);
        }
        continue;
      }
      const headerStart = HEADER_STARTS[path.extname(entry.name)];
      if (headerStart === undefined) {
        continue;
      }
      const [first, second = ''] = readFileSync(entryPath, 'utf8').split(/\r?\n/);
      if (!first.startsWith(headerStart) || !second.startsWith(headerStart)) {
        missing.push(path.relative(rootDir, entryPath));
      }
    }
  };
  visit(rootDir);
  return missing.sort();
}

function makeTempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'aboutme-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('missingHeaders flags a file without the header', (t) => {
  const dir = makeTempDir(t);
  writeFileSync(path.join(dir, 'good.js'), '// ABOUTME: Adds one.\n// ABOUTME: Used by the counter.\n');
  writeFileSync(path.join(dir, 'bad.js'), 'export const one = 1;\n');
  assert.deepEqual(missingHeaders(dir), ['bad.js']);
});

test('missingHeaders needs both lines, in the comment style of the file type', (t) => {
  const dir = makeTempDir(t);
  writeFileSync(path.join(dir, 'one-line.js'), '// ABOUTME: Adds one.\nexport const one = 1;\n');
  writeFileSync(path.join(dir, 'styles.css'), '/* ABOUTME: Page styles. */\n/* ABOUTME: Light and dark. */\n');
  writeFileSync(path.join(dir, 'wrong-style.css'), '// ABOUTME: Page styles.\n// ABOUTME: Light and dark.\n');
  writeFileSync(path.join(dir, 'page.html'), '<!-- ABOUTME: The page. -->\n<!-- ABOUTME: Its markup. -->\n<!doctype html>\n');
  writeFileSync(path.join(dir, 'deploy.yml'), '# ABOUTME: Deploys the site.\n# ABOUTME: Runs on push.\n');
  mkdirSync(path.join(dir, 'node_modules'));
  writeFileSync(path.join(dir, 'node_modules', 'package.js'), 'export const one = 1;\n');
  assert.deepEqual(missingHeaders(dir), ['one-line.js', 'wrong-style.css']);
});

test('every code file in the repo starts with two ABOUTME lines', () => {
  assert.deepEqual(missingHeaders(repoRoot), []);
});
