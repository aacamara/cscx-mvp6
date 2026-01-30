# PRD-032: Champion Nurture Sequence

## Metadata
- **PRD ID**: PRD-032
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Stakeholder Data, Sequence Engine, Gmail Integration

## Scenario Description
A CSM wants to systematically nurture relationships with customer champions - the internal advocates who drive adoption and renewal. The system generates a personalized nurture sequence that provides value to the champion, keeps them engaged, and strengthens the advocacy relationship through recognition, exclusive access, and career development support.

## User Story
**As a** CSM using the Chat UI,
**I want to** create a champion nurture sequence,
**So that** I can maintain strong advocate relationships and reduce risk of champion disengagement.

## Trigger
- CSM types: "Create champion nurture for [stakeholder] at [customer]" or "Nurture [champion name]"
- Stakeholder identified as champion in stakeholder data
- Champion engagement score drops below threshold

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Stakeholder data | `stakeholders` table | Implemented | Can identify champions |
| Email sequences | Trigger engine | Partial | Basic scheduling exists |
| Gmail integration | `server/src/services/google/gmail.ts` | Implemented | Email sending |
| Sentiment tracking | `stakeholders.sentiment` | Implemented | Track relationship health |

### What's Missing
- [ ] Champion-specific nurture templates
- [ ] Champion engagement scoring
- [ ] Career development content library
- [ ] Exclusive access/early preview system
- [ ] Champion recognition program integration
- [ ] Champion churn risk detection

## Detailed Workflow

### Step 1: Champion Identification
- Identify champion stakeholder(s)
- Assess current engagement level
- Review interaction history and preferences

### Step 2: Nurture Strategy Selection
- Determine nurture focus:
  - Recognition and appreciation
  - Early access and exclusives
  - Career development and visibility
  - Community and networking
- Select sequence duration and frequency

### Step 3: Sequence Generation
- Generate personalized nurture emails
- Include relevant content (industry insights, career tips, exclusive previews)
- Schedule at appropriate intervals (typically monthly)

### Step 4: Execution and Monitoring
- Execute sequence with engagement tracking
- Alert on disengagement signals
- Adjust based on response patterns

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/sequences/championNurture.ts` | Create | Champion nurture sequence generator |
| `server/src/templates/emails/champion-recognition.ts` | Create | Recognition email template |
| `server/src/templates/emails/champion-exclusive.ts` | Create | Exclusive access email template |
| `server/src/templates/emails/champion-career.ts` | Create | Career development email template |
| `server/src/templates/emails/champion-community.ts` | Create | Community invitation template |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/stakeholders/:id/nurture-sequence` | POST | Create champion nurture sequence |
| `GET /api/customers/:id/champions` | GET | List champions at customer |
| `GET /api/stakeholders/:id/engagement-score` | GET | Get champion engagement metrics |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `stakeholders` | Add column | `is_champion` - Boolean flag |
| `stakeholders` | Add column | `champion_score` - Engagement score 0-100 |
| `stakeholders` | Add column | `champion_since` - Date identified as champion |
| `champion_touches` | Create | Track nurture interactions |

## Chat UI Flow
```
CSM: Create champion nurture for Sarah Chen at TechCorp
System: I'll create a champion nurture sequence for Sarah Chen.

Champion Profile:
- Name: Sarah Chen, Director of Operations
- Champion since: March 2024 (22 months)
- Engagement score: 72/100 (Good, trending down)
- Last interaction: 6 weeks ago
- Key contribution: Led 3 successful expansions, provided case study

Recommended nurture focus: Re-engagement + Recognition

📧 **Email 1 - Recognition** (Immediate)
Subject: Sarah, Thank You for Being an Amazing Partner
Preview: Genuine appreciation, highlight specific contributions...

📧 **Email 2 - Exclusive Preview** (Week 2)
Subject: Early Look: Q2 Product Roadmap (Champions Only)
Preview: Exclusive preview of upcoming features, request feedback...

📧 **Email 3 - Career Spotlight** (Week 4)
Subject: Industry Trends Report + Speaking Opportunity
Preview: Share industry report, invite to webinar panel...

📧 **Email 4 - Community** (Week 6)
Subject: Join Our Champion Advisory Board?
Preview: Invite to exclusive champion community, networking perks...

📧 **Email 5 - Check-in** (Week 8)
Subject: Coffee Catch-up? I'd Love Your Perspective
Preview: Personal connection, no agenda, relationship building...

[Preview All] [Customize] [Start Sequence]

CSM: Start Sequence
System: Champion nurture sequence started for Sarah Chen!

First email sends immediately. You'll receive engagement alerts.
```

## Acceptance Criteria
- [ ] Identify champions from stakeholder data
- [ ] Calculate champion engagement score
- [ ] Generate personalized nurture sequence (recognition, exclusive, career, community)
- [ ] Track all nurture interactions
- [ ] Alert on declining engagement
- [ ] Support sequence customization
- [ ] Follow HITL approval for each email
- [ ] Update champion_score based on engagement

## Ralph Loop Notes
- **Learning**: Identify which nurture content resonates most with champions
- **Optimization**: Optimal frequency for champion touchpoints
- **Personalization**: Match content to champion interests and career stage

### Completion Signal
```
<promise>PRD-032-COMPLETE</promise>
```
