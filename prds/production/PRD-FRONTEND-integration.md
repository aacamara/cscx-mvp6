# PRD: Frontend Integration Testing & Fixes

## Overview
Verify all frontend components integrate correctly with the backend and provide a smooth user experience.

## Problem Statement
Before production, the frontend must:
- Render correctly without console errors
- Handle loading and error states gracefully
- Navigate between views without issues
- Show correct data based on user role

## User Stories

### US-001: Test Login Flow
**Description:** As a user, I need the login flow to work correctly.

**Acceptance Criteria:**
- Logged out users see invite code screen
- Invalid invite code shows error message
- Valid invite code enables Google Sign-In button
- Admin bypass link works for direct login
- OAuth redirect completes successfully
- Typecheck passes
- Verify in browser using dev-browser skill

### US-002: Test Role-Based Navigation
**Description:** As a user, I need to see appropriate navigation based on my role.

**Acceptance Criteria:**
- Admin sees: Dashboard, Customers, Onboarding, Agent Center, Knowledge Base, Admin, Support, Actions
- Design partner sees: Dashboard, Onboarding, Agent Center, Knowledge Base
- Navigation renders without console errors
- Typecheck passes
- Verify in browser using dev-browser skill

### US-003: Test Welcome Modal
**Description:** As a design partner, I need a welcome modal on first login.

**Acceptance Criteria:**
- Modal appears on first login for design partners
- Shows exploration options: Demo Customers, Mock Onboarding, AI Chat, Agent Actions
- "Start Exploring" dismisses modal
- Modal does not appear on subsequent visits (localStorage)
- Admin does not see welcome modal
- Typecheck passes
- Verify in browser using dev-browser skill

### US-004: Test Customer List View
**Description:** As a user, I need the customer list to display correctly.

**Acceptance Criteria:**
- Customer table renders with correct columns
- Admin sees all customers without badges
- Design partner sees demo customers with "DEMO" badge
- Design partner sees own customers with "YOUR DATA" badge
- Template and Import buttons visible for design partners only
- Typecheck passes
- Verify in browser using dev-browser skill

### US-005: Test CSV Import Modal
**Description:** As a design partner, I need the CSV import modal to work correctly.

**Acceptance Criteria:**
- Import CSV button opens modal
- File drop zone accepts .csv files
- Preview table shows first 5 rows after file selection
- Import button shows count: "Import X Customers"
- Success message and list refresh after import
- Validation errors display inline
- Typecheck passes
- Verify in browser using dev-browser skill

### US-006: Test Contract Upload Flow
**Description:** As a user, I need contract upload to extract and create customers.

**Acceptance Criteria:**
- Upload accepts PDF and DOCX files
- Loading state shows during parsing
- Design partners see extraction preview with editable fields
- Admins skip preview and go directly to chat
- Confirm creates customer and starts onboarding chat
- Typecheck passes
- Verify in browser using dev-browser skill

### US-007: Test Agent Center Chat
**Description:** As a user, I need the AI chat to work correctly.

**Acceptance Criteria:**
- Chat interface loads without errors
- Messages send and receive correctly
- Customer context appears when selected
- Design partners see "Try Mock Onboarding" card
- Mock onboarding demo mode works
- Typecheck passes
- Verify in browser using dev-browser skill

### US-008: Test Error States
**Description:** As a user, I need graceful error handling throughout the app.

**Acceptance Criteria:**
- Network errors show user-friendly messages
- 401 errors redirect to login
- 404 pages show helpful navigation
- No unhandled promise rejections in console
- Loading states prevent premature interactions
- Typecheck passes
- Verify in browser using dev-browser skill

## Technical Implementation

### Browser Testing Checklist
```markdown
1. Open http://localhost:5173 in incognito
2. Verify invite code screen appears
3. Enter invalid code → Check error message
4. Enter valid code → Check Google button appears
5. Complete OAuth → Verify redirect
6. Check navigation items based on role
7. Navigate to each view → No console errors
8. Test CRUD operations → Verify data updates
9. Test error handling → Disconnect network, check graceful failure
```
