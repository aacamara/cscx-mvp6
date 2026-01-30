# PRD-074: Account Benchmarking

## Category
**Category C: Account Intelligence**

## Priority
**P2** - Advanced Features

## Overview
Enable CSMs to benchmark a customer account against peer accounts based on industry, size, segment, or custom cohorts. This comparative analysis helps identify where an account is underperforming relative to peers, surface best practices from top performers, and provide data-driven recommendations for improvement.

## User Story
As a CSM, I want to see how my customer compares to similar customers so that I can identify gaps, share relevant best practices, and set realistic improvement targets based on peer performance.

As a customer stakeholder, I want to understand how my organization compares to industry peers so that I can benchmark our performance and identify opportunities for improvement.

## Trigger
- Navigation: Customer Detail > Benchmark Tab
- Natural language: "How does [Account] compare to peers?"
- Variations: "Benchmark [Account]", "Peer comparison for [Account]", "Is [Account] performing well?"
- QBR Prep: Auto-generated benchmark slide

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to benchmark |
| Comparison Cohort | String | No | "industry", "segment", "size", "custom" |
| Metrics | String[] | No | Specific metrics to compare |
| Anonymize Peers | Boolean | No | Show/hide peer names (default: hide) |

## Benchmark Dimensions
### Performance Metrics
| Metric | Description | Comparison Type |
|--------|-------------|-----------------|
| Health Score | Overall health | Percentile |
| Adoption Score | Product usage | Percentile |
| Engagement Score | Interaction level | Percentile |
| NPS | Net Promoter Score | Percentile |
| CSAT | Satisfaction score | Percentile |

### Usage Metrics
| Metric | Description | Comparison Type |
|--------|-------------|-----------------|
| Feature Breadth | % features used | Percentile |
| DAU/MAU Ratio | Stickiness | Percentile |
| API Usage | Integration depth | Percentile |
| User Activation | % users active | Percentile |
| Time in Product | Session duration | Percentile |

### Outcome Metrics
| Metric | Description | Comparison Type |
|--------|-------------|-----------------|
| Renewal Rate | Historical renewals | Percentage |
| Expansion Rate | Growth from base | Percentage |
| Time to Value | Days to first value | Comparison |
| ROI Achieved | Value delivered | Percentile |

## Benchmark Data Model
```typescript
interface BenchmarkAnalysis {
  customerId: string;
  cohort: CohortDefinition;
  cohortSize: number;

  metrics: BenchmarkMetric[];
  overallPercentile: number;
  strengths: string[];
  improvements: string[];
  recommendations: Recommendation[];
}

interface BenchmarkMetric {
  name: string;
  category: string;
  customerValue: number;
  cohortMedian: number;
  cohortP25: number;
  cohortP75: number;
  cohortP90: number;
  customerPercentile: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface CohortDefinition {
  type: 'industry' | 'segment' | 'size' | 'custom';
  criteria: Record<string, any>;
  matchingAccounts: number;
}
```

## Output Format
```markdown
## Account Benchmarking: Acme Corp
Cohort: Enterprise SaaS Companies (N=127)
Generated: [Timestamp]

### Overall Position: 72nd Percentile (Above Average)
[Bell curve visualization with Acme marked]

### Benchmark Summary
| Dimension | Acme Corp | Cohort Median | Percentile | Status |
|-----------|-----------|---------------|------------|--------|
| Health Score | 72 | 68 | 65th | ● Good |
| Adoption | 68 | 72 | 42nd | ⚠ Below |
| Engagement | 78 | 70 | 75th | ● Good |
| Usage Depth | 55 | 60 | 38th | ⚠ Below |
| ROI Achieved | 184% | 145% | 80th | ✓ Excellent |

---

### Detailed Comparisons

#### Health & Engagement (Above Cohort)

| Metric | Acme | P25 | Median | P75 | P90 | Rank |
|--------|------|-----|--------|-----|-----|------|
| Health Score | 72 | 55 | 68 | 78 | 88 | 65th |
| Engagement Score | 78 | 58 | 70 | 82 | 90 | 75th |
| NPS | 45 | 20 | 35 | 50 | 65 | 70th |
| CSAT | 4.2 | 3.5 | 3.9 | 4.3 | 4.7 | 68th |

[Box plot visualization]

**Strengths**:
- Engagement above 75% of peers
- NPS in top third of cohort
- Strong customer satisfaction

---

#### Product Adoption (Below Cohort)

| Metric | Acme | P25 | Median | P75 | P90 | Rank |
|--------|------|-----|--------|-----|-----|------|
| Feature Breadth | 45% | 40% | 55% | 70% | 85% | 38th |
| DAU/MAU Ratio | 0.35 | 0.30 | 0.45 | 0.55 | 0.65 | 35th |
| User Activation | 73% | 65% | 80% | 90% | 95% | 32nd |
| API Integration | 3 | 2 | 5 | 8 | 12 | 40th |

[Box plot visualization]

**Improvement Areas**:
- Feature breadth below median (45% vs 55%)
- Stickiness below peers (0.35 vs 0.45 DAU/MAU)
- User activation lagging (73% vs 80%)

**What Top Performers Do Differently**:
1. 90th percentile accounts complete structured onboarding
2. Top adopters use 3+ integrations (Acme has 3 - good start)
3. High activation correlates with dedicated training

---

### Peer Distribution Charts

#### Health Score Distribution
[Histogram showing distribution with Acme marked]

```
Count
  │    ████
  │   █████
  │  ███████   [Acme: 72]
  │ █████████     │
  │████████████   ▼
  └──────────────────────
    30  50  70  90  100
         Health Score
```

#### Feature Adoption by Cohort
[Scatter plot: Feature breadth vs Health Score]

Acme Position: Lower feature adoption but good health
Implication: Health could improve further with more adoption

---

### Cohort Insights

#### Top Performer Profile (P90)
| Characteristic | P90 Value | Acme Value | Gap |
|----------------|-----------|------------|-----|
| Feature Breadth | 85% | 45% | -40 pp |
| Stakeholders | 12 | 4 | -8 |
| Meeting Frequency | Weekly | Monthly | -3x |
| Training Hours | 15/year | 5/year | -10 hrs |
| Support Tickets | 0.5/mo | 1.2/mo | +0.7 |

#### What Differentiates P90 Accounts
1. **Multi-threaded relationships**: Avg 12 stakeholders vs Acme's 4
2. **Proactive engagement**: Weekly touchpoints vs monthly
3. **Investment in training**: 3x more training utilization
4. **Lower support burden**: Issues resolved proactively

---

### Industry-Specific Insights

**SaaS Industry Benchmarks** (Acme's industry):

| Metric | Industry Avg | Acme | Position |
|--------|--------------|------|----------|
| Logo Retention | 92% | 95% | Above |
| Net Revenue Retention | 108% | 112% | Above |
| Time to First Value | 21 days | 18 days | Better |
| Support Ticket Rate | 1.0/mo | 1.2/mo | Slightly higher |

---

### Improvement Recommendations

Based on peer analysis, prioritized improvements:

#### 1. Feature Adoption (High Impact)
**Current**: 45% | **Target**: 60% (Median) | **Stretch**: 70% (P75)

**Actions**:
- Schedule feature discovery workshop
- Share feature adoption playbook from P90 accounts
- Set monthly feature adoption goals

**Expected Impact**: +8 health score points based on peer correlation

#### 2. Stakeholder Depth (Medium Impact)
**Current**: 4 contacts | **Target**: 8 (Median) | **Stretch**: 12 (P90)

**Actions**:
- Identify 4 additional stakeholders
- Propose departmental expansion
- Multi-thread across Finance, Marketing

**Expected Impact**: +5 health score points, reduced churn risk

#### 3. Training Utilization (Medium Impact)
**Current**: 5 hrs/year | **Target**: 10 hrs | **Stretch**: 15 hrs

**Actions**:
- Schedule quarterly training sessions
- Offer self-service training resources
- Track certification completion

---

### Benchmark for QBR

**Customer-Shareable Slide**:

[Anonymized comparison graphic]

"Acme Corp vs Industry Peers"
- ROI Achievement: Top 20%
- Engagement: Top 25%
- Feature Adoption: Opportunity to improve
- Recommendation: Focus on feature discovery to unlock more value

[Generate QBR Slide] [Export Benchmark Report]

---

### Custom Cohort Builder

Create custom comparison cohort:
- [ ] Same Industry: SaaS
- [x] Similar Size: $100K-$200K ARR
- [x] Same Segment: Enterprise
- [ ] Same Region: North America
- [ ] Similar Contract Age: 1-2 years

Matching Accounts: 42
[Apply Custom Cohort]

---

### Quick Actions
[Export Report] [Generate QBR Slide] [Share with Customer] [Set Improvement Goals]
```

## Acceptance Criteria
- [ ] Percentile ranking calculated correctly
- [ ] Multiple cohort options available
- [ ] Peer distribution visualized
- [ ] Top performer characteristics identified
- [ ] Improvement recommendations generated
- [ ] Customer-shareable export available
- [ ] Custom cohort builder functional
- [ ] Anonymization works correctly
- [ ] Trend data included
- [ ] QBR slide generation works

## API Endpoint
```
GET /api/intelligence/benchmark/:customerId
  Query: ?cohort=industry&metrics=all

POST /api/intelligence/benchmark/:customerId/custom-cohort
  Body: {
    "criteria": {
      "industry": "SaaS",
      "arrMin": 100000,
      "arrMax": 200000,
      "segment": "enterprise"
    }
  }
```

## Data Sources
| Source | Table | Data |
|--------|-------|------|
| Customers | `customers` | Base data, segmentation |
| Health | `health_score_history` | Health metrics |
| Usage | `usage_metrics` | Usage patterns |
| Stakeholders | `stakeholders` | Relationship depth |
| Outcomes | `renewal_pipeline` | Outcome metrics |
| Industry | External/config | Industry benchmarks |

## Privacy & Anonymization
- Default: All peer data anonymized
- Option: Show anonymized top performers for inspiration
- Never: Share specific customer data without permission
- Aggregate: Minimum cohort size of 10 for anonymity

## Success Metrics
| Metric | Target |
|--------|--------|
| Benchmark Views/Month | > 2 per account |
| Improvement Goal Setting | > 50% after benchmark |
| Metric Improvement (actioned) | > 20% improvement |
| QBR Benchmark Inclusion | > 70% of QBRs |

## Future Enhancements
- Real-time benchmark updates
- Predictive benchmarking (where will they be in 6 months)
- Industry-specific benchmark packs
- Competitive benchmark integration
- Benchmark-driven automated playbooks

## Related PRDs
- PRD-058: Account Comparison Tool
- PRD-074: Account Benchmarking
- PRD-171: Benchmark Report
- PRD-169: Customer Cohort Analysis
