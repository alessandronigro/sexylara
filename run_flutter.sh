#!/usr/bin/env bash
set -euo pipefail

# Default device ID can be overridden via the first positional argument.
device="${1:-23078PND5G}"

# Backend host should be reachable from the phone; override with BACKEND_HOST if needed.
backendHost="${BACKEND_HOST:-192.168.1.42}"

flutter run -d "$device" \
  --dart-define=SUPABASE_URL=https://tnxdohjldclgbyadgdnt.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueGRvaGpsZGNsZ2J5YWRnZG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMDU3NTMsImV4cCI6MjA2Nzc4MTc1M30.2XpS-omdK4QTm2tlgvg__Re9K-w4bj_AF-hYIM7B-oA \
  --dart-define=GOOGLE_WEB_CLIENT_ID=750128796417-8in1f8vipmjpnpuuqsb08deobnujvn4n.apps.googleusercontent.com \
  --dart-define=GOOGLE_ANDROID_CLIENT_ID=750128796417-2o1fer0do3hqfi1788ehf7soh2pb3kkd.apps.googleusercontent.com \
  --dart-define=BACKEND_BASE_URL=http://$backendHost:4000 \
  --dart-define=AI_SERVICE_URL=http://$backendHost:5001 \
  --dart-define=WS_BASE_URL=ws://$backendHost:5001
