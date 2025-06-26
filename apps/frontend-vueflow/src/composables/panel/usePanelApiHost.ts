import { onUnmounted, type Ref, watch } from 'vue';
import { useExecutionStore } from '@/stores/executionStore';
import { workflowInvocationService } from '@/services/WorkflowInvocationService';
import { useTabStore, type Tab } from '@/stores/tabStore';
import { ExecutionStatus } from '@comfytavern/types';

// 定义消息协议接口
interface ApiRequestMessage {
  type: 'comfy-tavern-api-call' | 'panel-ready' | 'panel-log';
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
  logs: Ref<any[]>
) {
  const executionStore = useExecutionStore();
  const tabStore = useTabStore();
  const activeSubscriptions = new Map<string, () => void>(); // 存储 executionId -> unwatch function

  // --- 宿主端 API 实现 ---
  const panelApiHost = {
    /**
     * 执行一个工作流。
     * @param request - 包含 workflowId 和 inputs 的对象
     * @returns 返回一个包含 executionId 的对象，供后续订阅使用
     */
    executeWorkflow: async (request: { workflowId: string; inputs: Record<string, any> }) => {
      console.log('[Host] Received executeWorkflow call, processing with live-preview check:', request);

      // 检查此工作流是否在某个标签页中打开
      const openedTab: Tab | undefined = tabStore.tabs.find(
        (tab) => tab.type === 'workflow' && tab.associatedId === request.workflowId
      );

      let result;
      if (openedTab) {
        // 如果已打开，则使用 'live' 模式执行
        console.log(`[Host] Workflow ${request.workflowId} is open in tab ${openedTab.internalId}. Using 'live' mode.`);
        result = await workflowInvocationService.invoke({
          mode: 'live',
          targetId: openedTab.internalId, // 使用标签页的 internalId
          inputs: request.inputs,
          source: 'panel',
        });
      } else {
        // 如果未打开，则使用 'saved' 模式执行
        console.log(`[Host] Workflow ${request.workflowId} is not open. Using 'saved' mode.`);
        result = await workflowInvocationService.invoke({
          mode: 'saved',
          targetId: request.workflowId,
          inputs: request.inputs,
          source: 'panel',
        });
      }

      if (result) {
        // 只返回 executionId 给面板，因为 promptId 是后端概念
        return { executionId: result.executionId };
      }
      return null;
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
        () => executionStore.tabExecutionStates.get(executionId),
        (state, oldState) => {
          if (!state) return;

          // 检查流式接口输出
          if (state.streamingInterfaceOutputs) {
            for (const key in state.streamingInterfaceOutputs) {
              const stream = state.streamingInterfaceOutputs[key];
              const oldStream = oldState?.streamingInterfaceOutputs?.[key];
              if (stream && (!oldStream || stream.accumulatedText !== oldStream.accumulatedText)) {
                iframeRef.value?.contentWindow?.postMessage({
                  type: 'execution-event',
                  event: 'onProgress', // 使用 onProgress 作为流式事件
                  executionId,
                  payload: { key, content: stream.accumulatedText, isComplete: !!stream.isComplete }
                }, panelOrigin.value);
              }
            }
          }

          // 检查最终结果
          if (state.workflowStatus === ExecutionStatus.COMPLETE && oldState?.workflowStatus !== ExecutionStatus.COMPLETE) {
            iframeRef.value?.contentWindow?.postMessage({
              type: 'execution-event',
              event: 'onResult',
              executionId,
              payload: { status: 'COMPLETE', outputs: state.nodeOutputs }
            }, panelOrigin.value);
            unwatch(); // 完成后自动取消订阅
            activeSubscriptions.delete(executionId);
          }

          // 检查错误
          if (state.workflowStatus === ExecutionStatus.ERROR && oldState?.workflowStatus !== ExecutionStatus.ERROR) {
            iframeRef.value?.contentWindow?.postMessage({
              type: 'execution-event',
              event: 'onError',
              executionId,
              payload: { error: state.workflowError }
            }, panelOrigin.value);
            unwatch(); // 出错后自动取消订阅
            activeSubscriptions.delete(executionId);
          }
        },
        { deep: true }
      );

      activeSubscriptions.set(executionId, unwatch);

      // 返回一个成功的标志给面板
      return true;
    },

    /**
     * 获取宿主环境的设置。
     */
    getSettings: () => {
      console.log('[Host] Received getSettings call');
      return Promise.resolve({ theme: 'dark', language: 'zh-CN' });
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
    
    if (data.type === 'panel-ready') {
      console.log('[Host] Received panel-ready message. Injecting API script.');
      sendInjectionScript();
      return;
    }
    
    if (data.type === 'panel-log') {
      logs.value.push(data.payload);
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
   * 注入到 iframe 的脚本，用于创建 window.comfyTavern.panelApi 代理。
   */
  const getInjectionScript = () => {
    return `
      (() => {
        if (window.comfyTavern && window.comfyTavern.panelApi) {
          console.log('[Panel] panelApi already exists.');
          return;
        }
        window.comfyTavern = window.comfyTavern || {};
        const pendingRequests = new Map();
        
        // 监听来自宿主的回应或事件
        window.addEventListener('message', (event) => {
          const data = event.data;
          
          // 处理 API 响应
          if (data.type === 'comfy-tavern-api-response' && pendingRequests.has(data.id)) {
            const { resolve, reject } = pendingRequests.get(data.id);
            if (data.error) {
              reject(new Error(data.error.message));
            } else {
              resolve(data.payload);
            }
            pendingRequests.delete(data.id);
            return;
          }

          // 处理执行事件
          if (data.type === 'execution-event') {
             window.dispatchEvent(new CustomEvent('comfy-execution-event', { detail: data }));
          }
        });

        // 创建 API 代理
        window.comfyTavern.panelApi = new Proxy({}, {
          get(target, prop, receiver) {
            return function(...args) {
              return new Promise((resolve, reject) => {
                const id = \`\${String(prop)}-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`;
                pendingRequests.set(id, { resolve, reject });
                
                const requestMessage = {
                  type: 'comfy-tavern-api-call',
                  id: id,
                  payload: { method: prop, args: args }
                };
                
                window.parent.postMessage(requestMessage, '*'); // 目标源由宿主验证
              });
            }
          }
        });
        console.log('[Panel] window.comfyTavern.panelApi proxy created.');
      })();
    `;
  };

  /**
   * 发送注入脚本到 iframe。
   */
  function sendInjectionScript() {
    const iframe = iframeRef.value;
    if (!iframe || !iframe.contentWindow) {
      console.error('[Host] Cannot inject script: iframe or contentWindow not available.');
      return;
    }
    const script = getInjectionScript();
    // 使用一种更可靠的方式注入脚本
    iframe.contentWindow.postMessage({ type: 'inject-script', script: script }, panelOrigin.value || '*');
    console.log('[Host] API injection script sent to iframe.');
  }
  
  /**
   * 初始化宿主环境，开始监听消息。
   */
  const initializeHost = () => {
    window.addEventListener('message', handleMessage);
    console.log('[Host] Panel API host initialized and listening for messages.');
  };

  /**
   * 组件卸载时清理资源。
   */
  onUnmounted(() => {
    window.removeEventListener('message', handleMessage);
    // 取消所有仍在进行的订阅
    activeSubscriptions.forEach(unwatch => unwatch());
    activeSubscriptions.clear();
    console.log('[Host] Panel API host cleaned up.');
  });

  return {
    initializeHost,
  };
}