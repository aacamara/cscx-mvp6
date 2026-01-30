# PRD-167: Email Performance Report

## Document Information
| Field | Value |
|-------|-------|
| PRD ID | PRD-167 |
| Title | Email Performance Report |
| Category | F - Reporting & Analytics |
| Priority | P2 |
| Status | Draft |
| Created | 2026-01-29 |
| Author | CSCX.AI Team |

---

## 1. Summary

Create an email performance report that tracks email outreach effectiveness, response rates, and engagement patterns. This enables CSMs to optimize their communication strategies and improve customer responsiveness.

---

## 2. Problem Statement

### Current Pain Points
- No visibility into email response rates
- Cannot measure effectiveness of different email types
- Missing insights on optimal send times
- Difficult to identify unresponsive customers
- No benchmarks for email engagement

### Impact
- Ineffective email strategies
- Wasted effort on non-engaging outreach
- Missed opportunities from poor timing
- Inability to improve communication

---

## 3. Solution Overview

### High-Level Approach
Build an email analytics system that tracks all customer email interactions, measures engagement, and provides actionable insights for communication optimization.

### Key Features
1. **Volume Tracking** - Email sent/received counts
2. **Response Metrics** - Response rates and times
3. **Template Performance** - Effectiveness by type
4. **Timing Analysis** - Optimal send windows
5. **Engagement Trends** - Response patterns over time
6. **Unresponsive Detection** - Flag non-engaging contacts
7. **Recommendations** - Improve outreach effectiveness

---

## 4. User Stories

### Primary User Stories

```
As a CSM,
I want to see email response rates by customer
So that I can adjust my communication approach
```

```
As a CSM Manager,
I want to understand email effectiveness across my team
So that I can share best practices
```

```
As a CSM,
I want to know the best times to send emails
So that I can improve response rates
```

---

## 5. Functional Requirements

### 5.1 Email Tracking

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-167.1 | Track emails sent per customer | P0 |
| FR-167.2 | Track emails received from customers | P0 |
| FR-167.3 | Categorize emails by type/purpose | P1 |
| FR-167.4 | Track email threads | P0 |
| FR-167.5 | Record send/receive timestamps | P0 |

### 5.2 Response Metrics

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-167.6 | Calculate response rate | P0 |
| FR-167.7 | Measure average response time | P0 |
| FR-167.8 | Track non-responsive contacts | P0 |
| FR-167.9 | Compare response by email type | P1 |
| FR-167.10 | Show response trends | P1 |

### 5.3 Analysis

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-167.11 | Analyze optimal send times | P1 |
| FR-167.12 | Compare performance by day of week | P1 |
| FR-167.13 | Benchmark against team averages | P1 |
| FR-167.14 | Correlate email engagement with health | P2 |

---

## 6. Technical Requirements

### 6.1 Data Model

```typescript
interface EmailRecord {
  id: string;
  thread_id: string;
  customer_id: string;
  csm_id: string;

  direction: 'sent' | 'received';
  sender: string;
  recipients: string[];

  subject: string;
  email_type: EmailType;

  sent_at: string;
  day_of_week: number;
  hour_of_day: number;

  // Response tracking
  responded: boolean;
  response_time_hours?: number;
}

enum EmailType {
  CHECK_IN = 'check_in',
  QBR_INVITE = 'qbr_invite',
  RENEWAL = 'renewal',
  ONBOARDING = 'onboarding',
  FOLLOW_UP = 'follow_up',
  PRODUCT_UPDATE = 'product_update',
  ESCALATION = 'escalation',
  OTHER = 'other'
}

interface EmailMetrics {
  customer_id: string;
  period: string;

  volume: {
    sent: number;
    received: number;
    threads: number;
  };

  response: {
    rate: number;
    avg_response_hours: number;
    median_response_hours: number;
    unanswered: number;
  };

  by_type: {
    type: EmailType;
    sent: number;
    response_rate: number;
  }[];

  timing: {
    best_day: string;
    best_hour: number;
    worst_day: string;
  };
}
```

### 6.2 API Endpoints

```typescript
// Get email performance report
GET /api/reports/email-performance
Query: {
  csm_id?: string;
  customer_id?: string;
  period?: string;
  email_type?: EmailType;
}

Response: {
  summary: EmailPerformanceSummary;
  by_customer: CustomerEmailStats[];
  by_type: TypePerformance[];
  timing_analysis: TimingAnalysis;
  unresponsive: UnresponsiveContact[];
}

// Get customer email detail
GET /api/reports/email-performance/:customerId
Response: {
  metrics: EmailMetrics;
  recent_threads: EmailThread[];
  contacts: ContactEngagement[];
}
```

---

## 7. User Interface

### 7.1 Email Dashboard

```
+----------------------------------------------------------+
|  Email Performance Report                [This Month v]   |
+----------------------------------------------------------+
|                                                           |
|  PORTFOLIO SUMMARY                                        |
|  +----------------+----------------+----------------+     |
|  | Emails Sent    | Response Rate  | Avg Response   |     |
|  |     524        |     68%        |   18.5 hours   |     |
|  | +15% vs last mo| +5% vs last mo | -2 hrs         |     |
|  +----------------+----------------+----------------+     |
|                                                           |
|  RESPONSE RATE BY EMAIL TYPE                              |
|  +--------------------------------------------------+    |
|  | Escalation      | ██████████████████ | 92%       |    |
|  | QBR Invite      | ████████████████ | 78%         |    |
|  | Renewal         | ██████████████ | 72%           |    |
|  | Check-in        | ████████████ | 65%             |    |
|  | Product Update  | ██████████ | 52%               |    |
|  | Follow-up       | ████████ | 45%                 |    |
|  +--------------------------------------------------+    |
|                                                           |
|  BEST SEND TIMES                                          |
|  +--------------------------------------------------+    |
|  | Day: Tuesday (74% response)                       |    |
|  | Time: 9-11 AM (72% response)                      |    |
|  | Avoid: Friday PM, Monday AM                       |    |
|  +--------------------------------------------------+    |
|                                                           |
|  UNRESPONSIVE CONTACTS (>3 emails, no reply)              |
|  +--------------------------------------------------+    |
|  | ! Tom Davis (DataFlow) - 5 emails, 0 replies     |    |
|  | ! Lisa Wong (CloudNine) - 4 emails, 0 replies    |    |
|  | ! Mike Chen (TechStart) - 3 emails, 0 replies    |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

### 7.2 Customer Email View

```
+----------------------------------------------------------+
|  Email Performance: Acme Corp                             |
+----------------------------------------------------------+
|                                                           |
|  EMAIL METRICS                                            |
|  +--------------------------------------------------+    |
|  | Sent: 24 | Received: 18 | Response Rate: 75%     |    |
|  | Avg Response: 12.5 hours | Threads: 15           |    |
|  +--------------------------------------------------+    |
|                                                           |
|  CONTACT ENGAGEMENT                                       |
|  +------------------------------------------------------+|
|  | Contact       | Emails | Response | Avg Time        ||
|  |---------------|--------|----------|-----------------|
|  | Sarah Chen    | 12     | 85%      | 8 hours         ||
|  | Mike Johnson  | 8      | 65%      | 24 hours        ||
|  | Tom Davis     | 4      | 50%      | 48 hours        ||
|  +------------------------------------------------------+|
|                                                           |
|  RESPONSE TREND (12 Weeks)                                |
|  +--------------------------------------------------+    |
|  | 80%|          ___                                 |    |
|  | 70%|___      /   \___    ___                     |    |
|  | 60%|   \___/          \__/   \___                |    |
|  |    +------------------------------------------>  |    |
|  +--------------------------------------------------+    |
|                                                           |
|  RECENT THREADS                                           |
|  +--------------------------------------------------+    |
|  | Jan 25 | Re: QBR Scheduling | Replied (2 hrs)    |    |
|  | Jan 22 | Product Update | No reply               |    |
|  | Jan 18 | Follow-up: Action Items | Replied (12h) |    |
|  | Jan 15 | Renewal Discussion | Replied (4 hrs)    |    |
|  +--------------------------------------------------+    |
|                                                           |
+----------------------------------------------------------+
```

---

## 8. Agent Integration

### 8.1 Involved Agents

| Agent | Role |
|-------|------|
| Communicator | Track email activities |
| Monitor | Measure response patterns |
| Researcher | Analyze effectiveness |

### 8.2 Natural Language Queries

```
"What's my email response rate?"
"Which customers aren't responding to emails?"
"What's the best time to send emails?"
"Compare email performance across my accounts"
"Show me unresponsive contacts"
```

---

## 9. Acceptance Criteria

### 9.1 Core Functionality

- [ ] All sent/received emails are tracked
- [ ] Response rates calculate correctly
- [ ] Response times are accurate
- [ ] Email types are categorized
- [ ] Timing analysis is data-driven

### 9.2 Integration

- [ ] Gmail sync captures all customer emails
- [ ] Thread tracking links related messages
- [ ] Contact attribution is accurate

---

## 10. Test Cases

### TC-167.1: Response Rate
```
Given: 20 emails sent, 14 received replies
When: Response rate is calculated
Then: Rate = 70%
And: 6 shown as unanswered
```

### TC-167.2: Timing Analysis
```
Given: 100 emails with varying send times
When: Timing analysis runs
Then: Best day/time identified
And: Based on actual response data
```

### TC-167.3: Type Performance
```
Given: QBR invites have 80% response, check-ins have 50%
When: Type comparison is generated
Then: QBR invites shown as most effective
And: Recommendations suggest emphasis
```

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Response rate | > 65% | Portfolio average |
| Avg response time | < 24 hours | Time to first reply |
| Unresponsive contacts | < 10% | Contacts with no replies |
| Timing optimization | +10% | Improvement from timing |

---

## 12. Dependencies

- Gmail integration
- Email thread tracking
- Contact record linking
- PRD-157: Engagement Metrics Report

---

## 13. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Design | 1 week | Metrics model, UI mockups |
| Backend | 2 weeks | Tracking, calculations |
| Frontend | 1 week | Dashboard views |
| Testing | 1 week | Data accuracy |
| **Total** | **5 weeks** | |

---

## 14. Open Questions

1. How do we handle mass emails vs. personalized?
2. Should we track open rates (requires tracking pixels)?
3. How do we attribute shared inbox emails?
4. What defines "unresponsive" (# emails, time)?

---

## Appendix A: Email Type Best Practices

| Type | Best Day | Best Time | Expected Response |
|------|----------|-----------|-------------------|
| QBR Invite | Tuesday | 10 AM | 75-85% |
| Check-in | Wednesday | 9 AM | 60-70% |
| Renewal | Monday | 11 AM | 70-80% |
| Escalation | Any | Any | 90%+ |
| Product Update | Thursday | 2 PM | 40-50% |
