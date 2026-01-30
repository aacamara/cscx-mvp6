# PRD-243: Internal Escalation Workflow

## Metadata
- **PRD ID**: PRD-243
- **Title**: Internal Escalation Workflow
- **Category**: I - Collaboration
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-241 (@Mention), PRD-186 (Slack), Agent system

---

## Problem Statement

When a customer issue requires escalation (executive involvement, engineering support, legal review), CSMs lack a structured workflow within CSCX.AI. Escalations happen ad-hoc via Slack/email, leading to lost context, unclear ownership, and no tracking of resolution. This makes it difficult to measure escalation patterns and improve processes.

## User Story

> As a CSM, I want to trigger a formal escalation workflow that automatically routes to the right people, captures all context, and tracks progress to resolution so that customer issues are handled efficiently with full visibility.

---

## Functional Requirements

### FR-1: Escalation Creation
- **FR-1.1**: Quick escalation button on customer detail page
- **FR-1.2**: Escalation form with severity selection (P0-P3)
- **FR-1.3**: Category selection (Technical, Billing, Legal, Executive, Product)
- **FR-1.4**: Auto-populate customer context (ARR, health score, recent activity)
- **FR-1.5**: Rich text description with file attachments
- **FR-1.6**: Specify expected resolution and timeline

### FR-2: Routing & Assignment
- **FR-2.1**: Auto-route based on category and severity rules
- **FR-2.2**: Assign primary owner and optional secondary
- **FR-2.3**: Auto-notify manager chain based on severity
- **FR-2.4**: Suggest appropriate owners based on expertise tags
- **FR-2.5**: Support manual override of auto-routing

### FR-3: Escalation Tracking
- **FR-3.1**: Status workflow (Open -> Investigating -> Action Required -> Resolved -> Closed)
- **FR-3.2**: Activity log showing all updates and communications
- **FR-3.3**: SLA tracking with configurable thresholds per severity
- **FR-3.4**: Reminder notifications for stale escalations
- **FR-3.5**: Resolution documentation and root cause capture

### FR-4: Communication
- **FR-4.1**: Internal discussion thread on escalation
- **FR-4.2**: Slack channel creation for P0/P1 escalations (war room)
- **FR-4.3**: Email notifications at key state changes
- **FR-4.4**: Customer communication drafting (with approval)
- **FR-4.5**: Status update broadcasting to stakeholders

### FR-5: Reporting
- **FR-5.1**: Escalation dashboard (open, by category, by severity)
- **FR-5.2**: Resolution time metrics
- **FR-5.3**: Escalation trends by customer segment
- **FR-5.4**: Root cause analysis report
- **FR-5.5**: Team escalation load distribution

---

## Non-Functional Requirements

### NFR-1: Performance
- Escalation creation < 30 seconds
- Notifications delivered within 60 seconds of state change

### NFR-2: Reliability
- 99.9% uptime for escalation system
- No lost escalations (durable storage)

### NFR-3: Auditability
- Full audit trail of all escalation actions
- Immutable history for compliance

---

## Technical Approach

### Data Model Extensions

```sql
-- escalation_categories (configurable)
CREATE TABLE escalation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  default_owner_id UUID REFERENCES users(id),
  default_team_id UUID REFERENCES teams(id),
  sla_hours_p0 INTEGER DEFAULT 4,
  sla_hours_p1 INTEGER DEFAULT 24,
  sla_hours_p2 INTEGER DEFAULT 72,
  sla_hours_p3 INTEGER DEFAULT 168,
  active BOOLEAN DEFAULT true
);

-- escalations table
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  created_by_user_id UUID REFERENCES users(id) NOT NULL,
  category_id UUID REFERENCES escalation_categories(id),
  severity VARCHAR(10) NOT NULL, -- 'P0', 'P1', 'P2', 'P3'
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  primary_owner_id UUID REFERENCES users(id),
  secondary_owner_id UUID REFERENCES users(id),
  expected_resolution TEXT,
  target_resolution_date TIMESTAMPTZ,
  actual_resolution_date TIMESTAMPTZ,
  resolution_summary TEXT,
  root_cause TEXT,
  customer_impact TEXT,
  arr_at_risk DECIMAL,
  slack_channel_id VARCHAR(100),
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  sla_due_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- escalation_updates table
CREATE TABLE escalation_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_id UUID REFERENCES escalations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  update_type VARCHAR(50), -- 'status_change', 'comment', 'assignment', 'attachment'
  previous_value JSONB,
  new_value JSONB,
  comment TEXT,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- escalation_stakeholders table
CREATE TABLE escalation_stakeholders (
  escalation_id UUID REFERENCES escalations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  role VARCHAR(50), -- 'owner', 'watcher', 'approver', 'informed'
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (escalation_id, user_id)
);

CREATE INDEX idx_escalations_customer ON escalations(customer_id);
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_severity ON escalations(severity);
CREATE INDEX idx_escalations_owner ON escalations(primary_owner_id);
CREATE INDEX idx_escalation_updates ON escalation_updates(escalation_id, created_at);
```

### Routing Rules Engine

```typescript
interface RoutingRule {
  id: string;
  category: string;
  severity: string[];
  conditions: {
    field: string;
    operator: string;
    value: any;
  }[];
  actions: {
    assignTo: string; // user_id, team_id, or 'manager_of:{{csm_id}}'
    notify: string[];
    createSlackChannel: boolean;
    slaMultiplier?: number;
  };
}
```

### API Endpoints

```typescript
// Escalation CRUD
POST   /api/escalations
GET    /api/escalations
GET    /api/escalations/:id
PATCH  /api/escalations/:id
DELETE /api/escalations/:id

// Updates & Comments
POST   /api/escalations/:id/updates
GET    /api/escalations/:id/updates

// Assignment & Routing
POST   /api/escalations/:id/assign
POST   /api/escalations/:id/escalate  // Escalate to next level

// Resolution
POST   /api/escalations/:id/resolve

// Dashboard & Metrics
GET    /api/escalations/dashboard
GET    /api/escalations/metrics
```

### Agent Integration

```typescript
// Orchestrator agent can trigger escalations
tools: [
  {
    name: 'create_escalation',
    description: 'Create internal escalation for customer issue',
    parameters: {
      customer_id: 'string',
      category: 'string',
      severity: 'string',
      title: 'string',
      description: 'string'
    },
    approval_policy: 'require_approval'
  }
]
```

### Slack Integration

```typescript
// Auto-create war room channel for P0/P1
async function createEscalationChannel(escalation: Escalation) {
  const channelName = `esc-${escalation.id.slice(0,8)}-${slugify(escalation.customer.name)}`;
  const channel = await slack.createChannel(channelName);
  await slack.inviteUsers(channel.id, escalation.stakeholders);
  await slack.postMessage(channel.id, formatEscalationBrief(escalation));
  return channel;
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Escalation resolution time | 30% reduction | Time tracking |
| SLA compliance rate | 95%+ | Automated tracking |
| Escalation documentation quality | 90% with resolution notes | Audit |
| Customer save rate on escalations | 80%+ | Outcome tracking |

---

## Acceptance Criteria

- [ ] CSM can create escalation with severity and category
- [ ] Customer context auto-populates in escalation
- [ ] Escalation routes to correct owner based on rules
- [ ] Manager notified for P0/P1 escalations
- [ ] Slack channel created for P0/P1 escalations
- [ ] SLA countdown visible on escalation
- [ ] Status workflow enforced (Open -> ... -> Closed)
- [ ] All updates logged in activity history
- [ ] Resolution requires summary and root cause
- [ ] Dashboard shows all open escalations

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Routing rules engine | 3 days |
| API endpoints | 3 days |
| UI (creation, detail, dashboard) | 5 days |
| Slack integration | 2 days |
| Notifications | 2 days |
| Agent integration | 1 day |
| Testing | 2 days |
| **Total** | **20 days** |

---

## Notes

- Consider templates for common escalation types
- Add escalation playbooks with suggested actions
- Future: AI-suggested severity based on context
- Future: Predictive escalation detection before CSM triggers
- Future: Customer-facing status page for transparency
