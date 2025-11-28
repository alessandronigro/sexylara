#!/bin/bash

# VPS Configuration
VPS_HOST="45.85.146.77"
VPS_USER="root"
VPS_PASS="*Giuseppe78"
VPS_WEB_DIR="/var/www/thrilme"

echo "🚀 Deploying ThrillMe Web App to VPS..."

# Check if build exists
if [ ! -d "build/web" ]; then
  echo "❌ Build not found! Run './build_web.sh' first."
  exit 1
fi

echo "📦 Compressing build folder..."
cd build
tar -czf web.tar.gz web/
cd ..

if [ -z "$VPS_PASS" ]; then
  echo "🔐 Using SSH key authentication (no password)"
  scp build/web.tar.gz $VPS_USER@$VPS_HOST:/tmp/
  ssh $VPS_USER@$VPS_HOST <<'EOF'
    mkdir -p /var/www/thrilme
    cd /var/www/thrilme
    tar -xzf /tmp/web.tar.gz --strip-components=1
    chown -R www-data:www-data /var/www/thrilme
    chmod -R 755 /var/www/thrilme
    rm /tmp/web.tar.gz
    systemctl reload apache2
    echo "✅ Web app deployed successfully!"
EOF
else
  echo "🔐 Using password authentication via sshpass"
  sshpass -p "$VPS_PASS" scp build/web.tar.gz $VPS_USER@$VPS_HOST:/tmp/
  sshpass -p "$VPS_PASS" ssh $VPS_USER@$VPS_HOST <<'EOF'
    mkdir -p /var/www/thrilme
    cd /var/www/thrilme
    tar -xzf /tmp/web.tar.gz --strip-components=1
    chown -R www-data:www-data /var/www/thrilme
    chmod -R 755 /var/www/thrilme
    rm /tmp/web.tar.gz
    systemctl reload apache2
    echo "✅ Web app deployed successfully!"
EOF
fi

echo ""
echo "✅ Deployment complete!"
echo "🌐 Web app available at: https://sexylara.chat"
echo ""
echo "To verify:"
echo "  curl -I https://sexylara.chat"

# Cleanup local tar
rm build/web.tar.gz
