# PRD-094: Competitor Mentioned - Battle Card

## Metadata
- **PRD ID**: PRD-094
- **Category**: D - Alerts & Triggers
- **Priority**: P1
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: Meeting Intelligence, Email Analysis, Knowledge Base

---

## 1. Overview

### 1.1 Problem Statement
When a customer mentions a competitor in a meeting, email, or support conversation, it often signals they are evaluating alternatives. CSMs need immediate awareness of these competitive mentions along with relevant positioning information to address concerns effectively before the customer progresses in their evaluation.

### 1.2 Solution Summary
Implement an automated detection system that identifies competitor mentions across all customer communication channels (meetings, emails, support tickets). When detected, the system alerts the CSM with relevant context and automatically surfaces the appropriate competitive battle card with positioning guidance.

### 1.3 Success Metrics
- Detect 95% of competitor mentions within 24 hours
- Reduce competitive losses by 25%
- Increase CSM confidence in competitive conversations
- Improve win rate when competitor is mentioned by 30%

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be alerted when a customer mentions a competitor
**So that** I can proactively address competitive concerns with the right positioning

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want the relevant battle card surfaced automatically, so I don't have to search for competitive information.

**US-3**: As a CS Manager, I want to track competitive mention patterns across my portfolio, so I can identify systemic competitive threats.

**US-4**: As a Product team member, I want visibility into feature comparisons customers are requesting, so I can prioritize the roadmap.

---

## 3. Functional Requirements

### 3.1 Competitor Detection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Maintain competitor name list with aliases/variations | Must |
| FR-1.2 | Scan meeting transcripts for competitor mentions | Must |
| FR-1.3 | Scan email threads for competitor mentions | Must |
| FR-1.4 | Scan support tickets for competitor mentions | Should |
| FR-1.5 | Detect context: evaluation, comparison, positive mention of competitor | Should |
| FR-1.6 | Identify specific features/capabilities being compared | Should |

### 3.2 Alert and Battle Card

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create alert with competitor name, context, and source | Must |
| FR-2.2 | Link to relevant battle card from knowledge base | Must |
| FR-2.3 | Highlight key differentiators for the mentioned competitor | Must |
| FR-2.4 | Include suggested talk tracks and objection handlers | Should |
| FR-2.5 | Show win/loss history against this competitor | Should |

### 3.3 Response Preparation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Draft suggested response addressing competitive concern | Should |
| FR-3.2 | Schedule follow-up meeting to address concerns | Should |
| FR-3.3 | Notify Sales if expansion opportunity at risk | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
-- Competitor catalog
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  aliases TEXT[], -- ["Comp Inc", "Competitor", "CompetitorCorp"]
  website TEXT,
  category VARCHAR(100),
  battle_card_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitor mentions
CREATE TABLE competitor_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  competitor_id UUID REFERENCES competitors(id),
  source_type VARCHAR(50), -- meeting, email, support_ticket
  source_id TEXT,
  context TEXT,
  sentiment VARCHAR(20), -- positive, negative, neutral
  features_mentioned TEXT[],
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Detection Logic

```typescript
const COMPETITOR_PATTERNS = [
  { name: 'Gainsight', aliases: ['gainsight', 'gain sight', 'GS'] },
  { name: 'ChurnZero', aliases: ['churnzero', 'churn zero', 'CZ'] },
  { name: 'Totango', aliases: ['totango'] },
  // ... more competitors
];

function detectCompetitors(text: string): CompetitorMention[] {
  const mentions = [];
  for (const competitor of COMPETITOR_PATTERNS) {
    for (const alias of competitor.aliases) {
      if (text.toLowerCase().includes(alias.toLowerCase())) {
        const context = extractContext(text, alias);
        mentions.push({
          competitor: competitor.name,
          alias,
          context,
          sentiment: analyzeSentiment(context)
        });
      }
    }
  }
  return mentions;
}
```

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:crossed_swords: Competitor Alert: Acme Corp mentioned Gainsight

Source: Meeting transcript (Jan 28, 2026)
Context: "We're also looking at Gainsight because they have better reporting dashboards."

Customer Status:
- ARR: $120,000
- Renewal: 85 days away
- Health Score: 68

Battle Card: Gainsight
Key Differentiators:
1. AI-first approach vs rules-based automation
2. Faster implementation (weeks vs months)
3. Superior meeting intelligence integration

Suggested Response:
"I'd love to show you our new Analytics Dashboard - we've made significant improvements based on customer feedback."

[View Full Battle Card] [Draft Response] [Schedule Meeting]
```

---

## 6. Related PRDs
- PRD-011: Competitor Mention Analysis - Battle Card (document upload)
- PRD-068: Competitive Intelligence per Account
- PRD-230: Competitive Intelligence Gathering
