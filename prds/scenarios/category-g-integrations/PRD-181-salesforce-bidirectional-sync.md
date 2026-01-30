# PRD-181: Salesforce Bi-Directional Sync

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-181 |
| **Title** | Salesforce Bi-Directional Sync |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P0 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
CSMs currently must manually update customer data in both CSCX.AI and Salesforce, leading to data inconsistencies, wasted time, and risk of outdated information being used for critical customer decisions. Without bi-directional sync, health scores calculated in CSCX.AI are not visible in Salesforce where sales and leadership review accounts.

## User Stories

### Primary User Stories
1. **As a CSM**, I want customer account data to automatically sync from Salesforce to CSCX.AI so that I always have the latest account information without manual data entry.
2. **As a CSM**, I want health scores calculated in CSCX.AI to automatically push back to Salesforce so that sales and leadership can see customer health in their primary CRM.
3. **As a CS Leader**, I want to see CSCX.AI-generated insights in Salesforce reports so that I can include customer health in my executive dashboards.

### Secondary User Stories
4. **As a System Admin**, I want to configure which fields sync in each direction so that I can maintain data integrity and avoid conflicting updates.
5. **As a CSM**, I want to see the last sync timestamp and status so that I know my data is current.

## Functional Requirements

### FR-1: OAuth 2.0 Authentication
- Support Salesforce OAuth 2.0 authentication flow
- Store access tokens and refresh tokens securely in `integrations` table
- Handle token refresh automatically before expiration
- Support both Production and Sandbox environments

### FR-2: Account Data Pull (Salesforce → CSCX.AI)
- Pull Account records with configurable field mapping:
  - `Account.Name` → `customers.name`
  - `Account.AnnualRevenue` → `customers.arr`
  - `Account.Industry` → `customers.industry`
  - Custom fields as configured
- Pull Contact records linked to Accounts:
  - Map to `stakeholders` table
  - Include name, email, title, phone
- Support incremental sync based on LastModifiedDate
- Handle rate limiting with exponential backoff

### FR-3: Health Score Push (CSCX.AI → Salesforce)
- Push health scores to configurable custom field on Account
- Include health score components breakdown
- Push health score trend (growing/stable/declining)
- Support batch updates for efficiency
- Log all sync operations for audit

### FR-4: Bi-Directional Field Mapping
- Admin UI to configure field mappings
- Support custom fields in both systems
- Define sync direction per field (pull-only, push-only, bi-directional)
- Conflict resolution rules:
  - Salesforce wins (default)
  - CSCX.AI wins
  - Most recent wins
  - Manual review required

### FR-5: Sync Scheduling
- Real-time webhook for immediate sync on Salesforce changes
- Scheduled full sync (configurable: hourly, daily)
- Manual sync trigger from UI
- Sync status dashboard with history

## Non-Functional Requirements

### NFR-1: Performance
- Incremental sync completes within 30 seconds for 1000 records
- Full sync completes within 5 minutes for 10,000 accounts
- API rate limit compliance (Salesforce: 100,000 calls/24 hours)

### NFR-2: Reliability
- Circuit breaker pattern for API failures
- Retry mechanism with exponential backoff
- Data validation before write operations
- Rollback capability for failed batch operations

### NFR-3: Security
- Encrypted token storage
- Audit logging of all sync operations
- Role-based access to sync configuration
- No plaintext credentials in logs

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/salesforce/connect     # Initiate OAuth flow
GET    /api/integrations/salesforce/callback    # OAuth callback
POST   /api/integrations/salesforce/sync        # Trigger manual sync
GET    /api/integrations/salesforce/status      # Get sync status
PUT    /api/integrations/salesforce/mappings    # Update field mappings
DELETE /api/integrations/salesforce/disconnect  # Remove integration
```

### Database Schema
Uses existing `integrations` table:
```sql
-- integrations table already exists with:
-- id, user_id, provider, access_token, refresh_token,
-- instance_url, expires_at, metadata, created_at, updated_at

-- Add sync tracking
CREATE TABLE salesforce_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id),
  sync_type VARCHAR(20), -- 'full', 'incremental', 'push'
  direction VARCHAR(10), -- 'pull', 'push'
  records_processed INTEGER,
  records_created INTEGER,
  records_updated INTEGER,
  records_failed INTEGER,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) -- 'running', 'completed', 'failed'
);
```

### Data Flow
```
[Salesforce Account] --Pull--> [CSCX Customer]
                      <--Push-- [Health Score]

[Salesforce Contact] --Pull--> [CSCX Stakeholder]
```

### Integration Points
- Uses existing `server/src/services/google/` pattern for service layer
- Integrates with agent system for automated sync triggers
- Connects to trigger engine for sync-based automations

## User Interface

### Connection Flow
1. Settings > Integrations > Salesforce
2. Click "Connect Salesforce"
3. OAuth redirect to Salesforce login
4. Grant permissions
5. Redirect back with success message
6. Configure field mappings

### Sync Status Widget
- Last sync timestamp
- Records synced count
- Sync status indicator (green/yellow/red)
- "Sync Now" button
- Link to sync history

### Field Mapping UI
- Two-column mapping interface
- Drag-and-drop field assignment
- Direction toggle per field
- Save/Test buttons

## Dependencies
- Salesforce Connected App configuration
- OAuth scopes: `api`, `refresh_token`
- Custom field creation permissions in Salesforce

## Acceptance Criteria

### AC-1: Authentication
- [ ] Can connect to Salesforce via OAuth
- [ ] Tokens are stored securely and encrypted
- [ ] Token refresh happens automatically
- [ ] Can disconnect and reconnect

### AC-2: Data Sync
- [ ] Account data pulls successfully to customers table
- [ ] Contact data pulls successfully to stakeholders table
- [ ] Health scores push to configured Salesforce field
- [ ] Incremental sync only processes changed records

### AC-3: Configuration
- [ ] Admin can configure field mappings
- [ ] Admin can set sync schedule
- [ ] Admin can choose conflict resolution strategy
- [ ] Changes to mappings take effect on next sync

### AC-4: Observability
- [ ] All sync operations are logged
- [ ] Sync status is visible in UI
- [ ] Errors are surfaced with actionable messages
- [ ] Metrics available for monitoring

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Sync Salesforce data" | Trigger manual sync |
| "What's the Salesforce sync status?" | Show last sync info |
| "Update [account] health score in Salesforce" | Push single account |
| "Show Salesforce sync errors" | Display recent failures |

### Quick Actions
- **Sync Now**: Trigger immediate sync
- **View Status**: Show sync dashboard
- **Configure**: Open settings panel

## Rollout Plan

### Phase 1: Foundation
- OAuth integration
- Account pull functionality
- Basic field mapping

### Phase 2: Bi-Directional
- Health score push
- Contact sync
- Conflict resolution

### Phase 3: Advanced
- Webhook real-time sync
- Custom field support
- Batch operations

## Success Metrics
| Metric | Target |
|--------|--------|
| Sync success rate | > 99% |
| Average sync latency | < 30 seconds |
| Manual data entry reduction | 80% reduction |
| Data consistency score | > 95% match |

## Related PRDs
- PRD-182: HubSpot Integration
- PRD-107: Health Score Threshold Alert
- PRD-118: Health Score Change → Playbook Selection
