# PRD-256: Team Meeting Prep

## Metadata
- **PRD ID**: PRD-256
- **Title**: Team Meeting Prep
- **Category**: I - Collaboration
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-151 (Weekly Summary), Customer data aggregation

---

## Problem Statement

CS team meetings (1:1s, team syncs, pipeline reviews) require manual preparation - gathering metrics, identifying discussion topics, and creating agendas. This prep work is time-consuming and inconsistent. Meeting participants often come unprepared, leading to inefficient discussions.

## User Story

> As a CS manager, I want automated meeting prep materials generated before team meetings so that discussions are focused, data-driven, and valuable for all participants.

---

## Functional Requirements

### FR-1: Meeting Type Support
- **FR-1.1**: 1:1 meetings (manager + CSM)
- **FR-1.2**: Team sync meetings
- **FR-1.3**: Pipeline review meetings
- **FR-1.4**: QBR planning sessions
- **FR-1.5**: Custom meeting types

### FR-2: Auto-Generated Content
- **FR-2.1**: Portfolio summary for participant(s)
- **FR-2.2**: Key metrics changes since last meeting
- **FR-2.3**: Accounts needing discussion (risks, renewals, escalations)
- **FR-2.4**: Open action items from previous meeting
- **FR-2.5**: Wins and accomplishments to celebrate

### FR-3: Agenda Building
- **FR-3.1**: Template-based agenda generation
- **FR-3.2**: Drag-and-drop topic reordering
- **FR-3.3**: Time allocation per topic
- **FR-3.4**: Pre-meeting topic submission (by attendees)
- **FR-3.5**: Link discussion topics to accounts

### FR-4: Meeting Workflow
- **FR-4.1**: Schedule prep generation (1 day before)
- **FR-4.2**: Send prep materials to attendees
- **FR-4.3**: During-meeting note capture
- **FR-4.4**: Action item creation from meeting
- **FR-4.5**: Post-meeting summary distribution

### FR-5: Historical Tracking
- **FR-5.1**: Meeting history log
- **FR-5.2**: Action item completion tracking
- **FR-5.3**: Discussion topic patterns
- **FR-5.4**: Meeting effectiveness ratings
- **FR-5.5**: Skip meeting recommendations

---

## Non-Functional Requirements

### NFR-1: Timeliness
- Prep materials generated 24 hours before meeting

### NFR-2: Accuracy
- Metrics reflect latest data (< 4 hour lag)

### NFR-3: Customization
- Templates adaptable per manager/team preferences

---

## Technical Approach

### Data Model Extensions

```sql
-- meeting_prep_templates table
CREATE TABLE meeting_prep_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  meeting_type VARCHAR(50), -- '1on1', 'team_sync', 'pipeline_review', 'qbr_planning'
  created_by_user_id UUID REFERENCES users(id),

  -- Sections to include
  sections JSONB NOT NULL,
  -- Example: [{
  --   name: 'Portfolio Overview',
  --   type: 'metrics_summary',
  --   config: {metrics: ['health_score_avg', 'arr_total', 'at_risk_count']}
  -- }]

  -- Agenda template
  default_agenda JSONB,
  -- Example: [{topic: 'Review action items', duration_minutes: 5}, ...]

  -- Generation timing
  generate_hours_before INTEGER DEFAULT 24,
  send_to_attendees BOOLEAN DEFAULT true,

  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- scheduled_meeting_preps table
CREATE TABLE scheduled_meeting_preps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES meeting_prep_templates(id),
  organizer_user_id UUID REFERENCES users(id),

  -- Meeting details
  meeting_title VARCHAR(500),
  meeting_date TIMESTAMPTZ NOT NULL,
  calendar_event_id VARCHAR(200),
  attendees UUID[] NOT NULL, -- User IDs

  -- Generated content
  prep_document JSONB,
  generated_at TIMESTAMPTZ,

  -- Agenda
  agenda JSONB DEFAULT '[]',
  agenda_finalized BOOLEAN DEFAULT false,

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'generated', 'sent', 'completed'
  sent_at TIMESTAMPTZ,

  -- Meeting notes
  meeting_notes TEXT,
  action_items JSONB DEFAULT '[]',
  -- [{description: string, owner_user_id: uuid, due_date: date, status: string, customer_id?: uuid}]

  -- Post-meeting
  effectiveness_rating INTEGER, -- 1-5
  skip_recommended BOOLEAN DEFAULT false,
  skip_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- meeting_topic_submissions
CREATE TABLE meeting_topic_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_prep_id UUID REFERENCES scheduled_meeting_preps(id) ON DELETE CASCADE,
  submitted_by_user_id UUID REFERENCES users(id),
  topic VARCHAR(500) NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES customers(id),
  priority VARCHAR(20) DEFAULT 'normal',
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meeting_preps_date ON scheduled_meeting_preps(meeting_date);
CREATE INDEX idx_meeting_preps_organizer ON scheduled_meeting_preps(organizer_user_id);
```

### Prep Document Generation

```typescript
interface MeetingPrepDocument {
  meeting_title: string;
  meeting_date: Date;
  attendees: { user_id: string; name: string; role: string }[];
  sections: PrepSection[];
  suggested_agenda: AgendaItem[];
  previous_action_items: ActionItem[];
}

interface PrepSection {
  name: string;
  type: string;
  data: any;
}

async function generateMeetingPrep(meetingPrep: ScheduledMeetingPrep): Promise<MeetingPrepDocument> {
  const template = await getTemplate(meetingPrep.template_id);
  const attendees = await getUsers(meetingPrep.attendees);

  const sections: PrepSection[] = [];

  for (const sectionConfig of template.sections) {
    switch (sectionConfig.type) {
      case 'metrics_summary':
        sections.push({
          name: sectionConfig.name,
          type: 'metrics_summary',
          data: await generateMetricsSummary(attendees, sectionConfig.config)
        });
        break;

      case 'accounts_needing_attention':
        sections.push({
          name: sectionConfig.name,
          type: 'accounts_needing_attention',
          data: await getAccountsNeedingAttention(attendees)
        });
        break;

      case 'recent_wins':
        sections.push({
          name: sectionConfig.name,
          type: 'recent_wins',
          data: await getRecentWins(attendees, 7) // Last 7 days
        });
        break;

      case 'upcoming_renewals':
        sections.push({
          name: sectionConfig.name,
          type: 'upcoming_renewals',
          data: await getUpcomingRenewals(attendees, 30) // Next 30 days
        });
        break;

      case 'open_escalations':
        sections.push({
          name: sectionConfig.name,
          type: 'open_escalations',
          data: await getOpenEscalations(attendees)
        });
        break;
    }
  }

  // Get previous action items
  const lastMeeting = await getLastMeetingWithSameAttendees(meetingPrep.attendees);
  const previousActionItems = lastMeeting ? lastMeeting.action_items : [];

  // Get topic submissions
  const topicSubmissions = await getTopicSubmissions(meetingPrep.id);

  return {
    meeting_title: meetingPrep.meeting_title,
    meeting_date: meetingPrep.meeting_date,
    attendees: attendees.map(formatAttendee),
    sections,
    suggested_agenda: buildAgenda(template.default_agenda, topicSubmissions),
    previous_action_items: previousActionItems
  };
}
```

### API Endpoints

```typescript
// Templates
GET    /api/meeting-prep/templates
POST   /api/meeting-prep/templates
PATCH  /api/meeting-prep/templates/:id

// Scheduled preps
POST   /api/meeting-preps
GET    /api/meeting-preps
GET    /api/meeting-preps/:id
PATCH  /api/meeting-preps/:id

// Generation
POST   /api/meeting-preps/:id/generate
POST   /api/meeting-preps/:id/send

// Agenda
PATCH  /api/meeting-preps/:id/agenda
POST   /api/meeting-preps/:id/topics
GET    /api/meeting-preps/:id/topics

// During/Post meeting
PATCH  /api/meeting-preps/:id/notes
POST   /api/meeting-preps/:id/action-items
POST   /api/meeting-preps/:id/complete

// Calendar integration
POST   /api/meeting-preps/from-calendar-event
GET    /api/meeting-preps/upcoming
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Prep adoption rate | 80% of team meetings | Usage tracking |
| Prep generation time | < 30 seconds | Performance |
| Meeting efficiency rating | 4/5+ | Post-meeting rating |
| Action item completion | 85%+ | Status tracking |

---

## Acceptance Criteria

- [ ] Admin can create meeting prep templates
- [ ] System generates prep docs before scheduled meetings
- [ ] Prep includes portfolio metrics for attendees
- [ ] Prep highlights accounts needing attention
- [ ] Attendees can submit topics before meeting
- [ ] Agenda can be edited and reordered
- [ ] Notes can be captured during meeting
- [ ] Action items created and assigned
- [ ] Previous action items shown with status
- [ ] Post-meeting summary distributed

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Template system | 2 days |
| Prep generation engine | 3 days |
| API endpoints | 2 days |
| Meeting prep UI | 3 days |
| Agenda builder | 2 days |
| Calendar integration | 1 day |
| Testing | 2 days |
| **Total** | **17 days** |

---

## Notes

- Consider Google Calendar event integration
- Add AI-generated talking points
- Future: Automatic note transcription from meeting recording
- Future: Meeting effectiveness analytics
- Future: Skip meeting suggestions based on metrics
