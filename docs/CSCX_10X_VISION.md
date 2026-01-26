# CSCX.AI 10X Vision - Agentic CSM Platform

## Executive Summary

Transform CSCX.AI from a contract parsing tool into a fully autonomous AI-powered Customer Success platform that augments CSMs by 10X through intelligent automation, proactive insights, and seamless integrations.

**Target:** Production-ready in 1 week using parallel Claude agent development.

---

## Table of Contents

1. [Vision & Value Proposition](#vision--value-proposition)
2. [System Architecture](#system-architecture)
3. [Integration Specifications](#integration-specifications)
4. [Agent Ecosystem](#agent-ecosystem)
5. [Knowledge Base Architecture](#knowledge-base-architecture)
6. [Feedback & Learning System](#feedback--learning-system)
7. [Technical Implementation](#technical-implementation)
8. [1-Week Development Plan](#1-week-development-plan)
9. [Cost Analysis](#cost-analysis)
10. [Parallel Development Strategy](#parallel-development-strategy)

---

## Vision & Value Proposition

### The Problem

Customer Success Managers spend 70% of their time on:
- Writing emails (repetitive, time-consuming)
- Preparing for meetings (gathering context from multiple sources)
- Searching for information (knowledge scattered across tools)
- Manual tracking (health scores, renewals, at-risk accounts)
- Administrative tasks (scheduling, note-taking, follow-ups)

### The Solution

CSCX.AI becomes an **autonomous AI workforce** that:
- **Drafts** all communications with full context
- **Prepares** CSMs for every interaction
- **Executes** routine tasks without supervision
- **Monitors** customer health proactively
- **Learns** from every interaction to improve

### 10X Multiplier Breakdown

| Area | Current State | CSCX.AI State | Multiplier |
|------|---------------|---------------|------------|
| Email | 30 min/email | 2 min review | **15X** |
| Meeting Prep | 45 min | 0 min (auto-generated) | **∞** |
| Knowledge Search | 15 min average | Instant | **15X** |
| Health Monitoring | Manual checks | Proactive alerts | **5X** |
| Follow-ups | Often forgotten | Automated | **10X** |
| **Composite Effect** | | | **10X+** |

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CSCX.AI PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (React)                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Dashboard│ │ Agent    │ │ Customer │ │ Knowledge│ │ Settings │  │   │
│  │  │          │ │ Center   │ │ 360°     │ │ Base     │ │          │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API GATEWAY (Express)                        │   │
│  │  • Authentication (Supabase Auth)                                    │   │
│  │  • Rate Limiting                                                     │   │
│  │  • Request Routing                                                   │   │
│  │  • WebSocket (Real-time updates)                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         │                          │                          │            │
│         ▼                          ▼                          ▼            │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐        │
│  │   AGENT     │          │  KNOWLEDGE  │          │INTEGRATION  │        │
│  │   ENGINE    │          │    BASE     │          │   HUB       │        │
│  │             │          │             │          │             │        │
│  │ • Orchestr. │          │ • pgvector  │          │ • Gmail     │        │
│  │ • Execution │          │ • RAG       │          │ • Calendar  │        │
│  │ • Learning  │          │ • Ingestion │          │ • Zoom      │        │
│  │ • HITL      │          │ • Search    │          │ • Drive     │        │
│  └─────────────┘          └─────────────┘          └─────────────┘        │
│         │                          │                          │            │
│         └──────────────────────────┼──────────────────────────┘            │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AI SERVICES                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │   Gemini     │  │   Claude     │  │  Embeddings  │               │   │
│  │  │   (Primary)  │  │   (Fallback) │  │  (Gemini)    │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                   │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │                      SUPABASE                                 │   │   │
│  │  │  • PostgreSQL (structured data)                               │   │   │
│  │  │  • pgvector (embeddings)                                      │   │   │
│  │  │  • Auth (user management)                                     │   │   │
│  │  │  • Storage (documents)                                        │   │   │
│  │  │  • Realtime (subscriptions)                                   │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INBOUND DATA                                                            │
│  ────────────                                                            │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │ Gmail   │───▶│ Webhook │───▶│ Process │───▶│ Store   │              │
│  │ Events  │    │ Handler │    │ & Index │    │ (Supa)  │              │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘              │
│                                                                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │ Calendar│───▶│ Sync    │───▶│ Extract │───▶│ Create  │              │
│  │ Events  │    │ Service │    │ Context │    │ Tasks   │              │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘              │
│                                                                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │Documents│───▶│ Upload  │───▶│ Parse & │───▶│ Vector  │              │
│  │         │    │ Handler │    │ Chunk   │    │ Store   │              │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘              │
│                                                                          │
│  AGENT EXECUTION                                                         │
│  ───────────────                                                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │ Trigger │───▶│ Agent   │───▶│ Plan &  │───▶│ Execute │              │
│  │ (Event/ │    │ Select  │    │ Reason  │    │ Actions │              │
│  │  Time)  │    │         │    │         │    │         │              │
│  └─────────┘    └─────────┘    └─────────┘    └────┬────┘              │
│                                                     │                   │
│                      ┌──────────────────────────────┘                   │
│                      │                                                  │
│                      ▼                                                  │
│              ┌───────────────┐                                          │
│              │  HITL Check   │                                          │
│              │  (Approval?)  │                                          │
│              └───────┬───────┘                                          │
│                      │                                                  │
│         ┌────────────┴────────────┐                                     │
│         ▼                         ▼                                     │
│  ┌─────────────┐          ┌─────────────┐                              │
│  │ Auto-Execute│          │ Queue for   │                              │
│  │ (Low Risk)  │          │ Approval    │                              │
│  └──────┬──────┘          └──────┬──────┘                              │
│         │                        │                                      │
│         └────────────┬───────────┘                                      │
│                      ▼                                                  │
│              ┌───────────────┐                                          │
│              │ Feedback Loop │                                          │
│              │ (Learn)       │                                          │
│              └───────────────┘                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Specifications

### Google OAuth Scopes Required

```javascript
const GOOGLE_SCOPES = [
  // Gmail
  'https://www.googleapis.com/auth/gmail.readonly',      // Read emails
  'https://www.googleapis.com/auth/gmail.compose',       // Draft emails
  'https://www.googleapis.com/auth/gmail.send',          // Send emails

  // Calendar
  'https://www.googleapis.com/auth/calendar.readonly',   // Read events
  'https://www.googleapis.com/auth/calendar.events',     // Create/edit events

  // Drive
  'https://www.googleapis.com/auth/drive.readonly',      // Read files
  'https://www.googleapis.com/auth/drive.file',          // Create/edit files

  // User Info
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];
```

### Integration Data Models

```typescript
// Gmail Integration
interface EmailThread {
  id: string;
  customer_id: string;
  subject: string;
  participants: string[];
  messages: EmailMessage[];
  sentiment: 'positive' | 'neutral' | 'negative';
  action_items: string[];
  last_activity: Date;
  requires_response: boolean;
}

// Calendar Integration
interface CalendarEvent {
  id: string;
  customer_id: string;
  title: string;
  start_time: Date;
  end_time: Date;
  attendees: Attendee[];
  meeting_type: 'kickoff' | 'check-in' | 'qbr' | 'training' | 'escalation';
  prep_brief?: MeetingBrief;
  recording_url?: string;
  summary?: string;
  action_items?: ActionItem[];
}

// Drive Integration
interface DriveDocument {
  id: string;
  customer_id: string;
  name: string;
  type: 'success_plan' | 'qbr_deck' | 'contract' | 'notes' | 'other';
  url: string;
  last_modified: Date;
  content_indexed: boolean;
}

// Zoom Integration
interface ZoomMeeting {
  id: string;
  calendar_event_id: string;
  recording_url?: string;
  transcript?: string;
  summary?: string;
  duration: number;
  participants: string[];
}
```

### API Endpoints for Integrations

```
POST   /api/integrations/google/connect     # Initiate OAuth flow
GET    /api/integrations/google/callback    # OAuth callback
DELETE /api/integrations/google/disconnect  # Revoke access
GET    /api/integrations/status             # Check all integration status

# Gmail
GET    /api/gmail/threads                   # List email threads
GET    /api/gmail/threads/:id               # Get thread details
POST   /api/gmail/drafts                    # Create draft
POST   /api/gmail/send                      # Send email (with approval)

# Calendar
GET    /api/calendar/events                 # List events
POST   /api/calendar/events                 # Create event
GET    /api/calendar/events/:id/brief       # Get AI-generated meeting brief

# Drive
GET    /api/drive/files                     # List files
POST   /api/drive/files                     # Create file
POST   /api/drive/files/:id/index           # Index file for RAG

# Zoom
POST   /api/zoom/meetings                   # Create meeting
GET    /api/zoom/meetings/:id/transcript    # Get transcript
GET    /api/zoom/meetings/:id/summary       # Get AI summary
```

---

## Agent Ecosystem

### Agent Types & Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT HIERARCHY                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                      ┌───────────────────┐                              │
│                      │   ORCHESTRATOR    │                              │
│                      │      AGENT        │                              │
│                      │                   │                              │
│                      │ Routes requests   │                              │
│                      │ Coordinates work  │                              │
│                      │ Manages state     │                              │
│                      └─────────┬─────────┘                              │
│                                │                                        │
│         ┌──────────────────────┼──────────────────────┐                │
│         │                      │                      │                │
│         ▼                      ▼                      ▼                │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐          │
│  │COMMUNICATION│       │  WORKFLOW   │       │  INSIGHT    │          │
│  │   AGENTS    │       │   AGENTS    │       │   AGENTS    │          │
│  └──────┬──────┘       └──────┬──────┘       └──────┬──────┘          │
│         │                     │                     │                  │
│    ┌────┴────┐           ┌────┴────┐           ┌────┴────┐            │
│    │         │           │         │           │         │            │
│    ▼         ▼           ▼         ▼           ▼         ▼            │
│ ┌─────┐ ┌─────┐     ┌─────┐ ┌─────┐     ┌─────┐ ┌─────┐              │
│ │Email│ │Meet │     │Onbrd│ │Renwl│     │Helth│ │Expan│              │
│ │Agent│ │Agent│     │Agent│ │Agent│     │Agent│ │Agent│              │
│ └─────┘ └─────┘     └─────┘ └─────┘     └─────┘ └─────┘              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      SUPPORT AGENTS                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │Knowledge │  │ Document │  │ Research │  │ Analytics│        │   │
│  │  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent Specifications

#### 1. Email Agent
```yaml
name: Email Agent
trigger:
  - New email received
  - User requests draft
  - Follow-up timer expires
capabilities:
  - Read and categorize emails
  - Extract sentiment, action items, urgency
  - Draft contextual responses
  - Suggest follow-up timing
  - Learn from CSM edits
dependencies:
  - Gmail API access
  - Customer context
  - Knowledge base
  - CSM writing style model
hitl_required:
  - Sending emails (always)
  - Unusual sentiment detection
```

#### 2. Meeting Agent
```yaml
name: Meeting Agent
trigger:
  - 24 hours before meeting
  - Meeting ends (transcript available)
  - User requests prep
capabilities:
  - Generate meeting briefs
  - Create agendas
  - Summarize recordings
  - Extract action items
  - Schedule follow-ups
dependencies:
  - Calendar API access
  - Zoom API access
  - Customer context
  - Previous meeting history
hitl_required:
  - Scheduling with external parties
  - Sending invites
```

#### 3. Onboarding Agent
```yaml
name: Onboarding Agent
trigger:
  - New customer created
  - Onboarding task due
  - Milestone approaching
capabilities:
  - Track onboarding progress
  - Send milestone reminders
  - Generate status reports
  - Identify blockers
  - Celebrate completions
dependencies:
  - Contract data
  - Success plan
  - Task management
  - Email/Calendar access
hitl_required:
  - Escalations
  - Timeline changes
```

#### 4. Health Agent
```yaml
name: Health Agent
trigger:
  - Daily health check (scheduled)
  - Negative signal detected
  - Usage drop detected
capabilities:
  - Calculate health scores
  - Identify risk signals
  - Suggest interventions
  - Generate alerts
  - Track trends
dependencies:
  - Usage data (if available)
  - Email sentiment history
  - Meeting frequency
  - Support ticket data
hitl_required:
  - Risk escalations
  - Intervention actions
```

#### 5. Knowledge Agent
```yaml
name: Knowledge Agent
trigger:
  - User asks question
  - Agent needs context
  - New document indexed
capabilities:
  - Semantic search across KB
  - Answer questions with sources
  - Suggest relevant content
  - Identify knowledge gaps
dependencies:
  - Vector database
  - Document store
  - Embedding model
hitl_required:
  - None (read-only)
```

---

## Knowledge Base Architecture

### Database Schema (Supabase)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge documents table
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  layer TEXT NOT NULL CHECK (layer IN ('universal', 'company', 'customer')),
  category TEXT NOT NULL,

  -- Ownership
  organization_id UUID REFERENCES organizations(id),
  customer_id UUID REFERENCES customers(id),
  uploaded_by UUID REFERENCES users(id),

  -- Content
  title TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'upload', 'gdrive', 'url', 'email'
  source_url TEXT,
  content TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks for RAG
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,

  -- Content
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,

  -- Embedding
  embedding vector(768), -- Gemini embedding dimension

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for similarity search
CREATE INDEX ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- CSM Best Practices (pre-seeded)
CREATE TABLE csm_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  use_cases TEXT[],
  tags TEXT[],
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),

  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'onboarding', 'check-in', 'renewal', etc.
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  variables TEXT[], -- ['customer_name', 'product', etc.]

  -- Performance tracking
  times_used INTEGER DEFAULT 0,
  avg_response_rate DECIMAL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RAG Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      KNOWLEDGE RETRIEVAL PIPELINE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INDEXING (on document upload)                                          │
│  ─────────────────────────────                                          │
│                                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ Document │──▶│  Parse   │──▶│  Chunk   │──▶│  Embed   │            │
│  │  Upload  │   │  Content │   │  (512    │   │  (Gemini │            │
│  │          │   │          │   │  tokens) │   │  API)    │            │
│  └──────────┘   └──────────┘   └──────────┘   └────┬─────┘            │
│                                                     │                  │
│                                                     ▼                  │
│                                            ┌──────────────┐           │
│                                            │   Supabase   │           │
│                                            │   pgvector   │           │
│                                            └──────────────┘           │
│                                                                         │
│  RETRIEVAL (on query)                                                   │
│  ────────────────────                                                   │
│                                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │  Query   │──▶│  Embed   │──▶│ Similarity│──▶│  Top K   │            │
│  │          │   │  Query   │   │  Search  │   │  Chunks  │            │
│  └──────────┘   └──────────┘   └──────────┘   └────┬─────┘            │
│                                                     │                  │
│                                                     ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    CONTEXT ASSEMBLY                               │ │
│  │                                                                   │ │
│  │  [System Prompt]                                                  │ │
│  │  +                                                                │ │
│  │  [Retrieved Chunks with Sources]                                  │ │
│  │  +                                                                │ │
│  │  [Customer Context]                                               │ │
│  │  +                                                                │ │
│  │  [User Query]                                                     │ │
│  │                                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                              │                                         │
│                              ▼                                         │
│                     ┌──────────────┐                                  │
│                     │   LLM Call   │                                  │
│                     │   (Gemini)   │                                  │
│                     └──────────────┘                                  │
│                              │                                         │
│                              ▼                                         │
│                     ┌──────────────┐                                  │
│                     │   Response   │                                  │
│                     │ with Sources │                                  │
│                     └──────────────┘                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Feedback & Learning System

### Feedback Collection

```typescript
interface FeedbackEvent {
  id: string;
  timestamp: Date;

  // Context
  agent_type: string;
  action_type: string;
  customer_id?: string;

  // Original output
  original_output: string;

  // Feedback
  feedback_type: 'approved' | 'edited' | 'rejected';
  edited_output?: string;
  edit_distance?: number; // How much was changed
  csm_comment?: string;

  // Outcome (tracked later)
  outcome?: {
    customer_responded: boolean;
    response_sentiment?: string;
    goal_achieved?: boolean;
  };
}
```

### Learning Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEARNING PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  COLLECT                    ANALYZE                    APPLY            │
│  ───────                    ───────                    ─────            │
│                                                                         │
│  ┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐    │
│  │ CSM Edits   │─────▶│ Pattern         │─────▶│ Update Prompts  │    │
│  │ Draft       │      │ Extraction      │      │ "CSM prefers    │    │
│  │ Changes     │      │ "Always adds    │      │  shorter emails │    │
│  │             │      │  greeting"      │      │  with greeting" │    │
│  └─────────────┘      └─────────────────┘      └─────────────────┘    │
│                                                                         │
│  ┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐    │
│  │ Customer    │─────▶│ Response        │─────▶│ Adjust Strategy │    │
│  │ Responses   │      │ Analysis        │      │ "Technical      │    │
│  │             │      │ "Positive when  │      │  customers want │    │
│  │             │      │  technical"     │      │  more detail"   │    │
│  └─────────────┘      └─────────────────┘      └─────────────────┘    │
│                                                                         │
│  ┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐    │
│  │ Outcome     │─────▶│ Success         │─────▶│ Reinforce       │    │
│  │ Tracking    │      │ Correlation     │      │ Winning         │    │
│  │ (renewal,   │      │ "QBR prep led   │      │ Patterns        │    │
│  │  expansion) │      │  to expansion"  │      │                 │    │
│  └─────────────┘      └─────────────────┘      └─────────────────┘    │
│                                                                         │
│  Storage: feedback_events, pattern_library, csm_preferences            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### New Database Tables

```sql
-- User OAuth tokens (encrypted)
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'zoom'

  -- Tokens (encrypted at rest)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],

  -- Status
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, provider)
);

-- Agent executions log
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  user_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  agent_type TEXT NOT NULL,

  -- Trigger
  trigger_type TEXT NOT NULL, -- 'user', 'schedule', 'event'
  trigger_data JSONB,

  -- Execution
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',

  -- Plan & Actions
  plan JSONB,
  actions_taken JSONB[],

  -- HITL
  requires_approval BOOLEAN DEFAULT false,
  approval_status TEXT, -- 'pending', 'approved', 'rejected'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  -- Output
  output JSONB,
  error TEXT
);

-- Approval queue
CREATE TABLE approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES agent_executions(id),
  user_id UUID REFERENCES users(id),

  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,

  -- Review
  status TEXT DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,

  -- Modification
  original_content TEXT,
  modified_content TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback events
CREATE TABLE feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES agent_executions(id),
  user_id UUID REFERENCES users(id),

  feedback_type TEXT NOT NULL,
  original_output TEXT,
  modified_output TEXT,
  edit_distance INTEGER,

  -- Outcome tracking
  outcome_tracked BOOLEAN DEFAULT false,
  outcome_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Structure

```
/api
├── /auth
│   ├── POST   /signup
│   ├── POST   /login
│   ├── POST   /logout
│   └── GET    /me
│
├── /integrations
│   ├── GET    /status
│   ├── POST   /google/connect
│   ├── GET    /google/callback
│   ├── DELETE /google/disconnect
│   ├── POST   /zoom/connect
│   └── DELETE /zoom/disconnect
│
├── /gmail
│   ├── GET    /threads
│   ├── GET    /threads/:id
│   ├── POST   /drafts
│   └── POST   /send
│
├── /calendar
│   ├── GET    /events
│   ├── POST   /events
│   ├── GET    /events/:id/brief
│   └── POST   /events/:id/schedule
│
├── /drive
│   ├── GET    /files
│   ├── POST   /files
│   └── POST   /files/:id/index
│
├── /knowledge
│   ├── GET    /search
│   ├── POST   /documents
│   ├── GET    /documents/:id
│   ├── DELETE /documents/:id
│   └── GET    /playbooks
│
├── /agents
│   ├── POST   /chat
│   ├── GET    /executions
│   ├── GET    /executions/:id
│   └── POST   /executions/:id/approve
│
├── /approvals
│   ├── GET    /pending
│   ├── POST   /:id/approve
│   ├── POST   /:id/reject
│   └── POST   /:id/edit
│
└── /customers
    ├── GET    /
    ├── POST   /
    ├── GET    /:id
    ├── GET    /:id/context
    ├── GET    /:id/timeline
    └── GET    /:id/health
```

---

## 1-Week Development Plan

### Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    1-WEEK SPRINT PLAN                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Day 1-2: FOUNDATION                                                    │
│  ───────────────────                                                    │
│  • Supabase Auth setup                                                  │
│  • Google OAuth integration                                             │
│  • Database schema (integrations, knowledge, agents)                    │
│  • Knowledge base with pgvector                                         │
│                                                                         │
│  Day 3-4: INTEGRATIONS                                                  │
│  ────────────────────                                                   │
│  • Gmail read/draft/send                                                │
│  • Calendar read/create                                                 │
│  • Drive read/index                                                     │
│  • Document ingestion pipeline                                          │
│                                                                         │
│  Day 5-6: AGENTS                                                        │
│  ───────────────                                                        │
│  • Email agent (draft with context)                                     │
│  • Meeting agent (prep briefs)                                          │
│  • Knowledge agent (RAG search)                                         │
│  • Approval queue system                                                │
│                                                                         │
│  Day 7: POLISH & DEPLOY                                                 │
│  ─────────────────────                                                  │
│  • Frontend integration                                                 │
│  • Testing & bug fixes                                                  │
│  • Production deployment                                                │
│  • Documentation                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Detailed Day-by-Day Plan

#### Day 1: Authentication & Database

| Time | Task | Owner |
|------|------|-------|
| AM | Supabase Auth setup (email + Google) | Agent A |
| AM | Database migrations (all new tables) | Agent B |
| PM | Frontend auth flow (login, signup, OAuth) | Agent A |
| PM | pgvector setup + embedding service | Agent B |

**Deliverables:**
- Users can sign up/login
- Google OAuth flow works
- All database tables created
- Embedding service operational

#### Day 2: Knowledge Base Foundation

| Time | Task | Owner |
|------|------|-------|
| AM | Document upload API | Agent A |
| AM | Chunking + embedding pipeline | Agent B |
| PM | RAG search API | Agent A |
| PM | Seed CSM best practices content | Agent B |

**Deliverables:**
- Upload documents → auto-indexed
- Search returns relevant chunks
- 50+ CSM best practices indexed

#### Day 3: Gmail Integration

| Time | Task | Owner |
|------|------|-------|
| AM | Gmail OAuth + token storage | Agent A |
| AM | Email sync service (read threads) | Agent B |
| PM | Draft creation API | Agent A |
| PM | Email sending (with approval queue) | Agent B |

**Deliverables:**
- Connect Gmail account
- View email threads
- Create drafts
- Send with approval

#### Day 4: Calendar & Drive Integration

| Time | Task | Owner |
|------|------|-------|
| AM | Calendar OAuth + event sync | Agent A |
| AM | Drive OAuth + file listing | Agent B |
| PM | Meeting prep brief generation | Agent A |
| PM | Drive document indexing | Agent B |

**Deliverables:**
- View calendar events
- Auto-generate meeting briefs
- Index Drive documents

#### Day 5: Core Agents

| Time | Task | Owner |
|------|------|-------|
| AM | Email Agent (context-aware drafting) | Agent A |
| AM | Meeting Agent (prep + follow-up) | Agent B |
| PM | Knowledge Agent (RAG integration) | Agent A |
| PM | Agent execution logging | Agent B |

**Deliverables:**
- Email drafts use customer context
- Meeting briefs auto-generated
- Knowledge queries answered

#### Day 6: Approval System & UI

| Time | Task | Owner |
|------|------|-------|
| AM | Approval queue backend | Agent A |
| AM | Feedback collection system | Agent B |
| PM | Approval UI (approve/edit/reject) | Agent A |
| PM | Agent Control Center updates | Agent B |

**Deliverables:**
- Pending actions queue
- One-click approve/edit/reject
- Feedback tracked

#### Day 7: Polish & Deploy

| Time | Task | Owner |
|------|------|-------|
| AM | End-to-end testing | Both |
| AM | Bug fixes | Both |
| PM | Production deployment | Agent A |
| PM | Documentation | Agent B |

**Deliverables:**
- All features tested
- Deployed to production
- Basic documentation

---

## Cost Analysis

### Development Costs

#### Claude API Usage (Development)

| Activity | Tokens/Day | Days | Total Tokens | Cost |
|----------|------------|------|--------------|------|
| Agent A coding | 500K | 7 | 3.5M | $10.50 |
| Agent B coding | 500K | 7 | 3.5M | $10.50 |
| Testing/debugging | 200K | 7 | 1.4M | $4.20 |
| **Total Claude** | | | **8.4M** | **$25.20** |

*Assuming Claude Sonnet at ~$3/1M tokens*

#### Gemini API Usage (Development)

| Activity | Tokens/Day | Days | Total Tokens | Cost |
|----------|------------|------|--------------|------|
| Embeddings | 1M | 7 | 7M | $0.70 |
| LLM calls | 500K | 7 | 3.5M | $0.35 |
| **Total Gemini** | | | **10.5M** | **$1.05** |

*Gemini is ~10x cheaper*

#### Infrastructure (Monthly)

| Service | Cost/Month |
|---------|------------|
| Supabase Pro | $25 |
| Cloud Run | $20-50 |
| Domain (cscx.ai) | $2 |
| **Total Infra** | **~$50-80/month** |

### Production Costs (Per User)

| Usage | Tokens/Month | Cost |
|-------|--------------|------|
| Email drafts (50) | 500K | $0.05 |
| Meeting briefs (20) | 400K | $0.04 |
| Knowledge queries (100) | 1M | $0.10 |
| Embeddings | 500K | $0.05 |
| **Total/User/Month** | ~2.4M | **~$0.25** |

### Total 1-Week Development Cost

| Category | Cost |
|----------|------|
| Claude API | $25 |
| Gemini API | $2 |
| Supabase | $25 |
| Other infra | $10 |
| **Total** | **~$62** |

---

## Parallel Development Strategy

### Using Multiple Claude Code Instances

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PARALLEL DEVELOPMENT SETUP                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TERMINAL 1 (Agent A)              TERMINAL 2 (Agent B)                │
│  ─────────────────────             ─────────────────────                │
│                                                                         │
│  Focus: Frontend + API             Focus: Backend + Database            │
│                                                                         │
│  • Authentication UI               • Database migrations                │
│  • Integration connect UI          • Embedding service                  │
│  • Gmail/Calendar UI               • Gmail sync service                 │
│  • Approval queue UI               • Agent execution engine             │
│  • Agent Control Center            • Feedback collection                │
│                                                                         │
│  Directory: /src, /components      Directory: /server                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED CONTRACTS                              │   │
│  │                                                                   │   │
│  │  • /types/*.ts - Shared TypeScript types                        │   │
│  │  • /server/src/routes/*.ts - API contracts                       │   │
│  │  • /docs/API.md - API documentation                              │   │
│  │                                                                   │   │
│  │  Rule: Define types FIRST, then implement in parallel            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  COORDINATION STRATEGY                                                  │
│  ────────────────────                                                   │
│                                                                         │
│  1. Morning sync: Review what each agent will build                     │
│  2. Define interfaces/types before implementation                       │
│  3. Use feature branches, merge to main at end of day                   │
│  4. One agent handles conflicts if they occur                           │
│                                                                         │
│  CONFLICT AVOIDANCE                                                     │
│  ─────────────────                                                      │
│                                                                         │
│  • Agent A: src/, components/, public/                                  │
│  • Agent B: server/src/services/, server/src/routes/                    │
│  • Shared: types/ (coordinate changes)                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Optimal Workflow

```bash
# Setup: Open 2 terminals

# Terminal 1 - Agent A (Frontend/API)
cd /Users/azizcamara/Downloads/cscx-mvp
claude

# Terminal 2 - Agent B (Backend/Services)
cd /Users/azizcamara/Downloads/cscx-mvp/server
claude
```

### Task Assignment Template

```markdown
## Agent A Tasks (Frontend Focus)
- [ ] Implement login/signup UI with Supabase
- [ ] Create Google OAuth connect button
- [ ] Build email thread viewer component
- [ ] Build calendar event viewer
- [ ] Create approval queue UI
- [ ] Update Agent Control Center

## Agent B Tasks (Backend Focus)
- [ ] Create database migrations
- [ ] Implement embedding service
- [ ] Build Gmail sync service
- [ ] Build Calendar sync service
- [ ] Implement agent execution engine
- [ ] Create approval queue API
```

---

## Success Metrics

### Launch Criteria (End of Week 1)

| Feature | Criteria | Priority |
|---------|----------|----------|
| Auth | Users can sign up/login | P0 |
| Gmail | Connect + read emails | P0 |
| Calendar | Connect + view events | P0 |
| Knowledge | Search returns results | P0 |
| Email Draft | Context-aware drafts | P0 |
| Meeting Brief | Auto-generated before calls | P1 |
| Approvals | Queue works | P1 |
| Deploy | Running on cscx.ai | P0 |

### Post-Launch Metrics (Month 1)

| Metric | Target |
|--------|--------|
| Users signed up | 10+ |
| Emails drafted | 100+ |
| Time saved per CSM | 5+ hours/week |
| User retention (weekly) | 50%+ |
| NPS | 30+ |

---

## Appendix: CSM Best Practices Content

### Categories to Seed

1. **Onboarding Playbooks**
   - First 30/60/90 day frameworks
   - Kickoff meeting templates
   - Success plan templates

2. **Communication Templates**
   - Check-in email templates
   - QBR invitation templates
   - Renewal discussion openers
   - Escalation communication

3. **Health & Risk**
   - Risk identification frameworks
   - Intervention playbooks
   - Churn prevention strategies

4. **Expansion**
   - Upsell conversation guides
   - Cross-sell identification
   - Executive sponsor engagement

5. **Industry Benchmarks**
   - Onboarding timelines by industry
   - Health score benchmarks
   - Engagement frequency standards

---

*Document Version: 1.0*
*Created: January 2026*
*Author: CSCX.AI Team + Claude*
