# PRD-070: Engagement Score Breakdown

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide a detailed breakdown of the customer engagement score showing all contributing factors, historical trends, and actionable insights for improvement. This transparency helps CSMs understand exactly what's driving engagement levels and take targeted actions to improve customer interaction.

## User Story
As a CSM, I want to understand exactly what factors are contributing to my customer's engagement score so that I can take specific actions to improve engagement in areas where we're underperforming.

As a CS Leader, I want to see engagement patterns across the portfolio so that I can identify systemic engagement issues and develop scalable improvement programs.

## Trigger
- Navigation: Customer Detail > Engagement Tab
- Natural language: "Break down the engagement score for [Account]"
- Variations: "Why is engagement low for [Account]?", "Engagement details", "How engaged is [Account]?"
- Click: Engagement score widget for drill-down

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Time Period | String | No | Analysis period (default: 30 days) |
| Compare Period | String | No | Period for comparison |

## Engagement Score Components
### Communication Engagement
| Factor | Weight | Measurement | Healthy Range |
|--------|--------|-------------|---------------|
| Email Response Rate | 15% | % emails responded to | > 70% |
| Response Time | 10% | Avg hours to respond | < 24 hours |
| Meeting Attendance | 15% | % meetings attended | > 90% |
| Proactive Outreach | 10% | Customer-initiated contact | > 1/month |

### Product Engagement
| Factor | Weight | Measurement | Healthy Range |
|--------|--------|-------------|---------------|
| Login Frequency | 15% | Logins per user/week | > 3 |
| Feature Breadth | 10% | % features used | > 50% |
| Session Duration | 5% | Avg minutes/session | > 15 min |
| Active User % | 10% | Active vs total users | > 70% |

### Relationship Engagement
| Factor | Weight | Measurement | Healthy Range |
|--------|--------|-------------|---------------|
| Stakeholder Depth | 5% | Multi-threading score | > 3 contacts |
| Executive Access | 3% | Exec engagement level | Quarterly contact |
| Champion Activity | 2% | Champion engagement | Monthly contact |

## Engagement Score Calculation
```typescript
interface EngagementScore {
  overall: number;  // 0-100
  components: {
    communication: {
      score: number;
      weight: number;
      factors: EngagementFactor[];
    };
    product: {
      score: number;
      weight: number;
      factors: EngagementFactor[];
    };
    relationship: {
      score: number;
      weight: number;
      factors: EngagementFactor[];
    };
  };
  trend: 'improving' | 'stable' | 'declining';
  riskFactors: string[];
  recommendations: string[];
}

interface EngagementFactor {
  name: string;
  current: number;
  target: number;
  weight: number;
  contribution: number;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'flat' | 'down';
}
```

## Output Format
```markdown
## Engagement Score Breakdown: Acme Corp
Period: Last 30 Days | Updated: [Timestamp]

### Overall Engagement Score: 72/100
[Gauge visualization with segments for each component]

**Trend**: ▲ +5 from last period | **Status**: Good

### Score Composition
| Component | Score | Weight | Contribution | Status |
|-----------|-------|--------|--------------|--------|
| Communication | 78/100 | 50% | 39 pts | ● Good |
| Product | 65/100 | 40% | 26 pts | ⚠ Fair |
| Relationship | 70/100 | 10% | 7 pts | ● Good |
| **Total** | | **100%** | **72 pts** | |

[Stacked bar visualization of score composition]

---

### Communication Engagement (78/100)

| Factor | Current | Target | Score | Weight | Status | Trend |
|--------|---------|--------|-------|--------|--------|-------|
| Email Response Rate | 82% | 70% | 100 | 15% | ✓ | ▲ |
| Response Time | 18 hrs | 24 hrs | 100 | 10% | ✓ | ▲ |
| Meeting Attendance | 85% | 90% | 94 | 15% | ● | ▼ |
| Proactive Outreach | 2/mo | 1/mo | 100 | 10% | ✓ | ● |

**Highlights**:
- ✓ Excellent email responsiveness (82% vs 70% target)
- ✓ Customer initiated 2 conversations this month
- ⚠ Meeting attendance dipped (1 no-show)

**Actions**:
- Send calendar reminders day before meetings
- Acknowledge their proactive engagement

---

### Product Engagement (65/100)

| Factor | Current | Target | Score | Weight | Status | Trend |
|--------|---------|--------|-------|--------|--------|-------|
| Login Frequency | 2.1/week | 3/week | 70 | 15% | ⚠ | ▼ |
| Feature Breadth | 45% | 50% | 90 | 10% | ● | ▲ |
| Session Duration | 12 min | 15 min | 80 | 5% | ● | ● |
| Active User % | 58% | 70% | 83 | 10% | ⚠ | ▼ |

**Highlights**:
- ⚠ Login frequency below target (2.1 vs 3/week)
- ⚠ Active users declining (was 65% last month)
- ▲ Feature breadth improving (45% up from 42%)

**Root Cause Analysis**:
Based on usage patterns, the decline appears related to:
1. 3 power users on holiday in past 2 weeks
2. Feature requests pending (users waiting for capability)

**Actions**:
1. Schedule usage review meeting
2. Address top feature request status
3. Identify inactive users for re-engagement

[View Inactive Users] [Schedule Usage Review]

---

### Relationship Engagement (70/100)

| Factor | Current | Target | Score | Weight | Status | Trend |
|--------|---------|--------|-------|--------|--------|-------|
| Stakeholder Depth | 4 contacts | 3+ contacts | 100 | 5% | ✓ | ● |
| Executive Access | 60 days ago | Quarterly | 67 | 3% | ⚠ | ▼ |
| Champion Activity | Monthly | Monthly | 100 | 2% | ✓ | ● |

**Highlights**:
- ✓ Good multi-threading (4 engaged stakeholders)
- ⚠ Exec sponsor not contacted in 60 days
- ✓ Champion (Sarah) engaged weekly

**Actions**:
- Schedule exec check-in (overdue by 30 days)

[Schedule Exec Meeting]

---

### Engagement Trend
[Line chart showing overall score and components over last 6 months]

| Month | Communication | Product | Relationship | Overall |
|-------|---------------|---------|--------------|---------|
| Aug | 72 | 70 | 68 | 71 |
| Sep | 75 | 68 | 70 | 71 |
| Oct | 78 | 72 | 72 | 74 |
| Nov | 80 | 68 | 70 | 73 |
| Dec | 76 | 62 | 68 | 68 |
| Jan | 78 | 65 | 70 | 72 |

**Pattern Analysis**:
- Communication consistently strong
- Product engagement volatile (holiday impact visible)
- Relationship stable but exec engagement lagging

---

### Peer Comparison

| Factor | Acme Corp | Peer Avg | Percentile |
|--------|-----------|----------|------------|
| Overall | 72 | 68 | 65th |
| Communication | 78 | 70 | 75th |
| Product | 65 | 66 | 48th |
| Relationship | 70 | 68 | 55th |

**Insight**: Above average on communication, below on product engagement

---

### Impact Analysis

**If engagement improves to 85:**
- Renewal probability: +15%
- Expansion likelihood: +25%
- Reference potential: High

**If engagement drops to 60:**
- Churn risk: +40%
- Health score impact: -12 points
- Save play may be needed

---

### Recommended Actions (Priority Order)

1. **Product Engagement** (Highest Impact)
   - Re-engage inactive users with personalized outreach
   - Schedule feature training for underutilized capabilities
   - [Create Re-engagement Campaign]

2. **Executive Relationship**
   - Schedule quarterly check-in with Tom Williams
   - [Draft Exec Meeting Request]

3. **Meeting Attendance**
   - Add calendar reminders for all attendees
   - Consider recording options for busy stakeholders

---

### Quick Actions
[Schedule Engagement Review] [Export Breakdown] [Set Alerts] [Compare Periods]
```

## Acceptance Criteria
- [ ] Overall engagement score displayed (0-100)
- [ ] All component scores broken down
- [ ] Individual factor details shown
- [ ] Trend comparison to previous period
- [ ] Peer comparison available
- [ ] Root cause analysis for low factors
- [ ] Actionable recommendations generated
- [ ] Historical trend chart displayed
- [ ] Impact analysis for score changes
- [ ] Quick actions functional

## API Endpoint
```
GET /api/intelligence/engagement/:customerId
  Query: ?period=30d&comparePeriod=previous

Response: {
  overall: EngagementScore;
  components: ComponentBreakdown;
  factors: EngagementFactor[];
  trend: TrendData;
  peerComparison: PeerComparison;
  recommendations: Recommendation[];
}
```

## Data Sources
| Source | Table/API | Data |
|--------|-----------|------|
| Communication | Gmail, Calendar | Response rates, attendance |
| Product | `usage_metrics` | Logins, features, sessions |
| Relationship | `stakeholders` | Contact depth, recency |
| History | `engagement_history` | Historical scores |
| Peers | Aggregated data | Benchmark comparison |

## Alert Triggers
| Condition | Alert | Priority |
|-----------|-------|----------|
| Score drops > 10 pts | CSM notification | High |
| Any component < 50 | CSM notification | Medium |
| Score < 50 | CSM + Manager alert | Critical |

## Success Metrics
| Metric | Target |
|--------|--------|
| Engagement Score Visibility | > 90% of CSMs check weekly |
| Score Improvement (actioned accounts) | +10 pts in 60 days |
| Low Engagement → Action | < 48 hours response |
| Engagement-Churn Correlation | Validate r > 0.6 |

## Future Enhancements
- Real-time engagement scoring
- Automated engagement playbooks
- Customer-facing engagement portal
- Predictive engagement modeling
- Gamification of engagement improvement

## Related PRDs
- PRD-069: Account Success Metrics
- PRD-064: Product Adoption Dashboard
- PRD-157: Engagement Metrics Report
- PRD-106: Quiet Account Alert
