import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type { PanelDefinition } from '@comfytavern/types';
import { api, getPanels, getPanelDefinition } from '@/utils/api';
import { useDialogService } from '@/services/DialogService';
import { fileManagerApiClient } from '@/api/fileManagerApi';

export const usePanelStore = defineStore('panel', () => {
  const dialogService = useDialogService();

  // State
  const panelsById = reactive(new Map<string, PanelDefinition>());
  const panelList = ref<PanelDefinition[]>([]);
  const isLoadingList = ref(false);
  const isLoadingDefinition = ref(false);
  const isSavingDefinition = ref(false);

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
  
    /**
     * 保存面板定义文件。
     * @param projectId - 项目的唯一标识符。
     * @param panelDef - 要保存的完整面板定义对象。
     */
  async function savePanelDefinition(projectId: string, panelDef: PanelDefinition): Promise<boolean> {
    if (!projectId || !panelDef.id || !panelDef.panelDirectory) {
      console.error('[panelStore] savePanelDefinition: projectId, panelId 或 panelDirectory 缺失。', { projectId, panelDef });
      dialogService.showError('保存失败：关键信息缺失。');
      return false;
    }
    isSavingDefinition.value = true;
    try {
      // panel.json 的完整逻辑路径
      const panelPath = `user://projects/${projectId}/ui/${panelDef.panelDirectory}/panel.json`;
      await fileManagerApiClient.writeJsonFile(panelPath, panelDef);

      // 更新本地缓存
      panelsById.set(panelDef.id, panelDef);
      const index = panelList.value.findIndex(p => p.id === panelDef.id);
      if (index !== -1) {
        panelList.value[index] = panelDef;
      }

      dialogService.showSuccess('面板配置已保存。');
      return true;
    } catch (error) {
      console.error(`[panelStore] 保存面板定义失败 (ID: ${panelDef.id}):`, error);
      dialogService.showError(`保存面板 ${panelDef.displayName} 失败。`);
      return false;
    } finally {
      isSavingDefinition.value = false;
    }
  }

  /**
   * 获取所有可用的面板模板。
   */
  async function fetchPanelTemplates(): Promise<PanelDefinition[]> {
    try {
      const templates = await api.get<PanelDefinition[]>('/panels/templates');
      return templates.data;
    } catch (error) {
      console.error('[panelStore] 获取面板模板失败:', error);
      throw new Error('获取面板模板失败。');
    }
  }

  /**
   * 创建新面板（从模板或全新）。
   * @param projectId - 项目的唯一标识符。
   * @param data - 创建所需的数据。
   */
  async function createPanel(
    projectId: string,
    data: { templateId?: string | null; panelId: string; displayName: string }
  ): Promise<PanelDefinition> {
    try {
      const newPanel = await api.post<PanelDefinition>(`/projects/${projectId}/panels`, data);
      // 创建成功后，刷新列表
      await fetchPanelList(projectId);
      return newPanel.data;
    } catch (error: any) {
      console.error('[panelStore] 创建面板失败:', error);
      const errorMessage = error.response?.data?.error || '创建失败，请检查 ID 是否唯一。';
      throw new Error(errorMessage);
    }
  }

  return {
    // State
    panelsById,
    panelList,
    isLoadingList,
    isLoadingDefinition,
    isSavingDefinition,

    // Actions
    fetchPanelList,
    fetchPanelDefinition,
    savePanelDefinition,
    fetchPanelTemplates,
    createPanel,
  };
});