import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'factory-categories.spec.ts',
  workers: 1,
  use: {
    baseURL: process.env.CATEGORY_PREVIEW_URL ?? 'http://127.0.0.1:3149',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
});
