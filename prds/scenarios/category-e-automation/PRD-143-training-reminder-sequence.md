# PRD-143: Training Scheduled → Reminder Sequence

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-143 |
| **Title** | Training Scheduled → Reminder Sequence |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When customer training sessions are scheduled, attendance rates suffer due to forgotten appointments, insufficient preparation, and lack of pre-training engagement. Manual reminders are inconsistent.

## User Story
**As a** CSM
**I want** automatic reminder sequences when training is scheduled
**So that** customers attend prepared and training sessions are maximally effective

## Functional Requirements

### FR-1: Training Detection
- Detect training scheduling:
  - Calendar event with training type
  - LMS enrollment
  - Training request fulfilled
  - Manual entry
- Capture training details

### FR-2: Reminder Sequence
- Send automated reminders:
  - T-7 days: Confirmation + pre-work
  - T-3 days: Reminder + preparation tips
  - T-1 day: Final reminder + logistics
  - T-1 hour: Join link + quick tips
- Customize timing per training type

### FR-3: Pre-Training Content
- Provide preparation materials:
  - Pre-requisite content
  - Setup instructions
  - Learning objectives
  - Agenda preview
  - Questions to prepare

### FR-4: Attendee Management
- Track attendee responses:
  - Confirmations
  - Reschedule requests
  - Cancellations
  - No-shows
- Manage waitlists

### FR-5: Post-Training Follow-Up
- After training completion:
  - Thank you + resources
  - Recording/materials link
  - Feedback survey
  - Next steps guidance
  - Certification info (if applicable)

### FR-6: Attendance Analytics
- Track training effectiveness:
  - Attendance rates
  - Completion rates
  - Post-training adoption
  - Satisfaction scores

## Non-Functional Requirements

### NFR-1: Reliability
- 100% reminder delivery
- Correct timing

### NFR-2: Personalization
- Customer-specific content
- Role-appropriate materials

## Technical Specifications

### Data Model
```typescript
interface TrainingReminderSequence {
  id: string;
  customerId: string;
  training: {
    id: string;
    type: 'onboarding' | 'feature' | 'advanced' | 'certification' | 'custom';
    title: string;
    scheduledAt: Date;
    duration: number;
    attendees: TrainingAttendee[];
  };
  reminders: ReminderStatus[];
  materials: {
    prework: string[];
    prerequisites: string[];
    agenda: string;
    joinLink: string;
  };
  postTraining: {
    sent: boolean;
    recordingUrl: string | null;
    surveyId: string | null;
    nextSteps: string[];
  };
  attendance: {
    attended: string[];
    noShow: string[];
    rescheduled: string[];
  };
  createdAt: Date;
}

interface ReminderStatus {
  type: 'week' | '3day' | '1day' | '1hour';
  scheduledFor: Date;
  sent: boolean;
  sentAt: Date | null;
}
```

### API Endpoints
- `POST /api/training/schedule` - Schedule training
- `GET /api/training/:id/reminders` - Reminder status
- `PUT /api/training/:id/attendance` - Update attendance
- `POST /api/training/:id/post-complete` - Trigger post-training

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Calendar | IN | Training events |
| LMS | IN | Enrollments |
| Gmail | OUT | Reminders |
| Calendar | OUT | Confirmation requests |

## Acceptance Criteria

- [ ] Training detected and sequenced
- [ ] Reminders sent at correct times
- [ ] Pre-training materials included
- [ ] Attendance tracked
- [ ] Post-training follow-up sent
- [ ] Analytics available

## Dependencies
- PRD-038: Training Invitation Personalization
- PRD-104: Training Completion Alert
- PRD-017: Training Completion Data → Certification Tracking

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Attendance rate | > 85% | Attended / scheduled |
| Preparation rate | > 50% | Pre-work completed |
| Satisfaction | > 4/5 | Post-training survey |

## Implementation Notes
- Build reminder scheduling engine
- Create training-specific templates
- Integrate with LMS for completion
- Track training ROI metrics
