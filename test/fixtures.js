// ABOUTME: SPEC.md §7.11's worked examples for the tests: Example 1 as text, inputs and a Deal, and expected results.
// ABOUTME: Tests change Example 1 with overrides and extra(); contract overrides change only the fields they name.
import { deriveDeal } from '../site/lib/deal.js';
import { editField, emptyForm } from '../site/lib/form.js';
import { connecticut } from '../site/rules/connecticut.js';

// Example 1's fields (SPEC §7.11) as Erik types them, in the order he types them. Every other field is blank.
export const EXAMPLE_1_TEXT = {
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

// The form with each field in `texts` typed in, in the order given: an empty form unless `form` is given.
export function typed(texts, form = emptyForm()) {
  return Object.entries(texts).reduce((current, [name, text]) => editField(current, name, text), form);
}

// Example 1's deal as DealInputs: a $36,500 sale with a $699 doc fee and $5,000 down, quoted at 5.9% for 60 months
// at $699.00, with a 0% special for loans up to 36 months or $1,000 cash instead, and a 5.5% outside rate. The quote
// was given at the $5,000 down, and the contract section is blank. Each call gives a fresh object. Fields in
// `overrides` replace Example 1's, and the fields in `overrides.contract` replace the blank contract's.
export function dealInputs(overrides = {}) {
  const { contract = {}, ...fields } = overrides;
  return {
    stickerCents: null,
    targetCents: null,
    saleCents: 3650000,
    rebatesCents: 0,
    docFeeCents: 69900,
    titleRegistrationCents: null,
    theirTaxCents: null,
    theirDriveAwayCents: null,
    downCents: 500000,
    quoteDownCents: 500000,
    theirAprMilli: 5900,
    months: 60,
    theirPaymentCents: 69900,
    specialAprMilli: 0,
    specialCoversMonths: 36,
    cashInsteadCents: 100000,
    takingCash: false,
    outsideAprMilli: 5500,
    extras: [],
    ...fields,
    contract: {
      amountFinancedCents: null,
      financeChargeCents: null,
      totalOfPaymentsCents: null,
      aprMilli: null,
      paymentCents: null,
      paymentCount: null,
      finalPaymentCents: null,
      timing: null,
      ...contract,
    },
  };
}

// An extra as DealInputs holds it, named after its type. It's out of the deal and has its type's default Taxed
// setting unless `changes` says otherwise.
export function extra(id, type, priceCents, changes = {}) {
  const { label, taxedByDefault } = connecticut.extraTypes[type];
  return { id, type, name: label, priceCents, inDeal: false, taxed: taxedByDefault, ...changes };
}

// The Deal for Example 1's inputs with `overrides` applied.
export function dealWith(overrides = {}) {
  return deriveDeal(dealInputs(overrides), connecticut);
}

// The contract dates of Examples 2–4 (§7.11): the first payment 1 month and 15 days after signing.
export const CONTRACT_DATES = { contractDate: '2026-10-30', firstPaymentDate: '2026-12-14' };

// Example 3's contract (§7.11) as typed into the contract section: Example 1's deal with a $2,995 warranty and its
// $190.18 tax added to the amount financed.
export const EXAMPLE_3_CONTRACT_TEXT = {
  contractAmountFinanced: '38,010.32',
  contractFinanceCharge: '5,974.48',
  contractTotalOfPayments: '43,984.80',
  contractApr: '5.9',
  contractPayment: '733.08',
  contractPaymentCount: '60',
  ...CONTRACT_DATES,
};

// Example 1's Verdict cards (§7.11) as [severity, headline], in order.
export const EXAMPLE_1_VERDICTS = [
  ['red', "$699.00/mo doesn't add up."],
  ['amber', "You're not getting the 0% special or the $1,000 cash."],
  ['amber', '0.4 points over your outside rate.'],
  ['green', 'The 0% special beats the $1,000 cash by about $1,790.'],
  ['green', '$699 doc fee.'],
  ['green', 'No extras in the deal.'],
];

// Example 1's summary strip (§7.11).
export const EXAMPLE_1_STRIP = {
  driveAway: '$39,825',
  shouldBe: 'should be $671.65',
  theirs: 'theirs $699.00',
  problems: '3 problems',
};

// Example 1's payment card sentence (§7.11).
export const EXAMPLE_1_PAYMENT_SENTENCE =
  'At 5.9% for 60 months it should be $671.65 to $673.30. Either the real rate is at least 7.44%, or at least '
  + '$1,320 extra is in the loan, or the first payment is more than 45 days away.';
