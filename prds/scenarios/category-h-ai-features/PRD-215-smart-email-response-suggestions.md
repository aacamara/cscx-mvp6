# PRD-215: Smart Email Response Suggestions

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-215 |
| **Title** | Smart Email Response Suggestions |
| **Category** | H: AI-Powered Features |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs receive dozens of customer emails daily, each requiring thoughtful, personalized responses. Writing quality responses is time-consuming, and response time directly impacts customer satisfaction. AI should analyze incoming emails, understand context from account history, and suggest appropriate responses that the CSM can quickly review, edit, and send.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see suggested responses when viewing customer emails.
2. **As a CSM**, I want suggestions to incorporate account context (health, recent meetings, open issues).
3. **As a CSM**, I want multiple response options (formal, friendly, brief, detailed).
4. **As a CSM**, I want to edit suggestions before sending rather than writing from scratch.
5. **As a CSM**, I want one-click send for straightforward responses.

### Secondary User Stories
1. **As a CSM**, I want to teach the system my writing style over time.
2. **As a CSM**, I want suggestions for follow-up timing if I choose to delay response.
3. **As a CSM**, I want to flag suggested responses as good/bad to improve future suggestions.

## Acceptance Criteria

### Core Functionality
- [ ] Automatic suggestion generation for incoming customer emails
- [ ] Suggestions include appropriate greeting, body, and closing
- [ ] Context awareness: references recent meetings, open tasks, account status
- [ ] Multiple response variations offered (at least 2-3 options)
- [ ] One-click acceptance with edit capability
- [ ] Integration with Gmail draft creation

### Context Integration
- [ ] Include customer name and stakeholder information
- [ ] Reference recent interactions (meetings, previous emails)
- [ ] Acknowledge open support tickets or issues
- [ ] Factor in account health and sentiment
- [ ] Note upcoming events (renewal, QBR)

### Response Types
- [ ] Acknowledgment responses (got it, working on it)
- [ ] Information requests (clarification, more details)
- [ ] Scheduling responses (meeting requests)
- [ ] Issue resolution responses
- [ ] Escalation responses
- [ ] Renewal/commercial discussions

## Technical Specification

### Architecture
```
Incoming Email → Email Parser → Context Gatherer → Claude Analysis → Response Generator → Draft Creator
```

### Components

#### 1. Email Parser
Extract from incoming email:
- Sender information (map to stakeholder)
- Subject and intent classification
- Key questions or requests
- Sentiment/urgency level
- Thread context (previous messages)

#### 2. Context Gatherer
Pull from database:
```typescript
interface EmailContext {
  customer: Customer;
  stakeholder: Stakeholder;
  recentMeetings: MeetingSummary[];
  openTasks: Task[];
  riskSignals: RiskSignal[];
  lastInteraction: Date;
  healthScore: number;
  upcomingRenewal: Date | null;
  openSupportTickets: SupportTicket[];
  previousEmailThread: EmailMessage[];
}
```

#### 3. Response Generator

**Prompt Template:**
```
Generate 3 email response suggestions for this customer email.

INCOMING EMAIL:
From: {sender_name} ({sender_role}) at {company_name}
Subject: {subject}
Body: {email_body}

ACCOUNT CONTEXT:
- Customer: {customer_name}
- Health Score: {health_score}
- ARR: {arr}
- Recent Meetings: {recent_meetings_summary}
- Open Issues: {open_issues}
- Renewal Date: {renewal_date}
- Last Contact: {last_contact_date}

RESPONSE REQUIREMENTS:
1. Professional and helpful tone
2. Address all questions/requests in the email
3. Reference relevant context naturally
4. Include clear next steps if applicable
5. Keep response concise but complete

Generate 3 variations:
1. Formal/Professional
2. Warm/Friendly
3. Brief/Efficient

For each, provide:
- Subject line (if reply)
- Greeting
- Body
- Closing
- Suggested follow-up timing
```

### API Endpoints

#### POST /api/email/suggest-response
```json
{
  "email_id": "gmail-thread-id",
  "customer_id": "uuid",
  "stakeholder_id": "uuid"
}
```

Response:
```json
{
  "suggestions": [
    {
      "id": "sugg-1",
      "style": "formal",
      "subject": "Re: Question about Q1 reporting",
      "body": "Hi Sarah,\n\nThank you for reaching out...",
      "closing": "Best regards",
      "confidence": 0.92,
      "context_used": [
        "Referenced QBR meeting from Jan 15",
        "Noted open support ticket #1234"
      ],
      "suggested_send_time": null
    },
    {
      "id": "sugg-2",
      "style": "friendly",
      "subject": "Re: Question about Q1 reporting",
      "body": "Hey Sarah!\n\nGreat question...",
      "closing": "Thanks!",
      "confidence": 0.88,
      "context_used": [...],
      "suggested_send_time": null
    },
    {
      "id": "sugg-3",
      "style": "brief",
      "subject": "Re: Question about Q1 reporting",
      "body": "Hi Sarah,\n\nYes, the Q1 reports will be available...",
      "closing": "Best",
      "confidence": 0.85,
      "context_used": [...],
      "suggested_send_time": null
    }
  ],
  "detected_intent": "information_request",
  "urgency": "normal",
  "recommended_action": "respond_today"
}
```

#### POST /api/email/send-suggestion
```json
{
  "suggestion_id": "sugg-1",
  "edits": {
    "body": "Hi Sarah,\n\nThank you for reaching out. [edited content]..."
  },
  "send_now": true
}
```

#### POST /api/email/feedback
```json
{
  "suggestion_id": "sugg-1",
  "feedback": "used" | "edited" | "rejected",
  "rating": 5,
  "notes": "Good but needed to add technical details"
}
```

### Learning System

Store feedback for model improvement:
```sql
CREATE TABLE email_suggestion_feedback (
  id UUID PRIMARY KEY,
  suggestion_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email_context JSONB,
  suggestion_text TEXT,
  final_text TEXT,
  feedback VARCHAR(20),
  rating INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Future: Use feedback to fine-tune suggestions for individual CSMs.

## UI/UX Design

### Email View with Suggestions
```
┌─────────────────────────────────────────────────────────┐
│ From: Sarah Chen (VP Product) - TechCorp Industries     │
│ Subject: Question about Q1 reporting                    │
│ Received: 2 hours ago                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Hi,                                                     │
│                                                         │
│ Following up on our QBR last week - when will the Q1    │
│ reports be available? We need them for our board        │
│ meeting next Tuesday.                                   │
│                                                         │
│ Also, is there any update on the data export feature    │
│ request we submitted?                                   │
│                                                         │
│ Thanks,                                                 │
│ Sarah                                                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 🤖 SUGGESTED RESPONSES                                  │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐│
│ │ Professional Response                    [Use This] ││
│ │ ─────────────────────────────────────────────────── ││
│ │ Hi Sarah,                                           ││
│ │                                                     ││
│ │ Thank you for following up after our productive QBR ││
│ │ last week. The Q1 reports will be ready by Friday,  ││
│ │ which should give you time before Tuesday's board   ││
│ │ meeting.                                            ││
│ │                                                     ││
│ │ Regarding the data export feature request (#4521),  ││
│ │ our product team has it scheduled for the Q2        ││
│ │ release. I'll connect you with our PM for more      ││
│ │ details if helpful.                                 ││
│ │                                                     ││
│ │ Best regards                                        ││
│ │ ────                                                ││
│ │ Context: QBR Jan 15, Support ticket #4521          ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Friendly Response                        [Use This] ││
│ │ ─────────────────────────────────────────────────── ││
│ │ Hey Sarah!                                          ││
│ │                                                     ││
│ │ Great to hear from you! Reports will be ready...    ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Brief Response                           [Use This] ││
│ │ ─────────────────────────────────────────────────── ││
│ │ Hi Sarah - Reports ready Friday. Export feature...  ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ [Write Custom Response] [Schedule Response]             │
└─────────────────────────────────────────────────────────┘
```

### Edit and Send Flow
```
┌─────────────────────────────────────────────────────────┐
│ Edit Response                                           │
├─────────────────────────────────────────────────────────┤
│ To: sarah.chen@techcorp.com                             │
│ Subject: Re: Question about Q1 reporting                │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐│
│ │ Hi Sarah,                                           ││
│ │                                                     ││
│ │ Thank you for following up after our productive QBR ││
│ │ last week. The Q1 reports will be ready by Friday,  ││
│ │ which should give you time before Tuesday's board   ││
│ │ meeting.                                            ││
│ │                                                     ││
│ │ [Cursor here - editable]                            ││
│ │                                                     ││
│ │ Best regards                                        ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ [Send Now] [Schedule Send ▼] [Save Draft] [Cancel]      │
│                                                         │
│ ✓ Log activity to customer timeline                     │
│ ✓ Create follow-up task if needed                       │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Gmail API integration (existing)
- Claude API for response generation
- Stakeholder mapping to email addresses
- Customer context gathering service

### Related PRDs
- PRD-190: Gmail Integration
- PRD-034: Check-In Email After Silence
- PRD-026: One-Click QBR Email Generation
- PRD-223: Conversation Context Retention

## Success Metrics

### Quantitative
- Response time reduced by 50% (from 15 min to 7 min average)
- 60% of suggestions used with minor edits
- Customer response rate maintained or improved
- CSM handles 30% more email volume

### Qualitative
- Suggestions feel natural, not robotic
- Context integration improves email quality
- CSMs feel less email fatigue

## Rollout Plan

### Phase 1: Basic Suggestions (Week 1-2)
- Single response suggestion
- Basic context (customer name, recent meeting)
- Manual trigger (click to suggest)

### Phase 2: Multiple Options (Week 3-4)
- 3 style variations
- Enhanced context integration
- Automatic suggestion on email open

### Phase 3: Learning (Week 5-6)
- Feedback collection
- Style adaptation per CSM
- Improved accuracy metrics

### Phase 4: Advanced (Week 7-8)
- Scheduled sending recommendations
- Thread summarization
- Follow-up task creation

## Open Questions
1. Should suggestions be generated proactively or on-demand?
2. How do we handle confidential/sensitive email content?
3. What's the latency target for suggestion generation?
4. Should we support multiple languages?
