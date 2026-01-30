# PRD-103: Expansion Signal Detected

## Metadata
- **PRD ID**: PRD-103
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Usage Analytics, Meeting Intelligence, Expansion Detection Engine

---

## 1. Overview

### 1.1 Problem Statement
Expansion opportunities often emerge through subtle signals - increased usage, additional teams onboarding, feature upgrade requests, or positive mentions in conversations. Without automated detection, CSMs may miss these signals or identify them too late, leaving revenue on the table and potentially allowing competitors to capture the expansion.

### 1.2 Solution Summary
Implement an intelligent expansion signal detection system that monitors multiple data sources (usage, meetings, emails, support) for indicators of expansion potential. When signals are detected, alert CSMs with context, suggested expansion plays, and coordination with Sales for qualified opportunities.

### 1.3 Success Metrics
- Detect expansion signals 30 days earlier than manual identification
- Increase expansion pipeline by 40%
- Convert 25% of signaled accounts to expansion opportunities
- Reduce time from signal to proposal by 50%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when expansion signals emerge at my accounts
**So that** I can proactively pursue upsell and cross-sell opportunities

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to understand the specific signals that triggered the alert, so I can have relevant conversations.

**US-3**: As a Sales rep, I want CSM-qualified expansion signals routed to me with context, so I can assist with commercial conversations.

**US-4**: As a CS Manager, I want to track expansion signal-to-conversion rates, so I can optimize our expansion motions.

---

## 3. Functional Requirements

### 3.1 Signal Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Detect usage approaching tier limits | Must |
| FR-1.2 | Detect new user additions beyond contracted seats | Must |
| FR-1.3 | Detect interest in higher-tier features | Must |
| FR-1.4 | Detect expansion mentions in meetings/emails | Must |
| FR-1.5 | Detect new department/team onboarding | Should |
| FR-1.6 | Detect API usage growth | Should |
| FR-1.7 | Detect competitor product displacement | Should |

### 3.2 Alert and Qualification

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create expansion_opportunity record | Must |
| FR-2.2 | Score opportunity by signal strength and ARR potential | Must |
| FR-2.3 | Include signal details and evidence | Must |
| FR-2.4 | Suggest expansion type (upsell, cross-sell, land-and-expand) | Should |
| FR-2.5 | Estimate expansion value | Should |

### 3.3 Sales Coordination

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Notify assigned sales rep for qualified opportunities | Should |
| FR-3.2 | Create CRM opportunity record | Should |
| FR-3.3 | Track handoff and pipeline progression | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
-- Uses existing expansion_opportunities table
-- Signal detection metadata structure:
{
  "signals": [
    {
      "type": "usage_limit_approaching",
      "details": "Using 92% of API call limit",
      "detected_at": "2026-01-29T10:00:00Z",
      "strength": 0.85
    },
    {
      "type": "feature_interest",
      "details": "Asked about Advanced Analytics in last meeting",
      "source": "meeting_transcript",
      "detected_at": "2026-01-28T15:30:00Z",
      "strength": 0.7
    }
  ],
  "composite_score": 0.8,
  "estimated_expansion_arr": 45000,
  "suggested_products": ["Advanced Analytics", "API Plus"],
  "recommended_approach": "Schedule technical deep-dive on Advanced Analytics"
}
```

### 4.2 Signal Detection Logic

```typescript
const EXPANSION_SIGNALS = [
  {
    type: 'usage_limit_approaching',
    detect: (customer) => customer.usageMetrics.apiCalls / customer.limits.apiCalls > 0.8,
    strength: 0.8,
    expansion_type: 'upsell'
  },
  {
    type: 'seat_overage',
    detect: (customer) => customer.activeUsers > customer.contractedSeats,
    strength: 0.9,
    expansion_type: 'seat_expansion'
  },
  {
    type: 'feature_interest_meeting',
    detect: (customer) => customer.recentMeetings.some(m =>
      m.analysis.expansion_signals.length > 0
    ),
    strength: 0.7,
    expansion_type: 'feature_upsell'
  },
  {
    type: 'new_team_onboarding',
    detect: (customer) => {
      const newUsers = customer.recentUsers.filter(u => u.department !== customer.primaryDepartment);
      return newUsers.length >= 5;
    },
    strength: 0.75,
    expansion_type: 'land_and_expand'
  }
];
```

### 4.3 Workflow Definition

```yaml
workflow: expansion_signal_response
version: 1.0
trigger:
  type: scheduled
  schedule: "0 9 * * *" # Daily

steps:
  - id: scan_for_signals
    action: detect_expansion_signals
    config:
      signal_types: all
      min_composite_score: 0.6

  - id: notify_csm
    for_each: "{{detected_opportunities}}"
    action: slack_dm
    config:
      message_template: "expansion_signal_alert"
      include_signal_details: true

  - id: create_opportunity
    for_each: "{{high_score_opportunities}}"
    action: create_expansion_opportunity
    config:
      auto_qualify: false

  - id: create_task
    for_each: "{{detected_opportunities}}"
    action: create_task
    config:
      title: "Explore expansion: {{customer.name}} - {{primary_signal}}"
      due_date_offset_days: 7
      priority: medium

  - id: notify_sales
    condition: "{{composite_score}} >= 0.8"
    action: slack_dm
    config:
      recipient: "{{customer.sales_rep_id}}"
      message_template: "expansion_signal_sales_alert"
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:chart_with_upwards_trend: Expansion Signal: InnovateCorp

Signal Strength: HIGH (Score: 0.85)
Estimated Expansion: $45,000+ ARR

Signals Detected:

1. :zap: Usage Limit Approaching
   API calls at 92% of limit (projected to exceed in 2 weeks)

2. :bulb: Feature Interest
   "Asked about Advanced Analytics capabilities" - Meeting Jan 28

3. :busts_in_silhouette: New Team Onboarding
   8 new users from Marketing department (was only Sales)

Current State:
- ARR: $75,000
- Plan: Professional
- Contract End: Sep 2026

Recommended Expansion:
- Product: Advanced Analytics + API Plus
- Estimated Value: $45,000/year
- Approach: Schedule technical deep-dive

[Create Expansion Opportunity] [Draft Outreach] [View Account]
```

---

## 6. Related PRDs
- PRD-060: Expansion Opportunity Finder
- PRD-071: White Space Analysis
- PRD-119: Expansion Signal - Sales Routing
- PRD-238: Expansion Propensity Modeling
