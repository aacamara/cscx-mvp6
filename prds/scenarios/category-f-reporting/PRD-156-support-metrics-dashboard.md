# PRD-156: Support Metrics Dashboard

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-156 |
| Title | Support Metrics Dashboard |
| Category | F - Reporting & Analytics |
| Priority | P1 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create a comprehensive support metrics dashboard that provides CSMs with visibility into their customers' support health, including ticket volumes, resolution times, satisfaction scores, and escalation patterns. This enables proactive engagement before support issues impact customer health.

---

## 2. Problem Statement

### Current Pain Points
- CSMs lack visibility into customer support interactions
- No early warning when support issues are escalating
- Cannot correlate support patterns with customer health
- Missing context for customer conversations
- Reactive approach to support-related churn risks

### Impact
- Surprised by customer dissatisfaction during renewals
- Missed opportunities to intervene on escalations
- Inability to track support's impact on customer success
- Lack of data for support-related QBR discussions

---

## 3. Solution Overview

### High-Level Approach
Build a CSM-focused support dashboard that aggregates support data per customer, identifies patterns, and surfaces actionable insights for proactive customer engagement.

### Key Features
1. **Customer Support Overview** - Ticket volumes and trends per customer
2. **SLA Tracking** - Response and resolution time performance
3. **Escalation Monitoring** - Track escalated tickets
4. **Satisfaction Scores** - CSAT/support NPS per customer
5. **Pattern Detection** - Identify recurring issues
6. **Correlation Analysis** - Link support to health/churn
7. **Alerting** - Notify on support anomalies

---

## 4. User Stories

### Primary User Stories

```
As a CSM,
I want to see all support tickets for my customers
So that I can stay informed about their technical challenges
```

```
As a CSM,
I want to be alerted when a customer's support tickets spike
So that I can proactively reach out
```

```
As a CSM Manager,
I want to see support metrics across my team's portfolio
So that I can identify customers needing additional attention
```

### Secondary User Stories

```
As a CSM,
I want to see support satisfaction trends
So that I can address dissatisfaction before renewals
```

```
As a VP of CS,
I want to correlate support metrics with churn
So that I can quantify support's impact on retention
```

---

## 5. Functional Requirements

### 5.1 Ticket Visibility

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-156.1 | Display open tickets per customer | P0 |
| FR-156.2 | Show ticket volume trends (weekly/monthly) | P0 |
| FR-156.3 | Categorize tickets by type/priority | P0 |
| FR-156.4 | Link to ticket details in support system | P1 |
| FR-156.5 | Show ticket age and status | P0 |

### 5.2 SLA Metrics

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-156.6 | Track first response time | P0 |
| FR-156.7 | Track resolution time | P0 |
| FR-156.8 | Calculate SLA compliance rate | P0 |
| FR-156.9 | Compare to benchmark/target | P1 |
| FR-156.10 | Highlight SLA breaches | P0 |

### 5.3 Satisfaction Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-156.11 | Display CSAT scores per ticket | P0 |
| FR-156.12 | Calculate average CSAT per customer | P0 |
| FR-156.13 | Track CSAT trends over time | P1 |
| FR-156.14 | Highlight low satisfaction customers | P0 |
| FR-156.15 | Show response rate to CSAT surveys | P2 |

### 5.4 Escalations

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-156.16 | Track escalated tickets | P0 |
| FR-156.17 | Record escalation reasons | P1 |
| FR-156.18 | Calculate escalation rate per customer | P0 |
| FR-156.19 | Alert on new escalations | P0 |
| FR-156.20 | Show escalation resolution status | P1 |

### 5.5 Pattern Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-156.21 | Identify recurring issue categories | P1 |
| FR-156.22 | Detect ticket volume anomalies | P0 |
| FR-156.23 | Correlate support with health score | P1 |
| FR-156.24 | Identify training needs from tickets | P2 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface SupportTicket {
  ticket_id: string;
  customer_id: string;

  // Ticket details
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'pending' | 'resolved' | 'closed';

  // Timestamps
  created_at: string;
  first_response_at?: string;
  resolved_at?: string;
  closed_at?: string;

  // SLA
  sla_first_response_target: number; // hours
  sla_resolution_target: number; // hours
  sla_first_response_met: boolean;
  sla_resolution_met: boolean;

  // Satisfaction
  csat_score?: number;
  csat_feedback?: string;

  // Escalation
  is_escalated: boolean;
  escalation_reason?: string;
  escalation_level?: number;

  // Source
  source_system: string;
  external_id: string;
}

interface CustomerSupportMetrics {
  customer_id: string;
  period: string;

  tickets: {
    total: number;
    open: number;
    resolved: number;
    by_priority: Record<string, number>;
    by_category: Record<string, number>;
  };

  sla: {
    first_response_met_pct: number;
    resolution_met_pct: number;
    avg_first_response_hours: number;
    avg_resolution_hours: number;
  };

  satisfaction: {
    avg_csat: number;
    csat_responses: number;
    trend: 'improving' | 'stable' | 'declining';
  };

  escalations: {
    total: number;
    open: number;
    rate: number;
  };
}
```

### 6.2 API Endpoints

```typescript
// Get support metrics for customer
GET /api/reports/support-metrics/:customerId
Query: { period?: string }

Response: {
  customer: CustomerSupportMetrics;
  tickets: SupportTicket[];
  trends: TrendData[];
  alerts: SupportAlert[];
}

// Get portfolio support overview
GET /api/reports/support-metrics
Query: {
  csm_id?: string;
  period?: string;
  min_tickets?: number;
  max_csat?: number;
}

Response: {
  summary: PortfolioSupportSummary;
  customers: CustomerSupportSummary[];
  alerts: SupportAlert[];
}

// Get support-health correlation
GET /api/reports/support-metrics/correlation
Query: { period: string }
```

### 6.3 Integration Points

| System | Integration Type | Data Synced |
|--------|------------------|-------------|
| Zendesk | API | Tickets, CSAT |
| Intercom | API | Conversations |
| Freshdesk | API | Tickets |
| Salesforce Service | API | Cases |
| Custom webhook | Inbound | Events |

---

## 7. User Interface

### 7.1 Portfolio Support Overview

```
+----------------------------------------------------------+
|  Support Metrics Dashboard               [This Month v]   |
+----------------------------------------------------------+
|                                                           |
|  PORTFOLIO SUMMARY                                        |
|  +----------------+----------------+----------------+     |
|  | Open Tickets   | Avg CSAT       | Escalations    |     |
|  |      47        |    4.2/5       |       5        |     |
|  | +12 vs last wk | -0.3 vs target | +2 this week   |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  CUSTOMERS NEEDING ATTENTION                  [View All]  |
|  +--------------------------------------------------+    |
|  | ! Acme Corp - 12 open tickets, CSAT: 3.1         |    |
|  | ! TechStart - Escalation pending 3 days          |    |
|  | ! DataFlow - Ticket spike (+300% this week)      |    |
|  +--------------------------------------------------+    |
|                                                           |
|  SLA PERFORMANCE                                          |
|  +--------------------------------------------------+    |
|  | First Response | ████████████████████ | 94%       |    |
|  | Resolution     | ██████████████████   | 87%       |    |
|  |                | Target: 90%                      |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Customer Support Detail

```
+----------------------------------------------------------+
|  Support Metrics: Acme Corp                               |
+----------------------------------------------------------+
|                                                           |
|  CURRENT STATUS                                           |
|  +----------------+----------------+----------------+     |
|  | Open Tickets   | Avg Resolution | CSAT Score     |     |
|  |      12        |   18 hours     |     3.1/5      |     |
|  | 3 high priority| SLA: 85% met   | Trend: ↓       |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  OPEN TICKETS                                             |
|  +------------------------------------------------------+|
|  | ID     | Subject              | Priority | Age  | SLA ||
|  |--------|----------------------|----------|------|-----||
|  | #4521  | Login issues         | High     | 2d   | ⚠  ||
|  | #4518  | Export not working   | High     | 3d   | ⚠  ||
|  | #4510  | Performance slow     | Medium   | 5d   | ✓  ||
|  | #4498  | Feature question     | Low      | 7d   | ✓  ||
|  +------------------------------------------------------+|
|                                                           |
|  TICKET VOLUME TREND (12 weeks)                           |
|  +--------------------------------------------------+    |
|  | 15|            *                                  |    |
|  | 10|    *   *       *   *                 *       |    |
|  |  5|*       *   *       *   *   *   *   *   *     |    |
|  |   +----------------------------------------->    |    |
|  +--------------------------------------------------+    |
|                                                           |
|  TOP ISSUE CATEGORIES                                     |
|  +--------------------------------------------------+    |
|  | Performance  | █████████████ | 35%                |    |
|  | Integration  | ████████ | 22%                     |    |
|  | How-to       | ██████ | 18%                       |    |
|  | Bug Report   | █████ | 15%                        |    |
|  | Other        | ████ | 10%                         |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Monitor | Track support metrics and anomalies |
| Researcher | Analyze support patterns |
| Orchestrator | Generate support reports |

### 8.2 Natural Language Queries

```
"Show me support metrics for Acme Corp"
"Which customers have low CSAT scores?"
"Are there any escalated tickets?"
"What are the top support issues this month?"
"Show customers with ticket spikes"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] All customer tickets display with status and details
- [ ] SLA metrics calculate correctly
- [ ] CSAT scores aggregate and trend properly
- [ ] Escalations are flagged and tracked
- [ ] Alerts trigger on defined thresholds

### 9.2 Data Accuracy

- [ ] Ticket sync is near real-time (< 15 min delay)
- [ ] Historical data preserves for trend analysis
- [ ] SLA calculations match support system

---

## 10. Test Cases

### TC-156.1: Ticket Display
```
Given: Customer has 12 open tickets in support system
When: Support dashboard loads
Then: Shows 12 open tickets
And: Displays priority, status, and age for each
```

### TC-156.2: CSAT Calculation
```
Given: Customer has 10 tickets with CSAT: [5,4,4,3,5,4,3,2,4,5]
When: CSAT is calculated
Then: Shows average of 3.9/5
And: Trend compared to previous period
```

### TC-156.3: Spike Alert
```
Given: Customer normally has 3 tickets/week, this week has 12
When: Anomaly detection runs
Then: Alert generated for 300% spike
And: Customer flagged in "Attention Needed"
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| CSM awareness | 80% | CSMs checking support dashboard weekly |
| Proactive outreach | +50% | Outreach before support impacts renewal |
| Escalation awareness | 100% | CSMs notified within 1 hour |
| Support-health correlation | Documented | Quantified relationship |

---

## 12. Dependencies

- Support system integration (Zendesk, Intercom, etc.)
- PRD-184: Zendesk Ticket Integration
- PRD-185: Intercom Conversation Sync
- Customer record linking (email matching)

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | UI mockups, data model |
| Integration | 2 weeks | Support system connectors |
| Backend | 2 weeks | Metrics calculation, alerts |
| Frontend | 1 week | Dashboard views |
| Testing | 1 week | Integration tests, UAT |
| **Total** | **7 weeks** | |

---

## 14. Open Questions

1. Which support systems should we integrate first?
2. How do we match tickets to customers (email, account ID)?
3. Should we pull ticket content or just metadata?
4. What thresholds define "spike" or "low CSAT"?

---

## Appendix A: SLA Benchmarks

| Priority | First Response Target | Resolution Target |
|----------|----------------------|-------------------|
| Critical | 1 hour | 4 hours |
| High | 4 hours | 24 hours |
| Medium | 8 hours | 48 hours |
| Low | 24 hours | 72 hours |
