# PRD-172: Activity Feed Analysis

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-172 |
| Title | Activity Feed Analysis |
| Category | F - Reporting & Analytics |
| Priority | P2 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create an activity feed analysis report that tracks and analyzes all customer-related activities, providing insights into activity patterns, coverage, and effectiveness.

---

## 2. Problem Statement

- No unified view of all customer activities
- Cannot analyze activity patterns
- Missing insights on activity effectiveness
- Difficult to ensure comprehensive coverage

---

## 3. Solution Overview

Build an activity tracking and analysis system that aggregates all customer touchpoints and provides pattern analysis.

### Key Features
1. **Activity Aggregation** - All activities in one feed
2. **Pattern Analysis** - Activity frequency and timing
3. **Coverage Metrics** - Ensure all customers touched
4. **Effectiveness Correlation** - Link activities to outcomes
5. **CSM Productivity** - Activity metrics by team member

---

## 4. Functional Requirements

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-172.1 | Aggregate all activity types | P0 |
| FR-172.2 | Track activity by customer | P0 |
| FR-172.3 | Track activity by CSM | P0 |
| FR-172.4 | Analyze activity patterns | P1 |
| FR-172.5 | Correlate with outcomes | P1 |
| FR-172.6 | Identify activity gaps | P0 |

---

## 5. Technical Requirements

```typescript
interface Activity {
  id: string;
  type: 'email' | 'meeting' | 'call' | 'note' | 'task' | 'document';
  customer_id: string;
  csm_id: string;
  timestamp: string;
  description: string;
  outcome?: string;
}

interface ActivityMetrics {
  period: string;
  total_activities: number;
  by_type: Record<string, number>;
  by_csm: Record<string, number>;
  avg_per_customer: number;
  customers_without_activity: number;
}
```

---

## 6. User Interface

```
+----------------------------------------------------------+
|  Activity Feed Analysis                  [This Week v]    |
+----------------------------------------------------------+
|                                                           |
|  ACTIVITY SUMMARY                                         |
|  +----------------+----------------+----------------+     |
|  | Total          | By Customer    | Gaps           |     |
|  |    248         |   4.8 avg      |    5           |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  BY ACTIVITY TYPE                                         |
|  +--------------------------------------------------+    |
|  | Emails   | ████████████████████ | 98            |    |
|  | Meetings | ████████████ | 62                     |    |
|  | Calls    | ██████ | 35                           |    |
|  | Notes    | ████████ | 43                         |    |
|  | Tasks    | ██ | 10                               |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CUSTOMERS WITHOUT RECENT ACTIVITY                        |
|  +--------------------------------------------------+    |
|  | DataFlow (12 days) | CloudNine (8 days)          |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 7. Acceptance Criteria

- [ ] All activity types are captured
- [ ] Gap detection identifies inactive customers
- [ ] CSM productivity metrics are accurate
- [ ] Patterns are identified correctly

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Coverage | 100% | Customers with recent activity |
| Gap detection | < 24 hrs | Time to identify gaps |

---

## 9. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Backend | 2 weeks | Activity tracking |
| Frontend | 1 week | Feed and analysis views |
| Testing | 1 week | Integration |
| **Total** | **4 weeks** | |

---

## 10. Open Questions

1. What activity types should we track?
2. What defines "no recent activity"?
3. Should activities have quality scores?
