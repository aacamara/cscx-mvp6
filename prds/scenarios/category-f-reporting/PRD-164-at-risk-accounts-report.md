# PRD-164: At-Risk Accounts Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-164 |
| Title | At-Risk Accounts Report |
| Category | F - Reporting & Analytics |
| Priority | P0 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a dedicated at-risk accounts report that identifies, prioritizes, and tracks customers showing signs of potential churn. This enables proactive intervention and systematic risk mitigation across the portfolio.

---

## 2. Problem Statement

### Current Pain Points
- No consolidated view of all at-risk accounts
- Risk signals scattered across multiple systems
- Difficult to prioritize intervention efforts
- Missing systematic risk tracking and resolution
- Reactive approach to churn prevention

### Impact
- Preventable churn from late intervention
- Inefficient allocation of save resources
- Inconsistent risk identification
- Inability to measure risk mitigation effectiveness

---

## 3. Solution Overview

### High-Level Approach
Build a centralized risk monitoring system that aggregates risk signals, calculates risk scores, prioritizes accounts, and tracks intervention effectiveness.

### Key Features
1. **Risk Aggregation** - All risk signals in one view
2. **Risk Scoring** - Composite risk calculation
3. **Prioritization** - ARR-weighted risk ranking
4. **Signal Tracking** - Individual risk factor monitoring
5. **Intervention Tracking** - Save play progress
6. **Trend Analysis** - Risk trends over time
7. **Resolution Metrics** - Outcome tracking

---

## 4. User Stories

### Primary User Stories

```
As a VP of CS,
I want to see all at-risk accounts and their total ARR exposure
So that I can understand portfolio risk and allocate resources
```

```
As a CSM Manager,
I want to prioritize at-risk accounts for my team
So that we can focus on the highest-impact saves
```

```
As a CSM,
I want to understand why each account is at risk
So that I can take targeted intervention actions
```

---

## 5. Functional Requirements

### 5.1 Risk Identification

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-164.1 | Detect health score drops | P0 |
| FR-164.2 | Detect usage decline | P0 |
| FR-164.3 | Detect engagement drops | P0 |
| FR-164.4 | Detect champion departure | P0 |
| FR-164.5 | Detect support escalations | P0 |
| FR-164.6 | Detect negative sentiment | P1 |
| FR-164.7 | Detect payment issues | P1 |

### 5.2 Risk Scoring

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-164.8 | Calculate composite risk score | P0 |
| FR-164.9 | Weight signals by severity | P0 |
| FR-164.10 | Factor in ARR for prioritization | P0 |
| FR-164.11 | Consider time to renewal | P0 |
| FR-164.12 | Categorize risk levels | P0 |

### 5.3 Tracking & Resolution

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-164.13 | Track individual risk signals | P0 |
| FR-164.14 | Mark signals as acknowledged/resolved | P0 |
| FR-164.15 | Link to save plays | P0 |
| FR-164.16 | Track risk score trends | P0 |
| FR-164.17 | Record resolution outcomes | P0 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface RiskSignal {
  id: string;
  customer_id: string;
  type: RiskSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;

  detected_at: string;
  source: string;

  status: 'active' | 'acknowledged' | 'resolved';
  resolved_at?: string;
  resolution_notes?: string;
}

enum RiskSignalType {
  HEALTH_SCORE_DROP = 'health_score_drop',
  USAGE_DECLINE = 'usage_decline',
  ENGAGEMENT_DROP = 'engagement_drop',
  CHAMPION_LEFT = 'champion_left',
  SUPPORT_ESCALATION = 'support_escalation',
  NEGATIVE_SENTIMENT = 'negative_sentiment',
  PAYMENT_ISSUE = 'payment_issue',
  NO_LOGIN = 'no_login',
  NPS_DETRACTOR = 'nps_detractor',
  RENEWAL_RISK = 'renewal_risk'
}

interface AtRiskAccount {
  customer_id: string;
  customer_name: string;
  arr: number;
  segment: string;
  csm_id: string;
  renewal_date: string;
  days_to_renewal: number;

  risk: {
    score: number; // 0-100
    level: 'low' | 'medium' | 'high' | 'critical';
    priority_rank: number;
    arr_at_risk: number;
  };

  signals: RiskSignal[];
  active_signal_count: number;
  most_severe_signal: RiskSignal;

  health: {
    current_score: number;
    score_change_30d: number;
    trend: string;
  };

  intervention: {
    save_play_active: boolean;
    save_play_id?: string;
    last_intervention_date?: string;
  };
}

interface AtRiskPortfolio {
  total_at_risk: number;
  total_arr_at_risk: number;
  pct_portfolio_at_risk: number;

  by_level: {
    level: string;
    count: number;
    arr: number;
  }[];

  by_signal_type: {
    type: RiskSignalType;
    count: number;
  }[];

  trends: {
    period: string;
    at_risk_count: number;
    arr_at_risk: number;
    saved: number;
    churned: number;
  }[];
}
```

### 6.2 Risk Score Calculation

```typescript
const SIGNAL_WEIGHTS: Record<RiskSignalType, number> = {
  health_score_drop: 25,
  usage_decline: 20,
  engagement_drop: 15,
  champion_left: 25,
  support_escalation: 15,
  negative_sentiment: 10,
  payment_issue: 20,
  no_login: 20,
  nps_detractor: 15,
  renewal_risk: 25
};

function calculateRiskScore(signals: RiskSignal[]): number {
  let totalRisk = 0;

  for (const signal of signals) {
    if (signal.status !== 'active') continue;

    const baseWeight = SIGNAL_WEIGHTS[signal.type];
    const severityMultiplier = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      critical: 2.0
    }[signal.severity];

    totalRisk += baseWeight * severityMultiplier;
  }

  // Cap at 100
  return Math.min(100, totalRisk);
}

function calculatePriorityRank(account: AtRiskAccount): number {
  // Priority = Risk Score * ARR Factor * Renewal Urgency
  const arrFactor = Math.log10(account.arr / 10000 + 1);
  const renewalUrgency = account.days_to_renewal < 90 ? 1.5 : 1.0;

  return account.risk.score * arrFactor * renewalUrgency;
}
```

### 6.3 API Endpoints

```typescript
// Get at-risk accounts report
GET /api/reports/at-risk
Query: {
  csm_id?: string;
  team_id?: string;
  risk_level?: string;
  signal_type?: RiskSignalType;
  min_arr?: number;
}

Response: {
  summary: AtRiskPortfolio;
  accounts: AtRiskAccount[];
  trends: RiskTrend[];
}

// Get account risk detail
GET /api/reports/at-risk/:customerId
Response: {
  account: AtRiskAccount;
  signal_history: RiskSignal[];
  intervention_history: Intervention[];
  recommendations: string[];
}

// Acknowledge/resolve risk signal
PUT /api/risk-signals/:signalId
{
  status: 'acknowledged' | 'resolved';
  resolution_notes?: string;
}
```

---

## 7. User Interface

### 7.1 At-Risk Dashboard

```
+----------------------------------------------------------+
|  At-Risk Accounts Report                     [Export]     |
+----------------------------------------------------------+
|                                                           |
|  RISK SUMMARY                                             |
|  +----------------+----------------+----------------+     |
|  | At-Risk Count  | ARR at Risk    | % of Portfolio |     |
|  |      14        |    $980K       |      12%       |     |
|  | +3 vs last wk  | +$120K         | Target: <10%   |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  BY RISK LEVEL                                            |
|  +--------------------------------------------------+    |
|  | Critical  | ████ | 3 accounts | $240K ARR        |    |
|  | High      | ██████ | 5 accounts | $380K ARR      |    |
|  | Medium    | ████ | 4 accounts | $260K ARR        |    |
|  | Low       | ██ | 2 accounts | $100K ARR          |    |
|  +--------------------------------------------------+    |
|                                                           |
|  TOP RISK SIGNALS                                         |
|  +--------------------------------------------------+    |
|  | Health Score Drop  | ██████████████ | 8 accounts |    |
|  | Usage Decline      | ██████████ | 6 accounts     |    |
|  | Champion Left      | ████ | 3 accounts           |    |
|  | Support Escalation | ███ | 2 accounts            |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CRITICAL ACCOUNTS (Immediate Attention)                  |
|  +--------------------------------------------------+    |
|  | ! DataFlow Inc ($95K) - Priority Rank: 1          |    |
|  |   Signals: Health drop -28, Champion left         |    |
|  |   Renewal: 45 days | Save play: Active            |    |
|  | ! MegaCorp ($120K) - Priority Rank: 2             |    |
|  |   Signals: Usage -65%, Support escalation         |    |
|  |   Renewal: 28 days | Save play: Not started       |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 At-Risk Account Detail

```
+----------------------------------------------------------+
|  At-Risk: DataFlow Inc                                    |
+----------------------------------------------------------+
|                                                           |
|  RISK OVERVIEW                                            |
|  +--------------------------------------------------+    |
|  | Risk Score: 78/100 (Critical)                     |    |
|  | ARR: $95,000                                      |    |
|  | Renewal: 45 days (Feb 15)                         |    |
|  | Save Play: Active (Started Jan 10)                |    |
|  +--------------------------------------------------+    |
|                                                           |
|  ACTIVE RISK SIGNALS (3)                                  |
|  +------------------------------------------------------+|
|  | Signal           | Severity | Detected | Status      ||
|  |------------------|----------|----------|-------------||
|  | Health Score Drop| Critical | Jan 5    | Active      ||
|  |   Score: 72 → 44 (-28 points)                        ||
|  | Champion Left    | High     | Jan 8    | Active      ||
|  |   Sarah Chen departed company                        ||
|  | Usage Decline    | Medium   | Jan 12   | Active      ||
|  |   DAU down 45% from last month                       ||
|  +------------------------------------------------------+|
|                                                           |
|  RISK TREND (30 Days)                                     |
|  +--------------------------------------------------+    |
|  | 80|                              _______________  |    |
|  | 60|                    _________/                 |    |
|  | 40|___________________/                           |    |
|  |   +------------------------------------------>   |    |
|  +--------------------------------------------------+    |
|                                                           |
|  RECOMMENDED ACTIONS                                      |
|  +--------------------------------------------------+    |
|  | 1. Identify and engage new champion               |    |
|  | 2. Schedule executive-level check-in              |    |
|  | 3. Review product usage and offer training        |    |
|  | 4. Prepare value summary for renewal              |    |
|  +--------------------------------------------------+    |
|                                                           |
|  [Start Save Play] [Schedule Meeting] [Send Email]        |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Detect and track risk signals |
| Researcher | Analyze risk patterns |
| Orchestrator | Coordinate save plays |

### 8.2 Natural Language Queries

```
"Show me at-risk accounts"
"Which accounts have critical risk?"
"Why is DataFlow at risk?"
"What's the total ARR at risk?"
"Show me accounts with champion departures"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] All risk signals are detected and recorded
- [ ] Risk scores calculate correctly
- [ ] Priority ranking factors in ARR and renewal
- [ ] Signal status can be updated
- [ ] Save plays are linked to accounts

### 9.2 Detection Accuracy

- [ ] Health score drops detected within 24 hours
- [ ] Usage declines detected from metrics pipeline
- [ ] Champion departures detected from org changes

---

## 10. Test Cases

### TC-164.1: Risk Score
```
Given: Account with health_drop (critical), usage_decline (medium)
When: Risk score is calculated
Then: Score = (25 * 2.0) + (20 * 1.0) = 70
And: Risk level = High
```

### TC-164.2: Priority Ranking
```
Given: Two critical accounts, $120K and $45K ARR
When: Priority ranks are calculated
Then: Higher ARR account ranked first
And: Imminent renewal increases rank
```

### TC-164.3: Signal Resolution
```
Given: Active risk signal for champion departure
When: CSM marks as resolved with notes
Then: Signal status = resolved
And: Risk score recalculates without this signal
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| At-risk to churned | < 25% | At-risk accounts that actually churn |
| Save rate | > 70% | At-risk accounts saved |
| Detection lead time | > 45 days | Days before churn risk detected |
| Resolution rate | > 80% | Risk signals resolved in 30 days |

---

## 12. Dependencies

- Health score calculation (PRD-153)
- Usage metrics pipeline
- Stakeholder tracking
- Support ticket integration (PRD-156)
- Risk signal detection system

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Signal taxonomy, scoring model |
| Backend | 2 weeks | Detection, calculations |
| Frontend | 2 weeks | Dashboard, detail views |
| Testing | 1 week | Detection accuracy, UAT |
| **Total** | **6 weeks** | |

---

## 14. Open Questions

1. What thresholds define each risk signal?
2. How long should resolved signals impact risk score?
3. Should we auto-initiate save plays for critical accounts?
4. How do we handle overlapping risk signals?

---

## Appendix A: Risk Signal Thresholds

| Signal Type | Detection Threshold |
|-------------|---------------------|
| Health Score Drop | > 15 points in 30 days |
| Usage Decline | > 40% drop in 30 days |
| Engagement Drop | Score < 40 or > 20 point drop |
| Champion Left | Key contact marked as departed |
| Support Escalation | Ticket escalated to management |
| No Login | 30+ days without login |
| NPS Detractor | NPS score < 7 |
| Payment Issue | Invoice overdue > 30 days |
