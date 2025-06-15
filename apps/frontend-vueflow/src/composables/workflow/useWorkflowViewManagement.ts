import type { Edge as VueFlowEdge, Node as VueFlowNode } from "@vue-flow/core";
import { storeToRefs } from "pinia";
import { computed } from 'vue'; // 导入 computed
import { useThemeStore } from "../../stores/theme"; // 导入主题 Store
import type { ManagedVueFlowInstance, Viewport } from "../../types/workflowTypes"; // 导入所需类型
import { useEdgeStyles } from "../canvas/useEdgeStyles"; // 导入边样式 Composable
import { useWorkflowManager } from "./useWorkflowManager"; // 导入新的工作流管理器

/**
 * 用于管理 VueFlow 实例和视图相关状态的 Composable。
 */
export function useWorkflowViewManagement() {
  const workflowManager = useWorkflowManager(); // 获取管理器 Composable 实例
  const edgeStyles = useEdgeStyles(); // 获取边样式 Composable 实例
  const themeStore = useThemeStore(); // 获取主题 Store 实例
  const { currentAppliedMode } = storeToRefs(themeStore); // 获取响应式的 currentAppliedMode 状态

  const isCurrentlyDark = computed(() => currentAppliedMode.value === 'dark'); // 新的计算属性

  /**
   * 设置指定标签页的 VueFlow 实例。
   * @param internalId 标签页的内部 ID
   * @param instance VueFlow 实例 (或 null 清除)
   */
  async function setVueFlowInstance(internalId: string, instance: ManagedVueFlowInstance | null) {
    // Make async
    // 确保状态存在并获取它。传递 false 以避免在此处应用默认工作流。
    // 需要 await ensureTabState，因为它是异步的
    const state = await workflowManager.ensureTabState(internalId, false); // 添加 await
    if (!state) {
      console.warn(`[setVueFlowInstance] 无法确保标签页 ${internalId} 的状态。实例未设置。`);
      return; // 如果无法确保状态，则退出
    }
    state.vueFlowInstance = instance;
    // 为清除操作添加更具体的日志记录
    if (instance) {
      console.debug(`[setVueFlowInstance] 已为标签页 ${internalId} 设置 VueFlow 实例`);
    } else {
      console.info(`[setVueFlowInstance] 已清除标签页 ${internalId} 的 VueFlow 实例`); // 清除操作使用 info 级别日志
    }
  }

  /**
   * 获取指定标签页的 VueFlow 实例。
   * @param internalId 标签页的内部 ID
   * @returns VueFlow 实例或 null
   */
  function getVueFlowInstance(internalId: string): ManagedVueFlowInstance | null {
    // 使用提供的 internalId 通过管理器访问状态
    return workflowManager.getAllTabStates.value.get(internalId)?.vueFlowInstance ?? null;
    // return workflowManager.getAllTabStates.value.get(internalId)?.vueFlowInstance ?? null;
  }

  /**
   * 设置指定标签页的视口状态。
   * @param internalId 标签页的内部 ID
   * @param viewport 新的视口状态
   */
  async function setViewport(internalId: string, viewport: Viewport) {
    // Make async
    // 确保状态存在并获取它。传递 false 以避免在此处应用默认工作流。
    const state = await workflowManager.ensureTabState(internalId, false); // 添加 await
    if (!state) {
      console.warn(`[setViewport] 无法确保标签页 ${internalId} 的状态。视口未设置。`);
      return;
    }
    // 直接更新管理器状态中的视口。
    // 管理器本身会处理这是否需要触发历史记录/脏状态（如果需要的话）（目前不会）。
    state.viewport = viewport;
    // 注意：视口变化通常不标记为 dirty 或记录历史，除非有特定需求
    // workflowState.markAsDirty(internalId);
  }

  /**
   * 更新指定标签页中所有边的样式（例如，主题切换时）。
   * @param internalId 标签页的内部 ID
   */
  function updateEdgeStylesForTab(internalId: string) {
    // 通过管理器获取状态
    const state = workflowManager.getAllTabStates.value.get(internalId);
    if (!state) return;

    console.debug(
      `[useWorkflowViewManagement] 开始为标签页 ${internalId} 更新边样式 (isDark: ${isCurrentlyDark.value})`
    );

    const nodes = state.elements.filter((el): el is VueFlowNode => !("source" in el));
    const originalEdges = state.elements.filter((el): el is VueFlowEdge => "source" in el);

    const styledEdges = originalEdges.map((edge) => {
      const sourceType = edge.data?.sourceType || "any";
      const targetType = edge.data?.targetType || "any";
      // 使用从 useEdgeStyles 获取的函数
      const styleProps = edgeStyles.getEdgeStyleProps(sourceType, targetType, isCurrentlyDark.value);
      return {
        ...edge,
        ...styleProps,
      };
    });

    // 更新 tabState 中的 elements
    // 直接更新管理器状态中的元素以进行样式更改。
    // 这会绕过 setElements 的历史记录/脏状态逻辑，这可能是样式更新的预期行为。
    state.elements = [...nodes, ...styledEdges];

    // 更新 VueFlow 实例 (如果存在)
    // // 直接访问 state 中的实例，避免循环依赖 getVueFlowInstance
    const instance = state.vueFlowInstance;
    if (instance) {
      instance.setEdges(styledEdges); // // 只更新边即可
      console.debug(
        `[useWorkflowViewManagement] 已更新标签页 ${internalId} 的 VueFlow 实例中的边样式。`
      );
    }
  }

  return {
    setVueFlowInstance,
    getVueFlowInstance,
    setViewport,
    updateEdgeStylesForTab,
  };
}
