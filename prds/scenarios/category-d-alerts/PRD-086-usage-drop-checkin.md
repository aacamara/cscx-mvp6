# PRD-086: Usage Drop Alert - Check-In Workflow

## Metadata
- **PRD ID**: PRD-086
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Usage Data Ingestion API, Trigger Engine, Communicator Agent

---

## 1. Overview

### 1.1 Problem Statement
When customer product usage drops significantly, CSMs often discover the issue too late - sometimes only at renewal time. By then, the customer may have already mentally churned or be evaluating competitors. Early detection of usage drops enables proactive intervention before the situation becomes critical.

### 1.2 Solution Summary
Implement an automated alert system that detects significant usage drops (DAU, WAU, MAU, feature adoption, login frequency) and triggers a check-in workflow. The workflow includes generating a personalized check-in email, scheduling a call if needed, and creating appropriate tasks for the CSM.

### 1.3 Success Metrics
- Reduce time-to-detection of usage drops from 14+ days to < 24 hours
- Increase proactive outreach rate on at-risk accounts by 60%
- Improve health score recovery rate by 40% for accounts with detected usage drops
- Reduce churn rate for flagged accounts by 25%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be automatically alerted when a customer's usage drops significantly
**So that** I can proactively reach out before the situation escalates

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want the system to draft a personalized check-in email based on the specific usage drop pattern, so I can quickly send relevant outreach.

**US-3**: As a CSM, I want the alert to include context about the usage change (what dropped, by how much, comparison to historical norms), so I can have an informed conversation.

**US-4**: As a CS Manager, I want to see aggregated usage drop alerts across my team's portfolio, so I can identify systemic issues and allocate resources.

**US-5**: As a CSM, I want to configure the sensitivity of usage drop alerts per customer segment, so high-touch accounts get faster alerts than tech-touch accounts.

---

## 3. Functional Requirements

### 3.1 Usage Drop Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Calculate daily/weekly/monthly usage metrics from usage_events table | Must |
| FR-1.2 | Detect drops > 30% in DAU/WAU/MAU compared to rolling 7-day average | Must |
| FR-1.3 | Detect drops > 50% in specific feature usage compared to customer baseline | Must |
| FR-1.4 | Detect login frequency drops (e.g., daily user becomes weekly user) | Must |
| FR-1.5 | Support configurable thresholds per customer segment | Should |
| FR-1.6 | Exclude expected patterns (weekends, holidays, known seasonality) | Should |
| FR-1.7 | Correlate usage drops with recent support tickets or product issues | Could |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create risk_signal record with type "usage_anomaly" and severity based on drop magnitude | Must |
| FR-2.2 | Calculate severity: >30% drop = medium, >50% drop = high, >70% drop = critical | Must |
| FR-2.3 | Include affected metrics, percentage change, and baseline comparison in alert metadata | Must |
| FR-2.4 | Prevent duplicate alerts within cooldown period (configurable, default 7 days) | Must |
| FR-2.5 | Update customer health_score based on usage drop severity | Should |

### 3.3 Check-In Workflow Trigger

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Create trigger record linking usage_anomaly to check-in workflow | Must |
| FR-3.2 | Execute workflow actions: send Slack notification, create task, draft email | Must |
| FR-3.3 | Generate personalized check-in email using Communicator agent | Must |
| FR-3.4 | Include usage data visualization in email (if available) | Should |
| FR-3.5 | Suggest meeting time slots for deeper discussion | Should |
| FR-3.6 | Log all workflow actions in agent_activity_log | Must |

### 3.4 CSM Notification

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-4.1 | Send real-time Slack DM to assigned CSM | Must |
| FR-4.2 | Include customer name, ARR, drop summary, and quick action links | Must |
| FR-4.3 | Support email fallback if Slack not connected | Should |
| FR-4.4 | Create task in task list with due date based on severity | Must |
| FR-4.5 | Add alert to CSM's "My Day" view (when implemented) | Could |

---

## 4. Technical Specifications

### 4.1 Data Model Changes

```sql
-- No new tables required. Uses existing:
-- - usage_metrics (source data)
-- - risk_signals (alert storage)
-- - triggers (automation rules)
-- - trigger_events (execution log)

-- New trigger type to add to triggers.type enum
-- 'usage_drop' - fires when usage metrics drop below threshold
```

### 4.2 API Endpoints

```typescript
// Usage metric calculation (scheduled job)
POST /api/v1/usage/calculate-metrics
Body: { customerId?: string, period: 'daily' | 'weekly' | 'monthly' }

// Alert configuration
GET /api/triggers?type=usage_drop
POST /api/triggers
Body: {
  type: 'usage_drop',
  condition: {
    metricType: 'dau' | 'wau' | 'mau' | 'feature_usage' | 'login_frequency',
    threshold: number, // percentage drop
    comparisonPeriod: number, // days to compare against
    severity: 'medium' | 'high' | 'critical'
  },
  actions: ['slack_notify', 'create_task', 'draft_email', 'update_health_score']
}

// Manual trigger test
POST /api/triggers/:triggerId/test
Body: { customerId: string }
```

### 4.3 Agent Integration

```typescript
// Communicator agent generates check-in email
const checkInEmail = await communicatorAgent.execute({
  action: 'draft_email',
  context: {
    customerId,
    emailType: 'usage_drop_checkin',
    usageData: {
      metricType: 'dau',
      previousValue: 45,
      currentValue: 28,
      percentDrop: 38,
      affectedPeriod: '2026-01-22 to 2026-01-28'
    }
  }
});
```

### 4.4 Workflow Definition

```yaml
workflow: usage_drop_checkin
version: 1.0
trigger:
  type: risk_signal_created
  filter:
    signal_type: usage_anomaly

steps:
  - id: notify_csm
    action: slack_dm
    config:
      message_template: "usage_drop_alert"
      include_quick_actions: true

  - id: create_task
    action: create_task
    config:
      title: "Check in on {{customer.name}} - Usage dropped {{drop_percentage}}%"
      due_date_offset_hours: 24 # or 4 for critical
      priority: high

  - id: draft_email
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: usage_drop_checkin
        requires_approval: true

  - id: log_activity
    action: log_activity
    config:
      activity_type: workflow_triggered
      details: usage_drop_checkin
```

---

## 5. UI/UX Specifications

### 5.1 Alert Notification (Slack)

```
:warning: Usage Alert: Acme Corp

DAU dropped 42% (45 → 26 users) over the past 7 days

Customer: Acme Corp
ARR: $150,000
Health Score: 68 (↓12 from last week)
CSM: Sarah Chen

[View Customer] [Draft Check-In Email] [Schedule Call]
```

### 5.2 Alert in Customer Detail

Display in Risk Signals section:
- Alert type icon (usage drop)
- Severity indicator (yellow/orange/red)
- Metric affected and change amount
- Time detected
- Actions taken
- Resolution status

### 5.3 Draft Email Preview

The drafted email should appear in the CSM's pending approvals queue:
- Subject: "Quick check-in - noticed some changes"
- Personalized greeting with champion name
- Mention of observed usage pattern (without being alarming)
- Open-ended question about their experience
- Offer to schedule a call
- Signature

---

## 6. Integration Points

### 6.1 Required Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| Usage Data API | Source usage metrics | Implemented |
| Slack | CSM notifications | Implemented |
| Gmail | Draft/send check-in emails | Implemented |
| Calendar | Schedule follow-up calls | Implemented |
| Supabase | Store alerts, tasks, logs | Implemented |

### 6.2 Agent Dependencies

| Agent | Role | Actions Used |
|-------|------|--------------|
| Monitor | Detect usage anomalies | detect_usage_drop |
| Communicator | Draft check-in email | draft_email |
| Scheduler | Propose meeting times | check_availability, propose_meeting |

---

## 7. Testing Requirements

### 7.1 Unit Tests
- Usage drop calculation accuracy
- Threshold comparison logic
- Severity determination
- Cooldown period enforcement

### 7.2 Integration Tests
- End-to-end workflow execution
- Slack notification delivery
- Email draft creation
- Task creation in database

### 7.3 Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Moderate drop | DAU drops 35% | Medium severity alert, 24h task |
| Severe drop | DAU drops 60% | High severity alert, 4h task |
| Critical drop | DAU drops 80% | Critical alert, immediate Slack + email |
| Within cooldown | Drop after recent alert | No new alert |
| Weekend exclusion | Weekend drop | Alert delayed to Monday evaluation |

---

## 8. Rollout Plan

### Phase 1: Alert Detection (Week 1)
- Implement usage drop calculation job
- Create risk_signal records for detected drops
- Basic Slack notifications to CSMs

### Phase 2: Workflow Automation (Week 2)
- Integrate Communicator agent for email drafting
- Add task creation automation
- Implement approval queue integration

### Phase 3: Refinement (Week 3)
- Add configurable thresholds per segment
- Implement seasonality exclusions
- Add dashboard view for usage trends

### Phase 4: Advanced Features (Week 4)
- Correlate with support tickets
- A/B test email templates
- Add machine learning for baseline detection

---

## 9. Open Questions

1. What is the optimal threshold for "significant" usage drop? Should it be configurable per customer tier?
2. How should we handle customers with naturally variable usage patterns?
3. Should the check-in email be sent automatically or always require approval?
4. What is the appropriate cooldown period between alerts for the same customer?

---

## 10. Appendix

### 10.1 Email Template: Usage Drop Check-In

```
Subject: Quick check-in from {{csm_name}}

Hi {{champion_name}},

I hope you're doing well! I wanted to reach out and see how things are going with {{product_name}}.

I noticed there might have been some changes in how your team is using the platform recently, and I wanted to make sure everything is working smoothly for you. Sometimes these shifts are intentional, and sometimes they indicate we can do more to help.

A few questions:
- Is there anything that's been challenging or frustrating lately?
- Are there features you'd like to explore but haven't had time for?
- Would it be helpful to schedule a quick call to review anything?

I'm here to help in whatever way is most useful. Just let me know!

Best,
{{csm_name}}
```

### 10.2 Related PRDs
- PRD-107: Health Score Threshold Alert
- PRD-100: Login Pattern Change
- PRD-084: Usage Anomaly Detection
- PRD-034: Check-In Email After Silence
