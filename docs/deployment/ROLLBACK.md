# CSCX.AI Rollback Procedures

## Overview

This document covers rollback procedures for CSCX.AI deployments on Google Cloud Run, including application rollback and database migration rollback.

---

## Cloud Run Application Rollback

### Step 1: Identify the Good Revision

List all available revisions to find the last known-good deployment:

```bash
gcloud run revisions list --service=cscx-api --region=us-central1
```

Output shows revisions sorted by creation time with traffic allocation and status. Look for the revision that was serving traffic before the problematic deploy.

### Step 2: Route Traffic to the Good Revision

Shift 100% of traffic to the known-good revision:

```bash
gcloud run services update-traffic cscx-api \
  --to-revisions=REVISION=100 \
  --region=us-central1
```

Replace `REVISION` with the actual revision name (e.g., `cscx-api-00042-abc`).

### Step 3: Verify Health

Run the smoke test suite against the production URL to confirm the rollback is healthy:

```bash
./scripts/smoke-test.sh https://cscx-api-938520514616.us-central1.run.app
```

Verify all health endpoints return 200 and protected endpoints return 401.

### Step 4: Monitor

After rollback, monitor for at least 15 minutes:

```bash
# Stream live logs
gcloud run services logs tail cscx-api --region=us-central1

# Check error rate in Cloud Monitoring
gcloud logging read \
  'resource.type="cloud_run_revision" AND severity>=ERROR' \
  --limit=50 --freshness=15m
```

### Rollback Criteria

Trigger an immediate rollback if any of the following occur:

- Error rate exceeds 5% for 5 consecutive minutes
- P95 latency exceeds 10 seconds
- Health check endpoints (`/health/live`, `/health/ready`) fail
- Authentication flow is broken (users cannot log in)
- Data integrity issues detected (missing or corrupted responses)

---

## Gradual Traffic Migration (Canary Rollback)

For less urgent situations, gradually shift traffic instead of an instant cutback:

```bash
# Route 90% to old revision, 10% to new (for testing)
gcloud run services update-traffic cscx-api \
  --to-revisions=OLD_REVISION=90,NEW_REVISION=10 \
  --region=us-central1

# If issues persist, route 100% back to old
gcloud run services update-traffic cscx-api \
  --to-revisions=OLD_REVISION=100 \
  --region=us-central1
```

---

## Database Migration Rollback

Database migrations require more careful handling since they modify schema and data.

### Prerequisites

- All migrations in `database/migrations/` must have corresponding down/rollback SQL
- Always take a backup before running migrations in production

### Step 1: Create a Backup Before Migrating

```bash
# Export current database state via Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql --project-ref YOUR_PROJECT_REF

# Or via pg_dump directly
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Identify the Failed Migration

Check the migration history to find which migration caused the issue:

```bash
# List applied migrations
supabase migration list --project-ref YOUR_PROJECT_REF
```

### Step 3: Revert the Migration

If a rollback SQL file exists for the migration:

```bash
# Run the rollback SQL against the database
psql "$DATABASE_URL" -f database/migrations/NNNN_rollback.sql
```

If no rollback file exists, restore from the backup:

```bash
# Restore from backup (DESTRUCTIVE — replaces current state)
psql "$DATABASE_URL" < backup_YYYYMMDD_HHMMSS.sql
```

### Step 4: Verify Data Integrity

After rolling back the database:

```bash
# Check table counts for key tables
psql "$DATABASE_URL" -c "
  SELECT 'customers' as table_name, count(*) FROM customers
  UNION ALL
  SELECT 'organizations', count(*) FROM organizations
  UNION ALL
  SELECT 'onboarding_workflows', count(*) FROM onboarding_workflows;
"
```

### Migration Safety Rules

1. **Never** run destructive migrations (DROP TABLE, DROP COLUMN) without a backup
2. **Always** test migrations on staging before production
3. **Keep** migration rollback scripts alongside forward migrations
4. **Use** transactions for multi-statement migrations so they can be atomically rolled back
5. **Avoid** data-only migrations during peak traffic hours

---

## Rollback Checklist

Use this checklist during any rollback event:

- [ ] Incident identified and severity assessed
- [ ] Team notified (Slack/Telegram)
- [ ] Good revision identified from `gcloud run revisions list`
- [ ] Traffic routed to good revision
- [ ] Smoke tests pass on rolled-back version
- [ ] Database rollback performed (if migration was involved)
- [ ] Data integrity verified
- [ ] Monitoring confirms stable error rate and latency
- [ ] Incident documented with root cause
- [ ] Fix prepared and tested on staging before re-deploying

---

## Quick Reference

| Action | Command |
|--------|---------|
| List revisions | `gcloud run revisions list --service=cscx-api --region=us-central1` |
| Rollback traffic | `gcloud run services update-traffic cscx-api --to-revisions=REVISION=100 --region=us-central1` |
| Stream logs | `gcloud run services logs tail cscx-api --region=us-central1` |
| Run smoke tests | `./scripts/smoke-test.sh BASE_URL` |
| DB backup | `pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql` |
