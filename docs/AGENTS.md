# CSCX.AI Agent Architecture

Complete guide to understanding and building AI agents for CSCX.AI.

## Table of Contents

1. [Overview](#overview)
2. [Agent Types](#agent-types)
3. [Architecture](#architecture)
4. [Building Agents](#building-agents)
5. [LangChain Integration](#langchain-integration)
6. [Gemini Integration](#gemini-integration)
7. [Claude Integration](#claude-integration)
8. [Human-in-the-Loop](#human-in-the-loop)
9. [Best Practices](#best-practices)

---

## Overview

CSCX.AI uses a multi-agent architecture where specialized agents work together to automate customer success workflows. The system follows a hierarchical pattern:

```
CSM (Human)
    ↓
Onboarding Agent (Orchestrator)
    ├── Meeting Agent
    ├── Training Agent
    └── Intelligence Agent
```

### Key Principles

1. **Human-in-the-Loop (HITL)**: Critical actions require CSM approval
2. **Specialized Agents**: Each agent has focused capabilities
3. **Orchestration**: Central agent coordinates subagents
4. **Transparency**: All agent actions are logged and visible

---

## Agent Types

### 1. Onboarding Agent (Orchestrator)

**Purpose**: Main orchestrator that coordinates all subagents and manages the onboarding workflow.

**Capabilities**:
- Coordinate multi-step workflows
- Deploy subagents based on context
- Track onboarding progress
- Request HITL approvals
- Generate success plans

**When to Use**: Always active during customer onboarding

### 2. Meeting Agent

**Purpose**: Handles all meeting-related tasks including scheduling, joining, and transcription.

**Capabilities**:
- Schedule meetings via calendar APIs
- Join Zoom/Meet/Teams calls
- Real-time transcription
- Extract insights from conversations
- Generate meeting summaries

**Integrations**: Zoom, Google Meet, Microsoft Teams, Calendly

### 3. Training Agent

**Purpose**: Provides AI-powered training and self-service support to customers.

**Capabilities**:
- Generate training content
- Answer questions from knowledge base
- Voice-enabled assistance
- Track training completion
- Recommend learning paths

**Integrations**: Knowledge base, Voice APIs

### 4. Intelligence Agent

**Purpose**: Consolidates data and provides insights about customers.

**Capabilities**:
- Sync CRM data (Salesforce, HubSpot)
- Calculate health scores
- Monitor integrations
- Build customer timelines
- Predictive analytics

**Integrations**: Salesforce, HubSpot, internal databases

---

## Architecture

### Agent Communication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend UI                             │
│  (Agent Control Center - React)                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ WebSocket / HTTP
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                               │
│  (Express + Authentication)                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               Agent Orchestrator                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 Onboarding Agent                         ││
│  │  - Workflow State Machine                                ││
│  │  - HITL Approval Queue                                   ││
│  │  - Subagent Dispatcher                                   ││
│  └─────────────────────────────────────────────────────────┘│
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Meeting   │  │  Training   │  │Intelligence │         │
│  │   Agent     │  │   Agent     │  │   Agent     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI Services                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Gemini     │  │   Claude     │  │  LangChain   │       │
│  │   (Fast)     │  │  (Complex)   │  │  (Chains)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Supabase    │  │  Vector DB   │  │  External    │       │
│  │  (Primary)   │  │  (Embeddings)│  │  APIs        │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Message Flow

```typescript
interface AgentMessage {
  id: string;
  sessionId: string;
  agentId: AgentId;
  role: 'user' | 'agent' | 'system';
  content: string;
  metadata: {
    thinking?: boolean;
    requiresApproval?: boolean;
    deployedAgent?: AgentId;
    toolCalls?: ToolCall[];
  };
  timestamp: Date;
}
```

---

## Building Agents

### Base Agent Class

All agents extend the base agent class:

```typescript
// server/src/agents/base.ts
import { GeminiService } from '../services/gemini';
import { ClaudeService } from '../services/claude';
import { SupabaseService } from '../services/supabase';

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  model: 'gemini' | 'claude';
  systemPrompt: string;
  tools: Tool[];
  requiresApproval: string[]; // Actions requiring HITL
}

export interface AgentInput {
  sessionId: string;
  message: string;
  context: CustomerContext;
  history: AgentMessage[];
}

export interface AgentOutput {
  message: string;
  thinking?: boolean;
  requiresApproval?: boolean;
  deployAgent?: AgentId;
  toolCalls?: ToolCall[];
  data?: Record<string, any>;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected gemini: GeminiService;
  protected claude: ClaudeService;
  protected db: SupabaseService;

  constructor(config: AgentConfig) {
    this.config = config;
    this.gemini = new GeminiService();
    this.claude = new ClaudeService();
    this.db = new SupabaseService();
  }

  abstract execute(input: AgentInput): Promise<AgentOutput>;

  protected async think(prompt: string): Promise<string> {
    if (this.config.model === 'claude') {
      return this.claude.generate(prompt, this.config.systemPrompt);
    }
    return this.gemini.generate(prompt, this.config.systemPrompt);
  }

  protected async saveMessage(message: AgentMessage): Promise<void> {
    await this.db.insertMessage(message);
  }

  protected needsApproval(action: string): boolean {
    return this.config.requiresApproval.includes(action);
  }
}
```

### Creating the Onboarding Agent

```typescript
// server/src/agents/onboarding.ts
import { BaseAgent, AgentInput, AgentOutput, AgentConfig } from './base';
import { MeetingAgent } from './meeting';
import { TrainingAgent } from './training';
import { IntelligenceAgent } from './intelligence';

const SYSTEM_PROMPT = `You are the Onboarding Agent for CSCX.AI, an AI-powered customer success platform.

Your role is to:
1. Orchestrate customer onboarding workflows
2. Deploy specialized subagents when needed
3. Track progress and milestones
4. Request human approval for critical actions
5. Maintain context across the entire onboarding journey

Available subagents:
- Meeting Agent: Schedule calls, join meetings, transcribe
- Training Agent: Generate training, answer questions
- Intelligence Agent: Pull CRM data, calculate health scores

Always be helpful, professional, and proactive. If you're unsure, ask clarifying questions.
When deploying a subagent, explain what it will do.
For actions that affect the customer directly (sending emails, scheduling meetings), request approval.`;

const ONBOARDING_TOOLS = [
  {
    name: 'deployMeetingAgent',
    description: 'Deploy the Meeting Agent to schedule or join calls',
    parameters: { action: 'schedule' | 'join' | 'transcribe', details: 'string' }
  },
  {
    name: 'deployTrainingAgent',
    description: 'Deploy the Training Agent for customer training',
    parameters: { action: 'generate' | 'answer' | 'recommend', topic: 'string' }
  },
  {
    name: 'deployIntelligenceAgent',
    description: 'Deploy the Intelligence Agent to gather data',
    parameters: { action: 'pullCRM' | 'calculateHealth' | 'buildTimeline' }
  },
  {
    name: 'generateSuccessPlan',
    description: 'Generate a 30-60-90 day success plan',
    parameters: { customerId: 'string' }
  },
  {
    name: 'requestApproval',
    description: 'Request CSM approval for an action',
    parameters: { action: 'string', details: 'string' }
  }
];

export class OnboardingAgent extends BaseAgent {
  private meetingAgent: MeetingAgent;
  private trainingAgent: TrainingAgent;
  private intelligenceAgent: IntelligenceAgent;

  constructor() {
    super({
      id: 'onboarding',
      name: 'Onboarding Agent',
      description: 'Main orchestrator for customer onboarding',
      model: 'gemini', // Fast for orchestration
      systemPrompt: SYSTEM_PROMPT,
      tools: ONBOARDING_TOOLS,
      requiresApproval: ['sendEmail', 'scheduleMeeting', 'updateCRM']
    });

    this.meetingAgent = new MeetingAgent();
    this.trainingAgent = new TrainingAgent();
    this.intelligenceAgent = new IntelligenceAgent();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    // Build prompt with context
    const prompt = this.buildPrompt(input);

    // Get AI response with tool calls
    const response = await this.think(prompt);

    // Parse response for tool calls
    const toolCalls = this.parseToolCalls(response);

    // Execute tool calls
    for (const call of toolCalls) {
      await this.executeTool(call, input);
    }

    // Check if approval needed
    const requiresApproval = toolCalls.some(
      call => this.needsApproval(call.name)
    );

    return {
      message: response,
      requiresApproval,
      toolCalls
    };
  }

  private buildPrompt(input: AgentInput): string {
    return `
Customer Context:
- Name: ${input.context.name}
- ARR: ${input.context.arr}
- Stage: ${input.context.stage || 'Onboarding'}

Recent History:
${input.history.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

User Message: ${input.message}

Respond helpfully and decide if you need to deploy a subagent or request approval.
`;
  }

  private parseToolCalls(response: string): ToolCall[] {
    // Parse structured tool calls from response
    // Implementation depends on your prompt engineering
    return [];
  }

  private async executeTool(call: ToolCall, input: AgentInput): Promise<any> {
    switch (call.name) {
      case 'deployMeetingAgent':
        return this.meetingAgent.execute({
          ...input,
          message: call.parameters.details
        });
      case 'deployTrainingAgent':
        return this.trainingAgent.execute({
          ...input,
          message: call.parameters.topic
        });
      case 'deployIntelligenceAgent':
        return this.intelligenceAgent.execute({
          ...input,
          message: call.parameters.action
        });
      default:
        return null;
    }
  }
}
```

### Creating the Meeting Agent

```typescript
// server/src/agents/meeting.ts
import { BaseAgent, AgentInput, AgentOutput } from './base';
import { CalendarService } from '../services/calendar';
import { ZoomService } from '../services/zoom';
import { TranscriptionService } from '../services/transcription';

const SYSTEM_PROMPT = `You are the Meeting Agent for CSCX.AI.

Your capabilities:
1. Schedule meetings with customers via calendar integration
2. Join video calls (Zoom, Meet, Teams)
3. Transcribe meetings in real-time
4. Extract key insights from conversations
5. Generate meeting summaries

When scheduling, always:
- Check calendar availability
- Suggest multiple time slots
- Include clear agenda
- Send calendar invites (with approval)

When transcribing, capture:
- Key decisions made
- Action items assigned
- Concerns raised
- Stakeholder sentiment`;

export class MeetingAgent extends BaseAgent {
  private calendar: CalendarService;
  private zoom: ZoomService;
  private transcription: TranscriptionService;

  constructor() {
    super({
      id: 'meeting',
      name: 'Meeting Agent',
      description: 'Handles meeting scheduling and transcription',
      model: 'gemini',
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      requiresApproval: ['sendInvite', 'joinCall']
    });

    this.calendar = new CalendarService();
    this.zoom = new ZoomService();
    this.transcription = new TranscriptionService();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const action = this.detectAction(input.message);

    switch (action) {
      case 'schedule':
        return this.scheduleMeeting(input);
      case 'transcribe':
        return this.transcribeMeeting(input);
      case 'summarize':
        return this.summarizeMeeting(input);
      default:
        return this.handleGeneral(input);
    }
  }

  private async scheduleMeeting(input: AgentInput): Promise<AgentOutput> {
    // Get availability
    const availability = await this.calendar.getAvailability(
      input.context.stakeholders || []
    );

    // Generate response with slots
    const response = await this.think(`
      Find meeting times for: ${input.context.name}
      Available slots: ${JSON.stringify(availability)}
      Generate a professional response suggesting the best times.
    `);

    return {
      message: response,
      requiresApproval: true,
      data: { availability }
    };
  }

  private async transcribeMeeting(input: AgentInput): Promise<AgentOutput> {
    // Start transcription service
    const transcript = await this.transcription.start(input.context);

    return {
      message: 'Recording started. I will capture the transcript and extract insights.',
      thinking: true,
      data: { transcriptId: transcript.id }
    };
  }

  private async summarizeMeeting(input: AgentInput): Promise<AgentOutput> {
    // Get transcript from database
    const transcript = await this.db.getTranscript(input.context.meetingId);

    // Use Claude for complex analysis
    const summary = await this.claude.generate(`
      Analyze this meeting transcript and extract:
      1. Key decisions made
      2. Action items (with owners)
      3. Concerns or objections raised
      4. Overall sentiment
      5. Recommended next steps

      Transcript:
      ${transcript}
    `, SYSTEM_PROMPT);

    return {
      message: summary,
      data: { structured: this.parseInsights(summary) }
    };
  }

  private detectAction(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('schedule') || lower.includes('book')) return 'schedule';
    if (lower.includes('transcribe') || lower.includes('record')) return 'transcribe';
    if (lower.includes('summarize') || lower.includes('insights')) return 'summarize';
    return 'general';
  }

  private async handleGeneral(input: AgentInput): Promise<AgentOutput> {
    const response = await this.think(input.message);
    return { message: response };
  }

  private parseInsights(summary: string): MeetingInsights {
    // Parse structured insights from summary
    return {
      decisions: [],
      actionItems: [],
      concerns: [],
      sentiment: 'neutral',
      nextSteps: []
    };
  }
}
```

### Creating the Intelligence Agent

```typescript
// server/src/agents/intelligence.ts
import { BaseAgent, AgentInput, AgentOutput } from './base';
import { SalesforceService } from '../services/salesforce';
import { HubspotService } from '../services/hubspot';

const SYSTEM_PROMPT = `You are the Intelligence Agent for CSCX.AI.

Your role is to:
1. Pull and consolidate customer data from CRM systems
2. Calculate and explain health scores
3. Monitor integration status
4. Build comprehensive customer timelines
5. Identify risks and opportunities

When presenting data:
- Be concise but comprehensive
- Highlight key metrics
- Flag any concerns
- Suggest actionable insights`;

export class IntelligenceAgent extends BaseAgent {
  private salesforce: SalesforceService;
  private hubspot: HubspotService;

  constructor() {
    super({
      id: 'intelligence',
      name: 'Intelligence Agent',
      description: 'Data consolidation and analytics',
      model: 'claude', // Complex analysis
      systemPrompt: SYSTEM_PROMPT,
      tools: [],
      requiresApproval: ['updateCRM']
    });

    this.salesforce = new SalesforceService();
    this.hubspot = new HubspotService();
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const action = this.detectAction(input.message);

    switch (action) {
      case 'pullData':
        return this.pullCustomerData(input);
      case 'healthScore':
        return this.calculateHealthScore(input);
      case 'timeline':
        return this.buildTimeline(input);
      default:
        return this.handleGeneral(input);
    }
  }

  private async pullCustomerData(input: AgentInput): Promise<AgentOutput> {
    // Pull from multiple sources
    const [sfData, hubspotData, internalData] = await Promise.all([
      this.salesforce.getAccount(input.context.name),
      this.hubspot.getCompany(input.context.name),
      this.db.getCustomer(input.context.name)
    ]);

    // Consolidate with AI
    const consolidated = await this.think(`
      Consolidate this customer data into a unified profile:

      Salesforce: ${JSON.stringify(sfData)}
      HubSpot: ${JSON.stringify(hubspotData)}
      Internal: ${JSON.stringify(internalData)}

      Create a comprehensive customer profile with key metrics.
    `);

    return {
      message: consolidated,
      data: { sfData, hubspotData, internalData }
    };
  }

  private async calculateHealthScore(input: AgentInput): Promise<AgentOutput> {
    // Get all relevant data
    const customer = await this.db.getCustomerWithRelations(input.context.name);

    // Calculate score components
    const scores = {
      engagement: this.calculateEngagement(customer),
      adoption: this.calculateAdoption(customer),
      sentiment: await this.calculateSentiment(customer),
      growth: this.calculateGrowth(customer)
    };

    const overall = Object.values(scores).reduce((a, b) => a + b, 0) / 4;

    // Generate explanation
    const explanation = await this.think(`
      Explain this health score breakdown:
      - Overall: ${overall}/100
      - Engagement: ${scores.engagement}/100
      - Adoption: ${scores.adoption}/100
      - Sentiment: ${scores.sentiment}/100
      - Growth: ${scores.growth}/100

      Highlight concerns and recommendations.
    `);

    return {
      message: explanation,
      data: { overall, ...scores }
    };
  }

  private calculateEngagement(customer: any): number {
    // Logic for engagement score
    return 85;
  }

  private calculateAdoption(customer: any): number {
    // Logic for adoption score
    return 72;
  }

  private async calculateSentiment(customer: any): Promise<number> {
    // Analyze recent communications for sentiment
    return 78;
  }

  private calculateGrowth(customer: any): number {
    // Calculate growth/expansion potential
    return 90;
  }

  private async buildTimeline(input: AgentInput): Promise<AgentOutput> {
    // Build comprehensive timeline
    const events = await this.db.getCustomerEvents(input.context.name);

    const timeline = await this.think(`
      Create a narrative timeline from these events:
      ${JSON.stringify(events)}

      Include key milestones, decisions, and turning points.
    `);

    return {
      message: timeline,
      data: { events }
    };
  }

  private detectAction(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('pull') || lower.includes('data')) return 'pullData';
    if (lower.includes('health') || lower.includes('score')) return 'healthScore';
    if (lower.includes('timeline') || lower.includes('history')) return 'timeline';
    return 'general';
  }

  private async handleGeneral(input: AgentInput): Promise<AgentOutput> {
    const response = await this.think(input.message);
    return { message: response };
  }
}
```

---

## LangChain Integration (Current Implementation)

CSCX.AI now uses a fully LangChain-powered agent system with RAG (Retrieval Augmented Generation) for context-aware responses.

### Directory Structure

```
server/src/langchain/
├── index.ts           # Main exports
├── agents/
│   ├── CSAgents.ts    # 5 Specialist agents
│   └── Orchestrator.ts # Auto-routing orchestrator
├── tools/
│   └── index.ts       # 10 agent tools
└── vectorstore/
    └── index.ts       # In-memory RAG knowledge base
```

### Specialist Agents

The system includes 5 specialized Customer Success agents:

| Agent | Purpose | Auto-Routing Triggers |
|-------|---------|----------------------|
| **Onboarding** | New customer setup, kickoff, 30-60-90 plans | Status = 'onboarding', keywords: "kickoff", "getting started" |
| **Adoption** | Product usage, feature adoption, training | Health > 70, keywords: "adoption", "usage", "training" |
| **Renewal** | Renewals, expansion, commercial negotiations | Renewal < 90 days, keywords: "renew", "contract", "pricing" |
| **Risk** | At-risk customers, save plays, escalations | Health < 50, keywords: "risk", "churn", "cancel", "issue" |
| **Strategic** | Executive relationships, QBRs, planning | Keywords: "executive", "qbr", "strategic", "partnership" |

### Auto-Routing Orchestrator

The orchestrator intelligently routes conversations to the appropriate specialist:

```typescript
// Routing decision structure
interface RoutingDecision {
  agentType: CSAgentType;
  confidence: number;  // 0-1
  reasoning: string;
}

// Example routing logic
if (context.healthScore < 50) {
  return { agentType: 'risk', confidence: 0.85, reasoning: 'Low health score' };
}
if (context.renewalDate && daysToRenewal <= 90) {
  return { agentType: 'renewal', confidence: 0.9, reasoning: 'Approaching renewal' };
}
```

### RAG Knowledge Base

The system uses an in-memory vector store with semantic search:

```typescript
// Search the knowledge base
const results = await vectorStore.hybridSearch(
  query,           // Natural language query
  limit,           // Max results (default 5)
  collection       // Optional: 'playbooks', 'contracts', etc.
);

// Returns documents with similarity scores
results.forEach(r => {
  console.log(r.document.content, r.score);
});
```

**Seeded Collections:**
- `knowledge_base` - CS best practices, frameworks, templates
- `playbooks` - Onboarding, renewal, risk mitigation playbooks
- `contracts` - Past customer contracts
- `customer_notes` - Interaction history

### Available Tools

Agents have access to 10 tools:

| Tool | Description | HITL Required |
|------|-------------|---------------|
| `search_knowledge_base` | Search CS knowledge base | No |
| `search_contracts` | Search past contracts | No |
| `search_customer_notes` | Search customer history | No |
| `schedule_meeting` | Schedule customer meetings | **Yes** |
| `send_email` | Send emails to customers | **Yes** |
| `create_task` | Create follow-up tasks | No |
| `log_activity` | Log customer interactions | No |
| `calculate_health_score` | Calculate customer health | No |
| `search_google_drive` | Search connected Drive | No |
| `get_customer_summary` | Get customer overview | No |

### API Endpoints

```
POST /api/ai/chat              # Chat with auto-routing
POST /api/ai/chat/:agentType   # Chat with specific agent
POST /api/ai/analyze           # Multi-agent analysis
POST /api/ai/workflow          # Execute workflows
POST /api/ai/knowledge/search  # Search knowledge base
POST /api/ai/knowledge/add     # Add to knowledge base
GET  /api/ai/agents            # List available agents
GET  /api/ai/session           # Get session state
POST /api/ai/session/clear     # Clear session
```

### Example: Chat with Auto-Routing

```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "This customer has declining health score, what should I do?",
    "customerContext": {
      "id": "acme-corp",
      "name": "Acme Corp",
      "arr": 150000,
      "healthScore": 45,
      "status": "active"
    }
  }'

# Response includes routing decision
{
  "response": "Based on the declining health score...",
  "agentType": "risk",
  "routing": {
    "agentType": "risk",
    "confidence": 0.85,
    "reasoning": "Customer health score is critically low"
  },
  "suggestedActions": ["schedule call", "reach out"]
}
```

### Frontend Integration

The AgentControlCenter component supports:

1. **Auto-routing mode** (default) - Orchestrator selects best agent
2. **Manual selection** - User can force specific agent via dropdown
3. **Routing visibility** - Shows which agent was selected and confidence

```typescript
// Agent selector in UI
<select value={selectedAgent} onChange={...}>
  <option value="auto">Auto-route (Recommended)</option>
  <option value="onboarding">Onboarding Specialist</option>
  <option value="adoption">Adoption Specialist</option>
  <option value="renewal">Renewal Specialist</option>
  <option value="risk">Risk Specialist</option>
  <option value="strategic">Strategic CSM</option>
</select>
```

### Multi-Step Workflows

Execute predefined workflows that span multiple agents:

```typescript
// Available workflows
const workflows = ['onboarding', 'renewal_prep', 'risk_mitigation', 'qbr_prep'];

// Example: Risk mitigation workflow
POST /api/ai/workflow
{
  "workflowType": "risk_mitigation",
  "customerContext": { ... }
}

// Executes:
// 1. Risk Agent: Analyze root causes
// 2. Risk Agent: Create save play
// 3. Adoption Agent: Identify quick wins
// 4. Strategic Agent: Plan executive engagement
```

### Legacy LangChain Service

For advanced custom chains, use the base LangChain service:

```typescript
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';

// Create custom chains with LangChain primitives
const model = new ChatGoogleGenerativeAI({
  modelName: 'gemini-2.0-flash',
  apiKey: process.env.GEMINI_API_KEY!,
});
```
```

---

## Human-in-the-Loop

### Approval Flow

```typescript
// server/src/services/hitl.ts
export interface ApprovalRequest {
  id: string;
  sessionId: string;
  agentId: AgentId;
  action: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class HITLService {
  private db: SupabaseService;

  async requestApproval(request: Omit<ApprovalRequest, 'id' | 'status' | 'createdAt'>): Promise<ApprovalRequest> {
    const approval = await this.db.createApproval({
      ...request,
      status: 'pending',
      createdAt: new Date()
    });

    // Notify CSM (WebSocket, email, Slack, etc.)
    await this.notifyCSM(approval);

    return approval;
  }

  async resolveApproval(id: string, approved: boolean, userId: string): Promise<ApprovalRequest> {
    const approval = await this.db.updateApproval(id, {
      status: approved ? 'approved' : 'rejected',
      resolvedAt: new Date(),
      resolvedBy: userId
    });

    // Continue or halt agent workflow
    if (approved) {
      await this.resumeAgent(approval);
    }

    return approval;
  }

  private async resumeAgent(approval: ApprovalRequest): Promise<void> {
    // Resume the agent that was waiting for approval
    // This could emit an event or directly call the agent
  }
}
```

---

## Best Practices

### 1. Keep Agents Focused

Each agent should have a clear, single purpose. Don't overload agents with too many capabilities.

### 2. Use the Right Model

- **Gemini**: Fast, good for simple tasks, orchestration
- **Claude**: Complex reasoning, analysis, nuanced responses

### 3. Log Everything

```typescript
// Always log agent actions
await this.db.log({
  agentId: this.config.id,
  action: 'execute',
  input: input.message,
  output: response.message,
  duration: Date.now() - startTime
});
```

### 4. Handle Errors Gracefully

```typescript
try {
  return await this.execute(input);
} catch (error) {
  await this.db.logError(error);
  return {
    message: "I encountered an issue. Let me try a different approach.",
    error: true
  };
}
```

### 5. Test with Mock Data

Create mock services for testing:

```typescript
// server/src/services/__mocks__/salesforce.ts
export class MockSalesforceService {
  async getAccount(name: string) {
    return { name, arr: 100000, status: 'Active' };
  }
}
```

### 6. Use TypeScript Strictly

Enable strict mode and define interfaces for all data:

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```
