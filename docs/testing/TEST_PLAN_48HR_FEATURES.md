# CSCX.AI 48-Hour Feature Test Plan

**Date**: 2026-02-03
**Coverage**: All features implemented in the last 48 hours
**Frontend**: http://localhost:5173
**Backend**: http://localhost:3001

---

## Part 1: E2E Automated Tests (Run First)

### Test Suite: Core Flows
```bash
# Run via webapp-testing skill
python scripts/with_server.py \
  --server "npm run dev" --port 5173 \
  --server "cd server && npm run dev" --port 3001 \
  -- python test_e2e.py
```

### Automated Test Cases

| ID | Test | Expected Result |
|----|------|-----------------|
| E2E-001 | Login with invite code 2362369 | Redirect to customer list |
| E2E-002 | Navigate to customer list | Grid shows customers |
| E2E-003 | Download CSV template | File downloads |
| E2E-004 | Import CSV with customers | Customers appear in list |
| E2E-005 | Click customer → detail view | Customer detail loads |
| E2E-006 | Open Agent Control Center | Chat UI visible |
| E2E-007 | Send test message | AI response streams |
| E2E-008 | Upload contract PDF | Contract parsed |

---

## Part 2: Chat Production Features (Manual + Visual Verification)

### CHAT-001: Copy Button on Code Blocks ✅
**How to test:**
1. Send message: "Show me a code example in Python"
2. Wait for AI to respond with code block
3. Hover over code block

**Expected:**
- ✅ Copy button appears (top-right corner)
- ✅ Clicking copies code to clipboard
- ✅ Shows "Copied!" for 2 seconds
- ✅ Button matches dark theme (#333 bg)

---

### CHAT-002: Keyboard Shortcuts ✅
**How to test:**
1. Focus chat input
2. Type a message
3. Press `Cmd+Enter` (Mac) or `Ctrl+Enter` (Win)
4. Press `Escape` when dropdown open
5. In empty input, press `Up Arrow`

**Expected:**
- ✅ Cmd+Enter sends message
- ✅ Escape closes dropdowns/modals
- ✅ Up arrow recalls previous message
- ✅ Down arrow navigates forward in history

---

### CHAT-003: Auto-Focus Input ✅
**How to test:**
1. Send a message
2. Notice where cursor is after send

**Expected:**
- ✅ Input automatically focused after send
- ✅ Can immediately type next message

---

### CHAT-004: Smooth Scroll to New Messages ✅
**How to test:**
1. Have 20+ messages in chat
2. Scroll up to middle
3. Trigger new message (quick action)

**Expected:**
- ✅ "New messages ↓" button appears at bottom
- ✅ Clicking scrolls smoothly to bottom
- ✅ Auto-scroll resumes when at bottom

---

### CHAT-005: Loading Skeletons ✅
**How to test:**
1. Clear browser storage
2. Navigate to customer detail with chat history
3. Observe loading state

**Expected:**
- ✅ 3 skeleton messages appear while loading
- ✅ Pulse animation visible
- ✅ Skeletons match message layout

---

### CHAT-006: Message Actions on Hover ✅
**How to test:**
1. Hover over any message (user or agent)
2. Click the copy button

**Expected:**
- ✅ Actions appear on hover (fade in)
- ✅ Copy copies message text
- ✅ Actions have backdrop blur

---

### CHAT-007: Optimistic Updates ✅
**How to test:**
1. Send a message
2. Observe the message appearance

**Expected:**
- ✅ Message appears instantly
- ✅ Shows subtle "sending" state (opacity)
- ✅ Updates to "sent" on confirmation
- ✅ Would show "failed" with retry on error

---

### CHAT-008 & 009: Offline Mode + Queue ✅
**How to test:**
1. Open DevTools → Network → Offline
2. Try sending a message
3. Observe banner
4. Go back online

**Expected:**
- ✅ "You are offline" banner appears (amber)
- ✅ Shows "(X messages queued)"
- ✅ Messages queued in localStorage
- ✅ Queue processes when back online

---

### CHAT-010: Markdown Table Rendering ✅
**How to test:**
1. Send: "Show me a comparison table of CS metrics"
2. Wait for AI response with table

**Expected:**
- ✅ Table renders as HTML table (not markdown)
- ✅ Header row has different styling
- ✅ Row hover highlights
- ✅ Horizontal scroll on narrow screens

---

### CHAT-011: Collapsible JSON Viewer ✅
**How to test:**
1. Send: "Show me a JSON example of customer health data"
2. Wait for AI response with JSON code block

**Expected:**
- ✅ JSON renders as collapsible viewer
- ✅ Shows preview (Object{...} or Array[...])
- ✅ Clicking expands/collapses
- ✅ Copy button copies formatted JSON

---

### CHAT-012: Intent Classifier ✅
**How to test:**
1. Type in input: "help me with onboarding"
2. Observe the input hint
3. Try: "I'm worried about churn risk"

**Expected:**
- ✅ Shows predicted agent (Onboarding Specialist)
- ✅ Shows confidence percentage
- ✅ Changes as you type different intents

---

### PERF-001: Virtualized Message List ✅
**How to test:**
1. Generate 100+ messages in a conversation
2. Scroll rapidly up and down
3. Check DevTools Performance tab

**Expected:**
- ✅ No lag or jank
- ✅ 60fps scrolling
- ✅ Only visible messages in DOM

---

### PERF-002: Code Splitting ✅
**How to test:**
1. Check Network tab on page load
2. Click "Start New Onboarding"
3. Check Network for new chunk

**Expected:**
- ✅ OnboardingFlow loads on demand (~27KB)
- ✅ Initial bundle is smaller
- ✅ Lazy chunks load without flash

---

## Part 3: Complex Manual Test Scenarios

### Scenario 1: Full Onboarding Workflow
**Steps:**
1. Login with invite code 2362369
2. Click "New Onboarding"
3. Upload a contract PDF
4. Wait for parsing
5. Review extracted data
6. Click "Create Workspace"
7. Verify Google Drive folder created
8. Send message asking to schedule kickoff

**Challenge Points:**
- Does contract parsing extract correct ARR?
- Are stakeholders correctly identified?
- Does the tracker spreadsheet have correct data?

---

### Scenario 2: Risk Escalation Flow
**Steps:**
1. Go to customer "Acme Corp" (or create one)
2. Send: "I'm concerned about this account, they haven't logged in for 2 weeks"
3. Observe agent routing (should go to Risk Specialist)
4. Ask for save play recommendations
5. Ask to draft an email to the champion

**Challenge Points:**
- Does intent classifier route to Risk?
- Does AI provide actionable save plays?
- Does email draft await approval?

---

### Scenario 3: QBR Preparation
**Steps:**
1. Select a customer with contract data
2. Send: "Help me prepare for the upcoming QBR"
3. Wait for agent response with metrics
4. Ask for a slide deck outline
5. Ask to schedule a prep meeting

**Challenge Points:**
- Does it pull correct metrics?
- Does it include renewal date context?
- Can it suggest stakeholders to invite?

---

### Scenario 4: Offline Resilience
**Steps:**
1. Go offline (DevTools → Network → Offline)
2. Send 3 messages
3. Verify queue count shows 3
4. Go back online
5. Verify all 3 messages send

**Challenge Points:**
- Do messages queue correctly?
- Do they send in order (FIFO)?
- Do optimistic updates resolve?

---

### Scenario 5: High-Volume Chat
**Steps:**
1. Open a conversation
2. Send 50+ rapid messages (use quick actions)
3. Scroll through entire history
4. Verify no lag or missing messages

**Challenge Points:**
- Is virtualization working (check DOM)?
- Are all messages preserved?
- Is scroll position maintained?

---

## Part 4: Backend API Tests

### Contract Parsing
```bash
curl -X POST http://localhost:3001/api/contracts/parse \
  -H "Content-Type: application/json" \
  -d '{"text": "Contract for Acme Corp, ARR $120,000..."}'
```

### Agent Chat
```bash
curl -X POST http://localhost:3001/api/agents/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "customerId": "test-123"}'
```

### Health Check
```bash
curl http://localhost:3001/health
```

---

## Success Criteria

| Category | Requirement | Status |
|----------|-------------|--------|
| Chat UX | All 12 CHAT stories pass | ⬜ |
| Performance | <3s initial load | ⬜ |
| Performance | 60fps scroll with 1000 msgs | ⬜ |
| Offline | Messages queue and send | ⬜ |
| E2E | Login → Chat → Response works | ⬜ |
| Backend | All API endpoints respond | ⬜ |

---

## Quick Start Commands

```bash
# Start frontend
cd "/Users/azizcamara/CSCX V7" && npm run dev

# Start backend (separate terminal)
cd "/Users/azizcamara/CSCX V7/server" && npm run dev

# Run E2E tests
cd "/Users/azizcamara/CSCX V7" && npm run test:e2e
```

---

## Reported Issues

| # | Description | Severity | Fixed? |
|---|-------------|----------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

*Test plan generated by Claude on 2026-02-03*
