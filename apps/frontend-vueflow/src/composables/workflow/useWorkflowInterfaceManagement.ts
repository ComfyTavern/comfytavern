import { computed } from "vue";
import type { Edge as VueFlowEdge } from "@vue-flow/core";
import type { GroupInterfaceInfo, GroupSlotInfo } from "@comfytavern/types";
import { useTabStore } from "../../stores/tabStore";
import { useWorkflowManager } from "./useWorkflowManager";
import { useWorkflowViewManagement } from "./useWorkflowViewManagement";

export function useWorkflowInterfaceManagement() {
  const workflowManager = useWorkflowManager(); // 实例化新的管理器
  const tabStore = useTabStore();
  const workflowViewManagement = useWorkflowViewManagement(); // 获取视图管理实例

  /**
   * 更新指定节点组编辑器标签页的接口信息。
   * @param internalId 标签页的内部 ID
   * @param interfaceInfo 最新的 GroupInterfaceInfo
   */
  function updateGroupInterfaceInfo(internalId: string, interfaceInfo: GroupInterfaceInfo) {
    // 通过管理器获取状态
    const state = workflowManager.getAllTabStates.value.get(internalId);
    const tabInfo = tabStore.tabs.find((t) => t.internalId === internalId);

    if (state && tabInfo?.type === "groupEditor") {
      state.groupInterfaceInfo = interfaceInfo;
      console.debug(
        `[updateGroupInterfaceInfo] Updated group interface for tab ${internalId}:`,
        interfaceInfo
      );
      // 注意：这里不需要标记为 dirty 或记录历史，因为接口信息是派生状态
    } else if (!state) {
      console.warn(`[updateGroupInterfaceInfo] Tab state not found for ${internalId}`);
    } else if (tabInfo?.type !== "groupEditor") {
      console.warn(
        `[updateGroupInterfaceInfo] Attempted to update group interface for non-group-editor tab ${internalId}`
      );
    }
  }

  /**
   * 移除连接到指定节点句柄的所有边。
   * @param internalId 标签页的内部 ID
   * @param nodeId 节点的 ID
   * @param handleId 句柄的 ID (插槽 key)
   * @param handleType 句柄类型 ('source' 或 'target')
   */
  function removeEdgesForHandle(
    internalId: string,
    nodeId: string,
    handleId: string,
    handleType: "source" | "target"
  ) {
    // Get state via manager
    const state = workflowManager.getAllTabStates.value.get(internalId);
    if (!state) {
      console.error(`[removeEdgesForHandle] Tab state not found for ${internalId}`);
      return;
    }

    const edgesToRemove = state.elements.filter((el): el is VueFlowEdge => {
      // 添加类型守卫
      if (!("source" in el)) return false; // 不是边
      const edge = el as VueFlowEdge;
      if (handleType === "target") {
        // 输入插槽：目标节点和目标 handle 匹配
        return edge.target === nodeId && edge.targetHandle === handleId;
      } else {
        // 输出插槽：源节点和源 handle 匹配
        return edge.source === nodeId && edge.sourceHandle === handleId;
      }
    }) as VueFlowEdge[];

    if (edgesToRemove.length === 0) {
      console.debug(
        `[removeEdgesForHandle] No edges found for handle ${nodeId}.${handleId} (${handleType}) in tab ${internalId}`
      );
      return;
    }

    const edgeIdsToRemove = edgesToRemove.map((e) => e.id);
    console.debug(
      `[removeEdgesForHandle] Removing ${edgeIdsToRemove.length} edges for handle ${nodeId}.${handleId} (${handleType}) in tab ${internalId}:`,
      edgeIdsToRemove
    );

    // 从 state.elements 中移除边
    state.elements = state.elements.filter(
      (el) => !("source" in el) || !edgeIdsToRemove.includes((el as VueFlowEdge).id)
    );

    // 标记为脏并记录历史
    // 使用管理器的方法
    workflowManager.markAsDirty(internalId);
    workflowManager.setElements(internalId, state.elements);

    // 更新 VueFlow 实例
    const instance = workflowViewManagement.getVueFlowInstance(internalId); // 使用 workflowViewManagement.getVueFlowInstance
    if (instance) {
      instance.removeEdges(edgeIdsToRemove);
      console.debug(
        `[removeEdgesForHandle] Removed edges from VueFlow instance for tab ${internalId}`
      );
    }
  }

  /**
   * 原子性地更新指定标签页工作流的接口定义。
   * @param internalId 标签页的内部 ID
   * @param updateFn 一个函数，接收当前的 inputs 和 outputs，并返回更新后的 { inputs, outputs } 对象。
   */
  async function updateWorkflowInterface(
    internalId: string,
    updateFn: (
      currentInputs: Record<string, GroupSlotInfo>,
      currentOutputs: Record<string, GroupSlotInfo>
    ) => {
      inputs: Record<string, GroupSlotInfo>;
      outputs: Record<string, GroupSlotInfo>;
    }
  ) {
    // 通过管理器确保状态存在
    const state = await workflowManager.ensureTabState(internalId);
    if (!state.workflowData) {
      console.error(
        `[updateWorkflowInterface] Cannot update interface for tab ${internalId}: workflowData is null.`
      );
      return;
    }

    // 获取当前的接口定义（进行深拷贝以防意外修改）
    const currentInputs = JSON.parse(JSON.stringify(state.workflowData.interfaceInputs || {}));
    const currentOutputs = JSON.parse(JSON.stringify(state.workflowData.interfaceOutputs || {}));

    // 调用更新函数，传入当前状态，获取新状态
    const { inputs: newInputs, outputs: newOutputs } = updateFn(currentInputs, currentOutputs);

    // 直接更新 workflowData 中的接口定义
    state.workflowData.interfaceInputs = newInputs;
    state.workflowData.interfaceOutputs = newOutputs;

    // 标记为已修改
    workflowManager.markAsDirty(internalId);

    console.debug(
      `[updateWorkflowInterface] Updated interface atomically for workflow ${state.workflowData.id} in tab ${internalId}.`
    );

    // 如果当前标签页是节点组编辑器，则同时更新 groupInterfaceInfo 以触发 BaseNode 更新
    const tabInfo = tabStore.tabs.find((t) => t.internalId === internalId);
    if (tabInfo?.type === "groupEditor") {
      const newInterfaceInfo: GroupInterfaceInfo = {
        inputs: newInputs, // 使用更新后的 inputs
        outputs: newOutputs, // 使用更新后的 outputs
      };
      updateGroupInterfaceInfo(internalId, newInterfaceInfo);
      console.debug(
        `[updateWorkflowInterface] Also updated groupInterfaceInfo for group editor tab ${internalId}.`
      );
    }
  }

  // --- Getter 函数 ---
  const getActiveGroupInterfaceInfo = computed((): GroupInterfaceInfo | null => {
    // 使用管理器的 getter
    const state = workflowManager.getActiveTabState();
    const tabInfo = tabStore.activeTab; // 使用 tabStore.activeTab
    return state && tabInfo?.type === "groupEditor" ? state.groupInterfaceInfo : null;
  });

  // findNextSlotIndex 已移至 useWorkflowCoreLogic.ts，此处不包含

  return {
    updateWorkflowInterface,
    updateGroupInterfaceInfo,
    removeEdgesForHandle,
    getActiveGroupInterfaceInfo,
    // findNextSlotIndex, // 不导出
  };
}
