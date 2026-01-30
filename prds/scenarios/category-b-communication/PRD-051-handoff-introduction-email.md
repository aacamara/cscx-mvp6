# PRD-051: Handoff Introduction Email

## Metadata
- **PRD ID**: PRD-051
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail Integration, Customer Data, CSM Assignment Data

## Scenario Description
When a customer is being transitioned to a new CSM (due to territory change, CSM departure, or portfolio rebalancing), both the outgoing and incoming CSMs need to communicate this change professionally. The system generates a warm handoff introduction that maintains customer confidence and ensures continuity.

## User Story
**As a** CSM using the Chat UI,
**I want to** generate professional handoff introduction emails,
**So that** I can ensure smooth customer transitions that maintain trust and relationship continuity.

## Trigger
- CSM types: "Create handoff email for [customer] to [new CSM]"
- Customer assignment changes in system
- CSM departure planned
- Portfolio restructuring

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer data | `customers` table | Implemented | Full customer context |
| CSM assignment | `customers.csm_id` | Implemented | Current CSM tracking |
| Customer history | Multiple tables | Implemented | Relationship context |
| Email drafting | Communicator agent | Implemented | Can draft transitions |

### What's Missing
- [ ] Handoff email templates
- [ ] Handoff checklist/documentation generator
- [ ] New CSM briefing generator
- [ ] Transition tracking
- [ ] Customer preference transfer

## Detailed Workflow

### Step 1: Transition Planning
- Identify outgoing and incoming CSM
- Compile customer context and history
- Identify key relationship details
- Document any pending issues or opportunities

### Step 2: Documentation Preparation
- Generate customer briefing for new CSM
- Compile key contacts and relationships
- Document ongoing projects/initiatives
- Note any sensitivities or preferences

### Step 3: Communication Generation
- Generate handoff email from outgoing CSM
- Include introduction of new CSM
- Reassure customer of continuity
- Provide clear next steps

### Step 4: Transition Execution
- Send handoff communication
- Schedule transition meeting
- Update system assignments
- Ensure warm handoff occurs

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/handoff-outgoing.ts` | Create | Outgoing CSM handoff email |
| `server/src/templates/emails/handoff-incoming.ts` | Create | Incoming CSM introduction |
| `server/src/services/transitions/handoffGenerator.ts` | Create | Handoff generation logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/handoff` | POST | Generate handoff communications |
| `GET /api/customers/:id/handoff-briefing` | GET | Get briefing for new CSM |
| `POST /api/customers/:id/reassign` | POST | Execute CSM reassignment |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `customer_transitions` | Create | Track handoff history |
| `csm_notes` | Create | Store relationship notes for handoffs |

## Chat UI Flow
```
CSM: Create handoff email for DataCorp to Sarah Johnson
System: I'll prepare a handoff introduction for DataCorp to Sarah Johnson.

Customer Summary:
- Customer: DataCorp ($245K ARR)
- Relationship tenure: 18 months
- Health Score: 82
- Primary contact: Michael Torres (VP Ops)
- Key stakeholders: 4 total
- Upcoming: Renewal in 90 days

Relationship Context:
- Met weekly for first 6 months, now monthly
- Prefers direct communication style
- Previous escalation resolved well (built trust)
- Expansion in discussion for Q2

📧 **Handoff Email (From You)**
---
Subject: Introducing Your New Customer Success Manager - Sarah Johnson

Hi Michael,

I hope you're doing well! I'm reaching out with some news - I'm transitioning to a new role at CSCX, which means I'll be handing off our partnership to one of our best CSMs, Sarah Johnson.

**First, Thank You:**
Working with DataCorp over the past 18 months has been genuinely rewarding. Watching your team go from initial implementation to the powerhouse operation you have today has been one of my career highlights.

**About Sarah:**
Sarah has been with CSCX for 4 years and specializes in working with technology companies like DataCorp. She's exceptional at:
- Strategic planning and QBR facilitation
- Navigating complex expansions (relevant for your Q2 plans!)
- Building deep relationships across organizations

**What Happens Next:**
1. I've already briefed Sarah on everything - your history, preferences, ongoing initiatives, and the expansion conversation
2. Sarah will reach out this week to introduce herself
3. We'll have a three-way transition call if you'd like
4. All your documents and history remain intact

**My Commitment:**
I'll remain available through February 15 if you need anything during the transition. And I genuinely mean it - my personal email is [email] - don't hesitate to reach out.

It's been an honor working with you, Michael. DataCorp is in excellent hands with Sarah.

Warmly,
[Your Name]
---

📧 **Introduction Email (From Sarah - Draft)**
[Preview of Sarah's follow-up introduction]

[Edit Your Email] [Edit Sarah's Draft] [Send Both]

CSM: Send Both
System: Handoff emails sent!

- Your farewell email: Sent to Michael at DataCorp
- Sarah's intro draft: Sent to Sarah for review

Transition meeting can be scheduled once Sarah reaches out.
```

## Acceptance Criteria
- [ ] Generate comprehensive handoff email from outgoing CSM
- [ ] Include customer briefing for incoming CSM
- [ ] Communicate relationship history and context
- [ ] Reassure customer of continuity
- [ ] Provide clear transition timeline
- [ ] Support three-way transition coordination
- [ ] Track handoff completion
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Track which handoff approaches maintain customer satisfaction
- **Optimization**: Identify best transition timeline and touchpoints
- **Personalization**: Adapt handoff style to customer relationship type

### Completion Signal
```
<promise>PRD-051-COMPLETE</promise>
```
