// ABOUTME: Tests reading plain calendar dates and counting the whole months and odd days to the first payment.
// ABOUTME: Covers SPEC §7.3's examples, month ends, leap years, m = 0, clock changes, years 0 to 99 and date pairs that don't count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstPeriod, parseCalendarDate } from '../../site/lib/calendar.js';

// Connecticut's clocks change between some of these dates (2026-11-01 and 2027-03-14),
// so a day count taken in local time would be off by an hour.
process.env.TZ = 'America/New_York';

// Each case is [contract date, first payment date, expected {m, d} or null].
function assertFirstPeriods(cases) {
  for (const [contractDate, firstPaymentDate, expected] of cases) {
    assert.deepEqual(firstPeriod(contractDate, firstPaymentDate), expected, `${contractDate} → ${firstPaymentDate}`);
  }
}

test('firstPeriod counts whole months back from the first payment, then the days left over', () => {
  assertFirstPeriods([
    ['2026-10-30', '2026-12-14', { m: 1, d: 15 }],
    ['2026-10-15', '2026-11-15', { m: 1, d: 0 }],
  ]);
});

test('firstPeriod has m = 0 when the first payment is less than a month away', () => {
  assertFirstPeriods([
    ['2026-10-30', '2026-11-19', { m: 0, d: 20 }],
    ['2026-10-30', '2026-11-14', { m: 0, d: 15 }],
  ]);
});

test("firstPeriod uses a month's last day when the month is too short for the first payment's day", () => {
  assertFirstPeriods([
    ['2027-01-31', '2027-03-30', { m: 1, d: 28 }],
    ['2028-01-31', '2028-03-30', { m: 1, d: 29 }],
    ['2028-01-30', '2028-03-30', { m: 2, d: 0 }],
  ]);
});

test("firstPeriod uses each earlier month's last day when the first payment is on its month's last day", () => {
  assertFirstPeriods([
    ['2027-01-15', '2027-02-28', { m: 1, d: 16 }],
    ['2028-01-29', '2028-02-29', { m: 1, d: 2 }],
    ['2026-10-30', '2026-11-30', { m: 1, d: 1 }],
  ]);
});

test('firstPeriod counts across the end of a year', () => {
  assertFirstPeriods([
    ['2026-12-20', '2027-02-03', { m: 1, d: 14 }],
    ['2026-11-15', '2027-01-15', { m: 2, d: 0 }],
  ]);
});

test('firstPeriod counts whole calendar days when the clocks change between the dates', () => {
  assertFirstPeriods([
    ['2026-10-25', '2026-11-08', { m: 0, d: 14 }],
    ['2027-03-10', '2027-04-01', { m: 0, d: 22 }],
  ]);
});

test('firstPeriod counts years 0 to 99 as written, not as 1900 to 1999', () => {
  assertFirstPeriods([
    ['0099-12-31', '0100-01-31', { m: 1, d: 0 }],
    ['0100-01-01', '0099-12-31', null],
    ['0000-02-28', '0000-03-01', { m: 0, d: 2 }],
    ['0002-10-30', '2026-12-14', { m: 24289, d: 15 }],
  ]);
});

test('firstPeriod is null unless both dates are real and the first payment is after the contract date', () => {
  assertFirstPeriods([
    ['2026-10-30', '2026-10-30', null],
    ['2026-10-30', '2026-10-01', null],
    ['', '2026-12-14', null],
    ['2026-10-30', '', null],
    ['2026-10-30', '2026-11-31', null],
  ]);
});

test('parseCalendarDate reads YYYY-MM-DD as a year, month and day', () => {
  assert.deepEqual(parseCalendarDate('2026-10-30'), { year: 2026, month: 10, day: 30 });
  assert.deepEqual(parseCalendarDate('2028-02-29'), { year: 2028, month: 2, day: 29 });
  assert.deepEqual(parseCalendarDate('2000-02-29'), { year: 2000, month: 2, day: 29 });
});

test("parseCalendarDate rejects dates that don't exist", () => {
  for (const text of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-10-00', '2026-04-31', '2027-02-29', '2100-02-29']) {
    assert.equal(parseCalendarDate(text), null, text);
  }
});

test('parseCalendarDate rejects blank text and other date formats', () => {
  for (const text of ['', 'abc', '10/30/2026', '2026-10-30T12:00']) {
    assert.equal(parseCalendarDate(text), null, text);
  }
});
