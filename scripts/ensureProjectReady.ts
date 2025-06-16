// scripts/ensureProjectReady.ts
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * 检查字符串是否包含非 ASCII 字符。
 * @param text 要检查的字符串。
 * @returns 如果包含非 ASCII 字符则返回 true，否则返回 false。
 */
function containsNonAscii(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(text);
}

const dbFileName = 'app.sqlite';
const dbDir = path.resolve(process.cwd(), 'data');
const dbFilePath = path.join(dbDir, dbFileName);
const projectRoot = process.cwd();

/**
 * 设置数据库：生成迁移文件并应用迁移。
 * @returns 如果所有数据库命令成功执行则返回 true，否则返回 false。
 */
function setupDatabase(): boolean {
  console.log(`[ensureProjectReady] 开始数据库设置流程...`);

  const migrationsDir = path.join(projectRoot, 'apps/backend/drizzle/migrations');
  let skipGenerate = false;
  if (fs.existsSync(migrationsDir)) {
    const items = fs.readdirSync(migrationsDir);
    // 检查是否存在至少一个 .sql 文件。
    // fs.statSync(path.join(migrationsDir, item)).isFile() 确保我们只检查文件，而不是 'meta' 这样的子目录。
    if (items.some(item => {
      // 构造完整路径以进行 statSync
      const itemPath = path.join(migrationsDir, item);
      // 检查是否是文件以及是否以 .sql 结尾
      try {
        return fs.statSync(itemPath).isFile() && item.endsWith('.sql');
      } catch (e) {
        // 如果 statSync 失败（例如权限问题或符号链接断开），则忽略此项
        console.warn(`[ensureProjectReady] 无法获取文件状态 ${itemPath}: ${(e as Error).message}`);
        return false;
      }
    })) {
      skipGenerate = true;
    }
  }

  if (skipGenerate) {
    console.log(`[ensureProjectReady] 检测到迁移 SQL 文件已存在于 ${migrationsDir}。跳过生成迁移文件步骤。`);
  } else {
    console.log(`[ensureProjectReady] 步骤 1: 生成数据库迁移文件 (bunx drizzle-kit generate)`);
    try {
      const generateResult = spawnSync('bunx', ['drizzle-kit', 'generate'], {
        stdio: 'pipe',
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
        console.error(`[ensureProjectReady] bunx drizzle-kit generate 命令执行失败。退出码: ${generateResult.status}`);
        if (containsNonAscii(projectRoot)) {
          console.error(`[ensureProjectReady] 检测到项目路径 "${projectRoot}" 包含非 ASCII 字符。drizzle-kit 可能不支持此类路径，这可能是导致生成迁移文件失败的原因。请尝试将项目移动到仅包含 ASCII 字符的纯英文路径下重试。`);
        }
        return false;
      }
      console.log(`[ensureProjectReady] bunx drizzle-kit generate 命令执行成功。`);
    } catch (err: any) {
      console.error(`[ensureProjectReady] 执行 bunx drizzle-kit generate 时发生启动错误: ${err.message}`);
      return false;
    }
  }

  console.log(`[ensureProjectReady] 步骤 2: 应用数据库迁移 (bun run db:migrate)`);
  try {
    const migrateResult = spawnSync('bun', ['run', 'db:migrate'], {
      stdio: 'inherit',
      cwd: projectRoot,
    });
    if (migrateResult.status !== 0) {
      console.error(`[ensureProjectReady] bun run db:migrate 命令执行失败。退出码: ${migrateResult.status}`);
      return false;
    }
    console.log(`[ensureProjectReady] bun run db:migrate 命令执行成功。`);
  } catch (err: any) {
    console.error(`[ensureProjectReady] 执行 bun run db:migrate 时发生启动错误: ${err.message}`);
    return false;
  }

  console.log(`[ensureProjectReady] 数据库设置流程完成。`);
  return true;
}

function ensureProjectReady() {
  console.log('[ensureProjectReady] 开始检查项目状态...');

  // 步骤 1: 确保 ./data 目录存在
  if (!fs.existsSync(dbDir)) {
    console.log(`[ensureProjectReady] 数据目录 ${dbDir} 不存在，正在创建...`);
    try {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`[ensureProjectReady] 数据目录 ${dbDir} 已成功创建。`);
    } catch (err: any) {
      console.error(`[ensureProjectReady] 创建数据目录 ${dbDir} 失败: ${err.message}`);
      // 如果无法创建数据目录，则无法继续进行数据库操作
      process.exit(1);
    }
  }

  // 步骤 2: 检查数据库文件是否存在，如果不存在则进行数据库设置
  if (!fs.existsSync(dbFilePath)) {
    console.log(`[ensureProjectReady] 数据库文件 ${dbFilePath} 未找到。将执行数据库设置 (generate & migrate)...`);
    if (!setupDatabase()) { // 调用新的包含 generate 和 migrate 的函数
      console.error('[ensureProjectReady] 数据库设置步骤执行失败。请检查上面的错误信息。');
      process.exit(1); // 数据库设置失败是一个严重错误，应终止程序
    }
    console.log('[ensureProjectReady] 数据库已成功设置。');
  } else {
    console.log(`[ensureProjectReady] 数据库文件 ${dbFilePath} 已存在。跳过数据库设置步骤。`);
  }
  console.log('[ensureProjectReady] 项目状态检查完成。');
}

// 执行主函数
ensureProjectReady();