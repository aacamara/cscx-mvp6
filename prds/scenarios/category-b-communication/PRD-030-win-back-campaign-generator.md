# PRD-030: Win-Back Campaign Generator

## Metadata
- **PRD ID**: PRD-030
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: Gmail Integration, Sequence Engine, Churned Customer Data

## Scenario Description
A CSM wants to re-engage a churned customer or one who has gone dormant. The system generates a personalized win-back campaign sequence that acknowledges the past relationship, addresses likely reasons for departure, highlights relevant improvements since they left, and offers compelling reasons to return.

## User Story
**As a** CSM using the Chat UI,
**I want to** generate a win-back email campaign for former customers,
**So that** I can systematically attempt to recover lost revenue with personalized outreach.

## Trigger
- CSM types: "Create win-back campaign for [customer]" or "Re-engage [churned customer]"
- Quarterly review of churned customers
- Product update that addresses known churn reasons

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer stage tracking | `customers` table | Implemented | `stage` can be "churned" |
| Historical data | Multiple tables | Implemented | Past interactions preserved |
| Email sequences | Concept | Partial | Basic trigger automation exists |
| Gmail integration | `server/src/services/google/gmail.ts` | Implemented | Email sending |

### What's Missing
- [ ] Win-back email templates
- [ ] Churn reason tracking and analysis
- [ ] Product improvement changelog integration
- [ ] Win-back campaign sequence builder
- [ ] Re-engagement tracking and scoring
- [ ] Win-back success metrics

## Detailed Workflow

### Step 1: Customer Analysis
- Review churn history and documented reasons
- Analyze usage patterns before departure
- Check product updates since customer left
- Identify relevant new features/improvements

### Step 2: Campaign Strategy
- Select win-back approach (product update, special offer, relationship, case study)
- Determine campaign length and touchpoints
- Identify best contact(s) still at company

### Step 3: Sequence Generation
- Generate 3-5 email sequence
- Personalize with customer history and pain points
- Include relevant product updates
- Craft compelling re-engagement offer

### Step 4: Execution
- Schedule sequence with appropriate intervals
- Track engagement (opens, clicks, replies)
- Adjust based on response signals
- Escalate warm leads to sales

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/sequences/winBackSequence.ts` | Create | Win-back campaign generator |
| `server/src/templates/emails/winback-day1.ts` | Create | Initial re-engagement email |
| `server/src/templates/emails/winback-day7.ts` | Create | Value reminder email |
| `server/src/templates/emails/winback-day14.ts` | Create | Case study/social proof email |
| `server/src/templates/emails/winback-day21.ts` | Create | Special offer email |
| `server/src/templates/emails/winback-final.ts` | Create | Final attempt email |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/winback-campaign` | POST | Create win-back campaign |
| `GET /api/customers/churned` | GET | List churned customers for targeting |
| `GET /api/winback/success-rate` | GET | Win-back campaign analytics |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `customers` | Add column | `churned_at` - Date of churn |
| `customers` | Add column | `churn_reason` - Documented reason |
| `winback_campaigns` | Create | Track win-back attempts and outcomes |

## Chat UI Flow
```
CSM: Create win-back campaign for CloudSync Corp
System: I'll create a win-back campaign for CloudSync Corp.

Analyzing churn history:
- Churned: 6 months ago (July 2025)
- Previous ARR: $125,000
- Tenure: 2.5 years
- Documented reason: "Budget constraints, delayed project"
- Last contact: Mark Johnson (VP Ops) - still at company per LinkedIn

Product updates since departure:
- New pricing tiers (more flexible)
- 40% performance improvement
- Integration with their CRM (requested feature)

Generating win-back sequence:

📧 **Email 1 - Reconnect** (Day 1)
Subject: CloudSync Corp + CSCX - A lot has changed
Preview: Personal check-in, acknowledge time passed, mention relevant updates...

📧 **Email 2 - Value Reminder** (Day 7)
Subject: Remember when you achieved 3x ROI with us?
Preview: Highlight past successes, new customer wins in their industry...

📧 **Email 3 - New Capabilities** (Day 14)
Subject: That CRM integration you asked for? It's here.
Preview: Feature announcement, direct relevance to their needs...

📧 **Email 4 - Social Proof** (Day 21)
Subject: How [Similar Company] came back and grew 2x
Preview: Case study of successful return, ROI metrics...

📧 **Email 5 - Invitation** (Day 28)
Subject: Let's catch up over coffee (virtual or real)
Preview: Low-pressure reconnection, no hard sell, genuine interest...

[Preview All] [Customize Offer] [Start Campaign]

CSM: Start Campaign
System: Win-back campaign launched for CloudSync Corp!

5 emails scheduled over 28 days. You'll receive engagement alerts.
```

## Acceptance Criteria
- [ ] Generate personalized win-back sequence based on churn history
- [ ] Include relevant product updates since customer left
- [ ] Reference past successes and relationship history
- [ ] Track engagement throughout campaign
- [ ] Alert CSM on positive engagement signals
- [ ] Support campaign pause/modification based on responses
- [ ] Measure win-back success rate
- [ ] Follow HITL approval for sensitive re-engagement

## Ralph Loop Notes
- **Learning**: Identify which churn reasons are most recoverable
- **Optimization**: Discover optimal timing for win-back attempts
- **Personalization**: Match messaging to specific churn reasons

### Completion Signal
```
<promise>PRD-030-COMPLETE</promise>
```
