# Agent System Architecture

## Agents

| Agent | Role | Tools |
|-------|------|-------|
| Orchestrator | Coordinate all activities | delegate_to_agent, request_human_approval, update_task_ledger |
| Scheduler | Manage calendar/meetings | check_availability, propose_meeting, book_meeting |
| Communicator | Draft/send emails | draft_email, send_email, create_sequence |
| Researcher | Gather intelligence | research_company, map_stakeholders, detect_churn_signals |
| Data Analyst | Analyze data | query_metrics, generate_reports |

## Approval Policies

| Action | Policy |
|--------|--------|
| `send_email` | Always requires approval (blocking) |
| `book_meeting` | Always requires approval (important) |
| `update_crm` | Auto-approve minor changes |
| `internal_note` | Auto-approve |
| `research_action` | Auto-approve |

## HITL Approval Matrix

```
always_approve   -> Research, read-only actions
auto_approve     -> Drafts, document creation
require_approval -> Send email, book meeting, share files
never_approve    -> Delete files, modify permissions
```

## Key Files

- `server/src/agents/types.ts` - Core types, permissions, context
- `server/src/agents/index.ts` - Agent registry, approval policies
- `server/src/agents/specialists/orchestrator.ts` - Main coordinator
- `server/src/agents/specialists/scheduler.ts` - Calendar/meetings
- `server/src/agents/specialists/communicator.ts` - Email/sequences
- `server/src/agents/specialists/researcher.ts` - Intelligence/risk
- `server/src/agents/specialists/dataAnalyst.ts` - Data analysis

## SSE Streaming Architecture

```
Frontend (AgentControlCenter)          Backend (langchain.ts)
         |                                      |
         |  POST /api/ai/chat/stream            |
         | ----------------------------------->|
         |                                      |
         |  SSE: {type:'token', content:'Hi'}   |
         | <-----------------------------------|
         |  SSE: {type:'done', content:{...}}   |
         | <-----------------------------------|
```

**Event Types:** `token`, `tool_start`, `tool_end`, `done`, `error`

**Key Components:**
- `WorkflowAgent.chatStream()` - Streams Claude responses
- `POST /api/ai/chat/stream` - SSE endpoint in `langchain.ts`
- `sendToAgentRegular()` - Frontend SSE consumer
- `parseSSEData()` - SSE chunk parser with partial line buffering

**CADG Handling:** CADG plan responses are NOT streamed — they return instantly as a single `done` event with plan metadata for the CADGPlanCard.
