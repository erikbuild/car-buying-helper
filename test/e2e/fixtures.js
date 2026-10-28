// ABOUTME: Gives the end-to-end tests Playwright's test and expect, and the steps and measurements they share.
// ABOUTME: A test fails when its page logs a console error or throws an uncaught error.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(`console error: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      errors.push(`page error: ${error.message}`);
    });
    await use(page);
    expect(errors, 'errors in the page').toEqual([]);
  },
});

export { expect };

// Shows a field's input: selects the tab that holds it, and opens the contract section when the field is in it.
async function showField(page, name) {
  const { panelId, inClosedSection } = await page.locator(`#${name}`).evaluate((input) => ({
    panelId: input.closest('[role="tabpanel"]').id,
    inClosedSection: input.closest('details:not([open])') !== null,
  }));
  await page.locator(`[role="tab"][aria-controls="${panelId}"]`).click();
  if (inClosedSection) {
    await page.locator(`details:has(#${name}) > summary`).click();
  }
}

// Types each field's text into its input, in the order given.
export async function typeFields(page, texts) {
  for (const [name, text] of Object.entries(texts)) {
    await showField(page, name);
    await page.locator(`#${name}`).fill(text);
  }
}

// Checks the summary strip's four slots.
export async function expectStrip(page, { driveAway, shouldBe, theirs, problems }) {
  await expect(page.locator('[data-strip="drive-away"]')).toHaveText(driveAway);
  await expect(page.locator('[data-strip="should-be"]')).toHaveText(shouldBe);
  await expect(page.locator('[data-strip="theirs"]')).toHaveText(theirs);
  await expect(page.locator('[data-strip="problems"]')).toHaveText(problems);
}

// The elements of `locator` that are under 44px tall or under 44px wide, too small to tap (§9), as
// [name, width, height]. The name is the element's id, or its text when it has no id.
export async function tapTargetsUnder44px(locator) {
  const sizes = await locator.evaluateAll((elements) => elements.map((element) => {
    const { width, height } = element.getBoundingClientRect();
    return [element.id || element.textContent.trim(), width, height];
  }));
  return sizes.filter(([, width, height]) => width < 44 || height < 44);
}

// Opens the Verdict tab and checks its cards' severities and headlines, in order.
export async function expectVerdicts(page, verdicts) {
  await page.getByRole('tab', { name: 'Verdict' }).click();
  await expect(page.locator('[data-cards] > article > h3')).toHaveText(verdicts.map(([, headline]) => headline));
  const severities = await page.locator('[data-cards] > article')
    .evaluateAll((cards) => cards.map((card) => card.dataset.severity));
  expect(severities).toEqual(verdicts.map(([severity]) => severity));
}
