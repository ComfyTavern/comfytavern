import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ExtensionInfo } from '@comfytavern/types';
import * as pluginApi from '@/api/pluginApi';
import { useDialogService } from '@/services/DialogService';
import { deepClone } from '@/utils/deepClone';

export const usePluginStore = defineStore('plugin', () => {
  const dialogService = useDialogService();

  // --- State ---
  const plugins = ref<ExtensionInfo[]>([]);
  const originalPlugins = ref<ExtensionInfo[]>([]); // + 咕咕：存储原始插件状态
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // --- Getters / Computed ---
  const hasPendingChanges = computed(() => {
    if (plugins.value.length !== originalPlugins.value.length) {
      return true;
    }
    for (const originalPlugin of originalPlugins.value) {
      const currentPlugin = plugins.value.find(p => p.name === originalPlugin.name);
      if (!currentPlugin || currentPlugin.isEnabled !== originalPlugin.isEnabled) {
        return true;
      }
    }
    return false;
  });

  // --- Actions ---

  /**
   * 获取所有已发现的插件列表。
   */
  const fetchPlugins = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const fetchedPlugins = await pluginApi.getPlugins();
      plugins.value = deepClone(fetchedPlugins);
      originalPlugins.value = deepClone(fetchedPlugins);
    } catch (e: any) {
      const errorMessage = e.message || '获取插件列表失败。';
      error.value = errorMessage;
      dialogService.showError(errorMessage, '加载失败');
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 设置插件的启用状态。
   * @param {string} pluginName - 插件的名称。
   * @param {boolean} enabled - true 表示启用, false 表示禁用。
   */
  const setPluginEnabled = async (pluginName: string, enabled: boolean) => {
    try {
      await pluginApi.setPluginState(pluginName, enabled);
      // 更新本地状态以立即反映UI变化
      const plugin = plugins.value.find(p => p.name === pluginName);
      if (plugin) {
        plugin.isEnabled = enabled;
      }
    } catch (e: any) {
      const errorMessage = e.message || `设置插件 "${pluginName}" 状态失败。`;
      dialogService.showError(errorMessage, '操作失败');
      // 如果API调用失败，则恢复UI状态
      const originalPlugin = originalPlugins.value.find(p => p.name === pluginName);
      if (originalPlugin) {
        const pluginToRevert = plugins.value.find(p => p.name === pluginName);
        if (pluginToRevert) {
          pluginToRevert.isEnabled = originalPlugin.isEnabled;
        }
      }
    }
  };

  /**
   * 请求后端重新加载所有插件。
   */
  const reloadPlugins = async () => {
    dialogService.showToast({
        type: 'info',
        message: '正在应用更改并重载插件，请稍候...',
        duration: 0, // 持续显示直到被替换
    });
    try {
      const result = await pluginApi.reloadPlugins();
      dialogService.showSuccess(result.message, '操作成功');
      // 可以在这里触发页面刷新或通知用户手动刷新
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message || '重载插件失败。';
      dialogService.showError(errorMessage, '操作失败');
    }
  };

  return {
    // State
    plugins,
    isLoading,
    error,
    // Getters
    hasPendingChanges,
    // Actions
    fetchPlugins,
    setPluginEnabled,
    reloadPlugins,
  };
});