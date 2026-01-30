# PRD-057: "What Accounts Need Attention?" Briefing

## Category
**Category C: Account Intelligence**

## Priority
**P0** - Foundation Tier

## Overview
Provide CSMs with an intelligent daily briefing that identifies which accounts in their portfolio require immediate attention. This proactive intelligence feature analyzes health scores, risk signals, usage patterns, and upcoming events to surface the highest-priority accounts with specific reasons and recommended actions.

## User Story
As a CSM, I want to ask "What accounts need attention?" and receive a prioritized list of accounts requiring action today so that I can focus my time on the most critical customer needs rather than manually reviewing my entire portfolio.

## Trigger
- Natural language command: "What accounts need attention?"
- Variations: "Which customers need help?", "What's on fire?", "Morning briefing", "Priority accounts", "Who should I focus on today?"
- Scheduled: Daily morning digest (automated)

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| CSM ID | UUID | Yes (from context) | CSM requesting the briefing |
| Time Horizon | String | No | "today", "this week" (default: today) |
| Category Filter | String | No | "risk", "renewal", "engagement", "all" |
| Limit | Integer | No | Maximum accounts to return (default: 10) |

## Process Flow
```
Request Initiated
       │
       ▼
┌──────────────────────────┐
│ Get CSM's Portfolio      │
│ (All assigned customers) │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│ Score Each Account       │
│ (Attention Priority)     │
└───────────┬──────────────┘
            │
    ┌───────┴───────┬───────────────┬─────────────────┐
    ▼               ▼               ▼                 ▼
┌──────────┐ ┌───────────┐ ┌────────────────┐ ┌─────────────┐
│Health Drop│ │Risk Signals│ │Upcoming Events │ │Engagement   │
│Detection │ │Analysis   │ │(Renewal, QBR) │ │Gaps         │
└─────┬────┘ └─────┬─────┘ └───────┬────────┘ └──────┬──────┘
      │            │               │                  │
      └────────────┴───────────────┴──────────────────┘
                          │
                          ▼
           ┌──────────────────────────┐
           │ Rank by Priority Score   │
           │ (Weighted algorithm)     │
           └───────────┬──────────────┘
                       │
                       ▼
           ┌──────────────────────────┐
           │ Generate Attention       │
           │ Reasons & Actions        │
           └───────────┬──────────────┘
                       │
                       ▼
               Return Briefing
```

## Priority Scoring Algorithm
```typescript
interface AttentionScore {
  customerId: string;
  totalScore: number;
  breakdown: {
    healthDropScore: number;      // 0-30 points
    riskSignalScore: number;      // 0-25 points
    eventProximityScore: number;  // 0-20 points
    engagementGapScore: number;   // 0-15 points
    arrWeightScore: number;       // 0-10 points
  };
  reasons: AttentionReason[];
}

// Weights
const HEALTH_DROP_WEIGHT = 0.30;     // 30%
const RISK_SIGNAL_WEIGHT = 0.25;     // 25%
const EVENT_PROXIMITY_WEIGHT = 0.20; // 20%
const ENGAGEMENT_GAP_WEIGHT = 0.15;  // 15%
const ARR_WEIGHT = 0.10;             // 10%
```

## Attention Categories
| Category | Triggers | Score Weight |
|----------|----------|--------------|
| **Critical Risk** | Health < 30, Critical signal | +30 |
| **Health Decline** | >10 point drop in 7 days | +25 |
| **Renewal Approaching** | < 30 days to renewal | +20 |
| **Champion Risk** | Champion departure signal | +25 |
| **Usage Drop** | >30% usage decline | +20 |
| **No Contact** | >21 days since last contact | +15 |
| **Escalation Active** | Open escalation | +25 |
| **QBR Due** | QBR scheduled within 7 days | +10 |
| **Expansion Ready** | Positive signals + capacity | +10 |

## Output Format
```markdown
## Morning Briefing - [Date]
Accounts Needing Attention: [X]

### Critical (Immediate Action Required)
---

#### 1. [Account Name] - ARR: $XXX,XXX
**Attention Score**: 95/100 | **Health**: 28/100 (▼ 15)

**Why This Needs Attention**:
- Health score dropped 15 points in the last 7 days
- Critical risk signal: Champion departed
- Renewal in 45 days with no renewal conversation started

**Recommended Actions**:
1. Schedule emergency call with remaining stakeholders
2. Identify new champion candidate
3. Review usage data to understand health drop

**Quick Actions**: [Schedule Call] [View Account] [Start Save Play]

---

#### 2. [Account Name] - ARR: $XXX,XXX
...

### High Priority (Action Within 24 Hours)
---
[Similar format...]

### Medium Priority (Action This Week)
---
[Similar format...]

### Summary Stats
| Category | Count | Total ARR at Risk |
|----------|-------|-------------------|
| Critical | X | $XXX,XXX |
| High Priority | X | $XXX,XXX |
| Medium Priority | X | $XXX,XXX |
```

## Data Sources
| Source | Table | Query |
|--------|-------|-------|
| Portfolio | `customers` | WHERE csm_id = :csmId |
| Health History | `health_score_history` | Last 30 days for comparison |
| Risk Signals | `risk_signals` | WHERE resolved_at IS NULL |
| Renewals | `renewal_pipeline` | Upcoming 90 days |
| Meetings | `meetings` | Last contact date |
| Escalations | `save_plays` | WHERE status = 'active' |
| Usage | `usage_metrics` | Last 30 days vs prior 30 |

## Acceptance Criteria
- [ ] Returns prioritized list within 3 seconds
- [ ] Correctly identifies health score drops
- [ ] Surfaces all unresolved critical/high risk signals
- [ ] Includes accounts with renewals < 90 days
- [ ] Flags accounts with no contact > 21 days
- [ ] Calculates total ARR at risk
- [ ] Provides specific, actionable recommendations
- [ ] Quick action buttons functional
- [ ] Empty state handled: "Great news! No accounts need immediate attention."

## API Endpoint
```
GET /api/intelligence/attention-briefing
  Query: ?timeHorizon=today&category=all&limit=10

POST /api/intelligence/attention-briefing
  Body: {
    "csmId": "uuid",
    "timeHorizon": "this_week",
    "categories": ["risk", "renewal"]
  }
```

## Scheduled Delivery
```yaml
schedule:
  type: cron
  expression: "0 8 * * 1-5"  # 8 AM weekdays
  delivery:
    - type: email
      template: daily_briefing
    - type: slack
      channel: direct_message
```

## Error Handling
| Error | Response |
|-------|----------|
| No customers assigned | "You don't have any customers assigned yet." |
| Data unavailable | "Some data sources are unavailable. Showing partial results." |
| All healthy | "All accounts are healthy! Consider proactive outreach to: [suggestions]" |

## Success Metrics
| Metric | Target |
|--------|--------|
| Daily Active Usage | > 80% of CSMs |
| Time to First Action | < 30 minutes after briefing |
| Accounts Addressed | > 90% of flagged accounts |
| Risk Signals Resolved | +25% resolution rate |
| Churn Prevention | 15% reduction in at-risk churn |

## Future Enhancements
- Team view for CS managers
- Historical tracking of briefing accuracy
- Custom attention rules per CSM
- Integration with task management systems
- Predictive attention (accounts that WILL need attention)

## Related PRDs
- PRD-056: "Tell Me About [Account]" Command
- PRD-061: At-Risk Portfolio View
- PRD-086: Usage Drop Alert
- PRD-107: Health Score Threshold Alert
- PRD-151: Personal Weekly Summary Report
