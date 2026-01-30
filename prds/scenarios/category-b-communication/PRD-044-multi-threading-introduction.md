# PRD-044: Multi-Threading Introduction

## Metadata
- **PRD ID**: PRD-044
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail Integration, Stakeholder Data, LinkedIn Integration (optional)

## Scenario Description
A CSM needs to expand relationships beyond their primary contact by requesting introductions to other stakeholders. The system generates professional introduction request emails that make it easy for the champion to facilitate connections while explaining the value of multi-threaded relationships.

## User Story
**As a** CSM using the Chat UI,
**I want to** request introductions to additional stakeholders,
**So that** I can build multi-threaded relationships and reduce single-point-of-failure risk.

## Trigger
- CSM types: "Request intro to [stakeholder] at [customer]" or "Multi-thread into [customer]"
- Single-threaded risk detected
- Expansion opportunity requires new stakeholder relationship
- Champion transition risk identified

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Stakeholder data | `stakeholders` table | Implemented | Known contacts |
| Email drafting | Communicator agent | Implemented | Can draft intro requests |
| Risk signals | `risk_signals` table | Implemented | Can flag single-threading |

### What's Missing
- [ ] Multi-threading score/assessment
- [ ] Introduction request templates
- [ ] Stakeholder mapping recommendations
- [ ] Introduction tracking
- [ ] Relationship depth metrics

## Detailed Workflow

### Step 1: Multi-Threading Assessment
- Analyze current relationship depth
- Identify stakeholder gaps:
  - Executive sponsor
  - Technical champion
  - End users
  - Finance/procurement
- Prioritize introduction targets

### Step 2: Target Selection
- Select specific stakeholder to meet
- Identify best introducer (existing champion)
- Prepare value proposition for new relationship

### Step 3: Introduction Request
- Draft introduction request to champion
- Explain why relationship would help
- Make introduction easy (draft email, suggest format)
- Offer value to new stakeholder

### Step 4: Follow Through
- Track introduction status
- Send thank you to introducer
- Build relationship with new stakeholder

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/intro-request.ts` | Create | Introduction request template |
| `server/src/templates/emails/intro-draft.ts` | Create | Draft introduction email for champion to forward |
| `server/src/services/relationships/multiThread.ts` | Create | Multi-threading logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/intro-request` | POST | Generate introduction request |
| `GET /api/customers/:id/threading-score` | GET | Get multi-threading assessment |
| `GET /api/customers/:id/stakeholder-gaps` | GET | Identify missing stakeholder types |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `stakeholders` | Add column | `introduced_by` - Track introduction source |
| `stakeholders` | Add column | `introduction_date` - When introduced |
| `customers` | Add column | `threading_score` - Multi-threading depth |

## Chat UI Flow
```
CSM: Request intro to the CFO at TechCorp
System: I'll help you request an introduction to TechCorp's CFO.

Multi-Threading Assessment:
- Current contacts: 2 (Sarah Chen - Dir Ops, Mike Johnson - Analyst)
- Threading score: 3/10 (Single-threaded risk)
- Missing: Executive sponsor, Finance, IT

Target stakeholder:
- Name: Robert Williams, CFO
- Why: Renewal in 90 days, budget authority needed

Best introducer: Sarah Chen (strong champion, reports to CFO's peer)

📧 **Introduction Request to Sarah**
---
Subject: Quick Favor - Introduction to Robert Williams?

Hi Sarah,

I hope you're having a great week! I have a quick ask - would you be comfortable introducing me to Robert Williams?

**Why I'm asking:**
As we approach your renewal in March, I'd love to ensure Robert has visibility into the value TechCorp has achieved with our partnership. I know finance leaders appreciate having direct relationships with vendors, especially for strategic investments.

**What I'd discuss with him:**
• Overview of ROI achieved (the 4.2x return we documented)
• Budget planning support for renewal
• Any finance-specific questions about our partnership

**To make it easy, here's a draft you can forward:**

---
Hi Robert,

I wanted to connect you with [CSM Name], our Customer Success Manager. They've been instrumental in our success with [Product] - we've achieved 4.2x ROI since implementation.

With our renewal coming up, I thought it would be valuable for you two to connect on the business impact and planning. Would you have 20 minutes in the next few weeks?

[Your intro]
Sarah
---

No pressure at all if the timing isn't right - just let me know!

Thanks,
[CSM Name]
---

[Edit] [Edit Draft Intro] [Send]

CSM: Send
System: Introduction request sent to Sarah at TechCorp!
```

## Acceptance Criteria
- [ ] Assess current multi-threading depth
- [ ] Identify missing stakeholder types
- [ ] Generate professional introduction request
- [ ] Include draft email for champion to forward
- [ ] Explain value of new relationship
- [ ] Track introduction status
- [ ] Update stakeholder records upon successful intro
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Track which introduction approaches are most successful
- **Optimization**: Identify best timing for introduction requests
- **Personalization**: Match approach to champion's communication style

### Completion Signal
```
<promise>PRD-044-COMPLETE</promise>
```
