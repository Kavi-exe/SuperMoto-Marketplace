const path = require('path');

module.exports = {
  apps: [
    {
      name: 'ceylonsuperhub',
      cwd: path.join(__dirname, 'server'),
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      out_file: path.join(__dirname, 'logs', 'pm2-out.log'),
      error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
      merge_logs: true,
    },
  ],
};
