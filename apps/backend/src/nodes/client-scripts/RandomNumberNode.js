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
export function setupClientNode(vueFlow, node, context) {
  // 解构时获取 updateInputValue，移除 updateNodeData
  const { updateInputValue, getNodeInputValue, setNodeOutputValue, ref, watch } = context;

  // --- 状态管理 ---
  // 使用 context 提供的 ref 创建响应式状态
  // 初始值：尝试从节点数据获取，否则生成新的随机数
  const initialValue = getNodeInputValue(node.id, 'value') ?? generateRandom24BitInt();
  const currentValue = ref(initialValue);
  // 初始模式：尝试从节点数据获取，否则使用默认值 '固定'
  const initialMode = getNodeInputValue(node.id, 'mode') ?? '固定';
  const currentMode = ref(initialMode);

  // --- 核心逻辑 ---
  // 更新节点内部数据和输出值
  const updateValue = (newValue) => {
    const clampedValue = Math.max(0, Math.min(newValue, 16777215)); // 限制在 0 到 2^24-1
    if (clampedValue !== currentValue.value) {
      currentValue.value = clampedValue;
      // 使用 context.updateInputValue 更新输入值 'value'
      updateInputValue('value', clampedValue);
      // 更新节点的输出值 'number'
      setNodeOutputValue(node.id, 'number', clampedValue);
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
  watch(() => getNodeInputValue(node.id, 'mode'), (newMode) => {
    if (newMode !== undefined && newMode !== currentMode.value) {
      // console.log(`[Client ${node.id}] Mode changed to: ${newMode}`); // 清理日志
      currentMode.value = newMode;
      // 如果模式变为 '随机'，立即生成新值
      if (newMode === '随机') {
        updateValue(generateRandom24BitInt());
      }
      // 增加/减少模式通常由执行引擎触发，这里只更新模式状态
      // 如果需要在模式更改时立即执行增/减，可以在这里添加逻辑，但这可能不符合预期
    }
  }, { immediate: false }); // 不需要立即执行，等待用户交互或连接

  // 监听 value 输入变化 (来自手动输入或连接)
  watch(() => getNodeInputValue(node.id, 'value'), (newValue) => {
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
    // 可以暴露其他需要从 BaseNode 调用的方法或状态
    // cleanup: () => { ... } // 可选：用于清理监听器等
  };
}

// 可选：添加一个简单的导出，以便在 import.meta.hot 中使用（如果前端支持 HMR）
export const nodeType = 'RandomNumber';