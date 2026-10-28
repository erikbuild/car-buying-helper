// ABOUTME: End-to-end checks of the offline cache: the page opens with no network after one online visit.
// ABOUTME: Also checks that the next release replaces the cached one, with no files left from the release before it.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../serve.js';
import { test as pageTest, expect } from './fixtures.js';

const siteDir = fileURLToPath(new URL('../../site/', import.meta.url));

// Resolves once the offline cache's worker is active and controls the page.
async function waitForOfflineCache(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

// Copies site/ into dir as the named release, with a meta tag naming it in the page.
function copySiteAsRelease(release, dir) {
  cpSync(siteDir, dir, { recursive: true });
  const workerPath = path.join(dir, 'offline.js');
  writeFileSync(workerPath, readFileSync(workerPath, 'utf8')
    .replace("const RELEASE = 'development';", `const RELEASE = '${release}';`));
  const pagePath = path.join(dir, 'index.html');
  writeFileSync(pagePath, readFileSync(pagePath, 'utf8')
    .replace('</head>', `  <meta name="test-release" content="${release}">\n</head>`));
}

// Stops serving and closes the browser's open connections, so the port is free for the next release.
function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

const test = pageTest.extend({
  // Serves a copy of site/ as the named release, replacing the release served before it, and resolves to
  // the page's address. The first release takes a free port and later ones reuse it, so every release
  // has the same origin while browsers running this test at the same time each get their own port.
  serveRelease: async ({}, use) => {
    const dirs = [];
    let server = null;
    let port = 0;
    await use(async (release) => {
      if (server !== null) {
        await stopServer(server);
        server = null;
      }
      const dir = mkdtempSync(path.join(tmpdir(), `car-buying-helper-release-${release}-`));
      dirs.push(dir);
      copySiteAsRelease(release, dir);
      server = await startServer(dir, port);
      port = server.address().port;
      return `http://localhost:${port}/car-buying-helper/`;
    });
    if (server !== null) {
      await stopServer(server);
    }
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  },
});

test('opens offline after one online visit', async ({ page, context }) => {
  await page.goto('./');
  await waitForOfflineCache(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Car Buying Helper' })).toBeVisible();
});

test('the next release replaces the cached one', async ({ page, serveRelease }) => {
  const releaseUrl = await serveRelease('A');
  await page.goto(releaseUrl);
  await waitForOfflineCache(page);

  await serveRelease('B');
  await page.reload();
  // The worker answers from its cache before the network, so the load that finds release B still shows A.
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', 'A');
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['car-buying-helper-B']);
  await page.reload();

  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', 'B');
  const cachedPage = await page.evaluate(async () => (await caches.match('index.html')).text());
  expect(cachedPage).toContain('content="B"');
});
