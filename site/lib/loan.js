// ABOUTME: Loan math: monthly payments, present value and the rate a payment schedule works out to.
// ABOUTME: Handles odd first periods the way Reg Z Appendix J does.
import { divideHalfUp } from './numbers.js';

// First-payment timings: m whole months plus d days after signing (SPEC §7.3).
export const REGULAR = Object.freeze({ m: 1, d: 0 });
export const FORTY_FIVE_DAY = Object.freeze({ m: 1, d: 15 });

// A solved rate lies from 0% to this APR, in percent (SPEC §7.5).
export const HIGHEST_RATE_PERCENT = 100;
// Solving stops once the rate's bracket is narrower than this, in percentage points (SPEC §7.5).
const RATE_PRECISION_POINTS = 1e-7;

// The present value, in unrounded cents, of monthly payments at ratePercent APR, the first one
// timing.m whole months and timing.d days after signing (SPEC §7.4). At 0% it's the payments' sum.
export function presentValue(paymentsCents, ratePercent, { m, d }) {
  const monthlyRate = ratePercent / 100 / 12;
  // The d odd days earn simple interest, d/30 of a month's rate.
  const oddDaysFactor = 1 + (d / 30) * monthlyRate;
  return paymentsCents.reduce((total, payment, index) => {
    const k = index + 1;
    return total + payment / (oddDaysFactor * (1 + monthlyRate) ** (m + k - 1));
  }, 0);
}

// The monthly payment, in whole cents rounded half up, that pays off amountCents in n payments at
// ratePercent APR with the given first-payment timing (SPEC §7.0, §7.4). It's 0 when there's
// nothing to finance, and the amount ÷ n at 0%.
export function monthlyPayment(amountCents, ratePercent, n, timing = REGULAR) {
  if (amountCents <= 0) {
    return 0;
  }
  if (ratePercent === 0) {
    return divideHalfUp(amountCents, n);
  }
  return divideHalfUp(amountCents / presentValue(levelPayments(1, n), ratePercent, timing), 1);
}

// Lists n payments of paymentCents, then finalCents when it's given, which makes n + 1 payments in
// all: levelPayments(67165, 59, 78651) is 59 payments of $671.65 and then one of $786.51.
export function levelPayments(paymentCents, n, finalCents = null) {
  const payments = Array(n).fill(paymentCents);
  return finalCents === null ? payments : [...payments, finalCents];
}

// Works out the APR, in percent, at which the payments' present value is amountCents (SPEC §7.5).
// It bisects on [0%, 100%] until the bracket is narrower than 1e-7 points and returns the lower
// end, so the rate is never overstated. Returns {tooLow: true} when the payments add up to less
// than the amount, and {tooHigh: true} when they're worth more than it even at 100%.
export function solveRate(paymentsCents, amountCents, timing) {
  if (presentValue(paymentsCents, 0, timing) < amountCents) {
    return { tooLow: true };
  }
  if (presentValue(paymentsCents, HIGHEST_RATE_PERCENT, timing) > amountCents) {
    return { tooHigh: true };
  }
  let low = 0;
  let high = HIGHEST_RATE_PERCENT;
  while (high - low >= RATE_PRECISION_POINTS) {
    const middle = (low + high) / 2;
    if (presentValue(paymentsCents, middle, timing) >= amountCents) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return { percent: low };
}
