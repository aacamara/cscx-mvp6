# PRD-173: Customer Lifetime Value Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-173 |
| Title | Customer Lifetime Value Report |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a Customer Lifetime Value (CLV/LTV) report that calculates and tracks the predicted total value of each customer over their lifetime. This enables prioritization of CS investments based on customer value potential.

---

## 2. Problem Statement

### Current Pain Points
- No systematic calculation of customer lifetime value
- Cannot prioritize customers by value potential
- Missing insights on CLV drivers
- Difficult to justify CS investments
- No way to track CLV improvements

### Impact
- Suboptimal resource allocation
- Equal treatment of high and low-value customers
- Unable to calculate CS ROI
- Missed high-potential customers

---

## 3. Solution Overview

Build a CLV calculation engine that estimates customer value, identifies drivers, and provides actionable insights for value maximization.

### Key Features
1. **CLV Calculation** - Predict lifetime value
2. **Value Drivers** - Identify factors affecting CLV
3. **Segmentation** - Group by value tier
4. **Trend Tracking** - Monitor CLV changes
5. **Cohort Analysis** - CLV by customer cohort
6. **Recommendations** - Actions to increase CLV

---

## 4. User Stories

```
As a VP of CS,
I want to understand customer lifetime value distribution
So that I can allocate resources appropriately
```

```
As a CSM Manager,
I want to identify high-CLV customers
So that I can ensure they receive appropriate attention
```

```
As a Finance Leader,
I want CLV data for revenue modeling
So that I can build accurate forecasts
```

---

## 5. Functional Requirements

### 5.1 CLV Calculation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-173.1 | Calculate historical CLV | P0 |
| FR-173.2 | Calculate predictive CLV | P0 |
| FR-173.3 | Factor in churn probability | P0 |
| FR-173.4 | Factor in expansion potential | P1 |
| FR-173.5 | Account for gross margin | P1 |

### 5.2 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-173.6 | Segment customers by CLV tier | P0 |
| FR-173.7 | Identify CLV drivers | P1 |
| FR-173.8 | Track CLV trends | P1 |
| FR-173.9 | Compare CLV to acquisition cost | P1 |
| FR-173.10 | Benchmark against averages | P1 |

---

## 6. Technical Requirements

### 6.1 CLV Calculation Model

```typescript
interface CLVComponents {
  current_arr: number;
  estimated_lifetime_months: number;
  expansion_rate: number;
  gross_margin: number;
  discount_rate: number;
}

interface CustomerCLV {
  customer_id: string;

  historical: {
    total_revenue: number;
    months_as_customer: number;
  };

  current: {
    arr: number;
    monthly_revenue: number;
  };

  predicted: {
    remaining_lifetime_months: number;
    churn_probability: number;
    expansion_probability: number;
    predicted_clv: number;
    clv_range: { low: number; high: number };
  };

  total_clv: number;
  clv_tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  clv_percentile: number;
}

// CLV Formula (simplified):
// CLV = (Monthly Revenue × Gross Margin × Avg Lifetime Months) × (1 + Expansion Rate)
function calculateCLV(components: CLVComponents): number {
  const monthlyValue = components.current_arr / 12 * components.gross_margin;
  const lifetime = components.estimated_lifetime_months;
  const expansion = 1 + components.expansion_rate;
  const discount = 1 / (1 + components.discount_rate);

  return monthlyValue * lifetime * expansion * discount;
}
```

### 6.2 API Endpoints

```typescript
// Get CLV report
GET /api/reports/clv
Query: {
  segment?: string;
  tier?: string;
  min_clv?: number;
}

Response: {
  summary: CLVSummary;
  customers: CustomerCLV[];
  distribution: CLVDistribution;
  trends: CLVTrend[];
}

// Get customer CLV detail
GET /api/reports/clv/:customerId
Response: {
  clv: CustomerCLV;
  drivers: CLVDriver[];
  history: CLVHistory[];
  recommendations: string[];
}
```

---

## 7. User Interface

```
+----------------------------------------------------------+
|  Customer Lifetime Value Report                           |
+----------------------------------------------------------+
|                                                           |
|  CLV SUMMARY                                              |
|  +----------------+----------------+----------------+     |
|  | Total CLV      | Avg CLV        | CLV/CAC Ratio  |     |
|  |   $48.2M       |    $182K       |      5.2x      |     |
|  | 265 customers  | +12% vs last yr|                |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  CLV DISTRIBUTION                                         |
|  +--------------------------------------------------+    |
|  | Platinum (>$500K) | ████ | 12 customers | $8.2M  |    |
|  | Gold ($200-500K)  | ████████ | 35 cust | $12.1M  |    |
|  | Silver ($50-200K) | ████████████████ | 128 | $18.4M|   |
|  | Bronze (<$50K)    | ████████████ | 90 | $9.5M    |    |
|  +--------------------------------------------------+    |
|                                                           |
|  TOP CLV CUSTOMERS                                        |
|  +------------------------------------------------------+|
|  | Customer   | Current ARR | Predicted CLV | Tier      ||
|  |------------|-------------|---------------|-----------|
|  | MegaCorp   | $340K       | $1.2M         | Platinum  ||
|  | Acme Inc   | $120K       | $680K         | Platinum  ||
|  | TechStart  | $85K        | $420K         | Gold      ||
|  +------------------------------------------------------+|
|                                                           |
|  CLV DRIVERS                                              |
|  +--------------------------------------------------+    |
|  | 1. Tenure (+$45K per year)                        |    |
|  | 2. Product adoption (+$30K per feature)           |    |
|  | 3. Executive sponsor engagement (+$25K)           |    |
|  | 4. QBR completion (+$15K)                         |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Natural Language Queries

```
"What's the lifetime value of Acme Corp?"
"Show me our highest CLV customers"
"What drives customer lifetime value?"
"Compare CLV by segment"
"Which customers have increasing CLV?"
```

---

## 9. Acceptance Criteria

- [ ] CLV calculates correctly with all components
- [ ] Predictions factor in churn probability
- [ ] Tier assignments are accurate
- [ ] Drivers are identified with impact values
- [ ] Trends track CLV changes over time

---

## 10. Test Cases

### TC-173.1: CLV Calculation
```
Given: ARR $100K, lifetime 36 months, 70% margin, 20% expansion
When: CLV is calculated
Then: CLV ≈ $252K (with appropriate adjustments)
```

### TC-173.2: Tier Assignment
```
Given: Customer with CLV $650K
When: Tier is assigned
Then: Customer in Platinum tier (>$500K)
And: Percentile calculated correctly
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| CLV accuracy | > 80% | Predicted vs actual |
| CLV growth | +10% YoY | Portfolio average CLV |
| CLV/CAC ratio | > 3x | Value vs acquisition cost |

---

## 12. Dependencies

- Customer revenue history
- Churn prediction model (PRD-216)
- Expansion prediction (PRD-238)
- PRD-158: Revenue Analytics Report

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | CLV model, formulas |
| Backend | 2 weeks | Calculations, predictions |
| Frontend | 1 week | Dashboard views |
| Testing | 1 week | Model validation |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. What discount rate should we use?
2. How do we estimate remaining lifetime?
3. Should CLV include services revenue?
4. How often should CLV recalculate?
