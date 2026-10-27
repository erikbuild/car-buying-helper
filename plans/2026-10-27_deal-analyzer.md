# Car Buying Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline, mobile-first deal checker in `SPEC.md` and publish it on GitHub Pages.

**Architecture:** Plain ES modules, served as static files from `site/`. DOM-free modules do all the math and all the text, so Node's test runner tests them directly: numbers, calendar, loan, price, form, inputs, deal, display, checks and rules. `site/app.js` connects the DOM to those modules, and `site/offline.js` is the service worker. Playwright runs the end-to-end tests in real WebKit, Chromium and Firefox. A GitHub Actions workflow runs every test, stamps the release name, and deploys `site/`.

**Tech Stack:** HTML, CSS, JavaScript (ES modules, no build step) · Node 22 (`node --test`) · `@playwright/test` 1.64.1 (dev only) · GitHub Actions + GitHub Pages.

**Spec:** `SPEC.md`, approved 2026-10-27. Every § below refers to it. Read the spec section a task cites before starting the task.

## Global Constraints

- Plain HTML, CSS and JavaScript with no build step for the page. No runtime dependencies, CDNs or external fonts. Development-only tooling is allowed (§4).
- No network requests other than the page's own files. No analytics (§9).
- Every code file starts with two lines beginning `ABOUTME: ` (`//` in JS, `/* */` in CSS, `<!-- -->` in HTML, `#` in YAML).
  - `index.html` puts them before `<!doctype html>`.
  - Exempt: `manifest.webmanifest`, `package.json`, `package-lock.json`.
  - Not code: icons, `LICENSE`, Markdown, `.gitignore`.
- Names say what the code does. No implementation details, and no "new", "old", "legacy", "wrapper" or "unified" in names or comments.
- No code that converts old saved data. A version or shape mismatch means "start fresh" (§9).
- Money is whole cents (integers). Tax and 0% payments use integer half-up division (`divideHalfUp`). Never use `Math.round(x * 100) / 100` for money (§7.0).
- Entered rates are whole thousandths of a percent (5.9% → `5900`). The math uses percent (5.9).
- Card headlines are the exact strings in §6.5, and tests assert them. Connecticut text and numbers live only in `site/rules/connecticut.js` (§8).
- Input text is at least 16px, tap targets at least 44px, and light/dark follows the system. A severity word sits next to every card's color (§9).
- TDD for every task: failing test → run it → minimal code → run it → commit. Test output must be pristine. E2E tests fail on any console error or page error.
- Commit messages are plain, with no `Co-Authored-By` or "Generated with" lines.

## Review Focus

The spec never names these, but someone using the page will hit them. Each one has a test in the task that owns the code.

1. **Text caught mid-typing** ("5.", "36,", "$", " 36,500 ", "5.9 %"): it parses to the obvious value with no error flashing. Test in Task 3.
2. **Any mix of blank fields:** no text anywhere contains `NaN`, `undefined`, `Infinity` or `null`, and nothing throws. Test in Task 14 (sweep).
3. **Extreme but valid values** (a 1-month loan, $0.01 financed, a $500,000 sale, a 30% rate, a payment ten times too high): every card has defined wording. Test in Task 14 (sweep).
4. **A page reopened with invalid text saved:** the inline error shows again, and the value counts as blank. Test in Task 17.
5. **A 320px-wide phone and a 1280px desktop window:** no horizontal scrolling, and the strip is readable. Test in Task 7.

## Shared shapes

Every task uses these names and fields exactly as written.

```js
// Timing: first payment m whole months + d days after signing (§7.3)
{ m, d }                                   // REGULAR = {m:1,d:0}, FORTY_FIVE_DAY = {m:1,d:15}

// Form (site/lib/form.js): raw UI state, which is what gets saved
{ version: 1, fields: { [FIELD_NAME]: string }, takingCash: boolean,
  quoteDownCents: integer, nextExtraId: integer,
  extras: [{ id, type, name, priceText, inDeal: boolean, taxed: boolean }] }

// DealInputs (site/lib/inputs.js): parsed values; null = blank or invalid
{ stickerCents, targetCents, saleCents, rebatesCents /*0 when blank*/, docFeeCents,
  titleRegistrationCents, theirTaxCents, theirDriveAwayCents,
  downCents /*0 when blank*/, quoteDownCents, theirAprMilli, months, theirPaymentCents,
  specialAprMilli, specialCoversMonths, cashInsteadCents, takingCash, outsideAprMilli,
  extras: [{ id, type, name, priceCents /*0 when blank*/, inDeal, taxed }],
  contract: { amountFinancedCents, financeChargeCents, totalOfPaymentsCents, aprMilli,
              paymentCents, paymentCount, finalPaymentCents, timing /*Timing|null*/ } }

// Price (site/lib/price.js); all fields except hasSale are null when hasSale is false
{ hasSale, vehicleBaseCents, vehicleBp, serviceBaseCents, taxCents, registrationExcessCents,
  subtotalCents, dmvCents, dmvEstimated, driveAwayCents, amountFinancedCents, isCashDeal, ctDmvCents }

// Deal (site/lib/deal.js)
{ inputs, price, hasSale, isCashDeal,
  deskTimings /*Timing[]*/, contractTiming /*Timing|null*/,
  theirAprPercent /*number|null*/, shouldBeCents, expected /*{lowCents,highCents}|null*/,
  quoteCurrent /*boolean|null*/, workedOutRate /*{percent,zero,over100}|null*/,
  theirRate /*{percent, entered, over100}|null*/, specialApplies,
  docFeeCostCents, extras: [{ id, costCents, perMonthCents, overLoanCents }],
  extrasInDeal /*{costCents, perMonthCents, overLoanCents}|null*/ }

// Card (site/lib/*-checks.js)
{ key, number, severity /*'red'|'amber'|'green'|'neutral'*/, headline, sentence, context /*string|null*/, math /*string[]*/ }
```

`FIELD_NAMES`, in this order, are: `stickerTotal targetPrice salePrice rebates docFee titleRegistration theirTax theirDriveAway downPayment theirApr months theirPayment specialApr specialCoversMonths cashInstead outsideApr contractAmountFinanced contractFinanceCharge contractTotalOfPayments contractApr contractPayment contractPaymentCount contractFinalPayment contractDate firstPaymentDate`.

Card keys and numbers:
- payment 1, rateCap 2, specialRate 3, outsideRate 4, specialOrCash 5
- target 6, sticker 7, tax 8, driveAway 9, docFee 10, dmvFees 11, extras 12
- contractAmountFinanced 13, contractBox 14, contractPayments 15, contractApr 16, contractVsQuote 17
- payingCash 1, start 0

## File map

```
site/index.html            page markup (strip, tabs, fields, containers)       Tasks 1, 7
site/styles.css            mobile-first styles, light/dark                      Tasks 1, 7
site/app.js                DOM wiring, saving, service-worker registration      Tasks 1, 2, 15–17
site/offline.js            service worker: release cache, cache-first           Task 2
site/manifest.webmanifest  home-screen install                                  Task 1
site/icons/                icon-192.png, icon-512.png, apple-touch-icon.png     Task 1
site/lib/numbers.js        parse/format amounts and rates, cent rounding        Task 3
site/lib/calendar.js       plain dates, Appendix J month counting               Task 4
site/lib/loan.js           present value, payment, rate solving                 Task 5
site/rules/connecticut.js  CT values, extra types, tips, checklist, CT text     Task 6
site/rules/reference.js    Experian, KBB, Reg Z values                          Task 6
site/lib/price.js          tax, DMV, drive-away, amount financed, item costs    Task 8
site/lib/form.js           form state changes, save format                      Task 9
site/lib/inputs.js         form → DealInputs + field errors                     Task 9
site/lib/deal.js           shared derived values                                Task 10
site/lib/display.js        strip, tab lines, item lines, key numbers            Task 11
site/lib/desk-checks.js    cards 1–12 and Paying cash                           Task 12
site/lib/contract-checks.js cards 13–17                                         Task 13
site/lib/checks.js         card order, start note, problem count                Task 14
tools/make-icons.js        draws the PNG icons                                  Task 1
tools/stamp-release.js     writes the release name into offline.js              Task 18
test/serve.js              static server for e2e (base path /car-buying-helper/) Task 1
test/fixtures.js           Example 1 as DealInputs                              Task 8
test/unit/*.test.js, test/integration/examples.test.js, test/e2e/*.spec.js
playwright.config.js, package.json, .github/workflows/deploy.yml, README.md
```

## Execution order

Each wave starts after the one before it is committed. Tasks in the same wave touch disjoint files, so they can run in parallel. Parallel implementers don't run git and run only their own tests; the orchestrator commits each task once its review passes. For Playwright runs in a parallel wave, pass `--output=test-results/task-<n>` so runs don't clear each other's results.

1. Task 1
2. Tasks 2, 3, 4, 5, 6, 7
3. Task 8
4. Tasks 9, 10
5. Task 11
6. Tasks 12, 13
7. Task 14
8. Tasks 15 → 16 → 17 in sequence, with Task 18 alongside
9. Task 19

---

### Task 1: Scaffold, tooling, icons and the ABOUTME guard

**Files:**
- Create: `package.json`, `playwright.config.js`, `test/serve.js`, `test/e2e/fixtures.js`, `test/e2e/page.spec.js`, `test/unit/aboutme.test.js`, `test/unit/icons.test.js`, `tools/make-icons.js`, `site/manifest.webmanifest`, `site/icons/*.png`
- Create, with only the two ABOUTME lines as content: `site/styles.css`, `site/app.js`, every `site/lib/*.js` and `site/rules/*.js` in the file map
- Create: `site/index.html` (minimal)
- Modify: `.gitignore` (add `node_modules/`, `test-results/`, `playwright-report/`)

**Interfaces:**
- Produces:
  - `startServer(rootDir, port, basePath = '/car-buying-helper/') → Promise<http.Server>` (in `test/serve.js`)
    - also runs from the command line: `node test/serve.js site 4173`
    - content types: `.html` `text/html`, `.js` `text/javascript`, `.css` `text/css`, `.webmanifest` `application/manifest+json`, `.png` `image/png`
    - sends `Cache-Control: no-cache`; 404 for unknown paths
  - `test` and `expect` from `test/e2e/fixtures.js`. Each test fails if the page logs a console error or throws.
  - The e2e base URL `http://localhost:4173/car-buying-helper/`.
  - npm scripts:
    - `test`: `node --test "test/unit/**/*.test.js" "test/integration/**/*.test.js"`
    - `test:e2e`: `playwright test`
    - `serve`: `node test/serve.js site 4173`

- [ ] **Step 1: Create the branch and the project.** Run `git switch -c wip/deal-analyzer`.
  - `package.json`: `"private": true`, `"type": "module"`, `"engines": {"node": ">=22"}`, the three scripts above, and devDependency `"@playwright/test": "1.64.1"`.
  - Then run `npm install` and `npx playwright install chromium firefox webkit`.
- [ ] **Step 2: Write the guard's failing test.** In `test/unit/aboutme.test.js`, write a `missingHeaders(rootDir)` helper and two tests:
  - `missingHeaders flags a file without the header`: build a temp dir with `good.js` (two `// ABOUTME:` lines) and `bad.js` (none), and expect `['bad.js']`.
  - `every code file in the repo starts with two ABOUTME lines`: `missingHeaders(repoRoot)` deep-equals `[]`.

  The helper checks `.js .mjs .css .html .yml .yaml` files, and skips `node_modules .git test-results playwright-report .superpowers` and the three exempt JSON files.
- [ ] **Step 3:** Run `node --test test/unit/aboutme.test.js`. Expected: the first test FAILS (the helper isn't implemented yet).
- [ ] **Step 4:** Implement `missingHeaders`. Rerun. Expected: PASS.
- [ ] **Step 5: Write the failing e2e test and its tooling.**
  - `test/e2e/page.spec.js`:
    - `page renders in standards mode`: load `./`, then `expect(page).toHaveTitle('Car Buying Helper')` and `document.compatMode === 'CSS1Compat'`.
    - `manifest loads`: fetch `manifest.webmanifest` from the page and expect `name === 'Car Buying Helper'`.
  - `playwright.config.js`:
    - `webServer: { command: 'node test/serve.js site 4173', url: 'http://localhost:4173/car-buying-helper/', reuseExistingServer: true }`, so parallel runs share one server, and `use.baseURL` the same URL
    - project `webkit`: `devices['iPhone 15']`
    - project `chromium`: `{browserName:'chromium', viewport:{width:393,height:852}, isMobile:true, hasTouch:true, deviceScaleFactor:3}`
    - project `firefox`: `{browserName:'firefox', viewport:{width:393,height:852}}`
- [ ] **Step 6:** Run `npx playwright test test/e2e/page.spec.js`. Expected: FAIL, because there's no page yet.
- [ ] **Step 7: Write the failing icon test.** `test/unit/icons.test.js`:
  - read each PNG's IHDR: `icon-192.png` is 192×192, `icon-512.png` 512×512, `apple-touch-icon.png` 180×180
  - the manifest has `display: 'standalone'`, `start_url: './'` and `scope: './'`, and lists the 192 and 512 icons with `type: 'image/png'`

  Run it. Expected: FAIL.
- [ ] **Step 8: Create the files.**
  - `site/index.html`:
    - the ABOUTME comment lines, then `<!doctype html>`, `lang="en"`, charset, and `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
    - `<title>Car Buying Helper</title>`, `<link rel="manifest" href="manifest.webmanifest">`, `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`, `<link rel="stylesheet" href="styles.css">` and `<script type="module" src="app.js"></script>`
    - `<main><h1>Car Buying Helper</h1></main>`
  - The stubs.
  - `site/manifest.webmanifest`: name "Car Buying Helper", short_name "Car Deal", and theme and background colors.
  - `tools/make-icons.js`: draws a white check mark on a dark green (`#14532d`) square and writes the three PNGs with `zlib.deflateSync` and a CRC32. Run it once with `node tools/make-icons.js`.
- [ ] **Step 9: Run every test.** Run `npm test` and `npm run test:e2e`. Expected: all pass, in all three browsers, with clean output.
- [ ] **Step 10: Commit.** `git add -A && git commit -m "Scaffold the site, test tooling and icons"`.

### Task 2: Offline cache

**Files:** Create `site/offline.js`, `test/unit/offline-files.test.js`, `test/e2e/offline.spec.js` · Modify `site/app.js`

**Interfaces:**
- Produces:
  - `site/offline.js` contains the line `const RELEASE = 'development';` exactly once. Its cache is named `` `car-buying-helper-${RELEASE}` ``, and `FILES` lists `'./'` plus every file under `site/` except `offline.js`.
  - `site/app.js` registers the worker with `navigator.serviceWorker.register('offline.js', { updateViaCache: 'none' })` when `'serviceWorker' in navigator`.

- [ ] **Step 1: Write the failing unit tests.** In `test/unit/offline-files.test.js`:
  - `FILES lists every site file`: parse the `FILES` array from the text of `offline.js` (don't import it) and compare, sorted, with a recursive listing of `site/`.
  - `release placeholder appears once`.
- [ ] **Step 2: Write the failing e2e tests.** In `test/e2e/offline.spec.js`:
  - `opens offline after one online visit`:
    - load the page, then wait for `navigator.serviceWorker.ready` and a controller
    - `context.setOffline(true)` and reload
    - the "Car Buying Helper" heading is visible
  - `a new release replaces the old one`:
    - copy `site/` into two temp dirs. In each, set RELEASE to `'A'` or `'B'` and add `<meta name="test-release" content="A">` (or `B`) to `index.html`.
    - serve A on port 4174 with `startServer`, load the page, and wait for the controller
    - stop A and start B on 4174. Reload, then wait until `caches.keys()` equals `['car-buying-helper-B']`. Reload again.
    - the meta content is `B`, and the cached `index.html` text contains `content="B"`
- [ ] **Step 3:** Run `node --test test/unit/offline-files.test.js && npx playwright test test/e2e/offline.spec.js`. Expected: FAIL.
- [ ] **Step 4: Implement `offline.js` and the registration.**
  - install: open the cache, `addAll(FILES.map(f => new Request(f, { cache: 'reload' })))`, then `skipWaiting()`
  - activate: delete every `car-buying-helper-*` cache except the current one, then `clients.claim()`
  - fetch (GET only): answer from the cache (`ignoreSearch: true`), falling back to the network
- [ ] **Step 5: Run the tests.** Rerun Step 3's commands. Expected: PASS in WebKit, Chromium and Firefox.
  - **If any browser can't run the offline tests, stop and report it to the orchestrator.** It goes to Erik (§13); don't skip or weaken the test.
- [ ] **Step 6: Commit.** Run `git add site/offline.js site/app.js test/unit/offline-files.test.js test/e2e/offline.spec.js && git commit -m "Cache the page for offline use"`.

### Task 3: Numbers (`site/lib/numbers.js`)

**Interfaces:**
- Produces:
  - `parseAmount(text) → {cents, error}`. Blank → `{cents:null, error:null}`.
  - `parseRate(text) → {milli, error}`.
  - `parseWholeNumber(text, {min, max}) → {value, error}`.
  - `divideHalfUp(numerator, denominator) → integer`, for non-negative integers.
  - `formatCents(cents)` → `"$671.65"`. Negative amounts use U+2212: `"−$4.86"`.
  - `formatDollars(cents)` (half up), `formatAbout(cents)` (nearest $10, half up), `formatDollarsDown(cents)`.
  - `formatTensDown(cents)`: rounds down to $10 at $10 and over, and down to the dollar under $10.
  - `formatRateMilli(milli, decimals = 2)` and `formatRatePercent(percent, rounding = 'halfUp' | 'down', decimals = 2)`. Two decimals or fewer drops trailing zeros; 3 decimals stays fixed.
  - `formatPointsMilli(milli)` and `formatPointsPercent(points, rounding)` → `"0.4 points"`, `"1 point"`.
  - `formatAmountForField(cents)` → `"5,500"` or `"5,500.50"`.

- [ ] **Step 1: Write the failing tests** (`test/unit/numbers.test.js`). Each line is an `assert.deepEqual` or `assert.equal`:

```js
parseAmount('$36,500') → {cents:3650000,error:null}; '36500' → 3650000; ' 36,500 ' → 3650000
'36,500.5' → 3650050; '36,' → 3600 (Review Focus 1); '36.' → 3600; '$' → {cents:null,error:null}; '' → same
'abc' → error 'Enter a number, like 36,500.'; '-500' and '−500' → 'Can't be negative.'
'500000.01' → 'Must be $500,000 or less.'; '1.234' → 'Use at most 2 decimals.'
parseRate('5.9') → 5900; '5.9%' → 5900; '5.9 %' → 5900; '5.' → 5000; '6.135' → 6135; '30' → 30000
'30.001' → 'Must be 30% or less.'; '5.1234' → 'Use at most 3 decimals.'; 'x' → 'Enter a rate, like 5.9.'
parseWholeNumber('60',{min:1,max:96}) → 60; '60.5' → 'Enter a whole number.'; '0' and '97' → 'Must be from 1 to 96.'
divideHalfUp(3643000*635, 10000) → 231331; divideHalfUp(3243000*635, 10000) → 205931; divideHalfUp(3482514, 36) → 96737
formatCents(67165) '$671.65'; formatCents(-486) '−$4.86'; formatDollars(3982514) '$39,825'; formatDollars(37560) '$376'
formatAbout(178867) '$1,790'; formatAbout(178500) '$1,790'; formatDollarsDown(189840) '$1,898'
formatTensDown(132925) '$1,320'; formatTensDown(880) '$8'
formatRateMilli(5900) '5.9%'; (0) '0%'; (6135) '6.14%'; (5900,3) '5.900%'
formatRatePercent(7.440472,'down') '7.44%'; (1.900455) '1.9%'; (5.799797,'halfUp',3) '5.800%'; (0.000326,'down') '0%'
formatPointsMilli(400) '0.4 points'; (1000) '1 point'; (635) '0.64 points'; formatPointsPercent(1.940472,'down') '1.94 points'
formatAmountForField(550000) '5,500'; (550050) '5,500.50'
```

- [ ] **Step 2:** Run `node --test test/unit/numbers.test.js`. Expected: FAIL (the exports aren't defined).
- [ ] **Step 3: Implement.**
  - Parse amounts from the digit string: strip `$`, commas and spaces, split on `.`, and pad the cents. Never multiply a float by 100.
  - `formatRateMilli` uses `divideHalfUp`, so `6135` → `614` hundredths.
- [ ] **Step 4:** Run `node --test test/unit/numbers.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Parse and format amounts and rates".

### Task 4: Calendar (`site/lib/calendar.js`)

**Interfaces:**
- Produces:
  - `parseCalendarDate(text) → {year, month, day} | null`. It reads `YYYY-MM-DD` and rejects impossible dates.
  - `firstPeriod(contractDate, firstPaymentDate) → {m, d} | null`. It returns null unless the first payment is after the contract date.

- [ ] **Step 1: Write the failing tests** (`test/unit/calendar.test.js`). Each line is contract date → first payment date → expected `{m, d}`:

```js
'2026-10-30'→'2026-12-14' {m:1,d:15}; '2026-10-30'→'2026-11-19' {m:0,d:20}; '2027-01-31'→'2027-03-30' {m:1,d:28}
'2027-01-15'→'2027-02-28' {m:1,d:16}; '2028-01-30'→'2028-03-30' {m:2,d:0}; '2026-10-15'→'2026-11-15' {m:1,d:0}
'2026-10-30'→'2026-11-14' {m:0,d:15}; '2026-10-30'→'2026-10-30' null; '2026-10-30'→'2026-10-01' null
parseCalendarDate('2026-02-30') null; ('2026-13-01') null; ('') null; ('2026-10-30') {year:2026,month:10,day:30}
```

- [ ] **Step 2:** Run `node --test test/unit/calendar.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the month-back rule from §7.3: clamp to the month's last day, and use the last day of each month when the first payment falls on a month's last day. Count whole UTC days, never local time. Set the year with `setUTCFullYear`, because `Date.UTC` reads years 0–99 as 1900–1999.
- [ ] **Step 4:** Run `node --test test/unit/calendar.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Count first-payment months and days".

### Task 5: Loan math (`site/lib/loan.js`)

**Interfaces:**
- Consumes: `divideHalfUp` (Task 3).
- Produces:
  - `REGULAR` and `FORTY_FIVE_DAY`, both frozen.
  - `presentValue(paymentsCents, ratePercent, timing) → number`, in cents, unrounded.
  - `monthlyPayment(amountCents, ratePercent, n, timing = REGULAR) → integer`. It returns 0 when the amount is 0 or less, and `divideHalfUp(amount, n)` at 0%.
  - `levelPayments(paymentCents, n, finalCents = null) → number[]`: n payments of paymentCents, then finalCents when it's given (n + 1 payments in all).
  - `solveRate(paymentsCents, amountCents, timing) → {percent} | {tooLow:true} | {tooHigh:true}`. It bisects in percent on [0, 100] until the bracket is under 1e-7 points, and returns the lower end (§7.5).

- [ ] **Step 1: Write the failing tests** (`test/unit/loan.test.js`). AF is `3482514`:

```js
monthlyPayment(AF,5.9,60) 67165; (AF,5.9,60,FORTY_FIVE_DAY) 67330; (AF,5.9,60,{m:0,d:20}) 67055; (AF,0,36) 96737
monthlyPayment(AF,5.5,60) 66520; (AF,5.9,36) 105787; (AF,6.5,60) 68139; (AF,5.9,12,{m:0,d:15}) 298835; (0,5.9,60) 0
|presentValue(levelPayments(69900,60),5.9,REGULAR) − AF − 141813.4| < 1;  same with FORTY_FIVE_DAY → 132925 ± 1
solveRate(levelPayments(69900,60),AF,REGULAR).percent ≈ 7.5710 (±0.0001); FORTY_FIVE_DAY ≈ 7.4405
Appendix J (b)(9): solveRate(levelPayments(3361,36),100000,REGULAR) ≈ 12.8256
Appendix J (c)(1)(ii): solveRate(levelPayments(20000,36),600000,{m:1,d:19}) ≈ 11.8165
solveRate(levelPayments(67165,59,78651),AF,FORTY_FIVE_DAY) rounds (3 dp, half up) to 5.900
solveRate(levelPayments(298835,12),AF,REGULAR) ≈ 5.4419; with {m:0,d:15} ≈ 5.9002
solveRate(levelPayments(1000,10),AF,REGULAR) {tooLow:true}; solveRate(levelPayments(1000000,60),AF,REGULAR) {tooHigh:true}
```

- [ ] **Step 2:** Run `node --test test/unit/loan.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** per §7.4. The fraction factor is `(1 + (d/30)·i)` and the exponent is `m + k − 1`.
- [ ] **Step 4:** Run `node --test test/unit/loan.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Add payment, present value and rate solving".

### Task 6: Rules (`site/rules/connecticut.js`, `site/rules/reference.js`)

**Interfaces:**
- Produces `connecticut`:
  - `{ state: 'Connecticut', asOf: '2026-10-27' }`
  - `tax: { standardBp: 635, luxuryBp: 775, luxuryThresholdCents: 5000000 }`
  - `dmv: { financedCents: 26400, cashCents: 25400, breakdown: [{label, cents, financedOnly}] }`
  - `docFeeBenchmarkCents: 100000`, `aprCapMilli: 15000`
  - `extraTypes: { warranty, gap, maintenance, tireWheel, paintFabric, vinEtch, other }`, each `{ label, taxClass: 'vehicle'|'service', taxedByDefault, tip|null, taxedHint|null }`
  - `hints: { salePrice }`, `checklist: string[8]`
  - `text: { rateCapHeadline(cap), taxRightHeadline, taxOffHeadline(amount, moreOrLess), taxReasons, taxRegistrationReason(amount), docFeeHighHeadline(fee), docFeeSentence(cost), dmvHighHeadline(amount), dmvHighSentence(ctAmount, isCash), dmvOkHeadline }`
  - `sources: [{rule, cite}]`
- Produces `reference`:
  - `experian: { text, asOf }`, `kbb: { text, asOf }`
  - `regZ: { aprToleranceMilli: 125, firstPeriodLimits: { underOneYear: {shorter: 6, longer: 13}, oneYearAndOver: {shorter: 11, longer: 21} } }`
- Values and wording come from §6.4, §6.5 (cards 2, 8, 10 and 11, and the checklist), §8.1 and §8.2.

- [ ] **Step 1: Write the failing tests** (`test/unit/rules.test.js`):

```js
breakdown sums to 26400; without financedOnly items 25400
extraTypes.gap → {label:'GAP', taxClass:'vehicle', taxedByDefault:false}; warranty, maintenance, tireWheel → service + taxed
paintFabric, vinEtch, other → vehicle + taxed; vinEtch.tip 'CT requires your written consent.'
text.rateCapHeadline('15%') "Over Connecticut's 15% legal cap for new-car loans."
text.dmvHighSentence('$254', true) includes 'CT charges $254 when you pay cash.'
text.docFeeHighHeadline('$1,200') '$1,200 doc fee is above what CT Mazda dealers charge.'
checklist.length 8; checklist[5] 'There is no cooling-off period. The deal is final when you sign.'
reference.experian.text 'Buyers with 781+ scores averaged 4.41% on new-car loans in Q2 2026 (Experian; includes automaker specials).'
reference.kbb.text 'New cars averaged 3.4% under sticker nationally in Sept 2026 (KBB).'
```

- [ ] **Step 2:** Run `node --test test/unit/rules.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules as plain exported objects. Templates are small functions that take strings that are already formatted.
- [ ] **Step 4:** Run `node --test test/unit/rules.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Add Connecticut rules and reference values".

### Task 7: Page markup and styles (`site/index.html` body, `site/styles.css`)

**Interfaces:**
- Produces the DOM contract that Tasks 15–17 and every e2e test use:
  - **Strip:** `[data-strip=drive-away]`, `[data-strip=should-be]`, `[data-strip=theirs]`, and the button `[data-strip=problems]`.
  - **Tabs:** `role=tab` buttons named Price, Loan, Extras, Verdict, controlling `#panel-price` and the matching panels. Only Price is visible at load.
  - **Inputs:** one per field name, with `id` equal to the field name and the visible label from the §6.2/§6.3 tables. Contract labels: Amount financed, Finance charge, Total of payments, APR, Monthly payment, Number of payments, Final payment, Contract date, First payment date. Each input has a `[data-error-for=<field>]` element, and the date pair has `[data-hint-for=contractDates]`.
  - **Keypads:** `inputmode=decimal` for amounts and rates; `inputmode=numeric` for months, specialCoversMonths and contractPaymentCount; `type=date` for the two dates.
  - **Down payment buttons:** `[data-step-down=-50000]` "−$500" and `[data-step-down=50000]` "+$500".
  - **Switch:** `#takingCash`, `type=checkbox role=switch`, labeled "Taking the cash instead".
  - **Calculated lines:** `[data-calc=discount|tax-line|dmv|drive-away|their-tax-check|their-drive-away-check|amount-financed]`.
  - **Contract section:** `<details id=contract>` with the summary "At signing: the contract".
  - **Extras:** `[data-add-extra=<type>]` buttons in the §6.4 order, and the list `[data-extras]`.
  - **Verdict:** `[data-key-numbers]`, `[data-cards]`, `[data-checklist]`, and `[data-start-over]` "Start over".
  - **Links:**
    - "Before you go: how to look up a fair price" → `https://github.com/erikbuild/car-buying-helper#before-you-go`, followed by "(opens GitHub; needs a signal)"
    - "Mazda offers (external link to www.MazdaUSA.com)" → `https://www.mazdausa.com/shopping-tools/special-offers-and-incentives`
  - **Hints:** the field hints from §6.2/§6.3. The sale price hint is filled in from `connecticut.hints` by the app; the markup has an empty element for it.
  - **Placeholder:** "0" on downPayment and rebates.

- [ ] **Step 1: Write the failing tests** (`test/e2e/layout.spec.js`). The layout tests un-hide all panels with `page.evaluate` before measuring.
  - every label in the contract above resolves with `getByLabel(label, {exact:true})` and has the stated `inputmode` or `type`
  - every input's computed font-size is ≥ 16px
  - every button, input, summary and tab is ≥ 44px tall
  - `emulateMedia({colorScheme:'dark'})` changes the body background color
  - at 320×640 and at 1280×800, `scrollWidth <= document.documentElement.clientWidth` (Review Focus 5). Chromium's mobile emulation widens `innerWidth` to fit overflowing content, so `innerWidth` can't catch it there
  - both link addresses and texts
- [ ] **Step 2:** Run `npx playwright test test/e2e/layout.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the markup and the styles.
  - CSS custom properties for colors, with a `prefers-color-scheme: dark` override. System font stack.
  - The strip is sticky at the top. Single column, `max-width: 34rem`, centered.
  - Severity colors plus words: red "Problem", amber "Check", green "OK", neutral "Note".
- [ ] **Step 4:** Run `npx playwright test test/e2e/layout.spec.js test/e2e/page.spec.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Lay out the four tabs and the strip".

### Task 8: Price (`site/lib/price.js`) and the shared fixture

**Files:** Create `site/lib/price.js`, `test/fixtures.js`, `test/unit/price.test.js`

**Interfaces:**
- Consumes: `divideHalfUp`; `connecticut`.
- Produces:
  - `taxOf(vehicleBaseCents, serviceBaseCents, rules) → {taxCents, vehicleBp}`. It rounds once (§7.1).
  - `priceOf(inputs, rules) → Price`. The registration excess over `rules.dmv.financedCents` joins the vehicle base, and DMV and cash deals follow §7.2.
  - `itemCostCents(inputs, rules, extraId) → integer`, which is the price plus the tax it adds.
  - `docFeeCostCents(inputs, rules) → integer|null`.
  - `extrasInDealCostCents(inputs, rules) → integer`.
  - `dealInputs(overrides = {})` in `test/fixtures.js`: Example 1 (§7.11) as DealInputs. `contract` fields are null and `quoteDownCents` is 500000.

- [ ] **Step 1: Write the failing tests:**

```js
priceOf(dealInputs()) → taxCents 236214, dmvCents 26400, dmvEstimated true, driveAwayCents 3982514, amountFinancedCents 3482514, isCashDeal false
takingCash:true → driveAwayCents 3882514, amountFinancedCents 3382514, taxCents 236214
downCents 4000000 → dmvCents 25400, driveAwayCents 3981514, amountFinancedCents −18486, isCashDeal true, ctDmvCents 25400
downCents 3982000 → 25400 / −486; 3981514 → 25400 / 0; 3981513 → 26400 / 1001
titleRegistrationCents 30000 → registrationExcessCents 3600, taxCents 236442, driveAwayCents 3986342
taxOf(3643000,0) 231331; saleCents 4950000 + doc 69900 → vehicleBp 775, taxCents 389042; vehicle base 5000000 → 635, 317500
taxed GAP in deal, sale 4919900, docFee null → taxCents 388229
VIN etch $400 taxed in deal on sale 4900000 + doc 69900 → itemCostCents 112678
warranty (not in deal, taxed) itemCostCents 318518; GAP 89500; docFeeCostCents 74339; docFee null → null
saleCents null → {hasSale:false, …all null}
```

- [ ] **Step 2:** Run `node --test test/unit/price.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** per §7.1–§7.2 and §7.7.
- [ ] **Step 4:** Run `node --test test/unit/price.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Compute CT tax, DMV, drive-away and item costs".

### Task 9: Form state and inputs (`site/lib/form.js`, `site/lib/inputs.js`)

**Interfaces:**
- Consumes: Task 3's parsers; `parseCalendarDate` and `firstPeriod`; `connecticut.extraTypes`; `dealInputs` from `test/fixtures.js` (Task 8).
- Produces from `form.js`:
  - `FIELD_NAMES`, `FORM_VERSION = 1`, and `emptyForm() → Form` (every field `''`).
  - `editField(form, name, text) → Form`. Typing `theirPayment` or `downPayment` sets `quoteDownCents` to the down payment at that moment, with blank or invalid counting as 0.
  - `stepDownPayment(form, deltaCents) → Form`. It writes `formatAmountForField(max(0, down + delta))` and leaves `quoteDownCents` alone.
  - `setTakingCash(form, on)`.
  - `addExtra(form, type, rules)` with id `extra-<n>`, the name from the type's label, `inDeal: false`, and `taxed` from `taxedByDefault`.
  - `editExtra(form, id, changes)` and `removeExtra(form, id)`.
  - `serializeForm(form) → string` and `deserializeForm(text, rules) → Form | null`. Null when the text doesn't parse, the version differs, a field is missing or isn't a string, or an extra has an unknown type.
- Produces from `inputs.js`: `readInputs(form) → { inputs: DealInputs, errors: {[field]: string}, extraErrors: {[id]: string}, dateHint: string|null }`.
  - Limits follow §9.
  - Months, specialCoversMonths and contractPaymentCount are whole numbers from 1 to 96.
  - With exactly one date entered, `dateHint` is 'Enter both dates.'
  - With both dates in the wrong order: `errors.firstPaymentDate = 'The first payment date must be after the contract date.'`

- [ ] **Step 1: Write the failing tests** (`test/unit/form.test.js`, `test/unit/inputs.test.js`):

```js
editField(emptyForm(),'theirPayment','699') then editField(…,'downPayment','5000') → quoteDownCents 500000 (entry order)
stepDownPayment(+50000) → fields.downPayment '5,500', quoteDownCents 500000; two −50000 steps from '' → '0'
editField(…,'theirPayment','699') after a step → quoteDownCents 550000
addExtra(emptyForm(),'warranty',ct) → extras[0] {id:'extra-1', type:'warranty', name:'Extended warranty', priceText:'', inDeal:false, taxed:true}
deserializeForm(serializeForm(f)) deep-equals f; '{bad' → null; version 2 → null; missing 'months' → null; type 'rustproof' → null
readInputs on a form built by editField, in this order, from Example 1's fields (salePrice '$36,500', docFee '699', downPayment '5,000',
  theirApr '5.9', months '60', theirPayment '699', specialApr '0', specialCoversMonths '36', cashInstead '1,000', outsideApr '5.5')
  deep-equals dealInputs()
salePrice 'abc' → errors.salePrice 'Enter a number, like 36,500.', inputs.saleCents null
downPayment '' → downCents 0; rebates 'x' → rebatesCents 0 with errors.rebates set
contractDate only → dateHint 'Enter both dates.', contract.timing null; '2026-10-30'+'2026-12-14' → timing {m:1,d:15}
months '60.5' → errors.months 'Enter a whole number.'; contractPaymentCount '0' → 'Must be from 1 to 96.'
```

  `test/unit/inputs.test.js` imports `dealInputs` from `test/fixtures.js`.
- [ ] **Step 2:** Run `node --test test/unit/form.test.js test/unit/inputs.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Every state change returns a new object.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit.** "Track form state, saving format and parsed inputs".

### Task 10: Deal (`site/lib/deal.js`)

**Interfaces:**
- Consumes: `priceOf`, `itemCostCents`, `docFeeCostCents`, `extrasInDealCostCents`; the loan module; `dealInputs`.
- Produces: `deriveDeal(inputs, rules) → Deal`.
  - `deskTimings` is `[REGULAR, FORTY_FIVE_DAY]`, plus `contract.timing` when it's set (§7.3).
  - `shouldBeCents` and `expected` need their APR, months, and a loan.
  - `quoteCurrent` is `theirPaymentCents != null ? downCents === quoteDownCents : null`.
  - `workedOutRate` (R, §7.5) needs a blank APR, a current payment, months and a loan. Its percent is the smallest `solveRate` over `deskTimings`. It's 0 when payment × months ≤ AF, and it sets `over100` (percent 100) on `tooHigh`.
  - `theirRate` is the entered APR or R. `specialApplies` follows §7.6.
  - Extras' per-month figures use their rate and the regular timing (§7.7). For an item in the deal, when AF − cost ≤ 0, per month is `monthlyPayment(AF)`.

- [ ] **Step 1: Write the failing tests** (`test/unit/deal.test.js`):

```js
deriveDeal(dealInputs()) → shouldBeCents 67165, expected {lowCents:67165, highCents:67330}, quoteCurrent true,
  theirRate {percent:5.9, entered:true, over100:false}, specialApplies false, docFeeCostCents 74339
contract.timing {m:0,d:20} → expected {lowCents:67055, highCents:67330}
theirAprMilli null → workedOutRate.percent ≈ 7.4405, theirRate {entered:false}
theirAprMilli 0, months 36 → specialApplies true; takingCash true → false
downCents 550000 (quote 500000) → quoteCurrent false; with APR blank → workedOutRate null, theirRate null
APR blank, months 36, theirPaymentCents 96737, AF 3482514 → workedOutRate {zero:true}
APR blank, theirPaymentCents 699000 → workedOutRate {over100:true, percent:100}
warranty added, not in deal → extras[0] {costCents:318518, perMonthCents:6143, overLoanCents:368580}; GAP 89500/1726/103560
warranty in deal, downCents 4200000 → price AF 101032, extras[0].perMonthCents 1949
downCents 4000000 → isCashDeal true, shouldBeCents null, extras perMonthCents null
```

- [ ] **Step 2:** Run `node --test test/unit/deal.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `node --test test/unit/deal.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Derive the deal's shared values".

### Task 11: Display text (`site/lib/display.js`)

**Interfaces:**
- Consumes: Deal and Card shapes; Task 3's formatters.
- Produces:
  - `summaryStrip(deal, cards) → {driveAway, shouldBe, theirs /*string|null*/, problems}` (§6.1).
  - `taxLine(price) → string`, with one term per base in use.
  - `priceTabLines(deal) → {discount, taxLine, dmv, driveAway, theirTaxCheck, theirDriveAwayCheck}`.
  - `amountFinancedLine(deal)` and `extraLine(deal, extraId)` (§6.4).
  - `keyNumbers(deal) → [{label, value}]`.

- [ ] **Step 1: Write the failing tests** (`test/unit/display.test.js`). Cards in these tests are plain objects such as `{severity:'red'}`.

```js
Example 1 + [red, amber, amber, green] → {driveAway:'$39,825', shouldBe:'should be $671.65', theirs:'theirs $699.00', problems:'3 problems'}
one amber → '1 problem'; none → 'No problems'; saleCents null → driveAway '—', problems '—'
downCents 4000000 → shouldBe 'Paying cash', theirs null; downCents 550000 → theirs 'theirs $699.00 at $5,000 down'
APR blank → shouldBe 'should be —'
taxLine(Example 1) '6.35% of $37,199.00 = $2,362.14'
sale 5100000, docFee null, warranty 299500 taxed in deal → '7.75% of $51,000.00 + 6.35% of $2,995.00 = $4,142.68'
extraLine warranty not in deal 'Would add $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)'; in deal starts 'Adds $61.43/mo'
cash deal → 'Would add $3,185.18 with tax'
priceTabLines: sticker 3800000 → discount '$1,500.00 off the sticker (3.9%)'; dmv '$264.00 (estimated)'
theirTax 236214 → theirTaxCheck '✓ Matches'; 240000 → '$37.86 more than the page's'
keyNumbers(APR blank) includes {label:'Their rate', value:'at least 7.44%, from their payment'}
```

- [ ] **Step 2:** Run `node --test test/unit/display.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `node --test test/unit/display.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Write the strip and tab lines".

### Task 12: Desk cards (`site/lib/desk-checks.js`)

**Interfaces:**
- Consumes: Deal; `taxLine`; `connecticut`, `reference`; the loan module.
- Produces:
  - `deskCards(deal, rules, reference) → Card[]`, in card-number order. It returns cards 1–12 when it's a loan, and Paying cash in place of 1–5 in a cash deal.
  - `hiddenAmountCents(deal)` (E, §7.5).
  - `rateCostCents(deal, benchmarkPercent)` (§7.8).
  - `specialVsCash(deal, rules) → {nA, paymentACents, af0Cents, afBCents, paymentBCents, costACents, costBCents, winner, differenceCents, breakEven /*{percent}|{none:'cash'|'special'}*/, cashCoversRest}`. AF₀ and AF_B use `priceOf` with `takingCash` false and true (§7.9).
- Every headline and outcome order is in §6.5 cards 1–12 and the Paying cash note.

- [ ] **Step 1: Write the failing tests** (`test/unit/desk-checks.test.js`). Each line is inputs → `[severity, headline]` for the card under test:

```js
Example 1 → keys [payment, specialRate, outsideRate, specialOrCash, docFee, extras] with headlines
  "$699.00/mo doesn't add up." | "You're not getting the 0% special or the $1,000 cash." | "0.4 points over your outside rate."
  | "The 0% special beats the $1,000 cash by about $1,790." | "$699 doc fee." | "No extras in the deal."
card 1 sentence (Example 1) = "At 5.9% for 60 months it should be $671.65 to $673.30. Either the real rate is at least 7.44%, or at least $1,320 extra is in the loan, or the first payment is more than 45 days away."
hiddenAmountCents ≈ 132925; rateCostCents(Example 1, 5.5) 38700; specialVsCash → nA 36, paymentACents 96737, afBCents 3382514, paymentBCents 64610, winner 'special', breakEven ≈1.9005
card 1: downCents 600000 → neutral "Their payment was quoted at $5,000 down.", sentence starts "At $6,000 down it should be $652.36."
card 1: 0%/36, $965.00 → red "$965.00/mo for 36 months can't pay off $34,825."; $967.36 → green "$967.36/mo matches 36 months at 0%."
card 1: 5.9%/60, $650.00 → amber "$650.00/mo is less than this deal should cost."
card 1: APR blank → neutral "$699.00/mo for 60 months works out to at least 7.44%."; 0%/36 $967.37 → "…works out to 0%."; $6,990 → "…works out to over 100%."
card 1: 0%/36 $990.00 → sentence "At 0% for 36 months it should be $967.37. Either the real rate is at least 1.46%, or at least $810 extra is in the loan." (no 45-day clause)
card 1: docFee null → sentence starts "The doc fee isn't entered yet."; 6-month loan, $5,920.49 → sentence includes "at least $8 extra"
card 1: contract.timing {m:1,d:0}, their $673.30 → green
card 2: their APR 15.5% → red "Over Connecticut's 15% legal cap for new-car loans."; 15% → no rateCap card
card 3: switch on + cashInstead null → neutral "Enter the cash offered instead of the special rate."
card 3: 0% at 60 months → green "On the automaker's 0% special."; 5.9% at 36 months → red "Should be the automaker's 0% special." with "$3,258 more over 36 months" and "Or ask for the $1,000 cash instead."
card 4: APR blank → amber "At least 1.94 points over your outside rate." with "at least $1,898"; 6.5% → "1 point over your outside rate." ($971); 5.625% → green "At or under your 5.5% outside rate."
card 4: outside blank → neutral note whose text includes the Experian line
card 5: cashInstead 300000 → green "The $3,000 cash beats the 0% special by about $210." ending "The special only wins if your outside rate is above 5.94%."
card 5: downCents 3882014 → neutral "The $1,000 cash covers the rest of the loan."
card 6: target 3600000 → amber "$500 above your target."; 3650050 → green "At your target."; 3700000 → green "$500 under your target."
card 7: sticker 3800000 → green "$1,500 (3.9%) under sticker." with the KBB line; sticker 3600000 → amber "$500 above sticker."
card 8: theirTax 236214 → green "CT tax is right."; 240000 → amber "Their tax is $38 more than CT's."
card 9: 3990000 → red "$75 more than the itemized numbers add up to."; 3970000 → amber "$125 less than the itemized numbers."; 3982500 → green
card 10: docFee null → neutral "Ask for the doc fee."; 120000 → amber "$1,200 doc fee is above what CT Mazda dealers charge."
card 11: titleRegistration 30000 → amber "$36 more than CT DMV charges."; 26400 + down 4000000 → amber "$10 more than CT DMV charges." (cash deal)
card 12: warranty in deal → amber "Extras in the deal: $3,185." with "+$61.43/mo, $3,686 over 60 months. All optional."
down 4000000 → [docFee, extras, payingCash]; payingCash neutral "Paying cash: no loan to check."
```

- [ ] **Step 2:** Run `node --test test/unit/desk-checks.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - CT wording comes from `rules.text`. `math` lists the inputs and the formula.
  - When a needed input is blank, return the neutral note naming the missing fields (§6.5).
- [ ] **Step 4:** Run `node --test test/unit/desk-checks.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Check the deal at the desk".

### Task 13: Contract cards (`site/lib/contract-checks.js`)

**Interfaces:**
- Consumes: Deal; `reference.regZ`; the loan module.
- Produces:
  - `contractCards(deal, reference) → Card[]`. It returns `[]` unless a contract field other than the dates is entered, or when it's a cash deal.
  - `contractSchedule(contract) → number[] | null`. It uses the implied final payment when the final payment is blank and the total doesn't match (§7.10). With a final payment, entered or implied, the schedule is `levelPayments(payment, count − 1, final)`; without one, `levelPayments(payment, count)`.
  - `contractAprResults(deal, reference) → [{timing, percent /*number|null*/}]`, for the allowed contract timings only.
  - `quoteComparisons(deal) → {apr, payment, term}`. Each is `{ran, failed, text}`.

- [ ] **Step 1: Write the failing tests** (`test/unit/contract-checks.test.js`). The contract dates are 2026-10-30 → 2026-12-14 unless a line says otherwise.

```js
Example 2 contract → five green cards: "The amount financed matches your deal." | "The disclosure box adds up." | "Total of payments matches the schedule." | "The 0% checks out." | "The contract matches their quoted rate and term."
Example 3 → red 13 "$3,185 more is financed than your deal adds up to."; 14–17 green; quoteComparisons.payment ceiling text includes $735.88
Example 4 → all green; contractAprResults ≈ [5.800 (contract), 5.900 (regular)] (half up, 3 dp)
Example 4 with total 4041386, finance charge 558872 → card 15 neutral "Total of payments isn't 60 × $671.65."; card 16 green
Example 4 with total 4500000, finance charge 1017486 → card 16 red "The APR on the contract doesn't match its own numbers." with "They work out to 9.44%."
12-month (2026-10-30 → 2026-11-14), payment 298835 × 12, APR 5.44 → red; APR 5.9 → green
Example 6 (APR blank) + contract 60 × 69900, AF 3482514, APR 7.57 → card 17 green "The contract matches their quoted payment and term."; card 16 green
contract APR 6.4, payment 67976 → card 17 red, sentence includes "APR 6.4% against 5.9% quoted."
72 payments of 57551 → card 17 red, sentence includes "72 payments against 60 months quoted."
Example 3 AF with payment 74500 → card 17 red, sentence includes "$745.00/mo, but 5.9% on this amount financed comes to at most $734.88."
APR blank, payment blank (no rate), count 60 = months → card 17 neutral, not green
finance charge off by $2 → card 14 red "The disclosure box doesn't add up."; AF $5 low → card 13 amber "$5 less is financed than your deal adds up to."
0% contract with payment 98000 → card 16 red "This doesn't add up as a 0% loan."
only contractDate and firstPaymentDate entered → []
```

- [ ] **Step 2:** Run `node --test test/unit/contract-checks.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** per §6.5 cards 13–17 and §7.10. Contract APRs are shown rounded half up.
- [ ] **Step 4:** Run `node --test test/unit/contract-checks.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** "Check the contract's disclosure box".

### Task 14: Verdict assembly and the worked examples

**Files:** Create `site/lib/checks.js`, `test/unit/checks.test.js`, `test/integration/examples.test.js`

**Interfaces:**
- Consumes: `deskCards`, `contractCards`, `readInputs`, `deriveDeal`, `summaryStrip`, `emptyForm`, `editField`, `setTakingCash`, `addExtra`, `editExtra`.
- Produces:
  - `verdictCards(deal, rules, reference) → Card[]`. Order: red, amber, green, neutral, then card number. With no sale price, it returns only the start card: neutral, headline "Enter their sale price on the Price tab to start."
  - `problemCount(cards) → integer`.

- [ ] **Step 1: Write the failing tests.**
  - `checks.test.js`:
    - severity order and number order
    - Example 1's full order: payment, specialRate, outsideRate, specialOrCash, docFee, extras
    - no sale price → `[start]`
    - `problemCount` (Example 1) is 3
  - `examples.test.js`: build each §7.11 example from raw field text through `editField` (and `setTakingCash`). Assert, for each example:
    - the derived numbers §7.11 lists
    - the exact `[severity, headline]` list in order
    - the strip
    - Examples 1–7, plus the Extras table (both rows and the in-deal Extras card)
  - Add three more tests:
    - `empty form`: the start card only, and the strip `'—'` / `'should be —'` / `'—'`.
    - `blank-field sweep` (Review Focus 2): for every subset of these 12 Example 1 fields cleared, no card, strip or tab line text matches `/NaN|undefined|Infinity|null|\[object/`, and nothing throws. The fields: salePrice, docFee, downPayment, theirApr, months, theirPayment, specialApr, specialCoversMonths, cashInstead, outsideApr, contractAmountFinanced, contractPayment. 4,096 deals.
    - `extreme values` (Review Focus 3): run the same text check on:
      - months 1
      - a down payment leaving $0.01 financed
      - a $500,000 sale
      - a 30% APR
      - their payment $6,990
      - Example 3's contract with 96 payments
- [ ] **Step 2:** Run `node --test test/unit/checks.test.js test/integration/examples.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `checks.js`.** Fix any bug the integration tests expose in the module that owns it, with a unit test there first.
- [ ] **Step 4:** Run `npm test`. Expected: PASS, with clean output.
- [ ] **Step 5: Commit.** "Assemble the verdict and test the worked examples".

### Task 15: App wiring (`site/app.js`)

**Files:** Modify `site/app.js`, `test/e2e/offline.spec.js` · Create `test/e2e/deal.spec.js`

**Interfaces:**
- Consumes: everything above, and the DOM contract from Task 7.
- Produces:
  - `render(form)`: on every input or change, `readInputs → deriveDeal → verdictCards → summaryStrip / priceTabLines / keyNumbers`, then update the DOM. Field values are written to inputs only on load and on Start over, never while typing.
  - Card markup: `<article data-card=<key> data-severity=<sev>>` with the severity word, an `h3` headline, a sentence, an optional context line, and `<details><summary>Show the math</summary>`.
  - The checklist renders from `connecticut.checklist`.
  - Start over runs `confirm('Start over? This clears the whole deal.')`.
  - The Problems button selects the Verdict tab.

- [ ] **Step 1: Write the failing tests** (`test/e2e/deal.spec.js`):
  - **Example 1 through the UI.** Type their payment before the down payment. Expect the strip to read "$39,825", "should be $671.65", "theirs $699.00" and "3 problems". The Verdict headlines are Example 1's six, in order.
  - **Down payment buttons.** +$500 changes the drive-away and AF lines and shows "theirs $699.00 at $5,000 down". −$500 restores "theirs $699.00". From blank, −$500 leaves the field at "0".
  - **Contract.** Example 3 in the contract section shows a red `[data-card=contractAmountFinanced]`.
  - **Taking the cash instead.** Example 5's switch gives "1 problem" and "$38,825".
  - **Bad input.** Typing "abc" as the sale price shows "Enter a number, like 36,500." and puts "—" in the strip.
  - **Problems button.** Tapping it shows the Verdict panel.
  - **Requests.** Every request's origin equals the base URL's origin.
  - **Start over.** Accept the dialog; every field is empty and the strip shows "—".
  - **Offline.** In `offline.spec.js`, after the offline reload, typing a sale price of 36500 updates the strip.
- [ ] **Step 2:** Run `npx playwright test test/e2e/deal.spec.js test/e2e/offline.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npm run test:e2e`. Expected: PASS in all three browsers.
- [ ] **Step 5: Commit.** "Wire the page to the deal checks".

### Task 16: Extras tab (`site/app.js`)

**Interfaces:**
- Produces each item as `<li data-extra-id data-extra-type>` containing:
  - name `[data-extra-field=name]`, price `[data-extra-field=priceText]` (`inputmode=decimal`)
  - switches `[data-extra-field=inDeal]` "In the deal" and `[data-extra-field=taxed]` "Taxed"
  - `[data-remove-extra]` "Remove", the line `[data-extra-line]` (`extraLine`), the tip `.tip`, and GAP's taxed hint
  - inline error `[data-extra-error]`

- [ ] **Step 1: Write the failing tests** (`test/e2e/extras.spec.js`). Start from Example 1.
  - Add a warranty and enter 2995. The line is "Would add $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)", and the tip is Mazda's.
  - Toggle "In the deal". The line starts "Adds", the drive-away shows $43,010, and the Extras card is amber "Extras in the deal: $3,185."
  - A GAP item starts untaxed and shows the GAP hint. VIN etch shows "CT requires your written consent."
  - Remove restores "No extras in the deal."
- [ ] **Step 2:** Run `npx playwright test test/e2e/extras.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** "Add the Extras tab".

### Task 17: Saving the deal (`site/app.js`)

**Interfaces:**
- Produces:
  - The storage key `car-buying-helper/deal`, holding `serializeForm(form)`.
  - Saves after every change. Loads on start with `deserializeForm`, and starts fresh on null.
  - Every storage call is wrapped in try/catch.
  - Start over removes the key.

- [ ] **Step 1: Write the failing tests** (`test/e2e/saving.spec.js`):
  - Enter Example 1, one extra and the switch, then reload. Every value, the extra and the switch come back.
  - Save the sale price as "abc" and reload. The error shows again and the strip shows "—" (Review Focus 4).
  - `addInitScript` sets the key to `'{bad'`. The page loads empty with no console error.
  - Firefox only (`test.skip(browserName !== 'firefox')`), with `launchOptions.firefoxUserPrefs: {'dom.storage.enabled': false}`: the page still calculates Example 1.
  - Start over, then reload: the page is empty.
- [ ] **Step 2:** Run `npx playwright test test/e2e/saving.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** "Save the deal on the phone".

### Task 18: README and deploy

**Files:** Create `README.md`, `.github/workflows/deploy.yml`, `tools/stamp-release.js`, `test/unit/stamp-release.test.js`

**Interfaces:**
- Produces:
  - `stampRelease(text, release) → string`. It replaces `const RELEASE = 'development';` and throws unless that line appears exactly once.
  - The command line `node tools/stamp-release.js <release>`, which edits `site/offline.js` in place.

- [ ] **Step 1: Write the failing tests:**
  - stamping a copy of `offline.js` with `'abc123'` yields exactly one `const RELEASE = 'abc123';`
  - text without the placeholder throws
  - text with it twice throws
- [ ] **Step 2:** Run `node --test test/unit/stamp-release.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `stamp-release.js`.**
- [ ] **Step 4: Write `deploy.yml`.**
  - Triggers: push to `main` and `workflow_dispatch`.
  - Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`.
  - One job in environment `github-pages`, running these steps:
    1. `actions/checkout@v4`
    2. `actions/setup-node@v4` (node 22, npm cache)
    3. `npm ci`
    4. `npm test`
    5. `npx playwright install --with-deps chromium firefox webkit`
    6. `npm run test:e2e`
    7. `node tools/stamp-release.js "$GITHUB_SHA"`
    8. `actions/configure-pages@v5`
    9. `actions/upload-pages-artifact@v3` with `path: site`
    10. `actions/deploy-pages@v4`
- [ ] **Step 5: Write `README.md`** per §11. Its sections:
  - what it is, the live link `https://erikbuild.github.io/car-buying-helper/`, and how to add it to the home screen and use the icon
  - "Before you go", as a heading with exactly that text, with all six steps and the link rules
  - "At the dealer"
  - Development: `npm install`, `npx playwright install`, `npm test`, `npm run test:e2e`, `npm run serve`
  - the disclaimer
- [ ] **Step 6:** Run `npm test`. Expected: PASS, and the ABOUTME guard covers `deploy.yml` and the tools.
- [ ] **Step 7: Commit.** "Add the README and the deploy workflow".

### Task 19: Release

- [ ] **Step 1: Run every test.** Run `npm test && npm run test:e2e`. Expected: all pass with clean output.
- [ ] **Step 2: Review the branch.** Run a whole-branch review against SPEC.md and fix what it finds, test first.
- [ ] **Step 3: Merge.** Run `git switch main && git merge --ff-only wip/deal-analyzer && git push origin main`.
- [ ] **Step 4: Turn on Pages.** If Pages isn't enabled yet, run `gh api -X POST repos/erikbuild/car-buying-helper/pages -f build_type=workflow`. If the first deploy ran before that, rerun it with `gh workflow run deploy.yml`.
- [ ] **Step 5: Watch the deploy.** Run `gh run watch` until the deploy succeeds. Then `curl -sI https://erikbuild.github.io/car-buying-helper/` should return 200, and `curl -s …/offline.js | grep "const RELEASE"` should show the commit ID.
- [ ] **Step 6: Hand off to Erik** for the §14 iPhone check (Safari → home screen → open from the icon online → airplane mode → open and calculate). He also opens the Edmunds and TrueCar links by hand (§11).
