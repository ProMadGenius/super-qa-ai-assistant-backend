# Deployment Guide

This document outlines the steps to deploy the QA ChatCanvas API to a production environment.

## System Requirements

- Ubuntu 22.04 LTS
- Node.js 20.x or higher
- PM2 (Process Manager)
- Nginx (for reverse proxy and SSL termination)

## Environment Setup

### Install Node.js

```bash
# Add Node.js repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Install Nginx

```bash
# Install Nginx
sudo apt-get install -y nginx

# Verify installation
nginx -v

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Application Deployment

### Clone Repository

```bash
# Clone the repository
git clone <repository-url>
cd qa-chatcanvas-api
```

### Install Dependencies

```bash
# Install dependencies
npm ci
```

### Build Application

```bash
# Build the application
npm run build
```

### Configure Environment Variables

Edit the `ecosystem.config.js` file to set your API keys and other environment variables:

```bash
# Open the ecosystem config file
nano ecosystem.config.js

# Update the environment variables with your actual API keys
# Save and exit
```

### Start Application with PM2

```bash
# Start the application with PM2
pm2 start ecosystem.config.js

# Save the PM2 process list
pm2 save

# Set PM2 to start on system boot
pm2 startup
```

## Nginx Configuration

Create an Nginx configuration file for the application:

```bash
# Create a new Nginx configuration file
sudo nano /etc/nginx/sites-available/qa-chatcanvas-api

# Add the following configuration
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self';";

    # Proxy settings
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
```

Enable the configuration:

```bash
# Create a symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/qa-chatcanvas-api /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## SSL Certificate

You can obtain an SSL certificate using Let's Encrypt:

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain and install certificate
sudo certbot --nginx -d your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

## Monitoring and Maintenance

### Monitor Application

```bash
# View application logs
pm2 logs qa-chatcanvas-api

# Monitor application status
pm2 monit

# View application information
pm2 show qa-chatcanvas-api
```

### Update Application

```bash
# Pull latest changes
git pull

# Install dependencies
npm ci

# Build application
npm run build

# Restart application
pm2 restart qa-chatcanvas-api
```

### Backup and Restore

```bash
# Save PM2 process list
pm2 save

# Dump PM2 process list to a file
pm2 dump

# Restore PM2 process list
pm2 resurrect
```

## Troubleshooting

### Check Application Status

```bash
# Check if application is running
pm2 status

# Check application logs
pm2 logs qa-chatcanvas-api
```

### Check Nginx Status

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart application
pm2 restart qa-chatcanvas-api

# Restart Nginx
sudo systemctl restart nginx
```

## Performance Tuning

### Node.js Performance

Adjust the following settings in `ecosystem.config.js`:

- `instances`: Set to the number of CPU cores or `max` for automatic scaling
- `max_memory_restart`: Adjust based on available system memory
- Add `node_args: "--max-old-space-size=4096"` to increase memory limit if needed

### Nginx Performance

Adjust the following settings in the Nginx configuration:

```nginx
# Worker processes and connections
worker_processes auto;
events {
    worker_connections 1024;
    multi_accept on;
}

# Buffers and timeouts
http {
    client_body_buffer_size 10K;
    client_header_buffer_size 1k;
    client_max_body_size 8m;
    large_client_header_buffers 2 1k;

    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;

    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        text/css
        text/javascript
        text/plain;
}
```

## Security Considerations

1. **API Keys**: Store API keys securely and rotate them regularly
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Firewall**: Configure UFW or iptables to restrict access
4. **Regular Updates**: Keep all software updated with security patches
5. **Monitoring**: Set up monitoring for unusual activity
6. **Backups**: Regularly backup configuration files

## Automated Deployment

For automated deployments, consider setting up a CI/CD pipeline using GitHub Actions or similar tools.

Example GitHub Actions workflow:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /path/to/app
            git pull
            npm ci
            npm run build
            pm2 restart qa-chatcanvas-api
```

## Conclusion

This deployment guide provides a comprehensive approach to deploying the QA ChatCanvas API in a production environment. Follow these steps to ensure a secure, performant, and reliable deployment.
