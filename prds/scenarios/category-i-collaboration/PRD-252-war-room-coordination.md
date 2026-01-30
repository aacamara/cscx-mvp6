# PRD-252: War Room Coordination

## Metadata
- **PRD ID**: PRD-252
- **Title**: War Room Coordination
- **Category**: I - Collaboration
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-243 (Internal Escalation), PRD-186 (Slack Integration)

---

## Problem Statement

When critical customer situations arise (major outages, at-risk renewals, executive escalations), teams scramble to coordinate response efforts. Information is scattered across channels, action items get lost, and there's no single source of truth for war room status. This leads to duplicated efforts and slower resolution.

## User Story

> As a CS leader, I want to spin up a dedicated war room for critical customer situations that centralizes all communication, tracks action items, and provides real-time status updates so that we can coordinate effectively and resolve issues faster.

---

## Functional Requirements

### FR-1: War Room Initiation
- **FR-1.1**: Quick-start war room from escalation or customer page
- **FR-1.2**: Select war room type (Outage, Renewal Risk, Escalation, Launch)
- **FR-1.3**: Define severity/priority level
- **FR-1.4**: Auto-invite relevant stakeholders based on rules
- **FR-1.5**: Set expected resolution timeline

### FR-2: Communication Hub
- **FR-2.1**: Integrated chat stream for war room participants
- **FR-2.2**: Auto-create Slack channel linked to war room
- **FR-2.3**: Cross-post key updates to Slack
- **FR-2.4**: Pin critical messages
- **FR-2.5**: Structured status updates (template-based)

### FR-3: Action Management
- **FR-3.1**: Action item board (kanban-style)
- **FR-3.2**: Assign owners and due times
- **FR-3.3**: Priority ranking of actions
- **FR-3.4**: Dependencies between actions
- **FR-3.5**: Real-time progress tracking

### FR-4: Status Dashboard
- **FR-4.1**: Current status (Red/Yellow/Green)
- **FR-4.2**: Timeline of events and updates
- **FR-4.3**: Key metrics affected (health score, NPS, etc.)
- **FR-4.4**: Participant list with roles
- **FR-4.5**: Live update feed

### FR-5: External Communication
- **FR-5.1**: Draft customer communications from war room
- **FR-5.2**: Track customer-facing updates sent
- **FR-5.3**: Log customer responses/reactions
- **FR-5.4**: Schedule follow-up communications

### FR-6: Resolution & Post-Mortem
- **FR-6.1**: Close war room with resolution summary
- **FR-6.2**: Auto-generate post-mortem template
- **FR-6.3**: Capture lessons learned
- **FR-6.4**: Track follow-up action items
- **FR-6.5**: Archive war room for future reference

---

## Non-Functional Requirements

### NFR-1: Performance
- Real-time updates < 500ms latency
- War room loads < 2 seconds

### NFR-2: Reliability
- 99.99% uptime during active war rooms
- No message loss

### NFR-3: Accessibility
- Mobile-friendly for on-call response

---

## Technical Approach

### Data Model Extensions

```sql
-- war_rooms table
CREATE TABLE war_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  created_by_user_id UUID REFERENCES users(id) NOT NULL,

  -- Configuration
  title VARCHAR(500) NOT NULL,
  war_room_type VARCHAR(50) NOT NULL, -- 'outage', 'renewal_risk', 'escalation', 'launch', 'other'
  severity VARCHAR(20) NOT NULL, -- 'sev1', 'sev2', 'sev3'
  description TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'monitoring', 'resolved', 'closed'
  current_state VARCHAR(20) DEFAULT 'red', -- 'red', 'yellow', 'green'
  expected_resolution TIMESTAMPTZ,

  -- Linked entities
  escalation_id UUID REFERENCES escalations(id),
  renewal_pipeline_id UUID REFERENCES renewal_pipeline(id),

  -- Slack integration
  slack_channel_id VARCHAR(100),
  slack_channel_name VARCHAR(100),

  -- Resolution
  resolution_summary TEXT,
  root_cause TEXT,
  lessons_learned TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,

  -- Impact
  arr_at_risk DECIMAL,
  customers_affected INTEGER DEFAULT 1,
  business_impact TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- war_room_participants
CREATE TABLE war_room_participants (
  war_room_id UUID REFERENCES war_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  role VARCHAR(50) DEFAULT 'member', -- 'commander', 'comms_lead', 'tech_lead', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (war_room_id, user_id)
);

-- war_room_messages
CREATE TABLE war_room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID REFERENCES war_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  message_type VARCHAR(50) DEFAULT 'chat', -- 'chat', 'status_update', 'action_update', 'system'
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  slack_message_ts VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- war_room_status_updates (structured updates)
CREATE TABLE war_room_status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID REFERENCES war_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  previous_state VARCHAR(20),
  new_state VARCHAR(20),
  summary TEXT NOT NULL,
  next_steps TEXT,
  eta_to_resolution TIMESTAMPTZ,
  notified_stakeholders BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- war_room_actions
CREATE TABLE war_room_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID REFERENCES war_rooms(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo', -- 'todo', 'in_progress', 'blocked', 'done'
  priority INTEGER DEFAULT 2, -- 1=highest
  owner_id UUID REFERENCES users(id),
  due_at TIMESTAMPTZ,
  depends_on_action_id UUID REFERENCES war_room_actions(id),
  completed_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- war_room_customer_comms
CREATE TABLE war_room_customer_comms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID REFERENCES war_rooms(id) ON DELETE CASCADE,
  comm_type VARCHAR(50), -- 'email', 'call', 'meeting', 'portal_update'
  subject VARCHAR(500),
  content TEXT,
  sent_to TEXT[], -- Stakeholder names/emails
  sent_at TIMESTAMPTZ,
  sent_by_user_id UUID REFERENCES users(id),
  customer_response TEXT,
  response_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_war_rooms_customer ON war_rooms(customer_id);
CREATE INDEX idx_war_rooms_status ON war_rooms(status);
CREATE INDEX idx_war_room_messages ON war_room_messages(war_room_id, created_at);
CREATE INDEX idx_war_room_actions ON war_room_actions(war_room_id, status);
```

### Auto-Invite Rules

```typescript
interface WarRoomInviteRule {
  war_room_type: string;
  severity: string;
  invite_roles: string[]; // ['csm', 'csm_manager', 'solutions_architect', 'support_lead']
  invite_by_customer_tier?: boolean;
  invite_executive_sponsor?: boolean;
}

const inviteRules: WarRoomInviteRule[] = [
  {
    war_room_type: 'outage',
    severity: 'sev1',
    invite_roles: ['csm', 'csm_manager', 'cs_director', 'solutions_architect', 'support_lead', 'engineering_oncall'],
    invite_executive_sponsor: true
  },
  {
    war_room_type: 'renewal_risk',
    severity: 'sev1',
    invite_roles: ['csm', 'csm_manager', 'cs_director', 'sales_ae', 'deal_desk'],
    invite_executive_sponsor: true
  }
  // ... more rules
];

async function getAutoInvites(warRoom: WarRoom): Promise<User[]> {
  const rules = inviteRules.filter(r =>
    r.war_room_type === warRoom.war_room_type &&
    r.severity === warRoom.severity
  );

  const users: User[] = [];

  // Add CSM and manager chain
  const csm = await getAssignedCSM(warRoom.customer_id);
  users.push(csm);
  users.push(...await getManagerChain(csm.id));

  // Add by role
  for (const role of rules.flatMap(r => r.invite_roles)) {
    users.push(...await getUsersByRole(role));
  }

  // Add executive sponsor if applicable
  if (rules.some(r => r.invite_executive_sponsor)) {
    const sponsor = await getExecutiveSponsor(warRoom.customer_id);
    if (sponsor) users.push(sponsor);
  }

  return deduplicateUsers(users);
}
```

### API Endpoints

```typescript
// War room CRUD
POST   /api/war-rooms
GET    /api/war-rooms
GET    /api/war-rooms/:id
PATCH  /api/war-rooms/:id
DELETE /api/war-rooms/:id

// Participants
GET    /api/war-rooms/:id/participants
POST   /api/war-rooms/:id/participants
PATCH  /api/war-rooms/:id/participants/:userId
DELETE /api/war-rooms/:id/participants/:userId

// Messages
GET    /api/war-rooms/:id/messages
POST   /api/war-rooms/:id/messages
POST   /api/war-rooms/:id/messages/:messageId/pin

// Status updates
GET    /api/war-rooms/:id/status-updates
POST   /api/war-rooms/:id/status-updates

// Actions
GET    /api/war-rooms/:id/actions
POST   /api/war-rooms/:id/actions
PATCH  /api/war-rooms/:id/actions/:actionId
DELETE /api/war-rooms/:id/actions/:actionId

// Customer communications
GET    /api/war-rooms/:id/customer-comms
POST   /api/war-rooms/:id/customer-comms

// Resolution
POST   /api/war-rooms/:id/resolve
POST   /api/war-rooms/:id/close
GET    /api/war-rooms/:id/post-mortem
```

### Slack Integration

```typescript
async function createWarRoomChannel(warRoom: WarRoom): Promise<SlackChannel> {
  const channelName = `war-${warRoom.severity}-${warRoom.customer.name.slice(0,15)}`.toLowerCase().replace(/\s/g, '-');

  const channel = await slack.createChannel(channelName);

  // Invite participants
  const slackUsers = await Promise.all(
    warRoom.participants.map(p => findSlackUser(p.user_id))
  );
  await slack.inviteUsers(channel.id, slackUsers.filter(Boolean));

  // Post initial briefing
  await slack.postMessage(channel.id, {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `War Room: ${warRoom.title}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Customer:* ${warRoom.customer.name}\n*Severity:* ${warRoom.severity}\n*Status:* :red_circle: Red` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Description:*\n${warRoom.description}` } },
      { type: 'actions', elements: [
        { type: 'button', text: { type: 'plain_text', text: 'View in CSCX' }, url: `${APP_URL}/war-rooms/${warRoom.id}` }
      ]}
    ]
  });

  return channel;
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to assemble team | < 15 minutes | Timestamp tracking |
| Mean time to resolution | 30% improvement | War room duration |
| Action completion rate | 95%+ | Action tracking |
| Post-mortem completion | 100% | Status tracking |
| Customer save rate | 80%+ for war room cases | Outcome tracking |

---

## Acceptance Criteria

- [ ] User can create war room from escalation or customer page
- [ ] Relevant stakeholders auto-invited based on rules
- [ ] Slack channel created and linked
- [ ] Real-time chat works within war room
- [ ] Action items can be created with owners and due dates
- [ ] Status updates broadcast to all participants
- [ ] Timeline shows all events chronologically
- [ ] Customer communications tracked
- [ ] War room can be resolved with summary
- [ ] Post-mortem template generated on close

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Auto-invite rules | 2 days |
| API endpoints | 3 days |
| War room UI | 5 days |
| Action board | 2 days |
| Real-time messaging | 2 days |
| Slack integration | 2 days |
| Post-mortem flow | 1 day |
| Testing | 2 days |
| **Total** | **21 days** |

---

## Notes

- Consider PagerDuty integration for on-call
- Add war room templates for common scenarios
- Future: AI-suggested actions based on similar past incidents
- Future: Automated customer status page updates
- Future: War room analytics and trends
