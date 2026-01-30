# PRD-223: Conversation Context Retention

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-223 |
| **Title** | Conversation Context Retention |
| **Category** | H: AI-Powered Features |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Current AI interactions are often stateless or have limited context windows. CSMs have to repeat context when continuing conversations, switching between accounts, or returning after a break. The AI assistant should remember previous conversations, understand ongoing work, and maintain context across sessions to provide truly intelligent, continuous assistance.

## User Stories

### Primary User Stories
1. **As a CSM**, I want the AI to remember what we discussed yesterday about a specific account.
2. **As a CSM**, I want to say "continue where we left off" and have the AI know what I mean.
3. **As a CSM**, I want the AI to remember my preferences and working style.
4. **As a CSM**, I want context automatically loaded when I switch to a different customer.
5. **As a CSM**, I want the AI to reference relevant past conversations without me asking.

### Secondary User Stories
1. **As a CSM**, I want to search through past AI conversations.
2. **As a CSM**, I want to clear/reset context when starting fresh.
3. **As a CSM**, I want different conversation threads for different topics.

## Acceptance Criteria

### Core Functionality
- [ ] Persist conversation history across browser sessions
- [ ] Maintain per-customer conversation context
- [ ] Remember user preferences and patterns
- [ ] Intelligent context loading (relevant history, not everything)
- [ ] Cross-session continuity ("what were we doing with TechCorp?")

### Context Types
- [ ] **Conversation History**: Past messages and responses
- [ ] **Customer Context**: Last discussed topics, pending actions per account
- [ ] **User Preferences**: Communication style, common requests, shortcuts
- [ ] **Work State**: In-progress tasks, drafts, pending approvals
- [ ] **Knowledge Context**: Playbooks accessed, documentation referenced

### Memory Management
- [ ] Automatic summarization of old conversations
- [ ] Priority retention (important context kept longer)
- [ ] Context window optimization for model limits
- [ ] Explicit memory controls (remember this, forget that)

## Technical Specification

### Architecture

```
User Message → Context Retriever → Context Selector → Prompt Builder → Claude → Response → Memory Writer
                     ↓                    ↓
              Memory Store         Relevance Scorer
```

### Memory Store Structure

```typescript
interface MemoryStore {
  // Conversation memories
  conversations: ConversationMemory[];

  // Customer-specific memories
  customer_contexts: Map<string, CustomerContext>;

  // User-level memories
  user_preferences: UserPreferences;

  // Work state
  work_state: WorkState;
}

interface ConversationMemory {
  id: string;
  customer_id: string | null;
  timestamp: Date;
  messages: Message[];
  summary: string;
  key_topics: string[];
  action_items: string[];
  importance_score: number;
}

interface CustomerContext {
  customer_id: string;
  last_discussed: Date;
  recent_topics: string[];
  pending_actions: string[];
  key_decisions: string[];
  relationship_notes: string[];
  sentiment_history: number[];
}

interface UserPreferences {
  communication_style: 'formal' | 'casual' | 'brief';
  preferred_actions: string[];  // Common requests
  timezone: string;
  working_hours: { start: string; end: string };
  email_signature: string;
}

interface WorkState {
  active_customer_id: string | null;
  pending_drafts: Draft[];
  in_progress_tasks: Task[];
  recent_searches: string[];
}
```

### Context Retrieval Algorithm

```typescript
async function retrieveRelevantContext(
  currentMessage: string,
  customerId: string | null,
  userId: string
): Promise<RelevantContext> {
  const contextSources = await Promise.all([
    // Recent conversation history (last N messages)
    getRecentConversation(userId, customerId, 10),

    // Relevant past conversations (semantic search)
    searchRelevantConversations(currentMessage, userId, customerId),

    // Customer context if applicable
    customerId ? getCustomerContext(userId, customerId) : null,

    // User preferences
    getUserPreferences(userId),

    // Current work state
    getWorkState(userId)
  ]);

  // Score and select most relevant context within token budget
  return selectContext(contextSources, MAX_CONTEXT_TOKENS);
}

function selectContext(
  sources: ContextSource[],
  tokenBudget: number
): RelevantContext {
  // Prioritize:
  // 1. Current session messages (most recent)
  // 2. Customer-specific context
  // 3. Relevant past conversations
  // 4. User preferences
  // 5. Work state

  const scored = sources.flatMap(s =>
    s.items.map(item => ({
      ...item,
      score: calculateRelevanceScore(item)
    }))
  ).sort((a, b) => b.score - a.score);

  let selected: ContextItem[] = [];
  let currentTokens = 0;

  for (const item of scored) {
    const itemTokens = estimateTokens(item);
    if (currentTokens + itemTokens <= tokenBudget) {
      selected.push(item);
      currentTokens += itemTokens;
    }
  }

  return { items: selected, totalTokens: currentTokens };
}
```

### Memory Writing

```typescript
async function updateMemory(
  session: ConversationSession,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  // Store conversation turn
  await storeConversationTurn(session.id, userMessage, assistantResponse);

  // Extract and store key information
  const extraction = await extractKeyInfo(userMessage, assistantResponse);

  if (extraction.action_items.length > 0) {
    await updatePendingActions(session.customer_id, extraction.action_items);
  }

  if (extraction.decisions.length > 0) {
    await storeDecisions(session.customer_id, extraction.decisions);
  }

  if (extraction.preference_signals.length > 0) {
    await updateUserPreferences(session.user_id, extraction.preference_signals);
  }

  // Summarize older conversations if needed
  await maybeSummarizeOldConversations(session.user_id);
}

async function extractKeyInfo(
  userMessage: string,
  assistantResponse: string
): Promise<ExtractionResult> {
  const prompt = `
    Analyze this conversation turn and extract:
    1. Any action items or commitments made
    2. Key decisions or conclusions
    3. User preference signals (communication style, preferred approaches)
    4. Important information to remember for future reference

    User: ${userMessage}
    Assistant: ${assistantResponse}
  `;

  return await claude.analyze(prompt);
}
```

### API Endpoints

#### GET /api/context/{customer_id}
Returns current context for a customer conversation.

```json
{
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "recent_conversation": {
    "last_interaction": "2026-01-28T15:30:00Z",
    "summary": "Discussed renewal pricing and expansion options",
    "pending_actions": [
      "Send pricing proposal for additional seats",
      "Schedule exec briefing"
    ]
  },
  "key_context": {
    "relationship_status": "Healthy but needs executive engagement",
    "recent_topics": ["renewal", "expansion", "new features"],
    "sentiment_trend": "stable"
  },
  "previous_sessions": [
    {
      "date": "2026-01-25",
      "summary": "QBR planning discussion"
    },
    {
      "date": "2026-01-20",
      "summary": "Support escalation follow-up"
    }
  ]
}
```

#### POST /api/context/remember
Explicitly save something to memory.

```json
{
  "customer_id": "uuid",
  "memory_type": "note" | "preference" | "decision",
  "content": "Sarah prefers email over phone",
  "importance": "high"
}
```

#### POST /api/context/forget
Remove specific context.

```json
{
  "memory_ids": ["uuid1", "uuid2"],
  "scope": "specific" | "customer" | "all"
}
```

### Database Schema

```sql
CREATE TABLE conversation_memories (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_id UUID,
  session_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  importance_score INTEGER DEFAULT 50,
  embedding vector(1536),
  metadata JSONB
);

CREATE TABLE customer_contexts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_id UUID NOT NULL,
  last_discussed TIMESTAMPTZ,
  recent_topics TEXT[],
  pending_actions JSONB,
  key_decisions JSONB,
  relationship_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, customer_id)
);

CREATE TABLE user_memories (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  memory_type VARCHAR(50),
  content TEXT NOT NULL,
  importance VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_conv_memories_user_customer ON conversation_memories(user_id, customer_id, timestamp DESC);
CREATE INDEX idx_conv_memories_embedding ON conversation_memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_customer_contexts_user ON customer_contexts(user_id);
```

## UI/UX Design

### Context Indicator
```
┌─────────────────────────────────────────────────────────┐
│ AI ASSISTANT                     TechCorp Industries    │
├─────────────────────────────────────────────────────────┤
│ 📝 Context: Last discussed 1 day ago                    │
│    Topics: renewal pricing, expansion                   │
│    Pending: Send pricing proposal                       │
│    [Clear Context] [View History]                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 💬 Messages...                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Continue Conversation
```
User: "What were we working on?"

AI: Based on our last conversation about TechCorp:

**Yesterday (Jan 28):**
- Discussed renewal pricing options
- You asked for a proposal with expansion pricing
- Pending: Send pricing proposal to Sarah

**Earlier this week:**
- QBR planning (Jan 25)
- Support escalation follow-up (Jan 20) - resolved

Would you like to continue with the pricing proposal, or start
something new?

[Continue Proposal] [New Topic] [View Full History]
```

### Memory Management UI
```
┌─────────────────────────────────────────────────────────┐
│ MEMORY MANAGEMENT                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ EXPLICIT MEMORIES                                       │
│ ─────────────────                                       │
│ ☑ TechCorp: Sarah prefers email communication           │
│ ☑ Acme: Budget approval needed from CFO                 │
│ ☑ General: Use formal tone in emails                    │
│ [Add Memory]                                            │
│                                                         │
│ CUSTOMER CONTEXTS (Auto-maintained)                     │
│ ───────────────────────────────────                     │
│ TechCorp - Updated 1 day ago                            │
│   Recent: renewal, expansion, pricing                   │
│   Pending: Send proposal                                │
│   [View] [Clear]                                        │
│                                                         │
│ Acme Corp - Updated 3 days ago                          │
│   Recent: QBR, success metrics                          │
│   Pending: None                                         │
│   [View] [Clear]                                        │
│                                                         │
│ CONVERSATION HISTORY                                    │
│ ──────────────────────                                  │
│ • 847 messages across 45 accounts                       │
│ • Oldest: 90 days ago (summarized)                      │
│ [Search History] [Export] [Clear Old]                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Vector database for semantic search (pgvector)
- Message storage (existing chat_messages table)
- Claude API for extraction and summarization
- Redis for session state caching

### Related PRDs
- PRD-211: Natural Language Account Query
- PRD-219: AI-Powered Universal Search
- PRD-081: Account Notes Search

## Success Metrics

### Quantitative
- Context relevance: 90% of retrieved context is used
- Repeat queries reduced by 60%
- Session continuity: 80% of multi-day interactions reference context
- Memory retrieval latency < 500ms

### Qualitative
- AI feels like it "knows" the user and accounts
- Less repetition in conversations
- Smoother multi-session workflows

## Rollout Plan

### Phase 1: Basic History (Week 1-2)
- Per-session conversation persistence
- Recent history retrieval
- Basic context display

### Phase 2: Customer Context (Week 3-4)
- Per-customer context tracking
- Topic and action extraction
- Context switching UI

### Phase 3: Semantic Search (Week 5-6)
- Vector embeddings for conversations
- Relevant history retrieval
- "What were we doing?" support

### Phase 4: Intelligence (Week 7-8)
- User preference learning
- Automatic summarization
- Memory management UI

## Open Questions
1. How long should we retain detailed conversation history?
2. Should context be shared across team members?
3. How do we handle context for sensitive topics?
4. What's the right balance between memory and freshness?
