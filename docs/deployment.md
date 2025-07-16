# QA ChatCanvas Backend Deployment Guide

This document provides instructions for deploying the QA ChatCanvas Backend API to a production environment using PM2 on Ubuntu 22.04 LTS.

## Prerequisites

- Ubuntu 22.04 LTS server
- Node.js 20+ installed
- PM2 installed globally (`npm install -g pm2`)
- Git access to the repository
- OpenAI API key (required)
- Anthropic API key (optional, for fallback)

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/qa-chatcanvas-backend.git
cd qa-chatcanvas-backend
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
nano .env.local
```

Update the following variables:

```
# OpenAI Configuration (Required)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o  # Default model for OpenAI

# Anthropic Configuration (Optional, for failover)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-opus-20240229  # Default model for Anthropic

# Provider Failover Configuration
CIRCUIT_BREAKER_THRESHOLD=5  # Number of failures before circuit opens
CIRCUIT_BREAKER_RESET_TIMEOUT=60000  # Time in ms before circuit resets (1 minute)
MAX_RETRIES=3  # Maximum retry attempts
RETRY_DELAY_MS=1000  # Initial delay between retries in ms

# Environment
NODE_ENV=production

# API Configuration
API_BASE_URL=https://your-production-domain.com
```

### 4. Build the Application

```bash
npm run build
```

This creates a standalone build in `.next/standalone` directory that includes all dependencies.

## Deployment with PM2

### 1. Start the Application

```bash
pm2 start ecosystem.config.js --env production
```

### 2. Save PM2 Configuration

```bash
pm2 save
```

### 3. Configure PM2 to Start on System Boot

```bash
pm2 startup
```

Follow the instructions provided by the command to complete the setup.

## Monitoring and Logs

### View Application Status

```bash
pm2 status qa-chatcanvas-backend
```

### View Logs

```bash
# All logs
pm2 logs qa-chatcanvas-backend

# Error logs only
pm2 logs qa-chatcanvas-backend --err

# Out logs only
pm2 logs qa-chatcanvas-backend --out
```

### Monitor Application

```bash
pm2 monit
```

## Updating the Application

```bash
cd qa-chatcanvas-backend
git pull
npm ci
npm run build
pm2 reload ecosystem.config.js --env production
```

## Nginx Configuration (Recommended)

For production deployments, it's recommended to use Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-production-domain.com;

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
    }
}
```

Save this to `/etc/nginx/sites-available/qa-chatcanvas` and enable it:

```bash
sudo ln -s /etc/nginx/sites-available/qa-chatcanvas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Configuration with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-production-domain.com
```

## Troubleshooting

### Application Won't Start

Check the error logs:

```bash
pm2 logs qa-chatcanvas-backend --err
```

### Memory Issues

If the application is using too much memory, adjust the `max_memory_restart` setting in `ecosystem.config.js`.

### API Provider Issues

The application includes failover logic between OpenAI and Anthropic. Ensure both API keys are configured correctly in `.env.local` for this feature to work.

## Environment-Specific Configurations

To start the application in different environments:

```bash
# Development
pm2 start ecosystem.config.js --env development

# Staging
pm2 start ecosystem.config.js --env staging

# Production
pm2 start ecosystem.config.js --env production
```

Each environment uses different configuration values as defined in the `ecosystem.config.js` file.
