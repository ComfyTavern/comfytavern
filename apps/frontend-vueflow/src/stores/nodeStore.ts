import { ref, computed, watch } from 'vue'; // 导入 watch
import { defineStore } from 'pinia'; // 导入 defineStore
import { useApi } from '../utils/api';
// 导入共享类型并重命名
import type { NodeDefinition as SharedNodeDefinition } from '@comfytavern/types';
import type { CSSProperties } from 'vue';

// 节点样式类型
export type NodeStyle = CSSProperties;

// 定义前端特定的节点定义类型，排除后端字段，并包含 clientScriptUrl
export type FrontendNodeDefinition = Omit<
  SharedNodeDefinition,
  'execute' | 'isGroupInternal' | 'groupId' | 'groupConfig'
> & {
  // 添加 clientScriptUrl 字段
  clientScriptUrl?: string;
  // 可以根据需要添加前端特有的可选字段，例如 name 或 icon
  // name?: string;
  // icon?: string;
};

// 默认节点样式
export const defaultNodeStyle: NodeStyle = {
  backgroundColor: '#f5f5f5',
  borderColor: '#d9d9d9',
  borderWidth: '1px'
} as const;

// 使用 defineStore 创建 Pinia Store
export const useNodeStore = defineStore('node', () => {
  // --- State ---
  const nodeDefinitions = ref<FrontendNodeDefinition[]>([]); // 使用更新后的前端特定类型
  const definitionsLoaded = ref(false); // 标记定义是否已加载
  const loading = ref(false);
  const error = ref<string | null>(null);

  // --- Getters (Computed) ---
  const nodeDefinitionsByCategory = computed(() => {
    const result: Record<string, FrontendNodeDefinition[]> = {};
    nodeDefinitions.value.forEach((node: FrontendNodeDefinition) => {
      const category = node.category || '未分类';
      if (!result[category]) {
        result[category] = [];
      }
      result[category].push(node);
    });
    return result;
  });

  // --- Actions ---
  /**
   * 获取所有节点定义
   * @param showLoading 是否显示加载状态，默认为true
   * @returns 节点定义数组
   */
  const fetchAllNodeDefinitions = async (showLoading = true) => {
    const api = useApi();
    if (showLoading) {
      loading.value = true;
    }
    definitionsLoaded.value = false; // 重置加载状态
    error.value = null;

    try {
      const data = await api.get<FrontendNodeDefinition[]>('/nodes');
      nodeDefinitions.value = data;
      definitionsLoaded.value = true; // 设置加载完成标志
      // console.debug('节点定义已加载:', nodeDefinitions.value); // 注释掉重复日志
      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取节点定义失败';
      console.error('获取节点定义失败:', err);
      definitionsLoaded.value = false; // 加载失败
      return [];
    } finally {
      if (showLoading) {
        loading.value = false;
      }
    }
  };

  /**
   * 搜索节点定义
   * @param query 搜索关键词
   * @returns 匹配的节点定义数组
   */
  const searchNodeDefinitions = (query: string) => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return nodeDefinitions.value.filter((node: FrontendNodeDefinition) =>
      (node.displayName && node.displayName.toLowerCase().includes(lowerQuery)) ||
      node.type.toLowerCase().includes(lowerQuery) || // Search base type name
      (node.namespace && node.namespace.toLowerCase().includes(lowerQuery)) || // Search namespace
      (node.description && node.description.toLowerCase().includes(lowerQuery)) ||
      (node.category && node.category.toLowerCase().includes(lowerQuery)) ||
      // Also search full type (namespace:type)
      (node.namespace && `${node.namespace.toLowerCase()}:${node.type.toLowerCase()}`.includes(lowerQuery))
    );
  };

  /**
   * 根据完整类型 (namespace:type) 获取节点定义。
   * @param fullType - 节点的完整类型字符串，例如 "core:MergeNode"。
   * @returns 匹配的节点定义或 undefined。
   */
  const getNodeDefinitionByFullType = (fullType: string): FrontendNodeDefinition | undefined => {
    const parts = fullType.split(':');
    if (parts.length !== 2) {
      console.warn(`[NodeStore] Invalid fullType format provided to getNodeDefinitionByFullType: ${fullType}. Expected 'namespace:type'.`);
      // Fallback: Try searching by the provided string as if it were a base type (for potential backward compatibility or simple types)
      return nodeDefinitions.value.find(def => def.type === fullType);
    }
    const [namespace, baseType] = parts;
    return nodeDefinitions.value.find(def => def.namespace === namespace && def.type === baseType);
  };


  // 新增：确保节点定义已加载的辅助函数
  const ensureDefinitionsLoaded = async () => {
    // 如果已加载，直接返回
    if (definitionsLoaded.value) {
      console.debug('[NodeStore] Definitions already loaded.');
      return;
    }
    // 如果正在加载中，则等待加载完成
    if (loading.value) {
      console.debug('[NodeStore] Definitions are loading, awaiting completion...');
      await new Promise<void>((resolve, reject) => {
        // 使用 watch 监听状态变化，并添加类型注解
        const stopWatch = watch(
          [definitionsLoaded, error, loading],
          ([loaded, err, isLoading]: [boolean, string | null, boolean]) => {
            if (loaded) {
              stopWatch(); // 成功加载，停止监听并解决 Promise
              resolve();
            } else if (err) {
              stopWatch(); // 加载出错，停止监听并拒绝 Promise
              reject(new Error(`Failed to load definitions: ${err}`));
            } else if (!isLoading && !loaded) {
              // 处理加载结束但未成功的罕见情况
              stopWatch();
              reject(new Error('Loading finished unexpectedly without success or error.'));
            }
          }
        );
      });
      return; // 等待完成，直接返回
    }
    // 如果未加载且未在加载中，则触发加载
    // console.debug('[NodeStore] Definitions not loaded, initiating fetch...');
    try {
      // 调用 fetchAllNodeDefinitions，但不再次设置 loading 标志，因为它内部会处理
      await fetchAllNodeDefinitions(false);
      // console.debug('[NodeStore] Definitions fetched successfully by ensureDefinitionsLoaded.');
    } catch (err) {
      console.error('[NodeStore] ensureDefinitionsLoaded fetch failed:', err);
      // fetchAllNodeDefinitions 内部已设置 error，这里重新抛出错误
      throw err;
    }
  };

  // --- Return ---
  // 导出 state, getters, actions
  return {
    // State
    nodeDefinitions,
    definitionsLoaded,
    loading,
    error,
    // Getters
    nodeDefinitionsByCategory,
    // Actions
    fetchAllNodeDefinitions,
    searchNodeDefinitions,
    getNodeDefinitionByFullType, // 导出更新后的方法名
    ensureDefinitionsLoaded, // 导出方法名
  };
});