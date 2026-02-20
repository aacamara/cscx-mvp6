# CSCX.AI v3 — Agent Instructions

## Overview
AI-native Customer Success platform. React 19 + TypeScript + Vite + Tailwind (frontend), Express + TypeScript + Node.js (backend), Supabase PostgreSQL (database), Claude Agent SDK patterns (AI).

## How We Build
Read [docs/HOW_WE_BUILD.md](docs/HOW_WE_BUILD.md) for the Code Factory methodology. All code is written by agents, reviewed by CodeRabbit, and enforced by the repo.

## Risk Policy
All changes are classified by `.github/risk-policy.json`. Critical paths (auth, org filtering, migrations) require human approval and browser evidence. See [docs/security/SECURITY.md](docs/security/SECURITY.md).

## Deep Docs (read as needed)
- [docs/architecture/CURRENT_STATE.md](docs/architecture/CURRENT_STATE.md) — Current architecture snapshot
- [docs/architecture/agent-system.md](docs/architecture/agent-system.md) — Agent types, tools, approval matrix, SSE streaming
- [docs/architecture/multi-tenancy.md](docs/architecture/multi-tenancy.md) — Org filtering, isolation guarantees, query helpers
- [docs/architecture/cadg-system.md](docs/architecture/cadg-system.md) — 24 card types, task classifier, adding new cards
- [docs/security/SECURITY.md](docs/security/SECURITY.md) — Auth flow, data isolation, prohibited actions
- [docs/quality/QUALITY_SCORE.md](docs/quality/QUALITY_SCORE.md) — Quality grades per domain, improvement strategy
- [docs/prd/](docs/prd/) — Product requirement documents (PRD-0 through PRD-10)

## Project Structure
```
App.tsx                    # 5-view navigation (customers, customer-detail, onboarding, login, auth-callback)
components/                # React components (139 dirs, 500+ files)
  AIPanel/                 # Context-aware AI assistant
  AgentControlCenter/      # Main agent chat UI with SSE streaming
  UnifiedOnboarding.tsx    # Two-column layout with AI panel
server/src/
  agents/                  # Agent architecture (specialists/, tools/, engine/)
  langchain/               # LangChain/Claude integration + WorkflowAgent
  middleware/auth.ts        # CRITICAL: JWT verification + org resolution
  middleware/orgFilter.ts   # CRITICAL: Org-scoped query helpers
  routes/                  # 173 API routes
  services/cadg/           # Context-Aware Document Generation
  services/google/         # Google Workspace integration (11 service files)
database/migrations/       # 97 SQL migration files
```

## Commands
```bash
npm run dev                    # Frontend (Vite, port 5173)
cd server && npm run dev       # Backend (Express, port 3001)
npm run build                  # Production build
npm run lint                   # ESLint frontend
npm run lint:server            # ESLint server
cd server && npm test          # Vitest

# Harness commands (Code Factory)
npm run harness:risk-tier      # Show risk tier pattern counts
npm run harness:delta-ts       # Delta TS check (server)
npm run harness:delta-lint     # Delta lint check (changed files)
npm run harness:org-filter     # Check route files for auth/org imports
npm run harness:pre-pr         # Full pre-PR check (lint + ts + tests)
```

## Navigation
1. **Customers** — List + 360 detail with workspace
2. **+ New Onboarding** — Unified flow with AI panel
3. **Mission Control** — Agent observability (modal)

## Workflow Phases
```
upload → parsing → review → enriching → planning → plan_review → executing → monitoring → completed
```

## Rules
1. DO NOT recreate standalone AI Assistant or Integrations views
2. Use embedded AIPanel for AI interactions
3. WorkspacePanel is per-customer, not global
4. Follow phase state machine in `types/workflow.ts`
5. New agents go in `server/src/agents/specialists/`
6. New CADG cards require updates to: `taskClassifier.ts`, `contextAggregator.ts`, `reasoningEngine.ts`
7. Chat streaming: `/api/ai/chat/stream` (SSE) — fallback: `/api/ai/chat`
8. Every route MUST use auth middleware + org filtering
9. Every migration table MUST include `organization_id`
10. Never add `@ts-ignore` to auth/security code

## Brand Colors
```
cscx-accent: #e63946    cscx-black: #000000
cscx-gray-900: #0a0a0a  cscx-gray-800: #222222
```

## Original MVP
Preserved at `/Users/azizcamara/Downloads/cscx-mvp` — DO NOT MODIFY.
