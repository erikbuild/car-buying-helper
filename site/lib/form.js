// ABOUTME: Holds the raw text of every field and each extra, which is what the page saves.
// ABOUTME: Every change returns a fresh form; also turns a form into saved text and back.
import { formatAmountForField, parseAmount } from './numbers.js';

// The page's fields, in the order the Price and Loan tabs show them. A form holds each one's text exactly as typed.
export const FIELD_NAMES = [
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
];

// The saved format's version. Saved text with any other version is ignored, and the page starts fresh (§9).
export const FORM_VERSION = 1;

// A form with every field blank, Taking the cash instead off and no extras. The quote is tied to the $0 that a blank
// down payment counts as.
export function emptyForm() {
  return {
    version: FORM_VERSION,
    fields: Object.fromEntries(FIELD_NAMES.map((name) => [name, ''])),
    takingCash: false,
    quoteDownCents: 0,
    nextExtraId: 1,
    extras: [],
  };
}

// The down payment in the fields, in cents. Blank or invalid text counts as $0 (§9).
function downPaymentCents(fields) {
  return parseAmount(fields.downPayment).cents ?? 0;
}

// The form with one field's text changed. Typing their payment or a down payment ties the quote to the down payment
// in the field at that moment, so it doesn't matter which of the two is typed first (§6.3).
export function editField(form, name, text) {
  const fields = { ...form.fields, [name]: text };
  const tiesQuote = name === 'theirPayment' || name === 'downPayment';
  return { ...form, fields, quoteDownCents: tiesQuote ? downPaymentCents(fields) : form.quoteDownCents };
}

// The form with the down payment moved by deltaCents, stopping at $0, as the −$500 and +$500 buttons do. The quote
// stays tied to its own down payment, so the buttons try out other down payments without moving it (§6.3).
export function stepDownPayment(form, deltaCents) {
  const downCents = Math.max(0, downPaymentCents(form.fields) + deltaCents);
  return { ...form, fields: { ...form.fields, downPayment: formatAmountForField(downCents) } };
}

// The form with Taking the cash instead switched on or off.
export function setTakingCash(form, on) {
  return { ...form, takingCash: on };
}

// The form with an extra of this type added at the end: named after its type, with a blank price, out of the deal,
// and taxed as the rules say its type is by default. Each extra gets an id that no other extra has had.
export function addExtra(form, type, rules) {
  const { label, taxedByDefault } = rules.extraTypes[type];
  const extra = {
    id: `extra-${form.nextExtraId}`,
    type,
    name: label,
    priceText: '',
    inDeal: false,
    taxed: taxedByDefault,
  };
  return { ...form, nextExtraId: form.nextExtraId + 1, extras: [...form.extras, extra] };
}

// The form with the parts named in `changes` (name, priceText, inDeal, taxed) replaced on the extra with this id.
export function editExtra(form, id, changes) {
  return { ...form, extras: form.extras.map((extra) => (extra.id === id ? { ...extra, ...changes } : extra)) };
}

// The form without the extra with this id.
export function removeExtra(form, id) {
  return { ...form, extras: form.extras.filter((extra) => extra.id !== id) };
}

// The form as the text the page saves.
export function serializeForm(form) {
  return JSON.stringify(form);
}

// Reads saved text back into a form. Returns null, so the page starts fresh, when the text doesn't parse or has a
// different version or shape, including an extra of a type the rules don't have (§9).
export function deserializeForm(text, rules) {
  let saved;
  try {
    saved = JSON.parse(text);
  } catch {
    return null;
  }
  return isSavedForm(saved, rules) ? saved : null;
}

// True when `saved` has this version and exactly a form's shape, with every extra of a type the rules have.
function isSavedForm(saved, rules) {
  const isExtra = (extra) => hasShape(extra, {
    id: isString,
    type: (type) => isString(type) && Object.hasOwn(rules.extraTypes, type),
    name: isString,
    priceText: isString,
    inDeal: isBoolean,
    taxed: isBoolean,
  });
  return hasShape(saved, {
    version: (version) => version === FORM_VERSION,
    fields: (fields) => hasShape(fields, Object.fromEntries(FIELD_NAMES.map((name) => [name, isString]))),
    takingCash: isBoolean,
    quoteDownCents: Number.isInteger,
    nextExtraId: Number.isInteger,
    extras: (extras) => Array.isArray(extras) && extras.every(isExtra),
  });
}

// True when value is an object with exactly the keys in `checks`, and each key's value passes its check.
function hasShape(value, checks) {
  return typeof value === 'object'
    && value !== null
    && Object.keys(value).length === Object.keys(checks).length
    && Object.entries(checks).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
}

function isString(value) {
  return typeof value === 'string';
}

function isBoolean(value) {
  return typeof value === 'boolean';
}
