# PRD-6: Production Deployment + CI/CD

**Status**: 🔴 Not Started
**Priority**: P0 - Critical (Launch Blocker)
**Last Updated**: 2026-02-01

---

## Goal

Implement production-grade deployment with staging + production environments, domain + HTTPS, CI/CD pipeline, and rollback capability.

---

## Deployment Platform Decision

### Recommendation: Google Cloud Run

**Rationale:**
- Already using Google Cloud (existing project)
- Production URL exists: https://cscx-api-938520514616.us-central1.run.app
- Serverless scaling fits CS platform workload
- Integrates with Cloud Build for CI/CD
- Secret Manager for credentials
- Cloud Logging + Monitoring built-in

### Alternative Considered: Vercel
- Good for Next.js frontend
- Less suitable for Express backend
- Would require splitting deployment

**Decision: Google Cloud Run for both frontend and backend**

---

## Environment Configuration

### Development
- Local development
- `.env.local` for secrets
- SQLite or local Supabase

### Staging
- URL: https://staging.cscx.ai (or staging-cscx-xxx.run.app)
- Connected to staging Supabase project
- Test invite codes only
- Full feature parity with production

### Production
- URL: https://app.cscx.ai (custom domain)
- Connected to production Supabase project
- Real invite codes for design partners
- Monitoring and alerting active

---

## Requirements

| Req ID | Requirement |
|--------|-------------|
| FR-1 | Staging environment configured and accessible |
| FR-2 | Production environment with custom domain |
| FR-3 | HTTPS with auto-renewing TLS certificates |
| FR-4 | Secrets managed via Google Secret Manager |
| FR-5 | CI pipeline: build + test on every PR |
| FR-6 | CD pipeline: deploy to staging on merge to main |
| FR-7 | Production deploy: manual promotion from staging |
| FR-8 | Rollback: one-click revert to previous version |
| FR-9 | Health checks: /health/live and /health/ready endpoints |
| FR-10 | Zero-downtime deployments |

---

## CI/CD Pipeline (Cloud Build)

```yaml
# cloudbuild.yaml
steps:
  # Install dependencies
  - name: 'node:20'
    entrypoint: npm
    args: ['ci']

  # Run linter
  - name: 'node:20'
    entrypoint: npm
    args: ['run', 'lint']

  # Run type check
  - name: 'node:20'
    entrypoint: npm
    args: ['run', 'typecheck']

  # Run tests
  - name: 'node:20'
    entrypoint: npm
    args: ['test']

  # Build
  - name: 'node:20'
    entrypoint: npm
    args: ['run', 'build']

  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/cscx:$SHORT_SHA', '.']

  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/cscx:$SHORT_SHA']

  # Deploy to Cloud Run (staging)
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'cscx-staging'
      - '--image'
      - 'gcr.io/$PROJECT_ID/cscx:$SHORT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
```

---

## Domain Configuration

### DNS Setup
1. Add A/CNAME records for app.cscx.ai pointing to Cloud Run
2. Configure domain mapping in Cloud Run
3. SSL certificate auto-provisioned by Google

### Cloud Run Commands
```bash
# Map custom domain
gcloud run domain-mappings create --service cscx-production --domain app.cscx.ai --region us-central1
```

---

## Secrets Management

### Required Secrets
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `SESSION_SECRET`

### Secret Manager Commands
```bash
# Create secret
gcloud secrets create SUPABASE_URL --replication-policy="automatic"
echo -n "https://xxx.supabase.co" | gcloud secrets versions add SUPABASE_URL --data-file=-

# Grant access to Cloud Run
gcloud secrets add-iam-policy-binding SUPABASE_URL \
  --member="serviceAccount:xxx@xxx.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Rollback Procedure

### Automated Rollback
```bash
# List revisions
gcloud run revisions list --service cscx-production --region us-central1

# Rollback to previous revision
gcloud run services update-traffic cscx-production \
  --region us-central1 \
  --to-revisions=cscx-production-00001-abc=100
```

### Rollback Criteria
- Error rate > 5% for 5 minutes
- P95 latency > 10 seconds
- Health check failures

---

## Smoke Tests

### Staging Smoke Tests
```bash
#!/bin/bash
BASE_URL="https://staging.cscx.ai"

# Health check
curl -f "$BASE_URL/health/live" || exit 1
curl -f "$BASE_URL/health/ready" || exit 1

# Auth endpoint responds
curl -f "$BASE_URL/api/auth/session" || exit 1

# API responds
curl -f "$BASE_URL/api/customers" -H "Authorization: Bearer $TEST_TOKEN" || exit 1
```

### Production Smoke Tests
Same as staging with production URL and credentials.

---

## Test Plan

- CI pipeline executes on every PR
- Staging deploy triggers smoke tests
- Production deploy triggers smoke tests
- Rollback procedure tested monthly

---

## Definition of Done

- [ ] Staging environment configured and accessible
- [ ] Production environment with custom domain
- [ ] HTTPS working with valid certificate
- [ ] CI pipeline: tests pass, blocks on failure
- [ ] CD pipeline: auto-deploy to staging
- [ ] Production deploy: manual trigger
- [ ] Rollback procedure documented and tested
- [ ] Smoke tests pass on both environments
- [ ] Secrets managed securely (not in code)
