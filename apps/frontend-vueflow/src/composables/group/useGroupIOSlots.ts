import { computed } from 'vue';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { NodeProps } from '@vue-flow/core'; // 从 VueFlow 导入 NodeProps
import { SocketType, type GroupSlotInfo } from '@comfytavern/types'; // <-- Import SocketType

const CONVERTIBLE_ANY_DESCRIPTION = '这是一个**可转换**的插槽，初始类型为 `CONVERTIBLE_ANY`。\n\n- 连接后，其类型和名称将根据连接自动更新。\n- 会生成一个新的**空心插槽**。\n- 可在**侧边栏**编辑接口属性。';
// Define a type for the objects returned by the computed properties, ensuring 'description' exists
interface DisplaySlotInfo extends Omit<GroupSlotInfo, 'customDescription' | 'description'> {
  key: string;
  description: string;
  displayName: string; // DisplayName must also be a string
  type: string; // Type must be a string, not optional
  [key: string]: any; // Allow other properties from spreading
}

// 使用 NodeProps 作为 props 的类型
export function useGroupIOSlots(props: NodeProps) {
  const workflowStore = useWorkflowStore();

  // 活动工作流对象或组定义的响应式计算属性
  const activeWorkflowOrGroupDef = computed(() => {
    const activeState = workflowStore.getActiveTabState();
    const computedValue = activeState?.workflowData ?? null;
    return computedValue;
  });

  const finalInputs = computed((): DisplaySlotInfo[] => { // Use explicit return type
    const nodeType = props.type;
    const groupInterface = (props.data as any)?.groupInterface; // 显式访问 groupInterface
    const workflow = activeWorkflowOrGroupDef.value;
    // 1. GroupOutput: 使用工作流接口，为 CONVERTIBLE_ANY 提供前端描述
    if (nodeType === 'core:GroupOutput') { // Roo: 使用带命名空间的类型
      const interfaceOutputs = workflow?.interfaceOutputs || {};
      return Object.values(interfaceOutputs).map(slot => {
        const typedSlot = slot as GroupSlotInfo;
        // 优先使用 customDescription，然后检查是否为 CONVERTIBLE_ANY，再回退
        const description = typedSlot.customDescription ||
                            (typedSlot.type === SocketType.CONVERTIBLE_ANY ? CONVERTIBLE_ANY_DESCRIPTION : null) || // Use frontend description for CONVERTIBLE_ANY if no custom one
                            typedSlot.displayName ||
                            typedSlot.key;
        return {
          ...typedSlot,
          key: typedSlot.key,
          description: description,
        } as DisplaySlotInfo;
      });
    }

    // 2. NodeGroup: 使用节点数据中的 groupInterface
    if (nodeType === 'core:NodeGroup' && groupInterface?.inputs) { // Roo: 使用带命名空间的类型
      // Map to ensure a 'description' field exists, prioritizing customDescription
      const groupInputs = Object.values(groupInterface.inputs).map(slot => {
        const typedSlot = slot as GroupSlotInfo;
        return {
          ...typedSlot,
          key: typedSlot.key,
          description: typedSlot.customDescription || typedSlot.displayName || typedSlot.key,
        } as DisplaySlotInfo;
      });
      // Filter out CONVERTIBLE_ANY slots for NodeGroup inputs
      return groupInputs.filter(slot => slot.type !== SocketType.CONVERTIBLE_ANY);
    }

    // 3. 普通节点: 使用节点数据中的 inputs
    // Roo: 更新类型检查以包含命名空间
    if (nodeType !== 'core:GroupInput' && nodeType !== 'core:GroupOutput' && nodeType !== 'core:NodeGroup') {
      // Normal nodes: transformWorkflowToVueFlow already added 'description' to the value object
      const nodeInputs = Object.entries(props.data?.inputs || {}).map(([key, value]) => ({
        key,
        ...(value as any), // Spread the value object which includes description, defaultDescription, type etc.
      })) as DisplaySlotInfo[]; // Cast the result of map
      return nodeInputs;
    }

    // 4. GroupInput: 没有标准输入
    return [];
  });


  const finalOutputs = computed((): DisplaySlotInfo[] => { // Use explicit return type
    const nodeType = props.type;
    const groupInterface = (props.data as any)?.groupInterface; // 显式访问 groupInterface
    const workflow = activeWorkflowOrGroupDef.value;
    // 1. GroupInput: 使用工作流接口，为 CONVERTIBLE_ANY 提供前端描述
    if (nodeType === 'core:GroupInput') { // Roo: 使用带命名空间的类型
      const interfaceInputs = workflow?.interfaceInputs || {};
      return Object.values(interfaceInputs).map(slot => {
        const typedSlot = slot as GroupSlotInfo;
        // 优先使用 customDescription，然后检查是否为 CONVERTIBLE_ANY，再回退
        const description = typedSlot.customDescription ||
                            (typedSlot.type === SocketType.CONVERTIBLE_ANY ? CONVERTIBLE_ANY_DESCRIPTION : null) || // Use frontend description for CONVERTIBLE_ANY if no custom one
                            typedSlot.displayName ||
                            typedSlot.key;
        return {
          ...typedSlot,
          key: typedSlot.key,
          description: description,
        } as DisplaySlotInfo;
      });
    }

    // 2. NodeGroup: 使用节点数据中的 groupInterface
    if (nodeType === 'core:NodeGroup' && groupInterface?.outputs) { // Roo: 使用带命名空间的类型
      // Map to ensure a 'description' field exists, prioritizing customDescription
      const groupOutputs = Object.values(groupInterface.outputs).map(slot => {
        const typedSlot = slot as GroupSlotInfo;
        return {
          ...typedSlot,
          key: typedSlot.key,
          description: typedSlot.customDescription || typedSlot.displayName || typedSlot.key,
        } as DisplaySlotInfo;
      });
      // Filter out CONVERTIBLE_ANY slots for NodeGroup outputs
      return groupOutputs.filter(slot => slot.type !== SocketType.CONVERTIBLE_ANY);
    }

    // 3. 普通节点: 使用节点数据中的 outputs
    // Roo: 更新类型检查以包含命名空间
    if (nodeType !== 'core:GroupInput' && nodeType !== 'core:GroupOutput' && nodeType !== 'core:NodeGroup') {
      // Normal nodes: transformWorkflowToVueFlow already added 'description' to the value object
      const nodeOutputs = Object.entries(props.data?.outputs || {}).map(([key, value]) => ({
        key,
        ...(value as any), // Spread the value object which includes description, defaultDescription, type etc.
      })) as DisplaySlotInfo[]; // Cast the result of map
      return nodeOutputs;
    }

    // 4. GroupOutput: 没有标准输出
    return [];
  });


  return {
    finalInputs, // 返回统一的输入列表
    finalOutputs, // 返回统一的输出列表
  };
}