# PRD-174: Net Revenue Retention Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-174 |
| Title | Net Revenue Retention Report |
| Category | F - Reporting & Analytics |
| Priority | P0 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive Net Revenue Retention (NRR) report that tracks dollar-based retention including expansion, provides detailed breakdown of revenue movements, and enables analysis of NRR drivers across the portfolio.

---

## 2. Problem Statement

### Current Pain Points
- No detailed NRR tracking and analysis
- Cannot break down NRR components
- Missing visibility into NRR by segment/CSM
- Difficult to identify NRR improvement opportunities
- No forecasting for future NRR

### Impact
- Inability to report accurately on key SaaS metric
- Missing insights on revenue efficiency
- Cannot track CS team performance on NRR
- Poor strategic planning around retention

---

## 3. Solution Overview

Build a dedicated NRR analytics system that calculates, tracks, and analyzes NRR across multiple dimensions with detailed component breakdown.

### Key Features
1. **NRR Calculation** - Accurate NRR measurement
2. **Component Breakdown** - Expansion/contraction/churn detail
3. **Segment Analysis** - NRR by segment/tier
4. **CSM Attribution** - NRR by team member
5. **Cohort Analysis** - NRR by customer cohort
6. **Trend Tracking** - Historical NRR progression
7. **Forecasting** - Predict future NRR

---

## 4. User Stories

```
As a VP of CS,
I want detailed NRR reporting
So that I can track and report on our key retention metric
```

```
As a CFO,
I want to understand NRR components
So that I can forecast revenue accurately
```

```
As a CSM Manager,
I want to see NRR by team member
So that I can track performance and identify best practices
```

---

## 5. Functional Requirements

### 5.1 NRR Calculation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-174.1 | Calculate monthly/quarterly/annual NRR | P0 |
| FR-174.2 | Calculate gross revenue retention | P0 |
| FR-174.3 | Track expansion revenue | P0 |
| FR-174.4 | Track contraction revenue | P0 |
| FR-174.5 | Track churned revenue | P0 |

### 5.2 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-174.6 | NRR by segment | P0 |
| FR-174.7 | NRR by CSM | P0 |
| FR-174.8 | NRR by cohort | P1 |
| FR-174.9 | NRR drivers analysis | P1 |
| FR-174.10 | NRR forecast | P1 |

---

## 6. Technical Requirements

### 6.1 NRR Calculation

```typescript
interface NRRComponents {
  starting_arr: number;
  expansion: number;
  contraction: number;
  churn: number;
  ending_arr: number;
}

interface NRRMetrics {
  period: string;
  components: NRRComponents;

  rates: {
    nrr: number; // Net Revenue Retention
    grr: number; // Gross Revenue Retention
    expansion_rate: number;
    contraction_rate: number;
    churn_rate: number;
  };

  comparisons: {
    vs_previous_period: number;
    vs_same_period_last_year: number;
    vs_target: number;
  };
}

// NRR Formula
function calculateNRR(components: NRRComponents): number {
  const { starting_arr, expansion, contraction, churn } = components;
  return ((starting_arr + expansion - contraction - churn) / starting_arr) * 100;
}

// GRR Formula (excludes expansion)
function calculateGRR(components: NRRComponents): number {
  const { starting_arr, contraction, churn } = components;
  return ((starting_arr - contraction - churn) / starting_arr) * 100;
}
```

### 6.2 API Endpoints

```typescript
// Get NRR report
GET /api/reports/nrr
Query: {
  period_type: 'monthly' | 'quarterly' | 'annual';
  period?: string;
  segment?: string;
  csm_id?: string;
}

Response: {
  current: NRRMetrics;
  trends: NRRTrend[];
  by_segment: SegmentNRR[];
  by_csm: CSMNRR[];
  forecast: NRRForecast;
}

// Get NRR detail breakdown
GET /api/reports/nrr/breakdown
Query: { period: string }
Response: {
  expansion_details: RevenueMovement[];
  contraction_details: RevenueMovement[];
  churn_details: RevenueMovement[];
}
```

---

## 7. User Interface

```
+----------------------------------------------------------+
|  Net Revenue Retention Report            [Q1 2026 v]      |
+----------------------------------------------------------+
|                                                           |
|  NRR SUMMARY                                              |
|  +----------------+----------------+----------------+     |
|  | Net Retention  | Gross Retention| vs Target      |     |
|  |    112%        |     95%        |    +7%         |     |
|  | +4% vs Q4      | +2% vs Q4      | Target: 105%   |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  REVENUE WATERFALL                                        |
|  +--------------------------------------------------+    |
|  | Starting ARR      | $10.0M                        |    |
|  | + Expansion       | +$1.4M  (+14%)                |    |
|  | - Contraction     | -$0.2M  (-2%)                 |    |
|  | - Churn           | -$0.4M  (-4%)                 |    |
|  | = Ending ARR      | $10.8M                        |    |
|  |                                                   |    |
|  | NRR = 108%                                        |    |
|  +--------------------------------------------------+    |
|                                                           |
|  NRR TREND (12 Months)                                    |
|  +--------------------------------------------------+    |
|  | 115%|                              _____          |    |
|  | 110%|                    _________/              |    |
|  | 105%|___________________/                        |    |
|  | 100%|                                            |    |
|  |     +-----------------------------------------> |    |
|  |      J F M A M J J A S O N D                    |    |
|  +--------------------------------------------------+    |
|                                                           |
|  NRR BY SEGMENT                                           |
|  +------------------------------------------------------+|
|  | Segment     | Starting | Ending | NRR   | GRR        ||
|  |-------------|----------|--------|-------|------------|
|  | Enterprise  | $5.0M    | $5.8M  | 116%  | 97%        ||
|  | Mid-Market  | $3.2M    | $3.4M  | 106%  | 94%        ||
|  | SMB         | $1.8M    | $1.6M  | 89%   | 88%        ||
|  +------------------------------------------------------+|
|                                                           |
|  NRR DRIVERS                                              |
|  +--------------------------------------------------+    |
|  | Top Expansion: Seat growth (+$520K)               |    |
|  | Top Contraction: Tier downgrades (-$120K)         |    |
|  | Top Churn Reason: Budget cuts ($180K)             |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Natural Language Queries

```
"What's our NRR this quarter?"
"Break down NRR by segment"
"What's driving our expansion revenue?"
"Compare NRR across CSMs"
"Forecast NRR for next quarter"
```

---

## 9. Acceptance Criteria

- [ ] NRR calculates correctly from revenue components
- [ ] GRR calculates correctly (excludes expansion)
- [ ] All movements are categorized accurately
- [ ] Segment and CSM breakdowns are correct
- [ ] Trends display historical accuracy

---

## 10. Test Cases

### TC-174.1: NRR Calculation
```
Given: Starting $10M, Expansion $1.5M, Contraction $0.3M, Churn $0.5M
When: NRR is calculated
Then: NRR = (10 + 1.5 - 0.3 - 0.5) / 10 = 107%
And: GRR = (10 - 0.3 - 0.5) / 10 = 92%
```

### TC-174.2: Segment Breakdown
```
Given: Enterprise NRR 115%, SMB NRR 92%
When: Segment report is generated
Then: Shows accurate NRR per segment
And: Weighted average matches overall NRR
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| NRR | > 110% | Quarterly NRR |
| GRR | > 90% | Quarterly GRR |
| Expansion rate | > 15% | Expansion / Starting ARR |
| Churn rate | < 5% | Churn / Starting ARR |

---

## 12. Dependencies

- Revenue tracking system
- PRD-158: Revenue Analytics Report
- PRD-155: Expansion Pipeline Report
- PRD-152: Churn Analysis Report

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Calculation model |
| Backend | 2 weeks | NRR engine, aggregations |
| Frontend | 1 week | Dashboard, breakdowns |
| Testing | 1 week | Accuracy validation |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. How do we handle mid-period pricing changes?
2. Should we track NRR by billing vs. contract date?
3. How do we attribute expansion to sales vs. CS?
4. What's the right comparison period (rolling vs. calendar)?
