import { ref, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useNodeStore, type FrontendNodeDefinition } from '@/stores/nodeStore';
import { useWebSocket } from '@/composables/useWebSocket'; // 导入 WebSocket composable
import { WebSocketMessageType, type ButtonClickPayload } from '@comfytavern/types'; // 导入类型
import { getApiBaseUrl } from '@/utils/urlUtils'; // <--- 改为 getApiBaseUrl
import type { UseNodeStateProps } from './useNodeState'; // 导入节点状态 Props 类型

// 定义传递给 Composable 的参数类型
export interface UseNodeClientScriptProps extends UseNodeStateProps {
  // 从 useNodeState 传递必要的函数
  updateInputValue: (inputKey: string, value: any) => void;
  getInputValue: (inputKey: string) => any;
}

export function useNodeClientScript(props: UseNodeClientScriptProps) { // Removed async
  const nodeStore = useNodeStore();
  const { definitionsLoaded, nodeDefinitions } = storeToRefs(nodeStore);
  const { updateInputValue, getInputValue } = props; // 从 props 解构

  // For workflowId
  // const { useTabStore } = await import('@/stores/tabStore'); // Dynamic import for tabStore
  // const tabStore = useTabStore();
  // const { activeTab } = storeToRefs(tabStore);

  const clientScriptLoaded = ref(false);
  const clientScriptError = ref<string | null>(null);
  const clientScriptApi = ref<any>(null); // 用于存储 setupClientNode 返回的接口

  // 加载并执行客户端脚本
  const loadClientScript = async () => {
    let fullScriptUrl = ''; // 在 try 块外部声明

    // 重新从 store 获取最新的定义，确保使用最新版本
    const currentDef = nodeDefinitions.value.find((def: FrontendNodeDefinition) => def.type === props.data.type && def.namespace === props.data.namespace); // Ensure namespace matches too for safety
    const clientScriptRelativePath = currentDef?.clientScriptUrl;
    const nodeNamespace = currentDef?.namespace;
    const nodeType = currentDef?.type; // props.data.type should be the same
    const isLoaded = clientScriptLoaded.value;

    if (!currentDef || !clientScriptRelativePath || !nodeNamespace || !nodeType || isLoaded) {
      if (currentDef && currentDef.clientScriptUrl && !isLoaded) { // Log if essential parts are missing
        console.warn(`[${props.id}] Cannot load client script: Missing namespace or type for node type ${props.data.type}. Definition:`, currentDef);
      }
      return; // 如果没有定义、脚本相对路径、命名空间、类型，或已加载，则不执行
    }

    clientScriptError.value = null;
    try {
      const apiBaseUrl = getApiBaseUrl(); // This should be 'http://localhost:xxxx/api'
      // New URL format: /api/nodes/:namespace/:type/client-script/:relativeScriptPath
      // apiBaseUrl already includes '/api'
      fullScriptUrl = `${apiBaseUrl}/nodes/${nodeNamespace}/${nodeType}/client-script/${clientScriptRelativePath}`;
      // Example: http://localhost:3233/api/nodes/core/RandomNumber/client-script/client-scripts/RandomNumberNode.js
      console.log(`[${props.id}] Attempting to load client script from: ${fullScriptUrl}`);

      const scriptModule = await import(/* @vite-ignore */ fullScriptUrl);

      if (scriptModule && typeof scriptModule.setupClientNode === 'function') {
        // 准备传递给 setupClientNode 的参数
        const setupParams = {
          node: props, // 传递整个 props 对象
          context: {
            updateInputValue: (inputKey: string, value: any) => {
              // 直接调用从 props 解构出来的 updateInputValue 函数
              updateInputValue(inputKey, value);
            },
            getNodeInputValue: (inputKey: string) => getInputValue(inputKey), // 使用从 props 解构的函数
            setNodeOutputValue: (outputKey: string, value: any) => {
              console.warn(`[${props.id}] setNodeOutputValue called from client script`, outputKey, value);
            },
            ref, // 传递 Vue 的 ref 和 watch
            watch,
          }
        };

        // 调用 setupClientNode，按顺序传递 vueFlow (暂用 null), node, context
        const api = scriptModule.setupClientNode(
          null, // 第一个参数 vueFlow (暂不需要)
          setupParams.node, // 第二个参数 node
          setupParams.context // 第三个参数 context
        );
        clientScriptApi.value = api; // 存储返回的 API
        clientScriptLoaded.value = true;
      } else {
        console.error(`[${props.id}] Client script ${clientScriptRelativePath} did not export a setupClientNode function.`);
        clientScriptError.value = `Script ${clientScriptRelativePath} format error`;
      }
    } catch (error) {
      console.error(`[${props.id}] Failed to load or execute client script from ${fullScriptUrl}:`, error); // 使用完整 URL 记录错误
      clientScriptError.value = `Failed to load script ${clientScriptRelativePath}: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  // 检查并加载客户端脚本的逻辑
  const checkAndLoadClientScript = () => {
    if (!definitionsLoaded.value) {
      return;
    }

    // 查找定义
    const currentDef = nodeDefinitions.value.find((def: FrontendNodeDefinition) => def.type === props.data.type);

    if (currentDef?.clientScriptUrl && !clientScriptLoaded.value) {
      loadClientScript();
    } else if (!currentDef?.clientScriptUrl) {
      clientScriptLoaded.value = false;
      clientScriptApi.value = null;
      clientScriptError.value = null;
    } else if (clientScriptLoaded.value) {
      // 脚本已加载
    }
  };

  // 监听定义加载状态
  watch(definitionsLoaded, (loaded) => {
    if (loaded) {
      checkAndLoadClientScript();
    } else {
      // 重置状态
      clientScriptLoaded.value = false;
      clientScriptApi.value = null;
      clientScriptError.value = null;
    }
  });

  // 监听节点类型变化
  watch(() => props.data.type, (newType, oldType) => {
    if (newType !== oldType) {
      clientScriptLoaded.value = false;
      clientScriptApi.value = null;
      clientScriptError.value = null;
      // 重新检查加载
      checkAndLoadClientScript();
    }
  });

  // 组件挂载时检查
  onMounted(() => {
    if (definitionsLoaded.value) {
      checkAndLoadClientScript();
    }
  });

  // --- 按钮点击处理 ---
  const { sendMessage } = useWebSocket(); // 获取 sendMessage 函数

  const handleButtonClick = async (inputKey: string) => { // Made async to allow await for tabStore
    console.log(`[${props.id}] Button clicked: ${inputKey}`);

    // Dynamically import and use tabStore here
    const { useTabStore } = await import('@/stores/tabStore');
    const tabStore = useTabStore();
    const { activeTab } = storeToRefs(tabStore);


    // 1. 调用客户端脚本 (如果存在)
    if (clientScriptApi.value && typeof clientScriptApi.value.onButtonClick === 'function') {
      try {
        clientScriptApi.value.onButtonClick(inputKey);
        console.debug(`[${props.id}] Called client script onButtonClick for ${inputKey}`);
      } catch (e) {
        console.error(`[${props.id}] Error calling client script onButtonClick for ${inputKey}:`, e);
        // 可以选择性地设置 clientScriptError
      }
    } else {
      console.debug(`[${props.id}] No client script onButtonClick defined for ${inputKey}.`);
    }

    // 2. 发送 WebSocket 消息到后端
    const nodeType = props.data.type; // 从 props.data 获取类型
    let nodeDisplayName: string | undefined;

    // 优先尝试从 props.data.label (如果它是字符串)
    if (typeof props.data.label === 'string' && props.data.label.trim() !== '') {
      nodeDisplayName = props.data.label;
    }

    // 如果 props.data.label 不是有效的字符串，则从节点定义中获取 displayName
    if (!nodeDisplayName) {
      const currentDef = nodeDefinitions.value.find(def => def.type === nodeType && def.namespace === props.data.namespace);
      nodeDisplayName = currentDef?.displayName;
    }
    
    // 如果仍然没有，则回退到节点类型本身
    if (!nodeDisplayName) {
      nodeDisplayName = nodeType;
    }


    const payload: ButtonClickPayload = {
      nodeId: props.id,
      buttonName: inputKey,
      workflowId: activeTab.value?.associatedId || undefined, // Get workflowId from active tab
      nodeType: nodeType,
      nodeDisplayName: nodeDisplayName,
    };
    sendMessage({
      type: WebSocketMessageType.BUTTON_CLICK,
      payload: payload,
    });
    console.debug(`[${props.id}] Sent BUTTON_CLICK message for ${inputKey}`);
  };

  // 返回状态和方法
  return {
    clientScriptLoaded,
    clientScriptError,
    clientScriptApi,
    handleButtonClick,
  };
}