#!/bin/bash

# CSCX.AI Google Cloud Deployment Script
# Usage: ./scripts/deploy-gcp.sh [--project PROJECT_ID] [--region REGION]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
PROJECT_ID=""
REGION="us-central1"
SERVICE_NAME="cscx-api"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════╗"
echo "║       CSCX.AI Deployment Script           ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}Error: gcloud CLI is not installed${NC}"
  echo "Install from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Get project ID if not provided
if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
  if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: No project ID specified${NC}"
    echo "Use: gcloud config set project YOUR_PROJECT_ID"
    echo "Or:  ./deploy-gcp.sh --project YOUR_PROJECT_ID"
    exit 1
  fi
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "  Service:  $SERVICE_NAME"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

echo ""
echo -e "${GREEN}Step 1: Enabling required APIs...${NC}"
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project=$PROJECT_ID

echo ""
echo -e "${GREEN}Step 2: Building Docker image...${NC}"
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .

echo ""
echo -e "${GREEN}Step 3: Configuring Docker for GCR...${NC}"
gcloud auth configure-docker --quiet

echo ""
echo -e "${GREEN}Step 4: Pushing image to Container Registry...${NC}"
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

echo ""
echo -e "${GREEN}Step 5: Deploying to Cloud Run...${NC}"

# Check if secrets exist
echo "Checking secrets..."
SECRETS_EXIST=true
for SECRET in GEMINI_API_KEY ANTHROPIC_API_KEY SUPABASE_URL SUPABASE_SERVICE_KEY; do
  if ! gcloud secrets describe $SECRET --project=$PROJECT_ID &>/dev/null; then
    echo -e "${YELLOW}Warning: Secret $SECRET does not exist${NC}"
    SECRETS_EXIST=false
  fi
done

if [ "$SECRETS_EXIST" = true ]; then
  # Deploy with secrets
  gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_SERVICE_KEY=SUPABASE_SERVICE_KEY:latest" \
    --set-env-vars="NODE_ENV=production,PORT=8080" \
    --project=$PROJECT_ID
else
  echo -e "${YELLOW}Deploying without secrets (set them later)${NC}"
  gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars="NODE_ENV=production,PORT=8080" \
    --project=$PROJECT_ID
fi

echo ""
echo -e "${GREEN}Step 6: Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project=$PROJECT_ID --format='value(status.url)')

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Deployment Complete!                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "Service URL: ${YELLOW}$SERVICE_URL${NC}"
echo ""
echo "Next steps:"
echo "  1. Test the API: curl $SERVICE_URL/health"
echo "  2. Set up secrets if not done: gcloud secrets create SECRET_NAME --data-file=-"
echo "  3. Configure custom domain (optional)"
echo ""
