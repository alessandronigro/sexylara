#!/bin/bash

# Script to run database migration for adding allow_member_invite column
# Usage: ./run_migration.sh

set -e

echo "🔧 Running database migration: add_allow_member_invite"

# Load environment variables
if [ -f "env/local.env" ]; then
    source env/local.env
    echo "✅ Loaded local.env"
else
    echo "❌ env/local.env not found"
    exit 1
fi

# Check if required env vars are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not set"
    exit 1
fi

# Read migration file
MIGRATION_FILE="supabase/migrations/add_allow_member_invite.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Reading migration file..."
MIGRATION_SQL=$(cat "$MIGRATION_FILE")

# Execute migration using Supabase REST API
echo "🚀 Executing migration..."

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$MIGRATION_SQL" | jq -Rs .)}")

echo "📊 Response: $RESPONSE"

# Verify the column was added
echo "🔍 Verifying column exists..."
VERIFY_RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/groups?select=allow_member_invite&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}")

if echo "$VERIFY_RESPONSE" | grep -q "allow_member_invite"; then
    echo "✅ Migration successful! Column 'allow_member_invite' added to groups table"
else
    echo "⚠️  Could not verify column. Response: $VERIFY_RESPONSE"
fi

echo "✅ Migration complete!"
