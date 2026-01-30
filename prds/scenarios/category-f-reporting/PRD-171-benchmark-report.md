# PRD-171: Benchmark Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-171 |
| Title | Benchmark Report |
| Category | F - Reporting & Analytics |
| Priority | P2 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a benchmark report that compares customer metrics against internal and external standards. This enables identification of best performers, underperformers, and optimization opportunities based on peer comparison.

---

## 2. Problem Statement

### Current Pain Points
- No context for whether metrics are "good" or "bad"
- Cannot compare performance to industry standards
- Missing internal best-in-class benchmarks
- Difficult to set realistic targets
- No peer comparison for customers

### Impact
- Unclear performance standards
- Suboptimal target setting
- Missed improvement opportunities
- Lack of motivation from comparison

---

## 3. Solution Overview

Build a benchmarking system that establishes internal standards, incorporates external data where available, and provides comparative analysis.

### Key Features
1. **Internal Benchmarks** - Best/worst/average from portfolio
2. **Segment Benchmarks** - Compare within peer groups
3. **Customer Comparison** - Individual vs. benchmark
4. **Target Setting** - Data-driven goal recommendations
5. **Percentile Ranking** - Position within distribution
6. **External Data** - Industry benchmarks (where available)

---

## 4. Functional Requirements

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-171.1 | Calculate internal benchmarks by metric | P0 |
| FR-171.2 | Segment-specific benchmarks | P0 |
| FR-171.3 | Customer percentile ranking | P0 |
| FR-171.4 | Best-in-class identification | P1 |
| FR-171.5 | Gap analysis vs. benchmark | P0 |
| FR-171.6 | External benchmark integration | P2 |

---

## 5. Technical Requirements

```typescript
interface Benchmark {
  metric: string;
  segment?: string;

  values: {
    min: number;
    p25: number;
    median: number;
    p75: number;
    max: number;
    mean: number;
  };

  top_performers: string[]; // customer_ids
  bottom_performers: string[];
}

interface CustomerBenchmark {
  customer_id: string;
  metric: string;
  value: number;
  percentile: number;
  gap_to_median: number;
  gap_to_top: number;
  recommendation: string;
}
```

---

## 6. User Interface

```
+----------------------------------------------------------+
|  Benchmark Report                                         |
+----------------------------------------------------------+
|                                                           |
|  HEALTH SCORE BENCHMARK                                   |
|  +--------------------------------------------------+    |
|  | Min  | 25th | Median | 75th | Max  | Portfolio   |    |
|  |  32  |  58  |   72   |  82  |  95  |    74       |    |
|  +--------------------------------------------------+    |
|                                                           |
|  PORTFOLIO DISTRIBUTION                                   |
|  +--------------------------------------------------+    |
|  |     ████                                          |    |
|  |   ████████                                        |    |
|  | ████████████████                                  |    |
|  |   ████████████████████                            |    |
|  |     ████████████                                  |    |
|  +--------------------------------------------------+    |
|   30   40   50   60   70   80   90   100                  |
|                                                           |
|  TOP PERFORMERS                                           |
|  +--------------------------------------------------+    |
|  | 1. TechStart (95) | 2. CloudNine (92) | 3. Acme(90)|   |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 7. Acceptance Criteria

- [ ] Benchmarks calculate accurately from portfolio data
- [ ] Percentiles assign correctly
- [ ] Segment comparisons are apples-to-apples
- [ ] Gap analysis provides actionable insights

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Target achievement | +15% | Customers meeting benchmarks |
| Report usage | 70% | Managers using for goal setting |

---

## 9. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design & Backend | 2 weeks | Calculations |
| Frontend | 1 week | Visualizations |
| Testing | 1 week | Validation |
| **Total** | **4 weeks** | |

---

## 10. Open Questions

1. Should external benchmarks come from industry reports?
2. How do we handle small segment sizes?
3. How often should benchmarks recalculate?
