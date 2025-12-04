#!/usr/bin/env bash

# Deploy remoto su VPS con Docker (build+run sul VPS)
# Default: host 45.85.146.77, user root, branch master, path /root/sexylara

set -euo pipefail

# ---------- Config overridabili via env ----------
VPS_HOST="${VPS_HOST:-45.85.146.77}"
VPS_USER="${VPS_USER:-root}"
# Opzioni di auth: SSH_PASS (usa sshpass) oppure SSH_KEY (path); altrimenti agent/default.
SSH_PASS="${SSH_PASS:-}"
SSH_KEY="${SSH_KEY:-}"

REMOTE_PROJECT_ROOT="${REMOTE_PROJECT_ROOT:-/root/sexylara}"
GIT_BRANCH="${GIT_BRANCH:-master}"
DOCKER_IMAGE="${DOCKER_IMAGE:-sexylara-backend:latest}"
DOCKER_CONTAINER="${DOCKER_CONTAINER:-sexylara-backend}"
ENV_FILE="${ENV_FILE:-.env}"
# -------------------------------------------------

echo "--- Deploy started at $(date)"
echo "Target: ${VPS_USER}@${VPS_HOST} | branch: ${GIT_BRANCH} | path: ${REMOTE_PROJECT_ROOT}"

# Costruisci comando SSH e SCP
SSH_BASE_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"
if [[ -n "$SSH_KEY" ]]; then
  SSH_CMD=(ssh $SSH_BASE_OPTS -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}")
  SCP_CMD=(scp $SSH_BASE_OPTS -i "$SSH_KEY")
elif [[ -n "$SSH_PASS" ]]; then
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "Error: sshpass non presente. Installa sshpass o usa SSH_KEY/agent."
    exit 1
  fi
  SSH_CMD=(sshpass -p "$SSH_PASS" ssh $SSH_BASE_OPTS "${VPS_USER}@${VPS_HOST}")
  SCP_CMD=(sshpass -p "$SSH_PASS" scp $SSH_BASE_OPTS)
else
  SSH_CMD=(ssh $SSH_BASE_OPTS "${VPS_USER}@${VPS_HOST}")
  SCP_CMD=(scp $SSH_BASE_OPTS)
fi

echo "[Local] Uploading env file: backend/$ENV_FILE -> $REMOTE_PROJECT_ROOT/backend/$ENV_FILE"
"${SCP_CMD[@]}" "backend/$ENV_FILE" "${VPS_USER}@${VPS_HOST}:${REMOTE_PROJECT_ROOT}/backend/$ENV_FILE"

"${SSH_CMD[@]}" bash -s <<REMOTESCRIPT
set -euo pipefail
PROJECT_ROOT="${REMOTE_PROJECT_ROOT}"
BRANCH="${GIT_BRANCH}"
IMG="${DOCKER_IMAGE}"
CTR="${DOCKER_CONTAINER}"
ENVF="${ENV_FILE}"

echo "[VPS] Navigating to project root: \$PROJECT_ROOT"
cd "\$PROJECT_ROOT"

echo "[VPS] Stashing local changes and cleaning untracked files"
git add -A
git stash
git clean -fd

echo "[VPS] Fetching and resetting to branch: \$BRANCH"
git fetch origin
git checkout "\$BRANCH"
git reset --hard "origin/\$BRANCH"

echo "[VPS] Navigating to backend directory"
cd "\$PROJECT_ROOT/backend"

echo "[VPS] Building Docker image: \$IMG"
docker build -t "\$IMG" .

echo "[VPS] Stopping and removing old containers"
docker stop sexylara sexylara-backend 2>/dev/null || true
docker rm sexylara sexylara-backend 2>/dev/null || true

echo "[VPS] Starting new container: \$CTR"
docker run -d \\
  --name "\$CTR" \\
  -p 5000:4000 \\
  -p 5001:5001 \\
  --env-file "\$PROJECT_ROOT/backend/\$ENVF" \\
  "\$IMG"

echo "[VPS] Waiting for container to start..."
sleep 3

echo "[VPS] Container status:"
docker ps --filter "name=\$CTR" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "[VPS] Recent logs:"
docker logs "\$CTR" --tail 30
REMOTESCRIPT

echo "--- Deploy completed at $(date)"
echo ""
echo "✅ Deploy completato! Verifica i log con:"
echo "   ssh ${VPS_USER}@${VPS_HOST} 'docker logs -f ${DOCKER_CONTAINER}'"
