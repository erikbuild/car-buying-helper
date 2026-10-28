// ABOUTME: Derives the values the Verdict checks share from the parsed inputs.
// ABOUTME: Covers the expected payment range, the rate worked out from a payment and what each extra adds.
import { FORTY_FIVE_DAY, HIGHEST_RATE_PERCENT, REGULAR, levelPayments, monthlyPayment, solveRate } from './loan.js';
import { docFeeCostCents, extrasInDealCostCents, itemCostCents, priceOf } from './price.js';

// Works out the values the cards, the summary strip and the tabs share from the parsed inputs (SPEC §7.3–§7.7). A
// figure is null when it needs a loan, which is a deal with a sale price that isn't a cash deal, or needs an input
// that isn't entered.
export function deriveDeal(inputs, rules) {
  const price = priceOf(inputs, rules);
  const { months } = inputs;
  // The amount financed when there's a loan to pay off, and null when there's no sale price yet or it's a cash deal.
  const loanCents = price.hasSale && !price.isCashDeal ? price.amountFinancedCents : null;
  const contractTiming = inputs.contract.timing;
  const deskTimings = contractTiming === null ? [REGULAR, FORTY_FIVE_DAY] : [REGULAR, FORTY_FIVE_DAY, contractTiming];
  // Entered rates are thousandths of a percent: 5900 is 5.9%.
  const theirAprPercent = inputs.theirAprMilli === null ? null : inputs.theirAprMilli / 1000;
  const { shouldBeCents, expected } = paymentsAtTheirApr(loanCents, theirAprPercent, months, deskTimings);
  // Their payment is tied to the down payment it was quoted at (SPEC §6.3).
  const quoteCurrent = inputs.theirPaymentCents === null ? null : inputs.downCents === inputs.quoteDownCents;
  const workedOutRate = theirAprPercent === null && quoteCurrent === true && months !== null && loanCents !== null
    ? rateFromPayment(inputs.theirPaymentCents, months, loanCents, deskTimings)
    : null;
  const theirRate = theirRateOf(theirAprPercent, workedOutRate);
  // The loan an item's cost is spread over: the amount financed, at their rate, for the months (SPEC §7.7).
  const loanAtTheirRate = loanCents !== null && months !== null && theirRate !== null
    ? { amountFinancedCents: loanCents, ratePercent: theirRate.percent, months }
    : null;
  const extras = inputs.extras.map((extra) => {
    const costCents = itemCostCents(inputs, rules, extra.id);
    return { id: extra.id, costCents, ...spreadOverLoan(costCents, extra.inDeal, loanAtTheirRate) };
  });
  return {
    inputs,
    price,
    hasSale: price.hasSale,
    // False until the sale price is entered.
    isCashDeal: price.hasSale && price.isCashDeal,
    deskTimings,
    contractTiming,
    theirAprPercent,
    shouldBeCents,
    expected,
    quoteCurrent,
    workedOutRate,
    theirRate,
    specialApplies: specialRateApplies(inputs),
    docFeeCostCents: docFeeCostCents(inputs, rules),
    extras,
    extrasInDeal: extrasInDealOf(inputs, rules, loanAtTheirRate),
  };
}

// The should-be payment, which uses the regular timing, and the lowest and highest payments over the desk timings
// (SPEC §7.4), all at their APR for the months. Both are null without their APR, months or a loan.
function paymentsAtTheirApr(loanCents, theirAprPercent, months, deskTimings) {
  if (loanCents === null || theirAprPercent === null || months === null) {
    return { shouldBeCents: null, expected: null };
  }
  const payments = deskTimings.map((timing) => monthlyPayment(loanCents, theirAprPercent, months, timing));
  return {
    shouldBeCents: monthlyPayment(loanCents, theirAprPercent, months, REGULAR),
    expected: { lowCents: Math.min(...payments), highCents: Math.max(...payments) },
  };
}

// Works out R, the rate at which their payment for each of the months pays off the amount financed (SPEC §7.5). It's
// the smallest result over the timings, so it's never overstated, and 0% when the payments add up to no more than the
// amount financed. When they're worth more than it even at 100% with every timing, R is over 100% and counts as 100%.
// zero says R shows as 0, which is when rounding it down to 2 decimals leaves 0 (SPEC §7.0).
function rateFromPayment(paymentCents, months, loanCents, timings) {
  if (paymentCents * months <= loanCents) {
    return { percent: 0, zero: true, over100: false };
  }
  // The payments add up to more than the amount financed, so each timing gives a rate or is over 100%.
  const payments = levelPayments(paymentCents, months);
  const percents = timings
    .map((timing) => solveRate(payments, loanCents, timing))
    .filter((result) => !result.tooHigh)
    .map((result) => result.percent);
  // A rate worked out as over the top of the range counts as the top (SPEC §7.5).
  if (percents.length === 0) {
    return { percent: HIGHEST_RATE_PERCENT, zero: false, over100: true };
  }
  const percent = Math.min(...percents);
  return { percent, zero: Math.floor(percent * 100) === 0, over100: false };
}

// Their rate, which cards 2–4 and 17 and the extras' figures use (SPEC §7.5): their APR when it's entered, otherwise R
// when it could be worked out, and otherwise null, since it's unknown.
function theirRateOf(theirAprPercent, workedOutRate) {
  if (theirAprPercent !== null) {
    return { percent: theirAprPercent, entered: true, over100: false };
  }
  if (workedOutRate !== null) {
    return { percent: workedOutRate.percent, entered: false, over100: workedOutRate.over100 };
  }
  return null;
}

// The automaker's special rate applies when it, the longest term it covers and the months are all entered, the months
// are within that term, and the cash offered instead isn't being taken (SPEC §7.6).
function specialRateApplies({ specialAprMilli, specialCoversMonths, months, takingCash }) {
  return specialAprMilli !== null && specialCoversMonths !== null && months !== null
    && months <= specialCoversMonths && !takingCash;
}

// What a cost adds to the monthly payment, and over the loan, at their rate for the months with the regular timing
// (SPEC §7.7). An item that isn't in the deal would add Payment(AF + cost) − Payment(AF). One in the deal adds
// Payment(AF) − Payment(AF − cost), which is all of Payment(AF) when the cost is at least the amount financed, since
// the payment on $0 or less is 0. Both figures are null when there's no loan to spread the cost over.
function spreadOverLoan(costCents, inDeal, loan) {
  if (loan === null) {
    return { perMonthCents: null, overLoanCents: null };
  }
  const { amountFinancedCents, ratePercent, months } = loan;
  const paymentOn = (amountCents) => monthlyPayment(amountCents, ratePercent, months, REGULAR);
  const perMonthCents = inDeal
    ? paymentOn(amountFinancedCents) - paymentOn(amountFinancedCents - costCents)
    : paymentOn(amountFinancedCents + costCents) - paymentOn(amountFinancedCents);
  return { perMonthCents, overLoanCents: perMonthCents * months };
}

// The extras in the deal taken as one item (SPEC §7.7): their prices plus the tax they add, and what that adds to the
// payments. Null when no extra is in the deal.
function extrasInDealOf(inputs, rules, loan) {
  if (!inputs.extras.some((extra) => extra.inDeal)) {
    return null;
  }
  const costCents = extrasInDealCostCents(inputs, rules);
  return { costCents, ...spreadOverLoan(costCents, true, loan) };
}
