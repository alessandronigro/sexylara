#!/bin/bash
# Configure Apache as reverse proxy for backend

ssh root@45.85.146.77 << 'ENDSSH'

# Enable required Apache modules
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enmod headers

# Create Apache config for thril.me
cat > /etc/apache2/sites-available/thril.me.conf << 'EOF'
<VirtualHost *:80>
    ServerName thril.me
    ServerAlias www.thril.me
    
    # Redirect HTTP to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName thril.me
    ServerAlias www.thril.me
    
    # SSL Configuration (assuming you have certbot/letsencrypt)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/thril.me/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/thril.me/privkey.pem
    
    # React App (static files)
    DocumentRoot /var/www/thrilme
    <Directory /var/www/thrilme>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Serve PWA icons from the app folder (override default Apache /icons alias)
    Alias /icons /var/www/thrilme/icons
    <Directory /var/www/thrilme/icons>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # API Proxy (port 4000)
    ProxyPreserveHost On
    ProxyPass /api http://localhost:4000/api
    ProxyPassReverse /api http://localhost:4000/api
    
    # WebSocket Proxy (port 5001) - explicit ws scheme and query support
    ProxyPass /ws ws://localhost:5001/ws retry=0
    ProxyPassReverse /ws ws://localhost:5001/ws
    
    # Error and Access logs
    ErrorLog /var/log/apache2/thrilme-error.log
    CustomLog /var/log/apache2/thrilme-access.log combined
</VirtualHost>
EOF

# Enable site and restart Apache
a2ensite thril.me.conf
systemctl restart apache2

echo "✅ Apache configured successfully!"
echo "🌐 API: https://thril.me/api"
echo "🔌 WebSocket: wss://thril.me/ws"

ENDSSH
