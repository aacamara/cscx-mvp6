# PRD-159: Product Adoption Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-159 |
| Title | Product Adoption Report |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive product adoption report that tracks feature usage, adoption curves, and activation milestones across the customer portfolio. This enables CSMs to identify adoption gaps, drive feature enablement, and correlate adoption with customer success outcomes.

---

## 2. Problem Statement

### Current Pain Points
- No visibility into which features customers are/aren't using
- Cannot identify customers underutilizing the product
- Difficult to track adoption progress over time
- Missing insights on feature-value correlation
- No benchmarks for healthy adoption patterns

### Impact
- Customers miss value from unused features
- Higher churn risk from low adoption
- Inefficient training and enablement efforts
- Unable to demonstrate ROI to customers

---

## 3. Solution Overview

### High-Level Approach
Build an adoption analytics system that tracks feature usage, calculates adoption scores, identifies gaps, and provides recommendations for driving higher adoption.

### Key Features
1. **Feature Usage Tracking** - Monitor usage of all product features
2. **Adoption Score** - Composite metric of overall adoption
3. **Adoption Curves** - Track adoption progression over time
4. **Gap Analysis** - Identify underutilized features
5. **Benchmarking** - Compare adoption across cohorts
6. **Correlation Analysis** - Link adoption to outcomes
7. **Recommendations** - Suggest features to enable

---

## 4. User Stories

### Primary User Stories

```
As a CSM,
I want to see which features my customers are using
So that I can identify enablement opportunities
```

```
As a CSM Manager,
I want to compare adoption rates across customers
So that I can identify best practices and gaps
```

```
As a VP of CS,
I want to understand how adoption correlates with retention
So that I can prioritize adoption initiatives
```

---

## 5. Functional Requirements

### 5.1 Feature Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-159.1 | Track usage of all product features | P0 |
| FR-159.2 | Count unique users per feature | P0 |
| FR-159.3 | Track frequency of feature usage | P0 |
| FR-159.4 | Record first use date per feature | P1 |
| FR-159.5 | Track depth of feature usage | P2 |

### 5.2 Adoption Scoring

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-159.6 | Calculate overall adoption score | P0 |
| FR-159.7 | Weight features by importance | P1 |
| FR-159.8 | Score breadth and depth separately | P1 |
| FR-159.9 | Track adoption score trends | P0 |
| FR-159.10 | Categorize adoption level | P0 |

### 5.3 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-159.11 | Identify unused entitled features | P0 |
| FR-159.12 | Track time-to-adopt per feature | P1 |
| FR-159.13 | Compare adoption across segments | P1 |
| FR-159.14 | Correlate adoption with health/retention | P0 |
| FR-159.15 | Identify power users | P2 |

### 5.4 Recommendations

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-159.16 | Suggest features to enable | P1 |
| FR-159.17 | Provide training resources per feature | P2 |
| FR-159.18 | Identify quick-win features | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface FeatureDefinition {
  id: string;
  name: string;
  category: string;
  tier_required: string;
  importance_weight: number; // 1-10
  activation_threshold: number; // uses to consider "active"
}

interface FeatureUsage {
  customer_id: string;
  feature_id: string;
  period: string;

  usage: {
    unique_users: number;
    total_uses: number;
    avg_uses_per_user: number;
    last_used: string;
  };

  status: 'not_started' | 'exploring' | 'active' | 'power_user';
  first_used: string | null;
  days_to_adopt: number | null;
}

interface AdoptionMetrics {
  customer_id: string;
  period: string;

  scores: {
    overall_score: number; // 0-100
    breadth_score: number; // % features used
    depth_score: number; // avg usage intensity
    trend: 'improving' | 'stable' | 'declining';
    change: number;
  };

  features: {
    total_available: number;
    using: number;
    not_started: number;
    exploring: number;
    active: number;
  };

  highlights: {
    top_features: string[];
    unused_valuable: string[];
    recently_started: string[];
  };
}
```

### 6.2 Adoption Score Calculation

```typescript
function calculateAdoptionScore(
  features: FeatureUsage[],
  definitions: FeatureDefinition[]
): number {
  let totalWeight = 0;
  let earnedScore = 0;

  for (const feature of features) {
    const def = definitions.find(d => d.id === feature.feature_id);
    if (!def) continue;

    totalWeight += def.importance_weight;

    // Score based on status
    const statusScore = {
      'not_started': 0,
      'exploring': 0.3,
      'active': 0.7,
      'power_user': 1.0
    }[feature.status];

    earnedScore += def.importance_weight * statusScore;
  }

  return (earnedScore / totalWeight) * 100;
}
```

### 6.3 API Endpoints

```typescript
// Get adoption report for customer
GET /api/reports/product-adoption/:customerId
Query: { period?: string }

Response: {
  metrics: AdoptionMetrics;
  features: FeatureUsage[];
  trends: AdoptionTrend[];
  recommendations: FeatureRecommendation[];
}

// Get portfolio adoption overview
GET /api/reports/product-adoption
Query: { csm_id?: string; segment?: string }

Response: {
  summary: AdoptionSummary;
  customers: CustomerAdoptionSummary[];
  feature_adoption_rates: FeatureAdoptionRate[];
}

// Get adoption correlation
GET /api/reports/product-adoption/correlation
Query: { outcome: 'health' | 'retention' | 'expansion' }
```

---

## 7. User Interface

### 7.1 Portfolio Adoption View

```
+----------------------------------------------------------+
|  Product Adoption Report                 [This Month v]   |
+----------------------------------------------------------+
|                                                           |
|  PORTFOLIO ADOPTION                                       |
|  +----------------+----------------+----------------+     |
|  | Avg Score      | High Adopters  | Low Adopters   |     |
|  |    68/100      |      24        |       8        |     |
|  | +5 vs last mo  | 51% of portf.  | Need attention |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  ADOPTION DISTRIBUTION                                    |
|  +--------------------------------------------------+    |
|  | Power (80+)   | ████████████████████ | 12 (25%)   |    |
|  | Active (60-79)| ████████████████████ | 20 (43%)   |    |
|  | Exploring     | ███████ | 7 (15%)                 |    |
|  | Low (<40)     | ████ | 8 (17%)                    |    |
|  +--------------------------------------------------+    |
|                                                           |
|  TOP FEATURES BY ADOPTION                                 |
|  +--------------------------------------------------+    |
|  | Dashboard     | ████████████████████ | 95%        |    |
|  | Reports       | █████████████████ | 82%           |    |
|  | API Access    | ████████████ | 58%                |    |
|  | Automations   | █████████ | 45%                   |    |
|  | AI Assistant  | ██████ | 32%                      |    |
|  +--------------------------------------------------+    |
|                                                           |
|  LOW ADOPTERS NEEDING ATTENTION           [View All]      |
|  +--------------------------------------------------+    |
|  | DataFlow Inc  | Score: 32 | Using 4/15 features   |    |
|  | CloudNine     | Score: 38 | No API usage          |    |
|  | MegaCorp      | Score: 41 | Reports never used    |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Customer Adoption Detail

```
+----------------------------------------------------------+
|  Product Adoption: Acme Corp                              |
+----------------------------------------------------------+
|                                                           |
|  ADOPTION SCORE: 72/100 (Active)           Trend: ↑ +8   |
|                                                           |
|  SCORE BREAKDOWN                                          |
|  +--------------------------------------------------+    |
|  | Breadth (features used)  | ████████████████ | 78% |    |
|  | Depth (usage intensity)  | █████████████ | 65%    |    |
|  +--------------------------------------------------+    |
|                                                           |
|  FEATURE ADOPTION STATUS                                  |
|  +------------------------------------------------------+|
|  | Feature      | Status      | Users | Last Used       ||
|  |--------------|-------------|-------|-----------------|
|  | Dashboard    | Power User  | 45    | Today           ||
|  | Reports      | Active      | 28    | Yesterday       ||
|  | API Access   | Active      | 12    | 3 days ago      ||
|  | Automations  | Exploring   | 3     | 2 weeks ago     ||
|  | AI Assistant | Not Started | 0     | Never           ||
|  | Custom Fields| Not Started | 0     | Never           ||
|  +------------------------------------------------------+|
|                                                           |
|  ADOPTION RECOMMENDATIONS                                 |
|  +--------------------------------------------------+    |
|  | 1. AI Assistant - High value, not started         |    |
|  |    → Schedule demo with power users               |    |
|  | 2. Custom Fields - Easy win for their use case    |    |
|  |    → Share template examples                      |    |
|  | 3. Automations - Increase usage depth             |    |
|  |    → Offer workflow consultation                  |    |
|  +--------------------------------------------------+    |
|                                                           |
|  ADOPTION CURVE (12 Weeks)                                |
|  +--------------------------------------------------+    |
|  | 80|                           ___________         |    |
|  | 60|__________________________/                    |    |
|  | 40|                                               |    |
|  |   +------------------------------------------>   |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track usage data and adoption scores |
| Trainer | Provide enablement recommendations |
| Orchestrator | Generate adoption reports |

### 8.2 Natural Language Queries

```
"Show me adoption metrics for Acme Corp"
"Which customers aren't using the API?"
"What features should we enable for DataFlow?"
"Compare adoption across enterprise accounts"
"Which features have the lowest adoption?"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] All feature usage is tracked accurately
- [ ] Adoption scores calculate correctly
- [ ] Feature status categorization is accurate
- [ ] Recommendations are contextually relevant
- [ ] Trends show historical progression

### 9.2 Data Accuracy

- [ ] Usage data syncs from product analytics
- [ ] Feature definitions are complete
- [ ] Status thresholds are calibrated

---

## 10. Test Cases

### TC-159.1: Adoption Score
```
Given: Customer using 8/10 features with varying intensity
When: Adoption score is calculated
Then: Score reflects weighted usage across features
And: Breadth and depth scores are separate
```

### TC-159.2: Feature Status
```
Given: Feature used by 3 users, 5 total uses
When: Feature status is determined
Then: Status = "Exploring" (below activation threshold)
```

### TC-159.3: Gap Identification
```
Given: Customer entitled to 15 features, using 10
When: Adoption report is generated
Then: 5 unused features are identified
And: Recommendations include high-value gaps
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Portfolio avg score | > 65 | Average adoption score |
| Features per customer | > 70% | Avg % of features used |
| Low adopter conversion | 50% | Low adopters improved |
| Adoption-retention correlation | > 0.7 | Statistical correlation |

---

## 12. Dependencies

- Product usage data integration
- Feature definition catalog
- Usage metrics pipeline (PRD-006)
- PRD-064: Product Adoption Dashboard (real-time view)

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Feature catalog, scoring model |
| Backend | 2 weeks | Usage tracking, calculations |
| Frontend | 2 weeks | Dashboard views |
| Testing | 1 week | Data validation, UAT |
| **Total** | **6 weeks** | |

---

## 14. Open Questions

1. How do we handle customers with different feature entitlements?
2. Should we track adoption at user level or account level?
3. What defines "power user" for each feature?
4. How do we weight features for different customer segments?

---

## Appendix A: Feature Categories

| Category | Weight | Description |
|----------|--------|-------------|
| Core | 10 | Essential features all customers should use |
| Advanced | 7 | Features for mature users |
| Integration | 5 | API and integration features |
| Optional | 3 | Nice-to-have features |
