#!/bin/bash
set -e
cd "$(dirname "$0")"
PORT=8765
if command -v python3 >/dev/null 2>&1; then
  (sleep 1; open "http://localhost:${PORT}") &
  python3 -m http.server "$PORT"
elif command -v ruby >/dev/null 2>&1; then
  (sleep 1; open "http://localhost:${PORT}") &
  ruby -run -e httpd . -p "$PORT"
else
  echo "Python 3 または Ruby が必要です。"
  read -r
  exit 1
fi
