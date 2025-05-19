import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path'; // Import resolve
import { nodeManager } from './NodeManager';
import type { NodeDefinition } from '@comfytavern/types'; // Import NodeDefinition type

export class NodeLoader {
  /**
   * 加载指定目录下的所有节点定义。
   * - 对于子目录，尝试加载其 index.ts (假设它内部处理注册)。
   * - 对于独立的 .ts 文件，导入并查找导出的 'definition' 或 'definitions'。
   * @param dirPath 节点目录路径 (相对于项目根目录)
   */
  static async loadNodes(dirPath: string): Promise<void> {
    const absoluteDirPath = resolve(dirPath); // 获取绝对路径
    console.log(`Starting node loading from: ${absoluteDirPath}`);
    try {
      const entries = await readdir(absoluteDirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(absoluteDirPath, entry.name);

        // Skip specific directories like 'client-scripts'
        if (entry.isDirectory() && entry.name !== 'client-scripts') {
          // 对于子目录，仍然尝试加载其 index.ts
          // 假设 index.ts 会使用 createNodeRegisterer 并正确传递路径
          try {
            const indexPath = join(fullPath, 'index.ts');
            // 检查 index.ts 是否存在 (避免不必要的错误日志)
            try {
              await import(indexPath); // 动态导入
              console.log(`Executed node package entry point: ${indexPath}`);
            } catch (indexError) {
              if (indexError instanceof Error && 'code' in indexError && indexError.code === 'ERR_MODULE_NOT_FOUND') {
                // index.ts 不存在是正常的，忽略
              } else {
                // 其他导入 index.ts 的错误需要记录
                console.error(`Error executing node package entry point ${indexPath}:`, indexError);
              }
            }
          } catch (error) {
            // 记录读取目录或构造路径时的错误
            console.error(`Error accessing subdirectory ${entry.name}:`, error);
          }
        } else if (
          entry.isFile() &&
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.d.ts') && // 显式排除 .d.ts 文件
          !['NodeLoader.ts', 'NodeManager.ts', 'index.ts'].includes(entry.name)
        ) {
          // 加载并注册独立的节点文件
          try {
            console.log(`Attempting to load node definition(s) from: ${fullPath}`);
            const module = await import(fullPath); // 动态导入

            let registeredCount = 0;

            // 检查导出的 'definition' (单个)
            if (module.definition && typeof module.definition === 'object') {
              // TODO: 更严格的类型检查 NodeDefinition
              nodeManager.registerNode(module.definition as NodeDefinition, fullPath);
              registeredCount++;
            }

            // 检查导出的 'definitions' (数组)
            if (Array.isArray(module.definitions)) {
              for (const def of module.definitions) {
                if (def && typeof def === 'object') {
                  // TODO: 更严格的类型检查 NodeDefinition
                  nodeManager.registerNode(def as NodeDefinition, fullPath);
                  registeredCount++;
                } else {
                  console.warn(`Invalid item found in exported 'definitions' array from ${fullPath}`);
                }
              }
            }

            if (registeredCount === 0) {
              console.warn(`No 'definition' or 'definitions' export found in ${fullPath}. Node not registered.`);
            } else {
              // console.log(`Successfully registered ${registeredCount} node definition(s) from ${fullPath}`);
            }

          } catch (error) {
            console.error(`Error loading or registering node file ${entry.name} (${fullPath}):`, error);
          }
        }
      }

      console.log(`Finished scanning node directory: ${absoluteDirPath}`);
      // 日志输出修改为显示 fullType
      console.log('Registered nodes:', nodeManager.getDefinitions().map(n => `${n.namespace}:${n.type}`));
    } catch (error) {
      console.error(`Error reading node directory ${absoluteDirPath}:`, error);
    }
  }
}