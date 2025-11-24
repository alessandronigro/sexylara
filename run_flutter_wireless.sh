#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------------------------
# CONFIGURAZIONE DISPOSITIVO WIRELESS
# --------------------------------------------------------------------
# Inserisci l'IP:PORTA che vedi in 
# Impostazioni → Opzioni sviluppatore → Debug wireless → "Indirizzo IP e porta"
WIRELESS_IP_PORT="192.168.1.235:36053"

# Device ID per Flutter (usa l'IP wireless)
device="${1:-$WIRELESS_IP_PORT}"

# Backend host (Locale)
backendHost="192.168.1.42"

# Local Backend URLs
backendBaseUrl="http://${backendHost}:4001"
aiServiceUrl="http://${backendHost}:4001" # Avatar generation is on API port 4001
wsBaseUrl="ws://${backendHost}:5001"

# Percorso ADB di Android Studio
ADB="$HOME/Library/Android/sdk/platform-tools/adb"

echo "🔄 Riavvio server ADB..."
$ADB kill-server || true
$ADB start-server

echo "📡 Connessione al dispositivo wireless: $WIRELESS_IP_PORT"
$ADB connect "$WIRELESS_IP_PORT" || {
  echo "❌ Errore: impossibile connettersi a $WIRELESS_IP_PORT"
  exit 1
}

echo "📱 Dispositivi trovati:"
$ADB devices

echo "🚀 Avvio Flutter su device: $device"
flutter run -d "$device" \
  --dart-define=SUPABASE_URL=https://tnxdohjldclgbyadgdnt.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueGRvaGpsZGNsZ2J5YWRnZG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMDU3NTMsImV4cCI6MjA2Nzc4MTc1M30.2XpS-omdK4QTm2tlgvg__Re9K-w4bj_AF-hYIM7B-oA \
  --dart-define=GOOGLE_WEB_CLIENT_ID=750128796417-8in1f8vipmjpnpuuqsb08deobnujvn4n.apps.googleusercontent.com \
  --dart-define=GOOGLE_ANDROID_CLIENT_ID=750128796417-2o1fer0do3hqfi1788ehf7soh2pb3kkd.apps.googleusercontent.com \
  --dart-define=BACKEND_BASE_URL="${backendBaseUrl}" \
  --dart-define=AI_SERVICE_URL="${aiServiceUrl}" \
  --dart-define=WS_BASE_URL="${wsBaseUrl}"
