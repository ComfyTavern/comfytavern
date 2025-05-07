<template>
  <div
    v-if="visible"
    class="slot-context-menu context-menu-base"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @click.stop
  >
    <div class="context-menu-items">
      <div class="context-menu-item" @click="onDisconnect">
        <span class="icon">✂️</span> 断开连接 ({{ handleType === "target" ? "输入" : "输出" }}:
        {{ handleId }})
      </div>
      <!-- 删除插槽选项 -->
      <div
        v-if="canDeleteSlot"
        class="context-menu-item context-menu-item-danger"
        @click="onDeleteSlot"
      >
        <span class="icon">🗑️</span> 删除插槽 ({{ handleId }})
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { XYPosition, Node as VueFlowNode } from "@vue-flow/core";
import { computed } from "vue";
import { useWorkflowStore } from "@/stores/workflowStore";
import { useTabStore } from "@/stores/tabStore";
import { getNodeType } from "@/utils/nodeUtils"; // 导入用于获取节点类型的辅助函数
import { createHistoryEntry } from "@comfytavern/utils"; // 导入用于创建历史记录条目的函数
import { SocketType, type GroupSlotInfo, type HistoryEntry } from "@comfytavern/types"; // 导入项目共享的类型定义，包括 SocketType 枚举

const props = defineProps<{
  visible: boolean;
  position: XYPosition;
  nodeId: string;
  handleId: string;
  handleType: "source" | "target";
}>();

const emit = defineEmits<{
  (
    e: "disconnect",
    context: { nodeId: string; handleId: string; handleType: "source" | "target" }
  ): void;
  (
    e: "delete-slot",
    context: { nodeId: string; handleId: string; handleType: "source" | "target" }
  ): void; // 删除插槽事件，通知父组件处理（如果需要）
  (e: "close"): void; // 关闭菜单事件
}>();

const workflowStore = useWorkflowStore();
const tabStore = useTabStore();

// 计算属性：判断当前选中的插槽是否允许删除
const canDeleteSlot = computed(() => {
  const activeTab = tabStore.activeTab;
  if (!activeTab) {
    console.debug("[SlotContextMenu] No active tab.");
    return false;
  }
  // 当前激活的 Tab 代表了组定义的编辑界面，其 internalId 即为组工作流 ID
  const groupWorkflowId = activeTab.internalId;

  // 1. 获取当前右键点击的节点实例
  const node = workflowStore.getElements(groupWorkflowId).find((el) => el.id === props.nodeId) as
    | VueFlowNode
    | undefined;
  if (!node) {
    console.debug(`[SlotContextMenu] Node ${props.nodeId} not found.`);
    return false;
  }

  // 2. 获取节点类型
  const nodeType = getNodeType(node);
  if (nodeType ?.endsWith(':GroupInput') === false && nodeType ?.endsWith(':GroupOutput') === false) {
    console.debug(`[SlotContextMenu] Node ${props.nodeId} is not GroupInput or GroupOutput.`);
    // 必须是 GroupInput 或 GroupOutput 节点才能删除其接口插槽
    return false;
  }

  // 3. 根据节点类型和句柄类型，确定要检查的是输入接口还是输出接口的定义
  let interfaceToCheck: "interfaceInputs" | "interfaceOutputs" | null = null;
  if (nodeType ?.endsWith(':GroupInput') && props.handleType === "source") {
    // GroupInput 节点的输出句柄（source）对应组的输入接口（interfaceInputs）
    interfaceToCheck = "interfaceInputs";
  } else if (nodeType ?.endsWith(':GroupOutput') && props.handleType === "target") {
    // GroupOutput 节点的输入句柄（target）对应组的输出接口（interfaceOutputs）
    interfaceToCheck = "interfaceOutputs";
  } else {
    // 理论上，对于标准的 GroupInput/Output 节点，不应出现其他可删除插槽的组合
    console.debug(
      `[SlotContextMenu] Invalid combination for deletion: nodeType=${nodeType}, handleType=${props.handleType}`
    );
    return false;
  }

  // 4. 从 Store 中获取组工作流的完整数据，包括接口定义
  const groupWorkflowData = workflowStore.getWorkflowData(groupWorkflowId);
  if (!groupWorkflowData) {
    console.error(`[SlotContextMenu] Workflow data not found for ID: ${groupWorkflowId}`);
    return false;
  }
  const currentSlots =
    interfaceToCheck === "interfaceInputs"
      ? groupWorkflowData.interfaceInputs
      : groupWorkflowData.interfaceOutputs;

  if (!currentSlots) {
    console.error(
      `[SlotContextMenu] ${interfaceToCheck} slots not found in workflow data for ID: ${groupWorkflowId}`
    );
    return false;
  }

  // 5. 使用句柄 ID (handleId) 作为 Key，在中央接口定义中查找对应的插槽信息
  const slotInfo = currentSlots[props.handleId];

  // 6. 记录找到的插槽信息，用于调试
  // 记录克隆对象以防意外修改
  console.debug(
    `[SlotContextMenu] Checking slot: nodeId=${props.nodeId}, handleId=${props.handleId}, handleType=${props.handleType}, nodeType=${nodeType}, interface=${interfaceToCheck}. Found slotInfo:`,
    JSON.parse(JSON.stringify(slotInfo || null))
  );

  if (!slotInfo) {
    console.warn(
      `[SlotContextMenu] Slot info not found for handleId ${props.handleId} in ${interfaceToCheck}. Preventing deletion due to inconsistency.`
    );
    // 如果在中央定义中找不到插槽信息，则视为不可删除（可能状态不一致）
    return false;
  }

  // 7. 检查插槽类型是否为 CONVERTIBLE_ANY ('*')
  if (slotInfo.type === SocketType.CONVERTIBLE_ANY) {
    console.debug(
      `[SlotContextMenu] Slot ${props.handleId} type is CONVERTIBLE_ANY, deletion disallowed.`
    );
    // 不允许删除类型为 '*' (CONVERTIBLE_ANY) 的插槽
    return false;
  }

  console.debug(
    `[SlotContextMenu] Slot ${props.handleId} type is ${slotInfo.type}, deletion allowed.`
  );
  // 所有检查通过，允许删除
  return true;
});

const onDisconnect = async () => {
  // Make async if store action is async
  const activeTabId = tabStore.activeTabId;
  if (!activeTabId) {
    console.error("[SlotContextMenu] Cannot disconnect: No active tab ID found.");
    emit("close");
    return;
  }

  // 获取节点信息用于历史记录摘要
  const node = workflowStore.getElements(activeTabId).find((el) => el.id === props.nodeId) as
    | VueFlowNode
    | undefined;
  const nodeLabel = node?.data?.label || props.nodeId;
  const handleLabel = props.handleId; // 可以考虑从节点数据中获取更友好的句柄名称
  const handleDirection = props.handleType === "target" ? "输入" : "输出";

  // 1. 创建历史记录条目
  const summary = `断开节点 ${nodeLabel} ${handleDirection} ${handleLabel} 的所有连接`;
  const entry: HistoryEntry = createHistoryEntry(
    "delete", // 操作类型: 'delete' (删除边)
    "edge", // 对象类型: 'edge'
    summary,
    {
      // 初始 details，协调器会添加 removedEdges
      nodeId: props.nodeId,
      handleId: props.handleId,
      handleType: props.handleType,
      nodeLabel: nodeLabel, // 添加节点标签以便追溯
    }
  );

  // 2. 调用 Store 中的协调器函数来删除边并记录历史
  try {
    await workflowStore.removeEdgesByHandleAndRecord(
      activeTabId,
      props.nodeId,
      props.handleId,
      props.handleType,
      entry // 传递创建的 HistoryEntry
    );
    // console.debug(`[SlotContextMenu] Disconnect and record history called for handle ${props.handleId} on node ${props.nodeId}`);
  } catch (error) {
    console.error(`[SlotContextMenu] Error calling removeEdgesByHandleAndRecord:`, error);
    // 可以选择性地向用户显示错误消息
  } finally {
    // 3. 关闭菜单
    emit("close");
  }
};

// 处理删除插槽的操作：直接修改 Store 中的组接口定义
const onDeleteSlot = () => {
  if (!canDeleteSlot.value) return;

  // canDeleteSlot 计算属性已确保 activeTab 存在
  const activeTab = tabStore.activeTab!;
  // 使用激活 Tab 的 internalId 作为当前组定义的工作流 ID
  const groupWorkflowId = activeTab.internalId;
  // 节点句柄的 ID (handleId) 就是对应接口定义中的 Key
  const keyToRemove = props.handleId;

  // 1. 再次获取节点并确定类型，以决定修改输入接口还是输出接口
  // canDeleteSlot 已确保节点存在且类型正确，此处为类型安全再次获取
  const node = workflowStore.getElements(groupWorkflowId).find((el) => el.id === props.nodeId) as
    | VueFlowNode
    | undefined;
  if (!node) {
    console.error(`[SlotContextMenu] Node ${props.nodeId} not found unexpectedly.`);
    emit("close");
    return;
  }
  const nodeType = getNodeType(node);

  // 2. 根据节点类型确定接口类型 ('interfaceInput'/'interfaceOutput') 和 IO 方向 ('input'/'output')
  const interfaceType: "interfaceInput" | "interfaceOutput" =
    nodeType ?.endsWith(':GroupInput') ? "interfaceInput" : "interfaceOutput";
  // ioType 用于生成历史记录的摘要信息
  const ioType: "input" | "output" = nodeType ?.endsWith(':GroupInput') ? "input" : "output";

  // 3. 获取待删除插槽的显示名称，用于历史记录摘要
  const groupWorkflowData = workflowStore.getWorkflowData(groupWorkflowId);
  const currentSlots =
    interfaceType === "interfaceInput"
      ? groupWorkflowData?.interfaceInputs
      : groupWorkflowData?.interfaceOutputs;
  const slotToRemoveInfo = currentSlots?.[keyToRemove];
  const slotNameToRemove = slotToRemoveInfo?.displayName || keyToRemove;

  // 4. 再次确认工作流数据和对应的接口插槽存在
  if (!groupWorkflowData) {
    console.error(`[SlotContextMenu] Workflow data not found for ID: ${groupWorkflowId}`);
    emit("close");
    return;
  }
  if (!currentSlots) {
    console.error(
      `[SlotContextMenu] ${interfaceType} slots not found in workflow data for ID: ${groupWorkflowId}`
    );
    emit("close");
    return;
  }

  // 5. 定义一个更新函数，用于传递给 Store 的 action
  const updateFn = (
    currentInputs: Record<string, GroupSlotInfo>,
    currentOutputs: Record<string, GroupSlotInfo>
  ): { inputs: Record<string, GroupSlotInfo>; outputs: Record<string, GroupSlotInfo> } => {
    // 根据节点类型，决定是修改输入接口还是输出接口
    if (nodeType ?.endsWith(':GroupInput')) {
      // 如果是 GroupInput 节点，则从 interfaceInputs 中删除对应 Key
      const updatedInputs = { ...currentInputs };
      if (updatedInputs[keyToRemove]) {
        delete updatedInputs[keyToRemove];
      } else {
        // 正常情况不应触发此警告，触发表示 Store 和节点状态可能不同步
        console.warn(
          `[SlotContextMenu] Group interface input key ${keyToRemove} not found during update.`
        );
      }
      return { inputs: updatedInputs, outputs: currentOutputs };
    } else {
      // 否则是 GroupOutput 节点
      // 从 interfaceOutputs 中删除对应 Key
      const updatedOutputs = { ...currentOutputs };
      if (updatedOutputs[keyToRemove]) {
        delete updatedOutputs[keyToRemove];
      } else {
        // 正常情况不应触发此警告，触发表示 Store 和节点状态可能不同步
        console.warn(
          `[SlotContextMenu] Group interface output key ${keyToRemove} not found during update.`
        );
      }
      return { inputs: currentInputs, outputs: updatedOutputs };
    }
  };

  // 6. 准备历史记录条目所需信息
  const summary = `删除组${ioType === "input" ? "输入" : "输出"} ${slotNameToRemove}`;
  const entry: HistoryEntry = createHistoryEntry(
    "delete", // 操作类型: 'delete'
    interfaceType, // 对象类型: 'interfaceInput' 或 'interfaceOutput'
    summary,
    { key: keyToRemove, name: slotNameToRemove, slotType: ioType } // 附加信息
  );

  // 7. 调用 Store 的 action 来更新工作流接口定义
  // 此 action 会处理状态更新、添加历史记录、标记工作流为已修改，并可能触发同步
  workflowStore.updateWorkflowInterface(groupWorkflowId, updateFn, entry);

  // 8. 操作完成，关闭上下文菜单
  emit("close");
};
</script>

<style scoped>
.slot-context-menu {
  /* 基本样式已移至全局或通过 'context-menu-base' 类应用 */
  min-width: 180px;
}

/* “删除”等危险操作的特定样式 */
.context-menu-item-danger {
  color: #dc2626; /* red-600 */
}
.context-menu-item-danger:hover {
  background-color: #fee2e2; /* red-100 */
  color: #b91c1c; /* red-700 */
}
.dark .context-menu-item-danger {
  color: #f87171; /* red-400 */
}
.dark .context-menu-item-danger:hover {
  background-color: #450a0a; /* red-950 */
  color: #fca5a5; /* red-300 */
}
</style>
