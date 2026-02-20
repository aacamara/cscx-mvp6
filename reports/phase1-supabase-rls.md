# CSCX.AI Security Audit - Phase 1: Supabase Security, RLS Policies & Database Security

**Auditor:** Claude Opus 4.6 (Automated Security Audit)
**Date:** 2026-02-07
**Scope:** Supabase RLS, Client Configuration, Database Schema, Auth, Realtime, Google Token Storage
**Project:** CSCX.AI v3 at `/Users/azizcamara/CSCX V7`

---

## Executive Summary

This audit reveals **multiple CRITICAL and HIGH severity vulnerabilities** in the CSCX.AI Supabase configuration. The most dangerous findings are:

1. **Production secrets committed to Git** (`.env.production` with real Supabase anon key is tracked in Git)
2. **Plaintext API keys and tokens in `.env` files** (Anthropic, Google, Supabase service_role key all plaintext)
3. **409 instances of trusting client-supplied `x-user-id` header** across 70 route files, enabling impersonation
4. **~100+ database tables without RLS policies**, including tables storing sensitive data
5. **`GRANT ALL` to the `anon` role** on all tables in the initial schema, completely defeating RLS
6. **Google OAuth tokens stored in plaintext** in the database (comment says "encrypted at application level" but no encryption is implemented)

**Overall Risk Rating: CRITICAL -- Immediate action required before any production deployment.**

---

## 1. RLS (Row Level Security) Policies

### 1.1 Tables WITH RLS Enabled

```
[RLS COVERAGE - TABLES WITH RLS]
Status: PARTIAL -- approximately 60% of core tables
Evidence: database/migrations/001_initial_schema.sql:294-307, 020_enable_rls.sql, 002_google_workspace.sql:488-540
```

**Tables with RLS enabled and policies defined (from `001_initial_schema.sql`):**
- `user_profiles` -- Has SELECT/UPDATE for own profile + service_role full access
- `customers` -- Has service_role full access + CSM policies (in 020_enable_rls.sql)
- `stakeholders` -- Has service_role full access ONLY (no user-level policies)
- `contracts` -- Has service_role full access + CSM policies (in 020_enable_rls.sql)
- `entitlements` -- Has service_role full access ONLY (no user-level policies)
- `agent_runs` -- Has service_role full access ONLY (no user-level policies)
- `agent_steps` -- Has service_role full access ONLY (no user-level policies)
- `agent_sessions` -- Has service_role full access + user policies (in 020_enable_rls.sql)
- `agent_messages` -- Has service_role full access ONLY (no user-level policies)
- `approvals` -- Has service_role full access ONLY (no user-level policies)
- `feature_flags` -- Has service_role full access ONLY (no user-level policies)
- `meetings` -- Has service_role full access ONLY (no user-level policies)
- `tasks` -- Has service_role full access + CSM policies (in 020_enable_rls.sql)
- `insights` -- Has service_role full access ONLY (no user-level policies)

**Tables with RLS from `002_google_workspace.sql`:**
- `users` -- SELECT/UPDATE own profile
- `google_oauth_tokens` -- ALL for own tokens
- `gmail_threads`, `gmail_messages` -- ALL for own data
- `calendar_events`, `drive_files`, `google_tasks` -- ALL for own data
- `knowledge_documents`, `knowledge_chunks` -- Layer-based access
- `email_templates` -- Own + shared templates
- `agent_executions`, `approval_queue`, `feedback_events` -- Own data
- `csm_playbooks` -- READ for all authenticated users

### 1.2 Tables WITHOUT RLS (CRITICAL)

```
[TABLES WITHOUT RLS]
Status: FAIL
Severity: CRITICAL
Evidence: Multiple migration files across database/migrations/
```

The following tables were created **without any RLS enabled** (representative sample from ~100+ total):

| Table | Migration File | Data Sensitivity |
|-------|---------------|-----------------|
| `usage_events` | 015_usage_events_table.sql:74 (commented out) | Customer product usage |
| `usage_metrics` | 015_usage_events_table.sql:75 (commented out) | Aggregated metrics |
| `health_score_history` | 015_usage_events_table.sql:76 (commented out) | Health trends |
| `usage_api_keys` | 015_usage_events_table.sql | **API keys** |
| `notifications` | 016_notifications_table.sql | User notifications |
| `integration_connections` | 017_integrations_table.sql | **OAuth credentials** |
| `sync_logs` | 017_integrations_table.sql | Sync data |
| `plan_tasks` | 018_plan_tasks_and_contracts_update.sql | Customer plans |
| `chat_messages` | 012_chat_messages_table.sql | Chat content |
| `customer_documents` | 013_customer_documents.sql | **Customer files** |
| `timeline_events` | 025_customer_journey_timeline.sql:312 (commented out) | Journey data |
| `product_incidents` | 025_product_incidents.sql | Incident data |
| `risk_assessments` | 031_risk_assessment_tables.sql | **Risk data** |
| `agent_audit_logs` | 20260126_agent_audit_logs.sql | **Audit trail** |
| `salesforce_sync_log` | 023_salesforce_sync_log.sql | CRM sync data |
| `email_sequences` | 023_email_sequences.sql | Email campaigns |
| `renewal_pipeline` | 027_renewal_pipeline_forecast.sql | Revenue data |
| `meeting_prep_briefs` | 027_meeting_prep_briefs.sql | Meeting intel |
| `contract_amendments` | 042_contract_amendments.sql | **Contract data** |
| `jira_*` tables | 045_jira_integration.sql | Issue tracking |
| `competitors` | server/supabase/migrations/20260129000001 | **Competitive intel** |
| `battle_cards` | server/supabase/migrations/20260129000001 | **Sales intel** |

**Estimated 100+ tables created across all migration files, with fewer than 50 having RLS enabled.**

### 1.3 RLS Policies with Only Service Role Access

```
[SERVICE-ROLE-ONLY RLS POLICIES]
Status: FAIL
Severity: HIGH
Evidence: database/migrations/001_initial_schema.sql:312-325
Details: 10 core tables have RLS enabled but ONLY have service_role bypass policies.
         They have NO anon-level or authenticated-user-level policies, meaning
         authenticated users get BLOCKED from all access (RLS denies by default).
         This forces the backend to use service_role key for ALL operations.
```

Tables with RLS but ONLY service_role policies (no user-level policies):
- `stakeholders`
- `entitlements`
- `agent_runs`
- `agent_steps`
- `agent_messages`
- `approvals`
- `feature_flags`
- `meetings`
- `insights`

### 1.4 SECURITY DEFINER Functions

```
[SECURITY DEFINER FUNCTIONS]
Status: FAIL
Severity: MEDIUM
Evidence: server/supabase/migrations/20260201_emails_table.sql:114
Details: search_emails() function uses SECURITY DEFINER, which executes with the
         permissions of the function owner (typically superuser/postgres), bypassing RLS.
         The function filters by p_user_id but this parameter is application-supplied.
```

---

## 2. Supabase Client Configuration

### 2.1 Frontend Client (Correct: Uses Anon Key)

```
[FRONTEND SUPABASE CLIENT]
Status: PASS
Evidence: lib/supabase.ts:8-9, 15-22
Details: Frontend correctly uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
         from import.meta.env. Auth config includes autoRefreshToken, persistSession,
         and detectSessionInUrl.
```

### 2.2 Backend Client (Correct: Uses Service Role Key)

```
[BACKEND SUPABASE CLIENT]
Status: PASS
Evidence: server/src/services/supabase.ts:9-13, server/src/config/index.ts:18-19
Details: Backend correctly uses service_role key from server-side environment variables.
```

### 2.3 CRITICAL: Production Secrets Committed to Git

```
[SECRETS IN VERSION CONTROL]
Status: FAIL
Severity: CRITICAL
Evidence: .env.production (tracked in git, commit b24a8fd)
Details: .env.production is tracked in Git and contains REAL Supabase anon key.
         server/.env on disk contains Anthropic key, service_role key, DB password,
         Google OAuth credentials.
```

**Files with secrets tracked in Git:**
- `.env.production` -- Contains real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

**Files with secrets NOT tracked (correct):**
- `.env.local` -- Listed in `.gitignore` as `*.local`
- `server/.env` -- Listed in `.gitignore`

**`server/.env` contains on disk:**
- Anthropic API key: `sk-ant-api03-Qzo_qeh...` (REAL KEY)
- Supabase service_role key (REAL KEY -- full DB admin access)
- Supabase DB password
- Google Client ID and Client Secret (REAL)
- Gemini API key (REAL)

### 2.4 GRANT ALL to Anon Role

```
[EXCESSIVE ANON PERMISSIONS]
Status: FAIL
Severity: CRITICAL
Evidence: database/migrations/001_initial_schema.sql:383-386
Details: GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
         Anyone with the Supabase URL and anon key can CRUD ALL tables without RLS.
```

Repeated in: `028_thank_you_notes.sql`, `067_prd0_contract_parsing.sql`,
`026_check_in_email_silence.sql`, `PRD-264-voice-settings.sql`

---

## 3. Database Schema Security

### 3.1 Tables Without Proper Constraints

```
[MISSING CONSTRAINTS]
Status: FAIL
Severity: MEDIUM
Evidence: database/schema.sql vs database/migrations/001_initial_schema.sql
Details: Two versions of schema with different constraint levels. Missing CHECK,
         NOT NULL, and FK constraints on many tables.
```

### 3.2 Tables Without created_at/updated_at

```
[MISSING TIMESTAMPS]
Status: FAIL
Severity: LOW
Details: agent_steps, agent_messages, entitlements, insights, agent_audit_logs lack updated_at.
```

### 3.3 Missing Foreign Key Constraints

```
[MISSING FOREIGN KEYS]
Status: FAIL
Severity: MEDIUM
Details: agent_audit_logs.user_id is VARCHAR(255) not UUID, no FK.
         emails.user_id, email_sync_status.user_id have no FK.
```

### 3.4 Sensitive Data Without Protection

```
[SENSITIVE DATA EXPOSURE]
Status: FAIL
Severity: CRITICAL
```

| Table | Sensitive Data | RLS | Encrypted | Protection |
|-------|---------------|-----|-----------|------------|
| `google_oauth_tokens` | access_token, refresh_token | YES | NO | INSUFFICIENT |
| `usage_api_keys` | api_key | NO | NO | NONE |
| `integration_connections` | credentials (JSONB) | NO | NO | NONE |
| `microsoft_oauth_tokens` | access_token, refresh_token | YES | NO | MINIMAL |
| `activity_log` | ip_address, user_agent | NO | NO | NONE |
| `agent_audit_logs` | ip_address, user_agent, input/output | NO | NO | NONE |

---

## 4. Supabase Auth Configuration

### 4.1 Auth Implementation Status

```
[AUTH IMPLEMENTATION]
Status: FAIL
Severity: HIGH
Details: JWT middleware exists but 70 route files bypass it using x-user-id header.
```

### 4.2 Auth Middleware on Backend Routes

```
[AUTH MIDDLEWARE USAGE]
Status: FAIL
Severity: CRITICAL
Evidence: 409 occurrences of req.headers['x-user-id'] across 70 route files
Details: Complete user impersonation possible via header manipulation.
```

**Route files trusting `x-user-id` header (sample):**
- `alerts.ts` (8) -- Falls back to `'default-user'`
- `peer-review.ts` (16)
- `cadg.ts` (28)
- `quick-actions.ts` (14)
- `outreach.ts` (21)
- `gong.ts` (15)
- `mobile.ts` (19)
- And 63+ more files...

**Only ~6 routes use proper auth middleware:**
- `contracts.ts`, `entitlements.ts`, `contract-amendment-alerts.ts` (optionalAuthMiddleware)
- `renewal-proposals.ts` (authMiddleware)
- `agentic-mode.ts` (custom requireAuth)
- `admin.ts` (requireAdmin -- bypassed in dev)

### 4.3 Session Handling

```
[SESSION HANDLING]
Status: PASS (with caveats)
Details: Supabase handles sessions properly. Demo user fallback concerning.
```

### 4.4 Auth Bypass Possibilities

```
[AUTH BYPASS]
Status: FAIL
Severity: CRITICAL
```

**5 bypass vectors identified:**
1. Development mode fallback (`auth.ts:81-84`)
2. Admin skip in development (`admin.ts:25-27`)
3. Admin skip when Supabase unconfigured (`admin.ts:41-43`)
4. requireRole skip in non-production (`auth.ts:153`)
5. Direct x-user-id header manipulation (409 occurrences, 70 files)

### 4.5 Admin Role Detection (Client-Side Only)

```
[ADMIN ROLE DETECTION]
Status: FAIL
Severity: HIGH
Evidence: context/AuthContext.tsx:14-15
Details: ADMIN_EMAILS = ['azizcamara2@gmail.com'] hardcoded on frontend.
         RLS admin policies check JWT user_metadata.role but this claim is never set.
```

---

## 5. Supabase Realtime Security

```
[REALTIME SUBSCRIPTIONS]
Status: N/A
Details: No Supabase Realtime used. App uses SSE via Express backend.
```

---

## 6. Google Token Storage Security

### 6.1 Token Storage

```
[GOOGLE TOKEN STORAGE]
Status: FAIL
Severity: CRITICAL
Evidence: 002_google_workspace.sql:36-62, oauth.ts:190-206
Details: Tokens stored plaintext despite comment claiming application-level encryption.
         No pgcrypto or application encryption found anywhere.
```

### 6.2 Token Refresh Handling

```
[TOKEN REFRESH]
Status: PASS
Evidence: oauth.ts:161-178, 246-275
Details: Properly implemented with 5-minute buffer and error handling.
```

### 6.3 Expired Token Cleanup

```
[TOKEN CLEANUP]
Status: FAIL
Severity: LOW
Details: No automated cleanup of expired/invalid tokens.
```

### 6.4 Token RLS Policy

```
[TOKEN RLS]
Status: PASS
Evidence: 002_google_workspace.sql:506
Details: RLS policy using auth.uid() = user_id exists.
```

---

## Summary of Findings

### CRITICAL (Requires Immediate Action)

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| C1 | `GRANT ALL` to `anon` on all tables | `001_initial_schema.sql:384` | Unauthenticated users can CRUD all data |
| C2 | 100+ tables without RLS | Multiple migration files | All data world-readable |
| C3 | 409 instances of trusting `x-user-id` header | 70 route files | Complete user impersonation |
| C4 | Google OAuth tokens stored plaintext | `002_google_workspace.sql`, `oauth.ts` | Token theft = full Google access |
| C5 | Real API keys in `.env.production` tracked in git | `.env.production` | Key exposure via git history |
| C6 | Supabase service_role key on disk | `server/.env:23` | Full database admin access |

### HIGH (Should Be Fixed Before Production)

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| H1 | 10 core tables have RLS but only service_role policies | `001_initial_schema.sql:312-325` | No user-level access control |
| H2 | Auth bypasses in development mode | `admin.ts:25`, `auth.ts:81,153` | Privilege escalation |
| H3 | Admin detection is client-side hardcoded email | `AuthContext.tsx:15` | No server-side enforcement |
| H4 | Demo user fallback in auth context | `AuthContext.tsx:195`, `auth.ts:82` | Unauthed requests get demo access |
| H5 | `usage_api_keys` table has no RLS | `015_usage_events_table.sql` | API keys readable by anyone |

### MEDIUM

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| M1 | `SECURITY DEFINER` on `search_emails()` | `20260201_emails_table.sql:114` | RLS bypass for email search |
| M2 | Missing foreign keys on user_id columns | Multiple | Orphaned data, no cascade |
| M3 | Inconsistent schema versions | `schema.sql` vs `001_initial_schema.sql` | Confusion |
| M4 | Agent audit logs have no RLS | `20260126_agent_audit_logs.sql` | Audit trail exposed |
| M5 | `integration_connections` has no RLS | `017_integrations_table.sql` | OAuth creds exposed |

### LOW

| # | Finding | File(s) | Impact |
|---|---------|---------|--------|
| L1 | Missing `updated_at` on several tables | Multiple | No change tracking |
| L2 | No expired token cleanup | `oauth.ts` | Database bloat |
| L3 | CORS set to `*` in server config | `config/index.ts:11` | Cross-origin requests |
| L4 | Commented-out RLS on journey/usage tables | `015, 025, 045` migrations | Deferred security |

---

## Recommended Remediation Priority

### Phase 1 (Immediate -- This Week)
1. **Revoke and rotate ALL exposed secrets** (Anthropic key, Supabase service_role key, Google OAuth credentials)
2. **Remove `.env.production` from git tracking** and add to `.gitignore`
3. **Add auth middleware to ALL route files** -- Replace `req.headers['x-user-id']` with `req.userId` from JWT-verified middleware
4. **Revoke `GRANT ALL` from `anon` role** -- Only `authenticated` and `service_role` should have table access

### Phase 2 (This Sprint)
5. **Enable RLS on ALL remaining tables** -- Start with tables containing sensitive data
6. **Add user-level RLS policies** to the 10 core tables that only have service_role policies
7. **Encrypt Google OAuth tokens** at rest using `pgcrypto` or application-level encryption
8. **Remove development auth bypasses** or gate behind explicit env var
9. **Implement server-side admin role verification**

### Phase 3 (Next Sprint)
10. **Change `SECURITY DEFINER` to `SECURITY INVOKER`** on `search_emails()`
11. **Add missing foreign key constraints** on user_id columns
12. **Add missing `updated_at` columns** and triggers
13. **Implement token cleanup job** for expired Google OAuth tokens
14. **Audit and restrict CORS** to specific allowed origins
