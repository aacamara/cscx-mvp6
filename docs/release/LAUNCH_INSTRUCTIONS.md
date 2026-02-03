# CSCX.AI Launch Instructions

**Version**: 1.0
**Last Updated**: 2026-02-02
**Target Launch**: 2026-02-10

## Pre-Launch Checklist

### Infrastructure
- [x] Cloud Run service deployed
- [x] Supabase database configured
- [x] CI/CD pipeline working
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Staging environment ready

### Application
- [x] All PRD endpoints verified (25/25 checks pass)
- [x] 204 tests passing
- [x] Health endpoints working
- [ ] Database migrations applied to production
- [ ] Seed data for default workspace

### Security
- [x] Helmet security headers
- [x] Rate limiting configured
- [x] CORS configured
- [ ] Secrets rotated for production
- [ ] Backup procedures tested

---

## Step 1: Configure Custom Domain

### Option A: Using Cloud Run Domain Mapping

```bash
# Map custom domain to Cloud Run service
gcloud beta run domain-mappings create \
  --service=cscx-api \
  --domain=app.cscx.ai \
  --region=us-central1

# Get DNS records to configure
gcloud beta run domain-mappings describe \
  --domain=app.cscx.ai \
  --region=us-central1
```

### Option B: Using Cloudflare (Recommended)

1. Add domain to Cloudflare
2. Create CNAME record:
   - Name: `app` (or `@` for root)
   - Target: `cscx-api-938520514616.us-central1.run.app`
   - Proxy: Enabled (orange cloud)
3. Enable Full SSL mode
4. Configure Page Rules for caching

---

## Step 2: Apply Database Migrations

```bash
# Connect to Supabase
cd server

# Run all pending migrations
npx supabase db push

# Verify migrations applied
npx supabase db status
```

### Critical Migrations
1. `20260201000002_prd0_contract_entitlements.sql` - Entitlements schema
2. `20260202000001_prd1_gated_login.sql` - Invite codes, workspaces

---

## Step 3: Create Design Partner Invite Codes

### Generate Invite Codes

```sql
-- Insert invite codes for design partners
INSERT INTO invite_codes (code_hash, workspace_id, max_uses, expires_at)
VALUES
  -- Partner 1: Single use, 30-day expiry
  (encode(sha256('PARTNER-2026-ALPHA'::bytea), 'hex'),
   'a0000000-0000-0000-0000-000000000001', 1,
   NOW() + INTERVAL '30 days'),

  -- Partner 2: 5 uses for team
  (encode(sha256('PARTNER-2026-BETA'::bytea), 'hex'),
   'a0000000-0000-0000-0000-000000000001', 5,
   NOW() + INTERVAL '30 days'),

  -- Demo code: Unlimited uses
  (encode(sha256('DEMO-2026-TRIAL'::bytea), 'hex'),
   'a0000000-0000-0000-0000-000000000001', 1000,
   NOW() + INTERVAL '90 days');
```

### Invite Code Template

Send to design partners:
```
Welcome to CSCX.AI Private Beta!

Your invite code: PARTNER-2026-XXXX

To get started:
1. Go to https://app.cscx.ai
2. Click "Continue with Google"
3. Enter your invite code when prompted
4. Import your customers from Google Sheets or CSV

Questions? Email support@cscx.ai
```

---

## Step 4: Configure Secrets for Production

### Required Secrets

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `GEMINI_API_KEY` | Gemini API key |
| `SUPABASE_URL` | Production Supabase URL |
| `SUPABASE_SERVICE_KEY` | Service role key |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |

### Update Cloud Run Secrets

```bash
# Update a secret
gcloud run services update cscx-api \
  --region=us-central1 \
  --update-secrets=ANTHROPIC_API_KEY=anthropic-api-key:latest
```

### Rotate Secrets

1. Generate new key in respective console
2. Update Cloud Run secret
3. Verify health endpoint
4. Revoke old key

---

## Step 5: Run Production Smoke Tests

```bash
# Health check
curl https://app.cscx.ai/health

# Liveness
curl https://app.cscx.ai/health/live

# Readiness
curl https://app.cscx.ai/health/ready

# PRD verification
node test-screenshots/verify-all-prds.cjs
```

Expected output: All 25 checks passing

---

## Step 6: Monitor Launch

### Key Dashboards

1. **Cloud Run Console**: https://console.cloud.google.com/run
   - Instance count
   - Request latency
   - Error rate

2. **Supabase Dashboard**: https://app.supabase.com
   - Database connections
   - Query performance
   - Storage usage

3. **Application Health**: https://app.cscx.ai/health
   - Service status
   - Circuit breaker states

### Critical Metrics to Watch

| Metric | Normal | Alert |
|--------|--------|-------|
| Error rate | <1% | >5% |
| P95 latency | <2s | >5s |
| Instance count | 1-3 | >8 |
| Memory usage | <70% | >90% |

---

## Rollback Procedure

### Quick Rollback (< 5 minutes)

```bash
# List revisions
gcloud run revisions list --service=cscx-api --region=us-central1

# Route to previous revision
gcloud run services update-traffic cscx-api \
  --region=us-central1 \
  --to-revisions=PREVIOUS_REVISION=100
```

### Full Rollback

1. Revert code in GitHub
2. Cloud Build auto-deploys
3. Verify health endpoints
4. Monitor for 15 minutes

---

## Support Ticket Triage SOP

### P0: Platform Down
1. Acknowledge within 5 minutes
2. Check health endpoints
3. Review Cloud Run logs
4. Escalate if not resolved in 15 minutes

### P1: Feature Broken
1. Acknowledge within 30 minutes
2. Identify affected feature
3. Create workaround if possible
4. Target fix within 4 hours

### P2: Bug/Issue
1. Acknowledge within 2 hours
2. Add to backlog
3. Target fix within 1 week

### Auto-Generated Troubleshoot Prompt

Each support ticket includes a Claude CLI prompt:
```
Based on ticket #XXX:
- User: [email]
- Workspace: [name]
- Issue: [description]
- Steps: [reproduction steps]
- Browser: [user agent]
- Timestamp: [when]

Investigate:
1. Check recent errors for this user
2. Review related action IDs
3. Check service health at time of issue
4. Propose fix or workaround
```

---

## Post-Launch Tasks

### Day 1
- [ ] Monitor all dashboards
- [ ] Respond to any issues immediately
- [ ] Collect initial partner feedback

### Week 1
- [ ] Review error patterns
- [ ] Optimize slow queries
- [ ] Address top partner requests

### Month 1
- [ ] Security audit
- [ ] Performance optimization
- [ ] Feature prioritization based on usage

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Platform Lead | Aziz Camara |
| Cloud Support | Google Cloud Support |
| Database Support | Supabase Support |

---

## Appendix: Environment Variables

### Production
```
NODE_ENV=production
PORT=8080
CORS_ORIGIN=https://app.cscx.ai
VITE_API_URL=https://app.cscx.ai
```

### Staging
```
NODE_ENV=staging
PORT=8080
CORS_ORIGIN=https://staging.cscx.ai
VITE_API_URL=https://staging.cscx.ai
```
