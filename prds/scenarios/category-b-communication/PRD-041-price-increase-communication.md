# PRD-041: Price Increase Communication

## Metadata
- **PRD ID**: PRD-041
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: High
- **Dependencies**: Gmail Integration, Contract Data, Value Summary Data

## Scenario Description
A CSM needs to communicate an upcoming price increase to a customer in a way that minimizes friction and churn risk. The system generates a carefully crafted communication that leads with value delivered, explains the rationale, provides clear details on the change, and offers a path forward.

## User Story
**As a** CSM using the Chat UI,
**I want to** communicate price increases professionally,
**So that** I can maintain customer relationships while implementing necessary pricing changes.

## Trigger
- CSM types: "Prepare price increase communication for [customer]"
- Company-wide price increase announced
- Contract renewal with price adjustment

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Contract data | `contracts` table | Implemented | Current pricing |
| Value metrics | QBR data, usage metrics | Partial | ROI data available |
| Email drafting | Communicator agent | Implemented | Can draft sensitive emails |
| Health scores | `customers.health_score` | Implemented | Risk assessment |

### What's Missing
- [ ] Price increase templates (value-led approach)
- [ ] Value summary generator for price context
- [ ] Risk assessment for price increase communication
- [ ] Multi-step communication sequence
- [ ] Objection handling guidance

## Detailed Workflow

### Step 1: Risk Assessment
- Evaluate customer health and relationship strength
- Assess churn risk from price increase
- Review contract terms and history
- Identify relationship depth and advocates

### Step 2: Value Documentation
- Compile value delivered metrics
- Calculate ROI at current pricing
- Project continued value
- Identify key wins to highlight

### Step 3: Communication Strategy
- Determine communication approach:
  - Email only (low risk)
  - Email + call (medium risk)
  - In-person/video meeting (high risk)
- Select appropriate timing

### Step 4: Communication Generation
- Generate value-led communication
- Include clear pricing details
- Provide rationale (investment in product, etc.)
- Offer next steps and discussion option

### Step 5: Follow-up Planning
- Schedule follow-up touchpoints
- Prepare for objection handling
- Document customer response

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/price-increase.ts` | Create | Price increase communication template |
| `server/src/services/pricing/increaseComm.ts` | Create | Price increase communication logic |
| `server/src/services/pricing/valueCalculator.ts` | Create | Calculate value for justification |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/price-increase-comm` | POST | Generate price increase communication |
| `GET /api/customers/:id/value-summary` | GET | Get value delivered summary |
| `GET /api/customers/:id/price-increase-risk` | GET | Assess risk of price communication |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `price_changes` | Create | Track price change communications |
| `customers` | Add column | `price_sensitivity` - Assessed sensitivity |

## Chat UI Flow
```
CSM: Prepare price increase communication for GlobalTech
System: I'll help you prepare a price increase communication for GlobalTech.

⚠️ This is a sensitive communication. Let me assess the situation.

Risk Assessment:
- Health Score: 76 (Good)
- Relationship tenure: 3 years
- Champion strength: Strong (VP level)
- Recent sentiment: Positive (last QBR)
- Contract value: $285K ARR
- Proposed increase: 8% ($22.8K)

**Risk Level: Medium**
Recommendation: Email + follow-up call

Value Documentation:
- Documented ROI: 4.2x ($1.2M value delivered)
- Key wins: 35% cost reduction, 2 expansions
- Product improvements since last contract:
  - AI features (50% efficiency gain)
  - New integrations (3 they requested)
  - Enhanced security (compliance requirement)

📧 **Price Increase Communication**
---
Subject: GlobalTech Partnership Update & Continued Investment

Hi David,

As we approach your renewal in March, I wanted to reach out personally to discuss our continued partnership and share some important updates.

**Our Partnership Results:**
Over the past three years, GlobalTech has achieved remarkable results:
• 4.2x return on investment ($1.2M documented value)
• 35% reduction in operational costs
• Successful expansion to 3 additional departments

**What's New:**
Since your last contract, we've invested heavily in:
• AI-powered automation (driving 50% efficiency gains for teams like yours)
• The CRM integration you requested (now live!)
• Enhanced security certifications (supporting your compliance needs)

**What This Means for Pricing:**
Effective with your March renewal, pricing will adjust by 8% to reflect our continued investment in the platform. Your new annual rate will be $307,800.

I know pricing conversations are never easy, and I want to make sure we address any questions you have. Can we schedule 30 minutes next week to discuss?

[Schedule a Call →]

I'm confident the value we'll continue to deliver justifies this investment, and I'm committed to ensuring GlobalTech's ongoing success.

Best regards,
[CSM Name]
---

[Edit] [Preview Call Talking Points] [Send]

CSM: Preview Call Talking Points
System: **Call Talking Points:**
- Lead with appreciation and relationship history
- Summarize value: $1.2M ROI, 4.2x return
- Acknowledge the change: 8% increase ($22.8K)
- Explain investment: AI, integrations, security
- Address concerns: Multi-year lock for price protection available
- Close: Reaffirm commitment to their success
```

## Acceptance Criteria
- [ ] Assess risk level of price increase communication
- [ ] Calculate and document value delivered for justification
- [ ] Generate value-led communication (not price-led)
- [ ] Include specific ROI metrics and wins
- [ ] Provide clear pricing details
- [ ] Suggest appropriate communication channel based on risk
- [ ] Generate supporting talking points for calls
- [ ] Follow HITL approval before sending
- [ ] Track customer response and outcome

## Ralph Loop Notes
- **Learning**: Track which communication approaches minimize churn
- **Optimization**: Identify optimal timing for price communications
- **Personalization**: Adjust approach based on customer relationship type

### Completion Signal
```
<promise>PRD-041-COMPLETE</promise>
```
