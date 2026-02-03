# PRD-4: Support Tickets via Chat + Screenshots → Admin Agent Inbox + Auto Troubleshoot Prompt

**Status**: 🔴 Not Started
**Priority**: P1 - Important
**Last Updated**: 2026-02-01

---

## Goal

Users can submit support tickets from within the app by describing the problem in chat and attaching screenshots/files. Tickets appear in the admin's Agent Inbox. For each ticket, the system auto-generates a "Claude CLI troubleshooting prompt" that the admin can copy/paste to reproduce and diagnose the issue.

---

## User-Facing Requirements

| Req ID | Requirement |
|--------|-------------|
| FR-1 | "Support" button in chat UI and/or help menu |
| FR-2 | Support ticket form: problem description, steps to reproduce, expected vs actual, severity |
| FR-3 | Attachments: screenshots, files |
| FR-4 | Auto-capture: app version, browser, device, timestamp, workspace_id, user_id |
| FR-5 | Auto-capture: recent relevant logs/events/action ids |
| FR-6 | Confirmation message with ticket ID |

---

## Admin-Facing Requirements

| Req ID | Requirement |
|--------|-------------|
| FR-7 | Tickets appear in Agent Inbox (admin view) |
| FR-8 | Ticket details: user, workspace, timestamp, severity, attachments |
| FR-9 | Structured fields: repro steps, expected/actual, correlation IDs |
| FR-10 | Lifecycle: new → triaged → investigating → resolved → closed |
| FR-11 | Auto-generated Claude CLI troubleshoot prompt per ticket |
| FR-12 | Prompt includes: summary, env info, repro steps, logs, test commands |
| FR-13 | Guardrails: no secrets, redact tokens, minimal PII |

---

## Data Model

```sql
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number SERIAL,
  workspace_id UUID REFERENCES public.workspaces(id),
  user_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'new',  -- new, triaged, investigating, resolved, closed
  severity TEXT DEFAULT 'medium',  -- low, medium, high, critical
  title TEXT,
  description TEXT,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  environment JSONB,  -- browser, device, version, etc.
  correlation_ids JSONB,  -- request_id, action_ids, job_ids
  recent_logs TEXT,
  troubleshoot_prompt TEXT,  -- auto-generated
  resolution_notes TEXT,
  assigned_to UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE TABLE public.support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.support_ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  is_internal BOOLEAN DEFAULT false,  -- admin-only notes
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Auto-Generated Troubleshoot Prompt Template

```
# Support Ticket #{{ticket_number}} Troubleshooting

## Summary
{{description}}

## Environment
- App Version: {{version}}
- Browser: {{browser}}
- Timestamp: {{created_at}}
- User: {{user_email}} ({{workspace_name}})

## Steps to Reproduce
{{steps_to_reproduce}}

## Expected vs Actual
- Expected: {{expected_behavior}}
- Actual: {{actual_behavior}}

## Correlation IDs
- Request IDs: {{request_ids}}
- Action IDs: {{action_ids}}
- Job IDs: {{job_ids}}

## Recent Logs
{{recent_logs}}

## Troubleshooting Instructions
1. Search codebase for relevant error handlers
2. Check logs for correlation IDs above
3. Review recent changes to affected components
4. Run relevant tests: `npm test -- --grep "{{related_feature}}"`
5. Propose a fix with tests

## Guardrails
- Do not expose secrets or tokens
- Redact PII beyond necessary context
- Focus on root cause analysis
```

---

## API Contracts

### POST /api/support/tickets
Create a new support ticket.

### GET /api/support/tickets
List tickets (admin: all, user: own).

### GET /api/support/tickets/:id
Get ticket details.

### PATCH /api/support/tickets/:id
Update ticket status/assignment.

### POST /api/support/tickets/:id/comments
Add comment to ticket.

### POST /api/support/tickets/:id/attachments
Upload attachment.

---

## Test Plan

- E2E: submit ticket → appears in inbox → prompt generated → status update
- Attachment upload tests
- Permission tests (admins see all, users see own)
- Prompt generation tests

---

## Definition of Done

- [ ] Support entry point in UI
- [ ] Ticket submission with attachments
- [ ] Auto-capture of environment info
- [ ] Admin inbox view for tickets
- [ ] Auto-generated troubleshoot prompt
- [ ] Ticket lifecycle management
- [ ] All tests passing
- [ ] Deployed to staging/production
