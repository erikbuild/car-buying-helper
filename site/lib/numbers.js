// ABOUTME: Parses and formats money amounts and interest rates.
// ABOUTME: Money is whole cents, rounded with exact half-up integer division.

const MAX_AMOUNT_CENTS = 50000000; // $500,000
const MAX_RATE_MILLI = 30000; // 30%
const MINUS_SIGN = '−';

// Reads text typed into a field as a non-negative decimal number, ignoring the characters that
// `ignored` matches. Returns {scaled, error}: scaled is the number times 10^decimals ("36,500.5"
// with 2 decimals is 3650050), or null when the text is blank or has an error. Text with no
// digits yet, such as "$" or ".", is blank.
function parseDecimal(text, { ignored, decimals, unreadableError, decimalsError }) {
  const match = /^([-−]?)(\d*)(?:\.(\d*))?$/.exec(text.replace(ignored, ''));
  if (match === null) {
    return { scaled: null, error: unreadableError };
  }
  const [, sign, whole, fraction = ''] = match;
  if (sign !== '') {
    return { scaled: null, error: "Can't be negative." };
  }
  if (whole === '' && fraction === '') {
    return { scaled: null, error: null };
  }
  if (fraction.length > decimals) {
    return { scaled: null, error: decimalsError };
  }
  return { scaled: Number(whole + fraction.padEnd(decimals, '0')), error: null };
}

// Reads a typed dollar amount, such as "$36,500" or "36,500.5", as {cents, error}.
// Blank text gives {cents: null, error: null}; text with an error gives cents null.
export function parseAmount(text) {
  const { scaled, error } = parseDecimal(text, {
    ignored: /[$,\s]/g,
    decimals: 2,
    unreadableError: 'Enter a number, like 36,500.',
    decimalsError: 'Use at most 2 decimals.',
  });
  if (scaled !== null && scaled > MAX_AMOUNT_CENTS) {
    return { cents: null, error: `Must be ${formatDollars(MAX_AMOUNT_CENTS)} or less.` };
  }
  return { cents: scaled, error };
}

// Reads a typed rate, such as "5.9" or "5.9%", as {milli, error}, in thousandths of a percent
// (5.9% is 5900). Blank text gives {milli: null, error: null}; text with an error gives milli null.
export function parseRate(text) {
  const { scaled, error } = parseDecimal(text, {
    ignored: /[%\s]/g,
    decimals: 3,
    unreadableError: 'Enter a rate, like 5.9.',
    decimalsError: 'Use at most 3 decimals.',
  });
  if (scaled !== null && scaled > MAX_RATE_MILLI) {
    return { milli: null, error: `Must be ${formatRateMilli(MAX_RATE_MILLI)} or less.` };
  }
  return { milli: scaled, error };
}

// Reads a typed whole number from min to max as {value, error}.
// Blank text gives {value: null, error: null}; text with an error gives value null.
export function parseWholeNumber(text, { min, max }) {
  const { scaled, error } = parseDecimal(text, {
    ignored: /\s/g,
    decimals: 0,
    unreadableError: 'Enter a whole number.',
    decimalsError: 'Enter a whole number.',
  });
  if (scaled !== null && (scaled < min || scaled > max)) {
    return { value: null, error: `Must be from ${min} to ${max}.` };
  }
  return { value: scaled, error };
}

// Divides a non-negative number by a positive whole number and rounds the quotient half up:
// divideHalfUp(3482514, 36) is 96737, since 96,736.5 rounds up. The remainder is exact, so a
// tie always rounds up, even where floating-point division would land just below it.
export function divideHalfUp(numerator, denominator) {
  const remainder = numerator % denominator;
  const quotient = (numerator - remainder) / denominator;
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
}

// Writes a whole number with commas between thousands: 39825 → "39,825".
function withCommas(whole) {
  return String(whole).replace(/\B(?=(\d{3})+$)/g, ',');
}

// Writes whole cents as dollars and cents with commas, without a dollar sign: 3982514 → "39,825.14".
function dollarsAndCents(cents) {
  return `${withCommas(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, '0')}`;
}

// Writes an amount of cents as "$" and the digits writeSize gives for its size,
// with U+2212 in front of a negative amount: "−$4.86".
function writeMoney(cents, writeSize) {
  const sign = cents < 0 ? MINUS_SIGN : '';
  return `${sign}$${writeSize(Math.abs(cents))}`;
}

// The money formats below take cents, rounded or not, such as a present value.

// Dollars and cents, rounded half up to the cent: 67165 → "$671.65".
export function formatCents(cents) {
  return writeMoney(cents, (size) => dollarsAndCents(divideHalfUp(size, 1)));
}

// Whole dollars, rounded half up: 37560 → "$376".
export function formatDollars(cents) {
  return writeMoney(cents, (size) => withCommas(divideHalfUp(size, 100)));
}

// An amount worded "about", rounded half up to the nearest $10: 178500 → "$1,790".
export function formatAbout(cents) {
  return writeMoney(cents, (size) => withCommas(divideHalfUp(size, 1000) * 10));
}

// Whole dollars, rounded down: 189840 → "$1,898".
export function formatDollarsDown(cents) {
  return writeMoney(cents, (size) => withCommas(Math.floor(size / 100)));
}

// Rounded down to $10 at $10 and over, and down to the dollar under $10: 132925 → "$1,320", 880 → "$8".
export function formatTensDown(cents) {
  return writeMoney(cents, (size) => withCommas(size < 1000 ? Math.floor(size / 100) : Math.floor(size / 1000) * 10));
}

// Writes whole cents as amount-field text, without a dollar sign, showing cents only when there
// are some: 550000 → "5,500", 550050 → "5,500.50". parseAmount reads it back.
export function formatAmountForField(cents) {
  return cents % 100 === 0 ? withCommas(cents / 100) : dollarsAndCents(cents);
}

// Writes a whole number of 10^-decimals steps as a decimal number: (614, 2) → "6.14".
// Up to 2 decimals drop trailing zeros, so (590, 2) → "5.9" and (0, 2) → "0"; 3 decimals stay fixed.
function writeDecimal(steps, decimals) {
  const scale = 10 ** decimals;
  const digits = decimals === 0 ? '' : String(steps % scale).padStart(decimals, '0');
  const fraction = decimals <= 2 ? digits.replace(/0+$/, '') : digits;
  const whole = Math.floor(steps / scale);
  return fraction === '' ? String(whole) : `${whole}.${fraction}`;
}

// Rounds a computed percent or point gap to whole 10^-decimals steps, 'halfUp' or 'down':
// (7.440472, 'down', 2) → 744.
function roundToSteps(value, rounding, decimals) {
  const scaled = value * 10 ** decimals;
  return rounding === 'down' ? Math.floor(scaled) : divideHalfUp(scaled, 1);
}

// Writes an entered rate, held in thousandths of a percent, rounded half up:
// 5900 → "5.9%", 6135 → "6.14%", (5900, 3) → "5.900%".
export function formatRateMilli(milli, decimals = 2) {
  return `${writeDecimal(divideHalfUp(milli, 10 ** (3 - decimals)), decimals)}%`;
}

// Writes a computed rate in percent, rounded 'halfUp' or 'down': (7.440472, 'down') → "7.44%".
export function formatRatePercent(percent, rounding = 'halfUp', decimals = 2) {
  return `${writeDecimal(roundToSteps(percent, rounding, decimals), decimals)}%`;
}

// Writes a gap that shows as "1" as "1 point", and any other gap as "0.4 points".
function writePoints(number) {
  return number === '1' ? '1 point' : `${number} points`;
}

// Writes a gap between entered rates, held in thousandths of a point, rounded half up: 635 → "0.64 points".
export function formatPointsMilli(milli) {
  return writePoints(writeDecimal(divideHalfUp(milli, 10), 2));
}

// Writes a computed gap in points, rounded 'halfUp' or 'down': (1.940472, 'down') → "1.94 points".
export function formatPointsPercent(points, rounding = 'halfUp') {
  return writePoints(writeDecimal(roundToSteps(points, rounding, 2), 2));
}
