// ABOUTME: Checks Verdict cards 1–12 and the Paying cash note against SPEC.md §6.5, §7.5, §7.8 and §7.9.
// ABOUTME: Deals start from SPEC.md §7.11's Example 1, and each test changes only the inputs it names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deskCards, hiddenAmountCents, rateCostCents, specialVsCash } from '../../site/lib/desk-checks.js';
import { connecticut } from '../../site/rules/connecticut.js';
import { reference } from '../../site/rules/reference.js';
import { assertWithin } from '../assertions.js';
import { verdictOf } from '../cards.js';
import { dealWith, extra } from '../fixtures.js';

// The desk cards for Example 1's deal with `overrides` applied.
function cardsFor(overrides = {}) {
  return deskCards(dealWith(overrides), connecticut, reference);
}

// The card with `key` for Example 1's deal with `overrides` applied, or undefined when it's left off.
function cardFor(key, overrides = {}) {
  return cardsFor(overrides).find((card) => card.key === key);
}

// Example 1's deal at 0% for 36 months, with their payment as given.
function zeroPercentFor36(theirPaymentCents) {
  return { theirAprMilli: 0, months: 36, theirPaymentCents };
}

// The extended warranty from §7.11's Extras table, in the deal.
const WARRANTY_IN_DEAL = extra('extra-1', 'warranty', 299500, { inDeal: true });

test("Example 1's desk cards are its payment, rate, special-or-cash, doc fee and extras cards (§7.11)", () => {
  assert.deepEqual(cardsFor().map((card) => [card.key, card.number, ...verdictOf(card)]), [
    ['payment', 1, 'red', "$699.00/mo doesn't add up."],
    ['specialRate', 3, 'amber', "You're not getting the 0% special or the $1,000 cash."],
    ['outsideRate', 4, 'amber', '0.4 points over your outside rate.'],
    ['specialOrCash', 5, 'green', 'The 0% special beats the $1,000 cash by about $1,790.'],
    ['docFee', 10, 'green', '$699 doc fee.'],
    ['extras', 12, 'green', 'No extras in the deal.'],
  ]);
});

test('a deal with every desk input entered shows cards 1–12 in number order', () => {
  const cards = cardsFor({
    stickerCents: 3800000,
    targetCents: 3600000,
    titleRegistrationCents: 30000,
    theirTaxCents: 240000,
    theirDriveAwayCents: 4400000,
    extras: [WARRANTY_IN_DEAL],
    contract: { aprMilli: 15500 },
  });
  assert.deepEqual(cards.map((card) => [card.key, card.number]), [
    ['payment', 1],
    ['rateCap', 2],
    ['specialRate', 3],
    ['outsideRate', 4],
    ['specialOrCash', 5],
    ['target', 6],
    ['sticker', 7],
    ['tax', 8],
    ['driveAway', 9],
    ['docFee', 10],
    ['dmvFees', 11],
    ['extras', 12],
  ]);
});

test('every card has a severity, a headline, a sentence, a context line or null, and its math', () => {
  const deals = [
    {},
    { theirAprMilli: null },
    { downCents: 4000000, titleRegistrationCents: 26400 },
    { months: null, outsideAprMilli: null, docFeeCents: null },
    { takingCash: true, cashInsteadCents: null, stickerCents: 3650000, targetCents: 3700000 },
    { downCents: 3882014, theirTaxCents: 230000, theirDriveAwayCents: 3970000 },
  ];
  for (const overrides of deals) {
    for (const card of cardsFor(overrides)) {
      assert.ok(['red', 'amber', 'green', 'neutral'].includes(card.severity), card.key);
      assert.equal(typeof card.headline, 'string', card.key);
      assert.equal(typeof card.sentence, 'string', card.key);
      assert.ok(card.context === null || typeof card.context === 'string', card.key);
      assert.ok(card.math.length > 0 && card.math.every((line) => typeof line === 'string'), card.key);
    }
  }
});

test('there are no desk cards until their sale price is entered', () => {
  assert.deepEqual(cardsFor({ saleCents: null }), []);
});

test("hiddenAmountCents is E, the smaller of Example 1's $1,418.13 and $1,329.25 (§7.5)", () => {
  assertWithin(hiddenAmountCents(dealWith()), 132925, 1);
  assert.equal(hiddenAmountCents(dealWith({ theirAprMilli: null })), null);
});

test("rateCostCents is the regular-timing payment gap times the months: Example 1 against 5.5% is $387 (§7.8)", () => {
  assert.equal(rateCostCents(dealWith(), 5.5), 38700);
  assert.equal(rateCostCents(dealWith({ theirAprMilli: null, theirPaymentCents: null }), 5.5), null);
});

test("specialVsCash compares Example 1's 0% special with the $1,000 cash in today's dollars (§7.9)", () => {
  const comparison = specialVsCash(dealWith(), connecticut);
  assert.equal(comparison.nA, 36);
  assert.equal(comparison.paymentACents, 96737);
  assert.equal(comparison.af0Cents, 3482514);
  assert.equal(comparison.afBCents, 3382514);
  assert.equal(comparison.paymentBCents, 64610);
  assertWithin(comparison.costACents, 3203647, 1);
  assert.equal(comparison.costBCents, 3382514);
  assert.equal(comparison.winner, 'special');
  assertWithin(comparison.differenceCents, 178867, 1);
  assertWithin(comparison.breakEven.percent, 1.9005, 0.0001);
  assert.equal(comparison.cashCoversRest, false);
});

test('specialVsCash: taking the cash can also drop the lien fee near the cash-deal line (§7.9)', () => {
  const comparison = specialVsCash(dealWith({ downCents: 3882014 }), connecticut);
  assert.equal(comparison.af0Cents, 100500);
  assert.equal(comparison.afBCents, -500);
  assert.equal(comparison.cashCoversRest, true);
  assert.equal(comparison.winner, 'cash');
});

test('specialVsCash has no break-even when one option wins at every outside rate (§7.9)', () => {
  // A $0 cash offer on $34,825.00 financed: 36 × $967.36 is $34,824.96, no more than the cash loan's amount.
  const noCash = specialVsCash(dealWith({ downCents: 500014, cashInsteadCents: 0 }), connecticut);
  assert.equal(noCash.af0Cents, 3482500);
  assert.equal(noCash.paymentACents, 96736);
  assert.deepEqual(noCash.breakEven, { none: 'cash' });
  assert.equal(noCash.winner, 'special');
  // $25,000 cash leaves $9,825.14, which the special's payments are worth more than even at 100%.
  const bigCash = specialVsCash(dealWith({ cashInsteadCents: 2500000 }), connecticut);
  assert.deepEqual(bigCash.breakEven, { none: 'special' });
  assert.equal(bigCash.winner, 'cash');
});

test("card 1: Example 1's payment is too high, with the smallest rate and hidden amount behind it (§7.11)", () => {
  assert.equal(
    cardFor('payment').sentence,
    'At 5.9% for 60 months it should be $671.65 to $673.30. Either the real rate is at least 7.44%, or at least '
      + '$1,320 extra is in the loan, or the first payment is more than 45 days away (enter both dates under At '
      + 'signing to check).',
  );
});

test("card 1's math shows the payment with each timing, and R and E with each timing to the cent (§13)", () => {
  const math = cardFor('payment').math.join('\n');
  const payments = ['$34,825.14', '$671.65', '$673.30', '$670.65 to $674.30'];
  for (const figure of [...payments, '7.571%', '7.440%', '$1,418.13', '$1,329.25']) {
    assert.ok(math.includes(figure), `math should include ${figure}:\n${math}`);
  }
});

test('card 1: a quote at another down payment is a note, with the payment at the one entered now (§6.3)', () => {
  const outOfDate = cardFor('payment', { downCents: 600000 });
  assert.deepEqual(verdictOf(outOfDate), ['neutral', 'Their payment was quoted at $5,000 down.']);
  assert.equal(
    outOfDate.sentence,
    'At $6,000 down it should be $652.36. Ask for a new quote, or set the down payment back.',
  );
  const withoutApr = cardFor('payment', { downCents: 600000, theirAprMilli: null });
  assert.deepEqual(verdictOf(withoutApr), ['neutral', 'Their payment was quoted at $5,000 down.']);
  assert.equal(withoutApr.sentence, 'Ask for a new quote at $6,000 down.');
});

test("card 1: at 0% for 36 months, $965.00 can't pay off the loan and $967.36 matches (§13)", () => {
  assert.deepEqual(verdictOf(cardFor('payment', zeroPercentFor36(96500))), [
    'red',
    "$965.00/mo for 36 months can't pay off $34,825.",
  ]);
  assert.deepEqual(verdictOf(cardFor('payment', zeroPercentFor36(96736))), [
    'green',
    '$967.36/mo matches 36 months at 0%.',
  ]);
});

test("card 1: without their APR, L is the 0% payment, so a payment too small even at 0% is red", () => {
  assert.deepEqual(verdictOf(cardFor('payment', { ...zeroPercentFor36(96500), theirAprMilli: null })), [
    'red',
    "$965.00/mo for 36 months can't pay off $34,825.",
  ]);
  // $966.37 is exactly $1 under the $967.37 0% payment, so it still works out to 0%, and one cent less is red (§7.5).
  assert.deepEqual(verdictOf(cardFor('payment', { ...zeroPercentFor36(96637), theirAprMilli: null })), [
    'neutral',
    '$966.37/mo for 36 months works out to 0%.',
  ]);
  assert.deepEqual(verdictOf(cardFor('payment', { ...zeroPercentFor36(96636), theirAprMilli: null })), [
    'red',
    "$966.36/mo for 36 months can't pay off $34,825.",
  ]);
});

test("a payment-only quote that can't pay off the loan even at 0% leaves their rate unknown (§7.5, §13)", () => {
  const tooSmall = { theirAprMilli: null, theirPaymentCents: 56000 };
  const payment = cardFor('payment', tooSmall);
  assert.deepEqual(verdictOf(payment), ['red', "$560.00/mo for 60 months can't pay off $34,825."]);
  // There's no rate it works out to, so the math doesn't give one.
  const math = payment.math.join('\n');
  assert.ok(
    payment.math.includes(
      "Their payment is more than $1 under the 0% payment, so it can't pay off the amount financed at any rate.",
    ),
    math,
  );
  assert.ok(!math.includes('works out to'), math);
  assert.deepEqual(verdictOf(cardFor('specialRate', tooSmall)), [
    'amber',
    "You're not getting the 0% special or the $1,000 cash.",
  ]);
  assert.deepEqual(verdictOf(cardFor('outsideRate', tooSmall)), [
    'neutral',
    'Enter their rate to compare their loan with your own financing.',
  ]);
});

test('card 1: a 1-month loan says 1 month', () => {
  assert.deepEqual(verdictOf(cardFor('payment', { months: 1, theirPaymentCents: 3000000 })), [
    'red',
    "$30,000.00/mo for 1 month can't pay off $34,825.",
  ]);
});

test('card 1: a payment below the expected range that still pays off the loan is amber', () => {
  const card = cardFor('payment', { theirPaymentCents: 65000 });
  assert.deepEqual(verdictOf(card), ['amber', '$650.00/mo is less than this deal should cost.']);
  assert.equal(
    card.sentence,
    'At 5.9% for 60 months it should be $671.65 to $673.30. Check the months, the amount financed, and whether a '
      + 'rebate or the cash was applied.',
  );
});

test('card 1: without their APR, the headline gives the rate worked out from their payment (§7.5)', () => {
  const card = cardFor('payment', { theirAprMilli: null });
  assert.deepEqual(verdictOf(card), ['neutral', '$699.00/mo for 60 months works out to at least 7.44%.']);
  assert.equal(card.sentence, "Ask what rate they're using. The rate checks use this rate until you enter theirs.");
  assert.equal(
    cardFor('payment', { ...zeroPercentFor36(96737), theirAprMilli: null }).headline,
    '$967.37/mo for 36 months works out to 0%.',
  );
  assert.equal(
    cardFor('payment', { theirAprMilli: null, theirPaymentCents: 699000 }).headline,
    '$6,990.00/mo for 60 months works out to over 100%.',
  );
});

test("card 1: at 0% the first payment's timing doesn't change the payment, so there's no 45-day reason", () => {
  const card = cardFor('payment', zeroPercentFor36(99000));
  assert.deepEqual(verdictOf(card), ['red', "$990.00/mo doesn't add up."]);
  assert.equal(
    card.sentence,
    'At 0% for 36 months it should be $967.37. Either the real rate is at least 1.46%, or at least $810 extra is in '
      + 'the loan.',
  );
});

test('card 1: with the contract dates entered, there is no 45-day reason (Example 3)', () => {
  assert.equal(
    cardFor('payment', { contract: { timing: { m: 1, d: 15 } } }).sentence,
    'At 5.9% for 60 months it should be $671.65 to $673.30. Either the real rate is at least 7.44%, or at least '
      + '$1,320 extra is in the loan.',
  );
});

test("card 1: a payment worth more than the loan even at 100% says the real rate is over 100%", () => {
  const card = cardFor('payment', { theirPaymentCents: 699000 });
  assert.deepEqual(verdictOf(card), ['red', "$6,990.00/mo doesn't add up."]);
  const reasons = 'Either the real rate is over 100%, or at least $326,710 extra is in the loan';
  assert.ok(card.sentence.includes(reasons), card.sentence);
});

test('card 1: with a hidden amount that shows as $0 and no 45-day reason, the real rate is the only reason', () => {
  // At 30% for 1 month, $1.01 over the 45-day payment is worth $0.98 more than the loan with that timing.
  const card = cardFor('payment', {
    months: 1,
    theirAprMilli: 30000,
    theirPaymentCents: 3614298,
    contract: { timing: { m: 1, d: 0 } },
  });
  assert.equal(
    card.sentence,
    'At 30% for 1 month it should be $35,695.77 to $36,141.97. The real rate is at least 30.02%.',
  );
});

test("card 1: with the doc fee blank, the sentence starts by saying so", () => {
  const card = cardFor('payment', { docFeeCents: null });
  assert.equal(card.severity, 'red');
  const start = "The doc fee isn't entered yet. At 5.9% for 60 months it should be ";
  assert.ok(card.sentence.startsWith(start), card.sentence);
});

test('card 1: a hidden amount under $10 is rounded down to the dollar (§13)', () => {
  const card = cardFor('payment', { months: 6, theirPaymentCents: 592049 });
  assert.deepEqual(verdictOf(card), ['red', "$5,920.49/mo doesn't add up."]);
  assert.ok(card.sentence.startsWith('At 5.9% for 6 months it should be $5,904.48 to $5,918.99.'), card.sentence);
  assert.ok(card.sentence.includes('at least $8 extra'), card.sentence);
});

test("card 1: the contract's dates join the desk timings, so a 45-day quote still matches (§13)", () => {
  const card = cardFor('payment', { theirPaymentCents: 67330, contract: { timing: { m: 1, d: 0 } } });
  assert.deepEqual(verdictOf(card), ['green', '$673.30/mo matches 60 months at 5.9%.']);
});

test('card 1 needs months, and is left off until their payment is entered', () => {
  const card = cardFor('payment', { months: null });
  assert.deepEqual(verdictOf(card), ['neutral', 'Enter months to check their payment.']);
  assert.equal(cardFor('payment', { theirPaymentCents: null }), undefined);
});

test("card 2: a rate over 15% is red, and 15% itself isn't over the cap", () => {
  const capHeadline = "Over Connecticut's 15% legal cap for new-car loans.";
  assert.deepEqual(verdictOf(cardFor('rateCap', { theirAprMilli: 15500 })), ['red', capHeadline]);
  assert.equal(cardFor('rateCap', { theirAprMilli: 15000 }), undefined);
  assert.equal(cardFor('rateCap'), undefined);
});

test("card 2: the contract's APR, or a rate worked out from their payment, can be over the cap too", () => {
  const contractOver = cardFor('rateCap', { contract: { aprMilli: 15500 } });
  assert.equal(contractOver.severity, 'red');
  assert.ok(contractOver.sentence.includes('15.5%'), contractOver.sentence);
  const workedOut = cardFor('rateCap', { theirAprMilli: null, theirPaymentCents: 85000 });
  assert.equal(workedOut.severity, 'red');
  assert.ok(workedOut.sentence.includes('at least 15.86%'), workedOut.sentence);
});

test('card 3: with Taking the cash instead on and the cash blank, it asks for the cash, even with no special', () => {
  const askForCash = ['neutral', 'Enter the cash offered instead of the special rate.'];
  assert.deepEqual(verdictOf(cardFor('specialRate', { takingCash: true, cashInsteadCents: null })), askForCash);
  const noSpecial = { takingCash: true, cashInsteadCents: null, specialAprMilli: null };
  assert.deepEqual(verdictOf(cardFor('specialRate', noSpecial)), askForCash);
});

test('card 3: their rate at or under the special is green, even on a loan longer than it covers (§13)', () => {
  assert.deepEqual(verdictOf(cardFor('specialRate', { theirAprMilli: 0, months: 60 })), [
    'green',
    "On the automaker's 0% special.",
  ]);
  assert.equal(cardFor('specialRate', { theirAprMilli: 125, months: 36 }).severity, 'green');
});

test('card 3: a rate above the special but within 0.125 points of it says so (§13)', () => {
  const verdictAt = (theirAprMilli) => verdictOf(cardFor('specialRate', { theirAprMilli, months: 36 }));
  assert.deepEqual(verdictAt(0), ['green', "On the automaker's 0% special."]);
  assert.deepEqual(verdictAt(125), ['green', 'Within 0.125 points of the 0% special.']);
  assert.deepEqual(verdictAt(126), ['red', "Should be the automaker's 0% special."]);
});

test('card 3: a rate above the special on a loan it covers is red, with what it costs and the cash', () => {
  const card = cardFor('specialRate', { months: 36 });
  assert.deepEqual(verdictOf(card), ['red', "Should be the automaker's 0% special."]);
  assert.equal(card.sentence, 'Their 5.9% costs you $3,258 more over 36 months. Or ask for the $1,000 cash instead.');
  assert.equal(
    cardFor('specialRate', { months: 36, cashInsteadCents: null }).sentence,
    'Their 5.9% costs you $3,258 more over 36 months.',
  );
});

test('card 3: with a rate worked out from their payment, the red sentence says at least', () => {
  const card = cardFor('specialRate', { theirAprMilli: null, months: 36, theirPaymentCents: 100000 });
  assert.deepEqual(verdictOf(card), ['red', "Should be the automaker's 0% special."]);
  assert.equal(
    card.sentence,
    'Their rate of at least 2.1% costs you at least $1,143 more over 36 months. Or ask for the $1,000 cash instead.',
  );
});

test("card 3: on a loan longer than the special covers, it's amber with the cash entered and a note without it", () => {
  const amber = cardFor('specialRate');
  assert.equal(amber.severity, 'amber');
  for (const fact of ['36 months', '60-month loan', '$1,000 cash', 'Taking the cash instead']) {
    assert.ok(amber.sentence.includes(fact), amber.sentence);
  }
  const note = cardFor('specialRate', { cashInsteadCents: null });
  assert.deepEqual(verdictOf(note), ['neutral', 'The 0% special covers loans up to 36 months.']);
  assert.ok(note.sentence.includes("60-month loan is on the lender's standard rate."), note.sentence);
});

test("card 3: with their rate unknown on a loan the special covers, it asks for their rate", () => {
  const card = cardFor('specialRate', { theirAprMilli: null, theirPaymentCents: null, months: 36 });
  assert.deepEqual(verdictOf(card), ['neutral', 'Enter their rate to check it against the 0% special.']);
});

test('card 3: while a payment-only quote is out of date, it asks for a quote at the down payment entered (§13)', () => {
  const card = cardFor('specialRate', { theirAprMilli: null, months: 36, theirPaymentCents: 96737, downCents: 550000 });
  assert.deepEqual(verdictOf(card), [
    'neutral',
    'Ask for a new quote at $5,500 down to check their rate against the 0% special.',
  ]);
});

test('card 3 needs months and "covers loans up to"', () => {
  assert.equal(
    cardFor('specialRate', { months: null }).headline,
    'Enter months to check their rate against the 0% special.',
  );
  assert.equal(
    cardFor('specialRate', { specialCoversMonths: null }).headline,
    'Enter "covers loans up to" to check their rate against the 0% special.',
  );
  assert.deepEqual(verdictOf(cardFor('specialRate', { months: null, specialCoversMonths: null })), [
    'neutral',
    'Enter months and "covers loans up to" to check their rate against the 0% special.',
  ]);
});

test('card 3 is left off without the special rate, and while the cash is being taken', () => {
  assert.equal(cardFor('specialRate', { specialAprMilli: null }), undefined);
  assert.equal(cardFor('specialRate', { takingCash: true }), undefined);
});

test('card 4: their rate over your outside rate is amber, with what it costs and the Experian line', () => {
  const entered = cardFor('outsideRate');
  assert.deepEqual(verdictOf(entered), ['amber', '0.4 points over your outside rate.']);
  assert.equal(entered.sentence, 'That costs $387 over 60 months. Ask them to match 5.5%, or use your own financing.');
  assert.equal(entered.context, reference.experian.text);
  const onePoint = cardFor('outsideRate', { theirAprMilli: 6500 });
  assert.equal(onePoint.headline, '1 point over your outside rate.');
  assert.ok(onePoint.sentence.startsWith('That costs $971 over 60 months.'), onePoint.sentence);
});

test('card 4: with a rate worked out from their payment, the gap and the cost are at least (Example 6)', () => {
  const card = cardFor('outsideRate', { theirAprMilli: null });
  assert.deepEqual(verdictOf(card), ['amber', 'At least 1.94 points over your outside rate.']);
  assert.ok(card.sentence.startsWith('That costs at least $1,898 over 60 months.'), card.sentence);
});

test('card 4: up to 0.125 points over your outside rate is green, and a rate over it says it is within (§13)', () => {
  const atOrUnder = ['green', 'At or under your 5.5% outside rate.'];
  assert.deepEqual(verdictOf(cardFor('outsideRate', { theirAprMilli: 5500 })), atOrUnder);
  assert.deepEqual(verdictOf(cardFor('outsideRate', { theirAprMilli: 5400 })), atOrUnder);
  const within = cardFor('outsideRate', { theirAprMilli: 5625 });
  assert.deepEqual(verdictOf(within), ['green', 'Within 0.125 points of your 5.5% outside rate.']);
  assert.equal(within.context, null);
  assert.equal(cardFor('outsideRate', { theirAprMilli: 5626 }).severity, 'amber');
});

test("cards 3 and 4 give Reg Z's 0.125-point tolerance in full in their math", () => {
  for (const card of [cardFor('specialRate', { months: 36 }), cardFor('outsideRate')]) {
    const math = card.math.join('\n');
    assert.ok(math.includes('0.125 points'), math);
  }
});

test("cards 2–4 and 12 give a payment-only quote's rate in their math as 0.000% when it rounds down to 0", () => {
  // SPEC §13: $967.37 × 36 on $34,825.14 works out to 0.000326%. A rate that shows as 0 reads without "at least"
  // (§7.5), and "Show the math" shows rates to 3 decimals (§7.0).
  const rateLine = (key, overrides) =>
    cardFor(key, { theirAprMilli: null, months: 36, ...overrides }).math.find((line) => line.startsWith('Their rate:'));
  const zero = 'Their rate: 0.000%, worked out from their payment';
  assert.equal(rateLine('rateCap', { theirPaymentCents: 96737, contract: { aprMilli: 15500 } }), zero);
  assert.equal(rateLine('specialRate', { theirPaymentCents: 96737 }), zero);
  assert.equal(rateLine('outsideRate', { theirPaymentCents: 96737, specialAprMilli: null }), zero);
  // With the warranty in the deal, 36 × $1,055.00 is less than the $38,010.32 financed, and $1,055.00 is within $1 of
  // its $1,055.84 0% payment, so the rate is 0%.
  assert.equal(rateLine('extras', { theirPaymentCents: 105500, extras: [WARRANTY_IN_DEAL] }), zero);
  // $967.45 × 36 works out to 0.0055%, which shows as 0 to 2 decimals but not to 3.
  assert.equal(
    rateLine('specialRate', { theirPaymentCents: 96745 }),
    'Their rate: at least 0.005%, worked out from their payment',
  );
});

test('card 4 needs your outside rate, and its note adds the Experian line', () => {
  const card = cardFor('outsideRate', { outsideAprMilli: null });
  assert.deepEqual(verdictOf(card), [
    'neutral',
    'Enter your outside rate to compare their loan with your own financing.',
  ]);
  assert.equal(card.context, reference.experian.text);
  assert.equal(
    cardFor('outsideRate', { theirAprMilli: null, theirPaymentCents: null, outsideAprMilli: null }).headline,
    'Enter their rate and your outside rate to compare their loan with your own financing.',
  );
});

test('card 4: while a payment-only quote is out of date, the note asks for a quote after other inputs (§13)', () => {
  const outOfDate = { theirAprMilli: null, downCents: 550000 };
  const card = cardFor('outsideRate', outOfDate);
  assert.deepEqual(verdictOf(card), [
    'neutral',
    'Ask for a new quote at $5,500 down to compare their loan with your own financing.',
  ]);
  assert.equal(card.context, reference.experian.text);
  assert.equal(
    cardFor('outsideRate', { ...outOfDate, outsideAprMilli: null }).headline,
    'Enter your outside rate and ask for a new quote at $5,500 down to compare their loan with your own financing.',
  );
  // With the special rate entered, card 4 is left off until card 3 has the months, so the special is blank here.
  assert.equal(
    cardFor('outsideRate', { ...outOfDate, outsideAprMilli: null, months: null, specialAprMilli: null }).headline,
    'Enter your outside rate and months and ask for a new quote at $5,500 down to compare their loan with your own '
      + 'financing.',
  );
});

test('card 4 is left off when the special rate applies, and while card 3 asks for "covers loans up to"', () => {
  assert.equal(cardFor('outsideRate', { months: 36 }), undefined);
  assert.equal(cardFor('outsideRate', { specialCoversMonths: null }), undefined);
  assert.equal(cardFor('outsideRate', { months: 36, takingCash: true }).severity, 'amber');
});

test("card 5: Example 1's special wins, in today's dollars, with the break-even rate and a price warning", () => {
  const card = cardFor('specialOrCash');
  assert.equal(
    card.sentence,
    "In today's dollars at your 5.5% outside rate: $967.37/mo for 36 months, against $646.10/mo for 60 months with "
      + 'the cash. Cash only wins if you can borrow below 1.9%.',
  );
  assert.equal(card.context, "Make sure the price doesn't change when you switch between the rate and the cash.");
});

test('card 5: $3,000 cash beats the 0% special, and the special wins only above 5.94%', () => {
  const card = cardFor('specialOrCash', { cashInsteadCents: 300000 });
  assert.deepEqual(verdictOf(card), ['green', 'The $3,000 cash beats the 0% special by about $210.']);
  assert.ok(card.sentence.endsWith('The special only wins if your outside rate is above 5.94%.'), card.sentence);
});

test("card 5: with no break-even, it says the winner wins at any outside rate", () => {
  const bigCash = cardFor('specialOrCash', { cashInsteadCents: 2500000 });
  assert.ok(bigCash.headline.startsWith('The $25,000 cash beats the 0% special'), bigCash.headline);
  assert.ok(bigCash.sentence.endsWith("The special doesn't win at any outside rate."), bigCash.sentence);
  const noCash = cardFor('specialOrCash', { downCents: 500014, cashInsteadCents: 0 });
  assert.ok(noCash.headline.startsWith('The 0% special beats the $0 cash'), noCash.headline);
  assert.ok(noCash.sentence.endsWith("Cash doesn't win at any outside rate."), noCash.sentence);
});

test('card 5: near the lien-fee line the cash covers the rest of the loan (§7.9)', () => {
  const card = cardFor('specialOrCash', { downCents: 3882014 });
  assert.deepEqual(verdictOf(card), ['neutral', 'The $1,000 cash covers the rest of the loan.']);
  assert.equal(card.sentence, 'Take the cash.');
});

test('card 5 needs months, and shows once the special, its term, the cash and your outside rate are entered', () => {
  assert.deepEqual(verdictOf(cardFor('specialOrCash', { months: null })), [
    'neutral',
    'Enter months to compare the special rate with the cash.',
  ]);
  for (const blank of ['specialAprMilli', 'specialCoversMonths', 'cashInsteadCents', 'outsideAprMilli']) {
    assert.equal(cardFor('specialOrCash', { [blank]: null }), undefined, blank);
  }
});

test('card 6: their sale price against your target, within $1 counting as at your target', () => {
  assert.deepEqual(verdictOf(cardFor('target', { targetCents: 3600000 })), ['amber', '$500 above your target.']);
  assert.deepEqual(verdictOf(cardFor('target', { targetCents: 3650050 })), ['green', 'At your target.']);
  assert.deepEqual(verdictOf(cardFor('target', { targetCents: 3700000 })), ['green', '$500 under your target.']);
  assert.equal(cardFor('target'), undefined);
});

test('card 7: their sale price against the sticker, with the KBB line on the green outcomes', () => {
  const under = cardFor('sticker', { stickerCents: 3800000 });
  assert.deepEqual(verdictOf(under), ['green', '$1,500 (3.9%) under sticker.']);
  assert.equal(under.context, reference.kbb.text);
  // The math shows how the headline's percent is worked out.
  assert.equal(under.math.at(-1), 'Under sticker: $1,500.00 ÷ $38,000.00 = 3.9%');
  const at = cardFor('sticker', { stickerCents: 3650000 });
  assert.deepEqual(verdictOf(at), ['green', 'At sticker.']);
  assert.equal(at.context, reference.kbb.text);
  const above = cardFor('sticker', { stickerCents: 3600000 });
  assert.deepEqual(verdictOf(above), ['amber', '$500 above sticker.']);
  assert.equal(above.sentence, "Ask what it's for: a market adjustment or added options.");
  assert.equal(above.context, null);
  assert.equal(cardFor('sticker'), undefined);
});

test("card 8: their tax against CT's, with the tax line and the likely reasons", () => {
  const right = cardFor('tax', { theirTaxCents: 236214 });
  assert.deepEqual(verdictOf(right), ['green', 'CT tax is right.']);
  assert.equal(right.sentence, '6.35% of $37,199.00 = $2,362.14.');
  const more = cardFor('tax', { theirTaxCents: 240000 });
  assert.deepEqual(verdictOf(more), ['amber', "Their tax is $38 more than CT's."]);
  assert.equal(more.sentence, "6.35% of $37,199.00 = $2,362.14. Rebates don't lower CT tax. The doc fee is taxed.");
  assert.equal(cardFor('tax', { theirTaxCents: 230000 }).headline, "Their tax is $62 less than CT's.");
  assert.equal(cardFor('tax'), undefined);
});

test('card 8: title and registration over $265 adds the conveyance-fee reason (§7.1)', () => {
  const card = cardFor('tax', { theirTaxCents: 240000, titleRegistrationCents: 30000 });
  assert.equal(card.headline, "Their tax is $36 more than CT's.");
  assert.equal(
    card.sentence,
    "6.35% of $37,235.00 = $2,364.42. Rebates don't lower CT tax. The doc fee is taxed. This includes tax on the $36 "
      + "of title and registration charges above CT's fees, which CT counts as a conveyance fee.",
  );
  const atLimit = cardFor('tax', { theirTaxCents: 240000, titleRegistrationCents: 26500 });
  assert.ok(!atLimit.sentence.includes('conveyance fee'), atLimit.sentence);
});

test("card 9: their drive-away total against the itemized numbers", () => {
  const more = cardFor('driveAway', { theirDriveAwayCents: 3990000 });
  assert.deepEqual(verdictOf(more), ['red', '$75 more than the itemized numbers add up to.']);
  assert.equal(more.sentence, 'Ask them to itemize it.');
  const less = cardFor('driveAway', { theirDriveAwayCents: 3970000 });
  assert.deepEqual(verdictOf(less), ['amber', '$125 less than the itemized numbers.']);
  assert.equal(less.sentence, 'Something may be missing or counted differently.');
  assert.deepEqual(verdictOf(cardFor('driveAway', { theirDriveAwayCents: 3982500 })), [
    'green',
    'Their drive-away total matches.',
  ]);
  assert.equal(cardFor('driveAway'), undefined);
});

test('card 10: the doc fee against what CT Mazda dealers charge, with its cost with tax', () => {
  assert.deepEqual(verdictOf(cardFor('docFee', { docFeeCents: null })), ['neutral', 'Ask for the doc fee.']);
  assert.deepEqual(verdictOf(cardFor('docFee', { docFeeCents: 120000 })), [
    'amber',
    '$1,200 doc fee is above what CT Mazda dealers charge.',
  ]);
  assert.deepEqual(verdictOf(cardFor('docFee', { docFeeCents: 100000 })), ['green', '$1,000 doc fee.']);
  assert.equal(
    cardFor('docFee').sentence,
    "With tax it costs $743. CT Mazda dealers charge about $600–$1,000 (Oct 2026). CT doesn't cap it, and it's "
      + 'negotiable.',
  );
});

test("card 11: title and registration against CT's DMV fees, which are lower in a cash deal", () => {
  const loan = cardFor('dmvFees', { titleRegistrationCents: 30000 });
  assert.deepEqual(verdictOf(loan), ['amber', '$36 more than CT DMV charges.']);
  assert.equal(
    loan.sentence,
    "CT charges $264 when you finance. Under CT law the extra is part of the dealer's conveyance fee, so it's "
      + "negotiable, and it's taxed.",
  );
  const cash = cardFor('dmvFees', { titleRegistrationCents: 26400, downCents: 4000000 });
  assert.deepEqual(verdictOf(cash), ['amber', '$10 more than CT DMV charges.']);
  assert.ok(cash.sentence.startsWith('CT charges $254 when you pay cash.'), cash.sentence);
  assert.deepEqual(verdictOf(cardFor('dmvFees', { titleRegistrationCents: 26500 })), [
    'green',
    "Title and registration are within CT's fees.",
  ]);
  assert.equal(cardFor('dmvFees'), undefined);
});

test('card 12: extras in the deal are amber, with what they add to the payments (§7.11)', () => {
  const card = cardFor('extras', { extras: [WARRANTY_IN_DEAL] });
  assert.deepEqual(verdictOf(card), ['amber', 'Extras in the deal: $3,185.']);
  assert.equal(card.sentence, '+$61.43/mo, $3,686 over 60 months. All optional.');
  const cashDeal = cardFor('extras', { extras: [WARRANTY_IN_DEAL], downCents: 4400000 });
  assert.equal(cashDeal.sentence, "That's with tax. All optional.");
  assert.equal(cardFor('extras', { extras: [{ ...WARRANTY_IN_DEAL, inDeal: false }] }).severity, 'green');
});

test('card 12: with a rate worked out from their payment, both amounts read at least (§6.5, §7.0)', () => {
  // They're lower bounds, like the rate. $70.88 × 60 is $4,252.80, which rounds down.
  const card = cardFor('extras', { theirAprMilli: null, theirPaymentCents: 85000, extras: [WARRANTY_IN_DEAL] });
  assert.equal(card.sentence, 'At least +$70.88/mo, at least $4,252 over 60 months. All optional.');
});

test('a cash deal has the Paying cash note in place of cards 1–5 (Example 7)', () => {
  const cards = cardsFor({ downCents: 4000000 });
  assert.deepEqual(cards.map((card) => [card.key, card.number]), [
    ['payingCash', 1],
    ['docFee', 10],
    ['extras', 12],
  ]);
  const payingCash = cards[0];
  assert.deepEqual(verdictOf(payingCash), ['neutral', 'Paying cash: no loan to check.']);
  assert.ok(
    payingCash.sentence.endsWith('Ask whether the $1,000 cash instead of the special rate applies to a cash purchase.'),
    payingCash.sentence,
  );
});

test("Paying cash asks about the cash only when it's entered and not being taken", () => {
  const asks = (overrides) =>
    cardFor('payingCash', { downCents: 4000000, ...overrides }).sentence.includes('Ask whether');
  assert.equal(asks({}), true);
  assert.equal(asks({ takingCash: true }), false);
  assert.equal(asks({ cashInsteadCents: null }), false);
});
