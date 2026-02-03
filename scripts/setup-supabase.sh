#!/bin/bash
# CSCX.AI Supabase Setup Script

echo "=================================="
echo "  CSCX.AI Supabase Setup"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Create Supabase Project${NC}"
echo "   1. Go to https://supabase.com"
echo "   2. Sign up or log in"
echo "   3. Click 'New Project'"
echo "   4. Name it 'cscx-ai' (or similar)"
echo "   5. Set a secure database password"
echo "   6. Choose a region close to you"
echo "   7. Click 'Create new project'"
echo ""
echo -e "${YELLOW}Press Enter when project is created...${NC}"
read

echo -e "${BLUE}Step 2: Get Your API Keys${NC}"
echo "   1. Go to Project Settings > API"
echo "   2. Copy the 'Project URL' (looks like https://xxx.supabase.co)"
echo "   3. Copy the 'service_role' key (NOT the anon key)"
echo ""

read -p "Enter your Supabase Project URL: " SUPABASE_URL
read -p "Enter your Supabase Service Role Key: " SUPABASE_KEY

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo -e "${YELLOW}Skipping - you can add these later to server/.env${NC}"
else
    # Update server/.env
    if [ -f "server/.env" ]; then
        # Check if SUPABASE vars exist
        if grep -q "SUPABASE_URL" server/.env; then
            sed -i '' "s|SUPABASE_URL=.*|SUPABASE_URL=$SUPABASE_URL|" server/.env
            sed -i '' "s|SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$SUPABASE_KEY|" server/.env
        else
            echo "" >> server/.env
            echo "# Supabase Configuration" >> server/.env
            echo "SUPABASE_URL=$SUPABASE_URL" >> server/.env
            echo "SUPABASE_SERVICE_KEY=$SUPABASE_KEY" >> server/.env
        fi
        echo -e "${GREEN}Updated server/.env with Supabase credentials${NC}"
    else
        echo "SUPABASE_URL=$SUPABASE_URL" > server/.env
        echo "SUPABASE_SERVICE_KEY=$SUPABASE_KEY" >> server/.env
        echo -e "${GREEN}Created server/.env with Supabase credentials${NC}"
    fi
fi

echo ""
echo -e "${BLUE}Step 3: Create Database Tables${NC}"
echo "   1. Go to your Supabase Dashboard"
echo "   2. Click 'SQL Editor' in the sidebar"
echo "   3. Click 'New query'"
echo "   4. Copy the contents of database/schema.sql"
echo "   5. Paste into the SQL Editor"
echo "   6. Click 'Run' to execute"
echo ""
echo -e "${YELLOW}Press Enter when tables are created...${NC}"
read

echo ""
echo -e "${GREEN}=================================="
echo "  Setup Complete!"
echo "==================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart your backend server: cd server && npm run dev"
echo "  2. Test the connection - messages will be saved to database"
echo ""
echo "To add sample data, run this in SQL Editor:"
echo ""
echo "INSERT INTO customers (name, arr, industry, stage, health_score)"
echo "VALUES ('Meridian Capital Partners', 900000, 'Finance', 'onboarding', 87);"
echo ""
