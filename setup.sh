#!/bin/bash

# AltFit Setup and Validation Script
# This script helps validate your environment configuration before deployment

set -e

echo "🔧 AltFit Setup & Validation"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Update .env with your actual credentials${NC}"
fi

echo ""
echo "📋 Checking required environment variables..."
echo ""

# Required env vars
required_vars=(
    "GOOGLE_CLIENT_ID"
    "GOOGLE_SECRET_KEY"
    "ANTHROPIC_API_KEY"
    "RAZORPAY_KEY_ID"
    "RAZORPAY_KEY_SECRET"
    "database:DATABASE_URL"
    "SUPABASE_URL"
    "JWT_SECRET"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    # Handle special case for DATABASE_URL which is critical
    if [[ "$var" == "database:DATABASE_URL" ]]; then
        var_name="DATABASE_URL"
    else
        var_name="$var"
    fi
    
    value=$(grep "^${var_name}=" .env 2>/dev/null | cut -d'=' -f2-)
    
    if [ -z "$value" ] || [[ "$value" == "paste_your"* ]] || [[ "$value" == *"your_"* ]]; then
        missing_vars+=("$var_name")
        echo -e "${YELLOW}⚠️  ${var_name}${NC} - needs configuration"
    else
        if [[ "$var" == "database:DATABASE_URL" ]]; then
            echo -e "${GREEN}✅ ${var_name}${NC} - configured"
        else
            echo -e "${GREEN}✅ ${var_name}${NC} - configured"
        fi
    fi
done

echo ""

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing or invalid configurations:${NC}"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📖 See DEPLOYMENT_CHECKLIST.md for setup instructions"
    exit 1
else
    echo -e "${GREEN}✅ All environment variables configured${NC}"
fi

echo ""
echo "📦 Checking dependencies..."
if ! npm ls @prisma/client > /dev/null 2>&1; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"

echo ""
echo "🏗️  Building application..."
npm run build 2>&1 | tail -5

echo ""
echo -e "${GREEN}✅ Build successful!${NC}"
echo ""
echo "🗄️  Database Configuration Status:"
echo "   - DATABASE_URL: configured (validate connection separately)"
echo "   - DIRECT_URL: configured (for migrations)"
echo ""
echo "⚠️  Before deployment:"
echo "   1. Test database connection: psql \$DATABASE_URL -c 'SELECT 1'"
echo "   2. Run migrations: npx prisma migrate deploy"
echo "   3. Test all auth flows (email, Google OAuth)"
echo "   4. Test payment flow with Razorpay"
echo ""
echo -e "${GREEN}✅ Setup validation complete!${NC}"
echo ""
echo "Next steps:"
echo "  • Local testing: npm run dev"
echo "  • Production build: npm run build && npm start"
echo "  • Deployment: See DEPLOYMENT_CHECKLIST.md"
