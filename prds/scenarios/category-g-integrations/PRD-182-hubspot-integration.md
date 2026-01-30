# PRD-182: HubSpot Integration

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-182 |
| **Title** | HubSpot Integration |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations using HubSpot as their CRM cannot leverage CSCX.AI's customer success capabilities without manual data transfer. CSMs need seamless access to HubSpot company data, contact information, and deal pipeline to provide contextual customer engagement while maintaining data consistency across systems.

## User Stories

### Primary User Stories
1. **As a CSM**, I want HubSpot company data to sync automatically to CSCX.AI so that I have complete customer context without switching between tools.
2. **As a CSM**, I want to see HubSpot deal information alongside customer health so that I can coordinate renewal conversations with sales.
3. **As a CS Leader**, I want CSCX.AI health scores visible in HubSpot so that the entire revenue team has customer health visibility.

### Secondary User Stories
4. **As a CSM**, I want contact engagement data from HubSpot to inform my stakeholder prioritization.
5. **As a System Admin**, I want to map custom HubSpot properties to CSCX.AI fields for complete data alignment.

## Functional Requirements

### FR-1: OAuth 2.0 Authentication
- Support HubSpot OAuth 2.0 flow with private app credentials
- Request scopes: `crm.objects.companies.read`, `crm.objects.contacts.read`, `crm.objects.deals.read`
- Secure token storage with automatic refresh
- Support for multiple HubSpot portals per organization

### FR-2: Company Data Sync (HubSpot → CSCX.AI)
- Sync Company objects to `customers` table:
  - `name` → `customers.name`
  - `annualrevenue` → `customers.arr`
  - `industry` → `customers.industry`
  - `hubspot_owner_id` → lookup CSM assignment
- Support custom property mapping
- Incremental sync via `hs_lastmodifieddate`

### FR-3: Contact Data Sync
- Sync associated Contacts to `stakeholders` table
- Map properties: name, email, jobtitle, phone
- Maintain company-contact associations
- Track engagement scores from HubSpot

### FR-4: Deal Pipeline Integration
- Pull deal data for renewal tracking
- Map deal stages to renewal pipeline stages
- Show open deals in customer context
- Alert on deal stage changes

### FR-5: Health Score Push (CSCX.AI → HubSpot)
- Create custom property for CSCX health score
- Push health score updates via API
- Include trend indicator
- Update on health score calculation

## Non-Functional Requirements

### NFR-1: Performance
- Sync 5,000 companies within 10 minutes
- Real-time webhook processing < 5 seconds
- API rate compliance (100 requests/10 seconds)

### NFR-2: Reliability
- 99.9% sync availability
- Automatic retry on failures
- Data validation before writes

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/hubspot/connect
GET    /api/integrations/hubspot/callback
POST   /api/integrations/hubspot/sync
GET    /api/integrations/hubspot/status
PUT    /api/integrations/hubspot/mappings
DELETE /api/integrations/hubspot/disconnect
```

### HubSpot API Usage
```javascript
// Company sync
GET /crm/v3/objects/companies
GET /crm/v3/objects/companies/{companyId}/associations/contacts

// Health score push
PATCH /crm/v3/objects/companies/{companyId}
{
  "properties": {
    "cscx_health_score": 85,
    "cscx_health_trend": "growing"
  }
}
```

### Database Schema
```sql
-- Uses existing integrations table with provider='hubspot'

CREATE TABLE hubspot_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id),
  object_type VARCHAR(20), -- 'company', 'contact', 'deal'
  sync_direction VARCHAR(10),
  records_processed INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20)
);
```

## User Interface

### Connection Setup
1. Settings > Integrations > HubSpot
2. Enter HubSpot portal ID or connect via OAuth
3. Authorize requested scopes
4. Configure property mappings
5. Set sync schedule

### Sync Dashboard
- Connection status indicator
- Last sync timestamp per object type
- Record counts by sync direction
- Error log with resolution guidance

## Acceptance Criteria

### AC-1: Authentication
- [ ] OAuth flow completes successfully
- [ ] Tokens refresh automatically
- [ ] Multiple portal support works

### AC-2: Data Sync
- [ ] Companies sync to customers table
- [ ] Contacts sync to stakeholders table
- [ ] Deals appear in customer context
- [ ] Custom properties map correctly

### AC-3: Health Score Push
- [ ] Health scores push to HubSpot property
- [ ] Updates trigger on score changes
- [ ] Trend data included

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Sync HubSpot data" | Trigger sync |
| "Show HubSpot deals for [account]" | Display deal info |
| "Update HubSpot with latest health scores" | Push all scores |

## Success Metrics
| Metric | Target |
|--------|--------|
| Sync success rate | > 99% |
| Data freshness | < 1 hour |
| CSM tool switching | 50% reduction |

## Related PRDs
- PRD-181: Salesforce Bi-Directional Sync
- PRD-059: Renewal Pipeline Forecast
