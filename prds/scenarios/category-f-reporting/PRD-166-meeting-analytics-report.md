# PRD-166: Meeting Analytics Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-166 |
| Title | Meeting Analytics Report |
| Category | F - Reporting & Analytics |
| Priority | P2 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a meeting analytics report that tracks meeting patterns, outcomes, sentiment, and effectiveness across customer interactions. This enables optimization of meeting cadence and improved understanding of customer relationships through meeting intelligence.

---

## 2. Problem Statement

### Current Pain Points
- No visibility into meeting patterns and frequency
- Cannot measure meeting effectiveness
- Missing insights from meeting sentiment analysis
- Difficult to track action items across meetings
- No correlation between meetings and outcomes

### Impact
- Suboptimal meeting cadence
- Missed signals from meeting conversations
- Incomplete follow-through on commitments
- Lack of data to improve meeting quality

---

## 3. Solution Overview

### High-Level Approach
Build a meeting analytics system that aggregates meeting data, analyzes transcripts, tracks outcomes, and provides insights for improving customer interactions.

### Key Features
1. **Meeting Volume** - Track meeting frequency and duration
2. **Sentiment Analysis** - Meeting-level sentiment tracking
3. **Action Item Tracking** - Monitor follow-through
4. **Participant Analysis** - Stakeholder engagement
5. **Topic Analysis** - Common themes and concerns
6. **Outcome Correlation** - Link meetings to results
7. **Recommendations** - Cadence optimization suggestions

---

## 4. User Stories

### Primary User Stories

```
As a CSM,
I want to see meeting patterns for my customers
So that I can optimize my engagement cadence
```

```
As a CSM Manager,
I want to understand meeting effectiveness across my team
So that I can coach on best practices
```

```
As a VP of CS,
I want to correlate meetings with customer outcomes
So that I can set optimal meeting guidelines
```

---

## 5. Functional Requirements

### 5.1 Meeting Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-166.1 | Track meeting count per customer | P0 |
| FR-166.2 | Track total meeting time | P0 |
| FR-166.3 | Categorize meetings by type | P1 |
| FR-166.4 | Track meeting participants | P0 |
| FR-166.5 | Record meeting outcomes | P0 |

### 5.2 Sentiment & Topics

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-166.6 | Analyze meeting sentiment | P0 |
| FR-166.7 | Extract key topics discussed | P1 |
| FR-166.8 | Identify concerns raised | P0 |
| FR-166.9 | Detect risk signals | P0 |
| FR-166.10 | Track sentiment trends | P1 |

### 5.3 Action Items

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-166.11 | Extract action items from meetings | P0 |
| FR-166.12 | Track action item completion | P0 |
| FR-166.13 | Measure follow-through rate | P0 |
| FR-166.14 | Alert on overdue items | P1 |

### 5.4 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-166.15 | Compare meeting patterns by segment | P1 |
| FR-166.16 | Correlate meetings with health/retention | P1 |
| FR-166.17 | Identify optimal meeting cadence | P2 |
| FR-166.18 | Benchmark against team averages | P1 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface MeetingRecord {
  id: string;
  customer_id: string;
  csm_id: string;

  // Meeting details
  title: string;
  meeting_type: 'qbr' | 'check_in' | 'kickoff' | 'training' | 'escalation' | 'other';
  scheduled_at: string;
  duration_minutes: number;
  occurred: boolean;

  // Participants
  internal_attendees: string[];
  external_attendees: string[];
  stakeholder_levels: string[];

  // Analysis (from transcript)
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentiment_score: number;
  key_topics: string[];
  concerns_raised: string[];
  risk_signals: string[];
  expansion_signals: string[];

  // Outcomes
  action_items: ActionItem[];
  commitments: Commitment[];
  follow_up_scheduled: boolean;
}

interface MeetingAnalytics {
  customer_id: string;
  period: string;

  volume: {
    total_meetings: number;
    total_duration_minutes: number;
    avg_duration_minutes: number;
    by_type: Record<string, number>;
  };

  sentiment: {
    avg_sentiment_score: number;
    positive_pct: number;
    negative_pct: number;
    trend: 'improving' | 'stable' | 'declining';
  };

  action_items: {
    total_created: number;
    completed: number;
    completion_rate: number;
    avg_completion_days: number;
  };

  engagement: {
    unique_stakeholders: number;
    executive_meetings: number;
    avg_attendees: number;
  };

  top_topics: { topic: string; count: number }[];
  recent_concerns: string[];
}
```

### 6.2 API Endpoints

```typescript
// Get meeting analytics
GET /api/reports/meeting-analytics
Query: {
  csm_id?: string;
  customer_id?: string;
  period?: string;
  meeting_type?: string;
}

Response: {
  summary: MeetingAnalyticsSummary;
  by_customer: CustomerMeetingStats[];
  trends: MeetingTrend[];
  insights: MeetingInsight[];
}

// Get customer meeting detail
GET /api/reports/meeting-analytics/:customerId
Response: {
  analytics: MeetingAnalytics;
  meetings: MeetingRecord[];
  action_items: ActionItem[];
}
```

---

## 7. User Interface

### 7.1 Meeting Dashboard

```
+----------------------------------------------------------+
|  Meeting Analytics                       [This Quarter v] |
+----------------------------------------------------------+
|                                                           |
|  PORTFOLIO SUMMARY                                        |
|  +----------------+----------------+----------------+     |
|  | Total Meetings | Total Time     | Avg Sentiment  |     |
|  |     186        |   124 hours    |    7.2/10      |     |
|  | +12 vs last Q  | +8 hours       | Stable         |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  BY MEETING TYPE                                          |
|  +--------------------------------------------------+    |
|  | Check-ins      | ████████████████████ | 98 (53%) |    |
|  | QBRs           | █████ | 24 (13%)                |    |
|  | Training       | ████ | 22 (12%)                 |    |
|  | Kickoffs       | ███ | 18 (10%)                  |    |
|  | Other          | ████ | 24 (13%)                 |    |
|  +--------------------------------------------------+    |
|                                                           |
|  SENTIMENT TREND                                          |
|  +--------------------------------------------------+    |
|  |  8|_____                  ___________             |    |
|  |  7|     \___    _________/                        |    |
|  |  6|         \__/                                  |    |
|  |   +------------------------------------------>   |    |
|  |    Jan Feb Mar Apr May Jun                       |    |
|  +--------------------------------------------------+    |
|                                                           |
|  ACTION ITEM FOLLOW-THROUGH                               |
|  +--------------------------------------------------+    |
|  | Created: 245 | Completed: 198 | Rate: 81%        |    |
|  | Avg completion: 4.2 days | Overdue: 12           |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Customer Meeting View

```
+----------------------------------------------------------+
|  Meetings: Acme Corp                                      |
+----------------------------------------------------------+
|                                                           |
|  MEETING SUMMARY (This Quarter)                           |
|  +--------------------------------------------------+    |
|  | Meetings: 8 | Total Time: 6.5 hours | Sentiment: 7.8|  |
|  +--------------------------------------------------+    |
|                                                           |
|  RECENT MEETINGS                                          |
|  +------------------------------------------------------+|
|  | Date    | Type     | Duration | Sentiment | Actions  ||
|  |---------|----------|----------|-----------|----------|
|  | Jan 25  | Check-in | 45 min   | Positive  | 3        ||
|  | Jan 10  | QBR      | 90 min   | Mixed     | 8        ||
|  | Dec 15  | Training | 60 min   | Positive  | 2        ||
|  +------------------------------------------------------+|
|                                                           |
|  KEY TOPICS DISCUSSED                                     |
|  +--------------------------------------------------+    |
|  | Renewal planning | ████████████ | 5 meetings     |    |
|  | Feature requests | ████████ | 4 meetings         |    |
|  | Support issues   | ████ | 3 meetings             |    |
|  | Expansion        | ███ | 2 meetings              |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CONCERNS RAISED (Last 90 Days)                           |
|  +--------------------------------------------------+    |
|  | - Reporting capabilities need improvement         |    |
|  | - Some users struggling with new interface        |    |
|  | - Would like more training resources              |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Researcher | Analyze meeting transcripts |
| Monitor | Track meeting patterns |
| Orchestrator | Generate meeting reports |

### 8.2 Natural Language Queries

```
"Show me meeting analytics for my accounts"
"What concerns have been raised in recent meetings?"
"How is meeting sentiment trending for Acme?"
"Which customers haven't had a meeting recently?"
"What's the action item completion rate?"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] Meetings are tracked with accurate data
- [ ] Sentiment analysis produces meaningful scores
- [ ] Action items are extracted and tracked
- [ ] Topics and concerns are categorized
- [ ] Trends display accurate historical data

### 9.2 Integration

- [ ] Calendar meetings sync automatically
- [ ] Transcript analysis runs post-meeting
- [ ] Action items link to task system

---

## 10. Test Cases

### TC-166.1: Meeting Tracking
```
Given: Customer with 8 meetings this quarter
When: Meeting analytics loads
Then: Shows 8 meetings with correct types
And: Total duration calculates accurately
```

### TC-166.2: Sentiment Analysis
```
Given: Meeting transcript with positive indicators
When: Sentiment is analyzed
Then: Sentiment = Positive
And: Score reflects conversation tone
```

### TC-166.3: Action Item Tracking
```
Given: 10 action items created, 8 completed
When: Completion rate is calculated
Then: Rate = 80%
And: 2 items shown as pending/overdue
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Action item completion | > 85% | Items completed / created |
| Avg sentiment score | > 7/10 | Portfolio average |
| Meeting coverage | 100% | Customers with regular meetings |
| Insight accuracy | > 90% | Validated topic extraction |

---

## 12. Dependencies

- Google Calendar integration
- Zoom/meeting recording integration
- PRD-213: AI Meeting Summarization
- Transcript analysis (meeting_analyses table)

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Analytics model, UI mockups |
| Backend | 2 weeks | Aggregations, analysis |
| Frontend | 1 week | Dashboard views |
| Testing | 1 week | Data accuracy, UAT |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. Should we differentiate internal vs. external meetings?
2. How do we handle meetings without transcripts?
3. What defines a "successful" meeting?
4. Should we track reschedules and cancellations?

---

## Appendix A: Meeting Type Definitions

| Type | Purpose | Expected Frequency |
|------|---------|-------------------|
| QBR | Quarterly business review | Quarterly |
| Check-in | Regular status update | Monthly |
| Training | Product education | As needed |
| Kickoff | New customer start | Once |
| Escalation | Issue resolution | As needed |
| Executive | Strategic alignment | Quarterly |
