# PRD-043: Reference Request to Customer

## Metadata
- **PRD ID**: PRD-043
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, Customer Health Data, Reference Tracking

## Scenario Description
A CSM needs to ask a satisfied customer if they'd be willing to serve as a reference for prospects. The system generates a respectful request that explains what's being asked, makes participation easy, and respects the customer's time while emphasizing the value of their voice.

## User Story
**As a** CSM using the Chat UI,
**I want to** request reference availability from happy customers,
**So that** I can build a reference pool while respecting customer relationships.

## Trigger
- CSM types: "Request reference from [customer]" or "Ask [customer] to be a reference"
- Sales team requests reference for specific deal
- Customer achieves milestone indicating reference readiness

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer health | `customers.health_score` | Implemented | Satisfaction indicator |
| Stakeholder data | `stakeholders` table | Implemented | Contact info |
| Email drafting | Communicator agent | Implemented | Can draft requests |
| NPS data | QBR/survey data | Partial | Promoter identification |

### What's Missing
- [ ] Reference pool management
- [ ] Reference request templates
- [ ] Reference call tracking
- [ ] Reference fatigue prevention
- [ ] Matching references to prospects

## Detailed Workflow

### Step 1: Readiness Assessment
- Verify customer satisfaction
- Check past reference activity
- Ensure no active issues
- Identify best contact for request

### Step 2: Request Customization
- Explain specific prospect context (if applicable)
- Define participation level:
  - Reference call (30 min)
  - Email reference
  - Industry-specific reference
  - General availability

### Step 3: Request Generation
- Generate respectful reference request
- Explain what's involved
- Make declining easy (no guilt)
- Offer something in return

### Step 4: Track and Manage
- Record reference availability
- Match to appropriate prospects
- Track reference call completions
- Thank after each use

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/reference-request.ts` | Create | Reference request template |
| `server/src/templates/emails/reference-specific.ts` | Create | Specific prospect reference request |
| `server/src/services/advocacy/referenceManager.ts` | Create | Reference management logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/reference-request` | POST | Generate reference request |
| `GET /api/references/pool` | GET | Get reference pool |
| `GET /api/customers/:id/reference-status` | GET | Get customer reference status |
| `POST /api/references/:id/match` | POST | Match reference to prospect |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `customer_references` | Create | Track reference availability |
| `reference_calls` | Create | Track reference call usage |

## Chat UI Flow
```
CSM: Request reference from InnovateTech
System: I'll prepare a reference request for InnovateTech.

Reference Readiness Check:
✓ Health Score: 88 (Excellent)
✓ NPS: 10 (Strong Promoter)
✓ Relationship tenure: 2.5 years
✓ No active support issues
✓ Last reference call: 8 months ago
✓ Champion: Lisa Chen (Sr. Director)

📧 **Reference Request**
---
Subject: Quick Ask - Would You Be Open to Reference Calls?

Hi Lisa,

I hope you're doing well! I have a quick ask - would you be open to occasionally taking reference calls from prospective customers?

**What's involved:**
• ~30 minute calls (typically 2-3 per year max)
• Share your honest experience with our platform
• Usually with similar companies in the tech sector

**What we'd match you with:**
• Similar company size and challenges
• Topics you're comfortable discussing
• Scheduled at your convenience

**What's in it for you:**
• Help fellow CS leaders make informed decisions
• Early access to new features
• Annual thank-you gift

Completely understand if you're not available - just thought I'd ask given how successful your program has been!

Would you be open to joining our reference program?

[Yes, Happy to Help] [Not Right Now] [Tell Me More]

Best,
[CSM Name]
---

[Edit] [Send]

CSM: Send
System: Reference request sent to Lisa at InnovateTech!
```

## Acceptance Criteria
- [ ] Verify customer satisfaction before requesting
- [ ] Check reference request history (prevent fatigue)
- [ ] Generate respectful, no-pressure request
- [ ] Explain commitment level clearly
- [ ] Make declining easy
- [ ] Track reference availability and usage
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Identify which customers make best references
- **Optimization**: Optimal timing and frequency for reference requests
- **Personalization**: Match reference requests to customer personality

### Completion Signal
```
<promise>PRD-043-COMPLETE</promise>
```
