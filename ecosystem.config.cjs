// ecosystem.config.js
const fs = require('fs');
const path = require('path');

let backendPortToUse = 3233; // Default backend port
let frontendPortToUse = 5573; // Default frontend port

// Attempt to read ports from config.json
try {
  const configFilePath = path.resolve(__dirname, 'config.json');
  if (fs.existsSync(configFilePath)) {
    const configRaw = fs.readFileSync(configFilePath, 'utf-8');
    const config = JSON.parse(configRaw);

    // Backend port
    if (config.server && config.server.backend && config.server.backend.port) {
      backendPortToUse = config.server.backend.port;
      console.log(`[PM2 Ecosystem] Backend port loaded from config.json: ${backendPortToUse}`);
    } else {
      console.warn('[PM2 Ecosystem] Backend port not found in config.json, using default:', backendPortToUse);
    }

    // Frontend port
    if (config.server && config.server.frontend && config.server.frontend.port) {
      frontendPortToUse = config.server.frontend.port;
      console.log(`[PM2 Ecosystem] Frontend port loaded from config.json: ${frontendPortToUse}`);
    } else {
      console.warn('[PM2 Ecosystem] Frontend port not found in config.json, using default:', frontendPortToUse);
    }

  } else {
    console.warn(`[PM2 Ecosystem] config.json not found at ${configFilePath}, using default backend port: ${backendPortToUse} and frontend port: ${frontendPortToUse}`);
  }
} catch (error) {
  console.warn('[PM2 Ecosystem] Warning: Could not read config.json or ports not defined, using default ports.', error);
}

module.exports = {
  apps: [
    {
      name: 'comfytavern-backend',
      script: './scripts/run-backend-node.cjs', // 指向新的 Node.js 包装器脚本
      args: [], // 参数在 Node.js 包装器脚本内部处理
      cwd: './',                 // Node.js 包装器脚本会处理自己的路径
      interpreter: 'node',        // 明确指定使用 node 执行 .cjs 包装器脚本
      exec_mode: 'fork',
      watch: false,
      instance_var: 'INSTANCE_ID_BACKEND',
      env_production: {
        NODE_ENV: 'production',
        PORT: backendPortToUse, // 这个 PORT 环境变量会传递给包装器脚本，进而可以被后端应用使用
      },
      out_file: './logs/backend-out.log', // PM2 将捕获包装器脚本的 stdout
      error_file: './logs/backend-error.log', // PM2 将捕获包装器脚本的 stderr
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '60s', // App needs to be running for 60s to be considered stable
      restart_delay: 5000, // Delay 5s before restarting
    },
    {
      name: 'comfytavern-frontend',
      script: './scripts/frontend-server.ts', // 直接指向我们新的 Bun 服务器脚本
      args: ['--silent'], // 以静默模式启动，避免重复的欢迎日志
      cwd: './',
      interpreter: 'bun', // 明确指定使用 bun 来执行 .ts 脚本
      exec_mode: 'fork',
      watch: false,
      instance_var: 'INSTANCE_ID_FRONTEND',
      env_production: {
        NODE_ENV: 'production',
      },
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 3000,
    }
  ]
};