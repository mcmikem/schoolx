#!/bin/bash

# ============================================
# Omuto SMS - Database Setup Script
# ============================================
# Run this script to initialize your Supabase database
# 
# Usage: bash scripts/setup-database.sh
#
# Requirements:
# - Supabase CLI installed: https://github.com/supabase/cli
# - Or use Supabase Dashboard SQL Editor
# ============================================

set -e

echo "🔧 Omuto SMS Database Setup"
echo "=============================="

# Check for Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo "   Install from: https://github.com/supabase/cli"
    echo "   Or use Supabase Dashboard → SQL Editor"
    exit 1
fi

# Check if linked to a project
if [ ! -f supabase/config.toml ]; then
    echo "❌ Not linked to a Supabase project"
    echo "   Run: supabase link --project-ref <your-project-ref>"
    exit 1
fi

echo "✅ Linked to Supabase project"

# Push schema
echo "📊 Running schema migrations..."
supabase db push

echo "✅ Database schema applied"

# Seed data (optional)
read -p "Add demo data? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Seeding demo data..."
    psql -h db.$PROJECT_ID.supabase.co -U postgres -d postgres -f supabase/seed.sql
    echo "✅ Demo data added"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your Supabase URL and keys to .env.local"
echo "2. Run: npm run dev"
echo "3. Open: http://localhost:3000"