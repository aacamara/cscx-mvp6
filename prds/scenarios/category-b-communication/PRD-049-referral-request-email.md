# PRD-049: Referral Request Email

## Metadata
- **PRD ID**: PRD-049
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, Customer Health Data, Referral Tracking

## Scenario Description
A CSM wants to ask a satisfied customer for referrals to other potential customers. The system generates a professional referral request that makes the ask easy, explains the value of referrals, and provides multiple ways to participate at different effort levels.

## User Story
**As a** CSM using the Chat UI,
**I want to** request referrals from happy customers,
**So that** I can generate warm leads while respecting customer relationships.

## Trigger
- CSM types: "Request referral from [customer]" or "Ask [customer] for referrals"
- Customer gives high NPS score
- Post-successful milestone or renewal
- Customer expresses high satisfaction

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer health | `customers.health_score` | Implemented | Satisfaction indicator |
| NPS data | QBR/survey data | Partial | Promoter identification |
| Email drafting | Communicator agent | Implemented | Can draft requests |

### What's Missing
- [ ] Referral request templates
- [ ] Referral tracking system
- [ ] Referral reward/incentive program integration
- [ ] Referral fatigue prevention
- [ ] Referral conversion tracking

## Detailed Workflow

### Step 1: Referral Readiness Check
- Verify customer satisfaction
- Check recent referral requests (avoid over-asking)
- Assess relationship strength

### Step 2: Request Customization
- Select referral ask level:
  - Name drop permission
  - Warm introduction
  - Direct referral
- Customize incentive/benefit messaging

### Step 3: Request Generation
- Draft professional referral request
- Explain what kind of referrals are valuable
- Make participation easy
- Include any referral incentives

### Step 4: Track Referrals
- Track referrals received
- Follow up on referral leads
- Thank customer for referrals
- Report back on referral outcomes

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/referral-request.ts` | Create | Referral request template |
| `server/src/templates/emails/referral-thank-you.ts` | Create | Referral thank you template |
| `server/src/services/advocacy/referralManager.ts` | Create | Referral management logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/referral-request` | POST | Generate referral request |
| `GET /api/referrals` | GET | List referrals received |
| `POST /api/referrals` | POST | Log new referral |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `referrals` | Create | Track referrals |
| `customers` | Add column | `last_referral_request` - Prevent over-asking |

## Chat UI Flow
```
CSM: Request referral from CloudSync
System: I'll help you request a referral from CloudSync.

Referral Readiness:
✓ Health Score: 89 (Excellent)
✓ NPS: 9 (Promoter)
✓ Last referral request: 8 months ago
✓ Previous referrals given: 2 (both converted!)
✓ Champion: David Chen (strong relationship)

📧 **Referral Request**
---
Subject: Know Anyone Who'd Benefit from What CloudSync Achieved?

Hi David,

I hope you're doing great! Given CloudSync's amazing results this year (38% efficiency boost!), I wanted to ask - do you know any colleagues or peers at other companies who might be facing similar challenges?

**What I'm looking for:**
Companies dealing with:
• Manual operational processes eating up time
• Data silos between departments
• Scaling challenges as they grow

**How you can help (choose your level):**

**Easy (2 min):**
Just share a name and company - I'll handle the outreach and won't mention you unless you want me to.

**Medium (5 min):**
Forward a brief intro email I'll draft, or make a LinkedIn connection.

**Above & Beyond (15 min):**
A warm email introduction or quick call with me and your contact.

**What's in it for you:**
• $500 Amazon gift card for any referral that becomes a customer
• Early access to our beta features for every referral (even if they don't convert!)
• Good karma from helping a fellow leader solve their problems 😊

No pressure at all - completely understand if you'd rather not. But if anyone comes to mind, I'd love to hear from you!

Thanks for being such an amazing partner,
[CSM Name]
---

[Edit] [Adjust Incentives] [Send]

CSM: Send
System: Referral request sent to David at CloudSync!
```

## Acceptance Criteria
- [ ] Verify customer satisfaction before requesting
- [ ] Check referral request history (prevent over-asking)
- [ ] Generate professional, non-pushy request
- [ ] Offer multiple participation levels
- [ ] Include referral incentives if applicable
- [ ] Track referrals and conversions
- [ ] Thank customers for referrals
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Identify which customers give best referrals
- **Optimization**: Best timing and framing for referral requests
- **Personalization**: Match request approach to customer personality

### Completion Signal
```
<promise>PRD-049-COMPLETE</promise>
```
