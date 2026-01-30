# PRD-217: Automated Insight Generation

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-217 |
| **Title** | Automated Insight Generation |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs have access to vast amounts of customer data but often miss important patterns and trends buried in the noise. Manually analyzing usage data, meeting notes, support tickets, and engagement metrics to surface actionable insights is time-prohibitive. AI should continuously analyze customer data and proactively surface relevant insights without requiring explicit queries.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to receive daily/weekly insights about my accounts without asking for them.
2. **As a CSM**, I want insights to highlight anomalies, trends, and opportunities I might miss.
3. **As a CSM**, I want each insight to include recommended actions.
4. **As a CSM**, I want to understand why an insight matters (so what?).
5. **As a CSM**, I want to dismiss irrelevant insights so the system learns my preferences.

### Secondary User Stories
1. **As a CSM Manager**, I want to see aggregated insights across the team.
2. **As a CSM**, I want to share interesting insights with colleagues.
3. **As a CS Leader**, I want insights that inform strategic decisions.

## Acceptance Criteria

### Core Functionality
- [ ] Automated daily insight generation for all accounts
- [ ] Insights categorized by type (opportunity, risk, trend, anomaly)
- [ ] Each insight includes explanation, evidence, and recommended action
- [ ] Priority scoring for insights (not all insights are equal)
- [ ] Dismiss/snooze functionality with feedback loop
- [ ] Daily digest email with top insights

### Insight Categories
- [ ] **Usage Insights**: Adoption trends, feature discovery, power users
- [ ] **Engagement Insights**: Communication patterns, meeting trends
- [ ] **Risk Insights**: Declining metrics, silent accounts, champion changes
- [ ] **Opportunity Insights**: Expansion signals, success stories, referral potential
- [ ] **Benchmark Insights**: Comparison to peers, industry standards
- [ ] **Timing Insights**: Optimal moments for outreach, QBR scheduling

## Technical Specification

### Insight Generation Pipeline

```
Data Collection → Pattern Detection → Insight Formulation → Relevance Scoring → Delivery
       ↓                  ↓                    ↓                    ↓
  [All sources]    [Anomaly detection]   [Claude narrative]  [Personalization]
                   [Trend analysis]
                   [Cohort comparison]
```

### Insight Types and Detection Logic

#### 1. Usage Anomaly Detection
```typescript
interface UsageAnomaly {
  type: 'spike' | 'drop' | 'pattern_change';
  metric: string;
  customer_id: string;
  baseline: number;
  current: number;
  deviation: number; // Standard deviations from baseline
  period: string;
}

function detectUsageAnomalies(customerId: string): UsageAnomaly[] {
  // Compare current period to rolling average
  // Flag deviations > 2 standard deviations
  // Consider day-of-week patterns
}
```

#### 2. Engagement Pattern Analysis
```typescript
interface EngagementInsight {
  type: 'going_dark' | 'increased_activity' | 'stakeholder_shift';
  customer_id: string;
  evidence: string[];
  days_since_contact: number;
  previous_cadence: number;
}
```

#### 3. Benchmark Comparison
```typescript
interface BenchmarkInsight {
  type: 'outperforming' | 'underperforming';
  customer_id: string;
  metric: string;
  customer_value: number;
  cohort_average: number;
  percentile: number;
}
```

### Insight Schema

```typescript
interface Insight {
  id: string;
  customer_id: string;
  category: 'usage' | 'engagement' | 'risk' | 'opportunity' | 'benchmark' | 'timing';
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  evidence: Evidence[];
  so_what: string;
  recommended_action: Action;
  expires_at: Date | null;
  created_at: Date;
  status: 'new' | 'viewed' | 'actioned' | 'dismissed' | 'snoozed';
}

interface Evidence {
  metric: string;
  value: string;
  comparison: string;
  source: string;
}

interface Action {
  type: string;
  description: string;
  quick_action_id?: string;
}
```

### AI Narrative Generation

For each detected pattern, generate human-readable insight:

```
Pattern Detected: TechCorp DAU dropped 35% week-over-week

AI Generates:
Title: "TechCorp Usage Dropped Significantly"
Summary: "Daily active users at TechCorp fell from 245 to 159 this week, a 35% decline. This is the steepest drop in the past 6 months."
Evidence: [DAU chart, comparison to baseline]
So What: "This kind of drop often precedes churn conversations. Similar accounts that experienced this level of decline churned 40% of the time within 90 days."
Recommended Action: "Schedule a check-in call to understand what changed. Consider positioning an enablement session."
```

### API Endpoints

#### GET /api/insights
```json
{
  "filters": {
    "customer_id": "optional",
    "category": "optional",
    "priority": "optional",
    "status": "optional"
  },
  "limit": 20,
  "offset": 0
}
```

Response:
```json
{
  "insights": [
    {
      "id": "insight-uuid",
      "customer_id": "uuid",
      "customer_name": "TechCorp Industries",
      "category": "risk",
      "priority": "high",
      "title": "Usage dropped 35% this week",
      "summary": "Daily active users fell from 245 to 159...",
      "evidence": [
        {
          "metric": "DAU",
          "value": "159",
          "comparison": "vs 245 last week (-35%)",
          "source": "usage_metrics"
        }
      ],
      "so_what": "Similar drops preceded churn 40% of the time",
      "recommended_action": {
        "type": "schedule_meeting",
        "description": "Schedule check-in call",
        "quick_action_id": "schedule_meeting"
      },
      "created_at": "2026-01-29T08:00:00Z"
    }
  ],
  "total": 45,
  "unread": 12
}
```

#### POST /api/insights/{id}/action
```json
{
  "action": "dismiss" | "snooze" | "actioned",
  "feedback": "not_relevant" | "already_knew" | "helpful" | "took_action",
  "snooze_until": "2026-02-05" // if snoozing
}
```

### Database Schema

```sql
CREATE TABLE insights (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  user_id TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(100) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence JSONB NOT NULL,
  so_what TEXT,
  recommended_action JSONB,
  status VARCHAR(20) DEFAULT 'new',
  feedback VARCHAR(50),
  snoozed_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ
);

CREATE INDEX idx_insights_user_status ON insights(user_id, status);
CREATE INDEX idx_insights_customer ON insights(customer_id);
CREATE INDEX idx_insights_priority ON insights(priority, created_at DESC);
```

## UI/UX Design

### Insights Feed
```
┌─────────────────────────────────────────────────────────┐
│ INSIGHTS                          [Mark All Read] 🔔 12 │
├─────────────────────────────────────────────────────────┤
│ Filter: [All ▼] [High Priority ▼] [This Week ▼]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚠️ HIGH PRIORITY                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔴 TechCorp usage dropped 35%            2h ago    │ │
│ │ Daily active users fell significantly this week.    │ │
│ │ This pattern often precedes churn.                  │ │
│ │                                                     │ │
│ │ [Schedule Check-In] [View Account] [Dismiss]        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🎯 OPPORTUNITIES                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 💡 Acme Corp hitting usage limits        Yesterday  │ │
│ │ Feature usage at 92% of entitlement. Strong        │ │
│ │ expansion signal - they may need more capacity.     │ │
│ │                                                     │ │
│ │ [Draft Expansion Email] [View Usage] [Snooze]       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📊 TRENDS                                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📈 GlobalCo adoption up 3rd week in a row  3d ago  │ │
│ │ Steady improvement since onboarding completion.     │ │
│ │ Good candidate for case study.                      │ │
│ │                                                     │ │
│ │ [Request Case Study] [Share With Team] [Dismiss]    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Daily Digest Email
```
Subject: Your Daily Customer Insights - Jan 29, 2026

Good morning! Here are today's top insights:

🔴 HIGH PRIORITY (2)
• TechCorp: Usage dropped 35% - Schedule check-in
• GlobalCo: Champion went silent - Re-engage

💡 OPPORTUNITIES (3)
• Acme Corp: Expansion signal detected
• StartupXYZ: Case study candidate
• MegaCorp: Referral opportunity

📊 TRENDS (5)
• 3 accounts improving adoption
• 2 accounts approaching renewal

[View All Insights in CSCX.AI]
```

## Dependencies

### Required Infrastructure
- Usage metrics pipeline
- Meeting analysis system
- Health score calculation
- Anomaly detection algorithms

### Related PRDs
- PRD-150: End of Day → Daily Summary
- PRD-057: "What Accounts Need Attention?" Briefing
- PRD-084: Usage Anomaly Detection

## Success Metrics

### Quantitative
- Insight relevance rate > 70% (not dismissed)
- Action rate > 40% (insights lead to action)
- Early detection: Insights surface 30+ days before issues
- CSM time saved: 2+ hours/week from proactive insights

### Qualitative
- CSMs find insights valuable and actionable
- Insights catch things CSMs would have missed
- "So what" explanations resonate with CSMs

## Rollout Plan

### Phase 1: Basic Insights (Week 1-2)
- Usage anomaly detection
- Simple trend detection
- Basic UI feed

### Phase 2: Rich Insights (Week 3-4)
- AI-generated narratives
- Benchmark comparisons
- Recommended actions

### Phase 3: Personalization (Week 5-6)
- Feedback loop implementation
- Priority tuning
- Daily digest email

### Phase 4: Advanced (Week 7-8)
- Cross-account pattern detection
- Manager rollup views
- Insight sharing

## Open Questions
1. How many insights per day is optimal (not overwhelming)?
2. Should insights expire if not acted upon?
3. How do we balance sensitivity vs noise in anomaly detection?
4. Should we surface team-level insights to managers only?
