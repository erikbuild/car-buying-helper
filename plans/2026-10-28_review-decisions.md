# Release Review Decisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ten changes Erik approved after the release review on 2026-10-28.

**Architecture:** Changes to the existing DOM-free modules (`site/lib/*.js`), the page markup and `site/app.js`, each test first. Nothing new is added to the architecture.

**Tech Stack:** As in `plans/2026-10-27_deal-analyzer.md`: plain ES modules, Node 22 `node --test`, `@playwright/test` 1.64.1.

**Spec:** `SPEC.md`, amended 2026-10-28. §5 lists the decisions under "From the release review". The amended sections are §6.3, §6.4, §6.5 (screenshot goal; cards 1, 3, 4 and 12), §7.5, §7.11 Example 1, §9, §10, §11 and §13.

## Global Constraints

Everything in `plans/2026-10-27_deal-analyzer.md`'s Global Constraints, Shared shapes and card keys applies. In particular:
- Headlines are the exact strings in §6.5, and tests assert them.
- Money is whole cents. Every code file keeps its two ABOUTME lines.
- No "new", "old" or "legacy" in names or comments. Comments describe the code as it is.
- TDD: write the failing test, watch it fail for the expected reason, then write the code.
- Test output is pristine.

The screenshot goal change (§6.5: up to 3 problems on one screen) needs no code. `deal.spec.js`'s fit test already covers Example 1's 3 problems, and it must keep passing.

## Review Focus

1. **A payment exactly $1 under the 0% payment** ($966.37 against $967.37 at 0% for 36 months). It still works out to 0%, and one cent less leaves their rate unknown. Test in Task 20.
2. **A payment-only quote that's out of date, with other inputs blank too.** Card 4's note names those inputs first, then asks for the new quote. Test in Task 20.
3. **An extra in the deal whose price is then cleared.** It stops counting everywhere: drive-away total, amount financed, the strip, and card 12. Test in Task 21.
4. **Month-end date pairs** (2027-01-31 → 2027-03-30 is 1 month and 28 days). The hint uses §7.3's m and d exactly. Test in Task 22.
5. **Card 1's longer sentence.** Example 1's key numbers and its 3 problem cards still fit on one 393×760 screen after tapping Problems. The existing fit test covers this; run it in Task 20.

## Execution order

Tasks 20 → 21 → 22, one at a time. They share files.

---

### Task 20: Their rate when the payment can't pay off the loan, and the rate cards' wording

**Spec:** §6.5 cards 1, 3 and 4, §7.5, §7.11 Example 1, §10, §13.

**Files:**
- Modify: `site/lib/deal.js`, `site/lib/desk-checks.js`
- Test: `test/unit/deal.test.js`, `test/unit/desk-checks.test.js`, `test/fixtures.js` (`EXAMPLE_1_PAYMENT_SENTENCE`)
- Also, only where their expectations change: `test/integration/examples.test.js`, `test/unit/contract-checks.test.js`, `test/unit/display.test.js`, `test/unit/checks.test.js`, `test/e2e/*.spec.js`

**Interfaces:**
- `rateFromPayment(paymentCents, months, loanCents, timings)` in `deal.js` returns `{percent, over100}`, or `null` when `paymentCents` is less than the 0% payment `monthlyPayment(loanCents, 0, months)` minus $1. In that case the payment can't pay off the loan at any rate. Otherwise it behaves as it does now.
- `deal.workedOutRate` and `deal.theirRate` are `null` in that case.
- Keep the "less than the 0% payment − $1" rule in one place. Card 1's outcome 2 with a blank APR and `rateFromPayment` must use the same check.
- Cards 3 and 4 keep their keys and numbers.

- [ ] **Step 1: Write the failing tests.**
  - `deal.test.js`:
    - "a payment that can't pay off the amount financed even at 0% gives no rate": `dealWith({ theirAprMilli: null, theirPaymentCents: 56000 })` has `workedOutRate === null` and `theirRate === null`.
    - "a payment within $1 under the 0% payment still works out to 0%":
      - `dealWith({ theirAprMilli: null, months: 36, theirPaymentCents: 96637 }).workedOutRate` is `{ percent: 0, over100: false }`.
      - The same with `96636` is `null`.
    - The existing test at 96736 and 6 × 580419 keeps passing.
  - `desk-checks.test.js`:
    - With `{ theirAprMilli: null, theirPaymentCents: 56000 }`:
      - card 1 is red, "$560.00/mo for 60 months can't pay off $34,825."
      - card 3 is amber, "You're not getting the 0% special or the $1,000 cash."
      - card 4 is neutral, "Enter their rate to compare their loan with your own financing."
    - Card 3 at `months: 36`:
      - `theirAprMilli: 0` is green, "On the automaker's 0% special."
      - `125` is green, "Within 0.125 points of the 0% special."
      - `126` is red, "Should be the automaker's 0% special."
    - Card 4 on Example 1 (60 months, outside 5.5%):
      - `theirAprMilli: 5500` and `5400` are green, "At or under your 5.5% outside rate."
      - `5625` is green, "Within 0.125 points of your 5.5% outside rate."
      - `5626` stays amber.
    - Card 3 with `{ theirAprMilli: null, months: 36, theirPaymentCents: 96737, downCents: 550000 }` is neutral, "Ask for a new quote at $5,500 down to check their rate against the 0% special."
    - Card 4:
      - `{ theirAprMilli: null, downCents: 550000 }` is neutral, "Ask for a new quote at $5,500 down to compare their loan with your own financing.", with the Experian context line.
      - Adding `outsideAprMilli: null` makes it "Enter your outside rate and ask for a new quote at $5,500 down to compare their loan with your own financing."
      - Adding `months: null` as well makes it "Enter your outside rate and months and ask for a new quote at $5,500 down to compare their loan with your own financing."
    - Card 1's too-high sentence (the expectation near line 141) ends "…or the first payment is more than 45 days away (enter both dates under At signing to check)."
  - `test/fixtures.js`: `EXAMPLE_1_PAYMENT_SENTENCE` ends the same way.
- [ ] **Step 2: Run the tests and confirm they fail as expected.** Run `node --test test/unit/deal.test.js test/unit/desk-checks.test.js`. Expected: FAIL on the new expectations only.
- [ ] **Step 3: Implement.**
  - In `deal.js`: the `null` result of `rateFromPayment`, and the shared check.
  - In `desk-checks.js`:
    - card 1 uses the shared check;
    - cards 3 and 4 get their "Within …" headlines, using `theirRateIsAbove` against the special or the outside rate;
    - cards 3 and 4 get their stale-quote notes. These apply when their APR is blank and `deal.quoteCurrent === false`. Name the down payment now entered with `formatDollars`, the way card 1's out-of-date outcome does.
    - card 1's clause.
  - Update comments that describe the behavior you change.
- [ ] **Step 4: Run every test.** Run `npm test` and `npx playwright test --output=test-results/task-20`. Expected: all pass with pristine output, including `deal.spec.js`'s fit test.

### Task 21: Extras: the price hint, items without a price, and "at least"

**Spec:** §6.4, §6.5 card 12, §7.7, §9, §11, §13.

**Files:**
- Modify: `site/lib/inputs.js`, `site/lib/price.js`, `site/lib/deal.js`, `site/lib/display.js`, `site/lib/desk-checks.js`, `site/app.js`, `README.md` (the Extras paragraph of At the dealer)
- Test: `test/unit/inputs.test.js`, `test/unit/price.test.js`, `test/unit/deal.test.js`, `test/unit/display.test.js`, `test/unit/desk-checks.test.js`, `test/e2e/extras.spec.js`
- Also, only where their expectations change: `test/fixtures.js`, `test/integration/examples.test.js`, `test/e2e/layout.spec.js`, `test/e2e/saving.spec.js`, `site/styles.css`

**Interfaces:**
- `readInputs(form).inputs.extras[i].priceCents` is `null` when the price is blank or unreadable. It used to be `0`. The unreadable price's error stays in `extraErrors`.
- `priceOf`: an extra in the deal counts toward the tax, the drive-away total and the amount financed only when its `priceCents` isn't `null`.
- `deal.extras[i]` is `{ id, costCents: null, perMonthCents: null, overLoanCents: null }` when its `priceCents` is `null`.
- `deal.extrasInDeal` counts only the extras in the deal that have a price. It's `null` when there are none.
- `extraLine(deal, extraId)`:
  - "Would add —" (or "Adds —" in the deal) when the extra's `costCents` is `null`.
  - With their rate worked out from their payment (`deal.theirRate.entered === false`) and a per-month figure, both amounts read "at least": "Adds at least $70.88/mo, at least $4,252.80 over 60 months ($3,185.18 with tax)", or "Would add at least …" when the extra isn't in the deal.
  - Otherwise it's unchanged.
- Each item's Price has a hint under it, "The full price, not per month. If they quote $/mo, ask for the price.":
  - a `<p class="hint">` with an id;
  - the price input's `aria-describedby` names it before the error line.
  - It isn't Connecticut text, so it doesn't belong in the rules module.

- [ ] **Step 1: Write the failing tests.**
  - `inputs.test.js`: an extra with price text `''` or `'abc'` reads as `priceCents: null`, and `'abc'` keeps its error.
  - `price.test.js`: an extra in the deal with `priceCents: null` leaves the tax, drive-away total and amount financed what they are with no extras.
  - `deal.test.js`:
    - `dealWith({ extras: [extra('extra-1', 'warranty', null, { inDeal: true })] })` has `extras[0]` with all three figures `null`, and `extrasInDeal === null`.
    - The price's AF is Example 1's $34,825.14.
  - `display.test.js`:
    - `extraLine` gives "Would add —" and "Adds —" for an extra without a price.
    - With `{ theirAprMilli: null, theirPaymentCents: 85000 }` and the $2,995 warranty in the deal, it gives "Adds at least $70.88/mo, at least $4,252.80 over 60 months ($3,185.18 with tax)".
    - With the warranty out of the deal, it gives "Would add at least …", with the figures the module gives.
  - `desk-checks.test.js`: card 12 is green, "No extras in the deal.", when the only extra in the deal has no price.
  - `extras.spec.js`:
    - Rename the test "a price that isn't a number shows its error and counts as $0" to say it counts as blank. Its expectations become "Would add —" and the strip without the item.
    - Each item shows the price hint, and the price input's accessible description starts with it.
    - An extra marked In the deal and then given a price, then cleared, stops counting: the strip and card 12 go back to Example 1's.
- [ ] **Step 2: Run the tests and confirm they fail as expected.** Run `node --test "test/unit/**/*.test.js"` and `npx playwright test test/e2e/extras.spec.js --output=test-results/task-21`.
- [ ] **Step 3: Implement.**
  - Fix comments that still say an extra's price counts as $0, in `inputs.js` and wherever else they say it.
  - Add one sentence to the README's Extras paragraph: if they quote an extra per month, ask for its full price.
  - Update `plans/2026-10-27_deal-analyzer.md`'s Shared shapes only if this plan's Interfaces differ from what it says.
- [ ] **Step 4: Run every test.** Run `npm test` and `npx playwright test --output=test-results/task-21`. Expected: all pass with pristine output.

### Task 22: Loan tab hints: down payment, and the first period between the contract dates

**Spec:** §6.3, §7.3, §11, §13.

**Files:**
- Modify: `site/index.html`, `site/lib/inputs.js`, `site/lib/display.js` and `site/lib/contract-checks.js` (the shared first period in words), `site/app.js` (a comment), `README.md` (the At the dealer walkthrough)
- Test: `test/unit/inputs.test.js`, `test/e2e/layout.spec.js`, `test/e2e/deal.spec.js`
- Also, only where their expectations change: `test/integration/examples.test.js`, `test/e2e/saving.spec.js`

**Interfaces:**
- Down payment hint:
  - `index.html` gets `<p class="hint" id="downPayment-hint" data-hint-for="downPayment">Typing a down payment ties their quote to it. Use −$500/+$500 to try one out.</p>` in the down payment's field.
  - `#downPayment`'s `aria-describedby` names `downPayment-hint` before its error line.
- `readInputs(form).dateHint` for the contract dates:
  - For a valid pair: "First payment {period} after the contract date.", where {period} is §7.3's m and d as "1 month and 15 days", "20 days" (m = 0) or "2 months" (d = 0), in the singular for 1.
  - "Enter both dates." with one date, as now.
  - `null` for a pair that isn't valid, as now. Errors stay on `firstPaymentDate`.
  - {period} comes from `firstPeriodText({m, d})`, which the contract cards' math also uses. It lives in `display.js` next to `countOf`, and `contract-checks.js` and `inputs.js` import it.

- [ ] **Step 1: Write the failing tests.**
  - `inputs.test.js`:
    - Each §7.3 example as contract date → first payment date gives its hint:
      - 2026-10-30 → 2026-12-14: "First payment 1 month and 15 days after the contract date."
      - 2026-10-30 → 2026-11-19: "First payment 20 days after the contract date."
      - 2027-01-31 → 2027-03-30: "First payment 1 month and 28 days after the contract date."
      - 2027-01-15 → 2027-02-28: "First payment 1 month and 16 days after the contract date."
      - 2028-01-30 → 2028-03-30: "First payment 2 months after the contract date."
    - Plus:
      - 2026-10-30 → 2026-11-30: "First payment 1 month and 1 day after the contract date." November 30 is the month's last day, so §7.3 counts a month back to October 31.
      - 2026-10-15 → 2026-11-15: "First payment 1 month after the contract date."
      - 2026-10-30 → 2026-10-31: "First payment 1 day after the contract date."
      - 2026-10-30 → 2027-01-30: "First payment 3 months after the contract date."
    - 2026-10-30 → 2027-01-31 and a wrong-order pair give `dateHint: null`.
  - `layout.spec.js`: add `downPayment` to the field hints the hints test checks, with its exact text and accessible description.
  - `deal.spec.js`: in "Example 3's contract shows the red amount-financed card", once both dates are entered the hint reads Example 3's first period, in place of `toBeEmpty()` and `toBeHidden()`.
- [ ] **Step 2: Run the tests and confirm they fail as expected.** Run `node --test test/unit/inputs.test.js` and `npx playwright test test/e2e/layout.spec.js test/e2e/deal.spec.js --output=test-results/task-22`.
- [ ] **Step 3: Implement.** Also add this to the README's At the dealer walkthrough, next to the ± buttons sentence: "Typing a down payment ties their quote to it, so use the ± buttons to try one out."
- [ ] **Step 4: Run every test.** Run `npm test` and `npx playwright test --output=test-results/task-22`. Expected: all pass with pristine output.
