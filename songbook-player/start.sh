#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Songbook Player – local development startup script
# Starts the Express API server + Vite React dev server.
# Usage:  ./start.sh [--install]
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"

INSTALL=false
for arg in "$@"; do
  [[ "$arg" == "--install" ]] && INSTALL=true
done

# ── Helpers ────────────────────────────────────────────────────
log()  { echo -e "\033[1;34m[songbook]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[songbook]\033[0m $*"; }
err()  { echo -e "\033[1;31m[songbook]\033[0m $*" >&2; }

# ── Prereqs ────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  err "Node.js not found. Install Node 18+ from https://nodejs.org"
  exit 1
fi
NODE_VER=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if (( NODE_VER < 18 )); then
  err "Node.js 18+ required (found v$NODE_VER)"
  exit 1
fi
ok "Node.js v$(node --version) ✓"

# ── Install dependencies ───────────────────────────────────────
install_if_needed() {
  local dir="$1"
  local name="$2"
  if [[ "$INSTALL" == true ]] || [[ ! -d "$dir/node_modules" ]]; then
    log "Installing $name dependencies…"
    (cd "$dir" && npm install)
    ok "$name dependencies installed"
  fi
}

install_if_needed "$SERVER_DIR" "server"
install_if_needed "$CLIENT_DIR" "client"

# ── Launch ─────────────────────────────────────────────────────
log "Starting API server on http://localhost:3001"
(cd "$SERVER_DIR" && node index.js) &
SERVER_PID=$!

# Give the server a moment to start
sleep 1

log "Starting React dev server on http://localhost:5173"
(cd "$CLIENT_DIR" && npm run dev) &
CLIENT_PID=$!

ok "Both processes started. Open http://localhost:5173 in your browser."
echo ""
echo "  API:    http://localhost:3001/api/songs"
echo "  App:    http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop both."

# ── Cleanup on exit ────────────────────────────────────────────
cleanup() {
  echo ""
  log "Shutting down…"
  kill "$CLIENT_PID" 2>/dev/null || true
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$CLIENT_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  ok "Done."
}
trap cleanup INT TERM

# Wait for both children
wait "$CLIENT_PID" "$SERVER_PID"
