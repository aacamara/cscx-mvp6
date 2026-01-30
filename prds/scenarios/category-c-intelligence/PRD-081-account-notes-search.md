# PRD-081: Account Notes Search

## Metadata
- **PRD ID**: PRD-081
- **Category**: C - Account Intelligence
- **Priority**: P2
- **Estimated Complexity**: Medium
- **Dependencies**: PRD-219 (AI-Powered Universal Search)

## Scenario Description
CSMs accumulate extensive notes across customer interactions, meetings, and internal discussions. The system should provide powerful search capabilities to quickly find relevant information within account notes, using both keyword and semantic search.

## User Story
**As a** CSM preparing for a customer meeting,
**I want to** search through all notes for a customer,
**So that** I can quickly find relevant context and history.

## Trigger
- CSM types: "Search notes for [customer] about [topic]"
- CSM uses search bar within customer detail view
- CSM asks: "What did we discuss with [customer] about [topic]?"

## Current State Analysis

### What Exists Today
| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Chat messages | `chat_messages` table | Implemented | Stores conversation history |
| Agent messages | `agent_messages` table | Implemented | Agent interactions logged |
| Meeting notes | `meetings` table + `transcripts` | Implemented | Meeting content stored |
| Knowledge base | `knowledge_base` table | Implemented | Has embedding support |

### What's Missing
- [ ] Unified notes search across all sources
- [ ] Semantic/vector search for notes
- [ ] Notes tagging and categorization
- [ ] Search result ranking and relevance scoring
- [ ] Highlighted search results with context
- [ ] Search history and saved searches

## Detailed Workflow

### Step 1: Query Processing
- Parse search query for customer context
- Identify search type (keyword vs semantic)
- Extract key terms and intent

### Step 2: Multi-Source Search
- Search chat_messages for customer
- Search meeting transcripts and summaries
- Search agent activity logs
- Search any attached documents

### Step 3: Result Aggregation
- Combine results from all sources
- Rank by relevance and recency
- Group by source type

### Step 4: Presentation
- Display results with highlighted matches
- Show surrounding context
- Allow drill-down to full content

## Technical Requirements

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `server/src/services/search/notesSearch.ts` | Create | Notes search service |
| `server/src/routes/search.ts` | Modify | Add notes search endpoint |
| `components/CustomerDetail/NotesSearch.tsx` | Create | Search UI component |

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/customers/:id/notes/search` | GET | Search customer notes |
| `POST /api/search/notes` | POST | Cross-customer notes search |

### Database Changes
```sql
CREATE INDEX idx_chat_messages_content_gin ON chat_messages USING gin(to_tsvector('english', content));
CREATE INDEX idx_transcripts_content_gin ON transcripts USING gin(to_tsvector('english', content));
```

## Chat UI Flow
```
CSM: Search notes for Acme Corp about API integration issues
System: Searching all notes for Acme Corp related to "API integration issues"...

Found 7 relevant results:

**Meeting Notes - Dec 15, 2025** (High relevance)
"...discussed ongoing API integration issues with their data warehouse. Engineering team promised fix in v2.3..."

**Chat History - Dec 10, 2025** (Medium relevance)
"Customer reported API timeout errors during peak hours..."

**Internal Note - Dec 8, 2025** (Medium relevance)
"Escalated API integration ticket to engineering. Priority: High..."

[Show More Results] [Filter by Date] [Filter by Type]
```

## Acceptance Criteria
- [ ] Search across all note sources (chat, meetings, internal)
- [ ] Keyword and semantic search support
- [ ] Results ranked by relevance
- [ ] Context snippets with highlighted matches
- [ ] Filter by date range and source type
- [ ] Search history saved for quick re-access
- [ ] Response time < 2 seconds for typical queries

## Ralph Loop Notes
- **Learning**: Track which search results CSMs find useful
- **Optimization**: Improve ranking based on click-through data
- **Personalization**: Remember frequently searched topics per CSM

### Completion Signal
```
<promise>PRD-081-COMPLETE</promise>
```
