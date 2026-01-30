# PRD-249: Internal Discussion Thread

## Metadata
- **PRD ID**: PRD-249
- **Title**: Internal Discussion Thread
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-241 (@Mention), PRD-248 (Collaborative Notes)

---

## Problem Statement

When CSMs need to discuss customer situations with colleagues (getting advice, coordinating strategy, sharing updates), conversations happen in Slack, email, or in-person - all disconnected from the customer context in CSCX.AI. This makes it hard to track what was discussed and decided about a customer.

## User Story

> As a CSM, I want to start internal discussion threads about customers within CSCX.AI, @mention relevant colleagues, and have the full conversation history linked to the customer record so that team knowledge is preserved and discoverable.

---

## Functional Requirements

### FR-1: Thread Creation
- **FR-1.1**: Start thread from customer detail page
- **FR-1.2**: Link thread to specific context (deal, risk, opportunity, general)
- **FR-1.3**: Set thread topic/title
- **FR-1.4**: @mention initial participants
- **FR-1.5**: Mark urgency level

### FR-2: Discussion Features
- **FR-2.1**: Threaded replies (nested conversations)
- **FR-2.2**: Rich text formatting in messages
- **FR-2.3**: @mention additional participants
- **FR-2.4**: React with emoji
- **FR-2.5**: Attach files and images
- **FR-2.6**: Link to related entities

### FR-3: Notifications
- **FR-3.1**: In-app notification for new messages
- **FR-3.2**: Email digest for unread discussions
- **FR-3.3**: Slack notification option
- **FR-3.4**: Follow/unfollow thread
- **FR-3.5**: Mute thread temporarily

### FR-4: Thread Management
- **FR-4.1**: Mark thread as resolved
- **FR-4.2**: Pin important threads
- **FR-4.3**: Archive old threads
- **FR-4.4**: Summary generation (AI)
- **FR-4.5**: Convert to action item

### FR-5: Discovery
- **FR-5.1**: Thread list on customer page
- **FR-5.2**: Personal thread inbox (all participating)
- **FR-5.3**: Search threads by content
- **FR-5.4**: Filter by status, participants, date

---

## Non-Functional Requirements

### NFR-1: Performance
- Thread loads < 500ms
- Real-time message delivery < 1 second

### NFR-2: Scalability
- Support 1000+ messages per thread
- Handle 100+ threads per customer

### NFR-3: Privacy
- Threads are internal only (never customer-visible)

---

## Technical Approach

### Data Model Extensions

```sql
-- discussion_threads table
CREATE TABLE discussion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  created_by_user_id UUID REFERENCES users(id) NOT NULL,

  -- Thread info
  title VARCHAR(500) NOT NULL,
  context_type VARCHAR(50), -- 'general', 'risk', 'opportunity', 'renewal', 'escalation'
  context_id UUID, -- Optional link to specific entity

  -- Status
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'resolved', 'archived'
  urgency VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  is_pinned BOOLEAN DEFAULT false,

  -- Summary (AI generated)
  summary TEXT,
  summary_updated_at TIMESTAMPTZ,

  -- Stats
  message_count INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  resolved_by_user_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- discussion_messages table
CREATE TABLE discussion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES discussion_threads(id) ON DELETE CASCADE,
  parent_message_id UUID REFERENCES discussion_messages(id), -- For nested replies
  user_id UUID REFERENCES users(id) NOT NULL,

  -- Content
  content TEXT NOT NULL,
  content_html TEXT, -- Rendered HTML
  attachments JSONB DEFAULT '[]',

  -- Metadata
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- thread_participants
CREATE TABLE thread_participants (
  thread_id UUID REFERENCES discussion_threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'participant', -- 'creator', 'participant', 'mentioned'
  is_following BOOLEAN DEFAULT true,
  is_muted BOOLEAN DEFAULT false,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

-- message_reactions
CREATE TABLE message_reactions (
  message_id UUID REFERENCES discussion_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  emoji VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX idx_threads_customer ON discussion_threads(customer_id);
CREATE INDEX idx_threads_status ON discussion_threads(status);
CREATE INDEX idx_messages_thread ON discussion_messages(thread_id, created_at);
CREATE INDEX idx_participants_user ON thread_participants(user_id);
CREATE INDEX idx_threads_fulltext ON discussion_threads USING GIN(to_tsvector('english', title));
```

### Real-Time Messaging

```typescript
// WebSocket events
interface ThreadWSEvents {
  'thread:message': { threadId: string; message: Message };
  'thread:typing': { threadId: string; userId: string };
  'thread:reaction': { threadId: string; messageId: string; reaction: Reaction };
  'thread:status': { threadId: string; status: string };
}

// Server-side handler
async function handleNewMessage(threadId: string, userId: string, content: string) {
  const message = await createMessage(threadId, userId, content);

  // Extract @mentions
  const mentions = extractMentions(content);
  await addParticipants(threadId, mentions);

  // Notify participants via WebSocket
  const participants = await getParticipants(threadId);
  broadcastToUsers(participants, 'thread:message', { threadId, message });

  // Send push notifications to offline users
  const offlineUsers = participants.filter(p => !isUserOnline(p.user_id) && !p.is_muted);
  await sendPushNotifications(offlineUsers, {
    title: `New message in "${thread.title}"`,
    body: truncate(content, 100),
    link: `/customers/${thread.customer_id}/threads/${threadId}`
  });

  return message;
}
```

### API Endpoints

```typescript
// Thread CRUD
POST   /api/threads
GET    /api/threads
GET    /api/threads/:id
PATCH  /api/threads/:id
DELETE /api/threads/:id

// Messages
POST   /api/threads/:id/messages
GET    /api/threads/:id/messages
PATCH  /api/threads/:id/messages/:messageId
DELETE /api/threads/:id/messages/:messageId

// Reactions
POST   /api/threads/:id/messages/:messageId/reactions
DELETE /api/threads/:id/messages/:messageId/reactions/:emoji

// Participants
GET    /api/threads/:id/participants
POST   /api/threads/:id/participants
PATCH  /api/threads/:id/participants/:userId

// Actions
POST   /api/threads/:id/resolve
POST   /api/threads/:id/archive
POST   /api/threads/:id/pin
GET    /api/threads/:id/summary

// User inbox
GET    /api/threads/inbox
GET    /api/threads/unread-count

// Search
GET    /api/threads/search?q={query}
```

### AI Summary Generation

```typescript
async function generateThreadSummary(threadId: string): Promise<string> {
  const messages = await getThreadMessages(threadId);

  const prompt = `Summarize this internal discussion thread about a customer:

${messages.map(m => `${m.user.name}: ${m.content}`).join('\n\n')}

Provide a brief summary (2-3 sentences) covering:
1. The main topic/question
2. Key points discussed
3. Any decisions or conclusions`;

  const summary = await claude.complete(prompt);

  await updateThread(threadId, {
    summary,
    summary_updated_at: new Date()
  });

  return summary;
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Threads created per week | 10+ per CSM | Analytics |
| Discussion moved from Slack | 30% reduction | User surveys |
| Average response time | < 4 hours | Timestamp analysis |
| Thread resolution rate | 80% resolved | Status tracking |

---

## Acceptance Criteria

- [ ] User can create discussion thread linked to customer
- [ ] @mentions notify and add participants
- [ ] Messages appear in real-time for all participants
- [ ] Threaded replies supported
- [ ] Emoji reactions on messages
- [ ] File attachments work
- [ ] Users can follow/mute threads
- [ ] Threads can be marked resolved
- [ ] Personal inbox shows all participating threads
- [ ] AI summary available for long threads

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| API endpoints | 3 days |
| WebSocket real-time | 3 days |
| Thread UI | 4 days |
| Notifications | 2 days |
| AI summary | 1 day |
| Testing | 2 days |
| **Total** | **17 days** |

---

## Notes

- Consider Slack integration for cross-posting
- Add thread templates for common discussion types
- Future: AI-suggested participants based on topic
- Future: Auto-convert decisions to tasks
- Future: Voice message support
