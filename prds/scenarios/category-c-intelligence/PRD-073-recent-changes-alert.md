# PRD-073: Recent Changes Alert

## Category
**Category C: Account Intelligence**

## Priority
**P1** - Core Workflows

## Overview
Provide real-time alerts and a consolidated view of significant changes that have occurred with a customer account, including health score changes, stakeholder movements, usage pattern shifts, contract changes, and risk signal updates. This early warning system ensures CSMs never miss important developments.

## User Story
As a CSM, I want to be alerted immediately when something significant changes with my customer so that I can respond quickly and proactively address issues before they escalate.

As a CS Leader, I want to see change patterns across the portfolio so that I can identify systemic issues and coach CSMs on change response.

## Trigger
- Real-time: Push notification when change detected
- Navigation: Customer Detail > Changes Tab
- Natural language: "What's changed with [Account]?"
- Variations: "Any updates for [Account]?", "Recent changes", "What's new at [Account]?"
- Dashboard: Changes feed widget

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes (for single account) | Account to monitor |
| Time Period | String | No | Look-back period (default: 7 days) |
| Change Types | String[] | No | Filter by change type |
| Severity Filter | String | No | "critical", "high", "medium", "low", "all" |

## Change Types & Severity
### Health & Risk Changes
| Change Type | Severity Criteria | Alert Channel |
|-------------|-------------------|---------------|
| Health Score Drop > 20 | Critical | Push + Email + Slack |
| Health Score Drop > 10 | High | Push + Slack |
| Health Score Drop > 5 | Medium | Slack |
| New Risk Signal (Critical) | Critical | Push + Email + Slack |
| New Risk Signal (High) | High | Push + Slack |
| Risk Signal Resolved | Low (positive) | Slack |

### Stakeholder Changes
| Change Type | Severity Criteria | Alert Channel |
|-------------|-------------------|---------------|
| Champion Departed | Critical | Push + Email + Slack |
| Exec Sponsor Change | High | Push + Slack |
| New Decision Maker | Medium | Slack |
| Contact Info Updated | Low | In-app only |

### Usage Changes
| Change Type | Severity Criteria | Alert Channel |
|-------------|-------------------|---------------|
| Usage Drop > 40% | Critical | Push + Email |
| Usage Drop > 20% | High | Push |
| Usage Spike > 50% | Medium (positive) | Slack |
| No Login > 30 days | High | Push |
| Feature Abandoned | Medium | Slack |

### Contract Changes
| Change Type | Severity Criteria | Alert Channel |
|-------------|-------------------|---------------|
| Renewal < 30 days | Critical | Push + Email |
| Contract Amended | Medium | Slack |
| Expansion Opportunity | Medium (positive) | Slack |
| Payment Overdue | High | Push + Email |

## Change Detection Model
```typescript
interface AccountChange {
  id: string;
  customerId: string;
  changeType: ChangeType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';

  // Change details
  title: string;
  description: string;
  previousValue: any;
  newValue: any;
  changePercent: number;

  // Context
  detectedAt: Date;
  source: string;
  relatedEntity: string;

  // Response tracking
  acknowledged: boolean;
  acknowledgedBy: string;
  acknowledgedAt: Date;
  actionTaken: string;
}

interface ChangeAlert {
  change: AccountChange;
  channels: string[];
  priority: number;
  expiresAt: Date;
  actionRequired: boolean;
  suggestedActions: string[];
}
```

## Output Format
### Real-Time Alert (Push/Slack)
```
ALERT: Health Score Drop - Acme Corp

Health dropped from 72 to 58 (-14 points) in the last 7 days

Top Contributing Factors:
- Usage down 25%
- No login from champion in 14 days
- 2 new support tickets opened

Recommended Actions:
1. Schedule check-in call with champion
2. Review support tickets for root cause

[View Account] [Schedule Call] [Acknowledge]
```

### Changes Tab View
```markdown
## Recent Changes: Acme Corp
Period: Last 7 Days | Unacknowledged: 3

### Change Summary
| Severity | Count | Trend |
|----------|-------|-------|
| Critical | 1 | ▲ New |
| High | 2 | ● Same |
| Medium | 4 | ▼ -1 |
| Low | 2 | ● Same |

---

### Critical Changes (Action Required)

#### Health Score Drop
**Detected**: Jan 28, 2026 at 3:45 PM | **Unacknowledged**

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Health Score | 72 | 58 | -14 pts |
| Usage Score | 75 | 60 | -15 pts |
| Engagement Score | 70 | 55 | -15 pts |

**Analysis**: Significant decline driven by reduced usage and engagement.
Champion (Sarah Chen) last active 14 days ago.

**Recommended Actions**:
1. Urgent: Contact Sarah Chen to check on situation
2. Review support tickets for product issues
3. Prepare save play if decline continues

[Acknowledge] [Schedule Call] [Start Save Play]

---

### High Severity Changes

#### No Champion Login (14 days)
**Detected**: Jan 27, 2026

Sarah Chen (VP Operations) hasn't logged in for 14 days.
Previous pattern: Daily logins

**Possible Causes**:
- Out of office / vacation
- Role change
- Product disengagement

**Action**: Reach out to verify status

[Send Check-in Email] [Acknowledge]

---

#### Support Ticket Spike
**Detected**: Jan 26, 2026

2 new high-priority tickets in 48 hours (vs avg 0.5/week)

| Ticket | Issue | Status |
|--------|-------|--------|
| #4521 | API rate limiting | In Progress |
| #4518 | Report generation errors | Open |

**Correlation**: May explain usage decline

[View Tickets] [Acknowledge]

---

### Medium Severity Changes

| Change | Detected | Status | Action |
|--------|----------|--------|--------|
| Feature adoption: Alerts module activated | Jan 25 | ✓ Positive | None needed |
| New user added: John Smith | Jan 24 | ✓ Positive | Welcome email sent |
| Usage pattern shift: Evening usage up | Jan 23 | ● Neutral | Monitor |
| Meeting rescheduled: QBR moved | Jan 22 | ● Neutral | Calendar updated |

---

### Low Severity Changes

| Change | Detected | Status |
|--------|----------|--------|
| Contact updated: Sarah's phone number | Jan 26 | Logged |
| Document created: Q4 Report | Jan 24 | Logged |

---

### Change Trend (Last 30 Days)
[Timeline visualization showing changes over time]

| Week | Critical | High | Medium | Low | Net Sentiment |
|------|----------|------|--------|-----|---------------|
| Jan 22-28 | 1 | 2 | 4 | 2 | Negative |
| Jan 15-21 | 0 | 0 | 3 | 3 | Positive |
| Jan 8-14 | 0 | 1 | 2 | 2 | Neutral |
| Jan 1-7 | 0 | 0 | 2 | 4 | Positive |

**Insight**: Negative trend started Jan 22. Investigate root cause.

---

### Change Correlation

Changes detected this week appear correlated:
1. Champion stopped logging in (Jan 14)
2. Usage started declining (Jan 18)
3. Support tickets increased (Jan 24)
4. Health score dropped (Jan 28)

**Hypothesis**: Champion may be disengaged or facing internal challenges.
Recommend direct outreach to understand situation.

---

### Alert Preferences

**Current Settings for Acme Corp**:
| Change Type | Alert | Channel |
|-------------|-------|---------|
| Health Drop > 10 | ✓ | Push, Slack |
| Champion Activity | ✓ | Push |
| Support Tickets | ✓ | Slack |
| Usage Changes | ✓ | In-app |

[Modify Alert Settings]

---

### Quick Actions
[Acknowledge All] [Export Changes] [Set Custom Alerts] [View Change History]
```

## Acceptance Criteria
- [ ] Real-time change detection (< 5 min latency)
- [ ] Severity classification accurate
- [ ] Multi-channel alerting works (push, email, Slack)
- [ ] Changes tab shows all recent changes
- [ ] Acknowledge/dismiss functionality works
- [ ] Change correlation analysis provided
- [ ] Alert preferences configurable per account
- [ ] Historical change trend visible
- [ ] Suggested actions provided
- [ ] Export change log available

## API Endpoint
```
GET /api/intelligence/changes/:customerId
  Query: ?period=7d&severity=all&acknowledged=false

POST /api/intelligence/changes/:changeId/acknowledge
  Body: { "actionTaken": "Scheduled call with champion" }

PUT /api/intelligence/alerts/:customerId/preferences
  Body: { "healthDrop": { "threshold": 10, "channels": ["push", "slack"] } }
```

## Data Sources
| Source | Table | Change Detected |
|--------|-------|-----------------|
| Health | `health_score_history` | Score changes |
| Usage | `usage_metrics` | Usage patterns |
| Stakeholders | `stakeholders` | Contact changes |
| Risk | `risk_signals` | New/resolved signals |
| Support | Integration | Ticket activity |
| Contracts | `contracts` | Contract changes |
| Renewals | `renewal_pipeline` | Stage changes |

## Change Detection Engine
```typescript
// Runs on schedule (every 5 minutes) or triggered by events
async function detectChanges(customerId: string) {
  const detectors = [
    healthScoreChangeDetector,
    usagePatternDetector,
    stakeholderChangeDetector,
    riskSignalDetector,
    supportTicketDetector,
    contractChangeDetector,
  ];

  const changes = await Promise.all(
    detectors.map(d => d.detect(customerId))
  );

  return changes.flat().filter(c => c !== null);
}
```

## Alert Delivery
| Channel | Use Case | Latency |
|---------|----------|---------|
| Push Notification | Critical/High severity | < 1 min |
| Email | Critical with details | < 5 min |
| Slack | All acknowledged types | < 1 min |
| In-App | Low severity, FYI | Real-time |

## Success Metrics
| Metric | Target |
|--------|--------|
| Alert Delivery Time | < 5 minutes |
| Alert Acknowledgment Rate | > 90% within 24h |
| False Positive Rate | < 10% |
| Change-to-Action Time | < 4 hours (critical) |
| Churn Prevention (early detection) | +20% |

## Future Enhancements
- Predictive change alerts
- Smart alert bundling (reduce noise)
- Change impact prediction
- Automated response workflows
- Cross-account change patterns

## Related PRDs
- PRD-086: Usage Drop Alert
- PRD-088: Champion Departure Alert
- PRD-107: Health Score Threshold Alert
- PRD-080: Custom Alert Configuration
