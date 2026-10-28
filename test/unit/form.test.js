// ABOUTME: Checks the form state: field text, the down payment the quote is tied to, the ± steps, the switch and extras.
// ABOUTME: Also checks the saved format, which reads back only text with this version and exactly this shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELD_NAMES,
  FORM_VERSION,
  addExtra,
  deserializeForm,
  editExtra,
  editField,
  emptyForm,
  removeExtra,
  serializeForm,
  setTakingCash,
  stepDownPayment,
} from '../../site/lib/form.js';
import { connecticut } from '../../site/rules/connecticut.js';

// Freezes a value and everything inside it, so a change that writes to it throws.
function deepFreeze(value) {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// A form with their payment typed and then a $5,000 down payment, so the quote is tied to $5,000 down.
function quotedAtFiveThousandDown() {
  return editField(editField(emptyForm(), 'theirPayment', '699'), 'downPayment', '5000');
}

// A form with something in every part: field text, invalid text, a down payment moved off the quote's, the switch on,
// and two extras, one of them edited.
function filledForm() {
  let form = editField(emptyForm(), 'salePrice', '$36,500');
  form = editField(form, 'downPayment', '5,000');
  form = editField(form, 'theirPayment', '699');
  form = editField(form, 'months', 'abc');
  form = stepDownPayment(form, 50000);
  form = setTakingCash(form, true);
  form = addExtra(form, 'warranty', connecticut);
  form = addExtra(form, 'gap', connecticut);
  return editExtra(form, 'extra-1', { name: 'Platinum plan', priceText: '2,995', inDeal: true });
}

// The saved text of filledForm(), after `change` is made to its parsed copy.
function savedWith(change) {
  const saved = JSON.parse(serializeForm(filledForm()));
  change(saved);
  return JSON.stringify(saved);
}

test('FIELD_NAMES lists every field in the order the Price and Loan tabs show them', () => {
  assert.deepEqual(FIELD_NAMES, [
    'stickerTotal',
    'targetPrice',
    'salePrice',
    'rebates',
    'docFee',
    'titleRegistration',
    'theirTax',
    'theirDriveAway',
    'downPayment',
    'theirApr',
    'months',
    'theirPayment',
    'specialApr',
    'specialCoversMonths',
    'cashInstead',
    'outsideApr',
    'contractAmountFinanced',
    'contractFinanceCharge',
    'contractTotalOfPayments',
    'contractApr',
    'contractPayment',
    'contractPaymentCount',
    'contractFinalPayment',
    'contractDate',
    'firstPaymentDate',
  ]);
});

test('an empty form has every field blank, the switch off, no extras, and the quote tied to $0 down', () => {
  assert.equal(FORM_VERSION, 1);
  assert.deepEqual(emptyForm(), {
    version: 1,
    fields: Object.fromEntries(FIELD_NAMES.map((name) => [name, ''])),
    takingCash: false,
    quoteDownCents: 0,
    nextExtraId: 1,
    extras: [],
  });
});

test('each empty form is a fresh object', () => {
  const first = emptyForm();
  first.fields.salePrice = '36,500';
  first.extras.push('changed');
  assert.equal(emptyForm().fields.salePrice, '');
  assert.deepEqual(emptyForm().extras, []);
});

test('editField sets one field to the text exactly as typed and leaves the other fields alone', () => {
  const form = editField(editField(emptyForm(), 'salePrice', ' $36,500 '), 'docFee', 'abc');
  assert.deepEqual(form.fields, { ...emptyForm().fields, salePrice: ' $36,500 ', docFee: 'abc' });
});

test('the quote is tied to the down payment typed last, whichever of the two fields was typed later', () => {
  const paymentFirst = editField(editField(emptyForm(), 'theirPayment', '699'), 'downPayment', '5000');
  assert.equal(paymentFirst.quoteDownCents, 500000);
  const downFirst = editField(editField(emptyForm(), 'downPayment', '5000'), 'theirPayment', '699');
  assert.equal(downFirst.quoteDownCents, 500000);
  assert.equal(editField(emptyForm(), 'theirPayment', '699').quoteDownCents, 0);
});

test('a blank or invalid down payment ties the quote to $0', () => {
  const quoted = editField(editField(emptyForm(), 'downPayment', '5,000'), 'theirPayment', '699');
  assert.equal(editField(quoted, 'downPayment', '').quoteDownCents, 0);
  assert.equal(editField(quoted, 'downPayment', 'abc').quoteDownCents, 0);
  assert.equal(editField(quoted, 'downPayment', '-500').quoteDownCents, 0);
  assert.equal(editField(editField(quoted, 'downPayment', 'abc'), 'theirPayment', '700').quoteDownCents, 0);
});

test('typing any other field leaves the quote tied where it was', () => {
  const stepped = stepDownPayment(quotedAtFiveThousandDown(), 50000);
  for (const name of FIELD_NAMES.filter((field) => field !== 'theirPayment' && field !== 'downPayment')) {
    assert.equal(editField(stepped, name, '1').quoteDownCents, 500000, name);
  }
});

test('the down payment buttons move the down payment $500 at a time and leave the quote tied where it was', () => {
  const up = stepDownPayment(quotedAtFiveThousandDown(), 50000);
  assert.equal(up.fields.downPayment, '5,500');
  assert.equal(up.quoteDownCents, 500000);
  const back = stepDownPayment(up, -50000);
  assert.equal(back.fields.downPayment, '5,000');
  assert.equal(back.quoteDownCents, 500000);
});

test('typing their payment or a down payment after a step ties the quote to the down payment then in the field', () => {
  const stepped = stepDownPayment(quotedAtFiveThousandDown(), 50000);
  assert.equal(editField(stepped, 'theirPayment', '699').quoteDownCents, 550000);
  assert.equal(editField(stepped, 'downPayment', '6,000').quoteDownCents, 600000);
});

test('−$500 stops at $0, and the buttons count a blank or invalid down payment as $0', () => {
  const once = stepDownPayment(emptyForm(), -50000);
  assert.equal(once.fields.downPayment, '0');
  assert.equal(stepDownPayment(once, -50000).fields.downPayment, '0');
  assert.equal(stepDownPayment(editField(emptyForm(), 'downPayment', '$300'), -50000).fields.downPayment, '0');
  assert.equal(stepDownPayment(editField(emptyForm(), 'downPayment', 'abc'), 50000).fields.downPayment, '500');
  assert.equal(stepDownPayment(emptyForm(), 50000).fields.downPayment, '500');
});

test('the down payment buttons keep the cents of a down payment that has them', () => {
  const form = editField(emptyForm(), 'downPayment', '5,000.50');
  assert.equal(stepDownPayment(form, 50000).fields.downPayment, '5,500.50');
});

test('setTakingCash switches Taking the cash instead on and off', () => {
  const on = setTakingCash(emptyForm(), true);
  assert.equal(on.takingCash, true);
  assert.equal(setTakingCash(on, false).takingCash, false);
});

test('an added extra is named after its type, priced blank, out of the deal, and taxed as its type is by default', () => {
  const warranty = addExtra(emptyForm(), 'warranty', connecticut);
  assert.deepEqual(warranty.extras, [
    { id: 'extra-1', type: 'warranty', name: 'Extended warranty', priceText: '', inDeal: false, taxed: true },
  ]);
  assert.equal(warranty.nextExtraId, 2);
  const gap = addExtra(warranty, 'gap', connecticut);
  assert.deepEqual(gap.extras[1], { id: 'extra-2', type: 'gap', name: 'GAP', priceText: '', inDeal: false, taxed: false });
});

test('extra ids count up and are never reused after an extra is removed', () => {
  let form = addExtra(emptyForm(), 'warranty', connecticut);
  form = addExtra(form, 'gap', connecticut);
  form = removeExtra(form, 'extra-2');
  form = addExtra(form, 'vinEtch', connecticut);
  assert.deepEqual(form.extras.map((extra) => extra.id), ['extra-1', 'extra-3']);
  assert.equal(form.nextExtraId, 4);
});

test('editExtra changes only the named parts of the one extra with that id', () => {
  const form = addExtra(addExtra(emptyForm(), 'warranty', connecticut), 'gap', connecticut);
  const edited = editExtra(form, 'extra-2', { name: 'Lender GAP', priceText: '895', inDeal: true, taxed: true });
  assert.deepEqual(edited.extras, [
    form.extras[0],
    { id: 'extra-2', type: 'gap', name: 'Lender GAP', priceText: '895', inDeal: true, taxed: true },
  ]);
  assert.equal(editExtra(form, 'extra-1', { priceText: 'abc' }).extras[0].priceText, 'abc');
});

test('removeExtra takes out only the extra with that id', () => {
  const form = addExtra(addExtra(emptyForm(), 'warranty', connecticut), 'gap', connecticut);
  assert.deepEqual(removeExtra(form, 'extra-1').extras, [form.extras[1]]);
  assert.deepEqual(removeExtra(removeExtra(form, 'extra-1'), 'extra-2').extras, []);
});

test('every change returns a fresh form and leaves the form it was given as it was', () => {
  const form = deepFreeze(filledForm());
  const before = structuredClone(form);
  const changed = [
    editField(form, 'salePrice', '37,000'),
    editField(form, 'theirPayment', '700'),
    stepDownPayment(form, -50000),
    setTakingCash(form, false),
    addExtra(form, 'vinEtch', connecticut),
    editExtra(form, 'extra-2', { priceText: '895' }),
    removeExtra(form, 'extra-1'),
  ];
  for (const after of changed) {
    assert.notEqual(after, form);
  }
  assert.deepEqual(form, before);
});

test('a saved form reads back as the same form, invalid text included', () => {
  const form = filledForm();
  assert.equal(form.fields.months, 'abc');
  assert.deepEqual(deserializeForm(serializeForm(form), connecticut), form);
  assert.deepEqual(deserializeForm(serializeForm(emptyForm()), connecticut), emptyForm());
});

test("saved text that doesn't parse, or that has another version, reads back as null", () => {
  assert.equal(deserializeForm('{bad', connecticut), null);
  assert.equal(deserializeForm('', connecticut), null);
  // Nothing saved yet: localStorage.getItem gives null.
  assert.equal(deserializeForm(null, connecticut), null);
  assert.equal(deserializeForm(savedWith((saved) => { saved.version = 2; }), connecticut), null);
  assert.equal(deserializeForm(savedWith((saved) => { saved.version = '1'; }), connecticut), null);
});

test("saved text with a field missing, a field that isn't text, or a field the form doesn't have reads back as null", () => {
  assert.equal(deserializeForm(savedWith((saved) => { delete saved.fields.months; }), connecticut), null);
  assert.equal(deserializeForm(savedWith((saved) => { saved.fields.months = 60; }), connecticut), null);
  assert.equal(deserializeForm(savedWith((saved) => { saved.fields.months = null; }), connecticut), null);
  assert.equal(deserializeForm(savedWith((saved) => { saved.fields.tradeIn = ''; }), connecticut), null);
  assert.equal(deserializeForm(savedWith((saved) => { saved.fields = []; }), connecticut), null);
});

test("saved text with an extra of a type the rules don't have reads back as null", () => {
  assert.equal(deserializeForm(savedWith((saved) => { saved.extras[1].type = 'rustproof'; }), connecticut), null);
  assert.equal(deserializeForm(savedWith((saved) => { saved.extras[1].type = 'toString'; }), connecticut), null);
  assert.equal(deserializeForm(savedWith((saved) => { saved.extras[1].type = ['gap']; }), connecticut), null);
});

test('saved text with any other shape reads back as null', () => {
  for (const text of ['null', '[]', '"form"', '1']) {
    assert.equal(deserializeForm(text, connecticut), null, text);
  }
  const changes = {
    'switch as text': (saved) => { saved.takingCash = 'true'; },
    'quote down payment as text': (saved) => { saved.quoteDownCents = '500000'; },
    'quote down payment with a fraction': (saved) => { saved.quoteDownCents = 0.5; },
    'next extra id missing': (saved) => { delete saved.nextExtraId; },
    'a key the form does not have': (saved) => { saved.tab = 'Price'; },
    'extras as an object': (saved) => { saved.extras = {}; },
    'an extra that is not an object': (saved) => { saved.extras[0] = 'warranty'; },
    'an extra with its name missing': (saved) => { delete saved.extras[0].name; },
    'an extra with a toggle as text': (saved) => { saved.extras[0].inDeal = 'true'; },
    'an extra with a number id': (saved) => { saved.extras[0].id = 1; },
    'an extra with its price as a number': (saved) => { saved.extras[0].priceText = 2995; },
    'an extra with a key extras do not have': (saved) => { saved.extras[0].priceCents = 299500; },
  };
  for (const [label, change] of Object.entries(changes)) {
    assert.equal(deserializeForm(savedWith(change), connecticut), null, label);
  }
});
