# PRD-031: Executive Sponsor Outreach

## Metadata
- **PRD ID**: PRD-031
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Stakeholder Data, Gmail Integration, Account Plan Data

## Scenario Description
A CSM needs to establish or maintain a relationship with an executive sponsor at a customer account. The system generates professional, executive-appropriate outreach that positions the CSM as a strategic partner, provides high-level value insights, and proposes executive-level engagement opportunities.

## User Story
**As a** CSM using the Chat UI,
**I want to** draft executive sponsor outreach emails,
**So that** I can build multi-threaded relationships at the executive level with appropriate messaging.

## Trigger
- CSM types: "Draft executive outreach for [customer]" or "Contact [executive name] at [customer]"
- Account plan identifies need for executive engagement
- Pre-QBR executive alignment outreach

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Stakeholder data | `stakeholders` table | Implemented | Includes role, sentiment |
| Account plans | `account_plans` table | Implemented | Strategic objectives |
| Renewal pipeline | `renewal_pipeline` table | Implemented | `exec_sponsor_engaged` flag |
| Email drafting | Communicator agent | Implemented | General email capability |

### What's Missing
- [ ] Executive-specific email templates
- [ ] Executive brief content generator
- [ ] Business impact summary for executives
- [ ] Executive meeting proposal formats
- [ ] Executive relationship health tracking
- [ ] Talking points generator for executive calls

## Detailed Workflow

### Step 1: Executive Identification
- Identify target executive(s) from stakeholder data
- Review existing relationship status
- Check recent executive interactions (or lack thereof)

### Step 2: Context Preparation
- Generate executive summary of partnership value
- Identify strategic topics relevant to executive
- Research executive's public priorities (optional)

### Step 3: Outreach Crafting
- Select appropriate outreach purpose:
  - Introduction/relationship building
  - Strategic alignment
  - Pre-QBR executive briefing
  - Issue escalation awareness
  - Expansion conversation
- Draft concise, executive-appropriate email
- Include clear value proposition and ask

### Step 4: Review and Send
- Present draft with suggested send time
- Allow tone and content adjustments
- Send with HITL approval

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/executive-intro.ts` | Create | Executive introduction template |
| `server/src/templates/emails/executive-briefing.ts` | Create | Executive briefing request template |
| `server/src/templates/emails/executive-strategic.ts` | Create | Strategic alignment template |
| `server/src/services/executive/outreachGenerator.ts` | Create | Executive outreach logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/executive-outreach` | POST | Generate executive outreach |
| `GET /api/customers/:id/executive-summary` | GET | Get executive-level partnership summary |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `stakeholders` | Add column | `last_exec_outreach` - Track executive touches |
| `stakeholders` | Add column | `exec_engagement_score` - Relationship depth |

## Chat UI Flow
```
CSM: Draft executive outreach for Global Retail Co
System: I'll draft executive outreach for Global Retail Co.

Identifying executives:
- CEO: Jennifer Walsh (no prior direct contact)
- CFO: Robert Kim (met once at QBR Q2 2025)
- CTO: Amanda Chen (regular contact, champion)

Select target executive:
[Jennifer Walsh - CEO] [Robert Kim - CFO] [Amanda Chen - CTO]

CSM: Robert Kim - CFO
System: Drafting outreach to CFO Robert Kim.

Context gathered:
- Last contact: Q2 2025 QBR (7 months ago)
- ARR: $450K, renewal in 90 days
- Key metric: 32% cost reduction achieved
- Upcoming: Q1 2026 QBR

📧 **Executive Outreach Draft**
---
Subject: Global Retail Co Partnership ROI & Q1 Alignment

Robert,

I hope the new year is off to a strong start. I wanted to reach out ahead of our upcoming Q1 business review to share some highlights from our partnership and ensure we're aligned on priorities for the year ahead.

**Key 2025 Results:**
• 32% operational cost reduction (exceeding 25% target)
• 4.2x ROI on platform investment
• Successful expansion to 3 additional business units

As we approach renewal in March, I'd welcome 20 minutes to discuss how we can continue building on this momentum and explore alignment with Global Retail's 2026 strategic initiatives.

Would the week of January 20th work for a brief call?

Best regards,
[CSM Name]
---

[Edit] [Suggest Alternative Times] [Send]
```

## Acceptance Criteria
- [ ] Identify and list executive stakeholders for selection
- [ ] Generate executive-appropriate messaging (concise, strategic, value-focused)
- [ ] Include quantified business impact metrics
- [ ] Support multiple outreach purposes (intro, briefing, strategic)
- [ ] Track executive engagement attempts and responses
- [ ] Follow HITL approval before sending
- [ ] Update stakeholder record with outreach date

## Ralph Loop Notes
- **Learning**: Track which executive outreach approaches get responses
- **Optimization**: Identify best times/days for executive email delivery
- **Personalization**: Adapt messaging based on executive role (CEO vs. CFO vs. CTO)

### Completion Signal
```
<promise>PRD-031-COMPLETE</promise>
```
