# PRD-7: Production Readiness Hardening

**Status**: In Progress (85%)
**Priority**: P0 - Critical
**Last Updated**: 2026-02-20

---

## Goal

Make all core flows work end-to-end in production with robust reliability and UX.

---

## Implementation Progress

| Area | Status | Notes |
|------|--------|-------|
| Error handling | Completed | Consistent API error format, toast notifications, inline validation |
| Rate limiting | Completed | 100 req/min API, 10/min auth via express-rate-limit |
| Input validation | Completed | Zod schemas on all API endpoints |
| Health checks | Completed | `/api/health` endpoint with DB connectivity check |
| Metrics | Completed | Request duration, error rates, endpoint-level tracking |
| Circuit breakers | Completed | External service calls wrapped with circuit breaker pattern |
| Job queue / DLQ | Not implemented | Retry logic exists but no formal DLQ or admin DLQ viewer |
| Loading states | Partial | Most async views have loading spinners; some edge cases remain |

---

## Core Flows to Verify

| Flow | Status |
|------|--------|
| Login (Google OAuth) | Functional (Demo Mode verified) |
| Invite code validation | Functional |
| First-run onboarding | Functional |
| Chat send/receive | Functional |
| KB document ingestion | Functional |
| KB search/retrieval | Functional |
| Customer import (Sheets/CSV) | Functional |
| Contract upload + parse | Functional |
| Entitlement HITL review | Functional |
| Email draft + approval | Functional |
| QBR generation | Functional |
| Agent Inbox approve/reject | Functional |
| Support ticket submission | Functional |
| Admin dashboard access | Functional |

**E2E Verification Script**: `scripts/verify-core-flows.py` (Playwright-based, 8 automated flows)

---

## Requirements

| Req ID | Requirement | Status |
|--------|-------------|--------|
| FR-1 | All core flows work E2E without errors | In Progress |
| FR-2 | User-friendly error messages (no stack traces) | Completed |
| FR-3 | Loading states for all async operations | Partial |
| FR-4 | Input validation on all API endpoints | Completed |
| FR-5 | Rate limiting: 100 req/min per user for API, 10/min for auth | Completed |
| FR-6 | Job reliability: 3 retries with exponential backoff | Completed |
| FR-7 | Idempotency keys for critical operations | Completed |
| FR-8 | Failed jobs tracked with retry capability | Not started (DLQ) |
| FR-9 | Database migrations are reversible | Completed |
| FR-10 | Deployments are repeatable (infra as code) | Completed |
| FR-11 | Performance: P95 API latency < 2s, Chat response < 5s | Completed |

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
- **Status**: Not yet implemented -- retry logic exists but formal DLQ is a remaining gap

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
- **Automated verification**: `scripts/verify-core-flows.py` (8 Playwright flows)
- Load testing: 100 concurrent users
- Error injection testing
- Rate limit verification
- Job failure + retry testing

---

## Remaining Gaps

1. **Job Queue / DLQ**: No formal dead-letter queue or admin DLQ viewer. Retry logic is present but exhausted retries are not routed to a DLQ.
2. **Loading States**: Most views have loading indicators, but some edge cases (error recovery states, long-running agent operations) still lack explicit loading feedback.

---

## Definition of Done

- [x] Error handling implemented consistently
- [x] Rate limiting active
- [x] Input validation on all endpoints
- [x] Health checks operational
- [x] Metrics collection active
- [x] Circuit breakers on external services
- [ ] All core flows working E2E (in progress -- 85% verified)
- [ ] Job reliability with DLQ (retries done, DLQ not implemented)
- [ ] Loading states for all async operations (partial)
- [ ] Performance within budgets (monitoring in place)
- [ ] All tests passing
- [ ] Deployed to staging and production
