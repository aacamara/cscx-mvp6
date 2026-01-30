# PRD-154: Onboarding Funnel Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-154 |
| Title | Onboarding Funnel Report |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive onboarding funnel report that tracks customer progress through each stage of the onboarding journey, identifies bottlenecks, measures time-to-value, and provides insights to optimize the onboarding process for faster customer activation.

---

## 2. Problem Statement

### Current Pain Points
- No visibility into where customers get stuck during onboarding
- Unable to measure time-to-value consistently
- Difficult to identify which onboarding steps are most problematic
- No benchmark data for onboarding duration
- Cannot compare onboarding effectiveness across segments or CSMs

### Impact
- Extended onboarding leads to lower customer satisfaction
- Customers who struggle to onboard are more likely to churn
- Inefficient resource allocation during onboarding
- Missed opportunities to improve the onboarding process

---

## 3. Solution Overview

### High-Level Approach
Build a funnel visualization and analytics system that tracks every customer through defined onboarding stages, measures conversion rates between stages, and identifies optimization opportunities.

### Key Features
1. **Funnel Visualization** - Visual representation of onboarding stages
2. **Stage Metrics** - Time in stage, conversion rates, drop-off points
3. **Cohort Analysis** - Compare onboarding across customer cohorts
4. **Bottleneck Detection** - Identify problematic stages
5. **Time-to-Value Tracking** - Measure activation milestones
6. **CSM Performance** - Compare onboarding effectiveness
7. **Predictive Insights** - Identify at-risk onboardings

---

## 4. User Stories

### Primary User Stories

```
As a CSM Manager,
I want to see onboarding funnel metrics for all active onboardings
So that I can identify where customers are getting stuck
```

```
As a CSM,
I want to track my customers' progress through onboarding stages
So that I can proactively address delays
```

```
As a VP of CS,
I want to measure overall time-to-value and conversion rates
So that I can report on onboarding effectiveness
```

### Secondary User Stories

```
As a CS Ops Lead,
I want to identify which onboarding stages have the highest drop-off
So that I can redesign the process
```

```
As a CSM,
I want to be alerted when a customer is stuck in a stage too long
So that I can intervene quickly
```

---

## 5. Functional Requirements

### 5.1 Funnel Definition

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-154.1 | Define standard onboarding stages | P0 |
| FR-154.2 | Support custom stage definitions per segment | P1 |
| FR-154.3 | Track stage entry and exit timestamps | P0 |
| FR-154.4 | Record stage completion criteria | P0 |
| FR-154.5 | Support parallel/branching stages | P2 |

### 5.2 Funnel Metrics

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-154.6 | Calculate conversion rate per stage | P0 |
| FR-154.7 | Measure average time in each stage | P0 |
| FR-154.8 | Track customers stuck in each stage | P0 |
| FR-154.9 | Identify drop-off points and reasons | P0 |
| FR-154.10 | Calculate overall funnel completion rate | P0 |

### 5.3 Time-to-Value

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-154.11 | Define activation milestones | P0 |
| FR-154.12 | Track time from contract to first value | P0 |
| FR-154.13 | Measure time to each milestone | P1 |
| FR-154.14 | Compare TTV across segments | P1 |
| FR-154.15 | Benchmark against historical averages | P1 |

### 5.4 Analysis & Comparison

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-154.16 | Compare cohorts by start date | P1 |
| FR-154.17 | Compare by customer segment | P1 |
| FR-154.18 | Compare by CSM | P1 |
| FR-154.19 | Compare by product/package | P2 |
| FR-154.20 | Identify best practices from fast onboardings | P2 |

---

## 6. Technical Requirements

### 6.1 Onboarding Stage Model

```typescript
enum OnboardingStage {
  CONTRACT_SIGNED = 'contract_signed',
  KICKOFF_SCHEDULED = 'kickoff_scheduled',
  KICKOFF_COMPLETED = 'kickoff_completed',
  TECHNICAL_SETUP = 'technical_setup',
  DATA_MIGRATION = 'data_migration',
  TRAINING_SCHEDULED = 'training_scheduled',
  TRAINING_COMPLETED = 'training_completed',
  FIRST_USE = 'first_use',
  VALUE_REALIZED = 'value_realized',
  ONBOARDING_COMPLETE = 'onboarding_complete'
}

interface OnboardingProgress {
  customer_id: string;
  current_stage: OnboardingStage;
  started_at: string;
  target_completion: string;

  stages: {
    stage: OnboardingStage;
    entered_at: string;
    completed_at?: string;
    duration_days?: number;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    blockers?: string[];
  }[];

  milestones: {
    name: string;
    target_date: string;
    actual_date?: string;
    on_track: boolean;
  }[];
}
```

### 6.2 API Endpoints

```typescript
// Get onboarding funnel report
GET /api/reports/onboarding-funnel
Query: {
  period?: { start: string; end: string };
  segment?: string;
  csm_id?: string;
  stage_filter?: OnboardingStage;
}

Response: {
  funnel: FunnelStage[];
  active_onboardings: OnboardingProgress[];
  metrics: FunnelMetrics;
  cohort_comparison?: CohortComparison[];
}

// Get individual onboarding progress
GET /api/reports/onboarding-funnel/:customerId
Response: OnboardingProgress

// Get stuck customers
GET /api/reports/onboarding-funnel/stuck
Query: { days_threshold?: number }
Response: {
  customers: StuckCustomer[];
  by_stage: { stage: string; count: number }[];
}
```

### 6.3 Data Schema

```typescript
interface FunnelStage {
  stage: OnboardingStage;
  order: number;

  metrics: {
    total_entered: number;
    currently_in: number;
    completed: number;
    dropped: number;

    conversion_rate: number;
    avg_duration_days: number;
    median_duration_days: number;

    stuck_count: number;
    stuck_threshold_days: number;
  };
}

interface FunnelMetrics {
  total_onboardings: number;
  completed: number;
  in_progress: number;
  dropped: number;

  completion_rate: number;
  avg_total_duration_days: number;
  avg_time_to_value_days: number;

  top_bottleneck: OnboardingStage;
  top_drop_off: OnboardingStage;
}

interface StuckCustomer {
  customer_id: string;
  customer_name: string;
  current_stage: OnboardingStage;
  days_in_stage: number;
  expected_days: number;
  overdue_by: number;
  blockers: string[];
  csm_id: string;
  csm_name: string;
  last_activity: string;
}
```

---

## 7. User Interface

### 7.1 Funnel Visualization

```
+----------------------------------------------------------+
|  Onboarding Funnel Report            [Period: Q1 2026 v] |
+----------------------------------------------------------+
|                                                           |
|  FUNNEL OVERVIEW                                          |
|                                                           |
|  Contract Signed         ████████████████████████  48     |
|  100% conversion         ↓                                |
|                                                           |
|  Kickoff Scheduled       ██████████████████████    46     |
|  96% conversion          ↓ (2 dropped)                    |
|                                                           |
|  Kickoff Completed       █████████████████████     44     |
|  96% conversion          ↓ (2 dropped)                    |
|                                                           |
|  Technical Setup         ████████████████████      42     |
|  95% conversion          ↓ (2 dropped)     Avg: 5.2 days  |
|                                                           |
|  Training Completed      ███████████████████       40     |
|  95% conversion          ↓ (2 dropped)     Avg: 8.1 days  |
|                                                           |
|  First Value             █████████████████         38     |
|  95% conversion          ↓ (2 dropped)     Avg: 12.3 days |
|                                                           |
|  Fully Onboarded         ███████████████           35     |
|  92% conversion          COMPLETED                        |
|                                                           |
|  Overall: 73% completion rate | Avg TTV: 28 days          |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Active Onboardings View

```
+----------------------------------------------------------+
|  Active Onboardings (13)                    [Export]      |
+----------------------------------------------------------+
|  [Stage: All v] [CSM: All v] [Status: All v] [Search...] |
+----------------------------------------------------------+
|                                                           |
|  +------------------------------------------------------+|
|  | Customer    | Stage           | Days | Status | CSM   ||
|  |-------------|-----------------|------|--------|-------||
|  | Acme Corp   | Technical Setup | 12   | ⚠ Stuck | Sarah ||
|  | TechStart   | Training        | 5    | ✓ On track| Mike||
|  | DataFlow    | First Value     | 3    | ✓ On track| Sarah||
|  | CloudNine   | Kickoff         | 1    | ✓ On track| John ||
|  | MegaInc     | Data Migration  | 18   | ⚠ Stuck | Mike ||
|  +------------------------------------------------------+|
|                                                           |
|  STUCK CUSTOMERS (2)                          [View All]  |
|  +------------------------------------------------------+|
|  | ! Acme Corp - Technical Setup for 12 days (expected: 5)|
|  |   Blocker: Waiting on IT team access                  |
|  | ! MegaInc - Data Migration for 18 days (expected: 7)  |
|  |   Blocker: Legacy data format issues                  |
|  +------------------------------------------------------+|
|                                                           |
+----------------------------------------------------------+
```

### 7.3 Time-to-Value Analysis

```
+----------------------------------------------------------+
|  Time-to-Value Analysis                                   |
+----------------------------------------------------------+
|                                                           |
|  OVERALL TTV METRICS                                      |
|  +----------------+----------------+----------------+     |
|  | Avg TTV        | Median TTV     | Best TTV       |     |
|  |   28 days      |   24 days      |   14 days      |     |
|  | vs target: +3  |                | (TechCorp)     |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  TTV BY SEGMENT                                           |
|  +--------------------------------------------------+    |
|  | Enterprise  | ████████████████████ | 35 days      |    |
|  | Mid-Market  | ███████████████ | 26 days           |    |
|  | SMB         | ██████████ | 18 days                |    |
|  +--------------------------------------------------+    |
|                                                           |
|  TTV TREND (6 Months)                                     |
|  +--------------------------------------------------+    |
|  | 35|                                               |    |
|  | 30|___                                            |    |
|  | 25|   \___    ___                                 |    |
|  | 20|       \__/   \___  current: 28                |    |
|  |   +------------------------------------------>   |    |
|  |    Aug Sep Oct Nov Dec Jan                       |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Orchestrator | Track onboarding progress |
| Monitor | Detect stuck customers |
| Communicator | Send reminder/intervention emails |

### 8.2 Natural Language Queries

```
"Show me the onboarding funnel"
"Which customers are stuck in onboarding?"
"What's our average time-to-value?"
"Compare onboarding performance by CSM"
"How is Acme Corp's onboarding progressing?"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] Funnel visualization accurately represents all stages
- [ ] Conversion rates calculate correctly between stages
- [ ] Time metrics are accurate for each stage
- [ ] Stuck customers are identified based on thresholds
- [ ] TTV calculates from contract to first value milestone

### 9.2 Data Accuracy

- [ ] Stage transitions are recorded in real-time
- [ ] Duration calculations account for business days option
- [ ] Historical data is preserved for trend analysis
- [ ] Cohort comparisons use consistent date ranges

---

## 10. Test Cases

### TC-154.1: Funnel Conversion
```
Given: 50 customers started onboarding, 45 completed kickoff
When: Funnel report is generated
Then: Shows 90% conversion from start to kickoff
And: 5 customers show as dropped at kickoff stage
```

### TC-154.2: Stuck Detection
```
Given: Customer in "Technical Setup" for 12 days (threshold: 7)
When: Stuck customers report runs
Then: Customer appears in stuck list
And: Shows 5 days overdue
```

### TC-154.3: TTV Calculation
```
Given: Customer signed Jan 1, reached first value Jan 22
When: TTV is calculated
Then: Shows 21 days time-to-value
And: Compares to 28-day average
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Avg time-to-value | < 25 days | Median TTV across customers |
| Funnel completion rate | > 85% | Customers completing onboarding |
| Stuck customer resolution | < 3 days | Time from flagged to unstuck |
| Bottleneck identification | Weekly | Stages identified for improvement |

---

## 12. Dependencies

- Onboarding workflow tracking system
- Stage completion criteria definitions
- Customer milestone tracking
- Activity logging for stage transitions

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Stage definitions, UI mockups |
| Backend | 2 weeks | Tracking system, calculations |
| Frontend | 2 weeks | Funnel visualization, tables |
| Testing | 1 week | Integration tests, UAT |
| **Total** | **6 weeks** | |

---

## 14. Open Questions

1. Should we support custom stage definitions per product/segment?
2. How do we handle customers who skip stages (e.g., no data migration needed)?
3. What triggers "value realized" milestone?
4. Should we include customer satisfaction scores at onboarding completion?

---

## Appendix A: Standard Onboarding Stages

| Stage | Expected Duration | Completion Criteria |
|-------|-------------------|---------------------|
| Contract Signed | 0 days | Contract in system |
| Kickoff Scheduled | 2 days | Meeting on calendar |
| Kickoff Completed | 1 day | Meeting occurred |
| Technical Setup | 5 days | Environment configured |
| Data Migration | 7 days | Data imported |
| Training Scheduled | 2 days | Training on calendar |
| Training Completed | 3 days | Training delivered |
| First Use | 3 days | User logs in |
| Value Realized | 5 days | Key milestone achieved |
| Onboarding Complete | 0 days | Handoff to BAU |
