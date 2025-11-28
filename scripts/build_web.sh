#!/bin/bash

ENV_FILE="../env/production.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ERRORE: File $ENV_FILE non trovato!"
  exit 1
fi

echo "🔧 Caricamento variabili da $ENV_FILE..."
set -a
source "$ENV_FILE"
set +a

echo "🏠 Build Web LOCAL per ThrillMe..."

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

if [ $? -eq 0 ]; then
  echo "✅ Build web completata!"
  cd build/web
  python3 -m http.server 8080 --bind 192.168.1.42
else
  echo "❌ Build fallita!"
  exit 1
fi