# PRD-153: Health Score Portfolio View

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-153 |
| Title | Health Score Portfolio View |
| Category | F - Reporting & Analytics |
| Priority | P0 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive portfolio health dashboard that provides CSMs and managers with a real-time, interactive view of customer health scores across their entire portfolio. The view should enable quick identification of at-risk accounts, trend analysis, and drill-down into health score components.

---

## 2. Problem Statement

### Current Pain Points
- Health scores exist but lack a unified portfolio view
- No easy way to see health trends across all accounts
- Difficult to identify which accounts need immediate attention
- Health score components are not transparent to CSMs
- Managers cannot easily compare portfolio health across team members

### Impact
- Reactive rather than proactive customer engagement
- Inefficient allocation of CSM time
- Missed early warning signals
- Lack of portfolio-level insights

---

## 3. Solution Overview

### High-Level Approach
Build an interactive, real-time dashboard that visualizes health scores across the entire portfolio with drill-down capabilities, trend analysis, and actionable insights.

### Key Features
1. **Portfolio Overview** - At-a-glance health distribution
2. **Health Score Matrix** - All customers with scores and trends
3. **Component Breakdown** - Usage, engagement, sentiment scores
4. **Trend Analysis** - Historical health trajectory
5. **Cohort Comparison** - Compare segments, CSMs, industries
6. **Alert Integration** - Surface accounts crossing thresholds
7. **Action Queue** - Prioritized list of accounts needing attention

---

## 4. User Stories

### Primary User Stories

```
As a CSM,
I want to see all my customers' health scores in one view
So that I can prioritize my daily activities
```

```
As a CSM Manager,
I want to see portfolio health across my team
So that I can identify coaching opportunities and resource needs
```

```
As a CSM,
I want to understand what factors are driving each health score
So that I can take targeted action to improve it
```

### Secondary User Stories

```
As a VP of CS,
I want to see company-wide health trends
So that I can report to leadership and forecast retention
```

```
As a CSM,
I want to be alerted when a customer's health score drops significantly
So that I can intervene quickly
```

---

## 5. Functional Requirements

### 5.1 Portfolio Overview

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-153.1 | Display health score distribution (healthy/warning/critical) | P0 |
| FR-153.2 | Show total ARR in each health bucket | P0 |
| FR-153.3 | Calculate and display average portfolio health | P0 |
| FR-153.4 | Show week-over-week portfolio health change | P0 |
| FR-153.5 | Display total customer count by health category | P0 |

### 5.2 Customer Health Matrix

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-153.6 | List all customers with current health score | P0 |
| FR-153.7 | Show health score trend indicator (up/down/stable) | P0 |
| FR-153.8 | Display score change from previous period | P0 |
| FR-153.9 | Include ARR, renewal date, and segment | P0 |
| FR-153.10 | Enable sorting by any column | P1 |
| FR-153.11 | Enable filtering by health range, segment, renewal date | P1 |
| FR-153.12 | Search customers by name | P1 |

### 5.3 Health Score Components

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-153.13 | Break down score into usage, engagement, sentiment | P0 |
| FR-153.14 | Show component weights and contributions | P1 |
| FR-153.15 | Identify lowest scoring component for each customer | P0 |
| FR-153.16 | Display component trends over time | P1 |

### 5.4 Trend Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-153.17 | Show health score history for each customer | P0 |
| FR-153.18 | Display portfolio-level health trends | P0 |
| FR-153.19 | Compare current period to previous periods | P1 |
| FR-153.20 | Identify customers with steepest declines | P0 |

### 5.5 Cohort Comparison

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-153.21 | Compare health by customer segment | P1 |
| FR-153.22 | Compare health by CSM (for managers) | P1 |
| FR-153.23 | Compare health by industry | P2 |
| FR-153.24 | Compare health by tenure | P2 |

---

## 6. Technical Requirements

### 6.1 Data Sources

| Source | Data Points | Integration |
|--------|-------------|-------------|
| `customers` table | Current health score, ARR, segment | Direct query |
| `health_score_history` | Historical scores, components | Time-series query |
| `usage_metrics` | Usage component data | Aggregation |
| `meeting_analyses` | Sentiment component data | Aggregation |
| `risk_signals` | Active risks affecting score | Join query |

### 6.2 Health Score Calculation

```typescript
interface HealthScoreComponents {
  usage_score: number;      // 0-100, weight: 40%
  engagement_score: number; // 0-100, weight: 35%
  sentiment_score: number;  // 0-100, weight: 25%
}

interface HealthScoreCalculation {
  customer_id: string;

  // Raw scores
  components: HealthScoreComponents;

  // Weighted calculation
  weighted_score: number;

  // Final adjustments
  risk_penalty: number;
  renewal_factor: number;

  // Final score
  final_score: number;

  // Classification
  category: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
}

// Thresholds
const HEALTH_THRESHOLDS = {
  healthy: { min: 70, max: 100 },
  warning: { min: 40, max: 69 },
  critical: { min: 0, max: 39 }
};
```

### 6.3 API Endpoints

```typescript
// Get portfolio health overview
GET /api/reports/health-portfolio
Query: {
  csm_id?: string;
  team_id?: string;
  segment?: string;
  date?: string;
}

Response: {
  overview: {
    total_customers: number;
    healthy: { count: number; arr: number; pct: number };
    warning: { count: number; arr: number; pct: number };
    critical: { count: number; arr: number; pct: number };
    avg_score: number;
    score_change_wow: number;
  };
  customers: CustomerHealthSummary[];
  trends: PortfolioTrend[];
}

// Get customer health detail
GET /api/reports/health-portfolio/:customerId
Response: {
  customer: CustomerHealthDetail;
  components: HealthScoreComponents;
  history: HealthScoreHistory[];
  risks: ActiveRisk[];
  recommendations: string[];
}

// Get cohort comparison
GET /api/reports/health-portfolio/compare
Query: {
  dimension: 'segment' | 'csm' | 'industry' | 'tenure';
  period: string;
}
```

### 6.4 Data Schema

```typescript
interface CustomerHealthSummary {
  customer_id: string;
  customer_name: string;
  health_score: number;
  category: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
  score_change: number;
  change_period: string;
  arr: number;
  segment: string;
  renewal_date: string;
  days_to_renewal: number;
  lowest_component: string;
  active_risks: number;
  last_contact: string;
}

interface PortfolioHealthView {
  user_id: string;
  view_date: string;

  overview: {
    total_customers: number;
    total_arr: number;
    avg_health_score: number;

    distribution: {
      healthy: { count: number; arr: number };
      warning: { count: number; arr: number };
      critical: { count: number; arr: number };
    };

    changes: {
      improved: number;
      declined: number;
      stable: number;
    };
  };

  customers: CustomerHealthSummary[];

  alerts: {
    new_critical: CustomerHealthSummary[];
    steep_declines: CustomerHealthSummary[];
    renewals_at_risk: CustomerHealthSummary[];
  };

  trends: {
    date: string;
    avg_score: number;
    healthy_pct: number;
    warning_pct: number;
    critical_pct: number;
  }[];
}
```

---

## 7. User Interface

### 7.1 Portfolio Dashboard

```
+----------------------------------------------------------+
|  Health Score Portfolio                    [Filters v]    |
|  Last updated: 5 minutes ago                [Refresh]     |
+----------------------------------------------------------+
|                                                           |
|  PORTFOLIO OVERVIEW                                       |
|  +----------------+----------------+----------------+     |
|  |   HEALTHY     |   WARNING      |   CRITICAL     |     |
|  |     42        |      8         |       2        |     |
|  |   $3.2M ARR   |   $640K ARR    |   $180K ARR    |     |
|  |     81%       |      15%       |       4%       |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  Average Health: 72 (+3 vs last week)                     |
|                                                           |
|  HEALTH TREND (30 days)                                   |
|  +--------------------------------------------------+    |
|  | 80|                            ___________        |    |
|  | 70|_______________________----            \       |    |
|  | 60|                                        ----   |    |
|  |   +-------------------------------------------->  |    |
|  +--------------------------------------------------+    |
|                                                           |
|  ATTENTION NEEDED                              [View All] |
|  +--------------------------------------------------+    |
|  | ! Acme Corp dropped 15 points (72 → 57)          |    |
|  | ! TechStart renewal in 30 days, score: 48        |    |
|  | ! 2 customers moved to Critical this week        |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Customer Health Matrix

```
+----------------------------------------------------------+
|  Customer Health Matrix                    [Export CSV]   |
+----------------------------------------------------------+
|  [Search...] [Segment: All v] [Health: All v] [Sort: Score v]|
+----------------------------------------------------------+
|                                                           |
|  +------------------------------------------------------+|
|  | Customer     | Score | Trend | ARR    | Renewal | Risk||
|  |--------------|-------|-------|--------|---------|-----||
|  | Acme Corp    |  57   |  ↓-15 | $120K  | 45 days | 2   ||
|  | GlobalTech   |  85   |  ↑+5  | $280K  | 180 days| 0   ||
|  | DataFlow Inc |  42   |  ↓-8  | $95K   | 30 days | 3   ||
|  | TechStart    |  48   |  →0   | $65K   | 28 days | 1   ||
|  | CloudNine    |  92   |  ↑+2  | $150K  | 90 days | 0   ||
|  | MegaCorp     |  78   |  ↓-3  | $340K  | 120 days| 1   ||
|  +------------------------------------------------------+|
|                                                           |
|  Showing 6 of 52 customers                   [< 1 2 3 >] |
|                                                           |
+----------------------------------------------------------+
```

### 7.3 Health Score Detail Modal

```
+----------------------------------------------------------+
|  Health Score Detail: Acme Corp              [X]          |
+----------------------------------------------------------+
|                                                           |
|  CURRENT SCORE: 57 (Warning)          TREND: Declining    |
|                                                           |
|  SCORE COMPONENTS                                         |
|  +--------------------------------------------------+    |
|  | Usage Score     | ████████████░░░░░░░░ | 62/100   |    |
|  | Engagement      | ████████░░░░░░░░░░░░ | 45/100   |    |
|  | Sentiment       | █████████████░░░░░░░ | 68/100   |    |
|  +--------------------------------------------------+    |
|  Lowest: Engagement (-20 from last month)                 |
|                                                           |
|  SCORE HISTORY (90 days)                                  |
|  +--------------------------------------------------+    |
|  | 80|    _____                                      |    |
|  | 70|___/     \____                                 |    |
|  | 60|              \___                             |    |
|  | 50|                  \___  current: 57            |    |
|  +--------------------------------------------------+    |
|                                                           |
|  ACTIVE RISKS (2)                                         |
|  +--------------------------------------------------+    |
|  | HIGH | Champion departure announced               |    |
|  | MED  | Usage declined 25% this month             |    |
|  +--------------------------------------------------+    |
|                                                           |
|  RECOMMENDED ACTIONS                                      |
|  +--------------------------------------------------+    |
|  | 1. Schedule meeting with new primary contact      |    |
|  | 2. Review usage data and identify blockers        |    |
|  | 3. Initiate save play workflow                    |    |
|  +--------------------------------------------------+    |
|                                                           |
|  [View Full Customer Detail] [Start Save Play]            |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track health scores and changes |
| Researcher | Analyze score components and trends |
| Orchestrator | Generate portfolio reports |

### 8.2 Natural Language Queries

```
"Show me my portfolio health"
"Which customers have declining health scores?"
"What's driving Acme's low health score?"
"Compare health scores across my enterprise accounts"
"Show me customers with health below 50"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] Portfolio overview shows accurate health distribution
- [ ] All customers display with current health scores
- [ ] Health trends are calculated and displayed correctly
- [ ] Component breakdown accurately reflects score composition
- [ ] Filters and sorting work as expected

### 9.2 Data Accuracy

- [ ] Health scores match `customers.health_score` values
- [ ] Historical data matches `health_score_history` records
- [ ] ARR values are current and accurate
- [ ] Renewal dates are correct

### 9.3 Performance

- [ ] Dashboard loads in < 2 seconds for 100 customers
- [ ] Filtering/sorting is instant (< 100ms)
- [ ] Real-time updates reflect within 5 minutes

---

## 10. Test Cases

### TC-153.1: Portfolio Distribution
```
Given: 52 customers with various health scores
When: Portfolio view loads
Then: Correct counts in healthy/warning/critical buckets
And: ARR totals are accurate per bucket
```

### TC-153.2: Health Score Change
```
Given: Customer score changed from 72 to 57 this week
When: Customer appears in matrix
Then: Shows trend indicator "↓-15"
And: Appears in "Attention Needed" section
```

### TC-153.3: Component Drill-down
```
Given: Customer with usage: 62, engagement: 45, sentiment: 68
When: Health detail modal opens
Then: All components display correctly
And: Engagement is identified as lowest component
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard daily usage | 90% of CSMs | Active users per day |
| Time to identify at-risk | < 30 seconds | User testing |
| Health score accuracy | > 95% | Audit vs actual outcomes |
| Portfolio health improvement | +5 avg score | Quarterly comparison |

---

## 12. Dependencies

- Health score calculation service
- `health_score_history` table populated
- Risk signals detection (PRD-164)
- Customer data completeness

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | UI mockups, data model |
| Backend | 2 weeks | APIs, aggregations |
| Frontend | 2 weeks | Dashboard, matrix, detail views |
| Testing | 1 week | Integration tests, UAT |
| **Total** | **6 weeks** | |

---

## 14. Open Questions

1. Should health scores include manual CSM overrides?
2. How frequently should scores refresh (real-time vs. daily)?
3. Should we show industry benchmarks for comparison?
4. What notification thresholds for score changes?

---

## Appendix A: Health Score Calculation Reference

| Component | Weight | Factors |
|-----------|--------|---------|
| Usage | 40% | DAU/MAU ratio, feature adoption, API calls |
| Engagement | 35% | Meeting frequency, email responses, support tickets |
| Sentiment | 25% | NPS, survey responses, meeting sentiment |

| Category | Score Range | Action |
|----------|-------------|--------|
| Healthy | 70-100 | Monitor |
| Warning | 40-69 | Proactive outreach |
| Critical | 0-39 | Immediate intervention |
