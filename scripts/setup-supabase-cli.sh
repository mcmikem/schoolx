#!/bin/bash

# Setup Supabase CLI for your project

echo "Installing Supabase CLI..."
npm install -g supabase

echo ""
echo "Now linking your project to Supabase..."
echo "You'll need to provide your Supabase project reference"
echo ""
echo "Your Supabase URL: https://gucxpmgwvnbqykevucbi.supabase.co"
echo "Project ref (from URL): gucxpmgwvnbqykevucbi"
echo ""

# Try to link using the known project ref
echo "Attempting to link..."
echo "gucxpmgwvnbqykevucbi" | supabase link --project-ref gucxpmgwvnbqykevucbi 2>&1 || true

echo ""
echo "If linking failed, run manually:"
echo "  supabase link --project-ref gucxpmgwvnbqykevucbi"
echo ""
echo "Once linked, run:"
echo "  supabase db push"
echo ""
echo "Or to apply a specific migration:"
echo "  supabase db push --file supabase/migrations/20260411_onboarding_columns.sql"