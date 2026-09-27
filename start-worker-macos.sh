#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "[JARVIS] Node.js 18+ bulunamadi."
  echo "Node.js LTS kurup tekrar calistir."
  exit 1
fi
JARVIS_URL="${JARVIS_URL:-https://jarvis-os-1iuv.onrender.com}"
if [ -z "${JARVIS_TOKEN:-}" ]; then
  printf "JARVIS ACCESS KEY: "
  stty -echo
  read JARVIS_TOKEN
  stty echo
  printf "\n"
fi
if [ -z "$JARVIS_TOKEN" ]; then
  echo "[JARVIS] ACCESS KEY gerekli."
  exit 1
fi
JARVIS_WORKSPACE="${JARVIS_WORKSPACE:-$HOME/JARVIS-Workspace}"
export JARVIS_URL JARVIS_TOKEN JARVIS_WORKSPACE
echo "[JARVIS] Cloud: $JARVIS_URL"
echo "[JARVIS] Workspace: $JARVIS_WORKSPACE"
echo "[JARVIS] Worker baslatiliyor..."
exec node worker.js
