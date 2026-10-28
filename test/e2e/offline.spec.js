// ABOUTME: End-to-end checks of the offline cache: the page opens with no network after one online visit.
// ABOUTME: Also checks that the next release replaces the cached one, with no files left from the release before it.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampRelease } from '../../tools/stamp-release.js';
import { startServer } from '../serve.js';
import { test as pageTest, expect } from './fixtures.js';

const siteDir = fileURLToPath(new URL('../../site/', import.meta.url));

// The Cache-Control header GitHub Pages sends with every file: the browser may answer a request for the file from its
// own HTTP cache, without asking the server, for 10 minutes.
const GITHUB_PAGES_CACHE_CONTROL = 'max-age=600';

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
  writeFileSync(workerPath, stampRelease(readFileSync(workerPath, 'utf8'), release));
  const pagePath = path.join(dir, 'index.html');
  writeFileSync(pagePath, readFileSync(pagePath, 'utf8')
    .replace('</head>', `  <meta name="test-release" content="${release}">\n</head>`));
}

// Stops serving and closes the browser's open connections, so no request reaches the server through them
// and the port is free for the next release.
function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

const test = pageTest.extend({
  // The test's own server for the page: serve(dir, options) serves a folder, with startServer's options, in place
  // of the one served before it and resolves to the page's address, and stop() stops serving. The first folder
  // takes a free port and later ones reuse it, so every folder a test serves has the same origin while browsers
  // running these tests at the same time each get their own port.
  siteServer: async ({}, use) => {
    let server = null;
    let port = 0;
    const stop = async () => {
      if (server !== null) {
        await stopServer(server);
        server = null;
      }
    };
    const serve = async (dir, options) => {
      await stop();
      server = await startServer(dir, port, options);
      port = server.address().port;
      return `http://localhost:${port}/car-buying-helper/`;
    };
    await use({ serve, stop });
    await stop();
  },
  // Serves a copy of site/ as the named release, replacing the release served before it, and resolves to
  // the page's address. Each release comes with GitHub Pages' Cache-Control header, so the browser's HTTP cache
  // still holds the files of the release before while the next one downloads, as on a phone.
  serveRelease: async ({ siteServer }, use) => {
    const dirs = [];
    await use(async (release) => {
      const dir = mkdtempSync(path.join(tmpdir(), `car-buying-helper-release-${release}-`));
      dirs.push(dir);
      copySiteAsRelease(release, dir);
      return siteServer.serve(dir, { cacheControl: GITHUB_PAGES_CACHE_CONTROL });
    });
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  },
});

test('opens offline after one online visit', async ({ page, context, siteServer }) => {
  const pageUrl = await siteServer.serve(siteDir);
  await page.goto(pageUrl);
  await waitForOfflineCache(page);

  // Firefox's offline switch doesn't cover the worker's own requests, so the server stops too.
  await siteServer.stop();
  await context.setOffline(true);
  const heading = page.getByRole('heading', { name: 'Car Buying Helper' });
  await page.reload();
  await expect(heading).toBeVisible();
  // The page still works the deal out: $36,500 with 6.35% tax and the $264 DMV estimate is $39,081.75 drive-away.
  await page.locator('#salePrice').fill('36500');
  await expect(page.locator('[data-strip="drive-away"]')).toHaveText('$39,082');

  // Firefox reloads a page it has seen from its own HTTP cache, so the page must also open at an address
  // the browser hasn't loaded.
  await page.goto(`${pageUrl}?source=home-screen`);
  await expect(heading).toBeVisible();
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

  // Release B's worker downloaded every file fresh (§9). Taken from the browser's HTTP cache, they'd be release A's.
  await expect(page.locator('meta[name="test-release"]')).toHaveAttribute('content', 'B');
  const cachedPage = await page.evaluate(async () => (await caches.match('index.html')).text());
  expect(cachedPage).toContain('content="B"');
});
