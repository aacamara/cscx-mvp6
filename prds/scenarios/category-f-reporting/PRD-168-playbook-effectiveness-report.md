# PRD-168: Playbook Effectiveness Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-168 |
| Title | Playbook Effectiveness Report |
| Category | F - Reporting & Analytics |
| Priority | P2 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a playbook effectiveness report that measures the impact and success rates of customer success playbooks. This enables continuous improvement of playbook content and data-driven decisions about when and how to deploy different playbooks.

---

## 2. Problem Statement

### Current Pain Points
- No measurement of playbook success rates
- Cannot compare effectiveness across playbooks
- Missing data on which playbook steps drive outcomes
- Difficult to identify playbooks needing improvement
- No feedback loop for playbook optimization

### Impact
- Ineffective playbooks continue to be used
- Best practices are not identified or scaled
- Resources wasted on underperforming plays
- Inability to improve CS methodology

---

## 3. Solution Overview

### High-Level Approach
Build a playbook analytics system that tracks execution, measures outcomes, and provides insights for optimization of the CS playbook library.

### Key Features
1. **Execution Tracking** - Monitor playbook usage
2. **Outcome Measurement** - Success rates by playbook
3. **Step Analysis** - Effectiveness of individual steps
4. **Comparison** - Cross-playbook benchmarking
5. **CSM Performance** - Execution consistency
6. **Optimization** - Recommendations for improvement
7. **A/B Testing** - Compare playbook variants

---

## 4. User Stories

### Primary User Stories

```
As a CS Ops Lead,
I want to measure playbook effectiveness
So that I can optimize our playbook library
```

```
As a CSM Manager,
I want to see playbook execution consistency
So that I can ensure best practices are followed
```

```
As a VP of CS,
I want to understand which playbooks drive retention
So that I can invest in the right methodologies
```

---

## 5. Functional Requirements

### 5.1 Execution Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-168.1 | Track playbook initiations | P0 |
| FR-168.2 | Track step completion | P0 |
| FR-168.3 | Record completion time | P0 |
| FR-168.4 | Track abandonment | P0 |
| FR-168.5 | Record who executed | P0 |

### 5.2 Outcome Measurement

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-168.6 | Define success criteria per playbook | P0 |
| FR-168.7 | Calculate success rate | P0 |
| FR-168.8 | Track health score impact | P1 |
| FR-168.9 | Measure retention correlation | P0 |
| FR-168.10 | Calculate ROI per playbook | P2 |

### 5.3 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-168.11 | Compare playbooks head-to-head | P1 |
| FR-168.12 | Identify high-impact steps | P1 |
| FR-168.13 | Detect bottleneck steps | P1 |
| FR-168.14 | Benchmark CSM execution | P1 |
| FR-168.15 | Trend analysis over time | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface PlaybookExecution {
  id: string;
  playbook_id: string;
  playbook_name: string;
  customer_id: string;
  csm_id: string;

  // Timing
  started_at: string;
  completed_at?: string;
  duration_days?: number;

  // Status
  status: 'in_progress' | 'completed' | 'abandoned' | 'paused';
  abandonment_reason?: string;

  // Steps
  total_steps: number;
  completed_steps: number;
  step_completion: StepCompletion[];

  // Outcome
  outcome?: 'success' | 'partial' | 'failure';
  outcome_notes?: string;

  // Impact
  health_score_before?: number;
  health_score_after?: number;
  health_score_change?: number;
}

interface PlaybookMetrics {
  playbook_id: string;
  playbook_name: string;
  period: string;

  execution: {
    total_started: number;
    completed: number;
    abandoned: number;
    in_progress: number;
    completion_rate: number;
    avg_duration_days: number;
  };

  outcomes: {
    success: number;
    partial: number;
    failure: number;
    success_rate: number;
  };

  impact: {
    avg_health_improvement: number;
    retention_rate_for_executed: number;
    roi_estimate?: number;
  };

  step_analysis: {
    step_name: string;
    completion_rate: number;
    avg_duration: number;
    abandonment_rate: number;
  }[];
}
```

### 6.2 API Endpoints

```typescript
// Get playbook effectiveness report
GET /api/reports/playbook-effectiveness
Query: {
  playbook_id?: string;
  period?: string;
  csm_id?: string;
}

Response: {
  summary: PlaybookLibrarySummary;
  playbooks: PlaybookMetrics[];
  top_performers: PlaybookMetrics[];
  needs_improvement: PlaybookMetrics[];
  trends: PlaybookTrend[];
}

// Get individual playbook analysis
GET /api/reports/playbook-effectiveness/:playbookId
Response: {
  metrics: PlaybookMetrics;
  executions: PlaybookExecution[];
  step_funnel: StepFunnel;
  recommendations: string[];
}

// Compare playbooks
GET /api/reports/playbook-effectiveness/compare
Query: { playbook_ids: string[] }
```

---

## 7. User Interface

### 7.1 Playbook Library Dashboard

```
+----------------------------------------------------------+
|  Playbook Effectiveness Report           [This Quarter v] |
+----------------------------------------------------------+
|                                                           |
|  LIBRARY SUMMARY                                          |
|  +----------------+----------------+----------------+     |
|  | Active Plays   | Executions     | Avg Success    |     |
|  |      12        |     156        |     68%        |     |
|  | 3 save plays   | +24 vs last Q  | +5% vs last Q  |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  PLAYBOOK PERFORMANCE                                     |
|  +------------------------------------------------------+|
|  | Playbook          | Executions | Success | Avg Days  ||
|  |-------------------|------------|---------|-----------|
|  | Save Play - Health| 28         | 72%     | 21        ||
|  | Onboarding 30-day | 35         | 85%     | 30        ||
|  | QBR Preparation   | 24         | 92%     | 7         ||
|  | Champion Departure| 18         | 61%     | 14        ||
|  | Renewal Prep      | 22         | 78%     | 45        ||
|  | Expansion Motion  | 15         | 65%     | 28        ||
|  +------------------------------------------------------+|
|                                                           |
|  TOP PERFORMERS                                           |
|  +--------------------------------------------------+    |
|  | ★ QBR Preparation - 92% success, 7 day avg       |    |
|  | ★ Onboarding 30-day - 85% success, +18 health    |    |
|  +--------------------------------------------------+    |
|                                                           |
|  NEEDS IMPROVEMENT                                        |
|  +--------------------------------------------------+    |
|  | ! Champion Departure - 61% success, 39% abandon  |    |
|  |   Recommendation: Simplify steps 3-5             |    |
|  | ! Expansion Motion - 65% success, long duration  |    |
|  |   Recommendation: Add checkpoint at step 4       |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Individual Playbook View

```
+----------------------------------------------------------+
|  Playbook: Save Play - Health Score Drop                  |
+----------------------------------------------------------+
|                                                           |
|  PERFORMANCE SUMMARY                                      |
|  +--------------------------------------------------+    |
|  | Executions: 28 | Completed: 24 | Success: 72%     |    |
|  | Avg Duration: 21 days | Abandoned: 4 (14%)        |    |
|  +--------------------------------------------------+    |
|                                                           |
|  STEP FUNNEL                                              |
|  +--------------------------------------------------+    |
|  | Step 1: Assess Risk     | ██████████████████ 100% |   |
|  | Step 2: Stakeholder Call| ████████████████ 89%    |   |
|  | Step 3: Action Plan     | ██████████████ 82%      |   |
|  | Step 4: Weekly Check-ins| ████████████ 71%        |   |
|  | Step 5: Health Review   | ██████████ 68%          |   |
|  | Step 6: Close Play      | ████████ 61%            |   |
|  +--------------------------------------------------+    |
|  Bottleneck: Step 4 (Weekly Check-ins) - 11% drop        |
|                                                           |
|  OUTCOME BREAKDOWN                                        |
|  +--------------------------------------------------+    |
|  | Success (Health ≥60)  | ████████████████ | 72%    |    |
|  | Partial (Health 40-59)| ████ | 18%               |    |
|  | Failure (Churned/≤39) | ██ | 10%                 |    |
|  +--------------------------------------------------+    |
|                                                           |
|  HEALTH IMPACT                                            |
|  +--------------------------------------------------+    |
|  | Avg Health Before: 42                             |    |
|  | Avg Health After: 64                              |    |
|  | Avg Improvement: +22 points                       |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CSM EXECUTION COMPARISON                                 |
|  +------------------------------------------------------+|
|  | CSM         | Executions | Success | Avg Duration    ||
|  |-------------|------------|---------|-----------------|
|  | Sarah Chen  | 8          | 88%     | 18 days         ||
|  | Mike Johnson| 10         | 70%     | 24 days         ||
|  | Lisa Wang   | 10         | 60%     | 21 days         ||
|  +------------------------------------------------------+|
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Orchestrator | Execute and track playbooks |
| Monitor | Measure outcomes |
| Researcher | Analyze effectiveness |

### 8.2 Natural Language Queries

```
"Which playbooks are most effective?"
"What's the success rate for save plays?"
"Which playbook steps have high abandonment?"
"Compare CSM playbook execution"
"What's the health impact of onboarding playbook?"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] All playbook executions are tracked
- [ ] Step completion is recorded accurately
- [ ] Success rates calculate correctly
- [ ] Health impact is measured
- [ ] Abandonment is tracked with reasons

### 9.2 Analysis

- [ ] Step funnel shows accurate progression
- [ ] Bottlenecks are identified
- [ ] CSM comparisons are fair

---

## 10. Test Cases

### TC-168.1: Success Rate
```
Given: Playbook executed 28 times, 20 successful
When: Success rate is calculated
Then: Rate = 71%
And: Shows improvement vs baseline
```

### TC-168.2: Step Funnel
```
Given: 100 starts, 89 complete step 2, 71 complete step 4
When: Funnel is rendered
Then: Shows drop-off at each step
And: Identifies step 4 as bottleneck (18% drop)
```

### TC-168.3: Health Impact
```
Given: 20 executions with before/after health scores
When: Impact is calculated
Then: Shows average improvement
And: Compares to non-playbook accounts
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Avg playbook success | > 70% | Success rate across library |
| Completion rate | > 80% | Playbooks completed vs started |
| Health improvement | +15 pts | Avg health change post-playbook |
| CSM consistency | < 10% variance | Success rate variance by CSM |

---

## 12. Dependencies

- Playbook execution system
- Health score tracking (PRD-153)
- Step completion tracking
- Customer outcome data

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Success criteria, metrics model |
| Backend | 2 weeks | Tracking, calculations |
| Frontend | 1 week | Dashboard views |
| Testing | 1 week | Accuracy validation |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. How do we define "success" for each playbook type?
2. Should we track partial execution credit?
3. How long after completion do we measure outcomes?
4. Should we support playbook A/B testing?

---

## Appendix A: Playbook Success Criteria

| Playbook Type | Success Definition |
|---------------|-------------------|
| Save Play | Health ≥60 at completion |
| Onboarding | All milestones + health ≥70 |
| QBR Prep | QBR occurred with positive feedback |
| Renewal | Renewal closed |
| Expansion | Opportunity created or closed |
| Champion Departure | New champion engaged |
