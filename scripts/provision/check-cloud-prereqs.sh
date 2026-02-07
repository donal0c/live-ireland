#!/usr/bin/env bash
set -euo pipefail

missing=0

check_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing command: $1"
    missing=1
  else
    echo "ok command: $1"
  fi
}

check_env() {
  if [ -z "${!1:-}" ]; then
    echo "missing env: $1"
    missing=1
  else
    echo "ok env: $1"
  fi
}

check_cmd supabase
check_cmd flyctl

check_env SUPABASE_ACCESS_TOKEN
check_env SUPABASE_PROJECT_REF
check_env FLY_API_TOKEN
check_env FLY_APP_NAME

if [ "$missing" -eq 1 ]; then
  echo "cloud prerequisites are incomplete"
  exit 1
fi

echo "all cloud prerequisites present"
