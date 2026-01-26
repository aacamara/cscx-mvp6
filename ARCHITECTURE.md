# CSCX.AI Architecture

*Last Updated: January 15, 2026*

## Current State (MVP - Deployed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CURRENT ARCHITECTURE                           │
│                          (Production on Cloud Run)                          │
└─────────────────────────────────────────────────────────────────────────────┘

                                   INTERNET
                                      │
                                      ▼
                           ┌──────────────────┐
                           │   Google Cloud   │
                           │     Run          │
                           │  (Monolithic)    │
                           └────────┬─────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
         ┌──────────────────┐            ┌──────────────────┐
         │  Static Frontend │            │   Express API    │
         │  (React + Vite)  │            │   (Node.js)      │
         │  /public/*       │            │   /api/*         │
         └──────────────────┘            └────────┬─────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
         ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
         │   AI Services    │          │    Supabase      │          │ Google Workspace │
         │                  │          │                  │          │                  │
         │ ┌──────────────┐ │          │ • PostgreSQL     │          │ • Gmail API      │
         │ │Circuit Breaker│ │          │ • Customers      │          │ • Calendar API   │
         │ └──────────────┘ │          │ • Sessions       │          │ • Drive API      │
         │                  │          │ • Messages       │          │                  │
         │ • Gemini 2.0    │          │ • Tasks          │          │ OAuth 2.0        │
         │   (Primary)     │          │ • Approvals      │          │ Token Storage    │
         │                  │          │                  │          │                  │
         │ • Claude        │          │ • Auth (partial) │          │                  │
         │   (Routing +    │          │                  │          │                  │
         │    Fallback)    │          │                  │          │                  │
         └──────────────────┘          └──────────────────┘          └──────────────────┘


PRODUCTION URL: https://cscx-api-938520514616.us-central1.run.app
```

---

## Multi-Agent System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT ORCHESTRATION                               │
│                    (10 Specialists + Intelligent Routing)                   │
└─────────────────────────────────────────────────────────────────────────────┘

                              USER MESSAGE
                                   │
                                   ▼
                        ┌──────────────────┐
                        │   ORCHESTRATOR   │
                        │                  │
                        │ 4-Tier Routing:  │
                        │ 1. Follow-up     │
                        │ 2. Keyword       │
                        │ 3. Context       │
                        │ 4. LLM (Claude)  │
                        └────────┬─────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │           │           │           │           │
         ▼           ▼           ▼           ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ONBOARDING│ │ ADOPTION │ │ RENEWAL  │ │   RISK   │ │STRATEGIC │
   │          │ │          │ │          │ │          │ │          │
   │• Kickoff │ │• Usage   │ │• Renewal │ │• At-risk │ │• QBRs    │
   │• 30-60-90│ │• Training│ │• Upsell  │ │• Save    │ │• Exec    │
   │• Setup   │ │• Features│ │• Pricing │ │• Escalate│ │• Planning│
   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

         ┌───────────────────────┼───────────────────────┐
         │           │           │           │           │
         ▼           ▼           ▼           ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │  EMAIL   │ │ MEETING  │ │KNOWLEDGE │ │ RESEARCH │ │ANALYTICS │
   │          │ │          │ │          │ │          │ │          │
   │• Draft   │ │• Schedule│ │• Playbook│ │• Company │ │• Health  │
   │• Send*   │ │• Prep    │ │• Best    │ │• News    │ │• Trends  │
   │• Reply   │ │• Follow  │ │  Practice│ │• People  │ │• Metrics │
   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

   * = Requires HITL Approval


AGENT HANDOFFS:
┌──────────────────────────────────────────────────────────────────────────────┐
│  Onboarding ───► Meeting ───► Email                                          │
│       │                                                                       │
│       └──────────► Knowledge (search playbooks)                              │
│                                                                               │
│  Risk ───► Strategic (escalation) ───► Email (executive outreach)            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## HITL (Human-in-the-Loop) Approval Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPROVAL FLOW (ADR-001)                              │
│              DO NOT REMOVE - Required for customer safety                   │
└─────────────────────────────────────────────────────────────────────────────┘

    AGENT                      SYSTEM                       USER
    ─────                      ──────                       ────
      │                          │                           │
      │  1. Proposes action      │                           │
      │     (email, meeting)     │                           │
      │ ────────────────────────►│                           │
      │                          │                           │
      │                          │  2. Store in              │
      │                          │     approval_queue        │
      │                          │     status: pending       │
      │                          │                           │
      │                          │  3. Show in UI            │
      │                          │ ─────────────────────────►│
      │                          │                           │
      │                          │                           │  4. Review
      │                          │                           │     • Approve
      │                          │                           │     • Modify
      │                          │                           │     • Reject
      │                          │                           │
      │                          │  5. Decision              │
      │                          │ ◄─────────────────────────│
      │                          │                           │
      │                          │  6. If approved:          │
      │                          │     Execute action        │
      │                          │     (Gmail/Calendar API)  │
      │                          │                           │
      │                          │  7. Log for audit         │
      │                          │                           │


READ-ONLY TOOLS (Execute Immediately):
├── get_todays_meetings
├── get_upcoming_meetings
├── get_recent_emails
├── search_google_drive
├── search_knowledge_base
├── calculate_health_score
└── search_contracts

ACTION TOOLS (Require Approval):
├── schedule_meeting  ──► Creates Google Calendar event
├── draft_email       ──► Sends via Gmail API
└── create_task       ──► Creates in Supabase
```

---

## Resilience Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CIRCUIT BREAKERS (ADR-004)                               │
│              DO NOT REMOVE - Handles real production outages                │
└─────────────────────────────────────────────────────────────────────────────┘

                            ┌─────────────────┐
                            │  API Request    │
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │ Circuit Breaker │
                            │                 │
                            │ States:         │
                            │ • CLOSED (ok)   │
                            │ • OPEN (fail)   │
                            │ • HALF_OPEN     │
                            └────────┬────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
       ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
       │   Claude    │        │   Gemini    │        │  Supabase   │
       │   Breaker   │        │   Breaker   │        │   Breaker   │
       │             │        │             │        │             │
       │ Opens after │        │ Opens after │        │ Opens after │
       │ 5 failures  │        │ 5 failures  │        │ 5 failures  │
       │             │        │             │        │             │
       │ Recovers in │        │ Recovers in │        │ Recovers in │
       │ 30 seconds  │        │ 30 seconds  │        │ 30 seconds  │
       └─────────────┘        └─────────────┘        └─────────────┘


FAILOVER CHAIN:
┌─────────────────────────────────────────────────────────────────────────────┐
│  Primary: Gemini 2.0 Flash (fast, cheap)                                    │
│      │                                                                       │
│      └──► If circuit OPEN ──► Fallback: Claude                              │
│                                                                              │
│  Routing: Always Claude Haiku (determines which specialist)                 │
└─────────────────────────────────────────────────────────────────────────────┘


HEALTH CHECK ENDPOINT: GET /health
{
  "status": "healthy",
  "services": {
    "database": { "status": "connected", "latency": 150 },
    "gemini": { "status": "connected", "latency": 300 },
    "anthropic": { "status": "connected", "latency": 500 }
  },
  "circuitBreakers": {
    "claude": { "state": "CLOSED" },
    "gemini": { "state": "CLOSED" },
    "supabase": { "state": "CLOSED" }
  }
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SESSION PERSISTENCE                               │
│                      (Code ready, deployment pending)                       │
└─────────────────────────────────────────────────────────────────────────────┘

    USER                    BACKEND                   SUPABASE
    ────                    ───────                   ────────
      │                        │                         │
      │  POST /api/ai/chat     │                         │
      │  { message, sessionId }│                         │
      │ ──────────────────────►│                         │
      │                        │                         │
      │                        │  Get/Create Session     │
      │                        │ ───────────────────────►│
      │                        │                         │
      │                        │  ◄── Session + History  │
      │                        │                         │
      │                        │  Route to Specialist    │
      │                        │  (with conversation     │
      │                        │   context)              │
      │                        │                         │
      │                        │  Save User Message      │
      │                        │ ───────────────────────►│
      │                        │                         │
      │                        │  Save AI Response       │
      │                        │ ───────────────────────►│
      │                        │                         │
      │  ◄── Response          │                         │
      │                        │                         │


DATABASE SCHEMA:
┌─────────────────────────────────────────────────────────────────────────────┐
│  agent_sessions                                                             │
│  ├── id (UUID)                                                              │
│  ├── user_id (UUID, nullable)                                               │
│  ├── customer_id (UUID, nullable)                                           │
│  ├── status (active/expired/closed)                                         │
│  ├── context (JSONB - includes _metadata)                                   │
│  ├── created_at                                                             │
│  └── updated_at                                                             │
│                                                                             │
│  agent_messages                                                             │
│  ├── id (UUID)                                                              │
│  ├── session_id (FK)                                                        │
│  ├── role (user/assistant/system)                                           │
│  ├── content (TEXT)                                                         │
│  ├── metadata (JSONB)                                                       │
│  └── created_at                                                             │
│                                                                             │
│  agent_actions                                                              │
│  ├── id (UUID)                                                              │
│  ├── session_id (FK)                                                        │
│  ├── type (email/meeting/task)                                              │
│  ├── status (pending/approved/rejected/executed)                            │
│  ├── data (JSONB)                                                           │
│  └── created_at                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Google Workspace Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GOOGLE WORKSPACE APIs                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   OAuth 2.0 │
                              │   Flow      │
                              └──────┬──────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
     ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
     │   Gmail     │          │  Calendar   │          │   Drive     │
     │             │          │             │          │             │
     │ • Read      │          │ • Read      │          │ • Search    │
     │ • Send*     │          │ • Create*   │          │ • Read      │
     │ • Reply*    │          │ • Update*   │          │             │
     │             │          │ • Meet link │          │             │
     └─────────────┘          └─────────────┘          └─────────────┘

     * = Through HITL approval flow


TOKEN STORAGE:
┌─────────────────────────────────────────────────────────────────────────────┐
│  google_tokens (Supabase)                                                   │
│  ├── user_id                                                                │
│  ├── access_token (encrypted)                                               │
│  ├── refresh_token (encrypted)                                              │
│  ├── expires_at                                                             │
│  └── scopes                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘


SCOPES REQUESTED:
• gmail.readonly, gmail.send, gmail.compose, gmail.modify
• calendar, calendar.events
• drive.readonly, drive.file
```

---

## File Structure

```
cscx-mvp/
├── App.tsx                          # Main React app with view routing
├── components/
│   ├── AgentControlCenter/          # AI chat interface
│   ├── AIAssistant.tsx              # Floating AI assistant
│   ├── CustomerList.tsx             # CRM customer list
│   ├── CustomerDetail.tsx           # 360° customer view
│   ├── PendingApprovals.tsx         # HITL approval UI
│   ├── GoogleConnectionWidget.tsx   # OAuth connection status
│   └── [visualization components]
├── context/
│   └── AuthContext.tsx              # Supabase auth state
├── lib/
│   └── supabase.ts                  # Supabase client
│
├── server/
│   ├── src/
│   │   ├── index.ts                 # Express app + static serving
│   │   ├── routes/
│   │   │   ├── agents.ts            # Agent chat + sessions
│   │   │   ├── langchain.ts         # /api/ai/chat endpoint
│   │   │   ├── customers.ts         # Customer CRUD
│   │   │   ├── google/              # Google OAuth + APIs
│   │   │   └── approvals.ts         # HITL endpoints
│   │   ├── services/
│   │   │   ├── approval.ts          # Approval logic + execution
│   │   │   ├── session.ts           # Session persistence
│   │   │   ├── health.ts            # Health checks
│   │   │   ├── circuitBreaker.ts    # Circuit breaker impl
│   │   │   ├── gemini.ts            # Gemini API
│   │   │   ├── claude.ts            # Claude API
│   │   │   └── google/              # Gmail, Calendar services
│   │   └── langchain/
│   │       ├── agents/
│   │       │   ├── orchestrator.ts  # 4-tier routing
│   │       │   └── specialists/     # 10 specialist agents
│   │       └── tools/
│   │           └── index.ts         # 20 tools defined
│   └── public/                      # Built frontend (from dist/)
│
├── docs/
│   ├── adr/                         # Architecture Decision Records
│   │   ├── 001-hitl-approval.md
│   │   ├── 002-multi-agent.md
│   │   ├── 003-session-persistence.md
│   │   ├── 004-circuit-breakers.md
│   │   ├── 005-monolithic-deploy.md
│   │   └── 006-relative-urls.md
│   ├── PLATFORM_EVALUATION.md       # Agentic system assessment
│   └── AGENTS.md                    # Agent documentation
│
└── CLAUDE.md                        # Project context for AI agents
```

---

## Current vs Target State

| Aspect | Current (MVP) | Target (Enterprise) |
|--------|---------------|---------------------|
| **Hosting** | Cloud Run (monolithic) | Cloud Run + CDN |
| **Database** | Supabase PostgreSQL | Same + Read replicas |
| **Auth** | OAuth UI (not enforced) | Supabase Auth + SSO |
| **Sessions** | In-memory (persistence ready) | Supabase persistent |
| **AI Routing** | 10 specialists | Same + custom training |
| **Email** | Gmail API | Gmail + Outlook |
| **Calendar** | Google Calendar | Google + Outlook |
| **HITL** | Manual approval | Templates + auto-approve |
| **Monitoring** | Health endpoint | DataDog + Sentry |
| **Multi-tenant** | Single tenant | RLS isolation |

---

## Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT PROCESS                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    LOCAL                    BUILD                    CLOUD RUN
    ─────                    ─────                    ─────────
      │                        │                         │
      │  1. Build frontend     │                         │
      │     VITE_API_URL=""    │                         │
      │     npm run build      │                         │
      │                        │                         │
      │  2. Copy to server     │                         │
      │     cp -r dist/*       │                         │
      │     server/public/     │                         │
      │                        │                         │
      │  3. Deploy             │                         │
      │     gcloud run deploy  │                         │
      │     --source server/   │ ───────────────────────►│
      │                        │                         │
      │                        │  Build container        │
      │                        │  Deploy revision        │
      │                        │  Route traffic          │
      │                        │                         │


CURRENT REVISION: cscx-api-00040-4wk (rolled back)
KNOWN ISSUE: Session persistence deployment broke frontend (ADR-006)
```

---

## Key Architecture Decisions

See `docs/adr/` for detailed rationale:

| ADR | Decision | Reason |
|-----|----------|--------|
| 001 | HITL for all actions | Customer safety, audit trail |
| 002 | 10 specialist agents | Domain expertise, focused prompts |
| 003 | Hybrid session storage | Performance (cache) + durability (DB) |
| 004 | Circuit breakers | Handled real Gemini outage |
| 005 | Monolithic deploy | Simpler for MVP, no CORS |
| 006 | Relative API URLs | Works on any domain |

---

## Tech Stack

```
FRONTEND:           BACKEND:            DATABASE:           AI:
─────────           ────────            ─────────           ───
React 19            Express             PostgreSQL          Gemini 2.0 Flash
TypeScript          TypeScript          Supabase            Claude (routing)
Tailwind CSS        Node.js 20+                             Claude (fallback)
Vite                LangChain

INTEGRATIONS:       INFRASTRUCTURE:     OBSERVABILITY:
─────────────       ───────────────     ─────────────
Gmail API           Google Cloud Run    Health endpoint
Google Calendar     Supabase            Circuit breaker stats
Google Drive        (single container)  Agent tracing
```

---

*Architecture Document - CSCX.AI*
*Last Updated: January 15, 2026*
