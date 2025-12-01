#!/bin/bash
set -euo pipefail

# Deploy ThrilMe Backend to VPS
# Usage: ./scripts/deploy-to-vps.sh

VPS_HOST="45.85.146.77"
VPS_USER="root"
VPS_PASS="*Giuseppe78"

SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting deployment to VPS..."

# Check if backend/.env exists
if [ ! -f "$REPO_ROOT/backend/.env" ]; then
  echo "⚠️  WARNING: backend/.env not found! The deployment might fail without secrets."
fi

echo "📦 Compressing backend folder..."
# Create tarball excluding node_modules and .git
cd "$REPO_ROOT"
tar -czf backend.tar.gz --exclude='node_modules' --exclude='.git' backend

echo "📤 Uploading backend to VPS..."
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass could not be found. Please install it (brew install sshpass)."
    exit 1
fi

sshpass -p "$VPS_PASS" scp "$REPO_ROOT/backend.tar.gz" ${VPS_USER}@${VPS_HOST}:/tmp/

echo "🔧 Executing deployment on VPS..."
sshpass -p "$VPS_PASS" ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
    set -e
    
    echo "📦 Installing Docker if not present..."
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sh
        systemctl start docker
        systemctl enable docker
    fi

    echo "📂 Extracting backend..."
    cd /root
    # Remove old folder to ensure clean state (optional, but good for syncing)
    rm -rf sexylara/backend
    mkdir -p sexylara
    
    # Extract to temp location first or directly
    tar -xzf /tmp/backend.tar.gz -C sexylara
    rm /tmp/backend.tar.gz

    cd sexylara/backend

    echo "🐳 Building Docker image..."
    docker build -t sexylara-backend .

    echo "🛑 Stopping old container if exists..."
    docker stop sexylara 2>/dev/null || true
    docker rm sexylara 2>/dev/null || true

    echo "♻️ Restarting Docker service..."
    systemctl restart docker
    sleep 2

    echo "🧹 Cleaning up ports..."
    fuser -k -9 4000/tcp 2>/dev/null || true
    fuser -k -9 5001/tcp 2>/dev/null || true
    sleep 2

    echo "🚀 Starting new container..."
    # We use the .env file that was included in the tarball
    docker run -d \
      --name sexylara \
      -p 4000:4000 \
      -p 5001:5001 \
      --restart always \
      sexylara-backend

    echo "✅ Deployment complete!"
    echo "🌐 API available at: http://localhost:4000"
    
    docker logs sexylara --tail 20
EOF

# Cleanup local tar
rm "$REPO_ROOT/backend.tar.gz"

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 API: https://thril.me"
echo "🔌 WebSocket: wss://thril.me"
