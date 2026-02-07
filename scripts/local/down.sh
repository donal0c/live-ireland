#!/usr/bin/env bash
set -euo pipefail

docker compose -f docker-compose.local.yml down
supabase stop

echo "Local infra stopped"
