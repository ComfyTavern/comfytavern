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
 * @param {object} vueFlow - VueFlow 实例或相关 API 集合 (具体结构待前端确定)
 * @param {object} node - 当前节点实例 (VueFlow 节点对象)
 * @param {object} context - 包含与前端交互的方法和响应式工具的对象
 * @param {function} context.updateNodeData - (nodeId, partialData) => void，用于更新节点 data (例如 inputs 的值)
 * @param {function} context.getNodeInputValue - (nodeId, inputKey) => any，获取节点当前输入值
 * @param {function} context.setNodeOutputValue - (nodeId, outputKey, value) => void，设置节点输出值
 * @param {function} context.ref - Vue 的 ref 函数
 * @param {function} context.watch - Vue 的 watch 函数
 */
export function setupClientNode(vueFlow, node, context) { // 'node' 参数本身就是 props 对象
  // 移除错误的解构：const { props } = node;
  // console.log(`[Client ${node.id}] setupClientNode: node.data.inputs object is:`, node.data.inputs ? JSON.parse(JSON.stringify(node.data.inputs)) : undefined); // 清理：移除此日志
  // 解构时获取 updateInputValue，移除 updateNodeData
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
      // console.log(`[Client ${node.id}] Value updated to: ${clampedValue}`); // 清理日志
    }
  };

  // 处理重新随机按钮点击
  const handleRerollClick = () => {
    // console.log(`[Client ${node.id}] Reroll button clicked`); // 清理日志
    updateValue(generateRandom24BitInt());
  };

  // --- 监听器 ---
  // 监听模式输入变化 (来自下拉框或连接)
  watch(() => getNodeInputValue('mode'), (newMode) => {
    if (newMode !== undefined && newMode !== currentMode.value) {
      // console.log(`[Client ${node.id}] Mode changed to: ${newMode}`); // 清理日志
      currentMode.value = newMode;
      // 当模式切换时，不再立即更新数值。
      // 数值的更新将由 onWorkflowExecute 钩子或按钮点击（如 reroll）处理。
      // 如果产品设计要求模式切换到“随机”时立即更新（目前看不需要），
      // 可以取消注释并调整下面的 if 块。
      // if (newMode === '随机') {
      //   updateValue(generateRandom24BitInt());
      // }
      // 对于“固定”、“增加”、“减少”等模式，切换模式本身不应立即改变值。
      // 值的改变将由 onWorkflowExecute 钩子或特定按钮（如 reroll）处理。
    }
  }, { immediate: false }); // 不需要立即执行，等待用户交互或连接

  // 监听 value 输入变化 (来自手动输入或连接)
  watch(() => getNodeInputValue('value'), (newValue) => {
    // 只有当输入值与当前内部值不同时才更新，避免循环
    if (newValue !== undefined && typeof newValue === 'number' && newValue !== currentValue.value) {
      // console.log(`[Client ${node.id}] Value input changed externally to: ${newValue}`); // 清理日志
      // 直接使用输入的值更新内部状态和输出
      updateValue(newValue);
    }
  }, { immediate: false }); // 不需要立即执行

  // --- 初始化 ---
  // 确保初始状态正确反映在节点数据和输出上
  // (updateValue 内部会处理数据和输出的更新)
  updateValue(currentValue.value); // 调用一次以确保初始值被设置和钳制

  // console.log(`[Client] Setup complete for RandomNumberNode ${node.id}. Initial value: ${currentValue.value}, Mode: ${currentMode.value}`); // 清理日志

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
      // context 参数包含 { nodeId, workflowContext }
      // nodeId 应该与当前脚本的 node.id 相同
      // workflowContext 包含 { nodes, edges } (这是从 StatusBar 传递的)
      // console.log(`[Client ${node.id}] 'onWorkflowExecute' hook triggered. Context received:`, context); // 日志已在调用处打印，此处简化

      // 优先从输入端口获取最新的模式值，如果未连接或无值，则使用内部维护的 currentMode
      // 注意：getNodeInputValue 获取的是节点 *输入数据* 的值，通常是连接上游节点的值或用户在UI上为该输入设置的值
      // currentMode.value 是通过 watch(getNodeInputValue('mode'), ...) 更新的内部响应式状态
      const modeFromInput = getNodeInputValue('mode');
      // console.log(`[Client ${node.id}] onWorkflowExecute: Value directly from getNodeInputValue('mode') is:`, modeFromInput); // 清理：移除此日志
      // console.log(`[Client ${node.id}] onWorkflowExecute: currentMode.value (internal ref before logic) is:`, currentMode.value); // 清理：移除此日志
      const effectiveMode = modeFromInput !== undefined ? modeFromInput : currentMode.value;

      console.log(`[Client ${node.id}] onWorkflowExecute: Mode='${effectiveMode}', Value=${currentValue.value}.`); // 保留关键执行信息

      if (effectiveMode === '随机') {
        // console.log(`[Client ${node.id}] Mode is '随机', rerolling number.`); // 日志已包含在上一条
        handleRerollClick(); // 重新生成随机数
      } else if (effectiveMode === '增加') {
        // console.log(`[Client ${node.id}] Mode is '增加', incrementing number from ${currentValue.value}.`); // 日志已包含
        updateValue(currentValue.value + 1);
      } else if (effectiveMode === '减少') {
        // console.log(`[Client ${node.id}] Mode is '减少', decrementing number from ${currentValue.value}.`); // 日志已包含
        updateValue(currentValue.value - 1);
      } else if (effectiveMode === '固定') {
        // console.log(`[Client ${node.id}] Mode is '固定', value (${currentValue.value}) remains unchanged by onWorkflowExecute.`); // 日志已包含
        // 对于固定模式，可以选择不执行任何操作，或者确保输出与当前值一致
        // setNodeOutputValue('number', currentValue.value); // 如果需要强制刷新输出
      } else {
        console.warn(`[Client ${node.id}] Unknown mode '${effectiveMode}' in onWorkflowExecute. Defaulting to reroll.`);
        handleRerollClick(); // 对于未知或未定义的模式，选择一个默认行为
      }
    },
    // 可以暴露其他需要从 BaseNode 调用的方法或状态
    // cleanup: () => { ... } // 可选：用于清理监听器等
  };
}

// 可选：添加一个简单的导出，以便在 import.meta.hot 中使用（如果前端支持 HMR）
export const nodeType = 'RandomNumber';