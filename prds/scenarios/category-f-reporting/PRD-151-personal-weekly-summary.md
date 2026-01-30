# PRD-151: Personal Weekly Summary Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-151 |
| Title | Personal Weekly Summary Report |
| Category | F - Reporting & Analytics |
| Priority | P0 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Enable CSMs to receive an automated, personalized weekly summary report that consolidates all key activities, metrics, and action items from their portfolio. The report should be generated every Friday afternoon and delivered via email, with an option to view in-app.

---

## 2. Problem Statement

### Current Pain Points
- CSMs spend 2-3 hours weekly manually compiling their own activity summaries
- No centralized view of weekly accomplishments and pending tasks
- Difficult to track progress against weekly goals
- Managers lack visibility into CSM activities without manual check-ins
- Important customer events or changes may be missed in the noise

### Impact
- Lost productivity from manual report compilation
- Inconsistent tracking of customer health trends
- Missed escalation opportunities
- Poor visibility for leadership

---

## 3. Solution Overview

### High-Level Approach
Automatically aggregate data from all CSM activities, customer interactions, and system events into a comprehensive weekly digest that is both actionable and shareable.

### Key Features
1. **Portfolio Health Summary** - Overview of all customers with health score trends
2. **Activity Recap** - Emails sent, meetings held, tasks completed
3. **Risk Alerts** - New risks detected, unresolved escalations
4. **Renewal Pipeline** - Upcoming renewals and their status
5. **Expansion Updates** - New opportunities, pipeline changes
6. **Action Items** - Pending tasks and overdue items
7. **Wins & Highlights** - Positive outcomes and achievements

---

## 4. User Stories

### Primary User Stories

```
As a CSM,
I want to receive an automated weekly summary of my portfolio
So that I can stay on top of all customer activities without manual tracking
```

```
As a CSM Manager,
I want to view weekly summaries for my team members
So that I can understand workload distribution and identify coaching opportunities
```

```
As a CSM,
I want to customize which sections appear in my weekly summary
So that I can focus on the metrics most relevant to my role
```

### Secondary User Stories

```
As a CSM,
I want to compare this week's metrics to last week
So that I can track my progress over time
```

```
As a VP of Customer Success,
I want to see aggregated weekly summaries across all CSMs
So that I can monitor team performance
```

---

## 5. Functional Requirements

### 5.1 Report Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-151.1 | Generate weekly summary every Friday at 4:00 PM user's timezone | P0 |
| FR-151.2 | Include portfolio health overview with score distribution | P0 |
| FR-151.3 | Show week-over-week health score changes for each customer | P0 |
| FR-151.4 | List all meetings held with outcomes | P1 |
| FR-151.5 | Summarize emails sent and response rates | P1 |
| FR-151.6 | Highlight new risk signals detected | P0 |
| FR-151.7 | Show renewal pipeline status and changes | P0 |
| FR-151.8 | Include expansion opportunity updates | P1 |
| FR-151.9 | List completed tasks and pending action items | P0 |
| FR-151.10 | Calculate time allocation across activities | P2 |

### 5.2 Delivery Options

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-151.11 | Send report via email (HTML formatted) | P0 |
| FR-151.12 | Provide in-app viewing with interactive elements | P1 |
| FR-151.13 | Export to PDF option | P2 |
| FR-151.14 | Push to Slack channel option | P2 |
| FR-151.15 | Generate Google Slides summary | P2 |

### 5.3 Customization

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-151.16 | Allow section enable/disable preferences | P1 |
| FR-151.17 | Configure delivery time and timezone | P1 |
| FR-151.18 | Set threshold alerts (e.g., only show health drops > 10) | P2 |
| FR-151.19 | Choose comparison period (WoW, MoM) | P2 |

---

## 6. Technical Requirements

### 6.1 Data Sources

| Source | Data Points | Integration |
|--------|-------------|-------------|
| `customers` table | Health scores, ARR, stage | Direct query |
| `health_score_history` | Weekly trends | Aggregation query |
| `meetings` table | Meeting counts, outcomes | Direct query |
| `meeting_analyses` | Action items, sentiment | Join query |
| `agent_activity_log` | Email activities | Filtered query |
| `risk_signals` | Active risks | Filtered query |
| `renewal_pipeline` | Pipeline status | Direct query |
| `expansion_opportunities` | Opportunity data | Direct query |
| `approvals` table | Pending approvals | Filtered query |

### 6.2 API Endpoints

```typescript
// Generate weekly summary for a user
POST /api/reports/weekly-summary
{
  user_id: string;
  week_ending: string; // ISO date
  options?: {
    include_sections?: string[];
    comparison_period?: 'week' | 'month';
    delivery_method?: 'email' | 'slack' | 'in_app';
  }
}

// Get weekly summary history
GET /api/reports/weekly-summary/history
Query: user_id, limit, offset

// Update preferences
PUT /api/reports/weekly-summary/preferences
{
  delivery_time: string; // HH:mm
  timezone: string;
  sections: SectionConfig[];
  delivery_methods: string[];
}
```

### 6.3 Scheduled Jobs

```typescript
// Cron job configuration
{
  name: 'weekly-summary-generator',
  schedule: '0 16 * * 5', // Every Friday at 4 PM
  handler: 'generateWeeklySummaries',
  config: {
    batch_size: 50,
    timeout_ms: 300000,
    retry_count: 3
  }
}
```

### 6.4 Report Schema

```typescript
interface WeeklySummary {
  id: string;
  user_id: string;
  week_ending: string;
  generated_at: string;

  portfolio_summary: {
    total_customers: number;
    by_health: { healthy: number; at_risk: number; critical: number };
    total_arr: number;
    avg_health_score: number;
    health_trend: 'improving' | 'stable' | 'declining';
  };

  health_changes: {
    customer_id: string;
    customer_name: string;
    previous_score: number;
    current_score: number;
    change: number;
    trend: string;
  }[];

  activity_summary: {
    meetings_held: number;
    emails_sent: number;
    tasks_completed: number;
    calls_made: number;
    documents_created: number;
  };

  risk_summary: {
    new_risks: number;
    resolved_risks: number;
    active_critical: number;
    active_high: number;
  };

  renewal_summary: {
    upcoming_30_days: number;
    upcoming_90_days: number;
    arr_up_for_renewal: number;
    at_risk_renewals: number;
  };

  expansion_summary: {
    new_opportunities: number;
    pipeline_value: number;
    closed_won_value: number;
  };

  action_items: {
    overdue: ActionItem[];
    due_this_week: ActionItem[];
    pending_approvals: number;
  };

  highlights: {
    type: 'win' | 'milestone' | 'achievement';
    description: string;
    customer_name?: string;
  }[];
}
```

---

## 7. User Interface

### 7.1 In-App View

```
+----------------------------------------------------------+
|  Weekly Summary - Week of Jan 27, 2026                   |
+----------------------------------------------------------+
|                                                           |
|  PORTFOLIO HEALTH                          [Export PDF]   |
|  +------------------+------------------+                  |
|  | 12 Healthy       | 3 At Risk       |                  |
|  | 85% of portfolio | 15% of portfolio |                  |
|  +------------------+------------------+                  |
|                                                           |
|  HEALTH SCORE CHANGES                                     |
|  +-----------------------------------------------+        |
|  | Customer      | Last Week | This Week | Trend |        |
|  |---------------|-----------|-----------|-------|        |
|  | Acme Corp     |    72     |    65     |   -7  |        |
|  | TechStart Inc |    58     |    71     |  +13  |        |
|  +-----------------------------------------------+        |
|                                                           |
|  ACTIVITY THIS WEEK                                       |
|  +---------------------------------------------------+   |
|  | 8 Meetings | 24 Emails | 15 Tasks | 3 Documents   |   |
|  +---------------------------------------------------+   |
|                                                           |
|  RENEWALS COMING UP                                       |
|  +-----------------------------------------------+        |
|  | 2 renewals in next 30 days ($120K ARR)        |        |
|  | 5 renewals in next 90 days ($340K ARR)        |        |
|  +-----------------------------------------------+        |
|                                                           |
|  ACTION ITEMS                                             |
|  +-----------------------------------------------+        |
|  | ! 3 overdue tasks                              |        |
|  | > 7 tasks due this week                        |        |
|  | ? 2 pending approvals                          |        |
|  +-----------------------------------------------+        |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Email Template

```html
Subject: Your Weekly Summary - Week of {{week_ending}}

Hi {{csm_name}},

Here's your portfolio summary for the week:

PORTFOLIO HEALTH
- {{healthy_count}} healthy customers ({{healthy_pct}}%)
- {{at_risk_count}} at-risk customers ({{at_risk_pct}}%)
- Average health score: {{avg_health}}

KEY CHANGES THIS WEEK
{{#each health_changes}}
- {{customer_name}}: {{previous}} → {{current}} ({{change_direction}}{{change}})
{{/each}}

ACTIVITY SUMMARY
- Meetings: {{meetings_count}}
- Emails: {{emails_count}}
- Tasks completed: {{tasks_count}}

ATTENTION NEEDED
- {{overdue_tasks}} overdue tasks
- {{critical_risks}} critical risks
- {{pending_renewals}} renewals in next 30 days

[View Full Report]({{report_url}})
```

---

## 8. Integration Points

### 8.1 Google Workspace

| Integration | Usage |
|-------------|-------|
| Gmail | Send formatted email report |
| Docs | Generate detailed report document |
| Slides | Create presentation summary |
| Apps Script | Automate delivery via `weeklyDigest` script |

### 8.2 Slack

```typescript
// Slack message format
{
  channel: user_dm_channel,
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Weekly Summary - Week of Jan 27' }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Healthy Customers*\n12' },
        { type: 'mrkdwn', text: '*At-Risk*\n3' }
      ]
    },
    // ... additional blocks
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'View Full Report' }, url: report_url }
      ]
    }
  ]
}
```

---

## 9. Agent Integration

### 9.1 Involved Agents

| Agent | Role |
|-------|------|
| Orchestrator | Coordinate report generation |
| Monitor | Gather health and risk data |
| Researcher | Compile customer intelligence |

### 9.2 Natural Language Queries

```
"Generate my weekly summary"
"Show me my portfolio summary for last week"
"What happened with my accounts this week?"
"Compare this week to last week"
```

---

## 10. Acceptance Criteria

### 10.1 Core Functionality

- [ ] Weekly summary generates automatically every Friday at configured time
- [ ] Report includes all specified sections with accurate data
- [ ] Week-over-week comparisons are calculated correctly
- [ ] Email delivery works with proper formatting
- [ ] In-app view displays all data with correct layout

### 10.2 Data Accuracy

- [ ] Health scores match current customer records
- [ ] Activity counts match agent_activity_log entries
- [ ] Renewal dates align with renewal_pipeline
- [ ] Risk signals include all active, unresolved items

### 10.3 Customization

- [ ] Users can enable/disable sections
- [ ] Delivery time respects user timezone
- [ ] Threshold filters work correctly

---

## 11. Test Cases

### TC-151.1: Report Generation
```
Given: A CSM with 15 customers in their portfolio
When: The weekly summary job runs
Then: A report is generated with accurate data for all 15 customers
And: The report is delivered via the user's preferred method
```

### TC-151.2: Health Score Trends
```
Given: A customer whose health score changed from 80 to 65 this week
When: The weekly summary is generated
Then: The customer appears in the health changes section
And: Shows -15 decline with appropriate warning styling
```

### TC-151.3: Empty Week
```
Given: A CSM with no activities logged this week
When: The weekly summary is generated
Then: Report shows zero counts for activities
And: Includes message "No customer interactions this week"
```

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Report generation success rate | > 99% | Jobs completed / jobs scheduled |
| Email delivery rate | > 98% | Emails delivered / reports generated |
| User engagement | > 70% | Users opening reports weekly |
| Time saved per CSM | 2+ hours/week | Survey + activity tracking comparison |

---

## 13. Dependencies

- PRD-153: Health Score Portfolio View (for health data aggregation)
- PRD-164: At-Risk Accounts Report (for risk signal data)
- PRD-163: Renewal Forecast Report (for renewal pipeline data)
- Google Workspace integration (Gmail, Docs, Slides)
- Slack integration (optional delivery channel)

---

## 14. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | UI mockups, API spec |
| Backend | 2 weeks | Data aggregation, report generation |
| Frontend | 1 week | In-app view, preferences UI |
| Email Templates | 1 week | HTML templates, Slack blocks |
| Testing | 1 week | Integration tests, UAT |
| **Total** | **6 weeks** | |

---

## 15. Open Questions

1. Should managers receive a consolidated team summary in addition to individual reports?
2. What is the maximum number of customers to include in detailed health changes?
3. Should the report include AI-generated insights and recommendations?
4. How far back should comparison periods extend (current week vs. last week, last month, same week last year)?

---

## Appendix A: Data Model References

- `customers` - Customer records with health scores
- `health_score_history` - Historical health score tracking
- `agent_activity_log` - Activity records
- `meetings` - Meeting records
- `risk_signals` - Risk detection records
- `renewal_pipeline` - Renewal tracking
- `expansion_opportunities` - Expansion pipeline
