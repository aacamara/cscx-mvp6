# PRD-064: Product Adoption Dashboard

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide a comprehensive dashboard showing product adoption metrics for a customer account, including feature utilization, user engagement, adoption trends, and comparison to similar customers. This dashboard enables CSMs to identify adoption gaps, target enablement efforts, and demonstrate value to stakeholders.

## User Story
As a CSM, I want to see which features my customer is using and which they're not so that I can proactively offer training on underutilized features and demonstrate ROI through adoption metrics.

As a CS Leader, I want to see adoption patterns across the portfolio so that I can identify common adoption challenges and create scalable enablement programs.

## Trigger
- Navigation: Customer Detail > Adoption Tab
- Natural language: "Show me product adoption for [Account]"
- Variations: "How is [Account] using the product?", "Feature adoption", "Usage breakdown"

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Time Period | String | No | "7d", "30d", "90d", "all" (default: 30d) |
| Comparison | String | No | "peers", "segment", "all_customers" |

## Adoption Metrics
### User Adoption
| Metric | Calculation | Health Threshold |
|--------|-------------|------------------|
| DAU | Daily Active Users | Industry-specific |
| WAU | Weekly Active Users | Industry-specific |
| MAU | Monthly Active Users | > 70% of licensed |
| User Activation | Users logged in at least once | > 95% |
| Power Users | Users in top 20% by usage | > 10% of base |
| Dormant Users | No login in 30+ days | < 10% of base |
| Login Frequency | Avg logins/user/week | > 3 |
| Session Duration | Avg time in product | Industry-specific |

### Feature Adoption
| Metric | Calculation | Health Threshold |
|--------|-------------|------------------|
| Feature Breadth | % of features used | > 50% |
| Core Feature Usage | Usage of must-have features | 100% |
| Advanced Feature Usage | Usage of power features | > 30% |
| Feature Stickiness | Features used repeatedly | > 60% |
| Time to Feature | Days to first use | < 14 days |

### Engagement Depth
| Metric | Calculation | Health Threshold |
|--------|-------------|------------------|
| Actions per Session | Avg actions taken | > 15 |
| API Usage | API calls/day | Entitlement-based |
| Integration Usage | Connected integrations | > 2 |
| Content Created | Reports, dashboards, etc. | Growing |
| Collaboration | Multi-user workflows | > 20% of sessions |

## Process Flow
```
Request Adoption Dashboard
            │
            ▼
┌──────────────────────────┐
│ Fetch Usage Metrics      │
│ (usage_metrics table)    │
└───────────┬──────────────┘
            │
    ┌───────┴───────┬───────────────┬────────────────┐
    ▼               ▼               ▼                ▼
┌──────────┐ ┌───────────┐ ┌─────────────┐ ┌────────────┐
│User      │ │Feature    │ │Entitlement │ │Peer        │
│Metrics   │ │Usage      │ │Comparison  │ │Benchmarks  │
└─────┬────┘ └─────┬─────┘ └──────┬──────┘ └─────┬──────┘
      │            │              │               │
      └────────────┴──────────────┴───────────────┘
                          │
                          ▼
           ┌──────────────────────────┐
           │ Calculate Adoption       │
           │ Score & Trends           │
           └───────────┬──────────────┘
                       │
                       ▼
           ┌──────────────────────────┐
           │ Generate Recommendations │
           │ (Gaps & Opportunities)   │
           └───────────┬──────────────┘
                       │
                       ▼
              Render Dashboard
```

## Output Format
```markdown
## Product Adoption Dashboard: Acme Corp
Period: Last 30 Days | Updated: [Timestamp]

### Adoption Score: 72/100 (Good)
Trend: ▲ +5 from last month

[Gauge visualization: 72/100]

### Adoption vs Entitlement
| Metric | Used | Entitled | Utilization |
|--------|------|----------|-------------|
| Users | 145 | 200 | 73% |
| API Calls/day | 8,500 | 10,000 | 85% |
| Storage (GB) | 42 | 100 | 42% |
| Integrations | 3 | Unlimited | - |

---

### User Engagement

#### Active Users
| Metric | Value | vs Last Period | vs Peers |
|--------|-------|----------------|----------|
| DAU | 89 | ▲ +12% | ▲ Above |
| WAU | 128 | ▲ +8% | ● Average |
| MAU | 145 | ▲ +5% | ● Average |
| Power Users | 18 (12%) | ▲ +3 | ▲ Above |

[Line chart: Active users over time]

#### User Health
| Status | Count | % of Total |
|--------|-------|------------|
| Active (7d) | 89 | 61% |
| Engaged (8-14d) | 28 | 19% |
| At Risk (15-30d) | 18 | 12% |
| Dormant (>30d) | 10 | 7% |

**Dormant Users Alert**: 10 users haven't logged in 30+ days
[View List] [Export] [Create Re-engagement Campaign]

---

### Feature Adoption

#### Feature Matrix
| Feature | Adopted | Usage | Health |
|---------|---------|-------|--------|
| Dashboard | ✓ | 89% of users | ● |
| Reports | ✓ | 72% of users | ● |
| Alerts | ✓ | 45% of users | ● |
| API | ✓ | 15% of users | ● |
| Analytics | ✗ | 8% of users | ⚠ |
| Automations | ✗ | 3% of users | ⚠ |
| Mobile App | ✗ | 0% of users | ⚠ |

#### Feature Adoption Journey
[Funnel visualization]
Core Features: 92% → Advanced: 45% → Power: 18%

#### Unused Features (Opportunity)
| Feature | Peer Usage | Value Prop | Action |
|---------|------------|------------|--------|
| Analytics | 65% | 30% efficiency gain | [Schedule Training] |
| Automations | 58% | 5hrs/week saved | [Send Guide] |
| Mobile App | 42% | Faster response | [Share Download Link] |

---

### Engagement Trends

#### Usage Patterns
[Heatmap: Usage by day of week and hour]

Peak Usage: Tuesday-Thursday, 9am-11am
Weekend Usage: Low (5% of weekday)

#### Growth Trajectory
[Area chart: Usage growth over time with milestones marked]

Key Milestones:
- Week 2: Core features adopted
- Week 6: API integration completed
- Week 10: First custom report created

---

### Peer Comparison

#### vs Similar Customers (Enterprise, SaaS)
| Metric | Acme Corp | Peer Avg | Percentile |
|--------|-----------|----------|------------|
| Adoption Score | 72 | 68 | 65th |
| Feature Breadth | 58% | 52% | 70th |
| User Activation | 73% | 78% | 45th |
| API Usage | High | Medium | 80th |

**Insight**: Above average on features, below on user activation.
Consider: User onboarding refresh to improve activation rate.

---

### Recommendations

#### Immediate Actions
1. **Re-engage Dormant Users**: 10 users inactive >30 days
   - [Create Re-engagement Campaign] [Export List]

2. **Analytics Feature Training**: Only 8% adoption vs 65% peer avg
   - [Schedule Training Session] [Send Self-Service Guide]

3. **Mobile Adoption**: 0% usage of mobile app
   - [Share App Download Links] [Highlight Mobile Benefits]

#### Value Demonstration
- Users saved estimated 120 hours/month using current features
- Top benefit: Dashboard reduced reporting time by 60%
- [Generate Adoption Report for Customer]
```

## Acceptance Criteria
- [ ] All user metrics displayed (DAU, WAU, MAU, etc.)
- [ ] Feature adoption matrix shows all features
- [ ] Peer comparison calculated accurately
- [ ] Trend charts show historical data
- [ ] Dormant user list accessible
- [ ] Unused feature recommendations generated
- [ ] Export adoption report to PDF
- [ ] Quick actions (schedule training, send guide) functional
- [ ] Time period filter works
- [ ] Real-time data (< 24 hour lag)

## API Endpoint
```
GET /api/intelligence/adoption/:customerId
  Query: ?period=30d&comparison=peers

Response: {
  adoptionScore: number;
  userMetrics: UserMetrics;
  featureAdoption: FeatureAdoption[];
  peerComparison: PeerComparison;
  recommendations: Recommendation[];
  trends: TrendData;
}
```

## Data Sources
| Source | Table | Data |
|--------|-------|------|
| Usage | `usage_metrics` | Aggregated metrics |
| Events | `usage_events` | Detailed events |
| Entitlements | `entitlements` | Licensed limits |
| Contracts | `contracts` | Contract details |
| Customers | `customers` | Segment for peers |
| Features | Product catalog | Feature list |

## Adoption Score Calculation
```typescript
const adoptionScore = (
  userActivation * 0.25 +      // % users logged in
  featureBreadth * 0.25 +      // % features used
  engagementDepth * 0.20 +     // Actions per session
  usageTrend * 0.15 +          // Growth direction
  entitlementUtilization * 0.15 // % of entitlements used
);
```

## Success Metrics
| Metric | Target |
|--------|--------|
| Dashboard Views/CSM/Week | > 10 |
| Training Sessions Scheduled | +30% |
| Feature Adoption Improvement | +15% after training |
| Adoption Score Portfolio Avg | > 70 |
| Dormant User Recovery | > 40% |

## Future Enhancements
- Individual user adoption journey
- Cohort analysis (users by signup date)
- Feature recommendation engine
- Automated adoption-based playbooks
- In-app guidance integration (Pendo, WalkMe)

## Related PRDs
- PRD-006: Usage Data Upload
- PRD-069: Account Success Metrics
- PRD-070: Engagement Score Breakdown
- PRD-090: Feature Adoption Stalled Alert
- PRD-159: Product Adoption Report
