// scripts/upgradeDatabase.ts
import { spawnSync } from 'node:child_process';
import path from 'node:path'; // 尽管当前 setupDatabase 未直接使用 path，但 projectRoot 依赖，且未来可能用到
import fs from 'node:fs'; // 导入 fs 模块用于文件系统操作

const projectRoot = process.cwd();

/**
 * 设置数据库：生成迁移文件并应用迁移。
 * @returns 如果所有数据库命令成功执行则返回 true，否则返回 false。
 */
function setupDatabase(): boolean {
  console.log(`[upgradeDatabase] 开始数据库升级流程...`); // 修改日志前缀

  console.log(`[upgradeDatabase] 步骤 1: 生成数据库迁移文件 (bunx drizzle-kit generate)`);
  try {
    // 注意：确保 drizzle-kit 已安装或可以通过 bunx 访问
    // 如果在 package.json 中定义了 "db:generate": "drizzle-kit generate"
    // 也可以考虑使用 spawnSync('bun', ['run', 'db:generate'], ...)
    const generateResult = spawnSync('bunx', ['drizzle-kit', 'generate'], {
      stdio: 'pipe', // 改为 pipe，方便捕获输出
      cwd: projectRoot,
      encoding: 'utf-8'
    });

    if (generateResult.stdout) {
      console.log(generateResult.stdout);
    }
    if (generateResult.stderr) {
      console.error(generateResult.stderr);
    }

    if (generateResult.status !== 0) {
      console.error(`[upgradeDatabase] bunx drizzle-kit generate 命令执行失败。退出码: ${generateResult.status}`);
      return false;
    }
    console.log(`[upgradeDatabase] bunx drizzle-kit generate 命令执行成功。`);
  } catch (err: any) {
    console.error(`[upgradeDatabase] 执行 bunx drizzle-kit generate 时发生启动错误: ${err.message}`);
    return false;
  }

  // 确保 ./data 目录存在
  const dataDir = path.join(projectRoot, 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`[upgradeDatabase] 已成功创建目录: ${dataDir}`);
    } catch (err: any) {
      console.error(`[upgradeDatabase] 创建目录 ${dataDir} 失败: ${err.message}`);
      return false;
    }
  } else {
    console.log(`[upgradeDatabase] 目录 ${dataDir} 已存在。`);
  }

  console.log(`[upgradeDatabase] 步骤 2: 应用数据库迁移 (bun run db:migrate)`);
  try {
    const migrateResult = spawnSync('bun', ['run', 'db:migrate'], {
      stdio: 'inherit', // migrate 的输出通常比较重要，可以直接 inherit
      cwd: projectRoot,
    });
    if (migrateResult.status !== 0) {
      console.error(`[upgradeDatabase] bun run db:migrate 命令执行失败。退出码: ${migrateResult.status}`);
      return false;
    }
    console.log(`[upgradeDatabase] bun run db:migrate 命令执行成功。`);
  } catch (err: any) {
    console.error(`[upgradeDatabase] 执行 bun run db:migrate 时发生启动错误: ${err.message}`);
    return false;
  }
  
  console.log(`[upgradeDatabase] 数据库升级流程完成。`);
  return true;
}

// 执行数据库升级
const success = setupDatabase();

if (success) {
  console.log("[upgradeDatabase] 数据库升级成功完成。");
  process.exit(0);
} else {
  console.error("[upgradeDatabase] 数据库升级失败。请检查上面的错误信息。");
  process.exit(1);
}