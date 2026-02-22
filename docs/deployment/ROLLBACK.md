# CSCX.AI Rollback Procedures

## Cloud Run Rollback (Instant)

Cloud Run keeps all deployed revisions. Rollback to a previous revision:

```bash
# List recent revisions
gcloud run revisions list --service=cscx-api --region=us-central1 --limit=5

# Rollback to a specific revision (instant, zero-downtime)
gcloud run services update-traffic cscx-api \
  --to-revisions=REVISION_NAME=100 \
  --region=us-central1
```

## Database Migration Rollback

Migrations are forward-only. For critical issues:

1. Identify the problematic migration in `database/migrations/`
2. Write a reverse migration (e.g., `101_revert_xyz.sql`)
3. Apply via Supabase SQL Editor

## Verification After Rollback

```bash
./scripts/smoke-test.sh https://cscx-api-938520514616.us-central1.run.app
```

## Emergency Links

- Cloud Run Console: https://console.cloud.google.com/run
- Supabase Dashboard: https://supabase.com/dashboard
- GitHub Actions: https://github.com/aacamara/cscx-mvp6/actions
