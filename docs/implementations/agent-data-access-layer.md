# Agent Data Access Layer

## Overview

A comprehensive set of 11 data access tools enabling CS agents to query the knowledge base, customer data, and metrics for data-backed recommendations.

## Architecture

```
server/src/agents/
├── types.ts              # Core types: DataAccessTool, Customer360, etc.
├── index.ts              # Agent registry
└── tools/
    ├── index.ts          # Exports all tools, getToolsForAgent()
    ├── knowledge-tools.ts # RAG/knowledge base tools
    ├── customer-tools.ts  # Customer data tools
    ├── metrics-tools.ts   # Analytics and metrics tools
    └── portfolio-tools.ts # Portfolio-level tools
```

## Tools by Category

### Knowledge Tools (`knowledge-tools.ts`)

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_knowledge_base` | RAG search across playbooks, best practices, docs | `query`, `layer`, `category`, `limit` |
| `get_playbook` | Retrieve CS playbooks for specific situations | `situation`, `customer_context` |
| `search_similar_cases` | Find similar historical customer cases | `situation`, `outcome_filter`, `industry` |

### Customer Tools (`customer-tools.ts`)

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_customer_360` | Comprehensive customer profile | `customer_id`, `include_sections` |
| `get_health_trends` | Historical health score with predictions | `customer_id`, `period`, `include_predictions` |
| `get_customer_history` | Timeline of interactions and events | `customer_id`, `event_types`, `period` |

### Metrics Tools (`metrics-tools.ts`)

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_engagement_metrics` | Product usage and adoption data | `customer_id`, `metrics`, `period`, `compare_to_cohort` |
| `get_risk_signals` | Current risk indicators and warnings | `customer_id`, `signal_types`, `severity_filter` |
| `get_renewal_forecast` | Renewal probability and expansion potential | `customer_id`, `include_recommendations` |

### Portfolio Tools (`portfolio-tools.ts`)

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_portfolio_insights` | Portfolio-level analytics | `segment`, `focus` |
| `compare_to_cohort` | Compare customer to cohort averages | `customer_id`, `cohort_by`, `metrics` |

## Tool Distribution by Agent

| Agent | Tools Available |
|-------|----------------|
| **Orchestrator** | All 11 tools |
| **Researcher** | `search_knowledge_base`, `get_playbook`, `search_similar_cases`, `get_customer_360`, `get_engagement_metrics`, `get_risk_signals`, `get_renewal_forecast` |
| **Communicator** | `get_customer_360`, `get_customer_history`, `get_risk_signals` |
| **Scheduler** | `get_customer_360`, `get_health_trends`, `get_customer_history` |

## Usage

### Get tools for an agent
```typescript
import { getToolsForAgent, dataAccessTools } from '@/agents/tools';

// Get all tools for a specific agent type
const researcherTools = getToolsForAgent('researcher');

// Get all available tools
const allTools = dataAccessTools;
```

### Execute a tool
```typescript
const customer360Tool = dataAccessTools.find(t => t.name === 'get_customer_360');

const result = await customer360Tool.execute({
  customer_id: 'cust_123',
  include_sections: ['overview', 'health', 'stakeholders']
}, {
  customerId: 'cust_123',
  userId: 'user_456'
});
```

## Type Definitions (`types.ts`)

```typescript
interface DataAccessTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: ToolInput, context: AgentContext) => Promise<ToolOutput>;
  requiresApproval: boolean;
}

interface Customer360 {
  overview: CustomerOverview;
  health: HealthData;
  engagement: EngagementData;
  stakeholders: Stakeholder[];
  contracts: Contract[];
  interactions: Interaction[];
  risks: RiskSignal[];
  opportunities: Opportunity[];
}

interface HealthTrendPoint {
  date: string;
  score: number;
  components: {
    engagement: number;
    adoption: number;
    sentiment: number;
    support: number;
  };
}

interface RiskSignalData {
  type: 'churn' | 'engagement' | 'sentiment' | 'support' | 'payment';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  detectedAt: string;
  recommendation: string;
}

interface RenewalForecast {
  probability: number;
  expansionPotential: 'high' | 'medium' | 'low' | 'none';
  riskFactors: string[];
  recommendedActions: string[];
  daysUntilRenewal: number;
  renewalDate: string;
}
```

## Key Features

### Auto-Approval
All tools are read-only with `requiresApproval: false`, enabling autonomous agent operation without human intervention for data retrieval.

### Context Awareness
Tools leverage `AgentContext` for:
- Customer ID scoping
- User authentication
- Supabase client access
- Caching and optimization

### Trend Analysis
Health trends tool includes:
- Direction (improving/declining/stable)
- Change percentage
- Volatility scoring
- 4-week predictions

### Cohort Comparison
Compare any customer against:
- Industry peers
- Tier grouping
- ARR band
- Tenure cohort

## Files

| File | Purpose |
|------|---------|
| `server/src/agents/types.ts` | Type definitions |
| `server/src/agents/tools/index.ts` | Tool registry and exports |
| `server/src/agents/tools/knowledge-tools.ts` | Knowledge base tools |
| `server/src/agents/tools/customer-tools.ts` | Customer data tools |
| `server/src/agents/tools/metrics-tools.ts` | Metrics and analytics tools |
| `server/src/agents/tools/portfolio-tools.ts` | Portfolio analysis tools |
| `server/src/agents/tools/__tests__/data-access-tools.test.ts` | Test suite |

## Status

✅ All 12 user stories complete (100%)

- US-001: Directory structure and types ✅
- US-002: search_knowledge_base ✅
- US-003: get_customer_360 ✅
- US-004: get_health_trends ✅
- US-005: get_risk_signals ✅
- US-006: get_engagement_metrics ✅
- US-007: get_customer_history ✅
- US-008: get_renewal_forecast ✅
- US-009: get_playbook ✅
- US-010: search_similar_cases ✅
- US-011: Portfolio tools ✅
- US-012: Agent integration ✅
