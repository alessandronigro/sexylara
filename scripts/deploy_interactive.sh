#!/usr/bin/env bash

# Wrapper interattivo per deploy_vps.sh
# Chiede la password SSH e la passa allo script di deploy

set -euo pipefail

echo "🚀 Deploy SexyLara su VPS"
echo "=========================="
echo ""
echo "Host: ${VPS_HOST:-45.85.146.77}"
echo "User: ${VPS_USER:-root}"
echo "Branch: ${GIT_BRANCH:-main}"
echo ""
echo -n "Inserisci la password SSH: "
read -s SSH_PASSWORD
echo ""
echo ""

export SSH_PASS="$SSH_PASSWORD"

# Esegui lo script di deploy
exec "$(dirname "$0")/deploy_vps.sh"
