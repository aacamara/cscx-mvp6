# CSCX.AI Security Audit - Phase 1
## Security Headers, CORS, Rate Limiting & Dependencies

**Date:** 2026-02-07
**Auditor:** Claude Opus 4.6 (automated)
**Scope:** Server-side security configuration, dependency vulnerabilities, TLS/HTTPS posture, error handling
**Project:** CSCX.AI v3 (`/Users/azizcamara/CSCX V7`)

---

## 1. Security Headers

### 1.1 Helmet.js Usage
**Status: PASS ✅ (with caveats)**
**Severity: LOW**
**Evidence:** `/Users/azizcamara/CSCX V7/server/src/index.ts:3-4, 184-195`

Helmet v8.0.0 is installed and applied as the first middleware. Helmet's defaults include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` (via helmet default)
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-Permitted-Cross-Domain-Policies: none`
- `Strict-Transport-Security` (HSTS) with default `max-age=15552000`
- `Referrer-Policy: no-referrer` (helmet default)

### 1.2 HSTS (Strict-Transport-Security)
**Status: PASS ✅**
**Severity: N/A**
**Evidence:** Helmet v8 default behavior (enabled by default with `max-age=15552000`)

Helmet enables HSTS by default. However, there is no explicit configuration to enable `includeSubDomains` or `preload`, which are recommended for production domains.

### 1.3 X-Frame-Options
**Status: PASS ✅**
**Severity: N/A**
**Evidence:** Helmet default sets `X-Frame-Options: SAMEORIGIN`; Vercel config at `/Users/azizcamara/CSCX V7/vercel.json:12` sets `X-Frame-Options: DENY` for the frontend.

### 1.4 X-Content-Type-Options
**Status: PASS ✅**
**Severity: N/A**
**Evidence:** Helmet default sets `X-Content-Type-Options: nosniff`; also configured in `vercel.json:13`.

### 1.5 Content-Security-Policy (CSP)
**Status: FAIL 🔴**
**Severity: MEDIUM**
**Evidence:** `/Users/azizcamara/CSCX V7/server/src/index.ts:185-194`

```typescript
contentSecurityPolicy: config.nodeEnv === 'production' ? {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://*.supabase.co"],
  }
} : false
```

**Issues:**
1. `'unsafe-inline'` and `'unsafe-eval'` in `scriptSrc` **completely negate CSP's XSS protection**.
2. `'unsafe-inline'` in `styleSrc` weakens CSS injection protection.
3. `imgSrc` allows `https:` which is overly permissive.
4. CSP is **disabled entirely** in non-production environments.

### 1.6 Referrer-Policy
**Status: PASS ✅**
**Evidence:** Helmet v8 default sets `Referrer-Policy: no-referrer`.

### 1.7 Permissions-Policy
**Status: FAIL 🔴**
**Severity: LOW**
**Evidence:** No `Permissions-Policy` header found anywhere in the codebase.

### 1.8 Headers at Cloud Run / Dockerfile Level
**Status: N/A ⚪**
**Evidence:** Cloud Run provides TLS termination. No additional headers set at infrastructure level.

---

## 2. CORS Configuration

### 2.1 CORS Setup
**Status: FAIL 🔴**
**Severity: CRITICAL**
**Evidence:** `server/src/index.ts:196-221`, `server/src/config/index.ts:11`

```typescript
// config/index.ts
corsOrigin: process.env.CORS_ORIGIN || '*',
```

**Issues:**
1. **Default CORS_ORIGIN is `*` (wildcard).** When `config.corsOrigin === '*'`, ANY origin is accepted.
2. **CORS_ORIGIN not set in Cloud Build production deployment.** `cloudbuild.yaml` only sets `NODE_ENV=production` but does NOT set `CORS_ORIGIN`. In production, it defaults to `'*'`.
3. **Localhost origins hardcoded in production.** The allowedOrigins list includes `http://localhost:*` entries always present.
4. **Requests with no origin always allowed** (`if (!origin) return callback(null, true)`).

### 2.2 Credentials Handling
**Status: FAIL 🔴**
**Severity: CRITICAL**
**Evidence:** `server/src/index.ts:220`

`credentials: true` combined with the wildcard origin bypass means any website can send authenticated cross-origin requests and read responses. The code dynamically reflects the requesting origin (`callback(null, origin)`), which effectively bypasses the browser's `Access-Control-Allow-Origin: *` + credentials protection.

### 2.3 Allowed Methods and Headers
**Status: PASS ✅ (default)**
**Severity: LOW**
**Evidence:** No explicit `methods` or `allowedHeaders` restriction. Uses cors package defaults.

---

## 3. Rate Limiting

### 3.1 General API Rate Limiting
**Status: PASS ✅ (with caveats)**
**Severity: MEDIUM**
**Evidence:** `server/src/index.ts:229-234`

General rate limiter applied to all `/api/` routes. Default: 100 requests per minute.

**Issue:** Uses `express-rate-limit`'s default **in-memory store**. In Cloud Run with `max-instances: 10`, each instance has its own counter. Attacker can exceed limit by 10x.

### 3.2 Auth Endpoint Rate Limiting
**Status: PASS ✅ (partial)**
**Severity: MEDIUM**
**Evidence:** `server/src/routes/auth.ts:22-52, 68`

`/api/auth/validate-invite` has custom rate limiter (10/60s per IP).

**Issues:**
1. `/api/auth/claim-invite` has **NO rate limiting**
2. `/api/auth/provision-admin` has **NO rate limiting**
3. `/api/auth/redeem-invite` has **NO rate limiting**
4. All use in-memory store

### 3.3 Agentic Endpoint Rate Limiting
**Status: PASS ✅**
**Severity: LOW**
**Evidence:** `server/src/middleware/agenticRateLimit.ts`, `server/src/routes/agentic-agents.ts:52`

Well-implemented tiered rate limiting with sliding window algorithm. Uses in-memory store (same Cloud Run concern).

### 3.4 DDoS Protection
**Status: FAIL 🔴**
**Severity: MEDIUM**
**Evidence:** No Cloud Armor, Cloudflare, or equivalent DDoS protection found.

---

## 4. Dependency Vulnerabilities

### 4.1 Server Dependencies (npm audit)
**Status: PASS ✅ (with warnings)**
**Severity: LOW**

```
Total dependencies: 487 (262 prod, 225 dev)
Critical: 0, High: 0, Moderate: 6 (all dev-only), Low: 0
```

Moderate vulns are in esbuild/vite/vitest (dev dependencies only, excluded from production Docker build).

### 4.2 Frontend Dependencies (npm audit)
**Status: PASS ✅**

```
Total dependencies: 285 (112 prod, 173 dev)
Critical: 0, High: 0, Moderate: 0, Low: 0
```

### 4.3 Dockerfile Base Image Security
**Status: PASS ✅**
**Severity: LOW**

Uses `node:20-alpine` (smaller attack surface). Multi-stage build. Production-only deps.
**Note:** Not pinned to specific patch version.

### 4.4 Key Production Dependencies
**Status: PASS ✅**

| Package | Version | Notes |
|---------|---------|-------|
| express | ^4.21.2 | Current stable |
| helmet | ^8.0.0 | Latest major |
| cors | ^2.8.5 | Stable |
| express-rate-limit | ^7.5.0 | Current |
| zod | ^3.24.1 | Current |
| @supabase/supabase-js | ^2.47.10 | Recent |

---

## 5. HTTPS & TLS

### 5.1 HTTPS Enforcement
**Status: PASS ✅**
**Evidence:** Cloud Run automatically provides TLS termination. Helmet HSTS header set.

### 5.2 HTTP URLs in Code
**Status: FAIL 🔴**
**Severity: LOW**
**Evidence:** `server/src/config/index.ts:33,39`

Default fallback URLs use `http://`. Would be overridden in production via env vars, but if `GOOGLE_REDIRECT_URI` or `FRONTEND_URL` are not set, OAuth callbacks attempt HTTP.

### 5.3 Cookie Security Flags
**Status: N/A ⚪**
**Evidence:** No server-side cookies used. JWT in Authorization headers.

---

## 6. Error Information Leakage

### 6.1 Stack Traces in Production
**Status: PASS ✅ (error handler) / FAIL 🔴 (audit log routes)**
**Severity: MEDIUM**

Error handler middleware correctly guards stack traces (dev only). But audit logs store full stack traces which could leak if exposed via API.

### 6.2 Error Messages Leaking System Info
**Status: FAIL 🔴**
**Severity: MEDIUM**

Multiple routes return raw `error.message` to clients:
- `routes/outlook/auth.ts:50`
- `routes/email.ts:82`
- `routes/social.ts:166`

### 6.3 NODE_ENV=production Setting
**Status: PASS ✅**
**Evidence:** Set in both Dockerfile and Cloud Build.

### 6.4 Exposed Metrics and Health Endpoints
**Status: FAIL 🔴**
**Severity: MEDIUM**
**Evidence:** `server/src/index.ts:262-284`

`/metrics`, `/metrics/agentic`, `/health/circuits` are publicly accessible without auth. Expose system architecture, usage patterns, and service status.

---

## 7. Additional Findings

### 7.1 WebSocket Authentication
**Status: FAIL 🔴**
**Severity: HIGH**
**Evidence:** `server/src/services/websocket.ts:91-108`

WebSocket auth handler accepts **any non-empty token** without validation. Any client can connect and receive real-time agent events.

### 7.2 Missing Authentication on Most Routes
**Status: FAIL 🔴**
**Severity: HIGH**
**Evidence:** `server/src/index.ts:287-386`

Only 4 of 100+ route files use `authMiddleware`. Customer data, dashboards, AI endpoints all unprotected.

### 7.3 Admin Provisioning Endpoint
**Status: FAIL 🔴**
**Severity: HIGH**
**Evidence:** `routes/auth.ts:263`

No auth, no rate limit. Email allowlist is sole protection. Leaks info about valid admin emails.

### 7.4 CORS_ORIGIN Missing from Production Deployment
**Status: FAIL 🔴**
**Severity: CRITICAL**
**Evidence:** `cloudbuild.yaml:49-50`

Only `NODE_ENV=production` set in `--set-env-vars`. CORS_ORIGIN defaults to `'*'` in production.

---

## Summary

### Critical Issues (2)
| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 1 | CORS wildcard with credentials | `index.ts:196-221`, `config/index.ts:11`, `cloudbuild.yaml:49-50` | CORS_ORIGIN defaults to `*` and is not set in production. Any website can make credentialed requests. |
| 2 | CORS_ORIGIN missing from Cloud Build | `cloudbuild.yaml`, `cloudbuild-staging.yaml` | Production and staging do not set CORS_ORIGIN env var |

### High Issues (3)
| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 3 | WebSocket auth not implemented | `services/websocket.ts:91-108` | Any token accepted, no JWT validation |
| 4 | Most routes lack authentication | `index.ts:287-386` | Only 4 of 100+ route files use auth middleware |
| 5 | Admin provisioning unprotected | `routes/auth.ts:263` | No auth, no rate limit |

### Medium Issues (5)
| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 6 | CSP allows unsafe-inline/eval | `index.ts:188` | Negates XSS protection |
| 7 | Rate limiting in-memory | `index.ts:229`, `agenticRateLimit.ts:84` | Ineffective with multiple Cloud Run instances |
| 8 | Error messages leak to clients | `outlook/auth.ts`, `email.ts`, `social.ts` | Raw error.message returned |
| 9 | Metrics/health endpoints public | `index.ts:262-284` | System info exposed |
| 10 | No DDoS protection | N/A | No Cloud Armor or WAF |

### Low Issues (4)
| # | Issue | Location | Description |
|---|-------|----------|-------------|
| 11 | Permissions-Policy missing | N/A | Browser feature restrictions not set |
| 12 | HSTS not configured with preload | Helmet defaults | Missing includeSubDomains and preload |
| 13 | HTTP fallback URLs in config | `config/index.ts:33,39` | Default URLs use http:// |
| 14 | Docker image not pinned | `Dockerfile:6,25,44` | node:20-alpine not pinned to patch |

### Passing Items (17)
| # | Item |
|---|------|
| 1 | Helmet.js installed and applied (v8.0.0) |
| 2 | X-Frame-Options set |
| 3 | X-Content-Type-Options set |
| 4 | Referrer-Policy set |
| 5 | HSTS set |
| 6 | Error handler stack trace guard |
| 7 | Logger stack trace guard |
| 8 | NODE_ENV=production |
| 9 | npm audit: 0 critical/high vulns |
| 10 | Alpine Docker images, multi-stage build |
| 11 | Auth endpoint rate limiting (partial) |
| 12 | Agentic endpoint rate limiting |
| 13 | Input validation (Zod) exists |
| 14 | Cloud Run TLS |
| 15 | JWT-based auth middleware exists |
| 16 | No server-side cookies |
| 17 | Graceful shutdown handling |

---

## Priority Remediation Order

1. **IMMEDIATE:** Set `CORS_ORIGIN=https://cscx.ai` in Cloud Build `--set-env-vars`
2. **IMMEDIATE:** Change config default from `'*'` to reject if not set in production
3. **HIGH:** Apply `authMiddleware` globally to all `/api/` routes
4. **HIGH:** Implement WebSocket JWT validation
5. **HIGH:** Add rate limiting to claim-invite, redeem-invite, provision-admin
6. **MEDIUM:** Switch rate limiting to Redis-backed store
7. **MEDIUM:** Remove `'unsafe-inline'` and `'unsafe-eval'` from CSP
8. **MEDIUM:** Restrict error messages to clients
9. **MEDIUM:** Add auth to `/metrics` endpoints
10. **LOW:** Add Permissions-Policy header
11. **LOW:** Configure HSTS with includeSubDomains and preload
12. **LOW:** Pin Docker base image version
