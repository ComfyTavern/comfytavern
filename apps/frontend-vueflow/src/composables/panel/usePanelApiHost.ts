import { onUnmounted, type Ref, watch } from 'vue';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useExecutionStore } from '@/stores/executionStore';
import { useProjectStore } from '@/stores/projectStore';
import { ExecutionStatus } from '@comfytavern/types';
// registerPanelExecution 和 unregisterPanelExecution 已被重构,不再需要直接导入
// import { registerPanelExecution, unregisterPanelExecution } from '@/composables/useWebSocket';

// 定义消息协议接口
interface ApiRequestMessage {
  type: 'comfy-tavern-api-call' | 'panel-ready' | 'panel-log';
  id?: string // panel-ready 消息不需要 id
  payload?: { // panel-ready 消息不需要 payload
    method: string
    args: any[]
    level?: 'log' | 'warn' | 'error' | 'debug';
    message?: any[];
  }
}

interface ApiResponseMessage {
  type: 'comfy-tavern-api-response'
  id: string
  payload?: any
  error?: { message: string }
}

/**
 * usePanelApiHost Composable
 * @param iframeRef - 对 iframe 元素的引用
 * @param panelOrigin - 面板的预期源，用于安全验证
 */
export function usePanelApiHost(iframeRef: Ref<HTMLIFrameElement | null>, panelOrigin: Ref<string>, logs: Ref<any[]>) {
  const workflowStore = useWorkflowStore()
  const executionStore = useExecutionStore()
  const projectStore = useProjectStore()

  // 模拟宿主端 API 实现
  const panelApiHost = {
    executeWorkflow: async (request: { workflowId: string; inputs: Record<string, any> }) => {
      console.log('[Host] Received executeWorkflow call:', request)
      const projectId = projectStore.currentProjectId
      if (!projectId) {
        console.error('[Host] No active project found.')
        throw new Error('No active project found.')
      }
      // executeWorkflowFromPanel 内部会处理执行ID的注册，这里不再需要手动调用
      const result = await workflowStore.executeWorkflowFromPanel(request.workflowId, request.inputs, projectId)
      return result
    },
    subscribeToExecutionEvents: (executionId: string, _callbacks: { onProgress?: (data: any) => void; onResult?: (data: any) => void; onError?: (data: any) => void; }) => {
      console.log(`[Host] Subscribing to events for executionId: ${executionId}`)

      const unwatch = watch(
        () => executionStore.tabExecutionStates.get(executionId),
        (state, oldState) => {
          if (!state) return

          // 检查节点状态变化
          if (state.nodeStates) {
            for (const nodeId in state.nodeStates) {
              const currentNodeStatus = state.nodeStates[nodeId];
              const oldNodeStatus = oldState?.nodeStates?.[nodeId];
              
              if (currentNodeStatus !== oldNodeStatus) {
                const eventPayload = {
                  nodeId: nodeId,
                  status: currentNodeStatus,
                  outputs: state.nodeOutputs[nodeId], // May be undefined until complete
                  error: state.nodeErrors[nodeId]
                };
                iframeRef.value?.contentWindow?.postMessage({
                  type: 'execution-event',
                  event: 'onNodeUpdate', // Custom event for node status
                  payload: eventPayload
                }, panelOrigin.value);
              }
            }
          }

          // 检查流式输出
          if (state.streamingInterfaceOutputs) {
            for (const key in state.streamingInterfaceOutputs) {
              const stream = state.streamingInterfaceOutputs[key]
              const oldStream = oldState?.streamingInterfaceOutputs?.[key]
              if (stream && (!oldStream || stream.accumulatedText !== oldStream.accumulatedText)) {
                iframeRef.value?.contentWindow?.postMessage({ type: 'execution-event', event: 'onProgress', payload: { key, content: stream.accumulatedText, isComplete: !!stream.isComplete } }, panelOrigin.value)
              }
            }
          }
          // 检查最终结果
          if (state.workflowStatus === ExecutionStatus.COMPLETE && oldState?.workflowStatus !== ExecutionStatus.COMPLETE) {
            iframeRef.value?.contentWindow?.postMessage({ type: 'execution-event', event: 'onResult', payload: { status: 'COMPLETE', outputs: state.nodeOutputs } }, panelOrigin.value)
            // 清理逻辑已移至 useWebSocket.ts 内部，这里不再需要手动调用
            unwatch(); // 自动取消订阅
          }

          // 检查错误
          if (state.workflowStatus === ExecutionStatus.ERROR && oldState?.workflowStatus !== ExecutionStatus.ERROR) {
            iframeRef.value?.contentWindow?.postMessage({ type: 'execution-event', event: 'onError', payload: { error: state.workflowError } }, panelOrigin.value)
            // 清理逻辑已移至 useWebSocket.ts 内部，这里不再需要手动调用
            unwatch(); // 自动取消订阅
          }
        },
        { deep: true }
      )

      // 返回一个取消订阅的函数
      return () => {
        console.log(`[Host] Unsubscribing from events for executionId: ${executionId}`)
        unwatch()
        // 清理逻辑已移至 useWebSocket.ts 内部，这里不再需要手动调用
      }
    },
    getSettings: () => {
      console.log('[Host] Received getSettings call')
      return Promise.resolve({ theme: 'dark', language: 'zh-CN' })
    }
  }

  const handleMessage = async (event: MessageEvent) => {
    // --- 安全第一：验证来源 ---
    // 暂时不验证 origin，因为我们正在调试 postMessage 问题
    // if (event.origin !== panelOrigin.value) {
    //   console.warn(`[Host] Ignored message from unexpected origin: ${event.origin}. Expected: ${panelOrigin.value}`)
    //   return
    // }

    const data = event.data as ApiRequestMessage
    
    if (data.type === 'panel-ready') {
      console.log('[Host] Received panel-ready message from iframe. Injecting API script.');
      sendInjectionScript();
      return;
    }
    
    if (data.type === 'panel-log') {
      logs.value.push(data.payload);
      return;
    }

    if (data.type !== 'comfy-tavern-api-call') {
      return
    }

    console.log(`[Host] Received API call for method: ${data.payload!.method}`)

    const { id, payload } = data;
    if (!id) {
      console.error('[Host] API call received without a request ID. Ignoring.');
      return;
    }
    const { method, args } = payload!;

    const apiMethod = (panelApiHost as any)[method];

    if (typeof apiMethod === 'function') {
      try {
        const result = await apiMethod(...args)
        
        // 如果方法是 subscribeToExecutionEvents，它的返回值是一个函数，不能被 postMessage。
        // 我们只返回一个成功的标志。
        const payloadToSend = (method === 'subscribeToExecutionEvents') ? true : result;

        const response: ApiResponseMessage = {
          type: 'comfy-tavern-api-response',
          id,
          payload: payloadToSend,
        }
        iframeRef.value?.contentWindow?.postMessage(response, panelOrigin.value)
      } catch (e: any) {
        const response: ApiResponseMessage = {
          type: 'comfy-tavern-api-response',
          id,
          error: { message: e.message || 'An unknown error occurred' }
        }
        iframeRef.value?.contentWindow?.postMessage(response, panelOrigin.value)
      }
    } else {
      console.error(`[Host] Method "${method}" not found on panelApiHost.`)
      const response: ApiResponseMessage = {
        type: 'comfy-tavern-api-response',
        id,
        error: { message: `Method "${method}" not found.` }
      }
      iframeRef.value?.contentWindow?.postMessage(response, panelOrigin.value)
    }
  }

  const initializeHost = () => {
    window.addEventListener('message', handleMessage)
    console.log('[Host] Panel API host initialized and listening for messages.')
  }

  const getInjectionScript = () => {
    // 这个脚本将在 iframe 中执行，创建 window.comfyTavern.panelApi 代理
    return `
      (() => {
        if (window.comfyTavern && window.comfyTavern.panelApi) {
          console.log('[Panel] panelApi already exists.');
          return;
        }
        window.comfyTavern = window.comfyTavern || {};
        const pendingRequests = new Map();
        
        window.addEventListener('message', (event) => {
          // 注意：这里的来源验证由宿主负责，面板侧主要是处理响应
          const data = event.data;
          if (data.type !== 'comfy-tavern-api-response' || !pendingRequests.has(data.id)) {
            return;
          }

          const { resolve, reject } = pendingRequests.get(data.id);
          if (data.error) {
            reject(new Error(data.error.message));
          } else {
            resolve(data.payload);
          }
          pendingRequests.delete(data.id);
        });

        window.comfyTavern.panelApi = new Proxy({}, {
          get(target, prop, receiver) {
            return function(...args) {
              return new Promise((resolve, reject) => {
                const id = \`\${String(prop)}-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`;
                pendingRequests.set(id, { resolve, reject });
                
                const requestMessage = {
                  type: 'comfy-tavern-api-call',
                  id: id,
                  payload: {
                    method: prop,
                    args: args,
                  }
                };
                
                window.parent.postMessage(requestMessage, '*'); // 目标源应由宿主验证
              });
            }
          }
        });
        console.log('[Panel] window.comfyTavern.panelApi proxy created.');
      })();
    `
  }

  function sendInjectionScript() {
    const iframe = iframeRef.value;
    if (!iframe || !iframe.contentWindow) {
      console.error('[Host] Cannot inject script: iframe or contentWindow not available.');
      return;
    }
    const script = getInjectionScript();
    iframe.contentWindow.postMessage(`inject:${script}`, '*'); // 目标源仍为 *
    console.log('[Host] API injection script sent to iframe.');
  }

  onUnmounted(() => {
    window.removeEventListener('message', handleMessage)
    console.log('[Host] Panel API host cleaned up.')
  })

  return {
    initializeHost,
    getInjectionScript,
    sendInjectionScript // 暴露给外部调用
  }
}