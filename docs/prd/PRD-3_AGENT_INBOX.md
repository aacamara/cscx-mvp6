# PRD-3: Agent Inbox (Approval / Rejection / Rerun) + Action History Timeline

**Status**: 🔴 Not Started
**Priority**: P0 - Critical (Launch Blocker)
**Last Updated**: 2026-02-01

---

## Goal

Create an "Agent Inbox" tab where users can view every agent action generated from the Chat UI (e.g., analyzed data, built QBR, drafted email, wrote to Drive, updated DB). Each action is timestamped, reviewable, editable (when applicable), and supports approval, rejection, and re-run.

---

## Core Requirements

### Action Record Schema

```sql
CREATE TABLE public.agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES public.workspaces(id),
  user_id UUID REFERENCES public.users(id),
  customer_id UUID REFERENCES public.customers(id),
  conversation_id UUID,  -- link to chat thread
  action_type TEXT NOT NULL,  -- 'email_draft', 'qbr_generation', 'drive_write', etc.
  status TEXT NOT NULL DEFAULT 'proposed',  -- proposed, approved, rejected, executing, completed, failed
  title TEXT,
  description TEXT,
  inputs JSONB,  -- sanitized inputs
  outputs JSONB,  -- results/payload
  artifacts JSONB,  -- links to files, documents
  error_message TEXT,
  requires_approval BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  retry_of UUID REFERENCES public.agent_actions(id),  -- if this is a retry
  execution_started_at TIMESTAMPTZ,
  execution_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.agent_action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID REFERENCES public.agent_actions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'created', 'approved', 'rejected', 'started', 'completed', 'failed', 'retried'
  details JSONB,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.agent_action_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES public.workspaces(id),
  action_type TEXT NOT NULL,
  requires_approval BOOLEAN DEFAULT true,
  auto_approve_conditions JSONB,  -- e.g., { "max_cost": 100 }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Functional Requirements

| Req ID | Requirement |
|--------|-------------|
| FR-1 | Top-level navigation tab: "Agent Inbox" |
| FR-2 | Every agent workflow creates an Action record |
| FR-3 | Status lifecycle: proposed → approved → executing → completed OR proposed → rejected |
| FR-4 | List view with filters: date, action_type, status, customer |
| FR-5 | Detail view: inputs, outputs, files, diffs, logs, timestamps |
| FR-6 | Approve button: moves to executing, triggers execution |
| FR-7 | Reject button: requires reason, moves to rejected |
| FR-8 | Rerun button: creates new action linked to original |
| FR-9 | Edit-and-Run: for safe actions, allow input modification before rerun |
| FR-10 | Timeline view: chronological audit trail per action and per customer |
| FR-11 | Permissions: users see workspace actions; admins see all |
| FR-12 | Chat integration: "This action is pending review in Agent Inbox" |
| FR-13 | Policy configuration: which actions require approval |

---

## API Contracts

### GET /api/agent-inbox/actions
List actions with filters.

### GET /api/agent-inbox/actions/:id
Get action details with logs.

### POST /api/agent-inbox/actions/:id/approve
Approve and trigger execution.

### POST /api/agent-inbox/actions/:id/reject
Reject with reason.

### POST /api/agent-inbox/actions/:id/rerun
Create new action from existing.

### GET /api/agent-inbox/policies
Get approval policies for workspace.

### PUT /api/agent-inbox/policies/:actionType
Update policy for action type.

---

## UI/UX

### Inbox List View
- Table with columns: Title, Type, Customer, Status, Created, Actions
- Status badges: Proposed (yellow), Approved (blue), Completed (green), Rejected (red), Failed (red)
- Quick action buttons inline
- Bulk approve/reject for multiple items

### Action Detail View
- Header: title, type, customer, timestamps
- Sections: Inputs, Outputs, Artifacts, Logs
- Action buttons at bottom

### Timeline View
- Chronological list grouped by date
- Filter by customer for customer-specific timeline

---

## Test Plan

- Unit tests for action status transitions
- Integration tests for creating Action records from chat workflows
- E2E: run workflow → see action in inbox → approve → verify execution
- E2E: run workflow → reject → verify status and reason
- E2E: rerun action → verify new action with link to original

---

## Definition of Done

- [ ] Agent Inbox navigation tab
- [ ] Action records created from all chat workflows
- [ ] Approve/Reject/Rerun working
- [ ] Timeline view
- [ ] Policy configuration
- [ ] Chat shows "pending review" indicator
- [ ] All tests passing
- [ ] Deployed to staging/production
