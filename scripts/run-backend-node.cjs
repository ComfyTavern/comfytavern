// scripts/run-backend-node.cjs
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const backendDir = path.join(projectRoot, 'apps', 'backend');
const logFilePath = path.join(projectRoot, 'logs', 'backend_node_wrapper_debug.log');

// 确保日志目录存在
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 创建/清空日志文件
fs.writeFileSync(logFilePath, `[${new Date().toISOString()}] Backend Node.js wrapper script started.\n`);

const appendLog = (message) => {
  // 输出到控制台，以便 PM2 捕获
  // 我们将所有来自包装器的日志都视为 stdout，后端进程的 stderr 会被特殊标记
  console.log(`[${new Date().toISOString()}] ${message.toString().trim()}`);
  // 同时写入到包装器的调试日志文件
  fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${message.toString().trim()}\n`);
};

appendLog(`Target backend directory: ${backendDir}`);
// 后端 package.json 中的 "start" 脚本是 "NODE_ENV=production bun src/index.ts"
// 我们在 spawn 的 env 中设置 NODE_ENV，并直接执行 "bun src/index.ts"
const command = 'bun';
const args = ['src/index.ts'];
appendLog(`Executing: ${command} ${args.join(' ')} in ${backendDir} with NODE_ENV=production`);

const backendProcess = spawn(command, args, {
  cwd: backendDir,
  stdio: ['ignore', 'pipe', 'pipe'], // stdin: ignore, stdout: pipe, stderr: pipe
  env: { 
    ...process.env, 
    NODE_ENV: 'production',
    // 如果后端需要通过环境变量获取端口号，可以在这里或 PM2 的 env 中设置
    // PORT: process.env.PORT || '3233' // 示例，实际端口由 PM2 env_production 设置并传递
  }
});

appendLog(`Backend subprocess spawned with PID: ${backendProcess.pid}`);

backendProcess.stdout.on('data', (data) => {
  appendLog(`[backend stdout] ${data}`);
});

backendProcess.stderr.on('data', (data) => {
  // 将后端的 stderr 也通过 console.error 输出，以便 PM2 将其归类为错误日志
  console.error(`[${new Date().toISOString()}] [backend stderr] ${data.toString().trim()}`);
  fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] [backend stderr] ${data.toString().trim()}\n`);
});

backendProcess.on('close', (code) => {
  appendLog(`Backend subprocess exited with code ${code}`);
  // 如果需要，可以在这里添加逻辑，例如如果非正常退出则尝试重启（尽管PM2也会做）
});

backendProcess.on('error', (err) => {
  appendLog(`Failed to start backend subprocess: ${err.message}`);
});

appendLog('Node.js wrapper script is now in a waiting state, monitoring the spawned backend process.');