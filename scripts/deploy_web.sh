#!/bin/bash
set -euo pipefail

# VPS Configuration
VPS_HOST="45.85.146.77"
VPS_USER="root"
VPS_PASS="*Giuseppe78"
VPS_WEB_DIR="/var/www/thrilme"

SCRIPT_DIR="$(cd -- "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Deploying ThrillMe Web App to VPS..."

# Check if build exists
if [ ! -d "$REPO_ROOT/build/web" ]; then
  echo "❌ Build not found! Run './build_web.sh' first."
  exit 1
fi

# Sanity check: ensure PWA icons are present before packaging
missing_icons=()
for icon in Icon-192.png Icon-512.png Icon-maskable-192.png Icon-maskable-512.png; do
  if [ ! -f "$REPO_ROOT/build/web/icons/$icon" ]; then
    missing_icons+=("$icon")
  fi
done

if [ ${#missing_icons[@]} -gt 0 ]; then
  echo "⚠️  Missing icons in build/web/icons: ${missing_icons[*]}"
  echo "   Attempting to copy from source web/icons/..."
  mkdir -p "$REPO_ROOT/build/web/icons"
  cp -v "$REPO_ROOT"/web/icons/Icon-* "$REPO_ROOT/build/web/icons/" || true
  # Re-evaluate after copy
  missing_icons=()
  for icon in Icon-192.png Icon-512.png Icon-maskable-192.png Icon-maskable-512.png; do
    if [ ! -f "$REPO_ROOT/build/web/icons/$icon" ]; then
      missing_icons+=("$icon")
    fi
  done

  if [ ${#missing_icons[@]} -gt 0 ]; then
    echo "❌ Still missing icons after copy: ${missing_icons[*]}"
    exit 1
  else
    echo "✅ Icons restored from source web/icons/"
  fi
fi

echo "📦 Compressing build folder..."
cd "$REPO_ROOT/build"
tar -czf web.tar.gz web/
cd "$REPO_ROOT"

if [ -z "$VPS_PASS" ]; then
  echo "🔐 Using SSH key authentication (no password)"
  scp "$REPO_ROOT/build/web.tar.gz" $VPS_USER@$VPS_HOST:/tmp/
  ssh $VPS_USER@$VPS_HOST <<'EOF'
    mkdir -p /var/www/thrilme
    cd /var/www/thrilme
    # Clear previous build to avoid stale cached assets
    rm -rf /var/www/thrilme/*
    tar -xzf /tmp/web.tar.gz --strip-components=1
    chown -R www-data:www-data /var/www/thrilme
    chmod -R 755 /var/www/thrilme
    # Verify PWA icons are present after deploy
    for icon in Icon-192.png Icon-512.png Icon-maskable-192.png Icon-maskable-512.png; do
      if [ ! -f "/var/www/thrilme/icons/$icon" ]; then
        echo "⚠️  Missing /var/www/thrilme/icons/$icon after deploy"
      fi
    done
    rm /tmp/web.tar.gz
    systemctl reload apache2
    echo "✅ Web app deployed successfully!"
EOF
else
  echo "🔐 Using password authentication via sshpass"
  sshpass -p "$VPS_PASS" scp "$REPO_ROOT/build/web.tar.gz" $VPS_USER@$VPS_HOST:/tmp/
  sshpass -p "$VPS_PASS" ssh $VPS_USER@$VPS_HOST <<'EOF'
    mkdir -p /var/www/thrilme
    cd /var/www/thrilme
    # Clear previous build to avoid stale cached assets
    rm -rf /var/www/thrilme/*
    tar -xzf /tmp/web.tar.gz --strip-components=1
    chown -R www-data:www-data /var/www/thrilme
    chmod -R 755 /var/www/thrilme
    # Verify PWA icons are present after deploy
    for icon in Icon-192.png Icon-512.png Icon-maskable-192.png Icon-maskable-512.png; do
      if [ ! -f "/var/www/thrilme/icons/$icon" ]; then
        echo "⚠️  Missing /var/www/thrilme/icons/$icon after deploy"
      fi
    done
    rm /tmp/web.tar.gz
    systemctl reload apache2
    echo "✅ Web app deployed successfully!"
EOF
fi

echo ""
echo "✅ Deployment complete!"
echo "🌐 Web app available at: https://thril.me"
echo ""
echo "To verify:"
echo "  curl -I https://thril.me"

# Cleanup local tar
rm build/web.tar.gz
