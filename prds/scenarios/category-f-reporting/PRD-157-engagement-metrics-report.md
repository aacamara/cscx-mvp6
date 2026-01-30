# PRD-157: Engagement Metrics Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-157 |
| Title | Engagement Metrics Report |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive engagement metrics report that tracks all customer touchpoints and interactions, providing visibility into relationship depth, communication patterns, and engagement health across the portfolio.

---

## 2. Problem Statement

### Current Pain Points
- No unified view of all customer engagement activities
- Difficult to identify under-engaged or over-engaged customers
- Cannot track engagement trends over time
- Missing insights on which engagement activities drive success
- No benchmarks for healthy engagement levels

### Impact
- Relationships deteriorate without visibility
- Inefficient time allocation across accounts
- Reactive engagement instead of proactive
- Unable to quantify CS effort vs. outcomes

---

## 3. Solution Overview

### High-Level Approach
Build an engagement analytics system that tracks all customer interactions, calculates engagement scores, identifies patterns, and provides actionable insights for relationship management.

### Key Features
1. **Engagement Score** - Composite metric of interaction quality
2. **Activity Tracking** - All touchpoints across channels
3. **Trend Analysis** - Engagement patterns over time
4. **Segmentation** - Compare engagement by cohort
5. **Correlation** - Link engagement to outcomes
6. **Alerts** - Flag engagement anomalies
7. **Recommendations** - Suggest optimal engagement levels

---

## 4. User Stories

### Primary User Stories

```
As a CSM,
I want to see engagement metrics for all my accounts
So that I can prioritize customers needing more attention
```

```
As a CSM Manager,
I want to compare engagement levels across my team
So that I can ensure consistent coverage
```

```
As a VP of CS,
I want to understand the correlation between engagement and retention
So that I can optimize team capacity planning
```

---

## 5. Functional Requirements

### 5.1 Engagement Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-157.1 | Track all email interactions (sent/received) | P0 |
| FR-157.2 | Track meeting occurrences and duration | P0 |
| FR-157.3 | Track calls made/received | P0 |
| FR-157.4 | Track in-app messages and responses | P1 |
| FR-157.5 | Track QBR completion | P0 |
| FR-157.6 | Track stakeholder coverage breadth | P1 |

### 5.2 Engagement Scoring

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-157.7 | Calculate composite engagement score | P0 |
| FR-157.8 | Weight activities by impact | P1 |
| FR-157.9 | Factor in response rates | P0 |
| FR-157.10 | Include recency of engagement | P0 |
| FR-157.11 | Account for stakeholder seniority | P2 |

### 5.3 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-157.12 | Show engagement trends over time | P0 |
| FR-157.13 | Compare engagement across segments | P1 |
| FR-157.14 | Identify engagement outliers | P0 |
| FR-157.15 | Correlate engagement with health/retention | P1 |
| FR-157.16 | Benchmark against successful accounts | P2 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface EngagementActivity {
  id: string;
  customer_id: string;
  type: 'email' | 'meeting' | 'call' | 'qbr' | 'message' | 'event';
  direction: 'inbound' | 'outbound';
  date: string;
  duration_minutes?: number;
  participants: string[];
  stakeholder_level?: 'executive' | 'champion' | 'user';
  response_received?: boolean;
  source: string;
}

interface EngagementMetrics {
  customer_id: string;
  period: string;

  activities: {
    emails_sent: number;
    emails_received: number;
    meetings_held: number;
    meeting_minutes: number;
    calls_made: number;
    qbrs_completed: number;
  };

  quality: {
    response_rate: number;
    avg_response_time_hours: number;
    stakeholders_engaged: number;
    executive_touchpoints: number;
  };

  score: {
    engagement_score: number;
    category: 'high' | 'healthy' | 'low' | 'at_risk';
    trend: 'improving' | 'stable' | 'declining';
    change_from_last_period: number;
  };

  last_contact: {
    date: string;
    type: string;
    days_ago: number;
  };
}
```

### 6.2 Engagement Score Calculation

```typescript
interface EngagementScoreWeights {
  email_volume: 0.15;
  email_response: 0.20;
  meeting_frequency: 0.25;
  meeting_quality: 0.15;
  stakeholder_breadth: 0.15;
  recency: 0.10;
}

// Score calculation (0-100)
function calculateEngagementScore(metrics: EngagementMetrics): number {
  const emailScore = Math.min(100, (metrics.activities.emails_sent * 5));
  const responseScore = metrics.quality.response_rate * 100;
  const meetingScore = Math.min(100, (metrics.activities.meetings_held * 20));
  const qualityScore = (metrics.activities.meeting_minutes / 60) * 10;
  const breadthScore = Math.min(100, metrics.quality.stakeholders_engaged * 25);
  const recencyScore = Math.max(0, 100 - (metrics.last_contact.days_ago * 3));

  return (
    emailScore * 0.15 +
    responseScore * 0.20 +
    meetingScore * 0.25 +
    qualityScore * 0.15 +
    breadthScore * 0.15 +
    recencyScore * 0.10
  );
}
```

### 6.3 API Endpoints

```typescript
// Get engagement metrics for portfolio
GET /api/reports/engagement-metrics
Query: {
  csm_id?: string;
  period?: string;
  segment?: string;
  min_score?: number;
  max_score?: number;
}

// Get engagement details for customer
GET /api/reports/engagement-metrics/:customerId
Query: { period?: string }

// Get engagement trends
GET /api/reports/engagement-metrics/:customerId/trends
Query: { periods: number }

// Get engagement correlation analysis
GET /api/reports/engagement-metrics/correlation
Query: { outcome: 'health' | 'renewal' | 'churn' }
```

---

## 7. User Interface

### 7.1 Portfolio Engagement View

```
+----------------------------------------------------------+
|  Engagement Metrics Report               [This Quarter v] |
+----------------------------------------------------------+
|                                                           |
|  PORTFOLIO ENGAGEMENT                                     |
|  +----------------+----------------+----------------+     |
|  | Avg Score      | High Engaged   | At Risk        |     |
|  |    72/100      |      18        |       5        |     |
|  | +3 vs last qtr | 38% of portf.  | Need attention |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  ENGAGEMENT DISTRIBUTION                                  |
|  +--------------------------------------------------+    |
|  | High (80+)    | ████████████████████ | 18 (38%)   |    |
|  | Healthy (60-79)| █████████████████ | 15 (32%)    |    |
|  | Low (40-59)   | █████████ | 9 (19%)               |    |
|  | At Risk (<40) | █████ | 5 (11%)                   |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CUSTOMERS NEEDING ATTENTION                              |
|  +--------------------------------------------------+    |
|  | DataFlow Inc  | Score: 32 | Last contact: 45 days |   |
|  | CloudNine     | Score: 38 | Response rate: 20%    |   |
|  | MegaCorp      | Score: 42 | No exec touchpoint    |   |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Customer Engagement Detail

```
+----------------------------------------------------------+
|  Engagement: Acme Corp                                    |
+----------------------------------------------------------+
|                                                           |
|  ENGAGEMENT SCORE: 78/100 (Healthy)        Trend: ↑ +5   |
|                                                           |
|  ACTIVITY BREAKDOWN (This Quarter)                        |
|  +--------------------------------------------------+    |
|  | Emails Sent      | 24                              |    |
|  | Emails Received  | 18                              |    |
|  | Response Rate    | 75%                             |    |
|  | Meetings Held    | 6                               |    |
|  | Meeting Time     | 4.5 hours                       |    |
|  | QBRs             | 1 completed                     |    |
|  +--------------------------------------------------+    |
|                                                           |
|  STAKEHOLDER COVERAGE                                     |
|  +--------------------------------------------------+    |
|  | Sarah Chen (VP)  | ██████████ | Last: 2 weeks     |    |
|  | Mike Johnson     | ████████ | Last: 1 week        |    |
|  | Lisa Wang        | ██████ | Last: 3 weeks         |    |
|  | Tom Davis        | ████ | Last: 6 weeks           |    |
|  +--------------------------------------------------+    |
|                                                           |
|  ENGAGEMENT TREND (6 Months)                              |
|  +--------------------------------------------------+    |
|  | 80|                    ___________                |    |
|  | 70|_______        ____/                           |    |
|  | 60|       \______/                                |    |
|  |   +------------------------------------------>   |    |
|  |    Aug Sep Oct Nov Dec Jan                       |    |
|  +--------------------------------------------------+    |
|                                                           |
|  RECENT ACTIVITIES                                        |
|  +--------------------------------------------------+    |
|  | Jan 27 | Meeting with Sarah Chen (45 min)        |    |
|  | Jan 22 | Email: Renewal discussion                |    |
|  | Jan 18 | Call with Mike Johnson                   |    |
|  | Jan 10 | Email: Product update                    |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track engagement levels |
| Researcher | Analyze engagement patterns |
| Communicator | Log communication activities |

### 8.2 Natural Language Queries

```
"Show me engagement metrics for my accounts"
"Which customers have I not contacted recently?"
"What's the engagement score for Acme Corp?"
"Show me low-engaged customers"
"Compare engagement across my enterprise accounts"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] All engagement activities are tracked and attributed
- [ ] Engagement scores calculate correctly
- [ ] Trends display accurate historical data
- [ ] Low engagement accounts are flagged
- [ ] Stakeholder coverage is tracked

### 9.2 Data Accuracy

- [ ] Activities sync from Gmail/Calendar within 1 hour
- [ ] Score calculations are consistent and repeatable
- [ ] Historical data preserves for trend analysis

---

## 10. Test Cases

### TC-157.1: Score Calculation
```
Given: Customer with 10 emails, 3 meetings, 60% response rate
When: Engagement score is calculated
Then: Score reflects weighted combination of inputs
And: Falls within expected category
```

### TC-157.2: Low Engagement Alert
```
Given: Customer engagement score drops below 40
When: Daily engagement check runs
Then: Customer flagged as "at risk"
And: CSM notified of engagement decline
```

### TC-157.3: Activity Tracking
```
Given: CSM sends email to customer
When: Email is tracked in system
Then: Activity appears in engagement log
And: Engagement metrics update accordingly
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Portfolio avg score | > 65 | Average engagement across all customers |
| At-risk percentage | < 10% | Customers with score < 40 |
| Score-retention correlation | > 0.6 | Statistical correlation |
| Engagement visibility | 95% | Activities tracked vs. total |

---

## 12. Dependencies

- Google Workspace integration (Gmail, Calendar)
- Meeting tracking system
- PRD-166: Meeting Analytics Report
- PRD-167: Email Performance Report

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Scoring model, UI mockups |
| Backend | 2 weeks | Activity tracking, calculations |
| Frontend | 2 weeks | Dashboard views |
| Testing | 1 week | Integration tests, UAT |
| **Total** | **6 weeks** | |

---

## 14. Open Questions

1. Should engagement scores factor in customer size/ARR?
2. How do we handle shared accounts (multiple CSMs)?
3. What is the ideal engagement level by segment?
4. Should we track engagement at stakeholder level?

---

## Appendix A: Engagement Benchmarks

| Segment | Healthy Score | Expected Meetings/Qtr | Expected Emails/Month |
|---------|---------------|----------------------|----------------------|
| Enterprise | 70-85 | 6-8 | 15-20 |
| Mid-Market | 60-75 | 3-4 | 8-12 |
| SMB | 50-65 | 1-2 | 4-6 |
