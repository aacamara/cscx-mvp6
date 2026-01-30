# PRD-183: Gainsight Data Pull

## Overview
| Field | Value |
|-------|-------|
| **PRD ID** | PRD-183 |
| **Title** | Gainsight Data Pull |
| **Category** | G: CRM & Tool Integrations |
| **Priority** | P1 |
| **Status** | Not Started |
| **Created** | 2026-01-29 |
| **Last Updated** | 2026-01-29 |

## Problem Statement
Organizations transitioning from or running Gainsight alongside CSCX.AI need to import historical customer success data, health scores, and playbook execution history. Without this integration, valuable customer insights accumulated in Gainsight would be lost or require manual re-entry.

## User Stories

### Primary User Stories
1. **As a CS Leader**, I want to import Gainsight health score history into CSCX.AI so that I maintain trend visibility during platform transition.
2. **As a CSM**, I want Gainsight timeline entries imported so that I don't lose historical customer interaction context.
3. **As a System Admin**, I want to migrate Gainsight playbook data to inform CSCX.AI automation configuration.

### Secondary User Stories
4. **As a CSM**, I want Gainsight CTAs (Calls to Action) imported as tasks so that nothing falls through the cracks.
5. **As an Analyst**, I want historical Gainsight data for trend analysis and benchmarking.

## Functional Requirements

### FR-1: API Authentication
- Support Gainsight REST API authentication
- API key-based authentication
- Support for Gainsight NXT and CS platforms
- Secure credential storage

### FR-2: Company/Account Import
- Pull Company records from Gainsight
- Map standard fields:
  - Company Name → customers.name
  - ARR → customers.arr
  - Industry → customers.industry
  - CSM Assignment → customers.csm_id
  - Health Score → customers.health_score
- Support custom MDA (Massive Data Architecture) objects

### FR-3: Health Score History Import
- Import historical health score records
- Maintain score components breakdown
- Import scorecard configurations
- Map to `health_score_history` table

### FR-4: Timeline Entry Import
- Import Activity Timeline entries
- Map activity types to CSCX activity log
- Preserve timestamps and ownership
- Include attachments references

### FR-5: CTA Migration
- Import open and closed CTAs
- Map CTA types to task categories
- Preserve due dates and priorities
- Link to playbook associations

### FR-6: Relationship Import
- Import Person records as stakeholders
- Import Relationship objects
- Preserve relationship types and strengths
- Map to stakeholder sentiment

## Non-Functional Requirements

### NFR-1: Performance
- Import 50,000 timeline entries within 30 minutes
- Handle paginated API responses efficiently
- Resume capability for interrupted imports

### NFR-2: Data Integrity
- Validate all records before import
- Duplicate detection and handling
- Audit log of all imported records

## Technical Implementation

### API Endpoints
```
POST   /api/integrations/gainsight/connect
POST   /api/integrations/gainsight/import
GET    /api/integrations/gainsight/import/status
GET    /api/integrations/gainsight/preview
DELETE /api/integrations/gainsight/disconnect
```

### Gainsight API Usage
```javascript
// Company fetch
GET /v1/data/objects/Company
Authorization: Gainsight-Api-Key: {api_key}

// Timeline entries
GET /v1/data/objects/Activity_Timeline
?fields=Name,Subject,Activity_Date,Activity_Type,Company_ID

// Health score history
GET /v1/data/objects/Company_Person_Score_History
```

### Data Mapping
```javascript
const gainsightMapping = {
  Company: {
    targetTable: 'customers',
    fields: {
      'Name': 'name',
      'ARR_c': 'arr',
      'Industry_c': 'industry',
      'Gainsight_Health_Score': 'health_score',
      'CSM_User_c': 'csm_id'
    }
  },
  Activity_Timeline: {
    targetTable: 'agent_activity_log',
    fields: {
      'Subject': 'action_type',
      'Activity_Date': 'started_at',
      'Details': 'action_data'
    }
  }
};
```

## User Interface

### Import Wizard
1. Enter Gainsight API credentials
2. Test connection
3. Select objects to import
4. Preview record counts
5. Map custom fields
6. Start import
7. Monitor progress

### Import Dashboard
- Progress indicator per object type
- Records imported vs total
- Error log with record details
- Resume/retry controls

## Acceptance Criteria

### AC-1: Authentication
- [ ] API key authentication works
- [ ] Connection test validates access
- [ ] Credentials stored securely

### AC-2: Data Import
- [ ] Companies import with field mapping
- [ ] Health score history imports correctly
- [ ] Timeline entries preserve context
- [ ] CTAs import as tasks

### AC-3: Import Management
- [ ] Progress tracking accurate
- [ ] Failed records logged with details
- [ ] Import can be paused and resumed

## Chat UI Integration

### Natural Language Commands
| Command | Action |
|---------|--------|
| "Import Gainsight data" | Start import wizard |
| "Show Gainsight import status" | Display progress |
| "Import health scores from Gainsight" | Import specific object |

## Success Metrics
| Metric | Target |
|--------|--------|
| Import success rate | > 98% |
| Data mapping accuracy | > 99% |
| Historical data preserved | 100% |

## Related PRDs
- PRD-181: Salesforce Bi-Directional Sync
- PRD-153: Health Score Portfolio View
