# PRD-061: At-Risk Portfolio View

## Category
**Category C: Account Intelligence**

## Priority
**P0** - Foundation Tier

## Overview
Provide a comprehensive dashboard view of all at-risk accounts across a CSM's portfolio or the entire organization. This view consolidates risk signals, health scores, and churn indicators into an actionable interface that enables proactive intervention before accounts churn.

## User Story
As a CSM, I want to see all my at-risk accounts in one place with clear risk factors and recommended actions so that I can prioritize my save efforts and prevent churn.

As a CS Manager, I want to see all at-risk accounts across my team so that I can allocate resources, identify patterns, and coach CSMs on risk mitigation.

## Trigger
- Navigation: Click "At-Risk" in portfolio view
- Natural language: "Show me at-risk accounts"
- Variations: "Which accounts are at risk?", "Churn watch list", "Accounts in danger"
- Dashboard: Risk Dashboard widget

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| View Scope | String | No | "my_accounts", "team", "all" (default: my_accounts) |
| Risk Level | String | No | "critical", "high", "medium", "all" (default: all) |
| Sort By | String | No | "risk_score", "arr", "renewal_date", "health_trend" |
| Time Frame | String | No | Health trend comparison period |

## Risk Classification
### Risk Score Calculation
```typescript
interface RiskScore {
  customerId: string;
  totalScore: number;  // 0-100 (higher = more risk)
  level: 'critical' | 'high' | 'medium' | 'low';
  factors: RiskFactor[];
  trend: 'increasing' | 'stable' | 'decreasing';
  daysAtRisk: number;
}

// Risk Score Formula
riskScore = (
  (100 - healthScore) * 0.30 +           // Inverse health
  riskSignalScore * 0.25 +                // Active signals
  usageDeclineScore * 0.20 +              // Usage trend
  engagementGapScore * 0.15 +             // Contact recency
  renewalProximityScore * 0.10            // Time to renewal
);
```

### Risk Levels
| Level | Score Range | Criteria | Action Timeline |
|-------|-------------|----------|-----------------|
| Critical | 80-100 | Multiple severe signals | Immediate (24h) |
| High | 60-79 | Significant deterioration | This week |
| Medium | 40-59 | Early warning signs | This month |
| Low | 0-39 | Minor concerns | Monitor |

## Risk Signal Types
| Signal | Weight | Description |
|--------|--------|-------------|
| Champion Departure | +25 | Key contact left company |
| Health Score < 40 | +20 | Critically low health |
| Health Drop > 20pts/30d | +20 | Rapid decline |
| No Login 30+ days | +15 | Product abandonment |
| Usage Decline > 40% | +15 | Significant usage drop |
| Open Escalation | +15 | Active escalation |
| Negative NPS (0-6) | +10 | Detractor status |
| No Contact 45+ days | +10 | Engagement gap |
| Support Tickets Spike | +10 | Product issues |
| Renewal < 60 days | +10 | Time pressure |

## Output Format
### Dashboard View
```markdown
## At-Risk Portfolio
Updated: [Timestamp]

### Risk Summary
| Level | Accounts | ARR at Risk | Avg Days at Risk |
|-------|----------|-------------|------------------|
| Critical | 3 | $245,000 | 12 |
| High | 7 | $420,000 | 28 |
| Medium | 12 | $380,000 | 45 |
| **Total** | **22** | **$1,045,000** | **32** |

### Trend
[Chart: At-Risk ARR over last 12 weeks]
Current: $1,045,000 | Peak: $1,280,000 | Improved: -18%

---

### Critical Risk Accounts (Immediate Action)

#### 1. Beta Inc
| Metric | Value | Status |
|--------|-------|--------|
| Risk Score | 92/100 | Critical |
| Health Score | 28/100 | ▼ 24 pts (30d) |
| ARR | $120,000 | |
| Renewal | 45 days | |
| Days at Risk | 18 | |

**Active Risk Signals**:
- Champion (Sarah Chen) departed 2 weeks ago
- Usage down 52% since departure
- 3 critical support tickets open
- No exec sponsor identified

**Risk Timeline**:
[Visual timeline showing signal progression]

**Recommended Save Play**:
1. Emergency exec-to-exec outreach (CEO to their CEO)
2. Identify interim champion from power users
3. Expedite support ticket resolution
4. Propose success workshop for remaining team

**Actions**: [Start Save Play] [Schedule Call] [Escalate Internally]

---

#### 2. Gamma Ltd
[Similar format...]

---

### High Risk Accounts

[Condensed list with key metrics and top risk factor]

| Account | ARR | Risk | Health | Top Risk Factor | Action |
|---------|-----|------|--------|-----------------|--------|
| Delta Co | $85,000 | 72 | 45 ▼ | Usage -35% | [View] |
| Epsilon | $68,000 | 68 | 52 ▼ | No contact 38d | [View] |
...

---

### Risk Patterns Detected

**Common Factors Across At-Risk Accounts**:
1. **Champion Instability**: 60% have champion change in last 90 days
2. **Feature Adoption**: 70% using < 40% of features
3. **Engagement Gap**: Average 32 days since last meaningful contact

**Recommended Portfolio Actions**:
- Implement champion backup identification process
- Schedule feature adoption workshops for medium-risk accounts
- Increase touch frequency for accounts > 21 days no contact
```

## Visualization Components
```typescript
interface AtRiskDashboard {
  summary: {
    byLevel: RiskLevelSummary[];
    totalArr: number;
    trendDirection: 'improving' | 'worsening' | 'stable';
  };

  accounts: AtRiskAccount[];

  charts: {
    arrTrend: TimeSeriesData;      // At-risk ARR over time
    riskDistribution: PieChart;    // By risk level
    signalFrequency: BarChart;     // Most common signals
    timeAtRisk: Histogram;         // Days at risk distribution
  };

  patterns: RiskPattern[];
}
```

## Acceptance Criteria
- [ ] All accounts with risk score > 40 displayed
- [ ] Risk scores calculated correctly from all factors
- [ ] Sorting by risk score, ARR, renewal date works
- [ ] Risk signals listed with severity
- [ ] Health trend displayed (30-day comparison)
- [ ] Save play recommendations specific to risk factors
- [ ] Quick actions (schedule call, start save play) functional
- [ ] Export at-risk list to CSV
- [ ] Filter by CSM (for managers)
- [ ] Real-time updates when risk signals change

## API Endpoint
```
GET /api/intelligence/at-risk
  Query: ?scope=my_accounts&level=all&sortBy=risk_score

POST /api/intelligence/at-risk
  Body: {
    "csmId": "uuid",          // Optional: specific CSM
    "levels": ["critical", "high"],
    "minArr": 50000
  }
```

## Data Sources
| Source | Table | Usage |
|--------|-------|-------|
| Customers | `customers` | Base account info |
| Health History | `health_score_history` | Trend calculation |
| Risk Signals | `risk_signals` | Active signals |
| Usage | `usage_metrics` | Usage trends |
| Stakeholders | `stakeholders` | Champion status |
| Save Plays | `save_plays` | Active interventions |
| Renewals | `renewal_pipeline` | Renewal proximity |

## Automated Actions
- Daily recalculation of risk scores
- Alert CSM when account enters Critical status
- Alert Manager when Critical account unaddressed 48+ hours
- Auto-create save play record for Critical accounts
- Slack notification for new risk signals

## Success Metrics
| Metric | Target |
|--------|--------|
| At-Risk Identification Accuracy | > 90% |
| Average Time to Action (Critical) | < 24 hours |
| Save Play Success Rate | > 50% |
| At-Risk ARR Reduction | -25% month-over-month |
| False Positive Rate | < 15% |

## Future Enhancements
- Predictive risk (accounts likely to become at-risk)
- Automated save play assignment
- Risk contagion analysis (accounts with shared factors)
- Win-back tracking for churned accounts
- Industry/segment risk benchmarking

## Related PRDs
- PRD-057: "What Accounts Need Attention?" Briefing
- PRD-083: Account Risk Factors Deep Dive
- PRD-107: Health Score Threshold Alert
- PRD-164: At-Risk Accounts Report
- PRD-216: Predictive Churn Scoring
