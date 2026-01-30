# PRD-088: Champion Departure Alert

## Metadata
- **PRD ID**: PRD-088
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Stakeholder Management, External Data Enrichment, Trigger Engine

---

## 1. Overview

### 1.1 Problem Statement
When a customer champion leaves their role, the account immediately becomes at-risk. Champions are often the internal advocates who drive adoption, influence renewals, and protect the vendor relationship. CSMs typically discover champion departures weeks or months after the fact, missing the critical window to establish new relationships and maintain momentum.

### 1.2 Solution Summary
Implement an automated detection system that identifies champion departures through multiple signals (LinkedIn changes, email bounces, meeting declines, login cessation) and triggers an immediate risk mitigation workflow. The workflow includes notifying the CSM, updating the stakeholder map, drafting multi-threading outreach, and creating a relationship recovery plan.

### 1.3 Success Metrics
- Detect champion departures within 7 days of occurrence
- Reduce renewal risk on affected accounts by 40%
- Increase successful multi-threading rate post-departure by 60%
- Maintain relationship continuity score above 70% for affected accounts

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be immediately alerted when a champion leaves their role at a customer account
**So that** I can quickly establish new relationships and prevent account deterioration

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want the system to suggest alternative contacts at the account who could become new champions, so I can prioritize multi-threading outreach.

**US-3**: As a CSM, I want a pre-drafted introduction email to send to other stakeholders, so I can quickly re-establish presence at the account.

**US-4**: As a CS Manager, I want visibility into accounts with recent champion departures across my team, so I can prioritize support and resources.

**US-5**: As a CSM, I want to track where my departed champions went, so I can potentially nurture them as champions at their new company.

---

## 3. Functional Requirements

### 3.1 Departure Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Monitor email delivery status for champion emails (bounces, auto-replies) | Must |
| FR-1.2 | Detect LinkedIn job title/company changes (via data enrichment) | Must |
| FR-1.3 | Detect login cessation for champions who were product users | Should |
| FR-1.4 | Monitor meeting decline patterns (consistent declines) | Should |
| FR-1.5 | Process out-of-office messages mentioning departure | Should |
| FR-1.6 | Allow manual champion departure flagging | Must |
| FR-1.7 | Cross-reference multiple signals for confidence scoring | Should |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create risk_signal with type "champion_left" | Must |
| FR-2.2 | Severity based on champion role: exec sponsor = critical, primary contact = high | Must |
| FR-2.3 | Include detection method, confidence score, and evidence in metadata | Must |
| FR-2.4 | Update stakeholder record with departure status and date | Must |
| FR-2.5 | Recalculate relationship health score for the account | Should |

### 3.3 Mitigation Workflow

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Immediately notify CSM via Slack with full context | Must |
| FR-3.2 | Create high-priority task: "Re-establish champion at {{customer}}" | Must |
| FR-3.3 | Draft multi-threading outreach emails to other stakeholders | Must |
| FR-3.4 | Generate list of suggested new champion candidates | Should |
| FR-3.5 | Update health score to reflect relationship risk | Must |
| FR-3.6 | Schedule internal review meeting if renewal within 90 days | Should |
| FR-3.7 | Track departed champion's new company for future opportunity | Could |

### 3.4 Stakeholder Intelligence

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-4.1 | Identify other contacts at the account with email history | Must |
| FR-4.2 | Score contacts by engagement level and seniority | Should |
| FR-4.3 | Suggest outreach priority order | Should |
| FR-4.4 | Identify gaps in stakeholder coverage (e.g., no exec sponsor) | Should |

---

## 4. Technical Specifications

### 4.1 Data Model Changes

```sql
-- Add to stakeholders table
ALTER TABLE stakeholders ADD COLUMN status VARCHAR(20) DEFAULT 'active';
-- Values: 'active', 'departed', 'inactive', 'unknown'

ALTER TABLE stakeholders ADD COLUMN departure_detected_at TIMESTAMPTZ;
ALTER TABLE stakeholders ADD COLUMN departure_destination TEXT; -- New company
ALTER TABLE stakeholders ADD COLUMN departure_confidence INTEGER; -- 0-100

-- risk_signal metadata structure for champion_left
{
  "stakeholder_id": "uuid",
  "stakeholder_name": "Jane Doe",
  "stakeholder_role": "VP Product",
  "was_primary_contact": true,
  "was_exec_sponsor": false,
  "detection_method": "linkedin_update",
  "confidence": 95,
  "new_company": "Competitor Corp",
  "evidence": [
    {"type": "linkedin", "data": "Title changed to VP Product at Competitor Corp"},
    {"type": "email_bounce", "data": "Mailbox not found since 2026-01-20"}
  ],
  "remaining_contacts": 3,
  "suggested_new_champions": ["John Smith (Dir Engineering)", "Sarah Lee (Product Manager)"]
}
```

### 4.2 API Endpoints

```typescript
// Trigger manual champion departure
POST /api/stakeholders/:stakeholderId/mark-departed
Body: {
  departureDate?: string,
  newCompany?: string,
  newRole?: string,
  reason?: string
}

// Get departure detection status
GET /api/customers/:customerId/champion-status
Response: {
  champions: Stakeholder[],
  atRiskChampions: Array<{
    stakeholder: Stakeholder,
    riskIndicators: string[],
    confidence: number
  }>,
  recentDepartures: Array<{
    stakeholder: Stakeholder,
    departedAt: string,
    destination?: string
  }>
}

// Get suggested new champions
GET /api/customers/:customerId/suggest-champions
Response: {
  suggestions: Array<{
    stakeholder: Stakeholder,
    score: number,
    reasons: string[]
  }>
}
```

### 4.3 Detection Logic

```typescript
interface ChampionDepartureSignal {
  stakeholderId: string;
  signalType: 'email_bounce' | 'linkedin_change' | 'login_stopped' | 'meeting_declines' | 'ooo_mention';
  confidence: number;
  evidence: string;
  detectedAt: Date;
}

async function evaluateChampionStatus(stakeholderId: string): Promise<DepartureEvaluation> {
  const signals = await collectDepartureSignals(stakeholderId);

  // Weight signals by reliability
  const weights = {
    linkedin_change: 0.4,
    email_bounce: 0.3,
    login_stopped: 0.15,
    meeting_declines: 0.1,
    ooo_mention: 0.05
  };

  const confidence = signals.reduce((sum, s) => sum + (s.confidence * weights[s.signalType]), 0);

  return {
    isDeparted: confidence >= 70,
    confidence,
    signals,
    recommendedAction: confidence >= 70 ? 'trigger_alert' :
                       confidence >= 40 ? 'monitor_closely' : 'no_action'
  };
}
```

### 4.4 Workflow Definition

```yaml
workflow: champion_departure_response
version: 1.0
trigger:
  type: risk_signal_created
  filter:
    signal_type: champion_left

steps:
  - id: notify_csm
    action: slack_dm
    config:
      message_template: "champion_departure_alert"
      urgency: critical
      include_stakeholder_list: true

  - id: update_health_score
    action: update_health_score
    config:
      adjustment: -20
      reason: "Champion departure detected"

  - id: create_task
    action: create_task
    config:
      title: "URGENT: Champion departed at {{customer.name}} - establish new contact"
      due_date_offset_hours: 24
      priority: critical

  - id: suggest_new_champions
    action: delegate_to_agent
    config:
      agent: researcher
      action: suggest_champions
      params:
        customer_id: "{{customer.id}}"

  - id: draft_multithreading_emails
    action: delegate_to_agent
    config:
      agent: communicator
      action: draft_email
      params:
        template: champion_transition_introduction
        recipients: "{{top_3_contacts}}"
        requires_approval: true

  - id: notify_manager
    condition: "{{customer.arr}} >= 100000 OR {{days_until_renewal}} <= 90"
    action: slack_dm
    config:
      recipient: "{{csm.manager_id}}"
      message_template: "champion_departure_manager_alert"

  - id: schedule_review
    condition: "{{days_until_renewal}} <= 90"
    action: create_meeting
    config:
      title: "Account Review: {{customer.name}} - Champion Departure"
      attendees: ["{{csm.email}}", "{{csm.manager_email}}"]
      duration: 30
      description: "Review account status following champion departure"
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:warning: CHAMPION DEPARTURE: Acme Corp

Jane Doe (VP Product) has left Acme Corp

Detection:
- LinkedIn: Now VP Product at TechRival Inc (Jan 25, 2026)
- Email bouncing since Jan 20, 2026

Account Impact:
- Jane was PRIMARY CONTACT
- Last meeting: Jan 15, 2026
- Relationship tenure: 2.5 years

Account Status:
- ARR: $250,000
- Renewal: 67 days away
- Health Score: 72 → 52 (adjusted)

Remaining Contacts (3):
1. John Smith - Director Engineering (7 interactions)
2. Sarah Lee - Product Manager (4 interactions)
3. Bob Wilson - IT Admin (2 interactions)

[View Stakeholder Map] [Draft Outreach] [See New Champion Candidates]
```

### 5.2 Customer Detail - Stakeholder Section

Show departed champions with:
- Visual indicator (grayed out, "Departed" badge)
- Departure date and destination (if known)
- Link to view in new company context
- "Find Replacement" action button

### 5.3 Stakeholder Org Chart

Visual representation showing:
- Active champions (highlighted)
- Departed stakeholders (dimmed with strikethrough)
- Coverage gaps
- Recommended multi-threading targets

---

## 6. Integration Points

### 6.1 Required Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| LinkedIn (via enrichment) | Job change detection | Needed |
| Gmail | Bounce detection, OOO parsing | Implemented |
| Calendar | Meeting pattern analysis | Implemented |
| Usage Data | Login cessation detection | Implemented |

### 6.2 Data Enrichment Services

Consider integrating with:
- Clearbit
- ZoomInfo
- Apollo
- LinkedIn Sales Navigator

---

## 7. Testing Requirements

### 7.1 Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| LinkedIn job change | Champion changes company on LinkedIn | Critical alert, new company captured |
| Email bounce | Champion email starts bouncing | High confidence signal added |
| Login stopped | Champion stops logging in for 30 days | Medium confidence signal added |
| Multiple signals | Bounce + LinkedIn change | Very high confidence alert |
| Non-champion leaves | Regular user departs | No alert (below threshold) |
| New contact added | Champion leaves but new one added | Alert but adjusted severity |

---

## 8. Rollout Plan

### Phase 1: Manual + Basic Detection (Week 1)
- Manual champion departure marking
- Email bounce detection
- Basic Slack alerts

### Phase 2: Enhanced Detection (Week 2)
- LinkedIn change monitoring (via enrichment API)
- Login pattern analysis
- Confidence scoring

### Phase 3: Response Automation (Week 3)
- Multi-threading email drafts
- New champion suggestions
- Health score adjustments

### Phase 4: Advanced Intelligence (Week 4)
- Departed champion tracking
- Predictive departure signals
- Relationship coverage scoring

---

## 9. Open Questions

1. Which data enrichment provider should we use for LinkedIn monitoring?
2. What confidence threshold should trigger an alert (currently 70%)?
3. Should we track where champions go and alert if they join a prospect company?
4. How should we handle champion departures at one-person accounts?

---

## 10. Appendix

### 10.1 Email Template: Multi-Threading Introduction

```
Subject: Continuing our partnership

Hi {{contact_name}},

I hope this message finds you well. I'm {{csm_name}}, the Customer Success Manager for your {{product_name}} account.

I wanted to reach out to introduce myself and ensure we have a direct line of communication. {{#if champion_departed}}I understand there have been some team changes recently, and I want to make sure our partnership continues smoothly.{{/if}}

As your CSM, I'm here to:
- Ensure you're getting maximum value from {{product_name}}
- Share best practices and new features relevant to your goals
- Address any questions or concerns you might have

I'd love to schedule a brief call to learn more about your priorities and how we can best support your team. Would you have 20 minutes this week or next?

Looking forward to connecting!

Best regards,
{{csm_name}}
```

### 10.2 Related PRDs
- PRD-063: Stakeholder Relationship Map
- PRD-044: Multi-Threading Introduction
- PRD-082: Decision Maker Analysis
- PRD-095: Executive Change Detected
