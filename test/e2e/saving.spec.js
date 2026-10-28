// ABOUTME: End-to-end checks that the deal is saved on the phone and comes back when the page opens again.
// ABOUTME: Also checks that Start over clears it, unreadable saved text starts fresh, and the page works with storage off.
import { FIELD_NAMES } from '../../site/lib/form.js';
import { EXAMPLE_1_STRIP, EXAMPLE_1_TEXT, EXAMPLE_1_VERDICTS, EXAMPLE_3_CONTRACT_TEXT } from '../fixtures.js';
import { test, expect, expectStrip, expectVerdicts, typeFields } from './fixtures.js';

// Where the page saves the deal (SPEC §9).
const SAVED_DEAL_KEY = 'car-buying-helper/deal';

// A test whose Firefox has storage turned off by Firefox's own setting, not by replacing localStorage in the page
// (SPEC §13). The setting is added to the project's launch options, which keep the rest, such as Firefox's home folder.
const storageOffTest = test.extend({
  launchOptions: [async ({ launchOptions }, use) => {
    await use({ ...launchOptions, firefoxUserPrefs: { 'dom.storage.enabled': false } });
  }, { scope: 'worker' }],
});

// The deal's saved text, or null when nothing is saved.
function savedDeal(page) {
  return page.evaluate((key) => localStorage.getItem(key), SAVED_DEAL_KEY);
}

// Checks that the page shows a fresh deal: every field blank, the switch off, no extras, and nothing worked out.
async function expectFreshDeal(page) {
  for (const name of FIELD_NAMES) {
    await expect(page.locator(`#${name}`), name).toHaveValue('');
  }
  // Found by id, because it's on the Loan tab, which can be hidden.
  await expect(page.locator('#takingCash')).not.toBeChecked();
  await expect(page.locator('[data-extras] > li')).toHaveCount(0);
  await expect(page.locator('[data-strip="drive-away"]')).toHaveText('—');
}

test('the fields, the switch, the quote and the extra come back when the page opens again', async ({ page }) => {
  await page.goto('./');
  const typed = { ...EXAMPLE_1_TEXT, ...EXAMPLE_3_CONTRACT_TEXT };
  await typeFields(page, typed);
  await page.locator('#takingCash').check();
  // +$500 moves the down payment away from the $5,000 that their quote stays tied to.
  await page.locator('[data-step-down="50000"]').click();
  await page.getByRole('tab', { name: 'Extras' }).click();
  await page.locator('[data-add-extra="warranty"]').click();
  const warranty = page.locator('[data-extras] > li[data-extra-type="warranty"]');
  const warrantyControl = (part) => warranty.locator(`[data-extra-field="${part}"]`);
  await warrantyControl('name').fill('Platinum warranty');
  await warrantyControl('priceText').fill('2,995');
  await warrantyControl('inDeal').check();
  await warrantyControl('taxed').uncheck();
  // Example 1 with Example 3's contract, the cash taken, $5,500 down, and the $2,995 warranty in the deal untaxed.
  const strip = {
    driveAway: '$41,820',
    shouldBe: 'should be $700.48',
    theirs: 'theirs $699.00 at $5,000 down',
    problems: '3 problems',
  };
  await expectStrip(page, strip);

  await page.reload();
  const fields = { ...typed, downPayment: '5,500' };
  for (const name of FIELD_NAMES) {
    await expect(page.locator(`#${name}`), name).toHaveValue(fields[name] ?? '');
  }
  await expect(page.locator('#takingCash')).toBeChecked();
  await expect(page.locator('[data-extras] > li')).toHaveCount(1);
  await expect(warrantyControl('name')).toHaveValue('Platinum warranty');
  await expect(warrantyControl('priceText')).toHaveValue('2,995');
  await expect(warrantyControl('inDeal')).toBeChecked();
  await expect(warrantyControl('taxed')).not.toBeChecked();
  await expectStrip(page, strip);

  // An extra added now gets an item of its own beside the warranty.
  await page.getByRole('tab', { name: 'Extras' }).click();
  await page.locator('[data-add-extra="gap"]').click();
  await expect(page.locator('[data-extras] > li')).toHaveCount(2);
  await expect(warrantyControl('name')).toHaveValue('Platinum warranty');
});

test("a sale price saved as text that isn't a number shows its error again, and counts as blank", async ({ page }) => {
  await page.goto('./');
  await typeFields(page, { ...EXAMPLE_1_TEXT, salePrice: 'abc' });

  await page.reload();
  await expect(page.locator('#salePrice')).toHaveValue('abc');
  const salePriceError = page.locator('[data-error-for="salePrice"]');
  await expect(salePriceError).toHaveText('Enter a number, like 36,500.');
  await expect(salePriceError).toBeVisible();
  await expect(page.locator('[data-strip="drive-away"]')).toHaveText('—');
});

test("saved text that doesn't read back as a deal is ignored, and the page starts fresh", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{bad'), SAVED_DEAL_KEY);
  await page.goto('./');
  await expectFreshDeal(page);

  // The page still works the deal out.
  await typeFields(page, EXAMPLE_1_TEXT);
  await expectStrip(page, EXAMPLE_1_STRIP);
});

storageOffTest('with storage turned off, the page still works the deal out', async ({ page, browserName }) => {
  test.skip(browserName !== 'firefox', 'Storage is turned off with a Firefox setting');
  await page.goto('./');
  // Storage really is off: reading it throws.
  const storageReadable = await page.evaluate(() => {
    try {
      localStorage.getItem('any key');
      return true;
    } catch {
      return false;
    }
  });
  expect(storageReadable).toBe(false);

  await typeFields(page, EXAMPLE_1_TEXT);
  await expectStrip(page, EXAMPLE_1_STRIP);
  await expectVerdicts(page, EXAMPLE_1_VERDICTS);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expectFreshDeal(page);
});

test('Start over clears the saved deal too, so the page opens empty', async ({ page }) => {
  await page.goto('./');
  await typeFields(page, EXAMPLE_1_TEXT);
  await page.locator('#takingCash').check();
  await page.getByRole('tab', { name: 'Extras' }).click();
  await page.locator('[data-add-extra="warranty"]').click();
  expect(await savedDeal(page)).not.toBeNull();

  await page.getByRole('tab', { name: 'Verdict' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  expect(await savedDeal(page)).toBeNull();
  await page.reload();
  await expectFreshDeal(page);
});
