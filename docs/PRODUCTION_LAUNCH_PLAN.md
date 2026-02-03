# CSCX.AI Production Launch Plan

**Goal:** Launch with 100 users next week
**Current Status:** 80% production ready (revised after verification)
**Remaining Work:** 2 critical PRDs

---

## Verification Results (2024-01-28)

### ✅ WORKING - No Tasks Needed
| Feature | Evidence |
|---------|----------|
| Gmail Send | `gmail.users.messages.send()` in `gmail.ts:282-316` |
| Gmail Draft | `gmail.users.drafts.create()` in `gmail.ts:318-350` |
| Calendar Events | `calendar.events.insert()` in `calendar.ts:175-224` |
| Google Meet | Auto-generated with conferenceDataVersion |
| Token Refresh | 5-minute buffer in `oauth.ts:246-275` |
| Customer Persistence | Full CRUD to Supabase |
| Contract Persistence | Metadata + extracted data saved |
| Agent Sessions | Messages and context preserved |
| User Profiles | Auth + profile data |
| Agent Tools | HITL approval flow working |

### ⚠️ NEEDS WORK - 2 PRDs Required
| Issue | Severity | PRD |
|-------|----------|-----|
| RLS Not Enabled | 🔴 Critical | `prd-production-security-hardening.md` |
| No SSE Streaming | 🔴 Critical | `prd-streaming-chat.md` |

---

## Revised Battle Plan

```
Day 1-2: Security Hardening (Ralph Loop 1)
├── Enable RLS on all tables
├── Enforce JWT authentication
├── Remove demo user fallback
└── Create migration file

Day 2-3: Streaming Chat (Ralph Loop 2)
├── SSE endpoint for chat
├── Stream Gemini/Claude responses
├── Update ChatPanel UI
└── Add cancel button

Day 4: Integration Testing
├── Manual test checklist
├── Fix any issues found
└── Deploy to staging

Day 5: Deploy & Soft Launch
├── Deploy to Cloud Run
├── Invite 10 beta users
└── Monitor closely

Day 6-7: Scale to 100 Users
├── Onboard in batches of 20
├── Fix issues as they arise
└── Compound learnings
```

---

## PRD Execution Order

### Loop 1: Security Hardening (CRITICAL)
```bash
cd /Users/azizcamara/cscx-v5

# Convert PRD to prd.json
# Use Claude: "Load the tasks skill. Convert tasks/prd-production-security-hardening.md to scripts/ralph/prd.json"

# Run Ralph loop
./scripts/ralph/ralph.sh --tool claude 15
```

**User Stories:**
1. US-001: Enable RLS on customers table
2. US-002: Enable RLS on contracts table
3. US-003: Enable RLS on agent_sessions table
4. US-004: Enable RLS on tasks table
5. US-005: Enforce JWT authentication
6. US-006: Remove demo user fallback
7. US-007: Create database migration

### Loop 2: Streaming Chat (CRITICAL UX)
```bash
cd /Users/azizcamara/cscx-v5
git checkout -b ralph/streaming-chat

# Convert PRD to prd.json
# Use Claude: "Load the tasks skill. Convert tasks/prd-streaming-chat.md to scripts/ralph/prd.json"

# Run Ralph loop
./scripts/ralph/ralph.sh --tool claude 15
```

**User Stories:**
1. US-001: Implement SSE endpoint
2. US-002: Stream Gemini responses
3. US-003: Stream Claude responses
4. US-004: Stream tool call events
5. US-005: Update ChatPanel for streaming
6. US-006: Add cancel button
7. US-007: Handle connection errors
8. US-008: Maintain message history

---

## What's NOT Needed (Already Working)

These PRDs/tasks are **COMPLETE** based on verification:

- ~~prd-google-workspace-completion.md~~ → Gmail/Calendar working
- ~~Agent tools implementation~~ → HITL approval flow working
- ~~Token refresh~~ → 5-minute buffer working
- ~~Data persistence~~ → All core data flows persist

---

## Parallel Execution

You can run both loops in parallel on separate branches:

**Terminal 1 - Security:**
```bash
cd /Users/azizcamara/cscx-v5
git checkout -b ralph/security-hardening
./scripts/ralph/ralph.sh --tool claude 15
```

**Terminal 2 - Streaming:**
```bash
cd /Users/azizcamara/cscx-v5
git checkout -b ralph/streaming-chat
./scripts/ralph/ralph.sh --tool claude 15
```

---

## Manual Testing Checklist (Day 4)

- [ ] Sign up new user → Works
- [ ] User A cannot see User B's customers → RLS working
- [ ] API call without token returns 401 → Auth enforced
- [ ] Upload contract → Parses correctly
- [ ] Chat with agent → Streams responses (not 60s wait)
- [ ] Agent drafts email → Appears in Gmail drafts
- [ ] Approve email → Actually sends
- [ ] Book meeting → Appears on calendar with Meet link
- [ ] Stop button → Cancels streaming

---

## Success Criteria

### Before Launch:
- [ ] All security tests pass (RLS enabled, JWT enforced)
- [ ] Chat streams in <2 seconds to first token
- [ ] No cross-tenant data leaks

### Week 1 Complete:
- [ ] 10 beta users active without critical bugs
- [ ] <5 support tickets per day

### Week 2 Complete:
- [ ] 100 users onboarded
- [ ] Compound Product running nightly

---

## Quick Reference

```bash
# Start Ralph loop
./scripts/ralph/ralph.sh --tool claude 10

# Check progress
cat scripts/ralph/progress.txt

# Deploy
gcloud builds submit --config=cloudbuild.yaml

# Check production logs
gcloud run services logs read cscx-api --limit=100
```
