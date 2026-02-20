# PRD-10: Security Hardening

**Status**: In Progress (90%)
**Priority**: P0 - Critical
**Last Updated**: 2026-02-20

---

## Goal

Comprehensive security posture: authentication hardening, authorization boundaries, data protection, audit logging, and vulnerability prevention.

---

## Implementation Progress

### Completed Items

| Item | Status | Notes |
|------|--------|-------|
| JWT authentication (Supabase Auth) | Done | Google OAuth 2.0 with PKCE |
| RBAC (role-based access control) | Done | member, admin, owner roles |
| Organization/workspace filtering | Done | orgFilter middleware on all routes |
| Helmet security headers | Done | Configured in Express server |
| CORS whitelist | Done | Allowed origins configured |
| Zod input validation | Done | All API inputs validated |
| Audit logging (agent actions) | Done | AuditLogService with Supabase + in-memory fallback |
| Row Level Security (RLS) | Done | Enabled on all Supabase tables |
| Rate limiting | Done | In-memory rate limiter on auth endpoints |
| npm audit in CI | Done | Security audit job in GitHub Actions CI pipeline |
| Dependabot | Done | Weekly npm updates + monthly GitHub Actions updates |
| Auth event logging | Done | Login success/failure, token refresh, logout, invite events |

### Remaining Items

| Item | Status | Notes |
|------|--------|-------|
| Penetration testing | Not Started | Requires external security audit |
| File upload validation review | Not Started | Validate file types, size limits, content scanning |

---

## Requirements

### Authentication Security

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-1 | Google OAuth 2.0 with PKCE flow | Done |
| FR-2 | Session tokens with secure cookie settings (HttpOnly, Secure, SameSite) | Done |
| FR-3 | Session expiry: 24 hours idle, 7 days maximum | Done |
| FR-4 | Invite code rate limiting: 10 attempts per minute | Done |
| FR-5 | Failed login tracking and lockout after 5 failures | Partial |
| FR-6 | Secure logout: invalidate all sessions | Done |

---

### Authorization Boundaries

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-7 | All API endpoints require authentication (except /health/*) | Done |
| FR-8 | Workspace isolation: users only access their workspace data | Done |
| FR-9 | Role-based access: member, admin, owner | Done |
| FR-10 | Admin endpoints require admin role | Done |
| FR-11 | RLS (Row Level Security) on all Supabase tables | Done |
| FR-12 | Service key usage only in server-side code | Done |

### Role Permissions

| Role | Permissions |
|------|-------------|
| member | Read/write own data, view customer data, submit tickets |
| admin | All member + view all workspace data, manage users, access admin dashboard |
| owner | All admin + delete workspace, manage billing |

---

### Data Protection

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-13 | All data encrypted at rest (Supabase default) | Done |
| FR-14 | All data encrypted in transit (HTTPS only) | Done |
| FR-15 | PII minimization: only store necessary data | Done |
| FR-16 | No PII in logs (mask email, names in log output) | Done |
| FR-17 | Secure file upload: validate file types, size limits | Not Started |
| FR-18 | Contract files stored with signed URLs (time-limited access) | Done |

### PII Fields to Protect

- User email addresses
- User names
- Customer contact information
- Contract details
- Support ticket content

---

### Input Validation

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-19 | All API inputs validated with Zod schemas | Done |
| FR-20 | SQL injection prevention (parameterized queries via Supabase) | Done |
| FR-21 | XSS prevention (React escaping + CSP headers) | Done |
| FR-22 | File upload validation: type, size, content scanning | Not Started |
| FR-23 | URL validation for external links | Done |
| FR-24 | UUID validation for all ID parameters | Done |

### Content Security Policy

```typescript
const cspHeader = {
  'default-src': "'self'",
  'script-src': "'self' 'unsafe-inline' https://accounts.google.com",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: https:",
  'connect-src': "'self' https://*.supabase.co https://api.anthropic.com",
  'frame-src': "https://accounts.google.com",
  'object-src': "'none'",
  'base-uri': "'self'"
};
```

---

### Audit Logging

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-25 | Log all authentication events (login, logout, failures) | Done |
| FR-26 | Log all authorization failures | Done |
| FR-27 | Log admin actions (user management, config changes) | Done |
| FR-28 | Log data access patterns (bulk exports, sensitive queries) | Partial |
| FR-29 | Audit logs immutable (append-only) | Done |
| FR-30 | Audit log retention: 90 days minimum | Done |

### Auth Event Audit Actions (added 2026-02-20)

The following audit actions are now tracked in `server/src/services/auditLog.ts`:

- `auth_login_success` — Successful login via invite redemption or admin provisioning
- `auth_login_failure` — Failed login (invalid invite code, unauthorized admin, expired token)
- `auth_token_refresh` — Session validation via `/api/auth/session`
- `auth_logout` — User logout
- `auth_invite_validated` — Invite code validated successfully
- `auth_invite_redeemed` — Invite code redeemed, user added to workspace
- `auth_admin_provisioned` — Admin user auto-provisioned

All audit log calls are non-blocking (fire-and-forget with `.catch(() => {})`) to avoid impacting auth response times.

### Audit Log Schema

```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL,  -- 'auth.login', 'auth.logout', 'admin.user_added', etc.
  actor_id UUID REFERENCES public.users(id),
  actor_email TEXT,
  workspace_id UUID REFERENCES public.workspaces(id),
  resource_type TEXT,  -- 'user', 'customer', 'contract', etc.
  resource_id UUID,
  action TEXT,  -- 'create', 'read', 'update', 'delete'
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true
);

-- Immutable: no UPDATE or DELETE allowed via RLS
CREATE POLICY "audit_logs_insert_only" ON public.audit_logs
  FOR INSERT WITH CHECK (true);
-- No UPDATE or DELETE policies = immutable
```

---

### API Security

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-31 | Rate limiting: 100 req/min general, 10/min auth | Done |
| FR-32 | Request size limits: 10MB max body | Done |
| FR-33 | API versioning for breaking changes | Partial |
| FR-34 | CORS: whitelist allowed origins | Done |
| FR-35 | Security headers: HSTS, X-Frame-Options, X-Content-Type-Options | Done |

### Security Headers

```typescript
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
```

---

### Secret Management

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-36 | All secrets in Google Secret Manager (not env files) | Done |
| FR-37 | No secrets in code or git history | Done |
| FR-38 | Secret rotation capability for API keys | Partial |
| FR-39 | Separate secrets per environment (staging/production) | Done |

### Required Secrets

| Secret | Purpose |
|--------|---------|
| SUPABASE_URL | Database connection |
| SUPABASE_ANON_KEY | Client-side Supabase access |
| SUPABASE_SERVICE_KEY | Server-side Supabase access |
| GOOGLE_CLIENT_ID | OAuth authentication |
| GOOGLE_CLIENT_SECRET | OAuth authentication |
| ANTHROPIC_API_KEY | Claude API access |
| OPENAI_API_KEY | Embeddings API access |
| SESSION_SECRET | Session encryption |

---

### Dependency Security

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-40 | Weekly `npm audit` scans | Done |
| FR-41 | No high/critical vulnerabilities in production | Done |
| FR-42 | Dependabot or similar for automated updates | Done |
| FR-43 | Lock file (package-lock.json) committed | Done |

---

## Security Checklist

### Pre-Launch

- [x] All RLS policies enabled and tested
- [x] Authentication flow verified
- [x] Authorization boundaries verified
- [x] Input validation on all endpoints
- [x] Security headers configured
- [x] Audit logging active
- [x] Secrets in Secret Manager
- [x] No secrets in git history
- [x] npm audit in CI pipeline
- [x] HTTPS enforced everywhere
- [x] Dependabot configured
- [x] Auth event audit logging
- [ ] Authentication flow penetration tested
- [ ] File upload validation review

### Ongoing

- [x] Weekly dependency audits (Dependabot)
- [ ] Monthly security review
- [ ] Quarterly penetration testing
- [ ] Annual security audit

---

## Test Plan

### Authentication Tests
- OAuth flow completes successfully
- Invalid tokens rejected
- Session expiry enforced
- Logout invalidates session

### Authorization Tests
- Workspace isolation verified
- Role permissions enforced
- Admin endpoints protected
- RLS policies tested

### Input Validation Tests
- SQL injection attempts blocked
- XSS attempts blocked
- Invalid file types rejected
- Malformed UUIDs rejected

### Security Header Tests
- All security headers present
- CSP properly configured
- CORS whitelist enforced

---

## Definition of Done

- [x] OAuth with PKCE implemented
- [x] Session security configured
- [x] RLS on all tables
- [x] Role-based access enforced
- [x] Audit logging active
- [x] Security headers configured
- [x] Input validation on all endpoints
- [x] npm audit in CI
- [x] Secrets in Secret Manager
- [x] Auth event logging
- [ ] Security tests passing (partial)
- [ ] Penetration test completed
- [x] Deployed to staging/production
