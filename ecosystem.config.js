/**
 * PM2 Ecosystem Configuration
 * Used for production deployment on Ubuntu 22.04 LTS
 */

module.exports = {
  apps: [
    {
      name: 'qa-chatcanvas-api',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max', // Use maximum number of CPU cores
      exec_mode: 'cluster', // Run in cluster mode for load balancing
      watch: false, // Disable file watching in production
      max_memory_restart: '1G', // Restart if memory usage exceeds 1GB
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        OPENAI_API_KEY: 'your-openai-api-key', // Replace with actual key in production
        ANTHROPIC_API_KEY: 'your-anthropic-api-key', // Replace with actual key in production
        OPENAI_MODEL: 'gpt-4o',
        ANTHROPIC_MODEL: 'claude-3-opus-20240229',
        CIRCUIT_BREAKER_THRESHOLD: '5',
        CIRCUIT_BREAKER_RESET_TIMEOUT: '60000', // 1 minute
        MAX_RETRIES: '3',
        RETRY_DELAY_MS: '1000', // 1 second
        LOG_LEVEL: 'info'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'debug'
      },
      env_test: {
        NODE_ENV: 'test',
        PORT: 3001,
        LOG_LEVEL: 'debug'
      }
    }
  ]
};