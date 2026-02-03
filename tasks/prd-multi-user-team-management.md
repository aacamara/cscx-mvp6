# PRD: Multi-User & Team Management

## Introduction

Multi-User & Team Management enables organizations to have multiple CSMs, managers, and admins using CSCX with appropriate role-based permissions, team structures, and account assignments. This transforms CSCX from a single-user tool to a scalable team platform with proper access controls, workload distribution, and collaboration features.

This addresses the core requirement of supporting CS teams of any size with proper governance and visibility controls.

## Goals

- Support unlimited users per organization with role-based access
- Enable team hierarchies (CSM → Manager → VP → Admin)
- Manage account assignments and ownership
- Provide team collaboration features (mentions, handoffs)
- Audit all user actions for compliance
- Scale to support teams of 100+ CSMs

## User Stories

### US-001: User invitation and onboarding
**Description:** As an admin, I want to invite team members so that they can access CSCX.

**Acceptance Criteria:**
- [ ] Invite users via email with role assignment
- [ ] Magic link or SSO-based first login
- [ ] Welcome flow with role-specific guidance
- [ ] Invite status tracking (pending, accepted, expired)
- [ ] Bulk invite via CSV upload
- [ ] Re-send invitation option
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Role-based permissions
**Description:** As an admin, I want to assign roles with specific permissions so that users have appropriate access.

**Acceptance Criteria:**
- [ ] Predefined roles: Admin, VP/Manager, CSM, Read-only
- [ ] Admin: Full access, user management, settings
- [ ] VP/Manager: Team portfolio view, all reports, read-only other teams
- [ ] CSM: Own accounts only, agent access, approvals
- [ ] Read-only: View dashboards and reports, no actions
- [ ] Role displayed in user profile
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Team hierarchy structure
**Description:** As an admin, I want to create team hierarchies so that managers see their team's accounts.

**Acceptance Criteria:**
- [ ] Create teams with name and manager assignment
- [ ] Assign CSMs to teams
- [ ] Nested teams (sub-teams under parent teams)
- [ ] Manager sees all accounts of team members
- [ ] VP sees all teams in their organization
- [ ] Team selector in navigation
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Account ownership assignment
**Description:** As a manager, I want to assign accounts to CSMs so that ownership is clear.

**Acceptance Criteria:**
- [ ] Assign primary CSM to each customer
- [ ] Optional secondary CSM (backup)
- [ ] Bulk reassignment (select multiple, assign to new CSM)
- [ ] Assignment history tracking
- [ ] Handoff notes when reassigning
- [ ] Email notification on assignment
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: User activity audit log
**Description:** As an admin, I want to see user activity logs so that I can audit actions.

**Acceptance Criteria:**
- [ ] Log all user actions (login, view, edit, approve, etc.)
- [ ] Filter by user, action type, date range
- [ ] Export audit log (CSV)
- [ ] Retention: 12 months minimum
- [ ] Search by customer or action
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: SSO integration
**Description:** As an admin, I want SSO login so that users authenticate with company credentials.

**Acceptance Criteria:**
- [ ] SAML 2.0 SSO configuration
- [ ] Google Workspace SSO
- [ ] Microsoft Azure AD SSO
- [ ] Auto-provisioning (create user on first SSO login)
- [ ] Role mapping from SSO groups
- [ ] Force SSO (disable email login)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: User profile and preferences
**Description:** As a CSM, I want to customize my profile so that my settings persist.

**Acceptance Criteria:**
- [ ] Profile: name, photo, title, phone
- [ ] Email signature for agent-drafted emails
- [ ] Notification preferences (email, in-app)
- [ ] Default dashboard view
- [ ] Timezone setting
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Team collaboration mentions
**Description:** As a CSM, I want to mention colleagues so that I can collaborate on accounts.

**Acceptance Criteria:**
- [ ] @mention in notes and comments
- [ ] Mention autocomplete with team members
- [ ] Notification sent to mentioned user
- [ ] Mention links to user profile
- [ ] View all mentions in notification center
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Account handoff workflow
**Description:** As a manager, I want a structured handoff process so that account transitions are smooth.

**Acceptance Criteria:**
- [ ] Initiate handoff from customer detail
- [ ] Handoff checklist (required steps before transfer)
- [ ] Handoff notes field (context for new CSM)
- [ ] Previous CSM retains read-only access for 30 days
- [ ] Notification to customer stakeholders (optional)
- [ ] Handoff history visible in customer timeline
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: User deactivation
**Description:** As an admin, I want to deactivate users so that former employees lose access.

**Acceptance Criteria:**
- [ ] Deactivate user (soft delete, preserves history)
- [ ] Reassign accounts before deactivation required
- [ ] Deactivation blocks login immediately
- [ ] Sessions invalidated on deactivation
- [ ] Reactivation option for returning employees
- [ ] Export user data before deletion (GDPR)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Permission-based feature access
**Description:** As an admin, I want to control feature access by role so that users see appropriate functionality.

**Acceptance Criteria:**
- [ ] Agent access toggleable per role
- [ ] Executive dashboard requires VP+ role
- [ ] Settings pages require Admin role
- [ ] Approval authority configurable per role
- [ ] Feature flags per team/role
- [ ] Typecheck passes

### US-012: My accounts view
**Description:** As a CSM, I want to see only my accounts so that I focus on my portfolio.

**Acceptance Criteria:**
- [ ] Default view shows assigned accounts only
- [ ] Toggle to see team accounts (read-only)
- [ ] "All accounts" view for managers/admins
- [ ] Account count in navigation
- [ ] Filter by assignment status
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Users stored in `users` table with org_id, role, team_id, status
- FR-2: Teams stored in `teams` table with parent_team_id for hierarchy
- FR-3: Account assignments in `customer_assignments` with user_id, customer_id, role (primary/secondary)
- FR-4: Audit log in `audit_log` with user_id, action, resource_type, resource_id, timestamp
- FR-5: Invitations in `invitations` with token, email, role, expires_at
- FR-6: SSO configuration in `sso_configs` with provider, settings, org_id
- FR-7: Row-level security policies in database based on user role and team
- FR-8: Session management with JWT tokens, 24-hour expiry
- FR-9: Notification preferences in `user_preferences` JSONB field
- FR-10: Handoff records in `account_handoffs` with from_user, to_user, notes, checklist

## Non-Goals

- No custom role builder (predefined roles sufficient for v1)
- No cross-organization access (each org is isolated)
- No API keys per user (organization-level API keys only)
- No delegation (user A acting as user B)
- No time-based access (temporary permissions)

## Technical Considerations

- Row-level security in Supabase for data isolation
- Session invalidation requires token blacklist or short expiry
- SSO metadata parsing varies by provider; use library like passport-saml
- Audit log can grow large; implement retention policy and archival
- Team hierarchy queries can be slow; consider materialized paths
- Consider caching user permissions to avoid repeated DB lookups

## Design Considerations

- Role indicators should be subtle but visible
- Navigation should adapt to user role (hide inaccessible items)
- User switcher for admins testing as other roles
- Clear visual distinction between "my accounts" and "team accounts"
- Invitation emails should be well-designed (first impression)

## Success Metrics

- User onboarding time <5 minutes from invite to first login
- 100% of accounts have assigned CSM
- Audit log queries return in <2 seconds
- SSO adoption >90% for organizations with SSO configured
- Zero unauthorized access incidents

## Open Questions

- Should we support custom roles in the future?
- How to handle CSMs in multiple teams?
- Should account assignment history affect analytics attribution?
- What happens to agent sessions when user is deactivated?
