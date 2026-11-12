import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/browser',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${(process.env.TEST_PORT || '3000').trim()}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
