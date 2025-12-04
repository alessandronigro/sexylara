#!/usr/bin/env bash

# Script di monitoraggio log per SexyLara VPS
# Monitora i log del container Docker in tempo reale

set -euo pipefail

VPS_HOST="${VPS_HOST:-45.85.146.77}"
VPS_USER="${VPS_USER:-root}"
SSH_PASS="${SSH_PASS:-}"
CONTAINER="${CONTAINER:-sexylara-backend}"

echo "🔍 Monitoraggio log SexyLara"
echo "=============================="
echo "Container: ${CONTAINER}"
echo "VPS: ${VPS_USER}@${VPS_HOST}"
echo ""

# Costruisci comando SSH
if [[ -n "$SSH_PASS" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "Error: sshpass non presente. Usa SSH_KEY o configura chiave SSH."
    exit 1
  fi
  SSH_CMD="sshpass -p '$SSH_PASS' ssh -o StrictHostKeyChecking=no"
else
  SSH_CMD="ssh -o StrictHostKeyChecking=no"
fi

echo "📊 Status PM2:"
$SSH_CMD ${VPS_USER}@${VPS_HOST} "docker exec ${CONTAINER} pm2 list"
echo ""

echo "🔴 Ultimi errori API (se presenti):"
$SSH_CMD ${VPS_USER}@${VPS_HOST} "docker exec ${CONTAINER} pm2 logs api --err --lines 20 --nostream" || echo "Nessun errore API"
echo ""

echo "🔴 Ultimi errori WebSocket (se presenti):"
$SSH_CMD ${VPS_USER}@${VPS_HOST} "docker exec ${CONTAINER} pm2 logs ws --err --lines 20 --nostream" || echo "Nessun errore WS"
echo ""

echo "✅ Ultimi log API:"
$SSH_CMD ${VPS_USER}@${VPS_HOST} "docker exec ${CONTAINER} pm2 logs api --out --lines 10 --nostream"
echo ""

echo "✅ Ultimi log WebSocket:"
$SSH_CMD ${VPS_USER}@${VPS_HOST} "docker exec ${CONTAINER} pm2 logs ws --out --lines 10 --nostream"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Per monitoraggio continuo usa:"
echo "   SSH_PASS='*Giuseppe78' ./scripts/monitor_logs.sh"
echo "   oppure:"
echo "   ssh ${VPS_USER}@${VPS_HOST} 'docker logs -f ${CONTAINER}'"
