# CSCX.AI

**AI-Powered Customer Success Platform with Multi-Agent Orchestration**

Production-ready platform for automated customer onboarding, featuring intelligent contract parsing, multi-agent AI orchestration, and real-time observability.

## Features

- **Contract Intelligence**: Upload contracts (PDF/text) and automatically extract customer data, stakeholders, entitlements, and technical requirements
- **Multi-Agent Orchestration**: 10 specialized AI agents (Onboarding, Email, Meeting, Research, Adoption, Renewal, Risk, Analytics, Strategic, Knowledge)
- **Agent Observability**: Real-time tracing with Supabase persistence and LangSmith integration
- **Human-in-the-Loop**: Approval workflows for sensitive actions
- **Production Ready**: Circuit breakers, health checks, feature flags, and comprehensive error handling

## Architecture

```
                                   CSCX.AI Architecture

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                              Frontend (React)                            │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
    │  │   Contract   │  │  Handoff     │  │    Agent     │  │   Agent     │  │
    │  │   Upload     │──▶│  Screen     │──▶│   Control    │  │Observability│  │
    │  │              │  │              │  │   Center     │  │   (React    │  │
    │  └──────────────┘  └──────────────┘  └──────────────┘  │    Flow)    │  │
    └─────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                          Backend (Express + TypeScript)                  │
    │  ┌──────────────┐  ┌──────────────────────────────────────────────────┐ │
    │  │   Contract   │  │              Agent Orchestrator                   │ │
    │  │   Parser     │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
    │  │  (Gemini)    │  │  │Onboard  │ │ Email   │ │Meeting  │ │Research │ │ │
    │  └──────────────┘  │  │ Agent   │ │ Agent   │ │ Agent   │ │ Agent   │ │ │
    │                    │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
    │  ┌──────────────┐  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
    │  │   Agent      │  │  │Adoption │ │Renewal  │ │  Risk   │ │Analytics│ │ │
    │  │   Tracer     │  │  │ Agent   │ │ Agent   │ │ Agent   │ │ Agent   │ │ │
    │  │(Observability)│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
    │  └──────────────┘  └──────────────────────────────────────────────────┘ │
    └─────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
            ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
            │   Supabase   │   │    Claude    │   │    Gemini    │
            │  (Database)  │   │  (Anthropic) │   │   (Google)   │
            └──────────────┘   └──────────────┘   └──────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Cloud account (for deployment)
- Supabase account
- Anthropic API key
- Google Gemini API key

### Local Development

```bash
# 1. Clone and install
git clone <repo-url>
cd cscx-mvp

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your API keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   GEMINI_API_KEY=AI...
#   SUPABASE_URL=https://xxx.supabase.co
#   SUPABASE_SERVICE_KEY=eyJ...

# 3. Run database migration (in Supabase SQL Editor)
# Copy contents of database/migrations/001_initial_schema.sql

# 4. Start development servers
cd server && npm run dev    # Backend on port 3001
npm run dev                  # Frontend on port 5173 (in another terminal)

# 5. Open http://localhost:5173
```

## API Endpoints

### Health & Status
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Full health check with service status |
| `/health/live` | GET | Kubernetes liveness probe |
| `/health/ready` | GET | Kubernetes readiness probe |

### Agent Orchestration
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents/orchestrator/chat` | POST | Send message to agent orchestrator |
| `/api/agents/orchestrator/state` | GET | Get current orchestrator state |
| `/api/agents/chat/:specialist` | POST | Chat with specific specialist |
| `/api/agents/approve/:id` | POST | Approve pending action (HITL) |

### Agent Observability
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents/runs` | GET | List agent runs for user |
| `/api/agents/runs/:id` | GET | Get specific run details |
| `/api/agents/runs/:id/visualization` | GET | Get trace visualization data |
| `/api/agents/stats` | GET | Get agent execution statistics |

### Contract Parsing
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/contracts/parse` | POST | Parse uploaded contract |
| `/api/contracts/analyze` | POST | Generate intelligence from contract |

## Deployment to Google Cloud Run

### 1. Set Up Google Cloud

```bash
# Install gcloud CLI if not already installed
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com
```

### 2. Create Secrets in Secret Manager

```bash
# Create secrets for API keys and credentials
echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "your-gemini-key" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "https://xxx.supabase.co" | gcloud secrets create SUPABASE_URL --data-file=-
echo -n "your-supabase-service-key" | gcloud secrets create SUPABASE_SERVICE_KEY --data-file=-
echo -n "your-google-client-id" | gcloud secrets create GOOGLE_CLIENT_ID --data-file=-
echo -n "your-google-client-secret" | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-

# Grant Cloud Run access to secrets
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Deploy with Cloud Build

```bash
# Deploy to Cloud Run
gcloud builds submit --config=cloudbuild.yaml

# Or deploy directly
gcloud run deploy cscx-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest"
```

### 4. Verify Deployment

```bash
# Get service URL
gcloud run services describe cscx-api --region us-central1 --format='value(status.url)'

# Test health endpoint
curl https://your-service-url.run.app/health
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Environment (development/production) |
| `PORT` | No | Server port (default: 3001, Cloud Run: 8080) |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `LANGCHAIN_TRACING_V2` | No | Enable LangSmith tracing (true/false) |
| `LANGCHAIN_API_KEY` | No | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | LangSmith project name |

## Database Schema

The application uses Supabase with the following main tables:

- `user_profiles` - User accounts (extends Supabase Auth)
- `customers` - Customer records with health scores
- `stakeholders` - Customer contacts
- `contracts` - Uploaded contracts with parsed data
- `entitlements` - Contract entitlements
- `agent_runs` - Agent execution traces
- `agent_steps` - Individual steps within runs
- `agent_sessions` - Chat sessions
- `agent_messages` - Messages within sessions
- `approvals` - HITL approval requests
- `feature_flags` - Feature flag configurations
- `meetings` - Scheduled meetings
- `tasks` - Tasks created by agents
- `insights` - AI-generated insights

Run migrations in order:
1. `database/migrations/001_initial_schema.sql`
2. `database/migrations/001_feature_flags.sql` (if not included)
3. `database/migrations/003_fix_user_id_types.sql` (for development flexibility)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Flow |
| Backend | Node.js, Express, TypeScript |
| AI/LLM | Claude (Anthropic), Gemini (Google) |
| Database | Supabase (PostgreSQL) |
| Observability | LangSmith, Custom Agent Tracer |
| Deployment | Google Cloud Run, Cloud Build |

## Project Structure

```
cscx-mvp/
├── components/              # React components
│   ├── AgentControlCenter/  # Agent chat interface
│   ├── AgentObservability/  # Real-time trace visualization
│   └── ...
├── server/
│   ├── src/
│   │   ├── config/          # Configuration
│   │   ├── middleware/      # Express middleware (auth, metrics)
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   │   ├── agentTracer.ts    # Observability service
│   │   │   ├── claude.ts         # Claude API client
│   │   │   ├── gemini.ts         # Gemini API client
│   │   │   └── ...
│   │   └── langchain/
│   │       └── agents/
│   │           ├── orchestrator.ts    # Main routing agent
│   │           └── specialists/       # 10 specialist agents
│   └── package.json
├── database/
│   └── migrations/          # SQL migrations
├── Dockerfile               # Multi-stage Docker build
├── cloudbuild.yaml          # Google Cloud Build config
└── package.json
```

## Monitoring & Observability

### Health Checks
- `/health` - Full status with AI service connectivity
- `/health/live` - Simple liveness (for k8s)
- `/health/ready` - Readiness with dependency checks

### Agent Traces
All agent executions are traced and stored in Supabase:
- Run start/end times
- Individual steps (thinking, tool calls, decisions)
- Token usage
- Errors and status

### LangSmith Integration
Enable deep tracing by setting:
```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-key
LANGCHAIN_PROJECT=cscx-agents
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

---

Built with Claude Code + Anthropic Claude + Google Gemini
