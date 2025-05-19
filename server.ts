#!/usr/bin/env bun
import { spawn, type SpawnOptions } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ProcessInfo {
  name: string;
  process: ReturnType<typeof spawn>;
}

class ComfyTavernServer {
  private processes: ProcessInfo[] = [];
  private isShuttingDown = false;

  constructor() {
    // 处理进程退出信号
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('uncaughtException', (err) => {
      console.error('未捕获的异常:', err);
      this.shutdown();
    });
  }

  private async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('\n正在关闭服务...');
    
    // 按照相反的顺序关闭进程
    for (const { name, process } of this.processes.reverse()) {
      console.log(`正在停止 ${name}...`);
      process.kill();
      await new Promise<void>((resolve) => {
        process.on('close', () => {
          console.log(`${name} 已停止`);
          resolve();
        });
      });
    }

    this.processes = [];
    process.exit(0);
  }

  private spawnProcess(command: string, args: string[], options: SpawnOptions, name: string) {
    const process = spawn(command, args, {
      ...options,
      stdio: 'inherit', // 继承主进程的标准输入输出
    });

    this.processes.push({ name, process });

    process.on('error', (err) => {
      console.error(`${name} 启动失败:`, err);
      this.shutdown();
    });

    return process;
  }

  async start() {
    console.log('正在启动 ComfyTavern...');

    // 启动后端服务器
    const backendPath = resolve(__dirname, 'apps/backend');
    console.log('正在启动后端服务器...');
    const isDev = process.argv.includes('dev');
    console.log(`运行模式: ${isDev ? '开发' : '生产'}`);

    // 启动后端服务器
    const backendScript = isDev ? 'dev' : 'start';
    this.spawnProcess('bun', ['run', backendScript], { cwd: backendPath }, 'Backend Server');

    // 启动前端服务器
    const frontendPath = resolve(__dirname, 'apps/frontend-vueflow');
    console.log('正在启动前端服务器...');
    if (isDev) {
      // 开发模式直接启动 dev server
      this.spawnProcess('bun', ['vite'], { cwd: frontendPath }, 'Frontend Dev Server');
    } else {
      // 生产模式启动预览服务器（构建步骤已在start.bat/sh中完成）
      console.log('启动前端预览服务器...');
      this.spawnProcess('bun', ['run', 'preview'], { cwd: frontendPath }, 'Frontend Preview Server');
    }

    console.log('\nComfyTavern 服务已启动');
    console.log('前端访问地址: http://localhost:5573/'); // 添加前端访问地址提示
    console.log('后端API地址: http://localhost:3233/'); // 添加后端API地址提示
    console.log('按 Ctrl+C 停止所有服务');
  }
}

// 启动服务器
const server = new ComfyTavernServer();
server.start().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});