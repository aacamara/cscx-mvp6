# CSCX Platform - Current State Architecture

**Generated**: 2026-02-01
**Version**: 3.0 (10X Refactor)
**Status**: MVP Deployed, Production Hardening Required

---

## Executive Summary

CSCX.AI is a production-grade, multi-agent customer success platform deployed on Google Cloud Run. Features 10 specialized agents, Google Workspace integration, and Supabase PostgreSQL backend with 179 API routes across 361+ service modules.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CSCX.AI PLATFORM (v3)                           │
│                    Production on Google Cloud Run                        │
└─────────────────────────────────────────────────────────────────────────┘

                                   USERS
                                    │
                    ┌───────────────┴────────────────┐
                    ▼                                ▼
           ┌────────────────┐          ┌────────────────────┐
           │  React 19 SPA  │          │  Google Workspace  │
           │  (Vite 6.2)    │          │  (Gmail, Cal, etc) │
           │  Tailwind CSS  │          │  OAuth 2.0         │
           └────────┬───────┘          └────────────────────┘
                    │
                    │ HTTPS
                    ▼
    ┌──────────────────────────────────────────────┐
    │   GOOGLE CLOUD RUN (us-central1)             │
    │   cscx-api-938520514616.us-central1.run.app  │
    ├──────────────────────────────────────────────┤
    │                                              │
    │  ┌────────────────┐  ┌────────────────────┐  │
    │  │ Express.js     │  │ WebSocket Server   │  │
    │  │ Node.js 20     │  │ Real-time Updates  │  │
    │  │ Port 8080      │  │ /ws endpoint       │  │
    │  └───────┬────────┘  └────────────────────┘  │
    │          │                                   │
    │  ┌───────┴────────────────────────────────┐  │
    │  │      AGENT ORCHESTRATION LAYER         │  │
    │  │  ┌──────────────────────────────────┐  │  │
    │  │  │         ORCHESTRATOR             │  │  │
    │  │  │    4-tier Intelligent Routing    │  │  │
    │  │  └─────────────┬────────────────────┘  │  │
    │  │    ┌───────────┼───────────┐           │  │
    │  │    ▼           ▼           ▼           │  │
    │  │ ┌──────┐  ┌──────────┐  ┌────────┐     │  │
    │  │ │Onbrd │  │Adoption  │  │Renewal │     │  │
    │  │ └──────┘  └──────────┘  └────────┘     │  │
    │  │ ┌──────┐  ┌──────────┐                 │  │
    │  │ │ Risk │  │Strategic │                 │  │
    │  │ └──────┘  └──────────┘                 │  │
    │  │                                        │  │
    │  │  Support: Scheduler, Communicator,     │  │
    │  │           Researcher, DataAnalyst,     │  │
    │  │           Knowledge                    │  │
    │  │                                        │  │
    │  │  Tools: 40+ (Customer, Knowledge,      │  │
    │  │         Metrics, Portfolio, Actions)   │  │
    │  └────────────────────────────────────────┘  │
    │                                              │
    │  ┌────────────────────────────────────────┐  │
    │  │  API LAYER: 179 Routes, 361+ Services  │  │
    │  └────────────────────────────────────────┘  │
    │                                              │
    │  ┌────────────────────────────────────────┐  │
    │  │  MIDDLEWARE: Helmet, CORS, Rate Limit, │  │
    │  │              Morgan, Zod Validation    │  │
    │  └────────────────────────────────────────┘  │
    └──────────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┬──────────────┐
    ▼               ▼               ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐
│Supabase  │  │Claude    │  │Gemini    │  │Google      │
│PostgreSQL│  │API       │  │API       │  │Workspace   │
│+ Storage │  │(Primary) │  │(Fallback)│  │APIs        │
└──────────┘  └──────────┘  └──────────┘  └────────────┘
```

---

## Technology Stack

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 19.0.0 |
| Build Tool | Vite | 6.2.0 |
| Language | TypeScript | 5.8.2 |
| Styling | Tailwind CSS | 3.4.17 |
| Router | React Router | 7.12.0 |
| State | React Context + Hooks | - |

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 20 (Alpine) |
| Framework | Express.js | 4.21.2 |
| Language | TypeScript | 5.7.2 |
| WebSocket | ws | 8.18.0 |
| Validation | Zod | 3.24.1 |

### Data Layer
| Component | Technology | Version |
|-----------|-----------|---------|
| Database | Supabase PostgreSQL | Managed |
| ORM/Client | @supabase/supabase-js | 2.47.10 |
| Storage | Supabase Storage | GCS backend |
| Vector Store | In-Memory (MVP) | - |

### AI Services
| Service | Library | Version |
|---------|---------|---------|
| Claude (Primary) | @anthropic-ai/sdk | 0.32.1 |
| Gemini (Fallback) | @google/generative-ai | 0.21.0 |
| LangChain | langchain | 1.2.7 |
| LangGraph | @langchain/langgraph | 1.0.15 |

### Deployment
| Component | Technology |
|-----------|-----------|
| Cloud | Google Cloud Run |
| Container | Docker (multi-stage) |
| CI/CD | GitHub Actions + Cloud Build |
| Domain | TBD (production) |

---

## Data Flow

### Chat → Agents → Actions → Approvals
```
User Chat Message
       │
       ▼
┌──────────────────┐
│ Orchestrator     │ ← Routes to specialist
│ (4-tier routing) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Specialist Agent │ ← Executes with tools
│ (e.g., Renewal)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Action Created   │ ← Stored in DB
│ (requires HITL?) │
└────────┬─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Auto-   │ │Approval│
│Approve │ │Queue   │
└────┬───┘ └────┬───┘
     │          │
     ▼          ▼
┌──────────────────┐
│ Execute Action   │
│ (Email, Meeting) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Update KB        │
│ Log Activity     │
└──────────────────┘
```

### KB Ingestion Flow
```
Source (Drive/Upload/Generated)
       │
       ▼
┌──────────────────┐
│ Extract Text     │ ← PDF, DOCX, Google Docs
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Chunk & Embed    │ ← LangChain + Embeddings
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Store in KB      │ ← Supabase + Vector Index
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Chat Retrieval   │ ← Hybrid Search
└──────────────────┘
```

---

## Current Deployment

**Production URL**: `https://cscx-api-938520514616.us-central1.run.app`

### Cloud Run Configuration
- Memory: 1Gi
- CPU: 1
- Min instances: 0 (scale to zero)
- Max instances: 10
- Health check: GET /health (30s)

### CI/CD Pipeline
1. Push to main → GitHub Actions
2. Run tests (Vitest)
3. Type check (TypeScript)
4. Build frontend + backend
5. Trigger Cloud Build
6. Deploy to Cloud Run
7. PR previews for branches

---

## Gaps to Production

### Critical (Must Fix)

| Gap | Current State | Risk | Solution |
|-----|---------------|------|----------|
| **Job Queue** | In-memory node-cron | Job loss on deploy | Redis + BullMQ |
| **Vector Store** | In-memory | Data loss on restart | Supabase pgvector |
| **Test Coverage** | 1-30% | Regression bugs | Target 70%+ |
| **Rate Limiting** | Basic 100 req/min | DDoS, abuse | Per-user quotas |
| **Invite Gating** | None | Unauthorized access | Invite code system |

### Important (Should Fix)

| Gap | Current State | Risk | Solution |
|-----|---------------|------|----------|
| **Caching** | None | Performance, costs | Redis cache |
| **Logging** | Console only | Debug difficulty | Cloud Logging |
| **Tracing** | LangSmith only | Incomplete visibility | OpenTelemetry |
| **API Docs** | None | Integration difficulty | OpenAPI/Swagger |
| **Backups** | Supabase auto | Untested recovery | DR testing |

### Nice to Have

| Gap | Current State | Improvement |
|-----|---------------|-------------|
| Connection Pool | Supabase default | PgBouncer |
| Multi-region | us-central1 only | Global distribution |
| Canary Deploy | All-or-nothing | Gradual rollout |

---

## Key Services

### Agent System (`server/src/agents/`)
- `orchestrator.ts` - Route to specialists
- `specialists/` - 10 domain agents
- `tools/` - 40+ agent capabilities
- `engine/` - Execution loop

### Google Integration (`server/src/services/google/`)
- `gmail.ts` - Email operations
- `calendar.ts` - Meeting scheduling
- `drive.ts` - File management
- `docs.ts`, `sheets.ts`, `slides.ts` - Document generation

### Core Services (`server/src/services/`)
- `cadg/` - Context-Aware Document Generation
- `approval.ts` - HITL workflow
- `ai/` - Claude/Gemini abstraction
- `usage/` - Health scores, metrics

### Routes (`server/src/routes/`)
- 179 route files
- RESTful API design
- Zod validation on inputs
- Auth middleware protected

---

## Database Schema (Key Tables)

```sql
-- Core
customers (id, name, arr, health_score, stage, csm_id, ...)
stakeholders (id, customer_id, name, email, role, sentiment, ...)
contracts (id, customer_id, text, parsed_at, entitlements, ...)
entitlements (id, contract_id, sku, quantity, limits, ...)

-- Agent System
agent_sessions (id, customer_id, user_id, created_at, ...)
agent_messages (id, session_id, role, content, tool_calls, ...)
approvals (id, action_type, status, payload, reviewed_at, ...)

-- Generated Content
insights (id, customer_id, type, content, confidence, ...)
meetings (id, customer_id, scheduled_at, attendees, ...)
```

---

## Security Controls

### Implemented
- Helmet.js security headers
- CORS configuration
- Rate limiting (basic)
- Supabase Auth (JWT)
- Google OAuth 2.0
- Environment-based secrets

### Needed
- Invite code gating
- Per-user rate limits
- CSRF protection
- File upload validation
- Audit logging
- Secret rotation

---

## Monitoring & Observability

### Current
- Health check endpoint: `/health`
- Metrics endpoint: `/metrics`
- LangSmith for agent traces
- Console logging

### Needed
- Centralized logging (Cloud Logging)
- Error tracking (Sentry)
- Distributed tracing (OpenTelemetry)
- Alerting (PagerDuty/OpsGenie)
- Custom dashboards

---

## Next Steps

1. **PRD-0**: Contract Parsing + Entitlements (foundation)
2. **PRD-1**: Gated Login + Onboarding + Import
3. **PRD-2**: Unified Knowledge Base
4. **PRD-3**: Agent Inbox
5. **PRD-4**: Support Tickets
6. **PRD-5**: Admin Dashboard
7. **PRD-6**: Production Deployment
8. **PRD-7**: E2E Hardening
9. **PRD-8**: Testing Strategy
10. **PRD-9**: Observability
11. **PRD-10**: Security

See `/docs/release/PRODUCTION_READINESS.md` for master checklist.
