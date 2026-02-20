# CSCX.AI Security Audit - Phase 1: Input Validation, Injection Prevention & XSS

**Audit Date:** 2026-02-07
**Scope:** `/Users/azizcamara/CSCX V7/server/src/routes/` (171 route files), frontend components, middleware
**Project:** CSCX.AI v3 - Customer Success Platform

---

## Executive Summary

The CSCX.AI codebase has a **partial** security posture. A Zod-based validation middleware exists but is applied to only **3 out of ~162 route files** (the agentic-mode and agentic-agents routes). The vast majority of API endpoints (~97%) accept user input with minimal or no schema validation. The project uses Supabase's parameterized query builder which mitigates most SQL injection risks, but **25+ instances of unsanitized user input interpolated into Supabase `.or()` filter strings create PostgREST filter injection vectors**. CSRF protection is entirely absent. XSS surface area is limited due to React's default escaping, but two `dangerouslySetInnerHTML` usages and a weak CSP in production merit attention.

**Overall Risk Rating: HIGH**

---

## 1. INPUT VALIDATION

### 1.1 Validation Library Existence

```
[VALIDATION FRAMEWORK]
Status: PARTIAL (exists but rarely used)
Evidence: /server/src/middleware/validation.ts
Details: A well-structured Zod-based validation middleware exists with:
  - sanitizeString() / sanitizeObject() for XSS pattern stripping
  - validateBody(), validateParams(), validateQuery() middleware factories
  - Pre-built schemas for agentic endpoints (execute, plan, resume, specialist, etc.)
  - UUID validation, pattern matching, length limits
  However, validators are only imported in 3 route files:
    - /server/src/routes/agentic-mode.ts
    - /server/src/routes/agentic-agents.ts
    - /server/src/routes/entitlements.ts (uses its own Zod schema, not the middleware)
    - /server/src/routes/auth.ts (uses its own Zod schema inline)
  The remaining ~158 route files have NO Zod validation middleware applied.
Severity: HIGH
```

### 1.2 Missing Input Validation on Request Body

```
[REQUEST BODY VALIDATION - GENERAL ROUTES]
Status: FAIL 🔴
Evidence: 233+ occurrences of req.body across 50+ route files
Details: The vast majority of POST/PUT/PATCH endpoints destructure req.body
  directly without schema validation. Key examples:

  /server/src/routes/auth.ts:164-166 (claim-invite)
    const { inviteId, userId } = req.body;
    Only checks presence, no type/format validation on inviteId or userId.

  /server/src/routes/auth.ts:263-265 (provision-admin)
    const { userId, email, workspaceId } = req.body;
    No Zod schema, no email format validation, no UUID validation.

  /server/src/routes/customers.ts:926-937 (POST /customers)
    const { name, industry, arr, status, ... } = req.body;
    Only validates name presence. No type checking on arr, no enum on status.

  /server/src/routes/customers.ts:1001-1004 (PATCH /customers/:id)
    const updates = req.body;
    ENTIRE body passed directly to Supabase update with spread operator.
    No field whitelisting, no type validation. Attacker can set any column.

  /server/src/routes/escalations.ts:34-41
    const request: CreateEscalationRequest = req.body;
    TypeScript type assertion only (compile-time), no runtime validation.

  /server/src/routes/upload.ts:488-499 (POST /bulk-draft/:fileId/edit)
    const { emailId, subject, bodyHtml, bodyText } = req.body;
    HTML content (bodyHtml) accepted without sanitization.

  Pattern repeated across: langchain.ts, featureFlags.ts, template-library.ts,
  team-analytics.ts, expansion.ts, alerts.ts, and ~50 more files.
Severity: HIGH
```

### 1.3 Missing Query Parameter Validation

```
[QUERY PARAMETER VALIDATION]
Status: FAIL 🔴
Evidence: 179+ occurrences of req.query across 50+ route files
Details: Query parameters cast with `as string`, parseInt() with no NaN/bounds checking.

  /server/src/routes/customers.ts:635-648
    const { search, status, minArr, maxArr, healthBelow, ... } = req.query;
    All cast with `as string`, no validation.

  /server/src/routes/admin.ts:247,263
    const { limit = '50', offset = '0' } = req.query;
    Directly used in Supabase .range() with no max limit enforcement.
Severity: MEDIUM
```

### 1.4 Missing Path Parameter Validation

```
[PATH PARAMETER VALIDATION]
Status: FAIL 🔴
Evidence: 297+ occurrences of req.params across 50+ route files
Details: Path parameters (:id, :customerId, :fileId) used directly
  without UUID format validation. Only agentic-agents.ts validates path params.

  /server/src/routes/glossary.ts:65
    .or(`term.eq.${req.params.term},abbreviation.eq.${req.params.term}`)
    Path parameter directly interpolated into filter string (injection risk).
Severity: MEDIUM
```

### 1.5 File Upload Validation

```
[FILE UPLOAD - TYPE/SIZE VALIDATION]
Status: PASS ✅
Evidence:
  /server/src/routes/upload.ts:25-40 (CSV: 10MB, MIME check)
  /server/src/routes/contracts.ts:112-132 (PDF/DOCX/TXT: 10MB, MIME check)
  /server/src/routes/training.ts:25-46 (CSV/XLSX: 10MB, MIME check)
  /server/src/routes/events.ts:24-29 (CSV/XLSX: 10MB, MIME check)
Details: All use multer with file size limits and MIME type filtering.
  contracts.ts also sanitizes filenames. No magic-byte validation or
  virus scanning.
Severity: LOW
```

### 1.6 Content-Type Validation

```
[CONTENT-TYPE VALIDATION]
Status: PASS ✅
Evidence: /server/src/index.ts:223
  app.use(express.json({ limit: '10mb' }));
Details: Automatically rejects non-JSON for API routes, enforces 10MB limit.
Severity: LOW
```

---

## 2. SQL INJECTION PREVENTION

### 2.1 Supabase Client Usage (Parameterized Queries)

```
[PARAMETERIZED QUERIES VIA SUPABASE]
Status: PASS ✅
Evidence: All 171 route files use @supabase/supabase-js exclusively.
Details: Standard patterns (.eq(), .gte(), .in(), etc.) are parameterized
  by default. No raw pg, knex, or direct database driver usage found.
Severity: N/A (Good practice)
```

### 2.2 Raw SQL String Interpolation

```
[RAW SQL STRING CONCATENATION]
Status: FAIL 🔴 (1 instance, limited risk)
Evidence: /server/src/services/integrations/salesforce.ts:239
  const soql = `SELECT Id, ${salesforceFields.join(', ')} FROM Account WHERE IsDeleted = false`;
Details: SOQL (Salesforce query), not PostgreSQL. Field names come from
  pre-defined configuration, not directly from user input.
Severity: LOW
```

### 2.3 Supabase .raw() Usage

```
[SUPABASE .raw() CALLS]
Status: FAIL 🔴 (2 instances, low risk)
Evidence:
  /server/src/services/google/gmail.ts:1335 - .raw('usage_count + 1') (hardcoded)
  /server/src/services/integrations/segment.ts:844-845 - .raw(`${incrementField} + 1`)
    where incrementField is boolean-derived ('events_processed'|'events_failed')
Details: Both instances use controlled values, not user input.
Severity: LOW
```

### 2.4 Supabase .or() Filter String Injection

```
[POSTGREST FILTER INJECTION VIA .or()]
Status: FAIL 🔴
Severity: CRITICAL

The Supabase .or() method accepts raw PostgREST filter strings.
When unsanitized user input is interpolated, attackers can manipulate filter logic.

CRITICAL INSTANCES IN ROUTES:

1. /server/src/routes/customers.ts:669
   query = query.or(`name.ilike.%${search}%,industry.ilike.%${search}%`);
   `search` from req.query, no sanitization.

2. /server/src/routes/customers.ts:662
   query = query.or(`is_demo.eq.true,owner_id.eq.${userId}`);
   `userId` from x-user-id header (spoofable).

3. /server/src/routes/glossary.ts:24
   query = query.or(`term.ilike.%${search}%,abbreviation.ilike.%${search}%,...`);

4. /server/src/routes/glossary.ts:65
   .or(`term.eq.${req.params.term},abbreviation.eq.${req.params.term}`)
   Path parameter directly interpolated.

5. /server/src/routes/email.ts:101
   .or(`subject.ilike.%${body.query}%,body_text.ilike.%${body.query}%`)

6. /server/src/routes/resourceRequests.ts:288
   query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

7. /server/src/routes/triggers.ts:41
   query = query.or(`customer_id.eq.${customerId},customer_id.is.null`);

ADDITIONAL SERVICE-LAYER INSTANCES (reachable from routes):
  - services/universalSearch.ts:441,616
  - services/nlQuery/queryExecutor.ts:698,704
  - services/collaboration/crossFunctionalService.ts:167
  - services/accountTeam.ts:938
  - services/search/notesSearch.ts:335
  - services/skills/index.ts:238
  - services/keyDates/index.ts:321
  - services/executiveSponsor.ts:154
  - services/accountBriefing.ts:115
  - services/zoom/meetings.ts:302
  - + more

Example attack: /api/customers?search=%25,id.neq.null
  Produces: query.or('name.ilike.%%,id.neq.null%,...')
  Breaking out of intended filter to add arbitrary conditions.
```

### 2.5 Supabase RPC Calls

```
[SUPABASE RPC CALLS]
Status: PASS ✅
Evidence: 15+ .rpc() calls use parameterized object arguments.
Severity: N/A (safe pattern)
```

---

## 3. XSS PREVENTION

### 3.1 dangerouslySetInnerHTML Usage

```
[dangerouslySetInnerHTML]
Status: FAIL 🔴 (2 instances, LOW risk)
Evidence:
  /components/AgentDashboard/index.tsx:467
    {icon && <span dangerouslySetInnerHTML={{ __html: icon }} />}

  /components/AgentTraceViewer/index.tsx:448
    <span dangerouslySetInnerHTML={{ __html: STEP_ICONS[step.type] || '&#8226;' }} />

Details: Both render icon values. STEP_ICONS appears to be a hardcoded constant.
  If `icon` prop is always from hardcoded sources, risk is LOW.
Severity: LOW
```

### 3.2 innerHTML / document.write

```
[DOM MANIPULATION]
Status: PASS ✅
Evidence: No innerHTML or document.write found in /src/ frontend code.
Severity: N/A
```

### 3.3 Content Security Policy (CSP)

```
[CSP HEADERS]
Status: PARTIAL ⚠️
Evidence: /server/src/index.ts:184-195
Details:
  PRODUCTION CSP configured via helmet but weakened by:
  - 'unsafe-inline' in scriptSrc (allows inline scripts)
  - 'unsafe-eval' in scriptSrc (allows eval())
  - imgSrc allows "https:" (any HTTPS domain)

  DEVELOPMENT: CSP entirely DISABLED (contentSecurityPolicy: false)
Severity: MEDIUM
```

### 3.4 Client-Side Sanitization

```
[CLIENT-SIDE SANITIZATION]
Status: FAIL 🔴
Evidence: No DOMPurify or equivalent found in frontend dependencies.
Details: Server-side sanitizeString() exists in middleware/validation.ts
  but is only applied to agentic routes. No client-side HTML sanitization.
Severity: LOW (React auto-escapes by default)
```

---

## 4. CSRF PROTECTION

### 4.1 CSRF Token Implementation

```
[CSRF TOKENS]
Status: FAIL 🔴
Evidence: Zero matches for csrf/csurf/_csrf/csrfToken in entire codebase.
Details: No CSRF middleware installed or configured. Token-based auth
  (Bearer JWT) provides some inherent protection, but many routes accept
  unauthenticated requests via x-user-id header fallback.
Severity: MEDIUM
```

### 4.2 SameSite Cookie Attributes

```
[SAMESITE COOKIES]
Status: N/A ⚪
Evidence: No cookies set for authentication. Only 1 reference to "cookie"
  (in a support.ts error message suggesting users clear browser cookies).
Details: Application uses Bearer token auth, not cookie-based sessions.
Severity: N/A
```

### 4.3 State-Changing GET Requests

```
[STATE-CHANGING GET]
Status: PASS ✅ (1 legitimate exception)
Evidence: /server/src/routes/docusign.ts:60
  router.get('/callback', ...) -- OAuth callback (standard pattern)
Details: No inappropriate state-changing GET endpoints found.
Severity: LOW
```

---

## 5. NoSQL / POSTGREST FILTER INJECTION

### 5.1 Filter Injection via .or()

```
[POSTGREST FILTER INJECTION]
Status: FAIL 🔴
Evidence: See Section 2.4 (25+ instances)
Details: Covered comprehensively in Section 2.4.
Severity: CRITICAL
```

### 5.2 Standard Supabase Methods

```
[.eq()/.filter() WITH USER INPUT]
Status: PASS ✅
Evidence: .eq('column', value) pattern used throughout, parameterized by default.
Severity: N/A
```

### 5.3 JSONB Queries

```
[JSONB QUERIES]
Status: PASS ✅
Evidence: /server/src/routes/surveys.ts:498
  .eq('follow_up->required', true);
Details: One JSONB query found, uses hardcoded value.
Severity: N/A
```

---

## 6. AUTHENTICATION & AUTHORIZATION (Bonus Critical Findings)

### 6.1 Spoofable x-user-id Header

```
[X-USER-ID HEADER TRUST]
Status: FAIL 🔴
Evidence: 100+ routes use req.headers['x-user-id'] as primary authentication
Details: Despite middleware/auth.ts noting "x-user-id header is NOT accepted",
  the vast majority of routes bypass auth middleware entirely and trust x-user-id:
  - alerts.ts (8 occurrences with 'default-user' fallback)
  - custom-reports.ts (11 occurrences with 'user-1' fallback)
  - mobile-meeting-notes.ts, mobile-document-scanning.ts, escalations.ts, etc.
  These headers are trivially spoofable. Many routes also accept unauthenticated
  requests by falling back to default user IDs.
Severity: CRITICAL
```

### 6.2 Missing Auth Middleware on Routes

```
[ROUTE-LEVEL AUTHENTICATION]
Status: FAIL 🔴
Evidence: /server/src/index.ts:286-387
Details: Routes mounted WITHOUT authentication middleware at app level.
  Only ~5% of routes use authMiddleware or optionalAuthMiddleware per-route:
  - entitlements, contracts, renewal-proposals, contract-amendment-alerts, admin
  The remaining ~95% have no authentication middleware whatsoever.
Severity: CRITICAL
```

### 6.3 Admin Bypass in Development

```
[ADMIN AUTH BYPASS]
Status: FAIL 🔴
Evidence: /server/src/routes/admin.ts:25
  if (config.nodeEnv === 'development') { return next(); }
  /server/src/middleware/auth.ts:81-85
  Development mode grants hardcoded demo user UUID without authentication.
Severity: HIGH
```

---

## Summary Table

| # | Category | Finding | Severity |
|---|----------|---------|----------|
| 1 | Input Validation | Validation middleware exists, applied to <3% of routes | HIGH |
| 2 | Input Validation | No body schema validation on ~158 route files | HIGH |
| 3 | Input Validation | No query param validation/bounds | MEDIUM |
| 4 | Input Validation | No path param format validation | MEDIUM |
| 5 | Input Validation | File uploads have multer type/size limits | PASS |
| 6 | Input Validation | Content-type enforced via express.json() | PASS |
| 7 | SQL Injection | Supabase parameterized queries (primary pattern) | PASS |
| 8 | SQL Injection | **.or() filter injection with user input (25+ instances)** | **CRITICAL** |
| 9 | SQL Injection | SOQL concatenation (controlled input) | LOW |
| 10 | SQL Injection | .raw() usage (controlled values) | LOW |
| 11 | XSS | dangerouslySetInnerHTML (hardcoded icons) | LOW |
| 12 | XSS | No innerHTML/document.write | PASS |
| 13 | XSS | CSP has unsafe-inline + unsafe-eval | MEDIUM |
| 14 | XSS | No client-side sanitization library | LOW |
| 15 | CSRF | No CSRF tokens implemented | MEDIUM |
| 16 | CSRF | No cookies used (token-based auth) | N/A |
| 17 | NoSQL/JSONB | JSONB queries use safe patterns | PASS |
| 18 | Auth | **x-user-id header spoofable (100+ routes)** | **CRITICAL** |
| 19 | Auth | **No auth middleware on ~95% of routes** | **CRITICAL** |
| 20 | Auth | Admin bypass in development mode | HIGH |

---

## Risk Prioritization (Recommended Fix Order)

1. **CRITICAL: Supabase .or() Filter Injection** (25+ instances) -- Sanitize all user input before interpolation, or switch to Supabase filter object syntax.

2. **CRITICAL: x-user-id Header Trust** (100+ routes) -- Apply authMiddleware globally for /api/ routes.

3. **CRITICAL: Missing Route Authentication** (~155 routes) -- Add authentication middleware before route mounting.

4. **HIGH: Missing Input Validation** (~158 routes) -- Extend Zod schemas to all routes. Prioritize search, email, escalations, webhooks.

5. **HIGH: Customer PATCH Allows Arbitrary Fields** -- Whitelist update fields instead of spreading req.body.

6. **MEDIUM: CSP Weakening** -- Remove 'unsafe-inline' and 'unsafe-eval' from production CSP.

7. **MEDIUM: CSRF Protection** -- Implement CSRF tokens if cookie-based flows are introduced.

8. **LOW: File Upload Improvements** -- Add magic-byte validation beyond MIME checking.
