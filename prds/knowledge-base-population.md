# Knowledge Base Population & CSM Capability Index

## Executive Summary

Consolidate all 275+ PRDs and platform capabilities into a structured knowledge base that enables the AI system to understand and execute ANY CSM task via natural language. The knowledge base becomes the "brain" that knows what the platform can do and how to do it.

## Problem Statement

The platform has extensive capabilities spread across:
- 275+ PRD documents defining features
- Scattered playbooks and best practices
- Multiple service implementations
- Various UI components and workflows

But the AI agents don't know:
- What capabilities exist
- How to invoke them
- When to use each one
- How they connect together

## Solution: CSM Capability Index

Create a structured knowledge base with three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE BASE LAYERS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: CAPABILITY REGISTRY                                   │
│  "What can the platform do?"                                    │
│  • All features and their triggers                              │
│  • Natural language patterns that invoke each                   │
│  • Required inputs and outputs                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 2: METHODOLOGY LIBRARY                                   │
│  "How should each task be done?"                                │
│  • Step-by-step playbooks                                       │
│  • Best practices and frameworks                                │
│  • Templates and examples                                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 3: DOMAIN KNOWLEDGE                                      │
│  "What does a great CSM know?"                                  │
│  • Industry best practices                                      │
│  • CS metrics and benchmarks                                    │
│  • Communication patterns                                       │
│  • Risk indicators and responses                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Layer 1: Capability Registry

### Structure

```typescript
interface Capability {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;

  // How users ask for this
  triggerPatterns: string[]; // Natural language patterns
  keywords: string[];
  examplePrompts: string[];

  // What's needed
  requiredInputs: Array<{
    name: string;
    type: string;
    source: 'user' | 'context' | 'platform';
    required: boolean;
  }>;

  // What it produces
  outputs: Array<{
    type: 'chat' | 'document' | 'email' | 'calendar' | 'data';
    format: string;
    description: string;
  }>;

  // How to execute
  execution: {
    service: string;
    method: string;
    requiresApproval: boolean;
    estimatedDuration: string;
  };

  // Related capabilities
  relatedCapabilities: string[];
  prerequisites: string[];
}

type CapabilityCategory =
  | 'document_generation'  // QBRs, decks, plans
  | 'data_analysis'        // Health, metrics, trends
  | 'communication'        // Emails, sequences
  | 'scheduling'           // Meetings, reminders
  | 'research'             // Company intel, stakeholders
  | 'risk_management'      // Risk signals, alerts
  | 'expansion'            // Upsell, cross-sell
  | 'onboarding'           // New customer workflows
  | 'renewal'              // Renewal management
  | 'reporting'            // Reports, dashboards
  | 'integration'          // External tools
  | 'workflow'             // Multi-step processes
```

### Example Capability Entry

```typescript
const qbrGenerationCapability: Capability = {
  id: 'qbr_generation',
  name: 'QBR Generation',
  category: 'document_generation',
  description: 'Generate a comprehensive Quarterly Business Review presentation',

  triggerPatterns: [
    'build me a qbr',
    'create a qbr',
    'generate quarterly business review',
    'prepare qbr deck',
    'make a qbr presentation',
    'qbr for {customer}'
  ],

  keywords: ['qbr', 'quarterly', 'business review', 'deck', 'presentation'],

  examplePrompts: [
    'Build me a QBR for Acme Corp',
    'Create a Q4 business review deck',
    'Generate a QBR focusing on expansion opportunities',
    'Prepare the quarterly review for my meeting tomorrow'
  ],

  requiredInputs: [
    { name: 'customerId', type: 'uuid', source: 'context', required: true },
    { name: 'quarter', type: 'string', source: 'user', required: false },
    { name: 'focusAreas', type: 'string[]', source: 'user', required: false }
  ],

  outputs: [
    { type: 'document', format: 'google_slides', description: 'QBR presentation deck' },
    { type: 'document', format: 'pdf', description: 'PDF export' },
    { type: 'chat', format: 'markdown', description: 'Executive summary preview' }
  ],

  execution: {
    service: 'QBRGeneratorService',
    method: 'generateQBR',
    requiresApproval: true,
    estimatedDuration: '30-60 seconds'
  },

  relatedCapabilities: ['health_analysis', 'metrics_report', 'meeting_prep'],
  prerequisites: ['customer_selected']
};
```

## Layer 2: Methodology Library

### Structure

```typescript
interface Methodology {
  id: string;
  name: string;
  category: string;
  applicableTo: string[]; // Capability IDs

  // The actual playbook
  steps: Array<{
    order: number;
    name: string;
    description: string;
    actions: string[];
    dataNeeded: string[];
    tips: string[];
  }>;

  // Quality standards
  qualityCriteria: string[];
  commonMistakes: string[];

  // Templates
  templates: Array<{
    name: string;
    format: string;
    content: string;
  }>;

  // Examples
  examples: Array<{
    scenario: string;
    input: any;
    output: any;
  }>;
}
```

### Example Methodology

```typescript
const qbrMethodology: Methodology = {
  id: 'qbr_methodology',
  name: 'QBR Best Practices',
  category: 'document_generation',
  applicableTo: ['qbr_generation'],

  steps: [
    {
      order: 1,
      name: 'Data Gathering',
      description: 'Collect all relevant customer data',
      actions: [
        'Pull customer 360 profile',
        'Get health score trends (last 2 quarters)',
        'Retrieve engagement metrics',
        'Find previous QBR for comparison',
        'Check for open risks and opportunities'
      ],
      dataNeeded: ['customer_360', 'health_trends', 'engagement_metrics', 'previous_qbr'],
      tips: ['Look for patterns, not just numbers', 'Compare to cohort averages']
    },
    {
      order: 2,
      name: 'Executive Summary',
      description: 'Create a compelling 30-second overview',
      actions: [
        'Summarize relationship health in one sentence',
        'Highlight top 3 wins',
        'Note 1-2 focus areas',
        'Include renewal/expansion status'
      ],
      dataNeeded: ['health_score', 'wins', 'risks', 'renewal_date'],
      tips: ['Lead with positive', 'Be specific with numbers', 'End with forward-looking statement']
    },
    {
      order: 3,
      name: 'Metrics Deep Dive',
      description: 'Show the data that tells the story',
      actions: [
        'Present health score with trend',
        'Show product adoption metrics',
        'Include usage statistics',
        'Compare to goals set last quarter'
      ],
      dataNeeded: ['health_trends', 'adoption_metrics', 'usage_data', 'previous_goals'],
      tips: ['Use visualizations', 'Show quarter-over-quarter change', 'Benchmark against peers']
    },
    {
      order: 4,
      name: 'Wins & Value',
      description: 'Celebrate successes and quantify value',
      actions: [
        'List major milestones achieved',
        'Calculate ROI or value delivered',
        'Include customer quotes if available',
        'Reference success metrics from kickoff'
      ],
      dataNeeded: ['milestones', 'value_metrics', 'customer_feedback'],
      tips: ['Use customer\'s own words when possible', 'Tie wins to their business goals']
    },
    {
      order: 5,
      name: 'Risks & Challenges',
      description: 'Address concerns proactively',
      actions: [
        'Identify current risk signals',
        'Acknowledge known issues',
        'Present mitigation plans',
        'Show progress on previous concerns'
      ],
      dataNeeded: ['risk_signals', 'open_tickets', 'previous_action_items'],
      tips: ['Be honest but solution-oriented', 'Show you\'re on top of issues']
    },
    {
      order: 6,
      name: 'Roadmap & Future',
      description: 'Look ahead and align on next steps',
      actions: [
        'Share relevant product roadmap items',
        'Discuss expansion opportunities',
        'Align on Q+1 goals',
        'Address renewal if applicable'
      ],
      dataNeeded: ['product_roadmap', 'expansion_opportunities', 'renewal_info'],
      tips: ['Tie roadmap to their needs', 'Create excitement for what\'s coming']
    }
  ],

  qualityCriteria: [
    'Executive summary fits in 30 seconds',
    'Every metric has context (trend, benchmark)',
    'Wins are quantified with business impact',
    'Risks have mitigation plans',
    'Clear action items with owners and dates'
  ],

  commonMistakes: [
    'Too many slides (keep under 15)',
    'Data without insights',
    'Ignoring elephants in the room',
    'No clear ask or next steps',
    'Generic content not personalized to customer'
  ],

  templates: [
    {
      name: 'Executive Summary Slide',
      format: 'text',
      content: `# Q{quarter} Business Review
## {customer_name}

**Relationship Health:** {health_score}% ({trend})

**Key Wins:**
• {win_1}
• {win_2}
• {win_3}

**Focus Areas:**
• {focus_1}
• {focus_2}

**Renewal Status:** {renewal_status}`
    }
  ],

  examples: [
    {
      scenario: 'Healthy enterprise customer',
      input: { healthScore: 85, trend: 'improving', hasExpansion: true },
      output: 'Focus on expansion discussion and roadmap alignment'
    },
    {
      scenario: 'At-risk customer',
      input: { healthScore: 55, trend: 'declining', hasTickets: true },
      output: 'Lead with acknowledgment, show mitigation plan, focus on stabilization'
    }
  ]
};
```

## Layer 3: Domain Knowledge

### Categories

1. **CS Fundamentals**
   - Customer lifecycle stages
   - Health score components
   - Churn indicators
   - Expansion signals

2. **Communication Best Practices**
   - Email templates by situation
   - Meeting facilitation
   - Difficult conversation handling
   - Executive communication

3. **Industry Knowledge**
   - SaaS metrics and benchmarks
   - Common objections and responses
   - Competitive positioning
   - Pricing/packaging strategies

4. **Risk Management**
   - Early warning signs
   - Save plays by risk type
   - Escalation procedures
   - Recovery strategies

5. **Growth Strategies**
   - Expansion identification
   - Upsell/cross-sell techniques
   - Champion building
   - Multi-threading

## Database Schema

### capabilities table
```sql
CREATE TABLE capabilities (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,

  trigger_patterns JSONB NOT NULL,
  keywords TEXT[] NOT NULL,
  example_prompts JSONB,

  required_inputs JSONB,
  outputs JSONB,
  execution JSONB,

  related_capabilities TEXT[],
  prerequisites TEXT[],

  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_capabilities_keywords ON capabilities USING GIN(keywords);
CREATE INDEX idx_capabilities_category ON capabilities(category);
```

### methodologies table
```sql
CREATE TABLE methodologies (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  applicable_to TEXT[] NOT NULL, -- capability IDs

  steps JSONB NOT NULL,
  quality_criteria JSONB,
  common_mistakes JSONB,
  templates JSONB,
  examples JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_methodologies_applicable ON methodologies USING GIN(applicable_to);
```

### domain_knowledge table
```sql
CREATE TABLE domain_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,

  keywords TEXT[],
  related_capabilities TEXT[],

  source VARCHAR(255), -- Where this knowledge came from
  confidence DECIMAL(3,2) DEFAULT 1.0,

  embedding vector(1536), -- For semantic search

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_domain_knowledge_category ON domain_knowledge(category);
CREATE INDEX idx_domain_knowledge_embedding ON domain_knowledge USING ivfflat (embedding vector_cosine_ops);
```

## PRD Consolidation Process

### Step 1: Categorize Existing PRDs

```typescript
interface PRDClassification {
  prdPath: string;
  capabilities: string[]; // Which capabilities it defines
  methodologies: string[]; // Which methodologies it contains
  domainKnowledge: string[]; // Domain knowledge it contributes
}
```

### Step 2: Extract and Transform

For each of the 275+ PRDs:
1. Read the PRD content
2. Identify capabilities defined
3. Extract methodologies/playbooks
4. Pull out domain knowledge
5. Generate trigger patterns
6. Map to existing services

### Step 3: Populate Knowledge Base

```typescript
async function populateFromPRD(prdPath: string): Promise<void> {
  const prd = await readPRD(prdPath);

  // Extract capabilities
  const capabilities = extractCapabilities(prd);
  for (const cap of capabilities) {
    await upsertCapability(cap);
  }

  // Extract methodologies
  const methodologies = extractMethodologies(prd);
  for (const method of methodologies) {
    await upsertMethodology(method);
  }

  // Extract domain knowledge
  const knowledge = extractDomainKnowledge(prd);
  for (const item of knowledge) {
    await insertDomainKnowledge(item);
  }
}
```

## Capability Matcher Service

When a user sends a message, match to capabilities:

```typescript
interface CapabilityMatcher {
  match(userQuery: string, context: AgentContext): Promise<{
    capability: Capability;
    confidence: number;
    methodology: Methodology | null;
    relevantKnowledge: DomainKnowledge[];
  }>;
}
```

### Matching Algorithm

1. **Keyword matching** (fast, high precision)
2. **Pattern matching** (trigger patterns)
3. **Semantic search** (embeddings)
4. **Context boost** (current customer, recent actions)

## Initial Capability Set (From PRD Analysis)

Based on the 275+ PRDs, the initial capability registry should include:

### Document Generation (25+ capabilities)
- QBR Generation
- Onboarding Plan Creation
- Success Plan Creation
- Executive Briefing Deck
- Renewal Proposal
- ROI Report
- Case Study Draft
- Meeting Prep Brief
- Account Plan

### Data Analysis (30+ capabilities)
- Health Score Analysis
- Churn Risk Assessment
- Expansion Opportunity Analysis
- Usage Pattern Analysis
- Engagement Metrics Report
- Cohort Comparison
- Portfolio Health Overview
- Trend Analysis
- Benchmark Comparison

### Communication (40+ capabilities)
- Welcome Email
- Check-in Email
- Escalation Response
- Renewal Reminder
- QBR Invitation
- Thank You Note
- Re-engagement Email
- Upsell Proposal Email
- Meeting Follow-up
- NPS Follow-up

### Scheduling (15+ capabilities)
- Schedule Kickoff
- Schedule QBR
- Schedule Check-in
- Find Available Times
- Send Calendar Invite
- Reschedule Meeting
- Set Reminder

### Research (20+ capabilities)
- Company Research
- Stakeholder Mapping
- Competitor Analysis
- News Monitoring
- LinkedIn Research
- Tech Stack Analysis
- Org Chart Building

### Risk Management (25+ capabilities)
- Risk Signal Detection
- Churn Prediction
- At-Risk Playbook
- Save Play Execution
- Escalation Routing
- Support Ticket Analysis
- Sentiment Analysis

### Onboarding (20+ capabilities)
- Kickoff Preparation
- Technical Onboarding
- User Training
- Adoption Tracking
- Milestone Tracking
- Go-Live Checklist
- Handoff from Sales

### Renewal (15+ capabilities)
- Renewal Forecast
- Renewal Playbook
- Pricing Discussion Prep
- Contract Review
- Renewal Deck
- Multi-Year Proposal
- Auto-Renewal Review

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Capability coverage | 100% | All PRD features mapped |
| Query match rate | >90% | Queries matched to capability |
| False positive rate | <5% | Wrong capability matched |
| Knowledge utilization | >80% | Responses using KB |
| CSM satisfaction | >4.5/5 | Survey feedback |

## Implementation Phases

### Phase 1: Core Registry (This PRD - via Ralph)
- Database schema for capabilities
- 50 most common capabilities populated
- Basic capability matcher
- Integration with CADG system

### Phase 2: Full Population
- Process all 275+ PRDs
- Extract and map capabilities
- Build comprehensive methodology library
- Populate domain knowledge

### Phase 3: Continuous Learning
- Track which capabilities are used
- Learn from user modifications
- Auto-suggest new capabilities
- Improve matching over time
