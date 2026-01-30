# PRD-165: Success Metrics Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-165 |
| Title | Success Metrics Report |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a success metrics report that tracks and visualizes customer outcomes, goal achievement, and value realization. This enables CSMs to demonstrate ROI to customers and track progress toward defined success criteria.

---

## 2. Problem Statement

### Current Pain Points
- No systematic tracking of customer success metrics
- Difficult to demonstrate ROI during QBRs
- Missing visibility into goal achievement
- Cannot prove customer value realization
- Inconsistent success criteria across accounts

### Impact
- Weak renewal conversations
- Unable to differentiate from competitors
- Missed upsell opportunities from value proof
- Customer skepticism about ROI

---

## 3. Solution Overview

### High-Level Approach
Build a success tracking system that captures customer goals, measures progress, calculates value delivered, and generates compelling success reports.

### Key Features
1. **Goal Tracking** - Customer-defined success metrics
2. **Progress Measurement** - Track goal achievement
3. **Value Calculation** - Quantify ROI delivered
4. **Milestone Tracking** - Key achievement points
5. **Benchmarking** - Compare to similar customers
6. **Reporting** - Generate success summaries
7. **Visualization** - Compelling charts and graphics

---

## 4. User Stories

### Primary User Stories

```
As a CSM,
I want to track success metrics for each customer
So that I can demonstrate value during renewals
```

```
As a CSM Manager,
I want to see success achievement across the portfolio
So that I can identify best practices and gaps
```

```
As a Customer Stakeholder,
I want to see clear ROI from my investment
So that I can justify continued spending
```

---

## 5. Functional Requirements

### 5.1 Goal Definition

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-165.1 | Define customer-specific success goals | P0 |
| FR-165.2 | Set measurable targets for each goal | P0 |
| FR-165.3 | Define goal timeframes | P0 |
| FR-165.4 | Categorize goals by type | P1 |
| FR-165.5 | Support multiple goals per customer | P0 |

### 5.2 Progress Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-165.6 | Track current vs. target metrics | P0 |
| FR-165.7 | Calculate goal achievement percentage | P0 |
| FR-165.8 | Record milestone achievements | P0 |
| FR-165.9 | Track progress over time | P0 |
| FR-165.10 | Alert on goal achievement | P1 |

### 5.3 Value Calculation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-165.11 | Calculate time saved | P1 |
| FR-165.12 | Calculate cost reduction | P1 |
| FR-165.13 | Calculate revenue impact | P1 |
| FR-165.14 | Show ROI multiplier | P0 |
| FR-165.15 | Compare baseline to current | P0 |

### 5.4 Reporting

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-165.16 | Generate customer-facing success reports | P0 |
| FR-165.17 | Create QBR-ready presentations | P1 |
| FR-165.18 | Export to PDF/PPT formats | P1 |
| FR-165.19 | Include charts and visualizations | P0 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface SuccessGoal {
  id: string;
  customer_id: string;

  name: string;
  description: string;
  category: GoalCategory;

  // Target
  metric: string;
  baseline_value: number;
  target_value: number;
  unit: string;

  // Timeline
  start_date: string;
  target_date: string;

  // Status
  current_value: number;
  achievement_pct: number;
  status: 'not_started' | 'on_track' | 'at_risk' | 'achieved' | 'missed';

  // Value
  value_type?: 'time_saved' | 'cost_reduction' | 'revenue_increase';
  value_amount?: number;
}

enum GoalCategory {
  EFFICIENCY = 'efficiency',
  REVENUE = 'revenue',
  COST = 'cost',
  QUALITY = 'quality',
  ADOPTION = 'adoption',
  SATISFACTION = 'satisfaction',
  CUSTOM = 'custom'
}

interface SuccessMetrics {
  customer_id: string;
  period: string;

  goals: {
    total: number;
    achieved: number;
    on_track: number;
    at_risk: number;
    achievement_rate: number;
  };

  value_delivered: {
    time_saved_hours: number;
    cost_reduction: number;
    revenue_impact: number;
    total_value: number;
    roi_multiplier: number;
  };

  milestones: {
    name: string;
    achieved_date: string;
    description: string;
  }[];
}
```

### 6.2 API Endpoints

```typescript
// Get success metrics for customer
GET /api/reports/success-metrics/:customerId
Query: { period?: string }

Response: {
  metrics: SuccessMetrics;
  goals: SuccessGoal[];
  milestones: Milestone[];
  trends: ProgressTrend[];
}

// Get portfolio success overview
GET /api/reports/success-metrics
Query: { csm_id?: string; segment?: string }

Response: {
  summary: PortfolioSuccess;
  customers: CustomerSuccessSummary[];
  top_performers: Customer[];
}

// Create/update success goal
POST /api/success-goals
PUT /api/success-goals/:goalId
{
  name: string;
  metric: string;
  baseline_value: number;
  target_value: number;
  target_date: string;
}

// Generate success report
POST /api/reports/success-metrics/:customerId/generate
{
  format: 'pdf' | 'ppt' | 'html';
  include_sections: string[];
}
```

---

## 7. User Interface

### 7.1 Customer Success Dashboard

```
+----------------------------------------------------------+
|  Success Metrics: Acme Corp                 [Generate Report]|
+----------------------------------------------------------+
|                                                           |
|  SUCCESS OVERVIEW                                         |
|  +----------------+----------------+----------------+     |
|  | Goals Achieved | Value Delivered| ROI            |     |
|  |    4 / 5       |    $285K       |    4.2x        |     |
|  |    80%         | Time + Cost    | vs $68K invest |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  ACTIVE GOALS                                             |
|  +------------------------------------------------------+|
|  | Goal               | Target | Current | Status       ||
|  |--------------------|--------|---------|--------------|
|  | Reduce ticket time | 50%    | 52%     | ✓ Achieved   ||
|  | Increase NPS       | 50     | 48      | On Track     ||
|  | API response time  | <100ms | 85ms    | ✓ Achieved   ||
|  | User adoption      | 80%    | 78%     | On Track     ||
|  | Revenue from upsell| $50K   | $35K    | ⚠ At Risk   ||
|  +------------------------------------------------------+|
|                                                           |
|  VALUE DELIVERED                                          |
|  +--------------------------------------------------+    |
|  | Time Saved       | ████████████████ | 2,400 hrs   |    |
|  | Cost Reduction   | ██████████████ | $185K          |    |
|  | Revenue Impact   | ████████ | $100K               |    |
|  +--------------------------------------------------+    |
|  Total Value: $285,000 | Investment: $68,000             |
|  ROI: 4.2x                                               |
|                                                           |
|  MILESTONES ACHIEVED                                      |
|  +--------------------------------------------------+    |
|  | Jan 15 | First automation deployed               |    |
|  | Feb 1  | 100th user onboarded                    |    |
|  | Mar 10 | Support ticket reduction milestone      |    |
|  | Apr 5  | Executive dashboard launched            |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Goal Progress Detail

```
+----------------------------------------------------------+
|  Goal: Reduce Support Ticket Resolution Time              |
+----------------------------------------------------------+
|                                                           |
|  GOAL DETAILS                                             |
|  +--------------------------------------------------+    |
|  | Metric: Average resolution time                   |    |
|  | Baseline: 24 hours                                |    |
|  | Target: 12 hours (50% reduction)                  |    |
|  | Current: 11.5 hours (52% reduction)               |    |
|  | Status: ACHIEVED                                   |    |
|  +--------------------------------------------------+    |
|                                                           |
|  PROGRESS OVER TIME                                       |
|  +--------------------------------------------------+    |
|  | 24hr|_____                                        |    |
|  | 18hr|     \____                                   |    |
|  | 12hr|          \_______ TARGET ---------------   |    |
|  |  6hr|                  \_____ current: 11.5      |    |
|  |     +----------------------------------------->  |    |
|  |      Q1     Q2     Q3     Q4                     |    |
|  +--------------------------------------------------+    |
|                                                           |
|  VALUE CALCULATION                                        |
|  +--------------------------------------------------+    |
|  | Time saved per ticket: 12.5 hours                 |    |
|  | Tickets per month: 150                            |    |
|  | Hours saved monthly: 1,875 hours                  |    |
|  | Value at $50/hr: $93,750/month                    |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track goal progress |
| Researcher | Calculate value metrics |
| Orchestrator | Generate success reports |

### 8.2 Natural Language Queries

```
"Show me success metrics for Acme Corp"
"What value have we delivered this quarter?"
"Which goals are at risk?"
"Generate a success report for QBR"
"Compare success rates across enterprise accounts"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] Goals can be created with baselines and targets
- [ ] Progress tracks automatically where possible
- [ ] Achievement percentages calculate correctly
- [ ] Value calculations are accurate
- [ ] Reports generate in requested formats

### 9.2 Reporting

- [ ] Customer-facing reports are professional
- [ ] Charts visualize progress clearly
- [ ] Export formats work correctly

---

## 10. Test Cases

### TC-165.1: Goal Achievement
```
Given: Goal with baseline 24, target 12, current 11.5
When: Achievement is calculated
Then: Achievement = 104% (exceeded target)
And: Status = Achieved
```

### TC-165.2: ROI Calculation
```
Given: Value delivered $285K, investment $68K
When: ROI is calculated
Then: ROI multiplier = 4.2x
And: Displayed in success summary
```

### TC-165.3: Report Generation
```
Given: Customer with 5 goals and milestones
When: PDF report is requested
Then: Report generates with all sections
And: Charts and data are accurate
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Goal achievement rate | > 75% | Goals achieved / total goals |
| Avg ROI delivered | > 3x | Portfolio average ROI |
| Report usage | 80% | Customers with active goals |
| QBR inclusion | 100% | Reports used in QBRs |

---

## 12. Dependencies

- Customer goal definitions
- Usage/metrics data for tracking
- PRD-159: Product Adoption Report
- Document generation (Google Slides/Docs)

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Goal framework, UI mockups |
| Backend | 2 weeks | Goal tracking, calculations |
| Frontend | 2 weeks | Dashboard, visualizations |
| Reporting | 1 week | Report generation |
| Testing | 1 week | Accuracy validation, UAT |
| **Total** | **7 weeks** | |

---

## 14. Open Questions

1. How do we capture baseline metrics for new customers?
2. Should goals be templated by industry/use case?
3. How often should progress update (real-time vs. daily)?
4. Should customers have self-service access to success dashboards?

---

## Appendix A: Common Success Goals by Category

| Category | Example Goals | Typical Metrics |
|----------|---------------|-----------------|
| Efficiency | Reduce process time | Hours saved, FTE equivalent |
| Revenue | Increase sales | Revenue generated, deals closed |
| Cost | Reduce expenses | Cost reduction, savings |
| Quality | Improve accuracy | Error rate, defect reduction |
| Adoption | Increase usage | Active users, feature adoption |
| Satisfaction | Improve NPS | NPS score, CSAT |
