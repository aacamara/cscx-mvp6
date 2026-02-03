# PRD: Onboarding Flow Completion

## Introduction

Complete the onboarding user flow so customers can actually use the platform. Currently, users can upload contracts and see parsed data, but **nothing saves to the database**. This is a **CRITICAL BLOCKER** - users lose all their work when they refresh.

## Goals

- Save customer to database when onboarding completes
- Save contract with parsed data to database
- Persist uploaded contract files to Supabase Storage
- Add Google Workspace connect UI in settings
- Display saved customers in CustomerList

## User Stories

### US-001: Save customer on onboarding completion
**Description:** As a user, when I complete onboarding, the customer should be saved to the database.

**Acceptance Criteria:**
- [ ] `UnifiedOnboarding.onComplete` calls `POST /api/customers` with parsed data
- [ ] Customer saved with: name, arr, industry (from contract)
- [ ] Customer assigned to current user (`csm_user_id = auth.uid()`)
- [ ] Success toast shown: "Customer created successfully"
- [ ] Redirect to customer detail page after save
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-002: Save contract on onboarding completion
**Description:** As a user, the parsed contract should be saved linked to the customer.

**Acceptance Criteria:**
- [ ] After customer created, call `POST /api/contracts` with customer_id
- [ ] Contract saved with: file_name, parsed_data (JSON), customer_id
- [ ] Stakeholders from contract saved to customer record
- [ ] Contract status set to "parsed"
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-003: Upload contract file to Supabase Storage
**Description:** As a user, my uploaded contract PDF should be stored persistently.

**Acceptance Criteria:**
- [ ] Create Supabase Storage bucket "contracts" if not exists
- [ ] On contract upload, save file to `contracts/{customer_id}/{filename}`
- [ ] Store public URL in contracts table `file_url` column
- [ ] User can download original contract from customer detail page
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-004: Add Google Workspace connect button
**Description:** As a user, I want to connect my Google account after signing up.

**Acceptance Criteria:**
- [ ] Add Settings page/modal accessible from navigation or profile
- [ ] Show "Connect Google Workspace" button if not connected
- [ ] Button calls `GET /api/google/auth/connect` to start OAuth
- [ ] Show connected status with email when connected
- [ ] Show "Disconnect" button when connected
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-005: Display saved customers in CustomerList
**Description:** As a user, I should see my saved customers on the main page.

**Acceptance Criteria:**
- [ ] CustomerList fetches from `GET /api/customers` on mount
- [ ] Only shows customers where `csm_user_id` matches current user (RLS)
- [ ] Shows customer name, ARR, health score, renewal date
- [ ] Click customer navigates to detail view
- [ ] Empty state shows "No customers yet. Start by onboarding a new customer."
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-006: Show contract data in customer detail
**Description:** As a user, I want to see the parsed contract data when viewing a customer.

**Acceptance Criteria:**
- [ ] Customer detail page fetches contracts for customer
- [ ] Shows tabs: Overview, Contracts, Stakeholders, Tasks
- [ ] Contracts tab lists all contracts with parsed data
- [ ] Can download original file from file_url
- [ ] Stakeholders tab shows extracted stakeholders
- [ ] Run `npx tsc --noEmit` - exits with code 0

## Functional Requirements

- FR-1: All data must persist across page refreshes
- FR-2: Users can only see their own customers (RLS enforced)
- FR-3: Contract files stored securely in Supabase Storage
- FR-4: Google OAuth must request offline access for refresh tokens

## Non-Goals

- No bulk import of customers (future)
- No contract versioning (future)
- No team sharing of customers (future)

## Technical Considerations

- Use Supabase Storage JS client for file uploads
- Storage bucket should have RLS policies
- Contract parsing already works - just need to persist results
- AuthContext already has Google token handling

## Success Metrics

- 100% of completed onboardings result in saved customer
- 100% of uploaded contracts accessible after refresh
- Users can connect Google Workspace in <3 clicks
