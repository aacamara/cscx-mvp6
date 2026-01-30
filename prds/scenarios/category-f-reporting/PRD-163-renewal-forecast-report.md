# PRD-163: Renewal Forecast Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-163 |
| Title | Renewal Forecast Report |
| Category | F - Reporting & Analytics |
| Priority | P0 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive renewal forecast report that provides visibility into upcoming renewals, forecasts renewal outcomes, and tracks progress toward retention targets. This enables proactive renewal management and accurate revenue planning.

---

## 2. Problem Statement

### Current Pain Points
- No unified view of renewal pipeline and forecast
- Difficult to predict renewal outcomes accurately
- Cannot identify at-risk renewals early enough
- Missing visibility into renewal readiness
- No systematic tracking of renewal actions

### Impact
- Surprise churn from missed renewals
- Inaccurate revenue forecasting
- Reactive renewal conversations
- Inefficient allocation of renewal resources

---

## 3. Solution Overview

### High-Level Approach
Build a renewal forecasting system that tracks all upcoming renewals, assesses risk levels, forecasts outcomes, and provides actionable insights for renewal management.

### Key Features
1. **Renewal Calendar** - Visual view of upcoming renewals
2. **Forecast Accuracy** - Predicted renewal outcomes
3. **Risk Assessment** - Renewal risk indicators
4. **Readiness Tracking** - Renewal preparation checklist
5. **Pipeline Analytics** - Renewal pipeline metrics
6. **Trend Analysis** - Historical renewal performance
7. **Alert System** - Proactive renewal notifications

---

## 4. User Stories

### Primary User Stories

```
As a VP of CS,
I want to see renewal forecast for the quarter
So that I can report on expected retention
```

```
As a CSM Manager,
I want to identify at-risk renewals early
So that I can allocate resources for intervention
```

```
As a CSM,
I want to track renewal readiness for my accounts
So that I can ensure timely renewal conversations
```

---

## 5. Functional Requirements

### 5.1 Renewal Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-163.1 | Display all renewals by date | P0 |
| FR-163.2 | Show renewal ARR value | P0 |
| FR-163.3 | Track renewal stage/status | P0 |
| FR-163.4 | Record renewal probability | P0 |
| FR-163.5 | Track days to renewal | P0 |

### 5.2 Forecasting

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-163.6 | Calculate weighted renewal forecast | P0 |
| FR-163.7 | Show commit vs. best case scenarios | P0 |
| FR-163.8 | Track forecast vs. target | P0 |
| FR-163.9 | Compare to historical performance | P1 |
| FR-163.10 | Forecast by segment/tier | P1 |

### 5.3 Risk Assessment

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-163.11 | Score renewal risk based on health | P0 |
| FR-163.12 | Factor in engagement levels | P0 |
| FR-163.13 | Consider support history | P1 |
| FR-163.14 | Include stakeholder sentiment | P1 |
| FR-163.15 | Flag high-risk renewals | P0 |

### 5.4 Readiness Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-163.16 | Define renewal readiness checklist | P0 |
| FR-163.17 | Track checklist completion | P0 |
| FR-163.18 | Alert on overdue tasks | P0 |
| FR-163.19 | Show recommended actions | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface Renewal {
  id: string;
  customer_id: string;
  customer_name: string;

  // Renewal details
  renewal_date: string;
  days_to_renewal: number;
  current_arr: number;
  proposed_arr?: number;

  // Status
  stage: RenewalStage;
  probability: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';

  // Factors
  health_score: number;
  engagement_score: number;
  nps_score?: number;

  // Readiness
  readiness_score: number;
  checklist: RenewalChecklistItem[];

  // Outcome (if complete)
  outcome?: 'renewed' | 'churned' | 'downgraded' | 'expanded';
  outcome_arr?: number;
}

enum RenewalStage {
  NOT_STARTED = 'not_started',
  PREP = 'prep',
  VALUE_REVIEW = 'value_review',
  PROPOSAL_SENT = 'proposal_sent',
  NEGOTIATION = 'negotiation',
  VERBAL_COMMIT = 'verbal_commit',
  CLOSED = 'closed'
}

interface RenewalForecast {
  period: string;
  target: number;

  pipeline: {
    total_renewals: number;
    total_arr: number;
    weighted_arr: number;
  };

  forecast: {
    commit: number;
    best_case: number;
    at_risk: number;
  };

  by_stage: {
    stage: RenewalStage;
    count: number;
    arr: number;
  }[];

  by_risk: {
    risk_level: string;
    count: number;
    arr: number;
  }[];
}
```

### 6.2 Risk Calculation

```typescript
function calculateRenewalRisk(renewal: Renewal): string {
  let riskScore = 0;

  // Health score factor (0-40 points)
  if (renewal.health_score < 40) riskScore += 40;
  else if (renewal.health_score < 60) riskScore += 25;
  else if (renewal.health_score < 70) riskScore += 10;

  // Engagement factor (0-25 points)
  if (renewal.engagement_score < 40) riskScore += 25;
  else if (renewal.engagement_score < 60) riskScore += 15;
  else if (renewal.engagement_score < 70) riskScore += 5;

  // Time factor (0-20 points)
  if (renewal.days_to_renewal < 30 && renewal.stage === 'not_started') {
    riskScore += 20;
  } else if (renewal.days_to_renewal < 60 && renewal.stage === 'not_started') {
    riskScore += 10;
  }

  // NPS factor (0-15 points)
  if (renewal.nps_score !== undefined) {
    if (renewal.nps_score < 7) riskScore += 15;
    else if (renewal.nps_score < 8) riskScore += 5;
  }

  // Categorize
  if (riskScore >= 60) return 'critical';
  if (riskScore >= 40) return 'high';
  if (riskScore >= 20) return 'medium';
  return 'low';
}
```

### 6.3 API Endpoints

```typescript
// Get renewal forecast
GET /api/reports/renewal-forecast
Query: {
  period?: string;
  csm_id?: string;
  risk_level?: string;
  days_range?: { min: number; max: number };
}

Response: {
  forecast: RenewalForecast;
  renewals: Renewal[];
  calendar: RenewalCalendarView;
  trends: RenewalTrend[];
}

// Get renewal detail
GET /api/reports/renewal-forecast/:customerId
Response: {
  renewal: Renewal;
  history: RenewalHistory[];
  checklist: RenewalChecklistItem[];
  recommendations: string[];
}

// Update renewal status
PUT /api/renewals/:id
{
  stage?: RenewalStage;
  probability?: number;
  proposed_arr?: number;
  notes?: string;
}
```

---

## 7. User Interface

### 7.1 Renewal Forecast Dashboard

```
+----------------------------------------------------------+
|  Renewal Forecast - Q1 2026                  [Export]     |
+----------------------------------------------------------+
|                                                           |
|  FORECAST SUMMARY                                         |
|  +----------------+----------------+----------------+     |
|  | Total Up       | Weighted       | vs Target      |     |
|  |   $2.4M        |   $2.1M        |   $2.5M        |     |
|  | 28 renewals    | 87% probability| Gap: $400K     |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  FORECAST BREAKDOWN                                       |
|  +--------------------------------------------------+    |
|  | Commit (>90%)  | ████████████████████ | $1.6M    |    |
|  | Likely (70-90%)| ████████████ | $520K            |    |
|  | At Risk (<70%) | █████ | $280K                   |    |
|  +--------------------------------------------------+    |
|                                                           |
|  BY RISK LEVEL                                            |
|  +--------------------------------------------------+    |
|  | Low Risk       | ████████████████████ | 18 ($1.8M)|   |
|  | Medium Risk    | ██████ | 6 ($380K)               |   |
|  | High Risk      | ███ | 3 ($180K)                  |   |
|  | Critical       | █ | 1 ($40K)                     |   |
|  +--------------------------------------------------+    |
|                                                           |
|  RENEWAL CALENDAR (Next 90 Days)                          |
|  +--------------------------------------------------+    |
|  | Feb 2026                                          |    |
|  | ░░░▓▓░░░░░▓░░░▓▓▓░░░░░▓░░░                       |    |
|  | Mar 2026                                          |    |
|  | ▓░░░░▓▓░░░░░░▓░░░▓░░░▓▓░░░░░                     |    |
|  | (▓ = renewal, darker = higher ARR)                |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Renewal Pipeline View

```
+----------------------------------------------------------+
|  Renewal Pipeline                         [Add Filters]   |
+----------------------------------------------------------+
|                                                           |
|  +------------------------------------------------------+|
|  | Customer   | ARR    | Days | Stage    | Risk | Prob  ||
|  |------------|--------|------|----------|------|-------||
|  | Acme Corp  | $120K  | 28   | Proposal | Low  | 90%   ||
|  | TechStart  | $65K   | 35   | Value Rev| Med  | 75%   ||
|  | DataFlow   | $45K   | 18   | Not Start| High | 50%   ||
|  | CloudNine  | $90K   | 52   | Prep     | Low  | 85%   ||
|  | MegaCorp   | $180K  | 45   | Negotiat | Med  | 80%   ||
|  +------------------------------------------------------+|
|                                                           |
|  HIGH RISK RENEWALS                           [View All]  |
|  +--------------------------------------------------+    |
|  | ! DataFlow ($45K) - 18 days, stage: Not Started  |    |
|  |   Health: 42, No recent contact                   |    |
|  |   ACTION: Immediate outreach required             |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.3 Renewal Detail

```
+----------------------------------------------------------+
|  Renewal: Acme Corp                                       |
+----------------------------------------------------------+
|                                                           |
|  RENEWAL OVERVIEW                                         |
|  +--------------------------------------------------+    |
|  | Renewal Date: Feb 25, 2026 (28 days)              |    |
|  | Current ARR: $120,000                             |    |
|  | Proposed ARR: $135,000 (+$15K expansion)          |    |
|  | Probability: 90%                                  |    |
|  | Risk Level: Low                                   |    |
|  +--------------------------------------------------+    |
|                                                           |
|  READINESS CHECKLIST                         Score: 85%   |
|  +--------------------------------------------------+    |
|  | ✓ Value summary sent                              |    |
|  | ✓ QBR completed                                   |    |
|  | ✓ Executive sponsor engaged                       |    |
|  | ✓ Renewal proposal drafted                        |    |
|  | ○ Contract sent for signature                     |    |
|  | ○ Verbal commitment received                      |    |
|  +--------------------------------------------------+    |
|                                                           |
|  RISK FACTORS                                             |
|  +--------------------------------------------------+    |
|  | Health Score: 78 (Healthy)                ✓      |    |
|  | Engagement: 72 (Good)                     ✓      |    |
|  | NPS: 8 (Promoter)                         ✓      |    |
|  | Support Tickets: 2 open                   ⚠      |    |
|  +--------------------------------------------------+    |
|                                                           |
|  NEXT STEPS                                               |
|  +--------------------------------------------------+    |
|  | 1. Send final contract (Due: Feb 10)              |    |
|  | 2. Schedule signature call with Sarah             |    |
|  | 3. Close support tickets before renewal           |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track renewal dates and risk |
| Scheduler | Schedule renewal meetings |
| Communicator | Send renewal-related emails |

### 8.2 Natural Language Queries

```
"Show me renewals coming up this quarter"
"Which renewals are at risk?"
"What's the renewal forecast for Q1?"
"How is Acme's renewal progressing?"
"Generate renewal report for my portfolio"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] All renewals display with accurate dates
- [ ] Risk levels calculate correctly
- [ ] Forecast values are accurate (weighted)
- [ ] Readiness checklists track progress
- [ ] Stage transitions are recorded

### 9.2 Alerting

- [ ] High-risk renewals are flagged
- [ ] Upcoming renewals without action are alerted
- [ ] Readiness gaps are surfaced

---

## 10. Test Cases

### TC-163.1: Forecast Calculation
```
Given: 5 renewals with varying probabilities and ARR
When: Weighted forecast is calculated
Then: Weighted ARR = sum(ARR * probability)
And: Forecast shows commit/likely/at-risk breakdown
```

### TC-163.2: Risk Assessment
```
Given: Renewal with health 38, engagement 45, 25 days out
When: Risk is calculated
Then: Risk = Critical
And: Renewal flagged in high-risk section
```

### TC-163.3: Readiness Tracking
```
Given: Renewal with 4/6 checklist items complete
When: Readiness is calculated
Then: Shows 67% readiness
And: Remaining tasks are highlighted
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Forecast accuracy | > 90% | Predicted vs actual renewals |
| Gross retention | > 90% | ARR retained / ARR up for renewal |
| At-risk conversion | > 70% | At-risk renewals saved |
| Renewal timing | 30+ days | Average days from proposal to close |

---

## 12. Dependencies

- Customer renewal dates in database
- PRD-153: Health Score Portfolio View
- PRD-164: At-Risk Accounts Report
- Contract management system

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Risk model, UI mockups |
| Backend | 2 weeks | Forecasting, risk calculation |
| Frontend | 2 weeks | Dashboard, pipeline views |
| Testing | 1 week | Accuracy validation, UAT |
| **Total** | **6 weeks** | |

---

## 14. Open Questions

1. Should forecast include expected expansion/contraction?
2. How do we handle multi-year contracts?
3. What triggers stage transitions?
4. Should we integrate with contract management systems?

---

## Appendix A: Renewal Readiness Checklist

| Item | Timing | Owner |
|------|--------|-------|
| Value summary created | 90 days out | CSM |
| QBR completed | 60 days out | CSM |
| Executive sponsor engaged | 60 days out | CSM |
| Renewal proposal drafted | 45 days out | CSM |
| Proposal sent to customer | 30 days out | CSM |
| Verbal commitment received | 14 days out | CSM |
| Contract signed | 0 days | Customer |
