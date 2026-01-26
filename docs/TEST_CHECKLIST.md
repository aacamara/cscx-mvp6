# CSCX.AI Test Checklist

**Purpose:** Manual testing guide to verify all platform functionality
**Last Updated:** 2026-01-22

---

## Pre-Testing Setup

- [ ] Backend running on `http://localhost:3001`
- [ ] Frontend running on `http://localhost:5173`
- [ ] Supabase database accessible
- [ ] Google OAuth configured (optional but recommended)
- [ ] At least one AI key set (ANTHROPIC_API_KEY or GEMINI_API_KEY)

---

## 1. Authentication & Google Connection

### 1.1 Google OAuth Flow
- [ ] Click "Connect Google" shows OAuth consent screen
- [ ] After consent, redirects back to app
- [ ] Connection status shows "Connected"
- [ ] Token refresh works (check after 1 hour)
- [ ] "Disconnect" revokes access

### 1.2 User Session
- [ ] User ID persists in localStorage
- [ ] Session ID generated per customer context
- [ ] API calls include `x-user-id` header

---

## 2. Observability Dashboard

### 2.1 Overview Tab
- [ ] Portfolio metrics load (MRR, ARR, customers count)
- [ ] Health distribution chart renders
- [ ] NRR, GRR, LTV:CAC show with benchmark colors
- [ ] Top accounts by ARR display correctly

### 2.2 Customers Tab
- [ ] Customer list loads from database
- [ ] Search filters customers by name
- [ ] Status filter works (all, onboarding, active, at-risk)
- [ ] Sort by ARR, health score, status works
- [ ] Clicking customer redirects to Metrics tab with that customer

### 2.3 Metrics Tab
- [ ] Customer dropdown shows all customers
- [ ] Selecting customer loads their data
- [ ] Health score displays with color coding
- [ ] Engagement metrics section visible
- [ ] Google Workspace links work (Drive, Sheets)
- [ ] **Agent Inbox loads for selected customer**

---

## 3. Agent Inbox (NEW)

### 3.1 Pending Approvals
- [ ] Pending approvals display with action type
- [ ] Approve button triggers approval endpoint
- [ ] Reject button triggers rejection
- [ ] Approval count updates after action

### 3.2 Activity History
- [ ] Agent activities load for customer
- [ ] Activities show agent type and status
- [ ] Timestamps display correctly

### 3.3 Chat History
- [ ] Previous chat messages load
- [ ] User and assistant messages distinguished
- [ ] Agent type shown for assistant messages
- [ ] Session grouping works

---

## 4. Onboarding Flow (Agent Studio)

### 4.1 Step 1: Google Connection
- [ ] Shows connection status
- [ ] "Connect Google Workspace" initiates OAuth
- [ ] Skip option available
- [ ] Can proceed after connecting

### 4.2 Step 2: Contract Upload
- [ ] File upload accepts PDF
- [ ] Drag-and-drop works
- [ ] Progress indicator shows during upload
- [ ] Error handling for invalid files

### 4.3 Step 3: Parsing
- [ ] Shows "Analyzing contract" status
- [ ] AI extraction completes
- [ ] Extracted data displays

### 4.4 Step 4: Review
- [ ] All extracted fields editable
- [ ] Company name, ARR, dates shown
- [ ] Stakeholders list with roles
- [ ] Entitlements/SKUs displayed
- [ ] Can modify before proceeding

### 4.5 Step 5: Workspace Creation
- [ ] Creates Google Drive folder structure
- [ ] Creates Onboarding Tracker spreadsheet
- [ ] **Customer appears in customer list**
- [ ] Customer has `stage: 'onboarding'`

### 4.6 Step 6: Completion
- [ ] Summary screen shows all details
- [ ] Links to Drive folder work
- [ ] Links to tracker sheet work
- [ ] Can navigate to customer detail

---

## 5. AI Chat (AgentControlCenter)

### 5.1 Agent Routing
- [ ] Auto-route selects appropriate agent
- [ ] Manual agent selection works
- [ ] Routing confidence displayed
- [ ] Agent card highlights active agent

### 5.2 Chat Functionality
- [ ] Messages send successfully
- [ ] "Processing" indicator shows
- [ ] Responses render with markdown
- [ ] Agent type shown in response
- [ ] **Messages saved to database**

### 5.3 Quick Actions
- [ ] Quick action buttons visible
- [ ] Clicking triggers appropriate prompt
- [ ] Context-aware (customer name, ARR)

### 5.4 HITL Approvals
- [ ] Actions requiring approval show modal
- [ ] Can approve or reject
- [ ] Approval executes the action
- [ ] Result shown after execution

### 5.5 Model Selection
- [ ] Can switch between Claude and Gemini
- [ ] Model name displays correctly
- [ ] Responses work with either model

### 5.6 Knowledge Base
- [ ] Toggle enables/disables KB
- [ ] Responses cite KB when enabled
- [ ] Works without KB enabled

---

## 6. Workflows

### 6.1 Workflow Execution
- [ ] Agent actions trigger workflows
- [ ] Progress indicator shows steps
- [ ] Workflow completion shows results
- [ ] Google Drive links in output work

### 6.2 Workflow Approval
- [ ] Pending workflows show approve/reject
- [ ] Approval completes workflow
- [ ] Rejection cancels workflow

---

## 7. Customer Detail

### 7.1 Overview
- [ ] Health score gauge displays
- [ ] Quick stats show (meetings, emails, tasks)
- [ ] Renewal countdown visible
- [ ] Primary contact card shows

### 7.2 Activity Tab
- [ ] Timeline loads (currently mock data)
- [ ] Activity icons by type
- [ ] Timestamps correct

### 7.3 Workspace Integration
- [ ] WorkspacePanel shows Google services
- [ ] Can access Drive, Calendar, Gmail
- [ ] Files load from customer folder

---

## 8. Knowledge Base

### 8.1 Playbooks
- [ ] CSM playbooks list loads
- [ ] Search filters playbooks
- [ ] Individual playbook detail view
- [ ] Embeddings generated for semantic search

### 8.2 Glossary
- [ ] Terms load with definitions
- [ ] Category filter works
- [ ] Search finds terms

### 8.3 AI Integration
- [ ] "Ask AI" uses knowledge base
- [ ] Responses cite sources
- [ ] Relevant playbooks suggested

---

## 9. API Health Checks

### 9.1 Core Endpoints
```bash
# Health check
curl http://localhost:3001/health

# Customers
curl http://localhost:3001/api/customers -H "x-user-id: demo-user"

# Metrics dashboard
curl http://localhost:3001/api/metrics/dashboard

# Playbooks
curl http://localhost:3001/api/playbooks/csm
```

### 9.2 Google Endpoints (requires auth)
```bash
# Auth status
curl http://localhost:3001/api/google/auth/status -H "x-user-id: USER_ID"

# Calendar events
curl http://localhost:3001/api/google/calendar/events -H "x-user-id: USER_ID"
```

---

## 10. Error Handling

### 10.1 Network Errors
- [ ] Shows error message on API failure
- [ ] Retry option available
- [ ] Doesn't crash on network timeout

### 10.2 Validation Errors
- [ ] Form validation shows errors
- [ ] Required fields highlighted
- [ ] Error messages are helpful

### 10.3 AI Errors
- [ ] Handles AI service unavailable
- [ ] Falls back gracefully
- [ ] User informed of issue

---

## Known Issues (Expected Failures)

| Test | Expected Behavior | Reason |
|------|-------------------|--------|
| CustomerDetail activity timeline | Shows mock data | Not yet connected to DB |
| CustomerDetail engagement metrics | Shows 85%, 72%, 90% | Hardcoded values |
| Observability engagement metrics | Random values | Mock data pending usage_metrics |
| AppScript automations | Shows alert "Demo:" | Not implemented |
| Meeting transcription | Returns mock | No processing implemented |

---

## Test Results Template

```
Date: _______________
Tester: _______________
Environment: [ ] Local [ ] Staging [ ] Production

Section 1: Authentication     [ ] Pass [ ] Fail [ ] Partial
Section 2: Observability      [ ] Pass [ ] Fail [ ] Partial
Section 3: Agent Inbox        [ ] Pass [ ] Fail [ ] Partial
Section 4: Onboarding Flow    [ ] Pass [ ] Fail [ ] Partial
Section 5: AI Chat            [ ] Pass [ ] Fail [ ] Partial
Section 6: Workflows          [ ] Pass [ ] Fail [ ] Partial
Section 7: Customer Detail    [ ] Pass [ ] Fail [ ] Partial
Section 8: Knowledge Base     [ ] Pass [ ] Fail [ ] Partial
Section 9: API Health         [ ] Pass [ ] Fail [ ] Partial
Section 10: Error Handling    [ ] Pass [ ] Fail [ ] Partial

Notes:
_________________________________
_________________________________
_________________________________
```

---

## Regression Test (Quick Smoke)

For rapid verification after changes:

1. [ ] App loads without errors
2. [ ] Can view customer list
3. [ ] Can start new onboarding
4. [ ] Contract parsing works
5. [ ] Workspace creation succeeds
6. [ ] Customer appears in list
7. [ ] Agent chat responds
8. [ ] Chat messages saved (check Agent Inbox)
9. [ ] Approvals can be processed
10. [ ] No console errors
