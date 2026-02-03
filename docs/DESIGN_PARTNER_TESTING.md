# Design Partner Features - Testing Checklist

## Overview

Two features were implemented for design partners:
1. **Role-Based Views** - Limited navigation and demo data for non-admin users
2. **Self-Service Onboarding** - Contract upload and CSV import capabilities

---

## Prerequisites

### Migrations to Apply (in Supabase SQL Editor)

Run these in order:

1. **Add is_demo column:**
```sql
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_customers_is_demo ON public.customers(is_demo);
```

2. **Seed demo customers:** (run `20260202200002_seed_demo_customers.sql`)

3. **Add owner_id column:**
```sql
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_customers_owner_id ON public.customers(owner_id);
```

### Test Accounts

| Role | Email | Access |
|------|-------|--------|
| Admin | azizcamara2@gmail.com | Full access, all customers |
| Design Partner | Any other email | Limited access, demo + own data |

### Invite Code
- Code: `2362369`

---

## Feature 1: Gated Login with Invite Code

### Test 1.1: Invite Code Screen
- [ ] Open http://localhost:5173 (logged out)
- [ ] Should see "Enter Invite Code" screen (not landing page)
- [ ] Enter invalid code → Shows "Invalid code" error
- [ ] Enter `2362369` → Shows "Valid!" and Google Sign-In button

### Test 1.2: Admin Bypass
- [ ] On login screen, click "Admin? Sign in directly" link at bottom
- [ ] Should redirect to Google OAuth without needing invite code
- [ ] Login with azizcamara2@gmail.com → Full admin access

### Test 1.3: Design Partner Login
- [ ] Enter invite code `2362369`
- [ ] Sign in with a non-admin Google account
- [ ] Should complete OAuth and redirect to app

---

## Feature 2: Role-Based Navigation

### Test 2.1: Admin Navigation
- [ ] Login as admin (azizcamara2@gmail.com)
- [ ] Should see ALL navigation items:
  - Dashboard
  - Customers
  - Onboarding
  - Agent Center
  - Knowledge Base
  - **Admin** (admin only)
  - **Support** (admin only)
  - **Actions** (admin only)

### Test 2.2: Design Partner Navigation
- [ ] Login as design partner (non-admin email)
- [ ] Should see LIMITED navigation:
  - Dashboard
  - Onboarding
  - Agent Center
  - Knowledge Base
- [ ] Should NOT see: Admin, Support, Actions

---

## Feature 3: Welcome Modal

### Test 3.1: First-Time Welcome
- [ ] Login as design partner for the first time
- [ ] Should see "Welcome to CSCX.AI" modal
- [ ] Modal explains what they can explore:
  - Explore Demo Customers
  - Start Mock Onboarding
  - Chat with AI Assistant
  - Review Agent Actions
- [ ] Click "Start Exploring" → Modal dismisses

### Test 3.2: Modal Persistence
- [ ] Refresh the page
- [ ] Modal should NOT appear again (stored in localStorage)
- [ ] Clear localStorage key `dp_welcome_dismissed` to reset

---

## Feature 4: Demo Customer Filtering

### Test 4.1: Admin Sees All Customers
- [ ] Login as admin
- [ ] Go to Customers view
- [ ] Should see ALL customers in database (demo and real)

### Test 4.2: Design Partner Sees Demo Only
- [ ] Login as design partner
- [ ] Go to Customers view (via Dashboard)
- [ ] Should ONLY see 3 demo customers:
  - Acme Corp ($250K, 85% health, active)
  - TechStart Inc ($85K, 42% health, at_risk)
  - GlobalTech ($480K, 92% health, expanding)
- [ ] Should NOT see any real/production customers

---

## Feature 5: Mock Onboarding in Agent Chat

### Test 5.1: Mock Onboarding Prompt
- [ ] Login as design partner
- [ ] Go to Agent Center
- [ ] Should see "Try Mock Onboarding" card with rocket emoji
- [ ] Card shows: "Experience the AI-powered customer onboarding flow"

### Test 5.2: Start Demo Flow
- [ ] Click "Start Demo" button
- [ ] Chat should show demo introduction message with [DEMO MODE] label
- [ ] Shows simulated customer: Acme Corp, $250K ARR
- [ ] Lists what AI can demonstrate:
  - Draft welcome emails
  - Schedule kickoff meetings
  - Generate documents
- [ ] Note at bottom: "All actions are simulated"

---

## Feature 6: CSV Template Download

### Test 6.1: Template Button Visibility
- [ ] Login as design partner
- [ ] Go to Customers view
- [ ] Should see "Template" button (gray, with download icon)
- [ ] Button should NOT appear for admin users

### Test 6.2: Download Template
- [ ] Click "Template" button
- [ ] Should download `cscx-customer-template.csv`
- [ ] Open file - should have headers:
  - name, industry, arr, health_score, stage, renewal_date, csm_name, primary_contact_name, primary_contact_email, primary_contact_title
- [ ] Should have 2 example rows with sample data

---

## Feature 7: CSV Bulk Import

### Test 7.1: Import Button Visibility
- [ ] Login as design partner
- [ ] Go to Customers view
- [ ] Should see "Import CSV" button (blue)
- [ ] Button should NOT appear for admin users

### Test 7.2: Import Modal
- [ ] Click "Import CSV" button
- [ ] Modal opens with "Import Customers from CSV" title
- [ ] Shows file drop zone
- [ ] Has "Download it here" link for template

### Test 7.3: File Selection
- [ ] Drag and drop a .csv file OR click to browse
- [ ] Should show preview table with first 5 rows
- [ ] Headers displayed in table header
- [ ] Shows row count: "Preview: filename.csv (X rows)"
- [ ] "Change file" link to select different file

### Test 7.4: Import Execution
- [ ] With valid CSV, click "Import X Customers"
- [ ] Should show loading spinner
- [ ] On success: "Imported X customers" message
- [ ] Customer list refreshes automatically
- [ ] Modal closes after success

### Test 7.5: Validation Errors
- [ ] Try importing CSV with missing 'name' field
- [ ] Should show error for that row
- [ ] Try importing with invalid 'arr' (non-numeric)
- [ ] Should show validation error

---

## Feature 8: Ownership Badges

### Test 8.1: Demo Customer Badge
- [ ] Login as design partner
- [ ] Go to Customers view
- [ ] Demo customers should show "DEMO" badge (orange)
- [ ] Badge appears next to customer name

### Test 8.2: Your Data Badge
- [ ] Import customers via CSV (see Feature 7)
- [ ] Imported customers should show "YOUR DATA" badge (blue)
- [ ] Distinguishes your uploads from shared demos

### Test 8.3: Admin View
- [ ] Login as admin
- [ ] Go to Customers view
- [ ] Should NOT see any ownership badges (admin sees all)

---

## Feature 9: Contract Upload with Preview

### Test 9.1: Start New Onboarding
- [ ] Login as design partner
- [ ] Go to Onboarding view OR Agent Center
- [ ] Click "New Onboarding" button
- [ ] Should see contract upload screen

### Test 9.2: Upload Contract
- [ ] Upload a PDF or DOCX contract file
- [ ] Should show "Analyzing contract..." loading state
- [ ] AI extracts: company name, ARR, stakeholders, entitlements

### Test 9.3: Extraction Preview (Design Partners Only)
- [ ] After parsing, should see "Review Extracted Data" screen
- [ ] Editable fields:
  - Company Name (required)
  - ARR (required)
  - Contract Period
- [ ] Editable stakeholder list (add/remove)
- [ ] Editable entitlement list (add/remove)

### Test 9.4: Edit Extracted Data
- [ ] Modify company name
- [ ] Change ARR value
- [ ] Add a new stakeholder
- [ ] Remove an entitlement
- [ ] Changes should persist in form

### Test 9.5: Confirm and Create Customer
- [ ] Click "Confirm & Start Onboarding"
- [ ] Should create customer with your edits
- [ ] Customer has owner_id = your user ID
- [ ] Redirects to AI chat with customer context
- [ ] New customer appears in your customer list with "YOUR DATA" badge

### Test 9.6: Cancel Preview
- [ ] On preview screen, click "Cancel"
- [ ] Should return to contract upload screen
- [ ] No customer created

### Test 9.7: Admin Bypass
- [ ] Login as admin
- [ ] Upload a contract
- [ ] Should skip preview and go directly to chat
- [ ] Customer created without owner_id

---

## Data Isolation Verification

### Test 10.1: Design Partner A Cannot See Partner B's Data
- [ ] Login as Design Partner A
- [ ] Import some customers via CSV
- [ ] Logout
- [ ] Login as Design Partner B (different email)
- [ ] Should NOT see Partner A's imported customers
- [ ] Should only see demo customers

### Test 10.2: Admin Sees Everyone's Data
- [ ] Login as admin
- [ ] Should see ALL customers:
  - Demo customers
  - Partner A's imports
  - Partner B's imports
  - Any other customers

---

## Quick Smoke Test (5 minutes)

1. [ ] Open app logged out → See invite code screen
2. [ ] Enter `2362369` → Sign in with non-admin Google account
3. [ ] See welcome modal → Click "Start Exploring"
4. [ ] Check navigation → Only see Dashboard, Onboarding, Agent Center, KB
5. [ ] Go to Agent Center → See "Try Mock Onboarding" card
6. [ ] Click "Start Demo" → See demo mode chat
7. [ ] Navigate to Customers → See 3 demo customers with "DEMO" badges
8. [ ] Click "Template" → Download CSV template
9. [ ] Click "Import CSV" → Upload the template → See preview
10. [ ] Confirm import → See new customers with "YOUR DATA" badges

---

## Troubleshooting

### Welcome Modal Keeps Appearing
```javascript
// In browser console
localStorage.removeItem('dp_welcome_dismissed')
```

### Not Seeing Demo Customers
- Verify migrations were run in Supabase
- Check `is_demo` column exists on customers table
- Verify demo customers have `is_demo = true`

### Import Not Working
- Check backend is running on port 3001
- Verify CSV has required columns: `name`, `arr`
- Check browser console for errors

### Badges Not Showing
- Verify `owner_id` column exists
- Check `x-user-id` header is being sent (AuthContext)
- Design partner must be logged in (not admin)
