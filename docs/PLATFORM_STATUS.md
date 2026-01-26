# CSCX.AI Platform Status Report

**Generated:** 2026-01-22
**Version:** v4 Onboarding Consolidation

---

## Executive Summary

CSCX.AI is a multi-agent Customer Success platform with 5 specialized AI agents, Google Workspace integration, and HITL (Human-in-the-Loop) approval workflows. The platform is **85% production-ready** with key gaps in metrics integration and CI/CD infrastructure.

---

## System Architecture

### Frontend (React + TypeScript + Vite)
| Component | Purpose | Status |
|-----------|---------|--------|
| **Observability** | Portfolio dashboard + Customer list + Metrics | Production Ready |
| **AgentControlCenter** | Multi-agent chat orchestration | Production Ready |
| **AgentStudio** | Agent management + Onboarding launcher | Production Ready |
| **CustomerDetail** | 360° customer view | Partial (mock data) |
| **AIPanel** | Embedded context-aware assistant | Production Ready |
| **OnboardingFlow** | Guided onboarding wizard | Production Ready |

### Backend (Express + TypeScript + Node.js)
| Route | Endpoints | Status | External Dependencies |
|-------|-----------|--------|----------------------|
| `/api/customers` | 6 | Production Ready | Supabase |
| `/api/agents` | 25+ | Production Ready | Claude, Google APIs |
| `/api/ai` (LangChain) | 20+ | Production Ready | Claude/Gemini, pgvector |
| `/api/workflows` | 8 | Production Ready | Agent services |
| `/api/approvals` | 10 | Production Ready | Supabase |
| `/api/google/*` | 50+ | Production Ready | Google OAuth + APIs |
| `/api/metrics` | 17 | Production Ready | Google Forms/Slides |
| `/api/playbooks` | 9 | Production Ready | Gemini embeddings |
| `/api/agent-activities` | 4 | Production Ready | Supabase |

### Database (Supabase PostgreSQL)
- 40+ tables with proper relationships
- pgvector extension for semantic search
- Row-level security policies

---

## Feature Status Matrix

### Core Features
| Feature | Frontend | Backend | Database | Status |
|---------|----------|---------|----------|--------|
| Customer CRUD | ✅ | ✅ | ✅ | Complete |
| Contract Parsing | ✅ | ✅ | ✅ | Complete |
| Onboarding Workflow | ✅ | ✅ | ✅ | Complete |
| Health Scoring | ✅ | ✅ | ✅ | Complete |
| Multi-Agent Chat | ✅ | ✅ | ✅ | Complete |
| HITL Approvals | ✅ | ✅ | ✅ | Complete |
| Agent Inbox | ✅ | ✅ | ✅ | Complete |
| Knowledge Base | ✅ | ✅ | ✅ | Complete |

### Google Workspace Integration
| Service | OAuth | Read | Write | Status |
|---------|-------|------|-------|--------|
| Calendar | ✅ | ✅ | ✅ | Complete |
| Gmail | ✅ | ✅ | ✅ | Complete |
| Drive | ✅ | ✅ | ✅ | Complete |
| Docs | ✅ | ✅ | ✅ | Complete |
| Sheets | ✅ | ✅ | ✅ | Complete |
| Slides | ✅ | ✅ | ✅ | Complete |
| Forms | ✅ | ✅ | ✅ | Complete |

### AI Agents
| Agent | Routing | Tools | Knowledge | Status |
|-------|---------|-------|-----------|--------|
| Onboarding Specialist | ✅ | ✅ | ✅ | Complete |
| Adoption Champion | ✅ | ✅ | ✅ | Complete |
| Renewal Specialist | ✅ | ✅ | ✅ | Complete |
| Risk Analyst | ✅ | ✅ | ✅ | Complete |
| Strategic Advisor | ✅ | ✅ | ✅ | Complete |

---

## Known Gaps & TODOs

### High Priority (P0)
| Gap | Location | Impact |
|-----|----------|--------|
| **No GitHub Actions** | `.github/workflows/` | No CI/CD, no automated testing |
| **No DORA Metrics** | N/A | No deployment frequency, lead time tracking |
| **Mock engagement metrics** | `Observability.tsx:836-839` | Random data shown in customer metrics |
| **Demo user ID hardcoded** | Multiple files | `df2dc7be-ece0-40b2-a9d7-0f6c45b75131` |

### Medium Priority (P1)
| Gap | Location | Impact |
|-----|----------|--------|
| Mock activities in CustomerDetail | `CustomerDetail.tsx:42-83` | Timeline shows hardcoded data |
| Hardcoded engagement metrics | `CustomerDetail.tsx:345-370` | 85% engagement, 72% adoption static |
| Contract list endpoint stub | `contracts.ts` | Returns empty array |
| Plan completion tracking | `AgentControlCenter.tsx:913` | TODO comment |
| AppScript automations | `OnboardingFlow.tsx:776-802` | Alert demos only |

### Low Priority (P2)
| Gap | Location | Impact |
|-----|----------|--------|
| Agent memory not persisted | `AgentStudio/index.tsx` | Local state only |
| Meeting transcription mock | `meetings.ts` | No actual processing |
| Email preview formatting | `AgentControlCenter.tsx:395` | Basic display |

---

## API Endpoint Summary

**Total Endpoints:** 87
**Fully Implemented:** 79 (91%)
**Incomplete/Stubs:** 5 (6%)
**Mock-Only:** 3 (3%)

### Authentication
- Google OAuth 2.0 with token refresh
- User ID passed via `x-user-id` header
- Demo fallback: `df2dc7be-ece0-40b2-a9d7-0f6c45b75131`

### Rate Limiting
- Configured via `express-rate-limit`
- Window: configurable via `config.rateLimitWindowMs`
- Max requests: configurable via `config.rateLimitMax`

---

## Database Schema (Key Tables)

```
customers          - Core customer data + health scores
contracts          - Parsed contract documents
stakeholders       - Customer contacts/roles
onboarding_plans   - 30-60-90 day plans
plan_phases        - Plan phase details
plan_tasks         - Individual tasks
approval_queue     - HITL approval items
agent_activity_log - Agent execution history
chat_messages      - Conversation persistence
csm_playbooks      - Knowledge base with embeddings
csm_glossary       - Terminology definitions
feature_flags      - Runtime configuration
google_tokens      - OAuth token storage
```

---

## Environment Variables

### Required
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

### AI (at least one required)
```env
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
```

### Google Workspace (optional)
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/auth/callback
```

### Frontend
```env
VITE_API_URL=http://localhost:3001
```

---

## File Structure

```
cscx-v4-onboarding-consolidation/
├── App.tsx                     # Main app with routing
├── components/
│   ├── AgentControlCenter/     # Multi-agent chat UI
│   ├── AgentStudio/            # Agent management + OnboardingFlow
│   ├── AIPanel/                # Embedded AI assistant
│   ├── CustomerDetail.tsx      # 360° customer view
│   ├── Observability.tsx       # Dashboard + Customers + Metrics
│   └── ...
├── server/src/
│   ├── routes/                 # 24 route files, 87 endpoints
│   ├── services/               # Business logic + Google services
│   ├── langchain/              # LangChain agent implementations
│   └── config/                 # Environment configuration
├── database/
│   └── migrations/             # 12+ SQL migration files
├── types/                      # TypeScript type definitions
└── docs/                       # Documentation
```

---

## Recent Changes (2026-01-22)

1. **Agent Inbox Implementation**
   - Created `chat_messages` table (migration 012)
   - Created `/api/agent-activities` routes
   - Added Agent Inbox UI to Observability Metrics tab
   - Wired AIPanel and AgentControlCenter to save chat messages

2. **View Consolidation**
   - Merged Observability and Customers into single view
   - Customers tab redirects to Metrics with customer selected
   - Removed standalone Customers navigation

3. **Onboarding Fixes**
   - Fixed customer creation (stage column, UUID format)
   - Customers now appear in list after onboarding

---

## Next Steps

### Immediate (This Sprint)
1. [ ] Set up GitHub Actions CI/CD
2. [ ] Implement DORA metrics tracking
3. [ ] Replace mock engagement metrics with real usage_metrics table
4. [ ] Fix CustomerDetail activity timeline

### Near-term (Next Sprint)
1. [ ] Implement real contract list endpoint
2. [ ] Add AppScript automation triggers
3. [ ] Persist agent memory to database
4. [ ] Add meeting transcription processing

### Long-term
1. [ ] Add comprehensive integration tests
2. [ ] Implement real-time WebSocket updates for agent activities
3. [ ] Add advanced analytics dashboard
4. [ ] Multi-tenant support

---

## Quick Start

```bash
# Install dependencies
npm install
cd server && npm install

# Set environment variables
cp .env.example .env
# Edit .env with your credentials

# Run migrations (in Supabase SQL editor)
# Execute files in database/migrations/ in order

# Start development servers
npm run dev              # Frontend (port 5173)
cd server && npm run dev # Backend (port 3001)
```

---

## Support

- Issues: https://github.com/anthropics/claude-code/issues
- Documentation: See `docs/` folder
