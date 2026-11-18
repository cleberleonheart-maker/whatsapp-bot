const fs = require('node:fs');
const path = require('node:path');

const cwd = __dirname;
fs.mkdirSync(path.join(cwd, 'data/runtime'), { recursive: true });

module.exports = {
  apps: [
    {
      name: 'brinca-bot',
      cwd,
      script: 'scripts/launch.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      max_memory: '1G',
      listen_timeout: 10000,
      kill_timeout: 10000,
      out_file: './data/runtime/pm2-out.log',
      error_file: './data/runtime/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
