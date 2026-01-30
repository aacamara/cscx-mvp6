# PRD-169: Customer Cohort Analysis

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-169 |
| Title | Customer Cohort Analysis |
| Category | F - Reporting & Analytics |
| Priority | P2 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a customer cohort analysis report that groups customers by common attributes and tracks their behavior and outcomes over time. This enables identification of patterns, prediction of outcomes, and data-driven segmentation strategies.

---

## 2. Problem Statement

### Current Pain Points
- Cannot compare customer groups systematically
- Missing insights on which cohorts perform best
- Difficult to identify patterns by acquisition date
- No visibility into cohort retention curves
- Unable to predict outcomes by cohort characteristics

### Impact
- Suboptimal customer segmentation
- Missed patterns in customer behavior
- Inability to replicate success
- Reactive approach to cohort issues

---

## 3. Solution Overview

### High-Level Approach
Build a cohort analysis system that groups customers by various dimensions, tracks their metrics over time, and provides comparative insights.

### Key Features
1. **Cohort Definition** - Group by multiple dimensions
2. **Retention Curves** - Track cohort retention over time
3. **Metric Comparison** - Compare KPIs across cohorts
4. **Behavior Patterns** - Identify cohort-specific behaviors
5. **Outcome Prediction** - Forecast based on cohort data
6. **Visualization** - Cohort charts and heatmaps

---

## 4. User Stories

```
As a VP of CS,
I want to analyze retention by customer cohort
So that I can identify patterns and improve strategy
```

```
As a CS Ops Lead,
I want to compare metrics across different customer segments
So that I can optimize our engagement model
```

```
As a CSM Manager,
I want to understand which cohorts need different approaches
So that I can tailor our playbooks
```

---

## 5. Functional Requirements

### 5.1 Cohort Definition

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-169.1 | Group by start date (monthly/quarterly) | P0 |
| FR-169.2 | Group by segment/tier | P0 |
| FR-169.3 | Group by industry | P1 |
| FR-169.4 | Group by ARR range | P1 |
| FR-169.5 | Group by acquisition source | P2 |
| FR-169.6 | Custom cohort definitions | P2 |

### 5.2 Metric Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-169.7 | Track retention rate by cohort | P0 |
| FR-169.8 | Track health score trends | P0 |
| FR-169.9 | Track adoption metrics | P1 |
| FR-169.10 | Track expansion rates | P1 |
| FR-169.11 | Track NPS/satisfaction | P1 |

### 5.3 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-169.12 | Generate retention curves | P0 |
| FR-169.13 | Create cohort heatmaps | P1 |
| FR-169.14 | Compare cohorts side-by-side | P0 |
| FR-169.15 | Identify outlier cohorts | P1 |
| FR-169.16 | Predict future performance | P2 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface CohortDefinition {
  id: string;
  name: string;
  dimension: 'start_date' | 'segment' | 'industry' | 'arr_range' | 'source' | 'custom';
  criteria: CohortCriteria;
  customer_count: number;
  created_at: string;
}

interface CohortAnalysis {
  cohort: CohortDefinition;
  period_count: number;

  retention: {
    period: number;
    retained: number;
    retention_rate: number;
    arr_retained: number;
  }[];

  metrics_by_period: {
    period: number;
    avg_health_score: number;
    avg_adoption_score: number;
    nps_score: number;
    expansion_rate: number;
  }[];

  summary: {
    total_customers: number;
    total_arr: number;
    final_retention_rate: number;
    avg_lifetime_months: number;
    ltv_estimate: number;
  };
}

interface CohortComparison {
  cohorts: CohortAnalysis[];
  best_performer: string;
  worst_performer: string;
  key_differences: string[];
}
```

### 6.2 API Endpoints

```typescript
// Get cohort analysis
GET /api/reports/cohort-analysis
Query: {
  dimension: string;
  period_start?: string;
  period_end?: string;
  periods?: number;
}

Response: {
  cohorts: CohortAnalysis[];
  heatmap: RetentionHeatmap;
  insights: CohortInsight[];
}

// Compare specific cohorts
GET /api/reports/cohort-analysis/compare
Query: { cohort_ids: string[] }

// Get cohort members
GET /api/reports/cohort-analysis/:cohortId/members
```

---

## 7. User Interface

### 7.1 Cohort Dashboard

```
+----------------------------------------------------------+
|  Cohort Analysis                    [Dimension: Start Date v]|
+----------------------------------------------------------+
|                                                           |
|  RETENTION BY COHORT (Monthly)                            |
|  +------------------------------------------------------+|
|  |         | Mo 1 | Mo 2 | Mo 3 | Mo 6 | Mo 12| Final   ||
|  |---------|------|------|------|------|------|---------|
|  | Jan '25 | 100% | 96%  | 94%  | 90%  | 85%  | 82%     ||
|  | Feb '25 | 100% | 95%  | 92%  | 88%  | 82%  | -       ||
|  | Mar '25 | 100% | 97%  | 95%  | 91%  | -    | -       ||
|  | Apr '25 | 100% | 94%  | 91%  | -    | -    | -       ||
|  | May '25 | 100% | 96%  | -    | -    | -    | -       ||
|  | Jun '25 | 100% | -    | -    | -    | -    | -       ||
|  +------------------------------------------------------+|
|  (Darker = lower retention)                              |
|                                                           |
|  RETENTION CURVES                                         |
|  +--------------------------------------------------+    |
|  | 100%|____                                         |    |
|  |  90%|    \\___                                    |    |
|  |  80%|        \\\\___    Jan '25                  |    |
|  |  70%|             \\\\____                       |    |
|  |     +----------------------------------------->  |    |
|  |      1  2  3  4  5  6  7  8  9  10 11 12 Month   |    |
|  +--------------------------------------------------+    |
|                                                           |
|  COHORT INSIGHTS                                          |
|  +--------------------------------------------------+    |
|  | Best: Mar '25 - 95% retention at month 3          |    |
|  | Worst: Apr '25 - 91% retention at month 3         |    |
|  | Trend: Recent cohorts improving (+2% avg)         |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Segment Cohort View

```
+----------------------------------------------------------+
|  Cohort Analysis: By Segment                              |
+----------------------------------------------------------+
|                                                           |
|  SEGMENT COMPARISON                                       |
|  +------------------------------------------------------+|
|  | Segment    | Customers | Avg Health | NRR   | Churn  ||
|  |------------|-----------|------------|-------|--------|
|  | Enterprise | 45        | 78         | 112%  | 3%     ||
|  | Mid-Market | 68        | 72         | 106%  | 8%     ||
|  | SMB        | 120       | 65         | 98%   | 15%    ||
|  +------------------------------------------------------+|
|                                                           |
|  RETENTION BY SEGMENT (12-Month)                          |
|  +--------------------------------------------------+    |
|  | 100%|____                                         |    |
|  |  95%|    ___________  Enterprise                  |    |
|  |  90%|          ______ Mid-Market                  |    |
|  |  85%|               _____ SMB                     |    |
|  |     +----------------------------------------->  |    |
|  +--------------------------------------------------+    |
|                                                           |
|  KEY DIFFERENCES                                          |
|  +--------------------------------------------------+    |
|  | - Enterprise: Highest retention, slowest adopt.   |    |
|  | - Mid-Market: Balanced metrics, best expansion    |    |
|  | - SMB: Fastest adoption, highest churn           |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Researcher | Analyze cohort patterns |
| Monitor | Track cohort metrics |
| Orchestrator | Generate cohort reports |

### 8.2 Natural Language Queries

```
"Show me retention by start date cohort"
"Compare enterprise vs SMB cohorts"
"Which cohort has the best retention?"
"What's the retention curve for Q1 customers?"
"Analyze cohorts by industry"
```

---

## 9. Acceptance Criteria

- [ ] Cohorts can be defined by multiple dimensions
- [ ] Retention rates calculate correctly
- [ ] Heatmaps visualize retention accurately
- [ ] Curves show proper time progression
- [ ] Comparisons highlight key differences

---

## 10. Test Cases

### TC-169.1: Retention Calculation
```
Given: Cohort of 100 customers, 85 still active at month 12
When: 12-month retention is calculated
Then: Retention = 85%
```

### TC-169.2: Cohort Comparison
```
Given: Enterprise cohort 95% retention, SMB 82% retention
When: Comparison is generated
Then: Enterprise identified as best performer
And: Key differences highlighted
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Report usage | Weekly | Users accessing cohort analysis |
| Insight accuracy | > 90% | Validated predictions |
| Cohort improvement | +5% | Retention improvement from insights |

---

## 12. Dependencies

- Customer data with acquisition dates
- Historical retention data
- PRD-152: Churn Analysis Report
- PRD-175: Customer Segmentation Analysis

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Cohort model, visualizations |
| Backend | 2 weeks | Calculations, aggregations |
| Frontend | 1 week | Charts, heatmaps |
| Testing | 1 week | Data accuracy |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. What is the minimum cohort size for meaningful analysis?
2. How many periods back should we analyze?
3. Should we support multi-dimensional cohorts?
4. How do we handle customers who change segments?
