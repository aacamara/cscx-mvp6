# PRD-048: Case Study Request

## Metadata
- **PRD ID**: PRD-048
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail Integration, Customer Success Data, Marketing Coordination

## Scenario Description
A CSM wants to request a customer's participation in a case study to showcase their success. The system generates a compelling request that explains the process, highlights the benefits to the customer, and makes participation easy by outlining clear next steps and time commitment.

## User Story
**As a** CSM using the Chat UI,
**I want to** request case study participation from successful customers,
**So that** I can help marketing create social proof while providing value to the customer.

## Trigger
- CSM types: "Request case study from [customer]" or "Ask [customer] for case study"
- Customer achieves remarkable results
- Marketing requests case study candidates
- Customer expresses willingness to share story

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer metrics | Multiple tables | Implemented | Success data available |
| NPS data | QBR/survey data | Partial | Promoter identification |
| Email drafting | Communicator agent | Implemented | Can draft requests |

### What's Missing
- [ ] Case study request templates
- [ ] Case study process documentation
- [ ] Case study tracking system
- [ ] Marketing coordination workflow
- [ ] Incentive/benefit articulation

## Detailed Workflow

### Step 1: Candidate Assessment
- Verify customer is a good candidate:
  - Strong results/metrics
  - Positive relationship
  - Willing to be public
  - Compelling story
- Gather key success metrics

### Step 2: Request Preparation
- Outline case study process
- Identify time commitment
- Highlight benefits to customer
- Prepare for common objections

### Step 3: Request Generation
- Draft compelling case study request
- Include specific success metrics to feature
- Outline clear process and timeline
- Explain benefits (visibility, thought leadership)

### Step 4: Coordination
- Track request status
- Coordinate with marketing
- Manage case study production
- Share final case study with customer

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/case-study-request.ts` | Create | Case study request template |
| `server/src/templates/emails/case-study-followup.ts` | Create | Follow-up template |
| `server/src/services/advocacy/caseStudyManager.ts` | Create | Case study management logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/case-study-request` | POST | Generate case study request |
| `GET /api/case-studies` | GET | List case studies in progress |
| `GET /api/customers/case-study-candidates` | GET | Find good candidates |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `case_studies` | Create | Track case study requests and status |

## Chat UI Flow
```
CSM: Request case study from TechFlow Inc
System: I'll help you request a case study from TechFlow Inc.

Case Study Readiness:
✓ Documented results: 47% efficiency improvement
✓ ROI: 3.8x ($680K value delivered)
✓ Health Score: 91 (Excellent)
✓ NPS: 10 (Promoter)
✓ Relationship tenure: 2 years
✓ Champion willing to be public: Unknown

Success Story Highlights:
- Challenge: Manual processes consuming 40 hours/week
- Solution: Automated workflows with AI
- Results: 47% efficiency gain, $680K saved annually
- Quote potential: "Game-changer for our operations"

📧 **Case Study Request**
---
Subject: Would TechFlow Be Open to Sharing Your Success Story?

Hi Amanda,

I've loved watching TechFlow's journey over the past two years - from streamlining operations to achieving a 47% efficiency improvement. Your story is genuinely inspiring, and I think it could help other companies facing similar challenges.

**Would TechFlow be open to being featured in a case study?**

**What's Involved:**
• 45-minute interview with you (can be video or phone)
• Optional: Brief quote from an executive sponsor
• Review and approval of final content before publishing

**Timeline:** About 4 weeks from interview to publication

**What's In It For TechFlow:**
🎯 **Thought Leadership** - Position TechFlow as an innovation leader
🎯 **Visibility** - Featured on our website and shared with our audience
🎯 **Networking** - We'll promote to similar companies who'd love to connect
🎯 **Early Access** - Case study participants get first access to new features

**Success Stories We'd Highlight:**
• 47% operational efficiency improvement
• 3.8x ROI ($680K annual value)
• Transformation from manual to automated workflows

I've attached a sample of a recent case study so you can see the quality and tone.

Would you be interested? If yes, I can set up a quick prep call to discuss next steps!

Best,
[CSM Name]

[Sample Case Study PDF]
---

[Edit] [Attach Sample] [Send]

CSM: Send
System: Case study request sent to TechFlow Inc!
```

## Acceptance Criteria
- [ ] Assess customer readiness for case study
- [ ] Gather compelling success metrics
- [ ] Generate professional case study request
- [ ] Clearly explain process and time commitment
- [ ] Articulate benefits to customer
- [ ] Track request status through completion
- [ ] Coordinate with marketing team
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Identify characteristics of customers who say yes
- **Optimization**: Improve request timing and framing
- **Personalization**: Match request style to customer motivation

### Completion Signal
```
<promise>PRD-048-COMPLETE</promise>
```
