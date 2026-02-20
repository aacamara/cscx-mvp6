import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for CSCX.AI evidence capture.
 * Used by critical-tier PRs to generate browser evidence of auth + org isolation.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // Sequential — evidence capture needs deterministic order
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["html", { open: "never", outputFolder: "e2e/results/html" }],
    ["json", { outputFile: "e2e/results/results.json" }],
    ["list"],
  ],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    screenshot: "on",
    video: "on-first-retry",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "evidence",
      testDir: "./e2e/evidence",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start both frontend and backend for local runs
  webServer: process.env.CI
    ? undefined // CI starts servers separately
    : [
        {
          command: "cd server && npm run dev",
          port: 3001,
          reuseExistingServer: true,
          timeout: 15_000,
        },
        {
          command: "npm run dev",
          port: 5173,
          reuseExistingServer: true,
          timeout: 15_000,
        },
      ],
});
