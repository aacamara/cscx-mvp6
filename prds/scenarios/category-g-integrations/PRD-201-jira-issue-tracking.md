# PRD-201: Jira Issue Tracking

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-201 |
| **Title** | Jira Issue Tracking |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Customer-reported bugs and feature requests tracked in Jira are not visible to CSMs in their customer success workflow. CSMs cannot easily check the status of issues their customers care about, leading to poor communication and frustrated customers waiting for updates.

## User Stories

### Primary User Stories
1. **As a CSM**, I want to see Jira issues linked to my accounts so I can provide status updates to customers.
2. **As a CSM**, I want to be notified when issues my customers care about are resolved so I can proactively inform them.
3. **As a Product Manager**, I want to see which customers are affected by specific issues for prioritization.

### Secondary User Stories
4. **As a CSM**, I want to create Jira issues from customer conversations with proper context.
5. **As a Support Engineer**, I want CSM visibility into customer impact for better prioritization.

## Functional Requirements

### FR-1: OAuth/API Authentication
- Support Jira Cloud OAuth 2.0
- Support Jira Server/Data Center API tokens
- Configure Jira base URL

### FR-2: Issue Sync
- Pull issues linked to customers
- Sync issue fields:
  - Key, summary
  - Type (bug, story, task)
  - Status, priority
  - Assignee, reporter
  - Created, updated dates
  - Custom fields
- Link via customer label/field

### FR-3: Customer Linking
- Multiple linking strategies:
  - Custom field (customer ID)
  - Labels
  - Components
  - JQL queries
- Support many-to-many (issue affects multiple customers)

### FR-4: Issue Creation
- Create issues from CSCX.AI
- Pre-populate:
  - Customer context
  - Related stakeholder info
  - Health score
- Link to customer automatically
- Requires approval

### FR-5: Status Tracking
- Track issue status changes
- Webhook for real-time updates
- Notify CSM on:
  - Issue resolved
  - Priority changed
  - Moved to development
- Update customer context

### FR-6: Impact Analysis
- Show customers affected per issue
- Calculate impact severity
- Aggregate issue health per customer

### FR-7: SLA Tracking
- Track time in status
- Monitor against SLAs
- Alert on SLA breaches

## Non-Functional Requirements

### NFR-1: Performance
- Issue sync < 5 seconds per customer
- Real-time webhook processing

### NFR-2: Compatibility
- Support Jira Cloud
- Support Jira Server 8.x+
- Handle custom workflows

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/jira/connect
GET    /api/integrations/jira/callback
POST   /api/integrations/jira/webhook
GET    /api/jira/issues/:customerId
GET    /api/jira/issue/:issueKey
POST   /api/jira/issues
PUT    /api/jira/linking/:customerId
GET    /api/jira/affected-customers/:issueKey
```

### Jira API Usage
```javascript
// Search issues for customer
GET /rest/api/3/search
?jql=labels = "customer_acmecorp" AND status != Done
&fields=summary,status,priority,assignee,created,updated

// Create issue
POST /rest/api/3/issue
{
  "fields": {
    "project": {"key": "CS"},
    "summary": "Feature request from Acme Corp",
    "description": "Customer requested...",
    "issuetype": {"name": "Story"},
    "labels": ["customer_acmecorp"],
    "customfield_10001": "acme-corp-id"
  }
}

// Webhook payload
{
  "webhookEvent": "jira:issue_updated",
  "issue": {
    "key": "CS-123",
    "fields": {
      "status": {"name": "Done"}
    }
  },
  "changelog": {
    "items": [{"field": "status", "toString": "Done"}]
  }
}
```

### Database Schema
```sql
CREATE TABLE jira_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_key TEXT UNIQUE,
  project_key TEXT,
  summary TEXT,
  issue_type VARCHAR(50),
  status VARCHAR(50),
  priority VARCHAR(50),
  assignee TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE jira_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jira_key TEXT REFERENCES jira_issues(jira_key),
  customer_id UUID REFERENCES customers(id),
  link_type VARCHAR(20), -- affected, requested, watching
  created_at TIMESTAMPTZ,
  UNIQUE(jira_key, customer_id)
);
```

## User Interface

### Customer Issues Panel
- List of linked issues
- Status badges
- Priority indicators
- Quick filters

### Issue Detail View
- Full issue details
- Status timeline
- Affected customers list
- Quick actions

### Issue Creation Form
- Issue type selection
- Summary/description
- Customer auto-link
- Priority suggestion

## Acceptance Criteria

### AC-1: Connection
- [ ] OAuth flow works (Cloud)
- [ ] API token works (Server)
- [ ] Webhooks receive events

### AC-2: Data Sync
- [ ] Issues sync correctly
- [ ] Customer linking works
- [ ] Status updates real-time

### AC-3: Issue Creation
- [ ] Can create from CSCX.AI
- [ ] Customer linked automatically
- [ ] Appears in Jira correctly

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Show Jira issues for [account]" | Display issues |
| "What's the status of CS-123?" | Show issue detail |
| "Create a Jira issue for [account]" | Open creation form |
| "Alert me when CS-123 is resolved" | Set up notification |

## Success Metrics
| Metric | Target |
|--------|--------|
| Issue sync accuracy | > 99% |
| CSM awareness of resolutions | < 1 hour |
| Customer communication improvement | 50% faster |

## Related PRDs
- PRD-202: Linear Issue Integration
- PRD-097: Product Issue Alert
- PRD-112: Feature Request Update
