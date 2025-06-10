import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { StatItem } from '@/components/graph/sidebar/PerformancePanel.vue';

export const usePerformanceStatsStore = defineStore('performanceStats', () => {
  // 使用 Map 来存储每个标签页 (internalId) 的统计数据
  // Key: tabInternalId (来自 tabStore.activeTab.internalId)
  // Value: StatItem[]
  const statsByTab = ref<Map<string, StatItem[]>>(new Map());
  const collectedByTab = ref<Map<string, boolean>>(new Map()); // 追踪每个标签页是否已收集过数据
  const loadingByTab = ref<Map<string, boolean>>(new Map()); // 追踪每个标签页的加载状态

  // 新增：存储每个标签页的组件实例计数
  // Key: tabInternalId
  // Value: Record<componentType: string, count: number>
  const componentCountsByTab = ref<Map<string, Record<string, number>>>(new Map());

  function getStats(tabInternalId: string): StatItem[] | undefined {
    return statsByTab.value.get(tabInternalId);
  }

  function setStats(tabInternalId: string, stats: StatItem[]): void {
    statsByTab.value.set(tabInternalId, stats);
    collectedByTab.value.set(tabInternalId, true);
    loadingByTab.value.set(tabInternalId, false); // 数据设置完成，加载结束
  }

  function hasCollected(tabInternalId: string): boolean {
    return collectedByTab.value.get(tabInternalId) || false;
  }

  function isLoading(tabInternalId: string): boolean {
    return loadingByTab.value.get(tabInternalId) || false;
  }

  function setLoading(tabInternalId: string, isLoadingState: boolean): void {
    loadingByTab.value.set(tabInternalId, isLoadingState);
    if (isLoadingState) {
      // 如果开始加载，通常意味着要重新收集，可以清除旧的 collected 状态
      // collectedByTab.value.delete(tabInternalId); // 或者在 collectStats 开始时处理
    }
  }

  function clearStats(tabInternalId: string): void {
    statsByTab.value.delete(tabInternalId);
    collectedByTab.value.delete(tabInternalId);
    loadingByTab.value.delete(tabInternalId);
    componentCountsByTab.value.delete(tabInternalId); // 新增：清除组件计数
    console.log(`[PerformanceStatsStore] Cleared stats for tab ${tabInternalId}`);
  }

  // 新增 Actions 和 Getters 用于组件计数
  function incrementComponentCount(tabInternalId: string, componentType: string): void {
    const counts = componentCountsByTab.value.get(tabInternalId) || {};
    counts[componentType] = (counts[componentType] || 0) + 1;
    componentCountsByTab.value.set(tabInternalId, counts);
  }

  function decrementComponentCount(tabInternalId: string, componentType: string): void {
    const counts = componentCountsByTab.value.get(tabInternalId);
    if (counts) {
      // 确保 componentType 存在且其值为数字，并且大于0
      if (typeof counts[componentType] === 'number' && counts[componentType] > 0) {
        counts[componentType]--;
        if (counts[componentType] === 0) {
          delete counts[componentType]; // 可选：如果计数为0，则移除该类型
        }
      }
      // 如果counts变为空对象，则从Map中删除该tabId的条目
      if (Object.keys(counts).length === 0) {
        componentCountsByTab.value.delete(tabInternalId);
      } else {
        // 只有在 counts 实际被修改过（即 componentType 存在且大于0，或 componentType 被删除，或 counts 变为空）
        // 或者即使没改，为了确保 Map 更新，也 set 一下。
        // 如果 counts[componentType] 一开始就不存在，这里 set 也无妨。
        componentCountsByTab.value.set(tabInternalId, counts);
      }
    }
  }

  function getComponentStats(tabInternalId: string): Record<string, number> | undefined {
    return componentCountsByTab.value.get(tabInternalId);
  }

  function setComponentUsageStats(tabInternalId: string, componentUsage: Record<string, number>): void {
    componentCountsByTab.value.set(tabInternalId, componentUsage);
  }

  return {
    // statsByTab, // 不直接暴露 Map，通过 getter 操作
    // collectedByTab,
    // loadingByTab,
    getStats,
    setStats,
    hasCollected,
    isLoading,
    setLoading,
    clearStats,
    // 新增导出
    incrementComponentCount,
    decrementComponentCount,
    getComponentStats,
    setComponentUsageStats, // 导出新添加的 action
  };
});