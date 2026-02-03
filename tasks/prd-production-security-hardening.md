# PRD: Production Security Hardening

## Introduction

Enable Row Level Security (RLS) and enforce authentication to make CSCX safe for multi-tenant production use with 100+ users. This is a **CRITICAL BLOCKER** - without this, any user can see any customer's data.

## Goals

- Enable RLS on all database tables
- Enforce JWT authentication on all API routes
- Add user_id to key tables for ownership tracking
- Remove demo user fallbacks in production
- Implement proper session persistence

## User Stories

### US-001: Enable RLS on customers table
**Description:** As a CSM, I should only see customers assigned to me.

**Acceptance Criteria:**
- [ ] Add `csm_user_id UUID REFERENCES auth.users(id)` column to customers table
- [ ] Enable RLS: `ALTER TABLE customers ENABLE ROW LEVEL SECURITY`
- [ ] Create policy: users see only their assigned customers
- [ ] Create admin policy: admins see all customers
- [ ] Run `npx tsc --noEmit` - exits with code 0
- [ ] Test: User A cannot see User B's customers

### US-002: Enable RLS on contracts table
**Description:** As a CSM, I should only see contracts for my customers.

**Acceptance Criteria:**
- [ ] Enable RLS on contracts table
- [ ] Create policy: contracts visible only if customer is assigned to user
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-003: Enable RLS on agent_sessions table
**Description:** As a CSM, I should only see my own chat sessions.

**Acceptance Criteria:**
- [ ] Ensure user_id column is NOT NULL
- [ ] Enable RLS on agent_sessions table
- [ ] Create policy: sessions visible only to owner
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-004: Enable RLS on tasks table
**Description:** As a CSM, I should only see tasks for my customers.

**Acceptance Criteria:**
- [ ] Add user_id or link through customer_id
- [ ] Enable RLS on tasks table
- [ ] Create policy for task visibility
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-005: Enforce JWT authentication
**Description:** As a system, all API calls must have valid JWT tokens.

**Acceptance Criteria:**
- [ ] Remove `x-user-id` header fallback in authMiddleware
- [ ] Return 401 for missing/invalid tokens (not 200 with demo user)
- [ ] Test: API call without token returns 401
- [ ] Test: API call with invalid token returns 401
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-006: Remove demo user fallback
**Description:** As a system, demo users should not exist in production.

**Acceptance Criteria:**
- [ ] Remove hardcoded demo user ID from auth middleware
- [ ] Add environment check: only allow demo in NODE_ENV=development
- [ ] Test: Production mode rejects unauthenticated requests
- [ ] Run `npx tsc --noEmit` - exits with code 0

### US-007: Create database migration
**Description:** As a developer, security changes should be in a migration file.

**Acceptance Criteria:**
- [ ] Create `database/migrations/020_enable_rls.sql`
- [ ] Include all RLS enables and policies
- [ ] Include rollback comments
- [ ] Migration applies cleanly on fresh database
- [ ] Run `npx tsc --noEmit` - exits with code 0

## Functional Requirements

- FR-1: All tables containing user data must have RLS enabled
- FR-2: Policies must use `auth.uid()` for user identification
- FR-3: Admin role can bypass RLS for support purposes
- FR-4: Failed auth must return 401, not fall back to demo
- FR-5: All changes must be backwards compatible with existing data

## Non-Goals

- No RBAC implementation (separate PRD)
- No user profile management (separate PRD)
- No audit logging changes (already exists)

## Technical Considerations

- Supabase RLS uses `auth.uid()` function
- Existing data needs user_id backfilled (set to first admin)
- Test with both authenticated and unauthenticated requests
- Consider service role key for background jobs

## Success Metrics

- 0 cross-tenant data leaks in security audit
- 100% of API calls require valid JWT
- All 15+ tables have RLS enabled
