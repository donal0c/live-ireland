#!/usr/bin/env bash
set -euo pipefail

: "${FLY_API_TOKEN:?FLY_API_TOKEN is required}"
: "${FLY_APP_NAME:?FLY_APP_NAME is required}"

if ! command -v flyctl >/dev/null 2>&1; then
  echo "flyctl not found. install from https://fly.io/docs/flyctl/install/"
  exit 1
fi

if ! flyctl apps list | grep -q "${FLY_APP_NAME}"; then
  flyctl apps create "$FLY_APP_NAME" --org personal
fi

if [ -n "${UPSTASH_REDIS_REST_URL:-}" ] && [ -n "${UPSTASH_REDIS_REST_TOKEN:-}" ]; then
  flyctl secrets set \
    UPSTASH_REDIS_REST_URL="$UPSTASH_REDIS_REST_URL" \
    UPSTASH_REDIS_REST_TOKEN="$UPSTASH_REDIS_REST_TOKEN" \
    --app "$FLY_APP_NAME"
fi

if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  flyctl secrets set \
    SUPABASE_URL="$SUPABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    --app "$FLY_APP_NAME"
fi

flyctl deploy \
  --app "$FLY_APP_NAME" \
  --config fly.api.toml \
  --dockerfile Dockerfile.api \
  --region dub

echo "fly deployment submitted"
