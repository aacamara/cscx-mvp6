# Context-Aware Agentic Document Generation (CADG)

## Executive Summary

Enable the CSCX.AI platform to generate high-quality artifacts (QBRs, decks, analyses, summaries, emails, etc.) by systematically reasoning across internal knowledge, customer data, and external sources, with a human-in-the-loop approval step before execution.

## Problem Statement

Current AI workflows respond directly to user prompts without:
- Fully leveraging historical knowledge and prior artifacts
- Explicitly reasoning about how to construct outputs
- Providing transparency into data sources and planned actions
- Allowing structured approval before generation and persistence

This leads to:
- Inconsistent outputs that miss available context
- Limited trust and explainability
- Poor reuse of institutional knowledge
- CSMs manually gathering data before asking AI for help

## Solution Overview

When a CSM requests any task via chat, the system will:

```
┌─────────────────────────────────────────────────────────────────┐
│                     1. USER REQUEST                             │
│  "Build me a QBR for Acme Corp"                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. CONTEXT AGGREGATION ENGINE                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Knowledge    │ │  Platform    │ │  External    │            │
│  │ Base         │ │  Data        │ │  Sources     │            │
│  │ • Playbooks  │ │ • Metrics    │ │ • Drive      │            │
│  │ • Templates  │ │ • Health     │ │ • Gmail      │            │
│  │ • SOPs       │ │ • History    │ │ • Past QBRs  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               3. REASONING & PLANNING                           │
│  • Classify task type (QBR, analysis, deck, email, etc.)       │
│  • Select appropriate methodology from knowledge base           │
│  • Identify all relevant data sources                          │
│  • Plan structure and sections                                 │
│  • Determine output format and destination                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               4. PLAN DISCLOSURE (HITL)                         │
│  "I will create a QBR using:                                   │
│   • QBR Best Practices playbook                                │
│   • Customer health data (score: 78, trend: improving)         │
│   • Last 90 days of engagement metrics                         │
│   • Previous QBR from Q3 (found in Drive)                      │
│   • Recent email thread about expansion                        │
│                                                                 │
│   Structure: Executive Summary → Metrics → Wins → Risks →      │
│              Roadmap → Next Steps                              │
│                                                                 │
│   [Approve] [Modify] [Cancel]"                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               5. EXECUTION & GENERATION                         │
│  • Generate artifact following approved plan                   │
│  • Save to Google Drive (customer folder)                      │
│  • Link back to platform                                       │
│  • Track in customer timeline                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               6. REVIEW & ACCESS                                │
│  • Inline preview in chat                                      │
│  • Direct link to document                                     │
│  • Option to iterate/refine                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Task Types

The CADG system must handle ANY CSM request. Initial task types:

| Task Type | Example Prompts | Output Format |
|-----------|-----------------|---------------|
| **QBR Generation** | "Build a QBR for Acme" | Google Slides + PDF |
| **Data Analysis** | "Analyze churn risk for my portfolio" | In-chat report + optional Sheets |
| **Deck/Presentation** | "Create an executive briefing deck" | Google Slides |
| **Email Drafting** | "Draft a renewal proposal email" | Email draft (requires approval) |
| **Meeting Prep** | "Prep me for tomorrow's call with Acme" | In-chat brief |
| **Document Creation** | "Create an onboarding plan" | Google Docs |
| **Transcription Summary** | "Summarize this meeting recording" | In-chat + Docs |
| **Health Analysis** | "Why is Acme's health score dropping?" | In-chat analysis |
| **Expansion Planning** | "Identify expansion opportunities" | In-chat + Docs |
| **Risk Assessment** | "What risks should I focus on this week?" | In-chat report |

## Technical Architecture

### 1. Context Aggregation Engine

New service that orchestrates data gathering across all sources:

```typescript
interface ContextAggregator {
  // Gather all relevant context for a task
  aggregateContext(params: {
    taskType: TaskType;
    customerId: string;
    userQuery: string;
    userId: string;
  }): Promise<AggregatedContext>;
}

interface AggregatedContext {
  // Knowledge base results
  knowledge: {
    playbooks: PlaybookMatch[];
    templates: TemplateMatch[];
    bestPractices: BestPracticeMatch[];
  };

  // Platform data
  platformData: {
    customer360: Customer360;
    healthTrends: HealthTrend[];
    engagementMetrics: EngagementMetrics;
    riskSignals: RiskSignal[];
    interactionHistory: Interaction[];
    renewalForecast: RenewalForecast;
  };

  // External sources
  externalSources: {
    driveDocuments: DriveDocument[];
    emailThreads: EmailThread[];
    calendarEvents: CalendarEvent[];
    previousArtifacts: PreviousArtifact[];
  };

  // Metadata
  metadata: {
    sourcesSearched: string[];
    relevanceScores: Record<string, number>;
    gatheringDurationMs: number;
  };
}
```

### 2. Task Classifier

Determines what type of task the user is requesting:

```typescript
interface TaskClassifier {
  classify(userQuery: string, context: AgentContext): Promise<{
    taskType: TaskType;
    confidence: number;
    suggestedMethodology: string;
    requiredSources: string[];
  }>;
}

type TaskType =
  | 'qbr_generation'
  | 'data_analysis'
  | 'presentation_creation'
  | 'document_creation'
  | 'email_drafting'
  | 'meeting_prep'
  | 'transcription_summary'
  | 'health_analysis'
  | 'expansion_planning'
  | 'risk_assessment'
  | 'custom';
```

### 3. Reasoning Engine

Plans how to construct the output:

```typescript
interface ReasoningEngine {
  createPlan(params: {
    taskType: TaskType;
    context: AggregatedContext;
    userQuery: string;
  }): Promise<ExecutionPlan>;
}

interface ExecutionPlan {
  planId: string;
  taskType: TaskType;

  // What we're using
  inputs: {
    knowledgeBase: Array<{
      title: string;
      relevance: number;
      usage: string; // How it will be used
    }>;
    platformData: Array<{
      source: string;
      dataPoints: string[];
      usage: string;
    }>;
    externalSources: Array<{
      type: 'drive' | 'email' | 'calendar';
      name: string;
      usage: string;
    }>;
  };

  // How we'll structure the output
  structure: {
    sections: Array<{
      name: string;
      description: string;
      dataSources: string[];
    }>;
    outputFormat: 'slides' | 'docs' | 'sheets' | 'chat' | 'email';
    estimatedLength: string;
  };

  // What actions we'll take
  actions: Array<{
    step: number;
    action: string;
    requiresApproval: boolean;
  }>;

  // Where output goes
  destination: {
    primary: string; // e.g., "Google Slides in customer folder"
    secondary?: string; // e.g., "PDF copy"
    chatPreview: boolean;
  };
}
```

### 4. Plan Presenter (Chat UI)

Renders the plan for user approval:

```typescript
interface PlanPresenter {
  // Render plan as structured chat message
  formatPlanForChat(plan: ExecutionPlan): ChatMessage;

  // Handle user response
  handlePlanResponse(
    planId: string,
    response: 'approve' | 'modify' | 'cancel',
    modifications?: PlanModification[]
  ): Promise<void>;
}
```

### 5. Artifact Generator

Executes the approved plan:

```typescript
interface ArtifactGenerator {
  generate(params: {
    plan: ExecutionPlan;
    context: AggregatedContext;
  }): Promise<GeneratedArtifact>;
}

interface GeneratedArtifact {
  artifactId: string;
  type: 'slides' | 'docs' | 'sheets' | 'email' | 'chat';

  // Content
  content: string | Buffer;
  preview: string; // Markdown preview for chat

  // Storage
  storage: {
    driveFileId?: string;
    driveUrl?: string;
    localPath?: string;
  };

  // Metadata
  metadata: {
    generatedAt: Date;
    planId: string;
    customerId: string;
    sourcesUsed: string[];
  };
}
```

## Database Schema

### execution_plans table
```sql
CREATE TABLE execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),

  task_type VARCHAR(50) NOT NULL,
  user_query TEXT NOT NULL,

  plan_json JSONB NOT NULL, -- Full ExecutionPlan
  context_summary JSONB, -- Summary of aggregated context

  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, executing, completed, failed

  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  modifications JSONB, -- User modifications to plan

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### generated_artifacts table
```sql
CREATE TABLE generated_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES execution_plans(id),
  customer_id UUID REFERENCES customers(id),
  user_id UUID REFERENCES users(id),

  artifact_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,

  -- Storage references
  drive_file_id VARCHAR(255),
  drive_url TEXT,
  local_path TEXT,

  -- Content
  preview_markdown TEXT,
  content_hash VARCHAR(64),

  -- Metadata
  sources_used JSONB,
  generation_duration_ms INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### POST /api/agents/plan
Create an execution plan for a task:
```typescript
Request: {
  query: string;
  customerId: string;
}

Response: {
  planId: string;
  plan: ExecutionPlan;
  requiresApproval: boolean;
}
```

### POST /api/agents/plan/:planId/approve
Approve a plan for execution:
```typescript
Request: {
  modifications?: PlanModification[];
}

Response: {
  artifactId: string;
  status: 'generating';
}
```

### GET /api/agents/artifact/:artifactId
Get generated artifact:
```typescript
Response: {
  artifact: GeneratedArtifact;
  preview: string;
  downloadUrl?: string;
}
```

## Chat UI Changes

### Plan Approval Component

When a plan is created, show in chat:

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 EXECUTION PLAN                                           │
├─────────────────────────────────────────────────────────────┤
│ Task: Generate Q4 QBR for Acme Corp                        │
│                                                             │
│ 📚 KNOWLEDGE SOURCES                                        │
│ • QBR Best Practices Playbook (95% relevant)               │
│ • Enterprise QBR Template (92% relevant)                   │
│ • Value Metrics Framework (88% relevant)                   │
│                                                             │
│ 📊 PLATFORM DATA                                            │
│ • Customer 360 Profile                                      │
│ • Health Score: 78% (↑ 5% from last quarter)               │
│ • Engagement: 82% product adoption                         │
│ • 3 risk signals, 2 expansion opportunities               │
│                                                             │
│ 📁 EXTERNAL SOURCES                                         │
│ • Previous QBR (Q3 2024) from Google Drive                 │
│ • Recent email thread: "Expansion Discussion"              │
│ • Upcoming renewal in 45 days                              │
│                                                             │
│ 📝 PLANNED STRUCTURE                                        │
│ 1. Executive Summary                                        │
│ 2. Key Metrics & Health Score                              │
│ 3. Wins & Value Delivered                                  │
│ 4. Challenges & Risks                                      │
│ 5. Product Roadmap                                         │
│ 6. Renewal & Expansion Discussion                          │
│ 7. Action Items & Next Steps                               │
│                                                             │
│ 📤 OUTPUT                                                   │
│ Google Slides → Customer folder → PDF copy                 │
│                                                             │
│ [✓ Approve] [✏️ Modify] [✗ Cancel]                         │
└─────────────────────────────────────────────────────────────┘
```

### Artifact Preview Component

After generation, show:

```
┌─────────────────────────────────────────────────────────────┐
│ ✅ QBR GENERATED SUCCESSFULLY                               │
├─────────────────────────────────────────────────────────────┤
│ 📊 Q4 2024 Business Review - Acme Corp                     │
│                                                             │
│ [Preview shows first slide / executive summary]            │
│                                                             │
│ ─────────────────────────────────────────────────────────  │
│ Executive Summary:                                          │
│ Acme Corp has shown strong adoption this quarter with      │
│ 82% product utilization across 150 users. Health score     │
│ improved from 73% to 78%...                                │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ [🔗 Open in Google Slides] [📥 Download PDF]               │
│ [🔄 Regenerate] [✏️ Edit in Slides]                        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Infrastructure (This PRD)
- Context Aggregation Engine
- Task Classifier
- Reasoning Engine
- Plan Presenter (Chat UI)
- Basic Artifact Generator (chat output only)

### Phase 2: Google Workspace Integration
- Slides generation for QBRs/decks
- Docs generation for plans/summaries
- Sheets generation for analysis
- Drive storage and linking

### Phase 3: Advanced Features
- Template learning from approved modifications
- Cross-customer pattern recognition
- Automated suggestions based on calendar/renewals
- Multi-artifact workflows

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Plan approval rate | >80% | Approved / Total plans |
| Time to QBR | -60% | Before vs after |
| Knowledge base utilization | >90% | Plans using KB / Total |
| User satisfaction | >4.5/5 | Post-generation survey |
| Artifact reuse | >50% | Artifacts referenced again |

## Acceptance Criteria

1. **Context Aggregation**: System queries knowledge base, platform data, and external sources for every request
2. **Plan Generation**: Every generative task shows a plan before execution
3. **Transparency**: Plan clearly shows all sources being used
4. **Approval Flow**: User can approve, modify, or cancel any plan
5. **Execution**: Approved plans generate artifacts correctly
6. **Storage**: Artifacts saved to appropriate destinations
7. **Preview**: In-chat preview of generated content
8. **Links**: Direct links to full documents
9. **Tracking**: All plans and artifacts tracked in database
10. **Reusability**: System learns from modifications to improve future plans
