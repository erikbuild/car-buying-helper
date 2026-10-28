// ABOUTME: End-to-end checks of the page layout: each field's label, keypad and place, text size, tap targets and colors.
// ABOUTME: Also checks the elements the app fills in, the sticky strip, phone and desktop widths, and the outside links.
import { connecticut } from '../../site/rules/connecticut.js';
import { test, expect, tapTargetsUnder44px } from './fixtures.js';

// Each field's id, its visible label, its keypad (an inputmode, or the date picker), and where it sits on the page.
const FIELDS = [
  { name: 'stickerTotal', label: 'Window sticker total', inputmode: 'decimal', place: '#panel-price' },
  { name: 'targetPrice', label: 'Your target price', inputmode: 'decimal', place: '#panel-price' },
  { name: 'salePrice', label: 'Their sale price', inputmode: 'decimal', place: '#panel-price' },
  { name: 'rebates', label: 'Rebates applied', inputmode: 'decimal', place: '#panel-price' },
  { name: 'docFee', label: 'Doc fee', inputmode: 'decimal', place: '#panel-price' },
  { name: 'titleRegistration', label: 'Title + registration', inputmode: 'decimal', place: '#panel-price' },
  { name: 'theirTax', label: 'Their tax', inputmode: 'decimal', place: '#panel-price' },
  { name: 'theirDriveAway', label: 'Their drive-away total', inputmode: 'decimal', place: '#panel-price' },
  { name: 'downPayment', label: 'Down payment', inputmode: 'decimal', place: '#panel-loan' },
  { name: 'theirApr', label: 'Their rate (APR)', inputmode: 'decimal', place: '#panel-loan' },
  { name: 'months', label: 'Months', inputmode: 'numeric', place: '#panel-loan' },
  { name: 'theirPayment', label: 'Their monthly payment', inputmode: 'decimal', place: '#panel-loan' },
  { name: 'specialApr', label: "Automaker's special rate", inputmode: 'decimal', place: '#panel-loan' },
  { name: 'specialCoversMonths', label: 'Covers loans up to', inputmode: 'numeric', place: '#panel-loan' },
  { name: 'cashInstead', label: 'Cash instead of the special rate', inputmode: 'decimal', place: '#panel-loan' },
  { name: 'outsideApr', label: 'Your outside rate', inputmode: 'decimal', place: '#panel-loan' },
  { name: 'contractAmountFinanced', label: 'Amount financed', inputmode: 'decimal', place: '#contract' },
  { name: 'contractFinanceCharge', label: 'Finance charge', inputmode: 'decimal', place: '#contract' },
  { name: 'contractTotalOfPayments', label: 'Total of payments', inputmode: 'decimal', place: '#contract' },
  { name: 'contractApr', label: 'APR', inputmode: 'decimal', place: '#contract' },
  { name: 'contractPayment', label: 'Monthly payment', inputmode: 'decimal', place: '#contract' },
  { name: 'contractPaymentCount', label: 'Number of payments', inputmode: 'numeric', place: '#contract' },
  { name: 'contractFinalPayment', label: 'Final payment', inputmode: 'decimal', place: '#contract' },
  { name: 'contractDate', label: 'Contract date', type: 'date', place: '#contract' },
  { name: 'firstPaymentDate', label: 'First payment date', type: 'date', place: '#contract' },
];

// The hints the page shows under their fields (§6.2, §6.3).
const HINTS = {
  rebates: 'Cash offered instead of the special rate goes on the Loan tab.',
  theirApr: 'Leave blank if they only quote a payment.',
  theirPayment: 'Ask for the exact payment, to the cent.',
  contractFinalPayment: 'Only if the last payment is different',
};

// Long text for each strip slot, with amounts near the §9 limits, in the forms the app writes (§6.1).
const LONG_STRIP_TEXT = {
  'drive-away': '$545,264',
  'should-be': 'should be $541,234.56',
  theirs: 'theirs $541,234.56 at $500,000 down',
  problems: '14 problems',
};

// Shows every tab panel and opens the contract section, so every element on the page can be measured.
async function showEverything(page) {
  await page.evaluate(() => {
    for (const panel of document.querySelectorAll('[role="tabpanel"]')) {
      panel.hidden = false;
    }
    document.getElementById('contract').open = true;
  });
}

test('the four tabs control their panels, and at load only Price shows, with the contract closed', async ({ page }) => {
  await page.goto('./');
  const tabNames = ['Price', 'Loan', 'Extras', 'Verdict'];
  await expect(page.getByRole('tab')).toHaveText(tabNames);
  for (const name of tabNames) {
    const panelId = `panel-${name.toLowerCase()}`;
    const tab = page.getByRole('tab', { name, exact: true });
    const panel = page.locator(`#${panelId}`);
    await expect(tab).toHaveAttribute('aria-controls', panelId);
    await expect(tab).toHaveAttribute('aria-selected', String(name === 'Price'));
    await expect(panel).toHaveAttribute('role', 'tabpanel');
    await expect(panel).toHaveAttribute('aria-labelledby', await tab.getAttribute('id'));
    if (name === 'Price') {
      await expect(panel).toBeVisible();
    } else {
      await expect(panel).toBeHidden();
    }
  }
  await expect(page.locator('#panel-loan details#contract')).not.toHaveAttribute('open');
  await expect(page.locator('#contract > summary')).toHaveText('At signing: the contract');
});

test('every field has its label, its keypad and its place', async ({ page }) => {
  await page.goto('./');
  await showEverything(page);
  const inputIds = await page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.id));
  expect(inputIds.sort()).toEqual([...FIELDS.map(({ name }) => name), 'takingCash'].sort());
  for (const { name, label, inputmode, type = 'text', place } of FIELDS) {
    const input = page.getByLabel(label, { exact: true });
    await expect(input, label).toHaveAttribute('id', name);
    await expect(input, label).toHaveAttribute('type', type);
    if (inputmode !== undefined) {
      await expect(input, label).toHaveAttribute('inputmode', inputmode);
    }
    await expect(page.locator(`${place} #${name}`), label).toHaveCount(1);
  }

  const takingCash = page.getByLabel('Taking the cash instead', { exact: true });
  await expect(takingCash).toHaveAttribute('id', 'takingCash');
  await expect(takingCash).toHaveAttribute('type', 'checkbox');
  await expect(takingCash).toHaveRole('switch');
  await expect(takingCash).not.toBeChecked();
  await expect(page.locator('#panel-loan #takingCash')).toHaveCount(1);

  const theirSheet = page.locator('#panel-price').getByRole('group', { name: 'From their sheet (optional)', exact: true });
  await expect(theirSheet.getByLabel('Their tax', { exact: true })).toHaveCount(1);
  await expect(theirSheet.getByLabel('Their drive-away total', { exact: true })).toHaveCount(1);
});

test('fields show their hints and placeholders, and each hint and error line describes its field', async ({ page }) => {
  await page.goto('./');
  await showEverything(page);
  await expect(page.locator('#downPayment')).toHaveAttribute('placeholder', '0');
  await expect(page.locator('#rebates')).toHaveAttribute('placeholder', '0');
  for (const [name, hint] of Object.entries(HINTS)) {
    await expect(page.locator(`[data-hint-for="${name}"]`)).toHaveText(hint);
    await expect(page.locator(`#${name}`)).toHaveAccessibleDescription(hint);
  }
  // The app writes the sale price hint from the state's rules at load, and the date pair's hint as dates are entered.
  await expect(page.locator('[data-hint-for="salePrice"]')).toHaveText(connecticut.hints.salePrice);
  await expect(page.locator('[data-hint-for="contractDates"]')).toBeEmpty();

  // Write text where the app writes it, then read each field's description.
  await page.evaluate(() => {
    document.querySelector('[data-hint-for="salePrice"]').textContent = 'Sale price hint.';
    document.querySelector('[data-hint-for="contractDates"]').textContent = 'Enter both dates.';
    for (const error of document.querySelectorAll('[data-error-for]')) {
      error.textContent = `Error in ${error.dataset.errorFor}.`;
    }
  });
  for (const { name } of FIELDS) {
    await expect(page.locator(`[data-error-for="${name}"]`)).toHaveCount(1);
    await expect(page.locator(`#${name}`)).toHaveAccessibleDescription(new RegExp(`(^| )Error in ${name}\\.$`));
  }
  await expect(page.locator('#salePrice')).toHaveAccessibleDescription('Sale price hint. Error in salePrice.');
  await expect(page.locator('#contractDate')).toHaveAccessibleDescription('Enter both dates. Error in contractDate.');
  await expect(page.locator('#firstPaymentDate'))
    .toHaveAccessibleDescription('Enter both dates. Error in firstPaymentDate.');
});

test("the contract dates' hint has the same space below it as the contract's last field", async ({ page }) => {
  await page.goto('./');
  const contract = page.locator('#contract');
  const spaceBelow = async (part) => {
    const [box, partBox] = [await contract.boundingBox(), await part.boundingBox()];
    return box.y + box.height - (partBox.y + partBox.height);
  };
  await page.getByRole('tab', { name: 'Loan' }).click();
  await contract.locator(':scope > summary').click();
  const belowLastField = await spaceBelow(contract.locator(':scope > .field').last());
  await page.locator('#contractDate').fill('2026-10-30');
  const hint = page.locator('[data-hint-for="contractDates"]');
  await expect(hint).toHaveText('Enter both dates.');
  expect(await spaceBelow(hint)).toBeCloseTo(belowLastField, 0);
});

test('the page has every element the app fills in or listens to', async ({ page }) => {
  await page.goto('./');
  await showEverything(page);

  await expect(page.locator('[data-strip="drive-away"]')).toHaveText('—');
  await expect(page.locator('[data-strip="should-be"]')).toHaveText('should be —');
  await expect(page.locator('[data-strip="theirs"]')).toBeEmpty();
  await expect(page.locator('button[data-strip="problems"]')).toHaveText('—');

  for (const line of ['discount', 'tax-line', 'dmv', 'drive-away', 'their-tax-check', 'their-drive-away-check']) {
    await expect(page.locator(`#panel-price [data-calc="${line}"]`), line).toHaveCount(1);
  }
  await expect(page.locator('#panel-loan [data-calc="amount-financed"]')).toHaveCount(1);
  await expect(page.locator('#panel-loan button[data-step-down="-50000"]')).toHaveText('−$500');
  await expect(page.locator('#panel-loan button[data-step-down="50000"]')).toHaveText('+$500');

  const addExtraButtons = page.locator('#panel-extras button[data-add-extra]');
  await expect(addExtraButtons).toHaveText([
    'Extended warranty', 'GAP', 'Prepaid maintenance', 'Tire & wheel', 'Paint / fabric', 'VIN etch', 'Other',
  ]);
  expect(await addExtraButtons.evaluateAll((buttons) => buttons.map((button) => button.dataset.addExtra)))
    .toEqual(['warranty', 'gap', 'maintenance', 'tireWheel', 'paintFabric', 'vinEtch', 'other']);
  await expect(page.locator('#panel-extras [data-extras]')).toHaveCount(1);

  for (const container of ['data-key-numbers', 'data-cards', 'data-checklist']) {
    await expect(page.locator(`#panel-verdict [${container}]`), container).toHaveCount(1);
  }
  await expect(page.locator('#panel-verdict button[data-start-over]')).toHaveText('Start over');
});

test('input text is at least 16px, so iOS does not zoom in', async ({ page }) => {
  await page.goto('./');
  await showEverything(page);
  await expect(page.locator('input')).toHaveCount(FIELDS.length + 1);
  const fontSizes = await page.locator('input').evaluateAll((inputs) =>
    inputs.map((input) => [input.id, parseFloat(getComputedStyle(input).fontSize)]));
  expect(fontSizes.filter(([, size]) => size < 16)).toEqual([]);
});

test('every button, input, summary, tab and link is at least 44px tall and 44px wide', async ({ page }) => {
  await page.goto('./');
  await showEverything(page);
  await expect(page.locator('input')).toHaveCount(FIELDS.length + 1);
  await expect(page.getByRole('tab')).toHaveCount(4);
  // With no sale price yet, the strip's problem count is "—", its narrowest text (§6.1).
  await expect(page.locator('[data-strip="problems"]')).toHaveText('—');
  expect(await tapTargetsUnder44px(page.locator('button, input, summary, [role="tab"], a'))).toEqual([]);
});

test('light and dark follow the system setting', async ({ page }) => {
  await page.goto('./');
  const bodyColors = () => page.evaluate(() => {
    const { backgroundColor, color } = getComputedStyle(document.body);
    return { backgroundColor, color };
  });
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await bodyColors();
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await bodyColors();
  expect(dark.backgroundColor).not.toBe(light.backgroundColor);
  expect(dark.color).not.toBe(light.color);
});

test('each card severity has its own color on the card and its word, in light and in dark', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    document.getElementById('panel-verdict').hidden = false;
    document.querySelector('[data-cards]').innerHTML = ['red', 'amber', 'green', 'neutral']
      .map((severity) => `<article data-card="sample" data-severity="${severity}">`
        + '<span class="severity">Word</span><h3>Headline</h3><p>Sentence.</p></article>')
      .join('');
  });
  for (const colorScheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme });
    const colors = await page.locator('[data-cards] [data-severity]').evaluateAll((cards) => cards.map((card) => ({
      edge: getComputedStyle(card).borderLeftColor,
      word: getComputedStyle(card.querySelector('.severity')).color,
    })));
    const edges = colors.map(({ edge }) => edge);
    expect(new Set(edges).size, colorScheme).toBe(4);
    expect(colors.map(({ word }) => word), colorScheme).toEqual(edges);
  }
});

test('the strip stays at the top of the screen while the page scrolls', async ({ page }) => {
  await page.goto('./');
  await showEverything(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByRole('heading', { name: 'Car Buying Helper' })).not.toBeInViewport();
  const strip = page.getByRole('region', { name: 'Summary', exact: true });
  expect(Math.abs((await strip.boundingBox()).y)).toBeLessThan(1);
  for (const slot of ['drive-away', 'should-be', 'problems']) {
    await expect(strip.locator(`[data-strip="${slot}"]`)).toBeInViewport();
  }
});

for (const viewport of [{ width: 320, height: 640 }, { width: 1280, height: 800 }]) {
  test(`at ${viewport.width}x${viewport.height} nothing scrolls sideways and the strip text fits`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await showEverything(page);
    await page.evaluate((texts) => {
      for (const [slot, text] of Object.entries(texts)) {
        document.querySelector(`[data-strip="${slot}"]`).textContent = text;
      }
    }, LONG_STRIP_TEXT);
    const { scrollWidth, innerWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    // Chromium's mobile emulation widens innerWidth to fit content that overflows, so the root's clientWidth, which
    // stays the viewport's width, is the measure that catches overflow in every browser.
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    const clipped = await page.locator('[data-strip]').evaluateAll((slots) => slots
      .filter((slot) => slot.scrollWidth > slot.clientWidth)
      .map((slot) => slot.dataset.strip));
    expect(clipped).toEqual([]);
  });
}

test('at desktop width the page is one centered column, at most 34rem wide', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  const column = await page.evaluate(() => {
    const { left, right, width } = document.body.getBoundingClientRect();
    return { width, leftGap: left, rightGap: document.documentElement.clientWidth - right };
  });
  expect(column.width).toBeLessThanOrEqual(34 * 16);
  expect(Math.abs(column.leftGap - column.rightGap)).toBeLessThanOrEqual(1);
});

test('the two outside links have their addresses and texts', async ({ page }) => {
  await page.goto('./');
  await showEverything(page);
  const beforeYouGo = page.getByRole('link', { name: 'Before you go: how to look up a fair price', exact: true });
  await expect(beforeYouGo).toHaveAttribute('href', 'https://github.com/erikbuild/car-buying-helper#before-you-go');
  await expect(page.locator('#panel-price p', { has: beforeYouGo }))
    .toHaveText('Before you go: how to look up a fair price (opens GitHub; needs a signal)');
  const mazdaOffers = page.locator('#panel-loan')
    .getByRole('link', { name: 'Mazda offers (external link to www.MazdaUSA.com)', exact: true });
  await expect(mazdaOffers)
    .toHaveAttribute('href', 'https://www.mazdausa.com/shopping-tools/special-offers-and-incentives');
  await expect(page.getByRole('link')).toHaveCount(2);
});
