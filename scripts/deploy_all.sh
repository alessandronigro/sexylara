#!/bin/bash

# ========================================================
# MASTER DEPLOY SCRIPT
# ========================================================
# Runs both backend and frontend deployment scripts.
# ========================================================

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"

# Define passwords if not set (for convenience, though risky in shared envs)
export SSH_PASS="${SSH_PASS:-*Giuseppe78}"

echo "🚀 STARTING FULL DEPLOYMENT"
echo "========================================================"

echo ""
echo "🔄 STEP 0: SYNC CODEBASE"
echo "--------------------------------------------------------"
if [[ -n $(git status -s) ]]; then
    echo "📝 Changes detected. Committing and pushing..."
    git add -A
    git commit -m "Auto-deploy update $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin master
else
    echo "✅ No local changes to commit. Pushing to be sure..."
    git push origin master
fi

echo ""
echo "📦 STEP 1: BACKEND DEPLOYMENT"
echo "--------------------------------------------------------"
"$SCRIPT_DIR/deploy_vps.sh"

echo ""
echo "🌐 STEP 2: FRONTEND DEPLOYMENT"
echo "--------------------------------------------------------"
"$SCRIPT_DIR/deploy_web.sh"

echo ""
echo "========================================================"
echo "✅ FULL DEPLOYMENT COMPLETED!"
echo "========================================================"
