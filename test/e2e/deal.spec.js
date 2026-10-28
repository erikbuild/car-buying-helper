// ABOUTME: End-to-end checks that the page works the deal out as it's typed: the strip, the tabs' lines and the cards.
// ABOUTME: Enters SPEC.md §7.11's examples on the page, and checks the buttons, bad input, Start over and requests.
import { FIELD_NAMES } from '../../site/lib/form.js';
import { connecticut } from '../../site/rules/connecticut.js';
import { reference } from '../../site/rules/reference.js';
import {
  EXAMPLE_1_PAYMENT_SENTENCE,
  EXAMPLE_1_STRIP,
  EXAMPLE_1_TEXT,
  EXAMPLE_1_VERDICTS,
  EXAMPLE_3_CONTRACT_TEXT,
} from '../fixtures.js';
import { test, expect, expectStrip, expectVerdicts, typeFields } from './fixtures.js';

// The summary strip until their sale price is entered (§6.1). The theirs slot is empty.
const EMPTY_STRIP = { driveAway: '—', shouldBe: 'should be —', theirs: '', problems: '—' };

// The part of an iPhone 15's screen that the home-screen app shows above the home indicator (§2, §6.5).
const IPHONE_SCREEN = { width: 393, height: 760 };

test('with no sale price, the Verdict shows only the start note, the checklist and Start over', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('[data-hint-for="salePrice"]')).toHaveText(connecticut.hints.salePrice);
  await expectStrip(page, EMPTY_STRIP);

  await expectVerdicts(page, [['neutral', 'Enter their sale price on the Price tab to start.']]);
  await expect(page.locator('[data-card="start"] > .severity')).toHaveText('Note');
  await expect(page.locator('[data-key-numbers]')).toBeEmpty();
  await expect(page.locator('[data-checklist] > li')).toHaveText(connecticut.checklist);
  await expect(page.getByRole('button', { name: 'Start over', exact: true })).toBeVisible();
});

test('Example 1 typed with their payment before the down payment', async ({ page }) => {
  await page.goto('./');
  // Typing the down payment after their payment ties the quote to it, so the quote is current (§6.3).
  const { downPayment, ...beforeDownPayment } = EXAMPLE_1_TEXT;
  await typeFields(page, { ...beforeDownPayment, downPayment });
  await expectStrip(page, EXAMPLE_1_STRIP);

  await expectVerdicts(page, EXAMPLE_1_VERDICTS);
  await expect(page.locator('[data-cards] > article > .severity'))
    .toHaveText(['Problem', 'Check', 'Check', 'OK', 'OK', 'OK']);
  await expect(page.locator('[data-key-numbers] dt'))
    .toHaveText(['Their sale price', 'Drive-away total', 'Amount financed', 'Their rate', 'Months', 'Payment']);
  await expect(page.locator('[data-key-numbers] dd'))
    .toHaveText(['$36,500', '$39,825', '$34,825', '5.9%', '60', 'should be $671.65, theirs $699.00']);

  // A card: its data-card key, its headline, its sentence, a context line only when it has one, and its math, closed
  // until it's asked for.
  const payment = page.locator('[data-card="payment"]');
  await expect(page.locator('[data-card="payment"] > p')).toHaveText(EXAMPLE_1_PAYMENT_SENTENCE);
  await expect(page.locator('[data-card="payment"] > .context')).toHaveCount(0);
  await expect(page.locator('[data-card="outsideRate"] > .context')).toHaveText(reference.experian.text);
  const showTheMath = payment.locator('details > summary');
  await expect(showTheMath).toHaveText('Show the math');
  const acceptedRange = payment.locator('details li', { hasText: '$670.65 to $674.30' });
  await expect(acceptedRange).toBeHidden();
  await showTheMath.click();
  await expect(acceptedRange).toBeVisible();
});

test('the down payment buttons try out other down payments without moving the quote', async ({ page }) => {
  await page.goto('./');
  const downPayment = page.locator('#downPayment');
  const minus500 = page.locator('[data-step-down="-50000"]');
  const plus500 = page.locator('[data-step-down="50000"]');
  await page.getByRole('tab', { name: 'Loan' }).click();
  // −$500 stops at $0, and a blank down payment counts as $0 (§6.3, §9).
  await minus500.click();
  await expect(downPayment).toHaveValue('0');

  await typeFields(page, EXAMPLE_1_TEXT);
  const amountFinanced = page.locator('[data-calc="amount-financed"]');
  const driveAway = page.locator('[data-calc="drive-away"]');
  await expect(amountFinanced).toHaveText('$34,825.14');
  await plus500.click();
  await expect(downPayment).toHaveValue('5,500');
  await expect(amountFinanced).toHaveText('$34,325.14');
  // The down payment comes off the amount financed. The drive-away total moves only where the down payment turns the
  // deal into a cash deal (§7.2), which $5,500 down doesn't.
  await expect(driveAway).toHaveText('$39,825.14');
  await expectStrip(page, {
    driveAway: '$39,825',
    shouldBe: 'should be $662.01',
    theirs: 'theirs $699.00 at $5,000 down',
    problems: '2 problems',
  });

  await minus500.click();
  await expect(downPayment).toHaveValue('5,000');
  await expect(amountFinanced).toHaveText('$34,825.14');
  await expectStrip(page, EXAMPLE_1_STRIP);
});

test('typing their payment or a down payment ties the quote to the down payment again', async ({ page }) => {
  await page.goto('./');
  await typeFields(page, EXAMPLE_1_TEXT);
  const plus500 = page.locator('[data-step-down="50000"]');
  const theirs = page.locator('[data-strip="theirs"]');
  await plus500.click();
  await expect(theirs).toHaveText('theirs $699.00 at $5,000 down');
  await typeFields(page, { theirPayment: '699' });
  await expect(theirs).toHaveText('theirs $699.00');
  await page.locator('[data-step-down="-50000"]').click();
  await expect(theirs).toHaveText('theirs $699.00 at $5,500 down');
  await typeFields(page, { downPayment: '5,000' });
  await expect(theirs).toHaveText('theirs $699.00');

  // A field's change event comes when the field loses focus after its text changed, which can be after a button press
  // that left it focused. That doesn't tie the quote again.
  await typeFields(page, { theirPayment: '700' });
  await plus500.dispatchEvent('click');
  await page.locator('#theirPayment').blur();
  await expect(theirs).toHaveText('theirs $700.00 at $5,000 down');
});

test("Example 3's contract shows the red amount-financed card", async ({ page }) => {
  await page.goto('./');
  const { firstPaymentDate, ...contractBeforeFirstPayment } = EXAMPLE_3_CONTRACT_TEXT;
  await typeFields(page, { ...EXAMPLE_1_TEXT, ...contractBeforeFirstPayment });
  // With only one date entered, the dates ask for both (§6.3).
  const datesHint = page.locator('[data-hint-for="contractDates"]');
  await expect(datesHint).toHaveText('Enter both dates.');
  await typeFields(page, { firstPaymentDate });
  await expect(datesHint).toBeEmpty();
  await expect(datesHint).toBeHidden();

  await expect(page.locator('[data-strip="problems"]')).toHaveText('4 problems');
  await page.getByRole('tab', { name: 'Verdict' }).click();
  const amountFinanced = page.locator('[data-card="contractAmountFinanced"]');
  await expect(amountFinanced).toHaveAttribute('data-severity', 'red');
  await expect(page.locator('[data-card="contractAmountFinanced"] > h3'))
    .toHaveText('$3,185 more is financed than your deal adds up to.');
});

test('Taking the cash instead takes the cash off the drive-away total (Example 5)', async ({ page }) => {
  await page.goto('./');
  await typeFields(page, { ...EXAMPLE_1_TEXT, theirPayment: '652.36' });
  await expectStrip(page, {
    driveAway: '$39,825',
    shouldBe: 'should be $671.65',
    theirs: 'theirs $652.36',
    problems: '3 problems',
  });

  const takingCash = page.getByRole('switch', { name: 'Taking the cash instead' });
  await takingCash.check();
  await expectStrip(page, {
    driveAway: '$38,825',
    shouldBe: 'should be $652.36',
    theirs: 'theirs $652.36',
    problems: '1 problem',
  });

  await takingCash.uncheck();
  await expect(page.locator('[data-strip="problems"]')).toHaveText('3 problems');
});

test('unreadable and out-of-range text shows its error and counts as blank', async ({ page }) => {
  await page.goto('./');
  await typeFields(page, EXAMPLE_1_TEXT);
  const salePriceError = page.locator('[data-error-for="salePrice"]');
  await expect(salePriceError).toBeHidden();

  await typeFields(page, { salePrice: 'abc' });
  await expect(salePriceError).toHaveText('Enter a number, like 36,500.');
  await expect(salePriceError).toBeVisible();
  await expectStrip(page, { ...EMPTY_STRIP, theirs: 'theirs $699.00' });

  await typeFields(page, { salePrice: '36,500', months: '97' });
  await expect(salePriceError).toBeEmpty();
  await expect(page.locator('[data-error-for="months"]')).toHaveText('Must be from 1 to 96.');
  await expectStrip(page, { ...EXAMPLE_1_STRIP, shouldBe: 'should be —', problems: 'No problems' });
});

test("the Price tab's lines, and the checks of their sheet against them", async ({ page }) => {
  await page.goto('./');
  await typeFields(page, { ...EXAMPLE_1_TEXT, stickerTotal: '38,000', theirTax: '2,362.14', theirDriveAway: '39,900' });
  await expect(page.locator('[data-calc="discount"]')).toHaveText('$1,500.00 off the sticker (3.9%)');
  await expect(page.locator('[data-calc="tax-line"]')).toHaveText('6.35% of $37,199.00 = $2,362.14');
  await expect(page.locator('[data-calc="dmv"]')).toHaveText('$264.00 (estimated)');
  await expect(page.locator('[data-calc="drive-away"]')).toHaveText('$39,825.14');
  const theirTaxCheck = page.locator('[data-calc="their-tax-check"]');
  await expect(theirTaxCheck).toHaveText('✓ Matches');
  await expect(page.locator('[data-calc="their-drive-away-check"]')).toHaveText("$74.86 more than the page's");

  // A check is empty, and takes no room, while their figure is blank.
  await typeFields(page, { theirTax: '' });
  await expect(theirTaxCheck).toBeEmpty();
  await expect(theirTaxCheck).toBeHidden();
});

test('the Problems button opens the Verdict tab at its top, from anywhere on the page', async ({ page }) => {
  await page.goto('./');
  await typeFields(page, { ...EXAMPLE_1_TEXT, ...EXAMPLE_3_CONTRACT_TEXT });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  await page.locator('[data-strip="problems"]').click();
  await expect(page.locator('#panel-verdict')).toBeVisible();
  for (const name of ['Price', 'Loan', 'Extras']) {
    await expect(page.getByRole('tab', { name, exact: true }), name).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator(`#panel-${name.toLowerCase()}`), name).toBeHidden();
  }
  await expect(page.getByRole('tab', { name: 'Verdict', exact: true })).toHaveAttribute('aria-selected', 'true');

  // The key numbers start in view, below the strip.
  const keyNumbers = page.locator('[data-key-numbers]');
  await expect(keyNumbers).toBeInViewport();
  const strip = await page.getByRole('region', { name: 'Summary', exact: true }).boundingBox();
  expect((await keyNumbers.boundingBox()).y).toBeGreaterThanOrEqual(strip.y + strip.height);
});

test("tapping Problems fits Example 1's key numbers and problem cards on one iPhone screen", async ({ page }) => {
  await page.setViewportSize(IPHONE_SCREEN);
  await page.goto('./');
  await typeFields(page, EXAMPLE_1_TEXT);
  // From the top of the page, where the heading and the tabs sit above the key numbers.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-strip="problems"]').click();

  // The key numbers start just below the strip, which stays at the top of the screen.
  const strip = await page.getByRole('region', { name: 'Summary', exact: true }).boundingBox();
  const stripBottom = strip.y + strip.height;
  const keyNumbersTop = (await page.locator('[data-key-numbers]').boundingBox()).y;
  expect(keyNumbersTop).toBeGreaterThanOrEqual(stripBottom);
  expect(keyNumbersTop).toBeLessThanOrEqual(stripBottom + 1);
  // Every red and amber card ends on the screen (§6.5's screenshot goal).
  const problemCards = page.locator('[data-cards] > article:is([data-severity="red"], [data-severity="amber"])');
  await expect(problemCards).toHaveCount(3);
  const lastProblemCard = await problemCards.last().boundingBox();
  expect(lastProblemCard.y + lastProblemCard.height).toBeLessThanOrEqual(IPHONE_SCREEN.height);
});

test("each card's Show the math is a 44px tap target that covers none of the card's words", async ({ page }) => {
  await page.goto('./');
  await typeFields(page, { ...EXAMPLE_1_TEXT, ...EXAMPLE_3_CONTRACT_TEXT });
  await page.getByRole('tab', { name: 'Verdict' }).click();
  await expect(page.locator('[data-cards] > article')).toHaveCount(11);

  // Each card's faults: its toggle is under 44px tall (§9), or a line of its words runs into the toggle.
  const faults = await page.locator('[data-cards] > article').evaluateAll((cards) => cards.flatMap((card) => {
    const toggle = card.querySelector('details > summary').getBoundingClientRect();
    const found = toggle.height < 44 ? [`${card.dataset.card}: Show the math is ${toggle.height}px tall`] : [];
    for (const part of card.querySelectorAll(':scope > :not(details)')) {
      const words = document.createRange();
      words.selectNodeContents(part);
      const covered = [...words.getClientRects()].some((line) => line.left < toggle.right && line.right > toggle.left
        && line.top < toggle.bottom && line.bottom > toggle.top);
      if (covered) {
        found.push(`${card.dataset.card}: Show the math covers its ${part.tagName.toLowerCase()}`);
      }
    }
    return found;
  }));
  expect(faults).toEqual([]);
});

test("every request goes to the page's own origin", async ({ page, context, baseURL }) => {
  const requestUrls = [];
  context.on('request', (request) => requestUrls.push(request.url()));
  await page.goto('./');
  await typeFields(page, { ...EXAMPLE_1_TEXT, ...EXAMPLE_3_CONTRACT_TEXT });
  await expectVerdicts(page, [
    ['red', "$699.00/mo doesn't add up."],
    ['red', '$3,185 more is financed than your deal adds up to.'],
    ...EXAMPLE_1_VERDICTS.slice(1),
    ['green', 'The disclosure box adds up.'],
    ['green', 'Total of payments matches the schedule.'],
    ['green', "The APR matches the contract's numbers."],
    ['green', 'The contract matches their quoted rate and term.'],
  ]);

  expect(requestUrls).toContain(new URL('lib/checks.js', baseURL).href);
  const { origin } = new URL(baseURL);
  expect(requestUrls.filter((url) => new URL(url).origin !== origin)).toEqual([]);
});

test('Start over asks first, then clears the whole deal', async ({ page }) => {
  await page.goto('./');
  await typeFields(page, { ...EXAMPLE_1_TEXT, rebates: 'x', ...EXAMPLE_3_CONTRACT_TEXT });
  // Found by id, because it's on the Loan tab, which is hidden while Start over shows.
  const takingCash = page.locator('#takingCash');
  await takingCash.check();
  await expect(page.locator('[data-error-for="rebates"]')).toHaveText('Enter a number, like 36,500.');
  await page.getByRole('tab', { name: 'Verdict' }).click();
  const startOver = page.getByRole('button', { name: 'Start over', exact: true });
  const questions = [];

  // Saying no keeps the deal.
  page.once('dialog', (dialog) => {
    questions.push(dialog.message());
    return dialog.dismiss();
  });
  await startOver.click();
  await expect(page.locator('[data-strip="drive-away"]')).toHaveText('$38,825');
  await expect(takingCash).toBeChecked();

  page.once('dialog', (dialog) => {
    questions.push(dialog.message());
    return dialog.accept();
  });
  await startOver.click();
  expect(questions).toEqual(['Start over? This clears the whole deal.', 'Start over? This clears the whole deal.']);
  await expectStrip(page, EMPTY_STRIP);
  for (const name of FIELD_NAMES) {
    await expect(page.locator(`#${name}`), name).toHaveValue('');
  }
  await expect(takingCash).not.toBeChecked();
  await expect(page.locator('[data-error-for="rebates"]')).toBeEmpty();
  await expectVerdicts(page, [['neutral', 'Enter their sale price on the Price tab to start.']]);
});
