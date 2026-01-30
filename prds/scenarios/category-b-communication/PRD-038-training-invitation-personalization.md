# PRD-038: Training Invitation Personalization

## Metadata
- **PRD ID**: PRD-038
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, Usage Data, Customer Entitlements

## Scenario Description
A CSM needs to invite customer users to training sessions. The system generates personalized training invitations based on the user's role, current feature adoption, and skill gaps, making the training feel relevant rather than generic.

## User Story
**As a** CSM using the Chat UI,
**I want to** send personalized training invitations,
**So that** I can increase training attendance by making invitations relevant to each recipient.

## Trigger
- CSM types: "Invite [customer] to training" or "Send training invite for [topic] to [customer]"
- New feature released requiring training
- Low adoption detected for specific features
- Onboarding training scheduled

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Usage metrics | `usage_metrics` table | Implemented | Feature adoption data |
| Email drafting | Communicator agent | Implemented | Can draft invitations |
| Calendar integration | `server/src/services/google/calendar.ts` | Implemented | Can create events |
| Stakeholder data | `stakeholders` table | Implemented | Roles available |

### What's Missing
- [ ] Training session catalog/schedule
- [ ] Role-based training recommendations
- [ ] Training attendance tracking
- [ ] Skill gap analysis for personalization
- [ ] Training invitation templates

## Detailed Workflow

### Step 1: Training Selection
- Identify training topic/session
- Get training date, time, and format details
- Determine target audience

### Step 2: Recipient Analysis
- Identify relevant stakeholders by role
- Analyze feature adoption gaps
- Determine personalization angle for each

### Step 3: Invitation Generation
- Draft personalized invitation per recipient
- Highlight relevant benefits based on role/gaps
- Include clear logistics and registration

### Step 4: Send and Track
- Send invitations (individual or bulk)
- Track registrations and attendance
- Follow up with non-registrants

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/training-invite.ts` | Create | Training invitation template |
| `server/src/services/training/invitationGenerator.ts` | Create | Personalized invitation logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/training-invite` | POST | Generate training invitation |
| `POST /api/training-sessions` | POST | Create/manage training sessions |
| `GET /api/customers/:id/training-gaps` | GET | Identify training needs |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `training_sessions` | Create | Track training session catalog |
| `training_invitations` | Create | Track invitations sent |
| `training_attendance` | Create | Track registration and attendance |

## Chat UI Flow
```
CSM: Invite CloudTech team to Advanced Analytics training
System: I'll create personalized training invitations for CloudTech.

Training Details:
- Topic: Advanced Analytics & Custom Dashboards
- Date: February 5, 2026, 2:00 PM EST
- Duration: 90 minutes
- Format: Live webinar with Q&A

CloudTech stakeholders identified:
1. Sarah Chen (Director of Ops) - Low dashboard adoption
2. Mike Johnson (Data Analyst) - Power user, good fit for advanced
3. Lisa Park (Team Lead) - Medium adoption, could benefit

Generating personalized invitations...

📧 **Invitation to Sarah Chen**
---
Subject: Unlock Custom Dashboards - Training on Feb 5

Hi Sarah,

I noticed your team hasn't fully explored our custom dashboard capabilities yet - and I think they could save you significant time on your monthly reporting.

I'd love to invite you to our **Advanced Analytics Training** on February 5th at 2:00 PM EST. In 90 minutes, you'll learn:

• How to build custom dashboards tailored to your KPIs
• Automated report scheduling (no more manual exports!)
• Tips for sharing insights across your organization

**[Register Now →]**

Can't make this date? Reply and I'll find an alternative session for you.

Best,
[CSM Name]
---

[Preview All 3] [Edit Individual] [Send All]

CSM: Send All
System: 3 personalized training invitations sent to CloudTech team!
```

## Acceptance Criteria
- [ ] Identify relevant stakeholders based on role and adoption
- [ ] Personalize invitation with specific benefits per recipient
- [ ] Include clear training logistics
- [ ] Support bulk sending with individual personalization
- [ ] Track invitation delivery, registration, and attendance
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Track which personalization approaches increase attendance
- **Optimization**: Identify best timing for training invitations
- **Personalization**: Match training recommendations to adoption gaps

### Completion Signal
```
<promise>PRD-038-COMPLETE</promise>
```
