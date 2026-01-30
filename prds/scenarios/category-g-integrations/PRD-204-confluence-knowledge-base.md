# PRD-204: Confluence Knowledge Base

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-204 |
| **Title** | Confluence Knowledge Base |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Confluence for documentation have customer playbooks, product docs, and process guides that CSMs need to reference. Without integration, this knowledge is not accessible to the AI assistant, and CSMs must manually search Confluence for answers.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to search Confluence knowledge base from CSCX.AI for quick answers.
2. **As CSCX.AI AI**, I want to reference Confluence documentation when helping CSMs with customer questions.
3. **As a CS Leader**, I want playbooks stored in Confluence automatically available to the AI.

### Secondary User Stories
4. **As a CSM**, I want customer-specific pages in Confluence linked to their records.
5. **As an Admin**, I want to configure which Confluence spaces are indexed.

## Functional Requirements

### FR-1: Authentication
- Support Confluence Cloud OAuth 2.0
- Support Confluence Server basic auth/API token
- Space-level permissions

### FR-2: Content Sync
- Index selected spaces
- Sync page content:
  - Title, body
  - Labels
  - Attachments metadata
  - Last modified
- Handle macros and formatting

### FR-3: Space Configuration
- Select spaces to index
- Configure sync frequency
- Set permission mappings

### FR-4: Search Integration
- Unified search across Confluence
- Full-text content search
- Label-based filtering
- Relevance ranking

### FR-5: AI Knowledge Base
- Embed content for semantic search
- Include in AI context
- Reference in responses
- Citation support

### FR-6: Customer Page Linking
- Link pages to customers via:
  - Labels
  - Page properties
  - Space structure
- Show linked pages in customer view

### FR-7: Page Creation
- Create pages from CSCX.AI
- Use Confluence templates
- Link to customer
- Populate with context

## Non-Functional Requirements

### NFR-1: Performance
- Sync 10,000 pages in 30 minutes
- Search response < 2 seconds

### NFR-2: Content Handling
- Handle large pages
- Parse macros appropriately
- Respect permissions

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/confluence/connect
GET    /api/integrations/confluence/callback
GET    /api/confluence/spaces
PUT    /api/confluence/spaces/config
POST   /api/confluence/sync
GET    /api/confluence/search
GET    /api/confluence/pages/:customerId
POST   /api/confluence/pages
```

### Confluence API Usage
```javascript
// Search content
GET /wiki/rest/api/content/search
?cql=space=CS AND type=page AND text~"onboarding"

// Get page content
GET /wiki/rest/api/content/{id}
?expand=body.storage,version,space

// Create page
POST /wiki/rest/api/content
{
  "type": "page",
  "title": "Success Plan - Acme Corp",
  "space": {"key": "CS"},
  "body": {
    "storage": {
      "value": "<p>Content here</p>",
      "representation": "storage"
    }
  },
  "metadata": {
    "labels": [{"name": "customer-acmecorp"}]
  }
}
```

### Database Schema
```sql
CREATE TABLE confluence_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confluence_page_id TEXT UNIQUE,
  space_key TEXT,
  title TEXT,
  content_text TEXT,
  labels TEXT[],
  page_url TEXT,
  last_modified_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);

CREATE TABLE confluence_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confluence_page_id TEXT REFERENCES confluence_pages(confluence_page_id),
  chunk_text TEXT,
  embedding VECTOR(1536),
  chunk_index INTEGER
);

CREATE TABLE confluence_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confluence_page_id TEXT REFERENCES confluence_pages(confluence_page_id),
  customer_id UUID REFERENCES customers(id),
  link_type VARCHAR(20)
);
```

## User Interface

### Space Configuration
- Space list with checkboxes
- Sync status per space
- Last sync timestamp

### Knowledge Search
- Search bar in CSCX.AI
- Results with snippets
- Link to Confluence

### Customer Pages
- Linked pages list
- Quick preview
- Create new page

## Acceptance Criteria

### AC-1: Connection
- [ ] OAuth works (Cloud)
- [ ] API token works (Server)
- [ ] Spaces load correctly

### AC-2: Sync
- [ ] Content indexes properly
- [ ] Embeddings generated
- [ ] Search works accurately

### AC-3: AI Integration
- [ ] AI references Confluence
- [ ] Citations provided
- [ ] Permissions respected

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Search Confluence for 'onboarding checklist'" | Search KB |
| "What does our playbook say about renewals?" | AI lookup |
| "Create Confluence page for [account]" | Create page |

## Success Metrics
| Metric | Target |
|--------|--------|
| Content sync accuracy | > 99% |
| Search relevance | > 85% |
| AI answer accuracy with KB | +25% |

## Related PRDs
- PRD-203: Notion Documentation Sync
- PRD-219: AI-Powered Universal Search
