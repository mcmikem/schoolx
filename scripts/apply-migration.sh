#!/bin/bash
# Apply migrations to Supabase

SUPABASE_URL="https://gucxpmgwvnbqykevucbi.supabase.co"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Y3hwbWd3dm5icXlrZXZ1Y2JpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE3NjYxMCwiZXhwIjoyMDg5NzUyNjEwfQ.u-yxVo_MfiXnoj6UlFZgcAsNinM0XY4PryIUp77O-7Y"

# Read SQL from file or argument
if [ -n "$1" ]; then
  SQL=$(cat "$1")
else
  SQL=$(cat)
fi

curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$SQL\"}"