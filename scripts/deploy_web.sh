#!/bin/bash

# ========================================================
# SCRIPT UNIFICATO: BUILD & DEPLOY WEB
# ========================================================
# 1. Compila l'applicazione Flutter Web con configurazione PROD
# 2. Effettua il deploy sul VPS
# ========================================================

set -euo pipefail

# --- CONFIGURAZIONE VPS ---
VPS_HOST="45.85.146.77"
VPS_USER="root"
VPS_PASS="*Giuseppe78"
VPS_DEST="/var/www/thrilme"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# --- CONFIGURAZIONE PATH ---
SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/env/production.env"

echo "🚀 INIZIO PROCESSO DI BUILD & DEPLOY"
echo "========================================================"

# --------------------------------------------------------
# FASE 1: BUILD
# --------------------------------------------------------
echo ""
echo "🔨 FASE 1: BUILD FLUTTER WEB"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ERRORE: File $ENV_FILE non trovato!"
  exit 1
fi

echo "🔧 Caricamento variabili da $ENV_FILE..."
set -a
source "$ENV_FILE"
set +a

cd "$REPO_ROOT"

echo "🧹 Pulizia cache..."
flutter clean > /dev/null
flutter pub get > /dev/null

echo "🏗️  Compilazione in corso (Release)..."
flutter build web \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=GOOGLE_WEB_CLIENT_ID="$GOOGLE_WEB_CLIENT_ID" \
  --dart-define=BACKEND_BASE_URL="$BACKEND_BASE_URL" \
  --dart-define=AI_SERVICE_URL="$AI_SERVICE_URL" \
  --dart-define=WS_BASE_URL="$WS_BASE_URL" \
  --dart-define=FLUTTER_WEB_USE_SKIA="$FLUTTER_WEB_USE_SKIA" \
  --dart-define=FLUTTER_WEB_USE_SKWASM="$FLUTTER_WEB_USE_SKWASM" \
  --release --no-tree-shake-icons

echo "✅ Build completata con successo!"

# --------------------------------------------------------
# FASE 2: DEPLOY
# --------------------------------------------------------
echo ""
echo "🚀 FASE 2: DEPLOY SU VPS ($VPS_HOST)"

# Verifica se sshpass è installato per usare la password
USE_SSHPASS=false
if command -v sshpass &> /dev/null; then
    USE_SSHPASS=true
    echo "🔑 sshpass rilevato: userò la password fornita."
else
    echo "⚠️  sshpass non trovato: dovrai inserire la password manualmente ($VPS_PASS)."
fi

# Funzione wrapper per SSH/SCP
run_ssh() {
    if [ "$USE_SSHPASS" = true ]; then
        sshpass -p "$VPS_PASS" ssh $SSH_OPTS "$@"
    else
        ssh $SSH_OPTS "$@"
    fi
}

run_scp() {
    if [ "$USE_SSHPASS" = true ]; then
        sshpass -p "$VPS_PASS" scp $SSH_OPTS -r "$@"
    else
        scp $SSH_OPTS -r "$@"
    fi
}

echo "🧹 Pulizia directory remota ($VPS_DEST)..."
run_ssh ${VPS_USER}@${VPS_HOST} "rm -rf ${VPS_DEST}/*"

echo "📤 Upload file in corso..."
run_scp "$REPO_ROOT/build/web/"* ${VPS_USER}@${VPS_HOST}:${VPS_DEST}/

echo ""
echo "========================================================"
echo "✅ DEPLOY COMPLETATO CON SUCCESSO!"
echo "🌐 App disponibile su: http://$VPS_HOST (o dominio configurato)"
echo "========================================================"
