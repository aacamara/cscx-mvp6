# PRD-10: Security Hardening

**Status**: 🔴 Not Started
**Priority**: P0 - Critical
**Last Updated**: 2026-02-01

---

## Goal

Comprehensive security posture: authentication hardening, authorization boundaries, data protection, audit logging, and vulnerability prevention.

---

## Requirements

### Authentication Security

| Req ID | Requirement |
|--------|-------------|
| FR-1 | Google OAuth 2.0 with PKCE flow |
| FR-2 | Session tokens with secure cookie settings (HttpOnly, Secure, SameSite) |
| FR-3 | Session expiry: 24 hours idle, 7 days maximum |
| FR-4 | Invite code rate limiting: 10 attempts per minute |
| FR-5 | Failed login tracking and lockout after 5 failures |
| FR-6 | Secure logout: invalidate all sessions |

---

### Authorization Boundaries

| Req ID | Requirement |
|--------|-------------|
| FR-7 | All API endpoints require authentication (except /health/*) |
| FR-8 | Workspace isolation: users only access their workspace data |
| FR-9 | Role-based access: member, admin, owner |
| FR-10 | Admin endpoints require admin role |
| FR-11 | RLS (Row Level Security) on all Supabase tables |
| FR-12 | Service key usage only in server-side code |

### Role Permissions

| Role | Permissions |
|------|-------------|
| member | Read/write own data, view customer data, submit tickets |
| admin | All member + view all workspace data, manage users, access admin dashboard |
| owner | All admin + delete workspace, manage billing |

---

### Data Protection

| Req ID | Requirement |
|--------|-------------|
| FR-13 | All data encrypted at rest (Supabase default) |
| FR-14 | All data encrypted in transit (HTTPS only) |
| FR-15 | PII minimization: only store necessary data |
| FR-16 | No PII in logs (mask email, names in log output) |
| FR-17 | Secure file upload: validate file types, size limits |
| FR-18 | Contract files stored with signed URLs (time-limited access) |

### PII Fields to Protect

- User email addresses
- User names
- Customer contact information
- Contract details
- Support ticket content

---

### Input Validation

| Req ID | Requirement |
|--------|-------------|
| FR-19 | All API inputs validated with Zod schemas |
| FR-20 | SQL injection prevention (parameterized queries via Supabase) |
| FR-21 | XSS prevention (React escaping + CSP headers) |
| FR-22 | File upload validation: type, size, content scanning |
| FR-23 | URL validation for external links |
| FR-24 | UUID validation for all ID parameters |

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

| Req ID | Requirement |
|--------|-------------|
| FR-25 | Log all authentication events (login, logout, failures) |
| FR-26 | Log all authorization failures |
| FR-27 | Log admin actions (user management, config changes) |
| FR-28 | Log data access patterns (bulk exports, sensitive queries) |
| FR-29 | Audit logs immutable (append-only) |
| FR-30 | Audit log retention: 90 days minimum |

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

| Req ID | Requirement |
|--------|-------------|
| FR-31 | Rate limiting: 100 req/min general, 10/min auth |
| FR-32 | Request size limits: 10MB max body |
| FR-33 | API versioning for breaking changes |
| FR-34 | CORS: whitelist allowed origins |
| FR-35 | Security headers: HSTS, X-Frame-Options, X-Content-Type-Options |

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

| Req ID | Requirement |
|--------|-------------|
| FR-36 | All secrets in Google Secret Manager (not env files) |
| FR-37 | No secrets in code or git history |
| FR-38 | Secret rotation capability for API keys |
| FR-39 | Separate secrets per environment (staging/production) |

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

| Req ID | Requirement |
|--------|-------------|
| FR-40 | Weekly `npm audit` scans |
| FR-41 | No high/critical vulnerabilities in production |
| FR-42 | Dependabot or similar for automated updates |
| FR-43 | Lock file (package-lock.json) committed |

---

## Security Checklist

### Pre-Launch

- [ ] All RLS policies enabled and tested
- [ ] Authentication flow penetration tested
- [ ] Authorization boundaries verified
- [ ] Input validation on all endpoints
- [ ] Security headers configured
- [ ] Audit logging active
- [ ] Secrets in Secret Manager
- [ ] No secrets in git history
- [ ] npm audit clean (no high/critical)
- [ ] HTTPS enforced everywhere

### Ongoing

- [ ] Weekly dependency audits
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

- [ ] OAuth with PKCE implemented
- [ ] Session security configured
- [ ] RLS on all tables
- [ ] Role-based access enforced
- [ ] Audit logging active
- [ ] Security headers configured
- [ ] Input validation on all endpoints
- [ ] npm audit clean
- [ ] Secrets in Secret Manager
- [ ] Security tests passing
- [ ] Penetration test completed
- [ ] Deployed to staging/production
