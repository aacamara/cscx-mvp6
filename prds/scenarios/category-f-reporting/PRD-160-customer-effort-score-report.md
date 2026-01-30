# PRD-160: Customer Effort Score Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-160 |
| Title | Customer Effort Score Report |
| Category | F - Reporting & Analytics |
| Priority | P2 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a Customer Effort Score (CES) reporting system that measures and tracks how easy it is for customers to interact with the product and support channels. This enables identification of friction points and improvement opportunities to reduce customer effort.

---

## 2. Problem Statement

### Current Pain Points
- No systematic measurement of customer effort
- Friction points in the product experience go undetected
- Cannot quantify ease-of-use improvements
- Missing correlation between effort and churn
- No benchmarks for acceptable effort levels

### Impact
- High effort experiences lead to churn
- Inefficient resource allocation for improvements
- Unable to prioritize UX investments
- Reactive rather than proactive experience management

---

## 3. Solution Overview

### High-Level Approach
Build a CES collection and analytics system that measures effort across touchpoints, identifies friction areas, and provides actionable insights for experience improvement.

### Key Features
1. **CES Collection** - Survey delivery and response capture
2. **Score Tracking** - CES trends over time
3. **Touchpoint Analysis** - Effort by interaction type
4. **Friction Detection** - Identify high-effort areas
5. **Correlation Analysis** - Link effort to outcomes
6. **Benchmarking** - Compare across segments
7. **Improvement Tracking** - Measure initiative impact

---

## 4. User Stories

### Primary User Stories

```
As a VP of CS,
I want to understand overall customer effort
So that I can prioritize experience improvements
```

```
As a Product Manager,
I want to see CES by feature/workflow
So that I can identify UX improvement areas
```

```
As a CSM,
I want to know which customers have high effort experiences
So that I can proactively address their concerns
```

---

## 5. Functional Requirements

### 5.1 CES Collection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-160.1 | Deliver CES surveys after key interactions | P0 |
| FR-160.2 | Support 1-7 scale CES questions | P0 |
| FR-160.3 | Capture optional feedback comments | P0 |
| FR-160.4 | Track survey delivery and response rates | P0 |
| FR-160.5 | Prevent survey fatigue with frequency limits | P1 |

### 5.2 Score Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-160.6 | Calculate average CES per customer | P0 |
| FR-160.7 | Track CES trends over time | P0 |
| FR-160.8 | Segment CES by interaction type | P0 |
| FR-160.9 | Calculate portfolio-wide CES | P0 |
| FR-160.10 | Show response distribution | P1 |

### 5.3 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-160.11 | Identify high-effort touchpoints | P0 |
| FR-160.12 | Analyze feedback themes | P1 |
| FR-160.13 | Correlate CES with NPS/health | P1 |
| FR-160.14 | Correlate CES with churn | P0 |
| FR-160.15 | Compare CES across segments | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface CESSurvey {
  id: string;
  customer_id: string;
  user_id: string;

  // Context
  touchpoint: string; // 'support_ticket', 'feature_use', 'onboarding', etc.
  interaction_id?: string;

  // Response
  score: number; // 1-7 (1=very high effort, 7=very low effort)
  feedback?: string;
  responded_at: string;

  // Metadata
  delivered_at: string;
  channel: 'in_app' | 'email' | 'slack';
}

interface CESMetrics {
  customer_id: string;
  period: string;

  scores: {
    average: number;
    count: number;
    response_rate: number;
    trend: 'improving' | 'stable' | 'worsening';
  };

  distribution: {
    low_effort: number; // 6-7
    neutral: number; // 4-5
    high_effort: number; // 1-3
  };

  by_touchpoint: {
    touchpoint: string;
    average: number;
    count: number;
  }[];
}

interface PortfolioCES {
  period: string;

  overall: {
    average: number;
    total_responses: number;
    response_rate: number;
  };

  by_touchpoint: {
    touchpoint: string;
    average: number;
    count: number;
    trend: string;
  }[];

  problem_areas: {
    touchpoint: string;
    average: number;
    common_feedback: string[];
  }[];

  top_performers: {
    touchpoint: string;
    average: number;
  }[];
}
```

### 6.2 CES Scale Definition

```typescript
const CES_SCALE = {
  1: { label: 'Strongly Disagree', effort: 'Very High' },
  2: { label: 'Disagree', effort: 'High' },
  3: { label: 'Somewhat Disagree', effort: 'Moderate-High' },
  4: { label: 'Neutral', effort: 'Moderate' },
  5: { label: 'Somewhat Agree', effort: 'Moderate-Low' },
  6: { label: 'Agree', effort: 'Low' },
  7: { label: 'Strongly Agree', effort: 'Very Low' }
};

// Survey question format:
// "[Company] made it easy for me to [accomplish task]"
```

### 6.3 API Endpoints

```typescript
// Get CES report
GET /api/reports/ces
Query: {
  period?: string;
  customer_id?: string;
  touchpoint?: string;
}

Response: {
  summary: PortfolioCES;
  trends: CESTrend[];
  problem_areas: ProblemArea[];
}

// Get customer CES detail
GET /api/reports/ces/:customerId
Response: {
  metrics: CESMetrics;
  surveys: CESSurvey[];
  trends: CustomerCESTrend[];
}

// Submit CES response
POST /api/ces/respond
{
  survey_id: string;
  score: number;
  feedback?: string;
}
```

---

## 7. User Interface

### 7.1 CES Dashboard

```
+----------------------------------------------------------+
|  Customer Effort Score Report            [This Quarter v] |
+----------------------------------------------------------+
|                                                           |
|  OVERALL CES                                              |
|  +----------------+----------------+----------------+     |
|  | Average CES    | Responses      | Response Rate  |     |
|  |     5.2/7      |     842        |      68%       |     |
|  | +0.3 vs last Q | +15% vs last Q | Stable         |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  SCORE DISTRIBUTION                                       |
|  +--------------------------------------------------+    |
|  |    Low Effort (6-7)   | ████████████████ | 45%    |    |
|  |    Neutral (4-5)      | ████████████ | 35%        |    |
|  |    High Effort (1-3)  | ████████ | 20%            |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CES BY TOUCHPOINT                                        |
|  +--------------------------------------------------+    |
|  | Touchpoint          | CES  | Trend | Responses    |    |
|  |---------------------|------|-------|--------------|    |
|  | Support Ticket      | 5.8  |  ↑    | 245          |    |
|  | Feature Use         | 5.4  |  →    | 320          |    |
|  | Onboarding          | 5.1  |  ↑    | 85           |    |
|  | Billing/Invoicing   | 4.2  |  ↓    | 92           |    |
|  | API Integration     | 3.8  |  →    | 100          |    |
|  +--------------------------------------------------+    |
|                                                           |
|  HIGH EFFORT AREAS (Need Attention)                       |
|  +--------------------------------------------------+    |
|  | ! API Integration (3.8) - "Documentation unclear" |    |
|  | ! Billing/Invoicing (4.2) - "Hard to find info"  |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Customer CES View

```
+----------------------------------------------------------+
|  CES: Acme Corp                                           |
+----------------------------------------------------------+
|                                                           |
|  AVERAGE CES: 4.8/7                        Trend: ↓ -0.4 |
|                                                           |
|  RECENT RESPONSES                                         |
|  +------------------------------------------------------+|
|  | Date    | Touchpoint    | Score | Feedback           ||
|  |---------|---------------|-------|--------------------||
|  | Jan 25  | Support       | 6     | Quick resolution   ||
|  | Jan 20  | API Setup     | 3     | Docs outdated      ||
|  | Jan 15  | Feature Use   | 5     | -                  ||
|  | Jan 10  | Billing       | 4     | Confusing invoice  ||
|  +------------------------------------------------------+|
|                                                           |
|  EFFORT TREND (6 Months)                                  |
|  +--------------------------------------------------+    |
|  |  7|                                               |    |
|  |  6|_____                                          |    |
|  |  5|     \___    ___                               |    |
|  |  4|         \__/   \__ current: 4.8               |    |
|  |   +------------------------------------------>   |    |
|  +--------------------------------------------------+    |
|                                                           |
|  FEEDBACK THEMES                                          |
|  +--------------------------------------------------+    |
|  | Documentation | ███████████ | 4 mentions          |    |
|  | Response Time | ████████ | 3 mentions             |    |
|  | Complexity    | █████ | 2 mentions                |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track CES scores and trends |
| Researcher | Analyze feedback themes |
| Communicator | Deliver survey follow-ups |

### 8.2 Natural Language Queries

```
"What's our customer effort score?"
"Which touchpoints have the highest effort?"
"Show me CES for Acme Corp"
"What's causing high effort in API integrations?"
"How does CES correlate with churn?"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] CES surveys deliver after defined touchpoints
- [ ] Responses are captured and stored correctly
- [ ] Averages and distributions calculate accurately
- [ ] Touchpoint breakdown is accurate
- [ ] Trends display historical data

### 9.2 Survey Management

- [ ] Survey frequency limits prevent fatigue
- [ ] Multi-channel delivery works
- [ ] Response rates track correctly

---

## 10. Test Cases

### TC-160.1: CES Calculation
```
Given: 10 responses with scores [7,6,5,5,4,3,6,7,5,4]
When: Average CES is calculated
Then: Average = 5.2
And: Distribution shows 3 low-effort, 5 neutral, 2 high-effort
```

### TC-160.2: Touchpoint Analysis
```
Given: Support interactions have avg CES 5.8, API has 3.8
When: Touchpoint report is generated
Then: API flagged as high-effort area
And: Support shown as top performer
```

### TC-160.3: Survey Delivery
```
Given: Customer completed a support ticket
When: Ticket is closed
Then: CES survey is delivered within 1 hour
And: Survey references the specific interaction
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Overall CES | > 5.5 | Portfolio average |
| High effort % | < 15% | Scores 1-3 as % of total |
| Response rate | > 30% | Surveys answered / delivered |
| Improvement rate | +0.2/qtr | Quarter-over-quarter CES |

---

## 12. Dependencies

- Survey delivery infrastructure
- Touchpoint event tracking
- PRD-156: Support Metrics Dashboard (support CES)
- PRD-159: Product Adoption Report (feature usage CES)

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Survey design, touchpoint map |
| Backend | 2 weeks | Survey system, calculations |
| Frontend | 1 week | Dashboard views |
| Testing | 1 week | Survey flows, calculations |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. Which touchpoints should trigger CES surveys?
2. What is the ideal survey frequency per customer?
3. Should we use 1-5 or 1-7 scale?
4. How do we handle anonymous feedback?

---

## Appendix A: CES Touchpoints

| Touchpoint | Trigger Event | Survey Timing |
|------------|---------------|---------------|
| Support Ticket | Ticket closed | 1 hour after |
| Onboarding | Phase completed | Immediate |
| Feature Use | First use of major feature | 24 hours after |
| Billing | Invoice viewed/paid | 1 day after |
| API Integration | First successful call | 24 hours after |
| Training | Session completed | Immediate |
