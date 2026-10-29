# Live Check Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two fixes Erik approved after the live check on 2026-10-29. First, cards 3 and 4 choose a worked-out rate's green headline from the rate as the card shows it. Second, the Down payment hint keeps "−$500/+$500" on one line.

**Architecture:** Task 23 adds a rounding helper to `site/lib/numbers.js` and one comparison to `site/lib/desk-checks.js`. Task 24 changes the page markup and adds one CSS rule. Nothing new is added to the architecture.

**Tech Stack:** As in `plans/2026-10-27_deal-analyzer.md`: plain ES modules, Node 22 `node --test`, `@playwright/test` 1.64.1.

**Spec:** `SPEC.md`, amended 2026-10-29. §5 lists the decisions under "From the live check". The amended sections are §6.3 (the Down payment row), §6.5 (cards 3 and 4), §7.0 and §13.

## Global Constraints

Everything in `plans/2026-10-27_deal-analyzer.md`'s Global Constraints, Shared shapes and card keys applies. In particular:
- Headlines are the exact strings in §6.5, and tests assert them.
- Every code file keeps its two ABOUTME lines.
- No "new", "old" or "legacy" in names or comments. Comments describe the code as it is.
- TDD: write the failing test, watch it fail for the expected reason, then write the code.
- Test output is pristine.

## Review Focus

1. **A payment-only quote just above the 0% payment.** At 36 months, $967.37, $967.38 and $967.50 work out to under 0.01%, so each reads "On the automaker's 0% special." $968.00 reads "Within …". Test in Task 23.
2. **A worked-out rate that shows at or under the tolerance but is over it unrounded.** The card's color still comes from the unrounded rate. $969.29 × 36 is red, though it shows as at least 0.12%. Test in Task 23.
3. **Entered APRs keep the exact comparison.** 0.125% against the 0% special still reads "Within …", and so does 5.625% against 5.5%. The existing tests cover this, and they must keep passing unchanged. Task 23.
4. **The other comparisons of their rate.** Card 2 (the rate cap) and the outcomes of cards 3 and 4 keep `theirRateIsAbove`, the unrounded comparison. Task 23's review checks that no other comparison changed.
5. **The hint at every phone width, in every browser.** "−$500/+$500" never splits from 320px to 440px. The hint's text, its accessible description and the 320px no-sideways-scroll test are unchanged. Test in Task 24.

## Execution order

Task 23, then Task 24. They don't share files. Run them one at a time anyway, so their Playwright runs don't share a server.

---

### Task 23: Cards 3 and 4 choose a worked-out rate's headline from the rate as it shows

**Spec:** §5 (From the live check), §6.5 cards 3 and 4, §7.0, §13.

**Files:**
- Modify: `site/lib/numbers.js`, `site/lib/desk-checks.js`
- Test: `test/unit/numbers.test.js`, `test/unit/desk-checks.test.js`
- Also, only where their expectations change: `test/integration/examples.test.js`, `test/e2e/*.spec.js`

**Interfaces:**
- `roundedRateMilli(percent, rounding = 'halfUp', decimals = 2)` in `numbers.js`:
  - It returns a computed rate in percent, rounded to `decimals` as `formatRatePercent` writes it, in thousandths of a percent. For example, `roundedRateMilli(7.440472, 'down')` is 7440.
  - It rounds with `roundToSteps`, as `formatRatePercent` does, so the two never disagree.
- `theirRateShowsAbove(deal, limitMilli)`, private in `desk-checks.js`:
  - An entered APR compares exactly, as in `theirRateIsAbove`.
  - A rate worked out from their payment compares as `roundedRateMilli(deal.theirRate.percent, 'down') > limitMilli`.
- Cards 3 and 4 use `theirRateShowsAbove` against the special or the outside rate to choose their green headline: "On …" or "At or under …", or else "Within …". Whether the card is green, and every other comparison, still use `theirRateIsAbove`.
- Card keys, numbers, sentences and math don't change.

- [ ] **Step 1: Write the failing tests.**
  - `numbers.test.js`, "roundedRateMilli rounds a computed rate as formatRatePercent writes it, in thousandths of a percent":
    - Rounded down: `roundedRateMilli(7.440472, 'down')` is 7440, `(0.000326, 'down')` is 0, `(5.509453, 'down')` is 5500 and `(5.510063, 'down')` is 5510.
    - Rounded half up: `roundedRateMilli(7.4472)` is 7450, and `(5.799797, 'halfUp', 3)` is 5800.
  - `desk-checks.test.js`:
    - "card 3: a payment-only quote reads On while its rate shows as the special, and Within once it shows above it (§13)", with `{ theirAprMilli: null, months: 36, theirPaymentCents }`:
      - 96737, 96738 and 96750: `['green', "On the automaker's 0% special."]`, with the sentence "Their rate is 0%."
      - 96800: `['green', 'Within 0.125 points of the 0% special.']`, with the sentence "Their rate is at least 0.04%."
    - "card 3: with a payment-only quote, green or red still comes from the unrounded rate (§13)":
      - 96928: `['green', 'Within 0.125 points of the 0% special.']`, with the sentence "Their rate is at least 0.12%."
      - 96929: `['red', "Should be the automaker's 0% special."]`, with a sentence starting "Their rate of at least 0.12% costs you at least $67 more over 36 months."
    - "card 4: a payment-only quote reads At or under while its rate shows as your outside rate (§13)". On Example 1 (60 months, outside 5.5%), with `{ theirAprMilli: null, theirPaymentCents }`:
      - 66672 (5.4997%): `['green', 'At or under your 5.5% outside rate.']`, with the sentence "Their rate is at least 5.49%."
      - 66673 (5.5003%) and 66688 (5.5095%): `['green', 'At or under your 5.5% outside rate.']`, with the sentence "Their rate is at least 5.5%."
      - 66689 (5.5101%): `['green', 'Within 0.125 points of your 5.5% outside rate.']`, with the sentence "Their rate is at least 5.51%."
      - `{ theirAprMilli: null, months: 36, theirPaymentCents: 96737, specialAprMilli: null, outsideAprMilli: 0 }`: `['green', 'At or under your 0% outside rate.']`.
    - "card 4: with a payment-only quote, green or amber still comes from the unrounded rate (§13)":
      - 66877: `['green', 'Within 0.125 points of your 5.5% outside rate.']`.
      - 66878: `['amber', 'At least 0.12 points over your outside rate.']`.
    - The existing tests with entered APRs stay as they are and keep passing. These are "card 3: a rate above the special but within 0.125 points of it says so" and "card 4: up to 0.125 points over your outside rate is green…".
- [ ] **Step 2: Run the tests and confirm they fail as expected.** Run `node --test test/unit/numbers.test.js test/unit/desk-checks.test.js`.
  - Expected to fail:
    - `numbers.test.js`, because `roundedRateMilli` isn't exported.
    - The "On" and "At or under" expectations for 96737, 96738 and 96750, for 66673 and 66688, and for the 0% outside rate. Today these read "Within …".
  - Expected to pass already: 96800, 66672, 66689 and both unrounded-outcome tests. They guard what must not change.
- [ ] **Step 3: Implement.**
  - Put `roundedRateMilli` next to `formatRatePercent`, with a comment in the file's style.
  - Put `theirRateShowsAbove` next to `theirRateIsAbove`. Its comment says which comparison each kind of rate gets, and why (SPEC §6.5, §7.0).
  - Cards 3 and 4's headline conditions use `theirRateShowsAbove`.
  - Update the comments on `specialRateOutcome` and `outsideRateOutcome`. Each should say a worked-out rate counts as above the special or the outside rate only when it shows above it.
- [ ] **Step 4: Run every test.** Run `npm test` and `npx playwright test --output=test-results/task-23`. Expected: all pass with pristine output.

### Task 24: The Down payment hint keeps "−$500/+$500" on one line

**Spec:** §5 (From the live check), §6.3 (the Down payment row), §13.

**Files:**
- Modify: `site/index.html`, `site/styles.css`
- Test: `test/e2e/layout.spec.js`

**Interfaces:**
- In the Down payment hint, `−$500/+$500` sits in `<span class="nowrap">`.
- The hint's text doesn't change: "Typing a down payment ties their quote to it. Use −$500/+$500 to try one out." Don't add invisible characters such as word joiners. The hints test asserts the hint's exact text and accessible description.
- `styles.css` gets `.nowrap { white-space: nowrap; }` next to the `.hint` rules. Its comment, in the file's style, says it keeps text on one line, like the down payment hint's −$500/+$500.

- [ ] **Step 1: Write the failing test.** In `layout.spec.js`, add "the down payment hint keeps −$500/+$500 on one line at every phone width":
  - Open the page and tap the Loan tab, as the other tests open tabs.
  - For each width from 320px to 440px, in 1px steps:
    - Set the viewport to that width, at a height of 852px.
    - Find "−$500/+$500" in the hint's text nodes. One text node must hold all of it. If none does, the test fails.
    - Make a Range over the phrase. Assert that its `getClientRects()` sit on one line: every rect's top is within 1px of the first rect's top.
    - Name the width in the assertion's message.
- [ ] **Step 2: Run the test and confirm it fails as expected.** Run `npx playwright test test/e2e/layout.spec.js --output=test-results/task-24`. Expected: FAIL in WebKit at 393px at least, where the phrase splits after "−" in Apple's system font. Record which browsers and widths fail.
- [ ] **Step 3: Implement.** Add the span and the rule.
- [ ] **Step 4: Run every test.** Run `npm test` and `npx playwright test --output=test-results/task-24`. Expected: all pass with pristine output. This includes the hints test, which checks the hint's text and accessible description, and the 320px no-sideways-scroll test.
