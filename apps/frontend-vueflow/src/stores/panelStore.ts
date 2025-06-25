import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type { PanelDefinition } from '@comfytavern/types';
import { getPanels, getPanelDefinition } from '@/utils/api';
import { useDialogService } from '@/services/DialogService';

export const usePanelStore = defineStore('panel', () => {
  const dialogService = useDialogService();

  // State
  const panelsById = reactive(new Map<string, PanelDefinition>());
  const panelList = ref<PanelDefinition[]>([]);
  const isLoadingList = ref(false);
  const isLoadingDefinition = ref(false);

  // Actions

  /**
   * 获取并缓存指定项目的所有面板列表。
   * @param projectId - 项目的唯一标识符。
   */
  async function fetchPanelList(projectId: string) {
    if (!projectId) {
      console.warn('[panelStore] fetchPanelList called with no projectId.');
      return;
    }
    isLoadingList.value = true;
    try {
      const fetchedPanels = await getPanels(projectId);
      panelList.value = fetchedPanels;
      // 同时更新缓存
      for (const panel of fetchedPanels) {
        if (!panelsById.has(panel.id)) {
          panelsById.set(panel.id, panel);
        }
      }
    } catch (error) {
      console.error(`[panelStore] 获取项目 "${projectId}" 的面板列表失败:`, error);
      dialogService.showError(`获取面板列表失败`, '错误');
      panelList.value = [];
    } finally {
      isLoadingList.value = false;
    }
  }

  /**
   * 获取并缓存单个面板的详细定义。
   * 如果缓存中已存在，则直接返回缓存数据。
   * @param projectId - 项目的唯一标识符。
   * @param panelId - 面板的唯一标识符。
   * @returns 返回单个面板定义的 Promise，如果找不到则返回 null。
   */
  async function fetchPanelDefinition(projectId: string, panelId: string): Promise<PanelDefinition | null> {
    if (!projectId || !panelId) {
      console.warn('[panelStore] fetchPanelDefinition called with no projectId or panelId.');
      return null;
    }

    // 1. 首先检查缓存
    if (panelsById.has(panelId)) {
      return panelsById.get(panelId) ?? null;
    }

    // 2. 如果不存在，则从后端获取
    isLoadingDefinition.value = true;
    try {
      const panelDef = await getPanelDefinition(projectId, panelId);
      // 3. 获取成功后，存入缓存
      panelsById.set(panelId, panelDef);
      return panelDef;
    } catch (error) {
      console.error(`[panelStore] 获取面板定义 "${panelId}" (项目: "${projectId}") 失败:`, error);
      dialogService.showError(`获取面板 ${panelId} 失败`, '错误');
      return null;
    } finally {
      isLoadingDefinition.value = false;
    }
  }

  return {
    // State
    panelsById,
    panelList,
    isLoadingList,
    isLoadingDefinition,

    // Actions
    fetchPanelList,
    fetchPanelDefinition,
  };
});