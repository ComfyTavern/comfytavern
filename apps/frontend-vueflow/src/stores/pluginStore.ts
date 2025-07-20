import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ExtensionInfo } from '@comfytavern/types';
import * as pluginApi from '@/api/pluginApi';
import { useDialogService } from '@/services/DialogService';
import { deepClone } from '@/utils/deepClone';
import { useWebSocketCore } from '@/services/WebSocketCoreService';
import { loadPluginAssets, unloadPluginAssets } from '@/services/PluginLoaderService';

let isListenerInitialized = false;

export const usePluginStore = defineStore('plugin', () => {
  const dialogService = useDialogService();
  const ws = useWebSocketCore();

  // --- State ---
  const plugins = ref<ExtensionInfo[]>([]);
  const originalPlugins = ref<ExtensionInfo[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const pendingPlugins = ref<string[]>([]); // 咕咕：跟踪正在变更状态的插件
  const pendingTimeouts = ref(new Map<string, ReturnType<typeof setTimeout>>()); // 咕咕：跟踪待处理插件的超时计时器

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
    // 咕咕：将插件标记为处理中
    if (!pendingPlugins.value.includes(pluginName)) {
      pendingPlugins.value.push(pluginName);
    }

    // 咕咕：清除可能存在的旧超时器，防止竞争条件
    if (pendingTimeouts.value.has(pluginName)) {
      clearTimeout(pendingTimeouts.value.get(pluginName)!);
      pendingTimeouts.value.delete(pluginName);
    }

    try {
      await pluginApi.setPluginState(pluginName, enabled);

      // 咕咕：设置一个超时，以防 websocket 消息丢失
      const timeoutId = setTimeout(() => {
        // 只有当插件仍处于待处理状态时才显示超时
        if (pendingPlugins.value.includes(pluginName)) {
          dialogService.showWarning(
            `未收到插件 "${pluginName}" 的状态变更确认。网络可能存在延迟，请刷新页面查看最终状态。`,
            '操作超时'
          );
          // 从处理中状态移除
          pendingPlugins.value = pendingPlugins.value.filter(p => p !== pluginName);
          pendingTimeouts.value.delete(pluginName);
        }
      }, 8000); // 8秒超时

      pendingTimeouts.value.set(pluginName, timeoutId);

    } catch (e: any) {
      const errorMessage = e.message || `设置插件 "${pluginName}" 状态失败。`;
      dialogService.showError(errorMessage, '操作失败');

      // 咕咕：如果API调用失败，则从处理中列表里移除
      pendingPlugins.value = pendingPlugins.value.filter(p => p !== pluginName);
      // 确保也清理掉可能已设置的超时器
      if (pendingTimeouts.value.has(pluginName)) {
        clearTimeout(pendingTimeouts.value.get(pluginName)!);
        pendingTimeouts.value.delete(pluginName);
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

  /**
   * 监听来自后端的插件状态变更事件。
   */
  const listenToPluginChanges = () => {
    if (isListenerInitialized) return;

    ws.subscribe('plugin-store', (message: any) => {
      if (message.type === 'plugin-enabled') {
        const newPlugin = message.payload.plugin as ExtensionInfo;
        console.log(`[PluginStore] Received plugin-enabled event for: ${newPlugin.displayName}`);
        loadPluginAssets(newPlugin);
        // 更新插件列表
        const existing = plugins.value.find(p => p.name === newPlugin.name);
        if (existing) {
          Object.assign(existing, newPlugin, { isEnabled: true });
        } else {
          plugins.value.push({ ...newPlugin, isEnabled: true });
        }
        originalPlugins.value = deepClone(plugins.value); // 同步原始状态
        dialogService.showSuccess(`插件 "${newPlugin.displayName}" 已启用。`);
        // 咕咕：清除超时器，防止不必要的超时警告
        if (pendingTimeouts.value.has(newPlugin.name)) {
          clearTimeout(pendingTimeouts.value.get(newPlugin.name)!);
          pendingTimeouts.value.delete(newPlugin.name);
        }
        // 咕咕：从处理中列表里移除
        pendingPlugins.value = pendingPlugins.value.filter(p => p !== newPlugin.name);

      } else if (message.type === 'plugin-disabled') {
        const { pluginName } = message.payload;
        console.log(`[PluginStore] Received plugin-disabled event for: ${pluginName}`);
        unloadPluginAssets(pluginName);
        // 更新插件列表状态
        const plugin = plugins.value.find(p => p.name === pluginName);
        if (plugin) {
          plugin.isEnabled = false;
        }
        originalPlugins.value = deepClone(plugins.value); // 同步原始状态
        dialogService.showSuccess(`插件 "${pluginName}" 已禁用。`);
        // 咕咕：清除超时器，防止不必要的超时警告
        if (pendingTimeouts.value.has(pluginName)) {
          clearTimeout(pendingTimeouts.value.get(pluginName)!);
          pendingTimeouts.value.delete(pluginName);
        }
        // 咕咕：从处理中列表里移除
        pendingPlugins.value = pendingPlugins.value.filter(p => p !== pluginName);

      } else if (message.type === 'plugins-reloaded') {
        dialogService.showSuccess(message.payload.message, '插件已重载');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    });

    isListenerInitialized = true;
    console.log('[PluginStore] WebSocket listener for plugin changes initialized.');
  };

  // 咕咕：导出一个 getter 用于检查插件是否正在处理中
  const isPluginPending = computed(() => (pluginName: string) => pendingPlugins.value.includes(pluginName));

  return {
    // State
    plugins,
    isLoading,
    error,
    // Getters
    hasPendingChanges,
    isPluginPending,
    // Actions
    fetchPlugins,
    setPluginEnabled,
    reloadPlugins,
    listenToPluginChanges,
  };
});