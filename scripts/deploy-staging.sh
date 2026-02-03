#!/bin/bash
# CSCX.AI Staging Deployment Script
# Run this script to deploy to staging environment

set -e

echo "=== CSCX.AI Staging Deployment ==="
echo ""

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-cscx-ai-project}"
REGION="us-central1"
SERVICE_NAME="cscx-api-staging"
IMAGE_TAG="staging-$(git rev-parse --short HEAD)"

# Pre-flight checks
echo "1. Running pre-flight checks..."

# Check gcloud is configured
if ! gcloud auth list 2>&1 | grep -q 'ACTIVE'; then
    echo "ERROR: gcloud not authenticated. Run: gcloud auth login"
    exit 1
fi

# Check project is set
gcloud config set project "$PROJECT_ID"

echo "   ✓ gcloud authenticated"
echo "   ✓ Project: $PROJECT_ID"
echo "   ✓ Region: $REGION"
echo ""

# Build and push
echo "2. Building Docker image..."
docker build -t "gcr.io/$PROJECT_ID/cscx-api:$IMAGE_TAG" .

echo ""
echo "3. Pushing to Container Registry..."
docker push "gcr.io/$PROJECT_ID/cscx-api:$IMAGE_TAG"

echo ""
echo "4. Deploying to Cloud Run (staging)..."
gcloud run deploy "$SERVICE_NAME" \
    --image "gcr.io/$PROJECT_ID/cscx-api:$IMAGE_TAG" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --set-env-vars "NODE_ENV=staging" \
    --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"

echo ""
echo "5. Getting service URL..."
STAGING_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format "value(status.url)")
echo "   Staging URL: $STAGING_URL"

echo ""
echo "6. Running smoke tests..."
echo "   Testing health endpoint..."
curl -sf "$STAGING_URL/health" | jq .

echo ""
echo "   Testing liveness..."
curl -sf "$STAGING_URL/health/live" | jq .

echo ""
echo "   Testing readiness..."
curl -sf "$STAGING_URL/health/ready" | jq .

echo ""
echo "=== Staging Deployment Complete ==="
echo "URL: $STAGING_URL"
echo ""
echo "Next steps:"
echo "  1. Run full smoke tests: ./scripts/smoke-test.sh $STAGING_URL"
echo "  2. If passing, promote to production: ./scripts/deploy-production.sh"
