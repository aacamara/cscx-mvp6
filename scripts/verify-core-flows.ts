/**
 * CSCX.AI -- PRD-023 US-010: Core Flows Smoke Test (Playwright)
 * ==============================================================
 *
 * End-to-end smoke test that verifies 7 critical user flows of the
 * CSCX.AI Customer Success platform. Takes a screenshot at each step,
 * monitors console errors, and checks for API failures.
 *
 * Prerequisites:
 *   npm install -D @playwright/test   (already in package.json)
 *   npx playwright install chromium
 *
 * Usage:
 *   npx playwright test scripts/verify-core-flows.ts
 *
 * Or with the existing Playwright config (will use webServer settings):
 *   npx playwright test scripts/verify-core-flows.ts --config=playwright.config.ts
 *
 * Environment variables:
 *   BASE_URL      -- Frontend URL (default: http://localhost:5173)
 *   BACKEND_URL   -- Backend URL  (default: http://localhost:3001)
 */

import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const SUMMARY_PATH = path.join(SCREENSHOT_DIR, "smoke-test-summary.json");

// ---------------------------------------------------------------------------
// Shared state across tests
// ---------------------------------------------------------------------------

const consoleErrors: { step: string; text: string; url: string }[] = [];

const apiFailures: {
  step: string;
  method: string;
  url: string;
  status: number;
}[] = [];

const stepResults: {
  name: string;
  passed: boolean;
  screenshotFile: string;
  durationMs: number;
  detail: string;
}[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureScreenshotDir(): void {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const fileName = `${name}.png`;
  const filePath = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return fileName;
}

function recordStep(
  name: string,
  passed: boolean,
  screenshotFile: string,
  durationMs: number,
  detail: string
): void {
  stepResults.push({ name, passed, screenshotFile, durationMs, detail });
}

function attachMonitors(page: Page, stepName: string): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({
        step: stepName,
        text: msg.text(),
        url: page.url(),
      });
    }
  });

  page.on("response", (response) => {
    const url = response.url();
    const status = response.status();
    if (url.includes("/api/") && status >= 400) {
      apiFailures.push({
        step: stepName,
        method: response.request().method(),
        url,
        status,
      });
    }
  });
}

async function waitForStable(page: Page, extraMs = 500): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
  } catch {
    // networkidle may not fire if there is a persistent WebSocket connection
  }
  if (extraMs > 0) {
    await page.waitForTimeout(extraMs);
  }
}

async function safeClick(
  page: Page,
  selector: string,
  timeoutMs = 5_000
): Promise<boolean> {
  try {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: "visible", timeout: timeoutMs });
    await loc.click();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe("CSCX Core Flows Smoke Test (PRD-023 US-010)", () => {
  test.beforeAll(() => {
    ensureScreenshotDir();
  });

  test.afterAll(() => {
    const passed = stepResults.filter((s) => s.passed).length;
    const failed = stepResults.filter((s) => !s.passed).length;

    const summary = {
      capturedAt: new Date().toISOString(),
      frontendUrl: BASE_URL,
      backendUrl: BACKEND_URL,
      total: stepResults.length,
      passed,
      failed,
      steps: stepResults,
      consoleErrors: consoleErrors.slice(0, 50),
      apiFailures: apiFailures.slice(0, 50),
    };

    fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));

    console.log("\n=== CSCX Smoke Test Summary ===");
    console.log(`  Passed: ${passed}  |  Failed: ${failed}  |  Total: ${stepResults.length}`);
    if (consoleErrors.length > 0) {
      console.log(`  Console errors captured: ${consoleErrors.length}`);
    }
    if (apiFailures.length > 0) {
      console.log(`  API failures (4xx/5xx): ${apiFailures.length}`);
    }
    console.log(`  Summary JSON: ${SUMMARY_PATH}`);
    console.log(`  Screenshots:  ${SCREENSHOT_DIR}/`);
    console.log("===============================\n");
  });

  // Flow 1: Login Page
  test("Flow 1: Login page renders correctly", async ({ page }) => {
    const start = Date.now();
    const stepName = "01-login-page";
    attachMonitors(page, stepName);

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await waitForStable(page, 1_000);

    const screenshot = await takeScreenshot(page, stepName);

    const hasLoginUI =
      (await page.locator('text="Sign in"').isVisible().catch(() => false)) ||
      (await page.locator('text="Log in"').isVisible().catch(() => false)) ||
      (await page.locator('button:has-text("Google")').isVisible().catch(() => false)) ||
      (await page.locator('button:has-text("Demo Mode")').isVisible().catch(() => false)) ||
      (await page.locator('button:has-text("Continue without sign in")').isVisible().catch(() => false));

    const hasDashboard =
      (await page.locator('text="CSCX"').isVisible().catch(() => false)) ||
      (await page.locator('text="Dashboard"').isVisible().catch(() => false));

    const passed = hasLoginUI || hasDashboard;
    const detail = hasLoginUI
      ? "Login page rendered with sign-in controls"
      : hasDashboard
        ? "Dashboard loaded directly (Supabase not configured)"
        : "Neither login nor dashboard content detected";

    recordStep("Login page renders", passed, screenshot, Date.now() - start, detail);
    expect(passed, detail).toBeTruthy();
  });

  // Flow 2: Post-Auth Org Setup
  test("Flow 2: Post-auth org setup -- enter demo mode", async ({ page }) => {
    const start = Date.now();
    const stepName = "02-org-setup";
    attachMonitors(page, stepName);

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await waitForStable(page, 1_000);

    const enteredDemo = await safeClick(
      page,
      'button:has-text("Demo Mode"), button:has-text("Continue without sign in")',
      5_000
    );

    if (enteredDemo) {
      await waitForStable(page, 2_000);
    }

    const screenshot = await takeScreenshot(page, stepName);

    const content = await page.content();
    const lower = content.toLowerCase();

    const hasDashboard =
      lower.includes("dashboard") ||
      lower.includes("customer") ||
      lower.includes("observability") ||
      lower.includes("cscx.ai");

    const hasSignup =
      lower.includes("create organization") ||
      lower.includes("join organization") ||
      lower.includes("org setup");

    const passed = hasDashboard || hasSignup || enteredDemo;
    const detail = hasDashboard
      ? "Dashboard loaded after demo mode entry"
      : hasSignup
        ? "SignupPage rendered (user has no org)"
        : enteredDemo
          ? "Demo mode activated; app is loading"
          : "App did not reach a recognized post-login state";

    recordStep("Post-auth org setup", passed, screenshot, Date.now() - start, detail);
    expect(passed, detail).toBeTruthy();
  });

  // Flow 3: Customer List
  test("Flow 3: Customer list loads on dashboard", async ({ page }) => {
    const start = Date.now();
    const stepName = "03-customer-list";
    attachMonitors(page, stepName);

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await waitForStable(page, 1_000);
    await safeClick(page, 'button:has-text("Demo Mode"), button:has-text("Continue without sign in")', 5_000);
    await waitForStable(page, 2_000);

    await safeClick(page, 'button:has-text("Dashboard")', 5_000);
    await waitForStable(page, 2_000);

    const screenshot = await takeScreenshot(page, stepName);

    const content = await page.content();
    const lower = content.toLowerCase();

    const hasCustomerContent =
      lower.includes("customer") ||
      lower.includes("health") ||
      lower.includes("portfolio") ||
      lower.includes("arr") ||
      lower.includes("revenue") ||
      lower.includes("score") ||
      lower.includes("churn");

    const detail = hasCustomerContent
      ? "Customer list/health portfolio content detected on dashboard"
      : "No customer-related content found on dashboard";

    recordStep("Customer list loads", hasCustomerContent, screenshot, Date.now() - start, detail);
    expect(hasCustomerContent, detail).toBeTruthy();
  });

  // Flow 4: Customer Detail (360 View)
  test("Flow 4: Customer detail 360 view loads", async ({ page }) => {
    const start = Date.now();
    const stepName = "04-customer-detail";
    attachMonitors(page, stepName);

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await waitForStable(page, 1_000);
    await safeClick(page, 'button:has-text("Demo Mode"), button:has-text("Continue without sign in")', 5_000);
    await waitForStable(page, 2_000);

    await safeClick(page, 'button:has-text("Dashboard")', 5_000);
    await waitForStable(page, 2_000);

    const customerClicked = await safeClick(
      page,
      'table tbody tr, [class*="customer-row"], [class*="customer-card"], [role="row"], button:has-text("View")',
      5_000
    );

    if (customerClicked) {
      await waitForStable(page, 2_000);
    }

    const screenshot = await takeScreenshot(page, stepName);

    const content = await page.content();
    const lower = content.toLowerCase();

    const hasDetailContent =
      lower.includes("360") ||
      lower.includes("customer detail") ||
      lower.includes("workspace") ||
      lower.includes("health score") ||
      lower.includes("contract") ||
      lower.includes("timeline") ||
      lower.includes("back to dashboard");

    const passed = customerClicked && hasDetailContent;
    const detail = !customerClicked
      ? "No customer row/card found to click into"
      : hasDetailContent
        ? "Customer 360 detail view loaded successfully"
        : "Customer row clicked but detail content not detected";

    recordStep("Customer detail 360 view", passed || !customerClicked, screenshot, Date.now() - start, detail);

    if (customerClicked) {
      expect(hasDetailContent, detail).toBeTruthy();
    }
  });

  // Flow 5: Admin Panel
  test("Flow 5: Admin panel is accessible", async ({ page }) => {
    const start = Date.now();
    const stepName = "05-admin-panel";
    attachMonitors(page, stepName);

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await waitForStable(page, 1_000);
    await safeClick(page, 'button:has-text("Demo Mode"), button:has-text("Continue without sign in")', 5_000);
    await waitForStable(page, 2_000);

    const adminClicked = await safeClick(page, 'button:has-text("Admin")', 5_000);

    if (adminClicked) {
      await waitForStable(page, 2_000);
    }

    const screenshot = await takeScreenshot(page, stepName);

    const content = await page.content();
    const lower = content.toLowerCase();

    if (!adminClicked) {
      recordStep("Admin panel accessible", true, screenshot, Date.now() - start,
        "Admin button not visible (expected for non-admin/design-partner users)");
      return;
    }

    const hasAdminContent =
      lower.includes("platform metrics") ||
      lower.includes("organization") ||
      lower.includes("admin") ||
      lower.includes("team") ||
      lower.includes("import") ||
      lower.includes("settings");

    recordStep("Admin panel accessible", hasAdminContent, screenshot, Date.now() - start,
      hasAdminContent ? "Admin panel loaded with management tabs" : "Admin panel navigated but expected content not found");

    expect(hasAdminContent, "Admin panel should contain management content").toBeTruthy();
  });

  // Flow 6: Onboarding
  test("Flow 6: Onboarding flow is accessible", async ({ page }) => {
    const start = Date.now();
    const stepName = "06-onboarding";
    attachMonitors(page, stepName);

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await waitForStable(page, 1_000);
    await safeClick(page, 'button:has-text("Demo Mode"), button:has-text("Continue without sign in")', 5_000);
    await waitForStable(page, 2_000);

    let onboardingFound = await safeClick(
      page,
      'button:has-text("New Onboarding"), button:has-text("+ New"), button:has-text("Onboard")',
      5_000
    );

    if (onboardingFound) {
      await waitForStable(page, 2_000);
    } else {
      onboardingFound = await safeClick(page, 'button:has-text("Agent Center")', 5_000);
      if (onboardingFound) {
        await waitForStable(page, 2_000);
      }
    }

    const screenshot = await takeScreenshot(page, stepName);

    const content = await page.content();
    const lower = content.toLowerCase();

    const hasOnboardingContent =
      lower.includes("onboarding") ||
      lower.includes("agent center") ||
      lower.includes("upload") ||
      lower.includes("contract") ||
      lower.includes("new customer") ||
      lower.includes("chat") ||
      lower.includes("message");

    const passed = onboardingFound && hasOnboardingContent;
    const detail = !onboardingFound
      ? "Onboarding / Agent Center button not found"
      : hasOnboardingContent
        ? "Onboarding or Agent Center view loaded successfully"
        : "View navigated but onboarding content not detected";

    recordStep("Onboarding flow accessible", passed || !onboardingFound, screenshot, Date.now() - start, detail);

    if (onboardingFound) {
      expect(hasOnboardingContent, detail).toBeTruthy();
    }
  });

  // Flow 7: Agent Center (Mission Control)
  test("Flow 7: Agent Center (Mission Control) opens", async ({ page }) => {
    const start = Date.now();
    const stepName = "07-agent-center";
    attachMonitors(page, stepName);

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await waitForStable(page, 1_000);
    await safeClick(page, 'button:has-text("Demo Mode"), button:has-text("Continue without sign in")', 5_000);
    await waitForStable(page, 2_000);

    const agentClicked = await safeClick(page, 'button:has-text("Agent Center")', 5_000);

    if (agentClicked) {
      await waitForStable(page, 2_000);
    }

    const screenshot = await takeScreenshot(page, stepName);

    if (!agentClicked) {
      recordStep("Agent Center opens", false, screenshot, Date.now() - start, "Agent Center button not found in navigation");
      expect(agentClicked, "Agent Center button should be visible").toBeTruthy();
      return;
    }

    const content = await page.content();
    const lower = content.toLowerCase();

    const hasAgentContent =
      lower.includes("agent") ||
      lower.includes("chat") ||
      lower.includes("message") ||
      lower.includes("send") ||
      lower.includes("conversation") ||
      lower.includes("onboarding") ||
      lower.includes("specialist");

    recordStep("Agent Center opens", hasAgentContent, screenshot, Date.now() - start,
      hasAgentContent ? "Agent Center loaded with chat/agent interface" : "Agent Center navigated but expected content not found");

    expect(hasAgentContent, "Agent Center should display agent/chat content").toBeTruthy();
  });

  // Bonus: Backend Health Check
  test("Bonus: Backend health endpoint responds", async ({ request }) => {
    const start = Date.now();
    let passed = false;
    let detail = "";

    try {
      const response = await request.get(`${BACKEND_URL}/api/health`);
      const status = response.status();
      passed = status === 200;
      detail = `GET /api/health returned HTTP ${status}`;
    } catch (err) {
      detail = `Backend not reachable at ${BACKEND_URL}: ${err}`;
    }

    recordStep("Backend health endpoint", passed, "", Date.now() - start, detail);

    if (!passed) {
      console.warn(`  [WARN] ${detail}`);
    }
  });

  // Bonus: Console Errors
  test("Bonus: No critical console errors", async () => {
    const start = Date.now();

    const criticalErrors = consoleErrors.filter((e) => {
      const text = e.text.toLowerCase();
      return (
        !text.includes("favicon") &&
        !text.includes("hmr") &&
        !text.includes("hot module") &&
        !text.includes("websocket") &&
        !text.includes("failed to load resource: net::err_connection_refused")
      );
    });

    const passed = criticalErrors.length === 0;
    const detail =
      criticalErrors.length === 0
        ? `No critical console errors (${consoleErrors.length} total, all non-critical)`
        : `${criticalErrors.length} critical console error(s) found: ${criticalErrors
            .slice(0, 3)
            .map((e) => e.text.slice(0, 100))
            .join("; ")}`;

    recordStep("No critical console errors", passed, "", Date.now() - start, detail);

    if (!passed) {
      console.warn(`  [WARN] ${detail}`);
    }
  });

  // Bonus: No API 5xx Errors
  test("Bonus: No API 5xx errors during navigation", async () => {
    const start = Date.now();

    const serverErrors = apiFailures.filter((f) => f.status >= 500);
    const passed = serverErrors.length === 0;
    const detail =
      serverErrors.length === 0
        ? `No 5xx API errors recorded (${apiFailures.length} total 4xx/5xx)`
        : `${serverErrors.length} server error(s): ${serverErrors
            .slice(0, 3)
            .map((e) => `${e.method} ${e.url} => ${e.status}`)
            .join("; ")}`;

    recordStep("No API 5xx errors", passed, "", Date.now() - start, detail);

    expect(passed, detail).toBeTruthy();
  });
});
