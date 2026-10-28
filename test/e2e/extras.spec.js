// ABOUTME: End-to-end checks of the Extras tab on Example 1's deal: adding, pricing, switching and removing extras.
// ABOUTME: Checks each item's line, tip and hints, and that only the extras in the deal with a price count toward the totals.
import { connecticut } from '../../site/rules/connecticut.js';
import { EXAMPLE_1_STRIP, EXAMPLE_1_TEXT, EXAMPLE_1_VERDICTS } from '../fixtures.js';
import { test, expect, expectStrip, expectVerdicts, tapTargetsUnder44px, typeFields } from './fixtures.js';

// The warranty's line at $2,995 on Example 1's deal, out of the deal and in it (§6.4, §7.11).
const WARRANTY_WOULD_ADD = 'Would add $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)';
const WARRANTY_ADDS = 'Adds $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)';

// GAP's line at $895, untaxed, on Example 1's deal (§7.11).
const GAP_WOULD_ADD = 'Would add $17.26/mo, $1,035.60 over 60 months ($895.00 with tax)';

// The line of an extra whose price is blank or isn't a number, out of the deal and in it. It counts toward nothing
// until its price is entered (§6.4).
const UNPRICED_WOULD_ADD = 'Would add —';
const UNPRICED_ADDS = 'Adds —';

// The hint under every extra's price (§6.4).
const PRICE_HINT = 'The full price, not per month. If they quote $/mo, ask for the price.';

// Opens the page, types Example 1 in (§7.11) and selects the Extras tab.
async function openExtrasOnExample1(page) {
  await page.goto('./');
  await typeFields(page, EXAMPLE_1_TEXT);
  await page.getByRole('tab', { name: 'Extras' }).click();
}

// Taps the add button for this type of extra, and returns the item it adds. A test adds at most one of each type.
async function addExtra(page, type) {
  await page.locator(`[data-add-extra="${type}"]`).click();
  return page.locator(`[data-extras] > li[data-extra-type="${type}"]`);
}

// An item's control for one of its parts: name, priceText, inDeal or taxed.
function extraField(item, part) {
  return item.locator(`[data-extra-field="${part}"]`);
}

test("a warranty's line says what it would add, and its tip is Mazda's", async ({ page }) => {
  await openExtrasOnExample1(page);
  const warranty = await addExtra(page, 'warranty');
  await expect(warranty).toHaveCount(1);
  // Typed a key at a time, as on a phone. The price keeps its text and its focus while the line follows it.
  const price = extraField(warranty, 'priceText');
  await price.pressSequentially('2995');
  await expect(price).toHaveValue('2995');
  await expect(price).toBeFocused();
  const line = warranty.locator('[data-extra-line]');
  await expect(line).toHaveText(WARRANTY_WOULD_ADD);
  await expect(warranty.locator('.tip')).toHaveText(connecticut.extraTypes.warranty.tip);
  // An extra that isn't in the deal counts toward nothing (§6.4).
  await expectStrip(page, EXAMPLE_1_STRIP);

  // With months blank there's no loan to spread it over, so the line is just what it costs (§6.4).
  await typeFields(page, { months: '' });
  await expect(line).toHaveText('Would add $3,185.18 with tax');
});

test('putting the warranty in the deal adds it to the totals and the Extras card', async ({ page }) => {
  await openExtrasOnExample1(page);
  const warranty = await addExtra(page, 'warranty');
  await extraField(warranty, 'priceText').fill('2995');
  await extraField(warranty, 'inDeal').check();
  await expect(warranty.locator('[data-extra-line]')).toHaveText(WARRANTY_ADDS);
  await expect(page.locator('[data-strip="drive-away"]')).toHaveText('$43,010');
  // The amount financed becomes Example 3's (§7.11).
  await expect(page.locator('[data-calc="amount-financed"]')).toHaveText('$38,010.32');

  await page.getByRole('tab', { name: 'Verdict' }).click();
  await expect(page.locator('[data-card="extras"]')).toHaveAttribute('data-severity', 'amber');
  await expect(page.locator('[data-card="extras"] > h3')).toHaveText('Extras in the deal: $3,185.');
  await expect(page.locator('[data-card="extras"] > p')).toHaveText('+$61.43/mo, $3,686 over 60 months. All optional.');
});

test("a GAP item starts untaxed with the hint on Taxed, and VIN etch's tip asks for consent", async ({ page }) => {
  await openExtrasOnExample1(page);
  const gap = await addExtra(page, 'gap');
  const taxed = extraField(gap, 'taxed');
  await expect(taxed).not.toBeChecked();
  const { taxedHint } = connecticut.extraTypes.gap;
  await expect(gap.getByText(taxedHint, { exact: true })).toBeVisible();
  await expect(taxed).toHaveAccessibleDescription(taxedHint);
  await extraField(gap, 'priceText').fill('895');
  const line = gap.locator('[data-extra-line]');
  await expect(line).toHaveText(GAP_WOULD_ADD);
  // A taxed GAP is taxed with the car, so its $895 adds $56.83 of tax (§7.1).
  await taxed.check();
  await expect(line).toHaveText('Would add $18.36/mo, $1,101.60 over 60 months ($951.83 with tax)');

  const vinEtch = await addExtra(page, 'vinEtch');
  await expect(vinEtch.locator('.tip')).toHaveText(connecticut.extraTypes.vinEtch.tip);
});

test('Remove takes out only its own extra, and the deal goes back to Example 1', async ({ page }) => {
  await openExtrasOnExample1(page);
  const warranty = await addExtra(page, 'warranty');
  await extraField(warranty, 'priceText').fill('2995');
  await extraField(warranty, 'inDeal').check();
  const gap = await addExtra(page, 'gap');
  await extraField(gap, 'priceText').fill('895');
  await expect(page.locator('[data-strip="drive-away"]')).toHaveText('$43,010');

  await warranty.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(warranty).toHaveCount(0);
  // The GAP item stays as it was typed.
  await expect(page.locator('[data-extras] > li')).toHaveCount(1);
  await expect(extraField(gap, 'priceText')).toHaveValue('895');
  await expect(gap.locator('[data-extra-line]')).toHaveText(GAP_WOULD_ADD);
  await expectStrip(page, EXAMPLE_1_STRIP);
  // Example 1's Verdict, which ends with "No extras in the deal."
  await expectVerdicts(page, EXAMPLE_1_VERDICTS);
});

test("each add button adds its type's item, named after the type, out of the deal, with the type's Taxed and tip",
  async ({ page }) => {
    await openExtrasOnExample1(page);
    for (const [type, { label, taxedByDefault, tip, taxedHint }] of Object.entries(connecticut.extraTypes)) {
      const item = await addExtra(page, type);
      await expect(extraField(item, 'name'), type).toHaveValue(label);
      await expect(extraField(item, 'priceText'), type).toHaveValue('');
      await expect(extraField(item, 'inDeal'), type).not.toBeChecked();
      await expect(extraField(item, 'taxed'), type).toBeChecked({ checked: taxedByDefault });
      await expect(extraField(item, 'taxed'), type).toHaveAccessibleDescription(taxedHint ?? '');
      await expect(item.locator('.tip'), type).toHaveText(tip === null ? [] : [tip]);
      await expect(item.locator('[data-extra-line]'), type).toHaveText(UNPRICED_WOULD_ADD);
    }
    // In the order they were added.
    const types = await page.locator('[data-extras] > li')
      .evaluateAll((items) => items.map((item) => item.dataset.extraType));
    expect(types).toEqual(Object.keys(connecticut.extraTypes));
    await expectStrip(page, EXAMPLE_1_STRIP);
  });

test("every item's price has the hint that it's the full price, under it and describing it", async ({ page }) => {
  await openExtrasOnExample1(page);
  for (const type of Object.keys(connecticut.extraTypes)) {
    const item = await addExtra(page, type);
    const hint = item.locator('[data-extra-field="priceText"] + .hint');
    await expect(hint, type).toHaveText(PRICE_HINT);
    await expect(hint, type).toBeVisible();
    await expect(extraField(item, 'priceText'), type).toHaveAccessibleDescription(PRICE_HINT);
  }
});

test('each add button shows its item below the strip, with the cursor in its price', async ({ page }) => {
  await openExtrasOnExample1(page);
  const strip = page.getByRole('region', { name: 'Summary', exact: true });
  // Each item goes at the end of the list, which is below the bottom of the screen from the second one on.
  for (const type of ['warranty', 'gap', 'maintenance']) {
    const item = await addExtra(page, type);
    const price = extraField(item, 'priceText');
    await expect(price, type).toBeFocused();
    const stripBox = await strip.boundingBox();
    const itemBox = await item.boundingBox();
    expect(itemBox.y, type).toBeGreaterThanOrEqual(stripBox.y + stripBox.height);
    // Scrolled into view, the item's bottom lines up with the screen's, give or take the scroll's rounding to a pixel.
    expect(itemBox.y + itemBox.height, type).toBeLessThanOrEqual(page.viewportSize().height + 1);
    // What's typed next goes into the new item's price.
    await page.keyboard.type('895');
    await expect(price, type).toHaveValue('895');
  }
});

test("a price that isn't a number shows its error and counts as blank", async ({ page }) => {
  await openExtrasOnExample1(page);
  const warranty = await addExtra(page, 'warranty');
  const price = extraField(warranty, 'priceText');
  const error = warranty.locator('[data-extra-error]');
  const line = warranty.locator('[data-extra-line]');
  await price.fill('2995');
  await expect(line).toHaveText(WARRANTY_WOULD_ADD);
  await expect(error).toBeHidden();

  await price.fill('abc');
  await expect(error).toHaveText('Enter a number, like 36,500.');
  await expect(error).toBeVisible();
  // The price's hint describes it first, then its error.
  await expect(price).toHaveAccessibleDescription(`${PRICE_HINT} Enter a number, like 36,500.`);
  await expect(line).toHaveText(UNPRICED_WOULD_ADD);
  await expectStrip(page, EXAMPLE_1_STRIP);

  await price.fill('2,995');
  await expect(error).toBeEmpty();
  await expect(error).toBeHidden();
  await expect(line).toHaveText(WARRANTY_WOULD_ADD);
});

test('an extra in the deal counts only while its price is entered', async ({ page }) => {
  await openExtrasOnExample1(page);
  const warranty = await addExtra(page, 'warranty');
  const price = extraField(warranty, 'priceText');
  const line = warranty.locator('[data-extra-line]');
  await extraField(warranty, 'inDeal').check();
  await expect(line).toHaveText(UNPRICED_ADDS);
  await expectStrip(page, EXAMPLE_1_STRIP);

  await price.fill('2995');
  await expect(line).toHaveText(WARRANTY_ADDS);
  await expect(page.locator('[data-strip="drive-away"]')).toHaveText('$43,010');

  // Cleared, the price counts as blank, so the deal is Example 1's again (§6.4).
  await price.fill('');
  await expect(line).toHaveText(UNPRICED_ADDS);
  await expectStrip(page, EXAMPLE_1_STRIP);
  await expect(page.locator('[data-calc="amount-financed"]')).toHaveText('$34,825.14');
  // Example 1's Verdict, which ends with "No extras in the deal."
  await expectVerdicts(page, EXAMPLE_1_VERDICTS);
});

test("an extra's controls have their labels and keypad, 16px text and 44px tap targets", async ({ page }) => {
  await openExtrasOnExample1(page);
  const warranty = await addExtra(page, 'warranty');
  const controls = [
    { part: 'name', role: 'textbox', name: 'Name' },
    { part: 'priceText', role: 'textbox', name: 'Price' },
    { part: 'inDeal', role: 'switch', name: 'In the deal' },
    { part: 'taxed', role: 'switch', name: 'Taxed' },
  ];
  for (const { part, role, name } of controls) {
    await expect(warranty.getByRole(role, { name, exact: true }), name).toHaveAttribute('data-extra-field', part);
  }
  await expect(extraField(warranty, 'priceText')).toHaveAttribute('inputmode', 'decimal');
  await expect(warranty.getByRole('button', { name: 'Remove', exact: true })).toHaveAttribute('data-remove-extra');

  const tapTargets = warranty.locator('input, button');
  await expect(tapTargets).toHaveCount(controls.length + 1);
  expect(await tapTargetsUnder44px(tapTargets)).toEqual([]);
  const fontSizes = await warranty.locator('input').evaluateAll((inputs) =>
    inputs.map((input) => [input.dataset.extraField, parseFloat(getComputedStyle(input).fontSize)]));
  expect(fontSizes.filter(([, size]) => size < 16)).toEqual([]);
});

test('Start over removes every extra, and one added afterwards starts fresh', async ({ page }) => {
  await openExtrasOnExample1(page);
  const warranty = await addExtra(page, 'warranty');
  await extraField(warranty, 'priceText').fill('2995');
  await extraField(warranty, 'inDeal').check();
  await addExtra(page, 'gap');
  await page.getByRole('tab', { name: 'Verdict' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.locator('[data-extras] > li')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Extras' }).click();
  const fresh = await addExtra(page, 'warranty');
  await expect(fresh).toHaveCount(1);
  await expect(extraField(fresh, 'priceText')).toHaveValue('');
  await expect(extraField(fresh, 'inDeal')).not.toBeChecked();
  // Its price is blank, so it counts toward nothing yet.
  await expect(fresh.locator('[data-extra-line]')).toHaveText(UNPRICED_WOULD_ADD);
});
