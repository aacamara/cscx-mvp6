# PRD-047: Upsell Introduction Email

## Metadata
- **PRD ID**: PRD-047
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail Integration, Expansion Signals, Usage Data

## Scenario Description
A CSM identifies an upsell opportunity and needs to introduce the expansion conversation to the customer. The system generates a non-pushy introduction email that frames the upsell in terms of customer value, references their specific situation, and proposes a conversation rather than a hard sell.

## User Story
**As a** CSM using the Chat UI,
**I want to** introduce upsell opportunities professionally,
**So that** I can initiate expansion conversations that feel helpful rather than salesy.

## Trigger
- CSM types: "Introduce upsell to [customer]" or "Send expansion email to [customer]"
- Expansion signal detected (hitting usage limits, feature requests)
- Customer achieving success indicating readiness for more
- Renewal approaching with expansion opportunity

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Expansion opportunities | `expansion_opportunities` table | Implemented | Tracks opportunities |
| Usage metrics | `usage_metrics` table | Implemented | Usage patterns |
| Expansion agent | Implemented | Partial | Can identify opportunities |
| Email drafting | Communicator agent | Implemented | Can draft expansion emails |

### What's Missing
- [ ] Upsell introduction templates
- [ ] Value-based expansion framing
- [ ] Soft introduction vs. hard sell options
- [ ] Expansion conversation tracking
- [ ] AE coordination workflow

## Detailed Workflow

### Step 1: Opportunity Analysis
- Identify specific expansion opportunity
- Gather supporting data (usage, requests, signals)
- Calculate potential value for customer
- Determine best approach (CSM-led vs. AE-involved)

### Step 2: Framing Strategy
- Select introduction approach:
  - Educational (share what's possible)
  - Problem-solving (address limitation they've hit)
  - Value-add (build on their success)
  - Proactive (prepare for their growth)

### Step 3: Email Generation
- Draft value-focused introduction
- Reference customer-specific context
- Propose conversation (not hard sell)
- Include relevant resources/info

### Step 4: Track and Coordinate
- Track email engagement
- Coordinate with AE if needed
- Follow up based on response

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/upsell-educational.ts` | Create | Educational upsell intro |
| `server/src/templates/emails/upsell-problem.ts` | Create | Problem-solving upsell intro |
| `server/src/templates/emails/upsell-value.ts` | Create | Value-add upsell intro |
| `server/src/services/expansion/introGenerator.ts` | Create | Upsell intro generation logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/upsell-intro` | POST | Generate upsell introduction |
| `GET /api/customers/:id/expansion-context` | GET | Get expansion context data |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `expansion_opportunities` | Add column | `intro_sent_at` - Track introduction |
| `expansion_opportunities` | Add column | `intro_response` - Track response |

## Chat UI Flow
```
CSM: Introduce upsell to Acme Corp
System: I'll help you introduce an expansion opportunity to Acme Corp.

Expansion Context:
- Current tier: Professional (100 users)
- Usage: 98% of user licenses consumed
- API calls: 85% of monthly limit
- Feature requests: Advanced analytics, API priority
- Health score: 87 (excellent)
- Expansion opportunity: Enterprise tier (+$48K/year)

Recommended approach: Problem-solving (they're hitting limits)

📧 **Upsell Introduction**
---
Subject: Noticed You're Approaching Some Limits - Let's Chat

Hi Jennifer,

I was reviewing your account this week and noticed Acme Corp is growing quickly - which is fantastic! I also noticed you're getting close to a few limits:

• **Users:** 98/100 licenses used
• **API calls:** 85% of monthly allocation

First, this is a great "problem" to have - it means adoption is strong and your team is getting real value.

I wanted to reach out proactively because there are a few options to ensure your growth isn't constrained:

**Option 1:** Optimize current usage (I can help identify any inactive users)
**Option 2:** Explore our Enterprise tier, which includes:
  - Unlimited users
  - 5x API capacity
  - Advanced analytics (which I know you've asked about!)
  - Priority support

No pressure at all - I just wanted to flag this before you hit any walls. Would you have 20 minutes next week to chat about what makes sense for Acme's growth trajectory?

[Schedule a Quick Call →]

Either way, I'm here to help you succeed!

Best,
[CSM Name]
---

[Edit] [CC Account Executive] [Send]

CSM: Send
System: Upsell introduction sent to Acme Corp!
```

## Acceptance Criteria
- [ ] Identify specific expansion opportunity with supporting data
- [ ] Generate value-focused (not salesy) introduction
- [ ] Reference customer-specific usage and context
- [ ] Offer alternatives (optimize vs. expand)
- [ ] Propose conversation, not immediate purchase
- [ ] Support AE coordination via CC
- [ ] Track introduction and response
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Track which introduction approaches convert best
- **Optimization**: Identify optimal timing for expansion conversations
- **Personalization**: Match approach to customer buying style

### Completion Signal
```
<promise>PRD-047-COMPLETE</promise>
```
