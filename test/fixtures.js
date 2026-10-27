// ABOUTME: Example 1 from SPEC.md §7.11 as parsed deal inputs, the deal the unit tests start from.
// ABOUTME: Tests pass overrides to change it; contract overrides change only the contract fields they name.

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
