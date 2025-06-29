import { useWebSocket } from "@/composables/useWebSocket";
import { useExecutionStore } from "@/stores/executionStore";
import { useProjectStore } from "@/stores/projectStore";
import { useTabStore } from "@/stores/tabStore";
import { flattenWorkflow } from "@/utils/workflowFlattener";
import {
  transformVueFlowToCoreWorkflow,
} from "@/utils/workflowTransformer";
import {
  transformStorageToExecutionPayload,
} from "@comfytavern/utils";
import {
  type WebSocketMessage,
  DataFlowType,
  ExecutionStatus,
  WebSocketMessageType,
  type WorkflowStorageNode,
  type WorkflowStorageEdge,
} from "@comfytavern/types";
import type { FlowExportObject, Edge as VueFlowEdge, Node as VueFlowNode } from "@vue-flow/core"; // 新增导入
import { klona } from "klona/full"; // 新增导入
import { useDialogService } from "../../services/DialogService"; // 导入 DialogService
import { useWorkflowData } from "./useWorkflowData";
import { useWorkflowManager } from "./useWorkflowManager";
import { useSlotDefinitionHelper } from "../node/useSlotDefinitionHelper";
import { useEdgeStyles } from "../canvas/useEdgeStyles";
import { watch } from "vue";

/**
 * Composable for handling workflow execution logic.
 */
export function useWorkflowExecution() {
  const workflowManager = useWorkflowManager();
  const tabStore = useTabStore();
  const projectStore = useProjectStore();
  const executionStore = useExecutionStore();
  const { sendMessage, setInitiatingExecution } = useWebSocket(); // 获取 setInitiatingExecution
  const workflowDataHandler = useWorkflowData();
  const dialogService = useDialogService(); // 获取 DialogService 实例
  const { getSlotDefinition } = useSlotDefinitionHelper();
  const { getEdgeStyleProps } = useEdgeStyles();

  /**
   * 触发当前活动工作流的完整执行。
   */
  async function executeWorkflow() {
    const internalId = tabStore.activeTabId;
    if (!internalId) {
      console.error("[WorkflowExecution:executeWorkflow] No active tab found.");
      dialogService.showError("请先选择一个标签页。"); // 与 StatusBar.vue 保持一致
      return;
    }

    const currentStatus = executionStore.getWorkflowStatus(internalId);
    if (currentStatus === ExecutionStatus.RUNNING || currentStatus === ExecutionStatus.QUEUED) {
      console.warn(
        `[WorkflowExecution:executeWorkflow] Workflow for tab ${internalId} is already ${currentStatus}. Execution request ignored.`
      );
      // TODO: Show user feedback (e.g., toast notification "Workflow is already running/queued")
      return;
    }

    console.info(
      `[WorkflowExecution:executeWorkflow] Initiating execution for tab ${internalId}...`
    );
    setInitiatingExecution(internalId); // 设置发起执行

    // 1. 获取初始的当前元素
    const initialElements = workflowManager.getElements(internalId);
    if (!initialElements || initialElements.length === 0) {
      console.error(
        `[WorkflowExecution:executeWorkflow] No initial elements found for tab ${internalId}. Aborting.`
      );
      dialogService.showError("画布上没有元素可执行。");
      return;
    }

    // 2. 从初始元素派生出 VueFlow 节点和边，用于客户端脚本上下文
    const initialVueFlowNodes = initialElements.filter((el) => !("source" in el)) as VueFlowNode[];
    const initialVueFlowEdges = initialElements.filter((el) => "source" in el) as VueFlowEdge[];

    // 3. 执行客户端脚本钩子 (这些脚本会通过 workflowManager.updateNodeData 更新 store)
    const clientScriptHookName = "onWorkflowExecute";
    if (initialVueFlowNodes.length > 0) {
      console.log(
        `[WorkflowExecution] Attempting to run '${clientScriptHookName}' hook for ${initialVueFlowNodes.length} nodes.`
      );
      for (const node of initialVueFlowNodes) {
        // 迭代初始快照
        const executor = executionStore.getNodeClientScriptExecutor(node.id);
        if (executor) {
          try {
            console.debug(
              `[WorkflowExecution] Executing client script hook '${clientScriptHookName}' for node ${node.id}`
            );
            // hookContext 使用克隆的初始状态，避免脚本间意外串改传递的上下文对象本身
            const hookContext = {
              nodeId: node.id,
              workflowContext: {
                nodes: klona(initialVueFlowNodes),
                edges: klona(initialVueFlowEdges),
              },
            };
            await executor(clientScriptHookName, hookContext); // executor 内部调用 setNodeOutputValue -> workflowManager.updateNodeData
          } catch (e) {
            console.warn(
              `[WorkflowExecution] Client script hook '${clientScriptHookName}' for node ${node.id} failed:`,
              e
            );
          }
        }
      }
    }

    // 4. 在所有客户端脚本执行完毕后，从 store 重新获取最新的元素状态
    // 这是为了确保 flattenWorkflow 处理的是包含了所有脚本更新的最终状态
    const elementsAfterClientScripts = workflowManager.getElements(internalId);
    if (!elementsAfterClientScripts || elementsAfterClientScripts.length === 0) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Elements became empty or invalid after client scripts for tab ${internalId}. Aborting.`
      );
      dialogService.showError("执行客户端脚本后画布状态错误。");
      return;
    }
    console.info(
      `[WorkflowExecution:executeWorkflow] Fetched ${elementsAfterClientScripts.length} elements after client scripts.`
    );

    // 5. 使用更新后的元素进行扁平化工作流
    console.info(
      `[WorkflowExecution:executeWorkflow] Flattening workflow for tab ${internalId} using elements after client scripts...`
    );
    const getEdgeStylePropsAdapter = (sourceType: string, targetType: string) => {
      const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      return getEdgeStyleProps(sourceType, targetType, isDark);
    };

    const flattenedResult = await flattenWorkflow(
      internalId,
      elementsAfterClientScripts, // 使用执行完客户端脚本后的最新元素
      workflowDataHandler,
      projectStore,
      getSlotDefinition,
      getEdgeStylePropsAdapter
    );

    if (!flattenedResult) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Failed to flatten workflow for tab ${internalId}. Aborting.`
      );
      // TODO: Show user feedback
      return;
    }
    console.info(
      `[WorkflowExecution:executeWorkflow] Workflow flattened successfully for tab ${internalId}. Nodes: ${flattenedResult.nodes.length}, Edges: ${flattenedResult.edges.length}`
    );

    // 重新引入 transformVueFlowToCoreWorkflow 步骤
    // 假设 flattenedResult.nodes 和 .edges 是 VueFlowElement 类型或者兼容的
    // （需要确保 flattenWorkflow 返回的类型与 VueFlowNode/VueFlowEdge 兼容，或者进行适配）
    const defaultViewport = { x: 0, y: 0, zoom: 1 };
    const tempFlowExport: FlowExportObject = {
      nodes: flattenedResult.nodes as VueFlowNode[], // 强制类型转换，需要验证 flattenWorkflow 的输出类型
      edges: flattenedResult.edges as VueFlowEdge[], // 强制类型转换
      viewport: defaultViewport, // 使用默认/虚拟视口
      position: [defaultViewport.x, defaultViewport.y], // 补上 position
      zoom: defaultViewport.zoom, // 补上 zoom
    };

    const coreWorkflowData = transformVueFlowToCoreWorkflow(tempFlowExport);
    if (!coreWorkflowData || !coreWorkflowData.nodes) {
      console.error(
        `[WorkflowExecution:executeWorkflow] Failed to transform flattened workflow to core data for tab ${internalId}. Aborting.`
      );
      // TODO: Show user feedback
      return;
    }
    console.info(
      `[WorkflowExecution:executeWorkflow] Workflow transformed to core data successfully for tab ${internalId}. Nodes: ${coreWorkflowData.nodes.length}, Edges: ${coreWorkflowData.edges.length}`
    );


    // 新增：构建 outputInterfaceMappings
    const outputInterfaceMappings: Record<string, { sourceNodeId: string; sourceSlotKey: string }> =
      {};
    const activeWorkflowData = workflowManager.getWorkflowData(internalId);

    if (
      activeWorkflowData &&
      activeWorkflowData.interfaceOutputs &&
      Object.keys(activeWorkflowData.interfaceOutputs).length > 0
    ) {
      // 在扁平化后的节点列表 (coreWorkflowData.nodes) 中查找 GroupOutput 节点
      // 假设 coreWorkflowData.nodes 中的节点有 id 和 type 属性
      const groupOutputNode = coreWorkflowData.nodes.find(
        (node) => node.type === "core:GroupOutput"
      );

      if (groupOutputNode) {
        for (const interfaceKey in activeWorkflowData.interfaceOutputs) {
          // 在扁平化后的边列表 (coreWorkflowData.edges) 中查找
          // 假设 coreWorkflowData.edges 中的边有 target, targetHandle, source, sourceHandle 属性
          const edgeConnectedToGroupOutputSlot = coreWorkflowData.edges.find(
            (edge) =>
              edge.target === groupOutputNode.id && // 使用扁平化图中 GroupOutput 节点的 ID
              edge.targetHandle === interfaceKey
          );

          if (
            edgeConnectedToGroupOutputSlot &&
            edgeConnectedToGroupOutputSlot.source &&
            edgeConnectedToGroupOutputSlot.sourceHandle
          ) {
            outputInterfaceMappings[interfaceKey] = {
              sourceNodeId: edgeConnectedToGroupOutputSlot.source,
              sourceSlotKey: edgeConnectedToGroupOutputSlot.sourceHandle,
            };
          } else {
            const slotInfo = activeWorkflowData.interfaceOutputs[interfaceKey];
            if (slotInfo) {
              if (slotInfo.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
                console.debug(
                  `[WorkflowExecution:executeWorkflow] No valid edge found (in coreWorkflowData.edges) connecting to GroupOutput node's slot '${interfaceKey}' (type: ${slotInfo.dataFlowType}) for workflow ${internalId}. This interface output will not be mapped and will likely be undefined.`
                );
              }
              // 对于 CONVERTIBLE_ANY 类型，如果未连接，则不发出警告或日志
            } else {
              // 如果 slotInfo 未定义，这可能是一个潜在问题，可以保留一个警告
              console.warn(
                `[WorkflowExecution:executeWorkflow] Slot info for interfaceKey '${interfaceKey}' not found in activeWorkflowData.interfaceOutputs for workflow ${internalId}. Cannot determine if it's CONVERTIBLE_ANY.`
              );
            }
            // 不为没有有效连接的 interfaceKey 创建映射
            // outputInterfaceMappings[interfaceKey] = { sourceNodeId: '', sourceSlotKey: '' };
          }
        }
      } else {
        console.warn(
          `[WorkflowExecution:executeWorkflow] No GroupOutput node found in coreWorkflowData.nodes for workflow ${internalId} to map interfaceOutputs.`
        );
      }
    }
    // 保留这个关键日志，但改为 console.debug，如果 outputInterfaceMappings 不大，可以接受
    console.debug(
      "[WorkflowExecution:executeWorkflow] Final generated outputInterfaceMappings:",
      klona(outputInterfaceMappings)
    );
    // 结束新增

    // 4. 准备执行状态 (此步骤在原始 StatusBar.vue 中没有，但在旧版 useWorkflowExecution 中有)
    // executionStore.prepareForNewExecution(internalId); // 暂时注释，以更接近 StatusBar 的成功路径

    const workflowForCore = {
        id: activeWorkflowData?.id,
        name: activeWorkflowData?.name,
        nodes: coreWorkflowData.nodes,
        edges: coreWorkflowData.edges,
        interfaceInputs: activeWorkflowData?.interfaceInputs || {},
        interfaceOutputs: activeWorkflowData?.interfaceOutputs || {},
    };

    // 编辑器执行时，没有需要覆盖的输入
    await executeWorkflowCore(internalId, workflowForCore, projectStore.currentProjectId, null, outputInterfaceMappings);
  }

  /**
   * 封装了向后端发送执行请求并等待 promptId 的核心逻辑。
   * @param executionId - 本次执行的唯一ID (对于编辑器是 aabId, 对于面板是生成的唯一ID)
   * @param workflowToExecute - 一个符合特定格式的、准备好被执行的工作流对象
   * @param projectId - 当前的项目ID
   * @param isPanelExecution - 标记这是否是一次面板执行
   * @returns 返回一个包含`promptId`和`executionId`的对象，或在失败时返回`null`
   */
  async function executeWorkflowCore(
    executionId: string,
    workflowToExecute: {
      id: string | undefined;
      name: string | undefined;
      nodes: WorkflowStorageNode[];
      edges: WorkflowStorageEdge[];
      interfaceInputs: Record<string, any>;
      interfaceOutputs: Record<string, any>;
      referencedWorkflows?: string[];
    },
    projectId: string | null,
    overrideInputs?: Record<string, any> | null, // 新增参数，用于面板输入
    outputInterfaceMappings?: Record<string, { sourceNodeId: string; sourceSlotKey: string }>,
  ): Promise<{ promptId: string; executionId: string } | null> {
    if (!projectId) {
      console.error("[WorkflowExecution:Core] Project ID is missing. Aborting execution.");
      dialogService.showError("执行失败：项目 ID 丢失。");
      return null;
    }

    // 1. 从完整的接口定义中提取出默认输入值
    const defaultInputs: Record<string, any> = {};
    if (workflowToExecute.interfaceInputs) {
      for (const key in workflowToExecute.interfaceInputs) {
        const inputDef = workflowToExecute.interfaceInputs[key];
        // 假设默认值在 config.default
        if (inputDef && inputDef.config && "default" in inputDef.config) {
          defaultInputs[key] = inputDef.config.default;
        } else {
          // 对于没有默认值的输入，可以根据需要设置为 null 或 undefined
          defaultInputs[key] = null;
        }
      }
    }

    // 2. 用 overrideInputs 覆盖默认值，得到最终的输入键值对
    const finalInterfaceInputs = {
      ...defaultInputs,
      ...overrideInputs,
    };

    const payload = transformStorageToExecutionPayload({
      nodes: workflowToExecute.nodes,
      edges: workflowToExecute.edges,
      interfaceInputs: finalInterfaceInputs, // 使用处理过的、干净的输入键值对
      interfaceOutputs: workflowToExecute.interfaceOutputs,
      outputInterfaceMappings, // 传递映射
    });

    setInitiatingExecution(executionId);

    const message: WebSocketMessage = {
      type: WebSocketMessageType.PROMPT_REQUEST,
      payload: {
        ...payload,
        metadata: {
          internalId: executionId,
          workflowId: workflowToExecute.id,
          workflowName: workflowToExecute.name,
          projectId: projectId,
        },
      },
    };

    sendMessage(message);
    console.debug(`[WorkflowExecution:Core] PROMPT_REQUEST sent for executionId ${executionId}.`, message);
    executionStore.setWorkflowStatusManually(executionId, ExecutionStatus.QUEUED);


    return new Promise((resolve) => {
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      const unwatch = watch(
        () => executionStore.getCurrentPromptId(executionId),
        (newPromptId) => {
          if (newPromptId) {
            console.log(`[WorkflowExecution:Core] Received promptId ${newPromptId} for ${executionId}`);
            if (timeoutHandle) clearTimeout(timeoutHandle);
            unwatch();
            resolve({ promptId: newPromptId, executionId: executionId });
          }
        },
        { immediate: false }
      );

      timeoutHandle = setTimeout(() => {
        console.error(`[WorkflowExecution:Core] Timed out waiting for promptId for executionId ${executionId}`);
        unwatch();
        resolve(null);
      }, 100000); // 100s timeout
    });
  }


  return {
    executeWorkflow,
    executeWorkflowCore,
  };
}
