# PRD-058: Account Comparison Tool

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Enable CSMs to compare two or more accounts side-by-side across key metrics, behaviors, and outcomes. This tool helps identify best practices from successful accounts that can be applied to struggling ones, understand why similar accounts perform differently, and make data-driven decisions about resource allocation.

## User Story
As a CSM, I want to compare Account A with Account B across all key dimensions so that I can understand why one is thriving while the other struggles, and apply learnings to improve outcomes.

## Trigger
- Natural language command: "Compare [Account A] with [Account B]"
- Variations: "Show me the difference between [A] and [B]", "Why is [A] doing better than [B]?", "[A] vs [B]"
- UI action: Select multiple accounts and click "Compare"

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Account IDs | UUID[] | Yes | 2-5 accounts to compare |
| Comparison Focus | String | No | "health", "usage", "engagement", "financial", "all" |
| Time Period | String | No | "current", "last_quarter", "last_year" |

## Process Flow
```
Select Accounts for Comparison
            │
            ▼
┌──────────────────────────┐
│ Validate Account Access  │
│ (CSM permissions)        │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ Fetch All Metrics for    │
│ Each Account (Parallel)  │
└───────────┬──────────────┘
            │
    ┌───────┴───────┬──────────────┬────────────────┐
    ▼               ▼              ▼                ▼
┌──────────┐ ┌───────────┐ ┌─────────────┐ ┌────────────┐
│Financial │ │Health &   │ │Engagement & │ │Product     │
│Metrics   │ │Risk       │ │Communication│ │Usage       │
└─────┬────┘ └─────┬─────┘ └──────┬──────┘ └─────┬──────┘
      │            │              │               │
      └────────────┴──────────────┴───────────────┘
                          │
                          ▼
           ┌──────────────────────────┐
           │ Normalize & Calculate    │
           │ Deltas / Percentiles     │
           └───────────┬──────────────┘
                       │
                       ▼
           ┌──────────────────────────┐
           │ AI Analysis: Key         │
           │ Differentiators          │
           └───────────┬──────────────┘
                       │
                       ▼
              Generate Comparison
                    Report
```

## Comparison Dimensions
### Financial Metrics
| Metric | Description | Comparison Type |
|--------|-------------|-----------------|
| ARR | Annual Recurring Revenue | Absolute + % diff |
| Contract Length | Months remaining | Absolute |
| Expansion Revenue | Upsell/cross-sell | Absolute + % |
| LTV | Lifetime value | Absolute |
| Revenue Growth | YoY growth rate | Percentage |

### Health Metrics
| Metric | Description | Comparison Type |
|--------|-------------|-----------------|
| Health Score | Current composite score | Score + trend |
| Usage Score | Product adoption | Score |
| Engagement Score | Interaction level | Score |
| Sentiment Score | Relationship health | Score |
| Risk Signal Count | Active risk signals | Count |

### Engagement Metrics
| Metric | Description | Comparison Type |
|--------|-------------|-----------------|
| Stakeholder Count | Total contacts | Count |
| Champion Strength | Champion engagement | Score |
| Exec Sponsor | Exec relationship | Yes/No |
| Meeting Frequency | Meetings per month | Count |
| Last Contact | Days since contact | Days |
| Response Time | Avg response time | Hours |

### Usage Metrics
| Metric | Description | Comparison Type |
|--------|-------------|-----------------|
| DAU/MAU | Active users | Count + ratio |
| Feature Adoption | Features used | Percentage |
| API Usage | Integration depth | Count |
| Login Frequency | Sessions per user | Count |
| Usage Trend | Growth direction | Trend arrow |

## Output Format
```markdown
## Account Comparison Report
Generated: [Timestamp]

### Accounts Compared
| Account | ARR | Segment | Industry | Health |
|---------|-----|---------|----------|--------|
| Acme Corp | $250,000 | Enterprise | SaaS | 85 |
| Beta Inc | $180,000 | Enterprise | SaaS | 52 |

### Side-by-Side Comparison

#### Financial Performance
| Metric | Acme Corp | Beta Inc | Delta | Winner |
|--------|-----------|----------|-------|--------|
| ARR | $250,000 | $180,000 | +39% | Acme |
| Growth Rate | +15% | -5% | +20pp | Acme |
| Expansion | $50,000 | $0 | +$50K | Acme |

#### Health & Risk
| Metric | Acme Corp | Beta Inc | Delta | Winner |
|--------|-----------|----------|-------|--------|
| Health Score | 85 | 52 | +33 | Acme |
| Risk Signals | 0 | 3 | -3 | Acme |
| Trend | Growing | Declining | - | Acme |

#### Engagement
| Metric | Acme Corp | Beta Inc | Delta | Winner |
|--------|-----------|----------|-------|--------|
| Stakeholders | 8 | 3 | +5 | Acme |
| Exec Sponsor | Yes | No | - | Acme |
| Meetings/Mo | 4 | 1 | +3 | Acme |
| Last Contact | 3 days | 28 days | -25 days | Acme |

#### Product Usage
| Metric | Acme Corp | Beta Inc | Delta | Winner |
|--------|-----------|----------|-------|--------|
| MAU | 145 | 42 | +245% | Acme |
| Features Used | 85% | 35% | +50pp | Acme |
| Usage Trend | +12% | -23% | +35pp | Acme |

### AI Analysis: Key Differentiators

**Why Acme Corp is Outperforming Beta Inc:**

1. **Stakeholder Depth**: Acme has 8 engaged stakeholders vs Beta's 3.
   This multi-threading provides resilience and multiple advocates.

2. **Executive Sponsorship**: Acme has an active exec sponsor who
   attends QBRs. Beta lacks executive engagement.

3. **Engagement Frequency**: Acme meets monthly; Beta hasn't been
   contacted in 28 days. This gap correlates with declining usage.

4. **Feature Adoption**: Acme uses 85% of features vs Beta's 35%.
   Low adoption often precedes churn.

### Recommended Actions for Beta Inc

1. **Immediate**: Schedule exec outreach to establish sponsorship
2. **This Week**: Identify and activate a champion within the account
3. **This Month**: Conduct feature adoption workshop to increase usage
4. **Ongoing**: Increase touch frequency to bi-weekly minimum

### Patterns to Apply
- Acme's onboarding included dedicated training; Beta's did not
- Acme has a weekly internal sync; consider suggesting for Beta
- Acme's champion was identified in week 2; Beta still lacks one
```

## Visualization Components
```typescript
interface ComparisonVisualization {
  radarChart: {
    dimensions: string[];
    datasets: AccountDataset[];
  };
  trendLines: {
    metric: string;
    data: TimeSeriesData[];
  };
  barComparison: {
    metrics: string[];
    values: AccountValues[];
  };
}
```

## Acceptance Criteria
- [ ] Compare 2-5 accounts simultaneously
- [ ] All metrics normalized for fair comparison
- [ ] Clear visual indication of "winner" per metric
- [ ] Delta calculations accurate (percentage and absolute)
- [ ] AI analysis provides actionable insights
- [ ] Patterns and recommendations specific to accounts
- [ ] Export comparison to PDF/Doc
- [ ] Save comparison for future reference
- [ ] Works with accounts from different segments

## API Endpoint
```
POST /api/intelligence/account-comparison
  Body: {
    "accountIds": ["uuid1", "uuid2"],
    "focus": "all",
    "timePeriod": "current"
  }

Response: {
  "accounts": [...],
  "comparison": {...},
  "analysis": {...},
  "recommendations": [...]
}
```

## Error Handling
| Error | Response |
|-------|----------|
| < 2 accounts | "Please select at least 2 accounts to compare" |
| > 5 accounts | "Maximum 5 accounts can be compared at once" |
| Different industries | "Note: Accounts are from different industries. Some comparisons may not be meaningful." |
| Insufficient data | "Limited data available for [Account]. Comparison may be incomplete." |

## Success Metrics
| Metric | Target |
|--------|--------|
| Comparisons per CSM/week | > 3 |
| Recommendations Actioned | > 60% |
| Health Improvement (target accounts) | +15 points avg |
| User Satisfaction | > 4.2/5 |

## Future Enhancements
- Cohort comparison (segment vs segment)
- Historical comparison (same account over time)
- Benchmark against industry averages
- Automated comparison when similar accounts diverge
- Share comparison with account team

## Related PRDs
- PRD-056: "Tell Me About [Account]" Command
- PRD-074: Account Benchmarking
- PRD-069: Account Success Metrics
- PRD-083: Account Risk Factors Deep Dive
