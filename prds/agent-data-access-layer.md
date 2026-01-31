# PRD: Agent Data Access Layer

## Overview
Enhance CS specialist agents with comprehensive data access capabilities, enabling them to fetch and synthesize information from all available data sources (Knowledge Base, Customer Database, Metrics, Agent History) to provide informed, context-rich responses.

---

## Problem Statement

### Current State
- Agents receive only **static context** passed from the frontend (customer name, ARR, health score)
- Knowledge Base exists with RAG capabilities but **agents cannot query it**
- Customer database has rich data (metrics, trends, engagement) but **agents cannot access it**
- Agents make recommendations without real-time data, limiting their usefulness

### Desired State
- Agents can **autonomously query** all relevant data sources
- Agents **synthesize information** from multiple sources before responding
- Agents provide **data-backed recommendations** with citations
- CSMs get **informed, accurate insights** from a single conversation

---

## Architecture

### New Data Access Tools for Agents

```
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT DATA ACCESS LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Knowledge   │  │   Customer   │  │     Engagement       │  │
│  │    Base      │  │   Database   │  │      Metrics         │  │
│  │   (RAG)      │  │              │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         ▼                 ▼                      ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    TOOL DEFINITIONS                       │  │
│  │  • search_knowledge_base    • get_customer_360           │  │
│  │  • get_playbooks            • get_health_trends          │  │
│  │  • get_best_practices       • get_engagement_metrics     │  │
│  │  • search_similar_cases     • get_risk_signals           │  │
│  │  • get_customer_history     • get_renewal_forecast       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   AGENT SPECIALISTS                       │  │
│  │  • Onboarding Agent    • Renewal Agent                   │  │
│  │  • Adoption Agent      • Risk Agent                      │  │
│  │  • Strategic Agent     • General CS Agent                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## New Tools Specification

### 1. Knowledge Base Tools

#### `search_knowledge_base`
Search the RAG knowledge base for relevant information.

```typescript
{
  name: "search_knowledge_base",
  description: "Search the knowledge base for playbooks, best practices, templates, and documentation relevant to the query. Returns semantically similar content with relevance scores.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural language search query" },
      layer: {
        type: "string",
        enum: ["universal", "company", "customer", "all"],
        description: "Knowledge layer to search (default: all)"
      },
      category: {
        type: "string",
        enum: ["playbooks", "templates", "best-practices", "case-studies", "faqs"],
        description: "Optional category filter"
      },
      limit: { type: "number", default: 5, description: "Max results to return" }
    },
    required: ["query"]
  },
  requiresApproval: false  // Read-only, auto-approve
}
```

#### `get_playbook`
Retrieve a specific playbook by name or situation.

```typescript
{
  name: "get_playbook",
  description: "Retrieve a specific CS playbook for a situation (e.g., 'churn risk', 'expansion opportunity', 'escalation handling')",
  inputSchema: {
    type: "object",
    properties: {
      situation: { type: "string", description: "The situation or playbook name" },
      customer_context: { type: "boolean", description: "Include customer-specific adaptations" }
    },
    required: ["situation"]
  },
  requiresApproval: false
}
```

#### `search_similar_cases`
Find similar historical cases for reference.

```typescript
{
  name: "search_similar_cases",
  description: "Find similar historical customer cases based on situation, outcome, or characteristics",
  inputSchema: {
    type: "object",
    properties: {
      situation: { type: "string", description: "Current situation description" },
      outcome_filter: {
        type: "string",
        enum: ["success", "churn", "expansion", "all"],
        description: "Filter by case outcome"
      },
      industry: { type: "string", description: "Optional industry filter" }
    },
    required: ["situation"]
  },
  requiresApproval: false
}
```

---

### 2. Customer Database Tools

#### `get_customer_360`
Comprehensive customer profile with all available data.

```typescript
{
  name: "get_customer_360",
  description: "Get complete customer profile including health score, ARR, engagement metrics, recent interactions, stakeholders, and risk signals",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "string", description: "Customer ID (uses current context if not provided)" },
      include_sections: {
        type: "array",
        items: {
          type: "string",
          enum: ["overview", "health", "engagement", "stakeholders", "contracts", "interactions", "risks", "opportunities"]
        },
        description: "Sections to include (default: all)"
      }
    }
  },
  requiresApproval: false
}
```

#### `get_health_trends`
Historical health score trends and analysis.

```typescript
{
  name: "get_health_trends",
  description: "Get health score trends over time with component breakdown (engagement, adoption, sentiment, support)",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "string" },
      period: {
        type: "string",
        enum: ["7d", "30d", "90d", "1y"],
        default: "90d"
      },
      include_predictions: { type: "boolean", default: true }
    }
  },
  requiresApproval: false
}
```

#### `get_customer_history`
Timeline of all customer interactions and events.

```typescript
{
  name: "get_customer_history",
  description: "Get chronological history of customer interactions, meetings, emails, support tickets, and key events",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "string" },
      event_types: {
        type: "array",
        items: { type: "string", enum: ["meetings", "emails", "tickets", "calls", "milestones", "all"] }
      },
      period: { type: "string", enum: ["7d", "30d", "90d", "1y", "all"] },
      limit: { type: "number", default: 50 }
    }
  },
  requiresApproval: false
}
```

---

### 3. Metrics & Analytics Tools

#### `get_engagement_metrics`
Product engagement and usage data.

```typescript
{
  name: "get_engagement_metrics",
  description: "Get product engagement metrics including DAU/MAU, feature adoption, login frequency, and usage trends",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "string" },
      metrics: {
        type: "array",
        items: {
          type: "string",
          enum: ["dau_mau", "feature_adoption", "login_frequency", "session_duration", "api_usage", "all"]
        }
      },
      period: { type: "string", enum: ["7d", "30d", "90d"] },
      compare_to_cohort: { type: "boolean", default: true }
    }
  },
  requiresApproval: false
}
```

#### `get_risk_signals`
Current risk indicators and early warning signs.

```typescript
{
  name: "get_risk_signals",
  description: "Get current risk signals including churn indicators, engagement drops, sentiment issues, and support escalations",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "string" },
      signal_types: {
        type: "array",
        items: { type: "string", enum: ["churn", "engagement", "sentiment", "support", "payment", "all"] }
      },
      severity_filter: { type: "string", enum: ["critical", "high", "medium", "low", "all"] }
    }
  },
  requiresApproval: false
}
```

#### `get_renewal_forecast`
Renewal likelihood and expansion potential.

```typescript
{
  name: "get_renewal_forecast",
  description: "Get renewal forecast including probability, expansion potential, risk factors, and recommended actions",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "string" },
      include_recommendations: { type: "boolean", default: true }
    }
  },
  requiresApproval: false
}
```

---

### 4. Portfolio & Comparative Tools

#### `get_portfolio_insights`
Cross-customer portfolio analysis.

```typescript
{
  name: "get_portfolio_insights",
  description: "Get portfolio-level insights including health distribution, risk summary, renewal pipeline, and trends",
  inputSchema: {
    type: "object",
    properties: {
      segment: { type: "string", enum: ["all", "enterprise", "strategic", "commercial", "smb"] },
      focus: { type: "string", enum: ["health", "renewals", "risks", "expansion", "engagement"] }
    }
  },
  requiresApproval: false
}
```

#### `compare_to_cohort`
Compare customer to similar customers.

```typescript
{
  name: "compare_to_cohort",
  description: "Compare customer metrics to cohort of similar customers (by tier, industry, ARR, tenure)",
  inputSchema: {
    type: "object",
    properties: {
      customer_id: { type: "string" },
      cohort_by: { type: "string", enum: ["tier", "industry", "arr_band", "tenure"] },
      metrics: { type: "array", items: { type: "string" } }
    }
  },
  requiresApproval: false
}
```

---

## Implementation Plan

### Phase 1: Core Data Access Tools (Priority: High)
1. `search_knowledge_base` - RAG search integration
2. `get_customer_360` - Comprehensive customer data
3. `get_health_trends` - Health score history
4. `get_risk_signals` - Risk indicators

### Phase 2: Analytics Tools (Priority: Medium)
5. `get_engagement_metrics` - Usage data
6. `get_customer_history` - Interaction timeline
7. `get_renewal_forecast` - Renewal predictions

### Phase 3: Advanced Tools (Priority: Lower)
8. `get_playbook` - Situation-specific playbooks
9. `search_similar_cases` - Historical case matching
10. `get_portfolio_insights` - Portfolio analysis
11. `compare_to_cohort` - Cohort benchmarking

---

## Files to Create/Modify

### New Files
```
server/src/agents/tools/
├── knowledge-tools.ts      # search_knowledge_base, get_playbook, search_similar_cases
├── customer-tools.ts       # get_customer_360, get_health_trends, get_customer_history
├── metrics-tools.ts        # get_engagement_metrics, get_risk_signals, get_renewal_forecast
├── portfolio-tools.ts      # get_portfolio_insights, compare_to_cohort
└── index.ts                # Export all tools
```

### Files to Modify
```
server/src/agents/specialists/
├── orchestrator.ts         # Add new tools to orchestrator
├── researcher.ts           # Add knowledge + metrics tools
├── communicator.ts         # Add customer context tools
└── scheduler.ts            # Add customer history tools

server/src/agents/types.ts  # Add tool type definitions
server/src/agents/index.ts  # Register new tools
```

---

## Data Flow Example

### Before (Current)
```
User: "What's the best approach for Acme Corp's renewal?"

Agent thinks: "I only have basic context: ARR $450K, Health 78%"
Agent responds: "Based on their health score of 78%, I recommend..."
                 (Generic advice, no real data)
```

### After (With Data Access)
```
User: "What's the best approach for Acme Corp's renewal?"

Agent executes:
  1. get_customer_360("acme-corp")
     → Full profile: 3 stakeholders, 2 open tickets, NPS 42

  2. get_health_trends("acme-corp", "90d")
     → Health dropped from 85 to 78 in last month
     → Engagement component down 15%

  3. get_risk_signals("acme-corp")
     → Champion left company 2 weeks ago
     → Feature adoption stalled at 60%

  4. search_knowledge_base("champion departure renewal strategy")
     → Returns: "Champion Loss Playbook" with steps

  5. search_similar_cases("champion left before renewal")
     → Returns: 3 similar cases, 2 saved, 1 churned

Agent responds: "Based on my analysis of Acme Corp:

**Key Risk**: Your champion Sarah Chen left 2 weeks ago. This correlates
with the 15% engagement drop I'm seeing.

**Recommendation** (based on our Champion Loss Playbook):
1. Identify new champion - I see 2 other stakeholders: James (VP Ops)
   and Maria (Director). James has highest login activity.
2. Schedule executive alignment call within 7 days
3. Address the 2 open support tickets before renewal conversation

**Similar Cases**: Of 3 similar situations, we saved 2 by re-engaging
within 14 days of champion departure.

Want me to draft an outreach email to James?"
```

---

## Acceptance Criteria

1. [ ] Agents can query knowledge base and return relevant playbooks/best practices
2. [ ] Agents can fetch real-time customer data (health, metrics, history)
3. [ ] Agents synthesize multiple data sources before responding
4. [ ] All data tools are read-only and auto-approved (no HITL delay)
5. [ ] Responses include data citations ("Based on health trend data...")
6. [ ] Tools handle missing data gracefully with appropriate messaging
7. [ ] Performance: Data queries complete within 2 seconds

---

## Success Metrics

- **Response Quality**: Increase in actionable, data-backed recommendations
- **User Satisfaction**: CSMs rate agent responses as more helpful
- **Data Utilization**: % of responses that query at least one data source
- **Time Savings**: Reduction in CSM time spent gathering information manually

---

## Security Considerations

- All tools are read-only (no write operations)
- Customer data scoped to user's accessible customers
- Knowledge base respects layer permissions (customer-specific content)
- Audit logging for all data access queries
- Rate limiting to prevent abuse
