# PRD-257: Cross-Functional Alignment

## Metadata
- **PRD ID**: PRD-257
- **Title**: Cross-Functional Alignment
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-181 (Salesforce), PRD-201 (Jira), PRD-184 (Zendesk)

---

## Problem Statement

CSMs work alongside Sales, Support, Product, and Engineering teams on customer accounts, but these teams operate in silos with different tools. There's no unified view of what each team is doing for a customer, leading to duplicated outreach, missed handoffs, and poor customer experiences.

## User Story

> As a CSM, I want to see and coordinate activities from all teams working on my accounts so that I can ensure aligned customer experiences and avoid conflicting communications.

---

## Functional Requirements

### FR-1: Unified Activity Timeline
- **FR-1.1**: Aggregate activities from all integrated systems
- **FR-1.2**: Display chronological timeline per customer
- **FR-1.3**: Filter by team/department
- **FR-1.4**: Filter by activity type
- **FR-1.5**: Show planned future activities

### FR-2: Team Visibility
- **FR-2.1**: Show Sales activities (opportunities, calls, emails)
- **FR-2.2**: Show Support activities (tickets, escalations)
- **FR-2.3**: Show Product activities (feature requests, beta programs)
- **FR-2.4**: Show Engineering activities (implementations, integrations)
- **FR-2.5**: Show Executive activities (sponsor engagements)

### FR-3: Conflict Detection
- **FR-3.1**: Alert for multiple outreach to same contact in short period
- **FR-3.2**: Flag conflicting messages/positioning
- **FR-3.3**: Warn about scheduled communications overlap
- **FR-3.4**: Detect gaps in coverage

### FR-4: Coordination Tools
- **FR-4.1**: Request hold-off from other teams
- **FR-4.2**: Schedule coordination call
- **FR-4.3**: Share account context with other teams
- **FR-4.4**: Internal alignment notes

### FR-5: Account Team View
- **FR-5.1**: Show all team members working on account
- **FR-5.2**: Display roles and responsibilities
- **FR-5.3**: Contact information and availability
- **FR-5.4**: RACI matrix for key activities

---

## Non-Functional Requirements

### NFR-1: Data Freshness
- Activities sync within 15 minutes of occurrence

### NFR-2: Integration Reliability
- Graceful degradation if integration unavailable

### NFR-3: Privacy
- Respect data access permissions from source systems

---

## Technical Approach

### Data Model Extensions

```sql
-- cross_functional_activities table (aggregated from integrations)
CREATE TABLE cross_functional_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,

  -- Source system
  source_system VARCHAR(50) NOT NULL, -- 'salesforce', 'zendesk', 'jira', 'slack', 'cscx'
  source_id VARCHAR(200), -- ID in source system
  source_url TEXT, -- Link to source system

  -- Activity details
  activity_type VARCHAR(100) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  team VARCHAR(50), -- 'sales', 'support', 'product', 'engineering', 'cs', 'executive'

  -- People
  performed_by_name VARCHAR(200),
  performed_by_email VARCHAR(200),
  performed_by_user_id UUID REFERENCES users(id), -- If internal user
  contact_name VARCHAR(200), -- Customer contact involved
  contact_email VARCHAR(200),

  -- Timing
  activity_date TIMESTAMPTZ NOT NULL,
  is_planned BOOLEAN DEFAULT false, -- Future activity

  -- Status
  status VARCHAR(50), -- Source-specific status
  outcome VARCHAR(100), -- Result if applicable

  -- Metadata
  metadata JSONB DEFAULT '{}',

  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- account_team_members
CREATE TABLE account_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  user_id UUID REFERENCES users(id),
  external_email VARCHAR(200), -- For non-CSCX users
  name VARCHAR(200) NOT NULL,
  team VARCHAR(50) NOT NULL,
  role VARCHAR(100) NOT NULL,
  responsibilities TEXT,
  source_system VARCHAR(50), -- Where this came from
  source_id VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, user_id),
  UNIQUE(customer_id, external_email)
);

-- coordination_requests
CREATE TABLE coordination_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  requested_by_user_id UUID REFERENCES users(id),
  request_type VARCHAR(50), -- 'hold_off', 'alignment_call', 'context_share'
  target_team VARCHAR(50),
  target_email VARCHAR(200),
  reason TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'acknowledged', 'completed', 'expired'
  response_notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- activity_conflicts
CREATE TABLE activity_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  conflict_type VARCHAR(50), -- 'multiple_outreach', 'message_conflict', 'overlap', 'gap'
  severity VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'critical'
  description TEXT,
  activities JSONB, -- Array of conflicting activity IDs
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id),
  resolution_notes TEXT
);

CREATE INDEX idx_cf_activities_customer ON cross_functional_activities(customer_id, activity_date DESC);
CREATE INDEX idx_cf_activities_source ON cross_functional_activities(source_system, source_id);
CREATE INDEX idx_cf_activities_team ON cross_functional_activities(team);
CREATE INDEX idx_account_team_customer ON account_team_members(customer_id);
```

### Activity Aggregation

```typescript
interface ActivityAggregator {
  source: string;
  sync(): Promise<void>;
  getActivities(customerId: string, dateRange: DateRange): Promise<CrossFunctionalActivity[]>;
}

class SalesforceActivityAggregator implements ActivityAggregator {
  source = 'salesforce';

  async sync(): Promise<void> {
    const lastSync = await getLastSyncTime(this.source);
    const activities = await salesforce.query(`
      SELECT Id, WhatId, Subject, Description, ActivityDate, Status, OwnerId, Owner.Email
      FROM Task
      WHERE LastModifiedDate > ${lastSync}
    `);

    for (const activity of activities) {
      const customer = await findCustomerBySalesforceId(activity.WhatId);
      if (!customer) continue;

      await upsertActivity({
        customer_id: customer.id,
        source_system: 'salesforce',
        source_id: activity.Id,
        activity_type: 'task',
        title: activity.Subject,
        description: activity.Description,
        team: 'sales',
        performed_by_email: activity.Owner.Email,
        activity_date: activity.ActivityDate,
        status: activity.Status
      });
    }
  }
}

// Similar aggregators for Zendesk, Jira, Slack, etc.
```

### Conflict Detection Engine

```typescript
async function detectConflicts(customerId: string): Promise<ActivityConflict[]> {
  const conflicts: ActivityConflict[] = [];
  const activities = await getRecentActivities(customerId, 7); // Last 7 days

  // Detect multiple outreach to same contact
  const contactActivities = groupBy(activities.filter(a => a.contact_email), 'contact_email');
  for (const [contact, acts] of Object.entries(contactActivities)) {
    const recentActs = acts.filter(a => isWithinDays(a.activity_date, 2));
    if (recentActs.length > 2) {
      conflicts.push({
        customer_id: customerId,
        conflict_type: 'multiple_outreach',
        severity: 'warning',
        description: `${recentActs.length} outreach activities to ${contact} in 2 days`,
        activities: recentActs.map(a => a.id)
      });
    }
  }

  // Detect coverage gaps
  const daysSinceLastActivity = getDaysSince(activities[0]?.activity_date);
  if (daysSinceLastActivity > 14) {
    conflicts.push({
      customer_id: customerId,
      conflict_type: 'gap',
      severity: 'info',
      description: `No cross-functional activity in ${daysSinceLastActivity} days`
    });
  }

  return conflicts;
}
```

### API Endpoints

```typescript
// Activity timeline
GET    /api/customers/:id/activities
GET    /api/customers/:id/activities/timeline

// Account team
GET    /api/customers/:id/team
POST   /api/customers/:id/team
PATCH  /api/customers/:id/team/:memberId
DELETE /api/customers/:id/team/:memberId

// Conflicts
GET    /api/customers/:id/conflicts
POST   /api/activity-conflicts/:id/resolve

// Coordination
POST   /api/coordination-requests
GET    /api/coordination-requests
PATCH  /api/coordination-requests/:id

// Sync status
GET    /api/integrations/sync-status
POST   /api/integrations/:source/sync
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Activity visibility coverage | 90% of touchpoints | Sync tracking |
| Conflict detection rate | Track baseline | Conflict logs |
| Coordination request usage | 5+ per CSM/month | Request tracking |
| Customer confusion reduction | 20% fewer complaints | Support tickets |

---

## Acceptance Criteria

- [ ] Activities from Salesforce visible in customer timeline
- [ ] Activities from Support system visible
- [ ] Timeline filterable by team
- [ ] Account team members displayed with roles
- [ ] Conflicts detected and displayed
- [ ] CSM can request hold-off from other teams
- [ ] Planned activities shown in timeline
- [ ] Sync status visible for each integration

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Activity aggregation framework | 3 days |
| Salesforce aggregator | 2 days |
| Support system aggregator | 2 days |
| Conflict detection | 2 days |
| API endpoints | 2 days |
| Timeline UI | 3 days |
| Account team UI | 2 days |
| Testing | 2 days |
| **Total** | **20 days** |

---

## Notes

- Consider bidirectional sync for coordination notes
- Add notification preferences for conflict alerts
- Future: AI-suggested coordination timing
- Future: Automated hold-off enforcement
- Future: Cross-functional reporting dashboard
