// ABOUTME: End-to-end checks that the page opens in standards mode with its title.
// ABOUTME: Also checks that the web app manifest loads and its icons decode at the sizes it lists.
import { test, expect } from './fixtures.js';

test('page renders in standards mode', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Car Buying Helper');
  expect(await page.evaluate(() => document.compatMode)).toBe('CSS1Compat');
});

test('manifest loads', async ({ page }) => {
  await page.goto('./');
  const manifest = await page.evaluate(async () => {
    const manifestUrl = document.querySelector('link[rel="manifest"]').href;
    const { name, icons } = await (await fetch(manifestUrl)).json();
    const decodedSizes = await Promise.all(icons.map(async ({ src }) => {
      const image = new Image();
      image.src = new URL(src, manifestUrl).href;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }));
    return { name, listedSizes: icons.map(({ sizes }) => sizes), decodedSizes };
  });
  expect(manifest.name).toBe('Car Buying Helper');
  expect(manifest.decodedSizes).toEqual(manifest.listedSizes);
});
