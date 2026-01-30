# PRD-158: Revenue Analytics Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-158 |
| Title | Revenue Analytics Report |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive revenue analytics report that provides visibility into ARR, MRR, revenue movements (expansion, contraction, churn), and revenue health across the customer portfolio. This enables CS leaders to understand and report on the financial impact of customer success activities.

---

## 2. Problem Statement

### Current Pain Points
- No unified view of revenue metrics by CSM/segment
- Difficult to track revenue movements over time
- Cannot attribute revenue changes to CS activities
- Missing insights on revenue concentration and risk
- Inability to forecast revenue outcomes accurately

### Impact
- Limited visibility into CS revenue contribution
- Inaccurate financial planning
- Inability to demonstrate CS ROI
- Missed early warnings on revenue risk

---

## 3. Solution Overview

### High-Level Approach
Build a revenue analytics dashboard that aggregates financial data, tracks movements, calculates key metrics, and provides actionable insights for revenue optimization.

### Key Features
1. **ARR/MRR Tracking** - Current and historical revenue
2. **Revenue Movements** - Expansion, contraction, churn
3. **Net Revenue Retention** - NRR calculations
4. **Revenue Concentration** - Risk from large customers
5. **Segment Analysis** - Revenue by cohort
6. **Forecasting** - Revenue projections
7. **CSM Attribution** - Revenue by CSM

---

## 4. User Stories

### Primary User Stories

```
As a VP of Customer Success,
I want to see total portfolio ARR and revenue movements
So that I can report on CS financial performance
```

```
As a CSM Manager,
I want to see ARR breakdown by team member
So that I can understand revenue responsibility distribution
```

```
As a Finance Leader,
I want to track net revenue retention
So that I can build accurate financial models
```

---

## 5. Functional Requirements

### 5.1 Revenue Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-158.1 | Display total ARR across portfolio | P0 |
| FR-158.2 | Calculate MRR from ARR | P0 |
| FR-158.3 | Track ARR changes over time | P0 |
| FR-158.4 | Break down ARR by segment | P0 |
| FR-158.5 | Show ARR by customer | P0 |

### 5.2 Revenue Movements

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-158.6 | Track new business ARR | P0 |
| FR-158.7 | Track expansion ARR | P0 |
| FR-158.8 | Track contraction ARR | P0 |
| FR-158.9 | Track churned ARR | P0 |
| FR-158.10 | Calculate net ARR movement | P0 |
| FR-158.11 | Show movement reasons | P1 |

### 5.3 Retention Metrics

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-158.12 | Calculate gross revenue retention | P0 |
| FR-158.13 | Calculate net revenue retention | P0 |
| FR-158.14 | Track retention by cohort | P1 |
| FR-158.15 | Compare retention across segments | P1 |
| FR-158.16 | Show retention trends | P0 |

### 5.4 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-158.17 | Calculate revenue concentration risk | P0 |
| FR-158.18 | Track ARPA (average revenue per account) | P1 |
| FR-158.19 | Show revenue distribution curve | P2 |
| FR-158.20 | Attribute revenue to CSMs | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface RevenueRecord {
  id: string;
  customer_id: string;
  effective_date: string;

  // Revenue values
  arr: number;
  mrr: number;
  currency: string;

  // Categorization
  segment: string;
  tier: string;
  csm_id: string;
}

interface RevenueMovement {
  id: string;
  customer_id: string;
  movement_date: string;

  type: 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation';
  previous_arr: number;
  new_arr: number;
  change_amount: number;

  reason?: string;
  source?: string; // 'upsell', 'downsell', 'price_change', 'churn'
}

interface RevenueMetrics {
  period: string;

  totals: {
    starting_arr: number;
    ending_arr: number;
    starting_mrr: number;
    ending_mrr: number;
    customer_count: number;
  };

  movements: {
    new_business: number;
    expansion: number;
    contraction: number;
    churn: number;
    net_change: number;
  };

  retention: {
    gross_retention: number;
    net_retention: number;
    logo_retention: number;
  };

  averages: {
    arpa: number;
    arpa_change: number;
    lifetime_value: number;
  };
}
```

### 6.2 Retention Calculations

```typescript
// Gross Revenue Retention (GRR)
// Revenue retained excluding expansion
function calculateGRR(
  startingARR: number,
  contraction: number,
  churn: number
): number {
  return ((startingARR - contraction - churn) / startingARR) * 100;
}

// Net Revenue Retention (NRR)
// Revenue retained including expansion
function calculateNRR(
  startingARR: number,
  expansion: number,
  contraction: number,
  churn: number
): number {
  return ((startingARR + expansion - contraction - churn) / startingARR) * 100;
}

// Logo Retention
function calculateLogoRetention(
  startingCustomers: number,
  churned: number
): number {
  return ((startingCustomers - churned) / startingCustomers) * 100;
}
```

### 6.3 API Endpoints

```typescript
// Get revenue analytics
GET /api/reports/revenue-analytics
Query: {
  period?: string;
  segment?: string;
  csm_id?: string;
}

Response: {
  summary: RevenueSummary;
  movements: RevenueMovement[];
  trends: RevenueTrend[];
  by_segment: SegmentBreakdown[];
  by_csm: CSMBreakdown[];
}

// Get revenue history
GET /api/reports/revenue-analytics/history
Query: { periods: number }

// Get revenue concentration
GET /api/reports/revenue-analytics/concentration
```

---

## 7. User Interface

### 7.1 Revenue Dashboard

```
+----------------------------------------------------------+
|  Revenue Analytics                       [Q1 2026 v]      |
+----------------------------------------------------------+
|                                                           |
|  REVENUE SUMMARY                                          |
|  +----------------+----------------+----------------+     |
|  | Total ARR      | MRR            | Customers      |     |
|  |   $12.4M       |    $1.03M      |      156       |     |
|  | +$840K (+7%)   | +$70K          | +12 net new    |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  REVENUE MOVEMENTS THIS QUARTER                           |
|  +--------------------------------------------------+    |
|  | New Business    | ████████████████ | +$420K       |    |
|  | Expansion       | ██████████████ | +$680K         |    |
|  | Contraction     | ████ | -$85K                    |    |
|  | Churn           | ██████ | -$175K                 |    |
|  | NET CHANGE      |              | +$840K           |    |
|  +--------------------------------------------------+    |
|                                                           |
|  RETENTION METRICS                                        |
|  +----------------+----------------+----------------+     |
|  | Gross Retention| Net Retention  | Logo Retention |     |
|  |     94%        |     108%       |      96%       |     |
|  | Target: 92%    | Target: 105%   | Target: 95%    |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  ARR TREND (12 Months)                                    |
|  +--------------------------------------------------+    |
|  | $13M|                              ____         |    |
|  | $12M|                    _________/              |    |
|  | $11M|___________________/                        |    |
|  |     +------------------------------------------>  |    |
|  |      J F M A M J J A S O N D J                   |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Revenue by Segment

```
+----------------------------------------------------------+
|  Revenue by Segment                                       |
+----------------------------------------------------------+
|                                                           |
|  +------------------------------------------------------+|
|  | Segment    | ARR     | % Total | NRR   | Change      ||
|  |------------|---------|---------|-------|-------------||
|  | Enterprise | $6.2M   |  50%    | 112%  | +$520K      ||
|  | Mid-Market | $4.1M   |  33%    | 106%  | +$280K      ||
|  | SMB        | $2.1M   |  17%    | 98%   | +$40K       ||
|  +------------------------------------------------------+|
|                                                           |
|  REVENUE CONCENTRATION                                    |
|  +--------------------------------------------------+    |
|  | Top 10 customers = 45% of ARR ($5.6M)             |    |
|  | Top 25 customers = 68% of ARR ($8.4M)             |    |
|  |                                                   |    |
|  | ⚠ High concentration risk in Enterprise          |    |
|  |   Acme Corp alone = 8% of total ARR              |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.3 Revenue Movement Detail

```
+----------------------------------------------------------+
|  Revenue Movements - Q1 2026                              |
+----------------------------------------------------------+
|                                                           |
|  EXPANSION (+$680K)                           [View All]  |
|  +------------------------------------------------------+|
|  | Acme Corp     | +$120K | Premium upgrade             ||
|  | TechStart     | +$85K  | 50 additional seats         ||
|  | GlobalRetail  | +$75K  | Analytics module            ||
|  +------------------------------------------------------+|
|                                                           |
|  CONTRACTION (-$85K)                          [View All]  |
|  +------------------------------------------------------+|
|  | DataFlow      | -$35K  | Reduced seats               ||
|  | CloudNine     | -$25K  | Downgraded tier             ||
|  | MegaInc       | -$25K  | Removed add-on              ||
|  +------------------------------------------------------+|
|                                                           |
|  CHURN (-$175K)                               [View All]  |
|  +------------------------------------------------------+|
|  | OldCo Inc     | -$95K  | Company acquired            ||
|  | LegacyCorp    | -$80K  | Competitor switch           ||
|  +------------------------------------------------------+|
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track revenue changes |
| Researcher | Analyze revenue patterns |
| Orchestrator | Generate revenue reports |

### 8.2 Natural Language Queries

```
"What's our total ARR?"
"Show me revenue movements this quarter"
"What's our net revenue retention?"
"Which segments have the highest expansion?"
"Show me churned revenue reasons"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] ARR totals calculate correctly from customer data
- [ ] Revenue movements track all changes accurately
- [ ] Retention metrics calculate per standard formulas
- [ ] Trends display accurate historical data
- [ ] Segmentation breakdowns are correct

### 9.2 Data Accuracy

- [ ] ARR matches source financial records
- [ ] Movement records capture all changes
- [ ] Retention calculations are auditable

---

## 10. Test Cases

### TC-158.1: NRR Calculation
```
Given: Starting ARR $10M, Expansion $1.2M, Contraction $300K, Churn $500K
When: NRR is calculated
Then: NRR = (10M + 1.2M - 0.3M - 0.5M) / 10M = 104%
```

### TC-158.2: Movement Tracking
```
Given: Customer upgrades from $50K to $75K ARR
When: Movement is recorded
Then: Expansion movement of $25K created
And: Portfolio ARR increases by $25K
```

### TC-158.3: Concentration Risk
```
Given: Top customer represents 12% of total ARR
When: Concentration analysis runs
Then: Warning flagged for high concentration
And: Risk score impacts portfolio health
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Net Revenue Retention | > 105% | NRR calculation |
| Gross Revenue Retention | > 90% | GRR calculation |
| Revenue growth | > 20% YoY | ARR comparison |
| Concentration risk | < 10% | Top customer % |

---

## 12. Dependencies

- Customer ARR data in database
- Financial system integration (if applicable)
- PRD-174: Net Revenue Retention Report (detailed NRR)
- PRD-152: Churn Analysis Report (churn attribution)

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Data model, UI mockups |
| Backend | 2 weeks | Calculations, tracking |
| Frontend | 2 weeks | Dashboard views |
| Testing | 1 week | Accuracy validation, UAT |
| **Total** | **6 weeks** | |

---

## 14. Open Questions

1. Should we support multi-currency and normalization?
2. How do we handle mid-period pricing changes?
3. Should revenue be recognized on billing or contract basis?
4. How do we attribute revenue for shared accounts?

---

## Appendix A: Revenue Metric Definitions

| Metric | Formula | Description |
|--------|---------|-------------|
| ARR | Sum of annual contract values | Annual Recurring Revenue |
| MRR | ARR / 12 | Monthly Recurring Revenue |
| GRR | (Starting - Contraction - Churn) / Starting | Gross Revenue Retention |
| NRR | (Starting + Expansion - Contraction - Churn) / Starting | Net Revenue Retention |
| ARPA | Total ARR / Customer Count | Average Revenue Per Account |
