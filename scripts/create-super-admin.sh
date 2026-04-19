#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  create-super-admin.sh
#  Provisions the SkoolMate OS Super Admin account via the setup-admin API.
#  Run ONCE after the app server is started.
#  Usage:  bash scripts/create-super-admin.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

NAME="SkoolMate Admin"
PHONE="0789000000"
PASSWORD="Admin@2026X!"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║      SkoolMate OS — Super Admin Setup            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "  API endpoint : $BASE_URL/api/setup-admin"
echo "  Name         : $NAME"
echo "  Phone        : $PHONE"
echo "  Password     : $PASSWORD"
echo ""

RESPONSE=$(curl -s -o /tmp/sa_response.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/setup-admin" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\",\"phone\":\"$PHONE\",\"password\":\"$PASSWORD\"}")

BODY=$(cat /tmp/sa_response.json)

echo "  HTTP Status  : $RESPONSE"
echo "  Response     : $BODY"
echo ""

if [ "$RESPONSE" -eq 201 ]; then
  echo "✅  Super Admin created successfully!"
  echo ""
  echo "  ┌─────────────────────────────────────────────┐"
  echo "  │  LOGIN CREDENTIALS (save these securely)    │"
  echo "  │                                             │"
  echo "  │  Phone    : $PHONE                     │"
  echo "  │  Password : $PASSWORD               │"
  echo "  │  URL      : $BASE_URL                  │"
  echo "  └─────────────────────────────────────────────┘"
elif [ "$RESPONSE" -eq 409 ] || echo "$BODY" | grep -qi "already"; then
  echo "ℹ️   Super Admin already exists — credentials unchanged."
  echo ""
  echo "  Phone    : $PHONE"
  echo "  Password : $PASSWORD"
else
  echo "❌  Setup failed (HTTP $RESPONSE)"
  echo "    $BODY"
  exit 1
fi
