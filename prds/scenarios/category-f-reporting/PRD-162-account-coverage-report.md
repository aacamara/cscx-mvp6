# PRD-162: Account Coverage Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-162 |
| Title | Account Coverage Report |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create an account coverage report that analyzes CSM portfolio assignments, identifies coverage gaps, and ensures appropriate attention is given to all accounts based on their tier and risk level. This enables optimal resource allocation and prevents accounts from falling through the cracks.

---

## 2. Problem Statement

### Current Pain Points
- No visibility into which accounts are under or over-covered
- Difficult to balance CSM workloads
- High-value accounts may not receive proportional attention
- At-risk accounts may be neglected
- No clear metrics for adequate coverage

### Impact
- Inconsistent customer experience
- Burnout from unbalanced portfolios
- Missed renewal or expansion opportunities
- Higher churn from neglected accounts

---

## 3. Solution Overview

### High-Level Approach
Build a coverage analysis system that tracks account assignments, measures engagement levels, and identifies coverage gaps relative to account importance.

### Key Features
1. **Portfolio Analysis** - CSM account distribution
2. **Coverage Metrics** - Last touch, engagement frequency
3. **Gap Detection** - Under-covered accounts
4. **Workload Balance** - CSM capacity analysis
5. **Tier Alignment** - Coverage vs. account importance
6. **Recommendations** - Rebalancing suggestions
7. **Alerting** - Coverage gap notifications

---

## 4. User Stories

### Primary User Stories

```
As a CSM Manager,
I want to see coverage metrics across all accounts
So that I can ensure no accounts are being neglected
```

```
As a VP of CS,
I want to understand portfolio balance across my team
So that I can make informed hiring and assignment decisions
```

```
As a CSM,
I want to identify which accounts need more attention
So that I can prioritize my outreach
```

---

## 5. Functional Requirements

### 5.1 Coverage Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-162.1 | Track last contact date per account | P0 |
| FR-162.2 | Calculate days since last engagement | P0 |
| FR-162.3 | Track meeting frequency per account | P0 |
| FR-162.4 | Track email touchpoints per account | P0 |
| FR-162.5 | Monitor stakeholder coverage breadth | P1 |

### 5.2 Portfolio Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-162.6 | Show accounts per CSM | P0 |
| FR-162.7 | Show ARR per CSM | P0 |
| FR-162.8 | Calculate coverage score per account | P0 |
| FR-162.9 | Compare coverage to tier expectations | P0 |
| FR-162.10 | Identify over/under-covered accounts | P0 |

### 5.3 Gap Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-162.11 | Flag accounts exceeding touch threshold | P0 |
| FR-162.12 | Identify high-value under-engaged accounts | P0 |
| FR-162.13 | Detect coverage gaps by tier | P0 |
| FR-162.14 | Alert on at-risk accounts without recent contact | P0 |

### 5.4 Workload Balance

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-162.15 | Calculate CSM utilization | P1 |
| FR-162.16 | Compare workloads across team | P1 |
| FR-162.17 | Suggest rebalancing when needed | P2 |
| FR-162.18 | Track coverage during CSM transitions | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface CoverageStandards {
  tier: string;
  expected_touches_per_month: number;
  max_days_between_contact: number;
  min_meetings_per_quarter: number;
  stakeholder_breadth: number;
}

interface AccountCoverage {
  customer_id: string;
  customer_name: string;
  tier: string;
  arr: number;
  csm_id: string;
  health_score: number;

  coverage: {
    last_contact_date: string;
    days_since_contact: number;
    touches_this_month: number;
    meetings_this_quarter: number;
    stakeholders_engaged: number;
  };

  standards: CoverageStandards;

  status: {
    coverage_score: number; // 0-100
    is_under_covered: boolean;
    gap_areas: string[];
    priority: 'urgent' | 'attention' | 'ok';
  };
}

interface CSMPortfolio {
  csm_id: string;
  csm_name: string;

  portfolio: {
    total_accounts: number;
    total_arr: number;
    by_tier: Record<string, number>;
    by_health: Record<string, number>;
  };

  coverage: {
    avg_coverage_score: number;
    under_covered: number;
    well_covered: number;
    over_covered: number;
  };

  workload: {
    estimated_hours_needed: number;
    current_capacity: number;
    utilization_pct: number;
  };
}
```

### 6.2 Coverage Score Calculation

```typescript
function calculateCoverageScore(
  account: AccountCoverage,
  standards: CoverageStandards
): number {
  let score = 100;

  // Deduct for days since contact
  if (account.coverage.days_since_contact > standards.max_days_between_contact) {
    const overdue = account.coverage.days_since_contact - standards.max_days_between_contact;
    score -= Math.min(40, overdue * 2);
  }

  // Deduct for insufficient touches
  const touchRatio = account.coverage.touches_this_month / standards.expected_touches_per_month;
  if (touchRatio < 1) {
    score -= (1 - touchRatio) * 30;
  }

  // Deduct for meeting gap
  const meetingRatio = account.coverage.meetings_this_quarter / standards.min_meetings_per_quarter;
  if (meetingRatio < 1) {
    score -= (1 - meetingRatio) * 20;
  }

  // Deduct for stakeholder gap
  const stakeholderRatio = account.coverage.stakeholders_engaged / standards.stakeholder_breadth;
  if (stakeholderRatio < 1) {
    score -= (1 - stakeholderRatio) * 10;
  }

  return Math.max(0, score);
}
```

### 6.3 API Endpoints

```typescript
// Get coverage report
GET /api/reports/account-coverage
Query: {
  csm_id?: string;
  team_id?: string;
  tier?: string;
  status?: 'under_covered' | 'ok' | 'over_covered';
}

Response: {
  summary: CoverageSummary;
  by_csm: CSMPortfolio[];
  accounts: AccountCoverage[];
  gaps: CoverageGap[];
  recommendations: CoverageRecommendation[];
}

// Get CSM portfolio detail
GET /api/reports/account-coverage/csm/:csmId

// Get coverage gaps only
GET /api/reports/account-coverage/gaps
Query: { priority?: string }
```

---

## 7. User Interface

### 7.1 Coverage Dashboard

```
+----------------------------------------------------------+
|  Account Coverage Report                 [This Month v]   |
+----------------------------------------------------------+
|                                                           |
|  PORTFOLIO COVERAGE SUMMARY                               |
|  +----------------+----------------+----------------+     |
|  | Well Covered   | Under Covered  | Over Covered   |     |
|  |      38        |       9        |       5        |     |
|  |     73%        |      17%       |      10%       |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  COVERAGE GAPS (Urgent)                       [View All]  |
|  +--------------------------------------------------+    |
|  | ! Acme Corp (Enterprise) - 28 days since contact |    |
|  |   Expected: 14 days max                          |    |
|  | ! TechStart (Mid-Market) - 0 meetings this qtr   |    |
|  |   Expected: 2 meetings min                       |    |
|  | ! DataFlow (Enterprise) - At-risk, no engagement |    |
|  |   URGENT: Health 42, renewal in 45 days          |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CSM PORTFOLIO BALANCE                                    |
|  +------------------------------------------------------+|
|  | CSM        | Accounts | ARR    | Avg Score | Gaps    ||
|  |------------|----------|--------|-----------|---------|
|  | Sarah Chen | 15       | $1.8M  | 82        | 2       ||
|  | Mike Johnson| 18      | $1.2M  | 68        | 4       ||
|  | Lisa Wang  | 12       | $2.1M  | 85        | 1       ||
|  | Tom Davis  | 16       | $1.4M  | 71        | 2       ||
|  +------------------------------------------------------+|
|                                                           |
|  COVERAGE BY TIER                                         |
|  +--------------------------------------------------+    |
|  | Enterprise  | ████████████████████ | 85% covered |    |
|  | Mid-Market  | ████████████████ | 75% covered     |    |
|  | SMB         | ████████████ | 65% covered         |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Account Coverage Detail

```
+----------------------------------------------------------+
|  Under-Covered Accounts                   [Export]        |
+----------------------------------------------------------+
|                                                           |
|  +------------------------------------------------------+|
|  | Customer   | Tier    | ARR  | Score | Gap        | Days||
|  |------------|---------|------|-------|------------|-----||
|  | Acme Corp  | Enterp. | $120K| 45    | Contact    | 28  ||
|  | TechStart  | Mid-Mkt | $65K | 52    | Meetings   | -   ||
|  | DataFlow   | Enterp. | $95K | 38    | Multiple   | 21  ||
|  | CloudNine  | Mid-Mkt | $45K | 58    | Stakeholder| -   ||
|  +------------------------------------------------------+|
|                                                           |
|  ACCOUNT DETAIL: DataFlow Inc                             |
|  +--------------------------------------------------+    |
|  | Coverage Score: 38/100 (Under-Covered)            |    |
|  |                                                   |    |
|  | Gaps Identified:                                  |    |
|  | - Last contact: 21 days ago (max: 14)            |    |
|  | - Meetings this quarter: 0 (min: 2)              |    |
|  | - Stakeholders engaged: 1 (min: 3)               |    |
|  |                                                   |    |
|  | Additional Context:                               |    |
|  | - Health Score: 42 (At-Risk)                     |    |
|  | - Renewal: 45 days                               |    |
|  | - PRIORITY: URGENT                               |    |
|  +--------------------------------------------------+    |
|                                                           |
|  [Schedule Meeting] [Send Check-In Email]                 |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track coverage metrics |
| Scheduler | Help schedule catch-up meetings |
| Communicator | Send check-in emails |

### 8.2 Natural Language Queries

```
"Which accounts need more coverage?"
"Show me coverage gaps for enterprise accounts"
"How is my portfolio coverage?"
"Compare CSM workloads"
"Which at-risk accounts haven't been contacted?"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] Coverage scores calculate correctly per tier standards
- [ ] Last contact dates are accurate
- [ ] Gap detection flags appropriate accounts
- [ ] CSM portfolio summaries are complete
- [ ] Recommendations are actionable

### 9.2 Alerting

- [ ] Urgent gaps trigger notifications
- [ ] At-risk + under-covered prioritized highest
- [ ] Coverage improvements tracked

---

## 10. Test Cases

### TC-162.1: Coverage Score
```
Given: Enterprise account, last contact 20 days ago (max 14)
When: Coverage score is calculated
Then: Score reflects contact gap deduction
And: Account flagged as under-covered
```

### TC-162.2: Portfolio Balance
```
Given: CSM with 18 accounts totaling $1.5M ARR
When: Portfolio analysis runs
Then: Accurate account/ARR counts shown
And: Compared to team averages
```

### TC-162.3: Priority Detection
```
Given: Account at-risk (health < 50) with no contact in 21 days
When: Gap analysis runs
Then: Account marked as URGENT priority
And: Appears at top of gap list
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Well-covered % | > 80% | Accounts meeting coverage standards |
| Gap resolution time | < 7 days | Time from flagged to resolved |
| At-risk coverage | 100% | At-risk accounts with recent contact |
| Portfolio balance | < 20% variance | ARR distribution across CSMs |

---

## 12. Dependencies

- Customer assignment data
- Activity logging (emails, meetings)
- PRD-157: Engagement Metrics Report
- PRD-153: Health Score Portfolio View

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Coverage standards, UI mockups |
| Backend | 2 weeks | Calculations, gap detection |
| Frontend | 1 week | Dashboard views |
| Testing | 1 week | Integration tests |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. What are the right coverage standards by tier?
2. Should coverage factor in customer preferences (some want less touch)?
3. How do we handle shared/pooled account models?
4. Should we auto-schedule catch-up tasks for gaps?

---

## Appendix A: Recommended Coverage Standards

| Tier | Max Days Between Contact | Touches/Month | Meetings/Quarter | Stakeholders |
|------|-------------------------|---------------|------------------|--------------|
| Enterprise | 14 | 4 | 3 | 4+ |
| Mid-Market | 21 | 2 | 2 | 3 |
| SMB | 30 | 1 | 1 | 2 |
