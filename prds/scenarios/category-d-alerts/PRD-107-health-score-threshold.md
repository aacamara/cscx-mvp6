# PRD-107: Health Score Threshold Alert

## Metadata
- **PRD ID**: PRD-107
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Health Score Calculation, Trigger Engine, Risk Management

---

## 1. Overview

### 1.1 Problem Statement
Health scores provide a composite view of customer wellbeing, but CSMs need to be alerted when scores cross critical thresholds or change dramatically. Without threshold-based alerting, CSMs may not notice gradual decline until the account is already at high risk.

### 1.2 Solution Summary
Implement a threshold-based alert system that triggers when health scores cross defined boundaries (entering at-risk zone) or change dramatically (>15 points in a week). Alerts include score breakdown, contributing factors, and suggested interventions.

### 1.3 Success Metrics
- Alert CSMs within 24 hours of threshold breach
- Improve health score recovery rate by 45%
- Reduce accounts entering "critical" zone by 30%
- Increase average portfolio health score by 10 points

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when a customer's health score crosses a critical threshold
**So that** I can investigate and intervene before the situation worsens

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to understand which factors caused the score change, so I can address root causes.

**US-3**: As a CS Manager, I want aggregated threshold breach alerts across my team, so I can allocate support.

**US-4**: As a CSM, I want different alert levels for different thresholds (watch, at-risk, critical).

---

## 3. Functional Requirements

### 3.1 Threshold Definition

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Define health score zones: Healthy (>70), At-Risk (50-70), Critical (<50) | Must |
| FR-1.2 | Alert when score drops into a lower zone | Must |
| FR-1.3 | Alert on rapid decline (>15 points in 7 days) | Must |
| FR-1.4 | Alert on score recovery (positive movement for follow-up) | Should |
| FR-1.5 | Allow custom thresholds per segment | Should |

### 3.2 Alert Content

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Include current score, previous score, and change | Must |
| FR-2.2 | Include score component breakdown (usage, engagement, sentiment) | Must |
| FR-2.3 | Identify primary factors driving the change | Must |
| FR-2.4 | Suggest appropriate playbook or intervention | Should |

### 3.3 Workflow Integration

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Trigger appropriate risk playbook | Should |
| FR-3.2 | Update risk_signals table | Must |
| FR-3.3 | Notify manager for critical drops | Should |
| FR-3.4 | Schedule intervention meeting | Should |

---

## 4. Technical Specifications

### 4.1 Threshold Configuration

```typescript
const HEALTH_SCORE_THRESHOLDS = {
  zones: {
    healthy: { min: 71, max: 100, color: 'green' },
    at_risk: { min: 50, max: 70, color: 'yellow' },
    critical: { min: 0, max: 49, color: 'red' }
  },
  alerts: {
    zone_entry_at_risk: {
      condition: (prev, curr) => prev > 70 && curr <= 70,
      severity: 'high',
      notify_manager: false
    },
    zone_entry_critical: {
      condition: (prev, curr) => prev >= 50 && curr < 50,
      severity: 'critical',
      notify_manager: true
    },
    rapid_decline: {
      condition: (prev, curr, days) => (prev - curr) >= 15 && days <= 7,
      severity: 'high',
      notify_manager: true
    }
  }
};
```

### 4.2 Workflow Definition

```yaml
workflow: health_score_threshold_alert
version: 1.0
trigger:
  type: event
  event: health_score_calculated

steps:
  - id: evaluate_thresholds
    action: evaluate_health_thresholds
    config:
      thresholds: default

  - id: create_risk_signal
    condition: "{{threshold_breached}}"
    action: create_risk_signal
    config:
      type: health_score_drop
      severity: "{{alert_severity}}"

  - id: notify_csm
    condition: "{{threshold_breached}}"
    action: slack_dm
    config:
      message_template: "health_score_threshold"
      urgency: "{{alert_severity}}"
      include_breakdown: true

  - id: notify_manager
    condition: "{{notify_manager}}"
    action: slack_dm
    config:
      recipient: "{{csm.manager_id}}"
      message_template: "health_score_critical"

  - id: create_task
    condition: "{{threshold_breached}}"
    action: create_task
    config:
      title: "Health Score Alert: {{customer.name}} dropped to {{current_score}}"
      due_date_offset_hours: "{{severity == 'critical' ? 4 : 24}}"
      priority: "{{severity}}"

  - id: start_playbook
    condition: "{{current_zone}} == 'critical'"
    action: start_playbook
    config:
      playbook: save_play
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format (Critical Zone Entry)

```
:rotating_light: HEALTH SCORE CRITICAL: MegaCorp

Score: 72 → 48 (entered CRITICAL zone)
Change: -24 points in 5 days

Score Breakdown:
- Usage Score: 35 (↓20) - DAU dropped 50%
- Engagement Score: 55 (↓12) - No meetings in 30 days
- Sentiment Score: 65 (↓5) - NPS declined to 6

Primary Drivers:
1. :chart_with_downwards_trend: Dramatic usage decline
2. :mute: Customer has gone quiet
3. :person_frowning: Champion sentiment concerning

Account Context:
- ARR: $180,000
- Renewal: 75 days away
- Segment: Enterprise

Recommended Actions:
1. Immediate outreach to champion
2. Review recent support tickets
3. Consider executive escalation

:warning: CS Manager notified

[Start Save Play] [Draft Outreach] [View Health Details]
```

### 5.2 Slack Alert Format (Zone Recovery)

```
:tada: Health Score Recovery: DataFlow Inc

Score: 52 → 74 (returned to HEALTHY zone)
Change: +22 points over 3 weeks

What Improved:
- Usage Score: +15 (feature adoption campaign successful)
- Engagement Score: +10 (regular meetings resumed)

This account was flagged as critical 3 weeks ago.
Your intervention appears to have worked!

[Update Save Play Status] [Send Celebration Note] [View Customer]
```

---

## 6. Related PRDs
- PRD-061: At-Risk Portfolio View
- PRD-083: Account Risk Factors Deep Dive
- PRD-113: Risk Score Calculation
- PRD-153: Health Score Portfolio View
