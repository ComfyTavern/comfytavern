// apps/backend/src/nodes/client-scripts/RandomNumberNode.js

// 注意：此脚本将在前端执行，需要依赖前端环境提供的上下文。
// 它不能直接 'import vue'，而是通过 setupClientNode 的 context 参数获取所需功能。

// 生成 24 位随机整数 (0 to 2^24 - 1)
function generateRandom24BitInt() {
  // 使用更安全的随机数生成方式 (如果浏览器支持)
  const randomBuffer = new Uint32Array(1);
  window.crypto.getRandomValues(randomBuffer);
  // 将 32 位随机数限制在 24 位范围内
  return randomBuffer[0] % 16777216;
}


/**
  * 设置 RandomNumberNode 的客户端逻辑。
  * @param {object | null} vueFlow - VueFlow 实例或相关 API 集合。注意：此参数当前在客户端脚本中未使用，通常传递为 null。
  * @param {object} node - 当前节点实例 (VueFlow 节点对象)，包含了节点的 props。
  * @param {object} context - 包含与前端交互的方法和响应式工具的对象。
  * @param {function} context.updateInputValue - (inputKey: string, value: any) => void，用于更新节点指定输入的值。
  * @param {function} context.getNodeInputValue - (inputKey: string) => any，获取节点当前输入值。
  * @param {function} context.setNodeOutputValue - (outputKey: string, value: any) => void，设置节点输出值。
  * @param {function} context.ref - Vue 的 ref 函数。
  * @param {function} context.watch - Vue 的 watch 函数。
  */
export function setupClientNode(vueFlow, node, context) { // 'node' 参数本身就是 props 对象，包含了节点的所有信息
  // node 参数直接可用，无需解构 props
  const { updateInputValue, getNodeInputValue, setNodeOutputValue, ref, watch } = context;
  // --- 状态管理 ---
  // 使用 context 提供的 ref 创建响应式状态
  // 初始值：尝试从节点数据获取，否则生成新的随机数
  const initialValue = getNodeInputValue('value') ?? generateRandom24BitInt();
  const currentValue = ref(initialValue);
  // 初始模式：尝试从节点数据获取，否则使用默认值 '固定'
  const initialMode = getNodeInputValue('mode') ?? '固定';
  const currentMode = ref(initialMode);
  console.log(`[Client ${node.id}] setupClientNode: initialMode is '${initialMode}', currentMode.value is '${currentMode.value}' (based on getNodeInputValue: '${getNodeInputValue('mode')}')`);

  // --- 核心逻辑 ---
  // 更新节点内部数据和输出值
  const updateValue = (newValue) => {
    const clampedValue = Math.max(0, Math.min(newValue, 16777215)); // 限制在 0 到 2^24-1
    if (clampedValue !== currentValue.value) {
      currentValue.value = clampedValue;
      // 使用 context.updateInputValue 更新输入值 'value'
      updateInputValue('value', clampedValue);
      // 更新节点的输出值 'number'
      setNodeOutputValue('number', clampedValue);
    }
  };

  // 处理重新随机按钮点击
  const handleRerollClick = () => {
    updateValue(generateRandom24BitInt());
  };

  // --- 监听器 ---
  // 监听模式输入变化 (来自下拉框或连接)
  watch(() => getNodeInputValue('mode'), (newMode) => {
    if (newMode !== undefined && newMode !== currentMode.value) {
      currentMode.value = newMode;
      // 当模式切换时，不再立即更新数值。
      // 数值的更新将由 onWorkflowExecute 钩子或按钮点击（如 reroll）处理。
      // 对于“固定”、“增加”、“减少”等模式，切换模式本身不应立即改变值。
    }
  }, { immediate: false }); // 不需要立即执行，等待用户交互或连接

  // 监听 value 输入变化 (来自手动输入或连接)
  watch(() => getNodeInputValue('value'), (newValue) => {
    // 只有当输入值与当前内部值不同时才更新，避免循环
    if (newValue !== undefined && typeof newValue === 'number' && newValue !== currentValue.value) {
      // 直接使用输入的值更新内部状态和输出
      updateValue(newValue);
    }
  }, { immediate: false }); // 不需要立即执行

  // --- 初始化 ---
  // 确保初始状态正确反映在节点数据和输出上
  // (updateValue 内部会处理数据和输出的更新)
  updateValue(currentValue.value); // 调用一次以确保初始值被设置和钳制

  // --- 暴露接口 ---
  // 返回需要从 BaseNode 组件调用的方法
  return {
    // 将按钮点击处理函数暴露出去，以便 ButtonInput 组件可以调用
    onButtonClick: (buttonName) => {
      if (buttonName === 'reroll') {
        handleRerollClick();
      } else {
        console.warn(`[Client ${node.id}] Unknown button clicked: ${buttonName}`);
      }
    },
    // 咕咕：新增 onWorkflowExecute 钩子
    onWorkflowExecute: (context) => {
      // context 参数包含 { nodeId, workflowContext }。
      // nodeId 应该与当前脚本的 node.id 相同。
      // workflowContext 包含工作流的上下文信息，如 { nodes, edges } (通常由调用方如 StatusBar 传递)。

      // 优先从输入端口获取最新的模式值，如果未连接或无值，则使用内部维护的 currentMode。
      // 注意：getNodeInputValue 获取的是节点 *输入数据* 的值，
      // 这通常是来自上游连接节点的值，或用户在UI上为该输入直接设置的值。
      // currentMode.value 是通过 watch(getNodeInputValue('mode'), ...) 更新的内部响应式状态。
      const modeFromInput = getNodeInputValue('mode');
      const effectiveMode = modeFromInput !== undefined ? modeFromInput : currentMode.value;

      console.log(`[Client ${node.id}] onWorkflowExecute: Mode='${effectiveMode}', Value=${currentValue.value}.`); // 保留此关键执行信息

      if (effectiveMode === '随机') {
        handleRerollClick(); // 重新生成随机数
      } else if (effectiveMode === '增加') {
        updateValue(currentValue.value + 1);
      } else if (effectiveMode === '减少') {
        updateValue(currentValue.value - 1);
      } else if (effectiveMode === '固定') {
        // 对于固定模式，通常不执行任何操作，当前值即为输出。
        // 如果需要强制刷新输出以确保与内部值一致，可以调用：
        // setNodeOutputValue('number', currentValue.value);
      } else {
        console.warn(`[Client ${node.id}] Unknown mode '${effectiveMode}' in onWorkflowExecute. Defaulting to reroll.`);
        handleRerollClick(); // 对于未知或未定义的模式，选择一个默认行为（例如重新随机）。
      }
    },
    // 可以暴露其他需要从 BaseNode 调用的方法或状态。
    // cleanup: () => { ... } // 可选：定义清理函数，用于在节点卸载或脚本重新加载时执行，例如移除监听器。
  };
}

// 可选：添加一个简单的导出，以便在 import.meta.hot 中使用（如果前端支持 HMR）
export const nodeType = 'RandomNumber';