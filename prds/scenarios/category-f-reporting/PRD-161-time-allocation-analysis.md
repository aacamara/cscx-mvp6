# PRD-161: Time Allocation Analysis

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-161 |
| Title | Time Allocation Analysis |
| Category | F - Reporting & Analytics |
| Priority | P2 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a time allocation analysis report that tracks how CSMs spend their time across activities, accounts, and tasks. This enables optimization of CSM capacity, identification of inefficiencies, and data-driven resource planning.

---

## 2. Problem Statement

### Current Pain Points
- No visibility into how CSMs allocate their time
- Cannot identify time spent vs. customer value
- Difficult to balance workload across team
- Unable to quantify administrative overhead
- Missing data for capacity planning

### Impact
- Inefficient time allocation reduces productivity
- High-value accounts may be underserved
- Low-value accounts may consume disproportionate time
- Cannot optimize team capacity

---

## 3. Solution Overview

### High-Level Approach
Build a time tracking and analysis system that captures CSM activities, categorizes time spent, and provides insights for optimization.

### Key Features
1. **Activity Tracking** - Automatic and manual time capture
2. **Time Breakdown** - By activity type, customer, task
3. **Value Analysis** - Time vs. ARR correlation
4. **Efficiency Metrics** - Time per outcome
5. **Capacity Planning** - Workload distribution
6. **Benchmarking** - Compare across team
7. **Recommendations** - Optimization suggestions

---

## 4. User Stories

### Primary User Stories

```
As a CSM Manager,
I want to see how my team allocates time across activities
So that I can identify optimization opportunities
```

```
As a CSM,
I want to understand where my time goes
So that I can work more efficiently
```

```
As a VP of CS,
I want to correlate time investment with outcomes
So that I can make data-driven resource decisions
```

---

## 5. Functional Requirements

### 5.1 Time Capture

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-161.1 | Auto-track meeting time from calendar | P0 |
| FR-161.2 | Auto-track email time estimates | P1 |
| FR-161.3 | Manual time entry for other activities | P0 |
| FR-161.4 | Categorize time by activity type | P0 |
| FR-161.5 | Associate time with customer when applicable | P0 |

### 5.2 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-161.6 | Show time breakdown by activity type | P0 |
| FR-161.7 | Show time breakdown by customer | P0 |
| FR-161.8 | Calculate time vs. ARR ratio | P0 |
| FR-161.9 | Track trends over time | P0 |
| FR-161.10 | Compare across CSMs | P1 |

### 5.3 Optimization

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-161.11 | Identify time-intensive customers | P0 |
| FR-161.12 | Flag imbalanced time/ARR ratios | P0 |
| FR-161.13 | Suggest reallocation opportunities | P1 |
| FR-161.14 | Track administrative overhead | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface TimeEntry {
  id: string;
  csm_id: string;
  customer_id?: string;

  activity_type: ActivityType;
  description?: string;
  duration_minutes: number;

  date: string;
  source: 'calendar' | 'email' | 'manual' | 'system';
  reference_id?: string; // meeting_id, email_id, etc.
}

enum ActivityType {
  MEETING = 'meeting',
  EMAIL = 'email',
  CALL = 'call',
  INTERNAL_MEETING = 'internal_meeting',
  ADMIN = 'admin',
  DOCUMENTATION = 'documentation',
  TRAINING = 'training',
  RESEARCH = 'research',
  TRAVEL = 'travel',
  OTHER = 'other'
}

interface TimeAllocationMetrics {
  csm_id: string;
  period: string;

  total_hours: number;

  by_activity: {
    type: ActivityType;
    hours: number;
    percentage: number;
  }[];

  by_customer: {
    customer_id: string;
    customer_name: string;
    hours: number;
    arr: number;
    hours_per_10k_arr: number;
  }[];

  customer_facing_pct: number;
  admin_pct: number;
  internal_pct: number;
}
```

### 6.2 API Endpoints

```typescript
// Get time allocation report
GET /api/reports/time-allocation
Query: {
  csm_id?: string;
  team_id?: string;
  period?: string;
}

Response: {
  summary: TimeAllocationSummary;
  by_csm: CSMTimeBreakdown[];
  by_customer: CustomerTimeBreakdown[];
  trends: TimeTrend[];
  recommendations: OptimizationSuggestion[];
}

// Log time entry
POST /api/time-entries
{
  activity_type: ActivityType;
  customer_id?: string;
  duration_minutes: number;
  date: string;
  description?: string;
}

// Get CSM time detail
GET /api/reports/time-allocation/:csmId
Query: { period?: string }
```

---

## 7. User Interface

### 7.1 Team Time Dashboard

```
+----------------------------------------------------------+
|  Time Allocation Analysis                [This Month v]   |
+----------------------------------------------------------+
|                                                           |
|  TEAM SUMMARY                                             |
|  +----------------+----------------+----------------+     |
|  | Total Hours    | Customer-Facing| Admin Overhead |     |
|  |    1,840       |      65%       |      18%       |     |
|  | 8 CSMs tracked | +5% vs target  | Target: <15%   |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  TIME BY ACTIVITY TYPE                                    |
|  +--------------------------------------------------+    |
|  | Meetings        | ████████████████ | 35% | 644 hrs|    |
|  | Email           | ██████████ | 22% | 405 hrs      |    |
|  | Admin           | ████████ | 18% | 331 hrs        |    |
|  | Internal Mtgs   | ██████ | 12% | 221 hrs          |    |
|  | Documentation   | ████ | 8% | 147 hrs             |    |
|  | Other           | ██ | 5% | 92 hrs                |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CSM COMPARISON                                           |
|  +------------------------------------------------------+|
|  | CSM        | Hours | Cust-Facing | Customers | ARR/hr||
|  |------------|-------|-------------|-----------|-------||
|  | Sarah Chen | 210   | 72%         | 15        | $420  ||
|  | Mike Johnson| 225  | 58%         | 12        | $380  ||
|  | Lisa Wang  | 195   | 68%         | 14        | $510  ||
|  +------------------------------------------------------+|
|                                                           |
|  OPTIMIZATION ALERTS                                      |
|  +--------------------------------------------------+    |
|  | ! DataFlow Inc consuming 15 hrs/month ($50K ARR) |    |
|  |   Recommendation: Review engagement model         |    |
|  | ! Admin time 18% - above 15% target              |    |
|  |   Recommendation: Automate recurring tasks        |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 CSM Time Detail

```
+----------------------------------------------------------+
|  Time Allocation: Sarah Chen                              |
+----------------------------------------------------------+
|                                                           |
|  THIS MONTH: 210 hours                   Trend: Stable   |
|                                                           |
|  TIME BREAKDOWN                                           |
|  +--------------------------------------------------+    |
|  | Customer Meetings | ████████████████ | 38% | 80 hrs|   |
|  | Email             | ██████████ | 22% | 46 hrs      |   |
|  | Internal Meetings | ██████ | 14% | 29 hrs          |   |
|  | Admin             | ██████ | 12% | 25 hrs          |   |
|  | Documentation     | ████ | 8% | 17 hrs             |   |
|  | Other             | ██ | 6% | 13 hrs               |   |
|  +--------------------------------------------------+    |
|                                                           |
|  TOP CUSTOMERS BY TIME                                    |
|  +------------------------------------------------------+|
|  | Customer    | Hours | ARR    | Hrs/$10K | Efficient? ||
|  |-------------|-------|--------|----------|------------||
|  | Acme Corp   | 18    | $120K  | 1.5      | ✓          ||
|  | TechStart   | 15    | $65K   | 2.3      | ✓          ||
|  | DataFlow    | 22    | $45K   | 4.9      | ⚠ High     ||
|  | CloudNine   | 12    | $90K   | 1.3      | ✓          ||
|  +------------------------------------------------------+|
|                                                           |
|  WEEKLY TREND                                             |
|  +--------------------------------------------------+    |
|  | 60|                                               |    |
|  | 50|___     ___     ___     ___                    |    |
|  | 40|   \___/   \___/   \___/   \                   |    |
|  | 30|                            \___               |    |
|  |   +------------------------------------------>   |    |
|  |    Wk1 Wk2 Wk3 Wk4                               |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track time-related activities |
| Researcher | Analyze time patterns |
| Orchestrator | Generate time reports |

### 8.2 Natural Language Queries

```
"How am I spending my time this month?"
"Which customers take the most time?"
"Compare time allocation across my team"
"What's my time per ARR ratio?"
"Show me time trends for the quarter"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] Calendar meetings auto-track to time log
- [ ] Manual time entries can be created
- [ ] Activity type categorization works correctly
- [ ] Customer attribution is accurate
- [ ] Time/ARR ratios calculate correctly

### 9.2 Analysis

- [ ] Trends display accurate historical data
- [ ] Team comparisons are fair and accurate
- [ ] Optimization suggestions are actionable

---

## 10. Test Cases

### TC-161.1: Auto-Tracking
```
Given: CSM has 5 customer meetings (4 hours total) on calendar
When: Time is auto-captured for the day
Then: 4 hours logged as "meeting" activity
And: Each meeting attributed to correct customer
```

### TC-161.2: Time/ARR Analysis
```
Given: CSM spent 20 hours on customer with $100K ARR
When: Efficiency ratio is calculated
Then: Shows 2.0 hours per $10K ARR
And: Compares to team average
```

### TC-161.3: Optimization Alert
```
Given: Customer consuming 5x team average hours per ARR
When: Analysis runs
Then: Alert generated for review
And: Recommendation provided
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Customer-facing time | > 60% | % of time in customer activities |
| Admin overhead | < 15% | % of time in admin tasks |
| Time/ARR efficiency | < 2 hrs/$10K | Portfolio average |
| Tracking completeness | > 90% | Hours tracked / working hours |

---

## 12. Dependencies

- Google Calendar integration
- Gmail integration
- Customer activity logging
- PRD-157: Engagement Metrics Report

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Activity categories, UI mockups |
| Backend | 2 weeks | Auto-tracking, calculations |
| Frontend | 1 week | Dashboard views |
| Testing | 1 week | Integration tests |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. Should we track time passively or require manual confirmation?
2. How do we handle time spent on multiple customers?
3. What is the ideal time/ARR ratio by segment?
4. Should we integrate with external time tracking tools?

---

## Appendix A: Activity Categories

| Category | Examples | Customer-Facing |
|----------|----------|-----------------|
| Meeting | Customer calls, QBRs | Yes |
| Email | Customer correspondence | Yes |
| Call | Phone calls | Yes |
| Internal Meeting | Team syncs, 1:1s | No |
| Admin | CRM updates, reporting | No |
| Documentation | Success plans, notes | Partial |
| Training | Certifications, learning | No |
| Research | Account research | No |
