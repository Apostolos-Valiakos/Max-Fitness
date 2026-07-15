#!/usr/bin/env bash
# Tails logs for one service, or every service if none is given.
# Usage: deploy/logs.sh [service-name]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

set -a
[ -f supabase/.env ] && source supabase/.env
[ -f deploy/.env ] && source deploy/.env
set +a

docker compose -f supabase/docker-compose.yml -f deploy/docker-compose.yml logs -f --tail=200 "$@"
