# CSCX.AI Deployment Guide

Complete guide to deploying CSCX.AI on Google Cloud Platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Google Cloud Setup](#google-cloud-setup)
3. [Supabase Setup](#supabase-setup)
4. [Environment Configuration](#environment-configuration)
5. [Docker Build](#docker-build)
6. [Cloud Run Deployment](#cloud-run-deployment)
7. [Custom Domain](#custom-domain)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- Google Cloud Platform account with billing enabled
- Supabase account (free tier works for development)
- Domain name (optional, for custom domain)

### Required Tools

```bash
# Install Google Cloud SDK
brew install google-cloud-sdk

# Install Docker
brew install docker

# Verify installations
gcloud --version
docker --version
```

### API Keys Required

| Service | Purpose | Get Key |
|---------|---------|---------|
| Gemini | AI text generation | [Google AI Studio](https://aistudio.google.com/apikey) |
| Anthropic Claude | Advanced AI reasoning | [Anthropic Console](https://console.anthropic.com/) |
| Supabase | Database & Auth | [Supabase Dashboard](https://supabase.com/dashboard) |

---

## Google Cloud Setup

### 1. Create Project

```bash
# Create new project
gcloud projects create cscx-ai-prod --name="CSCX.AI Production"

# Set as active project
gcloud config set project cscx-ai-prod

# Enable billing (required for Cloud Run)
# Do this in Console: https://console.cloud.google.com/billing
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### 3. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create cscx-api \
  --display-name="CSCX API Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding cscx-ai-prod \
  --member="serviceAccount:cscx-api@cscx-ai-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding cscx-ai-prod \
  --member="serviceAccount:cscx-api@cscx-ai-prod.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### 4. Configure Secrets

```bash
# Store API keys as secrets
echo -n "your-gemini-key" | gcloud secrets create GEMINI_API_KEY --data-file=-
echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "your-supabase-url" | gcloud secrets create SUPABASE_URL --data-file=-
echo -n "your-supabase-key" | gcloud secrets create SUPABASE_SERVICE_KEY --data-file=-

# Grant access to service account
for SECRET in GEMINI_API_KEY ANTHROPIC_API_KEY SUPABASE_URL SUPABASE_SERVICE_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:cscx-api@cscx-ai-prod.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

---

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Name: `cscx-ai-prod`
4. Region: Choose closest to your users
5. Generate a strong database password

### 2. Run Database Migrations

1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `database/schema.sql`
3. Run the SQL

Or use Supabase CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref your-project-ref

# Push schema
supabase db push
```

### 3. Configure Auth (Optional)

1. Go to Authentication > Providers
2. Enable Email/Password
3. Configure OAuth providers (Google, GitHub, etc.)

### 4. Get Connection Details

From Project Settings > API:
- `SUPABASE_URL`: Your project URL
- `SUPABASE_ANON_KEY`: Public anon key
- `SUPABASE_SERVICE_KEY`: Service role key (keep secret!)

---

## Environment Configuration

### Production Environment Variables

Create `server/.env.production`:

```env
# Server
NODE_ENV=production
PORT=8080

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# AI APIs
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key

# CORS (your frontend domain)
CORS_ORIGIN=https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend Environment Variables

Create `.env.production`:

```env
VITE_API_URL=https://api.your-domain.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Docker Build

### Build Images Locally (for testing)

```bash
# Build backend
docker build -t cscx-api:latest -f Dockerfile.server .

# Build frontend
docker build -t cscx-web:latest -f Dockerfile.web .

# Test locally
docker-compose up
```

### Build for Cloud Run

```bash
# Configure Docker for GCR
gcloud auth configure-docker

# Build and push backend
docker build -t gcr.io/cscx-ai-prod/cscx-api:latest -f Dockerfile.server .
docker push gcr.io/cscx-ai-prod/cscx-api:latest

# Build and push frontend
docker build -t gcr.io/cscx-ai-prod/cscx-web:latest -f Dockerfile.web .
docker push gcr.io/cscx-ai-prod/cscx-web:latest
```

---

## Cloud Run Deployment

### Deploy Backend API

```bash
gcloud run deploy cscx-api \
  --image gcr.io/cscx-ai-prod/cscx-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest" \
  --set-env-vars="NODE_ENV=production,PORT=8080"
```

### Deploy Frontend

```bash
gcloud run deploy cscx-web \
  --image gcr.io/cscx-ai-prod/cscx-web:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5
```

### Get Service URLs

```bash
# Get backend URL
gcloud run services describe cscx-api --region us-central1 --format='value(status.url)'

# Get frontend URL
gcloud run services describe cscx-web --region us-central1 --format='value(status.url)'
```

---

## Custom Domain

### 1. Map Domain in Cloud Run

```bash
# Map custom domain to frontend
gcloud beta run domain-mappings create \
  --service cscx-web \
  --domain app.cscx.ai \
  --region us-central1

# Map API subdomain
gcloud beta run domain-mappings create \
  --service cscx-api \
  --domain api.cscx.ai \
  --region us-central1
```

### 2. Configure DNS

Add these records to your domain registrar:

| Type | Name | Value |
|------|------|-------|
| CNAME | app | ghs.googlehosted.com |
| CNAME | api | ghs.googlehosted.com |

### 3. SSL Certificates

Cloud Run automatically provisions SSL certificates via Let's Encrypt.

---

## CI/CD Pipeline

### Cloud Build Configuration

The `cloudbuild.yaml` file handles automated deployments:

```yaml
# Trigger on push to main branch
# Build both services
# Deploy to Cloud Run
```

### Set Up Triggers

```bash
# Connect to GitHub repo
gcloud beta builds triggers create github \
  --repo-owner=your-org \
  --repo-name=cscx-ai \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

---

## Monitoring

### Cloud Monitoring

1. Go to [Cloud Monitoring](https://console.cloud.google.com/monitoring)
2. Create Dashboard for CSCX.AI
3. Add charts:
   - Request count
   - Latency (p50, p95, p99)
   - Error rate
   - Container memory/CPU

### Set Up Alerts

```bash
# Create alert policy for high error rate
gcloud alpha monitoring policies create \
  --display-name="CSCX API Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"'
```

### Logging

```bash
# View backend logs
gcloud run services logs read cscx-api --region us-central1

# Stream logs
gcloud run services logs tail cscx-api --region us-central1
```

---

## Troubleshooting

### Common Issues

#### Container fails to start

```bash
# Check logs
gcloud run services logs read cscx-api --region us-central1 --limit 50

# Common causes:
# - Missing environment variables
# - Port mismatch (must be 8080)
# - Secrets not accessible
```

#### 502 Bad Gateway

- Container health check failing
- Application crashing on startup
- Check memory limits

#### Slow cold starts

```bash
# Increase min instances
gcloud run services update cscx-api \
  --min-instances 1 \
  --region us-central1
```

#### CORS Errors

- Check `CORS_ORIGIN` environment variable
- Ensure it matches frontend domain exactly

### Health Check Endpoint

The API should respond to `/health`:

```bash
curl https://api.cscx.ai/health
# Expected: {"status":"ok","version":"1.0.0"}
```

---

## Quick Deploy Script

Use the provided script for one-command deployment:

```bash
./scripts/deploy-gcp.sh

# Or with options
./scripts/deploy-gcp.sh --project cscx-ai-prod --region us-central1
```

---

## Cost Optimization

### Cloud Run Pricing

- Pay per request (first 2M requests/month free)
- Pay per vCPU-second and GiB-second
- Use min-instances=0 for dev/staging

### Estimated Costs (Production)

| Resource | Cost/Month |
|----------|------------|
| Cloud Run (API) | ~$20-50 |
| Cloud Run (Web) | ~$5-10 |
| Cloud Build | ~$5 |
| Secret Manager | ~$1 |
| Supabase (Pro) | $25 |
| **Total** | **~$60-90** |

---

## Next Steps

1. Set up staging environment
2. Configure automated testing in CI/CD
3. Set up error tracking (Sentry)
4. Implement caching (Cloud CDN)
5. Configure backup strategy
