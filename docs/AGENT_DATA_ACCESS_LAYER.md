# Agent Data Access Layer

## Overview

The Agent Data Access Layer enables CS specialist agents to query real-time data from the knowledge base, customer database, and metrics systems. This allows agents to make informed, data-driven decisions when responding to user queries.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Center UI                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Orchestrator Agent                         │
│  • Coordinates all activities                                   │
│  • Has access to ALL 11 data tools                              │
│  • Delegates to specialist agents                               │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    Researcher    │  │   Communicator   │  │    Scheduler     │
│ • Knowledge tools│  │ • Customer 360   │  │ • Customer 360   │
│ • Metrics tools  │  │ • History        │  │ • Health trends  │
│ • Customer 360   │  │ • Risk signals   │  │ • History        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Access Tools                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │  Knowledge  │ │  Customer   │ │   Metrics   │ │ Portfolio │  │
│  │    Tools    │ │    Tools    │ │    Tools    │ │   Tools   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                          │
│  • customers table          • knowledge_base (pgvector)         │
│  • interactions table       • health_scores                     │
│  • contracts table          • risk_signals                      │
└─────────────────────────────────────────────────────────────────┘
```

## Data Access Tools

### Knowledge Tools (`knowledge-tools.ts`)

| Tool | Description | Use Case |
|------|-------------|----------|
| `search_knowledge_base` | RAG search across playbooks, best practices, templates | "How do I handle a churning customer?" |
| `get_playbook` | Retrieve specific playbook for a situation | "What's the playbook for onboarding?" |
| `search_similar_cases` | Find historical cases matching current situation | "Have we dealt with this before?" |

### Customer Tools (`customer-tools.ts`)

| Tool | Description | Use Case |
|------|-------------|----------|
| `get_customer_360` | Complete customer profile with all data | "Tell me about this customer" |
| `get_health_trends` | Health score changes over time with predictions | "How has their health changed?" |
| `get_customer_history` | Interaction timeline (meetings, emails, tickets) | "What's our history with them?" |

### Metrics Tools (`metrics-tools.ts`)

| Tool | Description | Use Case |
|------|-------------|----------|
| `get_engagement_metrics` | DAU/MAU, feature adoption, login frequency | "Are they using the product?" |
| `get_risk_signals` | Churn indicators across multiple dimensions | "What risks do you see?" |
| `get_renewal_forecast` | Renewal probability with recommendations | "Will they renew?" |

### Portfolio Tools (`portfolio-tools.ts`)

| Tool | Description | Use Case |
|------|-------------|----------|
| `get_portfolio_insights` | Cross-customer analysis and trends | "How's my portfolio doing?" |
| `compare_to_cohort` | Benchmark customer against similar customers | "How do they compare to peers?" |

## Tool Distribution by Agent

| Agent | Tools | Purpose |
|-------|-------|---------|
| **Orchestrator** | All 11 tools | Full access for coordination and decision-making |
| **Researcher** | 7 tools | Knowledge, metrics, and customer context for intelligence gathering |
| **Communicator** | 3 tools | Customer context for personalized communications |
| **Scheduler** | 3 tools | Customer context for meeting preparation |

## Implementation Details

### Tool Structure

All tools follow the same interface:

```typescript
const toolName: Tool = {
  name: 'tool_name',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: { /* input parameters */ },
    required: []
  },
  requiresApproval: false,  // All data tools are read-only, auto-approved
  execute: async (input, context) => {
    // Implementation
    return { success: true, data: { /* results */ } };
  }
};
```

### Context-Aware Fallbacks

All tools gracefully handle missing database data:

```typescript
// Try database first
const { data, error } = await supabase
  .from('customers')
  .select('*')
  .eq('id', customerId)
  .single();

// Fallback to context if database query fails
if (error || !data) {
  return {
    success: true,
    data: buildFromContext(context.customer)
  };
}
```

### Types

Key types defined in `server/src/agents/types.ts`:

```typescript
interface DataAccessTool extends Tool {
  category: 'knowledge' | 'customer' | 'metrics' | 'portfolio';
  requiresApproval: false;
}

interface Customer360 {
  overview: { id, name, industry, arr, mrr, tier, status, csmName };
  health: { score, trend, components };
  engagement: { productAdoption, lastActivityDays, npsScore, openTickets };
  stakeholders: Array<{ name, role, email, isPrimary }>;
  risks: Array<{ type, severity, description }>;
  opportunities: Array<{ type, potential, description }>;
}

interface KnowledgeSearchResult {
  title: string;
  content: string;
  relevanceScore: number;
  source: string;
  layer: 'universal' | 'company' | 'customer';
}
```

## Usage Examples

### In Agent Center Chat

```
User: "What do you know about Acme Corp?"

Orchestrator: [Uses get_customer_360 tool]
"Based on the customer data:
- Acme Corp is an Enterprise tier customer with $120K ARR
- Current health score: 75% (stable)
- Primary contact: John Doe, VP Engineering
- 2 open support tickets
- Last engagement: 3 days ago"
```

```
User: "What risks should I be aware of?"

Orchestrator: [Uses get_risk_signals tool]
"I've identified the following risk signals:
- Engagement Risk (Medium): Login frequency down 20% this month
- Support Risk (Low): 2 open P2 tickets older than 7 days
- Overall Risk Level: Medium
Recommendations: Schedule a proactive check-in call"
```

### Programmatic Usage

```typescript
import { getToolsForAgent } from '../tools/index.js';

// Get tools for a specific agent
const researcherTools = getToolsForAgent('researcher');

// Execute a tool directly
const result = await getCustomer360Tool.execute(
  { customerId: 'cust_123' },
  agentContext
);
```

## Testing

Run the test suite:

```bash
cd server
npx tsx src/agents/tools/__tests__/data-access-tools.test.ts
```

Expected output: 8/11 tests pass (3 knowledge tests require valid UUIDs)

## File Structure

```
server/src/agents/
├── tools/
│   ├── index.ts              # Exports all tools, getToolsForAgent()
│   ├── knowledge-tools.ts    # RAG search, playbooks, similar cases
│   ├── customer-tools.ts     # Customer 360, health trends, history
│   ├── metrics-tools.ts      # Engagement, risk signals, renewal
│   ├── portfolio-tools.ts    # Portfolio insights, cohort comparison
│   └── __tests__/
│       └── data-access-tools.test.ts
├── specialists/
│   ├── orchestrator.ts       # Updated with all data tools
│   ├── researcher.ts         # Updated with knowledge + metrics
│   ├── communicator.ts       # Updated with customer context
│   └── scheduler.ts          # Updated with customer + health
└── types.ts                  # DataAccessTool, Customer360, etc.
```

## Security Considerations

1. **Read-Only**: All data access tools are read-only operations
2. **Auto-Approved**: No human approval required (safe operations)
3. **Context-Scoped**: Tools operate within the current customer context
4. **Audit Logged**: All tool executions are logged for observability

## Future Enhancements

- [ ] Add caching layer for frequently accessed data
- [ ] Implement real-time data streaming for health scores
- [ ] Add write tools with HITL approval for data modifications
- [ ] Expand portfolio tools with segment-specific insights
