// ABOUTME: Writes the text for the summary strip, the Price tab lines, the extras and the key numbers.
// ABOUTME: Also builds the card pieces both card modules use. Shows "—" wherever a value can't be worked out yet.
import { MILLI_PER_PERCENT, formatCents, formatDollars, formatRateMilli, formatRatePercent } from './numbers.js';

// Shown wherever a value can't be worked out yet (SPEC §6.1).
const MISSING_VALUE = '—';
// Shown in place of the loan's figures when the down payment covers the drive-away total (SPEC §6.1, §7.2).
const PAYING_CASH = 'Paying cash';
// Two amounts match when they're within this much of each other (SPEC §5): payments, prices, tax, totals and the
// finance charge, and a figure from their sheet against the page's.
export const MATCH_TOLERANCE_CENTS = 100;
// What "Show the math" calls each first-payment timing (SPEC §7.3).
export const TIMING_NAMES = Object.freeze({
  regular: 'a first payment a month after signing',
  fortyFiveDay: 'a first payment 45 days after signing',
  contractDates: "the contract's dates",
});
// The desk timings' names, in the order the Deal lists the timings: the regular timing, the 45-day timing, then the
// contract dates' timing when they're entered (SPEC §7.3).
export const DESK_TIMING_NAMES = Object.freeze([
  TIMING_NAMES.regular,
  TIMING_NAMES.fortyFiveDay,
  TIMING_NAMES.contractDates,
]);

// The summary strip's slots (SPEC §6.1): the drive-away total in whole dollars, the should-be payment, their payment
// (null when there's none to show) and the number of problems, which are the red and amber cards. The drive-away total
// and the problem count are "—" until the sale price is entered.
export function summaryStrip(deal, cards) {
  return {
    driveAway: deal.hasSale ? formatDollars(deal.price.driveAwayCents) : MISSING_VALUE,
    shouldBe: shouldBeText(deal),
    theirs: theirsText(deal),
    problems: deal.hasSale ? problemsText(cards) : MISSING_VALUE,
  };
}

// "should be $671.65", "should be —" when it can't be worked out, or "Paying cash" in a cash deal.
function shouldBeText(deal) {
  if (deal.isCashDeal) {
    return PAYING_CASH;
  }
  return `should be ${deal.shouldBeCents === null ? MISSING_VALUE : formatCents(deal.shouldBeCents)}`;
}

// "theirs $699.00", or "theirs $699.00 at $5,000 down" while the quote is out of date (SPEC §6.3). Null until their
// payment is entered, and in a cash deal.
function theirsText(deal) {
  const { theirPaymentCents, quoteDownCents } = deal.inputs;
  if (deal.isCashDeal || theirPaymentCents === null) {
    return null;
  }
  const theirs = `theirs ${formatCents(theirPaymentCents)}`;
  return deal.quoteCurrent ? theirs : `${theirs} at ${formatDollars(quoteDownCents)} down`;
}

// "No problems", "1 problem" or "N problems". Only red and amber cards are problems (SPEC §6.5).
function problemsText(cards) {
  const count = problemCount(cards);
  if (count === 0) {
    return 'No problems';
  }
  return countOf(count, 'problem');
}

// The number of problems: the red and amber cards (SPEC §6.1).
export function problemCount(cards) {
  return cards.filter((card) => card.severity === 'red' || card.severity === 'amber').length;
}

// The tax, with one term for each tax base in use (SPEC §6.2, §7.1): "6.35% of $37,199.00 = $2,362.14". The vehicle
// base always has a term. The service base, which is always taxed at the standard rate, has one while taxed service
// extras are in the deal: "7.75% of $51,000.00 + 6.35% of $2,995.00 = $4,142.68". "—" until the sale price is entered.
export function taxLine(price, rules) {
  if (!price.hasSale) {
    return MISSING_VALUE;
  }
  const terms = [taxTerm(price.vehicleBp, price.vehicleBaseCents)];
  if (price.serviceBaseCents > 0) {
    terms.push(taxTerm(rules.tax.standardBp, price.serviceBaseCents));
  }
  return `${terms.join(' + ')} = ${formatCents(price.taxCents)}`;
}

// One term of the tax line, a rate in basis points on a base: "6.35% of $37,199.00".
function taxTerm(bp, baseCents) {
  // A basis point is 10 thousandths of a percent.
  return `${formatRateMilli(bp * 10)} of ${formatCents(baseCents)}`;
}

// The Price tab's calculated lines, with amounts in cents (SPEC §6.2): the discount off the sticker, the tax line, the
// DMV fees, the drive-away total, and how their tax and their drive-away total compare with the page's figures.
export function priceTabLines(deal, rules) {
  const { inputs, price } = deal;
  return {
    discount: discountText(inputs),
    taxLine: taxLine(price, rules),
    dmv: dmvText(price),
    driveAway: price.hasSale ? formatCents(price.driveAwayCents) : MISSING_VALUE,
    theirTaxCheck: matchText(inputs.theirTaxCents, price.taxCents),
    theirDriveAwayCheck: matchText(inputs.theirDriveAwayCents, price.driveAwayCents),
  };
}

// The sale price's distance from the window sticker, in dollars and as a percent of the sticker to 1 decimal:
// "$1,500.00 off the sticker (3.9%)", or "$500.00 above the sticker (1.4%)". "—" until both are entered, and while
// the sticker is $0, which leaves no percent to work out.
function discountText({ stickerCents, saleCents }) {
  if (stickerCents === null || saleCents === null || stickerCents === 0) {
    return MISSING_VALUE;
  }
  const distanceCents = Math.abs(stickerCents - saleCents);
  const percent = percentOfStickerText(distanceCents, stickerCents);
  const direction = saleCents > stickerCents ? 'above' : 'off';
  return `${formatCents(distanceCents)} ${direction} the sticker (${percent})`;
}

// An amount as a percent of the window sticker, rounded half up to 1 decimal: "3.9%". Needs a sticker above $0.
export function percentOfStickerText(amountCents, stickerCents) {
  // Multiplying by 100 before dividing rounds every 1-decimal tie up; dividing first rounds some of them down.
  return formatRatePercent((amountCents * 100) / stickerCents, 'halfUp', 1);
}

// The DMV fees, marked "(estimated)" when title + registration is blank and the state's amount is used (SPEC §6.2).
function dmvText(price) {
  if (!price.hasSale) {
    return MISSING_VALUE;
  }
  const dmv = formatCents(price.dmvCents);
  return price.dmvEstimated ? `${dmv} (estimated)` : dmv;
}

// How a figure from their sheet compares with the page's: "✓ Matches" within $1, and otherwise the difference,
// "$37.86 more than the page's" or "… less than the page's". Null while their figure is blank, and "—" until the page
// has a figure to compare it with.
function matchText(theirsCents, pageCents) {
  if (theirsCents === null) {
    return null;
  }
  if (pageCents === null) {
    return MISSING_VALUE;
  }
  const differenceCents = theirsCents - pageCents;
  if (Math.abs(differenceCents) <= MATCH_TOLERANCE_CENTS) {
    return '✓ Matches';
  }
  const direction = differenceCents > 0 ? 'more' : 'less';
  return `${formatCents(Math.abs(differenceCents))} ${direction} than the page's`;
}

// The Loan tab's amount financed in cents (SPEC §6.3, §7.2): "$34,825.14", or "Paying cash" when the down payment
// covers the drive-away total. "—" until the sale price is entered.
export function amountFinancedLine(deal) {
  if (!deal.hasSale) {
    return MISSING_VALUE;
  }
  return deal.isCashDeal ? PAYING_CASH : formatCents(deal.price.amountFinancedCents);
}

// What an extra costs, in cents (SPEC §6.4, §7.7): "Would add $61.43/mo, $3,685.80 over 60 months ($3,185.18 with
// tax)", starting "Adds" for an extra in the deal. With their rate worked out from their payment, both amounts are
// lower bounds and read "at least": "Adds at least $70.88/mo, at least $4,252.80 over 60 months ($3,185.18 with tax)".
// With no loan to spread it over (a cash deal, months blank or their rate unknown), the line is just its cost:
// "Would add $3,185.18 with tax". While its price is blank or unreadable, it has no cost: "Would add —".
export function extraLine(deal, extraId) {
  const { inDeal } = deal.inputs.extras.find((extra) => extra.id === extraId);
  const { costCents, perMonthCents, overLoanCents } = deal.extras.find((extra) => extra.id === extraId);
  const adds = inDeal ? 'Adds' : 'Would add';
  if (costCents === null) {
    return `${adds} ${MISSING_VALUE}`;
  }
  const cost = `${formatCents(costCents)} with tax`;
  if (perMonthCents === null) {
    return `${adds} ${cost}`;
  }
  const atLeast = deal.theirRate.entered ? '' : 'at least ';
  const overLoan = `${atLeast}${formatCents(overLoanCents)} over ${countOf(deal.inputs.months, 'month')}`;
  return `${adds} ${atLeast}${formatCents(perMonthCents)}/mo, ${overLoan} (${cost})`;
}

// The key numbers at the top of the Verdict tab, as {label, value} rows (SPEC §6.5): their sale price, the drive-away
// total, the amount financed, their rate, the months and the payments, with amounts in whole dollars and monthly
// amounts in cents. A cash deal has no loan, so a "Paying cash" payment row takes the place of the loan's rows. There
// are no key numbers until the sale price is entered.
export function keyNumbers(deal) {
  if (!deal.hasSale) {
    return [];
  }
  const { inputs, price } = deal;
  const prices = [
    { label: 'Their sale price', value: formatDollars(inputs.saleCents) },
    { label: 'Drive-away total', value: formatDollars(price.driveAwayCents) },
  ];
  if (deal.isCashDeal) {
    return [...prices, { label: 'Payment', value: PAYING_CASH }];
  }
  return [
    ...prices,
    { label: 'Amount financed', value: formatDollars(price.amountFinancedCents) },
    { label: 'Their rate', value: keyRateText(deal) },
    { label: 'Months', value: inputs.months === null ? MISSING_VALUE : String(inputs.months) },
    { label: 'Payment', value: paymentsText(deal) },
  ];
}

// Their APR as entered, or else the rate worked out from their payment, followed by ", from their payment"
// (SPEC §6.5, §7.5). "—" while their rate is unknown.
function keyRateText(deal) {
  if (deal.theirRate === null) {
    return MISSING_VALUE;
  }
  if (deal.theirRate.entered) {
    return theirRateText(deal);
  }
  return `${theirRateText(deal)}, from their payment`;
}

// Their rate as the cards word it (SPEC §6.5): their APR, "5.9%", or the rate worked out from their payment,
// "at least 7.44%". Needs their rate to be known.
export function theirRateText(deal) {
  return deal.theirRate.entered ? formatRateMilli(deal.inputs.theirAprMilli) : workedOutRateText(deal.workedOutRate);
}

// R, the rate worked out from their payment, rounded down to `decimals` (SPEC §7.0, §7.5): "at least 7.44%", or "0%"
// without "at least" when it shows as 0, or "over 100%". "Show the math" gives it to 3 decimals: "at least 7.440%",
// "0.000%".
export function workedOutRateText({ percent, over100 }, decimals = 2) {
  if (over100) {
    return 'over 100%';
  }
  const rate = formatRatePercent(percent, 'down', decimals);
  return rate === formatRatePercent(0, 'down', decimals) ? rate : `at least ${rate}`;
}

// The should-be payment and theirs, as the strip shows them: "should be $671.65, theirs $699.00".
function paymentsText(deal) {
  const theirs = theirsText(deal);
  return theirs === null ? shouldBeText(deal) : `${shouldBeText(deal)}, ${theirs}`;
}

// A Verdict card from the outcome of its check. An outcome without a context line has null for it.
export function card(key, number, { severity, headline, sentence, context = null, math }) {
  return { key, number, severity, headline, sentence, context, math };
}

// A neutral note asking for the blank inputs a card needs, which inputsText names (SPEC §6.5): "Enter months to check
// their payment."
export function missingInputNote(inputsText, purpose, sentence, math) {
  return { severity: 'neutral', headline: `Enter ${inputsText} to ${purpose}.`, sentence, math };
}

// Names joined into a list: "a", "a and b", "a, b and c".
export function listOf(names) {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

// A count with its unit, in the singular for 1 (SPEC §6.5): "1 month", "60 months".
export function countOf(count, unit) {
  return count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
}

// Their rate for "Show the math", to 3 decimals (SPEC §7.0): their APR, or the rate worked out from their payment,
// rounded down, or "unknown" while their rate is unknown.
export function theirRateMathText({ inputs, theirRate }) {
  if (theirRate === null) {
    return 'unknown';
  }
  if (theirRate.entered) {
    return formatRateMilli(inputs.theirAprMilli, 3);
  }
  return `${workedOutRateText(theirRate, 3)}, worked out from their payment`;
}

// Reg Z's APR tolerance in full, "0.125 points", as cards 3 and 4's "Within …" headlines and "Show the math" give it.
export function aprTolerancePointsText(reference) {
  return `${reference.regZ.aprToleranceMilli / MILLI_PER_PERCENT} points`;
}
