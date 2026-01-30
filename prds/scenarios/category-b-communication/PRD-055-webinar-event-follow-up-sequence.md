# PRD-055: Webinar/Event Follow-Up Sequence

## Metadata
- **PRD ID**: PRD-055
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail Integration, Event Registration Data, Sequence Engine

## Scenario Description
After a customer attends (or registers but misses) a webinar or event, the CSM needs to follow up with personalized communication. The system generates a follow-up sequence that provides value, shares relevant resources, and creates opportunities for deeper engagement based on the event content and customer's participation.

## User Story
**As a** CSM using the Chat UI,
**I want to** send post-event follow-up sequences,
**So that** I can maximize event ROI by converting engagement into action.

## Trigger
- CSM types: "Follow up with [customer] on [webinar/event]" or "Send event follow-up sequence to [attendee list]"
- Event ends (automated trigger)
- Post-event attendee list received

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Event tracking | Concept | Partial | Basic event data |
| Email sequences | Trigger engine | Partial | Can schedule emails |
| Email drafting | Communicator agent | Implemented | Can draft follow-ups |

### What's Missing
- [ ] Event attendee tracking
- [ ] Post-event follow-up templates
- [ ] Attendee vs. no-show differentiation
- [ ] Event content resource library
- [ ] Engagement tracking post-event

## Detailed Workflow

### Step 1: Participation Analysis
- Identify customer participation status:
  - Attended live
  - Registered but missed
  - Partial attendance
- Gather event context (topic, key takeaways)

### Step 2: Sequence Selection
- Select appropriate follow-up path:
  - **Attended**: Thank you + resources + discussion offer
  - **Missed**: Recording + summary + catch-up offer
- Determine sequence length

### Step 3: Sequence Generation
- Generate follow-up sequence
- Include relevant resources (recording, slides, summary)
- Add personalized insights based on customer context
- Create conversion opportunity

### Step 4: Execution
- Schedule sequence
- Track engagement
- Adjust based on response

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/event-followup-attended.ts` | Create | Attended follow-up template |
| `server/src/templates/emails/event-followup-missed.ts` | Create | Missed follow-up template |
| `server/src/templates/emails/event-followup-resources.ts` | Create | Resources email template |
| `server/src/services/events/followupSequence.ts` | Create | Event follow-up sequence logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/events/:id/followup` | POST | Generate event follow-up sequence |
| `GET /api/events/:id/attendees` | GET | Get event attendance data |
| `POST /api/events/:id/bulk-followup` | POST | Bulk follow-up for all attendees |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `event_attendance` | Create | Track customer event attendance |
| `event_followups` | Create | Track follow-up sequences |

## Chat UI Flow
```
CSM: Follow up with attendees from the AI Automation webinar
System: I'll prepare follow-up sequences for the AI Automation webinar attendees.

Event Details:
- Event: "AI Automation in Customer Success" Webinar
- Date: January 25, 2026
- Your customers: 8 registered

Attendance Analysis:
- Attended (5): TechCorp, DataFlow, CloudSync, InnovateTech, GlobalSoft
- Registered but missed (3): StartupCo, MidMarket Inc, Enterprise Ltd

I'll generate personalized sequences for each group.

📧 **Sequence for Attendees (5 customers)**

**Email 1 - Thank You (Day 1)**
Subject: Thanks for Joining - AI Automation Key Takeaways
Preview: Thank you, recap of key points, recording link...

**Email 2 - Resources (Day 3)**
Subject: Your AI Automation Toolkit
Preview: Slides, implementation checklist, case studies...

**Email 3 - Discussion (Day 7)**
Subject: How Could AI Automation Help [Company]?
Preview: Personalized application of webinar content...

📧 **Sequence for No-Shows (3 customers)**

**Email 1 - Recording (Day 1)**
Subject: Missed the Webinar? Here's the Recording
Preview: We missed you, recording link, summary...

**Email 2 - Highlights (Day 4)**
Subject: 3 Things You'll Want from the AI Webinar
Preview: Key takeaways summary, quick-start guide...

Sample personalized email for TechCorp (attended):

---
Subject: Thanks for Joining, Sarah - Your AI Automation Next Steps

Hi Sarah,

Great to see you at yesterday's AI Automation webinar! I noticed you stayed for the Q&A - hope you found it valuable.

**Key Takeaways:**
• 40% efficiency gains possible with AI-assisted workflows
• Implementation in 3 phases: Automate → Augment → Orchestrate
• Quick wins: Email drafting, meeting prep, health score alerts

**Your Resources:**
• [Recording]
• [Slides]
• [Implementation Checklist]

**For TechCorp Specifically:**
Given your team's focus on scaling operations, I think the "Augment" phase strategies would be most relevant for you right now. Would you be interested in a 20-minute chat about how this applies to your workflows?

Thanks for engaging with us!

Best,
[CSM Name]
---

[Preview All Sequences] [Edit] [Start Sequences]

CSM: Start Sequences
System: Event follow-up sequences started!

- 5 "attended" sequences: 3 emails each over 7 days
- 3 "missed" sequences: 2 emails each over 4 days

You'll receive engagement alerts as customers respond.
```

## Acceptance Criteria
- [ ] Differentiate between attended and missed customers
- [ ] Generate appropriate sequence for each group
- [ ] Include relevant event resources (recording, slides, summary)
- [ ] Personalize based on customer context
- [ ] Support bulk sequence initiation
- [ ] Track engagement throughout sequence
- [ ] Create conversion opportunities (discussion, demo)
- [ ] Follow HITL approval for sequences

## Ralph Loop Notes
- **Learning**: Track which follow-up approaches drive engagement
- **Optimization**: Identify optimal timing for post-event outreach
- **Personalization**: Match event content relevance to customer needs

### Completion Signal
```
<promise>PRD-055-COMPLETE</promise>
```
