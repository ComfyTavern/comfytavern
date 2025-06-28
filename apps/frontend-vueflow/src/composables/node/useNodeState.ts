import { useVueFlow } from "@vue-flow/core";
// import { nextTick } from 'vue';
import type { NodeDefinition, InputDefinition, OutputDefinition, HistoryEntry } from "@comfytavern/types"; // <-- Import HistoryEntry
import { createHistoryEntry } from "@comfytavern/utils"; // <-- Import createHistoryEntry
import { useWorkflowStore } from "@/stores/workflowStore";
import { useTabStore } from "@/stores/tabStore";

// 定义节点输入实例的接口，包含定义和值
interface NodeInputInstance extends InputDefinition {
  value?: any; // 输入实例的值
}

// 定义 useNodeState 期望接收的 props 结构 (导出以供其他 composables 使用)
export interface UseNodeStateProps {
  // 添加 export
  id: string;
  data: Partial<Omit<NodeDefinition, "inputs" | "outputs" | "configSchema">> & {
    // Omit 字段以使用更精确的实例类型
    inputs?: Record<string, NodeInputInstance>; // 使用包含 value 的实例类型
    outputs?: Record<string, OutputDefinition>; // 输出通常只有定义
    configSchema?: Record<string, InputDefinition>; // 配置模式是定义
    configValues?: Record<string, any>; // 配置值是实例数据
    groupInterface?: { inputs: any[]; outputs: any[] }; // TODO: 替换为精确类型
    groupInfo?: Record<string, any>;
    dynamicSlots?: boolean;
    label?: string; // 实例标签
    nodeType?: string; // 添加 nodeType 字段
    // 其他 props.data 中可能存在的字段...
  };
  selected?: boolean;
}

export function useNodeState(props: Readonly<UseNodeStateProps>) {
  const { getEdges } = useVueFlow(); // <-- 移除 getNode 和 updateNodeData
  // const { updateNodeGroupWorkflowReference } = useWorkflowGrouping(); // <-- 移除未使用的变量
  const workflowStore = useWorkflowStore(); // <-- 获取 WorkflowStore 实例
  const tabStore = useTabStore(); // <-- 获取 TabStore 实例
 
  // 检查输入是否已连接
  const isInputConnected = (handleId: string): boolean => {
    return getEdges.value.some(
      (edge) => edge.target === props.id && edge.targetHandle === handleId
    );
  };

  // 获取输入连接数量
  const getInputConnectionCount = (handleId: string): number => {
    return getEdges.value.filter(
      (edge) => edge.target === props.id && edge.targetHandle === handleId
    ).length;
  };

  // 判断是否为多输入类型
  const isMultiInput = (input: any): boolean => {
    // 直接检查后端定义的 multi 属性
    return input?.multi === true;
  };

  // 获取输入值
  const getInputValue = (inputKey: string): any => {
    return props.data.inputs?.[inputKey]?.value ?? props.data.inputs?.[inputKey]?.config?.default;
  };

  // 更新节点输入值 (调用协调器)
  const updateInputValue = (inputKey: string, value: any) => {
    const activeId = tabStore.activeTabId;
    if (!activeId) {
      console.warn("[useNodeState:updateInputValue] No active tab ID found.");
      return;
    }
 
    // 创建历史记录条目
    const nodeDisplayName = props.data.displayName || props.data.label || props.id;
    const inputDisplayName = props.data.inputs?.[inputKey]?.displayName || inputKey;
    const oldValue = getInputValue(inputKey); // <-- Uncomment: 获取旧值
 
    const entry: HistoryEntry = createHistoryEntry(
      'modify', // actionType
      'nodeInput', // objectType
      // 更详细的摘要，包含节点名、输入名和新值（截断）
      `编辑 ${nodeDisplayName} - ${inputDisplayName}: "${String(value).length > 20 ? String(value).substring(0, 17) + '...' : String(value)}"`, // summary
      { // details
        nodeId: props.id,
        nodeName: nodeDisplayName,
        propertyName: inputKey,
        oldValue: oldValue, // <-- Uncomment: 添加旧值
        newValue: value,
      }
    );
 
    // 调用协调器函数，传递 entry 对象
    workflowStore.updateNodeInputValueAndRecord(activeId, props.id, inputKey, value, entry);
  };

  // 获取配置项值
  const getConfigValue = (configKey: string): any => {
    return (
      props.data.configValues?.[configKey] ?? props.data.configSchema?.[configKey]?.config?.default
    );
  };

  // 更新配置项值 (调用协调器)
  const updateConfigValue = (configKey: string, value: any) => {
    const activeId = tabStore.activeTabId;
    if (!activeId) {
      console.warn("[useNodeState:updateConfigValue] No active tab ID found.");
      return;
    }

    const nodeDef = props.data as NodeDefinition;
    const isModeChange = nodeDef.modeConfigKey === configKey;
    const nodeDisplayName = props.data.displayName || props.data.label || props.id;
    const oldValue = getConfigValue(configKey);
    let entry: HistoryEntry;

    if (isModeChange) {
      const newModeDisplayName = nodeDef.modes?.[value]?.displayName || value;
      entry = createHistoryEntry(
        'modify',
        'nodeMode',
        `切换节点 '${nodeDisplayName}' 模式为 '${newModeDisplayName}'`,
        {
          nodeId: props.id,
          propertyName: configKey,
          oldValue: oldValue,
          newValue: value,
        }
      );
      workflowStore.changeNodeModeAndRecord(activeId, props.id, configKey, value, entry);
    } else {
      const configDisplayName = nodeDef.configSchema?.[configKey]?.displayName || configKey;
      entry = createHistoryEntry(
        'modify',
        'nodeConfig',
        `配置 ${nodeDisplayName} - ${configDisplayName}: "${String(value).length > 20 ? String(value).substring(0, 17) + '...' : String(value)}"`,
        {
          nodeId: props.id,
          nodeName: nodeDisplayName,
          propertyName: configKey,
          oldValue: oldValue,
          newValue: value,
        }
      );
      workflowStore.updateNodeConfigValueAndRecord(activeId, props.id, configKey, value, entry);
    }
  };

  return {
    isInputConnected,
    getInputConnectionCount,
    isMultiInput,
    getInputValue,
    updateInputValue,
    getConfigValue,
    updateConfigValue,
  };
}
