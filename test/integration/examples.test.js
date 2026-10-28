// ABOUTME: Builds SPEC.md §7.11's worked examples from the text typed into each field, as the page reads it.
// ABOUTME: Checks their numbers, cards and strip, and sweeps blank and extreme fields for broken text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictCards } from '../../site/lib/checks.js';
import { contractAprResults, contractSchedule, quoteComparisons } from '../../site/lib/contract-checks.js';
import { deriveDeal } from '../../site/lib/deal.js';
import { specialVsCash } from '../../site/lib/desk-checks.js';
import { amountFinancedLine, extraLine, keyNumbers, priceTabLines, summaryStrip } from '../../site/lib/display.js';
import { addExtra, editExtra, emptyForm, setTakingCash } from '../../site/lib/form.js';
import { readInputs } from '../../site/lib/inputs.js';
import { monthlyPayment } from '../../site/lib/loan.js';
import { formatCents, formatRatePercent } from '../../site/lib/numbers.js';
import { connecticut } from '../../site/rules/connecticut.js';
import { reference } from '../../site/rules/reference.js';
import { assertWithin } from '../assertions.js';
import { verdictOf } from '../cards.js';
import {
  CONTRACT_DATES,
  EXAMPLE_1_PAYMENT_SENTENCE,
  EXAMPLE_1_STRIP,
  EXAMPLE_1_TEXT,
  EXAMPLE_1_VERDICTS,
  EXAMPLE_3_CONTRACT_TEXT,
  typed,
} from '../fixtures.js';

// Card 5's figures for Example 1's deal (§7.9): the special rate's payment for nA months on AF₀, the cash's payment on
// AF_B, what each costs in today's dollars at the outside rate, which wins and by how much, and the break-even outside
// rate O*.
const EXAMPLE_1_SPECIAL_OR_CASH = {
  nA: 36,
  paymentA: '$967.37',
  af0: '$34,825.14',
  afB: '$33,825.14',
  paymentB: '$646.10',
  costA: '$32,036.47',
  costB: '$33,825.14',
  winner: 'special',
  difference: '$1,788.67',
  breakEven: '1.9005%',
};

// Example 1's form, with `fields` typed over it. The down payment is typed before their payment, so the quote is tied
// to the down payment the example gives.
function exampleForm(fields = {}) {
  return typed(fields, typed(EXAMPLE_1_TEXT));
}

// What the page shows for a form: the deal it reads, the Verdict cards and the summary strip. Every form here holds
// valid text, so no field has an error, and whenever the contract dates are entered they're Examples 2–4's valid
// pair, so their hint gives the first period between them.
function pageFor(form) {
  const { inputs, errors, extraErrors, dateHint } = readInputs(form);
  const contractDatesHint = inputs.contract.timing === null
    ? null
    : 'First payment 1 month and 15 days after the contract date.';
  assert.deepEqual({ errors, extraErrors, dateHint }, { errors: {}, extraErrors: {}, dateHint: contractDatesHint });
  const deal = deriveDeal(inputs, connecticut);
  const cards = verdictCards(deal, connecticut, reference);
  return { deal, cards, strip: summaryStrip(deal, cards) };
}

// The card with this key, which must be there.
function cardWithKey(cards, key) {
  const card = cards.find((each) => each.key === key);
  assert.ok(card, `there's no ${key} card`);
  return card;
}

// Checks that a card's sentence says `text`. Sentences may be polished as long as they keep their facts and amounts
// (§6.5), so the examples that give part of a sentence are checked for that part.
function assertSentenceSays(card, text) {
  assert.ok(card.sentence.includes(text), `${card.key}: ${card.sentence}`);
}

// Checks that each of `texts` is in one of the lines of a card's "Show the math".
function assertMathShows(card, texts) {
  for (const text of texts) {
    const message = `${card.key} math lacks ${text}: ${card.math.join(' | ')}`;
    assert.ok(card.math.some((line) => line.includes(text)), message);
  }
}

// The Price tab's tax, DMV and drive-away lines, and the amount financed in cents.
function priceFigures(deal) {
  const { taxLine, dmv, driveAway } = priceTabLines(deal, connecticut);
  return { taxLine, dmv, driveAway, amountFinanced: formatCents(deal.price.amountFinancedCents) };
}

// Card 5's comparison of the special rate with the cash (§7.9), with amounts in cents and O* half up to 4 decimals.
function specialOrCashFigures(deal) {
  const comparison = specialVsCash(deal, connecticut);
  return {
    nA: comparison.nA,
    paymentA: formatCents(comparison.paymentACents),
    af0: formatCents(comparison.af0Cents),
    afB: formatCents(comparison.afBCents),
    paymentB: formatCents(comparison.paymentBCents),
    costA: formatCents(comparison.costACents),
    costB: formatCents(comparison.costBCents),
    winner: comparison.winner,
    difference: formatCents(comparison.differenceCents),
    breakEven: formatRatePercent(comparison.breakEven.percent, 'halfUp', 4),
  };
}

// The rates the contract's numbers work out to with each timing it may use (§7.10), half up to 3 decimals as "Show the
// math" shows them.
function contractAprFigures(deal) {
  return contractAprResults(deal, reference).map(({ timing, percent }) => [
    timing,
    formatRatePercent(percent, 'halfUp', 3),
  ]);
}

test('Example 1: a padded payment on a standard-rate loan (§7.11)', () => {
  const { deal, cards, strip } = pageFor(exampleForm());
  assert.deepEqual(priceFigures(deal), {
    taxLine: '6.35% of $37,199.00 = $2,362.14',
    dmv: '$264.00 (estimated)',
    driveAway: '$39,825.14',
    amountFinanced: '$34,825.14',
  });
  // The should-be payment uses the regular timing, and the 45-day timing gives the highest payment.
  assert.equal(deal.shouldBeCents, 67165);
  assert.deepEqual(deal.expected, { lowCents: 67165, highCents: 67330 });
  // The accepted range, then R and E with the regular and the 45-day timings.
  const payment = cardWithKey(cards, 'payment');
  assertMathShows(payment, ['$670.65 to $674.30', '7.571%', '7.440%', '$1,418.13', '$1,329.25']);
  // The payment at the 5.5% outside rate, and what their rate costs against it.
  assertMathShows(cardWithKey(cards, 'outsideRate'), ['($671.65 − $665.20) × 60 = $387.00']);
  assert.deepEqual(specialOrCashFigures(deal), EXAMPLE_1_SPECIAL_OR_CASH);
  assert.equal(formatCents(deal.docFeeCostCents), '$743.39');

  assert.deepEqual(cards.map(verdictOf), EXAMPLE_1_VERDICTS);
  assert.equal(payment.sentence, EXAMPLE_1_PAYMENT_SENTENCE);
  assertSentenceSays(cardWithKey(cards, 'outsideRate'), 'That costs $387 over 60 months.');
  assertSentenceSays(cardWithKey(cards, 'specialOrCash'), 'Cash only wins if you can borrow below 1.9%.');
  assertSentenceSays(cardWithKey(cards, 'docFee'), 'With tax it costs $743.');
  assert.deepEqual(strip, EXAMPLE_1_STRIP);
});

test('Example 2: a clean 0% deal, with its contract (§7.11)', () => {
  const { deal, cards, strip } = pageFor(exampleForm({
    theirApr: '0',
    months: '36',
    theirPayment: '967.37',
    contractAmountFinanced: '34,825.14',
    contractFinanceCharge: '0.00',
    contractTotalOfPayments: '34,825.14',
    contractApr: '0',
    contractPayment: '967.37',
    contractPaymentCount: '36',
    contractFinalPayment: '967.19',
    ...CONTRACT_DATES,
  }));
  assert.deepEqual(deal.contractTiming, { m: 1, d: 15 });
  // At 0% all three desk timings give $967.37.
  assert.equal(deal.deskTimings.length, 3);
  assert.deepEqual(deal.expected, { lowCents: 96737, highCents: 96737 });
  assertMathShows(cardWithKey(cards, 'payment'), ['$966.37 to $968.37']);
  // The cash's payment is 5.5% for 36 months here.
  assert.deepEqual(specialOrCashFigures(deal), { ...EXAMPLE_1_SPECIAL_OR_CASH, paymentB: '$1,021.38' });
  assert.deepEqual(contractSchedule(deal.inputs.contract), [...Array(35).fill(96737), 96719]);
  // The Outside rate card is left off because the special rate applies.
  assert.equal(deal.specialApplies, true);

  assert.deepEqual(cards.map(verdictOf), [
    ['green', '$967.37/mo matches 36 months at 0%.'],
    ['green', "On the automaker's 0% special."],
    ['green', 'The 0% special beats the $1,000 cash by about $1,790.'],
    ['green', '$699 doc fee.'],
    ['green', 'No extras in the deal.'],
    ['green', 'The amount financed matches your deal.'],
    ['green', 'The disclosure box adds up.'],
    ['green', 'Total of payments matches the schedule.'],
    ['green', 'The 0% checks out.'],
    ['green', 'The contract matches their quoted rate and term.'],
  ]);
  assertSentenceSays(cardWithKey(cards, 'specialOrCash'), 'Cash only wins if you can borrow below 1.9%.');
  assert.deepEqual(strip, {
    driveAway: '$39,825',
    shouldBe: 'should be $967.37',
    theirs: 'theirs $967.37',
    problems: 'No problems',
  });
});

test('Example 3: a packed contract (§7.11)', () => {
  const { deal, cards, strip } = pageFor(exampleForm(EXAMPLE_3_CONTRACT_TEXT));
  // The contract's dates give 5.800%. A regular first month gives 5.900%, and it's allowed, because a first period
  // 15 days longer than a month is within Reg Z's 21-day limit.
  assert.deepEqual(contractAprFigures(deal), [[{ m: 1, d: 15 }, '5.800%'], [{ m: 1, d: 0 }, '5.900%']]);
  // Comparison 2: their 5.9% on the contract's amount financed with the regular timing, the 45-day timing and the
  // contract's dates. The highest + $1 is the line, and the contract's $733.08 is under it.
  const { amountFinancedCents, paymentCount } = deal.inputs.contract;
  const paymentsAtTheirApr = deal.deskTimings.map((timing) =>
    formatCents(monthlyPayment(amountFinancedCents, deal.theirAprPercent, paymentCount, timing)));
  assert.deepEqual(paymentsAtTheirApr, ['$733.08', '$734.88', '$734.88']);
  const { payment } = quoteComparisons(deal, reference);
  assert.deepEqual([payment.ran, payment.failed], [true, false]);
  assert.ok(payment.text.includes('$735.88'), payment.text);
  // The 60 payments of $733.08 come to the $43,984.80 total of payments: |$43,984.80 − $733.08 × 60| = $0.00.
  assertMathShows(cardWithKey(cards, 'contractPayments'), [
    'Payments: 60 × $733.08 = $43,984.80',
    'Total of payments: $43,984.80',
  ]);

  assert.deepEqual(cards.map(verdictOf), [
    ['red', "$699.00/mo doesn't add up."],
    ['red', '$3,185 more is financed than your deal adds up to.'],
    ['amber', "You're not getting the 0% special or the $1,000 cash."],
    ['amber', '0.4 points over your outside rate.'],
    ['green', 'The 0% special beats the $1,000 cash by about $1,790.'],
    ['green', '$699 doc fee.'],
    ['green', 'No extras in the deal.'],
    ['green', 'The disclosure box adds up.'],
    ['green', 'Total of payments matches the schedule.'],
    ['green', "The APR matches the contract's numbers."],
    ['green', 'The contract matches their quoted rate and term.'],
  ]);
  // Example 1's sentence, without the 45-day clause, because the contract dates are entered.
  assert.equal(
    cardWithKey(cards, 'payment').sentence,
    'At 5.9% for 60 months it should be $671.65 to $673.30. Either the real rate is at least 7.44%, or at least '
      + '$1,320 extra is in the loan.',
  );
  assert.deepEqual(strip, {
    driveAway: '$39,825',
    shouldBe: 'should be $671.65',
    theirs: 'theirs $699.00',
    problems: '4 problems',
  });
});

test('Example 4: an honest 5.9% deal (§7.11)', () => {
  const { deal, cards, strip } = pageFor(exampleForm({
    theirPayment: '671.65',
    contractAmountFinanced: '34,825.14',
    contractFinanceCharge: '5,473.86',
    contractTotalOfPayments: '40,299.00',
    contractApr: '5.9',
    contractPayment: '671.65',
    contractPaymentCount: '60',
    ...CONTRACT_DATES,
  }));
  // The disclosed 5.9% is within 0.125 points of both, so there's no false alarm.
  assert.deepEqual(contractAprFigures(deal), [[{ m: 1, d: 15 }, '5.800%'], [{ m: 1, d: 0 }, '5.900%']]);
  // Comparison 2's line is the 45-day timing's $673.30 + $1.
  const { payment } = quoteComparisons(deal, reference);
  assert.deepEqual([payment.ran, payment.failed], [true, false]);
  assert.ok(payment.text.includes('$674.30'), payment.text);

  assert.deepEqual(cards.map(verdictOf), [
    ['amber', "You're not getting the 0% special or the $1,000 cash."],
    ['amber', '0.4 points over your outside rate.'],
    ['green', '$671.65/mo matches 60 months at 5.9%.'],
    ['green', 'The 0% special beats the $1,000 cash by about $1,790.'],
    ['green', '$699 doc fee.'],
    ['green', 'No extras in the deal.'],
    ['green', 'The amount financed matches your deal.'],
    ['green', 'The disclosure box adds up.'],
    ['green', 'Total of payments matches the schedule.'],
    ['green', "The APR matches the contract's numbers."],
    ['green', 'The contract matches their quoted rate and term.'],
  ]);
  assertSentenceSays(cardWithKey(cards, 'outsideRate'), 'That costs $387 over 60 months.');
  assert.deepEqual(strip, {
    driveAway: '$39,825',
    shouldBe: 'should be $671.65',
    theirs: 'theirs $671.65',
    problems: '2 problems',
  });
});

test('Example 5: taking the cash (§7.11)', () => {
  const { deal, cards, strip } = pageFor(setTakingCash(exampleForm({ theirPayment: '652.36' }), true));
  // The cash comes off the drive-away total but doesn't change the tax.
  assert.deepEqual(priceFigures(deal), {
    taxLine: '6.35% of $37,199.00 = $2,362.14',
    dmv: '$264.00 (estimated)',
    driveAway: '$38,825.14',
    amountFinanced: '$33,825.14',
  });
  assert.equal(deal.shouldBeCents, 65236);
  assert.deepEqual(deal.expected, { lowCents: 65236, highCents: 65397 });
  assertMathShows(cardWithKey(cards, 'outsideRate'), ['($652.36 − $646.10) × 60 = $375.60']);
  // AF₀ is the amount financed without the cash, so card 5's figures are Example 1's.
  assert.deepEqual(specialOrCashFigures(deal), EXAMPLE_1_SPECIAL_OR_CASH);

  // The Special rate card is left off because the cash is being taken.
  assert.deepEqual(cards.map(verdictOf), [
    ['amber', '0.4 points over your outside rate.'],
    ['green', '$652.36/mo matches 60 months at 5.9%.'],
    ['green', 'The 0% special beats the $1,000 cash by about $1,790.'],
    ['green', '$699 doc fee.'],
    ['green', 'No extras in the deal.'],
  ]);
  assertSentenceSays(cardWithKey(cards, 'outsideRate'), 'That costs $376 over 60 months.');
  assert.deepEqual(strip, {
    driveAway: '$38,825',
    shouldBe: 'should be $652.36',
    theirs: 'theirs $652.36',
    problems: '1 problem',
  });
});

test('Example 6: they quote only a payment (§7.11)', () => {
  const { deal, cards, strip } = pageFor(exampleForm({ theirApr: '' }));
  // Their rate is R, worked out from their payment.
  assertWithin(deal.theirRate.percent, 7.4405, 0.0001);
  assert.equal(deal.theirRate.entered, false);
  assert.deepEqual(keyNumbers(deal).find(({ label }) => label === 'Their rate'), {
    label: 'Their rate',
    value: 'at least 7.44%, from their payment',
  });
  // The payment at R, and what R costs against the outside rate.
  assertMathShows(cardWithKey(cards, 'outsideRate'), ['($696.84 − $665.20) × 60 = $1,898.40']);

  assert.deepEqual(cards.map(verdictOf), [
    ['amber', "You're not getting the 0% special or the $1,000 cash."],
    ['amber', 'At least 1.94 points over your outside rate.'],
    ['green', 'The 0% special beats the $1,000 cash by about $1,790.'],
    ['green', '$699 doc fee.'],
    ['green', 'No extras in the deal.'],
    ['neutral', '$699.00/mo for 60 months works out to at least 7.44%.'],
  ]);
  assertSentenceSays(cardWithKey(cards, 'outsideRate'), 'That costs at least $1,898 over 60 months.');
  assert.deepEqual(strip, {
    driveAway: '$39,825',
    shouldBe: 'should be —',
    theirs: 'theirs $699.00',
    problems: '2 problems',
  });
});

test('Example 7: paying cash (§7.11)', () => {
  const { deal, cards, strip } = pageFor(exampleForm({ downPayment: '40,000' }));
  // The down payment is at least the subtotal + $254, so the estimated DMV fees leave out the lien fee.
  assert.equal(formatCents(deal.price.subtotalCents), '$39,561.14');
  assert.deepEqual(priceFigures(deal), {
    taxLine: '6.35% of $37,199.00 = $2,362.14',
    dmv: '$254.00 (estimated)',
    driveAway: '$39,815.14',
    amountFinanced: '−$184.86',
  });
  assert.equal(deal.isCashDeal, true);

  // Paying cash takes the place of cards 1–5.
  assert.deepEqual(cards.map(verdictOf), [
    ['green', '$699 doc fee.'],
    ['green', 'No extras in the deal.'],
    ['neutral', 'Paying cash: no loan to check.'],
  ]);
  assertSentenceSays(
    cardWithKey(cards, 'payingCash'),
    'Ask whether the $1,000 cash instead of the special rate applies to a cash purchase.',
  );
  assert.deepEqual(strip, { driveAway: '$39,815', shouldBe: 'Paying cash', theirs: null, problems: 'No problems' });
});

// Example 1's form with §7.11's extended warranty (extra-1) and GAP (extra-2) added, neither of them in the deal.
function formWithExtras() {
  const withWarranty = editExtra(addExtra(exampleForm(), 'warranty', connecticut), 'extra-1', { priceText: '2,995' });
  return editExtra(addExtra(withWarranty, 'gap', connecticut), 'extra-2', { priceText: '895' });
}

test("Extras: the warranty and GAP, added to Example 1's deal but not in it (§7.11)", () => {
  const { deal, cards } = pageFor(formWithExtras());
  // The warranty is taxed and GAP isn't, as their types are by default.
  assert.deepEqual(deal.inputs.extras.map(({ name, taxed }) => [name, taxed]), [
    ['Extended warranty', true],
    ['GAP', false],
  ]);
  // Each one's cost with tax, per month and over the loan.
  assert.deepEqual(
    deal.extras.map(({ costCents, perMonthCents, overLoanCents }) =>
      [costCents, perMonthCents, overLoanCents].map((cents) => formatCents(cents))),
    [
      ['$3,185.18', '$61.43', '$3,685.80'],
      ['$895.00', '$17.26', '$1,035.60'],
    ],
  );
  assert.equal(extraLine(deal, 'extra-1'), 'Would add $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)');
  // Extras out of the deal count toward nothing (§6.4), so the cards are Example 1's.
  assert.deepEqual(cards.map(verdictOf), EXAMPLE_1_VERDICTS);
});

test("Extras: the warranty in the deal makes the amount financed Example 3's and the Extras card amber (§7.11)", () => {
  const { deal, cards } = pageFor(editExtra(formWithExtras(), 'extra-1', { inDeal: true }));
  assert.equal(formatCents(deal.price.amountFinancedCents), '$38,010.32');
  const { severity, headline, sentence } = cardWithKey(cards, 'extras');
  assert.deepEqual([severity, headline, sentence], [
    'amber',
    'Extras in the deal: $3,185.',
    '+$61.43/mo, $3,686 over 60 months. All optional.',
  ]);
});

test('an empty form shows only the start note, and the strip shows "—" (§6.1, §6.5)', () => {
  const { cards, strip } = pageFor(emptyForm());
  assert.deepEqual(cards.map(verdictOf), [['neutral', 'Enter their sale price on the Price tab to start.']]);
  assert.deepEqual(strip, { driveAway: '—', shouldBe: 'should be —', theirs: null, problems: '—' });
});

// Text that shows a value went missing on its way to the page.
const BROKEN_TEXT = /NaN|undefined|Infinity|null|\[object/;

// The text the page works out for a deal with no extras: each card's headline, sentence, context line and math, the
// summary strip, the Price tab's lines, the Loan tab's amount financed and the key numbers. The slots that stay empty
// while there's nothing to show in them (a card's context line, their payment in the strip and the checks of their
// sheet) are left out while they're null.
function shownTexts({ deal, cards, strip }) {
  const lines = priceTabLines(deal, connecticut);
  const unlessNull = (...texts) => texts.filter((text) => text !== null);
  return [
    ...cards.flatMap(({ headline, sentence, context, math }) => [headline, sentence, ...unlessNull(context), ...math]),
    strip.driveAway,
    strip.shouldBe,
    ...unlessNull(strip.theirs),
    strip.problems,
    lines.discount,
    lines.taxLine,
    lines.dmv,
    lines.driveAway,
    ...unlessNull(lines.theirTaxCheck, lines.theirDriveAwayCheck),
    amountFinancedLine(deal),
    ...keyNumbers(deal).flatMap(({ label, value }) => [label, value]),
  ];
}

// Checks that the page shows only whole text for a form: reading it, checking the deal and writing the text don't
// throw, and every text is a string with nothing missing from it. `label` names the deal in a failure.
function assertWholeText(form, label) {
  let texts;
  try {
    texts = shownTexts(pageFor(form));
  } catch (error) {
    throw new Error(`${label}: ${error.message}`, { cause: error });
  }
  for (const text of texts) {
    assert.ok(typeof text === 'string' && !BROKEN_TEXT.test(text), `${label}: ${text}`);
  }
}

// The fields the sweep clears, in every combination (Review Focus 2).
const SWEPT_FIELDS = [
  'salePrice',
  'docFee',
  'downPayment',
  'theirApr',
  'months',
  'theirPayment',
  'specialApr',
  'specialCoversMonths',
  'cashInstead',
  'outsideApr',
  'contractAmountFinanced',
  'contractPayment',
];

test('every mix of blank fields shows only whole text, and nothing throws (Review Focus 2)', () => {
  // Example 3 is Example 1's deal with a contract, so clearing its fields reaches the contract cards too.
  const example3 = exampleForm(EXAMPLE_3_CONTRACT_TEXT);
  for (let blanks = 0; blanks < 2 ** SWEPT_FIELDS.length; blanks += 1) {
    const cleared = SWEPT_FIELDS.filter((_, index) => (blanks & (1 << index)) !== 0);
    const form = typed(Object.fromEntries(cleared.map((name) => [name, ''])), example3);
    assertWholeText(form, `${cleared.join(', ') || 'no fields'} blank`);
  }
});

// Example 1's deal pushed to extreme but valid values (Review Focus 3), as the fields typed over it.
const EXTREME_FIELDS = {
  'a 1-month loan': { months: '1' },
  // With title + registration entered as CT's $264, the drive-away total stays $39,825.14 whatever the down payment.
  // The DMV estimate would drop to $254 at this down payment and make it a cash deal (§7.2).
  'a down payment leaving $0.01 financed': { titleRegistration: '264', downPayment: '39,825.13' },
  'a $500,000 sale': { salePrice: '500,000' },
  'a 30% APR': { theirApr: '30' },
  'their payment of $6,990, ten times too high': { theirPayment: '6,990' },
  "Example 3's contract with 96 payments": { ...EXAMPLE_3_CONTRACT_TEXT, contractPaymentCount: '96' },
};

for (const [name, fields] of Object.entries(EXTREME_FIELDS)) {
  test(`${name} shows only whole text, and nothing throws (Review Focus 3)`, () => {
    assertWholeText(exampleForm(fields), name);
  });
}

test('the extreme down payment leaves exactly $0.01 financed', () => {
  const { deal } = pageFor(exampleForm(EXTREME_FIELDS['a down payment leaving $0.01 financed']));
  assert.equal(deal.price.amountFinancedCents, 1);
});
