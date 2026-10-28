// ABOUTME: Writes the release name into the offline cache's script, so phones pick up each deploy as a new release.
// ABOUTME: Run `node tools/stamp-release.js <release>` to edit site/offline.js in place; the deploy passes the commit ID.
import { readFileSync, writeFileSync } from 'node:fs';
import { startedAsCommand } from './command-line.js';

const RELEASE_PLACEHOLDER = "const RELEASE = 'development';";
const OFFLINE_SCRIPT = new URL('../site/offline.js', import.meta.url);

// Returns text with the release placeholder line naming release instead. Throws unless the placeholder
// appears exactly once, so the deploy stops instead of publishing a worker whose release name is unchanged or ambiguous.
export function stampRelease(text, release) {
  const parts = text.split(RELEASE_PLACEHOLDER);
  if (parts.length !== 2) {
    throw new Error(`Expected "${RELEASE_PLACEHOLDER}" exactly once, found ${parts.length - 1}`);
  }
  return parts.join(`const RELEASE = '${release}';`);
}

// Runs as a command only when Node was started with this file.
if (startedAsCommand(import.meta.url)) {
  const [release] = process.argv.slice(2);
  if (!release) {
    console.error('Usage: node tools/stamp-release.js <release>');
    process.exitCode = 1;
  } else {
    writeFileSync(OFFLINE_SCRIPT, stampRelease(readFileSync(OFFLINE_SCRIPT, 'utf8'), release));
  }
}
