// ABOUTME: Checks reading typed amounts, rates and whole numbers, including text caught mid-typing.
// ABOUTME: Also checks half-up division and the money, rate and point display formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  divideHalfUp,
  formatAbout,
  formatAmountForField,
  formatCents,
  formatDollars,
  formatDollarsDown,
  formatPointsMilli,
  formatPointsPercent,
  formatRateMilli,
  formatRatePercent,
  formatTensDown,
  parseAmount,
  parseRate,
  parseWholeNumber,
} from '../../site/lib/numbers.js';

const MONTH_LIMITS = { min: 1, max: 96 };

test('parseAmount reads dollars with or without $, commas and spaces', () => {
  assert.deepEqual(parseAmount('$36,500'), { cents: 3650000, error: null });
  assert.deepEqual(parseAmount('36500'), { cents: 3650000, error: null });
  assert.deepEqual(parseAmount(' 36,500 '), { cents: 3650000, error: null });
  assert.deepEqual(parseAmount('36,500.5'), { cents: 3650050, error: null });
  assert.deepEqual(parseAmount('500000'), { cents: 50000000, error: null });
});

test('parseAmount reads text caught mid-typing as the obvious value, with no error', () => {
  assert.deepEqual(parseAmount('36,'), { cents: 3600, error: null });
  assert.deepEqual(parseAmount('36.'), { cents: 3600, error: null });
  assert.deepEqual(parseAmount('$'), { cents: null, error: null });
  assert.deepEqual(parseAmount('.'), { cents: null, error: null });
  assert.deepEqual(parseAmount(''), { cents: null, error: null });
});

test('parseAmount gives an error and no amount for unreadable, negative, too large or too precise text', () => {
  assert.deepEqual(parseAmount('abc'), { cents: null, error: 'Enter a number, like 36,500.' });
  assert.deepEqual(parseAmount('-500'), { cents: null, error: "Can't be negative." });
  assert.deepEqual(parseAmount('−500'), { cents: null, error: "Can't be negative." });
  assert.deepEqual(parseAmount('500000.01'), { cents: null, error: 'Must be $500,000 or less.' });
  assert.deepEqual(parseAmount('1.234'), { cents: null, error: 'Use at most 2 decimals.' });
});

test('parseRate reads a percent as thousandths, with or without % and spaces', () => {
  assert.deepEqual(parseRate('5.9'), { milli: 5900, error: null });
  assert.deepEqual(parseRate('5.9%'), { milli: 5900, error: null });
  assert.deepEqual(parseRate('5.9 %'), { milli: 5900, error: null });
  assert.deepEqual(parseRate('5.'), { milli: 5000, error: null });
  assert.deepEqual(parseRate('6.135'), { milli: 6135, error: null });
  assert.deepEqual(parseRate('30'), { milli: 30000, error: null });
  assert.deepEqual(parseRate(''), { milli: null, error: null });
});

test('parseRate gives an error and no rate for unreadable, negative, too high or too precise text', () => {
  assert.deepEqual(parseRate('30.001'), { milli: null, error: 'Must be 30% or less.' });
  assert.deepEqual(parseRate('5.1234'), { milli: null, error: 'Use at most 3 decimals.' });
  assert.deepEqual(parseRate('x'), { milli: null, error: 'Enter a rate, like 5.9.' });
  assert.deepEqual(parseRate('-1'), { milli: null, error: "Can't be negative." });
});

test('parseWholeNumber reads a whole number inside its limits', () => {
  assert.deepEqual(parseWholeNumber('60', MONTH_LIMITS), { value: 60, error: null });
  assert.deepEqual(parseWholeNumber('1', MONTH_LIMITS), { value: 1, error: null });
  assert.deepEqual(parseWholeNumber('96', MONTH_LIMITS), { value: 96, error: null });
  assert.deepEqual(parseWholeNumber('', MONTH_LIMITS), { value: null, error: null });
});

test('parseWholeNumber gives an error and no value for a fraction or a number outside its limits', () => {
  assert.deepEqual(parseWholeNumber('60.5', MONTH_LIMITS), { value: null, error: 'Enter a whole number.' });
  assert.deepEqual(parseWholeNumber('0', MONTH_LIMITS), { value: null, error: 'Must be from 1 to 96.' });
  assert.deepEqual(parseWholeNumber('97', MONTH_LIMITS), { value: null, error: 'Must be from 1 to 96.' });
  assert.deepEqual(parseWholeNumber('abc', MONTH_LIMITS), { value: null, error: 'Enter a whole number.' });
  assert.deepEqual(parseWholeNumber('-5', MONTH_LIMITS), { value: null, error: "Can't be negative." });
});

test('divideHalfUp rounds the quotient half up, exactly', () => {
  assert.equal(divideHalfUp(3643000 * 635, 10000), 231331);
  assert.equal(divideHalfUp(3243000 * 635, 10000), 205931);
  assert.equal(divideHalfUp(3482514, 36), 96737);
  assert.equal(divideHalfUp(3482513, 36), 96736);
});

test('formatCents writes dollars and cents, with U+2212 before a negative amount', () => {
  assert.equal(formatCents(67165), '$671.65');
  assert.equal(formatCents(-486), '−$4.86');
});

test('formatDollars rounds half up to the dollar', () => {
  assert.equal(formatDollars(3982514), '$39,825');
  assert.equal(formatDollars(37560), '$376');
});

test('formatAbout rounds half up to the nearest $10', () => {
  assert.equal(formatAbout(178867), '$1,790');
  assert.equal(formatAbout(178500), '$1,790');
});

test('formatDollarsDown rounds down to the dollar', () => {
  assert.equal(formatDollarsDown(189840), '$1,898');
});

test('formatTensDown rounds down to $10 at $10 and over, and down to the dollar under $10', () => {
  assert.equal(formatTensDown(132925), '$1,320');
  assert.equal(formatTensDown(880), '$8');
  assert.equal(formatTensDown(1999), '$10');
});

test('every money format puts U+2212 before a negative amount', () => {
  assert.equal(formatDollars(-486), '−$5');
  assert.equal(formatAbout(-178867), '−$1,790');
  assert.equal(formatDollarsDown(-189840), '−$1,898');
  assert.equal(formatTensDown(-132925), '−$1,320');
});

test('every money format takes unrounded cents, as present values give them', () => {
  assert.equal(formatCents(141813.4), '$1,418.13');
  assert.equal(formatCents(67164.5), '$671.65');
  assert.equal(formatDollars(37549.5), '$375');
  assert.equal(formatAbout(178867.3), '$1,790');
  assert.equal(formatDollarsDown(189840.7), '$1,898');
  assert.equal(formatTensDown(132925.37), '$1,320');
});

test('formatRateMilli shows up to 2 decimals without trailing zeros, or 3 fixed decimals', () => {
  assert.equal(formatRateMilli(5900), '5.9%');
  assert.equal(formatRateMilli(0), '0%');
  assert.equal(formatRateMilli(6135), '6.14%');
  assert.equal(formatRateMilli(5900, 3), '5.900%');
});

test('formatRatePercent rounds a computed rate half up, or down when asked', () => {
  assert.equal(formatRatePercent(7.440472, 'down'), '7.44%');
  assert.equal(formatRatePercent(1.900455), '1.9%');
  assert.equal(formatRatePercent(5.799797, 'halfUp', 3), '5.800%');
  assert.equal(formatRatePercent(0.000326, 'down'), '0%');
  assert.equal(formatRatePercent(7.4472), '7.45%');
  assert.equal(formatRatePercent(4.02, 'halfUp', 1), '4%');
});

test('point formats say "1 point" for a gap that shows as 1, and "points" otherwise', () => {
  assert.equal(formatPointsMilli(400), '0.4 points');
  assert.equal(formatPointsMilli(1000), '1 point');
  assert.equal(formatPointsMilli(635), '0.64 points');
  assert.equal(formatPointsPercent(1.940472, 'down'), '1.94 points');
  assert.equal(formatPointsPercent(1.004), '1 point');
  assert.equal(formatPointsPercent(1.996), '2 points');
});

test('formatAmountForField writes field text that shows cents only when there are some', () => {
  assert.equal(formatAmountForField(550000), '5,500');
  assert.equal(formatAmountForField(550050), '5,500.50');
  assert.equal(formatAmountForField(0), '0');
  assert.deepEqual(parseAmount(formatAmountForField(550050)), { cents: 550050, error: null });
});
