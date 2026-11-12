import { defineConfig, devices } from '@playwright/test'

const PORT = parseInt((process.env.TEST_PORT || '3010').trim(), 10)

export default defineConfig({
  testDir: './__tests__/browser',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Automatically start the Next.js dev server before running browser tests.
  // Uses port 3010 by default to avoid clashing with any running dev server.
  // Set TEST_PORT to override.
  // The Next.js dev server must be started before running browser tests.
  // Start it with: set NODE_OPTIONS=--max-old-space-size=8192 && node node_modules\next\dist\bin\next dev -p 3010
  // Then run: node node_modules/@playwright/test/cli.js test --config playwright.config.ts
  //
  // webServer auto-start is disabled because the Next.js webpack worker requires
  // NODE_OPTIONS=--max-old-space-size=8192 which cannot be inherited by spawned
  // workers via the webServer env config on Windows. Run the server manually first.
  // webServer: {
  //   command: `node node_modules\\next\\dist\\bin\\next dev -H 0.0.0.0 -p ${PORT}`,
  //   url: `http://localhost:${PORT}`,
  //   timeout: 120 * 1000,
  //   reuseExistingServer: true,
  //   env: { NODE_OPTIONS: '--max-old-space-size=4096' },
  // },
})
