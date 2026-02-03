# PRD-1: Gated Google Login + First-Run Onboarding + Customer Import

**Status**: 🔴 Not Started
**Priority**: P0 - Critical (Launch Blocker)
**Last Updated**: 2026-02-01

---

## Goal

Enable design partners to log in with Google OAuth, but only authorized users can access (invite-code gated). After login, users land directly in Chat UI with onboarding guidance. Users must import customers and contacts from Google Sheets or CSV.

---

## Scope

### In Scope
- Google OAuth authentication
- Invite code gating system
- Post-login redirect to Chat UI
- First-run onboarding checklist
- Google Sheets customer import
- CSV customer import
- Column mapping UI
- Deduplication logic

### Out of Scope
- HubSpot import (Phase 2)
- SSO/SAML (future)
- Multi-workspace switching (future)

---

## User Stories

### US-1: Design Partner Login
**As a** design partner,
**I want to** log in with my Google account,
**So that** I can access the CSCX platform securely.

**Acceptance Criteria:**
- "Continue with Google" button on login page
- OAuth flow completes and returns user info
- Unauthorized users see invite code prompt
- Authorized users proceed to Chat UI

### US-2: Invite Code Validation
**As a** new user without platform access,
**I want to** enter an invite code after Google login,
**So that** I can be admitted to my workspace.

**Acceptance Criteria:**
- Invite code prompt appears after OAuth if email not authorized
- Valid codes bind user to workspace
- Invalid/expired/used codes show clear error
- Rate limiting prevents brute force (5 attempts/minute)

### US-3: First-Run Onboarding
**As a** new user,
**I want to** see an onboarding checklist on first login,
**So that** I know what steps to complete to get started.

**Acceptance Criteria:**
- Onboarding panel shows on first visit
- Checklist items: Google Connected, Import Customers, Create First Success Plan
- Welcome system message appears in chat
- Panel dismisses after completion or manual close

### US-4: Google Sheets Import
**As a** user,
**I want to** import customers from a Google Sheets spreadsheet,
**So that** I don't have to manually enter each customer.

**Acceptance Criteria:**
- Can select spreadsheet from connected Google Drive
- Can select specific sheet/tab
- Column mapping UI for required/optional fields
- Preview before import
- Import results summary (created/updated/skipped/failed)

### US-5: CSV Import
**As a** user,
**I want to** upload a CSV file to import customers,
**So that** I can import from any source.

**Acceptance Criteria:**
- File upload accepts .csv files
- Column mapping UI with preview
- Handles various encodings (UTF-8, etc.)
- Import results summary with error details

---

## Functional Requirements

### A) Google OAuth + Gating

| Req ID | Requirement |
|--------|-------------|
| FR-1.1 | Login page displays "Continue with Google" button |
| FR-1.2 | OAuth flow requests email, profile, and openid scopes |
| FR-1.3 | After OAuth, system checks if email is in authorized_users table |
| FR-1.4 | If not authorized, display invite code input form |
| FR-1.5 | Invite codes stored as hashed values with: max_uses, expires_at, workspace_id |
| FR-1.6 | Valid invite code creates user record and binds to workspace |
| FR-1.7 | Rate limit: 5 invite attempts per minute per IP |
| FR-1.8 | Failed attempts logged with IP, timestamp, attempted code hash |

### B) Invite Code Management

| Req ID | Requirement |
|--------|-------------|
| FR-2.1 | Admin can create invite codes via API/UI |
| FR-2.2 | Codes can be single-use or multi-use (configurable max_uses) |
| FR-2.3 | Codes can have expiration date (optional) |
| FR-2.4 | Codes can be revoked (soft delete) |
| FR-2.5 | Admin can view code usage history |

### C) Post-Login Onboarding

| Req ID | Requirement |
|--------|-------------|
| FR-3.1 | After successful login, redirect to /chat |
| FR-3.2 | First-run users see onboarding panel overlay |
| FR-3.3 | Onboarding checklist stored in user_preferences |
| FR-3.4 | Checklist items auto-update on completion |
| FR-3.5 | Welcome message auto-inserted as first chat message |

### D) Customer Import

| Req ID | Requirement |
|--------|-------------|
| FR-4.1 | Import UI accessible from onboarding panel and customers view |
| FR-4.2 | Google Sheets picker shows user's Drive files |
| FR-4.3 | Sheet/tab selector for multi-sheet files |
| FR-4.4 | Column mapping: required = name; optional = ARR, renewal_date, health_score, contact_name, contact_email, contact_title |
| FR-4.5 | Preview shows first 5 rows with mapped data |
| FR-4.6 | Dedup matching by normalized name (lowercase, trim) or external_id if provided |
| FR-4.7 | User chooses dedup action: update existing, skip, create duplicate |
| FR-4.8 | Import runs in background job with progress indicator |
| FR-4.9 | Results summary: X created, Y updated, Z skipped, W failed |
| FR-4.10 | Failed rows downloadable as error report with row numbers and reasons |

---

## Non-Functional Requirements

| Req ID | Requirement |
|--------|-------------|
| NFR-1 | OAuth callback completes in <3 seconds |
| NFR-2 | Invite code validation completes in <500ms |
| NFR-3 | Import of 1000 rows completes in <60 seconds |
| NFR-4 | Rate limiting enforced at edge (nginx/cloudflare) and application level |
| NFR-5 | All invite attempts logged for security audit |

---

## Data Model Changes

### New Tables

```sql
-- Invite codes for gated access
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_hash TEXT NOT NULL UNIQUE,  -- bcrypt hash of code
  workspace_id UUID REFERENCES public.workspaces(id),
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Invite code usage log
CREATE TABLE public.invite_code_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_hash TEXT,  -- hash of attempted code
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN,
  user_id UUID REFERENCES public.users(id),  -- if successful
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer imports
CREATE TABLE public.customer_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES public.workspaces(id),
  user_id UUID REFERENCES public.users(id),
  source_type TEXT NOT NULL,  -- 'google_sheets' | 'csv'
  source_ref TEXT,  -- spreadsheet ID or filename
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  total_rows INTEGER,
  created_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_details JSONB,
  column_mapping JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables

```sql
-- Add to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_checklist JSONB DEFAULT '{}',
  first_login_at TIMESTAMPTZ;
```

---

## API Contracts

### POST /api/auth/google/callback
**Request**: OAuth callback (handled by library)
**Response**:
```json
{
  "success": true,
  "user": { "id": "...", "email": "...", "name": "..." },
  "requiresInviteCode": false,
  "redirectTo": "/chat"
}
```

### POST /api/auth/invite-code
**Request**:
```json
{
  "code": "PARTNER-2026-XXXX"
}
```
**Response**:
```json
{
  "success": true,
  "workspaceId": "...",
  "redirectTo": "/chat"
}
```

### POST /api/customers/import
**Request**:
```json
{
  "sourceType": "google_sheets",
  "sourceRef": "spreadsheet-id",
  "sheetName": "Customers",
  "columnMapping": {
    "name": "A",
    "arr": "B",
    "renewal_date": "C"
  },
  "dedupAction": "update"
}
```
**Response**:
```json
{
  "importId": "...",
  "status": "processing"
}
```

### GET /api/customers/import/:id
**Response**:
```json
{
  "id": "...",
  "status": "completed",
  "totalRows": 100,
  "createdCount": 80,
  "updatedCount": 15,
  "skippedCount": 3,
  "failedCount": 2,
  "errorDetails": [
    { "row": 45, "reason": "Invalid date format" }
  ]
}
```

---

## UI/UX Acceptance Criteria

### Login Page
- Clean, professional design matching CSCX brand
- "Continue with Google" button prominently displayed
- Loading state during OAuth redirect
- Error state with clear message for failures

### Invite Code Screen
- Appears only for unauthorized users after OAuth
- Single text input with placeholder "Enter invite code"
- Submit button
- Clear error messages for invalid/expired/used codes
- Rate limit warning if triggered

### Onboarding Panel
- Slides in from right side of screen
- Semi-transparent overlay
- Checklist with checkmarks for completed items
- "Get Started" button to dismiss
- Persists until all items complete or manually dismissed

### Import UI
- Step wizard: Source → Mapping → Preview → Import
- Clear visual for required vs optional columns
- Drag-and-drop column mapping
- Preview table with sample data
- Progress bar during import
- Results summary with downloadable error report

---

## Edge Cases

1. **User already exists**: Skip invite code, proceed to login
2. **Invite code at max uses**: Show "Code has reached maximum uses"
3. **Invite code expired**: Show "Code has expired"
4. **Invite code revoked**: Show "Invalid invite code"
5. **OAuth cancelled**: Return to login page with message
6. **Import with no data**: Show "No data found in selected sheet"
7. **Import with unmappable columns**: Show warning, allow partial import
8. **Network failure during import**: Resume from last successful row

---

## Test Plan

### Unit Tests
- Invite code hash/verify functions
- Rate limiting logic
- Column mapping parser
- Dedup matching algorithm
- Import row validation

### Integration Tests
- OAuth flow (mock provider)
- Invite code creation/validation
- Import from mock spreadsheet
- Import from CSV file

### E2E Tests
1. Full login flow: unauthorized → invite code → chat
2. Full login flow: authorized → chat
3. Onboarding checklist completion
4. Google Sheets import end-to-end
5. CSV import end-to-end
6. Import with errors → download report

---

## Rollout Plan

1. **Phase 1**: Internal testing with team accounts
2. **Phase 2**: Staging deploy with test invite codes
3. **Phase 3**: Production deploy with first 5 design partner invites
4. **Phase 4**: Full design partner rollout

---

## Definition of Done

- [ ] All functional requirements implemented
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Staging smoke tests pass
- [ ] Production smoke tests pass
- [ ] Security review complete (invite code hashing, rate limiting)
- [ ] Documentation updated
- [ ] Design partner feedback incorporated
