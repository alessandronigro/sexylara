#!/usr/bin/env bash

# ------------------------------------------------------------
# Deploy script for Sexylara backend on a VPS
# ------------------------------------------------------------
# This script assumes the following:
#   • The project lives at /Applications/wwwroot/sexylara
#   • Node.js (>=18) and npm are installed on the VPS
#   • pm2 is installed globally (`npm i -g pm2`) for process management
#   • You have a valid REPLICATE_API_KEY set in the environment
#   • SSH access and proper permissions to the project directory
# ------------------------------------------------------------

set -euo pipefail

# ---------- Configuration ----------
PROJECT_ROOT="/Applications/wwwroot/sexylara"
APP_NAME="sexylara-backend"
PM2_PROCESS_NAME="sexylara"
# Branch to deploy – change if you use a different branch
GIT_BRANCH="main"
# ------------------------------------------------------------

echo "--- Deploy started at $(date)"

# 1️⃣ Ensure we are in the project directory
cd "$PROJECT_ROOT"

# 2️⃣ Pull latest code from git
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Fetching latest code from git..."
  git fetch origin
  git checkout $GIT_BRANCH
  git reset --hard origin/$GIT_BRANCH
else
  echo "Error: $PROJECT_ROOT is not a git repository. Exiting."
  exit 1
fi

# 3️⃣ Install / update npm dependencies
echo "Installing npm dependencies..."
npm ci

# 4️⃣ Build step (uncomment if needed)
# npm run build

# 5️⃣ Restart or start the application with pm2
if pm2 list | grep -q "$PM2_PROCESS_NAME"; then
  echo "Restarting existing pm2 process…"
  pm2 restart "$PM2_PROCESS_NAME"
else
  echo "Starting new pm2 process…"
  pm2 start "npm" --name "$PM2_PROCESS_NAME" -- run dev
fi

# 6️⃣ Save pm2 process list for auto‑restart on server reboot
pm2 save

echo "--- Deploy completed successfully at $(date)"
