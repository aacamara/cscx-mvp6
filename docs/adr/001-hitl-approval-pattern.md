# ADR-001: Human-in-the-Loop Approval Pattern

## Status
Accepted

## Context

CSCX.AI uses AI agents that can take real-world actions: sending emails, scheduling meetings, creating tasks. These actions have consequences - a poorly worded email or wrong meeting time damages customer relationships.

We considered three approaches:
1. **Fully autonomous** - Agents execute actions without approval
2. **Fully manual** - Agents only draft, humans do everything
3. **HITL (Human-in-the-Loop)** - Agents propose, humans approve, system executes

## Decision

We chose **HITL approval for all consequential actions**.

**Read-only tools execute immediately:**
- `get_todays_meetings`
- `get_recent_emails`
- `search_knowledge_base`
- `calculate_health_score`

**Action tools require human approval:**
- `schedule_meeting` - Creates calendar events
- `draft_email` - Sends via Gmail
- `create_task` - Creates in database

The approval flow:
1. Agent proposes action with full details
2. Action stored in `approval_queue` with `pending` status
3. User reviews in PendingApprovals UI
4. User can approve, modify, or reject
5. On approval, `executeAction()` calls real APIs
6. Feedback recorded for future analysis

## Consequences

**Benefits:**
- Safety - No emails sent without human review
- Trust - Users trust the system because they control it
- Learning - Approval patterns reveal what agents get right/wrong
- Compliance - Audit trail for all customer communications

**Drawbacks:**
- Friction - Every action requires user interaction
- Latency - Can't respond to time-sensitive situations automatically
- Scale limits - One human can only approve so many actions

**Future consideration:** Add "auto-approve" for templated actions or low-risk scenarios, but this should be opt-in per customer.

## Metadata
- **Subsystem:** services/approval, agents/specialists
- **Key files:**
  - `server/src/services/approval.ts` (approval logic + execution)
  - `server/src/langchain/agents/specialists/index.ts` (tool definitions)
  - `components/PendingApprovals.tsx` (UI)
- **Related ADRs:** ADR-002
