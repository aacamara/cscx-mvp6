# PRD-076: Account Sentiment Over Time

## Category
**Category C: Account Intelligence**

## Priority
**P2** - Advanced Features

## Overview
Track and visualize customer sentiment trends over time by analyzing communications, meeting transcripts, support interactions, and survey responses. This longitudinal sentiment view helps CSMs identify relationship trends, detect early warning signs, and understand how events impact customer perception.

## User Story
As a CSM, I want to see how my customer's sentiment has changed over time so that I can identify what's working, what's causing friction, and take action before negative sentiment leads to churn.

As a CS Leader, I want to understand sentiment trends across the portfolio so that I can identify systemic issues and correlate sentiment with business outcomes.

## Trigger
- Navigation: Customer Detail > Sentiment Tab
- Natural language: "What's the sentiment trend for [Account]?"
- Variations: "How does [Account] feel about us?", "Sentiment history", "Relationship health trend"
- Alert: Triggered when sentiment drops significantly

## Input Requirements
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Customer ID | UUID | Yes | Account to analyze |
| Time Period | String | No | Analysis period (default: 12 months) |
| Source Filter | String[] | No | Filter by sentiment source |

## Sentiment Sources
| Source | Data Type | Analysis Method |
|--------|-----------|-----------------|
| Meeting Transcripts | Audio/Text | NLP sentiment analysis |
| Email Threads | Text | Tone analysis |
| Support Tickets | Text | Frustration detection |
| NPS Surveys | Score + Comment | Direct + text analysis |
| CSAT Responses | Score + Comment | Direct + text analysis |
| Chat Messages | Text | Real-time sentiment |
| QBR Feedback | Structured | Direct capture |

## Sentiment Scoring Model
```typescript
interface SentimentAnalysis {
  customerId: string;
  period: DateRange;

  // Overall sentiment
  currentSentiment: number;  // -100 to +100
  sentimentLabel: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  trend: 'improving' | 'stable' | 'declining';

  // Time series
  sentimentHistory: SentimentDataPoint[];

  // Breakdown
  bySource: SourceSentiment[];
  byStakeholder: StakeholderSentiment[];
  byTopic: TopicSentiment[];

  // Events
  significantEvents: SentimentEvent[];
  correlations: SentimentCorrelation[];

  // Analysis
  drivers: SentimentDriver[];
  concerns: string[];
  positives: string[];
}

interface SentimentDataPoint {
  date: Date;
  score: number;          // -100 to +100
  confidence: number;     // 0-100
  sources: string[];
  eventMarker?: string;
}

interface SentimentEvent {
  date: Date;
  event: string;
  sentimentImpact: number;  // Change in sentiment
  type: 'positive' | 'negative';
}
```

## Sentiment Scale
| Score Range | Label | Description |
|-------------|-------|-------------|
| 75 to 100 | Very Positive | Advocates, highly satisfied |
| 25 to 74 | Positive | Generally satisfied |
| -24 to 24 | Neutral | Neither positive nor negative |
| -74 to -25 | Negative | Dissatisfied, concerns present |
| -100 to -75 | Very Negative | At risk, frustrated |

## Output Format
```markdown
## Sentiment Analysis: Acme Corp
Period: Last 12 Months | Updated: [Timestamp]

### Current Sentiment: +52 (Positive)
[Gauge visualization from -100 to +100]

**Trend**: ▼ Declining (-12 from 6 months ago)
**Confidence**: 85% (based on 47 data points)

---

### Sentiment Timeline
[Line chart showing sentiment over 12 months with event markers]

```
Score
 100 ┤
  75 ┤     ╭──╮
  50 ┤ ╭───╯  ╰──────╮        [Current: 52]
  25 ┤─╯              ╰──╮          │
   0 ┤                   ╰─────────────
 -25 ┤                              ▼
 -50 ┤
     └─────────────────────────────────────
       Feb  Apr  Jun  Aug  Oct  Dec  Feb
```

**Key Events Marked**:
- A: Successful QBR (Mar) - Sentiment peak
- B: Support escalation (Aug) - Sharp decline
- C: Issue resolved (Sep) - Recovery
- D: Champion on leave (Dec) - Gradual decline

---

### Sentiment by Source

| Source | Score | Trend | Data Points | Last |
|--------|-------|-------|-------------|------|
| Meeting Transcripts | +58 | ● Stable | 24 | Jan 22 |
| Email Communication | +45 | ▼ Down | 89 | Jan 28 |
| Support Tickets | +35 | ▲ Up | 12 | Jan 15 |
| NPS Survey | +70 (Score: 8) | ● Stable | 2 | Nov 15 |
| QBR Feedback | +65 | ▼ Down | 4 | Dec 15 |

**Insight**: Support sentiment improving, but email tone declining

---

### Sentiment by Stakeholder

| Stakeholder | Role | Sentiment | Trend | Recent Quotes |
|-------------|------|-----------|-------|---------------|
| Sarah Chen | VP Ops | +72 | ● | "The team really values the product" |
| Mike Lee | Director | +45 | ▼ | "Some frustration with recent bugs" |
| Amy Wang | User | +60 | ● | "Love the new features" |
| Bob Smith | User | +25 | ▼ | "Wish support was faster" |

**Alert**: Mike Lee sentiment declining - investigate

---

### Sentiment by Topic

| Topic | Sentiment | Frequency | Trend |
|-------|-----------|-----------|-------|
| Product Value | +75 | High | ● |
| Feature Quality | +55 | Medium | ▲ |
| Support Experience | +35 | Medium | ▲ |
| Ease of Use | +45 | Low | ● |
| Price/Value | +40 | Low | ▼ |
| Communication | +60 | Medium | ● |

**Topic Deep Dive: Support Experience (+35, Improving)**

Recent mentions:
- "Support resolved the issue, but took longer than expected" (Jan 15)
- "Better response than last time" (Jan 10)
- "Still waiting on ticket #4521" (Jan 5)

Recommendation: Acknowledge improvement, address remaining ticket

---

### Significant Events & Impact

| Date | Event | Sentiment Impact | Recovery Time |
|------|-------|------------------|---------------|
| Dec 15 | Champion vacation | -8 | Ongoing |
| Sep 10 | Escalation resolved | +15 | Immediate |
| Aug 20 | Major bug reported | -22 | 3 weeks |
| Mar 15 | Successful QBR | +18 | Sustained |
| Jan 10 | Price increase notice | -5 | 2 weeks |

[Timeline visualization with events]

---

### Sentiment Drivers

#### Positive Drivers
| Driver | Contribution | Evidence |
|--------|--------------|----------|
| Product value delivered | +30 | "Saving us 20 hours/week" |
| Champion relationship | +25 | "Sarah is our biggest advocate" |
| New features released | +15 | "Analytics module is great" |
| Training support | +10 | "Onboarding was excellent" |

#### Negative Drivers
| Driver | Contribution | Evidence |
|--------|--------------|----------|
| Support response time | -15 | "Takes too long to get help" |
| Recent bugs | -10 | "Reliability concerns" |
| Missing features | -8 | "Wish we had X capability" |
| Price increase | -5 | "Budget discussions ongoing" |

---

### Correlation Analysis

| Factor | Correlation with Sentiment |
|--------|---------------------------|
| Health Score | r = 0.85 (Strong) |
| Usage Volume | r = 0.72 (Moderate) |
| Support Tickets | r = -0.65 (Inverse) |
| Meeting Frequency | r = 0.58 (Moderate) |
| Days Since Contact | r = -0.45 (Inverse) |

**Insight**: Sentiment strongly correlates with health score.
Support tickets have inverse relationship - more tickets = lower sentiment.

---

### Sentiment Forecast

Based on current trend and patterns:
| Timeframe | Predicted Sentiment | Confidence |
|-----------|---------------------|------------|
| 30 days | +48 | 75% |
| 60 days | +45 | 65% |
| 90 days | +42 | 55% |

**Risk**: Without intervention, sentiment may continue declining

---

### Recommended Actions

1. **Immediate**: Address Bob Smith's concerns (lowest sentiment)
2. **This Week**: Check in with Mike Lee on recent frustrations
3. **Ongoing**: Increase touch frequency during champion absence
4. **Proactive**: Share roadmap to address feature gaps

---

### Alert Settings

Current sentiment alert thresholds:
| Condition | Alert | Status |
|-----------|-------|--------|
| Score drops below 25 | Email + Slack | Not triggered |
| Score drops > 20 in 30 days | Slack | Not triggered |
| Stakeholder becomes negative | In-app | Active for Bob |

[Modify Alert Settings]

---

### Quick Actions
[View All Quotes] [Export Sentiment Report] [Schedule Sentiment Review] [Share with Team]
```

## Acceptance Criteria
- [ ] Sentiment scores calculated from all sources
- [ ] Timeline visualization shows trend over time
- [ ] Event markers on significant changes
- [ ] Breakdown by source, stakeholder, topic
- [ ] Correlation analysis included
- [ ] Drivers identified and explained
- [ ] Forecast generated with confidence
- [ ] Alerts when sentiment drops
- [ ] Quotes extracted and displayed
- [ ] Export to PDF available

## API Endpoint
```
GET /api/intelligence/sentiment/:customerId
  Query: ?period=12m&sources=all

Response: {
  currentSentiment: number;
  trend: string;
  history: SentimentDataPoint[];
  bySource: SourceSentiment[];
  byStakeholder: StakeholderSentiment[];
  events: SentimentEvent[];
  drivers: SentimentDriver[];
  forecast: SentimentForecast;
}
```

## Data Sources
| Source | Table/API | Processing |
|--------|-----------|------------|
| Meetings | `meeting_analyses` | Pre-analyzed |
| Emails | Gmail API | Real-time NLP |
| Support | Integration | Ticket analysis |
| Surveys | NPS/CSAT tables | Direct scores |
| Chat | `chat_messages` | Real-time NLP |

## NLP Model
```typescript
// Sentiment analysis pipeline
const analyzeSentiment = async (text: string, source: string) => {
  const result = await nlpModel.analyze(text, {
    features: ['sentiment', 'entities', 'keywords'],
    source_context: source
  });

  return {
    score: result.sentiment.score,      // -100 to +100
    confidence: result.sentiment.confidence,
    keywords: result.keywords,
    topics: extractTopics(result.entities)
  };
};
```

## Success Metrics
| Metric | Target |
|--------|--------|
| Sentiment Accuracy | > 85% vs manual rating |
| Decline Detection | > 90% of declines caught |
| Correlation with Churn | r > 0.7 |
| CSM Sentiment Awareness | +50% |

## Future Enhancements
- Real-time sentiment during calls
- Predictive sentiment modeling
- Competitive sentiment comparison
- Sentiment-based automated actions
- Voice/tone analysis from calls

## Related PRDs
- PRD-005: NPS Survey Analysis
- PRD-218: Real-Time Sentiment Analysis
- PRD-213: AI Meeting Summarization
- PRD-227: Relationship Strength Scoring
