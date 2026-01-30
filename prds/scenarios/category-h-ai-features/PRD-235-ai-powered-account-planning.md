# PRD-235: AI-Powered Account Planning

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-235 |
| **Title** | AI-Powered Account Planning |
| **Category** | H: AI-Powered Features |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Account planning is a strategic activity that requires synthesizing data from multiple sources, understanding customer goals, and creating actionable plans. CSMs often struggle with where to start, what to include, and how to prioritize objectives. AI should assist in generating comprehensive account plans based on customer data, historical patterns, and best practices.

## User Stories

### Primary User Stories
1. **As a CSM**, I want AI to generate a draft account plan based on customer data.
2. **As a CSM**, I want suggested strategic objectives based on customer context.
3. **As a CSM**, I want relationship goals with specific stakeholder targets.
4. **As a CSM**, I want expansion opportunities identified and quantified.
5. **As a CSM**, I want quarterly milestones and success metrics suggested.

### Secondary User Stories
1. **As a CSM Manager**, I want to review and approve team account plans.
2. **As a CSM**, I want to compare my plan to similar successful accounts.
3. **As a CSM**, I want AI to update plans based on changing circumstances.

## Acceptance Criteria

### Core Functionality
- [ ] AI-generated account plan drafts
- [ ] Strategic objective recommendations
- [ ] Stakeholder relationship goals
- [ ] Expansion opportunity identification
- [ ] Quarterly milestone suggestions
- [ ] Risk mitigation strategies

### Account Plan Components
- [ ] Executive summary
- [ ] Customer business context
- [ ] Strategic objectives (3-5)
- [ ] Success metrics per objective
- [ ] Stakeholder map with relationship goals
- [ ] Expansion targets and timeline
- [ ] Risk assessment and mitigation
- [ ] QBR schedule
- [ ] Resource allocation recommendations
- [ ] 90-day action plan

## Technical Specification

### Architecture

```
Customer Data → Context Aggregator → Plan Generator → Template Filler → Review Interface → Database
       ↓                                    ↓
Similar Accounts                    Best Practices KB
```

### Account Plan Model

```typescript
interface AccountPlan {
  id: string;
  customer_id: string;
  fiscal_year: string;
  status: 'draft' | 'pending_review' | 'approved' | 'active';

  executive_summary: string;
  business_context: BusinessContext;
  strategic_objectives: StrategicObjective[];
  stakeholder_plan: StakeholderPlan;
  expansion_plan: ExpansionPlan;
  risk_mitigation: RiskMitigation;
  qbr_schedule: QBRSchedule[];
  resource_plan: ResourcePlan;
  action_plan_90day: ActionItem[];

  ai_generated: boolean;
  ai_confidence: number;
  generation_context: GenerationContext;

  created_by: string;
  approved_by?: string;
  created_at: Date;
  approved_at?: Date;
}

interface StrategicObjective {
  id: string;
  objective: string;
  rationale: string;
  success_metrics: SuccessMetric[];
  quarterly_milestones: QuarterlyMilestone[];
  owner: string;
  priority: 'critical' | 'high' | 'medium';
}

interface StakeholderPlan {
  current_map: StakeholderMapEntry[];
  relationship_goals: RelationshipGoal[];
  multi_threading_target: number;
  exec_sponsor_strategy: string;
}
```

### Plan Generation Pipeline

```typescript
async function generateAccountPlan(
  customerId: string,
  fiscalYear: string
): Promise<AccountPlan> {
  // Gather all customer context
  const context = await gatherPlanningContext(customerId);

  // Find similar successful accounts
  const benchmarks = await findSimilarAccounts(customerId);

  // Generate plan sections
  const sections = await Promise.all([
    generateExecutiveSummary(context),
    generateStrategicObjectives(context, benchmarks),
    generateStakeholderPlan(context),
    generateExpansionPlan(context),
    generateRiskMitigation(context),
    generateQBRSchedule(context),
    generate90DayPlan(context)
  ]);

  return assemblePlan(customerId, fiscalYear, sections);
}

async function generateStrategicObjectives(
  context: PlanningContext,
  benchmarks: BenchmarkData
): Promise<StrategicObjective[]> {
  const prompt = `
    Generate 3-5 strategic objectives for this account plan.

    Customer: ${context.customer.name}
    Industry: ${context.customer.industry}
    ARR: ${context.customer.arr}
    Current Health: ${context.health.score}
    Contract: ${context.contract.term} (${context.daysToRenewal} days to renewal)

    Current situation:
    - Usage: ${context.usage.summary}
    - Adoption: ${context.adoption.summary}
    - Key stakeholders: ${context.stakeholders.length}
    - Open opportunities: ${context.expansion.opportunities.length}

    Benchmark data from similar successful accounts:
    ${JSON.stringify(benchmarks.common_objectives)}

    Generate objectives that are:
    1. Specific and measurable
    2. Aligned with customer's business goals
    3. Achievable within the fiscal year
    4. Balanced across retention, adoption, and growth

    For each objective, provide:
    - Clear objective statement
    - Rationale (why this matters)
    - 2-3 success metrics with targets
    - Quarterly milestones
    - Suggested owner (CSM, Customer, or Both)
    - Priority level
  `;

  return await claude.generate(prompt);
}

async function generateStakeholderPlan(
  context: PlanningContext
): Promise<StakeholderPlan> {
  const currentStakeholders = context.stakeholders;
  const relationshipScores = await getRelationshipScores(context.customer.id);

  const prompt = `
    Generate a stakeholder plan for account planning.

    Current stakeholders:
    ${JSON.stringify(currentStakeholders.map(s => ({
      name: s.name,
      role: s.role,
      relationship_score: relationshipScores[s.id] || 'unknown',
      engagement: s.engagement_level
    })))}

    Ideal stakeholder coverage:
    - Executive sponsor (VP+ level)
    - 2-3 champions (daily users with influence)
    - Technical buyer
    - Economic buyer

    Generate:
    1. Current stakeholder assessment
    2. Relationship goals for each existing stakeholder
    3. Missing roles to target
    4. Multi-threading strategy
    5. Executive engagement strategy
  `;

  return await claude.generate(prompt);
}
```

### API Endpoints

#### POST /api/customers/{id}/account-plan/generate
```json
{
  "fiscal_year": "FY2026",
  "include_sections": ["all"],
  "reference_similar_accounts": true
}
```

Response:
```json
{
  "plan_id": "uuid",
  "status": "draft",
  "customer_id": "uuid",
  "customer_name": "TechCorp Industries",
  "fiscal_year": "FY2026",
  "ai_confidence": 0.82,

  "executive_summary": "TechCorp Industries is a $250K strategic account in the technology sector with strong product adoption but single-threaded executive engagement. Key priorities for FY2026 include deepening executive relationships, driving platform expansion, and securing a multi-year renewal...",

  "business_context": {
    "industry_trends": "Technology sector seeing 15% growth...",
    "customer_goals": "Scaling customer success operations...",
    "competitive_landscape": "Currently evaluating alternatives..."
  },

  "strategic_objectives": [
    {
      "id": "obj-1",
      "objective": "Expand executive engagement from single-threaded to multi-level",
      "rationale": "Currently reliant on Sarah (VP Product). Need CTO and CFO engagement for renewal security.",
      "success_metrics": [
        {
          "metric": "Executive sponsors engaged",
          "current": 0,
          "target": 2,
          "measurement": "Regular meetings with CTO and CFO"
        }
      ],
      "quarterly_milestones": [
        { "quarter": "Q1", "milestone": "Intro meeting with CTO" },
        { "quarter": "Q2", "milestone": "CFO value review" },
        { "quarter": "Q3", "milestone": "Joint exec planning session" },
        { "quarter": "Q4", "milestone": "Renewal approval secured" }
      ],
      "owner": "CSM",
      "priority": "critical"
    },
    {
      "id": "obj-2",
      "objective": "Increase platform adoption to 80% feature utilization",
      "rationale": "Currently at 55% utilization. Higher adoption correlates with renewal likelihood.",
      "success_metrics": [
        {
          "metric": "Feature utilization",
          "current": "55%",
          "target": "80%",
          "measurement": "Monthly adoption report"
        }
      ],
      "quarterly_milestones": [...],
      "owner": "Both",
      "priority": "high"
    }
  ],

  "stakeholder_plan": {
    "current_assessment": "Strong champion in Sarah, but limited breadth...",
    "relationship_goals": [
      {
        "stakeholder_id": "uuid",
        "name": "Sarah Chen",
        "current_score": 78,
        "target_score": 90,
        "strategy": "Elevate to executive sponsor, involve in strategic planning"
      }
    ],
    "multi_threading_target": 5,
    "exec_sponsor_strategy": "Propose quarterly executive briefings..."
  },

  "expansion_plan": {
    "current_arr": 250000,
    "target_arr": 350000,
    "opportunities": [
      {
        "type": "upsell",
        "description": "Premium analytics tier",
        "value": 50000,
        "probability": 0.7,
        "timeline": "Q2"
      }
    ]
  },

  "risk_mitigation": {
    "identified_risks": [
      {
        "risk": "Single executive sponsor",
        "mitigation": "Multi-thread to CTO and CFO",
        "owner": "CSM"
      }
    ]
  },

  "action_plan_90day": [
    {
      "week": 1,
      "action": "Request intro to CTO from Sarah",
      "owner": "CSM"
    },
    {
      "week": 2,
      "action": "Prepare executive briefing materials",
      "owner": "CSM"
    }
  ],

  "benchmark_comparison": {
    "similar_accounts_success_rate": 0.78,
    "key_differentiators": "Your plan includes exec strategy similar to top performers"
  }
}
```

#### PUT /api/account-plans/{id}
Update and edit the generated plan.

#### POST /api/account-plans/{id}/approve
Manager approval workflow.

### Database Schema

Uses existing `account_plans` table with additions:
```sql
ALTER TABLE account_plans ADD COLUMN ai_generated BOOLEAN DEFAULT false;
ALTER TABLE account_plans ADD COLUMN ai_confidence DECIMAL(3,2);
ALTER TABLE account_plans ADD COLUMN generation_context JSONB;
```

## UI/UX Design

### Account Plan Generator
```
┌─────────────────────────────────────────────────────────┐
│ GENERATE ACCOUNT PLAN - TechCorp Industries             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ AI will generate a comprehensive account plan based on: │
│ ✓ Current health score and metrics (68)                │
│ ✓ Stakeholder relationships (5 contacts)               │
│ ✓ Expansion opportunities (2 identified)               │
│ ✓ Risk signals (1 active)                              │
│ ✓ Similar successful accounts (12 benchmarks)          │
│                                                         │
│ Fiscal Year: [FY2026 ▼]                                │
│                                                         │
│ Sections to include:                                    │
│ ☑ Executive Summary                                     │
│ ☑ Strategic Objectives                                  │
│ ☑ Stakeholder Plan                                      │
│ ☑ Expansion Plan                                        │
│ ☑ Risk Mitigation                                       │
│ ☑ 90-Day Action Plan                                    │
│                                                         │
│ [Generate Plan] [Cancel]                                │
│                                                         │
│ ⏱️ Estimated generation time: 30 seconds               │
└─────────────────────────────────────────────────────────┘
```

### Generated Plan Review
```
┌─────────────────────────────────────────────────────────┐
│ ACCOUNT PLAN REVIEW - TechCorp Industries FY2026        │
│ AI Confidence: 82% | Status: Draft                      │
├─────────────────────────────────────────────────────────┤
│ [Summary] [Objectives] [Stakeholders] [Actions]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ STRATEGIC OBJECTIVES                         [Edit All] │
│ ────────────────────                                    │
│                                                         │
│ 1. Expand Executive Engagement            CRITICAL      │
│ ─────────────────────────────                           │
│ Multi-level engagement (0 → 2 exec sponsors)            │
│                                                         │
│ Quarterly Milestones:                                   │
│ Q1: Intro meeting with CTO ○                           │
│ Q2: CFO value review ○                                 │
│ Q3: Joint exec planning session ○                      │
│ Q4: Renewal approval secured ○                         │
│                                                         │
│ [Edit] [Remove]                                         │
│                                                         │
│ 2. Increase Platform Adoption              HIGH         │
│ ─────────────────────────────                           │
│ Feature utilization: 55% → 80%                          │
│ ...                                                     │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ 💡 AI INSIGHTS                                          │
│ Similar accounts with this strategy: 78% success rate   │
│ Missing element: Consider adding training objective     │
│                                                         │
│ [Save Draft] [Submit for Approval] [Export]             │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Customer data aggregation
- Relationship scoring
- Expansion opportunity detection
- Similar account matching

### Related PRDs
- PRD-227: Relationship Strength Scoring
- PRD-238: Expansion Propensity Modeling
- PRD-120: QBR Scheduling → Auto-Prep

## Success Metrics

### Quantitative
- Plan generation time < 2 minutes (vs hours manual)
- Plan adoption: 70% of accounts have AI-generated plans
- Objective completion rate: 60%+ objectives achieved
- Plan-to-outcome correlation: Accounts with plans retain better

### Qualitative
- Plans are comprehensive and actionable
- CSMs customize rather than start from scratch
- Managers approve plans faster

## Rollout Plan

### Phase 1: Basic Generation (Week 1-2)
- Executive summary and objectives
- Basic stakeholder plan
- Draft generation

### Phase 2: Intelligence (Week 3-4)
- Benchmark comparison
- Expansion planning
- Risk mitigation

### Phase 3: Workflow (Week 5-6)
- Approval process
- 90-day action tracking
- Progress monitoring

### Phase 4: Optimization (Week 7-8)
- Learning from successful plans
- Template improvements
- Auto-update suggestions

## Open Questions
1. How prescriptive should AI-generated objectives be?
2. Should plans auto-update based on customer changes?
3. What's the right cadence for plan review?
4. How do we measure plan quality vs outcomes?
