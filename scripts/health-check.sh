#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node dist/server.cjs >/tmp/sovereign-server.log 2>&1 &
server_pid=$!
trap 'kill $server_pid >/dev/null 2>&1 || true' EXIT
sleep 5
curl -fsS http://127.0.0.1:3000/api/health >/dev/null
kill $server_pid >/dev/null 2>&1 || true
wait $server_pid 2>/dev/null || true
