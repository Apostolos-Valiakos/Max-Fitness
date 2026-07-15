#!/usr/bin/env bash
# Stops the whole stack. Data volumes (db, storage, caddy certs) are kept —
# pass --volumes yourself if you explicitly want to wipe them.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

set -a
[ -f supabase/.env ] && source supabase/.env
[ -f deploy/.env ] && source deploy/.env
set +a

docker compose --project-directory . -f supabase/docker-compose.yml -f deploy/docker-compose.yml down "$@"
