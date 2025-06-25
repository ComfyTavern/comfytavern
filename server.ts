#!/usr/bin/env bun
import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";
import { checkAndMergeConfigs } from "./scripts/check-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ComfyTavernServer {
  private processes: { name: string; process: ChildProcess }[] = [];
  private isShuttingDown = false;
  private isDev: boolean;
  private frontendPort: number = 5573; // 默认值
  private backendPort: number = 3233; // 默认值

  // ANSI Color Codes
  private RESET = "\x1b[0m";
  private BOLD = "\x1b[1m";
  private GREEN = "\x1b[32m";
  private YELLOW = "\x1b[93m";
  private CYAN = "\x1b[96m";
  private GRAY = "\x1b[90m";

  constructor() {
    this.isDev = process.argv.includes("dev");
    this.loadConfig();

    // 处理进程退出信号
    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());
    process.on("uncaughtException", (err) => {
      console.error("未捕获的异常:", err);
      this.shutdown();
    });
  }

  private loadConfig() {
    try {
      const configPath = resolve(__dirname, "config.json");
      if (existsSync(configPath)) {
        const configFile = readFileSync(configPath, "utf-8");
        const config = JSON.parse(configFile);
        this.frontendPort = config.server?.frontend?.port || this.frontendPort;
        this.backendPort = config.server?.backend?.port || this.backendPort;
        console.log(
          `[Server] 从配置中加载端口: 前端=${this.frontendPort}, 后端=${this.backendPort}`
        );
      } else {
        console.log(`[Server] 配置文件未找到，使用默认端口。`);
      }
    } catch (error: any) {
      console.error(`[Server] 加载配置失败: ${error.message}`);
    }
  }

  private async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log("\n正在关闭服务...");

    for (const { name, process } of this.processes.reverse()) {
      console.log(`正在停止 ${name}...`);
      process.kill();
      await new Promise<void>((resolve) => {
        process.on("close", () => {
          console.log(`${name} 已停止`);
          resolve();
        });
      });
    }

    this.processes = [];
    process.exit(0);
  }

  private spawnProcess(command: string, args: string[], options: SpawnOptions, name: string) {
    const child = spawn(command, args, {
      ...options,
      stdio: "inherit",
    });

    this.processes.push({ name, process: child });

    child.on("error", (err) => {
      console.error(`${name} 启动失败:`, err);
      this.shutdown();
    });

    return child;
  }

  async start() {
    console.log("正在启动 ComfyTavern...");
    checkAndMergeConfigs(__dirname);
    console.log(`运行模式: ${this.isDev ? "开发" : "生产"}`);

    // 启动后端服务器
    const backendPath = resolve(__dirname, "apps/backend");
    console.log("正在启动后端服务器...");
    const backendScript = this.isDev ? "dev" : "start";
    // 通过命令行参数传递信号
    this.spawnProcess(
      "bun",
      // 使用 -- 来确保 --integrated-launch 被传递给脚本而不是 bun
      ["run", backendScript, "--", "--integrated-launch"],
      { cwd: backendPath },
      "Backend Server"
    );

    // 启动前端服务器
    const frontendPath = resolve(__dirname, "apps/frontend-vueflow");
    console.log("正在启动前端服务器...");
    if (this.isDev) {
      // 开发模式直接启动 dev server
      this.spawnProcess("bun", ["x", "vite"], { cwd: frontendPath }, "Frontend Dev Server");
    } else {
      // 生产模式下，使用我们自己的基于 Bun 的静态文件服务器（静默模式）
      console.log("正在启动前端生产服务器...");
      const serverScriptPath = resolve(__dirname, "scripts/frontend-server.ts");
      this.spawnProcess(
        "bun",
        [serverScriptPath, "--silent"],
        { cwd: __dirname },
        "Frontend Server"
      );
    }

    // 等待一小段时间，让子进程的初始输出能够先显示
    setTimeout(() => {
      console.log(`${this.GRAY}----------------------------------------${this.RESET}\n`);
      console.log(`${this.BOLD}${this.GREEN}✅ ComfyTavern 服务已准备就绪！${this.RESET}\n`);
      if (this.isDev) {
        console.log(
          `🎨 → ${this.YELLOW}前端开发服务器:${this.RESET} ${this.CYAN}http://localhost:${this.frontendPort}/${this.RESET}`
        );
      } else {
        console.log(
          `🌍 → ${this.YELLOW}前端访问地址:${this.RESET}  ${this.CYAN}http://localhost:${this.frontendPort}/${this.RESET}`
        );
      }
      console.log(
        `⚙️  → ${this.YELLOW}后端 API 地址:${this.RESET} ${this.CYAN}http://localhost:${this.backendPort}/${this.RESET}`
      );
      console.log(`\n${this.GRAY}----------------------------------------${this.RESET}`);
      console.log(`\n${this.BOLD}按 Ctrl+C 停止所有服务${this.RESET}\n`);
    }, 500); // 延迟500毫秒
  }
}

// 启动服务器
const server = new ComfyTavernServer();
server.start().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
