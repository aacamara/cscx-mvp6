# PRD-7: Production Readiness Hardening

**Status**: 🔴 Not Started
**Priority**: P0 - Critical
**Last Updated**: 2026-02-01

---

## Goal

Make all core flows work end-to-end in production with robust reliability and UX.

---

## Core Flows to Verify

| Flow | Status |
|------|--------|
| Login (Google OAuth) | 🔴 |
| Invite code validation | 🔴 |
| First-run onboarding | 🔴 |
| Chat send/receive | 🔴 |
| KB document ingestion | 🔴 |
| KB search/retrieval | 🔴 |
| Customer import (Sheets/CSV) | 🔴 |
| Contract upload + parse | 🔴 |
| Entitlement HITL review | 🔴 |
| Email draft + approval | 🔴 |
| QBR generation | 🔴 |
| Agent Inbox approve/reject | 🔴 |
| Support ticket submission | 🔴 |
| Admin dashboard access | 🔴 |

---

## Requirements

| Req ID | Requirement |
|--------|-------------|
| FR-1 | All core flows work E2E without errors |
| FR-2 | User-friendly error messages (no stack traces) |
| FR-3 | Loading states for all async operations |
| FR-4 | Input validation on all API endpoints |
| FR-5 | Rate limiting: 100 req/min per user for API, 10/min for auth |
| FR-6 | Job reliability: 3 retries with exponential backoff |
| FR-7 | Idempotency keys for critical operations |
| FR-8 | Failed jobs tracked with retry capability |
| FR-9 | Database migrations are reversible |
| FR-10 | Deployments are repeatable (infra as code) |
| FR-11 | Performance: P95 API latency < 2s, Chat response < 5s |

---

## Error Handling Standards

### API Errors
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Customer name is required",
    "details": [
      { "field": "name", "message": "Required field" }
    ]
  }
}
```

### HTTP Status Codes
- 400: Validation errors
- 401: Not authenticated
- 403: Not authorized
- 404: Resource not found
- 429: Rate limited
- 500: Internal error (logged, generic message to user)

### Frontend Error Display
- Toast notifications for transient errors
- Inline errors for form validation
- Full-page error for critical failures with "Try Again" button

---

## Rate Limiting Configuration

```typescript
// Express rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  keyGenerator: (req) => req.user?.id || req.ip
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 auth attempts per minute
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts' } }
});
```

---

## Job Reliability

### Retry Configuration
```typescript
const jobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000 // 1s, 2s, 4s
  },
  removeOnComplete: 100, // Keep last 100 completed
  removeOnFail: 1000 // Keep last 1000 failed for debugging
};
```

### Dead Letter Queue
- Failed jobs after all retries go to DLQ
- Admin can view and retry from DLQ
- Alert on DLQ depth > 10

---

## Input Validation

All API endpoints must:
1. Use Zod schemas for request validation
2. Sanitize string inputs (trim, max length)
3. Validate UUIDs, dates, numbers
4. Reject unknown fields

```typescript
const createCustomerSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  arr: z.number().min(0).max(1000000000).optional(),
  renewal_date: z.string().datetime().optional(),
  // No .passthrough() - reject unknown fields
});
```

---

## Performance Budgets

| Metric | Target | Alert |
|--------|--------|-------|
| API P95 latency | < 2s | > 3s |
| Chat response | < 5s | > 10s |
| Page load | < 3s | > 5s |
| KB indexing | < 60s per doc | > 120s |
| Contract parsing | < 30s | > 60s |

---

## Test Plan

- E2E tests for all 14 core flows
- Load testing: 100 concurrent users
- Error injection testing
- Rate limit verification
- Job failure + retry testing

---

## Definition of Done

- [ ] All core flows working E2E
- [ ] Error handling implemented consistently
- [ ] Rate limiting active
- [ ] Job reliability (retries, DLQ)
- [ ] Input validation on all endpoints
- [ ] Performance within budgets
- [ ] All tests passing
- [ ] Deployed to staging and production
