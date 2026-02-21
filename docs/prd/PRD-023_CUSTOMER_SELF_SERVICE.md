# PRD-023: Customer Self-Service Production Readiness

## Overview
Enable real customers to independently sign up, set up their organization, import customers, onboard via contract upload, do CS work, and generate artifacts — all with complete multi-tenant data isolation.

## Status: IN PROGRESS

---

## User Stories

### US-001: Google OAuth Sign-Up (Priority: CRITICAL)
**As a** new customer admin,
**I want to** sign in with my Google account,
**So that** I can access CSCX.AI without creating a separate password.

**Acceptance Criteria:**
- [ ] Google OAuth redirects correctly on production Cloud Run URL
- [ ] `GOOGLE_REDIRECT_URI` in GCP Secret Manager matches Google Console config
- [ ] After OAuth, user lands on SignupPage if no org exists
- [ ] After OAuth, user lands on dashboard if org already exists
- [ ] Error handling for OAuth failures (token expired, consent denied)

**Files:** `server/src/routes/auth.ts`, `components/Login.tsx`, `cloudbuild.yaml`

---

### US-002: Organization Setup (Priority: CRITICAL)
**As a** new customer admin,
**I want to** create my organization with a name and slug,
**So that** my team has a dedicated workspace.

**Acceptance Criteria:**
- [ ] SignupPage renders after OAuth when user has no org
- [ ] "Create Organization" flow: name → auto-slug → submit
- [ ] Backend `POST /api/organizations/create` creates org + makes user admin
- [ ] After creation, user redirects to main dashboard with org context
- [ ] Slug uniqueness enforced (409 Conflict on duplicate)
- [ ] "Join with Invite Code" path works for team members

**Files:** `components/Auth/SignupPage.tsx`, `server/src/routes/organizations.ts`, `App.tsx`

---

### US-003: CSV Customer Import (Priority: HIGH)
**As an** admin,
**I want to** upload a CSV of my customer list,
**So that** I can bulk-import customers into my organization.

**Acceptance Criteria:**
- [x] CSV template with sample rows downloads correctly
- [x] Auto-mapping of 7 fields (name, industry, arr, health_score, stage, contact_name, contact_email)
- [x] Validation warnings shown before import
- [x] Backend `POST /api/customers/import` persists with organization_id
- [ ] Imported customers appear in customer list immediately
- [ ] Duplicate detection (by name or domain) warns user

**Files:** `components/Admin/CustomerImport.tsx`, `server/src/routes/customers.ts`

---

### US-004: Contract Upload & Parsing (Priority: HIGH)
**As a** CSM,
**I want to** upload a customer contract (PDF/DOCX),
**So that** the system extracts stakeholders, entitlements, pricing, and technical requirements.

**Acceptance Criteria:**
- [ ] UnifiedOnboarding renders contract upload step
- [ ] Gemini parses contract and extracts structured data
- [ ] Extracted data populates: stakeholders, entitlements, pricing tables
- [ ] Onboarding plan is auto-generated from contract data
- [ ] Contract data is org-scoped (applyOrgFilter on contracts.ts)
- [ ] Stakeholder data is org-scoped (applyOrgFilter on stakeholders.ts)

**Files:** `components/UnifiedOnboarding.tsx`, `services/geminiService.ts`, `server/src/routes/contracts.ts`, `server/src/routes/stakeholders.ts`, `server/src/routes/onboarding.ts`

---

### US-005: Multi-Tenant Data Isolation (Priority: CRITICAL)
**As a** customer,
**I want to** see only my organization's data,
**So that** my customers, contracts, and artifacts are private.

**Acceptance Criteria:**
- [ ] `applyOrgFilter` on ALL data-returning routes (9 critical routes)
- [ ] `withOrgId` on ALL INSERT operations to tag with organization_id
- [ ] Customer list filtered by org
- [ ] Stakeholders filtered by org
- [ ] Contracts filtered by org
- [ ] Account plans filtered by org
- [ ] CADG artifacts filtered by org
- [ ] Chat history filtered by org
- [ ] Timeline activities filtered by org
- [ ] Agent configs/runs filtered by org
- [ ] Workspace data filtered by org
- [ ] Integration configs filtered by org
- [ ] Harness: `npm run harness:org-filter` passes on all route files

**Files:** All 9 route files listed in US-005 checklist + `server/src/middleware/orgFilter.ts`

---

### US-006: Team Management & CSM Assignment (Priority: HIGH)
**As an** admin,
**I want to** invite team members and assign them to customers,
**So that** each CSM has a defined book of business.

**Acceptance Criteria:**
- [x] Admin can generate invite codes with role (CSM/viewer)
- [x] Invite modal shows code to share
- [x] Team tab shows all org members with roles
- [x] Customer assignment panel maps CSMs to customers
- [ ] CSM sees only their assigned customers (or all if admin)
- [ ] Role-based access: viewer can read, CSM can edit, admin can manage

**Files:** `components/Admin/TeamManagement.tsx`, `server/src/routes/team.ts`, `server/src/routes/organizations.ts`

---

### US-007: Google Workspace Integration (Priority: MEDIUM)
**As a** CSM,
**I want to** connect my Google Workspace,
**So that** the system can create artifacts in my Drive and send emails on my behalf.

**Acceptance Criteria:**
- [ ] Google Connect component allows OAuth for Drive/Gmail scopes
- [ ] Integration config stored per-org (org-scoped)
- [ ] CADG artifacts can be exported to Google Docs
- [ ] Email drafts can be sent via Gmail API
- [ ] Disconnect/revoke flow works

**Files:** `components/GoogleConnect.tsx`, `server/src/services/google/`, `server/src/routes/integrations.ts`

---

### US-008: CADG Artifact Generation (Priority: HIGH)
**As a** CSM,
**I want to** generate account plans, QBRs, and playbook-driven artifacts,
**So that** I have professional CS documents based on real customer data.

**Acceptance Criteria:**
- [ ] CADG generates account plans from customer context
- [ ] CADG generates QBR decks with metrics and recommendations
- [ ] CADG generates playbook-driven actions (onboarding, renewal, risk)
- [ ] All artifacts are org-scoped (applyOrgFilter on cadg.ts)
- [ ] Artifacts reference correct customer data (not cross-org)
- [ ] Generated artifacts can be viewed in-app and exported

**Files:** `server/src/routes/cadg.ts`, `server/src/services/cadg/`, `components/AIPanel/`

---

### US-009: Production OAuth Verification (Priority: CRITICAL)
**As the** platform operator,
**I want to** verify Google OAuth works on production,
**So that** real customers can actually sign in.

**Acceptance Criteria:**
- [ ] `GOOGLE_REDIRECT_URI` in GCP Secret Manager matches Google Console
- [ ] Cloud Run service URL callback works
- [ ] OAuth consent screen shows correct app name and logo
- [ ] Token refresh works for returning users
- [ ] Error page shown for denied/expired OAuth

**Files:** `cloudbuild.yaml`, `server/src/routes/auth.ts`, GCP Secret Manager config

---

### US-010: End-to-End Smoke Test (Priority: CRITICAL)
**As the** platform operator,
**I want to** run a full smoke test of the customer journey,
**So that** I can confirm everything works before onboarding real customers.

**Acceptance Criteria:**
- [ ] Login page → Google OAuth or Demo Mode
- [ ] Create org → name + slug → redirects to dashboard
- [ ] Import CSV → 7 fields mapped → customers appear in list
- [ ] Open customer → detail view loads with data
- [ ] Admin panel → all 4 tabs load with data
- [ ] Generate QBR or account plan → artifact renders
- [ ] No console errors throughout journey
- [ ] No cross-org data leaks

**Files:** `scripts/verify-core-flows.ts` (to create), all frontend components

---

## Implementation Plan

| Phase | User Stories | Method | Priority |
|-------|------------|--------|----------|
| 1 | US-005 (Org Isolation) | Ralph agents — 4 parallel batches | CRITICAL |
| 2 | US-009 (Production OAuth) | Manual verification + config fix | CRITICAL |
| 3 | US-010 (Smoke Test) | Playwright + browser test | CRITICAL |
| 4 | US-001 (Google OAuth) | Verify + fix redirect config | CRITICAL |
| 5 | US-002 (Org Setup) | Verify existing flow | CRITICAL |
| 6 | US-003 (CSV Import) | Done — add duplicate detection | HIGH |
| 7 | US-004 (Contract Upload) | Verify e2e with org filtering | HIGH |
| 8 | US-006 (Team Management) | Add role-based customer filtering | HIGH |
| 9 | US-007 (Google Workspace) | Verify integration flow | MEDIUM |
| 10 | US-008 (CADG Artifacts) | Verify with org filtering | HIGH |

## Risk Assessment
- **CRITICAL**: Without US-005 (org isolation), multi-tenant is a data leak
- **CRITICAL**: Without US-009 (production OAuth), nobody can sign in
- **HIGH**: Without US-004 (contract parsing), core value prop doesn't work
- **MEDIUM**: US-007 (Google Workspace) can be deferred to week 2
