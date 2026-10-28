// ABOUTME: Checks the values the Verdict checks share against SPEC.md §7.3–§7.7 and §7.11's worked examples.
// ABOUTME: Covers the expected payments, whether the quote is current, the rate worked out from a payment and what extras add.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveDeal } from '../../site/lib/deal.js';
import { FORTY_FIVE_DAY, REGULAR } from '../../site/lib/loan.js';
import { priceOf } from '../../site/lib/price.js';
import { connecticut } from '../../site/rules/connecticut.js';
import { assertWithin } from '../assertions.js';
import { dealInputs, extra } from '../fixtures.js';

// The deal for Example 1's inputs with `overrides` applied.
function dealWith(overrides) {
  return deriveDeal(dealInputs(overrides), connecticut);
}

test("deriveDeal works out Example 1's should-be payment, expected range, rate and doc fee cost", () => {
  const inputs = dealInputs();
  assert.deepEqual(deriveDeal(inputs, connecticut), {
    inputs,
    price: priceOf(inputs, connecticut),
    hasSale: true,
    isCashDeal: false,
    deskTimings: [REGULAR, FORTY_FIVE_DAY],
    contractTiming: null,
    theirAprPercent: 5.9,
    shouldBeCents: 67165,
    expected: { lowCents: 67165, highCents: 67330 },
    quoteCurrent: true,
    workedOutRate: null,
    theirRate: { percent: 5.9, entered: true, over100: false },
    specialApplies: false,
    docFeeCostCents: 74339,
    extras: [],
    extrasInDeal: null,
  });
});

test("the contract dates' timing joins the desk timings, and a short first period gives the lowest payment", () => {
  const deal = dealWith({ contract: { timing: { m: 0, d: 20 } } });
  assert.deepEqual(deal.contractTiming, { m: 0, d: 20 });
  assert.deepEqual(deal.deskTimings, [REGULAR, FORTY_FIVE_DAY, { m: 0, d: 20 }]);
  assert.deepEqual(deal.expected, { lowCents: 67055, highCents: 67330 });
  // The should-be payment always uses the regular timing (§7.4).
  assert.equal(deal.shouldBeCents, 67165);
});

test('a 0% APR counts as entered, and at 0% every timing gives the same payment (Example 2)', () => {
  const deal = dealWith({ theirAprMilli: 0, months: 36, theirPaymentCents: 96737 });
  assert.equal(deal.theirAprPercent, 0);
  assert.equal(deal.shouldBeCents, 96737);
  assert.deepEqual(deal.expected, { lowCents: 96737, highCents: 96737 });
  assert.deepEqual(deal.theirRate, { percent: 0, entered: true, over100: false });
  assert.equal(deal.workedOutRate, null);
});

test("with their APR blank, their rate is R, the smallest of the desk timings' rates (Example 6)", () => {
  const deal = dealWith({ theirAprMilli: null });
  // R is 7.571% with the regular timing and 7.4405% with a 45-day first payment (§7.11).
  assertWithin(deal.workedOutRate.percent, 7.4405, 0.0001);
  assert.equal(deal.workedOutRate.zero, false);
  assert.equal(deal.workedOutRate.over100, false);
  assert.deepEqual(deal.theirRate, { percent: deal.workedOutRate.percent, entered: false, over100: false });
  assert.equal(deal.theirAprPercent, null);
  // The should-be payment and the expected range need their APR.
  assert.equal(deal.shouldBeCents, null);
  assert.equal(deal.expected, null);
});

test('R counts the contract timing too, so a later first payment lowers it', () => {
  // The first payment 2 months after signing works out to 7.3149%, below the 45-day timing's 7.4405%.
  const deal = dealWith({ theirAprMilli: null, contract: { timing: { m: 2, d: 0 } } });
  assertWithin(deal.workedOutRate.percent, 7.3149, 0.0001);
});

test("R comes from the timings that reach their payment at 100% or less when other timings can't", () => {
  // $3,200/mo for 60 months is worth more than $34,825.14 even at 100% with the regular and 45-day timings, but with
  // the first payment 3 months away it works out to 93.8174%.
  const deal = dealWith({ theirAprMilli: null, theirPaymentCents: 320000, contract: { timing: { m: 3, d: 0 } } });
  assertWithin(deal.workedOutRate.percent, 93.8174, 0.0001);
  assert.equal(deal.workedOutRate.over100, false);
});

test('a payment worth more than the amount financed even at 100% is over 100%, and counts as 100%', () => {
  const deal = dealWith({ theirAprMilli: null, theirPaymentCents: 699000 });
  assert.deepEqual(deal.workedOutRate, { percent: 100, zero: false, over100: true });
  assert.deepEqual(deal.theirRate, { percent: 100, entered: false, over100: true });
});

test('R shows as 0 when it rounds down to 0, and is 0% when the payments total at most the amount financed', () => {
  // 36 × $967.37 is 18 cents more than $34,825.14, so R is just above 0%.
  const justAbove = dealWith({ theirAprMilli: null, months: 36, theirPaymentCents: 96737 }).workedOutRate;
  assert.equal(justAbove.zero, true);
  assert.equal(justAbove.over100, false);
  assert.ok(justAbove.percent > 0 && justAbove.percent < 0.001, `${justAbove.percent}% should be just above 0%`);
  const zero = { percent: 0, zero: true, over100: false };
  assert.deepEqual(dealWith({ theirAprMilli: null, months: 36, theirPaymentCents: 96736 }).workedOutRate, zero);
  // 6 × $5,804.19 is exactly $34,825.14.
  assert.deepEqual(dealWith({ theirAprMilli: null, months: 6, theirPaymentCents: 580419 }).workedOutRate, zero);
});

test("a down payment other than the quote's makes the quote out of date, so no rate is worked out from it", () => {
  assert.equal(dealWith({ downCents: 550000 }).quoteCurrent, false);
  const deal = dealWith({ downCents: 550000, theirAprMilli: null });
  assert.equal(deal.workedOutRate, null);
  assert.equal(deal.theirRate, null);
});

test('until their payment is entered there is no quote to be current, and no rate to work out', () => {
  const deal = dealWith({ theirPaymentCents: null, theirAprMilli: null });
  assert.equal(deal.quoteCurrent, null);
  assert.equal(deal.workedOutRate, null);
  assert.equal(deal.theirRate, null);
});

test('without months there is no payment to expect, no rate to work out and no loan to spread an extra over', () => {
  const deal = dealWith({ months: null, extras: [extra('extra-1', 'warranty', 299500)] });
  assert.equal(deal.shouldBeCents, null);
  assert.equal(deal.expected, null);
  assert.deepEqual(deal.extras, [{ id: 'extra-1', costCents: 318518, perMonthCents: null, overLoanCents: null }]);
  assert.equal(dealWith({ months: null, theirAprMilli: null }).workedOutRate, null);
});

test("the special rate applies when it's entered, months are within its entered term, and the cash isn't taken", () => {
  assert.equal(dealWith({ theirAprMilli: 0, months: 36 }).specialApplies, true);
  assert.equal(dealWith({ theirAprMilli: 0, months: 36, takingCash: true }).specialApplies, false);
  assert.equal(dealWith({ months: 24 }).specialApplies, true);
  assert.equal(dealWith({ months: 37 }).specialApplies, false);
  assert.equal(dealWith({ months: 36, specialAprMilli: null }).specialApplies, false);
  assert.equal(dealWith({ months: 36, specialCoversMonths: null }).specialApplies, false);
  assert.equal(dealWith({ months: null }).specialApplies, false);
});

test("an extra that isn't in the deal would add its cost to the loan at their rate (§7.11's Extras table)", () => {
  const deal = dealWith({ extras: [extra('extra-1', 'warranty', 299500), extra('extra-2', 'gap', 89500)] });
  assert.deepEqual(deal.extras, [
    { id: 'extra-1', costCents: 318518, perMonthCents: 6143, overLoanCents: 368580 },
    { id: 'extra-2', costCents: 89500, perMonthCents: 1726, overLoanCents: 103560 },
  ]);
  assert.equal(deal.extrasInDeal, null);
});

test('the extras in the deal add their cost to the loan, each one alone and all of them taken as one item', () => {
  const warranty = extra('extra-1', 'warranty', 299500, { inDeal: true });
  const deal = dealWith({ extras: [warranty, extra('extra-2', 'gap', 89500)] });
  // Example 3's amount financed, $38,010.32.
  assert.equal(deal.price.amountFinancedCents, 3801032);
  assert.deepEqual(deal.extras[0], { id: 'extra-1', costCents: 318518, perMonthCents: 6143, overLoanCents: 368580 });
  assert.deepEqual(deal.extrasInDeal, { costCents: 318518, perMonthCents: 6143, overLoanCents: 368580 });
});

test('an extra in the deal that costs more than the amount financed adds the whole payment', () => {
  // With $42,000 down the amount financed is $1,010.32, less than the warranty's $3,185.18 cost.
  const deal = dealWith({ downCents: 4200000, extras: [extra('extra-1', 'warranty', 299500, { inDeal: true })] });
  assert.equal(deal.price.amountFinancedCents, 101032);
  assert.deepEqual(deal.extras[0], { id: 'extra-1', costCents: 318518, perMonthCents: 1949, overLoanCents: 116940 });
  assert.deepEqual(deal.extrasInDeal, { costCents: 318518, perMonthCents: 1949, overLoanCents: 116940 });
});

test("the extras' figures use R when their APR is blank, and 100% when R is over 100%", () => {
  const warranty = extra('extra-1', 'warranty', 299500);
  assert.equal(dealWith({ theirAprMilli: null, extras: [warranty] }).extras[0].perMonthCents, 6373);
  const overHundred = dealWith({ theirAprMilli: null, theirPaymentCents: 699000, extras: [warranty] });
  assert.equal(overHundred.extras[0].perMonthCents, 26763);
});

test("while their rate is unknown there's no loan to spread an extra's cost over", () => {
  const warranty = extra('extra-1', 'warranty', 299500, { inDeal: true });
  const deal = dealWith({ theirAprMilli: null, theirPaymentCents: null, extras: [warranty] });
  assert.deepEqual(deal.extras, [{ id: 'extra-1', costCents: 318518, perMonthCents: null, overLoanCents: null }]);
  assert.deepEqual(deal.extrasInDeal, { costCents: 318518, perMonthCents: null, overLoanCents: null });
});

test('a cash deal has no expected payment, no worked-out rate and no loan to spread an extra over (Example 7)', () => {
  const deal = dealWith({ downCents: 4000000, extras: [extra('extra-1', 'warranty', 299500)] });
  assert.equal(deal.isCashDeal, true);
  assert.equal(deal.shouldBeCents, null);
  assert.equal(deal.expected, null);
  assert.deepEqual(deal.extras, [{ id: 'extra-1', costCents: 318518, perMonthCents: null, overLoanCents: null }]);
  // The quote is current at this down payment, but there's no loan for it to pay off.
  assert.equal(dealWith({ downCents: 4000000, quoteDownCents: 4000000, theirAprMilli: null }).workedOutRate, null);
  const inDeal = dealWith({ downCents: 4400000, extras: [extra('extra-1', 'warranty', 299500, { inDeal: true })] });
  assert.equal(inDeal.isCashDeal, true);
  assert.deepEqual(inDeal.extrasInDeal, { costCents: 318518, perMonthCents: null, overLoanCents: null });
});

test('until the sale price is entered there is no sale, no cash deal and no loan', () => {
  const deal = dealWith({ saleCents: null, extras: [extra('extra-1', 'vinEtch', 40000)] });
  assert.equal(deal.hasSale, false);
  assert.equal(deal.isCashDeal, false);
  assert.equal(deal.shouldBeCents, null);
  assert.equal(deal.expected, null);
  // An item's cost counts the blank sale price as $0 (§7.7).
  assert.deepEqual(deal.extras, [{ id: 'extra-1', costCents: 42540, perMonthCents: null, overLoanCents: null }]);
  assert.equal(dealWith({ saleCents: null, theirAprMilli: null }).workedOutRate, null);
});
