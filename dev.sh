#!/usr/bin/env bash
# Start the API server + web client together for local dev.
# Edit any file, then just refresh the browser — Vite hot-reloads automatically.
#
#   ./dev.sh      then open http://localhost:5173
#
# Prereqs (one-time): server venv + deps, and `npm install` in client/.
# See README.md.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill both child processes when this script exits (e.g. Ctrl-C).
trap 'kill 0' EXIT

# API — FastAPI, auto-reloads on server code changes.
"$ROOT/server/.venv/bin/uvicorn" --app-dir "$ROOT/server" app.main:app --reload --port 8000 &

# Web — Vite, hot-reloads on client changes.
npm --prefix "$ROOT/client" run dev &

wait
