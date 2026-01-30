# PRD-219: AI-Powered Universal Search

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-219 |
| **Title** | AI-Powered Universal Search |
| **Category** | H: AI-Powered Features |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs need to find information quickly across multiple data sources: accounts, contacts, emails, documents, meeting notes, and playbooks. Current search is limited to basic keyword matching within individual sections. An AI-powered universal search should understand context, handle natural language queries, search across all data types, and return the most relevant results with intelligent ranking.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to search across all my data with a single query (Cmd+K style).
2. **As a CSM**, I want to find information using natural language ("emails from Sarah about pricing").
3. **As a CSM**, I want search to understand context ("meetings with enterprise accounts this month").
4. **As a CSM**, I want to search inside documents, not just by title.
5. **As a CSM**, I want intelligent suggestions as I type.

### Secondary User Stories
1. **As a CSM**, I want to save frequent searches for quick access.
2. **As a CSM**, I want to filter results by type, date, or account.
3. **As a CSM**, I want to search within a specific account's data only.

## Acceptance Criteria

### Core Functionality
- [ ] Single search bar accessible from anywhere (Cmd+K / Ctrl+K)
- [ ] Searches across all data types simultaneously
- [ ] Natural language query understanding
- [ ] Intelligent result ranking (most relevant first)
- [ ] Instant suggestions as user types
- [ ] Full-text search within document contents

### Searchable Data Types
- [ ] Customers (by name, industry, segment, any field)
- [ ] Stakeholders (by name, email, role, company)
- [ ] Emails (subject, body, sender, recipient)
- [ ] Meetings (title, notes, transcripts, action items)
- [ ] Documents (Google Docs, Drive files by content)
- [ ] Playbooks and knowledge base articles
- [ ] Tasks (title, description)
- [ ] Notes and activity logs

### Search Features
- [ ] Fuzzy matching for typos
- [ ] Synonym support (VP = Vice President)
- [ ] Filters: type, date range, account, status
- [ ] Recent searches history
- [ ] Saved searches
- [ ] Boolean operators support (AND, OR, NOT)

## Technical Specification

### Architecture

```
Query Input → Query Parser → Intent Detection → Multi-Source Search → Result Merger → AI Ranking → Response
                   ↓
           Suggestion Engine
```

### Search Infrastructure

#### 1. Search Index Structure

Using vector embeddings for semantic search + keyword search for exact matches:

```typescript
interface SearchDocument {
  id: string;
  type: 'customer' | 'stakeholder' | 'email' | 'meeting' | 'document' | 'playbook' | 'task' | 'note';
  title: string;
  content: string;
  embedding: number[];  // Vector embedding
  metadata: {
    customer_id?: string;
    customer_name?: string;
    created_at: Date;
    updated_at: Date;
    author?: string;
    tags?: string[];
  };
  access_control: {
    user_ids: string[];
    public: boolean;
  };
}
```

#### 2. Query Parser

```typescript
interface ParsedQuery {
  raw_query: string;
  keywords: string[];
  filters: {
    type?: string[];
    customer?: string;
    date_range?: DateRange;
    author?: string;
  };
  natural_language_intent?: string;
  entities: {
    person_names?: string[];
    company_names?: string[];
    dates?: string[];
  };
}

function parseQuery(query: string): ParsedQuery {
  // Use Claude for NL understanding
  // Extract filters from syntax: "type:email from:sarah"
  // Identify entities and intent
}
```

#### 3. Multi-Source Search

```typescript
async function universalSearch(query: ParsedQuery, userId: string): Promise<SearchResult[]> {
  const [
    semanticResults,
    keywordResults,
    entityResults
  ] = await Promise.all([
    semanticSearch(query.raw_query, query.filters),
    keywordSearch(query.keywords, query.filters),
    entitySearch(query.entities)
  ]);

  return mergeAndRank(semanticResults, keywordResults, entityResults);
}
```

#### 4. AI Ranking

Use Claude to re-rank results based on:
- Query relevance
- Recency
- User's recent activity patterns
- Account importance

### API Endpoints

#### GET /api/search
```
Query params:
- q: Search query
- type: Filter by type (optional)
- customer_id: Filter by customer (optional)
- from: Start date (optional)
- to: End date (optional)
- limit: Max results (default 20)
- offset: Pagination offset
```

Response:
```json
{
  "query": "emails from sarah about renewal",
  "parsed": {
    "keywords": ["renewal"],
    "entities": { "person_names": ["sarah"] },
    "filters": { "type": ["email"] }
  },
  "results": [
    {
      "id": "email-uuid",
      "type": "email",
      "title": "Re: Renewal discussion",
      "snippet": "...Sarah mentioned that renewal timing depends on...",
      "relevance_score": 0.95,
      "metadata": {
        "customer_name": "TechCorp Industries",
        "date": "2026-01-25",
        "from": "sarah.chen@techcorp.com"
      },
      "highlight": {
        "title": "Re: <mark>Renewal</mark> discussion",
        "content": "...<mark>Sarah</mark> mentioned that <mark>renewal</mark> timing..."
      },
      "actions": ["open_email", "view_customer"]
    },
    {
      "id": "meeting-uuid",
      "type": "meeting",
      "title": "Q4 Renewal Planning with TechCorp",
      "snippet": "Sarah discussed renewal priorities and timeline...",
      "relevance_score": 0.88,
      "metadata": {
        "customer_name": "TechCorp Industries",
        "date": "2026-01-20"
      },
      "actions": ["view_summary", "view_customer"]
    }
  ],
  "total": 15,
  "suggestions": [
    "emails from sarah about pricing",
    "meetings with sarah",
    "TechCorp renewal status"
  ],
  "filters_applied": {
    "type": "email",
    "person": "sarah"
  }
}
```

#### GET /api/search/suggest
```
Query params:
- q: Partial query
- limit: Max suggestions (default 5)
```

Response:
```json
{
  "suggestions": [
    {
      "type": "query",
      "text": "emails from sarah",
      "category": "Search"
    },
    {
      "type": "customer",
      "text": "TechCorp Industries",
      "id": "uuid",
      "category": "Customer"
    },
    {
      "type": "stakeholder",
      "text": "Sarah Chen (VP Product)",
      "id": "uuid",
      "category": "Contact"
    },
    {
      "type": "recent",
      "text": "emails from sarah about renewal",
      "category": "Recent Search"
    }
  ]
}
```

### Database Schema

```sql
-- Search index table (for full-text search)
CREATE TABLE search_index (
  id UUID PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,
  source_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB,
  tsv tsvector,  -- PostgreSQL full-text search vector
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_tsv ON search_index USING gin(tsv);
CREATE INDEX idx_search_user ON search_index(user_id);
CREATE INDEX idx_search_customer ON search_index(customer_id);
CREATE INDEX idx_search_type ON search_index(source_type);

-- Vector embeddings (using pgvector)
CREATE TABLE search_embeddings (
  id UUID PRIMARY KEY,
  search_index_id UUID REFERENCES search_index(id),
  embedding vector(1536),  -- OpenAI embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embeddings_vector ON search_embeddings
USING ivfflat (embedding vector_cosine_ops);

-- Recent/saved searches
CREATE TABLE user_searches (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB,
  is_saved BOOLEAN DEFAULT false,
  name TEXT,  -- For saved searches
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  use_count INTEGER DEFAULT 1
);
```

### Indexing Pipeline

```typescript
// Index new/updated documents
async function indexDocument(doc: IndexableDocument) {
  // Extract text content
  const content = await extractContent(doc);

  // Generate embedding
  const embedding = await generateEmbedding(content);

  // Update search index
  await upsertSearchIndex({
    source_type: doc.type,
    source_id: doc.id,
    title: doc.title,
    content: content,
    embedding: embedding,
    metadata: doc.metadata
  });
}

// Batch reindex for initial setup
async function reindexAll() {
  await Promise.all([
    indexAllCustomers(),
    indexAllStakeholders(),
    indexAllEmails(),
    indexAllMeetings(),
    indexAllDocuments()
  ]);
}
```

## UI/UX Design

### Command Palette (Cmd+K)
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Search across everything...                     ⌘K   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ SUGGESTIONS                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔍 emails from sarah about renewal      Search     │ │
│ │ 🏢 TechCorp Industries                  Customer   │ │
│ │ 👤 Sarah Chen (VP Product)              Contact    │ │
│ │ 📧 Re: Renewal discussion               Email      │ │
│ │ 📄 Renewal playbook                     Playbook   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ RECENT SEARCHES                                         │
│ • at-risk accounts                                      │
│ • meetings this week                                    │
│ • techcorp health score                                 │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ Press Enter to search, ↑↓ to navigate, Esc to close    │
└─────────────────────────────────────────────────────────┘
```

### Search Results Page
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 emails from sarah about renewal                      │
├─────────────────────────────────────────────────────────┤
│ Filter: [All Types ▼] [All Accounts ▼] [Any Time ▼]     │
│ 15 results (0.3s)                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📧 EMAILS (8)                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Re: Renewal discussion                              │ │
│ │ TechCorp Industries • Jan 25, 2026                  │ │
│ │ ...Sarah mentioned that renewal timing depends on   │ │
│ │ the budget cycle. She wants to discuss...           │ │
│ │ [View Email] [View Customer]                        │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Q1 Renewal Planning                                 │ │
│ │ TechCorp Industries • Jan 18, 2026                  │ │
│ │ ...Sarah and team want to finalize renewal before...│ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📅 MEETINGS (4)                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Q4 Renewal Planning with TechCorp                   │ │
│ │ Jan 20, 2026 • 45 minutes                          │ │
│ │ Sarah discussed renewal priorities and timeline...  │ │
│ │ [View Summary] [View Recording]                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📄 DOCUMENTS (3)                                        │
│ ...                                                     │
│                                                         │
│ [Load More Results]                                     │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

### Required Infrastructure
- PostgreSQL with full-text search (existing)
- pgvector extension for vector search
- OpenAI embeddings API
- Claude API for query understanding
- Gmail/Drive/Meeting data indexed

### Related PRDs
- PRD-211: Natural Language Account Query
- PRD-081: Account Notes Search
- PRD-204: Confluence Knowledge Base

## Success Metrics

### Quantitative
- Search latency < 500ms for 95% of queries
- Result relevance (click-through rate) > 40%
- Search usage: > 80% of CSMs use daily
- Zero-result rate < 5%

### Qualitative
- CSMs find what they need in first 3 results
- Natural language queries feel intuitive
- Filters are easy to apply and understand

## Rollout Plan

### Phase 1: Basic Search (Week 1-2)
- Keyword search across customers, stakeholders
- Basic suggestion engine
- Cmd+K interface

### Phase 2: Full-Text (Week 3-4)
- Email content indexing
- Meeting transcript search
- Document content search

### Phase 3: Semantic Search (Week 5-6)
- Vector embeddings
- Natural language queries
- AI re-ranking

### Phase 4: Intelligence (Week 7-8)
- Personalized ranking
- Saved searches
- Advanced filters

## Open Questions
1. How do we handle search across very large email histories?
2. Should we support searching across team members' data (with permissions)?
3. What's the right balance between semantic and keyword search?
4. How do we keep the search index fresh with real-time updates?
