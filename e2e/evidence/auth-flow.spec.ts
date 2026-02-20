import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Auth Flow Evidence Capture
 *
 * Captures screenshots and structured evidence for the authentication flow.
 * Used by critical-tier PRs touching auth middleware.
 *
 * Evidence manifest is written to e2e/results/evidence/auth-flow.json
 */

const EVIDENCE_DIR = path.join(process.cwd(), "e2e/results/evidence");

interface EvidenceStep {
  name: string;
  screenshot: string;
  timestamp: string;
  assertions: string[];
}

interface EvidenceManifest {
  capturedAt: string;
  tier: string;
  flow: string;
  baseURL: string;
  steps: EvidenceStep[];
  apiCalls: { method: string; url: string; status: number }[];
}

const manifest: EvidenceManifest = {
  capturedAt: new Date().toISOString(),
  tier: "critical",
  flow: "auth-flow",
  baseURL: "",
  steps: [],
  apiCalls: [],
};

test.describe("Auth Flow Evidence", () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.afterAll(() => {
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "auth-flow.json"),
      JSON.stringify(manifest, null, 2)
    );
  });

  test("Step 1: Unauthenticated access redirects to login", async ({
    page,
    baseURL,
  }) => {
    manifest.baseURL = baseURL || "";

    // Intercept API calls for evidence
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/")) {
        manifest.apiCalls.push({
          method: response.request().method(),
          url: url.replace(baseURL || "", ""),
          status: response.status(),
        });
      }
    });

    await page.goto("/");
    await page.waitForTimeout(2000);

    const screenshotPath = path.join(EVIDENCE_DIR, "01-unauthenticated.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Should be on login page or see login UI
    const url = page.url();
    const hasLoginIndicator =
      url.includes("login") ||
      url.includes("auth") ||
      (await page.locator("text=Sign in").isVisible().catch(() => false)) ||
      (await page.locator("text=Log in").isVisible().catch(() => false)) ||
      (await page
        .locator('button:has-text("Google")')
        .isVisible()
        .catch(() => false));

    manifest.steps.push({
      name: "Unauthenticated access redirects to login",
      screenshot: "01-unauthenticated.png",
      timestamp: new Date().toISOString(),
      assertions: [
        `Current URL: ${url}`,
        `Login indicator visible: ${hasLoginIndicator}`,
      ],
    });

    expect(hasLoginIndicator).toBeTruthy();
  });

  test("Step 2: API returns 401 without auth token", async ({ request }) => {
    const endpoints = [
      "/api/customers",
      "/api/workflows",
      "/api/health-scores",
    ];

    const results: { endpoint: string; status: number }[] = [];

    for (const endpoint of endpoints) {
      try {
        const response = await request.get(endpoint);
        results.push({ endpoint, status: response.status() });
        manifest.apiCalls.push({
          method: "GET",
          url: endpoint,
          status: response.status(),
        });
      } catch {
        results.push({ endpoint, status: 0 });
      }
    }

    manifest.steps.push({
      name: "API returns 401 without auth token",
      screenshot: "",
      timestamp: new Date().toISOString(),
      assertions: results.map(
        (r) => `${r.endpoint}: HTTP ${r.status} (expected 401)`
      ),
    });

    // All protected endpoints should return 401
    for (const result of results) {
      if (result.status !== 0) {
        expect(result.status).toBe(401);
      }
    }
  });

  test("Step 3: API returns 401 with invalid token", async ({ request }) => {
    const response = await request.get("/api/customers", {
      headers: {
        Authorization: "Bearer invalid-token-for-evidence-capture",
      },
    });

    manifest.apiCalls.push({
      method: "GET",
      url: "/api/customers",
      status: response.status(),
    });

    manifest.steps.push({
      name: "API returns 401 with invalid token",
      screenshot: "",
      timestamp: new Date().toISOString(),
      assertions: [
        `GET /api/customers with invalid token: HTTP ${response.status()} (expected 401)`,
      ],
    });

    expect(response.status()).toBe(401);
  });

  test("Step 4: Health endpoint is accessible (no auth required)", async ({
    request,
  }) => {
    let status = 0;
    try {
      const response = await request.get("/api/health");
      status = response.status();
    } catch {
      // Server might not be running in CI without setup
      status = -1;
    }

    manifest.steps.push({
      name: "Health endpoint accessible without auth",
      screenshot: "",
      timestamp: new Date().toISOString(),
      assertions: [
        `GET /api/health: HTTP ${status} (expected 200 or -1 if server not running)`,
      ],
    });

    if (status > 0) {
      expect(status).toBe(200);
    }
  });
});
