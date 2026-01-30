# PRD-052: Re-Engagement After Support Ticket

## Metadata
- **PRD ID**: PRD-052
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, Support Ticket Data, Customer Health Data

## Scenario Description
After a support ticket is resolved (especially a significant one), the CSM needs to follow up with the customer to ensure satisfaction, rebuild confidence, and demonstrate that they're paying attention. The system generates a thoughtful re-engagement email that goes beyond the support team's closure.

## User Story
**As a** CSM using the Chat UI,
**I want to** send post-ticket follow-up emails,
**So that** I can demonstrate care and rebuild trust after support issues.

## Trigger
- CSM types: "Follow up with [customer] on ticket [#]" or "Re-engage [customer] after support ticket"
- High-severity support ticket resolved
- Multiple tickets resolved for same customer
- Automated alert: Ticket resolved for at-risk customer

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Risk signals | `risk_signals` table | Implemented | Can track ticket events |
| Email drafting | Communicator agent | Implemented | Can draft follow-ups |
| Customer health | `customers.health_score` | Implemented | Track impact |

### What's Missing
- [ ] Support ticket integration (Zendesk, Intercom, etc.)
- [ ] Post-ticket follow-up templates
- [ ] Ticket sentiment analysis
- [ ] Automatic follow-up triggers
- [ ] Resolution satisfaction tracking

## Detailed Workflow

### Step 1: Ticket Context
- Get ticket details and resolution
- Assess customer impact
- Review customer health trend
- Check for related issues

### Step 2: Follow-up Strategy
- Determine appropriate follow-up:
  - Simple acknowledgment (minor issues)
  - Satisfaction check (moderate issues)
  - Relationship repair (major issues)
- Identify any additional value to offer

### Step 3: Email Generation
- Generate personalized follow-up
- Reference specific ticket and resolution
- Offer additional support
- Invite feedback

### Step 4: Track and Monitor
- Track follow-up delivery
- Monitor customer response
- Update health assessment

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/post-ticket-minor.ts` | Create | Minor ticket follow-up |
| `server/src/templates/emails/post-ticket-moderate.ts` | Create | Moderate ticket follow-up |
| `server/src/templates/emails/post-ticket-major.ts` | Create | Major ticket follow-up |
| `server/src/services/support/followupGenerator.ts` | Create | Post-ticket follow-up logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/ticket-followup` | POST | Generate ticket follow-up |
| `GET /api/customers/:id/recent-tickets` | GET | Get recent support tickets |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `support_followups` | Create | Track post-ticket follow-ups |

## Chat UI Flow
```
CSM: Follow up with TechFlow on their resolved API ticket
System: I'll prepare a follow-up for TechFlow's resolved support ticket.

Ticket Details:
- Ticket #: TF-2024-0847
- Issue: API rate limiting causing sync failures
- Severity: High
- Duration: 4 days (opened Jan 23, resolved Jan 27)
- Resolution: Rate limits increased, optimization guide provided

Customer Impact:
- Health Score: Dropped 6 points during issue
- Multiple stakeholders involved
- Escalated to engineering

📧 **Post-Ticket Follow-Up**
---
Subject: Checking In After Your API Issue - All Good?

Hi David,

I wanted to personally reach out now that your API rate limiting issue (ticket #TF-2024-0847) has been resolved.

I know the past few days were frustrating - having sync failures impact your operations is never acceptable, and I'm sorry you had to deal with that.

**Quick Recap:**
• Issue: API rate limits too restrictive for your usage
• Resolution: Limits increased 3x + optimization guide provided
• Status: Should be fully operational now

**My Questions for You:**
1. Is everything working smoothly since the fix?
2. Did the optimization guide help, or would a quick call be useful?
3. Anything else I should flag to our team?

I've also added a note to check your API metrics next week to make sure we stay ahead of any future scaling needs.

Thanks for your patience through this. If anything else comes up, please reach out directly - I'm here to help.

Best,
[CSM Name]
[Direct phone number]
---

[Edit] [Add Follow-up Reminder] [Send]

CSM: Send
System: Post-ticket follow-up sent to TechFlow!

Reminder set: Check API metrics in 7 days.
```

## Acceptance Criteria
- [ ] Retrieve ticket details and resolution context
- [ ] Assess severity and appropriate follow-up level
- [ ] Generate personalized, empathetic follow-up
- [ ] Reference specific ticket and resolution
- [ ] Offer additional support and invite feedback
- [ ] Set follow-up reminders automatically
- [ ] Track customer response
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Track which follow-ups restore customer confidence
- **Optimization**: Identify optimal timing for post-ticket outreach
- **Personalization**: Adapt tone based on ticket severity and customer relationship

### Completion Signal
```
<promise>PRD-052-COMPLETE</promise>
```
