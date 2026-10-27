// ABOUTME: Checks Connecticut tax, DMV fees, the drive-away total and the amount financed against SPEC.md §7.1, §7.2 and §7.11.
// ABOUTME: Also checks what the doc fee and the extras cost with the tax they add (§7.7), including the jump to 7.75%.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docFeeCostCents, extrasInDealCostCents, itemCostCents, priceOf, taxOf } from '../../site/lib/price.js';
import { connecticut } from '../../site/rules/connecticut.js';
import { dealInputs } from '../fixtures.js';

// An extra as DealInputs holds it, named after its type. It's out of the deal and has its type's default Taxed
// setting unless `changes` says otherwise.
function extra(id, type, priceCents, changes = {}) {
  const { label, taxedByDefault } = connecticut.extraTypes[type];
  return { id, type, name: label, priceCents, inDeal: false, taxed: taxedByDefault, ...changes };
}

// Checks the fields that `expected` names in the price of Example 1's deal with `overrides` applied.
function assertPrice(overrides, expected) {
  const price = priceOf(dealInputs(overrides), connecticut);
  const actual = Object.fromEntries(Object.keys(expected).map((name) => [name, price[name]]));
  assert.deepEqual(actual, expected);
}

test("priceOf works out Example 1's tax, estimated DMV fees, drive-away total and amount financed", () => {
  assert.deepEqual(priceOf(dealInputs(), connecticut), {
    hasSale: true,
    vehicleBaseCents: 3719900,
    vehicleBp: 635,
    serviceBaseCents: 0,
    taxCents: 236214,
    registrationExcessCents: 0,
    subtotalCents: 3956114,
    dmvCents: 26400,
    dmvEstimated: true,
    driveAwayCents: 3982514,
    amountFinancedCents: 3482514,
    isCashDeal: false,
    ctDmvCents: 26400,
  });
});

test('taking the cash instead and rebates come off the drive-away total but leave the tax alone', () => {
  assertPrice({ takingCash: true }, { taxCents: 236214, driveAwayCents: 3882514, amountFinancedCents: 3382514 });
  assertPrice({ rebatesCents: 50000 }, { taxCents: 236214, driveAwayCents: 3932514, amountFinancedCents: 3432514 });
});

test('taking the cash instead takes nothing off while the cash instead is blank', () => {
  assertPrice({ takingCash: true, cashInsteadCents: null }, { driveAwayCents: 3982514, amountFinancedCents: 3482514 });
});

test('a down payment that covers the drive-away total makes a cash deal, with no lien fee (Example 7)', () => {
  assertPrice(
    { downCents: 4000000 },
    { dmvCents: 25400, dmvEstimated: true, driveAwayCents: 3981514, amountFinancedCents: -18486, isCashDeal: true, ctDmvCents: 25400 },
  );
});

test('the DMV estimate is $254 only when the down payment is at least the subtotal plus $254', () => {
  // Example 1's subtotal is $39,561.14, so the line is $39,815.14 down. An amount financed of $0 is a cash deal.
  assertPrice({ downCents: 3982000 }, { dmvCents: 25400, amountFinancedCents: -486, isCashDeal: true });
  assertPrice({ downCents: 3981514 }, { dmvCents: 25400, amountFinancedCents: 0, isCashDeal: true });
  assertPrice({ downCents: 3981513 }, { dmvCents: 26400, amountFinancedCents: 1001, isCashDeal: false });
});

test('title and registration above $264 is a conveyance fee, so it joins the vehicle base and is taxed', () => {
  assertPrice(
    { titleRegistrationCents: 30000 },
    {
      registrationExcessCents: 3600,
      vehicleBaseCents: 3723500,
      taxCents: 236442,
      dmvCents: 30000,
      dmvEstimated: false,
      driveAwayCents: 3986342,
    },
  );
});

test("the registration excess is measured against $264 even in a cash deal, where CT's own amount is $254", () => {
  assertPrice({ titleRegistrationCents: 30000, downCents: 4500000 }, { registrationExcessCents: 3600, isCashDeal: true, ctDmvCents: 25400 });
  assertPrice(
    { titleRegistrationCents: 26400, downCents: 4000000 },
    { registrationExcessCents: 0, dmvCents: 26400, isCashDeal: true, ctDmvCents: 25400 },
  );
});

test('taxOf rounds the tax half up to the cent with integer math', () => {
  assert.deepEqual(taxOf(3643000, 0, connecticut), { taxCents: 231331, vehicleBp: 635 });
});

test('the whole vehicle base is taxed at 7.75% only when it is over $50,000', () => {
  assert.deepEqual(taxOf(5000000, 0, connecticut), { taxCents: 317500, vehicleBp: 635 });
  assert.deepEqual(taxOf(5000001, 0, connecticut), { taxCents: 387500, vehicleBp: 775 });
  assertPrice({ saleCents: 4950000 }, { vehicleBaseCents: 5019900, vehicleBp: 775, taxCents: 389042 });
});

test('the service base is always taxed at 6.35%, and the tax on both bases is rounded once', () => {
  assert.deepEqual(taxOf(5100000, 299500, connecticut), { taxCents: 414268, vehicleBp: 775 });
  // Each base alone comes to $2,313.305, so rounding each one would give $4,626.62.
  assert.deepEqual(taxOf(3643000, 3643000, connecticut), { taxCents: 462661, vehicleBp: 635 });
});

test('a taxed GAP is vehicle-class, so it counts toward the $50,000 line', () => {
  const gap = extra('extra-1', 'gap', 89500, { inDeal: true, taxed: true });
  assertPrice(
    { saleCents: 4919900, docFeeCents: null, extras: [gap] },
    { vehicleBaseCents: 5009400, vehicleBp: 775, serviceBaseCents: 0, taxCents: 388229 },
  );
});

test("a taxed warranty in the deal is service-class, and it brings the amount financed to Example 3's", () => {
  const warranty = extra('extra-1', 'warranty', 299500, { inDeal: true });
  assertPrice(
    { extras: [warranty] },
    { vehicleBaseCents: 3719900, serviceBaseCents: 299500, taxCents: 255232, amountFinancedCents: 3801032 },
  );
});

test('an untaxed extra in the deal adds its price to the drive-away total but adds no tax', () => {
  const gap = extra('extra-1', 'gap', 89500, { inDeal: true });
  assertPrice({ extras: [gap] }, { vehicleBaseCents: 3719900, taxCents: 236214, driveAwayCents: 4072014 });
});

test('extras that are not in the deal count toward nothing', () => {
  const extras = [extra('extra-1', 'warranty', 299500), extra('extra-2', 'vinEtch', 40000)];
  assert.deepEqual(priceOf(dealInputs({ extras }), connecticut), priceOf(dealInputs(), connecticut));
});

test('priceOf works out nothing until the sale price is entered', () => {
  assert.deepEqual(priceOf(dealInputs({ saleCents: null }), connecticut), {
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
  });
});

test('an extra costs its price plus the tax it adds, whether or not it is in the deal', () => {
  const warranty = extra('extra-1', 'warranty', 299500);
  const gap = extra('extra-2', 'gap', 89500);
  const outOfDeal = dealInputs({ extras: [warranty, gap] });
  assert.equal(itemCostCents(outOfDeal, connecticut, 'extra-1'), 318518);
  assert.equal(itemCostCents(outOfDeal, connecticut, 'extra-2'), 89500);
  const inDeal = dealInputs({ extras: [{ ...warranty, inDeal: true }, gap] });
  assert.equal(itemCostCents(inDeal, connecticut, 'extra-1'), 318518);
});

test('an extra that pushes the vehicle base over $50,000 also costs the jump to 7.75% on the whole base', () => {
  const vinEtch = extra('extra-1', 'vinEtch', 40000, { inDeal: true });
  assert.equal(itemCostCents(dealInputs({ saleCents: 4900000, extras: [vinEtch] }), connecticut, 'extra-1'), 112678);
});

test('the doc fee costs its amount plus the tax it adds, and has no cost until it is entered', () => {
  assert.equal(docFeeCostCents(dealInputs(), connecticut), 74339);
  assert.equal(docFeeCostCents(dealInputs({ docFeeCents: null }), connecticut), null);
});

test('the extras in the deal cost their prices plus the tax they add, taken as one item', () => {
  const warranty = extra('extra-1', 'warranty', 299500);
  assert.equal(extrasInDealCostCents(dealInputs({ extras: [{ ...warranty, inDeal: true }] }), connecticut), 318518);
  assert.equal(extrasInDealCostCents(dealInputs({ extras: [warranty] }), connecticut), 0);
  // Together these two cross $50,000, as one $400 VIN etch would. Each one alone, with the other already in
  // the deal, costs $914.08, so adding up the items' own costs would count the jump to 7.75% twice.
  const vinEtch = extra('extra-1', 'vinEtch', 20000, { inDeal: true });
  const paintFabric = extra('extra-2', 'paintFabric', 20000, { inDeal: true });
  const bothInDeal = dealInputs({ saleCents: 4900000, extras: [vinEtch, paintFabric] });
  assert.equal(extrasInDealCostCents(bothInDeal, connecticut), 112678);
  assert.equal(itemCostCents(bothInDeal, connecticut, 'extra-1'), 91408);
});

test('costs count a blank sale price as $0, so an item still has a cost before the sale price is entered', () => {
  const vinEtch = extra('extra-1', 'vinEtch', 40000);
  assert.equal(itemCostCents(dealInputs({ saleCents: null, extras: [vinEtch] }), connecticut, 'extra-1'), 42540);
  assert.equal(docFeeCostCents(dealInputs({ saleCents: null }), connecticut), 74339);
});
