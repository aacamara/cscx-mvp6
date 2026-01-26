# CSCX.AI - Next Steps Implementation Plan

## Overview
Complete these 5 features to finalize the MVP.

---

## 1. Email Sending
**Status:** COMPLETED
**Goal:** Wire up Gmail API to actually send emails after user approval

### What needs to be done:
- The `draft_email` tool already creates approval requests
- The `executeSendEmail` method exists in `approval.ts`
- Need to verify Gmail API `sendEmail` is working end-to-end
- Test: Ask AI to draft email → Approve → Email is sent

### Files:
- `/server/src/services/approval.ts` - executeSendEmail()
- `/server/src/services/google/gmail.ts` - sendEmail()

---

## 2. Customer Context
**Status:** COMPLETED
**Goal:** Connect AI to actual customer records so it knows who you're working with

### What needs to be done:
- Add customer selector or auto-detect from conversation
- Pass customer data (name, ARR, health score, history) to WorkflowAgent
- AI responses become customer-specific
- "Draft email to Acme Corp" uses their actual contact info

### Files:
- `/server/src/routes/langchain.ts` - Pass customer context to agent
- `/server/src/langchain/agents/WorkflowAgent.ts` - Use customer context
- `/components/AIAssistant.tsx` - Customer selector UI

---

## 3. Production Hardening
**Status:** COMPLETED
**Goal:** Add reliability features for production use

### What needs to be done:
- **Health Checks:** Real connectivity tests for Supabase, Claude, Gemini
- **Circuit Breakers:** Prevent cascade failures when APIs are down
- **Retry Logic:** Exponential backoff for transient failures
- **Integration Tests:** 40% coverage on critical paths

### Files to create:
- `/server/src/services/health.ts`
- `/server/src/services/circuitBreaker.ts`
- `/server/src/services/retry.ts`
- `/server/src/test/` - Test files

---

## 4. UI Improvements
**Status:** COMPLETED
**Goal:** Better user experience in approvals and responses

### What needs to be done:
- Show full email body in approval preview (expandable)
- Display Google Meet link after meeting is created
- Show success/failure feedback after approval execution
- Add "Edit before sending" option for emails

### Files:
- `/components/PendingApprovals.tsx` - Enhanced previews
- `/components/AIAssistant.tsx` - Show action results

---

## 5. Task Management
**Status:** COMPLETED
**Goal:** Wire up create_task to actually create tasks in your system

### What needs to be done:
- The `create_task` tool creates approval requests
- `executeCreateTask` saves to Supabase `google_tasks` table
- Add tasks display in UI
- Optionally sync with Google Tasks API

### Files:
- `/server/src/services/approval.ts` - executeCreateTask()
- `/components/TaskList.tsx` - New component to display tasks

---

## Progress Tracking

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Email Sending | COMPLETED | Fixed body field mismatch, `to` required |
| 2 | Customer Context | COMPLETED | Customer selector in sidebar, context to AI |
| 3 | Production Hardening | COMPLETED | Health checks, circuit breakers, retry logic |
| 4 | UI Improvements | COMPLETED | Expandable email previews, success notifications |
| 5 | Task Management | COMPLETED | Tasks API, TaskList component, logging |

---

## ALL 5 MVP FEATURES COMPLETED

*Last Updated: January 14, 2026*
