# PRD-087: Support Ticket Spike - Escalation

## Metadata
- **PRD ID**: PRD-087
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Support Ticket Integration, Trigger Engine, Risk Signal System

---

## 1. Overview

### 1.1 Problem Statement
When a customer experiences a sudden spike in support tickets, it often indicates a significant product issue, training gap, or widespread user frustration. CSMs typically learn about these spikes reactively, often after the customer has already escalated or expressed dissatisfaction. This delay damages the customer relationship and reduces the chance of successful resolution.

### 1.2 Solution Summary
Implement an automated alert system that detects unusual spikes in support ticket volume and triggers an immediate escalation workflow. The system analyzes ticket patterns, categorizes the issue type, notifies the CSM and relevant stakeholders, and initiates appropriate intervention steps.

### 1.3 Success Metrics
- Detect support spikes within 2 hours of pattern emergence
- Reduce customer-initiated escalations by 50%
- Improve first-call resolution rate on spike-related issues by 30%
- Decrease average time-to-resolution for spiked accounts by 40%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be immediately alerted when a customer has an unusual spike in support tickets
**So that** I can proactively coordinate with support and reach out to the customer before they escalate

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want to see a summary of the ticket themes (common issues, affected features), so I can quickly understand the problem scope.

**US-3**: As a CS Manager, I want escalation alerts to be routed to the appropriate team based on ticket categories (technical, billing, training), so the right resources are engaged.

**US-4**: As a Support Lead, I want visibility into CSM-flagged accounts with support spikes, so I can prioritize those tickets appropriately.

**US-5**: As a CSM, I want the system to automatically draft an empathetic outreach email acknowledging the issues, so I can quickly reach out to the customer.

---

## 3. Functional Requirements

### 3.1 Spike Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Monitor ticket creation rate per customer (tickets/hour, tickets/day) | Must |
| FR-1.2 | Detect spikes: >3x baseline ticket rate within 24 hours | Must |
| FR-1.3 | Calculate baseline from rolling 30-day average ticket rate | Must |
| FR-1.4 | Account for customer size (larger customers have higher normal rates) | Should |
| FR-1.5 | Categorize tickets by type: technical, billing, training, feature request | Should |
| FR-1.6 | Identify common themes using AI text analysis | Should |
| FR-1.7 | Track ticket severity distribution (P1, P2, P3, P4) | Must |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create risk_signal with type "ticket_spike" and severity based on magnitude | Must |
| FR-2.2 | Severity: 3-5x baseline = high, >5x baseline = critical | Must |
| FR-2.3 | Include spike metrics: count, baseline, percentage increase, affected period | Must |
| FR-2.4 | Include ticket breakdown by category and severity | Must |
| FR-2.5 | Link to affected tickets in support system | Should |

### 3.3 Escalation Workflow

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Immediately notify assigned CSM via Slack with spike details | Must |
| FR-3.2 | Create high-priority task for CSM review | Must |
| FR-3.3 | Notify CS Manager if spike is critical severity | Must |
| FR-3.4 | Draft acknowledgment email to customer champion | Must |
| FR-3.5 | Create internal Slack thread for coordination | Should |
| FR-3.6 | Add to escalation dashboard/war room (if active) | Should |
| FR-3.7 | Schedule internal sync if multiple P1 tickets | Could |

### 3.4 Routing Logic

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-4.1 | Route technical issues to Support Lead + Product team | Must |
| FR-4.2 | Route billing issues to Finance + CSM | Must |
| FR-4.3 | Route training issues to CSM + Enablement team | Should |
| FR-4.4 | Allow custom routing rules per organization | Could |

---

## 4. Technical Specifications

### 4.1 Data Model Changes

```sql
-- Ticket data can be stored or synced from external systems
-- For MVP, assume external support system provides webhook on ticket creation

-- New risk_signal.signal_type value: 'ticket_spike'
-- Metadata structure for ticket_spike:
{
  "ticket_count": 15,
  "baseline_daily_avg": 2.3,
  "spike_multiplier": 6.5,
  "period_hours": 24,
  "ticket_breakdown": {
    "technical": 10,
    "billing": 2,
    "training": 3
  },
  "severity_breakdown": {
    "P1": 3,
    "P2": 7,
    "P3": 5
  },
  "common_themes": ["API errors", "login issues"],
  "ticket_ids": ["TKT-001", "TKT-002", ...]
}
```

### 4.2 API Endpoints

```typescript
// Webhook receiver for support ticket events
POST /api/webhooks/support/ticket
Body: {
  ticketId: string,
  customerId: string,
  category: string,
  severity: string,
  subject: string,
  createdAt: string
}

// Manual spike check
POST /api/support/check-spike
Body: { customerId: string }

// Get ticket summary for customer
GET /api/support/summary/:customerId
Response: {
  recentTickets: Ticket[],
  baseline: number,
  currentRate: number,
  isSpike: boolean,
  themes: string[]
}
```

### 4.3 Detection Algorithm

```typescript
interface SpikeDetectionParams {
  customerId: string;
  lookbackHours: number; // default 24
  baselineDays: number; // default 30
  spikeThreshold: number; // default 3.0 (3x multiplier)
}

async function detectTicketSpike(params: SpikeDetectionParams): Promise<SpikeResult> {
  // 1. Get recent tickets in lookback window
  const recentTickets = await getTickets(params.customerId, params.lookbackHours);

  // 2. Calculate baseline from historical data
  const baseline = await calculateBaseline(params.customerId, params.baselineDays);

  // 3. Normalize for time window
  const normalizedCurrent = recentTickets.length / (params.lookbackHours / 24);
  const multiplier = normalizedCurrent / baseline;

  // 4. Determine if spike exists
  const isSpike = multiplier >= params.spikeThreshold;

  // 5. Analyze themes if spike detected
  const themes = isSpike ? await analyzeTicketThemes(recentTickets) : [];

  return {
    isSpike,
    ticketCount: recentTickets.length,
    baseline,
    multiplier,
    severity: multiplier > 5 ? 'critical' : multiplier > 3 ? 'high' : 'medium',
    themes,
    tickets: recentTickets
  };
}
```

### 4.4 Workflow Definition

```yaml
workflow: support_spike_escalation
version: 1.0
trigger:
  type: risk_signal_created
  filter:
    signal_type: ticket_spike

steps:
  - id: notify_csm
    action: slack_dm
    config:
      message_template: "support_spike_alert"
      urgency: high
      include_quick_actions: true

  - id: notify_manager
    condition: "{{severity}} == 'critical'"
    action: slack_dm
    config:
      recipient: "{{customer.csm.manager_id}}"
      message_template: "support_spike_manager_alert"

  - id: create_coordination_thread
    action: slack_channel_post
    config:
      channel: "#cs-escalations"
      message_template: "support_spike_coordination"
      create_thread: true

  - id: create_task
    action: create_task
    config:
      title: "URGENT: Support spike for {{customer.name}} - {{ticket_count}} tickets"
      due_date_offset_hours: 4
      priority: critical

  - id: draft_acknowledgment
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: support_spike_acknowledgment
        requires_approval: true

  - id: update_health_score
    action: update_health_score
    config:
      adjustment: -15
      reason: "Support ticket spike detected"
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:rotating_light: SUPPORT SPIKE ALERT: TechCorp Inc

15 tickets in last 24 hours (6.5x normal rate)

Ticket Breakdown:
- Technical: 10 (67%)
- Billing: 2 (13%)
- Training: 3 (20%)

Severity: 3 P1, 7 P2, 5 P3

Common Themes: API errors, login issues

Customer: TechCorp Inc
ARR: $500,000
Health Score: 52 (was 78)
CSM: Mike Johnson

[View Tickets] [Draft Response] [Start War Room] [View Customer]
```

### 5.2 Customer Detail Alert Banner

When active support spike exists, show prominent banner:
- Red alert bar at top of customer detail
- Ticket count and trend
- Link to view all tickets
- Quick action: "Address Spike"

### 5.3 Escalation Dashboard Entry

Card showing:
- Customer name and logo
- Spike status and severity
- Time since detection
- Actions taken
- Resolution progress

---

## 6. Integration Points

### 6.1 Required Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| Support System (Zendesk/Intercom) | Ticket data source | Needed |
| Slack | Alerts and coordination | Implemented |
| Gmail | Customer acknowledgment | Implemented |
| Supabase | Alert and task storage | Implemented |

### 6.2 Support System Webhooks

Configure webhooks from support system:
- `ticket.created` - New ticket opened
- `ticket.updated` - Ticket status/priority changed
- `ticket.resolved` - Ticket closed

---

## 7. Testing Requirements

### 7.1 Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| Normal ticket rate | 2 tickets/day (baseline 2) | No alert |
| Moderate spike | 8 tickets/day (4x baseline) | High severity alert |
| Severe spike | 15 tickets/day (7.5x baseline) | Critical alert + manager notification |
| New customer (no baseline) | 5 tickets first week | Use industry baseline for comparison |
| Weekend tickets | Spike on Saturday | Alert still fires (no weekend suppression) |

### 7.2 Integration Tests
- Webhook receipt and processing
- Slack notification delivery
- Email draft creation
- Health score update

---

## 8. Rollout Plan

### Phase 1: Detection Infrastructure (Week 1)
- Implement webhook receiver for support tickets
- Build spike detection algorithm
- Create risk_signal records

### Phase 2: Basic Alerting (Week 2)
- Slack notifications to CSMs
- Task creation automation
- Basic routing logic

### Phase 3: Advanced Features (Week 3)
- Theme analysis with AI
- Manager escalation path
- Coordination thread creation

### Phase 4: Refinement (Week 4)
- Custom routing rules
- War room integration
- Resolution tracking

---

## 9. Open Questions

1. Which support system(s) should we integrate with first? (Zendesk, Intercom, Freshdesk)
2. Should we count internal notes/updates as tickets or only customer-initiated contacts?
3. What is the appropriate baseline for brand new customers?
4. Should spikes during known outages be suppressed?

---

## 10. Appendix

### 10.1 Email Template: Spike Acknowledgment

```
Subject: We're on it - addressing your recent issues

Hi {{champion_name}},

I wanted to reach out personally because I noticed your team has experienced several issues recently. First and foremost, I want to apologize for any disruption this has caused.

I've already coordinated with our support and technical teams to prioritize your tickets. Here's what we're doing:

{{#if technical_issues}}
- Our engineering team is actively investigating the reported technical issues
{{/if}}
{{#if billing_issues}}
- Our billing team is reviewing the concerns and will reach out directly
{{/if}}

You should expect updates on your open tickets within the next {{sla_hours}} hours.

In the meantime, if there's anything urgent or if you'd like to discuss this directly, please don't hesitate to reach out. I'm here to help.

Best regards,
{{csm_name}}
```

### 10.2 Related PRDs
- PRD-145: Support SLA Breach Escalation
- PRD-121: Escalation Logged War Room
- PRD-102: Support Satisfaction Drop
- PRD-097: Product Issue Alert
