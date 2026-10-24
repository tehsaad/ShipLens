import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (section 11) against the production build, on a database that
 * scripts/e2e-server.mjs resets and seeds on every run. Run `npm run e2e:prepare` first to
 * build the app and the seed script; docs/handover.md has the local setup.
 */

const PORT = 3200;
const baseURL = `http://127.0.0.1:${PORT}`;
const ci = Boolean(process.env.CI);

// The demo password of the throwaway E2E database, shared by the server and the tests.
process.env.E2E_DEMO_PASSWORD ??= "e2e-only-demo-password";

export default defineConfig({
  testDir: "e2e",
  // The tests share one database, and the report cycle runs its steps in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: 0,
  reporter: ci ? [["list"], ["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // A preinstalled Chromium, where `playwright install` is not available.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `${baseURL}/api/health`,
    // Never test against a server that is already running: it may use another database.
    reuseExistingServer: false,
    timeout: 120_000,
    env: { E2E_PORT: String(PORT) },
  },
});
