# PRD-059: Renewal Pipeline Forecast

## Category
**Category C: Account Intelligence**

## Priority
**P0** - Foundation Tier

## Overview
Provide CSMs and CS leadership with an intelligent renewal pipeline forecast that predicts renewal outcomes, identifies at-risk renewals, and calculates expected revenue retention. This tool combines historical patterns, current health indicators, and engagement signals to generate accurate forecasts and recommended actions.

## User Story
As a CSM, I want to see my upcoming renewals with predicted outcomes and risk levels so that I can prioritize my renewal activities and proactively address at-risk accounts before it's too late.

As a CS Manager, I want to see portfolio-wide renewal forecasts so that I can accurately predict retention rates, identify coaching opportunities, and report to leadership.

## Trigger
- Natural language command: "Show me my renewal pipeline"
- Variations: "What renewals are coming up?", "Renewal forecast", "Which renewals are at risk?"
- Dashboard: Renewal Pipeline view
- Scheduled: Weekly renewal digest

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| CSM ID | UUID | No | Filter to specific CSM (default: current user) |
| Time Horizon | String | No | "30d", "60d", "90d", "quarter", "year" (default: 90d) |
| Segment Filter | String | No | Filter by customer segment |
| Risk Filter | String | No | "all", "at-risk", "healthy" |

## Process Flow
```
Request Renewal Forecast
          │
          ▼
┌──────────────────────────┐
│ Fetch Upcoming Renewals  │
│ (renewal_pipeline table) │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ For Each Renewal:        │
│ Calculate Risk Score     │
└───────────┬──────────────┘
            │
    ┌───────┴───────┬──────────────┬────────────────┐
    ▼               ▼              ▼                ▼
┌──────────┐ ┌───────────┐ ┌─────────────┐ ┌────────────┐
│Health    │ │Engagement │ │Historical   │ │Sentiment   │
│Score     │ │Signals    │ │Patterns     │ │Analysis    │
└─────┬────┘ └─────┬─────┘ └──────┬──────┘ └─────┬──────┘
      │            │              │               │
      └────────────┴──────────────┴───────────────┘
                          │
                          ▼
           ┌──────────────────────────┐
           │ Predict Renewal Outcome  │
           │ (Probability Model)      │
           └───────────┬──────────────┘
                       │
                       ▼
           ┌──────────────────────────┐
           │ Aggregate Portfolio      │
           │ Forecast                 │
           └───────────┬──────────────┘
                       │
                       ▼
              Generate Pipeline
                    Report
```

## Renewal Probability Model
```typescript
interface RenewalPrediction {
  customerId: string;
  renewalDate: Date;
  currentArr: number;
  predictedOutcome: 'renew' | 'churn' | 'downgrade' | 'expand';
  probability: number;  // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RenewalFactor[];
  expectedArr: number;
  confidenceInterval: {
    low: number;
    high: number;
  };
}

interface RenewalFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}
```

### Factor Weights
| Factor | Weight | Impact Direction |
|--------|--------|------------------|
| Health Score | 25% | Score > 70 = positive |
| Usage Trend | 20% | Growing = positive |
| Stakeholder Engagement | 15% | Recent contact = positive |
| Champion Status | 15% | Active champion = positive |
| NPS Score | 10% | > 8 = positive |
| Support Ticket Trend | 10% | Declining = positive |
| Historical Renewal | 5% | Prior renewal = positive |

## Output Format
```markdown
## Renewal Pipeline Forecast
Period: [Start Date] - [End Date]
Generated: [Timestamp]

### Executive Summary
| Metric | Value |
|--------|-------|
| Total Renewals | 45 accounts |
| Total ARR Up for Renewal | $2,450,000 |
| Predicted Retention Rate | 87% |
| Expected Renewed ARR | $2,131,500 |
| At-Risk ARR | $318,500 |
| Expansion Opportunity | $125,000 |

### Forecast by Outcome
| Outcome | Accounts | ARR | % of Total |
|---------|----------|-----|------------|
| Likely Renew (>80%) | 32 | $1,850,000 | 76% |
| Possible Renew (50-80%) | 8 | $420,000 | 17% |
| At Risk (<50%) | 5 | $180,000 | 7% |

### Detailed Pipeline

#### Critical Risk (Action Required)
| Account | ARR | Renewal | Probability | Key Risk Factors |
|---------|-----|---------|-------------|------------------|
| Beta Inc | $85,000 | Feb 15 | 25% | Champion left, Usage -40%, No exec sponsor |
| Gamma Ltd | $45,000 | Feb 28 | 35% | Health 38, No contact 45 days |

**Recommended Actions - Beta Inc:**
1. [URGENT] Schedule exec alignment call this week
2. Identify replacement champion from user base
3. Propose usage workshop to re-engage team

---

#### Medium Risk (Monitor Closely)
| Account | ARR | Renewal | Probability | Key Factors |
|---------|-----|---------|-------------|-------------|
| Delta Co | $120,000 | Mar 10 | 62% | Usage flat, NPS 6, Feature requests unmet |

---

#### Healthy (On Track)
| Account | ARR | Renewal | Probability | Opportunity |
|---------|-----|---------|-------------|-------------|
| Alpha Inc | $200,000 | Feb 20 | 92% | +$30,000 expansion |
| Epsilon | $150,000 | Mar 05 | 88% | Multi-year possible |

### Monthly Breakdown
| Month | Renewals | ARR | Predicted Retention |
|-------|----------|-----|---------------------|
| February | 15 | $890,000 | 84% |
| March | 18 | $1,020,000 | 89% |
| April | 12 | $540,000 | 91% |

### Trending Charts
[Renewal Funnel Visualization]
[ARR Retention Trend - Last 12 Months]
[Risk Distribution Over Time]
```

## Acceptance Criteria
- [ ] All renewals within time horizon displayed
- [ ] Probability scores calculated for each renewal
- [ ] Risk levels accurately categorized
- [ ] Aggregate metrics calculated correctly
- [ ] At-risk accounts highlighted prominently
- [ ] Specific action recommendations per at-risk account
- [ ] Export to CSV/Excel for reporting
- [ ] Filter by CSM, segment, risk level
- [ ] Historical accuracy tracking (predicted vs actual)

## API Endpoint
```
GET /api/intelligence/renewal-forecast
  Query: ?horizon=90d&segment=enterprise&risk=at-risk

POST /api/intelligence/renewal-forecast
  Body: {
    "csmId": "uuid",
    "startDate": "2026-02-01",
    "endDate": "2026-04-30",
    "segments": ["enterprise", "mid-market"]
  }
```

## Data Sources
| Source | Table | Usage |
|--------|-------|-------|
| Renewals | `renewal_pipeline` | Core renewal data |
| Customers | `customers` | ARR, segment, health |
| Health History | `health_score_history` | Trend analysis |
| Usage | `usage_metrics` | Usage trends |
| Stakeholders | `stakeholders` | Champion status |
| Meetings | `meetings` | Engagement recency |
| Risk Signals | `risk_signals` | Active risks |

## Accuracy Tracking
```typescript
interface ForecastAccuracy {
  period: string;
  predicted: {
    renewals: number;
    churn: number;
    downgrade: number;
    expand: number;
  };
  actual: {
    renewals: number;
    churn: number;
    downgrade: number;
    expand: number;
  };
  accuracy: number;  // Percentage match
}
```

## Error Handling
| Error | Response |
|-------|----------|
| No renewals in period | "No renewals scheduled in the selected time period" |
| Missing health data | "Some accounts have limited data. Predictions may be less accurate." |
| Model unavailable | "Prediction model temporarily unavailable. Showing raw data." |

## Success Metrics
| Metric | Target |
|--------|--------|
| Forecast Accuracy | > 85% match to actual |
| At-Risk Identification | > 90% of churns predicted |
| Time to Action (at-risk) | < 24 hours |
| Retention Improvement | +5% vs pre-tool baseline |

## Future Enhancements
- ML-based prediction model trained on historical data
- Scenario planning ("what if" analysis)
- Competitive displacement risk factor
- Economic/market condition adjustments
- Auto-trigger save plays for at-risk renewals

## Related PRDs
- PRD-061: At-Risk Portfolio View
- PRD-089: Renewal Approaching Alert
- PRD-163: Renewal Forecast Report
- PRD-174: Net Revenue Retention Report
