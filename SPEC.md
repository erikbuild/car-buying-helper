# Car Buying Helper: Specification

Status: approved by Erik, 2026-10-27, after two independent reviews of every rule and number.

## 1. What this is and why

Car Buying Helper is a single web page that Erik opens on his phone while sitting at a car dealership. He types in the numbers the dealer gives him. The page tells him, in plain words and dollar amounts, whether those numbers add up and whether he is paying more than he should. It catches a padded monthly payment, a marked-up interest rate, a missing rebate, extras slipped into the loan, wrong tax, and fees above what Connecticut actually charges.

**Why now.** Erik is buying a new Mazda CX-50 (a "Premium" trim) from a Connecticut dealer within a few days of 2026-10-27. Mazda's October offer in Connecticut requires delivery by Monday 2026-11-02, so the page must be on his phone, and trustworthy, before then.

**Success.** Erik can enter the dealer's numbers in about a minute at the desk. The Verdict tab tells him plainly either "this adds up" or "here is the $X they added, and where", with the math one tap away. A screenshot of the Verdict tab is enough of a record.

## 2. Who uses it, and when

- **User:** Erik, and possibly someone buying with him. He uses an iPhone inside a dealership, opening the page from its home-screen icon, with a salesperson nearby and possibly weak cell signal.
- **His situation:** 800+ credit score, so he should get the automaker's best advertised rates. No trade-in. He'll change the down payment on the spot. He is buying and registering in Connecticut, from one dealer.
- **Moments of use:**
  1. *Before going:* he looks up a fair target price and the automaker's current offer, using the README's "Before you go" steps.
  2. *At the sales desk:* he enters the price, the quoted payment and the quoted rate.
  3. *In the finance office:* he enters the extras they pitch to see what each costs.
  4. *At signing:* he enters the contract's federal disclosure box to check it.

## 3. Goals, non-goals, anti-goals

**Goals (first version)**
1. **The real price:** split whatever the dealer quotes into its parts, compute Connecticut tax and the drive-away total (the out-the-door price), and flag anything padded, wrong or missing.
2. **The payment adds up:** compute the payment the dealer's own rate, term and amount financed should produce. If their payment is higher, show both explanations: the rate they're really charging, or how much extra is hidden in the loan.
3. **The rate:** compare their rate with the automaker's advertised special rate (when it applies to the loan length) or with Erik's outside rate. Show what any gap costs over the loan, say whether the special rate or the cash rebate offered instead is worth more, and flag a deal that gets neither.
4. **Extras:** show what each pitched extra adds per month and over the loan, before Erik decides.
5. **Contract check:** verify that the disclosure box on the contract is consistent with itself and with the deal Erik agreed to. This is the only reliable way to catch an extra slipped into the amount financed.

**Non-goals (first version)**
- Trade-ins, leases, and comparing or saving several deals.
- Live price or incentive data. MarketCheck was evaluated and deferred: its key must stay secret, which needs a server, its terms forbid caching, so it wouldn't work offline, and signing up needs business details.
- States other than Connecticut. The state rules live in one module so another state can be added later.
- Accounts, sync, analytics, or sending Erik's numbers anywhere.
- An estimate of the federal car-loan interest deduction.
- Anything specific to the CX-50, such as a trim picker or a built-in offer table. Erik types in the offer.
- An export button. Erik takes a screenshot.

**Anti-goals** (would count as a failure even if everything technically works)
- Math that is wrong but stated with confidence.
- False alarms at the desk over a few cents, or over rounding and timing conventions that lenders may legally use.
- Entry that is slow or fiddly with a salesperson watching.
- Needing a signal after the first visit.
- Leaking Erik's numbers anywhere.

## 4. Constraints

- **Stack:** plain HTML, CSS and JavaScript, with no build step for the page. No runtime dependencies, CDNs or external fonts, for offline use and privacy. Development-only tooling (test runners) is allowed.
- **Hosting:** GitHub Pages on the public repo `erikbuild/car-buying-helper` (MIT license).
- **Target platform:** iPhone Safari (iOS 27 is current). It must also work in desktop Chrome, Safari and Firefox.
- **Code rules:** Erik's global coding rules apply: ABOUTME headers, TDD, unit + integration + end-to-end tests with pristine output, and his naming rules.
  - Erik's exception: JSON can't hold comments, so `manifest.webmanifest`, `package.json` and `package-lock.json` have no ABOUTME lines. Every other code file (`.html`, `.css`, `.js`/`.mjs`, `.yml`, and test and tooling scripts) has them. Icons, `LICENSE`, Markdown documents and `.gitignore` aren't code.
  - `index.html` starts with its two ABOUTME comment lines, before `<!doctype html>`. HTML allows comments there, and the page still renders in standards mode (§13 checks this).
- **Deadline:** on Erik's phone before his visit (see §1). Everything in this document ships in the first version.

## 5. Decisions

**Erik decided:**
- A single mobile-first page on GitHub Pages, built with plain HTML/CSS/JS and no build step.
- The three jobs in §3 goals 1-3, including the rebate-versus-special-rate comparison.
- The down payment is a field he can change. No trade-in. Connecticut.
- Extras are optional lines with an "in the deal" toggle. He'll probably decline them all but wants to see what each costs.
- A tabbed layout (Price / Loan / Extras / Verdict) with a summary strip on every tab.
- One dealer, no saved deals. A screenshot is enough.
- Fair-price checking by typing in a target price he looked up himself, plus links. The README must carry the lookup steps with instructions.
- The Verdict checks, the contract check, and the signing reminders listed in §6.5.
- The non-goals, anti-goals, and build/test/deploy approach in this document.
- Everything ships in the first version, before the visit. There is no staged release ("we can trivially get this done before then").
- The three JSON files in §4 are exempt from the ABOUTME rule.
- The deploy stamps a release name into `offline.js` (§9, §14). A phone only picks up a new release when that file changes. The stamp is the only change made to `site/` at deploy, and the files in the repo still run as they are.
- A first payment date more than 3 months after the contract date is an error, so a mis-set year can't widen card 1's accepted range (§6.3, §7.3).
- The offline test must fail without the cache in every browser. It stops its own server before going offline and also opens an address the browser hasn't loaded (§13).
- From the release review (2026-10-28):
  - A payment too small to pay off the amount financed, even at 0%, leaves their rate unknown, so no check treats the loan as 0% (§7.5).
  - Typing a down payment still ties the quote to it, and the Down payment field's hint says so (§6.3).
  - Once both contract dates are a valid pair, their hint shows the first period between them (§6.3).
  - Up to 3 problem cards fit one screenshot. With 4 or more, a second screenshot takes the rest (§6.5).
  - A rate above the special or the outside rate, but within the 0.125-point tolerance, reads "Within 0.125 points of …" (cards 3 and 4).
  - When a payment-only quote is out of date, cards 3 and 4 ask for a new quote instead of their rate.
  - Card 1's first-payment clause says how to check it.
  - Each extra's price has a hint that it's the full price, not per month. An extra counts only once its price is entered. With a worked-out rate, the Extras tab's lines read "at least" (§6.4).

**Claude's calls (Erik can overrule any of these):**

*The page*
- The automaker's rate is typed in, not built in. Mazda's offers change monthly and Erik is buying right at the October/November changeover.
- Labels are generic ("automaker's special rate"), not Mazda- or CX-50-specific.
- The Verdict tab is designed so its problems fit in one screenshot, up to 3 of them (§6.5). No export button.
- A **Taking the cash instead** switch on the Loan tab. When the loan is too long for the special rate and the cash isn't in the deal, an amber card says Erik is getting neither.
- When the dealer quotes only a payment, the page works out the rate from it ("at least R%") and uses that rate for the rate checks. A payment that can't pay off the loan even at 0% gives no rate (§7.5).
- Their quoted payment is tied to the down payment it was quoted at. Trying other down payments with the ± buttons marks the quote out of date instead of raising an alarm. Typing a down payment changes the deal, and the quote along with it, so the order Erik types fields in doesn't matter.
- A card whose optional inputs are blank is left off. A card missing an input it needs becomes a note naming the field. There are exactly four severities: red, amber, green, neutral.
- An optional **Final payment** field in the contract section, because many contracts end with a slightly different payment.
- The "Before you go" link opens the README on GitHub. It needs a signal, which is fine because it's used before the visit.
- A "Start over" button.
- The page name "Car Buying Helper" (from the repo name). Light and dark follow the phone's setting. System fonts.
- Context lines with dated benchmarks (Experian rates, KBB discounts).
- The README's price links default to the 2026 model year, with a note to switch years if the sticker says otherwise. Erik hasn't said which model year he's buying.

*The math*
- Special rate versus cash is compared in today's dollars at Erik's outside rate, and the page reports a break-even rate (§7.9).
- Tolerances:
  - $1 for payments, tax, totals, the finance charge, and the total of payments when the final payment is entered
  - $5 for the total of payments when the final payment isn't entered
  - 0.125 percentage points for APR (Reg Z)
- The payment check always allows both common first-payment conventions (one month after signing, or 45 days), plus the contract's real dates once they're entered. When the payment is too high, the page gives the smallest rate or hidden amount that explains it, worded "at least".
- Contract vs quote flags only three things: an APR more than 0.125 points above the APR they quoted, a payment above what the quoted rate gives on the contract's amount financed, or a different number of payments. A lower APR or payment never raises an alarm. When they quoted only a payment, the rate worked out from it is checked through the contract payment, not compared as an APR.
- The contract APR check uses Reg Z's first-period limits to decide when a first period may be treated as regular.
- When the contract's final payment isn't entered and the total of payments doesn't match, the APR check uses the final payment the disclosure box implies, so a hidden balloon payment can't pass.
- A taxed GAP is taxed like the car (vehicle-class). Each kind of extra has a default tax setting (§8.1), and GAP is untaxed by default.
- A title and registration charge above CT's DMV fees is taxed as a conveyance fee, as CT law treats it.
- An extra's cost is its price plus the tax it adds, so an item that pushes the car over $50,000 is counted at its full effect.
- Money is held in whole cents with exact half-up rounding. Dates are plain calendar dates, counted with Appendix J's month rules.
- The DMV estimate decides loan or cash from the down payment alone, so the drive-away total can't flip between two answers.
- Doc-fee comparison point: $1,000, the top of what Connecticut Mazda dealers list ($599–$998 in October 2026). CT DMV fees are filled in as an estimate when the field is blank.

*The build*
- Test tools are Node's built-in test runner and Playwright, running WebKit, Chromium and Firefox, including the offline test. Deployment runs through GitHub Actions.
- The deploy's tests run on a macOS runner, so the browsers lay the page out in Apple's system font, as the iPhone does. Whether 3 problems fit one screen (§6.5) depends on where lines wrap, and Linux's wider DejaVu Sans wraps them sooner.
- The page caches itself and never waits on the network. At the dealer, Erik opens it from the home-screen icon.
- File names describe jobs: `offline.js`, `deploy.yml`, `lib/numbers.js`. All Connecticut text and numbers live in the rules module.

## 6. The page

### 6.1 Layout

There are four tabs, **Price · Loan · Extras · Verdict**, with a **summary strip** pinned above the tabs on every tab:

| Slot | Shows |
|---|---|
| Drive-away | The drive-away total in whole dollars ("$39,825"), or "—" until their sale price is entered. |
| Payment | "should be $671.65" (§7.4), or "should be —" when it can't be computed. When their payment is entered, a second line says "theirs $699.00", or "theirs $699.00 at $5,000 down" when the quote is out of date (§6.3). In a cash deal the slot says "Paying cash". |
| Problems | "No problems", "1 problem" or "N problems": the number of red and amber Verdict cards. "—" until their sale price is entered. Tapping it opens the Verdict tab. |

A field that isn't filled in shows "—" wherever its value would appear. Numbers recalculate on every keystroke; there is no submit button.

### 6.2 Price tab

| Field | Meaning | Default |
|---|---|---|
| Window sticker total | The MSRP total printed on the window (Monroney) sticker, including destination and port-installed options | blank (optional) |
| Your target price | The fair price Erik looked up before going (README "Before you go"), on the same basis as their sale price | blank (optional) |
| Their sale price | The negotiated price of the car before the doc fee, extras, tax and DMV fees. It includes destination and port options, with dealer discounts already taken off. Hint: "CT quotes include the doc fee and add-ons (since Oct 2026). Enter the car's price without them; they have their own fields." | blank (every check needs it) |
| Rebates applied | Automaker cash Erik gets however he pays, such as a $500 loyalty bonus. Hint: "Cash offered instead of the special rate goes on the Loan tab." Blank counts as $0 | 0 |
| Doc fee | The dealer conveyance fee. Blank counts as $0, and the Verdict asks for it | blank |
| Title + registration | What the dealer charges for DMV paperwork. Anything above CT's DMV fees is a conveyance fee and is taxed (§7.1) | blank. When blank, the CT DMV amount from §7.2 is used and labeled "estimated" |

Calculated lines:
- discount off the sticker, in dollars and %
- CT tax, with one term for each base in use (§7.1): "6.35% of $37,199.00 = $2,362.14", or "7.75% of $51,000.00 + 6.35% of $2,995.00 = $4,142.68"
- DMV fees, marked "estimated" when title + registration is blank
- **drive-away total**

A small "From their sheet (optional)" group holds **Their tax** and **Their drive-away total**. Each shows a check mark when it matches the page's figure, or the difference when it doesn't.

A link, "Before you go: how to look up a fair price", opens `https://github.com/erikbuild/car-buying-helper#before-you-go`. Its label says that it opens GitHub and needs a signal.

### 6.3 Loan tab

| Field | Meaning | Default |
|---|---|---|
| Down payment | Cash Erik puts down, with −$500 and +$500 buttons. −$500 stops at $0. Blank counts as $0. Hint: "Typing a down payment ties their quote to it. Use −$500/+$500 to try one out." | 0 |
| *(calculated)* Amount financed | §7.2 | — |
| Their rate (APR) | The dealer's quoted APR. Hint: "Leave blank if they only quote a payment." | blank |
| Months | The loan length, a whole number from 1 to 96 | blank |
| Their monthly payment | The dealer's quoted payment. Hint: "Ask for the exact payment, to the cent." | blank |
| Automaker's special rate | The advertised promo APR, such as 0% | blank |
| Covers loans up to | The longest term the special rate applies to, in months (for example 36) | blank |
| Cash instead of the special rate | Customer cash offered *instead of* the special rate, such as $1,000 | blank |
| Taking the cash instead | A switch, on when the deal takes that cash instead of the special rate. The cash then comes off the drive-away total like a rebate (§7.2) | off |
| Your outside rate | A bank or credit-union APR Erik can get for the same term | blank |

**The quote and the down payment.** Their payment is tied to one down payment. It's the down payment in the field when their payment was last typed, or the one last typed into the down payment field, whichever came later. So the order Erik types fields in doesn't matter. The ± buttons try out other down payments without moving the quote's.

While the down payment differs from the quote's, the quote is out of date:
- the Payment card says so instead of raising an alarm (§6.5)
- the strip shows "theirs $699.00 at $5,000 down"
- the payment isn't used to work out a rate (§7.5)

Pressing the buttons back, typing a down payment, or typing their payment again makes the quote current.

Also on this tab:
- A plain-text link to `https://www.mazdausa.com/shopping-tools/special-offers-and-incentives`, with the link text "Mazda offers (external link to www.MazdaUSA.com)". Mazda's terms allow only text links and require that marking. Mazda takes the ZIP code on that page.
- A collapsed section, **"At signing: the contract"**. Erik copies these fields from the federal disclosure box and payment schedule on the retail installment contract: Amount financed, Finance charge, Total of payments, APR, Monthly payment, Number of payments, Final payment (hint: "Only if the last payment is different"), Contract date, and First payment date.
  - The two dates use date pickers, and they count only as a valid pair: both entered, with the first payment date after the contract date and no more than 3 months after it (§7.3). With only one entered, the fields show the hint "Enter both dates." With both entered in the wrong order, they show an inline error. With the first payment more than 3 months after the contract date, the first payment date shows the inline error "More than 3 months after the contract date. Check the dates." A mis-set year would otherwise widen card 1's accepted range enough to hide a padded payment. Anything other than a valid pair counts as blank.
  - Once the dates are a valid pair, the hint gives the first period between them, from §7.3's m and d: "First payment 1 month and 15 days after the contract date." With m = 0 it reads "First payment 20 days after the contract date.", and with d = 0 "First payment 2 months after the contract date." A count of 1 takes the singular. A date wheel spun one month too far then shows next to the dates, before it can turn a card red.
  - The dates also set the first-payment timing for the payment check (§7.3). If the dealer offers a later first payment, Erik can enter both dates at the desk. The dates alone don't bring up the contract cards.

### 6.4 Extras tab

Buttons add an item of each type: **Extended warranty · GAP · Prepaid maintenance · Tire & wheel · Paint / fabric · VIN etch · Other**. Each item has:
- a name (editable, pre-filled with the type)
- a price, with the hint "The full price, not per month. If they quote $/mo, ask for the price."
- **In the deal**, a toggle that is off by default
- **Taxed**, a toggle whose default depends on the type (§8.1). GAP's has the hint "Taxed only if the lender requires GAP. Check the buyer's order."
- remove

Each item shows what it costs (§7.7), for example "Would add $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)". An item in the deal says "Adds" instead of "Would add". When there's no loan to spread the cost over (a cash deal, months blank, or their rate unknown), the line is just "Would add $3,185.18 with tax". With their rate worked out from their payment (§7.5), the amounts are lower bounds and read "at least". For example, with their APR blank and $850.00/mo quoted on Example 1's deal, the warranty in the deal reads "Adds at least $70.88/mo, at least $4,252.80 over 60 months ($3,185.18 with tax)".

Items that are in the deal count toward the tax, the drive-away total and the amount financed. Items that aren't in the deal count toward nothing. An item counts only once its price is entered: while the price is blank or unreadable, its line reads "Would add —" ("Adds —" in the deal), and it counts toward nothing, the Extras card included.

One-line tips, shown on the item (text from the rules module):
- **Extended warranty:** "Mazda's own plan can be bought later, until 3 years/36,000 miles, from any Mazda dealer."
- **GAP:** "Your auto insurer may sell loan payoff coverage for less. Dealer GAP in CT can be cancelled for a full refund within 60 days."
- **VIN etch:** "CT requires your written consent."
- **Paint / fabric, Other:** "Optional. CT requires add-ons to be itemized and marked optional."

### 6.5 Verdict tab

At the top, the key numbers: their sale price, drive-away total, amount financed, their rate (or "at least R%, from their payment", in the forms given in §7.5), months, and the payment (should be vs theirs).

Then the cards. Each card has:
- a one-line headline
- one or two plain sentences with the dollar amount at stake
- a **"Show the math"** disclosure listing the numbers and the formula used

**Severities.** Every card is exactly one of four:
- **Red:** a problem that costs money or breaks a rule.
- **Amber:** worth questioning.
- **Green:** checked and fine.
- **Neutral:** information, or a note asking for a missing input.

Cards are ordered red, amber, green, neutral. Within a severity they keep the order of the numbered list below. Only red and amber count as problems.

**Screenshot goal:** the key numbers plus up to 3 red and amber cards fit on one iPhone screen, from the top of the tab, where the strip's problem count takes you. With 4 or more problems, a second screenshot takes the rest. Green cards may be compact.

**Which cards appear**
- Until their sale price is entered, the tab shows one neutral note, "Enter their sale price on the Price tab to start.", followed by the signing checklist and Start over. It shows no key numbers and no other cards.
- In a cash deal (§7.2), one neutral note, **Paying cash**, takes the place of cards 1–5 and the contract cards (13–17). It sits in card 1's place in the order.
- Each card says when it **shows**. Otherwise it is left off.
- Each card also lists what it **needs**. When a needed input is blank, the card becomes a neutral note naming the missing fields, for example "Enter months to check their payment."
- The outcomes are checked in order, and the first one that matches wins.

**Wording**
- Headlines below are the exact wording, and the tests check them. Sentences may be polished, but they must keep their facts and amounts. Amounts follow §7.0's display rules.
- "Their rate" means their APR, or, when that's blank, the rate worked out from their payment (§7.5).
- A worked-out rate reads "at least R%", except for the two forms in §7.5 ("0%" and "over 100%"). Amounts computed from it are lower bounds and also read "at least". Each card below says where the words go.
- A count of 1 takes the singular: "1 point", "1 month".
- L and H are the lowest and highest expected payments (§7.4). When they're equal, "should be $L to $H" reads "should be $L".

**1. Payment adds up.** Shows when their monthly payment is entered. Needs months.
1. The quote is out of date (§6.3). Neutral: "Their payment was quoted at $5,000 down." Sentence: "At $6,000 down it should be $652.36. Ask for a new quote, or set the down payment back." Without their APR, the sentence is "Ask for a new quote at $6,000 down."
2. Their payment is less than L − $1, and their payment × months is less than the amount financed. Red: "$X/mo for N months can't pay off $AF." When their APR is blank, L is the 0% payment.
3. Their APR is blank. Neutral: "$699.00/mo for 60 months works out to at least 7.44%." Sentence: "Ask what rate they're using. The rate checks use this rate until you enter theirs." When R shows as 0, the headline ends "works out to 0%."; when R is over 100%, it ends "works out to over 100%."
4. Their payment is less than L − $1. Amber: "$X/mo is less than this deal should cost." Sentence: "At A% for N months it should be $L to $H. Check the months, the amount financed, and whether a rebate or the cash was applied."
5. Their payment is more than H + $1. Red: "$X/mo doesn't add up." Sentence: "At A% for N months it should be $L to $H. Either the real rate is at least R%, or at least $E extra is in the loan, or the first payment is more than 45 days away (enter both dates under At signing to check)."
   - When R is over 100%, the rate clause reads "the real rate is over 100%".
   - The extra-amount clause is left out when E shows as $0 (§7.5).
   - The last clause appears only when their APR is above 0% and the contract dates aren't entered. At 0%, the first payment's timing doesn't change the payment.
   - When the doc fee is blank, the sentence starts with "The doc fee isn't entered yet."
6. Otherwise, green: "$X/mo matches N months at A%."

**2. CT rate cap.** Shows only when red: their rate or the contract APR is over 15%. Red: "Over Connecticut's 15% legal cap for new-car loans."

**3. Special rate.** Shows when the special rate is entered and Taking the cash instead is off. Needs months and "covers loans up to". While Taking the cash instead is on and cash instead is blank, card 3 shows as a neutral note instead: "Enter the cash offered instead of the special rate."
1. Their rate is known and at most the special + 0.125. Green: "On the automaker's S% special." When their rate is above the special, the headline is "Within 0.125 points of the S% special."
2. Months are over "covers loans up to", and cash instead is entered. Amber: "You're not getting the S% special or the $C cash." Sentence: "The special covers loans up to M months, so a N-month loan should come with the $C cash. Ask for it, or turn on Taking the cash instead if it's already in the deal."
3. Months are over "covers loans up to". Neutral: "The S% special covers loans up to M months." Sentence: "A N-month loan is on the lender's standard rate."
4. Their rate is unknown. Neutral: "Enter their rate to check it against the S% special." When their APR is blank and their payment is out of date (§6.3), the note is "Ask for a new quote at $6,000 down to check their rate against the S% special."
5. Otherwise, red: "Should be the automaker's S% special." Sentence: "Their A% costs you $D more over N months." With a worked-out rate, the sentence is "Their rate of at least A% costs you at least $D more over N months." When cash instead is entered, it adds "Or ask for the $C cash instead." $D is the rate cost from §7.8.

**4. Outside rate.** Shows unless the special rate applies (§7.6), or the special rate is entered and card 3 is still asking for months or "covers loans up to". Needs their rate, your outside rate and months. Its needs-input note adds the Experian context line: "Buyers with 781+ scores averaged 4.41% on new-car loans in Q2 2026 (Experian; includes automaker specials)." When their APR is blank and their payment is out of date (§6.3), the note asks for a new quote in place of their rate: "Ask for a new quote at $6,000 down to compare their loan with your own financing." Any other blank inputs come first: "Enter your outside rate and ask for a new quote at $6,000 down to compare their loan with your own financing."
1. Their rate is more than the outside rate + 0.125. Amber: "D points over your outside rate." Sentence: "That costs $C over N months. Ask them to match O%, or use your own financing." It also shows the Experian context line. With a worked-out rate, the headline is "At least D points over your outside rate." and the sentence starts "That costs at least $C over N months."
2. Otherwise, green: "At or under your O% outside rate." When their rate is above the outside rate, the headline is "Within 0.125 points of your O% outside rate."

**5. Special rate or cash.** Shows when the special rate, "covers loans up to", cash instead and your outside rate are all entered. Needs months. The math is in §7.9.
1. The cash covers the rest of the loan (AF_B ≤ 0). Neutral: "The $C cash covers the rest of the loan." Sentence: "Take the cash."
2. The special wins. Green: "The S% special beats the $C cash by about $X." Sentence: "In today's dollars at your O% outside rate: $P_A/mo for n_A months, against $P_B/mo for N months with the cash. Cash only wins if you can borrow below O\*%." When there's no break-even, the last sentence is "Cash doesn't win at any outside rate."
3. The cash wins. Green: "The $C cash beats the S% special by about $X." The sentence mirrors outcome 2 and ends "The special only wins if your outside rate is above O\*%." When there's no break-even, it ends "The special doesn't win at any outside rate."

Outcomes 2 and 3 both add: "Make sure the price doesn't change when you switch between the rate and the cash."

**6. Price vs target.** Shows when your target price is entered.
1. Their sale price is more than the target + $1. Amber: "$X above your target."
2. It's within $1 of the target. Green: "At your target."
3. Otherwise, green: "$X under your target."

**7. Price vs sticker.** Shows when the window sticker total is entered.
1. Their sale price is more than the sticker + $1. Amber: "$X above sticker." Sentence: "Ask what it's for: a market adjustment or added options."
2. It's within $1 of the sticker. Green: "At sticker."
3. Otherwise, green: "$X (Y%) under sticker."

Both green outcomes add the context line: "New cars averaged 3.4% under sticker nationally in Sept 2026 (KBB)."

**8. Tax.** Shows when their tax is entered.
1. It's within $1 of the page's tax. Green: "CT tax is right." Sentence: the tax line from §6.2.
2. Otherwise, amber: "Their tax is $X more than CT's." (or "less than CT's"). Sentence: the tax line, then the likely reasons: "Rebates don't lower CT tax. The doc fee is taxed." When title + registration is more than $265, it adds "This includes tax on the $X of title and registration charges above CT's fees, which CT counts as a conveyance fee." (§7.1)

**9. Drive-away total.** Shows when their drive-away total is entered.
1. It's more than the page's + $1. Red: "$X more than the itemized numbers add up to." Sentence: "Ask them to itemize it."
2. It's less than the page's − $1. Amber: "$X less than the itemized numbers." Sentence: "Something may be missing or counted differently."
3. Otherwise, green: "Their drive-away total matches."

**10. Doc fee.** Always shows.
1. Blank. Neutral: "Ask for the doc fee."
2. More than $1,000. Amber: "$D doc fee is above what CT Mazda dealers charge."
3. Otherwise, green: "$D doc fee."

Outcomes 2 and 3 add: "With tax it costs $T. CT Mazda dealers charge about $600–$1,000 (Oct 2026). CT doesn't cap it, and it's negotiable." $T is the doc fee's cost from §7.7.

**11. DMV fees.** Shows when title + registration is entered. CT's amount here is $254 in a cash deal and $264 otherwise (§7.2).
1. It's more than CT's amount + $1. Amber: "$X more than CT DMV charges." Sentence: "CT charges $264 when you finance. Under CT law the extra is part of the dealer's conveyance fee, so it's negotiable, and it's taxed." In a cash deal the sentence says "$254 when you pay cash".
2. Otherwise, green: "Title and registration are within CT's fees."

**12. Extras.** Always shows.
1. Any extra is in the deal. Amber: "Extras in the deal: $X." Sentence: "+$Y/mo, $Z over N months. All optional." With a worked-out rate, it reads "At least +$Y/mo, at least $Z over N months. All optional." When there's no loan to spread it over (§6.4), the sentence is "That's with tax. All optional." Only extras whose price is entered count (§6.4).
2. Otherwise, green: "No extras in the deal."

**Contract cards (13–17)** show once any contract field other than the two dates is entered.

**13. Contract: amount financed.** Needs the contract's amount financed.
1. It's more than the page's + $1. Red: "$X more is financed than your deal adds up to." Sentence: "Ask for the itemization of the amount financed."
2. It's less than the page's − $1. Amber: "$X less is financed than your deal adds up to." Sentence: "Check that the down payment, rebates and cash are what you agreed."
3. Otherwise, green: "The amount financed matches your deal."

**14. Contract: box adds up.** Needs the finance charge, total of payments and amount financed.
1. |finance charge − (total of payments − amount financed)| > $1. Red: "The disclosure box doesn't add up." Sentence: "The finance charge should equal the total of payments minus the amount financed."
2. Otherwise, green: "The disclosure box adds up."

**15. Contract: payments.** Needs the total of payments, monthly payment and number of payments.
1. The final payment is entered, and |total of payments − (payment × (n − 1) + final payment)| > $1. Amber: "Total of payments doesn't match the payment schedule."
2. The final payment is blank, and |total of payments − payment × n| > $5. Neutral: "Total of payments isn't n × $X." Sentence: "If the last payment is different, enter it as Final payment." Card 16 then checks the APR with the final payment the box implies (§7.10), so a hidden balloon payment still shows up there.
3. Otherwise, green: "Total of payments matches the schedule."

**16. Contract: APR.** Needs the APR, amount financed, monthly payment and number of payments. At 0% it also needs the finance charge. The math is in §7.10.
1. The APR is 0%, the payment is within $1 of the amount financed ÷ n, and the finance charge is at most $1. Green: "The 0% checks out."
2. Any other 0% APR. Red: "This doesn't add up as a 0% loan." Sentence: "A 0% loan has a $0 finance charge and a payment of about $AF/n."
3. The APR is within 0.125 points of an allowed rate worked out from the contract's numbers. Green: "The APR matches the contract's numbers."
4. Otherwise, red: "The APR on the contract doesn't match its own numbers." Sentence: "They work out to R%", where R is the allowed result closest to the disclosed APR. When there is no result, the sentence is "The payments don't cover the amount financed." or "They work out to over 100%."

**17. Contract vs quote.** Makes each of §7.10's three comparisons whose inputs are entered.
1. Any comparison that ran fails. Red: "The contract isn't the deal they quoted." The sentence lists each failure, for example: "APR 6.4% against 5.9% quoted." "$745.00/mo, but 5.9% on this amount financed comes to at most $734.88." "72 payments against 60 months quoted."
2. Comparison 3 ran, and so did comparison 1 or 2. Green: "The contract matches their quoted rate and term." When their rate was worked out from their payment, the headline is "The contract matches their quoted payment and term."
3. Otherwise, a neutral note naming the blank inputs that would let the missing comparisons run, for example "Enter their rate and months to compare the contract with their quote."

**Paying cash** (cash deals only). Neutral: "Paying cash: no loan to check." When cash instead is entered and Taking the cash instead is off, it adds "Ask whether the $C cash instead of the special rate applies to a cash purchase."

**Signing checklist** (static text below the cards, from the rules module):
1. Every blank on the contract is filled in, and you get a signed copy (CT law).
2. The doc fee is listed with the statement that it is "not payable to the State of Connecticut", and it is negotiable.
3. Each add-on is itemized and marked optional, and you ordered everything listed. There's no "dealer prep" charge for anything you didn't order or that Mazda pays the dealer for. VIN etching needs your written consent.
4. If the amount financed is higher than your numbers, ask for the itemization.
5. Don't take the car until the lender has approved the financing at the quoted rate. Check that the deposit line says how your deposit is refunded.
6. There is no cooling-off period. The deal is final when you sign.
7. Dealer GAP can be cancelled for a full refund within 60 days (CT).
8. If the odometer shows more than delivery miles, the order must say "demonstrator".

A **Start over** button at the bottom asks for confirmation. It then clears the deal and the saved data, and restores the defaults: down payment $0, rebates $0, no extras, switch off.

## 7. The math

### 7.0 Numbers, rounding and display

- Money is held as whole cents. Rates are entered in percent. Tax rates are whole basis points (635 means 6.35%).
- Tax is rounded half up to the cent with integer arithmetic: (base in cents × basis points + 5,000) ÷ 10,000, rounded down. For example, $36,430.00 at 6.35% is $2,313.305, which rounds to $2,313.31. Floating-point shortcuts such as `Math.round(x * 100) / 100` get some of these ties wrong.
- Payments are rounded half up to the cent.
  - At 0%, the payment is the amount financed ÷ n in integer cents, rounded half up: $34,825.14 ÷ 36 = $967.365, which rounds to $967.37.
  - Other payments come from floating-point math and are then rounded.
- Tolerances compare rounded cent values.
- **Display:**
  - On cards and in the summary strip:
    - Monthly amounts are in cents ("$671.65/mo").
    - Other dollar amounts are whole dollars, rounded half up ("$387").
    - An amount worded "about" is rounded to the nearest $10, half up.
    - An amount worded "at least" is rounded down to $10 when the rule says so, and to the dollar otherwise.
  - On the Price, Loan and Extras tabs, and in "Show the math", amounts are in cents.
  - Rates and point gaps show up to 2 decimals, with trailing zeros dropped: "5.9%", "0%", "7.44%", "0.4 points". "Show the math" shows rates to 3 decimals.
  - R, the rate worked out from their payment (§7.5), is rounded down, and so is any point gap or amount computed from it. Every other rate and gap is rounded half up, including the APRs worked out from the contract (§7.10) and O\* (§7.9).
  - Entered rates are held as whole thousandths of a percent (5.9% is 5,900), so a gap between two entered rates is exact. For example, 6.135% − 5.5% is 0.635 points, which shows as 0.64.
- Calculations always use unrounded values. Rounding is for display only.

### 7.1 Connecticut tax
- **Vehicle base** = sale price + doc fee + the extras in the deal that are taxed and *vehicle-class*: paint / fabric, VIN etch, Other, and GAP when taxed.
- **Vehicle rate** = 7.75% if the vehicle base is over $50,000.00, otherwise 6.35%. The higher rate applies to the whole base. A base of exactly $50,000.00 is taxed at 6.35%.
- **Service base** = the extras in the deal that are taxed and *service-class* (extended warranty, prepaid maintenance, tire & wheel). These are always taxed at 6.35%.
- **Tax** = vehicle rate × vehicle base + 6.35% × service base, rounded once (§7.0).
- Rebates and the cash instead do **not** reduce either base.
- Title + registration up to CT's DMV fees is not taxed. Anything above $264 is legally a conveyance fee, so it goes into the vehicle base. It's measured against $264 even in a cash deal, so the tax can't move the deal between cash and loan; the $10 lien fee changes the tax by less than $1. For example, $300 on Example 1's deal adds $36 to the base: tax $2,364.42, drive-away $39,863.42.
- GAP is untaxed unless its Taxed toggle is on. GAP the lender *requires* is taxable.

### 7.2 DMV fees, drive-away total and amount financed
- **Cash taken** = the cash instead when Taking the cash instead is on, otherwise $0.
- **Subtotal** = sale price + doc fee + Σ(prices of extras in the deal) + tax − rebates applied − cash taken.
- **DMV** = the entered title + registration. When it's blank, the CT amount (§8.1) is used and labeled "estimated": $254 (no lien fee) if the down payment is at least the subtotal + $254, otherwise $264.
- **CT's amount** for checking an entered title + registration (card 11) is $254 in a cash deal and $264 otherwise.
- **Drive-away total** = subtotal + DMV.
- **Amount financed (AF)** = drive-away total − down payment. If AF ≤ 0, it's a **cash deal**.

This can't flip between two answers. With the estimate, a cash deal always comes out at AF ≤ $0 using $254, and a loan always comes out at AF > $10 using $264.

### 7.3 First-payment timing (Reg Z Appendix J)
- Dates are plain calendar dates (year, month, day), read from the date fields as text. No time zones are involved.
- The first payment falls *m* whole months plus *d* days after the contract date. Count back from the first payment date (Appendix J (b)(5)(ii)):
  - The date *k* months back has the first payment's day of the month, *k* months earlier. If that month is too short, use its last day. If the first payment falls on the last day of its month, use the last day of each earlier month (Appendix J (b)(3)(iv)).
  - *m* is the largest *k* (0 or more) whose date is on or after the contract date. *d* is the number of days from the contract date to that date.
  - *m* is 0 when the first payment is less than a month away.
  - The dates are a valid pair only when the first payment is no more than 3 months after the contract date: *m* < 3, or *m* = 3 and *d* = 0 (§6.3). 2026-10-30 → 2027-01-30 (m = 3, d = 0) is valid; 2026-10-30 → 2027-01-31 (m = 3, d = 1) is more than 3 months.
  - Examples (contract date → first payment date):
    - 2026-10-30 → 2026-12-14: m = 1, d = 15
    - 2026-10-30 → 2026-11-19: m = 0, d = 20
    - 2027-01-31 → 2027-03-30: m = 1, d = 28
    - 2027-01-15 → 2027-02-28: m = 1, d = 16
    - 2028-01-30 → 2028-03-30: m = 2, d = 0
- **Timings:**
  - **Regular:** m = 1, d = 0.
  - **45-day:** m = 1, d = 15, a first payment 45 days after signing.
  - **Contract-dated:** the contract dates' m and d, when they're a valid pair (§6.3).
- **Desk timings** are used by card 1, §7.5 and comparison 2 of §7.10. They are regular, 45-day, and contract-dated when valid. Lenders commonly use either of the first two conventions, and the contract's real dates are the third.
- **Contract timings** are used by card 16:
  - contract-dated when valid, otherwise 45-day, always allowed
  - regular, allowed when the contract dates aren't entered, or when the first-period difference is within Reg Z's limits
- **First-period difference** = 30 × (m − 1) + d days, from the contract dates. Positive means longer than a regular month; negative means shorter.
- **Reg Z first-period limits** (12 CFR 1026.17(c)(4)): a lender may treat the first period as regular if it is close enough to a regular period:
  - loans under 12 months: at most 6 days shorter or 13 days longer
  - loans of 12 to 96 months: at most 11 days shorter or 21 days longer

### 7.4 Payments and the accepted range
- Monthly rate: i = APR / 12.
- **Present value** of payments P₁…Pₙ with timing (m, d):
  PV = Σ for k = 1..n of P_k / ((1 + (d/30)·i) · (1 + i)^(m + k − 1)). At APR = 0, PV = ΣP_k.
- **Payment**(A, APR, n, timing) = A / PV(1 for each of n payments, APR, timing), rounded to the cent (§7.0). At 0% it is A / n. With the regular timing this reduces to the standard A·i / (1 − (1 + i)^−n).
- **Should-be payment** = Payment(AF, their APR, months, regular). The strip and the key numbers show this.
- **Expected payments:**
  - L is the smallest and H the largest of Payment(AF, their APR, months, timing) over the desk timings (§7.3). With a short first period, the contract-dated payment is the smallest.
  - The **accepted range** runs from L − $1.00 to H + $1.00. Their payment adds up when it's inside the range.

### 7.5 Working back from their payment
This section is used when their payment is above the accepted range, and when their APR is blank. Each figure is computed for every desk timing (§7.3), and the smallest result is used, so it is never overstated. That's why these figures are worded "at least".
- **Solving for a rate** (here, in §7.9 and in §7.10): bisect the rate, in percent, on [0%, 100%] until the bracket is narrower than 1e-7 percentage points, and use the lower end.
- **Rate from their payment (R):** the rate at which PV(their payment for each of the months, R, timing) = AF.
  - If their payment is less than the 0% payment − $1, it can't pay off AF at any rate (card 1, outcome 2), and there is no R.
  - Otherwise, if their payment × months ≤ AF, R = 0%. A payment within $1 below the 0% payment gets here.
  - If PV at 100% is still more than AF, R is "over 100%". It counts as 100% in comparisons and in the figures computed from it.
  - It reads "at least R%". When R shows as 0 after rounding down, it reads "0%". When R is over 100%, it reads "over 100%", without "at least". In the key numbers, ", from their payment" follows.
- **Hidden amount (E):** PV(their payment for each of the months, their APR, timing) − AF. It's shown rounded down to $10 when it's $10 or more, and rounded down to the dollar otherwise.
- **Their rate** is what cards 2–4 and 17 and the Extras figures use:
  - their APR, when it's entered;
  - otherwise R, provided their payment is entered and current (§6.3), months is entered, and there is an R;
  - otherwise, their rate is unknown.

In Example 1, R is the smaller of 7.571% (regular) and 7.440% (45 days), so it reads "at least 7.44%". E is the smaller of $1,418.13 and $1,329.25, so it reads "at least $1,320".

### 7.6 When the special rate applies
The special rate applies when all of these hold:
- the special rate, "covers loans up to" and months are all entered
- months ≤ "covers loans up to"
- Taking the cash instead is off

### 7.7 What an item costs
- **Cost** of an extra or the doc fee = its price + (the deal's tax with it − the deal's tax without it), with everything else as entered. This counts the jump to 7.75% when an item pushes the vehicle base over $50,000. For example, a taxed $400 VIN etch on a $49,699 vehicle base adds $726.78 of tax, so it costs $1,126.78.
- **Per month** uses their rate, the months and the regular timing:
  - an item not in the deal: Payment(AF + cost) − Payment(AF)
  - an item in the deal: Payment(AF) − Payment(AF − cost), or just Payment(AF) when AF − cost is $0 or less
- **Over the loan** = per month × months.
- **The Extras card** treats all the extras in the deal as one item, with the same per-month rule. Its cost is their prices + (the tax − the tax with no extras in the deal).

### 7.8 Rate cost
Cost of a rate gap over the loan = (Payment(AF, their rate, months, regular) − Payment(AF, benchmark, months, regular)) × months. The benchmark is the special rate (card 3) or the outside rate (card 4).

### 7.9 Special rate or cash (today's dollars)
- **AF₀** is §7.2's amount financed worked out with cash taken = $0. **AF_B** is the same with cash taken = the cash instead. Both include the DMV estimate when title + registration is blank.
  - In CT the cash doesn't change the tax, so AF_B is usually AF₀ minus the cash.
  - The exception is near the lien-fee line: taking the cash can also turn the deal into a cash deal and drop the $10 lien fee. For example, Example 1's deal with $38,820.14 down has AF₀ $1,005.00 but AF_B −$5.00, so card 5 says the cash covers the rest.
- **Option A (special rate):** n_A = the smaller of months and "covers loans up to". P_A = Payment(AF₀, special, n_A, regular).
- **Option B (cash plus outside rate):** P_B = Payment(AF_B, outside, months, regular).
- **Cost in today's dollars at the outside rate:** cost_A = PV(P_A for each of n_A months, outside, regular); cost_B = AF_B.
- The cheaper option wins, and a tie goes to the special rate. The difference is worded "about" and shown to the nearest $10.
- **Break-even outside rate O\*:** solve PV(P_A for each of n_A months, O\*, regular) = AF_B on [0%, 100%]. Below O\*, cash wins.
  - If P_A × n_A ≤ AF_B, cash doesn't win at any outside rate.
  - If PV at 100% is still at least AF_B, the special doesn't win at any outside rate.
- "Show the math" notes that the outside rate also discounts the shorter special-rate loan. An outside rate quoted for a different term shifts the result slightly.

### 7.10 Contract checks
- **Expected amount financed** is §7.2's AF for the deal as entered, extras in the deal included.
- **Payment schedule:** the contract's monthly payment for each of its n payments, except the last.
  - The last is the final payment when that's entered.
  - When it's blank and |total of payments − payment × n| > $5, the last is the payment the box implies: total of payments − payment × (n − 1), if that's more than $0. A legitimate odd last payment still passes (§13 has one), and a hidden balloon payment fails.
- **APR from the contract's numbers:** solve PV(schedule, a, timing) = the contract's amount financed (§7.5's solving rule), once for each contract timing (§7.3).
- The disclosed APR passes when it is within 0.125 points of any allowed result (12 CFR 1026.22(a)(2)). "Show the math" says that Reg Z allows this much.
- There is no result when the schedule's total is less than the amount financed, or when PV at 100% is still more than it. Then the APR doesn't pass.
- **0% APR:** skip the solve. The payment must be within $1 of the amount financed ÷ n, and the finance charge must be at most $1.
- **Contract vs quote** makes each comparison whose inputs are entered:
  1. Their APR is entered, and the contract APR is more than their APR + 0.125. A rate worked out from a payment-only quote is a lower bound, so it isn't compared as an APR; comparison 2 covers that quote.
  2. The contract payment is more than the largest of Payment(contract AF, their rate, n, timing) over the desk timings (§7.3), plus $1.
  3. The number of payments differs from the months.

  Each comparison that's true is a failure. A lower APR or payment is never a failure. Comparison 2 uses the contract's own amount financed, so an amount slipped into the loan is reported once, by card 13.

### 7.11 Worked examples (test fixtures)

Every number below was computed from the formulas above, and two independent reviewers recomputed the earlier versions. Unless an example says otherwise, the inputs are:
- window sticker, target, their tax, their drive-away total and title + registration all blank
- sale price $36,500; rebates applied $0; doc fee $699; no extras
- down payment $5,000, which is also the down payment the quote was given at
- their APR 5.9%; 60 months; their payment $699
- special rate 0%, covering loans up to 36 months; cash instead $1,000; Taking the cash instead off; outside rate 5.5%
- the contract section blank

**Example 1: a padded payment on a standard-rate loan**

Results:
- Tax $2,362.14 (6.35% of $37,199.00). DMV $264, estimated. Drive-away $39,825.14. AF $34,825.14.
- Should-be payment $671.65. With a 45-day first payment, $673.30. Accepted range $670.65–$674.30.
- R: 7.571% (regular), 7.440% (45 days), so "at least 7.44%". E: $1,418.13 and $1,329.25, so "at least $1,320".
- Payment at 5.5%: $665.20. Outside-rate cost: ($671.65 − $665.20) × 60 = $387.00.
- Special rate or cash: P_A $967.37 for 36 months; AF_B $33,825.14; P_B $646.10 for 60 months. In today's dollars, cost_A $32,036.47 against cost_B $33,825.14, so the special wins by $1,788.67, shown as "about $1,790". O\* is 1.9005%, shown as 1.9%.
- Doc fee: $699 plus $44.39 tax = $743.39.

Cards, in order:
1. Red, Payment adds up: "$699.00/mo doesn't add up." Sentence: "At 5.9% for 60 months it should be $671.65 to $673.30. Either the real rate is at least 7.44%, or at least $1,320 extra is in the loan, or the first payment is more than 45 days away (enter both dates under At signing to check)."
2. Amber, Special rate: "You're not getting the 0% special or the $1,000 cash."
3. Amber, Outside rate: "0.4 points over your outside rate." Sentence: "That costs $387 over 60 months. …"
4. Green, Special rate or cash: "The 0% special beats the $1,000 cash by about $1,790." Sentence ends: "Cash only wins if you can borrow below 1.9%."
5. Green, Doc fee: "$699 doc fee." Sentence: "With tax it costs $743. …"
6. Green, Extras: "No extras in the deal."

Strip: "$39,825" · "should be $671.65" / "theirs $699.00" · "3 problems".

**Example 2: a clean 0% deal, with its contract**

Inputs: their APR 0%, 36 months, their payment $967.37. Contract fields:
- amount financed $34,825.14; finance charge $0.00; total of payments $34,825.14
- APR 0%; monthly payment $967.37; 36 payments; final payment $967.19
- contract date 2026-10-30; first payment date 2026-12-14 (m = 1, d = 15)

Results:
- Accepted range $966.37–$968.37. At 0% every timing gives $967.37.
- Special rate or cash: P_A $967.37 for 36 months; P_B $1,021.38 (5.5% for 36 months); cost_A $32,036.47 against cost_B $33,825.14; about $1,790; O\* 1.9%.
- Schedule: 35 × $967.37 + $967.19 = $34,825.14.
- The Outside rate card is left off because the special rate applies.

Cards, in order, all green:
1. Payment adds up: "$967.37/mo matches 36 months at 0%."
2. Special rate: "On the automaker's 0% special."
3. Special rate or cash: "The 0% special beats the $1,000 cash by about $1,790."
4. Doc fee: "$699 doc fee."
5. Extras: "No extras in the deal."
6. Contract: amount financed: "The amount financed matches your deal."
7. Contract: box adds up: "The disclosure box adds up."
8. Contract: payments: "Total of payments matches the schedule."
9. Contract: APR: "The 0% checks out."
10. Contract vs quote: "The contract matches their quoted rate and term."

Strip: "$39,825" · "should be $967.37" / "theirs $967.37" · "No problems".

**Example 3: a packed contract**

Inputs: Example 1's deal, plus these contract fields:
- amount financed $38,010.32, because a $2,995 warranty and its $190.18 tax were added
- finance charge $5,974.48; total of payments $43,984.80
- APR 5.9%; monthly payment $733.08; 60 payments; final payment blank
- contract date 2026-10-30; first payment date 2026-12-14

Results:
- The contract's numbers work out to 5.900% with the regular timing and 5.800% with the actual dates. The regular timing is allowed, because 15 days longer is within Reg Z's 21-day limit.
- Contract vs quote, comparison 2: over the desk timings the largest payment is $734.88 (45-day, the same as the contract dates; regular gives $733.08), so the line is $735.88. The $733.08 contract payment passes, because the extra is in the amount financed, which card 13 reports.

Cards, in order:
1. Red, Payment adds up: the same card as Example 1, without the 45-day clause, because the dates are entered.
2. Red, Contract: amount financed: "$3,185 more is financed than your deal adds up to."
3. Amber, Special rate: as in Example 1.
4. Amber, Outside rate: as in Example 1.
5. Green, Special rate or cash.
6. Green, Doc fee.
7. Green, Extras.
8. Green, Contract: box adds up.
9. Green, Contract: payments. |$43,984.80 − $733.08 × 60| = $0.00.
10. Green, Contract: APR.
11. Green, Contract vs quote.

Strip: "$39,825" · "should be $671.65" / "theirs $699.00" · "4 problems".

**Example 4: an honest 5.9% deal**

Inputs: their payment $671.65. Contract fields:
- amount financed $34,825.14; finance charge $5,473.86; total of payments $40,299.00
- APR 5.9%; monthly payment $671.65; 60 payments; final payment blank
- contract date 2026-10-30; first payment date 2026-12-14

Results:
- The contract's numbers work out to 5.900% (regular) and 5.800% (actual dates). The disclosed 5.9% is within 0.125 points of both, so there's no false alarm.
- Contract vs quote, comparison 2: the ceiling is $673.30 + $1 = $674.30.

Cards, in order:
1. Amber, Special rate: "You're not getting the 0% special or the $1,000 cash."
2. Amber, Outside rate: "0.4 points over your outside rate." ($387)
3. Green, Payment adds up: "$671.65/mo matches 60 months at 5.9%."
4. Green, Special rate or cash.
5. Green, Doc fee.
6. Green, Extras.
7. Green, Contract: amount financed.
8. Green, Contract: box adds up.
9. Green, Contract: payments.
10. Green, Contract: APR.
11. Green, Contract vs quote.

Strip: "$39,825" · "should be $671.65" / "theirs $671.65" · "2 problems".

**Example 5: taking the cash**

Inputs: Taking the cash instead on; their payment $652.36.

Results:
- Tax $2,362.14, unchanged. Drive-away $38,825.14. AF $33,825.14.
- Should-be payment $652.36. With 45 days, $653.97.
- Payment at 5.5%: $646.10. Outside-rate cost: $375.60.
- Special rate or cash: AF₀ $34,825.14, so the same figures as Example 1.
- The Special rate card is left off because the cash is being taken.

Cards, in order:
1. Amber, Outside rate: "0.4 points over your outside rate." Sentence: "That costs $376 over 60 months. …"
2. Green, Payment adds up: "$652.36/mo matches 60 months at 5.9%."
3. Green, Special rate or cash: "The 0% special beats the $1,000 cash by about $1,790."
4. Green, Doc fee.
5. Green, Extras.

Strip: "$38,825" · "should be $652.36" / "theirs $652.36" · "1 problem".

**Example 6: they quote only a payment**

Inputs: their APR blank.

Results:
- Their rate is R = 7.4405%, shown as "at least 7.44%".
- Payment at R: $696.84. Outside-rate cost: ($696.84 − $665.20) × 60 = $1,898.40.

Cards, in order:
1. Amber, Special rate: "You're not getting the 0% special or the $1,000 cash."
2. Amber, Outside rate: "At least 1.94 points over your outside rate." Sentence: "That costs at least $1,898 over 60 months. …"
3. Green, Special rate or cash.
4. Green, Doc fee.
5. Green, Extras.
6. Neutral, Payment adds up: "$699.00/mo for 60 months works out to at least 7.44%."

Strip: "$39,825" · "should be —" / "theirs $699.00" · "2 problems".

**Example 7: paying cash**

Inputs: down payment $40,000.

Results:
- The down payment is at least the subtotal ($39,561.14) + $254, so DMV is $254, estimated. Drive-away $39,815.14. AF −$184.86, so it's a cash deal.
- Paying cash takes the place of cards 1–5.

Cards, in order:
1. Green, Doc fee: "$699 doc fee."
2. Green, Extras: "No extras in the deal."
3. Neutral, Paying cash: "Paying cash: no loan to check." Sentence: "Ask whether the $1,000 cash instead of the special rate applies to a cash purchase."

Strip: "$39,815" · "Paying cash" · "No problems".

**Extras: Example 1's deal, with the items added but not in the deal**

| Extra | Price | Cost with tax | Per month | Over the loan |
|---|---|---|---|---|
| Extended warranty (taxed) | $2,995 | $3,185.18 | +$61.43 | $3,685.80 |
| GAP (untaxed) | $895 | $895.00 | +$17.26 | $1,035.60 |

The warranty's line reads "Would add $61.43/mo, $3,685.80 over 60 months ($3,185.18 with tax)". With the warranty in the deal, the AF becomes Example 3's $38,010.32. The Extras card is then amber: "Extras in the deal: $3,185." Sentence: "+$61.43/mo, $3,686 over 60 months. All optional."

## 8. Rules and reference data

All rules, reference values and Connecticut-specific text live in data modules, each value with its source and an "as of" date. Context lines in the UI show the date.

The Connecticut module holds:
- the tax rates and the $50,000 threshold
- each extra type's class, default Taxed setting and tip
- the DMV amounts
- the doc-fee benchmark
- the APR cap
- the signing checklist
- the text of every card that names a Connecticut rule or figure

Card code fills that text in from the values and has no Connecticut text of its own. Another state can be added as a new file of the same shape.

### 8.1 Connecticut (as of 2026-10-27)

| Rule | Value | Source |
|---|---|---|
| Sales tax | 6.35%. 7.75% on the whole vehicle base (§7.1) when it is over $50,000. Taxable dealer items added to the price count toward the $50,000 | CGS 12-408(1)(H); CT DMV taxable-items list |
| Rebates | Manufacturer rebates don't reduce the taxed price; dealer discounts do | DRS PS 2007(5), SN 2011(10) |
| Taxed with the car | Destination, dealer-installed add-ons, the conveyance (doc) fee. DMV fees are not taxed | CGS 12-407(a)(8)(A); Ruling 90-38 |
| Service-class extras | Extended warranty and prepaid maintenance: always 6.35%, even on a car over $50,000. Tire & wheel: probably the same. Default **Taxed = on** | CGS 12-407(a)(37)(CC), PS 94(2), SN 2011(10) |
| Vehicle-class extras | Paint sealant, fabric guard, rust protection, VIN etch, and accessories (other dealer add-ons): taxed at the car's rate as part of its price, and counted toward the $50,000 test. Default **Taxed = on** | CT DMV sales-tax table (portal.ct.gov/dmv/vehicle-services/sales-tax-registrations/sales-tax-calculator); Ruling 90-38 |
| GAP | Optional GAP: presumably untaxed (not on DMV's current table). GAP the lender requires: taxable like the car, including at 7.75% over $50,000 (DMV's 2017 list), so a taxed GAP is vehicle-class. Default **Taxed = off**, with the hint "Taxed only if the lender requires GAP. Check the buyer's order." | CT DMV taxable list (2017) |
| DMV fees | $264 financed / $254 cash. Breakdown: registration $120 (3 yr), title $25, lien $10 (financed only), plate $5, admin $10, Clean Air $15, Passport to the Parks $24, emissions exemption $40, greenhouse gas $15 | CGS 14-49, 14-192, 14-12s, 14-49b, 14-164c, 22a-201c |
| Conveyance fee | No cap. It must be disclosed as "not payable to the State of Connecticut" and is negotiable. CT Mazda dealers list $599–$998 (Oct 2026: Danbury $599, Hartford area $695–$699, Plainfield $759, Stamford $850, New London $998). A 2016 state study found a $405 average (2014–15 data, history only) | CGS 14-62; OLR 2023-R-0092; dealer pages |
| Dealer "registration" charges above DMV fees | Count as conveyance fee | CGS 14-62(a) |
| Quoted prices | Must include the conveyance fee and add-ons (since 2026-10-01). Add-ons must be itemized and marked optional (since 2025-10-01) | PA 26-24; PA 25-113 |
| APR cap | 15% on new-car retail installment contracts | CGS 36a-772 |
| Cooling-off | None for dealership purchases. The spot-delivery ban covers used cars only | CGS 42-134a; 14-62(h) |
| Dealer GAP refund | Full refund within 60 days, pro rata after | CGS 36a-789 |

### 8.2 Reference values

| Value | As of | Source |
|---|---|---|
| Average new-car APR for 781+ credit (VantageScore 4.0): 4.41% | Q2 2026 (published 2026-09-10) | Experian State of the Automotive Finance Market |
| Average transaction price 3.4% under MSRP | Sept 2026 | Kelley Blue Book ATP report |
| APR accuracy tolerance 1/8 point (1/4 point for irregular transactions; an odd first period or an odd first or final payment alone doesn't count as irregular) | current | 12 CFR 1026.22(a)(2)-(3) |
| A lender may treat a first period as regular if it is at most 11 days shorter or 21 days longer than a regular period (terms of 1–10 years), or at most 6 days shorter or 13 days longer (terms under 1 year). It may treat all months as equal and count odd days as fractions of 30 | current | 12 CFR 1026.17(c)(3)-(4); Appendix J |

## 9. Behavior

- **Input:**
  - Fields accept inputs such as "$36,500", "36500", "5.9" and "5.9%". Amounts and rates bring up the decimal keypad (`inputmode="decimal"`); months, "covers loans up to" and the number of payments bring up the number keypad (`inputmode="numeric"`).
  - Input text is at least 16px, so iOS doesn't zoom in.
  - Limits:
    - months, "covers loans up to" and the number of payments: whole numbers from 1 to 96
    - rates: 0–30%, with up to 3 decimals
    - amounts: $0–$500,000, with up to 2 decimals
  - A value that is negative, unreadable or outside these limits shows an inline error and counts as blank.
  - A blank or invalid down payment or rebates counts as $0. The ± buttons treat it as $0, and the quote is tied to that value.
  - An extra's blank or invalid price counts as blank, so the extra counts toward nothing (§6.4).
- **Persistence:**
  - The deal is saved to `localStorage` on every change and restored on load. What's saved:
    - a format version
    - the raw text of every field, invalid text included, so its error shows again
    - the Taking the cash instead switch
    - the down payment the quote is tied to
    - each extra's type, name, price text and toggles
  - Which tab or section is open isn't saved.
  - Saved data that doesn't parse, or has a different version or shape, is ignored, and the page starts fresh. Converting old saved data would need Erik's approval, so there is no conversion.
  - If storage is unavailable (for example, private browsing), the page still works without saving.
- **Offline:**
  - `offline.js`, registered as the service worker, stores every file of the page in one cache named for the release. It always answers from that cache and never waits on the network.
  - `offline.js` holds the release name. In the repo it's a placeholder; the deploy replaces it with the commit ID (§14). A new name makes the browser install the new worker in the background.
  - The new worker downloads every file fresh, bypassing the browser's own HTTP cache, into a cache named for its release. Then it takes over and deletes the old cache. The next load shows the new release, with no mix of old and new files.
- **Installable:** a web app manifest and icons, so the page opens full-screen from the iPhone home screen. On iPhone the home-screen app keeps its own saved deal and cache, separate from Safari's. Erik opens it from the icon once while online, and uses the icon at the dealer.
- **Privacy:** the page makes no network requests other than loading its own files. No analytics, no external fonts or scripts.
- **Look:** light and dark follow the phone's setting. Color is never the only signal; each card also carries a word or icon. Tap targets are at least 44px.

## 10. Errors and edge cases

- **Missing inputs:** §6.5 says which cards are left off and which ask for an input. The strip shows "—" for anything it can't compute.
- **No sale price yet:** the Verdict tab shows only "Enter their sale price on the Price tab to start.", the signing checklist and Start over.
- **Cash deal (AF ≤ 0):** one Paying cash note replaces the loan, rate and contract cards.
- **The payment can't pay off the loan, even at 0%:** red Payment card (card 1, outcome 2). With their APR blank, their rate is unknown (§7.5).
- **Out-of-date quote:** §6.3.
- **Solvers:** every solve brackets [0%, 100%]. No solution produces wording (§7.5, §7.9, §7.10), never a thrown error.
- **Display rounding:** §7.0.

## 11. README requirements

The README must include:

1. What the page does, the link to the live page, and how to add it to the iPhone home screen. It says to open the page from the icon once while online, and to use the icon, not Safari, at the dealer, because the two keep separate saved deals.
2. **Before you go**: a heading with exactly that text, so `#before-you-go` links to it. It has step-by-step lookup instructions (Erik's request). Link rules:
   - Use plain-text links only.
   - KBB links must be labeled "KBB.com" or "Kelley Blue Book".
   - The Mazda link must be marked "external link to www.MazdaUSA.com".
   - Don't link to CarGurus, whose terms forbid deep links.

   The steps:
   1. **Window sticker:** read the total MSRP, which includes destination and port options, and the model year.
   2. **Fair price:**
      - Check KBB.com (`https://www.kbb.com/mazda/cx-50/2026/`), Edmunds (`https://www.edmunds.com/mazda/cx-50/2026/`), TrueCar (`https://www.truecar.com/mazda/cx-50/`), CarsDirect (`https://www.carsdirect.com/mazda/cx-50/prices-deals`, enter your ZIP), and cars.com local listings (`https://www.cars.com/shopping/mazda-cx_50-2026/`).
      - The KBB, Edmunds and cars.com links are for the 2026 model year. If the sticker says 2027, change the year in those links. On TrueCar and CarsDirect, pick the year on the page.
      - For context, 2026 CX-50s have sold for about 4–5% under sticker (TrueCar about 3.8%, CarWhere about 5.3%, 2026).
      - Pick a target for the car's price before any rebate, and without the doc fee or add-ons. Type it into **Your target price**.
   3. **Mazda's offer for your ZIP:** `https://www.mazdausa.com/shopping-tools/special-offers-and-incentives`. Note:
      - the special APR, the longest term it covers, and the cash offered *instead*. Enter these on the Loan tab.
      - offers that stack (loyalty for current Mazda households, military). Add them to **Rebates applied** on the Price tab.
      - the deadline, which is a *delivery* deadline, not a signing deadline. Note it yourself; the page has no field for it.

      Give the October 2026 Connecticut example, labeled with its date:
      - 2.5 S Premium: 0% for 36 months, or $1,000 cash
      - Hybrid Premium: 2.9% for 36 months, or $1,500 cash
      - Delivery by Mon 11/2/2026.
   4. **Outside rate:** get a bank or credit-union rate for the term you want, and enter it as **Your outside rate**.
   5. **CT numbers to know:** 6.35% tax, $264 DMV when financing, and the doc fee is negotiable. The dealer doesn't collect your town's car property tax. That bill comes separately, roughly 70% of 85% of MSRP times your town's mill rate, which is capped at 32.46 mills.
   6. *(Optional)* Get a GAP quote from your auto insurer. Remember that Mazda's own warranty can be bought later.

   Edmunds and TrueCar block automated checks, so those two URLs must be opened by hand in a browser before release.
3. A short **At the dealer** walkthrough of the four tabs, including:
   - CT quotes include the doc fee and add-ons. Enter the car's price on its own and put those in their own fields.
   - If they quote only a payment, leave their rate blank; the page works out the rate.
   - Turn on **Taking the cash instead** if the deal takes the cash.
   - If they offer a later first payment, enter both dates under "At signing" before checking the payment.
   - The ± buttons try out other down payments. At a new down payment, ask for a new quote before relying on the payment check. Typing a down payment ties their quote to it, so use the ± buttons to try one out.
   - If they quote an extra per month, ask for its full price. The Extras tab takes the price.
4. Development: how to run the tests and serve the page locally.
5. A disclaimer: not financial or legal advice; Connecticut rules are as of the dates shown.

## 12. Architecture (suggested; the builder may adjust within the constraints)

```
site/                     the published page (GitHub Pages artifact)
  index.html
  styles.css
  app.js                  UI wiring: reads inputs, saves the deal, renders strip, tabs, cards
  offline.js              offline cache, registered as the service worker
  lib/numbers.js          parse and format amounts and rates; cent rounding
  lib/calendar.js         plain calendar dates; whole months and odd days between two dates (Appendix J)
  lib/loan.js             payment, present value (Appendix J), rate solving
  lib/deal.js             deal inputs → derived numbers (tax, DMV, drive-away, AF, accepted range, item costs)
  lib/checks.js           derived numbers → ordered Verdict cards
  rules/connecticut.js    CT rules, extra types, tips, checklist and card text, with sources and dates
  rules/reference.js      dated benchmarks (Experian, KBB, Reg Z)
  manifest.webmanifest, icons/
test/unit/                node --test: numbers, calendar, loan, tax, DMV, each card
test/integration/         node --test: whole deal → cards and strip for the §7.11 fixtures
test/e2e/                 Playwright: real browsers at iPhone size
.github/workflows/deploy.yml
package.json              development only (@playwright/test)
```

- The math and rules modules have no DOM access, so they can be tested directly in Node.
- State rules sit behind one shape (§8), so another state can be added as a new file.
- Development-only `package.json` with `@playwright/test`. No runtime dependencies.

## 13. Testing plan

- **Unit** (Node test runner):
  - **Numbers:** parsing ("$36,500", "36500", "5.9%"); invalid, negative and out-of-range input; display formats (§7.0).
  - **Cent rounding**, including ties: $36,430.00 at 6.35% → $2,313.31; $32,430.00 → $2,059.31; 0% payment $34,825.14 ÷ 36 → $967.37.
  - **Calendar:** every example in §7.3, including month ends, a leap year and m = 0.
  - **Loan:**
    - payment and present value, including 0% and odd first periods
    - a schedule with a final payment: 59 × $671.65 + $786.51 on $34,825.14 with a 45-day first payment works out to 5.900%
    - rate solving, including no solution at either end
    - Reg Z limits: a 12-month loan of $34,825.14 at a true 5.9% with a 15-day first period (2026-10-30 → 2026-11-14) has a payment of $2,988.35. Its regular-timing rate, 5.442%, isn't allowed, so a disclosed 5.44% fails and 5.9% passes.
    - the solving rule (§7.5): Example 1's regular R shows as 7.571% in "Show the math"
  - **Tax:**
    - both rates; rebates and cash not reducing tax
    - $49,500 sale + $699 doc fee → 7.75%, $3,890.42
    - a base of exactly $50,000.00 → 6.35%, $3,175.00
    - taxed GAP: $49,199 + $895 → $3,882.29
    - a $400 taxed VIN etch on a $49,699 base costs $1,126.78
    - title + registration of $300 on Example 1's deal: the $36 above $264 is taxed, so tax is $2,364.42 and drive-away $39,863.42
  - **DMV estimate** at the $10 window, on Example 1's deal:
    - down $39,820.00 → $254 and AF −$4.86 (cash)
    - down $39,815.14 → $254 and AF $0.00 (cash)
    - down $39,815.13 → $264 and AF $10.01 (loan)
  - **Every card's outcomes and boundaries**, including:
    - payment-card order: at 0% for 36 months, $967.36 is green and $965.00 is red "can't pay off"
    - a 20-day first period (2026-10-30 → 2026-11-19): regular $671.65, 45-day $673.30, contract-dated $670.55, accepted range $669.55–$674.30
    - contract dates a regular month apart (2026-10-15 → 2026-11-15): a $673.30 desk quote, made with the 45-day convention, is still green
    - a 6-month loan of $34,825.14 at 5.9%: L $5,904.48, H $5,918.99; their $5,920.49 is red, with E $8.80 shown as "at least $8 extra"
    - the out-of-date quote, including the entry order: their payment typed before the down payment, then $5,000 typed into the down payment, is current; a ± press makes it out of date, and pressing back makes it current again
    - the rate worked out from a payment, including a 0% payment-only quote ($967.37 × 36 works out to 0.000326%, so the headline ends "works out to 0%.")
    - a payment-only quote that can't pay off the loan: Example 1 with their APR blank and $560.00/mo leaves their rate unknown, so card 1 is red "can't pay off", card 3 is amber "You're not getting the 0% special or the $1,000 cash." and card 4 asks for their rate. At 0% for 36 months, $966.37, exactly $1 under the 0% payment of $967.37, still works out to 0%, and $966.36 leaves their rate unknown
    - card 3: their rate at or under the special, on a loan longer than it covers, is green
    - cards 3 and 4 within the tolerance: their 0.125% against the 0% special at 36 months reads "Within 0.125 points of the 0% special."; their 5.625% against an outside 5.5% reads "Within 0.125 points of your 5.5% outside rate.", and 5.5% reads "At or under your 5.5% outside rate."
    - cards 3 and 4 with a payment-only quote out of date ask for a new quote at the down payment now entered
    - card 4: their 6.5% against an outside 5.5% reads "1 point over your outside rate."
    - card 5 near the lien-fee line: Example 1's deal with $38,820.14 down has AF₀ $1,005.00 and AF_B −$5.00, so card 5 says the cash covers the rest
    - card 16 with the final payment blank: Example 4's contract with a total of payments of $40,413.86 (finance charge $5,588.72) implies a final payment of $786.51 and passes (card 15 is the neutral prompt). With $45,000 and a $10,174.86 finance charge, it implies $5,372.65, works out to 9.441% (45-day) or 9.595% (regular), and is red
    - card 17 with a payment-only quote (Example 6): a contract of 60 × $699 on $34,825.14 disclosing 7.57%, the regular-timing rate, is green, "The contract matches their quoted payment and term." The comparison-2 line is $700.00
    - card 17 with only comparison 3 possible is the neutral note, not green
  - **Item costs:** warranty +$61.43/mo, GAP +$17.26/mo (§7.11). An extra with a blank or unreadable price reads "Would add —" and counts toward nothing. With a worked-out rate, the lines read "at least" (§6.4's example).
  - **Contract dates' hint:** one date gives "Enter both dates."; each valid pair in §7.3 gives its first period, such as "First payment 1 month and 15 days after the contract date." for 2026-10-30 → 2026-12-14; a pair that isn't valid gives no hint.
- **Integration** (Node): build each §7.11 example from raw inputs. Assert the exact derived numbers, the exact card list (severity, headline and order), and the strip text.
- **End-to-end** (Playwright with WebKit, Chromium and Firefox, at an iPhone viewport, served by a small local static server):
  - enter Example 1 through the UI, then assert the strip and the Verdict cards
  - change the down payment with the ± buttons and see the totals update; −$500 stops at $0
  - the ± buttons mark the quote out of date, and pressing back or typing a down payment clears that; typing their payment before the down payment still gives a current quote
  - add, toggle and remove extras, and check each item's line, tip and price hint
  - the Down payment hint, and the contract dates' hint once both dates are entered
  - enter Example 3 in the contract section and see the red amount-financed card
  - turn on Taking the cash instead (Example 5)
  - bad and out-of-range input shows an inline error and counts as blank
  - reload and confirm the fields, extras and switch persist
  - corrupt saved data and blocked storage: the page still works and starts fresh. Storage is blocked with a real browser setting, such as Firefox's `dom.storage.enabled = false`, not by replacing `localStorage` in page code.
  - load the page from the test's own server, stop that server, go offline, reload, and confirm the page still works; then open an address the browser hasn't loaded (the page with a query string, which the cache answers) and confirm it works too, in all three browsers. The test must fail without the cache in every browser: Firefox reloads a page it has seen from its own HTTP cache, and Playwright's offline switch doesn't cover the cache's own requests in Firefox, so a plain offline reload proves nothing there. Prove the failure without the cache in each browser first. If one can't run it, stop and decide with Erik, since dropping a test needs his approval.
  - the update path: serve release A and load it, serve release B, load twice, and confirm B is showing with no files left from A
  - every request goes to the page's own origin
  - the keypad attributes (`inputmode="decimal"` and `"numeric"`, §9), input text of at least 16px, and tap targets of at least 44px
  - dark mode applies under `prefers-color-scheme: dark`
  - the document renders in standards mode (`document.compatMode` is `"CSS1Compat"`), and the manifest loads with its icons
  - the "Before you go" link's address
  - "Start over" clears everything
- Test output must be pristine. Any expected console errors are captured and asserted.

## 14. Build and deploy

- A GitHub Actions workflow, `deploy.yml`, runs on a macOS runner (§5) on every push to `main`:
  1. install
  2. unit and integration tests
  3. install the Playwright browsers and run the end-to-end tests
  4. only if everything passes, replace the release name in `site/offline.js` with the commit ID, then upload `site/` and deploy it with GitHub Pages (`actions/upload-pages-artifact`, `actions/deploy-pages`)
- **One-time setup:** set the repo's Pages source to "GitHub Actions" (`gh api -X POST repos/erikbuild/car-buying-helper/pages -f build_type=workflow`).
- **Before release:** on Erik's iPhone, open the live page in Safari and add it to the home screen. Open it from the icon once while online. Then turn on airplane mode, open it from the icon again, and confirm it opens and calculates.

## 15. Left to the builder

- Visual design: spacing, colors (within §9), icons, and the exact field order within each section.
- Number formatting details beyond §7.0, and quick-pick buttons for common terms (36/48/60/72).
- Module and file names, within Erik's naming rules.
- The local static server and Playwright configuration.
- Whether green cards collapse into a "N checks passed" line to meet the screenshot goal.
- Polishing card sentences, keeping their facts and amounts (§6.5).

## 16. Later (not in the first version)

- Local asking prices and incentives from MarketCheck through a small Cloudflare Worker.
- An estimate of the federal car-loan interest deduction (2025–2028, up to $10,000/yr, phased out above $100k MAGI, or $200k joint). The CX-50 is assembled in Huntsville, Alabama, so it may qualify.
- Leases, trade-ins, other states, several deals, export.
