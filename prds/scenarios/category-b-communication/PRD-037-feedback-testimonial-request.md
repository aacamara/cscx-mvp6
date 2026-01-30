# PRD-037: Feedback/Testimonial Request

## Metadata
- **PRD ID**: PRD-037
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, NPS Data, Customer Health Data

## Scenario Description
A CSM wants to request feedback or a testimonial from a satisfied customer. The system identifies the right moment and generates a personalized request that acknowledges the customer's success, makes the ask easy to fulfill, and provides clear options for participation level.

## User Story
**As a** CSM using the Chat UI,
**I want to** request feedback or testimonials from happy customers,
**So that** I can gather social proof while maintaining positive relationships.

## Trigger
- CSM types: "Request testimonial from [customer]" or "Ask [customer] for feedback"
- High NPS score received
- Customer achieves significant milestone
- Health score consistently above 80

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| NPS tracking | QBR data, surveys | Partial | NPS scores available |
| Health scores | `customers.health_score` | Implemented | Track customer satisfaction |
| Email drafting | Communicator agent | Implemented | Can draft requests |
| Customer wins | `qbrs.wins` | Implemented | Success data available |

### What's Missing
- [ ] Testimonial request templates
- [ ] Optimal timing detection for requests
- [ ] Participation level options (quote, case study, reference call)
- [ ] Testimonial tracking and storage
- [ ] Request fatigue prevention

## Detailed Workflow

### Step 1: Timing Assessment
- Verify customer satisfaction signals
- Check recent interactions (avoid bad timing)
- Review past testimonial requests (avoid over-asking)

### Step 2: Request Customization
- Select request type:
  - Written testimonial/quote
  - G2/Capterra review
  - Video testimonial
  - Reference call availability
  - Full case study
- Personalize based on customer's success story

### Step 3: Email Generation
- Draft request with clear, easy options
- Acknowledge specific achievements
- Make participation easy
- Offer flexibility in participation level

### Step 4: Follow-up Management
- Track request status
- Schedule gentle follow-up if needed
- Thank upon completion

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/testimonial-request.ts` | Create | Testimonial request template |
| `server/src/templates/emails/review-request.ts` | Create | Review site request template |
| `server/src/templates/emails/reference-request.ts` | Create | Reference availability request |
| `server/src/services/advocacy/testimonialTracker.ts` | Create | Track testimonial requests |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/testimonial-request` | POST | Generate testimonial request |
| `GET /api/customers/:id/advocacy-status` | GET | Check testimonial/reference status |
| `GET /api/customers/advocacy-ready` | GET | List customers ready for requests |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `testimonial_requests` | Create | Track testimonial requests |
| `customer_testimonials` | Create | Store received testimonials |
| `customers` | Add column | `last_testimonial_request` - Prevent over-asking |

## Chat UI Flow
```
CSM: Request testimonial from TechCorp
System: I'll help you request a testimonial from TechCorp.

Timing assessment:
✓ Health Score: 92 (Excellent)
✓ NPS: 9 (Promoter)
✓ Recent win: 45% efficiency improvement
✓ No testimonial request in past 12 months
✓ Recent positive QBR

Recommended approach: Multi-option request

📧 **Testimonial Request**
---
Subject: Quick Favor? We'd Love to Share Your Success Story

Hi David,

I hope you're doing well! I've really enjoyed working with TechCorp over the past 18 months, and your team's achievements have been impressive - a 45% efficiency improvement is no small feat!

If you're open to it, I'd love to share your success story to help other companies facing similar challenges. We have a few flexible options:

**Low effort (5 min):**
□ A 1-2 sentence quote I can use in marketing
□ A quick review on G2 or Capterra

**Medium effort (30 min):**
□ A short written testimonial about your experience
□ Brief interview for a mini case study

**If you're feeling generous (1 hour):**
□ Full case study with your team
□ Reference call availability for prospects

No pressure at all - any level of participation would be incredibly appreciated. Just hit reply with what sounds doable, or let me know if now isn't a good time.

Thanks for being such an amazing partner!

Best,
[CSM Name]
---

[Edit] [Send]

CSM: Send
System: Testimonial request sent to David at TechCorp!
```

## Acceptance Criteria
- [ ] Verify customer satisfaction before requesting
- [ ] Check testimonial request history (avoid over-asking)
- [ ] Offer multiple participation levels
- [ ] Personalize with customer's specific achievements
- [ ] Track request status and follow-ups
- [ ] Store received testimonials
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Identify which customers are most likely to provide testimonials
- **Optimization**: Best timing and framing for requests
- **Personalization**: Match request style to customer relationship

### Completion Signal
```
<promise>PRD-037-COMPLETE</promise>
```
