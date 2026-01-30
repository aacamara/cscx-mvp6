# PRD-120: QBR Scheduling → Auto-Prep

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-120 |
| **Title** | QBR Scheduling → Auto-Prep |
| **Category** | E: Workflow Automation |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
QBR preparation is time-consuming, often taking CSMs 4-8 hours per customer. When a QBR is scheduled, CSMs must manually gather metrics, create presentations, compile wins/challenges, and prepare talking points. This limits QBR frequency and quality.

## User Story
**As a** CSM
**I want** automatic QBR preparation to begin when a QBR meeting is scheduled
**So that** I can deliver high-quality QBRs with minimal manual preparation time

## Functional Requirements

### FR-1: QBR Detection
- Detect QBR scheduling via:
  - Calendar event with "QBR" in title
  - Manual QBR creation in CSCX
  - Recurring QBR series detection
  - Meeting type classification
- Trigger prep workflow immediately upon scheduling

### FR-2: Data Aggregation
- Automatically compile QBR metrics:
  - Health score trend (current quarter)
  - Usage metrics and trends
  - Feature adoption progress
  - Support ticket summary
  - NPS/CSAT scores
  - ROI/value delivered metrics
  - Engagement frequency
- Calculate quarter-over-quarter comparisons

### FR-3: Wins & Challenges Compilation
- Extract wins from:
  - Completed milestones
  - Positive meeting sentiments
  - Goal achievements
  - Expansion activities
- Identify challenges from:
  - Risk signals during quarter
  - Support escalations
  - Adoption gaps
  - Unmet objectives

### FR-4: Presentation Generation
- Create QBR presentation (Google Slides):
  - Executive summary slide
  - Partnership health overview
  - Usage and adoption metrics
  - Wins this quarter
  - Challenges and mitigations
  - Goals for next quarter
  - Strategic recommendations
  - Next steps
- Apply customer branding if available

### FR-5: Supporting Documents
- Generate supplementary materials:
  - Detailed metrics spreadsheet
  - Value summary document
  - Goal tracking sheet
  - Action item template
- Store in customer's QBR folder

### FR-6: Talking Points & Prep Brief
- Generate CSM prep document:
  - Key discussion topics
  - Anticipated questions
  - Competitive considerations
  - Expansion opportunities to explore
  - Risk factors to address
  - Stakeholder-specific notes

### FR-7: Pre-QBR Checklist
- Create preparation checklist:
  - [ ] Review presentation
  - [ ] Customize with specific examples
  - [ ] Confirm attendee list
  - [ ] Prepare for likely questions
  - [ ] Identify success stories
  - [ ] Review competitive landscape
- Track completion status

### FR-8: Reminder Sequence
- Send prep reminders:
  - T-7 days: Initial prep materials ready
  - T-3 days: Review reminder
  - T-1 day: Final prep checklist
  - T-1 hour: Meeting brief + materials link

## Non-Functional Requirements

### NFR-1: Timing
- Prep materials ready within 2 hours of scheduling
- Presentation generation < 5 minutes
- Data aggregation < 3 minutes

### NFR-2: Quality
- Metrics 100% accurate (real data, no estimates)
- Presentation professional quality
- Talking points actionable and relevant

### NFR-3: Flexibility
- Support different QBR formats (30/60/90 min)
- Customizable templates by segment
- Override individual sections

## Technical Specifications

### Data Model
```typescript
interface QBRPreparation {
  qbrId: string;
  customerId: string;
  scheduledDate: Date;
  calendarEventId: string;
  status: 'scheduled' | 'preparing' | 'ready' | 'completed';
  metrics: {
    healthScoreCurrent: number;
    healthScoreTrend: 'up' | 'down' | 'stable';
    usageMetrics: UsageMetrics;
    adoptionScore: number;
    npsScore: number | null;
    supportTickets: { total: number; escalated: number };
    engagementScore: number;
  };
  wins: QBRItem[];
  challenges: QBRItem[];
  presentation: {
    documentId: string;
    documentUrl: string;
    generatedAt: Date;
    customizedAt: Date | null;
  };
  supportingDocs: DocumentRef[];
  prepBrief: {
    documentId: string;
    talkingPoints: TalkingPoint[];
    anticipatedQuestions: string[];
    expansionOpportunities: string[];
  };
  checklist: ChecklistItem[];
  reminders: ReminderSchedule[];
  createdAt: Date;
  updatedAt: Date;
}

interface QBRItem {
  type: 'win' | 'challenge';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  source: string;
  date: Date;
}
```

### API Endpoints
- `POST /api/qbr/schedule` - Schedule QBR and trigger prep
- `GET /api/qbr/:qbrId/status` - Check prep status
- `GET /api/qbr/:qbrId/materials` - Get all prep materials
- `PUT /api/qbr/:qbrId/customize` - Update generated content
- `POST /api/qbr/:qbrId/complete` - Mark QBR complete

### Agent Involvement
| Agent | Role |
|-------|------|
| Orchestrator | Coordinate QBR prep workflow |
| Researcher | Compile metrics and insights |
| Monitor | Aggregate health and usage data |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Google Calendar | IN | QBR scheduling |
| Google Slides | OUT | Presentation creation |
| Google Sheets | OUT | Metrics spreadsheet |
| Google Docs | OUT | Prep brief, value summary |
| Usage Data | IN | Metrics aggregation |
| Risk Signals | IN | Challenges identification |

## UI/UX Requirements

### QBR Prep Dashboard
- Progress indicator for prep stages
- Preview of generated materials
- One-click to open each document
- Customization options inline

### Materials Preview
- Embedded presentation preview
- Editable wins/challenges list
- Drag-and-drop reordering
- Quick edit for talking points

### Reminder Management
- Timeline view of reminders
- Enable/disable individual reminders
- Custom reminder addition

## Acceptance Criteria

### AC-1: QBR Detection
- [ ] Calendar events with "QBR" detected
- [ ] Manual scheduling triggers prep
- [ ] Detection within 5 minutes of scheduling

### AC-2: Data Accuracy
- [ ] All metrics from real data sources
- [ ] Quarter boundaries correctly calculated
- [ ] Trends accurately computed

### AC-3: Presentation Quality
- [ ] Professional template applied
- [ ] All slides populated with data
- [ ] Charts/graphs correctly rendered
- [ ] Customer name throughout

### AC-4: Wins/Challenges
- [ ] At least 3 wins identified (if data exists)
- [ ] Challenges reflect actual issues
- [ ] Impact levels assigned appropriately

### AC-5: Prep Brief
- [ ] Talking points actionable
- [ ] Anticipated questions realistic
- [ ] Expansion opportunities relevant

### AC-6: Reminders
- [ ] All reminders scheduled correctly
- [ ] Notifications delivered on time
- [ ] Materials linked in reminders

## Dependencies
- PRD-026: One-Click QBR Email Generation
- PRD-153: Health Score Portfolio View
- PRD-213: AI Meeting Summarization
- PRD-188: Google Calendar Sync

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Incomplete data | Medium | Medium | Flag gaps, suggest manual input |
| Presentation errors | Low | High | CSM review required |
| Calendar detection misses | Low | Medium | Manual trigger option |

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Prep time reduction | > 75% | CSM time tracking |
| Materials used as-is | > 60% | Unchanged vs modified |
| QBR frequency increase | > 25% | QBRs per customer per year |
| CSM satisfaction | > 4.5/5 | Post-QBR survey |

## Implementation Notes
- Use `QBR_PRESENTATION` template from Google Slides
- Leverage `qbrs` table for tracking
- Consider caching aggregated metrics
- Support template customization per segment
