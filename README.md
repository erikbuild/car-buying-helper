# Car Buying Helper

A single web page for checking a new-car deal at a Connecticut dealer. You type in the numbers the dealer gives you, and it tells you in plain words and dollar amounts whether they add up. It catches a padded monthly payment, a marked-up interest rate, a missing rebate, extras slipped into the loan, wrong tax, and fees above what Connecticut charges.

Once it's on your phone, it works with no signal. Your numbers stay on your phone; the page sends them nowhere.

**Live page:** <https://erikbuild.github.io/car-buying-helper/>

## Put it on your iPhone

1. Open the live page in Safari.
2. Tap the Share button (if you don't see it, tap ••• first), then **Add to Home Screen**, then **Add**.
3. Open the page from the new icon once while you have a signal. That visit saves the page on the phone, so from then on it opens and works with no signal.

At the dealer, open the page from the icon, not from Safari. On iPhone the icon and Safari each keep their own saved deal, so numbers typed into one don't show up in the other.

When a new version is published, opening the icon with a signal downloads it in the background, and the next open shows it.

## Before you go

Do these at home, where you have a signal and time.

1. **Window sticker:** read the total MSRP, which includes destination and port-installed options, and the model year. You can enter the total as **Window sticker total** on the Price tab.

2. **Fair price:**
   - Check these sites. On each, pick the trim on your sticker, enter your ZIP code if the site asks for it, and note the prices it shows.
     - [KBB.com](https://www.kbb.com/mazda/cx-50/2026/)
     - [Edmunds](https://www.edmunds.com/mazda/cx-50/2026/)
     - [TrueCar](https://www.truecar.com/mazda/cx-50/)
     - [CarsDirect](https://www.carsdirect.com/mazda/cx-50/prices-deals) (enter your ZIP)
     - [cars.com local listings](https://www.cars.com/shopping/mazda-cx_50-2026/), for what nearby dealers are asking
   - The KBB.com, Edmunds and cars.com links are for the 2026 model year. If the sticker says 2027, change the year in those links. On TrueCar and CarsDirect, pick the year on the page.
   - For context, 2026 CX-50s have sold for about 4–5% under sticker (TrueCar about 3.8%, CarWhere about 5.3%, 2026).
   - Pick a target for the car's price before any rebate, and without the doc fee or add-ons. Type it into **Your target price** on the Price tab.

3. **Mazda's offer for your ZIP:** open [Mazda offers (external link to www.MazdaUSA.com)](https://www.mazdausa.com/shopping-tools/special-offers-and-incentives) and enter your ZIP code. Note:
   - the special APR, the longest term it covers, and the cash offered *instead*. Enter these on the Loan tab as **Automaker's special rate**, **Covers loans up to** and **Cash instead of the special rate**.
   - offers that stack, such as loyalty cash for current Mazda households or a military offer. Add them to **Rebates applied** on the Price tab.
   - the deadline. It's a *delivery* deadline, not a signing deadline. Note it yourself; the page has no field for it.

   Example, Connecticut, October 2026:
   - 2.5 S Premium: 0% for 36 months, or $1,000 cash
   - Hybrid Premium: 2.9% for 36 months, or $1,500 cash
   - Delivery by Mon 11/2/2026.

4. **Outside rate:** get a bank or credit-union rate for the term you want, and enter it as **Your outside rate** on the Loan tab.

5. **CT numbers to know (as of 2026-10-27):** 6.35% tax, $264 in DMV fees when financing, and the doc fee is negotiable. The dealer doesn't collect your town's car property tax. That bill comes separately, roughly 70% of 85% of MSRP times your town's mill rate, which is capped at 32.46 mills (a mill is $1 of tax per $1,000 of assessed value).

6. *(Optional)* Get a GAP quote from your auto insurer. Remember that Mazda's own warranty can be bought later, until 3 years/36,000 miles, from any Mazda dealer.

## At the dealer

Numbers recalculate as you type; there's no submit button. The strip at the top of every tab shows the drive-away total, what the payment should be, and how many problems the Verdict found. Tap the problem count to open the Verdict.

**Price.** Enter **Their sale price**: the car's price before the doc fee, add-ons, tax and DMV fees, including destination and port options, with dealer discounts taken off. CT quotes include the doc fee and add-ons, so enter the car's price on its own and put those in their own fields: the doc fee in **Doc fee**, and each add-on on the Extras tab. Add **Rebates applied** and **Title + registration** from their sheet. If the sheet shows their tax or drive-away total, enter them under **From their sheet (optional)** to see whether they match.

**Loan.** Enter the **Down payment**, **Their rate (APR)**, **Months** and **Their monthly payment** (ask for the exact payment, to the cent).
- If they quote only a payment, leave their rate blank; the page works out the rate.
- Turn on **Taking the cash instead** if the deal takes the cash instead of the special rate.
- If they offer a later first payment, enter both dates under **At signing: the contract** before checking the payment.
- The −$500 and +$500 buttons try out other down payments. At a new down payment, ask for a new quote before relying on the payment check.

**Extras.** Add each extra they pitch, with its price, to see what it would add per month and over the loan. If they quote an extra per month, ask for its full price. Turn on **In the deal** only for the ones their numbers include.

**Verdict.** Problems come first. Red is a problem that costs money or breaks a rule, amber is worth questioning, green checked out fine, and neutral is information or a field still to fill in. **Show the math** on each card shows the numbers behind it. A screenshot of this tab is your record. At signing, copy the contract's federal disclosure box and payment schedule into **At signing: the contract** on the Loan tab, and the Verdict checks the contract too. The signing checklist is below the cards, and **Start over** clears everything after asking you to confirm.

## Development

The page is plain HTML, CSS and JavaScript in `site/`, with no build step. The tests need Node 22 or later.

```sh
npm install              # Playwright, for the end-to-end tests
npx playwright install   # the browsers Playwright drives
npm test                 # unit and integration tests
npm run test:e2e         # end-to-end tests in WebKit, Chromium and Firefox
npm run serve            # serves the page at http://localhost:4173/car-buying-helper/
```

The page caches itself for offline use, and in the repo its release name never changes. So once a browser has opened the served page, it keeps showing the cached files after you edit `site/`. To see your edits, clear the site's data, or tick "Update on reload" under Chrome DevTools → Application → Service workers. The end-to-end tests start each browser fresh, so they always test the files on disk.

Every push to `main` runs `.github/workflows/deploy.yml`. It runs every test, then writes the commit ID into `site/offline.js` as the release name (`node tools/stamp-release.js <release>`), and publishes `site/` with GitHub Pages. Phones pick up a new release only when `offline.js` changes. In the repo, the release name stays `development`.

Rules for the links in this README: use plain text links, label KBB links `KBB.com` or `Kelley Blue Book`, mark the Mazda link `external link to www.MazdaUSA.com`, and don't link to CarGurus, whose terms forbid deep links. Edmunds and TrueCar block automated checks, so open those two links by hand in a browser before each release.

## Disclaimer

This is not financial or legal advice. Connecticut rules and figures are as of the dates shown on the page and in this README.
