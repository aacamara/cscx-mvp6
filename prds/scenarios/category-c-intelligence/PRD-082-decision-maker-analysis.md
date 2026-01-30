# PRD-082: Decision Maker Analysis

## Metadata
- **PRD ID**: PRD-082
- **Category**: C - Account Intelligence
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: PRD-063 (Stakeholder Relationship Map)

## Scenario Description
CSMs need to identify and understand the key decision makers within customer organizations, including their influence levels, priorities, and relationships. The system should analyze stakeholder data to surface decision-making patterns and recommend engagement strategies.

## User Story
**As a** CSM preparing for a renewal negotiation,
**I want to** understand who the key decision makers are,
**So that** I can tailor my approach and ensure the right people are engaged.

## Trigger
- CSM types: "Who are the decision makers at [customer]?"
- CSM asks: "Analyze decision makers for [customer] renewal"
- Automated analysis before renewal milestone

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Stakeholders | `stakeholders` table | Implemented | Stores contact info and roles |
| Engagement tracking | `engagement_events` table | Implemented | Interaction history |
| Meeting attendees | `meetings.attendees` | Implemented | Who attends meetings |
| Researcher agent | `specialists/researcher.ts` | Implemented | Can gather intelligence |

### What's Missing
- [ ] Decision maker scoring algorithm
- [ ] Influence network visualization
- [ ] Decision pattern analysis
- [ ] Engagement gap identification
- [ ] Recommended engagement actions
- [ ] Historical decision outcome tracking

## Detailed Workflow

### Step 1: Stakeholder Analysis
- Gather all stakeholders for customer
- Enrich with external data (LinkedIn, company news)
- Identify roles and reporting relationships

### Step 2: Influence Scoring
- Analyze meeting attendance patterns
- Track email response rates
- Evaluate contract signing authority
- Score each stakeholder's influence level

### Step 3: Gap Analysis
- Identify under-engaged decision makers
- Flag missing executive relationships
- Highlight risk from single-threaded relationships

### Step 4: Recommendations
- Suggest engagement priorities
- Recommend introduction strategies
- Propose meeting agendas focused on decision makers

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/intelligence/decisionMakers.ts` | Create | Decision maker analysis |
| `server/src/agents/specialists/researcher.ts` | Modify | Add decision maker research |
| `components/CustomerDetail/DecisionMakers.tsx` | Create | Decision maker UI |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/customers/:id/decision-makers` | GET | Get decision maker analysis |
| `POST /api/customers/:id/decision-makers/refresh` | POST | Trigger fresh analysis |

### Database Changes
```sql
ALTER TABLE stakeholders ADD COLUMN influence_score INTEGER;
ALTER TABLE stakeholders ADD COLUMN decision_authority VARCHAR(50);
ALTER TABLE stakeholders ADD COLUMN engagement_score INTEGER;
ALTER TABLE stakeholders ADD COLUMN last_analyzed_at TIMESTAMPTZ;
```

## Chat UI Flow
```
CSM: Who are the decision makers at Acme Corp for their renewal?
System: Analyzing decision makers at Acme Corp...

**Key Decision Makers for Renewal:**

1. **Sarah Chen** - VP of Operations (Primary)
   - Influence Score: 95/100
   - Decision Authority: Budget Approval
   - Last Engaged: 2 weeks ago
   - Status: ✅ Strong Relationship

2. **Michael Torres** - CFO (Economic Buyer)
   - Influence Score: 90/100
   - Decision Authority: Contract Signing
   - Last Engaged: 6 weeks ago
   - Status: ⚠️ Needs Engagement

3. **Jennifer Park** - Director of IT (Technical)
   - Influence Score: 75/100
   - Decision Authority: Technical Approval
   - Last Engaged: 1 week ago
   - Status: ✅ Champion

**Recommendations:**
- Schedule executive briefing with Michael Torres (CFO)
- Prepare ROI summary for budget justification
- Leverage Jennifer as internal champion

[Schedule Meeting with CFO] [Generate ROI Summary] [View Full Analysis]
```

## Acceptance Criteria
- [ ] Identify all stakeholders with decision-making authority
- [ ] Score influence level based on multiple factors
- [ ] Track engagement recency and quality
- [ ] Flag engagement gaps with key decision makers
- [ ] Provide actionable recommendations
- [ ] Support for multi-threaded relationship mapping
- [ ] Integration with LinkedIn for data enrichment

## Ralph Loop Notes
- **Learning**: Track which decision maker engagements lead to successful outcomes
- **Optimization**: Improve influence scoring based on actual deal outcomes
- **Personalization**: Learn customer's organizational patterns over time

### Completion Signal
```
<promise>PRD-082-COMPLETE</promise>
```
