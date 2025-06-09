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
    console.log(`[PerformanceStatsStore] Cleared stats for tab ${tabInternalId}`);
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
  };
});