#!/usr/bin/env bash
###############################################################################
#  dev.sh — Max Fitness dev helper (Supabase CLI version)
#
#  ./dev.sh start    — start Supabase stack
#  ./dev.sh stop     — stop stack (data preserved)
#  ./dev.sh reset    — wipe all local data and restart fresh
#  ./dev.sh status   — show running services + keys
#  ./dev.sh studio   — open Studio in browser
#  ./dev.sh psql     — open psql shell
#  ./dev.sh types    — regenerate TypeScript types from schema
#  ./dev.sh migrate  — push pending migrations to local DB
###############################################################################

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

cmd="${1:-help}"

case "$cmd" in

  start)
    info "Starting Supabase stack..."
    npx supabase start
    info ""
    info "Stack is up. Open Studio → http://127.0.0.1:54323"
    ;;

  app)
    info "Starting mobile app dev server (Node 22)..."
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use 22
    cd mobile-app && npm run dev
    ;;

  admin)
    info "Starting admin portal dev server (Node 22) → http://localhost:5174"
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && nvm use 22
    cd admin-portal && npm run dev
    ;;

  stop)
    info "Stopping stack (data preserved)..."
    npx supabase stop
    ;;

  reset)
    warn "This will DESTROY all local data. Are you sure? [y/N]"
    read -r confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
    npx supabase db reset
    info "Database reset complete."
    ;;

  status)
    npx supabase status --output env
    ;;

  studio)
    info "Opening Studio..."
    xdg-open http://127.0.0.1:54323 2>/dev/null || open http://127.0.0.1:54323 2>/dev/null || \
      info "Open manually → http://127.0.0.1:54323"
    ;;

  psql)
    info "Opening psql shell..."
    psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
    ;;

  types)
    info "Generating TypeScript types from schema..."
    npx supabase gen types typescript \
      --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres \
      > mobile-app/src/lib/database.types.ts
    cp mobile-app/src/lib/database.types.ts admin-portal/src/lib/database.types.ts
    info "Types written to:"
    info "  mobile-app/src/lib/database.types.ts"
    info "  admin-portal/src/lib/database.types.ts"
    ;;

  migrate)
    info "Pushing migrations to local DB..."
    npx supabase db push --local
    ;;

  help|*)
    echo ""
    echo "  ./dev.sh start     Start the Supabase stack"
    echo "  ./dev.sh stop      Stop the stack (data kept)"
    echo "  ./dev.sh reset     Wipe local DB and reseed"
    echo "  ./dev.sh status    Show all URLs and keys"
    echo "  ./dev.sh studio    Open Studio in browser"
    echo "  ./dev.sh psql      Open psql shell"
    echo "  ./dev.sh types     Generate TypeScript types"
    echo "  ./dev.sh migrate   Push migrations to local DB"
    echo ""
    ;;
esac
