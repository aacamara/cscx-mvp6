# CSCX.AI v3 - 10X Refactored Platform

## Project Overview
CSCX.AI v3 is a **production-grade multi-agent Customer Success platform** built with the Claude Agent SDK architecture patterns. This version represents a major refactor from the MVP.

## 10X Refactor Changes

### What Changed
1. **Unified Navigation** - Removed standalone AI Assistant and Integrations views
2. **Embedded AI Panel** - Context-aware assistant embedded in onboarding workflow
3. **Simplified Views** - From 9 view types to 5 (`customers`, `customer-detail`, `onboarding`, `login`, `auth-callback`)
4. **New Agent Architecture** - TypeScript-first agent definitions with tools and permissions
5. **Phase-Based Workflow** - State machine for onboarding phases
6. **Customer Workspace** - Google Workspace integration embedded in CustomerDetail

### Architecture Highlights
- **Two-column onboarding layout**: 70% main content, 30% AI panel
- **Orchestrator pattern**: Central agent delegates to specialists
- **HITL approval policies**: Granular control over agent actions
- **Per-customer workspace**: Gmail/Calendar/Drive scoped to each customer

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express + TypeScript + Node.js
- **AI:** Claude Agent SDK architecture patterns
- **Database:** Supabase PostgreSQL

## Project Structure
```
cscx-v3/
├── App.tsx                          # Simplified 5-view navigation
├── components/
│   ├── AIPanel/                     # Context-aware AI assistant (NEW)
│   ├── UnifiedOnboarding.tsx        # Two-column layout with AI (NEW)
│   ├── WorkspacePanel.tsx           # Per-customer workspace (NEW)
│   ├── CustomerDetail.tsx           # With embedded workspace
│   ├── CustomerList.tsx             # Customer grid
│   └── AgentControlCenter/          # Agent execution UI (clickable agents)
├── types/
│   └── workflow.ts                  # Phase state machine (NEW)
├── server/src/
│   ├── agents/                      # Agent architecture (NEW)
│   │   ├── types.ts                 # Core types, permissions, context
│   │   ├── index.ts                 # Agent registry, approval policies
│   │   └── specialists/
│   │       ├── orchestrator.ts      # Main coordinator
│   │       ├── scheduler.ts         # Calendar/meetings
│   │       ├── communicator.ts      # Email/sequences
│   │       └── researcher.ts        # Intelligence/risk
│   ├── routes/
│   └── services/
│       └── google/                  # Full Google Workspace integration
│           ├── oauth.ts             # OAuth2 authentication
│           ├── gmail.ts             # Email sending/drafts
│           ├── calendar.ts          # Events/meetings
│           ├── drive.ts             # File management
│           ├── docs.ts              # Document templates
│           ├── sheets.ts            # Spreadsheet templates
│           ├── slides.ts            # Presentation templates
│           ├── scripts.ts           # Apps Script automation
│           ├── approval.ts          # HITL approval policies
│           ├── workspace.ts         # Per-customer isolation
│           ├── agentActions.ts      # Unified agent interface
│           └── index.ts             # Service exports
└── docs/
```

## Workflow Phases
```
upload → parsing → review → enriching → planning → plan_review → executing → monitoring → completed
```

## Key Files
- `App.tsx` - Simplified 5-view navigation
- `components/UnifiedOnboarding.tsx` - Two-column layout with embedded AI
- `components/AIPanel/index.tsx` - Context-aware AI assistant
- `components/WorkspacePanel.tsx` - Customer-specific Google Workspace
- `types/workflow.ts` - Phase state machine and reducer
- `server/src/agents/types.ts` - Agent architecture types
- `server/src/agents/specialists/orchestrator.ts` - Main coordinator agent

## Agent Architecture

### Agents
| Agent | Role | Tools |
|-------|------|-------|
| Orchestrator | Coordinate all activities | delegate_to_agent, request_human_approval, update_task_ledger |
| Scheduler | Manage calendar/meetings | check_availability, propose_meeting, book_meeting |
| Communicator | Draft/send emails | draft_email, send_email, create_sequence |
| Researcher | Gather intelligence | research_company, map_stakeholders, detect_churn_signals |

### Approval Policies
- `send_email` - Always requires approval (blocking)
- `book_meeting` - Always requires approval (important)
- `update_crm` - Auto-approve minor changes
- `internal_note` - Auto-approve
- `research_action` - Auto-approve

## Google Workspace Integration

### Service Layer (`server/src/services/google/`)
Full production-ready integration with all Google Workspace products:

| Service | File | Purpose |
|---------|------|---------|
| OAuth | `oauth.ts` | OAuth2 authentication with full scopes |
| Gmail | `gmail.ts` | Send/draft emails, manage threads |
| Calendar | `calendar.ts` | Book meetings, check availability |
| Drive | `drive.ts` | File management, customer folders |
| Docs | `docs.ts` | Document templates with placeholders |
| Sheets | `sheets.ts` | Spreadsheet templates, data tracking |
| Slides | `slides.ts` | Presentation templates |
| Scripts | `scripts.ts` | Apps Script automation engine |
| Approval | `approval.ts` | HITL approval policies |
| Workspace | `workspace.ts` | Per-customer isolation |
| Agent Actions | `agentActions.ts` | Unified interface for agents |

### Document Templates
Pre-built templates with `{{placeholder}}` variable substitution:

**Docs:** QBR Report, Meeting Notes, Onboarding Plan, Success Plan, Renewal Proposal, Value Summary, Escalation Report, Save Play, Account Plan

**Sheets:** Health Score Tracker, Renewal Tracker, Onboarding Tracker, Usage Metrics, Customer Scorecard, QBR Metrics, Risk Dashboard, Adoption Tracker

**Slides:** QBR Presentation, Kickoff Deck, Training Presentation, Executive Briefing, Renewal Presentation, Value Summary, Escalation Deck, Adoption Report

### Apps Script Automations
Pre-built automation scripts in `AUTOMATION_SCRIPTS`:
- `healthScoreCalculator` - Calculate health scores from usage data
- `renewalAlerts` - Send alerts at 90/60/30/7 days before renewal
- `meetingPrep` - Generate pre-meeting briefs automatically
- `weeklyDigest` - Send weekly CSM summaries
- `usageTracker` - Track and trend usage metrics
- `npsFollowUp` - Process NPS responses with segmented follow-ups

### HITL Approval Matrix
Policy-based approval for agent actions:
```
always_approve  → Research, read-only actions
auto_approve    → Drafts, document creation
require_approval → Send email, book meeting, share files
never_approve   → Delete files, modify permissions
```

### Per-Customer Workspace Isolation
Each customer gets isolated folder structure:
```
CSCX - {CustomerName}/
├── 01 - Onboarding/
├── 02 - Meetings/
├── 03 - QBRs/
├── 04 - Contracts/
└── 05 - Reports/
```

### Agent → Google Product Matrix
| Agent | Gmail | Calendar | Drive | Docs | Sheets | Slides | Scripts |
|-------|-------|----------|-------|------|--------|--------|---------|
| Onboarding | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Adoption | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Renewal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Risk | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Strategic | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Commands
```bash
# Development
npm run dev              # Frontend (port 5173)
cd server && npm run dev # Backend (port 3001)

# Build
npm run build           # Production build

# Type Check
npx tsc --noEmit        # Verify TypeScript
```

## Navigation (v3)
Only 3 navigation items:
1. **Customers** - List + 360° detail with workspace
2. **+ New Onboarding** - Unified flow with AI panel
3. **Mission Control** - Agent observability (modal)

## When Working on This Project
1. **DO NOT** recreate standalone AI Assistant or Integrations views
2. Use the embedded AIPanel for AI interactions
3. WorkspacePanel should be per-customer, not global
4. Follow the phase state machine in `types/workflow.ts`
5. New agents go in `server/src/agents/specialists/`

## Brand Colors
```
cscx-accent: #e63946 (red)
cscx-black: #000000
cscx-gray-900: #0a0a0a
cscx-gray-800: #222222
```

## Original MVP
The original MVP is preserved at `/Users/azizcamara/Downloads/cscx-mvp` - DO NOT MODIFY.
