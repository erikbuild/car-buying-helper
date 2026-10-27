// ABOUTME: Gives the end-to-end tests Playwright's test and expect.
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
