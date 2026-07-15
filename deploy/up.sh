#!/usr/bin/env bash
# Brings up the whole stack: Supabase services + Caddy + both frontend apps.
# Run from anywhere — paths are resolved relative to this script.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

for f in supabase/.env deploy/.env; do
  if [ ! -f "$f" ]; then
    echo "Missing $f — copy ${f}.production.example or ${f}.example and fill it in first." >&2
    exit 1
  fi
done

# Export both env files into the real process environment so every ${VAR}
# reference in either compose file resolves, regardless of Compose's default
# .env auto-load (which only looks in the first -f file's directory).
set -a
source supabase/.env
source deploy/.env
set +a

docker compose --project-directory . -f supabase/docker-compose.yml -f deploy/docker-compose.yml up -d --build "$@"
