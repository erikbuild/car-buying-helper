// ABOUTME: Builds Verdict cards 13–17, which check the contract's federal disclosure box.
// ABOUTME: Compares the box with itself and with the deal that was quoted.
import {
  DESK_TIMING_NAMES,
  MATCH_TOLERANCE_CENTS,
  TIMING_NAMES,
  aprTolerancePointsText,
  card,
  countOf,
  firstPeriodText,
  listOf,
  missingInputNote,
  theirRateMathText,
} from './display.js';
import { FORTY_FIVE_DAY, REGULAR, levelPayments, monthlyPayment, solveRate } from './loan.js';
import { MILLI_PER_PERCENT, formatCents, formatDollars, formatRateMilli, formatRatePercent } from './numbers.js';

// With no final payment entered, the total of payments matches the payments within this much (SPEC §5).
const NO_FINAL_PAYMENT_TOLERANCE_CENTS = 500;
// Reg Z measures a first period's odd days against a 30-day month (SPEC §7.3).
const DAYS_PER_MONTH = 30;
// A loan with fewer payments than this has Reg Z's tighter first-period limits (SPEC §7.3).
const MONTHS_PER_YEAR = 12;

// The contract fields the cards need, as their notes name them, in the order the contract section lists them.
const CONTRACT_FIELD_NAMES = {
  amountFinancedCents: 'amount financed',
  financeChargeCents: 'finance charge',
  totalOfPaymentsCents: 'total of payments',
  aprMilli: 'APR',
  paymentCents: 'monthly payment',
  paymentCount: 'number of payments',
};

// A comparison with their quote that didn't run, because one of its inputs is blank.
const NOT_COMPARED = Object.freeze({ ran: false, failed: false, text: null });

// Verdict cards 13–17, in number order (SPEC §6.5). They show once any contract field other than the two dates is
// entered. There are none in a cash deal, which has no loan for the contract to check, or before the sale price is
// entered, while there's no deal to check it against. The contract cards have no context line.
export function contractCards(deal, reference) {
  const { contract } = deal.inputs;
  if (!deal.hasSale || deal.isCashDeal || !anyContractFieldEntered(contract)) {
    return [];
  }
  return [
    card('contractAmountFinanced', 13, amountFinancedOutcome(deal)),
    card('contractBox', 14, boxOutcome(contract)),
    card('contractPayments', 15, paymentsOutcome(contract)),
    card('contractApr', 16, aprOutcome(contract, reference)),
    card('contractVsQuote', 17, quoteOutcome(deal, reference)),
  ];
}

// The contract's payments (SPEC §7.10): its monthly payment for each of its payments, except that the last is the
// final payment when that's entered, or else the last payment the disclosure box implies, when it implies one. Null
// until the monthly payment and the number of payments are entered.
export function contractSchedule(contract) {
  const { paymentCents, paymentCount, finalPaymentCents } = contract;
  if (paymentCents === null || paymentCount === null) {
    return null;
  }
  return paymentsEndingWith(paymentCents, paymentCount, finalPaymentCents ?? impliedFinalPaymentCents(contract));
}

// The APRs the contract's payments work out to on its amount financed (SPEC §7.10), in percent, one for each timing
// the contract may use (§7.3). A percent is null when there's no rate: the payments add up to less than the amount
// financed, or they're worth more than it even at 100%. Empty until the payments and the amount financed are entered.
export function contractAprResults(deal, reference) {
  return contractAprSolutions(deal.inputs.contract, reference).map(({ timing, solution }) => ({
    timing,
    percent: solution.percent ?? null,
  }));
}

// §7.10's three comparisons of the contract with their quote, as {apr, payment, term}. Each is {ran, failed, text}: it
// runs when its inputs are entered and fails when what it checks is true, and its text, null when it didn't run, says
// what it compared.
// - apr: the contract APR is more than their APR + 0.125. A rate worked out from a payment-only quote is a lower bound,
//   so it isn't compared as an APR; the payment comparison covers that quote.
// - payment: the contract payment is more than the most their rate gives on the contract's amount financed for its
//   number of payments, over the desk timings, plus $1.
// - term: the number of payments differs from the months.
export function quoteComparisons(deal, reference) {
  return {
    apr: aprComparison(deal.inputs, reference),
    payment: paymentComparison(deal),
    term: termComparison(deal.inputs),
  };
}

// Whether any contract field other than the two dates, which give the timing, is entered.
function anyContractFieldEntered(contract) {
  return Object.entries(contract).some(([field, value]) => field !== 'timing' && value !== null);
}

// Card 13 (SPEC §6.5, §7.10): the contract's amount financed against the deal's, which §7.2 works out with the extras
// in the deal included.
function amountFinancedOutcome(deal) {
  const { contract, downCents } = deal.inputs;
  const { amountFinancedCents: dealCents, driveAwayCents } = deal.price;
  const dealLine = `Your deal: drive-away total ${formatCents(driveAwayCents)} − down payment ${formatCents(downCents)}`
    + ` = ${formatCents(dealCents)}`;
  const blank = blankContractFields(contract, ['amountFinancedCents']);
  if (blank.length > 0) {
    const sentence = `It should match the ${formatDollars(dealCents)} your deal adds up to.`;
    return missingInputNote(contractFieldsText(blank), 'check it against your deal', sentence, [dealLine]);
  }
  const differenceCents = contract.amountFinancedCents - dealCents;
  const math = [
    `Contract: ${formatCents(contract.amountFinancedCents)}`,
    dealLine,
    `Contract − your deal: ${formatCents(differenceCents)}. Within $1 matches.`,
  ];
  if (differenceCents > MATCH_TOLERANCE_CENTS) {
    return {
      severity: 'red',
      headline: `${formatDollars(differenceCents)} more is financed than your deal adds up to.`,
      sentence: 'Ask for the itemization of the amount financed.',
      math,
    };
  }
  if (differenceCents < -MATCH_TOLERANCE_CENTS) {
    return {
      severity: 'amber',
      headline: `${formatDollars(-differenceCents)} less is financed than your deal adds up to.`,
      sentence: 'Check that the down payment, rebates and cash are what you agreed.',
      math,
    };
  }
  return {
    severity: 'green',
    headline: 'The amount financed matches your deal.',
    sentence: `It's within $1 of the ${formatDollars(dealCents)} your deal adds up to.`,
    math,
  };
}

// Card 14 (SPEC §6.5): the disclosure box's finance charge against its total of payments minus its amount financed.
function boxOutcome(contract) {
  const rule = 'The finance charge should equal the total of payments minus the amount financed.';
  const formula = 'Finance charge = total of payments − amount financed, within $1.';
  const blank = blankContractFields(contract, ['amountFinancedCents', 'financeChargeCents', 'totalOfPaymentsCents']);
  if (blank.length > 0) {
    return missingInputNote(contractFieldsText(blank), 'check the disclosure box', rule, [formula]);
  }
  const { amountFinancedCents, financeChargeCents, totalOfPaymentsCents } = contract;
  const boxChargeCents = totalOfPaymentsCents - amountFinancedCents;
  const math = [
    `Finance charge: ${formatCents(financeChargeCents)}`,
    `Total of payments − amount financed: ${formatCents(totalOfPaymentsCents)} − ${formatCents(amountFinancedCents)}`
      + ` = ${formatCents(boxChargeCents)}`,
    formula,
  ];
  if (Math.abs(financeChargeCents - boxChargeCents) > MATCH_TOLERANCE_CENTS) {
    return { severity: 'red', headline: "The disclosure box doesn't add up.", sentence: rule, math };
  }
  return {
    severity: 'green',
    headline: 'The disclosure box adds up.',
    sentence: `The ${formatDollars(financeChargeCents)} finance charge is the total of payments minus the amount `
      + 'financed.',
    math,
  };
}

// Card 15 (SPEC §6.5): the total of payments against the payments. With the final payment entered they match within
// $1. Without it they match within $5, and past that the card asks for the final payment, because the APR check then
// uses the last payment the box implies (§7.10).
function paymentsOutcome(contract) {
  const formula = 'Total of payments = the payments added up, within $1 with a final payment, or $5 without one.';
  const blank = blankContractFields(contract, ['totalOfPaymentsCents', 'paymentCents', 'paymentCount']);
  if (blank.length > 0) {
    const sentence = 'The total of payments should be the payments added up.';
    return missingInputNote(contractFieldsText(blank), 'check the payment schedule', sentence, [formula]);
  }
  const { totalOfPaymentsCents, paymentCents, paymentCount, finalPaymentCents } = contract;
  const payments = paymentsEndingWith(paymentCents, paymentCount, finalPaymentCents);
  const paymentsCents = sumOf(payments);
  const differenceCents = Math.abs(totalOfPaymentsCents - paymentsCents);
  const math = [
    `Payments: ${scheduleText(payments)} = ${formatCents(paymentsCents)}`,
    `Total of payments: ${formatCents(totalOfPaymentsCents)}`,
    formula,
  ];
  const sentence = `The payments come to ${formatDollars(paymentsCents)}, and the total of payments is `
    + `${formatDollars(totalOfPaymentsCents)}.`;
  if (finalPaymentCents !== null && differenceCents > MATCH_TOLERANCE_CENTS) {
    return { severity: 'amber', headline: "Total of payments doesn't match the payment schedule.", sentence, math };
  }
  if (finalPaymentCents === null && differenceCents > NO_FINAL_PAYMENT_TOLERANCE_CENTS) {
    const lastCents = impliedFinalPaymentCents(contract);
    const lastLine = lastCents === null
      ? 'The box implies no last payment above $0, so the APR check uses equal payments.'
      : `The APR check uses the last payment the box implies: ${formatCents(totalOfPaymentsCents)} − `
        + `${paymentCount - 1} × ${formatCents(paymentCents)} = ${formatCents(lastCents)}.`;
    return {
      severity: 'neutral',
      headline: `Total of payments isn't ${paymentCount} × ${formatCents(paymentCents)}.`,
      sentence: 'If the last payment is different, enter it as Final payment.',
      math: [...math, lastLine],
    };
  }
  return { severity: 'green', headline: 'Total of payments matches the schedule.', sentence, math };
}

// Card 16 (SPEC §6.5, §7.10): the disclosed APR against the rates the contract's payments work out to on its amount
// financed, with each timing the contract may use. Reg Z allows the APR to be 0.125 points from one of them, and the
// closest one is shown. A 0% APR is checked without solving.
function aprOutcome(contract, reference) {
  const toleranceLine = `Reg Z allows the APR to be ${aprTolerancePointsText(reference)} from a rate the payments `
    + 'work out to (12 CFR 1026.22(a)(2)).';
  const needed = ['amountFinancedCents', 'aprMilli', 'paymentCents', 'paymentCount'];
  // At 0% the finance charge is checked too.
  const blank = blankContractFields(contract, contract.aprMilli === 0 ? [...needed, 'financeChargeCents'] : needed);
  if (blank.length > 0) {
    const sentence = 'The APR should match the rate the payments work out to.';
    return missingInputNote(contractFieldsText(blank), 'check the APR', sentence, [toleranceLine]);
  }
  if (contract.aprMilli === 0) {
    return zeroAprOutcome(contract);
  }
  const solutions = contractAprSolutions(contract, reference);
  const math = [
    `Payments: ${scheduleText(contractSchedule(contract))}`,
    `Amount financed: ${formatCents(contract.amountFinancedCents)}`,
    `APR on the contract: ${formatRateMilli(contract.aprMilli, 3)}`,
    ...solutions.map(({ name, solution }) => `With ${name}: ${solutionText(solution)}`),
    ...firstPeriodLimitLines(contract, reference),
    toleranceLine,
  ];
  const mismatch = "The APR on the contract doesn't match its own numbers.";
  const percents = solutions.map(({ solution }) => solution.percent).filter((percent) => percent !== undefined);
  if (percents.length === 0) {
    // A total under the amount financed is short with every timing; otherwise each timing is over 100%.
    const sentence = solutions[0].solution.tooLow
      ? "The payments don't cover the amount financed."
      : 'They work out to over 100%.';
    return { severity: 'red', headline: mismatch, sentence, math };
  }
  const aprPercent = contract.aprMilli / MILLI_PER_PERCENT;
  const closestPercent = percents.reduce((closest, percent) =>
    (Math.abs(percent - aprPercent) < Math.abs(closest - aprPercent) ? percent : closest));
  const sentence = `They work out to ${formatRatePercent(closestPercent)}.`;
  if (Math.abs(contract.aprMilli - closestPercent * MILLI_PER_PERCENT) <= reference.regZ.aprToleranceMilli) {
    return { severity: 'green', headline: "The APR matches the contract's numbers.", sentence, math };
  }
  return { severity: 'red', headline: mismatch, sentence, math };
}

// Card 16 at 0% (SPEC §7.10), with no solving: the payment is within $1 of the amount financed ÷ the number of
// payments, and the finance charge is at most $1.
function zeroAprOutcome({ amountFinancedCents, financeChargeCents, paymentCents, paymentCount }) {
  const evenPaymentCents = monthlyPayment(amountFinancedCents, 0, paymentCount);
  const math = [
    `Amount financed ÷ number of payments: ${formatCents(amountFinancedCents)} ÷ ${paymentCount} = `
      + formatCents(evenPaymentCents),
    `Monthly payment: ${formatCents(paymentCents)}`,
    `Finance charge: ${formatCents(financeChargeCents)}`,
    'At 0% the payment should be within $1 of the amount financed ÷ the number of payments, and the finance charge '
      + 'at most $1.',
  ];
  const paymentMatches = Math.abs(paymentCents - evenPaymentCents) <= MATCH_TOLERANCE_CENTS;
  if (paymentMatches && financeChargeCents <= MATCH_TOLERANCE_CENTS) {
    return {
      severity: 'green',
      headline: 'The 0% checks out.',
      sentence: `The payment is about the amount financed ÷ ${paymentCount}, ${formatCents(evenPaymentCents)}, and the `
        + `finance charge is ${formatDollars(financeChargeCents)}.`,
      math,
    };
  }
  return {
    severity: 'red',
    headline: "This doesn't add up as a 0% loan.",
    sentence: `A 0% loan has a $0 finance charge and a payment of about ${formatCents(evenPaymentCents)}.`,
    math,
  };
}

// Card 17 (SPEC §6.5, §7.10): the contract against their quote, with whichever of the three comparisons can run.
function quoteOutcome(deal, reference) {
  const comparisons = quoteComparisons(deal, reference);
  const { apr, payment, term } = comparisons;
  const ran = [apr, payment, term].filter((comparison) => comparison.ran);
  const math = quoteMath(deal, reference, comparisons);
  const failures = ran.filter((comparison) => comparison.failed);
  if (failures.length > 0) {
    return {
      severity: 'red',
      headline: "The contract isn't the deal they quoted.",
      sentence: failures.map((comparison) => comparison.text).join(' '),
      math,
    };
  }
  if (term.ran && (apr.ran || payment.ran)) {
    // A rate worked out from their payment came from a payment-only quote (SPEC §7.5).
    const quoted = deal.theirRate.entered ? 'rate' : 'payment';
    const compared = [[apr, 'APR'], [payment, 'payment'], [term, 'number of payments']]
      .filter(([comparison]) => comparison.ran)
      .map(([, name]) => name);
    return {
      severity: 'green',
      headline: `The contract matches their quoted ${quoted} and term.`,
      sentence: `The contract's ${listOf(compared)} are in line with their quote.`,
      math,
    };
  }
  const sentence = "It compares the contract's APR, payment and number of payments with their quote.";
  const inputsText = blankQuoteInputsText(deal, comparisons);
  return missingInputNote(inputsText, 'compare the contract with their quote', sentence, math);
}

// Card 17's "Show the math" (SPEC §6.5): for each comparison that ran, the numbers it compared, with rates to 3
// decimals (§7.0), and the most it allows, whether it passed or failed.
function quoteMath(deal, reference, { apr, payment, term }) {
  return [
    ...(apr.ran ? aprComparisonMath(deal.inputs, reference) : []),
    ...(payment.ran ? paymentComparisonMath(deal) : []),
    ...(term.ran ? termComparisonMath(deal.inputs) : []),
    'A lower APR or payment is never a problem.',
  ];
}

// Comparison 1's math (SPEC §7.10): the two APRs, and their APR + 0.125 points, the most the contract's may be.
function aprComparisonMath({ theirAprMilli, contract }, reference) {
  const toleranceMilli = reference.regZ.aprToleranceMilli;
  return [
    `APR on the contract: ${formatRateMilli(contract.aprMilli, 3)}`,
    `Their APR: ${formatRateMilli(theirAprMilli, 3)}`,
    `The contract's APR should be at most their APR + ${aprTolerancePointsText(reference)}: `
      + formatRateMilli(theirAprMilli + toleranceMilli, 3),
  ];
}

// Comparison 2's math (SPEC §7.10): the contract's payment, and what their rate gives on the contract's amount financed
// for its number of payments with each desk timing. The highest of those + $1 is the most the contract's may be.
function paymentComparisonMath(deal) {
  const { amountFinancedCents, paymentCents, paymentCount } = deal.inputs.contract;
  const payments = paymentsAtTheirRate(deal);
  return [
    `Amount financed on the contract: ${formatCents(amountFinancedCents)}`,
    `Payment on the contract: ${formatCents(paymentCents)} for ${countOf(paymentCount, 'payment')}`,
    `Their rate: ${theirRateMathText(deal)}`,
    ...payments.map((cents, index) => `At their rate with ${DESK_TIMING_NAMES[index]}: ${formatCents(cents)}`),
    "The contract's payment should be at most the highest of these + $1: "
      + formatCents(Math.max(...payments) + MATCH_TOLERANCE_CENTS),
  ];
}

// Comparison 3's math (SPEC §7.10): the number of payments and the months quoted.
function termComparisonMath({ months, contract }) {
  return [
    `Number of payments on the contract: ${contract.paymentCount}`,
    `Months quoted: ${months}`,
    'The number of payments should equal the months quoted.',
  ];
}

// Comparison 1 (SPEC §7.10): the contract APR against their APR, when both are entered.
function aprComparison({ theirAprMilli, contract }, reference) {
  if (theirAprMilli === null || contract.aprMilli === null) {
    return NOT_COMPARED;
  }
  return {
    ran: true,
    failed: contract.aprMilli > theirAprMilli + reference.regZ.aprToleranceMilli,
    text: `APR ${formatRateMilli(contract.aprMilli)} against ${formatRateMilli(theirAprMilli)} quoted.`,
  };
}

// Comparison 2 (SPEC §7.10): the contract payment against the most their rate gives on the contract's amount financed
// for its number of payments, over the desk timings, plus $1. It uses the contract's own amount financed, so an amount
// added to the loan is reported once, by card 13.
function paymentComparison(deal) {
  const { inputs, theirRate } = deal;
  const { amountFinancedCents, paymentCents, paymentCount } = inputs.contract;
  if (theirRate === null || amountFinancedCents === null || paymentCents === null || paymentCount === null) {
    return NOT_COMPARED;
  }
  const mostCents = Math.max(...paymentsAtTheirRate(deal));
  const lineCents = mostCents + MATCH_TOLERANCE_CENTS;
  // A rate worked out from their payment is a lower bound, so the quote it came from stands for it.
  const rate = theirRate.entered ? formatRateMilli(inputs.theirAprMilli) : 'their quote';
  const most = `${rate} on this amount financed comes to at most ${formatCents(mostCents)}`;
  const contractPayment = `${formatCents(paymentCents)}/mo`;
  if (paymentCents > lineCents) {
    return { ran: true, failed: true, text: `${contractPayment}, but ${most}.` };
  }
  const text = `${contractPayment}, at or under ${formatCents(lineCents)}: ${most}, plus $1.`;
  return { ran: true, failed: false, text };
}

// The payment their rate gives on the contract's amount financed for its number of payments, with each desk timing
// (SPEC §7.3), in the Deal's order of desk timings. Needs their rate and those contract fields.
function paymentsAtTheirRate({ inputs, theirRate, deskTimings }) {
  const { amountFinancedCents, paymentCount } = inputs.contract;
  return deskTimings.map((timing) => monthlyPayment(amountFinancedCents, theirRate.percent, paymentCount, timing));
}

// Comparison 3 (SPEC §7.10): the number of payments against the months, when both are entered.
function termComparison({ months, contract }) {
  if (months === null || contract.paymentCount === null) {
    return NOT_COMPARED;
  }
  return {
    ran: true,
    failed: contract.paymentCount !== months,
    text: `${countOf(contract.paymentCount, 'payment')} against ${countOf(months, 'month')} quoted.`,
  };
}

// Names the blank inputs that would let the comparisons that didn't run run (SPEC §6.5 card 17): their rate and the
// months, then the contract's fields. A rate worked out from a payment-only quote isn't compared as an APR (§7.10), so
// then the APR comparison asks for nothing.
function blankQuoteInputsText({ inputs, theirRate }, { apr, payment }) {
  const quoteNames = [];
  if (theirRate === null) {
    quoteNames.push('their rate');
  }
  if (inputs.months === null) {
    quoteNames.push('months');
  }
  const aprComparisonMissing = !apr.ran && (theirRate === null || theirRate.entered);
  const contractFields = [
    ...(aprComparisonMissing ? ['aprMilli'] : []),
    ...(payment.ran ? [] : ['amountFinancedCents', 'paymentCents']),
    'paymentCount',
  ];
  const contractNames = blankContractFields(inputs.contract, contractFields);
  return listOf(contractNames.length > 0 ? [...quoteNames, contractFieldsText(contractNames)] : quoteNames);
}

// The last payment the disclosure box implies (SPEC §7.10): with the final payment blank and the total of payments more
// than $5 off the payment × n, it's the total of payments − the payment × (n − 1), when that's more than $0. Null
// otherwise. Needs the monthly payment and the number of payments.
function impliedFinalPaymentCents({ totalOfPaymentsCents, paymentCents, paymentCount, finalPaymentCents }) {
  if (finalPaymentCents !== null || totalOfPaymentsCents === null
    || Math.abs(totalOfPaymentsCents - paymentCents * paymentCount) <= NO_FINAL_PAYMENT_TOLERANCE_CENTS) {
    return null;
  }
  const lastCents = totalOfPaymentsCents - paymentCents * (paymentCount - 1);
  return lastCents > 0 ? lastCents : null;
}

// The contract's paymentCount payments of paymentCents, the last of them lastCents instead when it isn't null.
function paymentsEndingWith(paymentCents, paymentCount, lastCents) {
  return lastCents === null
    ? levelPayments(paymentCents, paymentCount)
    : levelPayments(paymentCents, paymentCount - 1, lastCents);
}

// Solves for the contract's APR with each timing it may use (SPEC §7.3, §7.10), as [{timing, name, solution}]: name
// says the timing for "Show the math", and solution is what solveRate gives. Empty until the payments and the amount
// financed are entered.
function contractAprSolutions(contract, reference) {
  const schedule = contractSchedule(contract);
  if (schedule === null || contract.amountFinancedCents === null) {
    return [];
  }
  return contractTimings(contract, reference).map(({ timing, name }) => ({
    timing,
    name,
    solution: solveRate(schedule, contract.amountFinancedCents, timing),
  }));
}

// The timings the contract's APR may be worked out with (SPEC §7.3), each with its name for "Show the math": the
// contract's dates when they're a valid pair and otherwise a 45-day first payment, then a regular first month when
// the dates aren't entered or Reg Z lets their first period count as regular.
function contractTimings(contract, reference) {
  const { timing } = contract;
  const dated = timing === null
    ? { timing: FORTY_FIVE_DAY, name: TIMING_NAMES.fortyFiveDay }
    : { timing, name: `${TIMING_NAMES.contractDates}, ${firstPeriodText(timing)} to the first payment` };
  const regular = { timing: REGULAR, name: TIMING_NAMES.regular };
  return regularFirstPeriodAllowed(contract, reference) ? [dated, regular] : [dated];
}

// Whether Reg Z lets the contract's first period count as a regular month (SPEC §7.3, 12 CFR 1026.17(c)(4)): always
// when the dates aren't entered, and otherwise when the first-period difference, 30 × (m − 1) + d days, is within the
// limits for the loan's length. The difference is negative when the first period is shorter than a month.
function regularFirstPeriodAllowed({ timing, paymentCount }, reference) {
  if (timing === null) {
    return true;
  }
  const { underOneYear, oneYearAndOver } = reference.regZ.firstPeriodLimits;
  const { shorter, longer } = paymentCount < MONTHS_PER_YEAR ? underOneYear : oneYearAndOver;
  const differenceDays = DAYS_PER_MONTH * (timing.m - 1) + timing.d;
  return differenceDays >= -shorter && differenceDays <= longer;
}

// Says in "Show the math" why no rate is worked out with a regular first month, when Reg Z doesn't let the contract's
// first period count as regular. Empty otherwise.
function firstPeriodLimitLines(contract, reference) {
  if (regularFirstPeriodAllowed(contract, reference)) {
    return [];
  }
  const firstPeriod = firstPeriodText(contract.timing);
  return [`Not with ${TIMING_NAMES.regular}: a first period of ${firstPeriod} is outside Reg Z's limits.`];
}

// A solved rate for "Show the math", to 3 decimals rounded half up (SPEC §7.0), or why there's none.
function solutionText(solution) {
  if (solution.tooLow) {
    return "no rate, since the payments don't cover the amount financed";
  }
  if (solution.tooHigh) {
    return 'over 100%';
  }
  return formatRatePercent(solution.percent, 'halfUp', 3);
}

// A payment schedule for "Show the math": "60 × $671.65", or "59 × $671.65 + $786.51" when the last payment differs.
function scheduleText(payments) {
  const [firstCents] = payments;
  const lastCents = payments.at(-1);
  if (lastCents === firstCents) {
    return `${payments.length} × ${formatCents(firstCents)}`;
  }
  return `${payments.length - 1} × ${formatCents(firstCents)} + ${formatCents(lastCents)}`;
}

// The names of the given contract fields that are blank, in the order the contract section lists them.
function blankContractFields(contract, fields) {
  return Object.keys(CONTRACT_FIELD_NAMES)
    .filter((field) => fields.includes(field) && contract[field] === null)
    .map((field) => CONTRACT_FIELD_NAMES[field]);
}

// Contract fields named together: "the contract's finance charge and total of payments".
function contractFieldsText(names) {
  return `the contract's ${listOf(names)}`;
}

// The sum of some amounts.
function sumOf(amounts) {
  return amounts.reduce((total, amount) => total + amount, 0);
}
