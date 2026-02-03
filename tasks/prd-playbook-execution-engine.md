# PRD: Playbook Execution Engine

## Introduction

The Playbook Execution Engine enables CSMs to create, manage, and execute templated workflows for common Customer Success scenarios. Playbooks are reusable sequences of actions (emails, meetings, tasks, agent invocations) that trigger based on conditions (time-based, event-based, health score thresholds) and execute with HITL approval gates.

This addresses the gap between ad-hoc agent interactions and fully automated processes, giving CSMs structured, repeatable workflows while maintaining human oversight.

## Goals

- Enable creation of reusable playbook templates for common CS scenarios
- Support trigger conditions (time-based, event-based, threshold-based)
- Execute playbook steps with appropriate HITL approval gates
- Track playbook execution progress and outcomes
- Measure playbook effectiveness (completion rates, time saved, outcomes)
- Allow playbook sharing across the CSM team

## User Stories

### US-001: Create playbook template
**Description:** As a CSM, I want to create a playbook template so that I can standardize workflows for common scenarios.

**Acceptance Criteria:**
- [ ] Playbook builder UI with name, description, trigger conditions
- [ ] Add steps: email, meeting, task, wait, condition, agent action
- [ ] Configure step parameters (templates, recipients, delays)
- [ ] Set approval requirements per step (auto-approve, require approval)
- [ ] Save playbook as draft or publish
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Define playbook triggers
**Description:** As a CSM, I want to define when playbooks should trigger so that they activate at the right moments.

**Acceptance Criteria:**
- [ ] Time-based triggers (X days before renewal, X days after onboarding start)
- [ ] Event-based triggers (risk signal detected, health score drop, champion left)
- [ ] Manual triggers (CSM initiates for specific customer)
- [ ] Condition-based triggers (health score < 60, usage drop > 20%)
- [ ] Multiple triggers per playbook supported
- [ ] Typecheck passes

### US-003: Execute playbook for customer
**Description:** As a CSM, I want to execute a playbook for a specific customer so that the workflow runs automatically.

**Acceptance Criteria:**
- [ ] Start playbook from customer detail page
- [ ] Preview playbook steps before execution
- [ ] Variable substitution (customer name, CSM name, renewal date, etc.)
- [ ] Execution creates pending approvals for steps requiring approval
- [ ] Real-time progress tracking in UI
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Track playbook progress
**Description:** As a CSM, I want to see the progress of active playbooks so that I know what's completed and what's pending.

**Acceptance Criteria:**
- [ ] Active playbooks panel in customer detail
- [ ] Step-by-step progress indicator (completed, pending, waiting, failed)
- [ ] Time elapsed and estimated completion
- [ ] Ability to pause/resume/cancel playbook
- [ ] View step outputs (sent emails, scheduled meetings)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Playbook analytics dashboard
**Description:** As a CS leader, I want to see playbook performance metrics so that I can optimize our workflows.

**Acceptance Criteria:**
- [ ] Playbook usage (executions per playbook)
- [ ] Completion rates (% completed vs abandoned)
- [ ] Average execution time per playbook
- [ ] Step failure rates (which steps fail most)
- [ ] Outcome correlation (playbook completion vs retention)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Pre-built playbook library
**Description:** As a CSM, I want access to pre-built playbooks so that I can quickly adopt best practices.

**Acceptance Criteria:**
- [ ] Onboarding playbook (kickoff → training → 30-day check-in → 60-day review)
- [ ] At-risk playbook (detection → outreach → escalation → save plan)
- [ ] Renewal playbook (90-day prep → QBR → proposal → negotiation → close)
- [ ] Expansion playbook (opportunity identified → demo → proposal → close)
- [ ] Import pre-built playbooks from library
- [ ] Customize pre-built playbooks for team
- [ ] Typecheck passes

### US-007: Playbook step: Agent action
**Description:** As a CSM, I want playbook steps to invoke specialist agents so that AI handles complex reasoning.

**Acceptance Criteria:**
- [ ] Step type: "Agent Action" with agent selector
- [ ] Pass context to agent (customer data, playbook state)
- [ ] Agent output stored as step result
- [ ] Agent-generated actions go through normal HITL flow
- [ ] Support for all 5 specialist agents
- [ ] Typecheck passes

### US-008: Playbook branching and conditions
**Description:** As a CSM, I want playbooks to branch based on conditions so that workflows adapt to customer responses.

**Acceptance Criteria:**
- [ ] Condition step with if/else branches
- [ ] Conditions: health score, response received, meeting held, time elapsed
- [ ] Branch visualization in playbook builder
- [ ] Branch tracking in execution view
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Playbook templates stored in `playbooks` table with steps as JSONB
- FR-2: Playbook executions tracked in `playbook_executions` table with status
- FR-3: Step executions tracked in `playbook_step_executions` with inputs/outputs
- FR-4: Triggers evaluated by background job (every 5 minutes for time-based)
- FR-5: Event triggers processed via webhook from other system events
- FR-6: Variable substitution uses Handlebars-style syntax ({{customer.name}})
- FR-7: Steps with `require_approval: true` create entries in `approvals` table
- FR-8: Playbook pause/resume preserves state for continuation
- FR-9: Playbook cancellation marks remaining steps as skipped
- FR-10: Agent actions use existing agent orchestrator with playbook context

## Non-Goals

- No visual flowchart builder (use linear step list with conditions)
- No cross-customer playbooks (each execution is single-customer)
- No playbook versioning (edit in place, executions use snapshot)
- No playbook marketplace (internal library only)
- No external webhook triggers (only internal events)

## Technical Considerations

- Reuse existing approval system for step approvals
- Leverage WebSocket for real-time execution updates
- Background job service for trigger evaluation (consider Bull queue)
- Store step snapshots to handle playbook edits during execution
- Index playbook_executions by customer_id and status for quick lookups

## Design Considerations

- Playbook builder should feel like building an automation (simple, linear)
- Progress tracker should show clear visual progression
- Pre-built playbooks should be discoverable and easy to customize
- Integrate playbook panel into existing customer detail layout

## Success Metrics

- 80% of CSMs create or use at least one playbook within 30 days
- Average playbook completion rate > 70%
- Time to complete renewal process reduced by 40%
- CSM time spent on repetitive tasks reduced by 50%

## Open Questions

- Should playbooks support parallel step execution?
- How to handle playbook conflicts (two playbooks triggered for same customer)?
- Should we allow playbook nesting (playbook step that runs another playbook)?
