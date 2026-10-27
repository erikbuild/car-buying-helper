// ABOUTME: Connecticut's tax, DMV, doc-fee and rate-cap values, extra types, tips, checklist and card text.
// ABOUTME: All Connecticut text and numbers live here, with their sources and dates.

// The tip on paint / fabric and other dealer add-ons.
const OPTIONAL_ADD_ON_TIP = 'Optional. CT requires add-ons to be itemized and marked optional.';

export const connecticut = {
  state: 'Connecticut',
  asOf: '2026-10-27',
  // Rates in basis points (635 is 6.35%). The luxury rate applies to the whole vehicle base when that base is over the
  // threshold. Service-class extras always use the standard rate.
  tax: { standardBp: 635, luxuryBp: 775, luxuryThresholdCents: 5000000 },
  // A new car's DMV fees, with three years of registration. The lien fee is charged only when the car is financed.
  dmv: {
    financedCents: 26400,
    cashCents: 25400,
    breakdown: [
      { label: 'Registration (3 yr)', cents: 12000, financedOnly: false },
      { label: 'Title', cents: 2500, financedOnly: false },
      { label: 'Lien', cents: 1000, financedOnly: true },
      { label: 'Plate', cents: 500, financedOnly: false },
      { label: 'Admin', cents: 1000, financedOnly: false },
      { label: 'Clean Air', cents: 1500, financedOnly: false },
      { label: 'Passport to the Parks', cents: 2400, financedOnly: false },
      { label: 'Emissions exemption', cents: 4000, financedOnly: false },
      { label: 'Greenhouse gas', cents: 1500, financedOnly: false },
    ],
  },
  // The doc fee's comparison point, just above the top of what CT Mazda dealers list ($599–$998 in Oct 2026).
  // CT doesn't cap it.
  docFeeBenchmarkCents: 100000,
  // The legal APR cap on new-car retail installment contracts, in thousandths of a percent.
  aprCapMilli: 15000,
  // The kinds of extra the Extras tab adds, in its button order. Vehicle-class extras are taxed at the car's rate and
  // count toward the luxury threshold. Service-class extras are always taxed at the standard rate.
  extraTypes: {
    warranty: {
      label: 'Extended warranty',
      taxClass: 'service',
      taxedByDefault: true,
      tip: "Mazda's own plan can be bought later, until 3 years/36,000 miles, from any Mazda dealer.",
      taxedHint: null,
    },
    gap: {
      label: 'GAP',
      taxClass: 'vehicle',
      taxedByDefault: false,
      tip: 'Your auto insurer may sell loan payoff coverage for less. Dealer GAP in CT can be cancelled for a full refund within 60 days.',
      taxedHint: "Taxed only if the lender requires GAP. Check the buyer's order.",
    },
    maintenance: {
      label: 'Prepaid maintenance',
      taxClass: 'service',
      taxedByDefault: true,
      tip: null,
      taxedHint: null,
    },
    tireWheel: {
      label: 'Tire & wheel',
      taxClass: 'service',
      taxedByDefault: true,
      tip: null,
      taxedHint: null,
    },
    paintFabric: {
      label: 'Paint / fabric',
      taxClass: 'vehicle',
      taxedByDefault: true,
      tip: OPTIONAL_ADD_ON_TIP,
      taxedHint: null,
    },
    vinEtch: {
      label: 'VIN etch',
      taxClass: 'vehicle',
      taxedByDefault: true,
      tip: 'CT requires your written consent.',
      taxedHint: null,
    },
    other: {
      label: 'Other',
      taxClass: 'vehicle',
      taxedByDefault: true,
      tip: OPTIONAL_ADD_ON_TIP,
      taxedHint: null,
    },
  },
  // Field hints that name a Connecticut rule.
  hints: {
    salePrice: "CT quotes include the doc fee and add-ons (since Oct 2026). Enter the car's price without them; they have their own fields.",
  },
  // The signing checklist shown below the Verdict cards.
  checklist: [
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
  ],
  // Card text that names a Connecticut rule or figure. Each template takes amounts and rates already formatted for
  // display, such as '$1,200' or '15%'.
  text: {
    rateCapHeadline: (cap) => `Over Connecticut's ${cap} legal cap for new-car loans.`,
    taxRightHeadline: 'CT tax is right.',
    taxOffHeadline: (amount, moreOrLess) => `Their tax is ${amount} ${moreOrLess} than CT's.`,
    taxReasons: "Rebates don't lower CT tax. The doc fee is taxed.",
    taxRegistrationReason: (amount) =>
      `This includes tax on the ${amount} of title and registration charges above CT's fees, which CT counts as a conveyance fee.`,
    docFeeHighHeadline: (fee) => `${fee} doc fee is above what CT Mazda dealers charge.`,
    docFeeSentence: (cost) =>
      `With tax it costs ${cost}. CT Mazda dealers charge about $600–$1,000 (Oct 2026). CT doesn't cap it, and it's negotiable.`,
    dmvHighHeadline: (amount) => `${amount} more than CT DMV charges.`,
    dmvHighSentence: (ctAmount, isCash) =>
      `CT charges ${ctAmount} when you ${isCash ? 'pay cash' : 'finance'}. `
      + "Under CT law the extra is part of the dealer's conveyance fee, so it's negotiable, and it's taxed.",
    dmvOkHeadline: "Title and registration are within CT's fees.",
  },
  // Where each rule comes from.
  sources: [
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
  ],
};
