// ABOUTME: Dated benchmarks: Experian loan rates, KBB discounts, and Reg Z tolerances and first-period limits.
// ABOUTME: Verdict cards quote these values as context and use them as tolerances.

export const reference = {
  // The average new-car APR for 781+ credit (VantageScore 4.0), from Experian's State of the Automotive Finance Market.
  experian: {
    text: 'Buyers with 781+ scores averaged 4.41% on new-car loans in Q2 2026 (Experian; includes automaker specials).',
    asOf: 'Q2 2026 (published 2026-09-10)',
  },
  // The average transaction price against MSRP, from Kelley Blue Book's ATP report.
  kbb: {
    text: 'New cars averaged 3.4% under sticker nationally in Sept 2026 (KBB).',
    asOf: 'Sept 2026',
  },
  // Current Truth in Lending (Reg Z) rules.
  regZ: {
    // A disclosed APR is accurate within 1/8 point, in thousandths of a percent, even with an odd first period or an
    // odd first or final payment (12 CFR 1026.22(a)(2)-(3)).
    aprToleranceMilli: 125,
    // How many days shorter or longer than a regular month a first period may be and still be treated as regular,
    // for terms under one year and for terms of one to ten years (12 CFR 1026.17(c)(3)-(4); Appendix J).
    firstPeriodLimits: {
      underOneYear: { shorter: 6, longer: 13 },
      oneYearAndOver: { shorter: 11, longer: 21 },
    },
  },
};
