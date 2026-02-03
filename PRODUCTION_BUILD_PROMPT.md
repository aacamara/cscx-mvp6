# CSCX.AI Production Build Prompt

## Context
You are building CSCX.AI - an AI-powered Customer Success onboarding platform. The MVP exists but uses mock data and Gemini. We need production-ready code in 2 days.

## Current State
- **Frontend:** React 19 + TypeScript + Vite + Tailwind (working)
- **Backend:** Express + TypeScript + Node.js (working)
- **AI:** Currently Gemini (switching to Claude)
- **Database:** In-memory (needs Supabase)
- **Agents:** Simulated responses (need real implementations)

## Project Location
```
/Users/azizcamara/Downloads/cscx-mvp/
├── App.tsx                    # Main app with 3-phase flow
├── components/
│   ├── AgentControlCenter/    # Agent chat UI (working)
│   ├── ContractUpload.tsx     # File upload (working)
│   └── [other components]
├── server/
│   ├── src/agents/            # Agent implementations (need real logic)
│   ├── src/routes/            # API endpoints
│   └── src/services/          # AI services (switch to Claude)
├── types/                     # TypeScript definitions
└── .env files                 # Configuration
```

## What I Need Built

### 1. Contract Parsing Service (Claude-powered)
Replace Gemini with Claude for contract parsing. The service should:

```typescript
// server/src/services/claude.ts
- Parse uploaded PDF/DOCX contracts
- Extract structured data:
  - company_name: string
  - arr: number
  - contract_period: string
  - entitlements: Array<{name, description, quantity}>
  - stakeholders: Array<{name, title, email, role}>
  - technical_requirements: Array<{category, requirement, priority}>
  - pricing_terms: object
  - contract_tasks: Array<{task, owner, deadline}>
  - missing_info: string[]
  - next_steps: string[]
- Return confidence scores for each field
- Handle multi-page documents
- Support PDF, DOCX, and plain text
```

**Claude API Integration:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Use claude-sonnet-4-20250514 for fast parsing
// Use claude-opus-4-5-20251101 for complex reasoning
```

### 2. Real Agent Implementations

#### Onboarding Orchestrator Agent
```typescript
// server/src/agents/onboarding.ts
Purpose: Coordinates all customer onboarding activities
Capabilities:
- Analyzes contract data and creates personalized onboarding plans
- Delegates tasks to sub-agents (Meeting, Training, Intelligence)
- Tracks progress across all onboarding milestones
- Provides CSM with recommended next actions
- Handles human-in-the-loop approvals for key decisions

System Prompt:
"You are the Onboarding Orchestrator for CSCX.AI. You have access to the full contract
and customer context. Your role is to:
1. Create and manage the onboarding timeline
2. Coordinate between Meeting, Training, and Intelligence agents
3. Recommend actions to the CSM and request approval for critical steps
4. Track progress and proactively identify risks
5. Ensure the customer achieves their first value milestone quickly

Always be specific about customer details. Reference actual contract data.
When delegating, explain which agent and why."
```

#### Meeting Agent
```typescript
// server/src/agents/meeting.ts
Purpose: Handles all meeting-related tasks
Capabilities:
- Drafts meeting agendas based on onboarding phase
- Generates meeting invite content
- Creates pre-meeting briefs for CSM
- Captures meeting notes and action items
- Schedules follow-up meetings

Tools:
- draft_agenda(meeting_type, attendees, topics)
- create_invite(title, attendees, datetime, agenda)
- generate_brief(customer_context, meeting_purpose)
- capture_notes(transcript) -> action_items[]
```

#### Training Agent
```typescript
// server/src/agents/training.ts
Purpose: Manages customer training and enablement
Capabilities:
- Creates personalized training plans based on products purchased
- Generates training materials and guides
- Tracks training completion per stakeholder
- Recommends additional training based on usage patterns
- Creates self-service resources

Tools:
- create_training_plan(products, stakeholders, timeline)
- generate_guide(product, user_role, skill_level)
- track_progress(customer_id, stakeholder_id)
- recommend_training(usage_data)
```

#### Intelligence Agent
```typescript
// server/src/agents/intelligence.ts
Purpose: Analyzes customer health and provides insights
Capabilities:
- Monitors customer engagement signals
- Identifies risks and opportunities
- Generates health scores
- Predicts churn risk
- Recommends proactive interventions

Tools:
- calculate_health_score(customer_id)
- identify_risks(customer_data)
- find_opportunities(contract_data, usage_data)
- generate_insights(timeframe)
```

### 3. Database Schema (Supabase)

```sql
-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  arr DECIMAL(12,2),
  contract_start DATE,
  contract_end DATE,
  stage VARCHAR(50) DEFAULT 'onboarding',
  health_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  file_url TEXT,
  parsed_data JSONB,
  parsing_confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stakeholders
CREATE TABLE stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  name VARCHAR(255),
  title VARCHAR(255),
  email VARCHAR(255),
  role VARCHAR(50), -- 'champion', 'decision_maker', 'end_user', 'technical'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding Plans
CREATE TABLE onboarding_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  timeline_days INTEGER,
  phases JSONB,
  risk_factors JSONB,
  opportunities JSONB,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Sessions
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  user_id UUID, -- CSM user
  messages JSONB[],
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Actions (for HITL)
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id),
  agent_id VARCHAR(50),
  action_type VARCHAR(100),
  action_data JSONB,
  requires_approval BOOLEAN DEFAULT FALSE,
  approval_status VARCHAR(50), -- 'pending', 'approved', 'rejected'
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  plan_id UUID REFERENCES onboarding_plans(id),
  title VARCHAR(255),
  description TEXT,
  assigned_to UUID,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  phase VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. API Endpoints Needed

```typescript
// Contracts
POST /api/contracts/upload     - Upload and parse contract
GET  /api/contracts/:id        - Get parsed contract
POST /api/contracts/:id/reparse - Re-parse with corrections

// Customers
GET  /api/customers            - List customers
POST /api/customers            - Create from contract
GET  /api/customers/:id        - Get customer details
PUT  /api/customers/:id        - Update customer

// Agents
POST /api/agents/chat          - Send message to agent (exists, enhance)
POST /api/agents/deploy/:id    - Deploy specific sub-agent
POST /api/agents/approve/:id   - Approve/reject action
GET  /api/agents/actions       - Get pending actions

// Plans
GET  /api/plans/:customerId    - Get onboarding plan
PUT  /api/plans/:id            - Update plan
POST /api/plans/:id/tasks      - Add task to plan

// Health
GET  /health                   - Server health (exists)
```

### 5. Environment Variables Needed

```bash
# server/.env
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://app.cscx.ai

# Claude AI
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# File Storage (Supabase Storage or S3)
STORAGE_BUCKET=contracts

# Optional: Future integrations
SALESFORCE_CLIENT_ID=
HUBSPOT_API_KEY=
```

### 6. File Upload & Parsing Flow

```
1. User uploads contract (PDF/DOCX)
   └── POST /api/contracts/upload
       ├── Store file in Supabase Storage
       ├── Extract text (pdf-parse for PDF, mammoth for DOCX)
       └── Send to Claude for parsing

2. Claude parses contract
   └── System: "Extract structured customer data from this contract..."
   └── Returns: ContractExtraction JSON

3. Create customer record
   └── Insert into customers, stakeholders, contracts tables
   └── Generate initial onboarding plan

4. Redirect to Agent Control Center
   └── Pass customer context to agents
   └── CSM can now interact with onboarding agent
```

### 7. Agent Response Format

All agents should return structured responses:

```typescript
interface AgentResponse {
  message: string;           // Human-readable response
  thinking?: string;         // Agent's reasoning (optional, for debugging)
  actions?: AgentAction[];   // Actions to take
  requiresApproval?: boolean;// HITL flag
  deployAgent?: AgentId;     // Sub-agent to activate
  data?: any;                // Structured data (meeting details, plan updates, etc.)
}

interface AgentAction {
  type: 'send_email' | 'schedule_meeting' | 'create_task' | 'update_plan' | 'deploy_agent';
  params: Record<string, any>;
  description: string;       // Human-readable description
  requiresApproval: boolean;
}
```

### 8. Production Checklist

- [ ] Claude API integration (replace Gemini)
- [ ] Contract parsing with Claude (PDF/DOCX support)
- [ ] Supabase database setup and migrations
- [ ] Real agent implementations with tools
- [ ] HITL approval flow working end-to-end
- [ ] File upload to Supabase Storage
- [ ] Error handling and logging
- [ ] Environment configuration for production
- [ ] Basic authentication (Supabase Auth)
- [ ] Deploy backend (Railway/Render/Fly.io)
- [ ] Deploy frontend (Netlify/Vercel)

## Constraints

1. **Timeline:** 2 days to production
2. **AI Provider:** Claude only (Anthropic API)
3. **Database:** Supabase (PostgreSQL + Storage + Auth)
4. **Must Work:** Contract upload → Parse → Agent Control Center flow
5. **No Mock Data:** All agent responses must be real Claude completions

## Success Criteria

A user should be able to:
1. Upload a real customer contract (PDF or DOCX)
2. See extracted information (company, ARR, stakeholders, etc.)
3. Review and approve the auto-generated onboarding plan
4. Chat with the Onboarding Agent about next steps
5. Have the agent draft a kickoff meeting agenda
6. Approve the meeting and see it "scheduled"
7. See progress tracked in the sidebar

## Code Style

- TypeScript strict mode
- Functional components with hooks (React)
- async/await for all async operations
- Proper error handling with try/catch
- Descriptive variable names
- Comments only for complex logic

## Start Here

1. First, read the existing codebase:
   - `server/src/agents/onboarding.ts` - Current agent implementation
   - `server/src/services/gemini.ts` - Current AI service (replace)
   - `App.tsx` - Main application flow
   - `components/AgentControlCenter/index.tsx` - Agent UI

2. Then implement in this order:
   - Claude service (`server/src/services/claude.ts`)
   - Contract parsing (`server/src/services/contractParser.ts`)
   - Database schema (Supabase)
   - Update agents to use Claude
   - Test full flow
   - Deploy

---

**Now build this production-ready system. Start by reading the existing code and creating the Claude service.**
