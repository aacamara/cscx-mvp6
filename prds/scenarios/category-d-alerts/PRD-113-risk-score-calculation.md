# PRD-113: Risk Score Calculation

## Metadata
- **PRD ID**: PRD-113
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Multiple Data Sources, Risk Signal Engine, Health Score System

---

## 1. Overview

### 1.1 Problem Statement
While health scores provide a general view of customer wellbeing, a dedicated risk score that aggregates and weights churn-specific signals provides a more focused view of churn probability. CSMs need a clear risk indicator that combines multiple risk factors into an actionable score.

### 1.2 Solution Summary
Implement a composite risk score calculation that aggregates multiple risk signals (usage decline, NPS drop, champion departure, support issues, payment problems, competitive mentions) into a single 0-100 risk score. Alert CSMs when risk scores exceed thresholds.

### 1.3 Success Metrics
- Predict 80% of churn events 60+ days in advance
- Improve save play success rate by 30%
- Reduce unexpected churn by 50%
- Enable proactive intervention on high-risk accounts

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** have a clear risk score for each account
**So that** I can prioritize attention on accounts most likely to churn

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to understand which factors are driving the risk score, so I can address root causes.

**US-3**: As a CS Manager, I want to see risk distribution across my team's portfolio for resource planning.

**US-4**: As a Finance/Executive, I want to see ARR at risk for forecasting purposes.

---

## 3. Functional Requirements

### 3.1 Risk Signal Inputs

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Include usage decline signals | Must |
| FR-1.2 | Include NPS/sentiment signals | Must |
| FR-1.3 | Include champion departure signals | Must |
| FR-1.4 | Include support escalation signals | Must |
| FR-1.5 | Include payment/billing signals | Should |
| FR-1.6 | Include competitive mention signals | Should |
| FR-1.7 | Include engagement silence signals | Must |

### 3.2 Score Calculation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Calculate composite risk score (0-100, higher = more risk) | Must |
| FR-2.2 | Weight signals by predictive power | Should |
| FR-2.3 | Apply recency weighting (recent signals matter more) | Should |
| FR-2.4 | Calculate risk trend (increasing, stable, decreasing) | Should |

### 3.3 Alerts and Actions

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Alert when risk score exceeds threshold (e.g., 70) | Must |
| FR-3.2 | Alert on rapid risk increase (>20 points in 7 days) | Must |
| FR-3.3 | Recommend appropriate save play | Should |
| FR-3.4 | Update customers.stage to 'at_risk' when threshold exceeded | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
CREATE TABLE risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  previous_score INTEGER,
  score_change INTEGER,
  trend VARCHAR(20), -- increasing, stable, decreasing
  components JSONB NOT NULL,
  risk_level VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN score >= 80 THEN 'critical'
      WHEN score >= 60 THEN 'high'
      WHEN score >= 40 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, calculated_at::date)
);
```

### 4.2 Calculation Logic

```typescript
interface RiskSignal {
  type: string;
  weight: number;
  value: number; // 0-1 normalized
  recencyDays: number;
}

const RISK_SIGNAL_WEIGHTS = {
  usage_decline: 0.20,
  nps_detractor: 0.15,
  champion_departed: 0.15,
  support_escalation: 0.10,
  payment_issues: 0.10,
  competitive_mention: 0.10,
  engagement_silence: 0.10,
  health_score_drop: 0.10
};

function calculateRiskScore(signals: RiskSignal[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const signal of signals) {
    // Apply recency decay (signals older than 90 days have reduced weight)
    const recencyFactor = Math.max(0, 1 - (signal.recencyDays / 90));
    const adjustedWeight = RISK_SIGNAL_WEIGHTS[signal.type] * recencyFactor;

    weightedSum += signal.value * adjustedWeight;
    totalWeight += adjustedWeight;
  }

  // Normalize to 0-100
  return Math.round((weightedSum / totalWeight) * 100);
}
```

### 4.3 Workflow Definition

```yaml
workflow: risk_score_alert
version: 1.0
trigger:
  type: scheduled
  schedule: "0 6 * * *" # Daily at 6 AM

steps:
  - id: calculate_scores
    for_each: "{{active_customers}}"
    action: calculate_risk_score

  - id: alert_high_risk
    for_each: "{{high_risk_customers}}"
    condition: "{{risk_score}} >= 70"
    action: slack_dm
    config:
      message_template: "risk_score_alert"
      urgency: high

  - id: alert_rapid_increase
    for_each: "{{rapid_increase_customers}}"
    condition: "{{score_change}} >= 20"
    action: slack_dm
    config:
      message_template: "risk_score_rapid_increase"
      urgency: critical

  - id: update_stage
    for_each: "{{newly_at_risk}}"
    action: update_customer_stage
    config:
      new_stage: at_risk
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:warning: HIGH RISK ALERT: TroubledCorp

Risk Score: 78/100 (HIGH)
Change: +25 points in 7 days

Risk Factors:

:chart_with_downwards_trend: Usage Decline (Critical)
Weight: 20% | Score contribution: 18
DAU dropped 55% in the last 30 days

:disappointed: NPS Detractor (High)
Weight: 15% | Score contribution: 14
Latest NPS: 4 (Detractor)

:bust_in_silhouette: Champion Departed (High)
Weight: 15% | Score contribution: 12
Primary contact Sarah left 21 days ago

:clock3: Engagement Silence (Medium)
Weight: 10% | Score contribution: 8
No meaningful interaction in 45 days

Account Context:
- ARR: $125,000
- Renewal: 85 days away
- Health Score: 42 (Critical)

Recommended Action:
Start Save Play - Multiple risk factors require coordinated response.

[Start Save Play] [View Full Risk Analysis] [Schedule Intervention]
```

---

## 6. Related PRDs
- PRD-083: Account Risk Factors Deep Dive
- PRD-107: Health Score Threshold Alert
- PRD-216: Predictive Churn Scoring
- PRD-061: At-Risk Portfolio View
