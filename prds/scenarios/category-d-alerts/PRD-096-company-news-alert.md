# PRD-096: Company News Alert

## Metadata
- **PRD ID**: PRD-096
- **Category**: D - Alerts & Triggers
- **Priority**: P2
- **Status**: Not Started
- **Created**: 2026-01-29
- **Dependencies**: News API Integration, Data Enrichment

---

## 1. Overview

### 1.1 Problem Statement
Significant events at customer companies (funding rounds, acquisitions, layoffs, product launches, earnings reports) provide critical context for CSM conversations and can signal both opportunities and risks. CSMs who stay informed about customer news can have more relevant conversations and anticipate needs, but manually tracking news for dozens of accounts is impractical.

### 1.2 Solution Summary
Implement an automated news monitoring system that tracks relevant news about customer companies and alerts CSMs when significant events occur. News is categorized by type and impact, with suggested talking points and action items based on the news content.

### 1.3 Success Metrics
- Surface relevant company news within 24 hours of publication
- Increase CSM conversational relevance scores
- Identify 30% more expansion triggers from news events
- Reduce surprise reactions to major customer events

---

## 2. User Stories

### 2.1 Primary User Story
**As a** Customer Success Manager
**I want to** be informed when significant news happens at my customer accounts
**So that** I can have relevant, timely conversations and anticipate their needs

### 2.2 Secondary User Stories

**US-2**: As a CSM, I want news categorized by type (funding, layoffs, acquisition, etc.), so I can quickly understand the nature of the event.

**US-3**: As a CSM, I want suggested talking points based on the news, so I can reference it naturally in conversations.

**US-4**: As a CS Manager, I want aggregated news alerts across the team portfolio, so I can identify industry-wide trends.

---

## 3. Functional Requirements

### 3.1 News Monitoring

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-1.1 | Monitor news sources for customer company mentions | Must |
| FR-1.2 | Filter for significant/relevant news (not routine mentions) | Must |
| FR-1.3 | Categorize news: funding, M&A, leadership, layoffs, product, earnings | Must |
| FR-1.4 | Assess potential impact: positive, negative, neutral | Should |
| FR-1.5 | Deduplicate across multiple sources | Must |

### 3.2 Alert Generation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-2.1 | Create alert with news summary, source, and category | Must |
| FR-2.2 | Include suggested talking points | Should |
| FR-2.3 | Link to full article | Must |
| FR-2.4 | Aggregate daily digest option vs real-time alerts | Should |

### 3.3 Action Recommendations

| Requirement | Description | Priority |
|-------------|-------------|----------|
| FR-3.1 | Suggest appropriate action based on news type | Should |
| FR-3.2 | Draft congratulatory message for positive news | Should |
| FR-3.3 | Flag risk signals for negative news | Should |

---

## 4. Technical Specifications

### 4.1 Data Model

```sql
CREATE TABLE company_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  source_url TEXT,
  category VARCHAR(50), -- funding, acquisition, layoffs, product, earnings, leadership, other
  sentiment VARCHAR(20), -- positive, negative, neutral
  impact_assessment TEXT,
  published_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  alerted BOOLEAN DEFAULT false,
  alerted_at TIMESTAMPTZ
);
```

### 4.2 News Sources

- Google News API
- Crunchbase
- PR Newswire
- Company press release pages
- SEC filings (for public companies)

---

## 5. UI/UX Specifications

### 5.1 Slack Alert Format

```
:newspaper: Company News: InnovateTech Corp

:moneybag: FUNDING: InnovateTech Raises $50M Series C

Source: TechCrunch (Jan 29, 2026)

Summary:
InnovateTech announced a $50M Series C round led by Sequoia Capital. The company plans to expand its engineering team and accelerate product development.

Impact Assessment:
- Positive signal: Company is growing and well-funded
- Opportunity: Budget for additional tools/expansion
- Note: May have increased vendor scrutiny post-funding

Suggested Talking Points:
- "Congratulations on the funding round!"
- "How can we help support your growth plans?"
- "Would love to discuss how we can scale with you."

[Read Full Article] [Draft Congratulations Note] [View Customer]
```

---

## 6. Related PRDs
- PRD-095: Executive Change Detected
- PRD-073: Recent Changes Alert
- PRD-220: Automated Data Enrichment
