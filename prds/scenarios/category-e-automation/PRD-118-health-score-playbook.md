# PRD-118: Health Score Change → Playbook Selection

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-118 |
| **Title** | Health Score Change → Playbook Selection |
| **Category** | E: Workflow Automation |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
When a customer's health score changes significantly, CSMs must manually assess the situation, determine the appropriate response, and select the right playbook. This reactive approach delays intervention, and inconsistent playbook selection leads to suboptimal outcomes.

## User Story
**As a** CSM
**I want** automatic playbook recommendations when health scores change
**So that** I can immediately take the right action based on proven strategies and never miss a critical health change

## Functional Requirements

### FR-1: Health Score Monitoring
- Continuously monitor health score changes for all customers
- Detect significant changes:
  - Drop > 10 points in 7 days (critical)
  - Drop > 5 points in 7 days (warning)
  - Increase > 15 points in 30 days (positive)
  - Score crosses threshold boundaries (e.g., 70→65)
- Log all changes in `health_score_history` table

### FR-2: Change Analysis
- Analyze contributing factors when change detected:
  - Usage component change
  - Engagement component change
  - Sentiment component change
  - Recent risk signals
  - Recent support tickets
- Identify root cause indicators

### FR-3: Playbook Matching
- Match situation to appropriate playbook based on:
  - Health score trend (declining, stable, improving)
  - Current score zone (green > 70, yellow 50-70, red < 50)
  - Primary driver of change
  - Customer segment and ARR
  - Recent interaction history
- Support multiple playbook types:
  - Save plays (for declining scores)
  - Engagement plays (for stable but low engagement)
  - Expansion plays (for healthy, improving scores)
  - Intervention plays (for critical situations)

### FR-4: Playbook Recommendation
- Present recommended playbook with:
  - Playbook name and description
  - Why this playbook matches the situation
  - Expected outcomes
  - Time commitment estimate
  - First 3 actions to take
- Allow CSM to accept, modify, or reject recommendation

### FR-5: Automatic Playbook Initiation
- If CSM accepts recommendation:
  - Create playbook execution record
  - Generate first-step tasks
  - Schedule any required meetings
  - Draft any initial communications
  - Set milestone dates
- Track playbook progress against health score

### FR-6: Notification & Escalation
- Notify CSM of health score change via:
  - Real-time in-app alert
  - Slack notification with context
  - Email for critical drops
- Escalate to CS Manager if:
  - Health drops below critical threshold (< 40)
  - Multiple drops in succession
  - High-ARR customer affected

## Non-Functional Requirements

### NFR-1: Timeliness
- Detect health score changes within 1 hour of calculation
- Playbook recommendation within 30 seconds
- Notification delivery within 2 minutes

### NFR-2: Accuracy
- Playbook match accuracy > 85%
- Root cause identification accuracy > 80%
- False positive rate < 10%

### NFR-3: Scalability
- Support monitoring 10,000+ customers
- Handle 1,000+ health score changes per hour

## Technical Specifications

### Data Model
```typescript
interface HealthScoreChangeEvent {
  customerId: string;
  previousScore: number;
  currentScore: number;
  changeAmount: number;
  changePeriodDays: number;
  changeType: 'critical_drop' | 'warning_drop' | 'improvement' | 'threshold_crossed';
  components: {
    usage: { previous: number; current: number; change: number };
    engagement: { previous: number; current: number; change: number };
    sentiment: { previous: number; current: number; change: number };
  };
  contributingFactors: ContributingFactor[];
  detectedAt: Date;
}

interface PlaybookRecommendation {
  changeEventId: string;
  customerId: string;
  recommendedPlaybook: {
    id: string;
    name: string;
    type: 'save' | 'engagement' | 'expansion' | 'intervention';
    description: string;
    matchScore: number;
    matchReason: string;
  };
  alternativePlaybooks: PlaybookOption[];
  firstActions: ActionItem[];
  expectedOutcome: string;
  timeCommitment: string;
  status: 'pending' | 'accepted' | 'modified' | 'rejected';
  csmResponse: string | null;
  respondedAt: Date | null;
}
```

### API Endpoints
- `GET /api/health-score/changes` - List recent changes
- `GET /api/health-score/:customerId/analysis` - Get change analysis
- `POST /api/playbooks/recommend` - Get playbook recommendation
- `POST /api/playbooks/:customerId/start` - Start playbook execution
- `PUT /api/playbooks/:executionId/progress` - Update playbook progress

### Agent Involvement
| Agent | Role |
|-------|------|
| Monitor | Detect health score changes |
| Orchestrator | Coordinate analysis and recommendation |
| Researcher | Analyze contributing factors |

### Integration Points
| System | Direction | Data |
|--------|-----------|------|
| Health Score Calculator | IN | Score changes |
| Playbook Library | IN | Available playbooks |
| Usage Data | IN | Usage trends |
| Risk Signals | IN | Recent signals |
| Slack | OUT | Notifications |
| Tasks | OUT | First actions |

## UI/UX Requirements

### Health Alert Banner
- Prominent alert when health score changes
- Color-coded by severity (red, yellow, green)
- Quick view of key contributing factors
- One-click to view recommendation

### Playbook Recommendation Card
- Clear playbook title and match reason
- Confidence indicator
- First 3 actions preview
- Accept/Modify/Reject buttons
- Link to full playbook details

### Health Trend View
- Timeline visualization of health score
- Overlay significant events
- Show playbook intervention points
- Compare to cohort average

## Acceptance Criteria

### AC-1: Change Detection
- [ ] Critical drops detected within 1 hour
- [ ] All threshold crossings logged
- [ ] False positive rate < 10%

### AC-2: Analysis Quality
- [ ] Contributing factors accurately identified
- [ ] Root cause assessment helpful
- [ ] Historical context included

### AC-3: Playbook Matching
- [ ] Recommendations match situation > 85%
- [ ] Alternative options provided
- [ ] Match reasoning is clear and actionable

### AC-4: Notification Delivery
- [ ] CSM notified within 2 minutes
- [ ] Slack notification includes context
- [ ] Critical alerts escalate to manager

### AC-5: Playbook Initiation
- [ ] Accepted playbooks start immediately
- [ ] Tasks created with correct due dates
- [ ] Progress tracking enabled

## Dependencies
- PRD-107: Health Score Threshold Alert
- PRD-232: Automated Playbook Selection
- PRD-086: Usage Drop Alert → Check-In Workflow
- PRD-091: NPS Score Drop → Recovery Workflow

## Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Too many alerts (alert fatigue) | High | Medium | Configurable thresholds, smart batching |
| Incorrect playbook match | Medium | Medium | CSM review required, feedback loop |
| Delayed detection | Low | High | Real-time calculation triggers |

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Detection latency | < 1 hour | Time from change to alert |
| Playbook acceptance rate | > 70% | Accepted vs rejected |
| Health recovery rate | > 50% | Customers recovering within 30 days |
| Time to intervention | < 24 hours | Alert to first action |

## Implementation Notes
- Use database triggers or scheduled jobs for change detection
- Leverage `csm_playbooks` table for playbook matching
- Consider ML model for playbook recommendation over time
- Implement feedback loop to improve matching algorithm
