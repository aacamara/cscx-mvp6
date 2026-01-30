# PRD-065: Support History Summary

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide a comprehensive summary of a customer's support history including ticket volume, resolution times, common issues, escalations, and sentiment trends. This intelligence helps CSMs understand product friction points, prepare for conversations, and proactively address recurring issues before they impact customer health.

## User Story
As a CSM, I want to see a summary of my customer's support history so that I can understand their pain points, identify patterns, and address issues proactively in my conversations.

As a CS Leader, I want to see support patterns across accounts so that I can identify systemic product issues and coordinate with Product/Engineering teams.

## Trigger
- Navigation: Customer Detail > Support Tab
- Natural language: "Show me support history for [Account]"
- Variations: "What issues has [Account] had?", "Support tickets for [Account]", "Technical problems"

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Time Period | String | No | "30d", "90d", "1y", "all" (default: 90d) |
| Status Filter | String | No | "open", "closed", "all" |
| Priority Filter | String | No | "critical", "high", "medium", "low", "all" |

## Support Metrics
### Volume Metrics
| Metric | Description | Health Indicator |
|--------|-------------|------------------|
| Total Tickets | All-time ticket count | Trend matters |
| Open Tickets | Currently unresolved | < 3 is healthy |
| Tickets/Month | Average monthly volume | Declining = good |
| Ticket Trend | Month-over-month change | Decreasing = good |

### Resolution Metrics
| Metric | Description | Health Indicator |
|--------|-------------|------------------|
| Avg First Response | Time to first agent response | < 4 hours |
| Avg Resolution Time | Time to close ticket | < 24 hours |
| First Contact Resolution | % resolved in one touch | > 60% |
| Reopen Rate | % tickets reopened | < 10% |
| Escalation Rate | % escalated to tier 2+ | < 15% |

### Quality Metrics
| Metric | Description | Health Indicator |
|--------|-------------|------------------|
| CSAT Score | Post-ticket satisfaction | > 4.0/5.0 |
| CES Score | Customer effort score | < 3.0/5.0 |
| NPS (Support) | Support-specific NPS | > 30 |

## Process Flow
```
Request Support Summary
          │
          ▼
┌──────────────────────────┐
│ Fetch Ticket Data        │
│ (Integration or table)   │
└───────────┬──────────────┘
            │
    ┌───────┴───────┬───────────────┬────────────────┐
    ▼               ▼               ▼                ▼
┌──────────┐ ┌───────────┐ ┌─────────────┐ ┌────────────┐
│Volume    │ │Resolution │ │Issue        │ │Satisfaction│
│Analysis  │ │Metrics    │ │Categorization│ │Scores     │
└─────┬────┘ └─────┬─────┘ └──────┬──────┘ └─────┬──────┘
      │            │              │               │
      └────────────┴──────────────┴───────────────┘
                          │
                          ▼
           ┌──────────────────────────┐
           │ AI Analysis: Patterns    │
           │ & Recommendations        │
           └───────────┬──────────────┘
                       │
                       ▼
              Render Summary
```

## Output Format
```markdown
## Support History Summary: Acme Corp
Period: Last 90 Days | Updated: [Timestamp]

### Support Health Score: 75/100 (Good)
[Gauge visualization]

### Quick Stats
| Metric | Value | Trend | vs Peers |
|--------|-------|-------|----------|
| Total Tickets | 12 | ▼ -25% | ● Average |
| Open Tickets | 1 | - | ✓ Good |
| Avg Resolution | 18 hrs | ▲ Improved | ✓ Good |
| CSAT | 4.2/5.0 | ▲ +0.3 | ✓ Above |
| Escalation Rate | 8% | ▼ -5% | ✓ Good |

---

### Open Tickets (1)

| ID | Subject | Priority | Age | Assigned | Status |
|----|---------|----------|-----|----------|--------|
| #4521 | API rate limit errors | High | 2 days | John D. | In Progress |

[View in Support System] [Add to Meeting Agenda]

---

### Ticket Volume Trend
[Line chart: Tickets per month over last 12 months]

- Peak: July 2025 (8 tickets) - Post-upgrade issues
- Current: 4 tickets/month (below average)
- Trend: 25% decrease since Q3

---

### Issue Categories

#### Top Issues (Last 90 Days)
| Category | Tickets | % of Total | Trend |
|----------|---------|------------|-------|
| Integration Issues | 4 | 33% | ▼ Decreasing |
| Report Errors | 3 | 25% | ● Stable |
| Login Problems | 2 | 17% | ▲ Increasing |
| Performance | 2 | 17% | ● Stable |
| Feature Questions | 1 | 8% | - |

[Pie chart visualization]

#### Issue Deep Dive: Integration Issues
- Root Cause: API version mismatch with their system
- Resolution: Provided migration guide, updated docs
- Recommendation: Schedule technical review to prevent recurrence

---

### Resolution Performance

#### By Priority
| Priority | Count | Avg Resolution | Target | Status |
|----------|-------|----------------|--------|--------|
| Critical | 1 | 4 hours | 4 hours | ✓ Met |
| High | 3 | 12 hours | 8 hours | ⚠ Missed |
| Medium | 5 | 24 hours | 24 hours | ✓ Met |
| Low | 3 | 48 hours | 72 hours | ✓ Met |

#### Resolution Timeline
[Distribution chart showing resolution times]

---

### Escalation History

#### Recent Escalations
| Date | Ticket | Issue | Escalated To | Outcome |
|------|--------|-------|--------------|---------|
| Jan 10 | #4498 | Data sync failure | Engineering | Fixed in v2.4.1 |
| Nov 15 | #4321 | Performance degradation | Infrastructure | Scaling applied |

#### Escalation Trend
[Bar chart: Escalations per quarter]
Trend: Declining (from 4 to 1 per quarter)

---

### Satisfaction Metrics

#### CSAT by Ticket
| Ticket | Rating | Comment |
|--------|--------|---------|
| #4512 | 5/5 | "Quick and helpful!" |
| #4498 | 4/5 | "Took a while but resolved" |
| #4485 | 4/5 | "Good documentation shared" |
| #4321 | 3/5 | "Had to escalate" |

Average CSAT: 4.2/5.0 (Above peer average of 3.8)

---

### Key Contacts Submitting Tickets
| Contact | Tickets | Common Issues | Sentiment |
|---------|---------|---------------|-----------|
| Mike Lee | 5 | Integration, API | Neutral |
| Amy Wang | 4 | Reports, Performance | Positive |
| Bob Smith | 3 | Login, Access | Neutral |

---

### AI Analysis & Recommendations

#### Patterns Detected
1. **Integration Issues Cluster**: 4 tickets in last 90 days related to API
   - Likely cause: Customer using legacy API endpoints
   - Recommendation: Schedule API migration workshop

2. **Login Issues Increasing**: 2 recent tickets after none previously
   - Possible cause: SSO configuration drift
   - Recommendation: Verify SSO settings in next call

3. **Mike Lee Frequent Submitter**: 5 of 12 tickets
   - May indicate: Power user hitting edge cases OR frustration
   - Recommendation: Schedule 1:1 technical session

#### Proactive Talking Points for Next Meeting
1. "I noticed some API integration challenges - would a technical deep-dive help?"
2. "We've resolved the rate limit issue - any other performance concerns?"
3. "Your CSAT scores show improvement - what's working well?"

### Actions
[Create Support Review Meeting Agenda] [Export Report] [Share with Support Team]
```

## Acceptance Criteria
- [ ] All ticket metrics calculated correctly
- [ ] Open tickets prominently displayed
- [ ] Issue categorization accurate
- [ ] Trend charts show historical data
- [ ] Escalation history complete
- [ ] CSAT scores displayed per ticket
- [ ] AI analysis provides actionable insights
- [ ] Links to support system functional
- [ ] Filter by time period, status, priority works
- [ ] Export to PDF available

## API Endpoint
```
GET /api/intelligence/support-summary/:customerId
  Query: ?period=90d&status=all

Response: {
  healthScore: number;
  metrics: SupportMetrics;
  openTickets: Ticket[];
  issueCategories: IssueCategory[];
  escalations: Escalation[];
  satisfaction: SatisfactionData;
  aiAnalysis: Analysis;
}
```

## Data Sources
| Source | Integration | Data |
|--------|-------------|------|
| Zendesk | API | Tickets, CSAT |
| Intercom | API | Conversations |
| Freshdesk | API | Tickets, ratings |
| Internal | `support_tickets` table | Fallback storage |
| Meetings | `meeting_analyses` | Support mentions |

## Integration Requirements
- Support platform API access (read-only)
- Webhook for real-time ticket updates
- Historical data sync on initial connection
- Customer ID mapping between systems

## Error Handling
| Error | Response |
|-------|----------|
| No support integration | "Connect your support platform to see ticket history" |
| No tickets found | "No support tickets in the selected period" |
| Integration error | "Unable to fetch support data. Showing cached results." |

## Success Metrics
| Metric | Target |
|--------|--------|
| View Rate Before Calls | > 70% |
| Issue Proactively Addressed | +30% |
| Escalation Prevention | -20% |
| Support-Related Churn | -15% |

## Future Enhancements
- Predictive ticket volume forecasting
- Automated support health alerts
- Direct ticket creation from CSCX
- Support agent collaboration features
- Cross-account issue correlation

## Related PRDs
- PRD-087: Support Ticket Spike Alert
- PRD-102: Support Satisfaction Drop
- PRD-122: Support Ticket → CSM Visibility
- PRD-156: Support Metrics Dashboard
- PRD-184: Zendesk Ticket Integration
