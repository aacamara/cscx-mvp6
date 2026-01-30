# PRD-175: Customer Segmentation Analysis

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-175 |
| Title | Customer Segmentation Analysis |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a customer segmentation analysis report that enables dynamic segmentation based on multiple attributes, analyzes segment characteristics, and provides insights for tailored engagement strategies.

---

## 2. Problem Statement

### Current Pain Points
- Static segmentation doesn't reflect customer behavior
- Cannot segment by multiple dynamic attributes
- Missing insights on segment-specific needs
- One-size-fits-all approach to customer engagement
- No data-driven segmentation optimization

### Impact
- Ineffective engagement strategies
- Missed personalization opportunities
- Suboptimal resource allocation
- Lower customer satisfaction

---

## 3. Solution Overview

Build a dynamic segmentation system that groups customers by multiple dimensions, analyzes segment characteristics, and provides actionable insights.

### Key Features
1. **Multi-Dimensional Segmentation** - Combine multiple attributes
2. **Dynamic Segments** - Auto-update based on behavior
3. **Segment Profiles** - Detailed segment characteristics
4. **Performance Analysis** - Compare segments
5. **Recommendations** - Segment-specific strategies
6. **Custom Segments** - User-defined groupings

---

## 4. User Stories

```
As a CS Ops Lead,
I want to segment customers by multiple attributes
So that I can design targeted engagement models
```

```
As a VP of CS,
I want to understand segment performance differences
So that I can allocate resources appropriately
```

```
As a CSM Manager,
I want to identify segment-specific needs
So that I can tailor playbooks for each segment
```

---

## 5. Functional Requirements

### 5.1 Segmentation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-175.1 | Segment by ARR tier | P0 |
| FR-175.2 | Segment by industry | P0 |
| FR-175.3 | Segment by company size | P1 |
| FR-175.4 | Segment by tenure | P1 |
| FR-175.5 | Segment by behavior/engagement | P1 |
| FR-175.6 | Custom segment definitions | P2 |

### 5.2 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-175.7 | Generate segment profiles | P0 |
| FR-175.8 | Compare KPIs across segments | P0 |
| FR-175.9 | Identify segment-specific patterns | P1 |
| FR-175.10 | Track segment movement | P1 |
| FR-175.11 | Recommend segment strategies | P2 |

---

## 6. Technical Requirements

```typescript
interface Segment {
  id: string;
  name: string;
  criteria: SegmentCriteria[];
  customer_count: number;
  total_arr: number;
  is_dynamic: boolean;
}

interface SegmentCriteria {
  attribute: string;
  operator: 'equals' | 'greater' | 'less' | 'between' | 'in';
  value: any;
}

interface SegmentProfile {
  segment: Segment;

  demographics: {
    avg_arr: number;
    avg_company_size: number;
    top_industries: string[];
    avg_tenure_months: number;
  };

  performance: {
    avg_health_score: number;
    avg_adoption_score: number;
    nrr: number;
    churn_rate: number;
  };

  engagement: {
    avg_meetings_per_quarter: number;
    avg_email_response_rate: number;
    support_ticket_rate: number;
  };

  recommendations: string[];
}
```

---

## 7. User Interface

```
+----------------------------------------------------------+
|  Customer Segmentation Analysis                           |
+----------------------------------------------------------+
|                                                           |
|  SEGMENT OVERVIEW                                         |
|  +------------------------------------------------------+|
|  | Segment     | Count | ARR    | Health | NRR   | Risk  ||
|  |-------------|-------|--------|--------|-------|-------|
|  | Enterprise  | 45    | $5.2M  | 78     | 115%  | 4%    ||
|  | Mid-Market  | 68    | $3.8M  | 72     | 106%  | 8%    ||
|  | SMB         | 120   | $2.4M  | 65     | 95%   | 15%   ||
|  | High-Growth | 32    | $1.8M  | 82     | 125%  | 3%    ||
|  +------------------------------------------------------+|
|                                                           |
|  SEGMENT: ENTERPRISE                                      |
|  +--------------------------------------------------+    |
|  | Profile:                                          |    |
|  | - Avg ARR: $116K | Avg Size: 2,500 employees     |    |
|  | - Top Industries: Tech (40%), Finance (25%)       |    |
|  | - Avg Tenure: 28 months                           |    |
|  |                                                   |    |
|  | Characteristics:                                  |    |
|  | - Highest retention, longest sales cycles         |    |
|  | - Require executive engagement                    |    |
|  | - Value strategic QBRs                            |    |
|  |                                                   |    |
|  | Recommended Strategy:                             |    |
|  | - Quarterly exec touchpoints                      |    |
|  | - Dedicated technical resources                   |    |
|  | - Strategic account planning                      |    |
|  +--------------------------------------------------+    |
|                                                           |
|  SEGMENT MOVEMENT (Last Quarter)                          |
|  +--------------------------------------------------+    |
|  | 5 customers upgraded SMB → Mid-Market             |    |
|  | 3 customers upgraded Mid-Market → Enterprise      |    |
|  | 2 customers downgraded Mid-Market → SMB           |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Acceptance Criteria

- [ ] Segments can be defined by multiple criteria
- [ ] Dynamic segments auto-update membership
- [ ] Segment profiles generate accurately
- [ ] Segment comparisons are meaningful
- [ ] Movement between segments is tracked

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Segment coverage | 100% | Customers assigned to segments |
| Segment strategy adoption | 80% | Playbooks tailored by segment |
| Performance improvement | +10% | Metrics improvement from targeting |

---

## 10. Dependencies

- Customer data completeness
- PRD-169: Customer Cohort Analysis
- PRD-153: Health Score Portfolio View

---

## 11. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Segmentation model |
| Backend | 2 weeks | Segmentation engine |
| Frontend | 1 week | Analysis views |
| Testing | 1 week | Validation |
| **Total** | **5 weeks** | |

---

## 12. Open Questions

1. How do we handle customers fitting multiple segments?
2. Should segments have hierarchies?
3. How do we validate segment effectiveness?
4. Who can create custom segments?
