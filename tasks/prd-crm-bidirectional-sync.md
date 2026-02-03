# PRD: CRM Bidirectional Sync

## Introduction

CRM Bidirectional Sync establishes real-time, two-way synchronization between CSCX and major CRMs (Salesforce, HubSpot). Customer data, health scores, activities, and opportunities flow seamlessly between systems, eliminating manual data entry and ensuring sales and CS teams work from a single source of truth.

This solves the perennial problem of CS tools becoming data silos disconnected from the CRM that sales, finance, and leadership rely on.

## Goals

- Real-time bidirectional sync with Salesforce and HubSpot
- Sync customer records, contacts, opportunities, and activities
- Push CSCX health scores and risk signals to CRM
- Pull CRM opportunity data into CSCX renewal tracking
- Conflict resolution with clear rules (last write wins, or field-level ownership)
- Maintain data integrity with comprehensive audit logging

## User Stories

### US-001: Connect Salesforce
**Description:** As an admin, I want to connect Salesforce so that customer data syncs automatically.

**Acceptance Criteria:**
- [ ] OAuth flow to connect Salesforce org
- [ ] Permission validation (read/write Account, Contact, Opportunity)
- [ ] Test connection with sample query
- [ ] Display connected org name and user
- [ ] Disconnect option with clean token revocation
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Connect HubSpot
**Description:** As an admin, I want to connect HubSpot so that customer data syncs automatically.

**Acceptance Criteria:**
- [ ] OAuth flow to connect HubSpot account
- [ ] Permission scopes: crm.objects.contacts, crm.objects.companies, crm.objects.deals
- [ ] Test connection with sample query
- [ ] Display connected portal ID
- [ ] Disconnect option
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Configure field mappings
**Description:** As an admin, I want to map CSCX fields to CRM fields so that data syncs correctly.

**Acceptance Criteria:**
- [ ] UI to map CSCX customer fields to CRM Account/Company fields
- [ ] UI to map CSCX stakeholder fields to CRM Contact fields
- [ ] Support custom fields in CRM
- [ ] Default mappings for standard fields (name, ARR, renewal date)
- [ ] Validation that required fields are mapped
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Sync direction configuration
**Description:** As an admin, I want to configure sync direction per field so that data flows correctly.

**Acceptance Criteria:**
- [ ] Per-field sync direction: CSCX→CRM, CRM→CSCX, or bidirectional
- [ ] Conflict resolution rule: last write wins, CSCX wins, CRM wins
- [ ] Exclude fields from sync entirely
- [ ] Default direction per field type (e.g., ARR from CRM, health score to CRM)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Customer record sync
**Description:** As a CSM, I want customer records to sync automatically so that I don't manually update both systems.

**Acceptance Criteria:**
- [ ] New customers in CRM create CSCX records
- [ ] Customer updates sync within 5 minutes
- [ ] Soft deletes handled (archive, don't delete)
- [ ] Sync status indicator on customer record
- [ ] Last synced timestamp visible
- [ ] Typecheck passes

### US-006: Push health score to CRM
**Description:** As a CSM, I want health scores to appear in Salesforce/HubSpot so that sales sees CS data.

**Acceptance Criteria:**
- [ ] Health score syncs to custom field in CRM
- [ ] PROVE component scores sync (Product, Risk, Outcomes, Voice, Engagement)
- [ ] Risk category (Low/Medium/High) syncs
- [ ] Churn prediction score syncs (when available)
- [ ] Health score history available in CRM (last 6 values)
- [ ] Typecheck passes

### US-007: Pull opportunity data
**Description:** As a CSM, I want CRM opportunity data in CSCX so that renewal tracking is accurate.

**Acceptance Criteria:**
- [ ] Open opportunities sync to CSCX renewal pipeline
- [ ] Opportunity stage, amount, close date sync
- [ ] Opportunity owner visible in CSCX
- [ ] Link to CRM opportunity from CSCX
- [ ] Closed-won opportunities update customer ARR
- [ ] Typecheck passes

### US-008: Activity sync
**Description:** As a CSM, I want activities to sync bidirectionally so that both systems show complete history.

**Acceptance Criteria:**
- [ ] CSCX meetings sync to CRM activities
- [ ] CSCX emails sync to CRM activities (with HITL approval)
- [ ] CRM activities sync to CSCX timeline
- [ ] Activity deduplication (same meeting doesn't appear twice)
- [ ] Activity attribution (created by CSCX badge)
- [ ] Typecheck passes

### US-009: Sync status dashboard
**Description:** As an admin, I want to see sync status so that I can troubleshoot issues.

**Acceptance Criteria:**
- [ ] Sync health indicator (healthy, degraded, failed)
- [ ] Last successful sync timestamp
- [ ] Failed records list with error details
- [ ] Retry failed records individually or in bulk
- [ ] Sync queue depth (pending records)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Initial data import
**Description:** As an admin, I want to import existing CRM data so that CSCX starts with complete records.

**Acceptance Criteria:**
- [ ] Bulk import of CRM Accounts/Companies to CSCX customers
- [ ] Bulk import of CRM Contacts to CSCX stakeholders
- [ ] Import progress indicator
- [ ] Duplicate detection and merge options
- [ ] Import report with success/failure counts
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Webhook-based real-time sync
**Description:** As a system, I want CRM webhooks to trigger immediate syncs so that data is always current.

**Acceptance Criteria:**
- [ ] Salesforce Outbound Messages for Account/Contact/Opportunity changes
- [ ] HubSpot webhooks for company/contact/deal events
- [ ] Webhook endpoint with signature validation
- [ ] Webhook events queued for processing
- [ ] Fallback to polling if webhooks fail
- [ ] Typecheck passes

## Functional Requirements

- FR-1: CRM connections stored in `crm_connections` table with oauth tokens, sync config
- FR-2: Field mappings stored in `crm_field_mappings` with source_field, target_field, direction
- FR-3: Sync queue in `crm_sync_queue` with record_type, record_id, operation, status
- FR-4: Sync log in `crm_sync_log` with timestamp, record, changes, result
- FR-5: Salesforce uses JSforce library, HubSpot uses official SDK
- FR-6: Real-time sync via webhooks, polling fallback every 15 minutes
- FR-7: Rate limits: Salesforce (API limits per org), HubSpot (10 req/sec)
- FR-8: Conflict resolution: configurable per field with audit trail
- FR-9: Soft delete: CRM deleted records archived in CSCX with deleted_at timestamp
- FR-10: External ID linking: CSCX stores CRM record ID, CRM stores CSCX ID in custom field

## Non-Goals

- No Dynamics 365 support (v1 focuses on Salesforce + HubSpot)
- No CRM workflow triggers (just data sync, not automation)
- No CRM custom object sync (standard objects only)
- No CRM report embedding (use native CRM reports)
- No multi-CRM per org (one CRM connection at a time)

## Technical Considerations

- Salesforce API limits vary by org edition; implement adaptive rate limiting
- HubSpot has different API versions; use v3 CRM API
- Webhook reliability requires idempotent processing (use sync_key for dedup)
- Consider Change Data Capture for Salesforce instead of Outbound Messages
- Token refresh handling critical for long-running connections
- Bulk API for initial import (Salesforce Bulk API 2.0, HubSpot batch endpoints)

## Design Considerations

- Connection flow should feel familiar (standard OAuth)
- Field mapping UI should be visual and intuitive
- Sync status should be easy to understand at a glance
- Error messages should be actionable (not just "sync failed")
- CRM link should open record in new tab

## Success Metrics

- 95% of customers have matching CRM records within 24 hours of creation
- Sync latency <5 minutes for 99% of changes
- Manual data entry reduced by 80%
- Health score visibility in CRM adoption >90% of sales users

## Open Questions

- Should we sync all accounts or only those with active CSCX engagement?
- How to handle CRM sandbox vs production connections?
- Should sync failures block related CSCX operations?
- How to handle CRM field type mismatches (e.g., picklist vs text)?
