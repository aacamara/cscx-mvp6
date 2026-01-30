# PRD-039: Event Invitation Generator

## Metadata
- **PRD ID**: PRD-039
- **Category**: B - Customer Communication
- **Priority**: P2
- **Estimated Complexity**: Low
- **Dependencies**: Gmail Integration, Customer Data, Event Management

## Scenario Description
A CSM needs to invite customers to company events such as user conferences, webinars, roundtables, or local meetups. The system generates personalized invitations that highlight why the specific event is relevant to each customer's interests, industry, and current challenges.

## User Story
**As a** CSM using the Chat UI,
**I want to** send personalized event invitations,
**So that** I can increase event attendance by making invitations relevant to each customer.

## Trigger
- CSM types: "Invite [customer] to [event]" or "Send event invite to [customer list]"
- New event announced by marketing
- Customer expressing interest in topic covered by upcoming event

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Email drafting | Communicator agent | Implemented | Can draft invitations |
| Customer interests | Customer data, meeting notes | Partial | Some interest data available |
| Industry data | `customers.industry` | Implemented | Industry classification |
| Gmail integration | `server/src/services/google/gmail.ts` | Implemented | Email sending |

### What's Missing
- [ ] Event catalog/management system
- [ ] Event-customer relevance matching
- [ ] Event invitation templates
- [ ] Registration tracking
- [ ] Post-event follow-up automation

## Detailed Workflow

### Step 1: Event Selection
- Identify target event
- Get event details (date, location, agenda, speakers)
- Determine target audience criteria

### Step 2: Customer Matching
- Match customers to event based on:
  - Industry relevance
  - Current challenges/interests
  - Geography (for in-person events)
  - Past event attendance

### Step 3: Invitation Generation
- Generate personalized invitation
- Highlight specific sessions/speakers relevant to customer
- Include registration link and logistics
- Add personalized reason for attending

### Step 4: Manage Responses
- Track invitations sent
- Monitor registrations
- Send reminders to registrants
- Follow up with non-responders

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/templates/emails/event-invite-conference.ts` | Create | Conference invitation template |
| `server/src/templates/emails/event-invite-webinar.ts` | Create | Webinar invitation template |
| `server/src/templates/emails/event-invite-roundtable.ts` | Create | Roundtable invitation template |
| `server/src/services/events/invitationGenerator.ts` | Create | Event invitation logic |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/events/:id/invite` | POST | Generate event invitation |
| `POST /api/events` | POST | Create/manage events |
| `GET /api/events/:id/relevant-customers` | GET | Find relevant customers for event |
| `GET /api/customers/:id/event-history` | GET | Get customer's event history |

### Database Changes
| Table | Action | Description |
|-------|--------|-------------|
| `events` | Create | Track event catalog |
| `event_invitations` | Create | Track invitations sent |
| `event_registrations` | Create | Track registrations |

## Chat UI Flow
```
CSM: Invite DataFlow to the Customer Success Summit
System: I'll create a personalized invitation for DataFlow to the Customer Success Summit.

Event Details:
- Event: 2026 Customer Success Summit
- Date: March 15-16, 2026
- Location: San Francisco + Virtual Option
- Key Topics: AI in CS, Scaling Success, Executive Engagement

DataFlow Profile:
- Industry: SaaS/Technology
- Current focus: Scaling operations, AI adoption
- Champion: Maria Santos (VP Customer Success)
- Location: Austin, TX (virtual likely better fit)

Relevant sessions identified:
- "Scaling CS with AI Agents" - Day 1, 2:00 PM
- "Building Executive Relationships" - Day 2, 10:00 AM
- Roundtable: SaaS Customer Success Leaders

📧 **Event Invitation**
---
Subject: You're Invited: Customer Success Summit 2026 (Sessions You'll Love)

Hi Maria,

I wanted to personally invite you to our 2026 Customer Success Summit on March 15-16. Given your focus on scaling operations and interest in AI adoption, I think you'd find several sessions particularly valuable:

**Sessions Picked for You:**
🎯 "Scaling CS with AI Agents" - See how leading teams are automating without losing the human touch
🎯 "Building Executive Relationships" - Strategies for multi-threading at the C-level
🎯 SaaS CS Leaders Roundtable - Connect with peers facing similar challenges

**Event Details:**
📅 March 15-16, 2026
📍 San Francisco + Virtual Option (full virtual access available!)
🎟️ Early bird pricing ends Feb 15

**[Register with 20% CS Partner Discount →]**

I'll be there and would love to connect in person or virtually. Let me know if you have any questions!

Best,
[CSM Name]
---

[Edit] [Send]

CSM: Send
System: Event invitation sent to Maria at DataFlow!
```

## Acceptance Criteria
- [ ] Match events to customers based on relevance criteria
- [ ] Personalize invitation with specific session recommendations
- [ ] Support multiple event types (conference, webinar, roundtable)
- [ ] Include relevant logistics and registration links
- [ ] Track invitation delivery and registration
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Track which customers attend which event types
- **Optimization**: Improve event-customer matching over time
- **Personalization**: Learn customer interests for better session recommendations

### Completion Signal
```
<promise>PRD-039-COMPLETE</promise>
```
