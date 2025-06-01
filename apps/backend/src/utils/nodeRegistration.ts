import type { NodeDefinition } from '@comfytavern/types';
import type { NodeManager } from '../services/NodeManager';

/**
 * 创建一个节点注册器，可以为一组节点设置默认命名空间。
 * @param defaultNamespace - 该注册器实例注册节点时使用的默认命名空间。
 * @returns 一个包含 register 方法的对象。
 */
export function createNodeRegisterer(defaultNamespace: string) {
  return {
    /**
     * 注册一个或多个节点定义。
     * 如果节点定义没有显式指定 namespace，则使用创建注册器时提供的 defaultNamespace。
     * @param manager - NodeManager 的实例。
     * @param definitionOrArray - 单个节点定义或节点定义数组。
     * @param filePath - (可选) 节点定义文件的路径，用于 NodeManager 推断命名空间（如果需要）。
     */
    register(
      manager: NodeManager,
      definitionOrArray: NodeDefinition | NodeDefinition[],
      filePath?: string // 可选的文件路径参数
    ): void {
      const definitions = Array.isArray(definitionOrArray)
        ? definitionOrArray
        : [definitionOrArray];

      for (const definition of definitions) {
        // 如果节点定义没有自己的命名空间，则应用默认命名空间
        if (definition.namespace === undefined) {
          definition.namespace = defaultNamespace;
        }
        // 调用 NodeManager 的注册方法，传递定义和可选的文件路径
        manager.registerNode(definition, filePath);
      }
    },
  };
}