# PRD-040: Milestone Celebration Email

## Metadata
- **PRD ID**: PRD-040
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, Customer Metrics, Milestone Detection

## Scenario Description
A CSM wants to celebrate a significant customer milestone - such as 1-year anniversary, usage milestone, achievement of stated goals, or successful project completion. The system generates a celebratory email that acknowledges the accomplishment and strengthens the partnership.

## User Story
**As a** CSM using the Chat UI,
**I want to** send milestone celebration emails,
**So that** I can acknowledge customer achievements and reinforce the value of our partnership.

## Trigger
- CSM types: "Celebrate [milestone] with [customer]" or "Send anniversary email to [customer]"
- System detects milestone (anniversary, usage threshold, goal achieved)
- Customer completes major project or implementation

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Customer tenure | `customers.created_at` | Implemented | Can calculate anniversary |
| Usage metrics | `usage_metrics` table | Implemented | Can detect usage milestones |
| Success metrics | QBR data, meeting notes | Partial | Outcomes tracked |
| Email drafting | Communicator agent | Implemented | Can draft emails |

### What's Missing
- [ ] Milestone detection engine
- [ ] Milestone-specific templates
- [ ] Celebration email templates
- [ ] Milestone tracking/reminder system
- [ ] Visual celebration elements (badges, certificates)

## Detailed Workflow

### Step 1: Milestone Identification
- Detect or confirm milestone:
  - Anniversary (1yr, 2yr, 3yr, etc.)
  - Usage milestone (10K users, 1M API calls, etc.)
  - Goal achievement
  - Project completion
  - Adoption milestone (100% team adoption)

### Step 2: Context Gathering
- Collect relevant metrics and achievements
- Identify key accomplishments since last milestone
- Calculate partnership value delivered

### Step 3: Celebration Email
- Generate celebratory message
- Include specific achievements and metrics
- Express genuine appreciation
- Look forward to continued partnership

### Step 4: Send and Log
- Send celebration email
- Log milestone for future reference
- Optionally schedule next milestone reminder

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/milestone-anniversary.ts` | Create | Anniversary celebration template |
| `server/src/templates/emails/milestone-usage.ts` | Create | Usage milestone template |
| `server/src/templates/emails/milestone-goal.ts` | Create | Goal achievement template |
| `server/src/services/milestones/detector.ts` | Create | Milestone detection logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/celebrate` | POST | Generate milestone celebration |
| `GET /api/customers/:id/milestones` | GET | Get upcoming and past milestones |
| `GET /api/milestones/upcoming` | GET | List upcoming milestones across portfolio |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `customer_milestones` | Create | Track milestone events |

## Chat UI Flow
```
CSM: Celebrate 2-year anniversary with TechStart
System: I'll create a 2-year anniversary celebration for TechStart!

Partnership Summary:
- Partnership started: January 28, 2024
- Anniversary: January 28, 2026 (Tomorrow!)
- ARR growth: $50K → $125K (150% increase)
- Key achievements:
  - 3 successful expansions
  - 47% efficiency improvement
  - Zero churn risk signals in 24 months
  - NPS: 9 (Promoter)

📧 **Anniversary Celebration**
---
Subject: Happy 2nd Anniversary, TechStart! 🎉

Hi Amanda,

I can't believe it's already been two years since TechStart joined our community! Time flies when you're achieving great things together.

**A Quick Look Back at Our Journey:**
• Started with 10 users, now serving 85+ across your organization
• Achieved 47% operational efficiency improvement
• Expanded partnership 3x based on your team's success
• Zero downtime or major issues in 24 months

Beyond the metrics, it's been a genuine pleasure working with you and the team. Your feedback has made our product better, and your enthusiasm has been contagious.

Here's to many more years of success together! 🥂

As a small thank you, I'd love to [offer early access to our new beta features / treat you to lunch / send something fun to the office]. What would you prefer?

With gratitude,
[CSM Name]
---

[Edit] [Add Certificate] [Send]

CSM: Send
System: Anniversary celebration sent to TechStart!

Milestone logged: 2-year anniversary celebrated on January 28, 2026.
```

## Acceptance Criteria
- [ ] Detect various milestone types (anniversary, usage, goals)
- [ ] Calculate partnership metrics for celebration context
- [ ] Generate warm, genuine celebration message
- [ ] Include specific achievements and metrics
- [ ] Support optional celebration elements (certificates, gifts)
- [ ] Log milestones celebrated
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Track which celebrations strengthen relationships most
- **Optimization**: Identify optimal milestone celebration timing
- **Personalization**: Match celebration style to customer preferences

### Completion Signal
```
<promise>PRD-040-COMPLETE</promise>
```
