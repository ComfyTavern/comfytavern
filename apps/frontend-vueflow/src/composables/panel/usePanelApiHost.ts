import { watchEffect, type Ref, watch, ref, onMounted, onUnmounted } from 'vue';
import { klona } from 'klona';
import { useExecutionStore } from '@/stores/executionStore';
import { useApiAdapterManager } from '@/services/ApiAdapterManager';
import { getApiBaseUrl } from '@/utils/urlUtils';
import { ExecutionStatus } from '@comfytavern/types';
import type { InvocationRequest, PanelDefinition, PanelFile, PanelApiHost } from '@comfytavern/types';
import { usePanelStore } from '@/stores/panelStore';
import { useThemeStore } from '@/stores/theme'; // 引入主题 store

// 定义消息协议接口
interface ApiRequestMessage {
  type: 'comfy-tavern-api-call' | 'panel-sdk-ready' | 'panel-log' | 'comfy-tavern-theme-update';
  id?: string;
  payload?: {
    method: string;
    args: any[];
    level?: 'log' | 'warn' | 'error' | 'debug';
    message?: any[];
  };
}

interface ApiResponseMessage {
  type: 'comfy-tavern-api-response';
  id: string;
  payload?: any;
  error?: { message: string };
}

/**
 * usePanelApiHost Composable
 * @param iframeRef - 对 iframe 元素的引用
 * @param panelOrigin - 面板的预期源，用于安全验证
 * @param logs - 用于记录面板日志的 Ref
 */
export function usePanelApiHost(
  iframeRef: Ref<HTMLIFrameElement | null>,
  panelOrigin: Ref<string>,
  projectId: Ref<string | null>,
  panelId: Ref<string | null>,
  logs: Ref<any[]>
) {
  const executionStore = useExecutionStore();
  const apiAdapterManager = useApiAdapterManager();
  const panelStore = usePanelStore();
  const themeStore = useThemeStore(); // 实例化主题 store

  const panelDef = ref<PanelDefinition | null>(null);
  const activeSubscriptions = new Map<string, () => void>(); // 存储 executionId -> unwatch function

  const getAuthToken = () => localStorage.getItem('authToken');

  // --- 辅助函数，用于构建面板文件系统 API 的基础 URL ---
  const getPanelFsApiUrl = (filePath: string = ''): string => {
    if (!projectId.value || !panelId.value) {
      throw new Error('Project ID and Panel ID must be available to use file system API.');
    }
    // 路径的各个部分应该被编码，以处理特殊字符
    const safeFilePath = filePath.split('/').map(encodeURIComponent).join('/');
    const baseUrl = getApiBaseUrl();
    return `${baseUrl}/projects/${encodeURIComponent(projectId.value)}/panels/${encodeURIComponent(panelId.value)}/fs/${safeFilePath}`;
  };

  const panelApiHost: PanelApiHost = {
    /**
     * @deprecated 将在未来版本移除，请使用 invoke 方法。
     * 为了向后兼容，此方法内部会调用 invoke({ mode: 'native', ... })
     */
    executeWorkflow: async (request: { workflowId: string; inputs: Record<string, any> }) => {
      console.warn('[Host] executeWorkflow is deprecated. Please use the new invoke() method.');
      // 旧版方法不处理别名，直接使用 workflowId
      return panelApiHost.invoke({
        mode: 'native',
        workflowId: request.workflowId,
        inputs: request.inputs,
      });
    },

    /**
     * 新的核心调用方法，支持原生、适配器和别名模式。
     * @param request - InvocationRequest 对象
     * @returns 返回一个包含 executionId 的对象
     */
    invoke: async (request: InvocationRequest) => {
      console.log('[Host] Received invoke call with request:', request);
      
      if (!panelDef.value) {
        throw new Error("面板定义尚未加载，无法处理调用请求。");
      }

      // 验证请求的有效性
      if (request.mode === 'native' && !request.workflowId) {
        throw new Error("原生模式调用缺少 'workflowId'。");
      }
      if (request.mode === 'adapter' && !request.adapterId) {
        throw new Error("适配器模式调用缺少 'adapterId'。");
      }
      if (!request.mode) {
        throw new Error("调用请求缺少 'mode'。");
      }

       // 将验证和转换后的请求转发给 ApiAdapterManager
       return await apiAdapterManager.invoke(request);
    },

    /**
     * 订阅指定 executionId 的执行事件。
     * @param executionId - 从 executeWorkflow 返回的执行 ID
     */
    subscribeToExecutionEvents: (executionId: string) => {
      console.log(`[Host] Subscribing to events for executionId: ${executionId}`);

      // 如果已存在订阅，先取消旧的
      if (activeSubscriptions.has(executionId)) {
        activeSubscriptions.get(executionId)?.();
      }

      const unwatch = watch(
        // 只监听工作流的状态本身
        () => executionStore.tabExecutionStates.get(executionId)?.workflowStatus,
        (newStatus, oldStatus) => {
          if (!newStatus) return;

          // 当状态变为 COMPLETE 时，从 store 中获取最新的完整状态
          if (newStatus === ExecutionStatus.COMPLETE && oldStatus !== ExecutionStatus.COMPLETE) {
            const finalState = executionStore.tabExecutionStates.get(executionId);
            if (!finalState) return;
            
            const finalOutputs = finalState.nodeOutputs['__WORKFLOW_INTERFACE_OUTPUTS__'] || {};

            iframeRef.value?.contentWindow?.postMessage({
              type: 'execution-event',
              event: 'onResult',
              executionId,
              payload: klona({ status: 'COMPLETE', outputs: finalOutputs })
            }, panelOrigin.value);
            unwatch();
            activeSubscriptions.delete(executionId);
          }

          // 当状态变为 ERROR 时，同样获取最新状态
          if (newStatus === ExecutionStatus.ERROR && oldStatus !== ExecutionStatus.ERROR) {
             const finalState = executionStore.tabExecutionStates.get(executionId);
            if (!finalState) return;

            iframeRef.value?.contentWindow?.postMessage({
              type: 'execution-event',
              event: 'onError',
              executionId,
              payload: klona({ error: finalState.workflowError })
            }, panelOrigin.value);
            unwatch();
            activeSubscriptions.delete(executionId);
          }
        }
      );

      activeSubscriptions.set(executionId, unwatch);

      // 返回一个成功的标志给面板
      return true;
    },

    /**
     * @deprecated 主题和语言现在通过 dedicated message types 推送
     */
    getSettings: () => {
      console.warn('[Host] getSettings is deprecated and will be removed.');
      const theme = themeStore.currentThemePreset?.variants[themeStore.currentAppliedMode];
      return Promise.resolve({
        theme: themeStore.currentAppliedMode,
        language: 'zh-CN', // TODO: 替换为从 i18n store 获取
        variables: theme?.variables || {}
      });
    },

    // --- 文件系统 API 实现 ---
    async listFiles(path: string): Promise<PanelFile[]> {
      const url = getPanelFsApiUrl(path);
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to list files at '${path}': ${response.statusText}`);
      }
      return response.json();
    },

    async readFile(path: string, encoding: 'utf-8' | 'binary' = 'utf-8'): Promise<string | ArrayBuffer> {
      const url = getPanelFsApiUrl(path);
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to read file at '${path}': ${response.statusText}`);
      }
      if (encoding === 'binary') {
        return response.arrayBuffer();
      }
      return response.text();
    },

    async writeFile(path: string, content: string | Blob): Promise<void> {
      const url = getPanelFsApiUrl(path);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        body: content
      });
      if (!response.ok) {
        throw new Error(`Failed to write file at '${path}': ${response.statusText}`);
      }
    },

    async deleteFile(path: string, options?: { recursive?: boolean }): Promise<void> {
      let url = getPanelFsApiUrl(path);
      if (options?.recursive) {
        url += '?recursive=true';
      }
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to delete '${path}': ${response.statusText}`);
      }
    },

    async createDirectory(path: string): Promise<void> {
      const url = getPanelFsApiUrl(path);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/vnd.comfy.create-directory'
        },
        body: '' // body can't be null for post
      });
      if (!response.ok) {
        throw new Error(`Failed to create directory at '${path}': ${response.statusText}`);
      }
    }
  };

  /**
   * 处理从 iframe 收到的消息。
   */
  const handleMessage = async (event: MessageEvent) => {
    // --- 安全验证 ---
    if (event.origin !== panelOrigin.value && panelOrigin.value !== '*') {
      console.warn(`[Host] Ignored message from unexpected origin: ${event.origin}. Expected: ${panelOrigin.value}`);
      return;
    }

    const data = event.data as ApiRequestMessage;
    
    if (data.type === 'panel-sdk-ready') {
      console.log('[Host] Received panel-sdk-ready message. Sending initial theme.');
      sendThemeToPanel(); // 在 SDK 就绪后立即发送主题
      return;
    }
    
    if (data.type === 'panel-log' && data.payload) {
      logs.value.push({
        ...data.payload,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (data.type !== 'comfy-tavern-api-call') {
      return;
    }

    const { id, payload } = data;
    if (!id || !payload) {
      console.error('[Host] API call received without ID or payload. Ignoring.');
      return;
    }
    
    console.log(`[Host] Received API call for method: ${payload.method}`);
    const { method, args } = payload;
    const apiMethod = (panelApiHost as any)[method];

    if (typeof apiMethod === 'function') {
      try {
        const result = await apiMethod(...args);
        const response: ApiResponseMessage = { type: 'comfy-tavern-api-response', id, payload: result };
        iframeRef.value?.contentWindow?.postMessage(response, panelOrigin.value);
      } catch (e: any) {
        const response: ApiResponseMessage = { type: 'comfy-tavern-api-response', id, error: { message: e.message || 'An unknown error occurred' } };
        iframeRef.value?.contentWindow?.postMessage(response, panelOrigin.value);
      }
    } else {
      const response: ApiResponseMessage = { type: 'comfy-tavern-api-response', id, error: { message: `Method "${method}" not found.` } };
      iframeRef.value?.contentWindow?.postMessage(response, panelOrigin.value);
    }
  };

  /**
  /**
   * 发送当前主题信息到 iframe。
   */
  function sendThemeToPanel() {
    const iframe = iframeRef.value;
    if (!iframe || !iframe.contentWindow) {
      return;
    }

    const theme = themeStore.currentThemePreset;
    const mode = themeStore.currentAppliedMode;

    if (!theme) {
      console.warn('[Host] Cannot send theme: No theme preset selected.');
      return;
    }
    
    const variant = theme.variants[mode];
    if (!variant || !variant.variables) {
       console.warn(`[Host] Cannot send theme: Variant "${mode}" for theme "${theme.id}" is invalid or has no variables.`);
      return;
    }

    const themePayload = {
      type: 'comfy-tavern-theme-update',
      payload: {
        mode: mode,
        variables: klona(variant.variables), // 使用 klona 深度克隆，避免响应式对象问题
      },
    };
    
    iframe.contentWindow.postMessage(themePayload, panelOrigin.value || '*');
    console.log(`[Host] Sent theme update to panel. Mode: ${mode}`);
  }

  // 1. 只负责响应式地获取面板定义
  watchEffect(async () => {
    if (projectId.value && panelId.value) {
      panelDef.value = await panelStore.fetchPanelDefinition(projectId.value, panelId.value);
      if (!panelDef.value) {
        console.error(`[Host] Failed to fetch panel definition for ${panelId.value}. API calls may fail.`);
      }
    } else {
      panelDef.value = null;
    }
  });
  
  // 2. 将事件监听和清理与组件的生命周期绑定
  onMounted(() => {
    window.addEventListener('message', handleMessage);
    console.log(`[Host] Panel API host initialized and listening for messages.`);
  });

  onUnmounted(() => {
    window.removeEventListener('message', handleMessage);
    // 清理所有遗留的订阅，以防万一
    activeSubscriptions.forEach(unwatch => unwatch());
    activeSubscriptions.clear();
    console.log(`[Host] Panel API host cleaned up.`);
  });

  // 监视主题变化，并将其同步到面板
  watch(
    () => [themeStore.selectedThemeId, themeStore.currentAppliedMode],
    () => {
      console.log('[Host] Theme changed, sending update to panel.');
      sendThemeToPanel();
    },
    { deep: true }
  );
}