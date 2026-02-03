# LangChain Integration - Agent Instructions

## Overview

LangChain integration for AI agent orchestration, tool execution, and memory management.

## Directory Structure

```
langchain/
├── AGENTS.md           # This file
├── agents/
│   ├── orchestrator.ts # 4-tier routing logic
│   ├── specialists/    # Specialist agent configs
│   └── CSAgents.ts     # Agent registry
├── tools/
│   └── index.ts        # Tool definitions (20+)
└── vectorstore/
    └── index.ts        # Knowledge base embeddings
```

## Orchestrator (4-Tier Routing)

```typescript
// langchain/agents/orchestrator.ts

export async function routeMessage(
  message: string,
  session: Session,
  context: AgentContext
): Promise<RoutingResult> {

  // Tier 1: Follow-up Detection
  if (session.previousAgent && isFollowUp(message, session.messages)) {
    return { agent: session.previousAgent, confidence: 0.9, tier: 1 };
  }

  // Tier 2: Keyword Matching
  const keywordMatch = matchKeywords(message);
  if (keywordMatch) {
    return { agent: keywordMatch.agent, confidence: 0.85, tier: 2 };
  }

  // Tier 3: Context-Based
  if (context.healthScore && context.healthScore < 60) {
    return { agent: 'risk', confidence: 0.8, tier: 3 };
  }
  if (context.daysToRenewal && context.daysToRenewal < 90) {
    return { agent: 'renewal', confidence: 0.75, tier: 3 };
  }

  // Tier 4: LLM Routing
  const llmRouting = await routeWithLLM(message, context);
  return { ...llmRouting, tier: 4 };
}

// Keyword → Agent mapping
const KEYWORD_MAP: Record<string, AgentId> = {
  'kickoff': 'onboarding',
  'onboard': 'onboarding',
  'new customer': 'onboarding',
  'renewal': 'renewal',
  'expand': 'renewal',
  'upsell': 'renewal',
  'churn': 'risk',
  'cancel': 'risk',
  'risk': 'risk',
  'qbr': 'strategic',
  'executive': 'strategic',
  'training': 'adoption',
  'usage': 'adoption'
};
```

## Tool Definition Pattern

```typescript
// langchain/tools/index.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const draftEmailTool = new DynamicStructuredTool({
  name: 'draft_email',
  description: 'Draft an email to send to customer stakeholders',

  schema: z.object({
    to: z.array(z.string()).describe('Recipient email addresses'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content'),
    cc: z.array(z.string()).optional().describe('CC recipients')
  }),

  func: async ({ to, subject, body, cc }, runManager) => {
    const context = runManager?.getContext() as AgentContext;

    // Create draft via Gmail service
    const draft = await gmailService.createDraft(context.userId, {
      to, subject, body, cc,
      metadata: { customerId: context.customerId }
    });

    return JSON.stringify({
      success: true,
      draftId: draft.id,
      message: `Draft created: "${subject}" to ${to.join(', ')}`
    });
  }
});

// Tools requiring approval
export const sendEmailTool = new DynamicStructuredTool({
  name: 'send_email',
  description: 'Send an email (requires human approval)',

  schema: z.object({
    to: z.array(z.string()),
    subject: z.string(),
    body: z.string()
  }),

  func: async ({ to, subject, body }, runManager) => {
    const context = runManager?.getContext() as AgentContext;

    // Create approval request
    const approval = await approvalService.create({
      sessionId: context.sessionId,
      actionType: 'send_email',
      description: `Send email "${subject}" to ${to.join(', ')}`,
      data: { to, subject, body }
    });

    return JSON.stringify({
      success: true,
      requiresApproval: true,
      approvalId: approval.id,
      message: 'Email pending approval'
    });
  }
});
```

## Agent Execution

```typescript
// langchain/agents/CSAgents.ts
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatAnthropic } from '@langchain/anthropic';

export async function executeAgent(
  agentId: AgentId,
  message: string,
  session: Session,
  context: AgentContext
): Promise<AgentResponse> {

  const specialist = SPECIALISTS[agentId];
  const llm = new ChatAnthropic({
    modelName: 'claude-sonnet-4-20250514',
    temperature: 0.7
  });

  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools: specialist.tools,
    prompt: specialist.systemPrompt
  });

  const executor = new AgentExecutor({
    agent,
    tools: specialist.tools,
    verbose: true,
    returnIntermediateSteps: true
  });

  const result = await executor.invoke({
    input: message,
    chat_history: session.messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  });

  return {
    message: result.output,
    toolCalls: extractToolCalls(result.intermediateSteps),
    pendingApprovals: extractApprovals(result.intermediateSteps)
  };
}
```

## Knowledge Base (Vector Store)

```typescript
// langchain/vectorstore/index.ts
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings();

export const knowledgeBase = new SupabaseVectorStore(embeddings, {
  client: supabase,
  tableName: 'knowledge_base',
  queryName: 'match_documents'
});

// Search for relevant context
export async function searchKnowledge(
  query: string,
  filters?: { category?: string; customerId?: string }
): Promise<Document[]> {
  return knowledgeBase.similaritySearch(query, 5, filters);
}
```

## Common Gotchas

### 1. Tool Output Must Be String
```typescript
// ❌ BAD - returns object
func: async (params) => {
  return { success: true, data: result };
}

// ✅ GOOD - returns JSON string
func: async (params) => {
  return JSON.stringify({ success: true, data: result });
}
```

### 2. Context Passing
```typescript
// ❌ BAD - losing context
const result = await executor.invoke({ input: message });

// ✅ GOOD - pass full context
const result = await executor.invoke({
  input: message,
  chat_history: session.messages,
  customer_context: context
});
```

### 3. Error Handling in Tools
```typescript
// ❌ BAD - throws error
func: async (params) => {
  await sendEmail(params); // Throws on failure
}

// ✅ GOOD - returns error gracefully
func: async (params) => {
  try {
    await sendEmail(params);
    return JSON.stringify({ success: true });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
}
```
