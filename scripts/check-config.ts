import { resolve } from 'path';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

/**
 * 生成随机密码
 * @param length 密码长度，默认 16
 * @returns 随机密码字符串
 */
function generateRandomPassword(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-_=+';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      password += chars[byte % chars.length];
    }
  }
  return password;
}

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
        // 读取模板内容
        const templateContent = readFileSync(templateConfigPath, 'utf-8');
        const templateObj = JSON.parse(templateContent);
        
        // 如果后端面板密码为默认值，生成随机密码（无论是否启用认证）
        if (templateObj.security?.backendPanel?.password === 'change_me_on_first_run') {
          const randomPassword = generateRandomPassword(16);
          templateObj.security.backendPanel.password = randomPassword;
          console.log(`[Config Check] 检测到后端面板使用默认密码，已自动生成随机密码。`);
          console.log(`[Config Check] 请妥善保存以下凭据：`);
          console.log(`[Config Check]   用户名: ${templateObj.security.backendPanel.username}`);
          console.log(`[Config Check]   密码: ${randomPassword}`);
        }
        
        // 写入配置文件
        writeFileSync(configPath, JSON.stringify(templateObj, null, 2), 'utf-8');
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

      // 在合并后，检查后端面板认证密码是否为默认值，如果是则生成随机密码
      // 无论 enableAuth 是否启用，只要密码是默认值就生成随机密码，避免用户启用认证时使用默认密码
      if (configObj.security?.backendPanel?.password === 'change_me_on_first_run') {
        const randomPassword = generateRandomPassword(16);
        configObj.security.backendPanel.password = randomPassword;
        configChanged = true; // 标记为已更改，以便写入文件
        console.log(`[Config Check] 检测到后端面板使用默认密码，已自动生成随机密码。`);
        console.log(`[Config Check] 请妥善保存以下凭据：`);
        console.log(`[Config Check]   用户名: ${configObj.security.backendPanel.username}`);
        console.log(`[Config Check]   密码: ${randomPassword}`);
      }
      
      if (configChanged) {
        writeFileSync(configPath, JSON.stringify(configObj, null, 2), 'utf-8');
        console.log(`[Config Check] 配置文件已根据模板补全缺失字段或更新随机密码: ${configPath}`);
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