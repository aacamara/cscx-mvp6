# PRD-142: Survey Completed → Analysis + Action

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-142 |
| **Title** | Survey Completed → Analysis + Action |
| **Category** | E: Workflow Automation |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When customers complete surveys (NPS, CSAT, custom), responses are often siloed in survey tools without driving systematic action. CSMs may not see responses promptly, and follow-up is inconsistent.

## User Story
**As a** CSM
**I want** automatic analysis and action recommendations when customers complete surveys
**So that** I can respond appropriately to feedback and close the loop with customers

## Functional Requirements

### FR-1: Survey Completion Detection
- Detect survey submissions:
  - NPS surveys
  - CSAT surveys
  - Onboarding surveys
  - QBR feedback
  - Custom surveys
- Capture full response data

### FR-2: Response Analysis
- Analyze response content:
  - Sentiment classification
  - Theme extraction
  - Urgency assessment
  - Verbatim key points
  - Comparison to previous responses

### FR-3: Segmented Response Handling
- Handle by response type:
  - Promoters (9-10): Thank, reference request
  - Passives (7-8): Engagement opportunity
  - Detractors (0-6): Immediate follow-up
- Custom rules per survey type

### FR-4: CSM Notification
- Notify CSM immediately for:
  - Detractor responses
  - Urgent feedback
  - Significant score changes
  - Verbatim requiring attention
- Include context and recommendations

### FR-5: Follow-Up Generation
- Generate appropriate follow-up:
  - Thank you message (promoters)
  - Check-in request (passives)
  - Concern acknowledgment (detractors)
  - Issue resolution plan (if specific)
- Queue for CSM approval

### FR-6: Loop Closure Tracking
- Track follow-up completion:
  - Response acknowledged
  - Follow-up sent
  - Issue addressed
  - Customer re-surveyed
- Measure close rate

### FR-7: Trend Analysis
- Analyze survey trends:
  - Score trajectory
  - Theme patterns
  - Segment comparisons
  - Improvement tracking

## Non-Functional Requirements

### NFR-1: Timeliness
- Detractor notification < 1 hour
- All responses processed same day

### NFR-2: Accuracy
- Sentiment analysis > 90% accurate
- Theme extraction relevant

### NFR-3: Action Rate
- Follow-up on 100% of detractors
- Close loop on > 80%

## Technical Specifications

### Data Model
```typescript
interface SurveyResponse {
  id: string;
  customerId: string;
  stakeholderId: string | null;
  survey: {
    id: string;
    type: 'nps' | 'csat' | 'onboarding' | 'qbr' | 'custom';
    name: string;
  };
  response: {
    score: number | null;
    maxScore: number;
    verbatim: string | null;
    answers: Record<string, any>;
    submittedAt: Date;
  };
  analysis: {
    sentiment: 'positive' | 'neutral' | 'negative';
    urgency: 'high' | 'medium' | 'low';
    themes: string[];
    keyPoints: string[];
    scoreChange: number | null;
  };
  category: 'promoter' | 'passive' | 'detractor' | 'n/a';
  followUp: {
    required: boolean;
    type: string;
    draftId: string | null;
    sent: boolean;
    sentAt: Date | null;
    closedLoop: boolean;
    closedAt: Date | null;
  };
  csmNotified: boolean;
  createdAt: Date;
}
```

### API Endpoints
- `POST /api/surveys/response` - Record response
- `GET /api/surveys/customer/:customerId` - Customer surveys
- `PUT /api/surveys/:id/follow-up` - Record follow-up
- `GET /api/surveys/analysis` - Survey analysis

### Agent Involvement
| Agent | Role |
|-------|------|
| Monitor | Detect survey responses |
| Researcher | Analyze response content |
| Communicator | Generate follow-up |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Survey Tools | IN | Response data |
| AI/NLP | IN | Sentiment/theme analysis |
| Gmail | OUT | Follow-up emails |
| Slack | OUT | CSM notifications |
| Risk Signals | OUT | Detractor alerts |

## UI/UX Requirements

### Survey Response View
- Timeline of responses
- Sentiment indicators
- Trend visualization
- Follow-up status

### Detractor Alert
- Prominent notification
- One-click to response
- Quick follow-up actions
- Escalation option

## Acceptance Criteria

- [ ] Responses captured from all sources
- [ ] Analysis accurate and timely
- [ ] Segmentation correct
- [ ] CSM notified appropriately
- [ ] Follow-up generated
- [ ] Loop closure tracked

## Dependencies
- PRD-005: NPS Survey Results → Sentiment Analysis
- PRD-091: NPS Score Drop → Recovery Workflow
- PRD-024: Survey Response Upload → Statistical Analysis

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Response processing | < 1 hour | Submission to notification |
| Detractor follow-up | 100% | Detractors contacted |
| Loop closure | > 80% | Feedback acknowledged |
| NPS improvement | +5 points | Year-over-year |

## Implementation Notes
- Integrate with survey platforms (Delighted, SurveyMonkey, etc.)
- Build NLP pipeline for analysis
- Create segment-specific templates
- Implement closed-loop tracking
