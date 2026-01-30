# PRD-233: Smart Meeting Prep

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-233 |
| **Title** | Smart Meeting Prep |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs spend significant time preparing for customer meetings - reviewing account history, gathering metrics, checking recent interactions, and creating agendas. This manual preparation is time-consuming and inconsistent. AI should automatically generate comprehensive meeting prep materials tailored to each customer and meeting type.

## User Stories

### Primary User Stories
1. **As a CSM**, I want auto-generated meeting prep briefs before each customer meeting.
2. **As a CSM**, I want key talking points based on current account status.
3. **As a CSM**, I want to see outstanding action items from previous meetings.
4. **As a CSM**, I want risk signals and opportunities highlighted.
5. **As a CSM**, I want suggested agenda items based on meeting context.

### Secondary User Stories
1. **As a CSM**, I want prep delivered to my inbox before the meeting.
2. **As a CSM**, I want to customize prep preferences by meeting type.
3. **As a CSM Manager**, I want to ensure team is prepared for important meetings.

## Acceptance Criteria

### Core Functionality
- [ ] Automatic prep generation triggered by calendar events
- [ ] Meeting type detection (QBR, check-in, renewal, escalation)
- [ ] Comprehensive account summary
- [ ] Recent interaction history
- [ ] Key metrics and health status
- [ ] Suggested talking points and agenda

### Meeting Prep Components
- [ ] Account health snapshot
- [ ] Key metrics (usage, engagement, NPS)
- [ ] Recent interactions summary (emails, meetings)
- [ ] Outstanding action items
- [ ] Risk signals and concerns
- [ ] Expansion opportunities
- [ ] Stakeholder notes (who's attending, their role)
- [ ] Suggested questions to ask
- [ ] Competitive context (if relevant)

### Delivery Options
- [ ] In-app prep view
- [ ] Email digest before meeting
- [ ] Integration with calendar event
- [ ] Exportable to document

## Technical Specification

### Architecture

```
Calendar Event → Meeting Detector → Context Gatherer → Prep Generator → Delivery
       ↓                                    ↓                ↓
 Customer Match                       All Data Sources   Email/App/Doc
```

### Meeting Prep Model

```typescript
interface MeetingPrep {
  meeting_id: string;
  customer_id: string;
  meeting_type: MeetingType;
  scheduled_at: Date;
  attendees: Attendee[];
  sections: PrepSection[];
  suggested_agenda: AgendaItem[];
  talking_points: TalkingPoint[];
  questions_to_ask: string[];
  documents_to_review: Document[];
  generated_at: Date;
}

type MeetingType = 'check_in' | 'qbr' | 'renewal' | 'escalation' | 'onboarding' | 'training' | 'executive';

interface PrepSection {
  title: string;
  content: string | object;
  priority: 'high' | 'medium' | 'low';
  data_freshness: Date;
}

interface TalkingPoint {
  topic: string;
  context: string;
  suggested_phrasing: string;
  priority: 'must_discuss' | 'should_discuss' | 'nice_to_have';
}
```

### Prep Generation Pipeline

```typescript
async function generateMeetingPrep(
  calendarEvent: CalendarEvent
): Promise<MeetingPrep> {
  // Match to customer
  const customer = await matchEventToCustomer(calendarEvent);
  if (!customer) return null;

  // Detect meeting type
  const meetingType = detectMeetingType(calendarEvent, customer);

  // Gather all context
  const context = await gatherPrepContext(customer.id, meetingType);

  // Generate prep sections
  const sections = await generateSections(context, meetingType);

  // Generate talking points
  const talkingPoints = await generateTalkingPoints(context, meetingType);

  // Generate suggested agenda
  const agenda = await generateAgenda(context, meetingType);

  // Generate questions
  const questions = await generateQuestions(context, meetingType);

  return {
    meeting_id: calendarEvent.id,
    customer_id: customer.id,
    meeting_type: meetingType,
    scheduled_at: calendarEvent.start,
    attendees: await enrichAttendees(calendarEvent.attendees, customer.id),
    sections,
    suggested_agenda: agenda,
    talking_points: talkingPoints,
    questions_to_ask: questions,
    documents_to_review: await getRelevantDocuments(customer.id, meetingType),
    generated_at: new Date()
  };
}

async function generateTalkingPoints(
  context: PrepContext,
  meetingType: MeetingType
): Promise<TalkingPoint[]> {
  const prompt = `
    Generate talking points for a ${meetingType} meeting.

    Customer: ${context.customer.name}
    Health Score: ${context.customer.health_score} (${context.healthTrend})
    ARR: ${context.customer.arr}
    Renewal: ${context.daysToRenewal} days away

    Recent context:
    - Last meeting: ${context.lastMeeting?.summary}
    - Open action items: ${context.openActions.map(a => a.title).join(', ')}
    - Risk signals: ${context.riskSignals.map(r => r.description).join(', ')}
    - Recent wins: ${context.recentWins.join(', ')}

    Generate 5-7 talking points prioritized as:
    - must_discuss: Critical items that must be covered
    - should_discuss: Important but not critical
    - nice_to_have: Optional if time permits

    Include suggested phrasing for sensitive topics.
  `;

  return await claude.generate(prompt);
}
```

### API Endpoints

#### GET /api/meetings/{id}/prep
```json
{
  "meeting_id": "calendar-event-id",
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "meeting_type": "check_in",
  "scheduled_at": "2026-01-30T14:00:00Z",
  "attendees": [
    {
      "name": "Sarah Chen",
      "email": "sarah@techcorp.com",
      "role": "VP Product",
      "relationship_score": 78,
      "notes": "Primary champion, prefers data-driven discussions"
    },
    {
      "name": "Mike Roberts",
      "email": "mike@techcorp.com",
      "role": "Engineering Lead",
      "relationship_score": 62,
      "notes": "New stakeholder, met once at kickoff"
    }
  ],
  "sections": [
    {
      "title": "Health Snapshot",
      "content": {
        "score": 68,
        "trend": "declining",
        "change_30d": -8,
        "key_factors": ["Usage down 15%", "Sentiment stable"]
      },
      "priority": "high"
    },
    {
      "title": "Recent Interactions",
      "content": [
        {
          "type": "email",
          "date": "2026-01-25",
          "summary": "Sarah asked about reporting features"
        },
        {
          "type": "meeting",
          "date": "2026-01-15",
          "summary": "QBR - positive overall, concerns about pricing"
        }
      ],
      "priority": "medium"
    },
    {
      "title": "Outstanding Actions",
      "content": [
        {
          "item": "Send pricing comparison",
          "owner": "CSM",
          "due": "2026-01-28",
          "status": "overdue"
        }
      ],
      "priority": "high"
    },
    {
      "title": "Risk Signals",
      "content": [
        {
          "signal": "Usage declining",
          "severity": "medium",
          "detail": "DAU down 15% from last month"
        }
      ],
      "priority": "high"
    }
  ],
  "talking_points": [
    {
      "topic": "Usage decline",
      "context": "DAU dropped 15% - need to understand why",
      "suggested_phrasing": "I noticed usage has dipped a bit recently. Is there anything we can help with to drive more adoption?",
      "priority": "must_discuss"
    },
    {
      "topic": "Pricing comparison (overdue)",
      "context": "Promised pricing comparison, not yet sent",
      "suggested_phrasing": "I apologize for the delay on the pricing comparison. I have it ready to share today.",
      "priority": "must_discuss"
    },
    {
      "topic": "New reporting features",
      "context": "Sarah asked about reporting in recent email",
      "suggested_phrasing": "I saw your question about reporting - let me show you some new capabilities we've added.",
      "priority": "should_discuss"
    }
  ],
  "suggested_agenda": [
    { "item": "Quick wins since last meeting", "time_minutes": 5 },
    { "item": "Usage review and adoption support", "time_minutes": 15 },
    { "item": "Pricing discussion", "time_minutes": 10 },
    { "item": "Reporting feature demo", "time_minutes": 10 },
    { "item": "Action items and next steps", "time_minutes": 5 }
  ],
  "questions_to_ask": [
    "What's driving the change in usage patterns?",
    "Are there any team members who need additional training?",
    "How are the current integrations working for you?",
    "Any upcoming projects where we could provide more support?"
  ],
  "documents_to_review": [
    { "name": "Q4 QBR Slides", "url": "...", "relevance": "Last formal review" },
    { "name": "Pricing Comparison", "url": "...", "relevance": "For today's discussion" }
  ],
  "generated_at": "2026-01-30T08:00:00Z"
}
```

#### POST /api/meetings/prep/preferences
Set meeting prep preferences.

### Database Schema

```sql
CREATE TABLE meeting_preps (
  id UUID PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  meeting_type VARCHAR(50),
  scheduled_at TIMESTAMPTZ,
  prep_data JSONB NOT NULL,
  delivered_via TEXT[],  -- ['email', 'app']
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meeting_prep_preferences (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  meeting_type VARCHAR(50),
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, meeting_type)
);
```

## UI/UX Design

### Meeting Prep View
```
┌─────────────────────────────────────────────────────────┐
│ MEETING PREP - TechCorp Industries                      │
│ Check-in | Today 2:00 PM | 45 minutes                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ATTENDEES                                               │
│ ─────────                                               │
│ 👤 Sarah Chen (VP Product) - Champion, Score: 78       │
│    Prefers data-driven discussions                      │
│ 👤 Mike Roberts (Eng Lead) - New stakeholder           │
│                                                         │
│ HEALTH SNAPSHOT                            📊 68 ↘️ -8  │
│ ───────────────                                         │
│ Usage: ↓15% | Engagement: Stable | Sentiment: OK        │
│                                                         │
│ ⚠️ MUST DISCUSS                                         │
│ ─────────────                                           │
│ 1. Usage decline - DAU down 15%                         │
│    💬 "I noticed usage has dipped a bit recently..."    │
│                                                         │
│ 2. Pricing comparison (OVERDUE)                         │
│    💬 "I apologize for the delay..."                    │
│                                                         │
│ 📋 SUGGESTED AGENDA                       Total: 45 min │
│ ──────────────────                                      │
│ • Quick wins (5 min)                                    │
│ • Usage review (15 min)                                 │
│ • Pricing discussion (10 min)                           │
│ • Reporting demo (10 min)                               │
│ • Next steps (5 min)                                    │
│                                                         │
│ ❓ QUESTIONS TO ASK                                      │
│ ─────────────────                                       │
│ • What's driving the change in usage patterns?          │
│ • Any team members who need training?                   │
│                                                         │
│ [Copy to Calendar] [Export PDF] [Start Meeting Notes]   │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Calendar integration (Google Calendar)
- Customer matching from attendees
- Health score and metrics
- Meeting history and summaries

### Related PRDs
- PRD-127: Meeting Booked → Pre-Meeting Research
- PRD-213: AI Meeting Summarization
- PRD-120: QBR Scheduling → Auto-Prep

## Success Metrics

### Quantitative
- Meeting prep time reduced by 70%
- Prep usage rate > 80% of meetings
- Talking points mentioned in 90% of meetings
- Outstanding actions addressed rate improves by 50%

### Qualitative
- CSMs feel prepared for meetings
- Talking points are relevant and useful
- No major blind spots in prep

## Rollout Plan

### Phase 1: Basic Prep (Week 1-2)
- Account summary section
- Manual generation trigger
- Basic delivery (in-app)

### Phase 2: Talking Points (Week 3-4)
- AI-generated talking points
- Suggested agenda
- Questions to ask

### Phase 3: Automation (Week 5-6)
- Calendar trigger integration
- Email delivery
- Meeting type detection

### Phase 4: Intelligence (Week 7-8)
- Stakeholder insights
- Competitive context
- Document recommendations

## Open Questions
1. How far in advance should prep be generated?
2. Should prep be regenerated if context changes?
3. How do we handle recurring meetings?
4. Should attendees be able to see the prep?
