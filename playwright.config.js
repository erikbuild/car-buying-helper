// ABOUTME: Runs the end-to-end tests in WebKit, Chromium and Firefox at phone size.
// ABOUTME: Serves site/ under /car-buying-helper/, as GitHub Pages does, and reuses a server that's already running.
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:4173/car-buying-helper/';

export default defineConfig({
  testDir: 'test/e2e',
  use: { baseURL: BASE_URL },
  webServer: {
    command: 'node test/serve.js site 4173',
    url: BASE_URL,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
    {
      name: 'chromium',
      use: { browserName: 'chromium', viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    },
    { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 393, height: 852 } } },
  ],
});
