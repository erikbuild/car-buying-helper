// ABOUTME: Reads plain calendar dates, with no time of day or time zone.
// ABOUTME: Counts the whole months and odd days to the first payment, by Reg Z Appendix J's rules.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Reads a date field's "YYYY-MM-DD" text as {year, month, day}, with month from 1 to 12.
// Returns null for blank or other text, and for dates that don't exist, such as 2026-02-30.
export function parseCalendarDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

// Times the first payment as m whole months plus d days after the contract date, counting back
// from the first payment (SPEC §7.3). Takes both dates as "YYYY-MM-DD" text. Returns null unless
// both are real dates and the first payment is after the contract date.
export function firstPeriod(contractDate, firstPaymentDate) {
  const contract = parseCalendarDate(contractDate);
  const firstPayment = parseCalendarDate(firstPaymentDate);
  if (contract === null || firstPayment === null || daysFrom(contract, firstPayment) <= 0) {
    return null;
  }
  // m is the most whole months back from the first payment that still land on or after the contract date.
  let m = 0;
  while (daysFrom(contract, monthsBack(firstPayment, m + 1)) >= 0) {
    m += 1;
  }
  return { m, d: daysFrom(contract, monthsBack(firstPayment, m)) };
}

// The date `count` whole months before `date`. It keeps date's day of the month, or uses the month's
// last day when the month is too short or when date is the last day of its own month (Appendix J (b)(3)(iv)).
function monthsBack(date, count) {
  const monthsFromYearZero = date.year * 12 + (date.month - 1) - count;
  const year = Math.floor(monthsFromYearZero / 12);
  const month = monthsFromYearZero - year * 12 + 1;
  const lastDay = daysInMonth(year, month);
  const onLastDay = date.day === daysInMonth(date.year, date.month);
  return { year, month, day: onLastDay ? lastDay : Math.min(date.day, lastDay) };
}

// The number of days from start to end, negative when end comes first. It counts UTC midnights,
// so a clock change between the dates can't add or remove an hour.
function daysFrom(start, end) {
  return (utcMidnight(end) - utcMidnight(start)) / MS_PER_DAY;
}

// The time of date's UTC midnight, in milliseconds. It reads years 0 to 99 as written, not as 1900 to 1999.
function utcMidnight(date) {
  const time = new Date(0);
  time.setUTCFullYear(date.year, date.month - 1, date.day);
  return time.getTime();
}

function daysInMonth(year, month) {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
