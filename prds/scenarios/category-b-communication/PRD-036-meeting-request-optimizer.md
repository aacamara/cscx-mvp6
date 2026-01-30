# PRD-036: Meeting Request Optimizer

## Metadata
- **PRD ID**: PRD-036
- **Category**: B - Customer Communication
- **Priority**: P1
- **Estimated Complexity**: Medium
- **Dependencies**: Gmail Integration, Calendar Integration, Stakeholder Data

## Scenario Description
A CSM needs to request a meeting with a customer but wants to maximize the chance of acceptance. The system analyzes past meeting patterns, stakeholder preferences, and calendar availability to generate an optimized meeting request with the best timing, duration, and framing.

## User Story
**As a** CSM using the Chat UI,
**I want to** send optimized meeting requests,
**So that** I can increase meeting acceptance rates and respect customer time preferences.

## Trigger
- CSM types: "Request meeting with [customer]" or "Schedule call with [stakeholder]"
- CSM needs to book QBR, check-in, or other recurring meeting
- Follow-up meeting needed after specific event

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Calendar integration | `server/src/services/google/calendar.ts` | Implemented | Check availability, create events |
| Email drafting | Communicator agent | Implemented | Can draft meeting requests |
| Meeting history | `meetings` table | Implemented | Past meeting data |
| Stakeholder data | `stakeholders` table | Implemented | Contact preferences |

### What's Missing
- [ ] Meeting acceptance pattern analysis
- [ ] Optimal time/day recommendations
- [ ] Stakeholder time preference learning
- [ ] Smart duration suggestions
- [ ] Meeting request templates optimized for response
- [ ] A/B testing of meeting request approaches

## Detailed Workflow

### Step 1: Context Analysis
- Identify meeting purpose and required attendees
- Analyze past meeting patterns with customer
- Check CSM calendar availability
- Review stakeholder time zone and preferences

### Step 2: Optimization Recommendations
- Suggest optimal day of week based on history
- Recommend time slot based on patterns
- Suggest appropriate duration
- Recommend meeting format (video, phone, in-person)

### Step 3: Request Generation
- Draft meeting request email
- Include clear purpose and agenda
- Offer 2-3 time options
- Easy response mechanism (calendar link, reply options)

### Step 4: Send and Track
- Send optimized meeting request
- Track response time and outcome
- Learn from acceptance/rejection

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/meetings/optimizer.ts` | Create | Meeting optimization logic |
| `server/src/services/meetings/patternAnalyzer.ts` | Create | Analyze meeting acceptance patterns |
| `server/src/templates/emails/meeting-request.ts` | Create | Optimized meeting request template |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/customers/:id/meeting-request` | POST | Generate optimized meeting request |
| `GET /api/customers/:id/meeting-patterns` | GET | Get meeting pattern analysis |
| `GET /api/stakeholders/:id/preferences` | GET | Get stakeholder scheduling preferences |

### Database Changes
| Table | Change | Description |
|-------|--------|-------------|
| `meetings` | Add column | `request_sent_at` - When request was sent |
| `meetings` | Add column | `response_time_hours` - Time to respond |
| `stakeholder_preferences` | Create | Track scheduling preferences |

## Chat UI Flow
```
CSM: Request meeting with Jennifer at Acme Corp
System: I'll help you request a meeting with Jennifer at Acme Corp.

Analyzing meeting patterns:
- Jennifer's timezone: PST (3 hours behind you)
- Past meetings: 85% on Tuesdays/Wednesdays
- Preferred time: Morning (9-11 AM her time)
- Average duration: 30 minutes
- Last meeting: 6 weeks ago

Optimization recommendations:
- Best days: Tuesday or Wednesday
- Best times: 9:00-11:00 AM PST (12:00-2:00 PM EST for you)
- Suggested duration: 30 minutes
- Format: Video call (her preference)

Your availability matches:
- Tuesday, Jan 21: 12:00 PM, 1:00 PM, 1:30 PM
- Wednesday, Jan 22: 12:30 PM, 1:00 PM

📧 **Meeting Request**
---
Subject: Quick Sync - 30 Min This Week?

Hi Jennifer,

I hope you're having a great week! I'd love to catch up on how things are going with the new dashboard rollout and see if there's anything I can help with.

Would any of these times work for a quick 30-minute video call?

• Tuesday, Jan 21 at 9:00 AM PT
• Tuesday, Jan 21 at 10:00 AM PT
• Wednesday, Jan 22 at 9:30 AM PT

[Book directly on my calendar →]

If none of these work, feel free to suggest alternatives!

Best,
[CSM Name]
---

[Edit Times] [Edit Message] [Send]

CSM: Send
System: Meeting request sent to Jennifer at Acme Corp!

I'll notify you when she responds.
```

## Acceptance Criteria
- [ ] Analyze past meeting acceptance patterns
- [ ] Recommend optimal days/times based on history
- [ ] Consider time zones automatically
- [ ] Generate clear, professional meeting request
- [ ] Include calendar booking link option
- [ ] Track response time and outcome
- [ ] Learn from patterns to improve future suggestions
- [ ] Follow HITL approval before sending

## Ralph Loop Notes
- **Learning**: Improve optimal time predictions based on acceptance data
- **Optimization**: Identify best meeting request subject lines
- **Personalization**: Learn individual stakeholder preferences

### Completion Signal
```
<promise>PRD-036-COMPLETE</promise>
```
