# PRD-9: Observability + Ops

**Status**: 🔴 Not Started
**Priority**: P1 - Important
**Last Updated**: 2026-02-01

---

## Goal

Production-grade visibility and operational readiness.

---

## Requirements

### Structured Logging

| Req ID | Requirement |
|--------|-------------|
| FR-1 | All logs include: timestamp, level, request_id, user_id, workspace_id |
| FR-2 | Action-related logs include: action_id |
| FR-3 | JSON format for machine parsing |
| FR-4 | Log levels: debug, info, warn, error |
| FR-5 | No PII in logs (or masked) |
| FR-6 | Logs sent to Cloud Logging |

### Log Format
```json
{
  "timestamp": "2026-02-01T12:00:00.000Z",
  "level": "info",
  "message": "Customer created",
  "requestId": "req-abc123",
  "userId": "user-xyz",
  "workspaceId": "ws-123",
  "actionId": "action-456",
  "customerId": "cust-789",
  "durationMs": 150
}
```

---

### Error Tracking

| Req ID | Requirement |
|--------|-------------|
| FR-7 | Integration with error tracking service (Sentry recommended) |
| FR-8 | Capture stack traces, context, user info |
| FR-9 | Alert on error rate spikes |
| FR-10 | Error grouping by type |

---

### Metrics

| Metric | Type | Description |
|--------|------|-------------|
| api_latency | histogram | Request latency by endpoint |
| api_errors | counter | Errors by endpoint and code |
| api_requests | counter | Total requests by endpoint |
| agent_invocations | counter | Agent calls by agent type |
| agent_latency | histogram | Agent response time |
| agent_tokens | counter | Tokens used by agent |
| job_processing_time | histogram | Job duration by type |
| job_failures | counter | Failed jobs by type |
| kb_ingestion_time | histogram | Document ingestion time |
| kb_ingestion_failures | counter | Failed ingestions |
| contract_parsing_time | histogram | Contract parse time |
| contract_parsing_failures | counter | Failed parses |
| action_approval_time | histogram | Time from proposed to approved |
| ticket_response_time | histogram | Time to first response |

---

### Health Checks

```typescript
// /health/live - Basic liveness (is the process running?)
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// /health/ready - Readiness (can handle traffic?)
app.get('/health/ready', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    anthropic: await checkAnthropic()
  };

  const ready = Object.values(checks).every(c => c.status === 'ok');
  res.status(ready ? 200 : 503).json({
    ready,
    checks,
    timestamp: new Date().toISOString()
  });
});
```

---

### Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| High error rate | > 5% errors for 5 min | Critical |
| High latency | P95 > 5s for 5 min | Warning |
| Job queue depth | > 100 pending for 10 min | Warning |
| Database connection failures | Any failure | Critical |
| Auth failures spike | > 10/min | Warning |
| DLQ depth | > 10 items | Warning |

---

### Runbooks

Create runbooks for common issues:

#### /docs/runbooks/high-error-rate.md
1. Check Cloud Logging for error patterns
2. Identify affected endpoints/services
3. Check recent deployments
4. Rollback if deployment-related
5. Escalate if unresolved in 15 min

#### /docs/runbooks/database-issues.md
1. Check Supabase dashboard for connection issues
2. Verify connection pool not exhausted
3. Check for slow queries
4. Scale up if needed

#### /docs/runbooks/kb-ingestion-failures.md
1. Check DLQ for failed jobs
2. Identify file types/sizes causing issues
3. Check external API limits (OpenAI embeddings)
4. Retry failed jobs after fixing

#### /docs/runbooks/contract-parsing-failures.md
1. Check contract file format
2. Review extraction logs
3. Check Claude API status
4. Manual review if automated fails

---

## Implementation

### Logging Setup
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  base: {
    service: 'cscx',
    version: process.env.APP_VERSION
  }
});

// Request middleware
app.use((req, res, next) => {
  req.logger = logger.child({
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    userId: req.user?.id,
    workspaceId: req.workspace?.id
  });
  next();
});
```

### Metrics Setup
```typescript
import { Counter, Histogram, Registry } from 'prom-client';

const registry = new Registry();

const apiLatency = new Histogram({
  name: 'api_latency_seconds',
  help: 'API request latency',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

registry.registerMetric(apiLatency);

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});
```

---

## Definition of Done

- [ ] Structured logging implemented
- [ ] Request ID propagation
- [ ] Error tracking integration
- [ ] All metrics collecting
- [ ] Health check endpoints
- [ ] Readiness check endpoints
- [ ] Alerts configured
- [ ] Runbooks documented
- [ ] Dashboard for key metrics
- [ ] Deployed to staging/production
