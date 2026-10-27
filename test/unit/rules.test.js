// ABOUTME: Checks Connecticut's values, extra types, tips, hints, checklist, card text and sources against SPEC.md §6 and §8.1.
// ABOUTME: Also checks the dated Experian and KBB context lines and Reg Z's APR tolerance and first-period limits (§8.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connecticut } from '../../site/rules/connecticut.js';
import { reference } from '../../site/rules/reference.js';

const totalCents = (fees) => fees.reduce((total, fee) => total + fee.cents, 0);

test('the Connecticut rules name their state and date', () => {
  assert.equal(connecticut.state, 'Connecticut');
  assert.equal(connecticut.asOf, '2026-10-27');
});

test('sales tax is 6.35%, or 7.75% on a vehicle base over $50,000', () => {
  assert.deepEqual(connecticut.tax, { standardBp: 635, luxuryBp: 775, luxuryThresholdCents: 5000000 });
});

test('DMV fees are $264 when financed and $254 when paying cash', () => {
  assert.equal(connecticut.dmv.financedCents, 26400);
  assert.equal(connecticut.dmv.cashCents, 25400);
});

test('the DMV breakdown sums to $264, and to $254 without the financed-only items', () => {
  const { breakdown } = connecticut.dmv;
  assert.equal(totalCents(breakdown), 26400);
  assert.equal(totalCents(breakdown.filter((fee) => !fee.financedOnly)), 25400);
});

test('the DMV breakdown lists each fee, and only the lien fee is financed-only', () => {
  assert.deepEqual(connecticut.dmv.breakdown, [
    { label: 'Registration (3 yr)', cents: 12000, financedOnly: false },
    { label: 'Title', cents: 2500, financedOnly: false },
    { label: 'Lien', cents: 1000, financedOnly: true },
    { label: 'Plate', cents: 500, financedOnly: false },
    { label: 'Admin', cents: 1000, financedOnly: false },
    { label: 'Clean Air', cents: 1500, financedOnly: false },
    { label: 'Passport to the Parks', cents: 2400, financedOnly: false },
    { label: 'Emissions exemption', cents: 4000, financedOnly: false },
    { label: 'Greenhouse gas', cents: 1500, financedOnly: false },
  ]);
});

test('the doc-fee benchmark is $1,000 and the APR cap is 15%', () => {
  assert.equal(connecticut.docFeeBenchmarkCents, 100000);
  assert.equal(connecticut.aprCapMilli, 15000);
});

test('the extra types are in the order of the Extras tab buttons', () => {
  assert.deepEqual(Object.keys(connecticut.extraTypes), ['warranty', 'gap', 'maintenance', 'tireWheel', 'paintFabric', 'vinEtch', 'other']);
});

test('GAP is vehicle-class and untaxed by default, with a hint on when it is taxed', () => {
  assert.deepEqual(connecticut.extraTypes.gap, {
    label: 'GAP',
    taxClass: 'vehicle',
    taxedByDefault: false,
    tip: 'Your auto insurer may sell loan payoff coverage for less. Dealer GAP in CT can be cancelled for a full refund within 60 days.',
    taxedHint: "Taxed only if the lender requires GAP. Check the buyer's order.",
  });
});

test('the extended warranty, prepaid maintenance and tire & wheel are service-class and taxed by default', () => {
  const { warranty, maintenance, tireWheel } = connecticut.extraTypes;
  assert.deepEqual(warranty, {
    label: 'Extended warranty',
    taxClass: 'service',
    taxedByDefault: true,
    tip: "Mazda's own plan can be bought later, until 3 years/36,000 miles, from any Mazda dealer.",
    taxedHint: null,
  });
  assert.deepEqual(maintenance, { label: 'Prepaid maintenance', taxClass: 'service', taxedByDefault: true, tip: null, taxedHint: null });
  assert.deepEqual(tireWheel, { label: 'Tire & wheel', taxClass: 'service', taxedByDefault: true, tip: null, taxedHint: null });
});

test('paint / fabric, VIN etch and other are vehicle-class and taxed by default', () => {
  const { paintFabric, vinEtch, other } = connecticut.extraTypes;
  const addOnTip = 'Optional. CT requires add-ons to be itemized and marked optional.';
  assert.deepEqual(paintFabric, { label: 'Paint / fabric', taxClass: 'vehicle', taxedByDefault: true, tip: addOnTip, taxedHint: null });
  assert.deepEqual(vinEtch, {
    label: 'VIN etch',
    taxClass: 'vehicle',
    taxedByDefault: true,
    tip: 'CT requires your written consent.',
    taxedHint: null,
  });
  assert.deepEqual(other, { label: 'Other', taxClass: 'vehicle', taxedByDefault: true, tip: addOnTip, taxedHint: null });
});

test('the sale price hint says CT quotes include the doc fee and add-ons', () => {
  assert.deepEqual(connecticut.hints, {
    salePrice: "CT quotes include the doc fee and add-ons (since Oct 2026). Enter the car's price without them; they have their own fields.",
  });
});

test('the signing checklist has its eight items in order', () => {
  assert.deepEqual(connecticut.checklist, [
    'Every blank on the contract is filled in, and you get a signed copy (CT law).',
    'The doc fee is listed with the statement that it is "not payable to the State of Connecticut", and it is negotiable.',
    'Each add-on is itemized and marked optional, and you ordered everything listed. '
      + 'There\'s no "dealer prep" charge for anything you didn\'t order or that Mazda pays the dealer for. '
      + 'VIN etching needs your written consent.',
    'If the amount financed is higher than your numbers, ask for the itemization.',
    "Don't take the car until the lender has approved the financing at the quoted rate. "
      + 'Check that the deposit line says how your deposit is refunded.',
    'There is no cooling-off period. The deal is final when you sign.',
    'Dealer GAP can be cancelled for a full refund within 60 days (CT).',
    'If the odometer shows more than delivery miles, the order must say "demonstrator".',
  ]);
});

test('card 2: the rate cap headline names the cap', () => {
  assert.equal(connecticut.text.rateCapHeadline('15%'), "Over Connecticut's 15% legal cap for new-car loans.");
});

test('card 8: the tax headlines, the likely reasons, and the reason for taxed registration charges', () => {
  const { text } = connecticut;
  assert.equal(text.taxRightHeadline, 'CT tax is right.');
  assert.equal(text.taxOffHeadline('$38', 'more'), "Their tax is $38 more than CT's.");
  assert.equal(text.taxOffHeadline('$38', 'less'), "Their tax is $38 less than CT's.");
  assert.equal(text.taxReasons, "Rebates don't lower CT tax. The doc fee is taxed.");
  assert.equal(
    text.taxRegistrationReason('$36'),
    "This includes tax on the $36 of title and registration charges above CT's fees, which CT counts as a conveyance fee.",
  );
});

test('card 10: the high doc fee headline and the doc fee sentence', () => {
  const { text } = connecticut;
  assert.equal(text.docFeeHighHeadline('$1,200'), '$1,200 doc fee is above what CT Mazda dealers charge.');
  assert.equal(
    text.docFeeSentence('$743'),
    "With tax it costs $743. CT Mazda dealers charge about $600–$1,000 (Oct 2026). CT doesn't cap it, and it's negotiable.",
  );
});

test('card 11: the DMV headlines, and the sentence when financing and when paying cash', () => {
  const { text } = connecticut;
  const conveyanceFee = "Under CT law the extra is part of the dealer's conveyance fee, so it's negotiable, and it's taxed.";
  assert.equal(text.dmvHighHeadline('$36'), '$36 more than CT DMV charges.');
  assert.equal(text.dmvHighSentence('$264', false), `CT charges $264 when you finance. ${conveyanceFee}`);
  assert.equal(text.dmvHighSentence('$254', true), `CT charges $254 when you pay cash. ${conveyanceFee}`);
  assert.equal(text.dmvOkHeadline, "Title and registration are within CT's fees.");
});

test('each Connecticut rule cites its source', () => {
  assert.deepEqual(connecticut.sources, [
    { rule: 'Sales tax', cite: 'CGS 12-408(1)(H); CT DMV taxable-items list' },
    { rule: 'Rebates', cite: 'DRS PS 2007(5), SN 2011(10)' },
    { rule: 'Taxed with the car', cite: 'CGS 12-407(a)(8)(A); Ruling 90-38' },
    { rule: 'Service-class extras', cite: 'CGS 12-407(a)(37)(CC), PS 94(2), SN 2011(10)' },
    {
      rule: 'Vehicle-class extras',
      cite: 'CT DMV sales-tax table (portal.ct.gov/dmv/vehicle-services/sales-tax-registrations/sales-tax-calculator); Ruling 90-38',
    },
    { rule: 'GAP', cite: 'CT DMV taxable list (2017)' },
    { rule: 'DMV fees', cite: 'CGS 14-49, 14-192, 14-12s, 14-49b, 14-164c, 22a-201c' },
    { rule: 'Conveyance fee', cite: 'CGS 14-62; OLR 2023-R-0092; dealer pages' },
    { rule: 'Dealer "registration" charges above DMV fees', cite: 'CGS 14-62(a)' },
    { rule: 'Quoted prices', cite: 'PA 26-24; PA 25-113' },
    { rule: 'APR cap', cite: 'CGS 36a-772' },
    { rule: 'Cooling-off', cite: 'CGS 42-134a; 14-62(h)' },
    { rule: 'Dealer GAP refund', cite: 'CGS 36a-789' },
  ]);
});

test('the Experian context line and its date', () => {
  assert.deepEqual(reference.experian, {
    text: 'Buyers with 781+ scores averaged 4.41% on new-car loans in Q2 2026 (Experian; includes automaker specials).',
    asOf: 'Q2 2026 (published 2026-09-10)',
  });
});

test('the KBB context line and its date', () => {
  assert.deepEqual(reference.kbb, {
    text: 'New cars averaged 3.4% under sticker nationally in Sept 2026 (KBB).',
    asOf: 'Sept 2026',
  });
});

test("Reg Z's APR tolerance is 1/8 point, and its first-period limits depend on the loan's term", () => {
  assert.deepEqual(reference.regZ, {
    aprToleranceMilli: 125,
    firstPeriodLimits: { underOneYear: { shorter: 6, longer: 13 }, oneYearAndOver: { shorter: 11, longer: 21 } },
  });
});
