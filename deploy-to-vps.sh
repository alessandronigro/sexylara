#!/bin/bash

# Deploy ThrilMe Backend to VPS
# Usage: ./deploy-to-vps.sh

VPS_HOST="45.85.146.77"
VPS_USER="root"
VPS_PASS="*Giuseppe78"

echo "🚀 Starting deployment to VPS..."

# Create deployment script
cat > /tmp/vps-deploy.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

echo "📦 Installing Docker if not present..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

echo "📂 Cloning repository..."
cd /root
if [ -d "sexylara" ]; then
    cd sexylara
    git pull
else
    git clone https://github.com/alessandronigro/sexylara.git
    cd sexylara
fi

echo "🔧 Creating .env file..."
cd backend
cat > .env << 'ENV_FILE'
PORT=5000
NEXT_PUBLIC_OPENROUTER_API_KEY=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
NEXT_PUBLIC_VENICE_API_KEY=SnFC1yfD__3kJT4YMLl6VnAxwQq72-KqvO8Gz9FPfd
ADDRESS_VENICE="https://api.venice.ai/api/v1/chat/completions"
MODEL_VENICE="venice-uncensored"
API_VENICE=SnFC1yfD__3kJT4YMLl6VnAxwQq72-KqvO8Gz9FPfd
SUPABASE_URL=https://tnxdohjldclgbyadgdnt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueGRvaGpsZGNsZ2J5YWRnZG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMDU3NTMsImV4cCI6MjA2Nzc4MTc1M30.2XpS-omdK4QTm2tlgvg__Re9K-w4bj_AF-hYIM7B-oA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueGRvaGpsZGNsZ2J5YWRnZG50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjIwNTc1MywiZXhwIjoyMDY3NzgxNzUzfQ.csGToPrCSQaQwamEcUR3mk1lsl9ou__63YWjwo-sCk0
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
REPLICATE_API_TOKEN=your_replicate_token
FRONTEND_URL=https://sexylara.chat
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
ENV_FILE

echo "🐳 Building Docker image..."
docker build -t sexylara-backend .

echo "🛑 Stopping old container if exists..."
docker stop sexylara 2>/dev/null || true
docker rm sexylara 2>/dev/null || true

echo "🚀 Starting new container..."
docker run -d \
  --name sexylara \
  -p 4000:4000 \
  -p 5001:5001 \
  --env-file .env \
  --restart always \
  sexylara-backend

echo "✅ Deployment complete!"
echo "🌐 API available at: http://sexylara.chat"
echo "🔌 WebSocket available at: ws://sexylara.chat"
echo "📂 Static files served from /var/www/thrilme"

docker logs sexylara --tail 50
DEPLOY_SCRIPT

# Copy and execute on VPS
echo "📤 Uploading deployment script to VPS..."
scp /tmp/vps-deploy.sh ${VPS_USER}@${VPS_HOST}:/tmp/

echo "🔧 Executing deployment on VPS..."
ssh ${VPS_USER}@${VPS_HOST} "bash /tmp/vps-deploy.sh"

echo ""
echo "✅ Deployment completed!"
echo "🌐 Your backend is now live at:"
echo "   API: http://45.85.146.77:4000"
echo "   WebSocket: ws://45.85.146.77:5001"
