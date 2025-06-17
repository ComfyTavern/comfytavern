const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const logsDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (e) {
    // Fallback for older Node versions or permission issues, log to console
    console.error(`Failed to create logs directory ${logsDir}: ${e.message}`);
  }
}

const logFilePath = path.resolve(logsDir, 'frontend_node_wrapper_debug.log');
// Clear previous log file content or ensure it's writable
try {
  fs.writeFileSync(logFilePath, ''); // Create/clear the file
} catch (e) {
  console.error(`Failed to clear/create log file ${logFilePath}: ${e.message}`);
  // If log file cannot be written, subsequent writes will fail or go to console if not handled
}

const outputStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;
  
  // Write to our custom log file
  if (outputStream && !outputStream.destroyed) {
    try {
      outputStream.write(formattedMessage);
    } catch (e) {
      console.error(`Failed to write to custom log: ${e.message}`);
    }
  }
  
  // Also write to PM2's stdout so it appears in its logs too
  process.stdout.write(formattedMessage);
}

log('Node.js wrapper script started.');

const frontendDir = path.resolve(__dirname, '../apps/frontend-vueflow');
log(`Target frontend directory: ${frontendDir}`);

const command = 'bunx';
const args = ['vite', 'preview', '--port', '5573', '--host'];

log(`Executing: ${command} ${args.join(' ')} in ${frontendDir}`);

try {
  const child = spawn(command, args, {
    cwd: frontendDir,
    stdio: ['ignore', 'pipe', 'pipe'], // stdin, stdout, stderr (pipe to parent)
    shell: process.platform === 'win32', // Use shell on Windows for bunx/npx etc.
  });

  child.stdout.on('data', (data) => {
    log(`[vite preview stdout] ${data.toString().trim()}`);
  });

  child.stderr.on('data', (data) => {
    log(`[vite preview stderr] ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    log(`[Wrapper Error] Failed to start subprocess: ${err.message}`);
    log(`[Wrapper Error Stack] ${err.stack}`);
  });

  child.on('exit', (code, signal) => {
    log(`Subprocess vite preview exited with code ${code} and signal ${signal}`);
    // To ensure PM2 restarts if vite preview crashes, the wrapper should also exit.
    // However, if vite preview is meant to run indefinitely, this wrapper should too.
    // If vite preview exits cleanly (code 0), PM2 might not restart if restart_delay is high or autorestart is conditional.
    // For now, let the wrapper stay alive; PM2 will restart the wrapper if it crashes.
    // If vite preview exits, its logs will indicate that.
  });

  log(`Vite preview subprocess spawned with PID: ${child.pid || 'N/A (spawn failed or exited immediately)'}`);

} catch (error) {
  log(`[Wrapper Error] Error spawning 'vite preview' process: ${error.message}`);
  log(`[Wrapper Error Stack] ${error.stack}`);
}

// Keep this Node.js wrapper script running. PM2 monitors this script.
// If 'vite preview' (the child process) crashes, its exit will be logged.
// PM2's autorestart should apply to this wrapper script.
// To make PM2 restart when vite preview exits, this script would need to exit too.
// For now, this setup is simpler for debugging vite preview's output.
log('Node.js wrapper script is now in a waiting state, monitoring the spawned vite preview process.');

// process.stdin.resume(); // Keep alive, alternative to interval
setInterval(() => {
    // This interval just keeps the script alive for PM2.
    // In a more robust solution, you might check child.killed or child.exitCode.
}, 60 * 60 * 1000); // Keep alive for a long time