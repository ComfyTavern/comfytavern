import { klona } from 'klona';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTabStore } from '@/stores/tabStore';
import { useDialogService } from './DialogService';
import { useWorkflowExecution } from '@/composables/workflow/useWorkflowExecution';
import { useWorkflowData } from '@/composables/workflow/useWorkflowData';
import { transformVueFlowToCoreWorkflow } from '@/utils/workflowTransformer';
import { flattenWorkflow } from '@/utils/workflowFlattener';
import { useSlotDefinitionHelper } from '@/composables/node/useSlotDefinitionHelper';
import { useEdgeStyles } from '@/composables/canvas/useEdgeStyles';
import type { FlowExportObject, Node as VueFlowNode, Edge as VueFlowEdge } from '@vue-flow/core';
import {
  type WorkflowStorageObject,
  DataFlowType,
  type WorkflowStorageNode,
  type WorkflowStorageEdge,
} from '@comfytavern/types';
import { useExecutionStore } from '@/stores/executionStore';

/**
 * 定义调用请求的类型
 */
export interface InvocationRequest {
  // 调用模式：'live' 表示使用编辑器实时状态, 'saved' 表示使用已保存的工作流
  mode: 'live' | 'saved';
  // 目标ID：根据模式，可以是 tabId 或 workflowId
  targetId: string;
  // 要覆盖工作流输入的键值对
  inputs?: Record<string, any>;
  // 执行来源，用于生成唯一的执行ID
  source: 'editor' | 'panel' | 'preview';
}

/**
 * 统一的工作流调用服务
 * 职责:
 * 1. 作为所有工作流调用的唯一入口。
 * 2. 根据调用模式 (live/saved) 获取工作流定义。
 * 3. 处理从 VueFlow 状态到执行载荷的转换。
 * 4. 调用底层的执行核心。
 */
class WorkflowInvocationService {
  /**
   * 统一的调用方法
   * @param request 调用请求对象
   */
  public async invoke(
    request: InvocationRequest
  ): Promise<{ promptId: string; executionId: string } | null> {
    const dialogService = useDialogService();
    const projectStore = useProjectStore();
    const workflowDataHandler = useWorkflowData();
    const { executeWorkflowCore } = useWorkflowExecution();

    const projectId = projectStore.currentProjectId;

    if (!projectId) {
      console.error('[InvocationService] Project ID is missing. Aborting execution.');
      dialogService.showError('执行失败：项目 ID 丢失。');
      return null;
    }

    const executionId = `${request.source}_${request.targetId}_${Date.now()}`;
    let workflowToExecute: {
      id: string | undefined;
      name: string | undefined;
      nodes: WorkflowStorageNode[];
      edges: WorkflowStorageEdge[];
      interfaceInputs: Record<string, any>;
      interfaceOutputs: Record<string, any>;
    } | null = null;
    
    let outputInterfaceMappings: Record<string, { sourceNodeId: string; sourceSlotKey: string; }> | undefined = undefined;


    if (request.mode === 'live') {
        const workflowStore = useWorkflowStore();
        const tabId = request.targetId;
        const workflowManager = workflowStore;
        const executionStore = useExecutionStore();
        const { getSlotDefinition } = useSlotDefinitionHelper();
        const { getEdgeStyleProps } = useEdgeStyles();

        const initialElements = workflowManager.getElements(tabId);
        if (!initialElements || initialElements.length === 0) {
            dialogService.showError('画布上没有元素可执行。');
            return null;
        }

        const initialVueFlowNodes = initialElements.filter((el) => !('source' in el)) as VueFlowNode[];
        const initialVueFlowEdges = initialElements.filter((el) => 'source' in el) as VueFlowEdge[];

        const clientScriptHookName = "onWorkflowExecute";
        for (const node of initialVueFlowNodes) {
            const executor = executionStore.getNodeClientScriptExecutor(node.id);
            if (executor) {
                try {
                    await executor(clientScriptHookName, {
                        nodeId: node.id,
                        workflowContext: {
                            nodes: klona(initialVueFlowNodes),
                            edges: klona(initialVueFlowEdges),
                        },
                    });
                } catch (e) {
                    console.warn(`Client script hook '${clientScriptHookName}' for node ${node.id} failed:`, e);
                }
            }
        }
        
        const elementsAfterClientScripts = workflowManager.getElements(tabId);
        if (!elementsAfterClientScripts || elementsAfterClientScripts.length === 0) {
            dialogService.showError("执行客户端脚本后画布状态错误。");
            return null;
        }

        const getEdgeStylePropsAdapter = (sourceType: string, targetType: string) => {
            const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
            return getEdgeStyleProps(sourceType, targetType, isDark);
        };

        const flattenedResult = await flattenWorkflow(
            tabId,
            elementsAfterClientScripts,
            workflowDataHandler,
            projectStore,
            getSlotDefinition,
            getEdgeStylePropsAdapter
        );
        
        if (!flattenedResult) {
            console.error(`[InvocationService] Failed to flatten workflow for tab ${tabId}.`);
            return null;
        }

        const tempFlowExport: FlowExportObject = {
            nodes: flattenedResult.nodes as VueFlowNode[],
            edges: flattenedResult.edges as VueFlowEdge[],
            viewport: { x: 0, y: 0, zoom: 1 },
            position: [0, 0],
            zoom: 1,
        };

        const coreWorkflowData = transformVueFlowToCoreWorkflow(tempFlowExport);
        const activeWorkflowData = workflowManager.getWorkflowData(tabId);
        
        outputInterfaceMappings = this.buildOutputInterfaceMappings(activeWorkflowData, coreWorkflowData.nodes, coreWorkflowData.edges, tabId);

        workflowToExecute = {
            id: activeWorkflowData?.id,
            name: activeWorkflowData?.name,
            nodes: coreWorkflowData.nodes,
            edges: coreWorkflowData.edges,
            interfaceInputs: activeWorkflowData?.interfaceInputs || {},
            interfaceOutputs: activeWorkflowData?.interfaceOutputs || {},
        };

    } else if (request.mode === 'saved') {
        const workflowId = request.targetId;
        const { loadedData } = await workflowDataHandler.loadWorkflow(
            executionId,
            projectId,
            workflowId
        );

        if (!loadedData) {
            dialogService.showError('执行失败', `无法加载工作流: ${workflowId}`);
            return null;
        }
        // For saved workflows, we assume no complex flattening or client scripts are needed at invocation time.
        // The structure is already in WorkflowStorageObject format.
        workflowToExecute = {
            id: workflowId,
            name: loadedData.name,
            nodes: loadedData.nodes,
            edges: loadedData.edges,
            interfaceInputs: loadedData.interfaceInputs || {},
            interfaceOutputs: loadedData.interfaceOutputs || {},
        };
    }

    if (!workflowToExecute) {
      console.error('[InvocationService] Failed to prepare workflow for execution.', request);
      dialogService.showError('准备工作流失败。');
      return null;
    }

    return await executeWorkflowCore(
      executionId,
      workflowToExecute,
      projectId,
      request.inputs,
      outputInterfaceMappings
    );
  }

  private buildOutputInterfaceMappings(
    activeWorkflowData: any,
    nodes: WorkflowStorageNode[],
    edges: WorkflowStorageEdge[],
    contextId: string
  ): Record<string, { sourceNodeId: string; sourceSlotKey: string; }> {
    const mappings: Record<string, { sourceNodeId: string; sourceSlotKey: string; }> = {};
    if (activeWorkflowData && activeWorkflowData.interfaceOutputs && Object.keys(activeWorkflowData.interfaceOutputs).length > 0) {
        const groupOutputNode = nodes.find((node) => node.type === "core:GroupOutput");

        if (groupOutputNode) {
            for (const interfaceKey in activeWorkflowData.interfaceOutputs) {
                const edge = edges.find((e) => e.target === groupOutputNode.id && e.targetHandle === interfaceKey);
                if (edge && edge.source && edge.sourceHandle) {
                    mappings[interfaceKey] = {
                        sourceNodeId: edge.source,
                        sourceSlotKey: edge.sourceHandle,
                    };
                } else {
                    const slotInfo = activeWorkflowData.interfaceOutputs[interfaceKey];
                    if (slotInfo && slotInfo.dataFlowType !== DataFlowType.CONVERTIBLE_ANY) {
                        console.debug(`[InvocationService] No valid edge found for interface output '${interfaceKey}' in ${contextId}.`);
                    }
                }
            }
        }
    }
    return mappings;
  }
}

// 导出单例
export const workflowInvocationService = new WorkflowInvocationService();