import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3107"
const webServerPort = new URL(baseURL).port || "3000"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    // Reuse the same pinned Node runtime that launched Playwright. This avoids
    // silently falling back to a different system Node inside the child shell.
    command: `"${process.execPath}" scripts/setup-local.mjs --seed --dev`,
    env: {
      AUTH_URL: baseURL,
      PORT: webServerPort,
    },
    url: baseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
