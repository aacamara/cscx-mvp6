# PRD: End-to-End Workflow Testing

## Overview
Test complete user journeys from start to finish to ensure all features work together seamlessly.

## Problem Statement
Individual components may work but fail when integrated. End-to-end testing verifies:
- Complete user journeys work as expected
- Data flows correctly between components
- State is maintained across navigation
- Edge cases are handled gracefully

## User Stories

### US-001: E2E Design Partner Signup
**Description:** As a design partner, I can complete the full signup flow.

**Acceptance Criteria:**
- Start at landing page (logged out)
- Enter invite code '2362369'
- Click Google Sign-In
- Complete OAuth with non-admin email
- See welcome modal
- Dismiss welcome modal
- See limited navigation (no Admin/Support/Actions)
- See 3 demo customers in list
- Typecheck passes
- Verify in browser using dev-browser skill

### US-002: E2E Contract-Based Onboarding
**Description:** As a design partner, I can onboard a customer via contract upload.

**Acceptance Criteria:**
- Navigate to Agent Center or Onboarding
- Click "New Onboarding" or upload area
- Upload a PDF contract file
- Wait for AI extraction
- See extraction preview with editable fields
- Edit company name if needed
- Click "Confirm & Start Onboarding"
- See customer created in list with "YOUR DATA" badge
- Chat loads with customer context
- AI responds with onboarding suggestions
- Typecheck passes
- Verify in browser using dev-browser skill

### US-003: E2E CSV Bulk Import
**Description:** As a design partner, I can import multiple customers via CSV.

**Acceptance Criteria:**
- Navigate to Customers view
- Click "Template" button → Download CSV
- Open CSV, verify headers and examples
- Fill in 3 test customers
- Click "Import CSV" button
- Select filled CSV file
- See preview table with 3 rows
- Click "Import 3 Customers"
- See success message
- Customer list refreshes with 3 new customers
- New customers have "YOUR DATA" badges
- Typecheck passes
- Verify in browser using dev-browser skill

### US-004: E2E Mock Onboarding Demo
**Description:** As a design partner, I can experience mock onboarding.

**Acceptance Criteria:**
- Navigate to Agent Center
- See "Try Mock Onboarding" card
- Click "Start Demo"
- Chat shows [DEMO MODE] label
- Simulated customer info displayed
- AI explains what it can demonstrate
- User can interact with demo
- Demo actions are clearly labeled as simulated
- Typecheck passes
- Verify in browser using dev-browser skill

### US-005: E2E Admin Full Access
**Description:** As an admin, I have full access to all features.

**Acceptance Criteria:**
- Login with admin email (azizcamara2@gmail.com)
- See full navigation (including Admin, Support, Actions)
- See ALL customers (no filtering)
- No ownership badges on customer cards
- Can access any customer detail
- Contract upload skips preview
- Can see all agent activities
- Typecheck passes
- Verify in browser using dev-browser skill

### US-006: E2E Data Isolation
**Description:** As a design partner, my data is isolated from others.

**Acceptance Criteria:**
- Login as Design Partner A
- Import 2 customers via CSV
- See those customers with "YOUR DATA" badges
- Logout
- Login as Design Partner B
- Do NOT see Partner A's customers
- Only see demo customers
- Import own customers
- See only own + demo customers
- Typecheck passes
- Verify in browser using dev-browser skill

## Test Scenarios

### Test Data Required
```json
{
  "testContract": "sample-contract.pdf",
  "testCSV": "test-customers.csv",
  "designPartnerA": "testpartner.a@gmail.com",
  "designPartnerB": "testpartner.b@gmail.com",
  "adminEmail": "azizcamara2@gmail.com",
  "inviteCode": "2362369"
}
```

### Test Execution Order
1. Clean test database (optional)
2. Run signup E2E
3. Run contract onboarding E2E
4. Run CSV import E2E
5. Run mock onboarding E2E
6. Run admin access E2E
7. Run data isolation E2E
