# PRD-034: Check-In Email After Silence

## Metadata
- **PRD ID**: PRD-034
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, Customer Activity Tracking, Risk Signals

## Scenario Description
A CSM notices (or is alerted) that a customer has gone silent - no emails, no meetings, declining usage. The system generates a thoughtful, non-pushy check-in email that acknowledges the gap in communication and offers value without being intrusive or salesy.

## User Story
**As a** CSM using the Chat UI,
**I want to** draft a check-in email for a silent customer,
**So that** I can re-engage them appropriately without seeming desperate or pushy.

## Trigger
- CSM types: "Check in with [customer]" or "Send re-engagement email to [customer]"
- Risk signal detected: no_login or engagement_drop
- Automated alert: No customer contact in 30+ days
- Health score declining due to low engagement

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Risk signals | `risk_signals` table | Implemented | Tracks no_login signals |
| Email history | Gmail API | Implemented | Can check last contact |
| Meeting history | `meetings` table | Implemented | Track last meeting |
| Email drafting | Communicator agent | Implemented | Can draft emails |

### What's Missing
- [ ] Silence detection algorithm (combining email, meetings, usage)
- [ ] Check-in email templates by silence duration
- [ ] Conversation history summary for context
- [ ] Non-pushy re-engagement messaging
- [ ] Silence tracking metrics

## Detailed Workflow

### Step 1: Silence Assessment
- Calculate days since last meaningful contact
- Review last communication topics
- Check usage trends during silence period
- Assess severity of disengagement

### Step 2: Approach Selection
- Determine check-in tone based on:
  - Relationship strength
  - Silence duration
  - Recent events (renewal, issues, etc.)
  - Customer personality/preferences

### Step 3: Email Generation
- Draft appropriate check-in email
- Include value-add (not just "checking in")
- Reference shared history or recent industry news
- Soft call-to-action (no pressure)

### Step 4: Review and Send
- Present draft for CSM review
- Adjust tone if needed
- Send with HITL approval

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/engagement/silenceDetector.ts` | Create | Detect and measure customer silence |
| `server/src/templates/emails/check-in-light.ts` | Create | Light touch check-in (2-4 weeks) |
| `server/src/templates/emails/check-in-concerned.ts` | Create | Concerned check-in (4-8 weeks) |
| `server/src/templates/emails/check-in-value.ts` | Create | Value-add re-engagement (8+ weeks) |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/customers/:id/silence-status` | GET | Get silence assessment |
| `POST /api/customers/:id/check-in-email` | POST | Generate check-in email |
| `GET /api/customers/silent` | GET | List all silent customers |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `customers` | Add column | `last_meaningful_contact` - Calculated timestamp |
| `customers` | Add column | `silence_days` - Days since contact |

## Chat UI Flow
```
CSM: Check in with Quantum Analytics
System: I'll draft a check-in email for Quantum Analytics.

Silence Assessment:
- Last email: 38 days ago (re: support ticket resolution)
- Last meeting: 52 days ago (monthly check-in)
- Usage trend: -15% over past month
- Silence severity: Moderate

Relationship context:
- Good historical relationship
- Champion: Alex Rivera (still responsive to LinkedIn)
- No known issues or complaints

Recommended approach: Value-add with soft touch

📧 **Check-In Email Draft**
---
Subject: Quick thought for Quantum Analytics

Hi Alex,

I came across an article about predictive analytics trends in fintech and immediately thought of the work you're doing at Quantum Analytics.

[Link: "5 Ways Fintech Leaders Are Using Predictive Models in 2026"]

I'd also love to hear how things are going on your end - it's been a few weeks since we connected. No urgency at all, but if you have 15 minutes in the coming weeks, I'd enjoy catching up.

Either way, hope you're having a great start to the year!

Best,
[CSM Name]

P.S. - We also just released some new dashboard features that might be useful for your team's reporting. Happy to do a quick walkthrough whenever it's convenient.
---

[Edit] [Try Different Approach] [Send]

CSM: Send
System: Check-in email submitted for approval.

[Approval notification]
System: Check-in email sent to Alex at Quantum Analytics.
```

## Acceptance Criteria
- [ ] Calculate accurate silence duration from multiple signals
- [ ] Generate appropriate check-in based on silence severity
- [ ] Include value-add content (not just "touching base")
- [ ] Non-pushy, relationship-focused tone
- [ ] Support multiple check-in approaches
- [ ] Update last_meaningful_contact on response
- [ ] Follow HITL approval before sending
- [ ] Track response to check-in attempts

## Ralph Loop Notes
- **Learning**: Track which check-in approaches get responses
- **Optimization**: Identify optimal silence threshold before outreach
- **Personalization**: Match check-in style to customer personality

### Completion Signal
```
<promise>PRD-034-COMPLETE</promise>
```
