import { watchEffect, type Ref, watch, ref, onMounted, onUnmounted } from 'vue';
import { klona } from 'klona';
import { useExecutionStore } from '@/stores/executionStore';
import { useApiAdapterManager } from '@/services/ApiAdapterManager';
import { ExecutionStatus, type InvocationRequest, type PanelDefinition } from '@comfytavern/types';
import { usePanelStore } from '@/stores/panelStore';

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
  projectId: Ref<string | null>,
  panelId: Ref<string | null>,
  logs: Ref<any[]>
) {
  const executionStore = useExecutionStore();
  const apiAdapterManager = useApiAdapterManager();
  const panelStore = usePanelStore();

  const panelDef = ref<PanelDefinition | null>(null);
  const activeSubscriptions = new Map<string, () => void>(); // 存储 executionId -> unwatch function

  // --- 宿主端 API 实现 ---
  const panelApiHost = {
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
        // 1. 创建一个更精确的 getter，只依赖我们关心的状态
        () => {
          const state = executionStore.tabExecutionStates.get(executionId);
          if (!state) return null;
          
          // 返回一个包含所有相关状态的扁平对象
          return {
            status: state.workflowStatus,
            finalOutputs: state.nodeOutputs['__WORKFLOW_INTERFACE_OUTPUTS__'],
            streamingOutputs: state.streamingInterfaceOutputs,
            error: state.workflowError,
          };
        },
        // 2. watch 回调现在处理这个新的、更简单的 state 对象
        (newState, oldState) => {
          if (!newState) return;

          // 检查流式接口输出
          if (newState.streamingOutputs) {
            const oldStreamingOutputs = oldState?.streamingOutputs || {};
            for (const key in newState.streamingOutputs) {
              const stream = newState.streamingOutputs[key];
              const oldStream = oldStreamingOutputs[key];
              // 仅当文本实际发生变化时才发送事件
              if (stream && (!oldStream || stream.accumulatedText !== oldStream.accumulatedText)) {
                iframeRef.value?.contentWindow?.postMessage({
                  type: 'execution-event',
                  event: 'onProgress',
                  executionId,
                  payload: klona({ key, content: stream.accumulatedText, isComplete: !!stream.isComplete })
                }, panelOrigin.value);
              }
            }
          }

          // 检查最终结果
          if (newState.status === ExecutionStatus.COMPLETE && oldState?.status !== ExecutionStatus.COMPLETE) {
            iframeRef.value?.contentWindow?.postMessage({
              type: 'execution-event',
              event: 'onResult',
              executionId,
              payload: klona({ status: 'COMPLETE', outputs: newState.finalOutputs || {} })
            }, panelOrigin.value);
            unwatch();
            activeSubscriptions.delete(executionId);
          }

          // 检查错误
          if (newState.status === ExecutionStatus.ERROR && oldState?.status !== ExecutionStatus.ERROR) {
            iframeRef.value?.contentWindow?.postMessage({
              type: 'execution-event',
              event: 'onError',
              executionId,
              payload: klona({ error: newState.error })
            }, panelOrigin.value);
            unwatch();
            activeSubscriptions.delete(executionId);
          }
        },
        { deep: true } // deep 仍然是必要的，因为我们监听对象内部的变化
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
              console.log('[Panel Script] Received execution-event from host:', data);
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
    const scriptContent = getInjectionScript();
    
    // 我们不能直接在 iframe 中执行脚本，但我们可以向它发送脚本内容。
    // 这要求 iframe 内部有一个监听器来接收并执行此脚本。
    // 这是我们在 usePanelApiHost 外部（例如在面板的 HTML 中）需要处理的事情。
    // 出于这个原因，我们将修改 getInjectionScript 以包含自执行逻辑，并在这里发送它。
    
    const injectionPayload = {
      type: 'inject-and-run-script', // 使用一个新的类型来表示这个特定操作
      script: scriptContent,
    };
    
    iframe.contentWindow.postMessage(injectionPayload, panelOrigin.value || '*');
    console.log('[Host] API injection script sent to iframe via postMessage.');
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
}