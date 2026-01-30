# PRD-228: Content Recommendation Engine

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-228 |
| **Title** | Content Recommendation Engine |
| **Category** | H: AI-Powered Features |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs have access to various content resources (playbooks, templates, case studies, product documentation) but often don't know what content is most relevant for a specific customer situation. AI should recommend the right content at the right time based on customer context, lifecycle stage, and current challenges.

## User Stories

### Primary User Stories
1. **As a CSM**, I want content recommendations based on my customer's current situation.
2. **As a CSM**, I want to see relevant playbooks when dealing with specific challenges.
3. **As a CSM**, I want case study suggestions that match my customer's industry and size.
4. **As a CSM**, I want template recommendations for common workflows.
5. **As a CSM**, I want to discover content I didn't know existed.

### Secondary User Stories
1. **As a CSM**, I want to rate content usefulness to improve recommendations.
2. **As a CS Leader**, I want to see which content is most effective.
3. **As a CSM**, I want personalized content based on my expertise level.

## Acceptance Criteria

### Core Functionality
- [ ] Context-aware content recommendations
- [ ] Recommendation explanations (why this content)
- [ ] Content effectiveness tracking
- [ ] Personalization based on user behavior
- [ ] Real-time suggestions during customer conversations

### Content Types
- [ ] Playbooks (onboarding, renewal, risk management)
- [ ] Email templates
- [ ] Presentation templates
- [ ] Case studies
- [ ] Product documentation
- [ ] Training materials
- [ ] Best practice guides

### Recommendation Triggers
- [ ] Customer lifecycle stage change
- [ ] Risk signal detection
- [ ] Expansion opportunity identified
- [ ] Specific query in chat
- [ ] Meeting scheduled
- [ ] Renewal approaching

## Technical Specification

### Architecture

```
Trigger Event → Context Analyzer → Content Matcher → Relevance Ranker → Recommendations
                      ↓                  ↓                   ↓
               Customer Data      Content Index       User Preferences
```

### Content Index Structure

```typescript
interface ContentItem {
  id: string;
  type: 'playbook' | 'template' | 'case_study' | 'documentation' | 'guide';
  title: string;
  description: string;
  content: string;
  embedding: number[];  // Vector embedding
  metadata: {
    tags: string[];
    industry: string[];
    company_size: string[];
    lifecycle_stage: string[];
    use_cases: string[];
    effectiveness_score: number;
    usage_count: number;
  };
  created_at: Date;
  updated_at: Date;
}
```

### Recommendation Engine

```typescript
interface RecommendationRequest {
  customer_id: string;
  context_type: 'general' | 'challenge' | 'meeting_prep' | 'renewal' | 'risk';
  specific_query?: string;
  content_types?: string[];
}

interface ContentRecommendation {
  content_id: string;
  content_type: string;
  title: string;
  description: string;
  relevance_score: number;
  reasons: string[];
  preview_url: string;
}

async function getRecommendations(
  request: RecommendationRequest
): Promise<ContentRecommendation[]> {
  // Get customer context
  const customer = await getCustomerContext(request.customer_id);

  // Build query based on context
  const queryContext = buildQueryContext(customer, request);

  // Vector search for relevant content
  const candidates = await vectorSearch(queryContext, 20);

  // Re-rank based on additional factors
  const ranked = await reRank(candidates, {
    industry_match: customer.industry,
    size_match: customer.segment,
    stage_match: customer.stage,
    user_history: await getUserHistory(request.user_id),
    effectiveness: true
  });

  // Generate explanations
  return ranked.slice(0, 5).map(item => ({
    content_id: item.id,
    content_type: item.type,
    title: item.title,
    description: item.description,
    relevance_score: item.score,
    reasons: generateReasons(item, customer, request),
    preview_url: item.preview_url
  }));
}

function generateReasons(
  content: ContentItem,
  customer: CustomerContext,
  request: RecommendationRequest
): string[] {
  const reasons: string[] = [];

  if (content.metadata.industry.includes(customer.industry)) {
    reasons.push(`Relevant to ${customer.industry} industry`);
  }

  if (content.metadata.lifecycle_stage.includes(customer.stage)) {
    reasons.push(`Appropriate for ${customer.stage} stage customers`);
  }

  if (content.metadata.effectiveness_score > 80) {
    reasons.push(`Highly effective (${content.metadata.effectiveness_score}% success rate)`);
  }

  if (request.context_type === 'risk' && content.metadata.use_cases.includes('churn_prevention')) {
    reasons.push('Designed for at-risk customer situations');
  }

  return reasons;
}
```

### API Endpoints

#### GET /api/content/recommendations
```json
{
  "customer_id": "uuid",
  "context": "renewal_approaching",
  "limit": 5
}
```

Response:
```json
{
  "recommendations": [
    {
      "content_id": "playbook-renewal-enterprise",
      "content_type": "playbook",
      "title": "Enterprise Renewal Playbook",
      "description": "Step-by-step guide for managing enterprise renewals with 90+ day runway",
      "relevance_score": 0.94,
      "reasons": [
        "Designed for enterprise accounts like TechCorp",
        "89% renewal success rate when followed",
        "Appropriate for 60-day renewal window"
      ],
      "preview_url": "/content/preview/playbook-renewal-enterprise"
    },
    {
      "content_id": "case-study-techsector-renewal",
      "content_type": "case_study",
      "title": "How Similar Tech Company Expanded During Renewal",
      "description": "Case study of $200K tech company that grew to $300K at renewal",
      "relevance_score": 0.87,
      "reasons": [
        "Similar industry (technology)",
        "Comparable ARR range",
        "Relevant to expansion during renewal"
      ],
      "preview_url": "/content/preview/case-study-techsector-renewal"
    },
    {
      "content_id": "template-renewal-proposal",
      "content_type": "template",
      "title": "Renewal Proposal Template",
      "description": "Customizable renewal proposal document",
      "relevance_score": 0.82,
      "reasons": [
        "Most used template for this stage",
        "Includes value summary section"
      ],
      "preview_url": "/content/preview/template-renewal-proposal"
    }
  ],
  "context": {
    "customer_stage": "active",
    "days_to_renewal": 60,
    "health_score": 72,
    "industry": "technology"
  }
}
```

#### POST /api/content/{id}/feedback
```json
{
  "customer_id": "uuid",
  "feedback": "helpful" | "not_helpful" | "used",
  "outcome": "success" | "failure" | "pending",
  "notes": "optional"
}
```

### Database Schema

```sql
CREATE TABLE content_items (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  embedding vector(1536),
  tags TEXT[],
  industry TEXT[],
  company_size TEXT[],
  lifecycle_stage TEXT[],
  use_cases TEXT[],
  effectiveness_score INTEGER DEFAULT 50,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_usage (
  id UUID PRIMARY KEY,
  content_id UUID REFERENCES content_items(id),
  user_id TEXT NOT NULL,
  customer_id UUID,
  context VARCHAR(50),
  feedback VARCHAR(50),
  outcome VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_embedding ON content_items USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_content_type ON content_items(type);
CREATE INDEX idx_content_usage_content ON content_usage(content_id);
```

## UI/UX Design

### Contextual Recommendations Panel
```
┌─────────────────────────────────────────────────────────┐
│ RECOMMENDED FOR YOU                      TechCorp       │
│ Based on: Renewal in 60 days                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📋 PLAYBOOKS                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Enterprise Renewal Playbook              94% match  │ │
│ │ Step-by-step guide for enterprise renewals          │ │
│ │ ✓ Same industry  ✓ 89% success rate                │ │
│ │ [View] [Start Playbook]                             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📊 CASE STUDIES                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Tech Company Expansion at Renewal        87% match  │ │
│ │ $200K → $300K ARR growth story                      │ │
│ │ ✓ Similar size  ✓ Tech industry                    │ │
│ │ [View] [Share with Customer]                        │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📝 TEMPLATES                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Renewal Proposal Template                82% match  │ │
│ │ [View] [Create from Template]                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [View All Content] [Refresh Recommendations]            │
└─────────────────────────────────────────────────────────┘
```

### In-Chat Recommendations
```
User: "What's the best approach for this renewal?"

AI: Based on TechCorp's situation, I recommend:

📋 **Enterprise Renewal Playbook** (94% match)
This playbook has an 89% success rate for similar accounts.
Key steps include:
1. Value summary creation (Week 1)
2. Stakeholder alignment (Week 2-3)
3. Commercial discussion (Week 4-6)

[Start Playbook] [View Details]

📊 **Relevant Case Study**
"How Similar Tech Company Expanded During Renewal"
A $200K company grew to $300K - could be useful for
positioning expansion with TechCorp.

[View Case Study] [Share with Customer]

Would you like me to start the renewal playbook?
```

## Dependencies

### Required Infrastructure
- Vector database (pgvector)
- Content management system
- Usage tracking
- Claude API for ranking

### Related PRDs
- PRD-200: Playbook Execution
- PRD-219: AI-Powered Universal Search
- PRD-048: Case Study Request

## Success Metrics

### Quantitative
- Recommendation click-through rate > 30%
- Content usage increase > 50%
- Playbook completion rate improvement > 25%
- Renewal success correlation with content usage

### Qualitative
- CSMs discover useful content they didn't know about
- Recommendations feel relevant and timely
- Less time searching for resources

## Rollout Plan

### Phase 1: Basic Recommendations (Week 1-2)
- Content indexing and embeddings
- Simple context-based recommendations
- Basic UI integration

### Phase 2: Personalization (Week 3-4)
- User behavior tracking
- Effectiveness scoring
- Feedback collection

### Phase 3: Intelligence (Week 5-6)
- Contextual triggers
- In-chat recommendations
- Dynamic re-ranking

### Phase 4: Analytics (Week 7-8)
- Effectiveness dashboards
- Content gap identification
- Recommendation optimization

## Open Questions
1. How do we handle stale or outdated content?
2. Should recommendations differ by CSM experience level?
3. How do we measure content effectiveness accurately?
4. Should we recommend external content (blog posts, webinars)?
