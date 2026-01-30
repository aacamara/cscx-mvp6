# PRD-098: Onboarding Stalled - Intervention

## Metadata
- **PRD ID**: PRD-098
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Onboarding Workflow, Usage Tracking, Task Management

---

## 1. Overview

### 1.1 Problem Statement
When customer onboarding stalls - tasks remain incomplete, users don't activate, or the customer becomes unresponsive - the risk of early churn increases dramatically. CSMs often don't have visibility into onboarding progress across their portfolio and may not notice stalls until it's too late. Early intervention during onboarding significantly improves time-to-value and long-term retention.

### 1.2 Solution Summary
Implement an automated monitoring system that tracks onboarding progress against expected timelines and triggers intervention alerts when onboarding stalls. The system identifies the specific blockers, suggests targeted interventions, and provides escalation paths for chronically stalled accounts.

### 1.3 Success Metrics
- Detect onboarding stalls within 72 hours
- Reduce average onboarding time by 25%
- Decrease early churn (first 90 days) by 40%
- Increase on-time onboarding completion rate to 85%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when a customer's onboarding has stalled
**So that** I can intervene early and get them back on track

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to know specifically what's blocking progress (task, resource, user action), so I can address the right issue.

**US-3**: As an Onboarding Manager, I want visibility into stalled onboardings across the team, so I can allocate resources appropriately.

**US-4**: As a CSM, I want suggested intervention strategies based on the type of stall, so I can act quickly.

---

## 3. Functional Requirements

### 3.1 Stall Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Define expected timeline per onboarding phase | Must |
| FR-1.2 | Detect tasks overdue by >3 business days | Must |
| FR-1.3 | Detect user activation stalls (invited but not activated) | Must |
| FR-1.4 | Detect configuration/integration stalls | Must |
| FR-1.5 | Detect communication stalls (no response in 7 days) | Must |
| FR-1.6 | Consider customer segment for timeline expectations | Should |

### 3.2 Blocker Identification

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Identify specific overdue tasks | Must |
| FR-2.2 | Identify waiting-on-customer items | Must |
| FR-2.3 | Identify internal blockers (pending resources, approvals) | Should |
| FR-2.4 | Track blocker owner (customer vs internal) | Should |

### 3.3 Intervention Workflow

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Alert CSM with stall details and suggestions | Must |
| FR-3.2 | Create tasks for recommended intervention actions | Must |
| FR-3.3 | Draft re-engagement email | Must |
| FR-3.4 | Escalate to manager if stall exceeds 10 days | Should |
| FR-3.5 | Schedule sync call to unblock | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
-- Onboarding milestones tracking
CREATE TABLE onboarding_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  phase VARCHAR(100) NOT NULL,
  expected_start_date DATE,
  expected_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, stalled
  stall_detected_at TIMESTAMPTZ,
  stall_reason TEXT,
  stall_owner VARCHAR(50), -- customer, internal, unknown
  intervention_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stall detection rules
CREATE TABLE onboarding_stall_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase VARCHAR(100),
  condition_type VARCHAR(50), -- overdue, no_activity, no_response
  threshold_days INTEGER,
  segment VARCHAR(50), -- enterprise, mid-market, smb
  enabled BOOLEAN DEFAULT true
);
```

### 4.2 Detection Logic

```typescript
interface OnboardingStallCheck {
  customerId: string;
  currentPhase: string;
  phaseStartDate: Date;
  lastActivityDate: Date;
  lastResponseDate: Date;
  pendingTasks: Task[];
  expectedDurationDays: number;
}

function detectOnboardingStall(check: OnboardingStallCheck): StallResult | null {
  const now = new Date();
  const daysSincePhaseStart = daysBetween(check.phaseStartDate, now);
  const daysSinceActivity = daysBetween(check.lastActivityDate, now);
  const daysSinceResponse = daysBetween(check.lastResponseDate, now);

  const issues = [];

  // Phase taking too long
  if (daysSincePhaseStart > check.expectedDurationDays * 1.5) {
    issues.push({
      type: 'phase_overdue',
      severity: 'high',
      details: `Phase "${check.currentPhase}" is ${daysSincePhaseStart} days old (expected ${check.expectedDurationDays})`
    });
  }

  // No activity
  if (daysSinceActivity > 5) {
    issues.push({
      type: 'no_activity',
      severity: daysSinceActivity > 10 ? 'high' : 'medium',
      details: `No activity in ${daysSinceActivity} days`
    });
  }

  // No response
  if (daysSinceResponse > 7) {
    issues.push({
      type: 'no_response',
      severity: 'high',
      details: `Customer hasn't responded in ${daysSinceResponse} days`
    });
  }

  // Overdue tasks
  const overdueTasks = check.pendingTasks.filter(t =>
    t.dueDate && t.dueDate < now
  );
  if (overdueTasks.length > 0) {
    issues.push({
      type: 'tasks_overdue',
      severity: 'medium',
      details: `${overdueTasks.length} tasks overdue`,
      tasks: overdueTasks
    });
  }

  return issues.length > 0 ? { isStalled: true, issues } : null;
}
```

### 4.3 Workflow Definition

```yaml
workflow: onboarding_stall_intervention
version: 1.0
trigger:
  type: scheduled
  schedule: "0 9 * * *" # Daily at 9 AM

steps:
  - id: scan_onboardings
    action: query_database
    config:
      query: |
        SELECT * FROM customers
        WHERE stage = 'onboarding'
        AND created_at < NOW() - INTERVAL '7 days'

  - id: detect_stalls
    for_each: "{{onboarding_customers}}"
    action: check_onboarding_stall

  - id: notify_csm
    for_each: "{{stalled_customers}}"
    action: slack_dm
    config:
      message_template: "onboarding_stalled_alert"
      include_blockers: true
      urgency: "{{highest_issue_severity}}"

  - id: create_intervention_task
    for_each: "{{stalled_customers}}"
    action: create_task
    config:
      title: "Unblock onboarding: {{customer.name}} - {{primary_issue}}"
      due_date_offset_hours: 24
      priority: high

  - id: draft_reengagement
    for_each: "{{stalled_customers}}"
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: onboarding_reengagement

  - id: escalate_chronic_stalls
    condition: "{{days_stalled}} > 10"
    action: slack_dm
    config:
      recipient: "{{csm.manager_id}}"
      message_template: "onboarding_chronic_stall"
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:warning: Onboarding Stalled: NewCustomer Corp

Phase: Technical Integration
Expected Duration: 14 days
Current Duration: 23 days (9 days overdue)

Blockers Identified:
1. :clock3: API Configuration - Waiting on customer (12 days)
2. :red_circle: Data Migration - Task overdue by 5 days
3. :speech_balloon: No response - Last email Jan 17 (12 days ago)

Customer Context:
- ARR: $45,000
- Segment: Mid-Market
- Days in Onboarding: 35 (target: 30)

Suggested Interventions:
1. Call customer directly to understand blocker
2. Offer technical assistance session
3. Escalate to customer's manager if needed

[Draft Re-engagement Email] [Schedule Call] [View Onboarding Plan]
```

### 5.2 Onboarding Dashboard Card

For each stalled onboarding show:
- Customer name and days in onboarding
- Current phase with progress bar
- Red "STALLED" badge
- Primary blocker summary
- Days since last activity
- Intervention button

---

## 6. Related PRDs
- PRD-117: New Customer Assignment - Onboarding
- PRD-012: Onboarding Checklist Upload - Progress Tracking
- PRD-154: Onboarding Funnel Report
