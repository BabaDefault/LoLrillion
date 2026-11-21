import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests (spec Seam 3). See README "Smoke test".
 *
 * Local (default): builds the app and serves the production build on port 3100 in smoke-test mode
 * (`LOLRILLION_SMOKE_TEST=1`: fixed smoke Puzzle, adjustable clock, in-memory store), then runs
 * every spec.
 *
 * Deployed: `PLAYWRIGHT_BASE_URL=https://... npm run test:smoke` starts no server and runs only the
 * read-only `deployed.spec.ts`, since a deployed site has no test hooks.
 */
const deployedUrl = process.env.PLAYWRIGHT_BASE_URL;
const port = 3100;
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  testMatch: deployedUrl ? "deployed.spec.ts" : "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: deployedUrl ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    // Vercel preview deployments behind Deployment Protection.
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: deployedUrl
    ? undefined
    : {
        command: process.env.SMOKE_SKIP_BUILD
          ? `npx next start --port ${port}`
          : `npx next build && npx next start --port ${port}`,
        url: `http://localhost:${port}/api/puzzle/state`,
        // Never reuse a server: it must be one started here, in smoke-test mode.
        reuseExistingServer: false,
        timeout: 300_000,
        env: { LOLRILLION_SMOKE_TEST: "1" },
        stdout: "ignore",
        stderr: "pipe",
      },
});
