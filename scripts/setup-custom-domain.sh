#!/bin/bash
# CSCX.AI Custom Domain Setup Script
# Run this to configure app.cscx.ai domain

set -e

echo "=== CSCX.AI Custom Domain Setup ==="
echo ""

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-cscx-ai-project}"
REGION="us-central1"
SERVICE_NAME="cscx-api"
DOMAIN="app.cscx.ai"

echo "Domain: $DOMAIN"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Check prerequisites
echo "1. Checking prerequisites..."

# Verify domain ownership (must be done in Google Search Console first)
echo "   NOTE: You must verify domain ownership in Google Search Console first:"
echo "   https://search.google.com/search-console/welcome"
echo ""

# Option A: Cloud Run Domain Mapping (native)
echo "2. Option A: Cloud Run Domain Mapping"
echo ""
echo "   Run the following commands:"
echo ""
echo "   # Create domain mapping"
echo "   gcloud beta run domain-mappings create \\"
echo "     --service=$SERVICE_NAME \\"
echo "     --domain=$DOMAIN \\"
echo "     --region=$REGION"
echo ""
echo "   # Get DNS records to configure"
echo "   gcloud beta run domain-mappings describe \\"
echo "     --domain=$DOMAIN \\"
echo "     --region=$REGION"
echo ""
echo "   Then add the CNAME/A records to your DNS provider."
echo ""

# Option B: Cloudflare (recommended for global CDN)
echo "3. Option B: Cloudflare Setup (Recommended)"
echo ""
echo "   a) Add cscx.ai domain to Cloudflare"
echo "   b) Update nameservers at your registrar"
echo "   c) Add DNS record:"
echo "      Type: CNAME"
echo "      Name: app"
echo "      Target: cscx-api-938520514616.us-central1.run.app"
echo "      Proxy: Enabled (orange cloud)"
echo "   d) SSL/TLS settings: Full (strict)"
echo "   e) Add Page Rule for caching:"
echo "      URL: app.cscx.ai/api/*"
echo "      Cache Level: Bypass"
echo ""

# Environment variable update
echo "4. After domain is live, update environment variables:"
echo ""
echo "   gcloud run services update $SERVICE_NAME \\"
echo "     --region=$REGION \\"
echo "     --set-env-vars=\"CORS_ORIGIN=https://$DOMAIN,VITE_API_URL=https://$DOMAIN\""
echo ""

# OAuth callback update
echo "5. Update Google OAuth authorized redirect URIs:"
echo ""
echo "   Add to Google Cloud Console > APIs & Services > Credentials:"
echo "   https://$DOMAIN/api/auth/google/callback"
echo ""

# Verification
echo "6. Verification commands (run after DNS propagation):"
echo ""
echo "   # Test HTTPS"
echo "   curl -I https://$DOMAIN"
echo ""
echo "   # Test health"
echo "   curl https://$DOMAIN/health"
echo ""
echo "   # Test redirect"
echo "   curl -I http://$DOMAIN"
echo ""

echo "=== Setup Instructions Complete ==="
