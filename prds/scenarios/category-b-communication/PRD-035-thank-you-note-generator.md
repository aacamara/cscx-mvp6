# PRD-035: Thank You Note Generator

## Metadata
- **PRD ID**: PRD-035
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, Customer Activity Data

## Scenario Description
A CSM wants to send a thoughtful thank you note to a customer after a positive interaction - such as completing onboarding, providing a referral, participating in a case study, giving positive feedback, or renewing their contract. The system generates a personalized, genuine thank you that strengthens the relationship.

## User Story
**As a** CSM using the Chat UI,
**I want to** quickly generate personalized thank you notes,
**So that** I can acknowledge customer contributions and strengthen relationships without spending time drafting.

## Trigger
- CSM types: "Thank [customer] for [reason]" or "Send thank you to [stakeholder]"
- Customer completes significant milestone
- Customer provides referral or testimonial
- Contract renewal completed

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Email drafting | Communicator agent | Implemented | General email capability |
| Gmail integration | `server/src/services/google/gmail.ts` | Implemented | Email sending |
| Customer milestones | Various tables | Implemented | Trackable events |

### What's Missing
- [ ] Thank you note templates by occasion
- [ ] Personalization based on specific contribution
- [ ] Thank you tracking (avoid over-thanking)
- [ ] Occasion detection for proactive suggestions

## Detailed Workflow

### Step 1: Occasion Identification
- Identify thank you occasion:
  - Referral given
  - Case study participation
  - Positive NPS/feedback
  - Renewal completed
  - Successful onboarding
  - Speaking at event
  - Product feedback

### Step 2: Context Gathering
- Fetch relevant details about the contribution
- Review relationship history
- Check recent thank you notes (avoid redundancy)

### Step 3: Note Generation
- Generate sincere, specific thank you
- Reference the specific contribution
- Express genuine appreciation
- Optional: Include small gesture (early access, swag, etc.)

### Step 4: Send
- Present draft for quick review
- Send with HITL approval

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/thank-you-referral.ts` | Create | Referral thank you template |
| `server/src/templates/emails/thank-you-renewal.ts` | Create | Renewal thank you template |
| `server/src/templates/emails/thank-you-feedback.ts` | Create | Feedback thank you template |
| `server/src/templates/emails/thank-you-case-study.ts` | Create | Case study thank you template |
| `server/src/templates/emails/thank-you-general.ts` | Create | General thank you template |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/thank-you` | POST | Generate thank you note |
| `GET /api/customers/:id/thank-you-history` | GET | View past thank you notes |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `thank_you_log` | Create | Track thank you notes sent |

## Chat UI Flow
```
CSM: Thank Sarah at CloudTech for the referral
System: I'll draft a thank you note for Sarah's referral.

Referral details:
- Referred company: DataStream Inc
- Referral date: January 15, 2026
- Status: Currently in sales pipeline
- Sarah's role: VP of Operations, champion for 2 years

📧 **Thank You Note**
---
Subject: Thank You, Sarah - Your Referral Means the World

Hi Sarah,

I just wanted to take a moment to personally thank you for referring DataStream Inc to us. Recommendations from trusted partners like you are the highest compliment we can receive.

Your two years of partnership and advocacy have been incredible, and this referral is just another example of the trust you've placed in us. It truly means a lot.

As a small token of appreciation, I'd love to send you something. What's your preference?
- Early access to our Q2 product beta
- A $50 gift card to your favorite coffee shop
- Donation to a charity of your choice

Thank you again, Sarah. We're lucky to have you as a partner.

Warmly,
[CSM Name]
---

[Edit] [Send]

CSM: Send
System: Thank you note sent to Sarah at CloudTech!
```

## Acceptance Criteria
- [ ] Generate occasion-specific thank you notes
- [ ] Personalize with specific contribution details
- [ ] Authentic, non-generic tone
- [ ] Track thank you notes to avoid over-communication
- [ ] Support various thank you occasions
- [ ] Optional inclusion of appreciation gestures
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Track which thank you notes strengthen relationships most
- **Optimization**: Suggest proactive thank you opportunities
- **Personalization**: Learn customer preferences for appreciation style

### Completion Signal
```
<promise>PRD-035-COMPLETE</promise>
```
