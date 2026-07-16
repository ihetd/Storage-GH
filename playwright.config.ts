import { defineConfig, devices } from "@playwright/test";

// Runs the e2e suite against a dev server on :3000. If one is already running
// it is reused; otherwise Playwright starts `npm run dev`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
