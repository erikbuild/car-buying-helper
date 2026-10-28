// ABOUTME: Works out Connecticut tax, DMV fees, the drive-away total and the amount financed.
// ABOUTME: Also gives what the doc fee and each extra cost, tax included.
import { divideHalfUp } from './numbers.js';

const HUNDRED_PERCENT_BP = 10000;

// Taxes the vehicle base at the vehicle rate and the service base at the standard rate, and rounds the total once,
// half up to the cent (§7.0, §7.1). The vehicle rate is the luxury rate, on the whole vehicle base, when that base is
// over the threshold, and the standard rate otherwise. Returns {taxCents, vehicleBp}.
export function taxOf(vehicleBaseCents, serviceBaseCents, rules) {
  const { standardBp, luxuryBp, luxuryThresholdCents } = rules.tax;
  const vehicleBp = vehicleBaseCents > luxuryThresholdCents ? luxuryBp : standardBp;
  const taxCents = divideHalfUp(vehicleBaseCents * vehicleBp + serviceBaseCents * standardBp, HUNDRED_PERCENT_BP);
  return { taxCents, vehicleBp };
}

// The total price of a list of extras.
function totalPriceCents(extras) {
  return extras.reduce((total, extra) => total + extra.priceCents, 0);
}

// The extras that count toward the deal: the ones in it whose price is entered. The others, out of the deal or
// without a price, count toward nothing (§6.4).
export function pricedExtrasInDeal(inputs) {
  return inputs.extras.filter((extra) => extra.inDeal && extra.priceCents !== null);
}

// The part of an entered title + registration above the DMV fees for a financed car. It's a conveyance fee, so it's
// taxed with the car, and it's measured against the financed fees even in a cash deal (§7.1).
function registrationExcessOf(inputs, rules) {
  return Math.max(0, (inputs.titleRegistrationCents ?? 0) - rules.dmv.financedCents);
}

// The deal's vehicle and service bases (§7.1). The vehicle base holds the sale price, the conveyance fees (the doc fee
// and any registration excess) and the taxed vehicle-class extras in the deal, with a blank sale price or doc fee
// counted as $0. The service base holds the taxed service-class extras in the deal. Only the extras with a price
// count. Rebates and the cash instead reduce neither base.
function taxBasesOf(inputs, rules) {
  const taxedExtras = pricedExtrasInDeal(inputs).filter((extra) => extra.taxed);
  const taxedPriceCents = (taxClass) =>
    totalPriceCents(taxedExtras.filter((extra) => rules.extraTypes[extra.type].taxClass === taxClass));
  const carAndFeesCents = (inputs.saleCents ?? 0) + (inputs.docFeeCents ?? 0) + registrationExcessOf(inputs, rules);
  return {
    vehicleBaseCents: carAndFeesCents + taxedPriceCents('vehicle'),
    serviceBaseCents: taxedPriceCents('service'),
  };
}

// The deal's tax, with everything as entered.
function dealTaxCents(inputs, rules) {
  const { vehicleBaseCents, serviceBaseCents } = taxBasesOf(inputs, rules);
  return taxOf(vehicleBaseCents, serviceBaseCents, rules).taxCents;
}

// The DMV fees used when the title + registration is blank (§7.2): the cash amount, which has no lien fee, when the
// down payment is at least the subtotal plus that amount, and the financed amount otherwise.
function estimatedDmvCents(subtotalCents, downCents, rules) {
  const { cashCents, financedCents } = rules.dmv;
  return downCents >= subtotalCents + cashCents ? cashCents : financedCents;
}

// Works out the deal's tax, DMV fees, drive-away total and amount financed (§7.1, §7.2). An amount financed of $0 or
// less is a cash deal. ctDmvCents is the state's own DMV amount for this kind of deal, for checking an entered
// title + registration. Every field but hasSale is null until the sale price is entered.
export function priceOf(inputs, rules) {
  if (inputs.saleCents === null) {
    return {
      hasSale: false,
      vehicleBaseCents: null,
      vehicleBp: null,
      serviceBaseCents: null,
      taxCents: null,
      registrationExcessCents: null,
      subtotalCents: null,
      dmvCents: null,
      dmvEstimated: null,
      driveAwayCents: null,
      amountFinancedCents: null,
      isCashDeal: null,
      ctDmvCents: null,
    };
  }
  const { vehicleBaseCents, serviceBaseCents } = taxBasesOf(inputs, rules);
  const { taxCents, vehicleBp } = taxOf(vehicleBaseCents, serviceBaseCents, rules);
  const cashTakenCents = inputs.takingCash ? (inputs.cashInsteadCents ?? 0) : 0;
  const subtotalCents = inputs.saleCents + (inputs.docFeeCents ?? 0) + totalPriceCents(pricedExtrasInDeal(inputs))
    + taxCents - inputs.rebatesCents - cashTakenCents;
  const dmvEstimated = inputs.titleRegistrationCents === null;
  const dmvCents = dmvEstimated
    ? estimatedDmvCents(subtotalCents, inputs.downCents, rules)
    : inputs.titleRegistrationCents;
  const driveAwayCents = subtotalCents + dmvCents;
  const amountFinancedCents = driveAwayCents - inputs.downCents;
  const isCashDeal = amountFinancedCents <= 0;
  return {
    hasSale: true,
    vehicleBaseCents,
    vehicleBp,
    serviceBaseCents,
    taxCents,
    registrationExcessCents: registrationExcessOf(inputs, rules),
    subtotalCents,
    dmvCents,
    dmvEstimated,
    driveAwayCents,
    amountFinancedCents,
    isCashDeal,
    ctDmvCents: isCashDeal ? rules.dmv.cashCents : rules.dmv.financedCents,
  };
}

// What adding an amount to the deal costs (§7.7): its price, plus the deal's tax with it minus the deal's tax without
// it. This counts the jump to the luxury rate when the amount pushes the vehicle base over the threshold.
function costWithTaxCents(priceCents, withIt, withoutIt, rules) {
  return priceCents + dealTaxCents(withIt, rules) - dealTaxCents(withoutIt, rules);
}

// The deal with one extra put in it or taken out of it, and everything else as entered.
function withExtraInDeal(inputs, extraId, inDeal) {
  return { ...inputs, extras: inputs.extras.map((extra) => (extra.id === extraId ? { ...extra, inDeal } : extra)) };
}

// What one extra costs, whether or not it's in the deal: its price plus the tax it adds (§7.7), or null while its
// price is blank.
export function itemCostCents(inputs, rules, extraId) {
  const { priceCents } = inputs.extras.find((extra) => extra.id === extraId);
  if (priceCents === null) {
    return null;
  }
  const withIt = withExtraInDeal(inputs, extraId, true);
  const withoutIt = withExtraInDeal(inputs, extraId, false);
  return costWithTaxCents(priceCents, withIt, withoutIt, rules);
}

// What the doc fee costs: its amount plus the tax it adds (§7.7), or null while it's blank.
export function docFeeCostCents(inputs, rules) {
  if (inputs.docFeeCents === null) {
    return null;
  }
  return costWithTaxCents(inputs.docFeeCents, inputs, { ...inputs, docFeeCents: 0 }, rules);
}

// What the extras in the deal cost, taken as one item (§7.7): their prices plus the tax minus the tax with none of
// them in the deal. Only the ones with a price count, so it's $0 when no extra in the deal has a price.
export function extrasInDealCostCents(inputs, rules) {
  return costWithTaxCents(totalPriceCents(pricedExtrasInDeal(inputs)), inputs, { ...inputs, extras: [] }, rules);
}
