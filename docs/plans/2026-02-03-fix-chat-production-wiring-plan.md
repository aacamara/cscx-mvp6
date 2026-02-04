---
title: "fix: Wire Chat Production Features to Backend"
type: fix
date: 2026-02-03
priority: critical
deepened: 2026-02-03
---

# Fix: Wire Chat Production Features to Backend

## Enhancement Summary

**Deepened on:** 2026-02-03
**Research agents used:** 6 (production-chat, react-performance, data-fetching, supabase, debugging, typescript-api)

### Key Improvements from Research
1. **Functional setState pattern** - Prevents race conditions in message updates
2. **useTransition for non-blocking updates** - Keep UI responsive during status changes
3. **Exponential backoff with jitter** - Production-grade retry logic for offline queue
4. **Supabase upsert with onConflict** - Proper deduplication using client_id
5. **Zod validation on API endpoints** - Runtime type safety for all inputs
6. **Partial indexes** - Performance optimization for status queries

## Overview

Manual testing revealed 80% failure rate on chat production features. The root cause: features exist as UI-only facades without proper backend integration. This plan fixes all broken wiring.

## Problem Statement

| Feature | Current State | Root Cause |
|---------|---------------|------------|
| Intent Classifier | Client-side regex | No backend AI endpoint |
| Message Status | Lost on reload | API doesn't persist `status`/`client_id` |
| Optimistic Updates | Facade only | No server reconciliation |
| Contract Parsing | Fails on save | Missing DB columns |
| Offline Queue | May not send | Need to verify online event handler |
| Retry Button | May not work | Need to verify resend logic |

## Research Findings

### Existing Patterns to Follow

**API Endpoint Pattern** (`server/src/routes/ai-analysis.ts:1-50`):
```typescript
router.post('/endpoint', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    // ... logic
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error', message: (error as Error).message });
  }
});
```

**Claude Service Usage** (`server/src/services/claude.ts:170-199`):
```typescript
const result = await claudeService.generate(prompt, systemPrompt, false); // false = fast model
```

**Supabase Insert** (`server/src/routes/chat.ts:35-86`):
```typescript
const { data, error } = await supabase
  .from('chat_messages')
  .insert({ /* fields including status, client_id */ })
  .select()
  .single();
```

### Key Insight
The `POST /api/chat/messages` endpoint at `server/src/routes/chat.ts:35-86` does NOT include `status` or `client_id` in the insert. This is why status is lost on reload.

## Implementation Plan

### Phase 1: Backend Fixes (Priority: Critical)

#### 1.1 Add Intent Classification Endpoint
**File:** `server/src/routes/agents.ts`

```typescript
// POST /api/agents/intent/classify
router.post('/intent/classify', async (req: Request, res: Response) => {
  try {
    const { message, customerId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const systemPrompt = `You are an intent classifier for a Customer Success platform.
Classify the user's message into ONE of these agent categories:
- onboarding: New customer setup, kickoff, 30-60-90 plans
- adoption: Feature usage, training, engagement
- renewal: Contract renewal, pricing, negotiation
- risk: Churn signals, escalation, save plays
- strategic: QBR, executive briefing, account planning
- general: Other inquiries

Respond with JSON only: {"agent": "category", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

    const result = await claudeService.generate(
      `Classify this message: "${message}"`,
      systemPrompt,
      false // Use fast model for speed
    );

    const parsed = JSON.parse(result);
    res.json(parsed);
  } catch (error) {
    console.error('Intent classification error:', error);
    res.status(500).json({
      error: 'Classification failed',
      // Fallback to general
      agent: 'general',
      confidence: 0.5,
      reasoning: 'Backend classification failed, using fallback'
    });
  }
});
```

#### 1.2 Update saveChatMessage to Persist Status
**File:** `server/src/routes/chat.ts` - Update POST /api/chat/messages

```typescript
// Add status and client_id to insert
const { data, error } = await supabase
  .from('chat_messages')
  .insert({
    customer_id: message.customer_id || null,
    user_id: message.user_id,
    role: message.role,
    content: message.content,
    agent_type: message.agent_type || null,
    tool_calls: message.tool_calls || [],
    session_id: message.session_id,
    status: message.status || 'sent',        // NEW
    client_id: message.client_id || null     // NEW
  })
  .select()
  .single();
```

#### 1.3 Update getChatHistory to Return Status
**File:** `server/src/routes/chat.ts` - Update GET /api/chat/history

```typescript
// Add status to select
const { data, error, count } = await supabase
  .from('chat_messages')
  .select('id, customer_id, user_id, role, content, agent_type, tool_calls, session_id, created_at, status, client_id', { count: 'exact' })
  // ... rest of query
```

#### 1.4 Fix Contract Parsing
**File:** `server/src/routes/contracts.ts`

Make `total_value`, `start_date`, `end_date` optional:
```typescript
// Build insert object with only existing columns
const insertData: any = {
  customer_id: customerId,
  file_name: fileName,
  // ... required fields
};

// Add optional fields only if they have values
if (totalValue) insertData.total_value = totalValue;
if (startDate) insertData.start_date = startDate;
if (endDate) insertData.end_date = endDate;
```

### Phase 2: Frontend Fixes

#### 2.1 Wire Intent Classifier to Backend
**File:** `components/AgentControlCenter/index.tsx`

```typescript
// Replace local classifyIntent with API call
const classifyIntent = useCallback(async (text: string) => {
  if (!text || text.length < 3) return null;

  try {
    const response = await fetch(`${API_URL}/api/agents/intent/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, customerId: customer?.id })
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Backend classification failed, using local fallback');
  }

  // Fallback to existing local classifier
  return localClassifyIntent(text);
}, [customer?.id]);

// Debounce the API call
useEffect(() => {
  const timeoutId = setTimeout(() => {
    if (input.length >= 3) {
      classifyIntent(input).then(setPredictedIntent);
    }
  }, 300); // 300ms debounce

  return () => clearTimeout(timeoutId);
}, [input, classifyIntent]);
```

#### 2.2 Implement Real Optimistic Updates
**File:** `components/AgentControlCenter/index.tsx`

```typescript
const sendToAgent = async (message: string, attachment?, existingMessageId?) => {
  // Generate client-side ID for deduplication
  const clientId = existingMessageId || crypto.randomUUID();

  // Add message optimistically with 'sending' status
  const optimisticMessage: AgentMessage = {
    id: clientId,
    isUser: true,
    agent: activeAgent,
    message,
    status: 'sending',
    attachment
  };

  if (!existingMessageId) {
    setMessages(prev => [...prev, optimisticMessage]);
  } else {
    setMessages(prev => prev.map(m =>
      m.id === existingMessageId ? { ...m, status: 'sending' } : m
    ));
  }

  try {
    // Save to backend with client_id
    const saveResponse = await fetch(`${API_URL}/api/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
      body: JSON.stringify({
        customer_id: customer?.id,
        user_id: DEMO_USER_ID,
        role: 'user',
        content: message,
        session_id: sessionId,
        status: 'sent',
        client_id: clientId
      })
    });

    if (saveResponse.ok) {
      const { message: savedMessage } = await saveResponse.json();
      // Update with server ID and sent status
      setMessages(prev => prev.map(m =>
        m.id === clientId ? { ...m, id: savedMessage.id, status: 'sent' } : m
      ));
    } else {
      throw new Error('Failed to save message');
    }

    // Continue with agent response...
  } catch (error) {
    // Mark as failed
    setMessages(prev => prev.map(m =>
      m.id === clientId ? { ...m, status: 'failed' } : m
    ));
  }
};
```

#### 2.3 Wire Retry Button
**File:** `components/AgentControlCenter/index.tsx`

```typescript
const handleRetryMessage = async (messageId: string, content: string) => {
  // Resend with same client_id for deduplication
  await sendToAgent(content, undefined, messageId);
};
```

#### 2.4 Load Status from History
**File:** `components/AgentControlCenter/index.tsx`

```typescript
// In loadChatHistory, include status
const loadedMessages: AgentMessage[] = data.messages
  .reverse()
  .map((msg: any) => ({
    id: msg.id,
    isUser: msg.role === 'user',
    agent: msg.agent_type as CSAgentType || 'onboarding',
    message: msg.content,
    timestamp: msg.created_at,
    status: msg.status || 'sent'  // Include status from backend
  }));
```

## Acceptance Criteria

### Must Pass
- [ ] Type "help with onboarding" → Backend returns `{ agent: 'onboarding', confidence: > 0.7 }`
- [ ] Send message → Reload page → Status still shows 'sent'
- [ ] Send message → Appears instantly with 'sending' indicator → Changes to 'sent'
- [ ] Fail to send → Shows 'failed' → Click retry → Resends successfully
- [ ] Go offline → Send message → Go online → Message sends automatically
- [ ] Parse contract → Saves to database without column errors
- [ ] `npx tsc --noEmit` passes

### Verification Steps
```bash
# Test intent classifier
curl -X POST http://localhost:3001/api/agents/intent/classify \
  -H "Content-Type: application/json" \
  -d '{"message": "help me onboard this new customer"}'

# Test contract parsing
curl -X POST http://localhost:3001/api/contracts/parse \
  -H "Content-Type: application/json" \
  -d '{"type":"text","content":"Contract with Acme Corp. ARR $120,000."}'

# Verify typecheck
cd "/Users/azizcamara/CSCX V7" && npx tsc --noEmit
```

## Files to Modify

| File | Changes |
|------|---------|
| `server/src/routes/agents.ts` | Add `/intent/classify` endpoint |
| `server/src/routes/chat.ts` | Add `status`, `client_id` to insert and select |
| `server/src/routes/contracts.ts` | Make optional columns conditional |
| `components/AgentControlCenter/index.tsx` | Wire classifier, optimistic updates, retry |

## Dependencies

- Migration `20260203000001_chat_production_features.sql` must be run
- Migration `20260203000002_fix_contracts_columns.sql` should be run (or use conditional insert)
- Claude API key configured
- Supabase connection working

## Risk Mitigation

1. **Backend classifier fails** → Fallback to existing local regex classifier
2. **Supabase not configured** → Existing no-DB fallback handles gracefully
3. **Migration not run** → Conditional insert handles missing columns

## Success Metrics

- 100% of manual tests pass
- No TypeScript errors
- Intent classification < 500ms response time
- Messages persist across page reloads

---

## Research Insights (from /deepen-plan)

### React Performance Best Practices

**Functional setState Pattern** - Critical for message updates:
```typescript
// WRONG - can cause race conditions
setMessages([...messages, newMessage]);

// CORRECT - always use functional form
setMessages(prev => [...prev, newMessage]);
```

**useTransition for Status Updates** - Keep UI responsive:
```typescript
const [isPending, startTransition] = useTransition();

const updateMessageStatus = (id: string, status: string) => {
  startTransition(() => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, status } : m
    ));
  });
};
```

**useCallback Dependencies** - Memoize correctly:
```typescript
const classifyIntent = useCallback(async (text: string) => {
  // ... classification logic
}, [customer?.id]); // Only recreate when customer changes
```

### Data Fetching Best Practices

**Exponential Backoff with Jitter** - Production retry logic:
```typescript
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      const jitter = delay * 0.1 * Math.random();
      await new Promise(r => setTimeout(r, delay + jitter));
    }
  }
};
```

**AbortController for Debounced Requests** - Cancel stale requests:
```typescript
useEffect(() => {
  const controller = new AbortController();
  const timeoutId = setTimeout(async () => {
    try {
      const result = await classifyIntent(input, controller.signal);
      setPredictedIntent(result);
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  }, 300);

  return () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
}, [input]);
```

### Supabase/Postgres Best Practices

**Upsert with onConflict** - Proper deduplication:
```typescript
const { data, error } = await supabase
  .from('chat_messages')
  .upsert({
    client_id: clientId,
    customer_id: customerId,
    content: message,
    status: 'sent'
  }, {
    onConflict: 'client_id',
    ignoreDuplicates: false // Update on conflict
  })
  .select()
  .single();
```

**Partial Index for Status Queries** - Performance optimization:
```sql
-- Add to migration
CREATE INDEX idx_chat_messages_status_partial
ON chat_messages (status)
WHERE status IN ('sending', 'failed');
```

### TypeScript API Best Practices

**Zod Validation on Endpoints** - Runtime type safety:
```typescript
import { z } from 'zod';

const ClassifyIntentSchema = z.object({
  message: z.string().min(1).max(5000),
  customerId: z.string().uuid().optional()
});

router.post('/intent/classify', async (req, res) => {
  const result = ClassifyIntentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }
  // ... use result.data
});
```

**Error Classes for Better Handling**:
```typescript
class ClassificationError extends Error {
  constructor(message: string, public readonly fallback: IntentResult) {
    super(message);
    this.name = 'ClassificationError';
  }
}
```

### Edge Cases to Handle

1. **Race condition in rapid typing** - Use AbortController to cancel stale requests
2. **Duplicate messages on retry** - Use client_id with upsert
3. **Status stuck on 'sending'** - Add timeout and automatic failure marking
4. **Offline → Online transition** - Process queue with retry logic, not all at once
5. **Large message history** - Paginate with cursor, not offset
