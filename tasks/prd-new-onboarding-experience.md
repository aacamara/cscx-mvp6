# PRD: New Onboarding Experience

## Introduction

The New Onboarding Experience provides a comprehensive, guided workflow for onboarding new customers into CSCX. From contract upload and parsing to Google Workspace setup, stakeholder mapping, success plan creation, and kickoff scheduling—this streamlined process replaces manual steps with AI-assisted automation while maintaining CSM oversight.

This addresses the critical first 90 days where customer relationships are established and time-to-value must be minimized.

## Goals

- Reduce new customer onboarding time from days to hours
- Automate contract parsing and data extraction
- Set up customer workspace (Drive, Sheets, Calendar) automatically
- Generate 30-60-90 day success plans with AI assistance
- Schedule and prepare kickoff meetings efficiently
- Track onboarding milestone completion
- Ensure consistent onboarding experience across all customers

## User Stories

### US-001: Start new customer onboarding
**Description:** As a CSM, I want to start onboarding a new customer so that I initiate the setup process.

**Acceptance Criteria:**
- [ ] "New Customer" button on customer list
- [ ] Onboarding wizard with clear step indicators
- [ ] Progress saved between sessions (resume where left off)
- [ ] Estimated completion time shown
- [ ] Cancel/restart option
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Contract upload and parsing
**Description:** As a CSM, I want to upload a contract so that customer data is extracted automatically.

**Acceptance Criteria:**
- [ ] Upload contract (PDF, image, or paste text)
- [ ] AI extracts: company name, ARR, start date, end date, renewal date
- [ ] AI extracts: entitlements, user count, product tier
- [ ] AI extracts: stakeholder names, titles, emails from signature block
- [ ] Preview extracted data before confirming
- [ ] Manual override for any extracted field
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Customer profile creation
**Description:** As a CSM, I want a customer profile created from contract data so that the record is complete.

**Acceptance Criteria:**
- [ ] Customer record created with extracted data
- [ ] Industry, segment (SMB/MM/Enterprise) selection
- [ ] CSM assignment (default to current user)
- [ ] Tier assignment based on ARR
- [ ] Logo upload (optional)
- [ ] Customer saved to database
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Stakeholder mapping
**Description:** As a CSM, I want to map customer stakeholders so that I know who to engage.

**Acceptance Criteria:**
- [ ] Add stakeholders (name, title, email, phone)
- [ ] Stakeholder role: Champion, Sponsor, User, Detractor
- [ ] Primary contact designation
- [ ] Import stakeholders from contract extraction
- [ ] LinkedIn lookup for additional context (optional)
- [ ] Stakeholder influence score (Low/Medium/High)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Entitlements configuration
**Description:** As a CSM, I want to configure entitlements so that I track what the customer purchased.

**Acceptance Criteria:**
- [ ] List entitlements from contract (products, features, quantities)
- [ ] Edit entitlement details
- [ ] Add/remove entitlements manually
- [ ] Entitlement status: Active, Pending, Expired
- [ ] Link entitlements to usage tracking
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Google Workspace setup
**Description:** As a CSM, I want customer workspace created in Google Drive so that files are organized.

**Acceptance Criteria:**
- [ ] Create folder: "CSCX - {CustomerName}"
- [ ] Subfolders: Onboarding, Meetings, QBRs, Contracts, Reports, Training
- [ ] Upload contract to Contracts folder
- [ ] Create Health Score Tracker spreadsheet
- [ ] Create Onboarding Checklist spreadsheet
- [ ] Share folder with stakeholders (optional)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Success plan generation
**Description:** As a CSM, I want an AI-generated success plan so that goals are established early.

**Acceptance Criteria:**
- [ ] AI generates 30-60-90 day milestones based on customer profile
- [ ] Milestones customized by industry and product tier
- [ ] Each milestone has: title, description, due date, owner
- [ ] Success metrics defined for each phase
- [ ] Edit/approve AI-generated plan
- [ ] Plan saved to customer record
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Kickoff meeting scheduling
**Description:** As a CSM, I want to schedule the kickoff meeting so that onboarding begins promptly.

**Acceptance Criteria:**
- [ ] Suggest meeting times based on CSM availability
- [ ] Include stakeholders from stakeholder list
- [ ] Pre-filled meeting title: "{CustomerName} Kickoff"
- [ ] Pre-filled agenda template
- [ ] Google Calendar event creation with Meet link
- [ ] Email invitations sent (via HITL approval)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Welcome email drafting
**Description:** As a CSM, I want a welcome email drafted so that the customer receives initial communication.

**Acceptance Criteria:**
- [ ] AI drafts personalized welcome email
- [ ] Includes: introduction, kickoff details, what to expect
- [ ] Attachments: onboarding checklist, getting started guide
- [ ] Preview and edit before sending
- [ ] HITL approval for sending
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Onboarding checklist
**Description:** As a CSM, I want an onboarding checklist so that I track required steps.

**Acceptance Criteria:**
- [ ] Default checklist: contract uploaded, stakeholders mapped, kickoff scheduled, etc.
- [ ] Checklist auto-updates as steps complete
- [ ] Manual check-off for offline steps
- [ ] Due dates for each checklist item
- [ ] Reminders for overdue items
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Training enrollment
**Description:** As a CSM, I want to enroll stakeholders in training so that they learn the product.

**Acceptance Criteria:**
- [ ] Select training tracks from library
- [ ] Assign training to specific stakeholders
- [ ] Training enrollment emails sent
- [ ] Track training completion progress
- [ ] Certificate generation on completion (optional)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Onboarding progress dashboard
**Description:** As a CSM, I want to see onboarding progress so that I track status across customers.

**Acceptance Criteria:**
- [ ] List of customers in onboarding
- [ ] Progress bar per customer (% complete)
- [ ] Days since onboarding started
- [ ] Current step indicator
- [ ] Blocked/stalled customers highlighted
- [ ] Filter by onboarding stage
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-013: Onboarding templates
**Description:** As an admin, I want onboarding templates so that process is consistent.

**Acceptance Criteria:**
- [ ] Create onboarding template with steps and timelines
- [ ] Templates by segment (Enterprise, Mid-market, SMB)
- [ ] Templates by product line
- [ ] Default template selection
- [ ] Customize template per customer
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-014: Handoff from sales
**Description:** As a CSM, I want sales handoff notes so that I have context before kickoff.

**Acceptance Criteria:**
- [ ] Sales handoff form (why they bought, key concerns, champion info)
- [ ] Handoff received notification
- [ ] Handoff notes visible during onboarding
- [ ] Questions for sales if info missing
- [ ] Link to CRM opportunity for deal context
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-015: Onboarding completion
**Description:** As a CSM, I want to mark onboarding complete so that the customer transitions to steady state.

**Acceptance Criteria:**
- [ ] Completion checklist (all required items done)
- [ ] Completion celebration (UI feedback)
- [ ] Customer status changes from "Onboarding" to "Active"
- [ ] Handoff to Adoption agent for ongoing engagement
- [ ] Onboarding summary generated (duration, milestones achieved)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Onboarding wizard state stored in `onboarding_sessions` with customer_id, step, data
- FR-2: Contract parsing uses Claude vision for PDF/images, text extraction for digital
- FR-3: Extracted data stored in `contracts` table with parsed_data JSONB
- FR-4: Google Workspace setup uses existing Drive/Sheets/Calendar services
- FR-5: Success plan stored in `success_plans` with milestones as JSONB array
- FR-6: Onboarding checklist in `onboarding_checklists` with items and completion status
- FR-7: Onboarding templates in `onboarding_templates` with steps, timelines, segment
- FR-8: Progress calculated from completed steps / total steps
- FR-9: Onboarding agent (specialist) can be invoked throughout process
- FR-10: Sales handoff stored in `sales_handoffs` with customer_id, notes, submitted_by

## Non-Goals

- No multi-customer bulk onboarding (one at a time)
- No onboarding for existing customers (new customers only)
- No automated user provisioning in customer's product (just CSCX setup)
- No onboarding SLA enforcement (tracking only)
- No onboarding NPS survey (separate feedback system)

## Technical Considerations

- Contract parsing can be slow (10-30 sec); show progress
- Google Workspace setup requires valid OAuth tokens
- Large contracts may hit token limits; chunk for parsing
- Onboarding state must persist across sessions (database-backed)
- Consider background jobs for workspace setup (non-blocking)
- Template versioning: changes shouldn't affect in-flight onboardings

## Design Considerations

- Wizard should feel guided but not restrictive
- Progress should be visible at all times
- Skip steps where appropriate (not all steps required for all customers)
- Mobile-friendly for on-the-go CSMs
- Celebration moments for milestone completion
- Error recovery: never lose entered data

## Success Metrics

- Average onboarding time reduced by 60%
- 95% of onboardings completed within 14 days
- Contract parsing accuracy >90% for standard contracts
- CSM satisfaction with onboarding process >4.5/5
- Time to first value (kickoff meeting) <5 business days

## Open Questions

- Should customers be able to self-onboard via portal?
- How to handle contract amendments during onboarding?
- Should onboarding milestones affect health score?
- How to handle multi-contract customers (parent/child)?
