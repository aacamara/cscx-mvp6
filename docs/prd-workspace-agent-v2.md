# PRD: WorkspaceAgent V2 - Autonomous CSM Platform

## Overview

Transform the existing WorkspaceAgent from mock-based to a fully autonomous, MCP-powered Customer Success platform with proactive agents, meeting intelligence, and natural language automations.

**Scope**: 4 Phases (Phase 2 CRM skipped per user request)
**Execution Mode**: Ralph Loop Overnight Batch

---

## Phase 1: MCP Foundation + Real Integrations

### 1.1 MCP Tool Router Infrastructure

**Goal**: Create a Model Context Protocol compatible tool routing system that standardizes how agents access external services.

#### Files to Create/Modify:

**NEW: `server/src/mcp/index.ts`**
```typescript
// MCP Tool Router - Central hub for all tool integrations
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute: (input: unknown, context: MCPContext) => Promise<MCPResult>;
  category: 'communication' | 'calendar' | 'documents' | 'intelligence' | 'automation';
  requiresAuth: boolean;
  requiresApproval: boolean;
}

export interface MCPContext {
  userId: string;
  customerId?: string;
  customerName?: string;
  sessionId: string;
  approvalCallback?: (action: string, preview: unknown) => Promise<boolean>;
}

export interface MCPResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresApproval?: boolean;
  approvalId?: string;
}
```

**NEW: `server/src/mcp/tools/gmail.ts`**
- Wrap existing `server/src/services/google/gmail.ts` in MCP interface
- Tools: `gmail.list_threads`, `gmail.get_thread`, `gmail.send_email`, `gmail.draft_email`
- Use existing googleOAuth for auth

**NEW: `server/src/mcp/tools/calendar.ts`**
- Wrap existing calendar service
- Tools: `calendar.list_events`, `calendar.find_availability`, `calendar.create_event`, `calendar.update_event`

**NEW: `server/src/mcp/tools/drive.ts`**
- Wrap existing drive service
- Tools: `drive.search`, `drive.create_folder`, `drive.upload_file`, `drive.share`

**NEW: `server/src/mcp/tools/slack.ts`**
- NEW Slack integration
- Tools: `slack.send_message`, `slack.list_channels`, `slack.search_messages`, `slack.add_reaction`
- Use Slack Web API with OAuth

**NEW: `server/src/mcp/registry.ts`**
- Central registry of all MCP tools
- Dynamic tool discovery
- Tool search by category/capability
- Permission checking

#### Backend Route:

**MODIFY: `server/src/routes/workspace-agent.ts`**
- Update `/execute` to use MCP tool router
- Add `/tools` endpoint to list available tools
- Add `/tools/:toolId/execute` for direct tool invocation

### 1.2 Connect WorkspaceAgent UI to Real Backend

**Goal**: Replace all mock data with real API calls.

#### Files to Modify:

**MODIFY: `components/WorkspaceAgent/index.tsx`**

Replace mock handlers with real API calls:

```typescript
// Instead of mock data, call backend
const handleSummarizeEmails = async () => {
  const response = await fetch(`${API_URL}/api/mcp/tools/gmail.list_threads/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ customerId, limit: 10 })
  });
  const data = await response.json();
  setEmailSummary(data);
};
```

- Update all 25+ action handlers to call MCP tools
- Add loading states per action
- Add error handling with retry
- Add WebSocket subscription for real-time updates

### 1.3 Slack Integration

**Goal**: Full Slack integration for CSM workflows.

#### Files to Create:

**NEW: `server/src/services/slack/index.ts`**
```typescript
import { WebClient } from '@slack/web-api';

export class SlackService {
  private client: WebClient;

  async sendMessage(channel: string, text: string, blocks?: Block[]): Promise<void>;
  async listChannels(): Promise<Channel[]>;
  async searchMessages(query: string): Promise<Message[]>;
  async getCustomerChannel(customerId: string): Promise<Channel | null>;
  async postCustomerUpdate(customerId: string, update: CustomerUpdate): Promise<void>;
  async createThread(channel: string, message: string): Promise<string>;
  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void>;
}
```

**NEW: `server/src/services/slack/oauth.ts`**
- OAuth2 flow for Slack
- Token storage in Supabase
- Scope: `channels:read`, `channels:write`, `chat:write`, `search:read`, `users:read`

**NEW: `server/src/routes/slack.ts`**
- OAuth callback
- Webhook handler for Slack events
- Message posting endpoints

---

## Phase 3: Proactive Triggers + Playbook Engine

### 3.1 Trigger System

**Goal**: Event-driven automation that runs proactively.

#### Files to Create:

**NEW: `server/src/triggers/index.ts`**
```typescript
export interface Trigger {
  id: string;
  name: string;
  type: 'schedule' | 'event' | 'condition';
  condition: TriggerCondition;
  actions: TriggerAction[];
  enabled: boolean;
  customerId?: string; // null = all customers
}

export interface TriggerCondition {
  type: 'health_score_drop' | 'no_login' | 'ticket_escalated' |
        'renewal_approaching' | 'nps_submitted' | 'champion_left' |
        'usage_spike' | 'usage_drop' | 'contract_milestone';
  params: Record<string, unknown>;
}

export interface TriggerAction {
  type: 'draft_email' | 'send_slack' | 'create_task' | 'alert_csm' |
        'run_playbook' | 'update_health_score' | 'log_activity';
  params: Record<string, unknown>;
  requiresApproval: boolean;
}
```

**NEW: `server/src/triggers/engine.ts`**
```typescript
export class TriggerEngine {
  private triggers: Map<string, Trigger>;
  private scheduler: NodeSchedule;

  async evaluateTriggers(event: CustomerEvent): Promise<TriggerResult[]>;
  async runScheduledTriggers(): Promise<void>;
  async registerTrigger(trigger: Trigger): Promise<void>;
  async pauseTrigger(triggerId: string): Promise<void>;
}
```

**NEW: `server/src/triggers/conditions/`**
- `health-score-drop.ts` - Detect significant health score decreases
- `no-login.ts` - Detect customers with no recent activity
- `ticket-escalated.ts` - React to support escalations
- `renewal-approaching.ts` - 90/60/30/7 day triggers
- `nps-submitted.ts` - React to NPS scores
- `champion-left.ts` - LinkedIn integration for stakeholder changes
- `usage-anomaly.ts` - Spike or drop detection

### 3.2 Playbook Engine

**Goal**: Executable multi-step playbooks that guide CSM workflows.

#### Files to Create:

**NEW: `server/src/playbooks/index.ts`**
```typescript
export interface Playbook {
  id: string;
  name: string;
  description: string;
  type: 'renewal' | 'onboarding' | 'risk' | 'expansion' | 'qbr' | 'custom';
  stages: PlaybookStage[];
  triggers: PlaybookTrigger[];
  variables: PlaybookVariable[];
}

export interface PlaybookStage {
  id: string;
  name: string;
  daysOffset: number; // Relative to anchor date (e.g., renewal date)
  actions: PlaybookAction[];
  conditions: StageCondition[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface PlaybookAction {
  id: string;
  type: 'email' | 'meeting' | 'task' | 'slack' | 'document' | 'call';
  template?: string;
  params: Record<string, unknown>;
  status: 'pending' | 'completed' | 'failed';
  requiresApproval: boolean;
  completedAt?: Date;
}
```

**NEW: `server/src/playbooks/executor.ts`**
```typescript
export class PlaybookExecutor {
  async startPlaybook(playbookId: string, customerId: string, anchorDate: Date): Promise<PlaybookExecution>;
  async advanceStage(executionId: string): Promise<void>;
  async executeAction(executionId: string, actionId: string): Promise<ActionResult>;
  async pausePlaybook(executionId: string): Promise<void>;
  async getProgress(executionId: string): Promise<PlaybookProgress>;
}
```

**NEW: `server/src/playbooks/templates/`**
- `renewal-90-day.ts` - Standard renewal playbook
- `risk-mitigation.ts` - Customer at risk playbook
- `expansion-opportunity.ts` - Upsell playbook
- `onboarding-30-60-90.ts` - Onboarding playbook
- `qbr-preparation.ts` - QBR playbook

### 3.3 Playbook UI Component

**NEW: `components/PlaybookRunner/index.tsx`**
- Visual playbook timeline
- Stage progress indicators
- Action execution buttons
- Approval integration
- Real-time status updates via WebSocket

---

## Phase 4: Meeting Intelligence

### 4.1 Zoom Integration

**Goal**: Full meeting lifecycle management with AI-powered intelligence.

#### Files to Create:

**NEW: `server/src/services/zoom/index.ts`**
```typescript
export class ZoomService {
  async listMeetings(userId: string): Promise<Meeting[]>;
  async getMeeting(meetingId: string): Promise<MeetingDetails>;
  async createMeeting(params: CreateMeetingParams): Promise<Meeting>;
  async getRecording(meetingId: string): Promise<Recording>;
  async getTranscript(meetingId: string): Promise<Transcript>;
  async registerWebhook(events: ZoomEvent[]): Promise<void>;
}
```

**NEW: `server/src/services/zoom/oauth.ts`**
- Zoom OAuth2 implementation
- Token management
- Scope: `meeting:read`, `meeting:write`, `recording:read`, `user:read`

**NEW: `server/src/services/zoom/webhooks.ts`**
- Handle: `meeting.started`, `meeting.ended`, `recording.completed`, `recording.transcript_completed`
- Trigger meeting intelligence pipeline

### 4.2 Meeting Intelligence Pipeline

**NEW: `server/src/services/meeting-intelligence/index.ts`**
```typescript
export class MeetingIntelligence {
  async processTranscript(transcript: Transcript): Promise<MeetingAnalysis>;
  async extractActionItems(transcript: Transcript): Promise<ActionItem[]>;
  async analyzeSentiment(transcript: Transcript): Promise<SentimentAnalysis>;
  async detectCustomerSignals(transcript: Transcript): Promise<CustomerSignal[]>;
  async generateSummary(transcript: Transcript): Promise<MeetingSummary>;
  async generateFollowUpEmail(meeting: MeetingAnalysis): Promise<EmailDraft>;
}
```

**NEW: `server/src/services/meeting-intelligence/processors/`**
- `action-extractor.ts` - Uses Claude to extract action items
- `sentiment-analyzer.ts` - Per-speaker sentiment tracking
- `signal-detector.ts` - Risk, opportunity, feedback signals
- `summary-generator.ts` - Executive summary generation
- `topic-segmenter.ts` - Break transcript into topics

### 4.3 Real-Time Meeting Bot (Future-Ready)

**NEW: `server/src/services/meeting-bot/index.ts`**
```typescript
// Architecture for future real-time meeting assistant
export interface MeetingBot {
  joinMeeting(meetingUrl: string): Promise<void>;
  startTranscription(): Promise<void>;
  onUtterance(callback: (utterance: Utterance) => void): void;
  onSignalDetected(callback: (signal: Signal) => void): void;
  leaveMeeting(): Promise<void>;
}
```

### 4.4 Meeting Intelligence UI

**MODIFY: `components/WorkspaceAgent/index.tsx`**
- Add meeting intelligence section
- Show recent meetings with transcripts
- Display AI-generated summaries
- Action item extraction UI
- Sentiment visualization
- Customer signal alerts

---

## Phase 5: Skills System + Natural Language Automations

### 5.1 Skills System

**Goal**: User-definable skills as markdown files that extend agent capabilities.

#### Files to Create:

**NEW: `server/src/skills/index.ts`**
```typescript
export interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: SkillTrigger;
  steps: SkillStep[];
  variables: SkillVariable[];
  approvalPolicy: ApprovalPolicy;
}

export interface SkillTrigger {
  type: 'command' | 'phrase' | 'event';
  patterns: string[]; // e.g., ["prepare QBR for {customer}", "QBR prep"]
}

export interface SkillStep {
  id: string;
  action: string; // MCP tool name
  params: Record<string, string>; // Can use variables like {{customer}}
  condition?: string; // Optional condition to skip step
  onError: 'continue' | 'abort' | 'retry';
}
```

**NEW: `server/src/skills/parser.ts`**
```typescript
export class SkillParser {
  async parseMarkdown(content: string): Promise<Skill>;
  async validateSkill(skill: Skill): Promise<ValidationResult>;
}
```

**NEW: `server/src/skills/executor.ts`**
```typescript
export class SkillExecutor {
  async executeSkill(skillId: string, context: SkillContext): Promise<SkillResult>;
  async resolveVariables(skill: Skill, context: SkillContext): Promise<ResolvedSkill>;
  async executeStep(step: SkillStep, context: SkillContext): Promise<StepResult>;
}
```

**NEW: `server/src/skills/templates/`** (Markdown skill files)
- `qbr-prep.md` - QBR preparation skill
- `renewal-kickoff.md` - Renewal kickoff skill
- `risk-review.md` - Risk review skill
- `weekly-digest.md` - Weekly digest skill
- `customer-onboard.md` - Onboarding skill

Example skill file (`qbr-prep.md`):
```markdown
# QBR Preparation

## Trigger
- "prepare QBR for {customer}"
- "QBR prep {customer}"

## Variables
- customer: Customer name (required)
- quarter: Current quarter (auto)

## Steps

### 1. Gather Usage Metrics
- Action: analytics.get_usage_metrics
- Params: { customerId: "{{customer_id}}", period: "90d" }

### 2. Summarize Recent Emails
- Action: gmail.summarize_threads
- Params: { customerId: "{{customer_id}}", limit: 20 }

### 3. Get Health Score Trend
- Action: health.get_trend
- Params: { customerId: "{{customer_id}}", period: "90d" }

### 4. List Recent Meetings
- Action: calendar.list_events
- Params: { customerId: "{{customer_id}}", period: "90d" }

### 5. Generate QBR Document
- Action: docs.create_from_template
- Params: { template: "qbr", data: "{{aggregated_data}}" }
- Requires Approval: true

### 6. Create QBR Slides
- Action: slides.create_from_template
- Params: { template: "qbr_deck", data: "{{aggregated_data}}" }
- Requires Approval: true

## Approval Required
- Creating documents
- Sending emails
```

### 5.2 Natural Language Automation Builder

**Goal**: Let CSMs create automations using natural language.

#### Files to Create:

**NEW: `server/src/automations/nl-parser.ts`**
```typescript
export class NaturalLanguageAutomationParser {
  async parseAutomation(input: string): Promise<AutomationDefinition>;

  // Examples:
  // "Every Monday at 9am, send me a summary of customers with health score below 70"
  // "When a customer hasn't logged in for 14 days, draft a re-engagement email"
  // "After every meeting with Acme Corp, create meeting notes and send follow-up"
}
```

**NEW: `server/src/automations/builder.ts`**
```typescript
export class AutomationBuilder {
  async createFromNL(input: string, userId: string): Promise<Automation>;
  async validateAutomation(automation: Automation): Promise<ValidationResult>;
  async scheduleAutomation(automation: Automation): Promise<void>;
  async testAutomation(automationId: string): Promise<TestResult>;
}
```

**NEW: `server/src/automations/scheduler.ts`**
```typescript
export class AutomationScheduler {
  async scheduleRecurring(automation: Automation): Promise<void>;
  async scheduleOneTime(automation: Automation, runAt: Date): Promise<void>;
  async cancelSchedule(automationId: string): Promise<void>;
  async getUpcoming(userId: string): Promise<ScheduledRun[]>;
}
```

### 5.3 Automation UI

**NEW: `components/AutomationBuilder/index.tsx`**
- Natural language input field
- Parsed automation preview
- Variable extraction
- Schedule configuration
- Test run button
- Active automation list

---

## Database Schema Updates

### New Tables:

```sql
-- MCP Tool Registry
CREATE TABLE mcp_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  input_schema JSONB,
  requires_auth BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers
CREATE TABLE triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES customers(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  condition JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_fired_at TIMESTAMPTZ,
  fire_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbook Definitions
CREATE TABLE playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  stages JSONB NOT NULL,
  triggers JSONB,
  variables JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbook Executions
CREATE TABLE playbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID REFERENCES playbooks(id),
  customer_id UUID REFERENCES customers(id),
  user_id UUID REFERENCES auth.users(id),
  anchor_date DATE NOT NULL,
  current_stage TEXT,
  stage_statuses JSONB DEFAULT '{}',
  action_results JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Skills
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  trigger_patterns TEXT[],
  steps JSONB NOT NULL,
  variables JSONB,
  approval_policy JSONB,
  enabled BOOLEAN DEFAULT true,
  source TEXT, -- 'builtin' | 'user' | 'shared'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automations
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  natural_language TEXT,
  parsed_definition JSONB,
  schedule JSONB,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting Intelligence
CREATE TABLE meeting_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  platform TEXT, -- 'zoom' | 'google_meet' | 'teams'
  transcript TEXT,
  summary TEXT,
  action_items JSONB,
  sentiment_analysis JSONB,
  customer_signals JSONB,
  topics JSONB,
  follow_up_draft TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Slack Integration
CREATE TABLE slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  team_id TEXT NOT NULL,
  team_name TEXT,
  access_token TEXT NOT NULL,
  bot_user_id TEXT,
  scopes TEXT[],
  connected_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Implementation Order

### Story 1: MCP Tool Router (Phase 1)
- Create MCP infrastructure
- Wrap existing Google services
- Add tool registry
- Update workspace-agent route

### Story 2: Connect WorkspaceAgent to Backend (Phase 1)
- Replace mock handlers with API calls
- Add error handling
- Add loading states
- Test all 25+ actions

### Story 3: Slack Integration (Phase 1)
- OAuth flow
- Core Slack service
- MCP tool wrapper
- Route handlers

### Story 4: Trigger System (Phase 3)
- Trigger types and conditions
- Trigger engine
- Condition processors
- Database schema

### Story 5: Playbook Engine (Phase 3)
- Playbook definitions
- Executor service
- Built-in templates
- Database schema

### Story 6: Playbook UI (Phase 3)
- Visual timeline component
- Stage/action UI
- Real-time updates
- Integration with approvals

### Story 7: Zoom Integration (Phase 4)
- OAuth flow
- Core Zoom service
- Webhook handlers
- MCP tool wrapper

### Story 8: Meeting Intelligence Pipeline (Phase 4)
- Transcript processor
- Action item extractor
- Sentiment analyzer
- Signal detector
- Summary generator

### Story 9: Meeting Intelligence UI (Phase 4)
- Meetings list
- Transcript viewer
- Summary display
- Action items panel
- Signal alerts

### Story 10: Skills System (Phase 5)
- Skill parser
- Skill executor
- Built-in skills
- Skill registry

### Story 11: Natural Language Automations (Phase 5)
- NL parser (Claude-powered)
- Automation builder
- Scheduler
- Database integration

### Story 12: Automation UI (Phase 5)
- NL input component
- Preview panel
- Schedule picker
- Automation list

---

## Success Metrics

1. **MCP Tools**: 20+ tools available in registry
2. **Real Integrations**: Gmail, Calendar, Drive, Slack all working
3. **Triggers**: 10+ trigger types implemented
4. **Playbooks**: 5+ built-in playbook templates
5. **Meeting Intelligence**: Full pipeline from transcript to summary
6. **Skills**: 10+ skills in library
7. **Automations**: NL parsing with 90%+ accuracy

---

## Notes for Ralph Execution

- Leverage existing 50,000+ lines of infrastructure
- Don't recreate - wrap and extend
- Follow existing patterns in `server/src/services/`
- Use existing approval system for HITL
- All new routes go in `server/src/routes/`
- All new types extend `types/workspaceAgent.ts`
- WebSocket events follow existing pattern in `context/WebSocketContext.tsx`
