# PRD-202: Linear Issue Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-202 |
| **Title** | Linear Issue Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P2 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using Linear for issue tracking need customer-related issues visible to CSMs. Modern startups prefer Linear's streamlined interface, but CSMs lack visibility into engineering work affecting their customers without switching tools.

## User Stories

### Primary User Stories
1. **As a CSM**, I want Linear issues linked to my accounts visible in CSCX.AI.
2. **As a CSM**, I want to be notified when customer-affecting issues are completed.
3. **As a Product person**, I want to see customer impact when prioritizing Linear issues.

### Secondary User Stories
4. **As a CSM**, I want to create Linear issues with customer context from CSCX.AI.
5. **As an Engineer**, I want customer context visible in Linear for better understanding.

## Functional Requirements

### FR-1: OAuth Authentication
- Support Linear OAuth 2.0
- Request scopes: read/write issues, teams
- API key fallback

### FR-2: Issue Sync
- Pull issues linked to customers
- Sync issue data:
  - Identifier, title
  - State, priority
  - Assignee
  - Labels
  - Project/cycle
  - Due date
- Real-time via webhooks

### FR-3: Customer Linking
- Link via labels or custom field
- Support project-based linking
- Many-to-many relationships

### FR-4: Issue Creation
- Create issues from CSCX.AI
- Include customer context
- Auto-apply customer label
- Requires approval

### FR-5: Status Notifications
- Webhook for state changes
- Alert CSM on:
  - Issue completed
  - Priority elevated
  - Cycle changes
- Update customer timeline

### FR-6: Impact Tracking
- Show customers per issue
- Calculate issue impact
- Prioritization signals

## Non-Functional Requirements

### NFR-1: Performance
- Real-time webhook processing
- Sync latency < 1 minute

### NFR-2: Reliability
- Handle API rate limits
- Retry failed syncs

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/linear/connect
GET    /api/integrations/linear/callback
POST   /api/integrations/linear/webhook
GET    /api/linear/issues/:customerId
POST   /api/linear/issues
GET    /api/linear/issue/:issueId
```

### Linear API Usage
```javascript
// GraphQL query for issues
POST https://api.linear.app/graphql
{
  "query": `
    query {
      issues(filter: {labels: {name: {eq: "customer:acmecorp"}}}) {
        nodes {
          id
          identifier
          title
          state { name }
          priority
          assignee { name }
          createdAt
          updatedAt
        }
      }
    }
  `
}

// Create issue
mutation {
  issueCreate(input: {
    teamId: "team_123",
    title: "Feature request from Acme Corp",
    description: "...",
    labelIds: ["customer_label_id"]
  }) {
    issue { id identifier }
  }
}
```

### Database Schema
```sql
CREATE TABLE linear_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id TEXT UNIQUE,
  identifier TEXT,
  title TEXT,
  state VARCHAR(50),
  priority INTEGER,
  assignee TEXT,
  team TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE linear_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id TEXT REFERENCES linear_issues(linear_id),
  customer_id UUID REFERENCES customers(id),
  created_at TIMESTAMPTZ,
  UNIQUE(linear_id, customer_id)
);
```

## User Interface

### Issues Panel
- Customer issue list
- State indicators
- Priority badges
- Quick filters

### Issue Creation Modal
- Title, description
- Team/project selection
- Auto-link customer

## Acceptance Criteria

### AC-1: Connection
- [ ] OAuth works
- [ ] Issues sync correctly

### AC-2: Functionality
- [ ] Customer linking works
- [ ] Status updates real-time
- [ ] Issue creation works

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Linear issues for [account]" | Display issues |
| "Create Linear issue for [account]" | Open form |

## Success Metrics
| Metric | Target |
|--------|--------|
| Issue sync accuracy | > 99% |
| Status notification latency | < 1 minute |

## Related PRDs
- PRD-201: Jira Issue Tracking
- PRD-097: Product Issue Alert
