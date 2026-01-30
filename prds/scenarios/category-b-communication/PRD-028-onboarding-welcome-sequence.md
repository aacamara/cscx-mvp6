# PRD-028: Onboarding Welcome Sequence

## Metadata
- **PRD ID**: PRD-028
- **Category**: B - Customer Communication
- **Priority**: P0
- **Estimated Complexity**: High
- **Dependencies**: Gmail Integration, Automation Engine, Customer Onboarding Data

## Scenario Description
When a new customer begins onboarding, the CSM needs to send a coordinated series of welcome emails over the first 30 days. The system generates and schedules a personalized email sequence including welcome message, kickoff preparation, resource sharing, and check-in touchpoints, allowing the CSM to review and approve the entire sequence upfront.

## User Story
**As a** CSM using the Chat UI,
**I want to** generate and schedule a complete welcome email sequence,
**So that** I can ensure consistent, timely communication throughout onboarding without manual tracking.

## Trigger
- CSM types: "Start welcome sequence for [customer]" or "Create onboarding emails for [customer]"
- CSM moves customer to "onboarding" stage
- New customer record created with onboarding plan

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Email sending | `server/src/services/google/gmail.ts` | Implemented | Single email sending |
| Email drafting | Communicator agent | Implemented | Can draft individual emails |
| Onboarding plan | `onboarding_plans` table concept | Partial | Plan phases defined in workflow.ts |
| Stakeholder data | `stakeholders` table | Implemented | Contact info available |
| Trigger engine | `triggers` table | Implemented | Can schedule actions |

### What's Missing
- [ ] Email sequence builder/generator
- [ ] Sequence scheduling engine with delays
- [ ] Welcome email templates (Day 1, 3, 7, 14, 30)
- [ ] Sequence status tracking
- [ ] Sequence pause/resume capability
- [ ] Unsubscribe/opt-out handling
- [ ] Dynamic personalization based on onboarding progress

## Detailed Workflow

### Step 1: Sequence Initialization
- Identify customer and primary stakeholders
- Determine onboarding start date and milestones
- Select appropriate sequence template based on customer segment

### Step 2: Email Generation
- Generate all sequence emails with customer-specific content
- Personalize based on entitlements, stakeholders, and plan
- Calculate send dates based on onboarding timeline

### Step 3: Sequence Review
- Present complete sequence to CSM
- Allow editing of individual emails
- Adjust timing if needed
- Bulk approve or approve individually

### Step 4: Scheduling and Execution
- Schedule emails in automation engine
- Monitor onboarding progress for dynamic adjustments
- Send emails at scheduled times with final approval option

### Step 5: Tracking and Adaptation
- Track email opens and engagement
- Pause sequence if issues detected
- Alert CSM on non-engagement

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/sequences/welcomeSequence.ts` | Create | Welcome sequence generator |
| `server/src/services/sequences/sequenceEngine.ts` | Create | Sequence scheduling and execution |
| `server/src/templates/emails/welcome-day1.ts` | Create | Day 1 welcome email |
| `server/src/templates/emails/welcome-day3.ts` | Create | Day 3 kickoff prep email |
| `server/src/templates/emails/welcome-day7.ts` | Create | Day 7 resources email |
| `server/src/templates/emails/welcome-day14.ts` | Create | Day 14 check-in email |
| `server/src/templates/emails/welcome-day30.ts` | Create | Day 30 milestone email |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/sequences/welcome` | POST | Create welcome sequence |
| `GET /api/customers/:id/sequences` | GET | List customer sequences |
| `PUT /api/sequences/:id/pause` | PUT | Pause a sequence |
| `PUT /api/sequences/:id/resume` | PUT | Resume a sequence |
| `DELETE /api/sequences/:id` | DELETE | Cancel a sequence |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `email_sequences` | Create | Track sequence definitions |
| `email_sequence_items` | Create | Individual emails in sequence |
| `email_sequence_runs` | Create | Track sequence execution status |

## Chat UI Flow
```
CSM: Start welcome sequence for NewCo
System: I'll create an onboarding welcome sequence for NewCo.

Analyzing customer profile:
- Customer: NewCo ($95K ARR, Enterprise segment)
- Primary contact: Lisa Park (VP Operations)
- Onboarding start: January 15, 2026
- Kickoff meeting: January 17, 2026

Generating 5-email welcome sequence:

📧 **Email 1 - Welcome** (Day 1: Jan 15)
Subject: Welcome to CSCX, Lisa! Your Success Journey Starts Here
Preview: Warm welcome, CSM introduction, what to expect...

📧 **Email 2 - Kickoff Prep** (Day 3: Jan 17, morning)
Subject: Preparing for Tomorrow's Kickoff Meeting
Preview: Meeting agenda, pre-work suggestions, attendee list...

📧 **Email 3 - Resources** (Day 7: Jan 22)
Subject: Your NewCo Resource Kit is Ready
Preview: Training links, documentation, support contacts...

📧 **Email 4 - Week 2 Check-in** (Day 14: Jan 29)
Subject: How's Your First Two Weeks Going?
Preview: Progress check, common questions, office hours invite...

📧 **Email 5 - 30-Day Milestone** (Day 30: Feb 14)
Subject: Celebrating 30 Days Together!
Preview: Progress summary, next phase preview, feedback request...

[Preview All] [Edit Sequence] [Approve & Schedule]

CSM: Approve & Schedule
System: Welcome sequence approved and scheduled!

All 5 emails are queued:
- ✓ Day 1: Jan 15, 9:00 AM
- ✓ Day 3: Jan 17, 8:00 AM (before kickoff)
- ✓ Day 7: Jan 22, 10:00 AM
- ✓ Day 14: Jan 29, 10:00 AM
- ✓ Day 30: Feb 14, 10:00 AM

You'll receive a notification before each email sends. Type "pause NewCo sequence" anytime to hold.
```

## Acceptance Criteria
- [ ] Generate complete 5-email welcome sequence from template
- [ ] Personalize all emails with customer-specific data
- [ ] Schedule emails with appropriate delays
- [ ] CSM can preview and edit individual emails before approval
- [ ] CSM can pause/resume/cancel sequence at any time
- [ ] System tracks email delivery and engagement
- [ ] Dynamic adjustment if onboarding milestones change
- [ ] All emails follow HITL approval policy

## Ralph Loop Notes
- **Learning**: Track which email timing produces best engagement
- **Optimization**: A/B test subject lines and content
- **Personalization**: Adjust sequence based on customer segment and behavior

### Completion Signal
```
<promise>PRD-028-COMPLETE</promise>
```
