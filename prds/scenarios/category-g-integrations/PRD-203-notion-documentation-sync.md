# PRD-203: Notion Documentation Sync

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-203 |
| **Title** | Notion Documentation Sync |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Teams using Notion for documentation have customer-related pages (success plans, meeting notes, project docs) that should be accessible from CSCX.AI. Without integration, CSMs must switch tools to find relevant documentation, and AI assistants cannot reference this knowledge.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Notion pages about my customers linked and searchable in CSCX.AI.
2. **As CSCX.AI AI**, I want to reference Notion documentation when answering CSM questions about customers.
3. **As a CSM**, I want to create Notion pages for customer projects directly from CSCX.AI.

### Secondary User Stories
4. **As a CSM**, I want meeting notes I create in Notion automatically linked to the customer record.
5. **As a Team Lead**, I want shared customer workspaces in Notion visible across the team.

## Functional Requirements

### FR-1: OAuth Integration
- Support Notion OAuth 2.0
- Request access to pages and databases
- Workspace-level connection

### FR-2: Page Sync
- Pull pages linked to customers
- Sync page metadata:
  - Title
  - Content (markdown)
  - Properties
  - Last edited
- Index for search

### FR-3: Database Integration
- Connect Notion databases as data sources
- Map database properties to fields
- Sync records bi-directionally

### FR-4: Customer Linking
- Link pages via:
  - Property (customer name/ID)
  - Page tags
  - Folder structure
- Auto-detect customer mentions

### FR-5: Page Creation
- Create pages from templates
- Pre-populate customer context
- Link to customer automatically
- Support templates:
  - Success Plan
  - Meeting Notes
  - Project Brief

### FR-6: Search Integration
- Include Notion content in search
- Enable AI to reference content
- Semantic search support

### FR-7: Content Embedding
- Embed Notion pages in CSCX.AI
- Maintain Notion styling
- Handle updates

## Non-Functional Requirements

### NFR-1: Performance
- Sync 1000 pages in 10 minutes
- Search results < 2 seconds

### NFR-2: Content Handling
- Handle large pages
- Support rich content types
- Respect sharing permissions

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/notion/connect
GET    /api/integrations/notion/callback
GET    /api/notion/pages/:customerId
GET    /api/notion/page/:pageId
POST   /api/notion/pages
POST   /api/notion/search
GET    /api/notion/databases
```

### Notion API Usage
```javascript
// Search pages
POST https://api.notion.com/v1/search
{
  "query": "Acme Corp",
  "filter": {"property": "object", "value": "page"}
}

// Get page
GET https://api.notion.com/v1/pages/{page_id}

// Get page content
GET https://api.notion.com/v1/blocks/{page_id}/children

// Create page
POST https://api.notion.com/v1/pages
{
  "parent": {"database_id": "customer_docs_db"},
  "properties": {
    "Customer": {"relation": [{"id": "customer_page_id"}]},
    "Title": {"title": [{"text": {"content": "Success Plan - Acme Corp"}}]}
  },
  "children": [...]
}
```

### Database Schema
```sql
CREATE TABLE notion_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id),
  title TEXT,
  content_markdown TEXT,
  page_url TEXT,
  last_edited_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

CREATE TABLE notion_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT REFERENCES notion_pages(notion_page_id),
  chunk_text TEXT,
  embedding VECTOR(1536),
  chunk_index INTEGER
);
```

## User Interface

### Documentation Panel
- Customer page list
- Quick preview
- Link to Notion

### Page Creation
- Template selection
- Customer auto-link
- Property mapping

### Search Results
- Notion results in unified search
- Snippet preview
- Direct link

## Acceptance Criteria

### AC-1: Connection
- [ ] OAuth completes successfully
- [ ] Pages sync correctly

### AC-2: Functionality
- [ ] Customer linking works
- [ ] Page creation works
- [ ] Search includes Notion

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Find Notion docs for [account]" | Search pages |
| "Create success plan in Notion for [account]" | Create page |
| "What's in the Notion page about [topic]?" | Reference content |

## Success Metrics
| Metric | Target |
|--------|--------|
| Page sync accuracy | > 99% |
| Search relevance | > 85% |

## Related PRDs
- PRD-204: Confluence Knowledge Base
- PRD-259: Knowledge Capture
