import { resolve } from 'path';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs';

/**
 * 检查并合并配置文件。
 * 如果配置文件不存在，则从模板复制。
 * 如果配置文件存在但模板也存在，则将模板中的缺失字段合并到现有配置中。
 * @param projectRootDir 项目的根目录路径
 */
export function checkAndMergeConfigs(projectRootDir: string): void {
  const configPath = resolve(projectRootDir, 'config.json');
  const templateConfigPath = resolve(projectRootDir, 'config.template.json');

  let configChanged = false;
  if (!existsSync(configPath)) {
    if (existsSync(templateConfigPath)) {
      try {
        copyFileSync(templateConfigPath, configPath);
        console.log(`[Config Check] 配置文件 ${configPath} 未找到，已从模板 ${templateConfigPath} 复制创建。`);
      } catch (err) {
        console.error(`[Config Check] 从模板复制配置文件失败: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    } else {
      console.warn(`[Config Check] 警告: 配置文件 ${configPath} 未找到，且模板文件 ${templateConfigPath} 也不存在。请创建配置文件。`);
      process.exit(1);
    }
  } else if (existsSync(templateConfigPath)) {
    // 合并模板和现有配置
    try {
      const configRaw = readFileSync(configPath, 'utf-8');
      const templateRaw = readFileSync(templateConfigPath, 'utf-8');
      const configObj = JSON.parse(configRaw);
      const templateObj = JSON.parse(templateRaw);
      
      function deepMerge(target: any, source: any) {
        for (const key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (
              typeof source[key] === 'object' &&
              source[key] !== null &&
              !Array.isArray(source[key])
            ) {
              if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
                configChanged = true;
              }
              deepMerge(target[key], source[key]);
            } else if (!(key in target)) {
              target[key] = source[key];
              configChanged = true;
            }
          }
        }
      }
      
      deepMerge(configObj, templateObj);
      
      if (configChanged) {
        writeFileSync(configPath, JSON.stringify(configObj, null, 2), 'utf-8');
        console.log(`[Config Check] 配置文件已根据模板补全缺失字段: ${configPath}`);
      } else {
        console.log(`[Config Check] 配置文件 ${configPath} 无需更新。`);
      }
    } catch (err) {
      console.error(`[Config Check] 配置文件合并失败: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else {
    console.log(`[Config Check] 配置文件 ${configPath} 已存在，模板文件 ${templateConfigPath} 未找到，跳过合并。`);
  }
}