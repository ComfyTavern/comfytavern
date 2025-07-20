import type { NodeDefinition } from "@comfytavern/types";
import { fileURLToPath } from "node:url"; // 导入 fileURLToPath
import path from "node:path"; // 导入 path 模块


// 导入 path 模块

// 导入 fileURLToPath

// 定义核心/内置节点的基础路径
// NodeManager.ts 已移动到 services 目录，但 baseNodesPath 仍应指向原始的 nodes 目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseNodesPath = path.resolve(__dirname, "../nodes");

export class NodeManager {
  // 使用 fullType (namespace:type) 作为键
  private nodes: Map<string, NodeDefinition> = new Map();

  /**
   * 注册一个节点定义。
   * 会根据优先级确定节点的最终命名空间：显式定义 > 批量默认 > 路径推断。
   * @param node - 节点定义对象。NodeDefinition 中的 namespace 字段是可选的。
   * @param filePath - (可选) 节点定义文件的绝对路径，用于在 namespace 未提供时进行推断。
   */
  registerNode(node: NodeDefinition, filePath?: string) {
    let finalNamespace: string;

    // 1. 检查节点定义中是否已显式设置命名空间
    if (node.namespace) {
      finalNamespace = node.namespace;
    } else if (filePath) {
      // 2. 尝试从文件路径推断命名空间
      try {
        // 获取相对于 nodes 目录的路径
        const relativePath = path.relative(baseNodesPath, path.dirname(filePath)); // 使用 dirname 获取目录
        const parts = relativePath.split(path.sep);

        // 简单的推断逻辑 (根据需要调整)
        if (relativePath === "" || relativePath === ".") {
          // 直接在 nodes/ 目录下
          finalNamespace = "core";
        } else {
          const subDir = parts[0];
          // Treat all subdirectories under src/nodes/ as 'core' unless explicitly overridden
          // if (subDir === 'io') {
          //     finalNamespace = 'core'; // IO 视为核心
          // } else if (subDir === 'llm-test') {
          //     finalNamespace = 'builtin'; // LLM 测试视为内置扩展/示例 -> CHANGE TO CORE
          // // } else if (subDir === 'plugins') { // 示例：未来插件的推断
          // //     finalNamespace = parts[1] || 'unknown_plugin'; // 使用插件目录名
          // // } else if (subDir === 'user') { // 示例：用户节点的推断
          //     finalNamespace = 'user';
          // } else {
          //     console.warn(`Unknown subdirectory structure for path inference: ${relativePath}. Using 'core' namespace for ${node.type}.`);
          //     finalNamespace = 'core'; // Default unknown subdirs to 'core' as well
          // }
          // Simplified: Assume all subdirs are 'core' for now
          finalNamespace = "core";
          //     finalNamespace = 'user';
          // } else {
          console.warn(
            `Unknown subdirectory structure for path inference: ${relativePath}. Using 'unknown' namespace for ${node.type}.`
          );
          finalNamespace = "unknown"; // 未知结构，使用 'unknown'
          // }
        }
        // console.log(`Inferred namespace '${finalNamespace}' for node type '${node.type}' from path '${filePath}'`);
      } catch (error) {
        console.error(`Error inferring namespace for ${node.type} from path ${filePath}:`, error);
        finalNamespace = "unknown";
      }
    } else {
      // 3. 无法确定命名空间
      console.warn(
        `Namespace could not be determined for node type '${node.type}'. Using 'unknown'. Provide namespace explicitly or ensure filePath is passed during registration.`
      );
      finalNamespace = "unknown";
    }

    // 将最终确定的命名空间存回节点定义对象，以便 getDefinitions 返回一致数据
    node.namespace = finalNamespace;
    if (filePath) {
      // Store the filePath if provided
      node.filePath = filePath;
    }

    // 组合 fullType
    const fullType = `${finalNamespace}:${node.type}`;

    // 检查是否已存在相同 fullType 的节点
    if (this.nodes.has(fullType)) {
      // 注意：NodeLoader 现在可能会多次导入同一个文件（例如直接导入和通过 index.ts 导入）
      // 暂时只记录警告，后续可能需要优化 NodeLoader 或注册逻辑来避免重复
      // console.warn(`Node type "${fullType}" is already registered. Overwriting definition. Source: ${filePath || 'unknown'}`);
    }

    // 使用 fullType 作为键存储
    this.nodes.set(fullType, node);
  }

  getDefinitions(): NodeDefinition[] {
    // 返回的定义包含了最终确定的 namespace
    return Array.from(this.nodes.values());
  }

  /**
   * 获取指定完整类型 (namespace:type) 的节点定义。
   * @param fullType - 节点的完整类型字符串，格式为 "namespace:type"。
   * @returns 节点定义或 undefined。
   */
  getNode(fullType: string): NodeDefinition | undefined {
    // 直接使用 fullType 查找
    return this.nodes.get(fullType);
  }

  /**
   * 根据命名空间卸载一组节点。
   * @param namespace - 要卸载的节点的命名空间。
   * @returns 返回被卸载的节点数量。
   */
  unregisterNodesByNamespace(namespace: string): number {
    const nodesToUnregister: string[] = [];
    for (const [fullType, definition] of this.nodes.entries()) {
      if (definition.namespace === namespace) {
        nodesToUnregister.push(fullType);
      }
    }

    for (const fullType of nodesToUnregister) {
      this.nodes.delete(fullType);
    }

    if (nodesToUnregister.length > 0) {
      console.log(`[NodeManager] Unregistered ${nodesToUnregister.length} nodes for namespace: ${namespace}`);
    }

    return nodesToUnregister.length;
  }

  /**
   * 清空所有已注册的节点。
   */
  clearNodes() {
    this.nodes.clear();
    console.log("[NodeManager] All registered nodes have been cleared.");
  }
}

// 创建单例实例
export const nodeManager = new NodeManager();
