// ABOUTME: Checks reading the form's raw text into DealInputs, with an inline error for each field that can't be used.
// ABOUTME: Covers Example 1 typed field by field, §9's limits, $0 down or rebates when blank, extras and the contract dates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addExtra, editExtra, editField, emptyForm, setTakingCash, stepDownPayment } from '../../site/lib/form.js';
import { readInputs } from '../../site/lib/inputs.js';
import { connecticut } from '../../site/rules/connecticut.js';
import { dealInputs } from '../fixtures.js';

const ENTER_BOTH_DATES = 'Enter both dates.';
const DATES_OUT_OF_ORDER = 'The first payment date must be after the contract date.';
const UNREADABLE_AMOUNT = 'Enter a number, like 36,500.';

// Example 1's fields (SPEC §7.11) as Erik types them, in the order he types them. Every other field is blank.
const EXAMPLE_1_TEXT = {
  salePrice: '$36,500',
  docFee: '699',
  downPayment: '5,000',
  theirApr: '5.9',
  months: '60',
  theirPayment: '699',
  specialApr: '0',
  specialCoversMonths: '36',
  cashInstead: '1,000',
  outsideApr: '5.5',
};

// An empty form with each field in `texts` typed in, in the order given.
function typed(texts) {
  return Object.entries(texts).reduce((form, [name, text]) => editField(form, name, text), emptyForm());
}

// Reads an empty form with only this one field typed in.
function readOne(name, text) {
  return readInputs(editField(emptyForm(), name, text));
}

test("Example 1, typed field by field, reads as Example 1's DealInputs with no errors", () => {
  assert.deepEqual(readInputs(typed(EXAMPLE_1_TEXT)), {
    inputs: dealInputs(),
    errors: {},
    extraErrors: {},
    dateHint: null,
  });
});

test('every field reads into its own DealInputs value', () => {
  const form = typed({
    stickerTotal: '38,000',
    targetPrice: '35,900',
    salePrice: '$36,500',
    rebates: '500',
    docFee: '699',
    titleRegistration: '300',
    theirTax: '2,362.14',
    theirDriveAway: '39,825.14',
    downPayment: '5,000',
    theirApr: '5.9',
    months: '60',
    theirPayment: '671.65',
    specialApr: '0.9',
    specialCoversMonths: '36',
    cashInstead: '1,000',
    outsideApr: '5.5',
    contractAmountFinanced: '38,010.32',
    contractFinanceCharge: '5,974.48',
    contractTotalOfPayments: '43,984.80',
    contractApr: '6.135',
    contractPayment: '733.08',
    contractPaymentCount: '59',
    contractFinalPayment: '732.98',
    contractDate: '2026-10-30',
    firstPaymentDate: '2026-12-14',
  });
  assert.deepEqual(readInputs(setTakingCash(form, true)), {
    inputs: {
      stickerCents: 3800000,
      targetCents: 3590000,
      saleCents: 3650000,
      rebatesCents: 50000,
      docFeeCents: 69900,
      titleRegistrationCents: 30000,
      theirTaxCents: 236214,
      theirDriveAwayCents: 3982514,
      downCents: 500000,
      quoteDownCents: 500000,
      theirAprMilli: 5900,
      months: 60,
      theirPaymentCents: 67165,
      specialAprMilli: 900,
      specialCoversMonths: 36,
      cashInsteadCents: 100000,
      takingCash: true,
      outsideAprMilli: 5500,
      extras: [],
      contract: {
        amountFinancedCents: 3801032,
        financeChargeCents: 597448,
        totalOfPaymentsCents: 4398480,
        aprMilli: 6135,
        paymentCents: 73308,
        paymentCount: 59,
        finalPaymentCents: 73298,
        timing: { m: 1, d: 15 },
      },
    },
    errors: {},
    extraErrors: {},
    dateHint: null,
  });
});

test('an empty form reads as blank everywhere, with the down payment and rebates at $0', () => {
  assert.deepEqual(readInputs(emptyForm()), {
    inputs: {
      stickerCents: null,
      targetCents: null,
      saleCents: null,
      rebatesCents: 0,
      docFeeCents: null,
      titleRegistrationCents: null,
      theirTaxCents: null,
      theirDriveAwayCents: null,
      downCents: 0,
      quoteDownCents: 0,
      theirAprMilli: null,
      months: null,
      theirPaymentCents: null,
      specialAprMilli: null,
      specialCoversMonths: null,
      cashInsteadCents: null,
      takingCash: false,
      outsideAprMilli: null,
      extras: [],
      contract: {
        amountFinancedCents: null,
        financeChargeCents: null,
        totalOfPaymentsCents: null,
        aprMilli: null,
        paymentCents: null,
        paymentCount: null,
        finalPaymentCents: null,
        timing: null,
      },
    },
    errors: {},
    extraErrors: {},
    dateHint: null,
  });
});

test('an unreadable sale price shows an error and counts as blank', () => {
  const { inputs, errors } = readInputs(typed({ ...EXAMPLE_1_TEXT, salePrice: 'abc' }));
  assert.deepEqual(errors, { salePrice: UNREADABLE_AMOUNT });
  assert.equal(inputs.saleCents, null);
});

test('negative text, or text past the limits for amounts and rates, shows an error and counts as blank', () => {
  const { inputs, errors } = readInputs(typed({
    ...EXAMPLE_1_TEXT,
    docFee: '-699',
    theirPayment: '699.001',
    cashInstead: '500,000.01',
    theirApr: '30.001',
    outsideApr: '5.1234',
  }));
  assert.deepEqual(errors, {
    docFee: "Can't be negative.",
    theirPayment: 'Use at most 2 decimals.',
    cashInstead: 'Must be $500,000 or less.',
    theirApr: 'Must be 30% or less.',
    outsideApr: 'Use at most 3 decimals.',
  });
  assert.deepEqual(
    inputs,
    dealInputs({ docFeeCents: null, theirPaymentCents: null, cashInsteadCents: null, theirAprMilli: null, outsideAprMilli: null }),
  );
});

test('amounts read from $0 to $500,000 and rates from 0% to 30%', () => {
  const { inputs, errors } = readInputs(typed({ salePrice: '500,000', docFee: '0', theirApr: '30', outsideApr: '0' }));
  assert.deepEqual(errors, {});
  assert.equal(inputs.saleCents, 50000000);
  assert.equal(inputs.docFeeCents, 0);
  assert.equal(inputs.theirAprMilli, 30000);
  assert.equal(inputs.outsideAprMilli, 0);
});

test('months, "covers loans up to" and the number of payments read whole numbers from 1 to 96', () => {
  const valueReaders = {
    months: (inputs) => inputs.months,
    specialCoversMonths: (inputs) => inputs.specialCoversMonths,
    contractPaymentCount: (inputs) => inputs.contract.paymentCount,
  };
  for (const [name, valueIn] of Object.entries(valueReaders)) {
    assert.equal(valueIn(readOne(name, '1').inputs), 1, name);
    assert.equal(valueIn(readOne(name, '96').inputs), 96, name);
    for (const [text, error] of [['0', 'Must be from 1 to 96.'], ['97', 'Must be from 1 to 96.'], ['60.5', 'Enter a whole number.']]) {
      const { inputs, errors } = readOne(name, text);
      assert.equal(valueIn(inputs), null, `${name} '${text}'`);
      assert.deepEqual(errors, { [name]: error }, `${name} '${text}'`);
    }
  }
});

test('a blank or invalid down payment or rebates counts as $0, and invalid text still shows its error', () => {
  const blank = readInputs(typed({ ...EXAMPLE_1_TEXT, downPayment: '' }));
  assert.equal(blank.inputs.downCents, 0);
  assert.equal(blank.inputs.rebatesCents, 0);
  assert.deepEqual(blank.errors, {});
  const invalid = readInputs(typed({ ...EXAMPLE_1_TEXT, downPayment: 'abc', rebates: 'x' }));
  assert.equal(invalid.inputs.downCents, 0);
  assert.equal(invalid.inputs.rebatesCents, 0);
  assert.deepEqual(invalid.errors, { downPayment: UNREADABLE_AMOUNT, rebates: UNREADABLE_AMOUNT });
});

test('a quote given at a blank or invalid down payment is tied to the same $0 the down payment counts as', () => {
  for (const downPayment of ['', 'abc']) {
    const { inputs } = readInputs(typed({ ...EXAMPLE_1_TEXT, downPayment }));
    assert.equal(inputs.quoteDownCents, inputs.downCents, `'${downPayment}'`);
  }
});

test('the down payment and the one the quote is tied to come from the form separately', () => {
  const { inputs } = readInputs(stepDownPayment(typed(EXAMPLE_1_TEXT), 50000));
  assert.equal(inputs.downCents, 550000);
  assert.equal(inputs.quoteDownCents, 500000);
});

test("each extra's price reads into cents, with a blank price at $0, and its other parts carry over", () => {
  let form = addExtra(addExtra(typed(EXAMPLE_1_TEXT), 'warranty', connecticut), 'gap', connecticut);
  form = editExtra(form, 'extra-1', { name: 'Platinum plan', priceText: '$2,995', inDeal: true });
  const { inputs, errors, extraErrors } = readInputs(form);
  assert.deepEqual(inputs.extras, [
    { id: 'extra-1', type: 'warranty', name: 'Platinum plan', priceCents: 299500, inDeal: true, taxed: true },
    { id: 'extra-2', type: 'gap', name: 'GAP', priceCents: 0, inDeal: false, taxed: false },
  ]);
  assert.deepEqual(errors, {});
  assert.deepEqual(extraErrors, {});
});

test("an extra's unreadable or out-of-range price shows an error under the extra's id and counts as $0", () => {
  let form = addExtra(addExtra(addExtra(emptyForm(), 'warranty', connecticut), 'gap', connecticut), 'vinEtch', connecticut);
  form = editExtra(form, 'extra-1', { priceText: 'abc' });
  form = editExtra(form, 'extra-2', { priceText: '500,000.01' });
  form = editExtra(form, 'extra-3', { priceText: '400' });
  const { inputs, errors, extraErrors } = readInputs(form);
  assert.deepEqual(inputs.extras.map((extra) => extra.priceCents), [0, 0, 40000]);
  assert.deepEqual(extraErrors, { 'extra-1': UNREADABLE_AMOUNT, 'extra-2': 'Must be $500,000 or less.' });
  assert.deepEqual(errors, {});
});

test('with only one contract date entered, the dates ask for both and count as blank', () => {
  for (const name of ['contractDate', 'firstPaymentDate']) {
    const { inputs, errors, dateHint } = readOne(name, '2026-10-30');
    assert.equal(dateHint, ENTER_BOTH_DATES, name);
    assert.equal(inputs.contract.timing, null, name);
    assert.deepEqual(errors, {}, name);
  }
});

test("both contract dates, in order, set the first payment's timing", () => {
  const { inputs, errors, dateHint } = readInputs(typed({ contractDate: '2026-10-30', firstPaymentDate: '2026-12-14' }));
  assert.deepEqual(inputs.contract.timing, { m: 1, d: 15 });
  assert.equal(dateHint, null);
  assert.deepEqual(errors, {});
});

test('a first payment date on or before the contract date shows an error there, and the dates count as blank', () => {
  for (const firstPaymentDate of ['2026-10-01', '2026-10-30']) {
    const { inputs, errors, dateHint } = readInputs(typed({ contractDate: '2026-10-30', firstPaymentDate }));
    assert.deepEqual(errors, { firstPaymentDate: DATES_OUT_OF_ORDER }, firstPaymentDate);
    assert.equal(inputs.contract.timing, null, firstPaymentDate);
    assert.equal(dateHint, null, firstPaymentDate);
  }
});

test("date text that isn't a real date counts as not entered, as the date picker would show it", () => {
  const oneReal = readInputs(typed({ contractDate: '2026-10-30', firstPaymentDate: '2026-02-30' }));
  assert.equal(oneReal.dateHint, ENTER_BOTH_DATES);
  assert.equal(oneReal.inputs.contract.timing, null);
  assert.deepEqual(oneReal.errors, {});
  const noneReal = readInputs(typed({ contractDate: '10/30/2026', firstPaymentDate: 'soon' }));
  assert.equal(noneReal.dateHint, null);
  assert.equal(noneReal.inputs.contract.timing, null);
  assert.deepEqual(noneReal.errors, {});
});
