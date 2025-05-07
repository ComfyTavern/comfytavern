import { ref, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useNodeStore, type FrontendNodeDefinition } from '@/stores/nodeStore';
import { useWebSocket } from '@/composables/useWebSocket'; // 导入 WebSocket composable
import { WebSocketMessageType, type ButtonClickPayload } from '@comfytavern/types'; // 导入类型
import { getBackendBaseUrl } from '@/utils/urlUtils';
import type { UseNodeStateProps } from './useNodeState'; // 导入节点状态 Props 类型

// 定义传递给 Composable 的参数类型
export interface UseNodeClientScriptProps extends UseNodeStateProps {
  // 从 useNodeState 传递必要的函数
  updateInputValue: (inputKey: string, value: any) => void;
  getInputValue: (inputKey: string) => any;
}

export function useNodeClientScript(props: UseNodeClientScriptProps) {
  const nodeStore = useNodeStore();
  const { definitionsLoaded, nodeDefinitions } = storeToRefs(nodeStore);
  const { updateInputValue, getInputValue } = props; // 从 props 解构

  const clientScriptLoaded = ref(false);
  const clientScriptError = ref<string | null>(null);
  const clientScriptApi = ref<any>(null); // 用于存储 setupClientNode 返回的接口

  // 加载并执行客户端脚本
  const loadClientScript = async () => {
    let fullScriptUrl = ''; // 在 try 块外部声明

    // 重新从 store 获取最新的定义，确保使用最新版本
    const currentDef = nodeDefinitions.value.find((def: FrontendNodeDefinition) => def.type === props.data.type);
    const scriptUrl = currentDef?.clientScriptUrl;
    const isLoaded = clientScriptLoaded.value;

    if (!currentDef || !scriptUrl || isLoaded) {
      return; // 如果没有定义、没有脚本 URL 或已加载，则不执行
    }

    clientScriptError.value = null;
    try {
      const backendBaseUrl = getBackendBaseUrl();
      fullScriptUrl = `${backendBaseUrl}${scriptUrl}`; // 在 try 块内部赋值

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
        console.error(`[${props.id}] Client script ${scriptUrl} did not export a setupClientNode function.`);
        clientScriptError.value = `Script ${scriptUrl} format error`;
      }
    } catch (error) {
      console.error(`[${props.id}] Failed to load or execute client script from ${fullScriptUrl}:`, error); // 使用完整 URL 记录错误
      clientScriptError.value = `Failed to load script ${scriptUrl}: ${error instanceof Error ? error.message : String(error)}`;
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

  const handleButtonClick = (inputKey: string) => {
    console.log(`[${props.id}] Button clicked: ${inputKey}`);

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
    const payload: ButtonClickPayload = {
      nodeId: props.id,
      buttonName: inputKey, // 使用 inputKey 作为按钮标识符
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