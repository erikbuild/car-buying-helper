// ABOUTME: Reads the form's raw text into the parsed numbers the deal checks use.
// ABOUTME: Gives an inline error for each field that's unreadable or out of range, and counts it as blank.
import { firstPeriod, parseCalendarDate } from './calendar.js';
import { parseAmount, parseRate, parseWholeNumber } from './numbers.js';

// Months, "covers loans up to" and the number of payments are whole numbers in this range (§9).
const MONTH_COUNT_LIMITS = { min: 1, max: 96 };

const ENTER_BOTH_DATES = 'Enter both dates.';
const DATES_OUT_OF_ORDER = 'The first payment date must be after the contract date.';
const MORE_THAN_3_MONTHS_AFTER = 'More than 3 months after the contract date. Check the dates.';

// Keeps a parse result's error, when it has one, in `errors` under `key`, and returns the result.
function noteError(errors, key, result) {
  if (result.error !== null) {
    errors[key] = result.error;
  }
  return result;
}

// Whether a first payment m whole months plus d days after the contract date is more than 3 months after it (§7.3).
function isMoreThan3Months({ m, d }) {
  return m > 3 || (m === 3 && d > 0);
}

// Reads the two contract dates as {timing, dateHint, error} (§6.3). They count only as a pair, with the first payment
// after the contract date and no more than 3 months after it, and then the timing is the first period between them
// (§7.3). Anything else counts as blank: with one date entered, dateHint asks for both, and with the first payment on
// or before the contract date, or more than 3 months after it, error says so. A date counts as entered when it's a
// real date, which is all a date picker shows.
function readContractDates(fields) {
  const contractDateEntered = parseCalendarDate(fields.contractDate) !== null;
  const firstPaymentDateEntered = parseCalendarDate(fields.firstPaymentDate) !== null;
  if (contractDateEntered !== firstPaymentDateEntered) {
    return { timing: null, dateHint: ENTER_BOTH_DATES, error: null };
  }
  const timing = firstPeriod(fields.contractDate, fields.firstPaymentDate);
  if (timing !== null && isMoreThan3Months(timing)) {
    return { timing: null, dateHint: null, error: MORE_THAN_3_MONTHS_AFTER };
  }
  const outOfOrder = contractDateEntered && timing === null;
  return { timing, dateHint: null, error: outOfOrder ? DATES_OUT_OF_ORDER : null };
}

// Reads the form into DealInputs. A field whose text is unreadable, negative or out of range (§9) counts as blank, and
// its message is in `errors`, by field name. An extra's price works the same way, with its message in `extraErrors`,
// by extra id. A blank or invalid down payment, rebates or extra price counts as $0. dateHint asks for both contract
// dates while only one is entered, and is null otherwise. Dates in the wrong order, or a first payment more than
// 3 months after the contract date, put an error on firstPaymentDate.
export function readInputs(form) {
  const { fields } = form;
  const errors = {};
  const amount = (name) => noteError(errors, name, parseAmount(fields[name])).cents;
  const rate = (name) => noteError(errors, name, parseRate(fields[name])).milli;
  const monthCount = (name) => noteError(errors, name, parseWholeNumber(fields[name], MONTH_COUNT_LIMITS)).value;
  const extraErrors = {};
  const extras = form.extras.map(({ id, type, name, priceText, inDeal, taxed }) => ({
    id,
    type,
    name,
    priceCents: noteError(extraErrors, id, parseAmount(priceText)).cents ?? 0,
    inDeal,
    taxed,
  }));
  const { timing, dateHint } = noteError(errors, 'firstPaymentDate', readContractDates(fields));
  const inputs = {
    stickerCents: amount('stickerTotal'),
    targetCents: amount('targetPrice'),
    saleCents: amount('salePrice'),
    rebatesCents: amount('rebates') ?? 0,
    docFeeCents: amount('docFee'),
    titleRegistrationCents: amount('titleRegistration'),
    theirTaxCents: amount('theirTax'),
    theirDriveAwayCents: amount('theirDriveAway'),
    downCents: amount('downPayment') ?? 0,
    quoteDownCents: form.quoteDownCents,
    theirAprMilli: rate('theirApr'),
    months: monthCount('months'),
    theirPaymentCents: amount('theirPayment'),
    specialAprMilli: rate('specialApr'),
    specialCoversMonths: monthCount('specialCoversMonths'),
    cashInsteadCents: amount('cashInstead'),
    takingCash: form.takingCash,
    outsideAprMilli: rate('outsideApr'),
    extras,
    contract: {
      amountFinancedCents: amount('contractAmountFinanced'),
      financeChargeCents: amount('contractFinanceCharge'),
      totalOfPaymentsCents: amount('contractTotalOfPayments'),
      aprMilli: rate('contractApr'),
      paymentCents: amount('contractPayment'),
      paymentCount: monthCount('contractPaymentCount'),
      finalPaymentCents: amount('contractFinalPayment'),
      timing,
    },
  };
  return { inputs, errors, extraErrors, dateHint };
}
