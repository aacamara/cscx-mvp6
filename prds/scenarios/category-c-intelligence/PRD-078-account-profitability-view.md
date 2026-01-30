# PRD-078: Account Profitability View

## Category
**Category C: Account Intelligence**

## Priority
**P2** - Advanced Features

## Overview
Provide visibility into the profitability of each customer account by analyzing revenue, cost-to-serve, resource allocation, and margin contribution. This financial intelligence helps CS leaders make informed decisions about resource allocation, pricing strategies, and account segmentation.

## User Story
As a CS Leader, I want to understand the profitability of each account so that I can allocate resources appropriately, justify investments in high-value accounts, and identify accounts that need efficiency improvements.

As a Finance Partner, I want to see customer-level profitability so that I can support pricing decisions and understand the impact of CS activities on margins.

## Trigger
- Navigation: Customer Detail > Financials Tab (Manager+ access)
- Natural language: "What's the profitability of [Account]?"
- Variations: "Cost to serve [Account]", "Account margin", "Revenue vs cost"
- Reports: Portfolio profitability report

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Time Period | String | No | "qtd", "ytd", "12m", "contract" |
| Include Projections | Boolean | No | Show future projections |

## Profitability Components
### Revenue Components
| Component | Description | Data Source |
|-----------|-------------|-------------|
| Subscription Revenue | Recurring subscription fees | Billing system |
| Expansion Revenue | Upsells, cross-sells | Billing system |
| Services Revenue | Implementation, training | Billing system |
| Support Revenue | Paid support tiers | Billing system |

### Cost Components
| Component | Description | Calculation Method |
|-----------|-------------|-------------------|
| CSM Time | CSM hours allocated | Time tracking or estimate |
| Support Cost | Tickets, resolution | Ticket count * avg cost |
| Infrastructure | Compute, storage | Usage-based allocation |
| Onboarding | Implementation cost | One-time, amortized |
| Training | Training delivery | Sessions * cost |
| Sales Cost | AE involvement | Time allocation |

## Profitability Model
```typescript
interface AccountProfitability {
  customerId: string;
  period: DateRange;

  // Revenue
  revenue: {
    total: number;
    subscription: number;
    expansion: number;
    services: number;
    support: number;
  };

  // Costs
  costs: {
    total: number;
    csm: CSMCost;
    support: SupportCost;
    infrastructure: InfraCost;
    onboarding: number;
    training: number;
    sales: number;
    other: number;
  };

  // Profitability
  grossMargin: number;
  grossMarginPercent: number;
  contributionMargin: number;
  contributionMarginPercent: number;

  // Benchmarks
  vsSegmentAvg: number;
  profitabilityTier: 'high' | 'medium' | 'low' | 'negative';

  // Projections
  ltv: number;
  projectedMargin12m: number;
}

interface CSMCost {
  hours: number;
  hourlyRate: number;
  total: number;
  activities: ActivityCost[];
}
```

## Output Format
```markdown
## Account Profitability: Acme Corp
Period: Last 12 Months | Updated: [Timestamp]

### Profitability Summary
| Metric | Value | vs Segment Avg |
|--------|-------|----------------|
| Gross Revenue | $150,000 | |
| Total Cost to Serve | $42,500 | |
| **Gross Margin** | **$107,500** | ▲ Above avg |
| **Margin %** | **71.7%** | +8% vs avg |

**Profitability Tier**: High
[Gauge: Green zone at 71.7%]

---

### Revenue Breakdown

| Category | Amount | % of Total | Trend |
|----------|--------|------------|-------|
| Subscription | $135,000 | 90% | ● Stable |
| Expansion | $12,000 | 8% | ▲ +50% YoY |
| Services | $3,000 | 2% | ● Stable |
| **Total** | **$150,000** | 100% | |

[Pie chart visualization]

---

### Cost to Serve Breakdown

| Category | Amount | % of Revenue | Details |
|----------|--------|--------------|---------|
| CSM Time | $18,000 | 12% | 300 hrs @ $60/hr |
| Support | $8,500 | 5.7% | 12 tickets, 2 escalations |
| Infrastructure | $6,000 | 4% | High API usage |
| Sales (AE) | $4,000 | 2.7% | Expansion support |
| Training | $2,000 | 1.3% | 2 sessions |
| Onboarding (amort) | $4,000 | 2.7% | Year 1 of 3 |
| **Total** | **$42,500** | **28.3%** | |

[Waterfall chart: Revenue to Margin]

---

### CSM Time Allocation (300 hours)

| Activity | Hours | % | Cost |
|----------|-------|---|------|
| Meetings | 48 | 16% | $2,880 |
| Email/Communication | 60 | 20% | $3,600 |
| QBRs | 24 | 8% | $1,440 |
| Support Coordination | 36 | 12% | $2,160 |
| Strategy/Planning | 48 | 16% | $2,880 |
| Admin/Reporting | 24 | 8% | $1,440 |
| Training Prep | 30 | 10% | $1,800 |
| Escalation Handling | 30 | 10% | $1,800 |

**Efficiency Note**: 36 hours on support coordination - higher than average.
Consider: More proactive engagement to reduce reactive support.

---

### Support Cost Details

| Metric | Value | Benchmark | Status |
|--------|-------|-----------|--------|
| Tickets Submitted | 12 | 8 (avg) | ⚠ Above |
| Escalations | 2 | 0.5 (avg) | ⚠ Above |
| Avg Resolution Time | 18 hrs | 12 hrs (avg) | ● OK |
| Cost per Ticket | $708 | $650 (avg) | ● Close |

**Total Support Cost**: $8,500

**Analysis**: Higher ticket volume driving costs. Root cause: API integration
complexity. Recommendation: Technical documentation improvement.

---

### Profitability Trend

[Line chart: Margin % over last 8 quarters]

| Quarter | Revenue | Costs | Margin | Margin % |
|---------|---------|-------|--------|----------|
| Q1 2024 | $30,000 | $15,000 | $15,000 | 50% |
| Q2 2024 | $35,000 | $10,000 | $25,000 | 71% |
| Q3 2024 | $37,500 | $9,500 | $28,000 | 75% |
| Q4 2024 | $37,500 | $8,500 | $29,000 | 77% |
| Q1 2025 | $37,500 | $10,500 | $27,000 | 72% |

**Trend**: Improving margin after heavy Q1 2024 onboarding investment

---

### Segment Comparison

**Enterprise SaaS Accounts (N=45)**

| Metric | Acme | Segment P25 | Median | P75 | Acme % |
|--------|------|-------------|--------|-----|--------|
| Margin % | 71.7% | 58% | 63% | 72% | 75th |
| Cost/ARR | 28% | 24% | 32% | 42% | 30th (better) |
| CSM hrs/qtr | 75 | 60 | 85 | 120 | 40th (efficient) |
| Support cost | $8.5K | $4K | $6K | $10K | 70th (higher) |

**Position**: Above-average profitability, efficient CSM time,
but support costs are elevated.

---

### Lifetime Value Analysis

| Metric | Value |
|--------|-------|
| Customer Age | 12 months |
| Total Revenue (LTD) | $150,000 |
| Total Costs (LTD) | $42,500 |
| Net Margin (LTD) | $107,500 |
| Projected Annual Margin | $107,500 |
| Estimated Lifetime (years) | 5 |
| **Projected LTV** | **$537,500** |

---

### Profitability Optimization Opportunities

#### 1. Reduce Support Costs (-$3,000/year)
- Current: $8,500 | Target: $5,500
- Action: Create self-service documentation for common issues
- Impact: +2% margin improvement

#### 2. Increase Expansion Revenue (+$20,000/year)
- Current expansion: $12,000 | Target: $32,000
- Action: Pursue Marketing department expansion
- Impact: +10% revenue growth, margin maintained

#### 3. Optimize CSM Time (-$2,000/year)
- Current: 300 hrs | Target: 260 hrs
- Action: Automate monthly reporting
- Impact: +1.3% margin improvement

**Combined Impact**: +3.3% margin, +$20K revenue

---

### Access & Permissions

This financial data is visible to:
- CS Leadership (full access)
- Finance (full access)
- CSM (summary only)

[Export Report] [Share with Finance] [Set Profitability Alert]
```

## Acceptance Criteria
- [ ] All revenue components aggregated
- [ ] Cost components calculated/estimated
- [ ] Gross margin calculated accurately
- [ ] Segment benchmarking included
- [ ] Trend over time displayed
- [ ] CSM time allocation broken down
- [ ] Support cost details provided
- [ ] LTV projection calculated
- [ ] Optimization opportunities identified
- [ ] Access controls enforced

## API Endpoint
```
GET /api/intelligence/profitability/:customerId
  Query: ?period=12m&includeProjections=true

Response: {
  profitability: AccountProfitability;
  trend: ProfitabilityTrend[];
  benchmark: SegmentBenchmark;
  opportunities: OptimizationOpportunity[];
}
```

## Data Sources
| Source | Table/Integration | Data |
|--------|-------------------|------|
| Revenue | Billing (Stripe, etc.) | All revenue streams |
| CSM Time | Time tracking or estimate | Hours allocation |
| Support | Support integration | Ticket costs |
| Infrastructure | Cloud billing | Usage costs |
| Onboarding | Project records | Implementation costs |

## Cost Estimation Methods
```typescript
// When exact time tracking unavailable
const estimateCSMCost = (customer: Customer) => {
  const baseHours = SEGMENT_BASE_HOURS[customer.segment];
  const modifiers = {
    healthScore: customer.healthScore < 50 ? 1.3 : 1.0,
    complexity: customer.entitlements.length > 5 ? 1.2 : 1.0,
    escalations: customer.escalations * 10, // hours per escalation
  };
  return baseHours * modifiers.healthScore * modifiers.complexity + modifiers.escalations;
};
```

## Access Control
| Role | Access Level |
|------|--------------|
| CS Leadership | Full financial details |
| Finance | Full financial details |
| CSM | Summary metrics only |
| Others | No access |

## Success Metrics
| Metric | Target |
|--------|--------|
| Profitability Visibility | 100% of accounts |
| Optimization Actions Taken | > 30% of opportunities |
| Margin Improvement | +5% avg year-over-year |
| Resource Allocation Accuracy | Within 10% of actual |

## Future Enhancements
- Real-time profitability tracking
- Predictive profitability modeling
- Automated resource recommendations
- Integration with FP&A systems
- Profitability-based segmentation

## Related PRDs
- PRD-158: Revenue Analytics Report
- PRD-173: Customer Lifetime Value Report
- PRD-078: Account Profitability View
- PRD-161: Time Allocation Analysis
