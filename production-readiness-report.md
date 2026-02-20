# CSCX.AI Production Readiness Report

**Project:** CSCX.AI V7 — Multi-Agent Customer Success Platform
**Audit Date:** 2026-02-07
**Auditor:** Claude Opus 4.6 (4 parallel security agents)
**Stack:** React 19 + Express + Supabase PostgreSQL + Google Cloud Run

---

# Phase 1: Security Hardening — AUDIT COMPLETE

**Overall Security Grade: F (CRITICAL)**
**Status: BLOCKING — Must resolve before production deployment**

---

## BLOCKING ISSUES — All CRITICAL Findings

### Deduplicated across all 4 audit reports (19 unique CRITICAL/HIGH issues)

| # | Severity | Finding | Location | Report |
|---|----------|---------|----------|--------|
| **1** | **CRITICAL** | Anthropic API key in plaintext on disk | `server/.env:13` | 1A |
| **2** | **CRITICAL** | Gemini API key in plaintext (2 files) | `server/.env:16`, `.env.local:1` | 1A |
| **3** | **CRITICAL** | Supabase service role key in plaintext | `server/.env:23` | 1A |
| **4** | **CRITICAL** | Google OAuth client secret in plaintext | `server/.env:35` | 1A |
| **5** | **CRITICAL** | Database password in plaintext | `server/.env:48` | 1A |
| **6** | **CRITICAL** | Auth middleware on only 1 of 100+ routes | `server/src/index.ts` (no global auth) | 1A, 1B, 1C |
| **7** | **CRITICAL** | x-user-id header spoofable (409 instances, 70 files) | All route files | 1A, 1B, 1D |
| **8** | **CRITICAL** | HITL approval system bypassable via header spoofing | `server/src/routes/approvals.ts` | 1A |
| **9** | **CRITICAL** | `GRANT ALL` to `anon` role on all tables | `database/migrations/001_initial_schema.sql:383-386` | 1D |
| **10** | **CRITICAL** | ~100+ tables without RLS policies | Multiple migration files | 1D |
| **11** | **CRITICAL** | RLS commented out as "Optional" in schema.sql | `database/schema.sql:326-333` | 1A, 1D |
| **12** | **CRITICAL** | CORS wildcard (`*`) with `credentials: true` in production | `server/src/config/index.ts:11`, `cloudbuild.yaml` | 1C |
| **13** | **CRITICAL** | `.env.production` committed to git (real Supabase keys) | Git commit `b24a8fd` | 1D |
| **14** | **CRITICAL** | Supabase `.or()` filter injection (25+ instances) | Routes + services using `.or()` with user input | 1B |
| **15** | **HIGH** | Google OAuth tokens stored plaintext (no encryption) | `server/src/services/google/oauth.ts:192-199` | 1A, 1D |
| **16** | **HIGH** | WebSocket auth accepts any token without validation | `server/src/services/websocket.ts:91-108` | 1A, 1C |
| **17** | **HIGH** | Admin endpoint double bypass (dev + no-Supabase) | `server/src/routes/admin.ts:25-43` | 1A, 1C |
| **18** | **HIGH** | No user-scoped RLS policies (only service_role) | All migration files | 1A, 1D |
| **19** | **HIGH** | Default user fallbacks in 6+ route files | `alerts.ts`, `search.ts`, `mobile-*.ts`, etc. | 1A |

---

## All Findings by Severity

### CRITICAL (14 unique findings)

1. Anthropic API key in plaintext on disk
2. Gemini API key in plaintext in 2 files
3. Supabase service role key in plaintext
4. Google OAuth client secret in plaintext
5. Database password in plaintext
6. Auth middleware applied to only 1 route
7. x-user-id header spoofable identity (409 instances)
8. HITL approval system completely bypassable
9. `GRANT ALL` to `anon` role on all tables
10. ~100+ tables without RLS
11. RLS commented out in schema.sql
12. CORS wildcard + credentials in production (CORS_ORIGIN not set in Cloud Build)
13. `.env.production` committed to git history
14. Supabase `.or()` PostgREST filter injection (25+ instances)

### HIGH (11 unique findings)

1. Google OAuth tokens stored plaintext (no encryption)
2. WebSocket auth accepts any token
3. Admin endpoint double bypass
4. No user-scoped RLS policies
5. Default user fallbacks in routes
6. provision-admin endpoint has no auth
7. `.env.production` not in `.gitignore`
8. Possible secrets in git history (needs manual check)
9. Missing input validation on ~158 route files (Zod exists but not applied)
10. Customer PATCH allows arbitrary field updates (no whitelist)
11. Google OAuth routes use spoofable x-user-id header

### MEDIUM (9 unique findings)

1. CSP allows `'unsafe-inline'` and `'unsafe-eval'`
2. Rate limiting uses in-memory store (ineffective with Cloud Run multi-instance)
3. Raw `error.message` leaked to clients in multiple routes
4. `/metrics` and `/health/circuits` publicly accessible without auth
5. No DDoS protection (no Cloud Armor or WAF)
6. No CSRF tokens implemented
7. Role checks skipped in non-production environments
8. claim/redeem-invite accept unverified userId
9. Webhook endpoints have no auth or signature verification

### LOW (6 unique findings)

1. Missing `Permissions-Policy` header
2. HSTS lacks `includeSubDomains` and `preload`
3. HTTP fallback URLs in config defaults
4. Docker base image not pinned to specific patch
5. Sessions stored in localStorage (XSS-vulnerable)
6. Hardcoded demo user UUID in 3+ files

### PASSING (17 items)

1. Helmet.js installed and properly applied (v8.0.0)
2. X-Frame-Options set (Helmet + Vercel)
3. X-Content-Type-Options set
4. Referrer-Policy set
5. HSTS enabled (Helmet default)
6. Error handler guards stack traces in production
7. Logger guards stack traces in production
8. NODE_ENV=production set in Dockerfile and Cloud Build
9. npm audit: 0 critical/high vulnerabilities (both frontend and server)
10. Alpine Docker images with multi-stage build
11. Agentic endpoint rate limiting (well-implemented tiered system)
12. Zod validation middleware exists (just not widely applied)
13. Cloud Run provides automatic TLS termination
14. JWT validation middleware exists and works when applied
15. No server-side cookies (JWT in headers)
16. Graceful shutdown handling
17. Frontend uses anon key (not service role)

---

## Metrics

| Metric | Value |
|--------|-------|
| Total checklist items evaluated | 71 |
| PASS ✅ | 17 (24%) |
| FAIL 🔴 (CRITICAL) | 14 (20%) |
| FAIL 🔴 (HIGH) | 11 (15%) |
| FAIL 🔴 (MEDIUM) | 9 (13%) |
| FAIL 🔴 (LOW) | 6 (8%) |
| PARTIAL ⚠️ | 4 (6%) |
| N/A ⚪ | 6 (8%) |
| UNABLE TO VERIFY ❓ | 4 (6%) |
| **Security Grade** | **F** |

---

## Recommended Remediation Priority

### Phase A — IMMEDIATE (Today/Tomorrow)

1. **Rotate ALL secrets** — Anthropic, Gemini, Supabase, Google OAuth, DB password
2. **Add `.env.production` to `.gitignore`**
3. **Check git history** for committed secrets: `git log --all --diff-filter=A -- '*.env*'`
4. **Set `CORS_ORIGIN=https://cscx.ai`** in `cloudbuild.yaml` and `cloudbuild-staging.yaml`
5. **Change CORS default** from `'*'` to reject-if-not-set in production

### Phase B — This Week

6. **Apply `authMiddleware` globally** to all `/api/` routes in `server/src/index.ts`
7. **Remove ALL `x-user-id` header usage** — replace with JWT-verified user identity
8. **Remove default user fallbacks** (`'default-user'`, `'demo-user'`, etc.)
9. **Fix WebSocket authentication** — validate JWT via Supabase
10. **Add JWT verification** to provision-admin, claim-invite, redeem-invite
11. **Sanitize all `.or()` filter inputs** or switch to Supabase filter object syntax
12. **Revoke `GRANT ALL` from `anon`** role, replace with granular permissions

### Phase C — This Sprint

13. **Enable RLS on ALL tables** with user-scoped policies
14. **Encrypt Google OAuth tokens** at rest (use Supabase Vault or application-level encryption)
15. **Apply Zod validation** to all route files (extend existing middleware)
16. **Switch rate limiting** to Redis-backed store
17. **Remove `'unsafe-inline'`/`'unsafe-eval'`** from CSP
18. **Add auth to `/metrics` endpoints**
19. **Add webhook signature verification**

---

## Detailed Reports

- [Phase 1A: Secrets, Auth & Authorization](./reports/phase1-secrets-auth.md)
- [Phase 1B: Input Validation & Injection](./reports/phase1-input-validation.md)
- [Phase 1C: Headers, CORS, Rate Limiting & Dependencies](./reports/phase1-headers-cors-deps.md)
- [Phase 1D: Supabase Security, RLS & Database Security](./reports/phase1-supabase-rls.md)

---

## Phases 2-9: PENDING

Phases 2-9 of the production-readiness audit are blocked until Phase 1 security issues are reviewed and critical items are resolved.

| Phase | Name | Status |
|-------|------|--------|
| 1 | Security Hardening | **COMPLETE — REVIEW REQUIRED** |
| 2 | Database Optimization | PENDING |
| 3 | Error Handling & Resilience | PENDING |
| 4 | Observability & Monitoring | PENDING |
| 5 | CI/CD & Deployment | PENDING |
| 6 | Performance & Scaling | PENDING |
| 7 | Backup, Recovery & Business Continuity | PENDING |
| 8 | Documentation & Operations | PENDING |
| 9 | Pre-Launch Validation | PENDING |

---

*Report generated: 2026-02-07*
*Auditor: Claude Opus 4.6 (4 parallel security agents)*
*Project: CSCX.AI V7*
