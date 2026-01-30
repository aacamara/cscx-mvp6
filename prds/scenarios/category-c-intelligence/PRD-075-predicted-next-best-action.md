# PRD-075: Predicted Next Best Action

## Category
**Category C: Account Intelligence**

## Priority
**P0** - Foundation Tier

## Overview
Leverage AI and data analysis to predict and recommend the most impactful next action a CSM should take with each customer account. This intelligent recommendation engine considers health signals, engagement patterns, lifecycle stage, historical effectiveness, and current context to surface prioritized actions with expected impact.

## User Story
As a CSM, I want the system to tell me the single most impactful thing I should do next for each customer so that I can maximize my effectiveness and ensure I'm always focusing on the highest-value activities.

As a CS Leader, I want AI-driven action recommendations across the team so that we can optimize CSM effectiveness and ensure consistent, data-driven customer engagement.

## Trigger
- Dashboard: "Next Best Actions" widget on home
- Customer Detail: Top recommendation card
- Natural language: "What should I do next for [Account]?"
- Variations: "Best action for [Account]", "What's the priority for [Account]?", "Recommend action"
- Daily digest: Top 5 recommended actions

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | No | Specific account (or all portfolio) |
| Action Category | String | No | Filter: "engagement", "risk", "expansion" |
| Time Horizon | String | No | "today", "this_week", "this_month" |

## Action Categories
### Engagement Actions
| Action | Trigger Conditions | Expected Outcome |
|--------|-------------------|------------------|
| Check-in call | No contact > 21 days | Re-establish connection |
| Send value update | Quarterly, post-milestone | Reinforce value |
| Share content | Usage pattern indicates need | Drive adoption |
| Schedule training | Low feature adoption | Increase usage |
| Request feedback | Post-milestone, renewal prep | Gather insights |

### Risk Mitigation Actions
| Action | Trigger Conditions | Expected Outcome |
|--------|-------------------|------------------|
| Outreach to champion | Champion inactive | Prevent disengagement |
| Escalation call | Health drop > 15 | Address issues |
| Start save play | Critical risk signals | Prevent churn |
| Executive alignment | Exec sponsor inactive | Strengthen relationship |
| Address support issues | Ticket pattern detected | Resolve friction |

### Expansion Actions
| Action | Trigger Conditions | Expected Outcome |
|--------|-------------------|------------------|
| Expansion discussion | Positive signals detected | Grow account |
| Department introduction | White space identified | Expand footprint |
| Upsell proposal | At capacity, high health | Increase ARR |
| Renewal optimization | Renewal approaching | Maximize retention |
| Multi-year offer | Strong health, expansion | Secure commitment |

### Lifecycle Actions
| Action | Trigger Conditions | Expected Outcome |
|--------|-------------------|------------------|
| Kickoff scheduling | New customer | Start engagement |
| Onboarding checkpoint | Week 2, 4, 8 | Ensure progress |
| QBR preparation | QBR approaching | Deliver value review |
| Renewal preparation | 90 days before renewal | Secure renewal |
| Success review | Anniversary, milestone | Document value |

## Next Best Action Model
```typescript
interface NextBestAction {
  id: string;
  customerId: string;
  customerName: string;

  // Action details
  action: string;
  category: 'engagement' | 'risk' | 'expansion' | 'lifecycle';
  description: string;
  urgency: 'immediate' | 'today' | 'this_week' | 'this_month';

  // Scoring
  impactScore: number;        // 0-100: Expected positive impact
  confidenceScore: number;    // 0-100: Model confidence
  priorityScore: number;      // Combined score for ranking

  // Context
  reasoning: string[];        // Why this action
  signals: Signal[];          // Data points driving recommendation
  expectedOutcome: string;    // What success looks like

  // Execution
  suggestedApproach: string;  // How to execute
  talkingPoints: string[];    // What to say
  resources: Resource[];      // Templates, docs, etc.

  // Tracking
  status: 'recommended' | 'accepted' | 'completed' | 'dismissed';
  completedAt: Date | null;
  outcome: string | null;
}

interface Signal {
  type: string;
  value: any;
  weight: number;
  description: string;
}
```

## Priority Score Calculation
```typescript
const priorityScore = (
  impactScore * 0.35 +           // How much will this help?
  urgencyScore * 0.30 +          // How time-sensitive?
  confidenceScore * 0.20 +       // How sure are we?
  accountValueWeight * 0.15      // How valuable is the account?
);

// Factors influencing impact score:
// - Historical effectiveness of similar actions
// - Account health trajectory
// - Relationship strength
// - Business context (renewal timing, etc.)
```

## Output Format
### Portfolio View (Dashboard)
```markdown
## Your Next Best Actions
Updated: [Timestamp]

### Immediate (Do Now)

#### 1. Outreach to Champion - Beta Inc
**Priority Score**: 95/100 | **Impact**: High | **ARR**: $120,000

**Why This Action**:
- Champion Sarah hasn't logged in for 14 days
- Health score dropped 12 points this week
- Usage down 25% in same period
- Renewal in 60 days

**Approach**:
Call Sarah directly. Ask about her experience lately - don't lead with product.
Check if anything has changed on her end (team changes, priorities).

**Talking Points**:
1. "I noticed you've been quieter lately - wanted to check in"
2. "Is there anything we can help with?"
3. "We have some new features that might help with [their use case]"

**Expected Outcome**: Re-engage champion, identify root cause of decline

[Accept & Execute] [Schedule Call] [Defer] [Dismiss]

---

#### 2. Start Renewal Conversation - Alpha Corp
**Priority Score**: 88/100 | **Impact**: High | **ARR**: $200,000

**Why This Action**:
- Renewal in 85 days (optimal timing to start)
- Health score strong (82)
- Expansion opportunity identified ($30K)
- Champion relationship excellent

**Approach**:
Position as strategic planning conversation, not renewal negotiation.
Lead with value delivered, then discuss future goals.

**Expected Outcome**: Secure renewal commitment, surface expansion needs

[Accept & Execute] [Schedule Meeting] [Defer]

---

### Today (Before End of Day)

| # | Action | Account | Impact | ARR | Quick Action |
|---|--------|---------|--------|-----|--------------|
| 3 | Send value recap | Gamma Ltd | Medium | $85K | [Send Email] |
| 4 | Review support tickets | Delta Co | Medium | $65K | [View Tickets] |
| 5 | Schedule training | Epsilon | Medium | $45K | [Propose Time] |

---

### This Week

| # | Action | Account | Impact | Due | Status |
|---|--------|---------|--------|-----|--------|
| 6 | QBR preparation | Zeta Inc | High | Thu | Pending |
| 7 | Expansion proposal | Eta Corp | Medium | Fri | Draft ready |
| 8 | Stakeholder mapping | Theta | Medium | Fri | Not started |

---

### Action Effectiveness

**Your Last 30 Days**:
| Actions Completed | Success Rate | Avg Impact |
|-------------------|--------------|------------|
| 24 | 83% | +8 health pts |

**Top Performing Actions**:
1. Champion check-ins: 92% effective
2. Training sessions: 88% effective
3. Value recaps: 75% effective
```

### Single Account View
```markdown
## Next Best Action: Acme Corp

### Recommended: Schedule QBR Preparation Call
**Priority**: 92/100 | **Category**: Lifecycle | **Urgency**: This Week

---

**Why This Action Now**:

1. **Timing**: QBR scheduled for Feb 15 (18 days away)
2. **Preparation Gap**: No prep meeting scheduled yet
3. **Stakeholder Input**: Haven't gathered customer objectives
4. **Content Needs**: QBR deck not started

**Signals Driving Recommendation**:
| Signal | Value | Impact |
|--------|-------|--------|
| Days to QBR | 18 | High |
| Prep meeting scheduled | No | High |
| Customer objectives gathered | No | Medium |
| QBR deck status | Not started | Medium |
| Historical QBR effectiveness | 85% | Confidence boost |

---

**Recommended Approach**:

**Step 1: Reach out to Champion**
Send email proposing 30-min prep call this week.
Template: [QBR Prep Request Email]

**Step 2: Gather Objectives**
On the call, ask:
- What are your top priorities for next quarter?
- What have we done well? Where can we improve?
- Who should attend the QBR?

**Step 3: Build Agenda**
Based on input, create:
- Value delivered summary
- Success metrics review
- Roadmap alignment
- Next quarter goals

---

**Alternative Actions** (if this doesn't fit):

| Action | Priority | Reason |
|--------|----------|--------|
| Send value summary | 78 | If can't get meeting, share async |
| Review usage data | 65 | Inform QBR content |
| Check expansion signals | 60 | Add to QBR discussion |

---

**Resources**:
- [QBR Prep Email Template]
- [QBR Agenda Template]
- [Value Summary Generator]

[Execute Action] [Mark Complete] [Dismiss with Reason]
```

## Acceptance Criteria
- [ ] Recommendations generated for all portfolio accounts
- [ ] Priority scoring accurate and explainable
- [ ] Reasoning clearly articulated for each action
- [ ] Talking points specific to customer context
- [ ] Accept/dismiss tracking works
- [ ] Outcome tracking after completion
- [ ] Action effectiveness learning loop
- [ ] Resource links functional
- [ ] Daily digest delivery works
- [ ] Filter by category/urgency works

## API Endpoint
```
GET /api/intelligence/next-best-action
  Query: ?customerId=uuid&category=all&limit=10

POST /api/intelligence/next-best-action/:actionId/accept

POST /api/intelligence/next-best-action/:actionId/complete
  Body: { "outcome": "Scheduled QBR prep for Feb 8" }

POST /api/intelligence/next-best-action/:actionId/dismiss
  Body: { "reason": "Already addressed via other channel" }
```

## Data Sources
| Source | Table | Usage |
|--------|-------|-------|
| Customers | `customers` | Account context |
| Health | `health_score_history` | Health signals |
| Usage | `usage_metrics` | Usage patterns |
| Meetings | `meetings` | Contact recency |
| Actions | `agent_activity_log` | Past action effectiveness |
| Renewals | `renewal_pipeline` | Lifecycle stage |
| Risk | `risk_signals` | Risk indicators |

## Machine Learning Model
```typescript
// Features for action recommendation
const features = {
  accountFeatures: [
    'health_score', 'health_trend', 'usage_trend',
    'days_since_contact', 'days_to_renewal',
    'arr', 'segment', 'industry'
  ],
  historicalFeatures: [
    'past_action_success_rate',
    'action_type_effectiveness',
    'csm_action_patterns'
  ],
  contextualFeatures: [
    'current_risk_signals',
    'expansion_signals',
    'stakeholder_engagement',
    'support_ticket_pattern'
  ]
};

// Model outputs ranked actions with confidence scores
```

## Feedback Loop
- Track action acceptance rate
- Measure outcome after completion
- Learn from dismissed actions
- Improve model based on success patterns

## Success Metrics
| Metric | Target |
|--------|--------|
| Action Acceptance Rate | > 70% |
| Action Completion Rate | > 85% of accepted |
| Positive Outcome Rate | > 75% |
| Time to Action | < 24 hours (immediate) |
| Portfolio Health Improvement | +10% avg |

## Future Enhancements
- Auto-execution of low-risk actions
- Multi-action sequencing
- Team action coordination
- Real-time action updates
- Personalized CSM action preferences

## Related PRDs
- PRD-057: "What Accounts Need Attention?" Briefing
- PRD-214: Intelligent Task Prioritization
- PRD-232: Automated Playbook Selection
- PRD-226: Smart Follow-Up Timing
