# PRD-102: Support Satisfaction Drop

## Metadata
- **PRD ID**: PRD-102
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Support System Integration, CSAT Tracking, Trigger Engine

---

## 1. Overview

### 1.1 Problem Statement
When a customer's satisfaction with support interactions drops, it often indicates broader relationship issues or product frustrations that extend beyond the support team. CSMs need visibility into support experience to proactively address underlying concerns and prevent the dissatisfaction from affecting the overall relationship.

### 1.2 Solution Summary
Implement monitoring for support satisfaction (CSAT) scores that detects negative trends or concerning individual ratings. Alert CSMs when satisfaction drops, providing context about recent support interactions and suggesting relationship repair actions.

### 1.3 Success Metrics
- Detect satisfaction drops within 24 hours
- Improve support CSAT scores by 15% for intervened accounts
- Reduce escalations following poor support experiences by 40%
- Maintain overall customer satisfaction during support issues

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when a customer rates support poorly
**So that** I can follow up and address any underlying issues

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to see the context of the support interaction that received a poor rating.

**US-3**: As a Support Manager, I want CSM follow-up on dissatisfied customers to help improve resolution.

**US-4**: As a CSM, I want to track support satisfaction trends over time for my accounts.

---

## 3. Functional Requirements

### 3.1 Satisfaction Monitoring

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Track CSAT scores from support ticket closures | Must |
| FR-1.2 | Detect individual poor ratings (1-2 on 5-point scale) | Must |
| FR-1.3 | Detect declining trend (average drops >20%) | Must |
| FR-1.4 | Link CSAT to specific ticket/interaction | Must |
| FR-1.5 | Track resolution time and first-contact resolution | Should |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Alert on individual poor ratings immediately | Must |
| FR-2.2 | Alert on negative trends weekly | Should |
| FR-2.3 | Include ticket summary and customer feedback | Must |
| FR-2.4 | Severity based on rating and customer ARR | Must |

### 3.3 Recovery Actions

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Draft acknowledgment/follow-up email | Should |
| FR-3.2 | Coordinate with Support team on resolution | Should |
| FR-3.3 | Schedule relationship repair call if needed | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
CREATE TABLE support_satisfaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  ticket_id TEXT NOT NULL,
  ticket_subject TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  ticket_category VARCHAR(100),
  resolution_time_hours INTEGER,
  was_escalated BOOLEAN DEFAULT false,
  survey_sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  csm_notified BOOLEAN DEFAULT false,
  csm_followed_up BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Workflow Definition

```yaml
workflow: support_satisfaction_response
version: 1.0
trigger:
  type: event
  event: support_csat_received
  filter:
    rating: { lte: 2 }

steps:
  - id: notify_csm
    action: slack_dm
    config:
      message_template: "support_satisfaction_drop"
      include_ticket_context: true

  - id: create_task
    action: create_task
    config:
      title: "Follow up on poor support experience: {{customer.name}}"
      due_date_offset_hours: 24
      priority: high

  - id: draft_follow_up
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: support_satisfaction_followup
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:disappointed: Support Satisfaction Alert: GlobalTech

Poor Rating Received: 1/5

Ticket: #TKT-2026-4521
Subject: "API returning 500 errors intermittently"
Category: Technical Issue
Resolution Time: 72 hours (SLA: 24 hours)

Customer Feedback:
"Took too long to get a response, and the issue still isn't fully resolved."

Context:
- Customer ARR: $175,000
- Support history: 3 tickets this month
- Previous avg CSAT: 4.2

This is the second low rating in 30 days.

[Send Follow-Up Email] [View Ticket] [Coordinate with Support]
```

---

## 6. Related PRDs
- PRD-087: Support Ticket Spike - Escalation
- PRD-065: Support History Summary
- PRD-145: Support SLA Breach - Escalation
