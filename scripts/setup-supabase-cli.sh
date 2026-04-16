#!/bin/bash

# Setup Supabase CLI for your project
# Usage: ./scripts/setup-supabase-cli.sh
# Required env vars: NEXT_PUBLIC_SUPABASE_URL

set -e

echo "Installing Supabase CLI..."
npm install -g supabase

echo ""
echo "Now linking your project to Supabase..."
echo "You'll need to provide your Supabase project reference"
echo ""

# Extract project ref from environment variable
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL is not set"
  echo "Please set it in your .env file:"
  echo "  NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co"
  exit 1
fi

# Extract project ref from URL (e.g., https://xyz.supabase.co -> xyz)
PROJECT_REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

echo "Your Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "Project ref (from URL): $PROJECT_REF"
echo ""

# Try to link using the extracted project ref
echo "Attempting to link..."
echo "$PROJECT_REF" | supabase link --project-ref "$PROJECT_REF" 2>&1 || true

echo ""
echo "If linking failed, run manually:"
echo "  supabase link --project-ref $PROJECT_REF"
echo ""
echo "Once linked, run:"
echo "  supabase db push"
