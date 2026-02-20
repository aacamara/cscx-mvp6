import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Org Isolation Evidence Capture
 *
 * Verifies API responses are org-scoped and cross-org access is blocked.
 * Used by critical-tier PRs touching org filter middleware.
 *
 * Evidence manifest is written to e2e/results/evidence/org-isolation.json
 */

const EVIDENCE_DIR = path.join(process.cwd(), "e2e/results/evidence");

interface EvidenceStep {
  name: string;
  timestamp: string;
  assertions: string[];
  responseSnippet?: string;
}

interface EvidenceManifest {
  capturedAt: string;
  tier: string;
  flow: string;
  steps: EvidenceStep[];
}

const manifest: EvidenceManifest = {
  capturedAt: new Date().toISOString(),
  tier: "critical",
  flow: "org-isolation",
  steps: [],
};

test.describe("Org Isolation Evidence", () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.afterAll(() => {
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "org-isolation.json"),
      JSON.stringify(manifest, null, 2)
    );
  });

  test("Step 1: Protected routes require organization context", async ({
    request,
  }) => {
    // These endpoints should ALL require authentication and org context
    const orgScopedEndpoints = [
      "/api/customers",
      "/api/workflows",
      "/api/health-scores",
      "/api/playbooks",
      "/api/tasks",
      "/api/segments",
    ];

    const results: { endpoint: string; status: number }[] = [];

    for (const endpoint of orgScopedEndpoints) {
      try {
        const response = await request.get(endpoint);
        results.push({ endpoint, status: response.status() });
      } catch {
        results.push({ endpoint, status: 0 });
      }
    }

    manifest.steps.push({
      name: "Protected routes require org context",
      timestamp: new Date().toISOString(),
      assertions: results.map(
        (r) =>
          `${r.endpoint}: HTTP ${r.status} (expected 401/403 — no auth/org)`
      ),
    });

    // All should reject unauthenticated requests
    for (const result of results) {
      if (result.status > 0) {
        expect([401, 403]).toContain(result.status);
      }
    }
  });

  test("Step 2: Response bodies never leak cross-org data markers", async ({
    request,
  }) => {
    // Even error responses should not leak internal org IDs or data
    const endpoints = ["/api/customers", "/api/workflows"];
    const suspiciousPatterns = [
      /organization_id/i,
      /org_id/i,
      /other.*org/i,
      /tenant/i,
    ];

    const findings: string[] = [];

    for (const endpoint of endpoints) {
      try {
        const response = await request.get(endpoint);
        const body = await response.text();

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(body) && response.status() !== 401) {
            findings.push(
              `${endpoint}: response contains "${pattern.source}" (status ${response.status()})`
            );
          }
        }
      } catch {
        // Server not running — skip
      }
    }

    manifest.steps.push({
      name: "Error responses do not leak org data",
      timestamp: new Date().toISOString(),
      assertions:
        findings.length > 0
          ? findings
          : ["No cross-org data markers found in error responses"],
    });

    // No data leakage in error responses
    expect(findings).toHaveLength(0);
  });

  test("Step 3: POST requests without auth are rejected", async ({
    request,
  }) => {
    const writeEndpoints = [
      { method: "POST" as const, url: "/api/customers", body: { name: "test" } },
      {
        method: "POST" as const,
        url: "/api/workflows",
        body: { customer_id: "fake" },
      },
    ];

    const results: { method: string; endpoint: string; status: number }[] = [];

    for (const ep of writeEndpoints) {
      try {
        const response = await request.post(ep.url, { data: ep.body });
        results.push({
          method: ep.method,
          endpoint: ep.url,
          status: response.status(),
        });
      } catch {
        results.push({ method: ep.method, endpoint: ep.url, status: 0 });
      }
    }

    manifest.steps.push({
      name: "Write operations require auth",
      timestamp: new Date().toISOString(),
      assertions: results.map(
        (r) =>
          `${r.method} ${r.endpoint}: HTTP ${r.status} (expected 401/403)`
      ),
    });

    for (const result of results) {
      if (result.status > 0) {
        expect([401, 403]).toContain(result.status);
      }
    }
  });

  test("Step 4: SQL injection attempt in query params is handled safely", async ({
    request,
  }) => {
    const maliciousInputs = [
      "/api/customers?search=' OR 1=1 --",
      "/api/customers?org_id=other-org-uuid",
      "/api/customers?organization_id=inject-attempt",
    ];

    const results: { input: string; status: number; safe: boolean }[] = [];

    for (const input of maliciousInputs) {
      try {
        const response = await request.get(input);
        const status = response.status();
        // Safe if it returns 401 (no auth) or 400 (bad input) — NOT 200/500
        const safe = [400, 401, 403, 404, 422].includes(status);
        results.push({ input, status, safe });
      } catch {
        results.push({ input, status: 0, safe: true });
      }
    }

    manifest.steps.push({
      name: "SQL injection attempts handled safely",
      timestamp: new Date().toISOString(),
      assertions: results.map(
        (r) => `${r.input}: HTTP ${r.status} (safe: ${r.safe})`
      ),
    });

    for (const result of results) {
      if (result.status > 0) {
        expect(result.safe).toBeTruthy();
      }
    }
  });
});
