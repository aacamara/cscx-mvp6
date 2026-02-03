# PRD: Production Deployment Configuration

## Overview
Configure and deploy the application to production with proper security, monitoring, and custom domain.

## Problem Statement
Moving from development to production requires:
- Proper environment configuration
- Secure secret management
- Deployment pipeline setup
- Custom domain configuration
- Monitoring and error tracking

## Deployment Architecture

### Frontend: Vercel
- Zero-config deployment for Vite/React
- Automatic HTTPS and CDN
- Preview deployments for testing
- Easy custom domain setup

### Backend: Google Cloud Run
- Already have Google Cloud account
- Serverless scaling (pay per use)
- Container-based deployment
- Secure environment variables

### Database: Supabase
- PostgreSQL with RLS
- Already configured
- Production-ready

## User Stories

### US-001: Create Vercel Configuration
**Description:** As a developer, I need Vercel config for frontend deployment.

**Acceptance Criteria:**
- Create vercel.json with build settings
- Configure output directory (dist)
- Set up environment variable references
- Configure rewrites for SPA routing
- Typecheck passes

### US-002: Create Cloud Run Dockerfile
**Description:** As a developer, I need a Dockerfile for backend deployment.

**Acceptance Criteria:**
- Dockerfile uses Node.js 20 LTS
- Multi-stage build for smaller image
- Health check endpoint configured
- Runs as non-root user
- Exposes port 3001
- Typecheck passes

### US-003: Create Cloud Build Configuration
**Description:** As a developer, I need cloudbuild.yaml for CI/CD.

**Acceptance Criteria:**
- Builds Docker image
- Pushes to Container Registry
- Deploys to Cloud Run
- Sets environment variables from secrets
- Configures service settings (memory, concurrency)
- Typecheck passes

### US-004: Configure Environment Variables
**Description:** As a developer, I need production environment variables set up.

**Acceptance Criteria:**
- Frontend env vars documented in vercel.json
- Backend secrets stored in Google Secret Manager
- No secrets in source code or logs
- Environment-specific URLs configured
- Typecheck passes

### US-005: Set Up Custom Domain
**Description:** As a developer, I need custom domain for production.

**Acceptance Criteria:**
- Frontend domain: cscx.ai or app.cscx.ai
- Backend domain: api.cscx.ai
- SSL certificates automatically provisioned
- DNS records documented
- CORS configured for production domains
- Typecheck passes

### US-006: Configure Monitoring
**Description:** As a developer, I need monitoring for production health.

**Acceptance Criteria:**
- Cloud Run metrics enabled (CPU, memory, requests)
- Error logging to Cloud Logging
- Uptime checks configured
- Alert policies for downtime/errors
- Typecheck passes

## Technical Implementation

### vercel.json
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "env": {
    "VITE_API_URL": "@vite_api_url",
    "VITE_SUPABASE_URL": "@vite_supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@vite_supabase_anon_key"
  }
}
```

### Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
USER nodejs
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### cloudbuild.yaml
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/cscx-backend', './server']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/cscx-backend']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'cscx-backend'
      - '--image=gcr.io/$PROJECT_ID/cscx-backend'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--set-secrets=SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_KEY=supabase-key:latest'

images:
  - 'gcr.io/$PROJECT_ID/cscx-backend'
```

### Environment Variables Checklist
```
# Frontend (Vercel)
VITE_API_URL=https://api.cscx.ai
VITE_SUPABASE_URL=[from Supabase dashboard]
VITE_SUPABASE_ANON_KEY=[from Supabase dashboard]

# Backend (Cloud Run Secrets)
SUPABASE_URL=[from Supabase dashboard]
SUPABASE_SERVICE_KEY=[from Supabase dashboard]
GOOGLE_CLIENT_ID=[from Google Cloud Console]
GOOGLE_CLIENT_SECRET=[from Google Cloud Console]
GEMINI_API_KEY=[from Google AI Studio]
ANTHROPIC_API_KEY=[from Anthropic Console]
```

### DNS Configuration
```
# A/AAAA records for cscx.ai
cscx.ai → Vercel IP
www.cscx.ai → CNAME to cscx.ai

# CNAME for api subdomain
api.cscx.ai → Cloud Run domain
```

## Post-Deployment Checklist
- [ ] Verify frontend loads at https://cscx.ai
- [ ] Verify API responds at https://api.cscx.ai/health
- [ ] Test OAuth flow in production
- [ ] Verify database connectivity
- [ ] Check SSL certificates valid
- [ ] Test invite code flow
- [ ] Monitor for errors in first hour
