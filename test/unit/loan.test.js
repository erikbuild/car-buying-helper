// ABOUTME: Checks monthly payments, present value and rate solving against SPEC §7.4, §7.5 and Reg Z Appendix J's examples.
// ABOUTME: Covers 0%, odd first periods, a schedule with a final payment, and schedules with no rate at either end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORTY_FIVE_DAY, REGULAR, levelPayments, monthlyPayment, presentValue, solveRate } from '../../site/lib/loan.js';

// Example 1's amount financed, $34,825.14 (SPEC §7.11).
const AF = 3482514;

// Checks that actual is less than tolerance away from expected.
function assertWithin(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected} ± ${tolerance}, got ${actual}`);
}

test('REGULAR and FORTY_FIVE_DAY are frozen, so no caller can change the shared timings', () => {
  assert.ok(Object.isFrozen(REGULAR));
  assert.ok(Object.isFrozen(FORTY_FIVE_DAY));
});

test('monthlyPayment uses the regular timing unless it is given another', () => {
  assert.equal(monthlyPayment(AF, 5.9, 60), 67165);
  assert.equal(monthlyPayment(AF, 5.5, 60), 66520);
  assert.equal(monthlyPayment(AF, 5.9, 36), 105787);
  assert.equal(monthlyPayment(AF, 6.5, 60), 68139);
});

test('monthlyPayment charges for a first period longer or shorter than a month', () => {
  assert.equal(monthlyPayment(AF, 5.9, 60, FORTY_FIVE_DAY), 67330);
  assert.equal(monthlyPayment(AF, 5.9, 60, { m: 0, d: 20 }), 67055);
  assert.equal(monthlyPayment(AF, 5.9, 12, { m: 0, d: 15 }), 298835);
});

test('monthlyPayment at 0% is the amount divided by the months, with a half cent rounded up', () => {
  // $34,825.14 ÷ 36 is $967.365 (SPEC §7.0).
  assert.equal(monthlyPayment(AF, 0, 36), 96737);
});

test('monthlyPayment is 0 when there is nothing to finance', () => {
  assert.equal(monthlyPayment(0, 5.9, 60), 0);
  assert.equal(monthlyPayment(-486, 5.9, 60), 0);
  assert.equal(monthlyPayment(-486, 0, 36), 0);
});

test('levelPayments repeats one payment, then adds the final payment when there is one', () => {
  assert.deepEqual(levelPayments(69900, 3), [69900, 69900, 69900]);
  assert.deepEqual(levelPayments(67165, 2, 78651), [67165, 67165, 78651]);
});

test('presentValue of their payment, less the amount financed, is the extra in the loan for each timing', () => {
  // SPEC §7.11 Example 1: E is $1,418.13 with the regular timing and $1,329.25 with a 45-day first payment.
  assertWithin(presentValue(levelPayments(69900, 60), 5.9, REGULAR) - AF, 141813.4, 1);
  assertWithin(presentValue(levelPayments(69900, 60), 5.9, FORTY_FIVE_DAY) - AF, 132925, 1);
});

test('presentValue at 0% is the sum of the payments, whatever the timing', () => {
  assert.equal(presentValue([69900, 69900, 78651], 0, FORTY_FIVE_DAY), 218451);
});

test('solveRate works back from their payment to the rate, for each desk timing', () => {
  // SPEC §7.11 Example 1: R is 7.571% with the regular timing and 7.440% with a 45-day first payment.
  assertWithin(solveRate(levelPayments(69900, 60), AF, REGULAR).percent, 7.571, 0.0001);
  assertWithin(solveRate(levelPayments(69900, 60), AF, FORTY_FIVE_DAY).percent, 7.4405, 0.0001);
});

test("solveRate matches Reg Z Appendix J's examples", () => {
  // (b)(9): $1,000.00 repaid in 36 monthly payments of $33.61.
  assertWithin(solveRate(levelPayments(3361, 36), 100000, REGULAR).percent, 12.8256, 0.0001);
  // (c)(1)(ii): $6,000.00 repaid in 36 monthly payments of $200.00, the first 1 month and 19 days away.
  assertWithin(solveRate(levelPayments(20000, 36), 600000, { m: 1, d: 19 }).percent, 11.8165, 0.0001);
});

test('solveRate counts a final payment that differs from the others', () => {
  // SPEC §13: 59 × $671.65 + $786.51 on $34,825.14 with a 45-day first payment works out to 5.900%.
  const { percent } = solveRate(levelPayments(67165, 59, 78651), AF, FORTY_FIVE_DAY);
  assert.ok(percent >= 5.8995 && percent < 5.9005, `${percent} should round half up to 5.900`);
});

test("solveRate gives a short first period's true rate only with that period's timing", () => {
  // SPEC §13: $34,825.14 at a true 5.9%, with the first payment 15 days away, is 12 payments of $2,988.35.
  // With the regular timing those payments work out to 5.442%.
  assertWithin(solveRate(levelPayments(298835, 12), AF, REGULAR).percent, 5.4419, 0.0001);
  assertWithin(solveRate(levelPayments(298835, 12), AF, { m: 0, d: 15 }).percent, 5.9002, 0.0001);
});

test('solveRate returns the lower end of a bracket narrower than 1e-7 points, so it never overstates the rate', () => {
  const payments = levelPayments(69900, 60);
  const { percent } = solveRate(payments, AF, REGULAR);
  assert.ok(presentValue(payments, percent, REGULAR) >= AF, `${percent}% is above the rate`);
  assert.ok(presentValue(payments, percent + 1e-7, REGULAR) < AF, `${percent}% is more than 1e-7 points below the rate`);
});

test('solveRate gives 0% when the payments add up to exactly the amount', () => {
  assert.deepEqual(solveRate(levelPayments(1000, 10), 10000, REGULAR), { percent: 0 });
});

test('solveRate has no rate when the payments add up to less than the amount, or are worth more than it at 100%', () => {
  assert.deepEqual(solveRate(levelPayments(1000, 10), AF, REGULAR), { tooLow: true });
  assert.deepEqual(solveRate(levelPayments(1000000, 60), AF, REGULAR), { tooHigh: true });
});
