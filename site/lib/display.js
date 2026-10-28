// ABOUTME: Writes the text for the summary strip, the Price tab lines, the extras and the key numbers.
// ABOUTME: Shows "—" wherever a value can't be worked out yet.
import { formatCents, formatDollars, formatRateMilli, formatRatePercent } from './numbers.js';

// Shown wherever a value can't be worked out yet (SPEC §6.1).
const MISSING_VALUE = '—';
// Shown in place of the loan's figures when the down payment covers the drive-away total (SPEC §6.1, §7.2).
const PAYING_CASH = 'Paying cash';
// A figure from their sheet matches the page's when it's within this much of it (SPEC §5).
const MATCH_TOLERANCE_CENTS = 100;

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
  return count === 1 ? '1 problem' : `${count} problems`;
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
  // Multiplying by 100 before dividing rounds every 1-decimal tie up; dividing first rounds some of them down.
  const percent = formatRatePercent((distanceCents * 100) / stickerCents, 'halfUp', 1);
  const direction = saleCents > stickerCents ? 'above' : 'off';
  return `${formatCents(distanceCents)} ${direction} the sticker (${percent})`;
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
// tax)", starting "Adds" for an extra in the deal. With no loan to spread it over (a cash deal, months blank or their
// rate unknown), the line is just its cost: "Would add $3,185.18 with tax".
export function extraLine(deal, extraId) {
  const { inDeal } = deal.inputs.extras.find((extra) => extra.id === extraId);
  const { costCents, perMonthCents, overLoanCents } = deal.extras.find((extra) => extra.id === extraId);
  const adds = inDeal ? 'Adds' : 'Would add';
  const cost = `${formatCents(costCents)} with tax`;
  if (perMonthCents === null) {
    return `${adds} ${cost}`;
  }
  const overLoan = `${formatCents(overLoanCents)} over ${monthsText(deal.inputs.months)}`;
  return `${adds} ${formatCents(perMonthCents)}/mo, ${overLoan} (${cost})`;
}

// A number of months, with 1 in the singular: "60 months", "1 month" (SPEC §6.5).
function monthsText(months) {
  return months === 1 ? '1 month' : `${months} months`;
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
    { label: 'Their rate', value: theirRateText(deal) },
    { label: 'Months', value: inputs.months === null ? MISSING_VALUE : String(inputs.months) },
    { label: 'Payment', value: paymentsText(deal) },
  ];
}

// Their APR as entered, or else the rate worked out from their payment, followed by ", from their payment"
// (SPEC §6.5, §7.5). "—" while their rate is unknown.
function theirRateText(deal) {
  if (deal.inputs.theirAprMilli !== null) {
    return formatRateMilli(deal.inputs.theirAprMilli);
  }
  if (deal.workedOutRate === null) {
    return MISSING_VALUE;
  }
  return `${workedOutRateText(deal.workedOutRate)}, from their payment`;
}

// R, the rate worked out from their payment, rounded down (SPEC §7.0, §7.5): "at least 7.44%", or "0%" when it shows
// as 0, or "over 100%".
export function workedOutRateText({ percent, zero, over100 }) {
  if (over100) {
    return 'over 100%';
  }
  if (zero) {
    return '0%';
  }
  return `at least ${formatRatePercent(percent, 'down')}`;
}

// The should-be payment and theirs, as the strip shows them: "should be $671.65, theirs $699.00".
function paymentsText(deal) {
  const theirs = theirsText(deal);
  return theirs === null ? shouldBeText(deal) : `${shouldBeText(deal)}, ${theirs}`;
}
