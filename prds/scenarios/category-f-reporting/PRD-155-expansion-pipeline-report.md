# PRD-155: Expansion Pipeline Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-155 |
| Title | Expansion Pipeline Report |
| Category | F - Reporting & Analytics |
| Priority | P0 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive expansion pipeline report that tracks all upsell, cross-sell, and expansion opportunities across the customer portfolio. The report provides visibility into pipeline value, stage progression, win rates, and expansion forecasting to drive net revenue retention.

---

## 2. Problem Statement

### Current Pain Points
- No unified view of expansion opportunities across the portfolio
- Difficult to track expansion pipeline separate from new business
- Unable to forecast expansion revenue accurately
- No visibility into expansion velocity or win rates
- Missed expansion opportunities due to lack of systematic tracking

### Impact
- Underperformance on NRR targets
- Inefficient resource allocation for expansion motions
- Inability to report on CS-driven revenue
- Lost upsell opportunities

---

## 3. Solution Overview

### High-Level Approach
Build a dedicated expansion pipeline dashboard that tracks all expansion opportunities from identification through close, with forecasting, velocity metrics, and integration with sales systems.

### Key Features
1. **Pipeline Overview** - Total value by stage
2. **Opportunity Tracking** - Individual opportunity details
3. **Stage Progression** - Movement through pipeline stages
4. **Win Rate Analysis** - Historical conversion rates
5. **Velocity Metrics** - Time in stage, average sales cycle
6. **Forecasting** - Weighted pipeline and predictions
7. **Source Attribution** - Track how opportunities were identified

---

## 4. User Stories

### Primary User Stories

```
As a VP of Customer Success,
I want to see the total expansion pipeline and forecast
So that I can report on CS-driven revenue contribution
```

```
As a CSM,
I want to track expansion opportunities in my accounts
So that I can prioritize expansion conversations
```

```
As a CS Ops Lead,
I want to analyze expansion win rates and velocity
So that I can optimize the expansion playbook
```

### Secondary User Stories

```
As a Sales Leader,
I want visibility into CS-qualified expansion opportunities
So that I can support closing larger deals
```

```
As a Finance Lead,
I want to forecast expansion revenue
So that I can build accurate revenue models
```

---

## 5. Functional Requirements

### 5.1 Pipeline Overview

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-155.1 | Display total pipeline value by stage | P0 |
| FR-155.2 | Show opportunity count by stage | P0 |
| FR-155.3 | Calculate weighted pipeline value | P0 |
| FR-155.4 | Track pipeline changes week-over-week | P0 |
| FR-155.5 | Segment by opportunity type (upsell/cross-sell) | P1 |

### 5.2 Opportunity Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-155.6 | Create and track individual opportunities | P0 |
| FR-155.7 | Record opportunity value and probability | P0 |
| FR-155.8 | Track stage progression with timestamps | P0 |
| FR-155.9 | Link opportunities to customers | P0 |
| FR-155.10 | Assign opportunity owner (CSM or Sales) | P0 |
| FR-155.11 | Record close date and actual value | P0 |

### 5.3 Analysis & Metrics

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-155.12 | Calculate win rate by segment | P0 |
| FR-155.13 | Calculate average deal size | P0 |
| FR-155.14 | Track average sales cycle length | P0 |
| FR-155.15 | Compare performance by CSM | P1 |
| FR-155.16 | Identify top expansion sources | P1 |
| FR-155.17 | Track lost opportunity reasons | P1 |

### 5.4 Forecasting

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-155.18 | Generate weighted forecast by period | P0 |
| FR-155.19 | Show forecast vs. target variance | P0 |
| FR-155.20 | Provide best case / commit / worst case views | P1 |
| FR-155.21 | Track forecast accuracy over time | P2 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
enum ExpansionType {
  UPSELL = 'upsell',
  CROSS_SELL = 'cross_sell',
  ADD_ON = 'add_on',
  SEAT_EXPANSION = 'seat_expansion',
  TIER_UPGRADE = 'tier_upgrade'
}

enum ExpansionStage {
  IDENTIFIED = 'identified',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  CLOSED_WON = 'closed_won',
  CLOSED_LOST = 'closed_lost'
}

interface ExpansionOpportunity {
  id: string;
  customer_id: string;
  customer_name: string;

  // Opportunity details
  name: string;
  type: ExpansionType;
  product_line?: string;

  // Value
  estimated_value: number;
  probability: number;
  weighted_value: number;

  // Timeline
  identified_date: string;
  expected_close: string;
  actual_close?: string;

  // Status
  stage: ExpansionStage;
  stage_entered_at: string;

  // Ownership
  csm_id: string;
  sales_rep_id?: string;
  champion_id?: string;

  // Source & context
  source: string; // 'usage_signal', 'qbr', 'csm_identified', etc.
  use_case?: string;
  notes?: string;

  // If closed
  closed_value?: number;
  lost_reason?: string;
}
```

### 6.2 API Endpoints

```typescript
// Get expansion pipeline report
GET /api/reports/expansion-pipeline
Query: {
  period?: { start: string; end: string };
  csm_id?: string;
  type?: ExpansionType;
  stage?: ExpansionStage[];
  customer_id?: string;
}

Response: {
  summary: PipelineSummary;
  by_stage: StageBreakdown[];
  opportunities: ExpansionOpportunity[];
  forecast: ForecastData;
  metrics: ExpansionMetrics;
}

// Create/update opportunity
POST /api/expansion-opportunities
PUT /api/expansion-opportunities/:id

// Get opportunity history
GET /api/expansion-opportunities/:id/history

// Get pipeline analytics
GET /api/reports/expansion-pipeline/analytics
Query: { period: string; dimension: 'csm' | 'type' | 'source' }
```

### 6.3 Data Schema

```typescript
interface PipelineSummary {
  total_opportunities: number;
  total_value: number;
  weighted_value: number;

  by_type: {
    type: ExpansionType;
    count: number;
    value: number;
  }[];

  changes: {
    new_this_week: number;
    new_value: number;
    moved_forward: number;
    closed_won: number;
    closed_lost: number;
  };
}

interface StageBreakdown {
  stage: ExpansionStage;
  count: number;
  value: number;
  weighted_value: number;
  avg_days_in_stage: number;
  conversion_rate: number;
}

interface ExpansionMetrics {
  win_rate: number;
  avg_deal_size: number;
  avg_sales_cycle_days: number;
  expansion_rate: number; // expansion ARR / total ARR

  by_period: {
    period: string;
    won: number;
    value_won: number;
    lost: number;
    value_lost: number;
  }[];

  top_sources: {
    source: string;
    count: number;
    win_rate: number;
  }[];

  lost_reasons: {
    reason: string;
    count: number;
    value_lost: number;
  }[];
}

interface ForecastData {
  period: string;
  target: number;

  commit: number;
  best_case: number;
  weighted: number;

  pipeline_coverage: number;
  gap_to_target: number;

  by_month: {
    month: string;
    forecast: number;
    actual?: number;
  }[];
}
```

---

## 7. User Interface

### 7.1 Pipeline Dashboard

```
+----------------------------------------------------------+
|  Expansion Pipeline Report               [Q1 2026 v]      |
+----------------------------------------------------------+
|                                                           |
|  PIPELINE SUMMARY                                         |
|  +----------------+----------------+----------------+     |
|  | Total Pipeline | Weighted Value | Forecast       |     |
|  |    $1.2M       |    $840K       |    $720K       |     |
|  | 34 opportunities| 70% avg prob  | vs $800K target|     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  PIPELINE BY STAGE                                        |
|  +--------------------------------------------------+    |
|  | Identified  | $320K | ████████ | 12 opps         |    |
|  |             | 20%   |          |                 |    |
|  | Qualified   | $280K | ███████  | 8 opps          |    |
|  |             | 50%   |          |                 |    |
|  | Proposal    | $420K | █████████| 9 opps          |    |
|  |             | 75%   |          |                 |    |
|  | Negotiation | $180K | █████    | 5 opps          |    |
|  |             | 90%   |          |                 |    |
|  +--------------------------------------------------+    |
|                                                           |
|  THIS WEEK'S ACTIVITY                                     |
|  +--------------------------------------------------+    |
|  | +3 new opportunities ($95K)                       |    |
|  | 2 moved to Proposal                               |    |
|  | 1 Closed Won ($45K)                               |    |
|  | 1 Closed Lost ($30K - Budget)                     |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Opportunity List

```
+----------------------------------------------------------+
|  Opportunities                           [+ New] [Export] |
+----------------------------------------------------------+
|  [Stage: All v] [Type: All v] [CSM: All v] [Search...]   |
+----------------------------------------------------------+
|                                                           |
|  +------------------------------------------------------+|
|  | Customer   | Opportunity      | Value | Stage | Close ||
|  |------------|------------------|-------|-------|-------||
|  | Acme Corp  | Premium Tier     | $85K  | Prop  | Feb 15||
|  | TechStart  | 50 add'l seats   | $45K  | Neg   | Feb 8 ||
|  | DataFlow   | Analytics module | $120K | Qual  | Mar 1 ||
|  | CloudNine  | Enterprise upgrade| $200K| Ident | Apr 1 ||
|  | MegaCorp   | API expansion    | $65K  | Prop  | Feb 20||
|  +------------------------------------------------------+|
|                                                           |
|  Showing 5 of 34 opportunities            [< 1 2 3 ... >]|
|                                                           |
+----------------------------------------------------------+
```

### 7.3 Forecast View

```
+----------------------------------------------------------+
|  Expansion Forecast - Q1 2026                             |
+----------------------------------------------------------+
|                                                           |
|  FORECAST VS TARGET                                       |
|  +--------------------------------------------------+    |
|  |                                                   |    |
|  |  Target:    $800K  ████████████████████████████  |    |
|  |  Commit:    $560K  ██████████████████████        |    |
|  |  Best Case: $720K  ████████████████████████████  |    |
|  |  Gap:       $80K                                 |    |
|  |                                                   |    |
|  |  Pipeline Coverage: 1.5x (need 3x for 70% target)|    |
|  +--------------------------------------------------+    |
|                                                           |
|  FORECAST BY MONTH                                        |
|  +--------------------------------------------------+    |
|  |      | Target | Commit | Best | Actual            |    |
|  |------|--------|--------|------|-------------------|    |
|  | Jan  | $260K  | $180K  | $240K| $195K (achieved)  |    |
|  | Feb  | $270K  | $200K  | $280K| -                 |    |
|  | Mar  | $270K  | $180K  | $200K| -                 |    |
|  +--------------------------------------------------+    |
|                                                           |
|  FORECAST ACCURACY (Last 4 Quarters)                      |
|  +--------------------------------------------------+    |
|  | Q4 2025: 92% accuracy (Forecast: $740K, Actual: $680K)|
|  | Q3 2025: 88% accuracy                             |    |
|  | Q2 2025: 95% accuracy                             |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Expansion | Identify and track opportunities |
| Researcher | Qualify opportunities |
| Orchestrator | Generate pipeline reports |

### 8.2 Natural Language Queries

```
"Show me the expansion pipeline"
"What's our forecast for Q1?"
"Which accounts have expansion opportunities?"
"What's our win rate on upsells?"
"Show me opportunities closing this month"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] Pipeline displays all opportunities by stage
- [ ] Weighted values calculate correctly
- [ ] Stage transitions are tracked with timestamps
- [ ] Win/loss records include reasons and values
- [ ] Forecast calculations are accurate

### 9.2 Data Integrity

- [ ] Opportunities sync with Salesforce (if connected)
- [ ] Historical data preserved for trend analysis
- [ ] Closed opportunities maintain audit trail

---

## 10. Test Cases

### TC-155.1: Pipeline Calculation
```
Given: 10 opportunities with values and probabilities
When: Pipeline summary is calculated
Then: Total value sums correctly
And: Weighted value = sum(value * probability)
```

### TC-155.2: Win Rate
```
Given: 20 closed opportunities (15 won, 5 lost)
When: Win rate is calculated
Then: Shows 75% win rate
And: Lost reasons are categorized
```

### TC-155.3: Stage Movement
```
Given: Opportunity moves from Qualified to Proposal
When: Stage is updated
Then: Stage history records transition
And: Time in previous stage is calculated
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Expansion win rate | > 60% | Closed won / total closed |
| Pipeline coverage | > 3x | Pipeline / target |
| Forecast accuracy | > 85% | Forecast vs actual |
| Avg deal velocity | < 45 days | Identified to closed |

---

## 12. Dependencies

- PRD-060: Expansion Opportunity Finder (for signal detection)
- PRD-103: Expansion Signal Detected (for alerts)
- Salesforce integration (for opportunity sync)
- Customer health scores

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Data model, UI mockups |
| Backend | 2 weeks | Opportunity CRUD, calculations |
| Frontend | 2 weeks | Pipeline views, forecasting |
| Integration | 1 week | Salesforce sync |
| Testing | 1 week | Integration tests, UAT |
| **Total** | **7 weeks** | |

---

## 14. Open Questions

1. Should opportunities sync bi-directionally with Salesforce?
2. How do we handle opportunities owned by Sales vs. CSM?
3. What triggers automatic opportunity creation from signals?
4. Should we track multi-year deal values differently?

---

## Appendix A: Expansion Stages & Probabilities

| Stage | Default Probability | Exit Criteria |
|-------|---------------------|---------------|
| Identified | 10% | Signal detected, not yet discussed |
| Qualified | 40% | Customer confirmed interest |
| Proposal | 60% | Formal proposal sent |
| Negotiation | 80% | Active pricing/terms discussion |
| Closed Won | 100% | Contract signed |
| Closed Lost | 0% | Customer declined |
