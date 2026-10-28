// ABOUTME: Checks Verdict cards 13–17 against SPEC.md §6.5, §7.10 and §7.11's worked examples.
// ABOUTME: Covers the amount financed, the disclosure box, the payment schedule, the APR and the comparisons with the quote.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstPeriod } from '../../site/lib/calendar.js';
import { contractAprResults, contractCards, contractSchedule, quoteComparisons } from '../../site/lib/contract-checks.js';
import { levelPayments } from '../../site/lib/loan.js';
import { reference } from '../../site/rules/reference.js';
import { assertWithin } from '../assertions.js';
import { dealInputs, dealWith, extra } from '../fixtures.js';

// The contract dates the tests use unless they say otherwise, 2026-10-30 → 2026-12-14: the first payment 1 month and
// 15 days after signing.
const CONTRACT_DATES = firstPeriod('2026-10-30', '2026-12-14');

// SPEC §7.11 Example 2's contract: 0% for 36 months, with a last payment 18 cents less than the others.
const EXAMPLE_2_CONTRACT = {
  amountFinancedCents: 3482514,
  financeChargeCents: 0,
  totalOfPaymentsCents: 3482514,
  aprMilli: 0,
  paymentCents: 96737,
  paymentCount: 36,
  finalPaymentCents: 96719,
  timing: CONTRACT_DATES,
};
// Example 2's quote: 0% for 36 months at $967.37.
const EXAMPLE_2_QUOTE = { theirAprMilli: 0, months: 36, theirPaymentCents: 96737 };
// Example 3's contract: Example 1's deal with a $2,995 warranty and its $190.18 tax added to the amount financed.
const EXAMPLE_3_CONTRACT = {
  amountFinancedCents: 3801032,
  financeChargeCents: 597448,
  totalOfPaymentsCents: 4398480,
  aprMilli: 5900,
  paymentCents: 73308,
  paymentCount: 60,
  timing: CONTRACT_DATES,
};
// Example 4's contract: an honest 5.9% loan for 60 months.
const EXAMPLE_4_CONTRACT = {
  amountFinancedCents: 3482514,
  financeChargeCents: 547386,
  totalOfPaymentsCents: 4029900,
  aprMilli: 5900,
  paymentCents: 67165,
  paymentCount: 60,
  timing: CONTRACT_DATES,
};
// Example 4's quote: their payment is the $671.65 that 5.9% for 60 months should cost.
const EXAMPLE_4_QUOTE = { theirPaymentCents: 67165 };

// The contract cards for Example 1's inputs with `overrides` applied.
function contractCardsWith(overrides) {
  return contractCards(dealWith(overrides), reference);
}

// Cards by key.
function byKey(cards) {
  return Object.fromEntries(cards.map((card) => [card.key, card]));
}

// The contract cards for Example 1's inputs with `overrides` applied, by key.
function cardsWith(overrides) {
  return byKey(contractCardsWith(overrides));
}

// A card's severity and headline, the parts the tests check exactly (SPEC §6.5).
function outcome(card) {
  return [card.severity, card.headline];
}

// A contract financing Example 1's $34,825.14, with the usual dates and the fields given.
function example1Contract(fields) {
  return { amountFinancedCents: 3482514, timing: CONTRACT_DATES, ...fields };
}

// The contract fields given, with the rest blank.
function contractWith(fields) {
  return dealInputs({ contract: fields }).contract;
}

test("Example 2's clean 0% contract passes cards 13–17", () => {
  const cards = contractCardsWith({ ...EXAMPLE_2_QUOTE, contract: EXAMPLE_2_CONTRACT });
  assert.deepEqual(cards.map((card) => [card.key, card.number]), [
    ['contractAmountFinanced', 13],
    ['contractBox', 14],
    ['contractPayments', 15],
    ['contractApr', 16],
    ['contractVsQuote', 17],
  ]);
  assert.deepEqual(cards.map(outcome), [
    ['green', 'The amount financed matches your deal.'],
    ['green', 'The disclosure box adds up.'],
    ['green', 'Total of payments matches the schedule.'],
    ['green', 'The 0% checks out.'],
    ['green', 'The contract matches their quoted rate and term.'],
  ]);
});

test("Example 3's packed contract finances $3,185 more than the deal adds up to, and otherwise checks out", () => {
  const cards = contractCardsWith({ contract: EXAMPLE_3_CONTRACT });
  assert.deepEqual(cards.map(outcome), [
    ['red', '$3,185 more is financed than your deal adds up to.'],
    ['green', 'The disclosure box adds up.'],
    ['green', 'Total of payments matches the schedule.'],
    ['green', "The APR matches the contract's numbers."],
    ['green', 'The contract matches their quoted rate and term.'],
  ]);
  assert.equal(cards[0].sentence, 'Ask for the itemization of the amount financed.');
});

test("comparison 2's line is the most their rate gives on the contract's amount financed, plus $1 (Example 3)", () => {
  // Over the desk timings, 5.9% on $38,010.32 for 60 payments is at most $734.88 (45-day and the contract dates); the
  // regular timing gives the contract's $733.08.
  const { payment } = quoteComparisons(dealWith({ contract: EXAMPLE_3_CONTRACT }), reference);
  assert.equal(payment.ran, true);
  assert.equal(payment.failed, false);
  assert.ok(payment.text.includes('$735.88'), payment.text);
});

test("the deal's amount financed counts the extras in the deal", () => {
  // With Example 3's warranty in the deal, the deal adds up to the contract's $38,010.32.
  const warranty = extra('extra-1', 'warranty', 299500, { inDeal: true });
  const cards = cardsWith({ extras: [warranty], contract: EXAMPLE_3_CONTRACT });
  assert.deepEqual(outcome(cards.contractAmountFinanced), ['green', 'The amount financed matches your deal.']);
});

test("Example 4's honest contract works out to 5.800% with its dates and 5.900% with a regular first month", () => {
  const deal = dealWith({ ...EXAMPLE_4_QUOTE, contract: EXAMPLE_4_CONTRACT });
  assert.deepEqual(contractCards(deal, reference).map(outcome), [
    ['green', 'The amount financed matches your deal.'],
    ['green', 'The disclosure box adds up.'],
    ['green', 'Total of payments matches the schedule.'],
    ['green', "The APR matches the contract's numbers."],
    ['green', 'The contract matches their quoted rate and term.'],
  ]);
  const results = contractAprResults(deal, reference);
  // 15 days longer than a month is within Reg Z's 21-day limit, so the regular timing is allowed too.
  assert.deepEqual(results.map((result) => result.timing), [{ m: 1, d: 15 }, { m: 1, d: 0 }]);
  assertWithin(results[0].percent, 5.8, 0.0005);
  assertWithin(results[1].percent, 5.9, 0.0005);
});

test("the APR card's math shows the worked-out rates to 3 decimals and the 0.125 points Reg Z allows", () => {
  const math = cardsWith({ ...EXAMPLE_4_QUOTE, contract: EXAMPLE_4_CONTRACT }).contractApr.math.join('\n');
  assert.ok(math.includes('5.800%'), math);
  assert.ok(math.includes('5.900%'), math);
  assert.ok(math.includes('0.125 points'), math);
});

test('with no final payment, a total $5 off is a prompt, and the APR check uses the last payment the box implies', () => {
  // SPEC §13: $40,413.86 − 59 × $671.65 implies a last payment of $786.51, which works out to 5.900% with the dates.
  const cards = cardsWith({
    ...EXAMPLE_4_QUOTE,
    contract: { ...EXAMPLE_4_CONTRACT, totalOfPaymentsCents: 4041386, financeChargeCents: 558872 },
  });
  assert.deepEqual(outcome(cards.contractPayments), ['neutral', "Total of payments isn't 60 × $671.65."]);
  assert.equal(cards.contractPayments.sentence, 'If the last payment is different, enter it as Final payment.');
  assert.deepEqual(outcome(cards.contractApr), ['green', "The APR matches the contract's numbers."]);
});

test('a hidden balloon payment fails the APR check, which gives the rate the payments work out to', () => {
  // SPEC §13: $45,000.00 − 59 × $671.65 implies a last payment of $5,372.65: 9.441% with the dates, 9.595% regular.
  const { contractApr } = cardsWith({
    ...EXAMPLE_4_QUOTE,
    contract: { ...EXAMPLE_4_CONTRACT, totalOfPaymentsCents: 4500000, financeChargeCents: 1017486 },
  });
  assert.deepEqual(outcome(contractApr), ['red', "The APR on the contract doesn't match its own numbers."]);
  assert.equal(contractApr.sentence, 'They work out to 9.44%.');
});

test('the total of payments matches within $5 with no final payment, and within $1 with one', () => {
  const payments = (contract) => outcome(cardsWith({ contract }).contractPayments);
  const matches = ['green', 'Total of payments matches the schedule.'];
  const notLevel = ['neutral', "Total of payments isn't 60 × $671.65."];
  const offSchedule = ['amber', "Total of payments doesn't match the payment schedule."];
  // 60 × $671.65 is $40,299.00.
  assert.deepEqual(payments({ ...EXAMPLE_4_CONTRACT, totalOfPaymentsCents: 4030400 }), matches);
  assert.deepEqual(payments({ ...EXAMPLE_4_CONTRACT, totalOfPaymentsCents: 4030401 }), notLevel);
  assert.deepEqual(payments({ ...EXAMPLE_4_CONTRACT, totalOfPaymentsCents: 4029400 }), matches);
  assert.deepEqual(payments({ ...EXAMPLE_4_CONTRACT, totalOfPaymentsCents: 4029399 }), notLevel);
  // 35 × $967.37 + $967.19 is $34,825.14.
  assert.deepEqual(payments({ ...EXAMPLE_2_CONTRACT, totalOfPaymentsCents: 3482614 }), matches);
  assert.deepEqual(payments({ ...EXAMPLE_2_CONTRACT, totalOfPaymentsCents: 3482615 }), offSchedule);
  assert.deepEqual(payments({ ...EXAMPLE_2_CONTRACT, totalOfPaymentsCents: 3482414 }), matches);
  assert.deepEqual(payments({ ...EXAMPLE_2_CONTRACT, totalOfPaymentsCents: 3482413 }), offSchedule);
});

test('contractSchedule ends with the final payment, entered or implied by the box', () => {
  const scheduleWith = (fields) => contractSchedule(contractWith({ paymentCents: 67165, paymentCount: 60, ...fields }));
  assert.deepEqual(scheduleWith({ finalPaymentCents: 78651 }), levelPayments(67165, 59, 78651));
  // $40,413.86 − 59 × $671.65 = $786.51.
  assert.deepEqual(scheduleWith({ totalOfPaymentsCents: 4041386 }), levelPayments(67165, 59, 78651));
  // $40,304.01 is $5.01 more than 60 × $671.65, so the last payment is $40,304.01 − 59 × $671.65 = $676.66.
  assert.deepEqual(scheduleWith({ totalOfPaymentsCents: 4030401 }), levelPayments(67165, 59, 67666));
});

test('contractSchedule keeps the payments level when the box implies no different last payment', () => {
  const scheduleWith = (fields) => contractSchedule(contractWith({ paymentCents: 67165, paymentCount: 60, ...fields }));
  const level = levelPayments(67165, 60);
  assert.deepEqual(scheduleWith({}), level);
  // $5.00 more than 60 × $671.65 is still within the $5.
  assert.deepEqual(scheduleWith({ totalOfPaymentsCents: 4030400 }), level);
  // 59 × $671.65 leaves $0 for the last payment.
  assert.deepEqual(scheduleWith({ totalOfPaymentsCents: 3962735 }), level);
  assert.equal(contractSchedule(contractWith({ paymentCents: 67165 })), null);
  assert.equal(contractSchedule(contractWith({ paymentCount: 60 })), null);
});

test("a regular first month isn't allowed when the first period is further from a month than Reg Z allows", () => {
  // SPEC §13: 12 payments of $2,988.35 on $34,825.14, the first 15 days after signing, are a true 5.9%. With a regular
  // first month they'd work out to 5.442%, but 15 days shorter is past the 11 days Reg Z allows.
  const contract = example1Contract({ paymentCents: 298835, paymentCount: 12, timing: firstPeriod('2026-10-30', '2026-11-14') });
  const low = cardsWith({ contract: { ...contract, aprMilli: 5440 } }).contractApr;
  assert.deepEqual(outcome(low), ['red', "The APR on the contract doesn't match its own numbers."]);
  assert.equal(low.sentence, 'They work out to 5.9%.');
  const right = cardsWith({ contract: { ...contract, aprMilli: 5900 } }).contractApr;
  assert.deepEqual(outcome(right), ['green', "The APR matches the contract's numbers."]);
});

test("the regular timing is allowed without the dates, and with a first period inside Reg Z's limits", () => {
  const timingsFor = (paymentCount, timing) => {
    const contract = example1Contract({ paymentCents: 67165, paymentCount, timing });
    return contractAprResults(dealWith({ contract }), reference).map((result) => result.timing);
  };
  // Without the dates, the 45-day timing stands in for them.
  assert.deepEqual(timingsFor(60, null), [{ m: 1, d: 15 }, { m: 1, d: 0 }]);
  // 12 payments or more: up to 11 days shorter or 21 days longer than a regular month.
  assert.deepEqual(timingsFor(60, { m: 1, d: 21 }), [{ m: 1, d: 21 }, { m: 1, d: 0 }]);
  assert.deepEqual(timingsFor(60, { m: 1, d: 22 }), [{ m: 1, d: 22 }]);
  assert.deepEqual(timingsFor(12, { m: 0, d: 19 }), [{ m: 0, d: 19 }, { m: 1, d: 0 }]);
  assert.deepEqual(timingsFor(12, { m: 0, d: 18 }), [{ m: 0, d: 18 }]);
  assert.deepEqual(timingsFor(12, { m: 1, d: 14 }), [{ m: 1, d: 14 }, { m: 1, d: 0 }]);
  // Under 12 payments: up to 6 days shorter or 13 days longer.
  assert.deepEqual(timingsFor(11, { m: 1, d: 13 }), [{ m: 1, d: 13 }, { m: 1, d: 0 }]);
  assert.deepEqual(timingsFor(11, { m: 1, d: 14 }), [{ m: 1, d: 14 }]);
  assert.deepEqual(timingsFor(11, { m: 0, d: 24 }), [{ m: 0, d: 24 }, { m: 1, d: 0 }]);
  assert.deepEqual(timingsFor(11, { m: 0, d: 23 }), [{ m: 0, d: 23 }]);
});

test('contractAprResults has nothing to work out without the payments and the amount financed', () => {
  assert.deepEqual(contractAprResults(dealWith({ contract: { amountFinancedCents: 3482514 } }), reference), []);
  const noAmount = { paymentCents: 67165, paymentCount: 60, timing: CONTRACT_DATES };
  assert.deepEqual(contractAprResults(dealWith({ contract: noAmount }), reference), []);
});

test('a contract matching a payment-only quote is green, with their payment in the headline (Example 6)', () => {
  // SPEC §13: 60 × $699.00 on $34,825.14 works out to 7.571% with a regular first month, the APR the contract shows.
  const contract = example1Contract({ aprMilli: 7570, paymentCents: 69900, paymentCount: 60 });
  const deal = dealWith({ theirAprMilli: null, contract });
  const cards = byKey(contractCards(deal, reference));
  assert.deepEqual(outcome(cards.contractVsQuote), ['green', 'The contract matches their quoted payment and term.']);
  assert.deepEqual(outcome(cards.contractApr), ['green', "The APR matches the contract's numbers."]);
  // Their payment's rate on this amount financed comes to at most $699.00, so the line is $700.00.
  const { payment } = quoteComparisons(deal, reference);
  assert.ok(payment.text.includes('$700.00'), payment.text);
});

test("a contract APR more than 0.125 points over their APR isn't the deal they quoted", () => {
  // $679.76 is 60 months of $34,825.14 at 6.4%, so the payment is over the 5.9% line as well.
  const contract = example1Contract({ aprMilli: 6400, paymentCents: 67976, paymentCount: 60 });
  const { contractVsQuote } = cardsWith({ contract });
  assert.deepEqual(outcome(contractVsQuote), ['red', "The contract isn't the deal they quoted."]);
  assert.ok(contractVsQuote.sentence.includes('APR 6.4% against 5.9% quoted.'), contractVsQuote.sentence);
});

test("a contract with more payments than the months quoted isn't the deal they quoted", () => {
  // $575.51 is 72 months of $34,825.14 at 5.9%, so only the number of payments differs.
  const contract = example1Contract({ aprMilli: 5900, paymentCents: 57551, paymentCount: 72 });
  const { contractVsQuote } = cardsWith({ contract });
  assert.deepEqual(outcome(contractVsQuote), ['red', "The contract isn't the deal they quoted."]);
  assert.equal(contractVsQuote.sentence, '72 payments against 60 months quoted.');
});

test('a contract with fewer payments than the months quoted is reported once, by the number of payments', () => {
  // $816.27 is 48 months at 5.9%. The payment comparison uses the contract's 48 payments, so it passes; with the 60
  // months quoted its line would be $674.30.
  const contract = example1Contract({ aprMilli: 5900, paymentCents: 81627, paymentCount: 48 });
  const { contractVsQuote } = cardsWith({ contract });
  assert.deepEqual(outcome(contractVsQuote), ['red', "The contract isn't the deal they quoted."]);
  assert.equal(contractVsQuote.sentence, '48 payments against 60 months quoted.');
});

test("a payment over what their rate gives on the contract's amount financed isn't the deal they quoted", () => {
  const { contractVsQuote } = cardsWith({ contract: { ...EXAMPLE_3_CONTRACT, paymentCents: 74500 } });
  assert.deepEqual(outcome(contractVsQuote), ['red', "The contract isn't the deal they quoted."]);
  assert.equal(contractVsQuote.sentence, '$745.00/mo, but 5.9% on this amount financed comes to at most $734.88.');
});

test('a lower APR or payment is never a failure, and a higher one fails only past its tolerance', () => {
  const comparisonsWith = (changes) =>
    quoteComparisons(dealWith({ ...EXAMPLE_4_QUOTE, contract: { ...EXAMPLE_4_CONTRACT, ...changes } }), reference);
  assert.equal(comparisonsWith({ aprMilli: 4900 }).apr.failed, false);
  assert.equal(comparisonsWith({ aprMilli: 6025 }).apr.failed, false);
  assert.equal(comparisonsWith({ aprMilli: 6026 }).apr.failed, true);
  // The payment's line is the 45-day $673.30 plus $1 (SPEC §7.11 Example 4).
  assert.equal(comparisonsWith({ paymentCents: 60000 }).payment.failed, false);
  assert.equal(comparisonsWith({ paymentCents: 67430 }).payment.failed, false);
  assert.equal(comparisonsWith({ paymentCents: 67431 }).payment.failed, true);
});

test('a contract compared only on its number of payments is a note asking for their rate, not a pass', () => {
  // Without their APR or their payment, their rate is unknown.
  const { contractVsQuote } = cardsWith({ theirAprMilli: null, theirPaymentCents: null, contract: EXAMPLE_4_CONTRACT });
  assert.deepEqual(outcome(contractVsQuote), ['neutral', 'Enter their rate to compare the contract with their quote.']);
});

test("the quote note names each blank input the comparisons that didn't run need", () => {
  // Without their APR or months there's no rate to compare and no term.
  const noRateOrTerm = cardsWith({ theirAprMilli: null, months: null, contract: EXAMPLE_4_CONTRACT }).contractVsQuote;
  assert.deepEqual(outcome(noRateOrTerm), [
    'neutral',
    'Enter their rate and months to compare the contract with their quote.',
  ]);
  // A rate worked out from a payment-only quote isn't compared as an APR, so the note asks for neither their rate nor
  // the contract's APR.
  const paymentOnlyContract = { ...EXAMPLE_4_CONTRACT, aprMilli: null, paymentCount: null };
  const paymentOnly = cardsWith({ theirAprMilli: null, contract: paymentOnlyContract }).contractVsQuote;
  assert.deepEqual(outcome(paymentOnly), [
    'neutral',
    "Enter the contract's number of payments to compare the contract with their quote.",
  ]);
});

test("a comparison whose inputs aren't all entered doesn't run", () => {
  const deal = dealWith({ theirAprMilli: null, theirPaymentCents: null, contract: { paymentCount: 60 } });
  const { apr, payment, term } = quoteComparisons(deal, reference);
  assert.deepEqual(apr, { ran: false, failed: false, text: null });
  assert.deepEqual(payment, { ran: false, failed: false, text: null });
  assert.deepEqual([term.ran, term.failed], [true, false]);
});

test("a finance charge more than $1 off the box's other numbers means the box doesn't add up", () => {
  const box = (financeChargeCents) => {
    const contract = { amountFinancedCents: 3482514, financeChargeCents, totalOfPaymentsCents: 4029900 };
    return cardsWith({ contract }).contractBox;
  };
  // Example 4's box: $40,299.00 − $34,825.14 = $5,473.86.
  const offByTwo = box(547586);
  assert.deepEqual(outcome(offByTwo), ['red', "The disclosure box doesn't add up."]);
  assert.equal(offByTwo.sentence, 'The finance charge should equal the total of payments minus the amount financed.');
  assert.deepEqual(outcome(box(547486)), ['green', 'The disclosure box adds up.']);
  assert.deepEqual(outcome(box(547286)), ['green', 'The disclosure box adds up.']);
  assert.deepEqual(outcome(box(547186)), ['red', "The disclosure box doesn't add up."]);
});

test("an amount financed more than $1 off the deal's is reported, more as a problem and less as worth checking", () => {
  const amountFinanced = (amountFinancedCents) =>
    cardsWith({ contract: { amountFinancedCents } }).contractAmountFinanced;
  // The deal adds up to $34,825.14.
  const fiveLow = amountFinanced(3482014);
  assert.deepEqual(outcome(fiveLow), ['amber', '$5 less is financed than your deal adds up to.']);
  assert.equal(fiveLow.sentence, 'Check that the down payment, rebates and cash are what you agreed.');
  assert.deepEqual(outcome(amountFinanced(3482414)), ['green', 'The amount financed matches your deal.']);
  assert.deepEqual(outcome(amountFinanced(3482614)), ['green', 'The amount financed matches your deal.']);
  assert.deepEqual(outcome(amountFinanced(3482615)), ['red', '$1 more is financed than your deal adds up to.']);
  assert.deepEqual(outcome(amountFinanced(3482413)), ['amber', '$1 less is financed than your deal adds up to.']);
});

test("a 0% contract whose payment isn't about the amount financed ÷ n doesn't add up as a 0% loan", () => {
  const { contractApr } = cardsWith({ ...EXAMPLE_2_QUOTE, contract: { ...EXAMPLE_2_CONTRACT, paymentCents: 98000 } });
  assert.deepEqual(outcome(contractApr), ['red', "This doesn't add up as a 0% loan."]);
  assert.equal(contractApr.sentence, 'A 0% loan has a $0 finance charge and a payment of about $967.37.');
});

test('a 0% APR passes with a payment within $1 of the amount financed ÷ n and a finance charge of at most $1', () => {
  const apr = (changes) =>
    outcome(cardsWith({ ...EXAMPLE_2_QUOTE, contract: { ...EXAMPLE_2_CONTRACT, ...changes } }).contractApr);
  const checksOut = ['green', 'The 0% checks out.'];
  const doesNotAddUp = ['red', "This doesn't add up as a 0% loan."];
  // $34,825.14 ÷ 36 is $967.37.
  assert.deepEqual(apr({ paymentCents: 96837 }), checksOut);
  assert.deepEqual(apr({ paymentCents: 96838 }), doesNotAddUp);
  assert.deepEqual(apr({ paymentCents: 96637 }), checksOut);
  assert.deepEqual(apr({ paymentCents: 96636 }), doesNotAddUp);
  assert.deepEqual(apr({ financeChargeCents: 100 }), checksOut);
  // The payments still add up to the amount financed, which a solve would call 0%, but the finance charge is over $1.
  assert.deepEqual(apr({ financeChargeCents: 101 }), doesNotAddUp);
});

test('a 0% contract also needs the finance charge to check its APR', () => {
  const contract = { ...EXAMPLE_2_CONTRACT, financeChargeCents: null };
  const { contractApr } = cardsWith({ ...EXAMPLE_2_QUOTE, contract });
  assert.deepEqual(outcome(contractApr), ['neutral', "Enter the contract's finance charge to check the APR."]);
});

test("the APR check says when the payments can't cover the amount financed, or work out to over 100%", () => {
  const apr = (paymentCents) =>
    cardsWith({ contract: example1Contract({ aprMilli: 5900, paymentCents, paymentCount: 60 }) }).contractApr;
  const mismatch = ['red', "The APR on the contract doesn't match its own numbers."];
  // 60 × $500.00 is $30,000.00, less than the $34,825.14 financed.
  const short = apr(50000);
  assert.deepEqual(outcome(short), mismatch);
  assert.equal(short.sentence, "The payments don't cover the amount financed.");
  // 60 × $10,000.00 is worth more than $34,825.14 even at 100%.
  const huge = apr(1000000);
  assert.deepEqual(outcome(huge), mismatch);
  assert.equal(huge.sentence, 'They work out to over 100%.');
});

test('a card missing contract fields it needs is a note naming them', () => {
  const cards = contractCardsWith({ contract: { aprMilli: 5900 } });
  assert.deepEqual(cards.map((card) => card.severity), Array(5).fill('neutral'));
  assert.deepEqual(cards.map((card) => card.headline), [
    "Enter the contract's amount financed to check it against your deal.",
    "Enter the contract's amount financed, finance charge and total of payments to check the disclosure box.",
    "Enter the contract's total of payments, monthly payment and number of payments to check the payment schedule.",
    "Enter the contract's amount financed, monthly payment and number of payments to check the APR.",
    "Enter the contract's amount financed, monthly payment and number of payments to compare the contract with their "
      + 'quote.',
  ]);
});

test('the contract dates alone bring up no contract cards, and any other contract field brings up all five', () => {
  assert.deepEqual(contractCardsWith({ contract: { timing: CONTRACT_DATES } }), []);
  const finalPaymentOnly = contractCardsWith({ contract: { finalPaymentCents: 96719, timing: CONTRACT_DATES } });
  assert.deepEqual(finalPaymentOnly.map((card) => card.number), [13, 14, 15, 16, 17]);
});

test('a cash deal, or a deal without a sale price yet, has no contract cards', () => {
  // With $40,000 down, Example 1's deal is paid in cash (SPEC §7.11 Example 7).
  assert.deepEqual(contractCardsWith({ downCents: 4000000, contract: EXAMPLE_3_CONTRACT }), []);
  assert.deepEqual(contractCardsWith({ saleCents: null, contract: EXAMPLE_3_CONTRACT }), []);
});

test('every contract card has a sentence, no context line and its math, with no placeholder text', () => {
  const deals = [
    { ...EXAMPLE_2_QUOTE, contract: EXAMPLE_2_CONTRACT },
    { contract: EXAMPLE_3_CONTRACT },
    { ...EXAMPLE_4_QUOTE, contract: { ...EXAMPLE_4_CONTRACT, totalOfPaymentsCents: 4500000 } },
    { ...EXAMPLE_2_QUOTE, contract: { ...EXAMPLE_2_CONTRACT, paymentCents: 98000 } },
    { contract: { ...EXAMPLE_4_CONTRACT, paymentCents: 50000 } },
    { theirAprMilli: null, months: null, contract: { aprMilli: 5900 } },
  ];
  for (const overrides of deals) {
    for (const card of contractCardsWith(overrides)) {
      assert.ok(typeof card.sentence === 'string' && card.sentence.length > 0, `${card.key} has no sentence`);
      assert.equal(card.context, null);
      assert.ok(card.math.length > 0 && card.math.every((line) => typeof line === 'string'), `${card.key}'s math`);
      const text = [card.headline, card.sentence, ...card.math].join('\n');
      assert.doesNotMatch(text, /NaN|undefined|Infinity|null|\[object/);
    }
  }
});
