#!/usr/bin/env bash
set -euo pipefail

docker compose -f docker-compose.local.yml up -d redis
supabase start

echo "Local infra started: Redis + Supabase"
