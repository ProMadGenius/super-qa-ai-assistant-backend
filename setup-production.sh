#!/bin/bash

# QA ChatCanvas API Production Setup Script
# This script sets up the production environment for the QA ChatCanvas API on Ubuntu 22.04 LTS

# Exit on error
set -e

# Print commands before execution
set -x

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root or with sudo"
  exit 1
fi

# Update system packages
apt-get update
apt-get upgrade -y

# Install required packages
apt-get install -y curl git build-essential

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install PM2 globally
npm install -g pm2

# Verify PM2 installation
pm2 --version

# Install Nginx
apt-get install -y nginx

# Verify Nginx installation
nginx -v

# Enable and start Nginx
systemctl enable nginx
systemctl start nginx

# Create application directory
mkdir -p /var/www/qa-chatcanvas-api
cd /var/www/qa-chatcanvas-api

# Clone repository (replace with actual repository URL)
# git clone <repository-url> .

# Install dependencies
npm ci

# Build application
npm run build

# Configure Nginx
cat > /etc/nginx/sites-available/qa-chatcanvas-api << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings for streaming responses
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Logging
    access_log /var/log/nginx/qa-chatcanvas-api-access.log;
    error_log /var/log/nginx/qa-chatcanvas-api-error.log;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/qa-chatcanvas-api /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx

# Configure environment variables
cat > .env.local << 'EOF'
# API Keys
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# AI Models
OPENAI_MODEL=gpt-4o
ANTHROPIC_MODEL=claude-3-opus-20240229

# Circuit Breaker Configuration
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_RESET_TIMEOUT=60000
MAX_RETRIES=3
RETRY_DELAY_MS=1000

# Logging
LOG_LEVEL=info
EOF

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Set PM2 to start on system boot
pm2 startup

# Configure firewall
ufw allow 'Nginx Full'
ufw allow ssh
ufw enable

# Print success message
echo "QA ChatCanvas API setup complete!"
echo "Please update the API keys in .env.local and restart the application with: pm2 restart qa-chatcanvas-api"
echo "You can access the API at http://your-server-ip"

# Exit successfully
exit 0