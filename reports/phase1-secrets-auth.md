# CSCX.AI Security Audit -- Phase 1: Secrets, Authentication & Authorization

**Audit Date:** 2026-02-07
**Auditor:** Claude Opus 4.6 (Automated Security Scan)
**Scope:** Hardcoded secrets, authentication enforcement, authorization policies, token security
**Project Path:** `/Users/azizcamara/CSCX V7`

---

## Executive Summary

This audit uncovered **8 CRITICAL**, **11 HIGH**, **4 MEDIUM**, and **2 LOW** severity findings across the CSCX.AI codebase. The three most dangerous systemic issues are:

1. **Plaintext production secrets in env files** -- Anthropic API key, Gemini API key, Supabase service role key, Google OAuth client secret, and database password are all stored in plaintext in `server/.env` and `.env.local`. The `.env.production` file (containing the Supabase anon key) is NOT in `.gitignore` and is likely committed to the repository.

2. **Authentication middleware is applied to only 1 of 100+ route files** -- The well-written `authMiddleware` at `server/src/middleware/auth.ts` is only imported and used in `renewal-proposals.ts`. Every other route file either reads the spoofable `x-user-id` HTTP header directly or falls back to a hardcoded default user string.

3. **HITL approval system is completely bypassable** -- The human-in-the-loop approval flow (marked "DO NOT REMOVE - Required for customer safety" in ARCHITECTURE.md) uses the `x-user-id` header for identity at `server/src/routes/approvals.ts`. Any HTTP client can approve, reject, or modify email sends, meeting bookings, and task creations by spoofing this header.

---

## 1. Hardcoded Secrets Scan

### 1.1 Anthropic API Key in server/.env
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** `server/.env:13` -- `ANTHROPIC_API_KEY=sk-ant-api03-[REDACTED]`
- **Details:** Live Anthropic API key hardcoded in plaintext. Grants full API access and billing charges.

### 1.2 Gemini API Key in Multiple Files
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** `server/.env:16` and `.env.local:1` -- `GEMINI_API_KEY=AIza[REDACTED]`
- **Details:** Same Google API key in two files. `.env.local` is a frontend environment file.

### 1.3 Supabase Service Role Key in server/.env
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** `server/.env:23` -- `SUPABASE_SERVICE_KEY=eyJ[REDACTED]` (JWT with `role: service_role`)
- **Details:** This key BYPASSES all Row Level Security. Anyone with it has full unrestricted database access. This is the most dangerous secret in the project.

### 1.4 Google OAuth Client Secret in server/.env
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** `server/.env:35` -- `GOOGLE_CLIENT_SECRET=GOCSPX-[REDACTED]`
- **Details:** OAuth client secret allows impersonation of the application in OAuth flows.

### 1.5 Supabase Database Password in server/.env
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** `server/.env:48` -- `SUPABASE_DB_PASSWORD=[REDACTED]`
- **Details:** Combined with the known Supabase project reference, allows direct PostgreSQL connections.

### 1.6 .env.production NOT in .gitignore
- **Status:** FAIL 🔴 | **Severity:** HIGH
- **Evidence:** `.gitignore` covers `.env`, `.env.local`, `.env.*.local`, `server/.env` -- but NOT `.env.production`. The file `.env.production` contains the Supabase anon key and URL.
- **Details:** `.env.production` is likely committed to the git repository.

### 1.7 .gitignore Coverage
- **Status:** PARTIAL ⚠️ | **Severity:** HIGH
- **Evidence:** `.gitignore:16-19`
- **Details:** `.env`, `.env.local`, `.env.*.local`, `server/.env` are covered. `.env.production` is a gap.

### 1.8 Anon Key in Compiled JS Bundle
- **Status:** FAIL 🔴 | **Severity:** MEDIUM
- **Evidence:** `server/public/assets/index-B05fIkGs.js:275` contains the Supabase anon key.
- **Details:** Expected for client-side Supabase usage but confirms the key is publicly accessible. Verified that the service role key does NOT appear in frontend code.

### 1.9 Service Role Key NOT Sent to Frontend
- **Status:** PASS ✅ | **Severity:** N/A
- **Evidence:** Searched `src/`, `components/`, `lib/` for `service_role`, `serviceKey`, `SERVICE_KEY` -- no matches. `lib/supabase.ts:9` uses `VITE_SUPABASE_ANON_KEY` only.

### 1.10 Git History Check
- **Status:** UNABLE TO VERIFY ❓ | **Severity:** HIGH (if secrets were committed)
- **Details:** Sandbox restrictions prevented running `git log`. Must be checked manually.

---

## 2. Authentication Audit

### 2.1 Auth Middleware Applied to 1 of 100+ Route Files
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** `authMiddleware` is defined at `server/src/middleware/auth.ts:31` but is only imported and used in `server/src/routes/renewal-proposals.ts`. No global auth middleware is applied in `server/src/index.ts`.
- **Details:** 100+ route files mount directly on the Express app without any authentication layer.

### 2.2 x-user-id Header as Spoofable Identity
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** 50+ instances across route files. Examples:
  - `server/src/routes/approvals.ts:21` -- `req.headers['x-user-id']`
  - `server/src/routes/google/auth.ts:33` -- `req.headers['x-user-id']`
  - `server/src/routes/alerts.ts:24` -- `req.headers['x-user-id'] || 'default-user'`
- **Details:** Any HTTP client can set this header to any UUID, enabling complete user impersonation.

### 2.3 Default User Fallbacks in Routes
- **Status:** FAIL 🔴 | **Severity:** HIGH
- **Evidence:**
  - `routes/alerts.ts:24` -- `|| 'default-user'`
  - `routes/search.ts:54` -- `|| 'demo-user'`
  - `routes/mobile-meeting-notes.ts:35` -- `|| 'user_default'`
  - `routes/best-practices.ts:24` -- `|| 'demo-user'`
  - `routes/activity-feed.ts:25` -- `|| 'default-user'`
  - `routes/mobile-document-scanning.ts:22` -- `|| 'default-user'`
- **Details:** Unauthenticated requests processed silently as a default user instead of being rejected.

### 2.4 Auth Middleware Development Bypass
- **Status:** PASS ✅ (with caveat) | **Severity:** MEDIUM
- **Evidence:** `server/src/middleware/auth.ts:81-84` -- `if (config.nodeEnv === 'development')` falls back to demo user UUID.
- **Details:** Correctly gated behind NODE_ENV. Only relevant for the one route that uses it.

### 2.5 Role Check Skipped in Non-Production
- **Status:** FAIL 🔴 | **Severity:** MEDIUM
- **Evidence:** `server/src/middleware/auth.ts:152-156` -- `if (config.nodeEnv !== 'production') { next(); return; }`
- **Details:** Role verification bypassed in staging or any env not explicitly set to "production".

### 2.6 Admin Endpoint Double Bypass
- **Status:** FAIL 🔴 | **Severity:** HIGH
- **Evidence:** `server/src/routes/admin.ts:25-27` (dev bypass) and `admin.ts:41-43` (no-Supabase bypass)
- **Details:** Admin access granted when either development mode is on OR Supabase is unavailable.

### 2.7 JWT Configuration
- **Status:** PASS ✅ | **Severity:** N/A
- **Evidence:** `server/src/middleware/auth.ts:46` -- `supabase.auth.getUser(token)`
- **Details:** When actually used, JWT validation properly delegates to Supabase Auth.

### 2.8 Provision-Admin Endpoint -- No Auth
- **Status:** FAIL 🔴 | **Severity:** HIGH
- **Evidence:** `server/src/routes/auth.ts:263` -- `router.post('/provision-admin', ...)` with no middleware. Accepts userId from body without JWT verification. Hardcoded admin check: `ADMIN_EMAILS = ['azizcamara2@gmail.com']` at line 257.
- **Details:** An attacker who knows the admin email can call this endpoint with any userId to grant admin role.

### 2.9 Claim/Redeem-Invite Accept Unverified userId
- **Status:** FAIL 🔴 | **Severity:** MEDIUM
- **Evidence:** `server/src/routes/auth.ts:164` (claim-invite) and `:366` (redeem-invite)
- **Details:** Both accept userId from request body without JWT verification. No rate limit on claim-invite.

---

## 3. Authorization Audit

### 3.1 RLS Commented Out in schema.sql
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** `database/schema.sql:326-333` -- All `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements are commented out with the note "Optional".

### 3.2 RLS in Migration 001 -- Service Role Only
- **Status:** PARTIAL ⚠️ | **Severity:** HIGH
- **Evidence:** `database/migrations/001_initial_schema.sql:294-313` -- RLS enabled on 14 tables, but only `service_role` policies created.
- **Details:** Conflicts with schema.sql. No user-scoped policies exist. Backend uses service role key (bypasses all RLS).

### 3.3 No User-Scoped RLS Policies
- **Status:** FAIL 🔴 | **Severity:** HIGH
- **Evidence:** All policies in migrations use `auth.role() = 'service_role'`. No policies filter by `auth.uid()` for authenticated users on core tables.
- **Details:** Multi-tenancy target noted in ARCHITECTURE.md as "RLS isolation" but not implemented.

### 3.4 Frontend Uses Anon Key
- **Status:** PASS ✅ | **Severity:** N/A
- **Evidence:** `lib/supabase.ts:9` -- `import.meta.env.VITE_SUPABASE_ANON_KEY`

### 3.5 HITL Approvals Rely on Spoofable Header
- **Status:** FAIL 🔴 | **Severity:** CRITICAL
- **Evidence:** `server/src/routes/approvals.ts` -- All 9 occurrences of `req.headers['x-user-id']` (lines 21, 51, 94, 122, 158, 221, 264, 307, 357)
- **Details:** Approvals can be created, viewed, approved, rejected, and modified by anyone who sets the x-user-id header. This defeats the human-in-the-loop safety mechanism for email sends, meeting bookings, and task creation.

### 3.6 Google OAuth Routes -- Spoofable Header
- **Status:** FAIL 🔴 | **Severity:** HIGH
- **Evidence:** `server/src/routes/google/auth.ts:33,127,151,176` -- Uses `req.headers['x-user-id']`
- **Details:** Enables disconnect/refresh/sync-token operations for any user's Google account.

### 3.7 Webhook Endpoints -- No Auth
- **Status:** FAIL 🔴 | **Severity:** MEDIUM
- **Evidence:** `server/src/routes/webhooks/zapier.ts:28` -- Accepts userId from body.
- **Details:** No authentication or webhook signature verification.

---

## 4. Password & Token Security

### 4.1 No Local Password Auth
- **Status:** PASS ✅ | **Severity:** N/A
- **Evidence:** `context/AuthContext.tsx` -- Google OAuth via Supabase only.

### 4.2 Google OAuth Tokens -- Plaintext Storage
- **Status:** FAIL 🔴 | **Severity:** HIGH
- **Evidence:** `server/src/services/google/oauth.ts:192-199` -- `access_token` and `refresh_token` stored as plaintext in `google_oauth_tokens` table. ARCHITECTURE.md line 328 claims "encrypted" but no encryption code exists.
- **Details:** Database breach exposes all user Google tokens (Gmail, Calendar, Drive access).

### 4.3 WebSocket Authentication -- Completely Fake
- **Status:** FAIL 🔴 | **Severity:** HIGH
- **Evidence:**
  - `context/WebSocketContext.tsx:55` -- sends `token: 'demo-token'`
  - `server/src/services/websocket.ts:91-107` -- `handleAuth()` accepts ANY truthy string, assigns `user_${Date.now()}`
- **Details:** Comment says "In production, validate token with Supabase" but this was never implemented.

### 4.4 Invite Code Hashing
- **Status:** PASS ✅ | **Severity:** N/A
- **Evidence:** `server/src/routes/auth.ts:60-62` -- SHA-256 hashing.

### 4.5 Session Management
- **Status:** PASS ✅ (with caveat) | **Severity:** LOW
- **Evidence:** `lib/supabase.ts:17-21` -- Supabase Auth with `persistSession: true` (localStorage).
- **Details:** localStorage is vulnerable to XSS. Consider httpOnly cookies.

### 4.6 CORS Defaults to Wildcard
- **Status:** FAIL 🔴 | **Severity:** MEDIUM
- **Evidence:** `server/src/config/index.ts:11` -- `corsOrigin: process.env.CORS_ORIGIN || '*'` and `server/.env:6` -- `CORS_ORIGIN=*`
- **Details:** With `credentials: true`, this is a CSRF vulnerability.

### 4.7 Hardcoded Demo User UUID
- **Status:** FAIL 🔴 | **Severity:** LOW
- **Evidence:** `df2dc7be-ece0-40b2-a9d7-0f6c45b75131` in 3+ files.

---

## 5. Summary Table

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1.1 | Anthropic API key in plaintext | CRITICAL | Secrets |
| 1.2 | Gemini API key in multiple files | CRITICAL | Secrets |
| 1.3 | Supabase service role key in plaintext | CRITICAL | Secrets |
| 1.4 | Google OAuth client secret in plaintext | CRITICAL | Secrets |
| 1.5 | Database password in plaintext | CRITICAL | Secrets |
| 2.1 | Auth middleware on 1 of 100+ route files | CRITICAL | Authentication |
| 2.2 | x-user-id header as spoofable identity | CRITICAL | Authentication |
| 3.5 | HITL approvals on spoofable header | CRITICAL | Authorization |
| 1.6 | .env.production not in .gitignore | HIGH | Secrets |
| 1.7 | .gitignore gap for .env.production | HIGH | Secrets |
| 1.10 | Possible secrets in git history | HIGH | Secrets |
| 2.3 | Default user fallbacks in routes | HIGH | Authentication |
| 2.6 | Admin bypasses (dev + no-Supabase) | HIGH | Authentication |
| 2.8 | provision-admin has no auth | HIGH | Authentication |
| 3.1 | RLS commented out in schema.sql | CRITICAL (from 3.1) | Authorization |
| 3.2 | RLS only for service_role | HIGH | Authorization |
| 3.3 | No user-scoped RLS policies | HIGH | Authorization |
| 3.6 | Google OAuth routes spoofable | HIGH | Authorization |
| 4.2 | Google tokens stored plaintext | HIGH | Token Security |
| 4.3 | WebSocket auth is fake | HIGH | Authentication |
| 2.5 | Role checks skipped non-production | MEDIUM | Authentication |
| 2.9 | claim/redeem-invite no JWT | MEDIUM | Authentication |
| 3.7 | Webhooks have no auth | MEDIUM | Authorization |
| 4.6 | CORS wildcard + credentials | MEDIUM | Token Security |
| 1.8 | Anon key in JS bundle | MEDIUM | Secrets |
| 4.5 | Sessions in localStorage | LOW | Token Security |
| 4.7 | Hardcoded demo user UUID | LOW | Authentication |

---

## 6. Priority Remediation

**Immediate (today):**
- Rotate ALL secrets in findings 1.1-1.5
- Add `.env.production` to `.gitignore`
- Check git history for committed secrets (`git log --all --diff-filter=A -- '*.env*'`)

**This week:**
- Apply `authMiddleware` globally in `server/src/index.ts`
- Remove all `x-user-id` header usage
- Remove default user fallbacks
- Fix WebSocket auth
- Add JWT verification to provision-admin, claim-invite, redeem-invite endpoints

**This sprint:**
- Encrypt Google tokens at rest
- Create user-scoped RLS policies
- Lock down CORS in production
- Add webhook signature verification
