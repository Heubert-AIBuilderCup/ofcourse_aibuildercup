import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// The app's .env (DATABASE_URL) for the e2e db helpers and the dev server; a variable already
// set in the shell wins.
if (existsSync('.env')) process.loadEnvFile('.env')

// The dev login (src/app/api/dev-login) needs a secret. Without one in the shell or .env, each run
// makes its own: the config runs in the main process first, which hands it to the dev server and
// to the workers (they inherit it, so `||=` keeps it when they load this file again).
process.env.DEV_LOGIN_SECRET ||= randomBytes(24).toString('hex')

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts$/, // *.e2e.ts, so `bun test` (which matches *.spec.* and *.test.*) never runs Playwright files
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One, as on CI: the content specs render slides and run checks on one dev server. On 7 Oct,
  // two and four workers each failed different steps on timeouts (never the same one twice),
  // and one worker passed every spec in the same 5 minutes four workers took.
  workers: 1,
  // The dev server compiles each route on its first visit.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: 'html',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // A server Playwright starts gets the dev login and the fake model provider, with caps no run
    // reaches; a reused one keeps its own environment, so it must have DEV_LOGIN_SECRET (the same
    // value) in its .env, and the content specs refuse it unless it runs AI_PROVIDER=fake.
    env: {
      DEV_LOGIN_SECRET: process.env.DEV_LOGIN_SECRET,
      AI_PROVIDER: 'fake',
      AI_DAILY_CAP_PRO: '1000',
      AI_DAILY_CAP_IMAGE: '1000',
      // Priya's road on every board: the standing board spec covers its shape until the matched roads get their own spec (intent, open question 2).
      STUDENT_ROADS_OFF: '1',
    },
  },
})
