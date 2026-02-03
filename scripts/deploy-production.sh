#!/bin/bash
# CSCX.AI Production Deployment Script
# Run this script to deploy to production environment

set -e

echo "=== CSCX.AI Production Deployment ==="
echo ""

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-cscx-ai-project}"
REGION="us-central1"
SERVICE_NAME="cscx-api"
IMAGE_TAG="$(git rev-parse --short HEAD)"

# Safety check
read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Pre-flight checks
echo "1. Running pre-flight checks..."

# Check gcloud is configured
if ! gcloud auth list 2>&1 | grep -q 'ACTIVE'; then
    echo "ERROR: gcloud not authenticated. Run: gcloud auth login"
    exit 1
fi

# Check staging was successful first
echo "   Checking staging deployment..."
STAGING_URL=$(gcloud run services describe "cscx-api-staging" --region "$REGION" --format "value(status.url)" 2>/dev/null || echo "")
if [ -z "$STAGING_URL" ]; then
    echo "WARNING: No staging deployment found. Deploy to staging first."
    read -p "Continue anyway? (yes/no): " continue_anyway
    if [ "$continue_anyway" != "yes" ]; then
        exit 1
    fi
fi

gcloud config set project "$PROJECT_ID"

echo "   ✓ gcloud authenticated"
echo "   ✓ Project: $PROJECT_ID"
echo "   ✓ Region: $REGION"
echo ""

# Get current revision for rollback
echo "2. Recording current revision for rollback..."
CURRENT_REVISION=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format "value(status.latestCreatedRevisionName)" 2>/dev/null || echo "none")
echo "   Current revision: $CURRENT_REVISION"
echo "$CURRENT_REVISION" > /tmp/cscx-rollback-revision.txt

# Build and push
echo ""
echo "3. Building Docker image..."
docker build -t "gcr.io/$PROJECT_ID/cscx-api:$IMAGE_TAG" \
             -t "gcr.io/$PROJECT_ID/cscx-api:latest" .

echo ""
echo "4. Pushing to Container Registry..."
docker push "gcr.io/$PROJECT_ID/cscx-api:$IMAGE_TAG"
docker push "gcr.io/$PROJECT_ID/cscx-api:latest"

echo ""
echo "5. Deploying to Cloud Run (production)..."
gcloud run deploy "$SERVICE_NAME" \
    --image "gcr.io/$PROJECT_ID/cscx-api:$IMAGE_TAG" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars "NODE_ENV=production" \
    --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"

echo ""
echo "6. Getting service URL..."
PRODUCTION_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format "value(status.url)")
echo "   Production URL: $PRODUCTION_URL"

echo ""
echo "7. Running smoke tests..."
echo "   Testing health endpoint..."
curl -sf "$PRODUCTION_URL/health" | jq .

echo ""
echo "   Testing liveness..."
curl -sf "$PRODUCTION_URL/health/live" | jq .

echo ""
echo "   Testing readiness..."
curl -sf "$PRODUCTION_URL/health/ready" | jq .

echo ""
echo "=== Production Deployment Complete ==="
echo "URL: $PRODUCTION_URL"
echo ""
echo "Rollback command (if needed):"
echo "  gcloud run services update-traffic $SERVICE_NAME --region=$REGION --to-revisions=$CURRENT_REVISION=100"
