#!/usr/bin/env bash
# Puts OmniDoc online from this Mac: the site on Vercel, the API from this machine through a
# Cloudflare quick tunnel. Run it again after a restart; Ctrl+C takes the API offline.
#
#   deploy/go-live.sh
#
# Needs: backend/.venv, a model key in backend/.env (e.g. OPENROUTER_API_KEY), `vercel login`,
# and cloudflared (npm install -g cloudflared). The quick-tunnel address changes on every start,
# so each run rebuilds the site with the new address (about 2 minutes).
#
# The public API is a separate instance from your local one (port 8000): accounts are required
# and visitors' libraries live in backend/data/public, never in backend/data/library.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PUBLIC_API_PORT:-8001}"
SITE="${SITE_DOMAIN:-omnidoc-rag.vercel.app}"
LOGS="$ROOT/deploy/.logs"
DATA="$ROOT/backend/data/public"
mkdir -p "$LOGS" "$DATA/library"

pids=()
cleanup() { [ ${#pids[@]} -gt 0 ] && kill "${pids[@]}" 2>/dev/null; true; }
trap cleanup EXIT INT TERM

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is in use (a previous run?). Stop it first: lsof -tiTCP:$PORT -sTCP:LISTEN | xargs kill" >&2
  exit 1
fi

# A stable session-signing key, so visitors stay signed in across restarts.
[ -s "$DATA/secret.key" ] || (umask 077 && openssl rand -hex 32 > "$DATA/secret.key")

echo "1/3 Opening the tunnel"
# HTTP/2, not the default QUIC: over QUIC, request bodies larger than a few KB (PDF uploads) stalled.
cloudflared tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT" > "$LOGS/tunnel.log" 2>&1 &
pids+=($!)
API_URL=""
for _ in $(seq 60); do
  API_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/tunnel.log" | head -1 || true)"
  [ -n "$API_URL" ] && break
  sleep 1
done
[ -n "$API_URL" ] || { echo "The tunnel did not start; see $LOGS/tunnel.log" >&2; exit 1; }
echo "    API: $API_URL"

echo "2/3 Starting the public API on port $PORT"
(
  cd "$ROOT/backend"
  AUTH_ENABLED=true \
  SECRET_KEY="$(cat "$DATA/secret.key")" \
  LIBRARY_DIR="$DATA/library" \
  CORS_ORIGINS="https://$SITE" \
  exec .venv/bin/python -m uvicorn src.api.main:app --host 127.0.0.1 --port "$PORT" --workers 1
) > "$LOGS/api.log" 2>&1 &
pids+=($!)
for _ in $(seq 60); do curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null && break; sleep 1; done
curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null || { echo "The API did not start; see $LOGS/api.log" >&2; exit 1; }

echo "3/3 Rebuilding the site on Vercel with the new API address"
(cd "$ROOT/frontend" && vercel deploy --prod --yes --build-env NEXT_PUBLIC_API_URL="$API_URL" > "$LOGS/vercel.out" 2> "$LOGS/vercel.log") \
  || { echo "Vercel deploy failed; see $LOGS/vercel.log" >&2; exit 1; }

echo
echo "Live: https://$SITE  (API through $API_URL)"
echo "Logs: $LOGS. Keep this terminal open; Ctrl+C takes the API offline."
wait
