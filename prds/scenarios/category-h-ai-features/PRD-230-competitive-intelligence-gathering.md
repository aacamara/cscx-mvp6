# PRD-230: Competitive Intelligence Gathering

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-230 |
| **Title** | Competitive Intelligence Gathering |
| **Category** | H: AI-Powered Features |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs encounter competitive situations but often lack comprehensive intelligence about competitors. Competitive mentions in meetings, emails, and customer conversations are captured but not aggregated or analyzed. AI should automatically gather, consolidate, and provide actionable competitive intelligence to help CSMs navigate competitive situations effectively.

## User Stories

### Primary User Stories
1. **As a CSM**, I want automatic alerts when competitors are mentioned by customers.
2. **As a CSM**, I want battle cards that show how to position against specific competitors.
3. **As a CSM**, I want to see competitive trends across my portfolio.
4. **As a CSM**, I want talking points when customers ask about competitor comparisons.
5. **As a CSM**, I want to contribute competitive intel I discover to a shared knowledge base.

### Secondary User Stories
1. **As a CS Leader**, I want to understand which competitors are most active in our market.
2. **As a CSM**, I want to see win/loss analysis against specific competitors.
3. **As a Product Manager**, I want aggregated competitive feedback from customer conversations.

## Acceptance Criteria

### Core Functionality
- [ ] Automatic competitor mention detection in communications
- [ ] Dynamic battle cards per competitor
- [ ] Competitive trend analysis across portfolio
- [ ] Real-time competitive news/updates
- [ ] Intel contribution and curation system

### Detection Sources
- [ ] Meeting transcripts
- [ ] Email content
- [ ] Support ticket mentions
- [ ] CRM notes
- [ ] Survey/NPS responses

### Battle Card Components
- [ ] Competitor overview
- [ ] Product comparison (features, pricing)
- [ ] Strengths and weaknesses
- [ ] Common objections and responses
- [ ] Win themes (how we beat them)
- [ ] Loss themes (why we lose to them)
- [ ] Recent updates/news

## Technical Specification

### Architecture

```
Data Sources → Mention Detector → Intel Aggregator → Battle Card Generator → Delivery
      ↓               ↓                 ↓                    ↓
  Transcripts    NLP Extraction   Knowledge Base      Real-time Updates
  Emails
```

### Competitor Mention Detection

```typescript
interface CompetitorMention {
  id: string;
  competitor_name: string;
  source: 'meeting' | 'email' | 'support' | 'crm' | 'survey';
  source_id: string;
  customer_id: string;
  context: string;  // Surrounding text
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: 'evaluation' | 'comparison' | 'switch_risk' | 'information';
  detected_at: Date;
}

const KNOWN_COMPETITORS = [
  { name: 'CompetitorA', aliases: ['CompA', 'Competitor A'] },
  { name: 'CompetitorB', aliases: ['CompB', 'Competitor B'] },
  // ...
];

async function detectCompetitorMentions(
  text: string,
  source: string,
  customerId: string
): Promise<CompetitorMention[]> {
  const prompt = `
    Analyze this text for competitor mentions.
    Known competitors: ${KNOWN_COMPETITORS.map(c => c.name).join(', ')}

    Text:
    ${text}

    For each mention, identify:
    1. Competitor name
    2. Surrounding context (50 words)
    3. Sentiment (positive/neutral/negative toward competitor)
    4. Intent (evaluation, comparison, switch_risk, information)

    Return as JSON array.
  `;

  const mentions = await claude.analyze(prompt);
  return mentions.map(m => ({
    ...m,
    source,
    customer_id: customerId,
    detected_at: new Date()
  }));
}
```

### Battle Card Generator

```typescript
interface BattleCard {
  competitor_id: string;
  competitor_name: string;
  overview: string;
  product_comparison: ProductComparison;
  strengths: string[];
  weaknesses: string[];
  objection_handlers: ObjectionHandler[];
  win_themes: string[];
  loss_themes: string[];
  recent_intel: IntelItem[];
  recent_news: NewsItem[];
  updated_at: Date;
}

async function generateBattleCard(competitorName: string): Promise<BattleCard> {
  // Aggregate all intel about this competitor
  const mentions = await getMentions(competitorName);
  const winLossData = await getWinLossData(competitorName);
  const news = await fetchCompetitorNews(competitorName);

  // Use Claude to synthesize battle card
  const prompt = `
    Generate a competitive battle card for ${competitorName}.

    Recent mentions from customer conversations:
    ${JSON.stringify(mentions.slice(0, 20))}

    Win/Loss data:
    Wins against them: ${winLossData.wins.length}
    Losses to them: ${winLossData.losses.length}
    Win themes: ${winLossData.winThemes.join(', ')}
    Loss themes: ${winLossData.lossThemes.join(', ')}

    Create a comprehensive battle card including:
    1. Brief overview (2-3 sentences)
    2. Key strengths (their advantages)
    3. Key weaknesses (our advantages)
    4. Top 5 objection handlers
    5. Win themes (how to beat them)
    6. Loss themes (what to avoid)
  `;

  return await claude.generate(prompt);
}
```

### API Endpoints

#### GET /api/competitive/mentions
```json
{
  "filters": {
    "competitor": "optional",
    "customer_id": "optional",
    "date_range": { "from": "2026-01-01", "to": "2026-01-31" },
    "intent": "evaluation"
  }
}
```

Response:
```json
{
  "mentions": [
    {
      "id": "uuid",
      "competitor_name": "CompetitorA",
      "customer_name": "TechCorp Industries",
      "source": "meeting",
      "context": "...they mentioned they're evaluating CompetitorA for the reporting module...",
      "sentiment": "neutral",
      "intent": "evaluation",
      "detected_at": "2026-01-25T14:30:00Z",
      "actions": ["view_battle_card", "view_customer"]
    }
  ],
  "summary": {
    "total_mentions": 15,
    "by_competitor": {
      "CompetitorA": 8,
      "CompetitorB": 5,
      "CompetitorC": 2
    },
    "by_intent": {
      "evaluation": 6,
      "comparison": 5,
      "switch_risk": 2,
      "information": 2
    }
  }
}
```

#### GET /api/competitive/battle-card/{competitor}
```json
{
  "competitor_name": "CompetitorA",
  "overview": "CompetitorA is a mid-market CS platform focused on SMB customers. Strong in basic health scoring but lacks advanced analytics.",
  "product_comparison": {
    "pricing": { "us": "$$$", "them": "$$" },
    "features": [
      { "feature": "Health Scoring", "us": "Advanced ML", "them": "Basic rules" },
      { "feature": "Integrations", "us": "50+", "them": "20" },
      { "feature": "AI Features", "us": "Full suite", "them": "Basic" }
    ]
  },
  "strengths": [
    "Lower price point",
    "Simpler implementation",
    "Good for SMB needs"
  ],
  "weaknesses": [
    "Limited enterprise features",
    "No advanced analytics",
    "Poor integration depth"
  ],
  "objection_handlers": [
    {
      "objection": "CompetitorA is cheaper",
      "response": "While CompetitorA has a lower list price, our customers see 3x ROI due to automation. TechCorp saved 15 hours/week...",
      "supporting_data": ["ROI calculator", "TechCorp case study"]
    }
  ],
  "win_themes": [
    "Lead with enterprise complexity handling",
    "Demonstrate integration depth",
    "Show AI-driven automation ROI"
  ],
  "loss_themes": [
    "Price-focused evaluations favor them",
    "Very simple CS operations don't need our depth"
  ],
  "recent_intel": [
    {
      "date": "2026-01-25",
      "customer": "TechCorp",
      "insight": "Customer evaluating for reporting features"
    }
  ],
  "recent_news": [
    {
      "date": "2026-01-20",
      "headline": "CompetitorA raises Series B",
      "source": "TechCrunch",
      "summary": "..."
    }
  ],
  "win_rate_against": 0.68,
  "updated_at": "2026-01-29T10:00:00Z"
}
```

#### POST /api/competitive/intel
Contribute new competitive intelligence.
```json
{
  "competitor_name": "CompetitorA",
  "intel_type": "pricing" | "feature" | "strategy" | "news",
  "content": "Learned from customer that CompetitorA is now offering 20% discounts...",
  "source": "Customer conversation",
  "customer_id": "optional-uuid"
}
```

### Database Schema

```sql
CREATE TABLE competitor_mentions (
  id UUID PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  source VARCHAR(50) NOT NULL,
  source_id TEXT,
  context TEXT,
  sentiment VARCHAR(20),
  intent VARCHAR(50),
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE competitor_intel (
  id UUID PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  intel_type VARCHAR(50),
  content TEXT NOT NULL,
  source TEXT,
  contributed_by TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE battle_cards (
  id UUID PRIMARY KEY,
  competitor_name TEXT UNIQUE NOT NULL,
  overview TEXT,
  product_comparison JSONB,
  strengths TEXT[],
  weaknesses TEXT[],
  objection_handlers JSONB,
  win_themes TEXT[],
  loss_themes TEXT[],
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mentions_competitor ON competitor_mentions(competitor_name);
CREATE INDEX idx_mentions_customer ON competitor_mentions(customer_id);
```

## UI/UX Design

### Competitive Alert
```
┌─────────────────────────────────────────────────────────┐
│ 🚨 COMPETITIVE ALERT - TechCorp Industries              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ CompetitorA mentioned in meeting (Jan 25)               │
│                                                         │
│ Context: "...they're evaluating CompetitorA for the     │
│ reporting module specifically because of pricing..."    │
│                                                         │
│ Intent: Evaluation | Sentiment: Neutral                 │
│                                                         │
│ [View Battle Card] [Add to Deal Risk] [View Meeting]    │
└─────────────────────────────────────────────────────────┘
```

### Battle Card View
```
┌─────────────────────────────────────────────────────────┐
│ BATTLE CARD: CompetitorA                 Win Rate: 68%  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ OVERVIEW                                                │
│ ─────────                                               │
│ Mid-market CS platform focused on SMB. Strong in basic  │
│ health scoring but lacks advanced analytics and AI.     │
│                                                         │
│ COMPARISON                                              │
│ ──────────                                              │
│ Feature        │ Us              │ Them                 │
│ ────────────────────────────────────────────────────── │
│ Health Score   │ Advanced ML     │ Basic rules          │
│ Integrations   │ 50+             │ 20                   │
│ AI Features    │ Full suite      │ Basic                │
│ Price          │ $$$             │ $$                   │
│                                                         │
│ THEIR STRENGTHS (Be aware)                              │
│ ─────────────────────────                               │
│ • Lower price point                                     │
│ • Simpler implementation                                │
│ • Good fit for SMB                                      │
│                                                         │
│ OUR ADVANTAGES (Lead with)                              │
│ ─────────────────────────                               │
│ • Enterprise-grade features                             │
│ • Advanced analytics & AI                               │
│ • Deep integration ecosystem                            │
│                                                         │
│ TOP OBJECTION HANDLERS                                  │
│ ──────────────────────                                  │
│ ❓ "CompetitorA is cheaper"                             │
│ → While they have lower list price, customers see 3x    │
│   ROI from our automation. Show ROI calculator.         │
│                                                         │
│ [View All Handlers] [Share Battle Card] [Contribute]    │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- Meeting transcript analysis
- Email content processing
- News aggregation service
- Win/loss tracking in CRM

### Related PRDs
- PRD-068: Competitive Intelligence per Account
- PRD-094: Competitor Mentioned → Battle Card
- PRD-011: Competitor Mention Analysis → Battle Card

## Success Metrics

### Quantitative
- Competitive mention detection rate > 95%
- Battle card usage: 80% of competitive deals
- Win rate improvement: 15% when battle cards used
- Time to competitive response: < 24 hours

### Qualitative
- CSMs feel prepared for competitive situations
- Battle cards are accurate and up-to-date
- Intel contribution is easy and encouraged

## Rollout Plan

### Phase 1: Detection (Week 1-2)
- Competitor mention detection
- Basic alerting
- Mention aggregation

### Phase 2: Battle Cards (Week 3-4)
- Battle card generation
- Objection handlers
- Win/loss analysis

### Phase 3: Intelligence (Week 5-6)
- News integration
- Intel contribution
- Trend analysis

### Phase 4: Optimization (Week 7-8)
- Curation workflow
- Cross-team sharing
- Advanced analytics

## Open Questions
1. How do we keep battle cards current with limited manual effort?
2. Should we integrate with commercial competitive intel services?
3. How do we handle unverified intel submissions?
4. What's the process for Product to consume competitive feedback?
