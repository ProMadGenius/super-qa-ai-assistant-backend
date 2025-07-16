module.exports = {
  apps: [
    {
      name: 'qa-chatcanvas-backend',
      script: 'server.js',
      cwd: './.next/standalone',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Monitoring
      monitoring: false,
      
      // Advanced features
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      
      // Environment variables file
      env_file: '.env.local'
    }
  ]
}