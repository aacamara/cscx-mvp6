# PRD-115: Seasonal Review Alert

## Metadata
- **PRD ID**: PRD-115
- **Category**: D - Alerts & Triggers
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Calendar System, QBR Scheduling, Account Planning

---

## 1. Overview

### 1.1 Problem Statement
Certain customer activities are best performed on a seasonal/quarterly cadence: QBRs, account planning, annual reviews, budget discussions. Without automated reminders tied to the calendar, these important touchpoints may be missed or scheduled inconsistently.

### 1.2 Solution Summary
Implement a seasonal alert system that triggers reminders for periodic activities based on calendar quarters, fiscal years, and customer-specific cycles. Alerts include preparation guidance and scheduling tools.

### 1.3 Success Metrics
- Achieve 90% QBR completion rate
- Ensure 100% of enterprise accounts have annual planning sessions
- Improve consistency of periodic touchpoints across the team
- Increase customer satisfaction with proactive engagement

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be reminded of seasonal activities for each account
**So that** I maintain consistent, proactive engagement throughout the year

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want reminders calibrated to each customer's fiscal year and budget cycles.

**US-3**: As a CS Manager, I want visibility into seasonal activity completion across the team.

---

## 3. Functional Requirements

### 3.1 Seasonal Activities

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Quarterly Business Reviews (QBRs) | Must |
| FR-1.2 | Annual Account Planning | Must |
| FR-1.3 | Budget cycle check-ins | Should |
| FR-1.4 | Year-end reviews | Should |
| FR-1.5 | Fiscal year planning (customer-specific FY) | Should |
| FR-1.6 | Seasonal usage pattern reviews | Could |

### 3.2 Alert Configuration

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Trigger based on calendar quarter | Must |
| FR-2.2 | Support customer-specific fiscal years | Should |
| FR-2.3 | Configurable lead time (e.g., 3 weeks before quarter end) | Should |
| FR-2.4 | Track activity completion | Must |

### 3.3 Preparation Support

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Include preparation checklist | Should |
| FR-3.2 | Link to relevant templates (QBR deck, etc.) | Should |
| FR-3.3 | Auto-schedule if not yet scheduled | Could |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
CREATE TABLE seasonal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  activity_type VARCHAR(50) NOT NULL,
  period VARCHAR(20) NOT NULL, -- Q1_2026, FY2026, etc.
  due_date DATE,
  scheduled_date DATE,
  completed_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, completed, skipped
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, activity_type, period)
);

-- Customer-specific calendar settings
ALTER TABLE customers ADD COLUMN fiscal_year_start_month INTEGER DEFAULT 1;
ALTER TABLE customers ADD COLUMN qbr_cadence VARCHAR(20) DEFAULT 'quarterly';
```

### 4.2 Workflow Definition

```yaml
workflow: seasonal_review_alerts
version: 1.0
trigger:
  type: scheduled
  schedule: "0 9 1 * *" # First of each month

steps:
  - id: identify_due_activities
    action: query_seasonal_activities
    config:
      lookahead_days: 30

  - id: notify_csm
    for_each: "{{due_activities}}"
    action: slack_dm
    config:
      message_template: "seasonal_activity_reminder"

  - id: create_task
    for_each: "{{due_activities}}"
    condition: "{{status}} == 'pending'"
    action: create_task
    config:
      title: "{{activity_type}}: {{customer.name}} - {{period}}"
      due_date: "{{due_date}}"
      priority: medium
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:calendar: Seasonal Review Reminder

Q1 2026 QBRs Due (February)

Accounts Needing QBR Scheduling:

1. :red_circle: EnterpriseCorp ($500K ARR)
   Last QBR: Oct 2025 (3 months ago)
   Status: Not scheduled
   Prep: [Generate QBR Deck]

2. :yellow_circle: MidMarket Inc ($120K ARR)
   Last QBR: Nov 2025 (2 months ago)
   Status: Scheduled Feb 15
   Prep: [View Prep Checklist]

3. :green_circle: GrowthCo ($75K ARR)
   Last QBR: Dec 2025
   Status: Completed Jan 28

Summary:
- Total accounts: 15
- Scheduled: 8
- Completed: 3
- Needs attention: 4

[View All QBR Status] [Bulk Schedule]
```

### 5.2 Slack Alert Format (Single Account)

```
:calendar: Seasonal Activity Due: BigCo

Activity: Q1 2026 QBR
Due: February 28, 2026 (30 days away)
Status: Not yet scheduled

Last QBR: October 15, 2025
Topics Covered: Roadmap review, adoption metrics, renewal preview

Preparation Checklist:
- [ ] Update health score dashboard
- [ ] Compile usage metrics
- [ ] Prepare ROI summary
- [ ] Draft agenda
- [ ] Identify discussion topics

Templates Ready:
- [QBR Presentation Deck]
- [QBR Metrics Sheet]
- [Agenda Template]

[Schedule QBR] [Start Preparation] [View Last QBR Notes]
```

---

## 6. Related PRDs
- PRD-120: QBR Scheduling - Auto-Prep
- PRD-013: QBR Deck Upload - Data Refresh
- PRD-235: AI-Powered Account Planning
- PRD-109: Key Date Reminder
