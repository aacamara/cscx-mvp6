# PRD-226: Smart Follow-Up Timing

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-226 |
| **Title** | Smart Follow-Up Timing |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs often wonder "When is the best time to follow up?" - too soon feels pushy, too late loses momentum. Timing decisions are currently based on intuition or arbitrary rules. AI should analyze historical engagement patterns, stakeholder behaviors, and contextual signals to recommend optimal follow-up timing for each customer and interaction type.

## User Stories

### Primary User Stories
1. **As a CSM**, I want AI to suggest the best day/time to send follow-up emails to each stakeholder.
2. **As a CSM**, I want to know the optimal cadence for different customer situations (at-risk vs healthy).
3. **As a CSM**, I want reminders when the optimal follow-up window is approaching.
4. **As a CSM**, I want to understand why a specific timing is recommended.
5. **As a CSM**, I want historical data on what timing has worked for similar situations.

### Secondary User Stories
1. **As a CSM**, I want to schedule emails for optimal delivery times automatically.
2. **As a CSM**, I want meeting time suggestions based on stakeholder availability patterns.
3. **As a CSM Manager**, I want team-wide insights on effective timing patterns.

## Acceptance Criteria

### Core Functionality
- [ ] Personalized timing recommendations per stakeholder
- [ ] Situation-aware suggestions (post-meeting, after silence, renewal approach)
- [ ] Confidence scores for recommendations
- [ ] Explanation of timing rationale
- [ ] Integration with email scheduling

### Timing Factors
- [ ] Stakeholder's email engagement patterns (open times, response times)
- [ ] Historical response success by time/day
- [ ] Timezone considerations
- [ ] Industry/role patterns
- [ ] Urgency of communication
- [ ] Customer health status
- [ ] Recent interaction history

### Recommendation Types
- [ ] **Best send time**: Optimal hour/day for email delivery
- [ ] **Best follow-up interval**: Days to wait before following up
- [ ] **Meeting request timing**: When to propose meetings
- [ ] **Escalation timing**: When silence warrants escalation
- [ ] **Renewal outreach timing**: Optimal start for renewal conversations

## Technical Specification

### Architecture

```
Interaction Request → Context Gatherer → Pattern Analyzer → Timing Model → Recommendation → Scheduler Integration
                            ↓                   ↓
                    Historical Data      External Signals
```

### Timing Model

```typescript
interface TimingRecommendation {
  action_type: 'email' | 'call' | 'meeting_request' | 'follow_up';
  stakeholder_id: string;
  recommended_time: Date;
  confidence: number;
  reasoning: string[];
  alternative_times: AlternativeTime[];
  factors: TimingFactor[];
}

interface TimingFactor {
  name: string;
  influence: 'positive' | 'negative';
  weight: number;
  description: string;
}

interface AlternativeTime {
  time: Date;
  confidence: number;
  trade_off: string;  // e.g., "Slightly lower open rate but sooner"
}
```

### Pattern Analysis

```typescript
interface StakeholderEngagementPattern {
  stakeholder_id: string;
  email_patterns: {
    best_open_hours: number[];     // Hours in local time
    best_open_days: number[];      // 0-6, Monday-Sunday
    avg_response_time_hours: number;
    response_rate_by_hour: Map<number, number>;
  };
  meeting_patterns: {
    preferred_hours: number[];
    preferred_days: number[];
    avg_meeting_duration: number;
  };
  timezone: string;
  last_interaction: Date;
  interaction_frequency: number;  // Avg days between interactions
}

async function analyzeStakeholderPatterns(
  stakeholderId: string
): Promise<StakeholderEngagementPattern> {
  const emailHistory = await getEmailHistory(stakeholderId);
  const meetingHistory = await getMeetingHistory(stakeholderId);

  // Analyze email open/response patterns
  const emailPatterns = analyzeEmailPatterns(emailHistory);

  // Analyze meeting attendance patterns
  const meetingPatterns = analyzeMeetingPatterns(meetingHistory);

  return {
    stakeholder_id: stakeholderId,
    email_patterns: emailPatterns,
    meeting_patterns: meetingPatterns,
    timezone: await inferTimezone(stakeholderId),
    last_interaction: getLastInteraction(emailHistory, meetingHistory),
    interaction_frequency: calculateFrequency(emailHistory, meetingHistory)
  };
}
```

### Timing Recommendation Engine

```typescript
async function getOptimalTiming(
  request: TimingRequest
): Promise<TimingRecommendation> {
  const stakeholderPattern = await analyzeStakeholderPatterns(request.stakeholder_id);
  const customerContext = await getCustomerContext(request.customer_id);
  const situationContext = await getSituationContext(request);

  // Base timing from stakeholder patterns
  let baseTime = calculateBaseTime(stakeholderPattern, request.action_type);

  // Adjust for situation
  if (customerContext.health_status === 'at_risk') {
    baseTime = adjustForUrgency(baseTime, 'high');
  }

  if (request.context === 'renewal_outreach') {
    baseTime = adjustForRenewalTiming(baseTime, customerContext.renewal_date);
  }

  // Calculate confidence based on data quality
  const confidence = calculateConfidence(
    stakeholderPattern.email_patterns.response_rate_by_hour.size,
    stakeholderPattern.last_interaction
  );

  return {
    action_type: request.action_type,
    stakeholder_id: request.stakeholder_id,
    recommended_time: baseTime,
    confidence,
    reasoning: generateReasoning(stakeholderPattern, customerContext, situationContext),
    alternative_times: generateAlternatives(baseTime, stakeholderPattern),
    factors: extractFactors(stakeholderPattern, customerContext)
  };
}
```

### API Endpoints

#### POST /api/timing/recommend
```json
{
  "action_type": "email",
  "stakeholder_id": "uuid",
  "customer_id": "uuid",
  "context": "follow_up_after_meeting",
  "urgency": "normal",
  "content_type": "renewal_discussion"
}
```

Response:
```json
{
  "recommendation": {
    "recommended_time": "2026-01-30T14:30:00Z",
    "local_time": "9:30 AM EST",
    "confidence": 0.85,
    "reasoning": [
      "Sarah typically opens emails between 9-10 AM EST",
      "Tuesday has 23% higher response rate than other days",
      "1 day after meeting is optimal for follow-ups based on history"
    ],
    "factors": [
      {
        "name": "historical_open_time",
        "influence": "positive",
        "weight": 0.4,
        "description": "9-10 AM EST shows highest engagement"
      },
      {
        "name": "day_of_week",
        "influence": "positive",
        "weight": 0.25,
        "description": "Tuesday optimal for this stakeholder"
      },
      {
        "name": "follow_up_interval",
        "influence": "positive",
        "weight": 0.35,
        "description": "24 hours post-meeting is ideal"
      }
    ],
    "alternative_times": [
      {
        "time": "2026-01-30T19:00:00Z",
        "local_time": "2:00 PM EST",
        "confidence": 0.72,
        "trade_off": "Good open time but lower response rate"
      },
      {
        "time": "2026-01-31T14:30:00Z",
        "local_time": "9:30 AM EST Wednesday",
        "confidence": 0.78,
        "trade_off": "Similar pattern but delays follow-up"
      }
    ]
  },
  "actions": {
    "schedule_for_recommended": "/api/email/schedule",
    "schedule_custom": "/api/email/schedule"
  }
}
```

#### GET /api/timing/patterns/{stakeholder_id}
Returns engagement patterns for a specific stakeholder.

#### GET /api/timing/insights
Returns aggregate timing insights across portfolio.

### Database Schema

```sql
CREATE TABLE engagement_patterns (
  id UUID PRIMARY KEY,
  stakeholder_id UUID REFERENCES stakeholders(id),
  pattern_type VARCHAR(50),  -- email_open, email_response, meeting_attendance
  hour_distribution JSONB,   -- {0: 0.01, 1: 0.02, ..., 23: 0.05}
  day_distribution JSONB,    -- {0: 0.1, 1: 0.18, ..., 6: 0.08}
  avg_response_time_hours DECIMAL(8,2),
  sample_size INTEGER,
  last_calculated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE timing_recommendations (
  id UUID PRIMARY KEY,
  stakeholder_id UUID,
  customer_id UUID,
  action_type VARCHAR(50),
  recommended_time TIMESTAMPTZ,
  actual_send_time TIMESTAMPTZ,
  confidence DECIMAL(3,2),
  outcome VARCHAR(50),  -- opened, responded, no_response
  outcome_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patterns_stakeholder ON engagement_patterns(stakeholder_id);
CREATE INDEX idx_timing_recs_outcome ON timing_recommendations(stakeholder_id, outcome);
```

## UI/UX Design

### Email Compose with Timing
```
┌─────────────────────────────────────────────────────────┐
│ COMPOSE EMAIL                                           │
├─────────────────────────────────────────────────────────┤
│ To: Sarah Chen <sarah@techcorp.com>                     │
│ Subject: Follow-up from yesterday's call                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Email content...]                                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ OPTIMAL SEND TIME                                       │
│ ─────────────────                                       │
│                                                         │
│ 🎯 Recommended: Tomorrow, 9:30 AM EST (85% confidence)  │
│                                                         │
│ Why this time:                                          │
│ • Sarah typically opens emails 9-10 AM                  │
│ • Tuesday has 23% higher response rate                  │
│ • 1 day after meeting is optimal for follow-ups         │
│                                                         │
│ Alternatives:                                           │
│ • Today 2:00 PM EST (72% - good but lower response)     │
│ • Wednesday 9:30 AM (78% - delays follow-up)            │
│                                                         │
│ [Send Now] [Schedule for 9:30 AM ✓] [Schedule Custom]   │
└─────────────────────────────────────────────────────────┘
```

### Follow-Up Reminder
```
┌─────────────────────────────────────────────────────────┐
│ 🔔 FOLLOW-UP TIMING                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ TechCorp - Sarah Chen                                   │
│ Last contact: 5 days ago (proposal sent)                │
│                                                         │
│ 📊 Optimal follow-up window: NOW - Next 2 days          │
│                                                         │
│ Based on:                                               │
│ • Similar proposals get responses in 3-7 days           │
│ • Sarah's avg response time: 4 days                     │
│ • No response yet suggests action needed                │
│                                                         │
│ Recommendation: Follow up tomorrow morning (9:30 AM)    │
│                                                         │
│ [Draft Follow-Up] [Snooze 2 Days] [Mark Resolved]       │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Email tracking (opens, responses) - existing Gmail integration
- Meeting history - existing calendar integration
- Timezone database
- Scheduled task system

### Related PRDs
- PRD-215: Smart Email Response Suggestions
- PRD-036: Meeting Request Optimizer
- PRD-106: Quiet Account Alert

## Success Metrics

### Quantitative
- Email open rate improvement > 15%
- Response rate improvement > 20%
- Follow-up timing compliance > 70%
- Recommendation accuracy > 80%

### Qualitative
- CSMs trust timing recommendations
- Reduced decision fatigue on when to reach out
- Better stakeholder engagement

## Rollout Plan

### Phase 1: Data Collection (Week 1-2)
- Email engagement tracking
- Pattern analysis infrastructure
- Historical data processing

### Phase 2: Basic Recommendations (Week 3-4)
- Send time recommendations
- Simple confidence scoring
- Integration with email compose

### Phase 3: Follow-Up Intelligence (Week 5-6)
- Follow-up interval recommendations
- Situation-aware timing
- Reminder system

### Phase 4: Optimization (Week 7-8)
- Feedback loop from outcomes
- Model improvement
- Team-wide insights

## Open Questions
1. How much historical data do we need for reliable patterns?
2. Should we integrate with external email tracking services?
3. How do we handle stakeholders with limited interaction history?
4. Should timing recommendations override user preferences?
