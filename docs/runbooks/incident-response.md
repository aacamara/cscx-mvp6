# Incident Response Runbook

**Version**: 1.0
**Last Updated**: 2026-02-02

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P0** | Platform down | Immediate | API unreachable, auth broken |
| **P1** | Major feature broken | < 1 hour | Chat not working, KB search down |
| **P2** | Feature degraded | < 4 hours | Slow responses, partial failures |
| **P3** | Minor issue | < 24 hours | UI glitches, non-critical bugs |

## Initial Response Checklist

### 1. Assess Impact
- [ ] Check health endpoints: `curl https://cscx-api-938520514616.us-central1.run.app/health`
- [ ] Check Cloud Run console for errors
- [ ] Check Supabase dashboard for database issues
- [ ] Review recent deployments in Cloud Build

### 2. Communicate
- [ ] Acknowledge incident in team channel
- [ ] Update status page (if applicable)
- [ ] Notify affected users if P0/P1

### 3. Diagnose
```bash
# Check service status
gcloud run services describe cscx-api --region=us-central1

# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cscx-api" --limit=100

# Check revision history
gcloud run revisions list --service=cscx-api --region=us-central1
```

## Common Issues & Resolutions

### API Returns 503

**Symptoms**: All requests return 503 Service Unavailable

**Diagnosis**:
```bash
# Check Cloud Run instances
gcloud run services describe cscx-api --region=us-central1 --format="value(status.conditions)"
```

**Resolution**:
1. Check if instances are scaling (may be cold start)
2. Verify environment variables are set
3. Check memory/CPU limits not exceeded
4. Review startup logs for errors

### Authentication Failures

**Symptoms**: Users cannot log in, 401 errors

**Diagnosis**:
```bash
# Test auth endpoint
curl -X POST https://cscx-api-938520514616.us-central1.run.app/api/auth/session \
  -H "Content-Type: application/json"
```

**Resolution**:
1. Verify Supabase URL and keys in Cloud Run secrets
2. Check Supabase Auth service status
3. Verify Google OAuth credentials
4. Clear browser cookies and retry

### Database Connection Errors

**Symptoms**: Timeouts, connection refused

**Diagnosis**:
1. Check Supabase dashboard status
2. Verify connection pooling limits
3. Check for long-running queries

**Resolution**:
1. Restart Cloud Run service
2. Check Supabase connection limits
3. Kill long-running queries if needed

### AI Service Failures

**Symptoms**: Chat responses fail, contract parsing errors

**Diagnosis**:
```bash
# Check health endpoint for AI status
curl https://cscx-api-938520514616.us-central1.run.app/health | jq '.services'
```

**Resolution**:
1. Check circuit breaker states (Claude → Gemini fallback)
2. Verify API keys are valid
3. Check API quotas/rate limits
4. System will auto-fallback between Claude and Gemini

### Knowledge Base Search Not Working

**Symptoms**: KB search returns no results

**Diagnosis**:
```bash
# Check KB status
curl https://cscx-api-938520514616.us-central1.run.app/api/kb/status
```

**Resolution**:
1. Verify embeddings service is running
2. Check vector index in Supabase
3. Trigger re-sync if needed: `POST /api/kb/sync`

## Rollback Procedure

### Quick Rollback (< 5 minutes)

```bash
# List recent revisions
gcloud run revisions list --service=cscx-api --region=us-central1

# Route traffic to previous revision
gcloud run services update-traffic cscx-api \
  --region=us-central1 \
  --to-revisions=cscx-api-00039-xyz=100
```

### Full Rollback

1. Identify last known good commit in GitHub
2. Create rollback branch
3. Deploy via Cloud Build
4. Verify health endpoints
5. Monitor for 15 minutes

## Escalation Path

1. **On-call Engineer** - First response, diagnosis
2. **Platform Lead** - P0/P1 escalation
3. **Aziz Camara** - Major incidents, customer communication

## Post-Incident

1. Document timeline in incident report
2. Identify root cause
3. Create follow-up tickets for improvements
4. Update runbooks if new scenario
5. Schedule post-mortem for P0/P1
