#!/usr/bin/env bun
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs'; // 新增导入
import { resolve } from 'path';
import { checkAndMergeConfigs } from './check-config.js';

const ROOT_DIR = resolve(__dirname, '../'); // 项目根目录
const IS_WINDOWS = process.platform === "win32";

// 辅助函数，用于执行命令并处理输出
async function executeCommand(command: string, args: string[] = [], cwd: string = ROOT_DIR, inheritStdio = false): Promise<void> {
  const commandDisplay = `${command} ${args.join(' ')}`;
  console.log(`\n[PM2 Manager] Executing: ${commandDisplay} in ${cwd}`);

  const effectiveCommand = command;

  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn(effectiveCommand, args, {
      cwd,
      stdio: inheritStdio ? 'inherit' : 'pipe',
      shell: IS_WINDOWS, // shell: true 在 Windows 上有助于解决路径和 .cmd 问题, 特别是对于非 bunx 的全局命令
    });

    if (!inheritStdio && proc.stdout && proc.stderr) {
      proc.stdout.on('data', (data) => console.log(data.toString().trim()));
      proc.stderr.on('data', (data) => {
        // PM2 list/logs often output to stderr for formatting, so don't always treat as error
        const output = data.toString().trim();
        if (args.includes('list') || args.includes('logs')) {
          console.log(output); // For pm2 list/logs, stderr can be normal output
        } else {
          console.error(`[STDERR] ${output}`);
        }
      });
    }

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`[PM2 Manager] Successfully executed: ${commandDisplay}`);
        resolvePromise();
      } else {
        // Don't auto-reject for logs as it's a long-running process killed by user
        if (args.includes('logs')) {
          console.log(`[PM2 Manager] Process for "${commandDisplay}" ended.`);
          resolvePromise();
        } else {
          console.error(`[PM2 Manager] Error executing ${commandDisplay}. Exit code: ${code}`);
          rejectPromise(new Error(`Command failed: ${commandDisplay} (Code: ${code})`));
        }
      }
    });

    proc.on('error', (err) => {
      console.error(`[PM2 Manager] Failed to start ${commandDisplay}:`, err);
      rejectPromise(err);
    });
  });
}

async function prepareEnvironment() {
  console.log('\n[PM2 Manager] === Preparing Environment ===');

  // 首先检查和合并配置文件
  console.log('[PM2 Manager] Checking and merging configurations...');
  try {
    checkAndMergeConfigs(ROOT_DIR);
    console.log('[PM2 Manager] Configuration check/merge complete.');
  } catch (error) {
    console.error('[PM2 Manager] Configuration check/merge failed:', error instanceof Error ? error.message : String(error));
    process.exit(1); // 如果配置失败，则不继续
  }

  // 使用 inheritStdio: true 让用户看到 bun install 等的详细输出
  await executeCommand('bun', ['install'], ROOT_DIR, true);
  await executeCommand('bun', ['run', 'prepare:project'], ROOT_DIR, true);
  await executeCommand('bun', ['run', 'build'], ROOT_DIR, true); // build 通常指向 build:frontend
  console.log('[PM2 Manager] === Environment Prepared ===');
}

async function startServices() {
  console.log('\n[PM2 Manager] === Starting Services via PM2 ===');
  const ecosystemConfigPath = resolve(ROOT_DIR, 'ecosystem.config.cjs');
  if (!existsSync(ecosystemConfigPath)) {
    console.error('[PM2 Manager] Error: ecosystem.config.cjs not found!');
    process.exit(1);
  }
  await prepareEnvironment(); // 确保环境就绪
  await executeCommand('bunx', ['pm2', 'start', ecosystemConfigPath, '--env', 'production'], ROOT_DIR, true);
  console.log('[PM2 Manager] === Services Started ===');

  // --- BEGIN: 打印端口信息 ---
  let backendPort = 3233; // 默认后端端口
  let frontendPort = 5573; // 默认前端端口
  const configFilePath = resolve(ROOT_DIR, 'config.json');

  try {
    if (existsSync(configFilePath)) {
      const configRaw = fs.readFileSync(configFilePath, 'utf-8');
      const config = JSON.parse(configRaw);
      if (config.server) {
        if (config.server.backend && typeof config.server.backend.port === 'number') {
          backendPort = config.server.backend.port;
          console.log(`[PM2 Manager] Backend port loaded from config.json: ${backendPort}`);
        } else {
          console.warn(`[PM2 Manager] Backend port not found or invalid in config.json, using default: ${backendPort}`);
        }
        if (config.server.frontend && typeof config.server.frontend.port === 'number') {
          frontendPort = config.server.frontend.port;
          console.log(`[PM2 Manager] Frontend port loaded from config.json: ${frontendPort}`);
        } else {
          console.warn(`[PM2 Manager] Frontend port not found or invalid in config.json, using default: ${frontendPort}`);
        }
      } else {
        console.warn(`[PM2 Manager] 'server' object not found in config.json, using default ports.`);
      }
    } else {
      console.warn(`[PM2 Manager] config.json not found at ${configFilePath}, using default ports.`);
    }
  } catch (error) {
    console.warn('[PM2 Manager] Warning: Could not read config.json for port info, or config is malformed. Using default ports.', error instanceof Error ? error.message : String(error));
  }

  console.log(`[PM2 Manager] 【后端地址】 Backend is expected to be running on: http://localhost:${backendPort}`);
  console.log(`[PM2 Manager] 【前端地址】 Frontend is expected to be running on: http://localhost:${frontendPort}`);
  // --- END: 打印端口信息 ---

  console.log('[PM2 Manager] Use "bun manage:pm2 list" or corresponding .bat script to check status.');
}

async function stopServices(deleteToo = false) {
  const action = deleteToo ? 'delete' : 'stop';
  const actionDisplay = deleteToo ? 'Deleting' : 'Stopping';
  console.log(`\n[PM2 Manager] === ${actionDisplay} All Services via PM2 ===`);
  await executeCommand('bunx', ['pm2', action, 'all'], ROOT_DIR, true);
  console.log(`[PM2 Manager] === Services ${deleteToo ? 'Deleted' : 'Stopped'} ===`);
}

async function restartServices() {
  console.log(`\n[PM2 Manager] === Restarting All Services via PM2 ===`);
  await executeCommand('bunx', ['pm2', 'restart', 'all'], ROOT_DIR, true);
  console.log(`[PM2 Manager] === Services Restarted ===`);
}

async function showLogs(serviceName?: string) {
  const args = ['pm2', 'logs'];
  if (serviceName && serviceName !== '%1' && serviceName.trim() !== '') {
    args.push(serviceName.trim());
  }
  const serviceLogDisplay = args.length > 2 ? `for ${args[2]} ` : '';
  console.log(`\n[PM2 Manager] === Showing Logs ${serviceLogDisplay}via PM2 ===`);
  // Logs are continuous, so ensure stdio is inherited
  await executeCommand('bunx', args, ROOT_DIR, true);
}

async function listServices() {
  console.log('\n[PM2 Manager] === Listing Services via PM2 ===');
  await executeCommand('bunx', ['pm2', 'list'], ROOT_DIR, true);
}

async function flushLogs() {
  console.log('\n[PM2 Manager] === Flushing PM2 Logs ===');
  await executeCommand('bunx', ['pm2', 'flush'], ROOT_DIR, true);
}

async function main() {
  const action = process.argv[2]?.trim();

  try {
    switch (action) {
      case 'start': await startServices(); break;
      case 'stop': await stopServices(); break;
      case 'restart': await restartServices(); break;
      case 'delete': await stopServices(true); break;
      case 'logs': await showLogs(process.argv[3]); break;
      case 'list': await listServices(); break;
      case 'flush': await flushLogs(); break;
      case 'prepare': await prepareEnvironment(); break;
      default:
        console.log(`[PM2 Manager] Unknown or missing action: '${action}'`);
        console.log('Usage: bun manage:pm2 <action> [service_name_for_logs]');
        console.log('Available actions: prepare, start, stop, restart, delete, logs, list, flush');
        process.exit(1);
    }
  } catch (error) {
    console.error(`[PM2 Manager] Operation "${action}" failed:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('[PM2 Manager] A critical error occurred in main execution:', error instanceof Error ? error.message : error);
  process.exit(1);
});