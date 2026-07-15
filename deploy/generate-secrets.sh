#!/usr/bin/env bash
# Generates the secrets supabase/.env.production.example asks for:
# POSTGRES_PASSWORD, JWT_SECRET, and the ANON_KEY/SERVICE_ROLE_KEY JWTs
# derived from it. Prints everything — paste the output into supabase/.env.
#
# Uses only openssl + python3 stdlib (hmac/hashlib/base64/json) — no extra
# dependencies to install on a fresh VPS.
set -euo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required (stdlib only, no pip installs needed)." >&2
  exit 1
fi

POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n=+/' | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-48)

read -r ANON_KEY SERVICE_ROLE_KEY <<PYEOF
$(JWT_SECRET="$JWT_SECRET" python3 - <<'PY'
import base64, hashlib, hmac, json, os, time

secret = os.environ["JWT_SECRET"].encode()
now = int(time.time())
exp = now + 60 * 60 * 24 * 365 * 10  # ~10 years, matches existing dev keys

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def sign(role: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"role": role, "iss": "supabase", "iat": now, "exp": exp}
    signing_input = f"{b64url(json.dumps(header, separators=(',', ':')).encode())}." \
                    f"{b64url(json.dumps(payload, separators=(',', ':')).encode())}"
    signature = hmac.new(secret, signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{b64url(signature)}"

print(sign("anon"), sign("service_role"))
PY
)
PYEOF

cat <<EOF

# ── Paste these into supabase/.env ─────────────────────────
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
# ─────────────────────────────────────────────────────────

Keep these somewhere safe outside the repo too (e.g. a password manager).
Regenerating JWT_SECRET after go-live invalidates every issued session.
EOF
