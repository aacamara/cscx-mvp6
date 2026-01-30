# PRD-109: Key Date Reminder

## Metadata
- **PRD ID**: PRD-109
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Customer Data, Calendar Integration, Task Management

---

## 1. Overview

### 1.1 Problem Statement
CSMs need to remember important dates for their customers: contract anniversaries, stakeholder birthdays, company milestones, executive meetings, and more. Missing these dates means missing opportunities for relationship building and thoughtful engagement.

### 1.2 Solution Summary
Implement a key date tracking and reminder system that alerts CSMs ahead of important customer dates, suggesting appropriate acknowledgment or action.

### 1.3 Success Metrics
- Track 100% of key dates for managed accounts
- Send timely reminders 95% of the time
- Increase stakeholder relationship scores through thoughtful engagement
- Improve customer satisfaction with personalized attention

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be reminded of important customer dates in advance
**So that** I can prepare appropriate acknowledgment or action

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to track custom dates (project milestones, executive meetings) alongside standard dates.

**US-3**: As a CSM, I want suggested actions based on date type (birthday card, anniversary email, QBR prep).

---

## 3. Functional Requirements

### 3.1 Date Types

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Contract start anniversary | Must |
| FR-1.2 | Renewal date | Must |
| FR-1.3 | Go-live anniversary | Should |
| FR-1.4 | Stakeholder birthdays | Should |
| FR-1.5 | Company founding date | Could |
| FR-1.6 | Custom milestone dates | Should |

### 3.2 Reminder Configuration

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Configurable lead time per date type | Should |
| FR-2.2 | Multiple reminder levels (7 days, 1 day) | Should |
| FR-2.3 | Exclude weekends for business dates | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
CREATE TABLE key_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  stakeholder_id UUID REFERENCES stakeholders(id),
  date_type VARCHAR(50) NOT NULL,
  date_value DATE NOT NULL,
  title TEXT,
  description TEXT,
  reminder_days_before INTEGER DEFAULT 7,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(50), -- yearly, monthly, quarterly
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:calendar: Key Date Reminder: Acme Corp

Upcoming: 2-Year Partnership Anniversary
Date: February 5, 2026 (7 days away)

Context:
- Customer Since: Feb 5, 2024
- Total Revenue: $350,000
- Relationship Health: Excellent

Suggested Actions:
- Send personalized anniversary note
- Share ROI summary / value report
- Consider executive thank-you call

[Draft Anniversary Email] [Generate Value Summary] [View Customer]
```

---

## 6. Related PRDs
- PRD-040: Milestone Celebration Email
- PRD-054: Seasonal/Holiday Outreach
- PRD-089: Renewal Approaching - Prep Checklist
