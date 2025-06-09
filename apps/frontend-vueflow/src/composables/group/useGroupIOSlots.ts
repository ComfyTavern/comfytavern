import { computed } from 'vue';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { NodeProps } from '@vue-flow/core'; // 从 VueFlow 导入 NodeProps
import { DataFlowType, type GroupSlotInfo, type DataFlowTypeName, type InputDefinition, type OutputDefinition, BuiltInSocketMatchCategory } from '@comfytavern/types'; // <-- Import DataFlowType and other types
import { useSlotDefinitionHelper } from '../node/useSlotDefinitionHelper'; // <-- Import the helper
import { getEffectiveDefaultValue } from '@comfytavern/utils'; // <-- 导入默认值工具
// import { useTabStore } from '@/stores/tabStore'; // 移除了未使用的 tabStore

const CONVERTIBLE_ANY_DESCRIPTION = '这是一个**可转换**的插槽，初始类型为 `CONVERTIBLE_ANY`。\n\n- 连接后，其类型和名称将根据连接自动更新。\n- 会生成一个新的**空心插槽**。\n- 可在**侧边栏**编辑接口属性。';
// Define a type for the objects returned by the computed properties, ensuring 'description' exists
interface DisplaySlotInfo extends Omit<GroupSlotInfo, 'customDescription' | 'description'> {
  key: string;
  description: string;
  displayName: string; // DisplayName must also be a string
  dataFlowType: DataFlowTypeName; // Type must be a string, not optional
  [key: string]: any; // Allow other properties from spreading
}

// 使用 NodeProps 作为 props 的类型
export function useGroupIOSlots(props: NodeProps) {
  const workflowStore = useWorkflowStore();
  // const tabStore = useTabStore(); // 移除了未使用的 tabStore 实例化
  const { getSlotDefinition } = useSlotDefinitionHelper(); // <-- Instantiate the helper

  // 活动工作流对象或组定义的响应式计算属性
  const activeWorkflowOrGroupDef = computed(() => {
    const activeState = workflowStore.getActiveTabState();
    const computedValue = activeState?.workflowData ?? null;
    return computedValue;
  });

  const finalInputs = computed((): DisplaySlotInfo[] => { // Use explicit return type
    const nodeType = props.type;
    const nodeData = props.data as any; // 简化访问
    const workflowData = activeWorkflowOrGroupDef.value;

    // 获取所有可能的输入插槽 key
    let inputKeys: string[] = [];
    if (nodeType === 'core:GroupOutput' && workflowData?.interfaceOutputs) {
      inputKeys = Object.keys(workflowData.interfaceOutputs);
    } else if (nodeType === 'core:NodeGroup' && nodeData?.groupInterface?.inputs) {
      inputKeys = Object.keys(nodeData.groupInterface.inputs);
    } else if (nodeData?.inputs) { // 普通节点的 inputs
      inputKeys = Object.keys(nodeData.inputs);
    }

    const displayInputs: DisplaySlotInfo[] = [];

    for (const key of inputKeys) {
      // 使用统一的辅助函数获取原始插槽定义
      const slotDef = getSlotDefinition(props as any, key, 'target', workflowData);

      if (slotDef) {
        const typedSlot = slotDef as GroupSlotInfo | InputDefinition;

        // 检查是否为 CONVERTIBLE_ANY (包括通过 matchCategories 判断)
        const isConvertibleAny = typedSlot.dataFlowType === DataFlowType.CONVERTIBLE_ANY ||
                                 typedSlot.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);

        // NodeGroup 的输入插槽需要过滤掉 CONVERTIBLE_ANY
        if (nodeType === 'core:NodeGroup' && isConvertibleAny) {
          continue; // 跳过 NodeGroup 的 CONVERTIBLE_ANY 输入
        }
        
        let slotDescription: string | null = null;
        if ('customDescription' in typedSlot && typedSlot.customDescription) {
          slotDescription = typedSlot.customDescription;
        } else if (isConvertibleAny) { // 使用 isConvertibleAny 进行判断
          slotDescription = CONVERTIBLE_ANY_DESCRIPTION;
        } else if ('description' in typedSlot && typedSlot.description) {
          slotDescription = typedSlot.description;
        }
        const description = slotDescription || typedSlot.displayName || key;

        let uiInitialValue: any;
        if (nodeType === 'core:NodeGroup') {
          const snapshotDefaultValue = getEffectiveDefaultValue(typedSlot as InputDefinition); // NodeGroup 的 slotDef 总是 InputDefinition
          const instanceOverrideValue = nodeData.inputValues?.[key];
          uiInitialValue = instanceOverrideValue !== undefined ? instanceOverrideValue : snapshotDefaultValue;
        } else if (nodeData?.inputs?.[key]?.value !== undefined) { // 普通节点或 GroupOutput
           uiInitialValue = nodeData.inputs[key].value;
        } else { // 回退到定义中的默认值
           uiInitialValue = getEffectiveDefaultValue(typedSlot as InputDefinition);
        }
        
        displayInputs.push({
          ...(typedSlot as any),
          key: key,
          description: description,
          displayName: typedSlot.displayName || key,
          dataFlowType: typedSlot.dataFlowType || DataFlowType.WILDCARD,
          value: uiInitialValue, // 添加计算出的初始值
        } as DisplaySlotInfo);
      } else {
        console.warn(`[useGroupIOSlots] 未找到节点 ${props.id} 输入句柄 ${key} 的插槽定义。`);
      }
    }
    return displayInputs;
  });


  const finalOutputs = computed((): DisplaySlotInfo[] => { // Use explicit return type
    const nodeType = props.type;
    const nodeData = props.data as any; // 简化访问
    const workflowData = activeWorkflowOrGroupDef.value;

    // 获取所有可能的输出插槽 key
    let outputKeys: string[] = [];
    if (nodeType === 'core:GroupInput' && workflowData?.interfaceInputs) {
      outputKeys = Object.keys(workflowData.interfaceInputs);
    } else if (nodeType === 'core:NodeGroup' && nodeData?.groupInterface?.outputs) {
      outputKeys = Object.keys(nodeData.groupInterface.outputs);
    } else if (nodeData?.outputs) {
      outputKeys = Object.keys(nodeData.outputs);
    }

    const displayOutputs: DisplaySlotInfo[] = [];

    for (const key of outputKeys) {
      // 使用统一的辅助函数获取原始插槽定义
      // 类型断言 props 为 VueFlowNode 以解决类型不匹配问题
      const slotDef = getSlotDefinition(props as any, key, 'source', workflowData);

      if (slotDef) {
        // 转换为 DisplaySlotInfo
        const typedSlot = slotDef as GroupSlotInfo | OutputDefinition; // 可能是 GroupSlotInfo 或 OutputDefinition

        let slotDescription: string | null = null;
        if ('customDescription' in typedSlot && typedSlot.customDescription) {
          slotDescription = typedSlot.customDescription;
        } else if (typedSlot.dataFlowType === DataFlowType.CONVERTIBLE_ANY) {
          slotDescription = CONVERTIBLE_ANY_DESCRIPTION;
        } else if ('description' in typedSlot && typedSlot.description) {
          slotDescription = typedSlot.description;
        }

        const description = slotDescription || typedSlot.displayName || key;

        // NodeGroup 的输出插槽需要过滤掉 CONVERTIBLE_ANY (包括通过 matchCategories 判断)
        const isConvertibleAny = typedSlot.dataFlowType === DataFlowType.CONVERTIBLE_ANY ||
                                 typedSlot.matchCategories?.includes(BuiltInSocketMatchCategory.BEHAVIOR_CONVERTIBLE);
                                 
        if (nodeType === 'core:NodeGroup' && isConvertibleAny) {
          continue; // 跳过 NodeGroup 的 CONVERTIBLE_ANY 输出
        }

        displayOutputs.push({
          ...(typedSlot as any), // 展开原始定义属性, 使用 any 避免深层类型问题
          key: key, // 使用循环中的 key
          description: description,
          displayName: typedSlot.displayName || key, // 确保 displayName 存在
          dataFlowType: typedSlot.dataFlowType || DataFlowType.WILDCARD, // 确保 dataFlowType 存在
        } as DisplaySlotInfo);
      } else {
        console.warn(`[useGroupIOSlots] 未找到节点 ${props.id} 输出句柄 ${key} 的插槽定义。`);
      }
    }

    return displayOutputs;
  });


  return {
    finalInputs, // 返回统一的输入列表
    finalOutputs, // 返回统一的输出列表
  };
}