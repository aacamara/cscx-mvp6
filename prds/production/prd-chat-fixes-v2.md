# PRD: Chat Production Fixes V2

## Overview
Fix all broken chat features identified in the 48-hour audit. The current implementation has several features that are UI-only facades without proper backend integration.

## Problem Statement
Manual testing revealed 80% failure rate:
1. Intent classifier is client-side regex only - no AI
2. Message status not persisted - lost on reload
3. Optimistic updates are facade - no real reconciliation
4. Contract parsing fails - missing database columns

## Prime Directive
**Wire up the backend. Make features real, not facades.**

---

## User Stories

### FIX-001: Backend Intent Classifier
**Description**: Replace client-side keyword matching with real AI-powered intent classification.

**Current State**: `components/AgentControlCenter/index.tsx:197-248` has a `classifyIntent()` function that does pure regex/keyword matching locally.

**Acceptance Criteria**:
- Create `POST /api/agents/intent/classify` endpoint
- Use Claude to analyze message intent
- Return: `{ agent: string, confidence: number, reasoning: string }`
- Classify into: onboarding, adoption, renewal, risk, strategic, general
- Response time < 500ms (use fast model)
- Frontend calls backend instead of local function
- Fallback to local classifier if backend fails
- Typecheck passes

**Technical Notes**:
- Add endpoint to `server/src/routes/agents.ts`
- Use `claudeService.generate()` with JSON output
- Cache recent classifications to reduce API calls

---

### FIX-002: Persist Message Status
**Description**: Store message delivery status in database, not just React state.

**Current State**: Status only exists in frontend state (`sending`, `sent`, `failed`). Lost on page reload.

**Acceptance Criteria**:
- Add `status` column to `chat_messages` table (migration exists)
- Update `saveChatMessage()` to include status
- Update `getChatHistory()` to return status
- Frontend receives status from backend on history load
- Status updates when message confirmed by server
- Failed messages show retry button that works
- Typecheck passes

**Technical Notes**:
- Migration already created: `20260203000001_chat_production_features.sql`
- Update `server/src/services/supabase.ts` - `saveChatMessage()` method
- Update chat history endpoint to return status field

---

### FIX-003: Real Optimistic Updates
**Description**: Implement proper optimistic update pattern with server reconciliation.

**Current State**: Message appears instantly but no real confirmation loop. If server fails silently, message shows as sent but isn't.

**Acceptance Criteria**:
- Generate client-side message ID before sending
- Show message immediately with `status: 'sending'`
- Wait for server response with real message ID
- Update local message with server ID and `status: 'sent'`
- On failure: set `status: 'failed'`, show retry button
- Retry actually resends to server
- Duplicate prevention using client_id
- Typecheck passes

**Technical Notes**:
- Use `crypto.randomUUID()` for client-side ID
- Backend should accept and store `client_id` for deduplication
- Return server-generated ID in response

---

### FIX-004: Fix Contract Parsing Database
**Description**: Add missing columns to contracts table so parsing can save.

**Current State**: Contract parsing works but fails on database save with "Could not find the 'total_value' column".

**Acceptance Criteria**:
- Add `total_value` DECIMAL column to contracts
- Add `start_date` DATE column to contracts
- Add `end_date` DATE column to contracts
- Contract parsing saves successfully
- Return parsed data to frontend
- Typecheck passes

**Technical Notes**:
- Migration already created: `20260203000002_fix_contracts_columns.sql`
- User needs to run migration in Supabase
- Verify save works after migration

---

### FIX-005: Wire Offline Queue to Real Send
**Description**: Ensure offline queue actually sends messages when back online.

**Current State**: Messages queue to localStorage but may not actually send reliably on reconnect.

**Acceptance Criteria**:
- Queue processes automatically when online event fires
- Each queued message sent with retry logic
- Success removes from queue
- Failure keeps in queue with retry count
- Max 3 retries before marking failed
- User sees queue processing indicator
- Typecheck passes

**Technical Notes**:
- Check `hooks/useOnlineStatus.ts` implementation
- Verify `processQueue()` is called on online event
- Add exponential backoff for retries

---

### FIX-006: Message Retry Actually Works
**Description**: Clicking retry on a failed message should resend it.

**Current State**: Retry button exists but may not be wired to actual resend logic.

**Acceptance Criteria**:
- Failed messages show retry button
- Clicking retry resends the message
- Message status updates to 'sending' then 'sent' or 'failed'
- Original message ID preserved or new one assigned
- Works for both online failures and offline queue items
- Typecheck passes

**Technical Notes**:
- Check `handleRetryMessage` in AgentControlCenter
- Ensure it calls `sendToAgent` with correct params
- Update message in state after retry

---

## Out of Scope
- Redesigning UI components
- Adding new features beyond fixing existing
- Database schema redesign
- Authentication changes

## Success Metrics
- 100% of manual tests pass
- Intent classifier uses real AI
- Message status persists across page reloads
- Contract parsing saves to database
- Offline messages send on reconnect
- Failed messages can be retried

## Dependencies
- Supabase migrations must be run first
- Claude API key must be configured
- Backend server must be running

## Testing Checklist
After implementation, verify:
- [ ] Send message → reload → status still shows 'sent'
- [ ] Type "help with onboarding" → backend classifies as onboarding agent
- [ ] Go offline → send message → go online → message sends
- [ ] Parse contract → saves to database with all fields
- [ ] Failed message → click retry → message sends
