#!/bin/bash
# Configure Apache as reverse proxy for backend

ssh root@45.85.146.77 << 'ENDSSH'

# Enable required Apache modules
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enmod headers

# Create Apache config for sexylara.chat
cat > /etc/apache2/sites-available/sexylara.chat.conf << 'EOF'
<VirtualHost *:80>
    ServerName sexylara.chat
    ServerAlias www.sexylara.chat
    
    # Redirect HTTP to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName sexylara.chat
    ServerAlias www.sexylara.chat
    
    # SSL Configuration (assuming you have certbot/letsencrypt)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/sexylara.chat/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/sexylara.chat/privkey.pem
    
    # React App (static files)
    DocumentRoot /var/www/thrilme
    <Directory /var/www/thrilme>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # API Proxy (port 4000)
    ProxyPreserveHost On
    ProxyPass /api http://localhost:4000/api
    ProxyPassReverse /api http://localhost:4000/api
    
    # WebSocket Proxy (port 5001)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /ws/(.*) ws://localhost:5001/ws/$1 [P,L]
    
    ProxyPass /ws http://localhost:5001/ws
    ProxyPassReverse /ws http://localhost:5001/ws
    
    # Error and Access logs
    ErrorLog /var/log/apache2/sexylara-error.log
    CustomLog /var/log/apache2/sexylara-access.log combined
</VirtualHost>
EOF

# Enable site and restart Apache
a2ensite sexylara.chat.conf
systemctl restart apache2

echo "✅ Apache configured successfully!"
echo "🌐 API: https://sexylara.chat/api"
echo "🔌 WebSocket: wss://sexylara.chat/ws"

ENDSSH
