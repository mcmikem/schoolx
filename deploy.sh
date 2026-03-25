#!/bin/bash
# ============================================
# OMUTO SMS - Deployment Script
# For Vercel or similar platforms
# ============================================

echo "🚀 Omuto SMS Deployment Script"
echo "=============================="

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ .env.local not found!"
  echo "Create .env.local with your Supabase credentials:"
  echo "  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
  echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
  exit 1
fi

echo "✅ Environment file found"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building..."
npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
  echo ""
  echo "📋 Next Steps:"
  echo "1. Push to GitHub: git push origin main"
  echo "2. Deploy to Vercel: vercel --prod"
  echo "3. Set environment variables in Vercel dashboard"
  echo "4. Run SQL setup in Supabase SQL Editor"
else
  echo "❌ Build failed. Check errors above."
  exit 1
fi
