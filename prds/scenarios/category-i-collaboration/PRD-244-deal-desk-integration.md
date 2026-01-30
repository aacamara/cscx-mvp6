# PRD-244: Deal Desk Integration

## Metadata
- **PRD ID**: PRD-244
- **Title**: Deal Desk Integration
- **Category**: I - Collaboration
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-181 (Salesforce), Renewal pipeline, Expansion opportunities

---

## Problem Statement

CSMs frequently need Deal Desk approval for non-standard pricing, contract amendments, or expansion proposals. Currently, this requires manual communication via email/Slack, leading to delays, lost context, and inconsistent approval workflows. There's no visibility into Deal Desk queue status or approval history within CSCX.AI.

## User Story

> As a CSM, I want to submit Deal Desk requests directly from CSCX.AI with all relevant customer context automatically attached, track approval status, and receive notifications when decisions are made so that I can move deals forward efficiently.

---

## Functional Requirements

### FR-1: Request Submission
- **FR-1.1**: Quick "Submit to Deal Desk" button on renewal/expansion views
- **FR-1.2**: Request type selection (Discount, Payment Terms, Contract Amendment, Custom Pricing, Bundle)
- **FR-1.3**: Auto-populate customer financials (current ARR, contract value, renewal date)
- **FR-1.4**: Include justification template with guided fields
- **FR-1.5**: Attach supporting documents (competitive quotes, usage data, etc.)
- **FR-1.6**: Specify urgency level and requested turnaround

### FR-2: Deal Desk Queue
- **FR-2.1**: Centralized queue view for Deal Desk team
- **FR-2.2**: Filter by request type, urgency, submitter, customer segment
- **FR-2.3**: Sort by submission date, ARR at stake, SLA due
- **FR-2.4**: Bulk actions for similar requests
- **FR-2.5**: Assignment to specific Deal Desk analyst

### FR-3: Approval Workflow
- **FR-3.1**: Multi-level approval for high-value requests
- **FR-3.2**: Approve/Reject/Request Changes actions
- **FR-3.3**: Conditional approval with notes/stipulations
- **FR-3.4**: Approval thresholds configurable by discount level/ARR
- **FR-3.5**: Delegate approval when out of office

### FR-4: Communication
- **FR-4.1**: In-platform discussion thread on each request
- **FR-4.2**: Email notifications to CSM on status changes
- **FR-4.3**: Slack integration for urgent requests
- **FR-4.4**: Request clarification workflow

### FR-5: Analytics & Reporting
- **FR-5.1**: Approval rate by request type
- **FR-5.2**: Average turnaround time
- **FR-5.3**: Discount trends by segment/CSM
- **FR-5.4**: Win rate correlation with Deal Desk involvement
- **FR-5.5**: Revenue impact analysis

---

## Non-Functional Requirements

### NFR-1: Performance
- Request submission < 2 minutes with auto-population
- Queue loads within 1 second

### NFR-2: Security
- Deal Desk requests contain sensitive pricing; restrict access
- Audit trail for all approvals

### NFR-3: Integration
- Sync approved terms back to Salesforce opportunity
- Update renewal pipeline with approved pricing

---

## Technical Approach

### Data Model Extensions

```sql
-- deal_desk_request_types (configurable)
CREATE TABLE deal_desk_request_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  approval_threshold_pct DECIMAL, -- Auto-approve if discount below this
  approval_threshold_arr DECIMAL, -- Requires higher approval above this ARR
  sla_hours INTEGER DEFAULT 48,
  required_fields JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT true
);

-- deal_desk_requests table
CREATE TABLE deal_desk_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  submitted_by_user_id UUID REFERENCES users(id) NOT NULL,
  request_type_id UUID REFERENCES deal_desk_request_types(id),
  urgency VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_review', 'approved', 'rejected', 'changes_requested'

  -- Financial context
  current_arr DECIMAL,
  proposed_arr DECIMAL,
  discount_requested_pct DECIMAL,
  discount_approved_pct DECIMAL,
  contract_term_months INTEGER,

  -- Request details
  title VARCHAR(500) NOT NULL,
  justification TEXT NOT NULL,
  competitive_situation TEXT,
  customer_commitment TEXT, -- What customer commits to in exchange
  attachments JSONB DEFAULT '[]',

  -- Related entities
  renewal_pipeline_id UUID REFERENCES renewal_pipeline(id),
  expansion_opportunity_id UUID REFERENCES expansion_opportunities(id),
  salesforce_opportunity_id VARCHAR(100),

  -- Assignment
  assigned_to_user_id UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,

  -- Resolution
  decision_by_user_id UUID REFERENCES users(id),
  decision_at TIMESTAMPTZ,
  decision_notes TEXT,
  conditions TEXT, -- Conditional approval terms

  -- SLA tracking
  sla_due_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- deal_desk_approvals (multi-level)
CREATE TABLE deal_desk_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES deal_desk_requests(id) ON DELETE CASCADE,
  approval_level INTEGER DEFAULT 1,
  approver_user_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  notes TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- deal_desk_comments
CREATE TABLE deal_desk_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES deal_desk_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true, -- Internal vs visible to CSM
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deal_desk_requests_status ON deal_desk_requests(status);
CREATE INDEX idx_deal_desk_requests_customer ON deal_desk_requests(customer_id);
CREATE INDEX idx_deal_desk_requests_assigned ON deal_desk_requests(assigned_to_user_id);
```

### Approval Rules Engine

```typescript
interface ApprovalRule {
  id: string;
  request_type: string;
  conditions: {
    discount_pct?: { max: number };
    arr?: { max: number };
    contract_term?: { max: number };
  };
  approval_levels: {
    level: number;
    role: string; // 'deal_desk_analyst', 'deal_desk_manager', 'finance_vp', 'cro'
    required: boolean;
  }[];
}

// Example rules
const approvalRules: ApprovalRule[] = [
  {
    id: 'standard-discount',
    request_type: 'discount',
    conditions: { discount_pct: { max: 10 }, arr: { max: 50000 } },
    approval_levels: [{ level: 1, role: 'deal_desk_analyst', required: true }]
  },
  {
    id: 'large-discount',
    request_type: 'discount',
    conditions: { discount_pct: { max: 25 }, arr: { max: 200000 } },
    approval_levels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true }
    ]
  },
  {
    id: 'strategic-discount',
    request_type: 'discount',
    conditions: {}, // No limits = all others
    approval_levels: [
      { level: 1, role: 'deal_desk_analyst', required: true },
      { level: 2, role: 'deal_desk_manager', required: true },
      { level: 3, role: 'finance_vp', required: true }
    ]
  }
];
```

### API Endpoints

```typescript
// Request CRUD
POST   /api/deal-desk/requests
GET    /api/deal-desk/requests
GET    /api/deal-desk/requests/:id
PATCH  /api/deal-desk/requests/:id

// Queue management
GET    /api/deal-desk/queue
POST   /api/deal-desk/requests/:id/assign
POST   /api/deal-desk/requests/:id/claim

// Approval workflow
POST   /api/deal-desk/requests/:id/approve
POST   /api/deal-desk/requests/:id/reject
POST   /api/deal-desk/requests/:id/request-changes

// Comments
POST   /api/deal-desk/requests/:id/comments
GET    /api/deal-desk/requests/:id/comments

// Analytics
GET    /api/deal-desk/analytics
GET    /api/deal-desk/analytics/turnaround
GET    /api/deal-desk/analytics/approval-rate
```

### Salesforce Sync

```typescript
// Sync approved terms back to Salesforce
async function syncApprovalToSalesforce(request: DealDeskRequest) {
  if (request.salesforce_opportunity_id) {
    await salesforce.updateOpportunity(request.salesforce_opportunity_id, {
      Discount_Approved__c: request.discount_approved_pct,
      Deal_Desk_Approval_Date__c: request.decision_at,
      Deal_Desk_Notes__c: request.conditions,
      Pricing_Status__c: 'Deal Desk Approved'
    });
  }
}
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Request turnaround time | < 24 hours for normal | SLA tracking |
| Approval rate | Track baseline, then trends | Analytics |
| CSM time saved | 30 min per request | User surveys |
| Deal win rate with Deal Desk | Compare to without | Salesforce correlation |

---

## Acceptance Criteria

- [ ] CSM can submit Deal Desk request from renewal/expansion page
- [ ] Customer financials auto-populate in request
- [ ] Request routes to Deal Desk queue
- [ ] Deal Desk can approve/reject/request changes
- [ ] Multi-level approval for high-value requests
- [ ] CSM receives notification on decision
- [ ] Approved terms sync to Salesforce
- [ ] Analytics show turnaround time and approval rates
- [ ] SLA tracking with escalation for overdue requests

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Approval rules engine | 2 days |
| API endpoints | 3 days |
| CSM submission UI | 2 days |
| Deal Desk queue UI | 3 days |
| Notifications | 1 day |
| Salesforce sync | 2 days |
| Analytics dashboard | 2 days |
| Testing | 2 days |
| **Total** | **19 days** |

---

## Notes

- Consider Slack workflow integration for quick approvals
- Add templates for common request types
- Future: AI-suggested pricing based on similar deals
- Future: Predictive approval likelihood
- Future: Integration with CPQ systems (Salesforce CPQ, DealHub)
