// ABOUTME: Builds Verdict cards 1–12, which check the numbers quoted at the sales desk.
// ABOUTME: In a cash deal, a Paying cash note replaces the payment and rate cards.
import { rateFromPayment } from './deal.js';
import {
  DESK_TIMING_NAMES,
  MATCH_TOLERANCE_CENTS,
  TIMING_NAMES,
  aprTolerancePointsText,
  card,
  countOf,
  listOf,
  missingInputNote,
  percentOfStickerText,
  taxLine,
  theirRateMathText,
  theirRateText,
  workedOutRateText,
} from './display.js';
import { HIGHEST_RATE_PERCENT, REGULAR, levelPayments, monthlyPayment, presentValue, solveRate } from './loan.js';
import {
  MILLI_PER_PERCENT,
  formatAbout,
  formatCents,
  formatDollars,
  formatDollarsDown,
  formatPointsMilli,
  formatPointsPercent,
  formatRateMilli,
  formatRatePercent,
  formatTensDown,
} from './numbers.js';
import { priceOf } from './price.js';

const CENTS_PER_DOLLAR = 100;
// How the notes name the longest term the special rate covers, after its field.
const COVERS_LOANS_UP_TO = '"covers loans up to"';
// The monthly payment formula, as "Show the math" gives it (SPEC §7.4).
const PAYMENT_FORMULA = 'Payment = amount financed × i ÷ (1 − (1 + i)^−n), with i = APR ÷ 12 and n = months, for '
  + `${TIMING_NAMES.regular}. Other first-payment dates add or take off interest for the odd days `
  + '(Reg Z Appendix J).';

// Verdict cards 1–12, in number order (SPEC §6.5). A card is left off when what it checks isn't entered. In a cash deal
// there's no loan to check, so the Paying cash note takes the place of cards 1–5. There are no cards until the sale
// price is entered.
export function deskCards(deal, rules, reference) {
  if (!deal.hasSale) {
    return [];
  }
  const loanCards = deal.isCashDeal
    ? [payingCashCard(deal)]
    : [
      paymentCard(deal),
      rateCapCard(deal, rules),
      specialRateCard(deal, reference),
      outsideRateCard(deal, reference),
      specialOrCashCard(deal, rules),
    ];
  const priceCards = [
    targetCard(deal),
    stickerCard(deal, reference),
    taxCard(deal, rules),
    driveAwayCard(deal),
    docFeeCard(deal, rules),
    dmvFeesCard(deal, rules),
    extrasCard(deal),
  ];
  return [...loanCards, ...priceCards].filter((card) => card !== null);
}

// E, the amount that could be hidden in the loan (SPEC §7.5): what their payment for each of the months is worth at
// their APR, less the amount financed, in unrounded cents. It's the smallest over the desk timings, so it's never
// overstated. Null without their APR, their payment, the months or a loan.
export function hiddenAmountCents(deal) {
  const amounts = hiddenAmountsByTiming(deal);
  return amounts === null ? null : Math.min(...amounts);
}

// What their rate costs over the loan against a benchmark rate, in cents (SPEC §7.8): the payment at their rate less
// the payment at the benchmark, both with the regular timing, times the months. The benchmark is the special rate
// (card 3) or the outside rate (card 4). Null while their rate or the months are unknown, or there's no loan.
export function rateCostCents(deal, benchmarkPercent) {
  const payments = rateCostPayments(deal, benchmarkPercent);
  return payments === null ? null : (payments.theirsCents - payments.benchmarkCents) * deal.inputs.months;
}

// Compares the special rate with the cash offered instead of it, in today's dollars at the outside rate (SPEC §7.9).
// - Option A is the special rate for nA months, the smaller of the months and the longest term it covers, on AF₀, the
//   amount financed with no cash taken. It costs its payments' present value at the outside rate.
// - Option B is the cash, then the outside rate for the months on AF_B, the amount financed with the cash taken. It
//   costs AF_B. Taking the cash can also turn the deal into a cash deal, which drops the lien fee.
// Both amounts include the DMV estimate when title + registration is blank. The cheaper option wins, and a tie goes to
// the special rate. differenceCents is how much it wins by. breakEven is {percent}, the outside rate O* below which the
// cash wins, or {none: 'cash'} or {none: 'special'} when that option doesn't win at any outside rate. cashCoversRest
// says the cash pays off the loan, with AF_B at $0 or less. Needs the special rate, the longest term it covers, the
// cash instead, the outside rate, the months and a sale price.
export function specialVsCash(deal, rules) {
  const { inputs } = deal;
  const specialPercent = inputs.specialAprMilli / MILLI_PER_PERCENT;
  const outsidePercent = inputs.outsideAprMilli / MILLI_PER_PERCENT;
  const nA = Math.min(inputs.months, inputs.specialCoversMonths);
  const af0Cents = priceOf({ ...inputs, takingCash: false }, rules).amountFinancedCents;
  const afBCents = priceOf({ ...inputs, takingCash: true }, rules).amountFinancedCents;
  const paymentACents = monthlyPayment(af0Cents, specialPercent, nA, REGULAR);
  const paymentsA = levelPayments(paymentACents, nA);
  const costACents = presentValue(paymentsA, outsidePercent, REGULAR);
  const costBCents = afBCents;
  return {
    nA,
    paymentACents,
    af0Cents,
    afBCents,
    paymentBCents: monthlyPayment(afBCents, outsidePercent, inputs.months, REGULAR),
    costACents,
    costBCents,
    winner: costACents <= costBCents ? 'special' : 'cash',
    differenceCents: Math.abs(costACents - costBCents),
    breakEven: breakEvenOutsideRate(paymentsA, afBCents),
    cashCoversRest: afBCents <= 0,
  };
}

// O*, the outside rate at which the special rate's payments are worth AF_B, the amount financed with the cash taken
// (SPEC §7.9), as {percent}. When the payments add up to no more than AF_B, the cash doesn't win at any outside rate:
// {none: 'cash'}. When they're worth at least AF_B even at 100%, the special doesn't win at any: {none: 'special'}.
function breakEvenOutsideRate(paymentsA, afBCents) {
  if (presentValue(paymentsA, 0, REGULAR) <= afBCents) {
    return { none: 'cash' };
  }
  if (presentValue(paymentsA, HIGHEST_RATE_PERCENT, REGULAR) >= afBCents) {
    return { none: 'special' };
  }
  return { percent: solveRate(paymentsA, afBCents, REGULAR).percent };
}

// Whether there's a loan: a sale price, and an amount financed above $0.
function hasLoan(deal) {
  return deal.hasSale && !deal.isCashDeal;
}

// E with each desk timing, in the Deal's order of desk timings (SPEC §7.5). Null without their APR, their payment, the
// months or a loan.
function hiddenAmountsByTiming(deal) {
  const { theirPaymentCents, months } = deal.inputs;
  if (deal.theirAprPercent === null || theirPaymentCents === null || months === null || !hasLoan(deal)) {
    return null;
  }
  const payments = levelPayments(theirPaymentCents, months);
  return deal.deskTimings.map(
    (timing) => presentValue(payments, deal.theirAprPercent, timing) - deal.price.amountFinancedCents,
  );
}

// The payments on the amount financed for the months at their rate and at a benchmark rate, with the regular timing
// (SPEC §7.8), as {theirsCents, benchmarkCents}. Null while their rate or the months are unknown, or there's no loan.
function rateCostPayments(deal, benchmarkPercent) {
  const { months } = deal.inputs;
  if (deal.theirRate === null || months === null || !hasLoan(deal)) {
    return null;
  }
  const paymentAt = (ratePercent) => monthlyPayment(deal.price.amountFinancedCents, ratePercent, months, REGULAR);
  return { theirsCents: paymentAt(deal.theirRate.percent), benchmarkCents: paymentAt(benchmarkPercent) };
}

// What their payment for each of the months works out to on the amount financed with each desk timing (SPEC §7.5), as
// solveRate gives it, in the Deal's order of desk timings.
function ratesFromPayment(deal) {
  const payments = levelPayments(deal.inputs.theirPaymentCents, deal.inputs.months);
  return deal.deskTimings.map((timing) => solveRate(payments, deal.price.amountFinancedCents, timing));
}

// Whether their rate is more than limitMilli thousandths of a percent. Their APR, held in percent as the entered
// thousandths ÷ 1000, compares exactly; a rate worked out from their payment counts as 100% when it's over 100%.
function theirRateIsAbove(deal, limitMilli) {
  return deal.theirRate.percent > limitMilli / MILLI_PER_PERCENT;
}

// Card 1, Payment adds up (SPEC §6.5, §7.4, §7.5). Shows when their payment is entered.
function paymentCard(deal) {
  if (deal.inputs.theirPaymentCents === null) {
    return null;
  }
  return card('payment', 1, paymentOutcome(deal));
}

// Card 1's outcome: their payment against the lowest and highest payments their APR gives over the desk timings, with
// $1 either side. Without their APR, the lowest is the 0% payment. Needs the months.
function paymentOutcome(deal) {
  const { theirPaymentCents, months, theirAprMilli } = deal.inputs;
  const loanCents = deal.price.amountFinancedCents;
  const theirs = `${formatCents(theirPaymentCents)}/mo`;
  if (months === null) {
    const sentence = `The loan's length sets what ${theirs} should be.`;
    const math = [
      `Amount financed: ${formatCents(loanCents)}`,
      `Their payment: ${formatCents(theirPaymentCents)}`,
      PAYMENT_FORMULA,
    ];
    return missingInputNote('months', 'check their payment', sentence, math);
  }
  if (!deal.quoteCurrent) {
    return outOfDateQuoteOutcome(deal);
  }
  const forMonths = `for ${countOf(months, 'month')}`;
  const lowCents = theirAprMilli === null ? monthlyPayment(loanCents, 0, months) : deal.expected.lowCents;
  const math = paymentMath(deal);
  if (theirPaymentCents < lowCents - MATCH_TOLERANCE_CENTS && theirPaymentCents * months < loanCents) {
    return {
      severity: 'red',
      headline: `${theirs} ${forMonths} can't pay off ${formatDollars(loanCents)}.`,
      sentence: 'Even at 0%, their payments add up to less than the amount financed.',
      math,
    };
  }
  if (theirAprMilli === null) {
    return {
      severity: 'neutral',
      headline: `${theirs} ${forMonths} works out to ${workedOutRateText(deal.workedOutRate)}.`,
      sentence: "Ask what rate they're using. The rate checks use this rate until you enter theirs.",
      math,
    };
  }
  const shouldBe = `At ${formatRateMilli(theirAprMilli)} ${forMonths} it should be ${paymentRangeText(deal.expected)}.`;
  if (theirPaymentCents < lowCents - MATCH_TOLERANCE_CENTS) {
    return {
      severity: 'amber',
      headline: `${theirs} is less than this deal should cost.`,
      sentence: `${shouldBe} Check the months, the amount financed, and whether a rebate or the cash was applied.`,
      math,
    };
  }
  if (theirPaymentCents > deal.expected.highCents + MATCH_TOLERANCE_CENTS) {
    return {
      severity: 'red',
      headline: `${theirs} doesn't add up.`,
      sentence: tooHighSentence(deal, shouldBe),
      math: [...math, ...rateFromPaymentLines(deal), ...hiddenAmountLines(deal)],
    };
  }
  return {
    severity: 'green',
    headline: `${theirs} matches ${countOf(months, 'month')} at ${formatRateMilli(theirAprMilli)}.`,
    sentence: `${shouldBe} Theirs is within $1 of that.`,
    math,
  };
}

// Card 1 while the quote is out of date (SPEC §6.3): their payment was quoted at another down payment, so it isn't
// checked. With their APR, the sentence gives the should-be payment at the down payment now entered.
function outOfDateQuoteOutcome(deal) {
  const { downCents, quoteDownCents, theirAprMilli } = deal.inputs;
  const headline = `Their payment was quoted at ${formatDollars(quoteDownCents)} down.`;
  const down = formatDollars(downCents);
  const quoteLine = `Their payment was quoted at ${formatCents(quoteDownCents)} down. The down payment is now `
    + `${formatCents(downCents)}.`;
  if (theirAprMilli === null) {
    return { severity: 'neutral', headline, sentence: `Ask for a new quote at ${down} down.`, math: [quoteLine] };
  }
  const shouldBe = formatCents(deal.shouldBeCents);
  return {
    severity: 'neutral',
    headline,
    sentence: `At ${down} down it should be ${shouldBe}. Ask for a new quote, or set the down payment back.`,
    math: [
      quoteLine,
      `Amount financed: ${formatCents(deal.price.amountFinancedCents)}`,
      `Their APR: ${formatRateMilli(theirAprMilli, 3)} for ${countOf(deal.inputs.months, 'month')}`,
      PAYMENT_FORMULA,
      `With ${TIMING_NAMES.regular}: ${shouldBe}`,
    ],
  };
}

// Card 1's sentence when their payment is too high (SPEC §6.5): the payments their APR gives, then the smallest rate
// and hidden amount that explain theirs. The hidden amount is left out when it shows as $0 (§7.5). A first payment more
// than 45 days away could explain it too, except at 0%, where the timing doesn't change the payment, or once the
// contract's dates are entered.
function tooHighSentence(deal, shouldBe) {
  const { theirAprMilli, docFeeCents, theirPaymentCents, months } = deal.inputs;
  const realRate = workedOutRateText(
    rateFromPayment(theirPaymentCents, months, deal.price.amountFinancedCents, deal.deskTimings),
  );
  const otherReasons = [];
  const hiddenCents = hiddenAmountCents(deal);
  if (hiddenCents >= CENTS_PER_DOLLAR) {
    otherReasons.push(`at least ${formatTensDown(hiddenCents)} extra is in the loan`);
  }
  if (theirAprMilli > 0 && deal.contractTiming === null) {
    otherReasons.push('the first payment is more than 45 days away');
  }
  const reasons = otherReasons.length === 0
    ? `The real rate is ${realRate}.`
    : `Either ${[`the real rate is ${realRate}`, ...otherReasons].join(', or ')}.`;
  const docFeeBlank = docFeeCents === null ? "The doc fee isn't entered yet. " : '';
  return `${docFeeBlank}${shouldBe} ${reasons}`;
}

// The lowest and highest expected payments, "$671.65 to $673.30", or just "$967.37" when they're equal (SPEC §6.5).
function paymentRangeText({ lowCents, highCents }) {
  return lowCents === highCents ? formatCents(lowCents) : `${formatCents(lowCents)} to ${formatCents(highCents)}`;
}

// Card 1's math: the loan, and with their APR the payment it gives with each desk timing and the accepted range they
// make. Without their APR, the 0% payment and the rate their payment works out to with each timing.
function paymentMath(deal) {
  const { theirPaymentCents, months, theirAprMilli } = deal.inputs;
  const loanCents = deal.price.amountFinancedCents;
  const loanLines = [
    `Amount financed: ${formatCents(loanCents)}`,
    `Their payment: ${formatCents(theirPaymentCents)} for ${countOf(months, 'month')}`,
  ];
  if (theirAprMilli === null) {
    return [
      ...loanLines,
      'Their APR: blank',
      `At 0%: ${formatCents(loanCents)} ÷ ${months} = ${formatCents(monthlyPayment(loanCents, 0, months))}`,
      ...rateFromPaymentLines(deal),
    ];
  }
  return [
    ...loanLines,
    `Their APR: ${formatRateMilli(theirAprMilli, 3)}`,
    PAYMENT_FORMULA,
    ...expectedPaymentLines(deal),
  ];
}

// "Show the math" for the accepted range (SPEC §7.4): the payment their APR gives with each desk timing, and the range
// from the lowest less $1 to the highest plus $1.
function expectedPaymentLines(deal) {
  const { lowCents, highCents } = deal.expected;
  const paymentWith = (timing) =>
    monthlyPayment(deal.price.amountFinancedCents, deal.theirAprPercent, deal.inputs.months, timing);
  return [
    ...deal.deskTimings.map((timing, index) => `With ${DESK_TIMING_NAMES[index]}: ${formatCents(paymentWith(timing))}`),
    `Accepted: ${formatCents(lowCents - MATCH_TOLERANCE_CENTS)} to ${formatCents(highCents + MATCH_TOLERANCE_CENTS)}, `
      + 'from the lowest less $1 to the highest plus $1',
  ];
}

// "Show the math" for R (SPEC §7.5): the rate their payment works out to with each desk timing, of which the smallest
// is used.
function rateFromPaymentLines(deal) {
  return [
    ...ratesFromPayment(deal).map(
      (result, index) => `Their payment works out to ${solvedRateText(result)} with ${DESK_TIMING_NAMES[index]}`,
    ),
    "The smallest rate is used, so it's never overstated.",
  ];
}

// A rate a payment works out to, for "Show the math": to 3 decimals rounded down, since it's a lower bound (SPEC §7.0),
// or why there's none.
function solvedRateText(result) {
  if (result.tooLow) {
    return '0%, since the payments add up to less than the amount financed';
  }
  if (result.tooHigh) {
    return 'over 100%';
  }
  return formatRatePercent(result.percent, 'down', 3);
}

// "Show the math" for E (SPEC §7.5): how much more than the amount financed their payments are worth at their APR with
// each desk timing, of which the smallest is used.
function hiddenAmountLines(deal) {
  const apr = formatRateMilli(deal.inputs.theirAprMilli, 3);
  return [
    ...hiddenAmountsByTiming(deal).map((cents, index) =>
      `At ${apr}, their payments are worth ${formatCents(cents)} more than the amount financed with `
        + DESK_TIMING_NAMES[index]),
    "The smallest amount is used, so it's never overstated.",
  ];
}

// Card 2, CT rate cap (SPEC §6.5). Shows only when their rate or the contract's APR is over the cap.
function rateCapCard(deal, rules) {
  const capMilli = rules.aprCapMilli;
  const contractAprMilli = deal.inputs.contract.aprMilli;
  const overCap = [];
  if (deal.theirRate !== null && theirRateIsAbove(deal, capMilli)) {
    overCap.push(`Their rate is ${theirRateText(deal)}.`);
  }
  if (contractAprMilli !== null && contractAprMilli > capMilli) {
    overCap.push(`The contract's APR is ${formatRateMilli(contractAprMilli)}.`);
  }
  if (overCap.length === 0) {
    return null;
  }
  return card('rateCap', 2, {
    severity: 'red',
    headline: rules.text.rateCapHeadline(formatRateMilli(capMilli)),
    sentence: overCap.join(' '),
    math: [
      `Their rate: ${theirRateMathText(deal)}`,
      `The contract's APR: ${contractAprMilli === null ? 'blank' : formatRateMilli(contractAprMilli, 3)}`,
      `${rules.state}'s cap: ${formatRateMilli(capMilli, 3)}`,
    ],
  });
}

// Card 3, Special rate (SPEC §6.5, §7.6). Shows when the special rate is entered and Taking the cash instead is off.
// While Taking the cash instead is on and the cash instead is blank, it's a note asking for the cash.
function specialRateCard(deal, reference) {
  const { specialAprMilli, takingCash, cashInsteadCents } = deal.inputs;
  if (takingCash && cashInsteadCents === null) {
    return card('specialRate', 3, {
      severity: 'neutral',
      headline: 'Enter the cash offered instead of the special rate.',
      sentence: "Taking the cash instead is on, but there's no cash to take off the price yet.",
      math: ['Cash taken = the cash instead, while Taking the cash instead is on. It comes off the drive-away total.'],
    });
  }
  if (specialAprMilli === null || takingCash) {
    return null;
  }
  return card('specialRate', 3, specialRateOutcome(deal, reference));
}

// Card 3's outcome: their rate against the special rate, which counts as met within Reg Z's APR tolerance. On a loan
// longer than the special covers, it asks for the cash instead. Needs the months and the longest term it covers.
function specialRateOutcome(deal, reference) {
  const { specialAprMilli, specialCoversMonths, months, cashInsteadCents } = deal.inputs;
  const special = formatRateMilli(specialAprMilli);
  const toleranceMilli = reference.regZ.aprToleranceMilli;
  const termsLine = `The special: ${formatRateMilli(specialAprMilli, 3)} on loans up to `
    + `${specialCoversMonths === null ? 'blank' : countOf(specialCoversMonths, 'month')}`;
  const blank = blankNames([['months', months], [COVERS_LOANS_UP_TO, specialCoversMonths]]);
  if (blank.length > 0) {
    const sentence = 'The special applies only to loans up to the length it covers.';
    const math = [termsLine, `Months: ${months === null ? 'blank' : months}`];
    return missingInputNote(listOf(blank), `check their rate against the ${special} special`, sentence, math);
  }
  const math = [
    termsLine,
    `Months: ${months}`,
    `Their rate: ${theirRateMathText(deal)}`,
    `Within ${aprTolerancePointsText(reference)} of the special counts as the special (Reg Z's APR tolerance).`,
  ];
  if (deal.theirRate !== null && !theirRateIsAbove(deal, specialAprMilli + toleranceMilli)) {
    return {
      severity: 'green',
      headline: `On the automaker's ${special} special.`,
      sentence: `Their rate is ${theirRateText(deal)}.`,
      math,
    };
  }
  const cash = cashInsteadCents === null ? null : `${formatDollars(cashInsteadCents)} cash`;
  if (months > specialCoversMonths && cash !== null) {
    return {
      severity: 'amber',
      headline: `You're not getting the ${special} special or the ${cash}.`,
      sentence: `The special covers loans up to ${countOf(specialCoversMonths, 'month')}, so your ${months}-month loan `
        + `should come with the ${cash}. Ask for it, or turn on Taking the cash instead if it's already in the deal.`,
      math,
    };
  }
  if (months > specialCoversMonths) {
    return {
      severity: 'neutral',
      headline: `The ${special} special covers loans up to ${countOf(specialCoversMonths, 'month')}.`,
      sentence: `Your ${months}-month loan is on the lender's standard rate.`,
      math,
    };
  }
  if (deal.theirRate === null) {
    const sentence = `The special covers your ${months}-month loan.`;
    return missingInputNote('their rate', `check it against the ${special} special`, sentence, math);
  }
  const specialPercent = specialAprMilli / MILLI_PER_PERCENT;
  const costCents = rateCostCents(deal, specialPercent);
  const overMonths = `more over ${countOf(months, 'month')}.`;
  const cost = deal.theirRate.entered
    ? `Their ${theirRateText(deal)} costs you ${formatDollars(costCents)} ${overMonths}`
    : `Their rate of ${theirRateText(deal)} costs you at least ${formatDollarsDown(costCents)} ${overMonths}`;
  return {
    severity: 'red',
    headline: `Should be the automaker's ${special} special.`,
    sentence: cash === null ? cost : `${cost} Or ask for the ${cash} instead.`,
    math: [...math, ...rateCostLines(deal, specialPercent, 'the special')],
  };
}

// "Show the math" for the rate cost against a benchmark rate (SPEC §7.8).
function rateCostLines(deal, benchmarkPercent, benchmarkName) {
  const { theirsCents, benchmarkCents } = rateCostPayments(deal, benchmarkPercent);
  return [
    `Payment at their rate: ${formatCents(theirsCents)}. At ${benchmarkName}: ${formatCents(benchmarkCents)}. Both `
      + `with ${TIMING_NAMES.regular}.`,
    `Cost = (${formatCents(theirsCents)} − ${formatCents(benchmarkCents)}) × ${deal.inputs.months} = `
      + formatCents(rateCostCents(deal, benchmarkPercent)),
  ];
}

// Card 4, Outside rate (SPEC §6.5). Left off when the special rate applies (§7.6), and while card 3 asks for the months
// or the longest term the special covers.
function outsideRateCard(deal, reference) {
  const { specialAprMilli, specialCoversMonths, months, takingCash } = deal.inputs;
  const specialNeedsTerms = specialAprMilli !== null && !takingCash
    && (months === null || specialCoversMonths === null);
  if (deal.specialApplies || specialNeedsTerms) {
    return null;
  }
  return card('outsideRate', 4, outsideRateOutcome(deal, reference));
}

// Card 4's outcome: their rate against your outside rate, with Reg Z's APR tolerance allowed. Needs their rate, your
// outside rate and the months. The note asking for them, and the amber outcome, add the Experian line.
function outsideRateOutcome(deal, reference) {
  const { theirAprMilli, outsideAprMilli, months } = deal.inputs;
  const outsideLine = `Your outside rate: ${outsideAprMilli === null ? 'blank' : formatRateMilli(outsideAprMilli, 3)}`;
  const blank = blankNames([
    ['their rate', deal.theirRate],
    ['your outside rate', outsideAprMilli],
    ['months', months],
  ]);
  if (blank.length > 0) {
    const sentence = 'A bank or credit-union rate for the same term shows what their rate costs you.';
    const math = [
      `Their rate: ${theirRateMathText(deal)}`,
      outsideLine,
      `Months: ${months === null ? 'blank' : months}`,
    ];
    return {
      ...missingInputNote(listOf(blank), 'compare their loan with your own financing', sentence, math),
      context: reference.experian.text,
    };
  }
  const toleranceMilli = reference.regZ.aprToleranceMilli;
  const outsidePercent = outsideAprMilli / MILLI_PER_PERCENT;
  const outside = formatRateMilli(outsideAprMilli);
  const math = [
    `Their rate: ${theirRateMathText(deal)}`,
    outsideLine,
    ...rateCostLines(deal, outsidePercent, 'your outside rate'),
    `Up to ${aprTolerancePointsText(reference)} over counts as at or under (Reg Z's APR tolerance).`,
  ];
  if (!theirRateIsAbove(deal, outsideAprMilli + toleranceMilli)) {
    return {
      severity: 'green',
      headline: `At or under your ${outside} outside rate.`,
      sentence: `Their rate is ${theirRateText(deal)}.`,
      math,
    };
  }
  const costCents = rateCostCents(deal, outsidePercent);
  const askToMatch = `Ask them to match ${outside}, or use your own financing.`;
  const overMonths = `over ${countOf(months, 'month')}.`;
  if (deal.theirRate.entered) {
    return {
      severity: 'amber',
      headline: `${formatPointsMilli(theirAprMilli - outsideAprMilli)} over your outside rate.`,
      sentence: `That costs ${formatDollars(costCents)} ${overMonths} ${askToMatch}`,
      context: reference.experian.text,
      math,
    };
  }
  // A gap from a rate worked out from their payment is rounded down, like the rate (SPEC §7.0).
  const gap = formatPointsPercent(deal.theirRate.percent - outsidePercent, 'down');
  return {
    severity: 'amber',
    headline: `At least ${gap} over your outside rate.`,
    sentence: `That costs at least ${formatDollarsDown(costCents)} ${overMonths} ${askToMatch}`,
    context: reference.experian.text,
    math,
  };
}

// Card 5, Special rate or cash (SPEC §6.5, §7.9). Shows when the special rate, the longest term it covers, the cash
// instead and your outside rate are all entered.
function specialOrCashCard(deal, rules) {
  const { specialAprMilli, specialCoversMonths, cashInsteadCents, outsideAprMilli } = deal.inputs;
  if ([specialAprMilli, specialCoversMonths, cashInsteadCents, outsideAprMilli].includes(null)) {
    return null;
  }
  return card('specialOrCash', 5, specialOrCashOutcome(deal, rules));
}

// Card 5's outcome: which of the special rate and the cash costs less in today's dollars, and the break-even outside
// rate. The green outcomes add a reminder that the price shouldn't change between the two. Needs the months.
function specialOrCashOutcome(deal, rules) {
  const { specialAprMilli, cashInsteadCents, outsideAprMilli, months } = deal.inputs;
  const special = `${formatRateMilli(specialAprMilli)} special`;
  const cash = `${formatDollars(cashInsteadCents)} cash`;
  if (months === null) {
    const sentence = `The ${special} and the ${cash} are compared over the loan's months.`;
    const math = [
      `The special: ${formatRateMilli(specialAprMilli, 3)}`,
      `The cash instead: ${formatCents(cashInsteadCents)}`,
    ];
    return missingInputNote('months', 'compare the special rate with the cash', sentence, math);
  }
  const comparison = specialVsCash(deal, rules);
  const math = specialOrCashMath(deal, comparison);
  if (comparison.cashCoversRest) {
    const headline = `The ${cash} covers the rest of the loan.`;
    return { severity: 'neutral', headline, sentence: 'Take the cash.', math };
  }
  const { nA, paymentACents, paymentBCents, differenceCents, breakEven } = comparison;
  const specialOption = `${formatCents(paymentACents)}/mo for ${countOf(nA, 'month')}`;
  const cashOption = `${formatCents(paymentBCents)}/mo for ${countOf(months, 'month')} with the cash`;
  const todaysDollars = `In today's dollars at your ${formatRateMilli(outsideAprMilli)} outside rate:`;
  const priceReminder = "Make sure the price doesn't change when you switch between the rate and the cash.";
  if (comparison.winner === 'special') {
    const cashWins = breakEven.none === 'cash'
      ? "Cash doesn't win at any outside rate."
      : `Cash only wins if you can borrow below ${formatRatePercent(breakEven.percent)}.`;
    return {
      severity: 'green',
      headline: `The ${special} beats the ${cash} by about ${formatAbout(differenceCents)}.`,
      sentence: `${todaysDollars} ${specialOption}, against ${cashOption}. ${cashWins}`,
      context: priceReminder,
      math,
    };
  }
  const specialWins = breakEven.none === 'special'
    ? "The special doesn't win at any outside rate."
    : `The special only wins if your outside rate is above ${formatRatePercent(breakEven.percent)}.`;
  return {
    severity: 'green',
    headline: `The ${cash} beats the ${special} by about ${formatAbout(differenceCents)}.`,
    sentence: `${todaysDollars} ${cashOption}, against ${specialOption} at the ${special}. ${specialWins}`,
    context: priceReminder,
    math,
  };
}

// Card 5's math (SPEC §7.9): both options, their costs in today's dollars, and the break-even outside rate.
function specialOrCashMath(deal, comparison) {
  const { specialAprMilli, outsideAprMilli, months } = deal.inputs;
  const { nA, paymentACents, af0Cents, afBCents, paymentBCents, costACents, costBCents, breakEven } = comparison;
  const outside = formatRateMilli(outsideAprMilli, 3);
  return [
    `The special: ${formatCents(paymentACents)}/mo for ${countOf(nA, 'month')} at `
      + `${formatRateMilli(specialAprMilli, 3)} on ${formatCents(af0Cents)}, the amount financed without the cash`,
    `The cash: ${formatCents(paymentBCents)}/mo for ${countOf(months, 'month')} at ${outside} on `
      + `${formatCents(afBCents)}, the amount financed with the cash taken`,
    `In today's dollars at ${outside}, the special's payments are worth ${formatCents(costACents)}, and the cash costs `
      + `its amount financed, ${formatCents(costBCents)}.`,
    breakEvenLine(breakEven),
    'The outside rate also discounts the shorter special-rate loan. An outside rate quoted for a different term '
      + 'shifts the result slightly.',
  ];
}

// The break-even outside rate for "Show the math", rounded half up to 3 decimals (SPEC §7.0), or why there's none.
function breakEvenLine(breakEven) {
  if (breakEven.none === 'cash') {
    return "No break-even: the special's payments add up to no more than the cash's amount financed, so the cash "
      + "doesn't win at any outside rate.";
  }
  if (breakEven.none === 'special') {
    return "No break-even: even at 100% the special's payments are worth at least the cash's amount financed, so the "
      + "special doesn't win at any outside rate.";
  }
  return `Break-even outside rate: ${formatRatePercent(breakEven.percent, 'halfUp', 3)}. Below it, the cash wins.`;
}

// Card 6, Price vs target (SPEC §6.5). Shows when your target price is entered.
function targetCard(deal) {
  const { saleCents, targetCents } = deal.inputs;
  if (targetCents === null) {
    return null;
  }
  const differenceCents = saleCents - targetCents;
  const sentence = `Their sale price is ${formatDollars(saleCents)}, and your target is ${formatDollars(targetCents)}.`;
  const math = [
    `Their sale price: ${formatCents(saleCents)}`,
    `Your target: ${formatCents(targetCents)}`,
    `Sale price − target: ${formatCents(differenceCents)}. Within $1 counts as at your target.`,
  ];
  if (differenceCents > MATCH_TOLERANCE_CENTS) {
    const headline = `${formatDollars(differenceCents)} above your target.`;
    return card('target', 6, { severity: 'amber', headline, sentence, math });
  }
  if (differenceCents >= -MATCH_TOLERANCE_CENTS) {
    return card('target', 6, { severity: 'green', headline: 'At your target.', sentence, math });
  }
  const headline = `${formatDollars(-differenceCents)} under your target.`;
  return card('target', 6, { severity: 'green', headline, sentence, math });
}

// Card 7, Price vs sticker (SPEC §6.5). Shows when the window sticker total is entered. The green outcomes add the KBB
// line.
function stickerCard(deal, reference) {
  const { saleCents, stickerCents } = deal.inputs;
  if (stickerCents === null) {
    return null;
  }
  const differenceCents = saleCents - stickerCents;
  const math = [
    `Their sale price: ${formatCents(saleCents)}`,
    `Window sticker total: ${formatCents(stickerCents)}`,
    `Sale price − sticker: ${formatCents(differenceCents)}. Within $1 counts as at sticker.`,
  ];
  if (differenceCents > MATCH_TOLERANCE_CENTS) {
    return card('sticker', 7, {
      severity: 'amber',
      headline: `${formatDollars(differenceCents)} above sticker.`,
      sentence: "Ask what it's for: a market adjustment or added options.",
      math,
    });
  }
  const sentence = `Their sale price is ${formatDollars(saleCents)}, and the sticker is `
    + `${formatDollars(stickerCents)}.`;
  const context = reference.kbb.text;
  if (differenceCents >= -MATCH_TOLERANCE_CENTS) {
    return card('sticker', 7, { severity: 'green', headline: 'At sticker.', sentence, context, math });
  }
  const discountCents = -differenceCents;
  const percent = percentOfStickerText(discountCents, stickerCents);
  const headline = `${formatDollars(discountCents)} (${percent}) under sticker.`;
  return card('sticker', 7, { severity: 'green', headline, sentence, context, math });
}

// Card 8, Tax (SPEC §6.5, §7.1). Shows when their tax is entered.
function taxCard(deal, rules) {
  const { theirTaxCents } = deal.inputs;
  if (theirTaxCents === null) {
    return null;
  }
  const { price } = deal;
  const line = taxLine(price, rules);
  const differenceCents = theirTaxCents - price.taxCents;
  const math = [
    `Their tax: ${formatCents(theirTaxCents)}`,
    `The page's tax: ${line}`,
    `Their tax − the page's: ${formatCents(differenceCents)}. Within $1 counts as right.`,
  ];
  if (Math.abs(differenceCents) <= MATCH_TOLERANCE_CENTS) {
    return card('tax', 8, { severity: 'green', headline: rules.text.taxRightHeadline, sentence: `${line}.`, math });
  }
  const reasons = [`${line}.`, rules.text.taxReasons];
  // Title + registration above the DMV fees is taxed as a conveyance fee (§7.1). The card names it once it's more than
  // $1 above them (§6.5).
  if (price.registrationExcessCents > MATCH_TOLERANCE_CENTS) {
    reasons.push(rules.text.taxRegistrationReason(formatDollars(price.registrationExcessCents)));
  }
  const moreOrLess = differenceCents > 0 ? 'more' : 'less';
  return card('tax', 8, {
    severity: 'amber',
    headline: rules.text.taxOffHeadline(formatDollars(Math.abs(differenceCents)), moreOrLess),
    sentence: reasons.join(' '),
    math,
  });
}

// Card 9, Drive-away total (SPEC §6.5, §7.2). Shows when their drive-away total is entered.
function driveAwayCard(deal) {
  const { theirDriveAwayCents } = deal.inputs;
  if (theirDriveAwayCents === null) {
    return null;
  }
  const { subtotalCents, dmvCents, driveAwayCents } = deal.price;
  const differenceCents = theirDriveAwayCents - driveAwayCents;
  const math = [
    `Their drive-away total: ${formatCents(theirDriveAwayCents)}`,
    `The itemized numbers: subtotal ${formatCents(subtotalCents)} + DMV fees ${formatCents(dmvCents)} = `
      + formatCents(driveAwayCents),
    'Subtotal = sale price + doc fee + extras in the deal + tax − rebates − cash taken',
    `Theirs − the itemized numbers: ${formatCents(differenceCents)}. Within $1 matches.`,
  ];
  if (differenceCents > MATCH_TOLERANCE_CENTS) {
    return card('driveAway', 9, {
      severity: 'red',
      headline: `${formatDollars(differenceCents)} more than the itemized numbers add up to.`,
      sentence: 'Ask them to itemize it.',
      math,
    });
  }
  if (differenceCents < -MATCH_TOLERANCE_CENTS) {
    return card('driveAway', 9, {
      severity: 'amber',
      headline: `${formatDollars(-differenceCents)} less than the itemized numbers.`,
      sentence: 'Something may be missing or counted differently.',
      math,
    });
  }
  return card('driveAway', 9, {
    severity: 'green',
    headline: 'Their drive-away total matches.',
    sentence: `It's within $1 of the ${formatDollars(driveAwayCents)} the itemized numbers add up to.`,
    math,
  });
}

// Card 10, Doc fee (SPEC §6.5, §7.7). Always shows. Its cost includes the tax it adds.
function docFeeCard(deal, rules) {
  const { docFeeCents } = deal.inputs;
  if (docFeeCents === null) {
    return card('docFee', 10, {
      severity: 'neutral',
      headline: 'Ask for the doc fee.',
      sentence: "The deal counts it as $0 until it's entered.",
      math: ['Doc fee: blank, counted as $0'],
    });
  }
  const fee = formatDollars(docFeeCents);
  const sentence = rules.text.docFeeSentence(formatDollars(deal.docFeeCostCents));
  const math = [
    `Doc fee: ${formatCents(docFeeCents)}`,
    `Its cost = the doc fee + the tax it adds = ${formatCents(deal.docFeeCostCents)}`,
    `Comparison point: ${formatCents(rules.docFeeBenchmarkCents)}`,
  ];
  if (docFeeCents > rules.docFeeBenchmarkCents) {
    return card('docFee', 10, { severity: 'amber', headline: rules.text.docFeeHighHeadline(fee), sentence, math });
  }
  return card('docFee', 10, { severity: 'green', headline: `${fee} doc fee.`, sentence, math });
}

// Card 11, DMV fees (SPEC §6.5, §7.2). Shows when title + registration is entered. The state's DMV fees are lower in a
// cash deal, which has no lien fee.
function dmvFeesCard(deal, rules) {
  const { titleRegistrationCents } = deal.inputs;
  if (titleRegistrationCents === null) {
    return null;
  }
  const { ctDmvCents } = deal.price;
  const differenceCents = titleRegistrationCents - ctDmvCents;
  const fees = rules.dmv.breakdown.filter((fee) => !(deal.isCashDeal && fee.financedOnly));
  const math = [
    `Title + registration: ${formatCents(titleRegistrationCents)}`,
    `DMV fees: ${fees.map((fee) => `${fee.label} ${formatCents(fee.cents)}`).join(' + ')} = ${formatCents(ctDmvCents)}`,
    `Theirs − the DMV fees: ${formatCents(differenceCents)}. Up to $1 over counts as within the fees.`,
  ];
  if (differenceCents > MATCH_TOLERANCE_CENTS) {
    return card('dmvFees', 11, {
      severity: 'amber',
      headline: rules.text.dmvHighHeadline(formatDollars(differenceCents)),
      sentence: rules.text.dmvHighSentence(formatDollars(ctDmvCents), deal.isCashDeal),
      math,
    });
  }
  return card('dmvFees', 11, {
    severity: 'green',
    headline: rules.text.dmvOkHeadline,
    sentence: `They charge ${formatDollars(titleRegistrationCents)}, and the DMV charges ${formatDollars(ctDmvCents)}.`,
    math,
  });
}

// Card 12, Extras (SPEC §6.5, §7.7). Always shows. The extras in the deal count as one item, with the tax they add,
// spread over the loan at their rate. With their rate worked out from their payment, both amounts are lower bounds, so
// they read "at least", and the amount over the loan is rounded down (§6.5, §7.0).
function extrasCard(deal) {
  if (deal.extrasInDeal === null) {
    return card('extras', 12, {
      severity: 'green',
      headline: 'No extras in the deal.',
      sentence: 'Extras count only once they are marked In the deal.',
      math: ['Extras in the deal: none'],
    });
  }
  const { costCents, perMonthCents, overLoanCents } = deal.extrasInDeal;
  const { months } = deal.inputs;
  const prices = deal.inputs.extras.filter((item) => item.inDeal).map((item) => formatCents(item.priceCents));
  const costLines = [
    `Extras in the deal: ${prices.join(' + ')}`,
    `Their cost = their prices + the tax they add = ${formatCents(costCents)}`,
  ];
  const headline = `Extras in the deal: ${formatDollars(costCents)}.`;
  if (perMonthCents === null) {
    const math = [...costLines, "There's no loan to spread the cost over."];
    return card('extras', 12, { severity: 'amber', headline, sentence: "That's with tax. All optional.", math });
  }
  const loanCents = deal.price.amountFinancedCents;
  const perMonth = `+${formatCents(perMonthCents)}/mo`;
  const overMonths = `over ${countOf(months, 'month')}`;
  const amounts = deal.theirRate.entered
    ? `${perMonth}, ${formatDollars(overLoanCents)} ${overMonths}`
    : `At least ${perMonth}, at least ${formatDollarsDown(overLoanCents)} ${overMonths}`;
  return card('extras', 12, {
    severity: 'amber',
    headline,
    sentence: `${amounts}. All optional.`,
    math: [
      ...costLines,
      `Their rate: ${theirRateMathText(deal)}`,
      `Per month, at their rate for ${countOf(months, 'month')}: the payment on ${formatCents(loanCents)} less the `
        + `payment on ${formatCents(loanCents - costCents)} = ${formatCents(perMonthCents)}`,
      `Over the loan: ${formatCents(perMonthCents)} × ${months} = ${formatCents(overLoanCents)}`,
    ],
  });
}

// The Paying cash note (SPEC §6.5), which takes the place of cards 1–5 in a cash deal. When the cash instead of the
// special rate is entered but not taken, it asks whether that cash applies to a cash purchase.
function payingCashCard(deal) {
  const { downCents, cashInsteadCents, takingCash } = deal.inputs;
  const { driveAwayCents, amountFinancedCents } = deal.price;
  const sentences = [
    `Your ${formatDollars(downCents)} down payment covers the ${formatDollars(driveAwayCents)} drive-away total.`,
  ];
  if (cashInsteadCents !== null && !takingCash) {
    sentences.push(
      `Ask whether the ${formatDollars(cashInsteadCents)} cash instead of the special rate applies to a cash purchase.`,
    );
  }
  return card('payingCash', 1, {
    severity: 'neutral',
    headline: 'Paying cash: no loan to check.',
    sentence: sentences.join(' '),
    math: [
      `Drive-away total: ${formatCents(driveAwayCents)}`,
      `Down payment: ${formatCents(downCents)}`,
      `Amount financed = drive-away total − down payment = ${formatCents(amountFinancedCents)}, which is $0 or less, `
        + "so there's no loan.",
    ],
  });
}

// The names of the inputs that are blank, from [name, value] pairs, in the order given.
function blankNames(namedValues) {
  return namedValues.filter(([, value]) => value === null).map(([name]) => name);
}
