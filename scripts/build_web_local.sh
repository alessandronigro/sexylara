#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/env/local.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ERRORE: File $ENV_FILE non trovato!"
  exit 1
fi

echo "🔧 Caricamento variabili da $ENV_FILE..."
set -a
source "$ENV_FILE"
set +a

echo "🏠 Build Web LOCAL per ThrillMe..."

cd "$REPO_ROOT"

flutter clean
flutter pub get

flutter build web \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=GOOGLE_WEB_CLIENT_ID="$GOOGLE_WEB_CLIENT_ID" \
  --dart-define=BACKEND_BASE_URL="$BACKEND_BASE_URL" \
  --dart-define=AI_SERVICE_URL="$AI_SERVICE_URL" \
  --dart-define=WS_BASE_URL="$WS_BASE_URL" \
  --dart-define=FLUTTER_WEB_USE_SKIA="$FLUTTER_WEB_USE_SKIA" \
  --dart-define=FLUTTER_WEB_USE_SKWASM="$FLUTTER_WEB_USE_SKWASM" \
  --release

echo "✅ Build web completata!"
cd "$REPO_ROOT/build/web"
pids=$(lsof -ti tcp:8080 || true)
if [ -n "$pids" ]; then
  echo "⚠️ Porta 8080 già in uso, chiudo il processo esistente: $pids"
  kill $pids
fi
python3 -m http.server 8080 --bind 192.168.1.42
