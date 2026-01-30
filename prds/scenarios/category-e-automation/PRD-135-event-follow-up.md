# PRD-135: Customer Event Attended → Follow-Up

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-135 |
| **Title** | Customer Event Attended → Follow-Up |
| **Category** | E: Workflow Automation |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When customers attend company events (webinars, conferences, training), follow-up is often inconsistent or missed entirely. This wastes engagement opportunities and leaves customers feeling like just another attendee rather than a valued partner.

## User Story
**As a** CSM
**I want** automatic follow-up when my customers attend company events
**So that** I can personalize engagement based on their participation and interests

## Functional Requirements

### FR-1: Event Attendance Detection
- Detect attendance via:
  - Webinar platform (Zoom, GoToWebinar)
  - Conference registration system
  - Training LMS completion
  - Marketing event platform
  - Manual entry
- Match to CSCX customers

### FR-2: Attendance Context Capture
- Capture event details:
  - Event type and topic
  - Attendance duration
  - Engagement level (questions asked, polls answered)
  - Materials downloaded
  - Sessions attended (for conferences)

### FR-3: CSM Notification
- Notify CSM of attendance:
  - Customer name and event
  - Engagement summary
  - Relevance to customer goals
  - Recommended follow-up
- Include quick action buttons

### FR-4: Follow-Up Generation
- Generate personalized follow-up:
  - Thank you for attending
  - Key takeaways relevant to them
  - Additional resources
  - Offer to discuss application
- Queue for CSM review/approval

### FR-5: Activity Logging
- Log event participation:
  - Update customer timeline
  - Track engagement score
  - Note topics of interest
  - Identify training completion

### FR-6: Aggregate Analysis
- Analyze event impact:
  - Customer engagement trends
  - Topic interest patterns
  - Event ROI (by customer segment)
  - Training effectiveness

## Non-Functional Requirements

### NFR-1: Timeliness
- Follow-up ready within 24 hours
- CSM notification same day

### NFR-2: Personalization
- Follow-up contextually relevant
- Not generic mass email

## Technical Specifications

### Data Model
```typescript
interface EventAttendance {
  id: string;
  customerId: string;
  stakeholderId: string | null;
  event: {
    id: string;
    name: string;
    type: 'webinar' | 'conference' | 'training' | 'workshop' | 'other';
    topic: string;
    date: Date;
  };
  attendance: {
    registered: boolean;
    attended: boolean;
    duration: number;
    engagementLevel: 'high' | 'medium' | 'low';
    questionsAsked: number;
    downloadsCount: number;
    sessionsAttended: string[];
  };
  followUp: {
    generated: boolean;
    draftId: string | null;
    sent: boolean;
    sentAt: Date | null;
  };
  csmNotified: boolean;
  detectedAt: Date;
}
```

### API Endpoints
- `POST /api/events/attendance` - Record attendance
- `GET /api/events/customer/:customerId` - Customer events
- `POST /api/events/:id/follow-up` - Generate follow-up
- `GET /api/events/analysis` - Event analytics

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Webinar Platforms | IN | Attendance data |
| Marketing Tools | IN | Event registrations |
| LMS | IN | Training completion |
| Gmail | OUT | Follow-up emails |

## Acceptance Criteria

- [ ] Attendance detected from platforms
- [ ] Customer matching accurate
- [ ] CSM notified promptly
- [ ] Follow-up personalized
- [ ] Timeline updated

## Dependencies
- PRD-055: Webinar/Event Follow-Up Sequence
- PRD-018: Event Attendance Upload → Engagement Scoring
- PRD-038: Training Invitation Personalization

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Follow-up rate | > 80% | Events with follow-up |
| Response rate | > 30% | Customer replies |
| Engagement lift | +15% | Post-event engagement |

## Implementation Notes
- Integrate with webinar/event platforms
- Build customer matching from email
- Support batch processing for large events
- Consider segment-specific follow-up templates
