# PRD-227: Relationship Strength Scoring

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-227 |
| **Title** | Relationship Strength Scoring |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs need to understand the depth and health of relationships with key stakeholders. Currently, relationship strength is subjective and inconsistently assessed. AI should analyze communication patterns, meeting frequency, sentiment trends, and engagement signals to provide objective relationship strength scores, helping CSMs identify where to invest in relationship building.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see a relationship strength score for each stakeholder.
2. **As a CSM**, I want to understand what factors contribute to relationship strength.
3. **As a CSM**, I want alerts when key relationships are weakening.
4. **As a CSM**, I want recommendations to strengthen specific relationships.
5. **As a CSM**, I want to see relationship trends over time.

### Secondary User Stories
1. **As a CSM**, I want a visual relationship map showing connection strengths.
2. **As a CSM Manager**, I want to see account-level relationship health aggregated.
3. **As a CSM**, I want to track multi-threading effectiveness (number of strong relationships).

## Acceptance Criteria

### Core Functionality
- [ ] Relationship score (0-100) for each stakeholder
- [ ] Multi-factor scoring with transparent breakdown
- [ ] Historical trend tracking
- [ ] Weakening relationship alerts
- [ ] Improvement recommendations
- [ ] Account-level relationship health summary

### Scoring Factors
- [ ] **Communication frequency**: Regular vs sporadic contact
- [ ] **Response patterns**: Response rate, speed, thoroughness
- [ ] **Meeting engagement**: Attendance, participation, follow-through
- [ ] **Sentiment trajectory**: Improving, stable, declining
- [ ] **Initiative balance**: Who initiates contact
- [ ] **Relationship tenure**: Time since first interaction
- [ ] **Access level**: Junior contact vs executive sponsor
- [ ] **Advocacy signals**: Referrals, references, testimonials

### Relationship Categories
- [ ] **Champion** (80-100): Strong advocate, high engagement
- [ ] **Supporter** (60-79): Positive, regular engagement
- [ ] **Neutral** (40-59): Professional, transactional
- [ ] **Distant** (20-39): Minimal engagement, at risk
- [ ] **Cold** (0-19): No meaningful relationship

## Technical Specification

### Architecture

```
Data Sources → Signal Extractor → Score Calculator → Trend Analyzer → Alert Engine → Recommendations
      ↓                                    ↓
Email/Calendar/Meetings             Historical Storage
```

### Scoring Model

```typescript
interface RelationshipScore {
  stakeholder_id: string;
  overall_score: number;
  category: 'champion' | 'supporter' | 'neutral' | 'distant' | 'cold';
  factors: ScoreFactor[];
  trend: 'strengthening' | 'stable' | 'weakening';
  trend_velocity: number;  // Points per month
  recommendations: Recommendation[];
  calculated_at: Date;
}

interface ScoreFactor {
  name: string;
  score: number;        // 0-100
  weight: number;       // 0-1, sum to 1
  contribution: number; // score * weight
  data_points: number;  // Sample size for confidence
  detail: string;
}
```

### Factor Calculation

```typescript
async function calculateRelationshipScore(
  stakeholderId: string
): Promise<RelationshipScore> {
  const data = await gatherRelationshipData(stakeholderId);

  const factors: ScoreFactor[] = [
    calculateCommunicationFrequency(data.emails, 0.2),
    calculateResponsePatterns(data.emails, 0.15),
    calculateMeetingEngagement(data.meetings, 0.2),
    calculateSentimentTrajectory(data.sentiments, 0.15),
    calculateInitiativeBalance(data.emails, data.meetings, 0.1),
    calculateRelationshipTenure(data.firstInteraction, 0.1),
    calculateAccessLevel(data.stakeholder, 0.05),
    calculateAdvocacySignals(data.advocacy, 0.05)
  ];

  const overallScore = factors.reduce((sum, f) => sum + f.contribution, 0);

  return {
    stakeholder_id: stakeholderId,
    overall_score: Math.round(overallScore),
    category: categorizeScore(overallScore),
    factors,
    trend: calculateTrend(stakeholderId),
    trend_velocity: calculateVelocity(stakeholderId),
    recommendations: generateRecommendations(factors, overallScore),
    calculated_at: new Date()
  };
}

function calculateCommunicationFrequency(
  emails: Email[],
  weight: number
): ScoreFactor {
  const last90Days = emails.filter(e => isWithinDays(e.date, 90));
  const frequency = last90Days.length / 90 * 30;  // Normalize to monthly

  let score: number;
  if (frequency >= 8) score = 100;      // Weekly+ contact
  else if (frequency >= 4) score = 80;  // Bi-weekly
  else if (frequency >= 2) score = 60;  // Monthly
  else if (frequency >= 1) score = 40;  // Every other month
  else score = Math.max(0, frequency * 40);

  return {
    name: 'communication_frequency',
    score,
    weight,
    contribution: score * weight,
    data_points: last90Days.length,
    detail: `${last90Days.length} interactions in 90 days (~${frequency.toFixed(1)}/month)`
  };
}

function calculateSentimentTrajectory(
  sentiments: SentimentData[],
  weight: number
): ScoreFactor {
  if (sentiments.length < 3) {
    return {
      name: 'sentiment_trajectory',
      score: 50,  // Neutral if insufficient data
      weight,
      contribution: 50 * weight,
      data_points: sentiments.length,
      detail: 'Insufficient data for sentiment trend'
    };
  }

  const recent = sentiments.slice(-5);
  const older = sentiments.slice(-10, -5);

  const recentAvg = average(recent.map(s => s.score));
  const olderAvg = average(older.map(s => s.score));

  // Convert sentiment (-100 to 100) to relationship score (0-100)
  const normalizedRecent = (recentAvg + 100) / 2;
  const trajectory = recentAvg - olderAvg;

  let score = normalizedRecent;
  if (trajectory > 10) score = Math.min(100, score + 10);
  if (trajectory < -10) score = Math.max(0, score - 10);

  return {
    name: 'sentiment_trajectory',
    score: Math.round(score),
    weight,
    contribution: Math.round(score * weight),
    data_points: sentiments.length,
    detail: trajectory > 0
      ? `Sentiment improving (+${trajectory.toFixed(0)} points)`
      : `Sentiment declining (${trajectory.toFixed(0)} points)`
  };
}
```

### API Endpoints

#### GET /api/stakeholders/{id}/relationship-score
```json
{
  "stakeholder_id": "uuid",
  "stakeholder_name": "Sarah Chen",
  "customer_name": "TechCorp Industries",
  "overall_score": 78,
  "category": "supporter",
  "trend": "stable",
  "trend_velocity": -2,
  "factors": [
    {
      "name": "communication_frequency",
      "score": 85,
      "weight": 0.2,
      "contribution": 17,
      "detail": "12 interactions in 90 days (~4/month)"
    },
    {
      "name": "response_patterns",
      "score": 90,
      "weight": 0.15,
      "contribution": 13.5,
      "detail": "95% response rate, avg 4 hours"
    },
    {
      "name": "meeting_engagement",
      "score": 75,
      "weight": 0.2,
      "contribution": 15,
      "detail": "Attended 6/8 meetings, active participant"
    },
    {
      "name": "sentiment_trajectory",
      "score": 65,
      "weight": 0.15,
      "contribution": 9.75,
      "detail": "Sentiment slightly declining (-5 points)"
    }
  ],
  "recommendations": [
    {
      "action": "address_sentiment",
      "priority": "medium",
      "description": "Recent interactions show slight negative sentiment shift. Consider a 1:1 check-in to address any concerns."
    },
    {
      "action": "increase_value",
      "priority": "low",
      "description": "Share relevant industry insights to strengthen advisory relationship."
    }
  ],
  "history": [
    { "date": "2026-01-01", "score": 80 },
    { "date": "2026-01-15", "score": 79 },
    { "date": "2026-01-29", "score": 78 }
  ]
}
```

#### GET /api/customers/{id}/relationship-health
```json
{
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "overall_relationship_health": 72,
  "multi_threading_score": 65,
  "stakeholder_count": 5,
  "relationship_distribution": {
    "champion": 1,
    "supporter": 2,
    "neutral": 1,
    "distant": 1,
    "cold": 0
  },
  "stakeholders": [
    {
      "id": "uuid",
      "name": "Sarah Chen",
      "role": "VP Product",
      "score": 78,
      "category": "supporter"
    }
  ],
  "risks": [
    "Single champion dependency",
    "No executive sponsor engagement"
  ],
  "recommendations": [
    "Engage CFO for renewal discussions",
    "Nurture engineering lead to supporter level"
  ]
}
```

### Database Schema

```sql
CREATE TABLE relationship_scores (
  id UUID PRIMARY KEY,
  stakeholder_id UUID REFERENCES stakeholders(id),
  overall_score INTEGER NOT NULL,
  category VARCHAR(20),
  factors JSONB NOT NULL,
  trend VARCHAR(20),
  trend_velocity DECIMAL(5,2),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE relationship_score_history (
  id UUID PRIMARY KEY,
  stakeholder_id UUID REFERENCES stakeholders(id),
  score INTEGER NOT NULL,
  category VARCHAR(20),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rel_scores_stakeholder ON relationship_scores(stakeholder_id);
CREATE INDEX idx_rel_history_stakeholder ON relationship_score_history(stakeholder_id, recorded_at DESC);
```

## UI/UX Design

### Stakeholder Card with Relationship Score
```
┌─────────────────────────────────────────────────────────┐
│ SARAH CHEN                                              │
│ VP Product @ TechCorp Industries                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ RELATIONSHIP STRENGTH                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │    78                     SUPPORTER                 │ │
│ │    ████████████████░░░░░░                           │ │
│ │    Trend: Stable (↓2 last month)                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ FACTOR BREAKDOWN                                        │
│ Communication:  ████████████████░░  85                  │
│ Responsiveness: █████████████████░  90                  │
│ Meeting Engage: ███████████████░░░  75                  │
│ Sentiment:      █████████████░░░░░  65                  │
│ Initiative:     ██████████████░░░░  70                  │
│                                                         │
│ RECOMMENDATION                                          │
│ ⚠️ Sentiment declining - Schedule 1:1 check-in          │
│                                                         │
│ [View Details] [Schedule Meeting] [Send Email]          │
└─────────────────────────────────────────────────────────┘
```

### Account Relationship Map
```
┌─────────────────────────────────────────────────────────┐
│ TECHCORP RELATIONSHIPS                  Health: 72      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    ┌─────────┐                          │
│                    │  CEO    │  Cold (15)               │
│                    │ James W │───┐                      │
│                    └─────────┘   │                      │
│                         │        │                      │
│      ┌─────────┐   ┌─────────┐  │                      │
│      │   CFO   │   │   CTO   │──┘                      │
│      │ Lisa M  │   │ Mike R  │  Neutral (45)           │
│      │Distant25│   │Neutral55│                         │
│      └─────────┘   └─────────┘                         │
│           │             │                               │
│      ┌─────────┐   ┌─────────┐                         │
│      │VP Prod  │   │VP Eng   │                         │
│      │Sarah C  │   │ Tom K   │                         │
│      │Support78│   │Support62│                         │
│      └─────────┘   └─────────┘                         │
│           │                                             │
│      ┌─────────┐                                        │
│      │Champion │                                        │
│      │ Amy L   │ Champion (92)                         │
│      └─────────┘                                        │
│                                                         │
│ RISKS:                                                  │
│ ⚠️ Single champion (Amy) - multi-thread needed          │
│ ⚠️ No exec sponsor - engage James or Lisa               │
│                                                         │
│ [Export Map] [Relationship Plan] [Schedule Outreach]    │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Email history analysis
- Meeting attendance tracking
- Sentiment analysis system
- Calendar integration

### Related PRDs
- PRD-063: Stakeholder Relationship Map
- PRD-218: Real-Time Sentiment Analysis
- PRD-082: Decision Maker Analysis

## Success Metrics

### Quantitative
- Score accuracy (validated by CSM feedback) > 85%
- Early warning: Weakening relationships flagged 30+ days before churn
- Multi-threading improvement: 20% more supporters per account
- Correlation between relationship score and retention

### Qualitative
- CSMs find scores accurate and actionable
- Recommendations improve relationships
- Proactive relationship building increases

## Rollout Plan

### Phase 1: Basic Scoring (Week 1-2)
- Communication frequency scoring
- Response pattern analysis
- Basic score display

### Phase 2: Full Model (Week 3-4)
- All scoring factors
- Trend analysis
- Recommendations

### Phase 3: Account View (Week 5-6)
- Relationship map visualization
- Account-level aggregation
- Multi-threading insights

### Phase 4: Alerts (Week 7-8)
- Weakening relationship alerts
- Champion departure risk
- Improvement tracking

## Open Questions
1. How do we handle stakeholders with very limited interaction history?
2. Should scores be visible to the customer?
3. How do we weight executive relationships vs champions?
4. What's the cadence for score recalculation?
