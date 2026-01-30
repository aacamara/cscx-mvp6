# PRD-247: Team Handoff Workflow

## Metadata
- **PRD ID**: PRD-247
- **Title**: Team Handoff Workflow
- **Category**: I - Collaboration
- **Priority**: P0
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: PRD-241 (@Mention), PRD-248 (Collaborative Notes)

---

## Problem Statement

When CSM territory changes, role transitions, or team reorganizations occur, customer account handoffs are often incomplete. Critical context gets lost, relationships suffer, and customers experience disruption. There's no standardized handoff process ensuring all institutional knowledge transfers to the new owner.

## User Story

> As a CS leader, I want a structured handoff workflow that ensures complete knowledge transfer, introduces the new CSM properly, and tracks handoff quality so that customers experience seamless transitions.

---

## Functional Requirements

### FR-1: Handoff Initiation
- **FR-1.1**: Manager initiates handoff with from/to CSM and accounts
- **FR-1.2**: Bulk handoff for multiple accounts
- **FR-1.3**: Schedule handoff for future date
- **FR-1.4**: Set handoff completion deadline
- **FR-1.5**: Define handoff type (permanent, temporary, coverage)

### FR-2: Knowledge Transfer Checklist
- **FR-2.1**: Auto-generate checklist based on account complexity
- **FR-2.2**: Required items: stakeholder map, relationship notes, open issues
- **FR-2.3**: Optional items: preferences, history highlights, gotchas
- **FR-2.4**: Customizable checklist templates per segment
- **FR-2.5**: Completion tracking with percentage progress

### FR-3: Handoff Documentation
- **FR-3.1**: Auto-generate handoff document from customer data
- **FR-3.2**: Include health score history, recent interactions, risks
- **FR-3.3**: Editable sections for outgoing CSM commentary
- **FR-3.4**: Attach relevant documents from customer folder
- **FR-3.5**: Stakeholder-by-stakeholder relationship notes

### FR-4: Handoff Meeting
- **FR-4.1**: Schedule handoff call between outgoing and incoming CSM
- **FR-4.2**: Prepare agenda from checklist items
- **FR-4.3**: Generate meeting notes template
- **FR-4.4**: Record action items from handoff meeting
- **FR-4.5**: Track completion of handoff meeting

### FR-5: Customer Introduction
- **FR-5.1**: Generate introduction email template
- **FR-5.2**: Include relevant context for new CSM
- **FR-5.3**: Track customer acknowledgment
- **FR-5.4**: Schedule introduction call with stakeholders
- **FR-5.5**: Post-introduction check-in with customer

### FR-6: Handoff Quality Tracking
- **FR-6.1**: Incoming CSM rates handoff quality
- **FR-6.2**: Track time from initiation to completion
- **FR-6.3**: Monitor customer health during handoff period
- **FR-6.4**: Post-handoff survey to customer
- **FR-6.5**: Manager approval for handoff completion

---

## Non-Functional Requirements

### NFR-1: Completeness
- All critical context must transfer (no data loss)

### NFR-2: Speed
- Handoff documentation generated within 30 seconds

### NFR-3: Quality
- Handoff quality score tracked and actionable

---

## Technical Approach

### Data Model Extensions

```sql
-- handoff_templates (configurable checklists)
CREATE TABLE handoff_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  segment VARCHAR(50), -- Apply to specific segments
  handoff_type VARCHAR(50), -- 'permanent', 'temporary', 'coverage'
  checklist_items JSONB NOT NULL,
  required_items TEXT[] DEFAULT '{}',
  estimated_duration_days INTEGER DEFAULT 14,
  active BOOLEAN DEFAULT true
);

-- handoffs table
CREATE TABLE handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  from_csm_id UUID REFERENCES users(id) NOT NULL,
  to_csm_id UUID REFERENCES users(id) NOT NULL,
  initiated_by_user_id UUID REFERENCES users(id) NOT NULL,

  -- Configuration
  handoff_type VARCHAR(50) DEFAULT 'permanent',
  template_id UUID REFERENCES handoff_templates(id),
  scheduled_date DATE,
  deadline DATE,

  -- Progress
  status VARCHAR(50) DEFAULT 'initiated', -- 'initiated', 'in_progress', 'pending_approval', 'completed', 'cancelled'
  checklist_progress JSONB DEFAULT '{}', -- {item_key: {completed: bool, notes: str, completed_at: timestamp}}
  completion_percentage INTEGER DEFAULT 0,

  -- Handoff meeting
  handoff_meeting_scheduled TIMESTAMPTZ,
  handoff_meeting_completed TIMESTAMPTZ,
  handoff_meeting_notes TEXT,

  -- Customer introduction
  intro_email_sent_at TIMESTAMPTZ,
  intro_email_id VARCHAR(200),
  intro_meeting_scheduled TIMESTAMPTZ,
  intro_meeting_completed TIMESTAMPTZ,

  -- Quality tracking
  quality_rating INTEGER, -- 1-5 from incoming CSM
  quality_feedback TEXT,
  customer_satisfaction INTEGER, -- Post-handoff survey

  -- Completion
  completed_by_user_id UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  manager_approved_at TIMESTAMPTZ,
  manager_approved_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- handoff_documents table
CREATE TABLE handoff_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID REFERENCES handoffs(id) ON DELETE CASCADE,
  document_type VARCHAR(50), -- 'summary', 'stakeholder_map', 'risk_assessment', 'relationship_notes'
  title VARCHAR(500),
  content TEXT,
  auto_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- handoff_stakeholder_notes
CREATE TABLE handoff_stakeholder_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID REFERENCES handoffs(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id),
  relationship_strength INTEGER, -- 1-5
  communication_preferences TEXT,
  personality_notes TEXT,
  history_highlights TEXT,
  watch_outs TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handoffs_customer ON handoffs(customer_id);
CREATE INDEX idx_handoffs_from ON handoffs(from_csm_id);
CREATE INDEX idx_handoffs_to ON handoffs(to_csm_id);
CREATE INDEX idx_handoffs_status ON handoffs(status);
```

### Auto-Generated Handoff Document

```typescript
interface HandoffDocument {
  customer_overview: {
    name: string;
    arr: number;
    segment: string;
    industry: string;
    health_score: number;
    renewal_date: string;
  };
  relationship_summary: {
    tenure: string;
    key_milestones: string[];
    current_sentiment: string;
  };
  stakeholder_map: {
    stakeholder_id: string;
    name: string;
    role: string;
    relationship_strength: number;
    notes: string;
  }[];
  health_history: {
    date: string;
    score: number;
    trend: string;
  }[];
  recent_interactions: {
    date: string;
    type: string;
    summary: string;
  }[];
  open_items: {
    type: string;
    title: string;
    status: string;
    due_date: string;
  }[];
  risks_and_opportunities: {
    risks: string[];
    opportunities: string[];
  };
  csm_commentary: string;
}

async function generateHandoffDocument(customerId: string): Promise<HandoffDocument> {
  const [customer, stakeholders, healthHistory, interactions, tasks, risks] = await Promise.all([
    getCustomer(customerId),
    getStakeholders(customerId),
    getHealthHistory(customerId, 90),
    getRecentInteractions(customerId, 30),
    getOpenTasks(customerId),
    getRiskSignals(customerId)
  ]);

  return {
    customer_overview: formatOverview(customer),
    relationship_summary: calculateRelationshipSummary(customer, interactions),
    stakeholder_map: stakeholders.map(formatStakeholder),
    health_history: healthHistory,
    recent_interactions: interactions.slice(0, 10),
    open_items: tasks,
    risks_and_opportunities: {
      risks: risks.filter(r => r.type === 'risk').map(r => r.description),
      opportunities: risks.filter(r => r.type === 'opportunity').map(r => r.description)
    },
    csm_commentary: '' // Filled by outgoing CSM
  };
}
```

### API Endpoints

```typescript
// Handoff CRUD
POST   /api/handoffs
GET    /api/handoffs
GET    /api/handoffs/:id
PATCH  /api/handoffs/:id
DELETE /api/handoffs/:id

// Checklist
PATCH  /api/handoffs/:id/checklist/:itemKey
GET    /api/handoffs/:id/checklist

// Documents
GET    /api/handoffs/:id/documents
POST   /api/handoffs/:id/documents
PATCH  /api/handoffs/:id/documents/:docId

// Stakeholder notes
GET    /api/handoffs/:id/stakeholder-notes
POST   /api/handoffs/:id/stakeholder-notes
PATCH  /api/handoffs/:id/stakeholder-notes/:noteId

// Workflow actions
POST   /api/handoffs/:id/schedule-meeting
POST   /api/handoffs/:id/send-intro-email
POST   /api/handoffs/:id/submit-for-approval
POST   /api/handoffs/:id/approve
POST   /api/handoffs/:id/complete

// Quality
POST   /api/handoffs/:id/rate
GET    /api/handoffs/quality-metrics
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Handoff completion rate | 100% | Status tracking |
| Average handoff duration | < 14 days | Time tracking |
| Handoff quality rating | 4.5/5 | Incoming CSM rating |
| Customer health during handoff | No degradation | Health score monitoring |
| Customer satisfaction post-handoff | 4/5+ | Survey |

---

## Acceptance Criteria

- [ ] Manager can initiate handoff with from/to CSM
- [ ] System generates checklist based on template
- [ ] Handoff document auto-generated with customer data
- [ ] Outgoing CSM can add stakeholder relationship notes
- [ ] Handoff meeting can be scheduled from workflow
- [ ] Introduction email template generated
- [ ] Progress tracked as checklist items completed
- [ ] Incoming CSM rates handoff quality
- [ ] Manager approves handoff completion
- [ ] Customer health monitored during handoff period

---

## Estimated Effort

| Component | Effort |
|-----------|--------|
| Data model & migrations | 2 days |
| Handoff document generator | 3 days |
| API endpoints | 3 days |
| Handoff workflow UI | 4 days |
| Checklist management | 2 days |
| Email/meeting integration | 2 days |
| Quality tracking | 1 day |
| Testing | 2 days |
| **Total** | **19 days** |

---

## Notes

- Consider parallel handoffs for bulk territory changes
- Add AI-generated summary of customer relationship
- Future: Video recording capability for handoff context
- Future: Predictive model for handoff success factors
- Future: Customer portal for self-serve transition info
