# PRD-241: @Mention Team Members

## Metadata
- **PRD ID**: PRD-241
- **Title**: @Mention Team Members
- **Category**: I - Collaboration
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: User authentication, Slack integration (PRD-186)

---

## Problem Statement

CSMs need to quickly loop in team members (other CSMs, managers, solutions architects, support engineers) when working on customer accounts. Currently, collaboration requires switching to external tools like Slack or email, breaking the workflow context and creating information silos.

## User Story

> As a CSM, I want to @mention team members directly within CSCX.AI notes, discussions, and tasks so that I can collaborate efficiently without leaving the platform and ensure relevant context is shared automatically.

---

## Functional Requirements

### FR-1: Mention Interface
- **FR-1.1**: Support `@` trigger character to open team member picker
- **FR-1.2**: Display autocomplete dropdown with fuzzy search on name/email
- **FR-1.3**: Show team member avatar, name, role, and availability status
- **FR-1.4**: Support keyboard navigation (arrow keys, Enter to select, Esc to close)
- **FR-1.5**: Render mentioned users as styled chips/badges in text

### FR-2: Notification Delivery
- **FR-2.1**: Send in-app notification to mentioned user
- **FR-2.2**: Send email notification with context and deep link
- **FR-2.3**: Send Slack DM notification (if Slack connected)
- **FR-2.4**: Include surrounding context (customer name, note content, task details)
- **FR-2.5**: Support notification preferences per user

### FR-3: Mention Contexts
- **FR-3.1**: Support mentions in customer notes (collaborative_notes)
- **FR-3.2**: Support mentions in internal discussion threads
- **FR-3.3**: Support mentions in task comments
- **FR-3.4**: Support mentions in escalation reports
- **FR-3.5**: Support mentions in chat messages with AI assistant

### FR-4: Activity Tracking
- **FR-4.1**: Log all mentions in activity log for audit
- **FR-4.2**: Track mention response rate and time
- **FR-4.3**: Show "mentioned you" in user's activity feed
- **FR-4.4**: Support filtering activity by mentions

---

## Non-Functional Requirements

### NFR-1: Performance
- Autocomplete results must appear within 200ms
- Notification delivery within 5 seconds of mention creation

### NFR-2: Scalability
- Support team sizes up to 500 users
- Handle high-frequency mentions during war room scenarios

### NFR-3: Security
- Only show team members user has permission to mention
- Respect customer data access permissions

---

## Technical Approach

### Data Model Extensions

```sql
-- team_members table (extend existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'available';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';

-- mentions table
CREATE TABLE mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_user_id UUID REFERENCES users(id),
  mentioned_by_user_id UUID REFERENCES users(id),
  context_type VARCHAR(50) NOT NULL, -- 'note', 'discussion', 'task', 'escalation', 'chat'
  context_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id),
  content_snippet TEXT,
  notification_sent BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mentions_user ON mentions(mentioned_user_id, created_at DESC);
CREATE INDEX idx_mentions_context ON mentions(context_type, context_id);
```

### API Endpoints

```typescript
// GET /api/team/search?q={query}
// Returns matching team members for autocomplete

// POST /api/mentions
// Create a mention and trigger notifications

// GET /api/mentions/my
// Get mentions for current user

// PATCH /api/mentions/:id/read
// Mark mention as read
```

### Integration Points

1. **Slack Integration** (PRD-186): Use `send_dm` action for Slack notifications
2. **Email Service**: Use existing Gmail/email service for email notifications
3. **Real-time Updates**: WebSocket for instant in-app notifications
4. **Activity Log**: Log to `agent_activity_log` table

### UI Components

```typescript
// MentionInput.tsx - Rich text input with @ mention support
// MentionPicker.tsx - Autocomplete dropdown
// MentionBadge.tsx - Rendered mention chip
// MentionNotification.tsx - In-app notification component
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mention adoption rate | 60% of CSMs use weekly | Analytics |
| Notification delivery rate | 99.9% | System logs |
| Response time to mentions | < 2 hours average | Time tracking |
| Cross-team collaboration | 30% increase | Mention analytics |

---

## Acceptance Criteria

- [ ] User can type `@` and see autocomplete with team members
- [ ] Selecting a team member inserts styled mention badge
- [ ] Mentioned user receives in-app notification within 5 seconds
- [ ] Mentioned user receives email with deep link to context
- [ ] Mentioned user receives Slack DM (if connected)
- [ ] Mentions appear in user's activity feed
- [ ] Mentions are searchable and filterable
- [ ] Notification preferences are respected

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 1 day |
| API endpoints | 2 days |
| UI components | 3 days |
| Notification system | 2 days |
| Slack integration | 1 day |
| Testing | 2 days |
| **Total** | **11 days** |

---

## Notes

- Consider rate limiting mentions to prevent spam
- Add "Do Not Disturb" mode for focused work
- Future: Support @team mentions for groups
- Future: AI suggestion for who to mention based on context
