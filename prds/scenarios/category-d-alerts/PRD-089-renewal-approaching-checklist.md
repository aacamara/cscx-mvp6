# PRD-089: Renewal Approaching - Prep Checklist

## Metadata
- **PRD ID**: PRD-089
- **Category**: D - Alerts & Triggers
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Contract Data, Renewal Pipeline, Trigger Engine, Google Docs Integration

---

## 1. Overview

### 1.1 Problem Statement
Renewal preparation is often rushed or inconsistent. CSMs may miss key preparation steps, fail to engage the right stakeholders, or not have updated value documentation ready. This leads to last-minute scrambles, weaker negotiating positions, and increased churn risk at renewal time.

### 1.2 Solution Summary
Implement a tiered alert system that triggers at key milestones before renewal (90, 60, 30, 7 days) with a contextual preparation checklist. Each milestone generates appropriate tasks, documents, and outreach suggestions based on account status, health score, and renewal complexity.

### 1.3 Success Metrics
- 100% of renewals have prep checklist initiated 90+ days out
- Increase renewal conversation start rate from 60% to 95% at 60-day mark
- Reduce last-minute renewal scrambles (< 30 days notice) by 80%
- Improve renewal close rate by 15%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** receive automated reminders and a prep checklist as renewals approach
**So that** I'm fully prepared for every renewal conversation

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want the checklist to be customized based on account health and ARR tier, so I can prioritize the right activities.

**US-3**: As a CSM, I want the system to auto-generate a value summary document with up-to-date metrics, so I don't have to manually compile data.

**US-4**: As a CS Manager, I want visibility into renewal prep status across my team, so I can identify accounts needing intervention.

**US-5**: As a CSM, I want to track checklist completion progress, so I know what's done and what remains.

---

## 3. Functional Requirements

### 3.1 Milestone Alerts

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Trigger alerts at 90, 60, 30, and 7 days before renewal date | Must |
| FR-1.2 | Alert includes days remaining, ARR, health score, renewal status | Must |
| FR-1.3 | Severity escalates as renewal approaches (info → warning → critical) | Must |
| FR-1.4 | Customize milestones per customer segment (e.g., enterprise gets 120-day start) | Should |
| FR-1.5 | Account for business days and holidays in timing | Should |
| FR-1.6 | Prevent alert fatigue with daily summary option vs individual alerts | Should |

### 3.2 Checklist Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Generate milestone-appropriate checklist (different items at 90d vs 30d) | Must |
| FR-2.2 | Customize checklist based on ARR tier (different for $10K vs $500K) | Must |
| FR-2.3 | Adjust checklist based on health score (at-risk gets additional items) | Must |
| FR-2.4 | Track checklist item completion status | Must |
| FR-2.5 | Allow CSM to add custom checklist items | Should |
| FR-2.6 | Inherit unfinished items from previous milestone | Should |

### 3.3 Document Auto-Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Generate Value Summary document at 90-day mark | Must |
| FR-3.2 | Generate Renewal Proposal template at 60-day mark | Must |
| FR-3.3 | Pre-populate documents with customer data, metrics, usage stats | Must |
| FR-3.4 | Store documents in customer's Google Drive folder | Must |
| FR-3.5 | Update documents when data changes significantly | Should |

### 3.4 Stakeholder Engagement

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-4.1 | Identify renewal decision makers and influencers | Must |
| FR-4.2 | Track last contact date with each stakeholder | Must |
| FR-4.3 | Flag stakeholders not engaged in last 30 days | Must |
| FR-4.4 | Draft outreach emails to unengaged stakeholders | Should |
| FR-4.5 | Suggest exec sponsor introduction if not engaged | Should |

---

## 4. Technical Specifications

### 4.1 Data Model Changes

```sql
-- Renewal checklist tracking
CREATE TABLE renewal_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  renewal_id UUID REFERENCES renewal_pipeline(id),
  milestone VARCHAR(20) NOT NULL, -- '90_day', '60_day', '30_day', '7_day'
  items JSONB NOT NULL, -- Array of checklist items
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(renewal_id, milestone)
);

-- Checklist item structure
{
  "items": [
    {
      "id": "value_summary",
      "title": "Create/update value summary document",
      "description": "Compile ROI metrics, usage highlights, and achievements",
      "priority": "high",
      "status": "pending", -- pending, in_progress, completed, skipped
      "completed_at": null,
      "completed_by": null,
      "due_offset_days": 80, -- Due 80 days before renewal (10 days to complete)
      "document_id": null, -- Link to generated document
      "auto_generated": true
    }
  ]
}
```

### 4.2 API Endpoints

```typescript
// Get renewal checklist for customer
GET /api/customers/:customerId/renewal-checklist
Response: {
  renewal: RenewalPipeline,
  currentMilestone: '60_day',
  daysUntilRenewal: 58,
  checklists: {
    '90_day': { items: ChecklistItem[], completionRate: 100 },
    '60_day': { items: ChecklistItem[], completionRate: 40 },
    '30_day': null, // Not yet triggered
    '7_day': null
  },
  documents: {
    valueSummary: { id, url, generatedAt },
    renewalProposal: { id, url, generatedAt }
  }
}

// Update checklist item
PATCH /api/renewal-checklists/:checklistId/items/:itemId
Body: {
  status: 'completed',
  notes?: string
}

// Regenerate document
POST /api/customers/:customerId/renewal-docs/regenerate
Body: {
  documentType: 'value_summary' | 'renewal_proposal'
}
```

### 4.3 Milestone Checklist Templates

```typescript
const RENEWAL_CHECKLISTS = {
  '90_day': {
    name: 'Strategic Preparation',
    items: [
      { id: 'review_health', title: 'Review current health score and trends', priority: 'high', autoCheck: true },
      { id: 'value_summary', title: 'Generate value summary document', priority: 'high', autoGenerate: 'value_summary' },
      { id: 'stakeholder_audit', title: 'Audit stakeholder engagement', priority: 'high' },
      { id: 'exec_sponsor', title: 'Confirm exec sponsor engagement', priority: 'medium' },
      { id: 'risk_assessment', title: 'Complete risk assessment', priority: 'high' },
      { id: 'expansion_review', title: 'Review expansion opportunities', priority: 'medium' },
      { id: 'qbr_schedule', title: 'Schedule pre-renewal QBR', priority: 'high' }
    ]
  },
  '60_day': {
    name: 'Active Engagement',
    items: [
      { id: 'renewal_proposal', title: 'Prepare renewal proposal', priority: 'high', autoGenerate: 'renewal_proposal' },
      { id: 'pricing_confirm', title: 'Confirm pricing with finance', priority: 'high' },
      { id: 'champion_aligned', title: 'Align with champion on renewal', priority: 'high' },
      { id: 'decision_timeline', title: 'Understand decision timeline and process', priority: 'high' },
      { id: 'competitor_check', title: 'Check for competitive threats', priority: 'medium' },
      { id: 'contract_terms', title: 'Review contract terms for changes', priority: 'medium' }
    ]
  },
  '30_day': {
    name: 'Negotiation & Close',
    items: [
      { id: 'proposal_sent', title: 'Formal proposal sent', priority: 'critical' },
      { id: 'objections_handled', title: 'Address all objections', priority: 'critical' },
      { id: 'legal_review', title: 'Legal/procurement review started', priority: 'high' },
      { id: 'executive_alignment', title: 'Executive alignment confirmed', priority: 'high' },
      { id: 'verbal_commit', title: 'Secure verbal commitment', priority: 'high' }
    ]
  },
  '7_day': {
    name: 'Final Push',
    items: [
      { id: 'contract_sent', title: 'Contract sent for signature', priority: 'critical' },
      { id: 'blockers_cleared', title: 'All blockers cleared', priority: 'critical' },
      { id: 'signature_timeline', title: 'Confirm signature timeline', priority: 'critical' },
      { id: 'escalate_if_needed', title: 'Escalate if at risk', priority: 'critical' }
    ]
  }
};
```

### 4.4 Workflow Definition

```yaml
workflow: renewal_milestone_alert
version: 1.0
trigger:
  type: scheduled
  schedule: "0 8 * * *" # Daily at 8 AM

steps:
  - id: find_upcoming_renewals
    action: query_database
    config:
      query: |
        SELECT * FROM renewal_pipeline
        WHERE renewal_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
        AND status NOT IN ('signed', 'churned')

  - id: check_milestones
    for_each: "{{renewals}}"
    action: evaluate_milestone
    config:
      milestones: [90, 60, 30, 7]

  - id: trigger_90_day
    condition: "{{milestone}} == 90 AND NOT {{checklist_exists}}"
    action: create_renewal_checklist
    config:
      milestone: '90_day'
      generate_documents: ['value_summary']
      notify: true

  - id: trigger_60_day
    condition: "{{milestone}} == 60 AND NOT {{checklist_exists}}"
    action: create_renewal_checklist
    config:
      milestone: '60_day'
      generate_documents: ['renewal_proposal']
      notify: true
      inherit_incomplete: true

  - id: trigger_30_day
    condition: "{{milestone}} == 30 AND NOT {{checklist_exists}}"
    action: create_renewal_checklist
    config:
      milestone: '30_day'
      notify: true
      urgency: high
      inherit_incomplete: true

  - id: trigger_7_day
    condition: "{{milestone}} == 7 AND NOT {{checklist_exists}}"
    action: create_renewal_checklist
    config:
      milestone: '7_day'
      notify: true
      urgency: critical
      notify_manager: true
      inherit_incomplete: true
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format (90-Day)

```
:calendar: Renewal Approaching: Acme Corp

90 days until renewal (April 29, 2026)

Account Summary:
- ARR: $150,000
- Health Score: 78 (Healthy)
- Segment: Enterprise

Prep Checklist Generated:
- [ ] Review health score and trends
- [ ] Generate value summary document
- [ ] Audit stakeholder engagement
- [ ] Confirm exec sponsor engagement
- [ ] Complete risk assessment
- [ ] Review expansion opportunities
- [ ] Schedule pre-renewal QBR

Documents Auto-Generated:
- Value Summary: [View Document]

[View Full Checklist] [View Customer] [Start Renewal Playbook]
```

### 5.2 Slack Alert Format (30-Day, Urgent)

```
:warning: URGENT: 30 Days to Renewal - Acme Corp

Renewal Date: February 28, 2026
ARR: $150,000
Health Score: 65 (At Risk)

Incomplete Items from Previous Milestones:
- [ ] Champion aligned on renewal
- [ ] Decision timeline confirmed

Current Milestone Tasks:
- [ ] Formal proposal sent
- [ ] Address all objections
- [ ] Legal/procurement review started
- [ ] Executive alignment confirmed
- [ ] Secure verbal commitment

:rotating_light: At-Risk Indicators:
- Health score dropped 13 points this month
- No champion meeting in 45 days

[View Checklist] [Draft Outreach] [Request Manager Support]
```

### 5.3 Customer Detail - Renewal Section

Dedicated renewal preparation card showing:
- Days until renewal (prominent countdown)
- Current milestone and next milestone
- Checklist progress bar
- Document links
- Stakeholder engagement status
- Risk factors

### 5.4 Checklist UI Component

Interactive checklist with:
- Checkbox for each item
- Priority indicators (color coding)
- Due dates
- Completion status
- Notes field
- Link to related document/action

---

## 6. Integration Points

### 6.1 Required Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| Google Docs | Value summary generation | Implemented |
| Google Drive | Document storage | Implemented |
| Slack | Milestone notifications | Implemented |
| Calendar | QBR scheduling | Implemented |

### 6.2 Document Templates

Use existing Google Docs templates:
- `VALUE_SUMMARY` - Pre-populated value summary
- `RENEWAL_PROPOSAL` - Renewal proposal template

---

## 7. Testing Requirements

### 7.1 Test Scenarios

| Scenario | Input | Expected Output |
|----------|-------|-----------------|
| 90-day trigger | Renewal in 90 days | Checklist created, value summary generated |
| 60-day trigger | Renewal in 60 days | New checklist, proposal template, carryover items |
| Missed milestone | Renewal in 85 days (started tracking late) | Catch up, mark 90-day as missed |
| Checklist completion | Complete all items | Completion tracking, celebration message |
| At-risk renewal | Health score < 60 at any milestone | Additional risk-mitigation items added |

---

## 8. Rollout Plan

### Phase 1: Basic Milestones (Week 1)
- Implement milestone detection
- Create basic checklists
- Slack notifications

### Phase 2: Document Generation (Week 2)
- Value summary auto-generation
- Renewal proposal templates
- Google Drive integration

### Phase 3: Smart Checklists (Week 3)
- Segment-based customization
- Health-score-based additions
- Stakeholder engagement tracking

### Phase 4: Completion Tracking (Week 4)
- Progress tracking UI
- Manager visibility dashboard
- Completion analytics

---

## 9. Open Questions

1. Should checklist items be mandatory or advisory?
2. What happens if CSM marks items complete without actually doing them?
3. Should we integrate with existing project management tools (Asana, etc.)?
4. How do we handle multi-year contracts with different renewal cycles?

---

## 10. Appendix

### 10.1 Value Summary Template Structure

```
# Value Summary: {{customer_name}}
Generated: {{date}}

## Partnership Overview
- Customer Since: {{start_date}}
- Current ARR: {{arr}}
- Contract End: {{renewal_date}}

## Key Achievements
{{#each achievements}}
- {{this}}
{{/each}}

## Usage Highlights
- Active Users: {{active_users}}
- Feature Adoption: {{adoption_score}}%
- Key Features Used: {{top_features}}

## ROI Delivered
{{roi_metrics}}

## Support Summary
- Tickets Resolved: {{tickets_resolved}}
- Avg Response Time: {{avg_response_time}}
- CSAT Score: {{csat_score}}

## Looking Ahead
- Recommended Next Steps
- Expansion Opportunities
```

### 10.2 Related PRDs
- PRD-027: Renewal Proposal Generator
- PRD-059: Renewal Pipeline Forecast
- PRD-093: Contract Auto-Renewal Review Trigger
- PRD-163: Renewal Forecast Report
