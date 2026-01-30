# PRD-152: Churn Analysis Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-152 |
| Title | Churn Analysis Report |
| Category | F - Reporting & Analytics |
| Priority | P0 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Provide comprehensive churn analysis reporting that helps Customer Success teams understand churn patterns, identify leading indicators, and develop data-driven retention strategies. The report analyzes historical churn data, identifies common churn factors, and provides predictive insights for current at-risk accounts.

---

## 2. Problem Statement

### Current Pain Points
- No systematic analysis of why customers churn
- Unable to identify common patterns across churned customers
- Lack of data-driven approach to retention strategy
- Post-mortems are inconsistent and rarely aggregated
- No visibility into churn trends over time

### Impact
- Repeated churn from similar causes
- Ineffective retention investments
- Inability to prove ROI of CS interventions
- Missed opportunities for early intervention

---

## 3. Solution Overview

### High-Level Approach
Build a comprehensive churn analytics engine that tracks, categorizes, and analyzes all churn events, identifies patterns, and generates actionable insights for retention improvement.

### Key Features
1. **Churn Timeline** - Historical view of all churn events
2. **Churn Categorization** - Classify churn by type and reason
3. **Pattern Detection** - Identify common pre-churn signals
4. **Cohort Analysis** - Compare churn rates by customer segment
5. **Predictive Alerts** - Flag accounts showing churn patterns
6. **ROI Analysis** - Track effectiveness of save attempts
7. **Trend Reporting** - Churn rate trends over time

---

## 4. User Stories

### Primary User Stories

```
As a VP of Customer Success,
I want to see comprehensive churn analysis across my portfolio
So that I can develop data-driven retention strategies
```

```
As a CSM Manager,
I want to understand what factors led to recent churns
So that I can coach my team on prevention
```

```
As a CSM,
I want to know which of my accounts exhibit churn warning signs
So that I can prioritize intervention efforts
```

### Secondary User Stories

```
As a Product Manager,
I want to see churn reasons related to product gaps
So that I can prioritize feature development
```

```
As a Finance Lead,
I want to forecast expected churn for revenue planning
So that I can build accurate financial models
```

---

## 5. Functional Requirements

### 5.1 Churn Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-152.1 | Record all churn events with full context | P0 |
| FR-152.2 | Categorize churn by primary reason | P0 |
| FR-152.3 | Track ARR impact of each churn | P0 |
| FR-152.4 | Capture pre-churn warning signals | P0 |
| FR-152.5 | Link churn to any save play attempts | P1 |
| FR-152.6 | Record timeline from first risk signal to churn | P1 |

### 5.2 Analysis Capabilities

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-152.7 | Calculate churn rate by period (monthly, quarterly, annually) | P0 |
| FR-152.8 | Segment churn by customer size, industry, tenure | P0 |
| FR-152.9 | Identify top 5 churn reasons with frequency | P0 |
| FR-152.10 | Detect pattern sequences preceding churn | P1 |
| FR-152.11 | Compare churn rates across CSM portfolios | P1 |
| FR-152.12 | Calculate average time from risk signal to churn | P1 |

### 5.3 Predictive Features

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-152.13 | Score current accounts for churn risk | P0 |
| FR-152.14 | Identify accounts matching historical churn patterns | P0 |
| FR-152.15 | Predict churn probability for next 90 days | P1 |
| FR-152.16 | Recommend interventions based on similar saved accounts | P1 |

### 5.4 Reporting

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-152.17 | Generate monthly churn analysis report | P0 |
| FR-152.18 | Provide executive summary dashboard | P0 |
| FR-152.19 | Export detailed churn data to CSV | P1 |
| FR-152.20 | Schedule automated report delivery | P2 |

---

## 6. Technical Requirements

### 6.1 Data Sources

| Source | Data Points | Integration |
|--------|-------------|-------------|
| `customers` table | Churn status, dates, ARR | Direct query |
| `risk_signals` table | Pre-churn warnings | Historical analysis |
| `save_plays` table | Intervention attempts | Join query |
| `health_score_history` | Score trajectory | Trend analysis |
| `usage_metrics` | Usage decline patterns | Aggregation |
| `meeting_analyses` | Sentiment trends | NLP analysis |

### 6.2 Churn Reason Taxonomy

```typescript
enum ChurnReason {
  // Product-related
  PRODUCT_FIT = 'product_fit',
  MISSING_FEATURES = 'missing_features',
  PRODUCT_QUALITY = 'product_quality',

  // Business-related
  BUDGET_CUT = 'budget_cut',
  COMPANY_CLOSED = 'company_closed',
  ACQUIRED = 'acquired',
  STRATEGIC_CHANGE = 'strategic_change',

  // Relationship-related
  CHAMPION_LEFT = 'champion_left',
  POOR_RELATIONSHIP = 'poor_relationship',
  SUPPORT_ISSUES = 'support_issues',

  // Competitive
  COMPETITOR_WIN = 'competitor_win',
  PRICE_COMPETITION = 'price_competition',

  // Other
  CONSOLIDATION = 'consolidation',
  UNKNOWN = 'unknown'
}
```

### 6.3 API Endpoints

```typescript
// Get churn analysis report
GET /api/reports/churn-analysis
Query: {
  start_date: string;
  end_date: string;
  segment?: string;
  csm_id?: string;
  reason_filter?: ChurnReason[];
}

Response: {
  summary: ChurnSummary;
  churned_accounts: ChurnedAccount[];
  trends: ChurnTrend[];
  patterns: ChurnPattern[];
  predictions: ChurnPrediction[];
}

// Record churn event
POST /api/churn/record
{
  customer_id: string;
  churn_date: string;
  primary_reason: ChurnReason;
  secondary_reasons?: ChurnReason[];
  arr_lost: number;
  notes: string;
  exit_interview?: ExitInterview;
}

// Get churn predictions for portfolio
GET /api/churn/predictions
Query: { csm_id?: string; threshold?: number; }
```

### 6.4 Data Schema

```typescript
interface ChurnEvent {
  id: string;
  customer_id: string;
  customer_name: string;
  churn_date: string;
  arr_lost: number;

  // Classification
  primary_reason: ChurnReason;
  secondary_reasons: ChurnReason[];
  controllable: boolean;

  // Context
  tenure_months: number;
  segment: string;
  industry: string;
  csm_id: string;

  // Pre-churn signals
  first_risk_signal_date: string;
  days_from_signal_to_churn: number;
  warning_signals: RiskSignal[];

  // Intervention
  save_play_attempted: boolean;
  save_play_id?: string;
  intervention_notes?: string;

  // Post-mortem
  exit_interview_completed: boolean;
  lessons_learned?: string;
}

interface ChurnAnalysisReport {
  period: { start: string; end: string };

  summary: {
    total_churned: number;
    total_arr_lost: number;
    churn_rate: number;
    gross_churn_rate: number;
    net_churn_rate: number;
    controllable_churn_pct: number;
  };

  by_reason: {
    reason: ChurnReason;
    count: number;
    arr_lost: number;
    percentage: number;
  }[];

  by_segment: {
    segment: string;
    churned: number;
    total: number;
    rate: number;
  }[];

  by_tenure: {
    bucket: string;
    churned: number;
    rate: number;
  }[];

  trends: {
    period: string;
    churned: number;
    arr_lost: number;
    rate: number;
  }[];

  patterns: {
    pattern_name: string;
    frequency: number;
    confidence: number;
    example_signals: string[];
  }[];

  predictions: {
    customer_id: string;
    customer_name: string;
    churn_probability: number;
    matching_patterns: string[];
    recommended_actions: string[];
  }[];
}
```

---

## 7. User Interface

### 7.1 Churn Dashboard

```
+----------------------------------------------------------+
|  Churn Analysis Report                    [Export] [Share]|
|  Period: Q4 2025                                          |
+----------------------------------------------------------+
|                                                           |
|  CHURN SUMMARY                                            |
|  +---------------+---------------+---------------+        |
|  | Customers Lost| ARR Lost      | Churn Rate    |        |
|  |      12       |   $840K       |    4.2%       |        |
|  | vs Q3: +3     | vs Q3: +$120K | vs Q3: +0.8%  |        |
|  +---------------+---------------+---------------+        |
|                                                           |
|  CHURN BY REASON                                          |
|  +-----------------------------------------------+        |
|  | Budget Cut          ████████████ 35% ($294K)  |        |
|  | Champion Left       ████████ 22% ($185K)      |        |
|  | Product Fit         ██████ 18% ($151K)        |        |
|  | Competitor Win      ████ 15% ($126K)          |        |
|  | Other               ███ 10% ($84K)            |        |
|  +-----------------------------------------------+        |
|                                                           |
|  CHURN TREND (12 Months)                                  |
|  +-----------------------------------------------+        |
|  |    ^                                          |        |
|  |  5%|      *           *                       |        |
|  |  4%|  *       *   *       *   *               |        |
|  |  3%|                              *   *       |        |
|  |    +------------------------------------>     |        |
|  |     J  F  M  A  M  J  J  A  S  O  N  D        |        |
|  +-----------------------------------------------+        |
|                                                           |
|  HIGH-RISK ACCOUNTS (Pattern Match)          [View All]   |
|  +-----------------------------------------------+        |
|  | Acme Corp      | 78% risk | Champion departure |        |
|  | TechStart      | 65% risk | Usage decline      |        |
|  | GlobalRetail   | 61% risk | Support escalation |        |
|  +-----------------------------------------------+        |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Churn Detail View

```
+----------------------------------------------------------+
|  Churned Account: DataFlow Inc.                           |
+----------------------------------------------------------+
|                                                           |
|  CHURN DETAILS                                            |
|  +-----------------------------------------------+        |
|  | Churn Date:      | December 15, 2025          |        |
|  | ARR Lost:        | $85,000                    |        |
|  | Primary Reason:  | Champion Left              |        |
|  | Secondary:       | Budget Constraints         |        |
|  | Tenure:          | 18 months                  |        |
|  | Controllable:    | Partially                  |        |
|  +-----------------------------------------------+        |
|                                                           |
|  PRE-CHURN TIMELINE                                       |
|  +-----------------------------------------------+        |
|  | Oct 5  | Champion (Sarah) announced departure |        |
|  | Oct 12 | Health score dropped 72 → 58        |        |
|  | Oct 20 | Save play initiated                  |        |
|  | Nov 8  | New contact unresponsive             |        |
|  | Nov 22 | Renewal conversation declined        |        |
|  | Dec 15 | Official churn notification          |        |
|  +-----------------------------------------------+        |
|                                                           |
|  LESSONS LEARNED                                          |
|  +-----------------------------------------------+        |
|  | - Should have multi-threaded earlier          |        |
|  | - New champion was never fully engaged        |        |
|  | - Budget cuts indicated 60 days prior         |        |
|  +-----------------------------------------------+        |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Researcher | Analyze churn patterns |
| Monitor | Track risk signals and predictions |
| Orchestrator | Generate comprehensive reports |

### 8.2 Natural Language Queries

```
"Show me churn analysis for last quarter"
"Why did our customers churn this year?"
"Which accounts are at risk of churning?"
"What are the top churn reasons for enterprise accounts?"
"Compare churn rates by CSM"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] All churn events are recorded with complete metadata
- [ ] Churn reasons can be categorized using standard taxonomy
- [ ] Churn rate calculations are accurate (gross and net)
- [ ] Pattern detection identifies common pre-churn sequences
- [ ] Predictions score accounts based on historical patterns

### 9.2 Reporting

- [ ] Dashboard displays all summary metrics
- [ ] Trends show accurate historical data
- [ ] Filters work correctly for segment/period/reason
- [ ] Export produces valid CSV with all data

### 9.3 Predictions

- [ ] Churn probability scores update daily
- [ ] High-risk accounts are flagged prominently
- [ ] Recommended actions are contextually relevant

---

## 10. Test Cases

### TC-152.1: Churn Rate Calculation
```
Given: 100 customers at period start, 5 churned, 10 new
When: Churn rate is calculated
Then: Gross churn = 5%, calculated correctly
And: Net accounts = 105
```

### TC-152.2: Pattern Detection
```
Given: 10 churned customers with "champion left" as primary reason
When: Pattern analysis runs
Then: "Champion departure" pattern is identified
And: Current accounts with departing champions are flagged
```

### TC-152.3: Cohort Comparison
```
Given: Enterprise segment with 2% churn, SMB with 8% churn
When: Segment analysis is generated
Then: Report shows accurate rates per segment
And: SMB is flagged as higher-risk segment
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Churn prediction accuracy | > 75% | Predicted churns that actually churned |
| Early warning time | > 60 days | Average days from prediction to churn |
| Report usage | 80% of managers | Weekly active users of churn reports |
| Actionable insights | > 5 per report | Insights leading to interventions |

---

## 12. Dependencies

- PRD-164: At-Risk Accounts Report (for risk signal integration)
- PRD-216: Predictive Churn Scoring (for prediction models)
- PRD-176: Predictive Analytics Report (for pattern detection)
- Risk signals detection system
- Health score tracking

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Data model, UI mockups |
| Churn Tracking | 2 weeks | Recording, categorization |
| Analysis Engine | 2 weeks | Calculations, patterns |
| Predictions | 2 weeks | ML model, scoring |
| Dashboard | 1 week | UI implementation |
| Testing | 1 week | Integration tests, UAT |
| **Total** | **9 weeks** | |

---

## 14. Open Questions

1. How should we handle "win-back" customers who return after churning?
2. What is the minimum data needed before pattern detection is reliable?
3. Should churn predictions include confidence intervals?
4. How do we handle partial churn (downgrades)?

---

## Appendix A: Churn Reason Definitions

| Reason | Definition | Controllable |
|--------|------------|--------------|
| Product Fit | Product doesn't meet core needs | Partially |
| Missing Features | Specific features required but unavailable | Partially |
| Budget Cut | Customer reduced spending | No |
| Champion Left | Primary advocate departed | Partially |
| Competitor Win | Lost to competing solution | Yes |
| Support Issues | Dissatisfaction with support | Yes |
| Company Closed | Customer went out of business | No |
