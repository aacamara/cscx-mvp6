# Agent System - Agent Instructions

## Overview

Multi-specialist AI agent architecture with central orchestration. Agents have specific domains, tools, and HITL policies.

## Agent Types

### The 5 Specialist Agents

| ID | Name | Domain | Trigger Keywords |
|----|------|--------|------------------|
| `onboarding` | Onboarding Specialist | New customer setup | kickoff, onboard, new customer, setup, contract |
| `adoption` | Adoption Specialist | Usage & engagement | usage, training, adoption, feature, champion |
| `renewal` | Renewal Specialist | Retention & expansion | renewal, expansion, upsell, contract, pricing |
| `risk` | Risk Specialist | Churn prevention | risk, churn, cancel, unhappy, escalation |
| `strategic` | Strategic Specialist | Executive engagement | QBR, strategic, executive, business review |

### Supporting Agents

| ID | Name | Purpose |
|----|------|---------|
| `orchestrator` | Orchestrator | Routes to specialists, coordinates handoffs |
| `communicator` | Communicator | Email drafting and sequences |
| `scheduler` | Scheduler | Calendar and meeting management |
| `researcher` | Researcher | Company intelligence gathering |

## Routing Logic (4-Tier System)

```
User Message
     │
     ▼
┌────────────────────────────────────┐
│ Tier 1: Follow-up Detection        │
│ Is this continuing a conversation? │
│ → Yes: Route to previous agent     │
└────────────────────────────────────┘
     │ No
     ▼
┌────────────────────────────────────┐
│ Tier 2: Keyword Matching           │
│ Contains specialist keywords?      │
│ → Yes: Route to matching specialist│
└────────────────────────────────────┘
     │ No match
     ▼
┌────────────────────────────────────┐
│ Tier 3: Context-Based Routing      │
│ Health < 60? → Risk Specialist     │
│ Days to renewal < 90? → Renewal    │
│ New customer? → Onboarding         │
└────────────────────────────────────┘
     │ No match
     ▼
┌────────────────────────────────────┐
│ Tier 4: LLM Routing                │
│ Claude Haiku determines intent     │
│ → Route to best-fit specialist     │
└────────────────────────────────────┘
```

## Agent Definition Structure

```typescript
// agents/specialists/onboarding.ts
import { AgentSpecialist, AgentTool } from '../types';

export const onboardingSpecialist: AgentSpecialist = {
  id: 'onboarding',
  name: 'Onboarding Specialist',
  description: 'Expert in new customer setup, kickoff meetings, and time-to-value',
  icon: '🚀',

  systemPrompt: `You are the Onboarding Specialist for CSCX.AI.

Your expertise:
- Contract parsing and entitlement setup
- Stakeholder identification and mapping
- Kickoff meeting preparation and scheduling
- 30-60-90 day success plan creation
- Training program coordination
- Google Workspace setup for customers

Always be proactive about:
- Identifying key stakeholders and champions
- Setting clear success milestones
- Scheduling the kickoff meeting promptly
- Creating organized customer workspaces

When you need help from other specialists:
- Handoff to Risk if you detect concerning signals
- Handoff to Adoption once onboarding completes`,

  tools: [
    parseContractTool,
    mapStakeholdersTool,
    createSuccessPlanTool,
    scheduleKickoffTool,
    createWorkspaceTool,
    sendWelcomeEmailTool
  ],

  triggerKeywords: ['onboard', 'kickoff', 'new customer', 'setup', 'contract', 'welcome'],
  contextTriggers: {
    isNewCustomer: true
  }
};
```

## Tool Definition Pattern

```typescript
// tools/draft-email.ts
export const draftEmailTool: AgentTool = {
  name: 'draft_email',
  description: 'Draft an email to send to customer stakeholders',

  parameters: {
    type: 'object',
    properties: {
      to: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses of recipients'
      },
      subject: {
        type: 'string',
        description: 'Email subject line'
      },
      body: {
        type: 'string',
        description: 'Email body in plain text or HTML'
      },
      cc: {
        type: 'array',
        items: { type: 'string' },
        description: 'CC recipients (optional)'
      }
    },
    required: ['to', 'subject', 'body']
  },

  // HITL Policy
  requiresApproval: false,  // Drafts don't need approval
  approvalType: 'auto',

  execute: async (params, context) => {
    const { to, subject, body, cc } = params;
    const { customerId, userId } = context;

    // Create draft in Gmail
    const draft = await gmailService.createDraft(userId, {
      to,
      subject,
      body,
      cc,
      metadata: { customerId }
    });

    return {
      success: true,
      draftId: draft.id,
      message: `Draft created: "${subject}" to ${to.join(', ')}`
    };
  }
};
```

## HITL Approval Policies

```typescript
// agents/index.ts
export const APPROVAL_POLICIES: Record<string, ApprovalPolicy> = {
  // Always require human approval
  send_email: { type: 'always_require', blocking: true },
  book_meeting: { type: 'always_require', blocking: true },
  share_file: { type: 'always_require', blocking: true },
  create_task: { type: 'always_require', blocking: false },

  // Auto-approve (safe operations)
  draft_email: { type: 'auto_approve' },
  search_drive: { type: 'auto_approve' },
  get_calendar: { type: 'auto_approve' },
  calculate_health: { type: 'auto_approve' },
  research_company: { type: 'auto_approve' },

  // Never allow (dangerous operations)
  delete_file: { type: 'never_allow' },
  modify_permissions: { type: 'never_allow' },
  delete_customer: { type: 'never_allow' }
};
```

## Handoff Protocol

When an agent needs another specialist's help:

```typescript
// Inside agent execution
if (needsRenewalExpertise) {
  return {
    type: 'handoff',
    targetAgent: 'renewal',
    reason: 'Customer asking about contract terms and pricing',
    context: {
      customerId,
      conversationHistory: messages.slice(-5),
      relevantData: { renewalDate, currentARR }
    }
  };
}
```

## Context Structure

```typescript
interface AgentContext {
  // User context
  userId: string;
  userName: string;

  // Customer context (when available)
  customerId?: string;
  customerName?: string;
  customerARR?: number;
  customerTier?: 'enterprise' | 'mid-market' | 'smb';
  healthScore?: number;
  daysToRenewal?: number;

  // Session context
  sessionId: string;
  previousAgent?: string;
  conversationHistory: Message[];

  // Workspace context
  googleTokens?: GoogleTokens;
  workspaceFolderId?: string;
}
```

## Common Gotchas

### 1. Tool Parameter Validation
```typescript
// ❌ BAD - no validation
execute: async (params) => {
  await sendEmail(params.to, params.subject, params.body);
}

// ✅ GOOD - validate before execution
execute: async (params) => {
  if (!params.to || params.to.length === 0) {
    return { success: false, error: 'Recipients required' };
  }
  if (!params.subject?.trim()) {
    return { success: false, error: 'Subject required' };
  }
  await sendEmail(params.to, params.subject, params.body);
}
```

### 2. Context Preservation on Handoff
```typescript
// ❌ BAD - losing context
return { type: 'handoff', targetAgent: 'renewal' };

// ✅ GOOD - preserve full context
return {
  type: 'handoff',
  targetAgent: 'renewal',
  reason: 'Explicit reason for handoff',
  context: {
    ...currentContext,
    handoffSource: 'onboarding',
    relevantInsights: ['Customer mentioned budget concerns']
  }
};
```

### 3. Tool Output Format
```typescript
// ❌ BAD - inconsistent output
return emailResult;

// ✅ GOOD - consistent structure
return {
  success: true,
  data: emailResult,
  message: 'Human-readable summary of what happened'
};
```

### 4. Idempotency
```typescript
// ❌ BAD - creates duplicate on retry
execute: async (params) => {
  await createMeeting(params);
}

// ✅ GOOD - idempotent with check
execute: async (params) => {
  const existing = await findMeeting(params.title, params.date);
  if (existing) {
    return { success: true, data: existing, message: 'Meeting already exists' };
  }
  const meeting = await createMeeting(params);
  return { success: true, data: meeting };
}
```

## Testing Agents

```bash
# Test routing logic
curl -X POST http://localhost:3001/api/agents/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Help me onboard a new customer", "customerId": "..."}'

# Check which agent was selected
# Response includes: { agent: "onboarding", ... }
```
