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
flutter gen-l10n

flutter build web \
  --output="$REPO_ROOT/build/web-local" \
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
cd "$REPO_ROOT/build/web-local"
pids=$(lsof -ti tcp:8080 || true)
if [ -n "$pids" ]; then
  echo "⚠️ Porta 8080 già in uso, chiudo il processo esistente: $pids"
  kill $pids
fi
echo "🌐 Avvio server locale con fallback SPA su 192.168.1.42:8080..."
python3 - "$BACKEND_BASE_URL" <<'PY'
import http.server
import os
import socketserver
from urllib.parse import unquote

HOST = "192.168.1.42"
PORT = 8080
ROOT = os.path.abspath(os.getcwd())


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Serve static files if they exist, otherwise fallback to index.html (SPA routing).
        path = unquote(path.split("?", 1)[0].split("#", 1)[0])
        full_path = os.path.join(ROOT, path.lstrip("/"))
        if os.path.isdir(full_path):
            index = os.path.join(full_path, "index.html")
            if os.path.exists(index):
                return index
        if os.path.exists(full_path):
            return full_path
        return os.path.join(ROOT, "index.html")

    def log_message(self, format, *args):
        # Cleaner logs
        return super().log_message(format, *args)


with socketserver.TCPServer((HOST, PORT), SPAHandler) as httpd:
    httpd.allow_reuse_address = True
    print(f"✅ Server statico con fallback SPA in esecuzione su http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹️  Arresto server locale.")
PY
