# PRD: Onboarding Data Persistence

## Overview
Ensure all customer data collected during onboarding is properly saved to the database and available for agent use.

## Problem Statement
When a new customer is onboarded through the workflow:
1. Contract data may not be persisted correctly
2. Stakeholder information entered in forms may be lost
3. Initial health scores aren't calculated and saved
4. Onboarding milestones aren't tracked
5. Agents can't access onboarding history for context

## User Stories

### US-001: Save contract data on upload
- When contract is uploaded and parsed, save to contracts table
- Store: customer_id, contract_value, start_date, end_date, terms
- Save parsed line items to contract_items table
- Link contract to customer record
- Typecheck passes

### US-002: Save stakeholders from onboarding form
- Create or update stakeholders when entered in onboarding
- Save: name, email, title, role, phone, linkedin_url
- Mark primary_contact flag appropriately
- Create customer_stakeholders junction if needed
- Typecheck passes

### US-003: Calculate and save initial health score
- After onboarding complete, calculate initial health score
- Use baseline metrics: contract value, stakeholder count, engagement signals
- Save to health_scores table with component breakdown
- Set initial score as baseline for trend tracking
- Typecheck passes

### US-004: Track onboarding milestones
- Create onboarding_milestones table if not exists
- Track: kickoff_completed, training_scheduled, first_login, adoption_milestone
- Save timestamps for each milestone
- Calculate days_to_milestone for reporting
- Typecheck passes

### US-005: Create customer timeline entry
- After onboarding, create timeline entry in agent_activities
- Record: customer created, contract uploaded, stakeholders added
- Include metadata about onboarding source (manual, import, etc.)
- Make available to agents for context
- Typecheck passes

### US-006: Verify data persistence in onboarding flow
- Add logging to track data save operations
- Ensure all form submissions trigger database writes
- Handle partial saves gracefully (resume capability)
- Show success indicators in UI after each save
- Typecheck passes

## Acceptance Criteria
1. All contract data from upload is saved and retrievable
2. Stakeholders added during onboarding appear in customer detail
3. New customers have initial health score calculated
4. Onboarding milestones are tracked with timestamps
5. Agents can reference onboarding history in conversations

## Priority
P2 - Important for data integrity

## Dependencies
- Onboarding flow working
- Database tables exist
- Contract parsing functional
