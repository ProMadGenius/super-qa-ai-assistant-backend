module.exports = {
  apps: [
    {
      name: 'qa-chatcanvas-backend',
      script: 'server.js',
      cwd: './.next/standalone',
      instances: 'max',  // Use max for auto-scaling based on CPU cores
      exec_mode: 'cluster',
      
      // Environment configurations
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        API_BASE_URL: 'http://localhost:3000'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        API_BASE_URL: 'https://your-production-domain.com'  // Update with actual production URL
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        API_BASE_URL: 'https://staging-domain.com'  // Update with actual staging URL
      },
      
      // Restart policy
      max_restarts: 10,
      min_uptime: '30s',
      max_memory_restart: '1G',
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Monitoring
      monitoring: true,
      
      // Advanced features
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // Environment variables file
      env_file: '.env.local',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Cron restart (optional - restart daily at 3am)
      cron_restart: '0 3 * * *'
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['your-production-server'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/qa-chatcanvas-backend.git',
      path: '/var/www/qa-chatcanvas',
      'post-deploy': 'npm ci && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
}