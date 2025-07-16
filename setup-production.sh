#!/bin/bash

# QA ChatCanvas Backend Setup Script
# This script sets up the production environment for the QA ChatCanvas Backend

# Exit on error
set -e

echo "=== QA ChatCanvas Backend Setup ==="
echo "This script will set up the production environment for the QA ChatCanvas Backend"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "Please do not run this script as root"
  exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Node.js is not installed. Please install Node.js 20+ before continuing."
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Node.js version 20+ is required. Current version: $(node -v)"
  exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2 globally..."
  npm install -g pm2
fi

# Install dependencies
echo "Installing dependencies..."
npm ci

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
  echo "Creating .env.local from .env.example..."
  cp .env.example .env.local
  
  echo "Please edit .env.local to add your API keys:"
  echo "nano .env.local"
fi

# Build the application
echo "Building the application..."
npm run build

# Create logs directory
mkdir -p logs

# Start the application with PM2
echo "Starting the application with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
echo "Saving PM2 configuration..."
pm2 save

# PM2 startup instructions
echo "To configure PM2 to start on system boot, run:"
echo "pm2 startup"
echo "Then follow the instructions provided by the command."

echo "=== Setup Complete ==="
echo "The QA ChatCanvas Backend is now running in production mode."
echo "You can monitor it with: pm2 status qa-chatcanvas-backend"
echo "View logs with: pm2 logs qa-chatcanvas-backend"
echo ""
echo "For more information, see docs/deployment.md"