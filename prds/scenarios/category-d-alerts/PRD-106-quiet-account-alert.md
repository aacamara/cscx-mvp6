# PRD-106: Quiet Account Alert

## Metadata
- **PRD ID**: PRD-106
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Activity Tracking, Communication History, Engagement Scoring

---

## 1. Overview

### 1.1 Problem Statement
"Quiet" accounts - those with no meaningful interaction (meetings, emails, support tickets) for extended periods - represent silent churn risk. Customers who stop engaging may be passively dissatisfied or simply no longer deriving value. CSMs need alerts to identify and re-engage these accounts before they silently churn.

### 1.2 Solution Summary
Implement monitoring for account engagement that detects extended periods of silence. Alert CSMs when accounts go quiet, provide context on last interactions, and suggest re-engagement strategies appropriate to the situation.

### 1.3 Success Metrics
- Detect quiet accounts within 30 days of last meaningful interaction
- Re-engage 70% of flagged quiet accounts
- Reduce silent churn by 35%
- Increase average engagement frequency by 20%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when an account has been quiet for too long
**So that** I can proactively re-engage before they silently churn

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to know the last interaction and communication history, so I can craft relevant outreach.

**US-3**: As a CSM, I want quiet thresholds adjusted by customer segment (enterprise needs more touchpoints).

**US-4**: As a CS Manager, I want to see aggregate quiet account metrics across the team.

---

## 3. Functional Requirements

### 3.1 Silence Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Track last meeting date | Must |
| FR-1.2 | Track last email exchange (not automated) | Must |
| FR-1.3 | Track last support ticket | Must |
| FR-1.4 | Track last CSM note/interaction logged | Should |
| FR-1.5 | Configure quiet thresholds by segment | Should |

### 3.2 Alert Logic

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Alert when no interaction for 30+ days (default) | Must |
| FR-2.2 | Escalate alert if quiet for 60+ days | Must |
| FR-2.3 | Consider account tier (enterprise: 21 days, SMB: 45 days) | Should |
| FR-2.4 | Exclude accounts with known reasons (seasonal business) | Should |

### 3.3 Re-engagement

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Draft context-appropriate check-in email | Must |
| FR-3.2 | Suggest meeting scheduling | Should |
| FR-3.3 | Provide conversation starters based on account data | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
CREATE TABLE engagement_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  last_meeting_at TIMESTAMPTZ,
  last_email_sent_at TIMESTAMPTZ,
  last_email_received_at TIMESTAMPTZ,
  last_support_ticket_at TIMESTAMPTZ,
  last_csm_note_at TIMESTAMPTZ,
  last_meaningful_interaction_at TIMESTAMPTZ,
  quiet_since TIMESTAMPTZ,
  quiet_days INTEGER GENERATED ALWAYS AS (
    EXTRACT(days FROM NOW() - last_meaningful_interaction_at)
  ) STORED,
  quiet_alert_sent_at TIMESTAMPTZ,
  re_engaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id)
);
```

### 4.2 Workflow Definition

```yaml
workflow: quiet_account_alert
version: 1.0
trigger:
  type: scheduled
  schedule: "0 9 * * 1" # Weekly Monday

steps:
  - id: find_quiet_accounts
    action: query_database
    config:
      query: |
        SELECT c.*, et.quiet_days, et.last_meaningful_interaction_at
        FROM customers c
        JOIN engagement_tracking et ON c.id = et.customer_id
        WHERE et.quiet_days >= CASE
          WHEN c.segment = 'enterprise' THEN 21
          WHEN c.segment = 'mid-market' THEN 30
          ELSE 45
        END
        AND et.quiet_alert_sent_at IS NULL
        AND c.stage NOT IN ('churned', 'onboarding')

  - id: notify_csm
    for_each: "{{quiet_accounts}}"
    action: slack_dm
    config:
      message_template: "quiet_account_alert"

  - id: create_task
    for_each: "{{quiet_accounts}}"
    action: create_task
    config:
      title: "Re-engage quiet account: {{customer.name}} ({{quiet_days}} days)"
      due_date_offset_days: 5
      priority: medium

  - id: draft_checkin
    for_each: "{{quiet_accounts}}"
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: quiet_account_checkin
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:mute: Quiet Account Alert: SilentCorp

Days Since Last Interaction: 45 days

Last Activities:
- Meeting: Dec 15, 2025 (45 days ago)
- Email: Dec 20, 2025 (40 days ago) - No reply received
- Support: Nov 28, 2025 (62 days ago)

Account Context:
- ARR: $65,000
- Health Score: 72 (stable)
- Renewal: 120 days away
- Segment: Mid-Market

Usage Status:
- Product usage: Active (no decline)
- Logins: Regular

Interpretation:
Account is using product but not engaging with CSM. May be satisfied but disengaged, or quietly evaluating alternatives.

[Draft Check-In Email] [Schedule Meeting] [View Communication History]
```

---

## 6. Related PRDs
- PRD-034: Check-In Email After Silence
- PRD-100: Login Pattern Change
- PRD-070: Engagement Score Breakdown
- PRD-157: Engagement Metrics Report
