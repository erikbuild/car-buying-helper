// ABOUTME: Checks the summary strip, the Price tab lines, the amount financed, the extra lines and the key numbers.
// ABOUTME: Deals start from SPEC.md §7.11's Example 1; cards here are plain objects that hold only a severity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  amountFinancedLine,
  extraLine,
  keyNumbers,
  priceTabLines,
  problemCount,
  summaryStrip,
  taxLine,
  workedOutRateText,
} from '../../site/lib/display.js';
import { connecticut } from '../../site/rules/connecticut.js';
import { dealWith, extra } from '../fixtures.js';

// Cards with the given severities, which is all the strip reads from them.
function cardsOf(...severities) {
  return severities.map((severity) => ({ severity }));
}

// The value of the key-number row labeled `label`.
function keyNumber(deal, label) {
  return keyNumbers(deal).find((row) => row.label === label).value;
}

test("the strip shows Example 1's drive-away total, both payments and the problem count", () => {
  assert.deepEqual(summaryStrip(dealWith(), cardsOf('red', 'amber', 'amber', 'green')), {
    driveAway: '$39,825',
    shouldBe: 'should be $671.65',
    theirs: 'theirs $699.00',
    problems: '3 problems',
  });
});

test('the problem count counts the red and amber cards, with 1 in the singular', () => {
  const problems = (...severities) => summaryStrip(dealWith(), cardsOf(...severities)).problems;
  assert.equal(problems('amber'), '1 problem');
  assert.equal(problems(), 'No problems');
  assert.equal(problems('green', 'neutral'), 'No problems');
  assert.equal(problems('red', 'red', 'neutral'), '2 problems');
});

test('until the sale price is entered the strip shows "—" for the drive-away total, should-be and problems', () => {
  assert.deepEqual(summaryStrip(dealWith({ saleCents: null }), cardsOf('neutral')), {
    driveAway: '—',
    shouldBe: 'should be —',
    theirs: 'theirs $699.00',
    problems: '—',
  });
});

test("a cash deal's payment slot says Paying cash, with no line for their payment (Example 7)", () => {
  assert.deepEqual(summaryStrip(dealWith({ downCents: 4000000 }), cardsOf('green', 'green', 'neutral')), {
    driveAway: '$39,815',
    shouldBe: 'Paying cash',
    theirs: null,
    problems: 'No problems',
  });
});

test('an out-of-date quote shows the down payment it was quoted at', () => {
  const strip = summaryStrip(dealWith({ downCents: 550000 }), cardsOf());
  assert.equal(strip.shouldBe, 'should be $662.01');
  assert.equal(strip.theirs, 'theirs $699.00 at $5,000 down');
});

test("without their APR there's no should-be payment, and without their payment there's no second line", () => {
  const paymentOnly = summaryStrip(dealWith({ theirAprMilli: null }), cardsOf('amber', 'amber'));
  assert.equal(paymentOnly.shouldBe, 'should be —');
  assert.equal(paymentOnly.theirs, 'theirs $699.00');
  assert.equal(summaryStrip(dealWith({ theirPaymentCents: null }), cardsOf()).theirs, null);
});

test("the tax line has one term for Example 1's vehicle base", () => {
  assert.equal(taxLine(dealWith().price, connecticut), '6.35% of $37,199.00 = $2,362.14');
});

test('the tax line adds a 6.35% term for taxed service extras, even with the car at 7.75%', () => {
  const warranty = extra('extra-1', 'warranty', 299500, { inDeal: true });
  const deal = dealWith({ saleCents: 5100000, docFeeCents: null, extras: [warranty] });
  assert.equal(taxLine(deal.price, connecticut), '7.75% of $51,000.00 + 6.35% of $2,995.00 = $4,142.68');
});

test('the tax line is "—" until the sale price is entered', () => {
  assert.equal(taxLine(dealWith({ saleCents: null }).price, connecticut), '—');
});

test("an extra's line gives what it adds a month and over the loan, and its cost with tax (§7.11's Extras table)", () => {
  const deal = dealWith({ extras: [extra('extra-1', 'warranty', 299500), extra('extra-2', 'gap', 89500)] });
  assert.equal(extraLine(deal, 'extra-1'), 'Would add $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)');
  assert.equal(extraLine(deal, 'extra-2'), 'Would add $17.26/mo, $1,035.60 over 60 months ($895.00 with tax)');
});

test('an extra in the deal says "Adds"', () => {
  const deal = dealWith({ extras: [extra('extra-1', 'warranty', 299500, { inDeal: true })] });
  assert.equal(extraLine(deal, 'extra-1'), 'Adds $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)');
});

test("with no loan to spread it over, an extra's line is just its cost with tax", () => {
  const warranty = extra('extra-1', 'warranty', 299500);
  const lineFor = (overrides) => extraLine(dealWith({ ...overrides, extras: [warranty] }), 'extra-1');
  assert.equal(lineFor({ downCents: 4000000 }), 'Would add $3,185.18 with tax');
  assert.equal(lineFor({ months: null }), 'Would add $3,185.18 with tax');
  assert.equal(lineFor({ theirAprMilli: null, theirPaymentCents: null }), 'Would add $3,185.18 with tax');
  const inCashDeal = dealWith({ downCents: 4400000, extras: [{ ...warranty, inDeal: true }] });
  assert.equal(extraLine(inCashDeal, 'extra-1'), 'Adds $3,185.18 with tax');
});

test("a 1-month loan's extra line says 1 month", () => {
  const deal = dealWith({ months: 1, extras: [extra('extra-1', 'warranty', 299500)] });
  assert.equal(extraLine(deal, 'extra-1'), 'Would add $3,200.84/mo, $3,200.84 over 1 month ($3,185.18 with tax)');
});

test("the Price tab lines show the sticker discount, Example 1's tax, the estimated DMV fees and the drive-away", () => {
  assert.deepEqual(priceTabLines(dealWith({ stickerCents: 3800000 }), connecticut), {
    discount: '$1,500.00 off the sticker (3.9%)',
    taxLine: '6.35% of $37,199.00 = $2,362.14',
    dmv: '$264.00 (estimated)',
    driveAway: '$39,825.14',
    theirTaxCheck: null,
    theirDriveAwayCheck: null,
  });
});

test('a sale price above the sticker shows how far above it, and the discount needs both prices', () => {
  const discount = (overrides) => priceTabLines(dealWith(overrides), connecticut).discount;
  assert.equal(discount({ stickerCents: 3600000 }), '$500.00 above the sticker (1.4%)');
  assert.equal(discount({ stickerCents: 3650000 }), '$0.00 off the sticker (0%)');
  assert.equal(discount({}), '—');
  assert.equal(discount({ stickerCents: 3800000, saleCents: null }), '—');
  // A $0 sticker leaves no percent to work out.
  assert.equal(discount({ stickerCents: 0 }), '—');
});

test('entered title + registration is shown as entered, without "estimated"', () => {
  const dmv = (overrides) => priceTabLines(dealWith(overrides), connecticut).dmv;
  assert.equal(dmv({ titleRegistrationCents: 30000 }), '$300.00');
  // A cash deal's estimate has no lien fee (Example 7).
  assert.equal(dmv({ downCents: 4000000 }), '$254.00 (estimated)');
});

test("their tax shows a check mark within $1 of the page's tax, and the difference otherwise", () => {
  const check = (theirTaxCents) => priceTabLines(dealWith({ theirTaxCents }), connecticut).theirTaxCheck;
  assert.equal(check(236214), '✓ Matches');
  assert.equal(check(240000), "$37.86 more than the page's");
  assert.equal(check(230000), "$62.14 less than the page's");
  assert.equal(check(236314), '✓ Matches');
  assert.equal(check(236315), "$1.01 more than the page's");
  assert.equal(check(236114), '✓ Matches');
  assert.equal(check(236113), "$1.01 less than the page's");
});

test("their drive-away total shows a check mark within $1 of the page's, and the difference otherwise", () => {
  const check = (theirDriveAwayCents) => priceTabLines(dealWith({ theirDriveAwayCents }), connecticut).theirDriveAwayCheck;
  assert.equal(check(3982500), '✓ Matches');
  assert.equal(check(3990000), "$74.86 more than the page's");
  assert.equal(check(3970000), "$125.14 less than the page's");
});

test('until the sale price is entered the Price tab lines are "—", and an entered figure of theirs has nothing to match', () => {
  assert.deepEqual(priceTabLines(dealWith({ saleCents: null, stickerCents: 3800000, theirTaxCents: 236214 }), connecticut), {
    discount: '—',
    taxLine: '—',
    dmv: '—',
    driveAway: '—',
    theirTaxCheck: '—',
    theirDriveAwayCheck: null,
  });
});

test('the amount financed is in cents, "Paying cash" in a cash deal, and "—" until the sale price is entered', () => {
  assert.equal(amountFinancedLine(dealWith()), '$34,825.14');
  assert.equal(amountFinancedLine(dealWith({ downCents: 4000000 })), 'Paying cash');
  // An amount financed of exactly $0 is a cash deal too.
  assert.equal(amountFinancedLine(dealWith({ downCents: 3981514 })), 'Paying cash');
  assert.equal(amountFinancedLine(dealWith({ saleCents: null })), '—');
});

test("the key numbers give Example 1's sale price, drive-away, amount financed, rate, months and payments", () => {
  assert.deepEqual(keyNumbers(dealWith()), [
    { label: 'Their sale price', value: '$36,500' },
    { label: 'Drive-away total', value: '$39,825' },
    { label: 'Amount financed', value: '$34,825' },
    { label: 'Their rate', value: '5.9%' },
    { label: 'Months', value: '60' },
    { label: 'Payment', value: 'should be $671.65, theirs $699.00' },
  ]);
});

test('an entered APR shows as entered', () => {
  assert.equal(keyNumber(dealWith({ theirAprMilli: 4350 }), 'Their rate'), '4.35%');
  assert.equal(keyNumber(dealWith({ theirAprMilli: 0, months: 36, theirPaymentCents: 96737 }), 'Their rate'), '0%');
});

test('with their APR blank, the key numbers give the rate worked out from their payment (Example 6)', () => {
  const deal = dealWith({ theirAprMilli: null });
  assert.ok(keyNumbers(deal).some((row) => row.label === 'Their rate' && row.value === 'at least 7.44%, from their payment'));
  assert.equal(keyNumber(deal, 'Payment'), 'should be —, theirs $699.00');
});

test('a worked-out rate that shows as 0, or is over 100%, reads "0%" or "over 100%" with no "at least"', () => {
  const zero = dealWith({ theirAprMilli: null, months: 36, theirPaymentCents: 96737 });
  assert.equal(keyNumber(zero, 'Their rate'), '0%, from their payment');
  const overHundred = dealWith({ theirAprMilli: null, theirPaymentCents: 699000 });
  assert.equal(keyNumber(overHundred, 'Their rate'), 'over 100%, from their payment');
});

test('workedOutRateText rounds R down and words it in the forms §7.5 gives', () => {
  assert.equal(workedOutRateText({ percent: 7.440472, zero: false, over100: false }), 'at least 7.44%');
  // Half up would give 7.45%, which overstates R.
  assert.equal(workedOutRateText({ percent: 7.449, zero: false, over100: false }), 'at least 7.44%');
  assert.equal(workedOutRateText({ percent: 0.000326, zero: true, over100: false }), '0%');
  assert.equal(workedOutRateText({ percent: 100, zero: false, over100: true }), 'over 100%');
});

test('key numbers that need a blank input show "—"', () => {
  const deal = dealWith({ theirAprMilli: null, theirPaymentCents: null, months: null });
  assert.equal(keyNumber(deal, 'Their rate'), '—');
  assert.equal(keyNumber(deal, 'Months'), '—');
  assert.equal(keyNumber(deal, 'Payment'), 'should be —');
});

test("the key numbers' payment shows an out-of-date quote's down payment", () => {
  const deal = dealWith({ downCents: 550000 });
  assert.equal(keyNumber(deal, 'Amount financed'), '$34,325');
  assert.equal(keyNumber(deal, 'Payment'), 'should be $662.01, theirs $699.00 at $5,000 down');
});

test('a cash deal has no loan, so its key numbers say Paying cash in place of the loan rows (Example 7)', () => {
  assert.deepEqual(keyNumbers(dealWith({ downCents: 4000000 })), [
    { label: 'Their sale price', value: '$36,500' },
    { label: 'Drive-away total', value: '$39,815' },
    { label: 'Payment', value: 'Paying cash' },
  ]);
});

test('there are no key numbers until the sale price is entered', () => {
  assert.deepEqual(keyNumbers(dealWith({ saleCents: null })), []);
});

test('problemCount counts the red and amber cards', () => {
  assert.equal(problemCount(cardsOf('red', 'amber', 'green', 'neutral', 'amber')), 3);
  assert.equal(problemCount(cardsOf('green', 'neutral')), 0);
  assert.equal(problemCount([]), 0);
});
