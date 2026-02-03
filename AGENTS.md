# CSCX.AI - Master Agent Instructions

> **READ THIS FIRST**: This file contains critical context for AI agents working on this codebase. Check directory-specific AGENTS.md files for detailed instructions.

## Project Identity

**CSCX.AI** is a production-grade multi-agent Customer Success platform that automates CS workflows through specialized AI agents with human-in-the-loop (HITL) approval.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Express.js, TypeScript, Node.js 20+ |
| AI | LangChain, Claude (Anthropic), Gemini (Google) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (partial), Google OAuth |
| Deployment | Google Cloud Run, Docker |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React 19)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ CustomerList │  │CustomerDetail│  │AgentControl  │       │
│  │              │  │ + Workspace  │  │   Center     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Express.js)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   ORCHESTRATOR                        │   │
│  │   Routes → Specialists → Tools → HITL → Execution    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │Onboard │ │Adoption│ │Renewal │ │  Risk  │ │Strategy│    │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              SERVICES & INTEGRATIONS                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Gemini  │  │ Claude  │  │ Google  │  │Supabase │        │
│  │(primary)│  │(fallback)│  │Workspace│  │   DB    │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## The 5 Specialist Agents

| Agent | Icon | Domain | When Routed |
|-------|------|--------|-------------|
| **Onboarding** | 🚀 | New customer setup | Keywords: kickoff, onboard, new customer |
| **Adoption** | 📈 | Usage & engagement | Keywords: usage, training, adoption |
| **Renewal** | 🔄 | Retention & expansion | Days to renewal < 90, keywords: renewal |
| **Risk** | ⚠️ | Churn prevention | Health score < 60, keywords: risk, churn |
| **Strategic** | 🎯 | Executive engagement | Keywords: QBR, strategic, executive |

## Critical Rules (MUST FOLLOW)

### 1. HITL Approval Policy
```
ALWAYS REQUIRE APPROVAL:
- send_email (external communication)
- book_meeting (calendar commitment)
- share_file (external sharing)

AUTO-APPROVE:
- draft_email (read-only)
- search_drive (read-only)
- calculate_health (analysis)

NEVER ALLOW:
- delete_file
- modify_permissions
```

### 2. Code Quality Gates
```bash
# MUST pass before any commit
npx tsc --noEmit

# Run for frontend changes
npm run dev  # Verify no console errors
```

### 3. Database Safety
- Never run raw SQL in production
- Use migrations for schema changes
- Always use Supabase client with RLS

### 4. Google OAuth
- Tokens expire - always check `expires_at`
- Use `getAuthenticatedClient()` helper
- Never store raw tokens in code

## File Organization

```
cscx-v5/
├── AGENTS.md                 # This file (master instructions)
├── CLAUDE.md                 # Claude Code specific config
├── App.tsx                   # Main React app
├── components/               # React components
│   ├── AGENTS.md            # Component patterns
│   ├── AgentControlCenter/  # Main agent UI
│   ├── AIPanel/             # Embedded assistant
│   └── ...
├── server/
│   ├── AGENTS.md            # Backend patterns
│   └── src/
│       ├── agents/          # Agent definitions
│       │   └── AGENTS.md    # Agent architecture
│       ├── services/        # Business logic
│       │   ├── AGENTS.md    # Service patterns
│       │   └── google/      # Workspace integration
│       │       └── AGENTS.md
│       └── routes/          # API endpoints
│           └── AGENTS.md
├── database/
│   ├── AGENTS.md            # Schema documentation
│   └── migrations/          # SQL migrations
├── types/                   # TypeScript types
│   └── AGENTS.md
├── tasks/                   # PRD files for Ralph
├── scripts/
│   ├── ralph/               # Ralph loop scripts
│   └── compound/            # Compound engineering scripts
└── docs/
    └── RALPH_COMPOUND_WORKFLOW.md
```

## Common Gotchas (Learn From Past Mistakes)

### Frontend
1. **React 19 `use()` hook**: Use for promises instead of useEffect
2. **Tailwind purge**: Don't use dynamic class names like `bg-${color}`
3. **Lucide icons**: Import individually, not `import * from 'lucide-react'`

### Backend
1. **Async routes**: Always `await` async operations before `res.json()`
2. **Error handling**: Use `next(error)`, not `throw` in Express routes
3. **Circuit breaker**: Gemini fails? Falls back to Claude automatically

### Database
1. **RLS policies**: User context must match for queries to work
2. **Timestamps**: Use `timestamptz`, not `timestamp`
3. **JSONB**: Use for flexible data, but index commonly queried fields

### Google Integration
1. **Token refresh**: Handled automatically by oauth.ts
2. **Rate limits**: Gmail 500/day, Calendar 1M queries/day
3. **Batch requests**: Use for multiple operations

## Environment Variables

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GEMINI_API_KEY=AI...
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Optional
LANGSMITH_API_KEY=ls-...
LANGSMITH_PROJECT=cscx
```

## Development Commands

```bash
# Frontend (port 5173)
npm run dev

# Backend (port 3001)
cd server && npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

## When Making Changes

1. **Read relevant AGENTS.md** files in the directories you'll modify
2. **Understand existing patterns** before adding new code
3. **Run type check** before committing
4. **Update AGENTS.md** if you discover new patterns or gotchas
5. **Keep changes focused** - one feature/fix per commit

## Ralph Loop Integration

This project is configured for autonomous Ralph loops:
- PRDs go in `/tasks/prd-*.md`
- Converted to `/scripts/ralph/prd.json` or `/scripts/compound/prd.json`
- Run with `./scripts/ralph/ralph.sh --tool claude 10`
- Progress tracked in `progress.txt`
- Learnings compound into these AGENTS.md files

## Links to Detailed Documentation

- [Architecture](./ARCHITECTURE.md) - Full system design
- [Context](./CONTEXT.md) - Business context
- [API](./docs/API.md) - API documentation
- [Ralph Workflow](./docs/RALPH_COMPOUND_WORKFLOW.md) - Automation setup
