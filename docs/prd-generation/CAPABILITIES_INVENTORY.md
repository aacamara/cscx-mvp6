# CSCX.AI Capabilities Inventory

> Comprehensive inventory of all platform capabilities as of 2026-01-29

## 1. Data Sources & Connections

### 1.1 Contract Document Parsing
- **File Formats Supported**: PDF, plain text
- **Extraction Capabilities**:
  - Company name, ARR, contract term
  - Start/end dates
  - Entitlements (description, quantity, pricing)
  - Stakeholders (name, role, email)
  - Technical requirements
  - Pricing terms
  - Missing information identification
  - Next steps recommendations
- **Processing**: AI-powered extraction with Claude/Gemini

### 1.2 Google Workspace Integration
| Service | Capabilities |
|---------|-------------|
| **Gmail** | List threads, get thread, send email, create draft, search, mark read, archive, star, get labels |
| **Calendar** | List events, get event, create event, update event, check availability, delete event, get upcoming, get today |
| **Drive** | List files, get file, create folder, upload file, share file, delete file, copy file, move file, search, get customer folder |
| **Docs** | Create documents, templates (QBR Report, Meeting Notes, Onboarding Plan, Success Plan, Renewal Proposal, Value Summary, Escalation Report, Save Play, Account Plan) |
| **Sheets** | Create spreadsheets, templates (Health Score Tracker, Renewal Tracker, Onboarding Tracker, Usage Metrics, Customer Scorecard, QBR Metrics, Risk Dashboard, Adoption Tracker) |
| **Slides** | Create presentations, templates (QBR Presentation, Kickoff Deck, Training Presentation, Executive Briefing, Renewal Presentation, Value Summary, Escalation Deck, Adoption Report) |
| **Apps Script** | Deploy automation scripts (healthScoreCalculator, renewalAlerts, meetingPrep, weeklyDigest, usageTracker, npsFollowUp) |

### 1.3 CRM Integrations
| CRM | Status | Capabilities |
|-----|--------|-------------|
| **Salesforce** | Implemented | OAuth, account sync, contact sync, health score push, bi-directional sync |
| **HubSpot** | Coming Soon | Company sync, contact sync, deal tracking (planned) |

### 1.4 Communication Channels
| Channel | Integration Type | Capabilities |
|---------|------------------|-------------|
| **Slack** | OAuth API | Send message, list channels, get channel info, get user, find user by email, send DM, reply to thread, add reaction, list users, connection check |
| **Zoom** | API | List meetings, get meeting, create meeting, get recording, get transcript |
| **Otter.ai** | Webhook/API | Meeting transcript ingestion and processing |

### 1.5 Usage Data Ingestion
- **Endpoint**: `POST /api/v1/usage`
- **Event Types**: Login, feature usage, API calls, session duration
- **Processing**: Daily/weekly/monthly aggregation
- **Metrics Calculated**: DAU, WAU, MAU, adoption score, usage trends

---

## 2. AI/Analytics Features

### 2.1 AI Models Supported
- **Claude** (Anthropic): Primary model for chat, analysis, orchestration
  - Models: claude-opus-4, claude-sonnet-4, claude-haiku-4
- **Gemini** (Google): Alternative model support
- **Embeddings**: OpenAI embeddings for semantic search

### 2.2 Contract Analysis
- Extract structured data from unstructured contracts
- Identify missing information and gaps
- Generate recommended next steps
- Stakeholder mapping

### 2.3 Meeting Intelligence
- **Transcript Analysis**: Parse and analyze meeting transcripts (Zoom, Otter, custom)
- **Insight Extraction**:
  - Action items with owners and due dates
  - Commitments made
  - Follow-up tasks
  - Risk signals detection
  - Expansion signal detection
  - Stakeholder insights
  - Competitor mentions
- **Sentiment Analysis**: Overall meeting sentiment (positive/neutral/negative/mixed)
- **Aggregated Analytics**: Customer-level meeting summaries, trending risks

### 2.4 Health Score Calculation
- **Input Signals**: Usage metrics, engagement metrics, sentiment scores
- **Components**: Usage score, engagement score, sentiment score
- **Output**: Composite health score (0-100)
- **Trends**: Growing, stable, declining

### 2.5 Risk Detection
- **Signal Types**:
  - Health score drop
  - No login (inactive users)
  - Renewal approaching
  - Ticket escalated
  - NPS submitted (detractors)
  - Usage anomaly
  - Champion left
- **Severity Levels**: Low, medium, high, critical
- **Auto-detection**: Automated signal detection from various sources

### 2.6 Churn Prediction
- Based on risk signals, usage trends, engagement patterns
- Integrated with save play workflows

### 2.7 Expansion Signal Detection
- Feature adoption analysis
- Usage growth trends
- Cross-sell/upsell opportunity identification

### 2.8 Knowledge Base & Semantic Search
- CSM playbooks storage and retrieval
- Semantic search using embeddings
- Context-aware responses based on playbook knowledge

---

## 3. Agent System

### 3.1 Specialist Agents
| Agent | Role | Tools |
|-------|------|-------|
| **Orchestrator** | Coordinate all activities | delegate_to_agent, request_human_approval, update_task_ledger, check_customer_health |
| **Scheduler** | Calendar/meeting management | check_availability, propose_meeting, book_meeting |
| **Communicator** | Email/outreach | draft_email, send_email, create_sequence |
| **Researcher** | Intelligence gathering | research_company, map_stakeholders, detect_churn_signals |
| **Trainer** | Onboarding materials | Create training plans, documentation |
| **Monitor** | Health tracking | Track health scores, usage data, churn signals |
| **Expansion** | Growth opportunities | Identify upsell, generate proposals |

### 3.2 Agentic Mode
- **Toggle**: Enable/disable autonomous agent execution
- **Scope**: Per-customer, global settings
- **Concurrency**: Maximum concurrent executions configurable

### 3.3 Built-in Skills
| Skill | Purpose |
|-------|---------|
| **Kickoff Meeting** | Schedule and prepare customer kickoff |
| **Welcome Email** | Send personalized welcome email |
| **Onboarding Checklist** | Generate customer-specific onboarding tasks |
| **Health Check** | Comprehensive customer health assessment |
| **Renewal Prep** | Prepare renewal materials and outreach |

### 3.4 Agent Execution Features
- Real-time streaming responses
- WebSocket updates for live observability
- Trace visualization and replay
- Execution metrics and performance tracking

---

## 4. Automation System

### 4.1 Trigger Engine
- **Trigger Types**:
  - Health score drop
  - No login (inactive)
  - Renewal approaching
  - Ticket escalated
  - NPS submitted
  - Usage anomaly
  - Contract expiring
  - Champion left
  - Expansion signal
  - Custom
- **Actions**:
  - Send email
  - Send Slack message
  - Create task
  - Start playbook
  - Update health score
  - Notify CSM
  - Log activity
  - Webhook call
- **Controls**: Cooldown, max fires per day, conditional execution

### 4.2 Natural Language Automation Builder
- **Endpoint**: `POST /api/automations/from-nl`
- **Capability**: Create automations from plain English descriptions
- **Parser**: AI-powered NL to automation definition conversion

### 4.3 Scheduled Agent Runs
- Cron-based scheduling for recurring agent tasks
- Configurable per customer or global

### 4.4 Playbook Execution
- Pre-defined playbooks with step-by-step actions
- Context-aware execution based on customer state

---

## 5. Approval System (HITL)

### 5.1 Approval Policies
| Policy | Description |
|--------|-------------|
| **always_approve** | Research, read-only actions |
| **auto_approve** | Drafts, document creation, internal actions |
| **require_approval** | Send email, book meeting, share files |
| **never_approve** | Delete files, modify permissions |

### 5.2 Approval Types
- Send email
- Book meeting
- Create document
- Share externally
- Update CRM
- Internal note
- Research action
- Escalation

### 5.3 Approval Queue Features
- Pending approvals list
- Approve/reject with notes
- Auto-execute on approval
- Expiration handling

---

## 6. Reporting & Analytics

### 6.1 Dashboard Metrics
- Portfolio health overview
- Customer distribution by status
- ARR by segment
- Upcoming renewals
- At-risk accounts

### 6.2 Agent Metrics
- Total actions
- Success rate
- Average response time
- Approval rate
- Error rate
- Token usage

### 6.3 QBR Generation
- Automated QBR document creation
- Automated QBR presentation creation
- Customer metrics aggregation
- Wins/challenges summary

### 6.4 Survey/NPS Support
- NPS score tracking
- Survey response storage
- Follow-up automation based on responses

---

## 7. Document Generation

### 7.1 Google Docs Templates
- QBR Report
- Meeting Notes
- Onboarding Plan
- Success Plan
- Renewal Proposal
- Value Summary
- Escalation Report
- Save Play
- Account Plan

### 7.2 Google Sheets Templates
- Health Score Tracker
- Renewal Tracker
- Onboarding Tracker
- Usage Metrics Dashboard
- Customer Scorecard
- QBR Metrics
- Risk Dashboard
- Adoption Tracker

### 7.3 Google Slides Templates
- QBR Presentation
- Kickoff Deck
- Training Presentation
- Executive Briefing
- Renewal Presentation
- Value Summary
- Escalation Deck
- Adoption Report

### 7.4 Variable Substitution
- `{{placeholder}}` syntax
- Customer context auto-population
- Metrics injection

---

## 8. Per-Customer Workspace

### 8.1 Folder Structure
```
CSCX - {CustomerName}/
├── 01 - Onboarding/
├── 02 - Meetings/
├── 03 - QBRs/
├── 04 - Contracts/
└── 05 - Reports/
```

### 8.2 Workspace Features
- Automatic folder creation
- Customer-scoped document organization
- Linked Google Workspace resources
- Permission management

---

## 9. Observability

### 9.1 Agent Tracing
- Run start/end events
- Step-by-step execution logging
- Tool use tracking
- Decision reasoning capture

### 9.2 Real-time Updates
- WebSocket streaming
- Live trace visualization
- Execution replay

### 9.3 Metrics Endpoints
- `/metrics` - General platform metrics
- `/metrics/agentic` - Agentic-specific metrics
- `/health` - System health status
- `/health/circuits` - Circuit breaker status

### 9.4 Audit Logging
- All agent actions logged
- MCP tool execution audit
- Approval decisions tracked
- Activity log for compliance

---

## 10. API Infrastructure

### 10.1 Rate Limiting
- Configurable window and max requests
- Per-endpoint limits

### 10.2 Circuit Breakers
- Per-provider circuit breakers (Google, Slack, Zoom)
- Automatic recovery
- Health monitoring

### 10.3 Health Checks
- Liveness probe
- Readiness probe
- Full health with connectivity tests
