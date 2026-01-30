# PRD-069: Account Success Metrics

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide a comprehensive view of success metrics for each customer account, tracking whether the customer is achieving their stated goals and realizing value from the product. This dashboard connects customer objectives to measurable outcomes, enabling CSMs to demonstrate ROI and identify when customers are not achieving expected results.

## User Story
As a CSM, I want to track whether my customer is achieving their success goals so that I can demonstrate value, identify when intervention is needed, and build a compelling case for renewal and expansion.

As a customer stakeholder, I want to see clear metrics showing the value I'm getting from the product so that I can justify continued investment to my leadership.

## Trigger
- Navigation: Customer Detail > Success Tab
- Natural language: "Show me success metrics for [Account]"
- Variations: "Is [Account] achieving their goals?", "ROI for [Account]", "Value metrics"
- QBR Prep: Auto-included in QBR materials

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Time Period | String | No | Comparison period (default: contract to date) |
| Include Targets | Boolean | No | Show targets vs actuals |

## Success Metrics Framework
### Metric Categories
| Category | Description | Examples |
|----------|-------------|----------|
| Operational | Efficiency improvements | Time saved, process speed |
| Financial | Cost/revenue impact | Cost reduction, revenue increase |
| Quality | Error/quality improvements | Error rate reduction, accuracy |
| Adoption | Product utilization | Feature adoption, user engagement |
| Satisfaction | Sentiment measures | NPS, CSAT, engagement |

### Metric Types
| Type | Description | Calculation |
|------|-------------|-------------|
| Baseline | Starting point | Pre-implementation measurement |
| Target | Goal to achieve | Customer-defined objective |
| Current | Latest measurement | Most recent data point |
| Trend | Direction of change | Period-over-period comparison |

## Success Metrics Data Model
```typescript
interface SuccessMetric {
  id: string;
  customerId: string;
  category: 'operational' | 'financial' | 'quality' | 'adoption' | 'satisfaction';
  name: string;
  description: string;

  // Values
  baseline: number;
  target: number;
  current: number;
  unit: string;  // "hours", "percent", "$", etc.

  // Metadata
  direction: 'higher_is_better' | 'lower_is_better';
  dataSource: string;
  measuredAt: Date;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';

  // Status
  status: 'exceeding' | 'on_track' | 'at_risk' | 'not_met';
  progressPercent: number;
}

interface SuccessGoal {
  id: string;
  customerId: string;
  title: string;
  description: string;
  metrics: SuccessMetric[];
  owner: string;
  targetDate: Date;
  status: 'not_started' | 'in_progress' | 'achieved' | 'at_risk';
}
```

## Output Format
```markdown
## Account Success Metrics: Acme Corp
Period: Contract Start (Jan 2025) to Present
Updated: [Timestamp]

### Overall Success Score: 85/100 (Strong)
[Gauge visualization]

### Executive Summary
- **4 of 5 goals** on track or exceeded
- **$245,000** estimated annual value delivered
- **1 goal** at risk (requires attention)

---

### Success Goals Overview

| Goal | Status | Progress | Details |
|------|--------|----------|---------|
| Reduce reporting time | ✓ Exceeded | 140% | 70% reduction vs 50% target |
| Improve data accuracy | ✓ On Track | 92% | 8% error reduction achieved |
| Increase team efficiency | ⚠ At Risk | 65% | Adoption gaps identified |
| Enable self-service | ✓ On Track | 88% | 88% self-serve vs 90% target |
| Consolidate tools | ✓ Achieved | 100% | 3 tools retired |

---

### Goal Details

#### Goal 1: Reduce Reporting Time
**Status**: ✓ Exceeded | **Owner**: Sarah Chen (VP Ops)

| Metric | Baseline | Target | Current | Status |
|--------|----------|--------|---------|--------|
| Time to create report | 4 hours | 2 hours | 1.2 hours | ✓ 140% |
| Reports created/week | 10 | 25 | 35 | ✓ 140% |
| Manual steps eliminated | 0 | 15 | 18 | ✓ 120% |

**Value Delivered**:
- Time saved: 140 hours/month
- Cost savings: ~$8,400/month (at $60/hr)
- Annual value: **$100,800**

[Trend Chart: Reporting time over months]

**Customer Quote** (from QBR):
> "What used to take us half a day now takes 20 minutes.
> The team loves it." - Sarah Chen

---

#### Goal 2: Improve Data Accuracy
**Status**: ✓ On Track | **Owner**: Mike Lee (Director Analytics)

| Metric | Baseline | Target | Current | Status |
|--------|----------|--------|---------|--------|
| Data error rate | 12% | 2% | 3.8% | ● 92% |
| Manual corrections/week | 45 | 5 | 8 | ● 93% |
| Audit findings | 15/quarter | 3/quarter | 4/quarter | ● 87% |

**Value Delivered**:
- Errors prevented: ~180/month
- Correction time saved: 90 hours/month
- Risk mitigation: Audit confidence improved
- Annual value: **$64,800**

**Recommended Action**:
Small gap to target - suggest data validation training

---

#### Goal 3: Increase Team Efficiency
**Status**: ⚠ At Risk | **Owner**: Bob Smith (Manager)

| Metric | Baseline | Target | Current | Status |
|--------|----------|--------|---------|--------|
| Tasks/person/day | 15 | 25 | 18 | ⚠ 60% |
| System adoption | 40% | 90% | 65% | ⚠ 69% |
| Process automation | 0 | 10 workflows | 4 workflows | ⚠ 40% |

**Root Cause Analysis**:
- Only 65% of team using system regularly
- Automation features underutilized
- Training completion at 50%

**Recommended Actions**:
1. **Immediate**: Schedule team training session
2. **This Week**: Identify automation opportunities
3. **This Month**: Implement 3 quick-win automations

[Schedule Training] [Create Automation Plan]

---

### Value Summary

#### Quantified Value Delivered
| Category | Annual Value | Confidence |
|----------|--------------|------------|
| Time Savings | $165,600 | High |
| Error Reduction | $64,800 | Medium |
| Tool Consolidation | $45,000 | High |
| **Total** | **$275,400** | |

**ROI Calculation**:
- Investment (ARR): $150,000
- Value Delivered: $275,400
- **ROI: 184%**

[Generate Value Report] [Export for QBR]

---

### Success Metrics Trends
[Multi-line chart showing all key metrics over time]

Key Observations:
- Strong start in Q1, plateau in Q2, growth resuming Q4
- Goal 3 metrics declined when champion went on leave

---

### Benchmark Comparison

| Metric | Acme Corp | Peer Average | Percentile |
|--------|-----------|--------------|------------|
| Success Score | 85 | 72 | 80th |
| Goals Achieved | 80% | 65% | 75th |
| ROI | 184% | 120% | 85th |

---

### Upcoming Milestones
| Milestone | Target Date | Status |
|-----------|-------------|--------|
| Goal 3 checkpoint | Feb 28 | At Risk |
| QBR review | Mar 15 | Scheduled |
| Annual success review | Jun 30 | Planned |

---

### Quick Actions
[Add New Goal] [Update Metrics] [Generate Value Report] [Share with Customer]
```

## Acceptance Criteria
- [ ] All defined success goals displayed
- [ ] Progress percentage calculated correctly
- [ ] Status (exceeded/on track/at risk/not met) accurate
- [ ] Value quantification calculated
- [ ] Trend charts show historical progress
- [ ] At-risk goals prominently highlighted
- [ ] Recommendations generated for at-risk goals
- [ ] Export value report for customer sharing
- [ ] Benchmarking against peer customers
- [ ] ROI calculation accurate

## API Endpoint
```
GET /api/intelligence/success-metrics/:customerId
  Query: ?period=all&includeBenchmarks=true

POST /api/intelligence/success-metrics/:customerId/goals
  Body: {
    "title": "Reduce support tickets",
    "metrics": [...],
    "targetDate": "2026-06-30"
  }
```

## Data Sources
| Source | Table | Data |
|--------|-------|------|
| Goals | `success_goals` | Goal definitions |
| Metrics | `success_metrics` | Metric values |
| Usage | `usage_metrics` | Adoption metrics |
| Meetings | `meeting_analyses` | Goal discussions |
| QBRs | `qbrs` | Goal reviews |

## Success Score Calculation
```typescript
const successScore = goals.reduce((score, goal) => {
  const goalProgress = goal.metrics.reduce((sum, m) => sum + m.progressPercent, 0) / goal.metrics.length;
  return score + (goalProgress * goal.weight);
}, 0);
```

## Error Handling
| Error | Response |
|-------|----------|
| No goals defined | "No success goals defined. [Define Goals]" |
| Missing metrics | "Some metrics missing data. Showing available data." |
| No baseline | "Baseline not set. Cannot calculate progress." |

## Success Metrics
| Metric | Target |
|--------|--------|
| Accounts with Goals Defined | > 80% |
| Goals Achieved Rate | > 70% |
| Value Reports Generated | > 50% of accounts |
| Renewal with Proven ROI | +30% success |

## Future Enhancements
- Automated metric collection from integrations
- Customer-facing success portal
- Predictive goal achievement
- Industry benchmark database
- Value report templates by industry

## Related PRDs
- PRD-056: "Tell Me About [Account]" Command
- PRD-064: Product Adoption Dashboard
- PRD-070: Engagement Score Breakdown
- PRD-165: Success Metrics Report
- PRD-137: Goal Achieved Documentation
