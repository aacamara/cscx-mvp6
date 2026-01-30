# PRD-218: Real-Time Sentiment Analysis

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-218 |
| **Title** | Real-Time Sentiment Analysis |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Understanding customer sentiment is crucial for maintaining healthy relationships. Currently, sentiment is only captured during periodic health assessments or post-meeting analysis. CSMs need real-time sentiment signals from all communication channels to detect mood shifts early and respond appropriately before small concerns become major issues.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see real-time sentiment scores for each customer interaction.
2. **As a CSM**, I want alerts when sentiment drops significantly during any touchpoint.
3. **As a CSM**, I want to see sentiment trends over time for each account.
4. **As a CSM**, I want sentiment analysis of emails as I read them in the platform.
5. **As a CSM**, I want to understand which specific topics drive positive or negative sentiment.

### Secondary User Stories
1. **As a CSM Manager**, I want to see aggregate sentiment across the team's portfolio.
2. **As a CSM**, I want historical sentiment correlated with outcomes (renewal, expansion, churn).
3. **As a CS Leader**, I want sentiment benchmarks across customer segments.

## Acceptance Criteria

### Core Functionality
- [ ] Sentiment scoring for all text-based communications (email, meeting transcripts, chat)
- [ ] Real-time analysis (within seconds for emails, within minutes for transcripts)
- [ ] Sentiment score range: -100 (very negative) to +100 (very positive)
- [ ] Topic-level sentiment breakdown (product, support, pricing, relationship)
- [ ] Historical sentiment tracking with trend visualization

### Communication Channels Analyzed
- [ ] Email threads (Gmail integration)
- [ ] Meeting transcripts (Zoom, Otter.ai)
- [ ] Support tickets (when integrated)
- [ ] Slack messages (when connected to customer channels)
- [ ] NPS/survey responses

### Alert Triggers
- [ ] Single interaction sentiment < -30
- [ ] Rolling 7-day sentiment drops > 20 points
- [ ] Negative sentiment spike (3+ negative interactions in 24 hours)
- [ ] Specific keywords detected (cancel, frustrated, disappointed, competitor)

## Technical Specification

### Architecture

```
Communication Source → Text Extractor → Sentiment Analyzer → Score Calculator → Alert Engine → Database
                                              ↓
                                       Topic Classifier
```

### Sentiment Analysis Pipeline

#### 1. Text Extraction
```typescript
interface CommunicationText {
  source: 'email' | 'meeting' | 'support' | 'slack' | 'survey';
  customer_id: string;
  stakeholder_id?: string;
  content: string;
  timestamp: Date;
  metadata: Record<string, any>;
}
```

#### 2. Sentiment Analyzer (Claude)

**Prompt:**
```
Analyze the sentiment of this customer communication.

Communication Context:
- Source: {source}
- Customer: {customer_name}
- Stakeholder: {stakeholder_name} ({role})
- Previous sentiment trend: {trend}

Text to analyze:
{content}

Provide:
1. Overall sentiment score (-100 to +100)
2. Confidence level (0-1)
3. Emotional indicators detected
4. Topic-specific sentiment:
   - Product/features
   - Support/service
   - Pricing/value
   - Relationship/partnership
5. Key phrases that influenced the score
6. Risk indicators (any concerning language)

Format as JSON.
```

#### 3. Score Calculator

```typescript
interface SentimentResult {
  overall_score: number;        // -100 to +100
  confidence: number;           // 0 to 1
  emotional_indicators: string[]; // e.g., ["frustrated", "concerned", "appreciative"]
  topic_sentiment: {
    product: number | null;
    support: number | null;
    pricing: number | null;
    relationship: number | null;
  };
  key_phrases: KeyPhrase[];
  risk_indicators: string[];
}

interface KeyPhrase {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;  // Contribution to overall score
}
```

### API Endpoints

#### POST /api/sentiment/analyze
```json
{
  "source": "email",
  "customer_id": "uuid",
  "content": "email body text...",
  "metadata": {
    "thread_id": "gmail-thread-id",
    "from": "customer@example.com"
  }
}
```

Response:
```json
{
  "sentiment_id": "uuid",
  "overall_score": -35,
  "confidence": 0.88,
  "emotional_indicators": ["frustrated", "concerned"],
  "topic_sentiment": {
    "product": -45,
    "support": -30,
    "pricing": null,
    "relationship": -10
  },
  "key_phrases": [
    {
      "text": "this has been an ongoing issue",
      "sentiment": "negative",
      "impact": -15
    },
    {
      "text": "appreciate your help",
      "sentiment": "positive",
      "impact": 5
    }
  ],
  "risk_indicators": ["ongoing issue", "escalate"],
  "alert_triggered": true,
  "alert_level": "warning"
}
```

#### GET /api/customers/{id}/sentiment
```json
{
  "customer_id": "uuid",
  "current_score": 42,
  "trend": "declining",
  "change_7d": -15,
  "change_30d": -28,
  "topic_breakdown": {
    "product": 55,
    "support": 25,
    "pricing": 60,
    "relationship": 50
  },
  "recent_interactions": [
    {
      "source": "email",
      "score": -35,
      "date": "2026-01-29",
      "snippet": "We've been experiencing issues with..."
    },
    {
      "source": "meeting",
      "score": 45,
      "date": "2026-01-25",
      "snippet": "Overall positive QBR..."
    }
  ],
  "historical_data": [
    { "date": "2026-01-01", "score": 70 },
    { "date": "2026-01-08", "score": 65 },
    { "date": "2026-01-15", "score": 58 },
    { "date": "2026-01-22", "score": 50 },
    { "date": "2026-01-29", "score": 42 }
  ]
}
```

### Database Schema

```sql
CREATE TABLE sentiment_analyses (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  stakeholder_id UUID REFERENCES stakeholders(id),
  source VARCHAR(50) NOT NULL,
  source_id TEXT,  -- e.g., email thread ID
  content_hash TEXT,  -- For deduplication
  overall_score INTEGER NOT NULL,
  confidence DECIMAL(3,2),
  topic_sentiment JSONB,
  emotional_indicators TEXT[],
  key_phrases JSONB,
  risk_indicators TEXT[],
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sentiment_alerts (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  sentiment_analysis_id UUID REFERENCES sentiment_analyses(id),
  alert_type VARCHAR(50),
  alert_level VARCHAR(20),
  message TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sentiment_customer_date ON sentiment_analyses(customer_id, analyzed_at DESC);
CREATE INDEX idx_sentiment_source ON sentiment_analyses(source, analyzed_at DESC);
CREATE INDEX idx_sentiment_alerts_customer ON sentiment_alerts(customer_id, created_at DESC);
```

### Real-Time Processing

#### Email Webhook Handler
```typescript
// When new email received via Gmail webhook
async function handleNewEmail(email: GmailMessage) {
  if (isCustomerEmail(email.from)) {
    const customer = await findCustomerByEmail(email.from);
    const sentiment = await analyzeSentiment({
      source: 'email',
      customer_id: customer.id,
      content: email.body,
      metadata: { thread_id: email.threadId }
    });

    if (sentiment.overall_score < -30) {
      await createSentimentAlert(customer.id, sentiment);
      await notifyCSM(customer.csm_id, sentiment);
    }
  }
}
```

## UI/UX Design

### Sentiment Indicator in Email View
```
┌─────────────────────────────────────────────────────────┐
│ From: Sarah Chen <sarah@techcorp.com>                   │
│ Subject: Re: Q1 reporting timeline                      │
│ Received: 10 minutes ago                                │
├─────────────────────────────────────────────────────────┤
│ SENTIMENT: 😟 -35       ⚠️ Declining trend              │
│ ├── Product: -45 (frustrated with feature)              │
│ ├── Support: -30 (delayed response mentioned)           │
│ └── Relationship: Neutral                               │
│                                                         │
│ ⚠️ Risk phrases detected: "ongoing issue", "escalate"   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Hi,                                                     │
│                                                         │
│ This has been an ongoing issue that we need resolved.   │
│ Our team is getting frustrated with the delays...       │
│ [highlighted: negative phrases]                         │
│                                                         │
│ I appreciate your help on this but may need to          │
│ escalate if we don't see progress this week.            │
│ [highlighted: escalation risk]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Customer Sentiment Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ SENTIMENT OVERVIEW - TechCorp Industries                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ CURRENT SENTIMENT          TREND (30 DAYS)              │
│ ┌─────────────────┐        ┌───────────────────────┐   │
│ │      42         │        │    70  ─┐              │   │
│ │   ████████░░    │        │         └─ 58         │   │
│ │   Cautious      │        │             └─ 42 ←   │   │
│ │   ↓28 vs 30d    │        │    ──────────────────  │   │
│ └─────────────────┘        │    Jan 1        Jan 29 │   │
│                            └───────────────────────┘   │
│                                                         │
│ BY TOPIC                                                │
│ ────────                                                │
│ Product     ████████████░░░░░░░░░  55  (stable)        │
│ Support     █████░░░░░░░░░░░░░░░░  25  (↓ concern)     │
│ Pricing     ████████████░░░░░░░░░  60  (stable)        │
│ Relationship█████████░░░░░░░░░░░  50  (↓ slight)       │
│                                                         │
│ RECENT INTERACTIONS                                     │
│ ───────────────────                                     │
│ 📧 Jan 29  -35  "ongoing issue...need to escalate"      │
│ 📅 Jan 25  +45  QBR meeting - overall positive          │
│ 📧 Jan 20  -10  Follow-up on support ticket             │
│ 📧 Jan 15  +25  Thank you for the demo                  │
│                                                         │
│ ALERTS                                                  │
│ ──────                                                  │
│ ⚠️ Sentiment dropped 28 points this month               │
│ ⚠️ Support satisfaction trending negative               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Gmail webhook integration
- Meeting transcript processing
- Claude API for sentiment analysis
- Real-time notification system

### Related PRDs
- PRD-213: AI Meeting Summarization
- PRD-190: Gmail Integration
- PRD-076: Account Sentiment Over Time
- PRD-091: NPS Score Drop → Recovery Workflow

## Success Metrics

### Quantitative
- Sentiment analysis latency < 5 seconds for emails
- Analysis accuracy > 85% (validated against human ratings)
- Alert precision > 80% (alerts are actionable)
- Early detection: Negative trends detected 7+ days before escalation

### Qualitative
- CSMs find sentiment signals accurate and useful
- Sentiment correlates with actual outcomes
- Topic breakdown helps target conversations

## Rollout Plan

### Phase 1: Email Sentiment (Week 1-2)
- Gmail integration sentiment analysis
- Basic scoring and display
- Simple alerts

### Phase 2: Multi-Channel (Week 3-4)
- Meeting transcript sentiment
- Support ticket sentiment
- Aggregated scoring

### Phase 3: Intelligence (Week 5-6)
- Topic-level sentiment
- Trend analysis
- Historical correlation

### Phase 4: Advanced Alerts (Week 7-8)
- Smart alert thresholds
- Predictive sentiment shifts
- Manager dashboards

## Open Questions
1. How do we handle sarcasm and cultural nuances?
2. Should we analyze CSM outgoing messages too?
3. What's the right granularity for historical tracking?
4. How do we weight different communication channels?
