import type { Node as VueFlowNode, Edge } from "@vue-flow/core";
import { getNodeType } from "@/utils/nodeUtils";
import type { useWorkflowData } from '@/composables/workflow/useWorkflowData';
import type { useProjectStore } from '@/stores/projectStore';
import type { useWorkflowManager } from '@/composables/workflow/useWorkflowManager';

/**
 * 递归地扁平化工作流，展开所有 NodeGroup。
 * @param internalId 标签页 ID (用于加载子工作流)。
 * @param initialElements 初始的顶层元素。
 * @param workflowDataHandler useWorkflowData 的实例。
 * @param projectStore useProjectStore 的实例。
 * @param workflowManager useWorkflowManager 的实例 (用于转换和获取节点类型)。
 * @param processedGroupIds 用于检测循环引用的 Set。
 * @returns 包含扁平化节点和边的对象，或在错误时返回 null。
 */
export async function flattenWorkflow(
  internalId: string,
  initialElements: (VueFlowNode | Edge)[],
  workflowDataHandler: ReturnType<typeof useWorkflowData>,
  projectStore: ReturnType<typeof useProjectStore>,
  workflowManager: ReturnType<typeof useWorkflowManager>, // 添加 workflowManager 依赖
  processedGroupIds: Set<string> = new Set()
): Promise<{ nodes: VueFlowNode[], edges: Edge[] } | null> {
  const flattenedNodes: VueFlowNode[] = [];
  const flattenedEdges: Edge[] = [];
  const nodeMap = new Map<string, VueFlowNode>(); // 存储所有遇到的节点（包括内部的）
  const edgeQueue: Edge[] = []; // 待处理的边

  const elementsToProcess = [...initialElements]; // 复制以避免修改原始数组

  // 初始处理顶层节点和边
  for (const el of elementsToProcess) {
    if (!('source' in el)) { // 是节点
      nodeMap.set(el.id, el);
    } else { // 是边
      edgeQueue.push(el);
    }
  }

  const nodesToExpand = [...nodeMap.values()]; // 获取初始节点列表

  while (nodesToExpand.length > 0) {
    const node = nodesToExpand.shift();
    if (!node) continue;

    const nodeType = getNodeType(node); // 使用导入的辅助函数

    if (nodeType === 'core:NodeGroup') { // 假设 NodeGroup 类型以 :NodeGroup 结尾
      const referencedWorkflowId = node.data?.referencedWorkflowId as string | undefined;
      if (!referencedWorkflowId) {
        console.warn(`[Flatten] NodeGroup ${node.id} is missing referencedWorkflowId. Skipping expansion.`);
        // 将其视为普通节点（虽然可能不正确，但避免执行中断）
        flattenedNodes.push(node);
        continue;
      }

      // 检测循环引用
      if (processedGroupIds.has(referencedWorkflowId)) {
        console.error(`[Flatten] Circular reference detected: Group ${referencedWorkflowId} is already being processed. Aborting expansion for this instance.`);
        // 可以选择抛出错误或跳过
        continue; // 跳过此实例的展开
      }

      // 加载引用的工作流
      const projectId = projectStore.currentProjectId; // 获取当前项目 ID
      if (!projectId) {
        console.error(`[Flatten] Cannot load referenced workflow ${referencedWorkflowId}: Project ID is missing.`);
        return null; // 无法继续
      }

      console.debug(`[Flatten] Expanding NodeGroup ${node.id}, loading workflow ${referencedWorkflowId} from project ${projectId}`);
      // 修正 loadWorkflow 参数顺序
      const { success, loadedData } = await workflowDataHandler.loadWorkflow(internalId, projectId, referencedWorkflowId);

      if (!success || !loadedData) {
        console.error(`[Flatten] Failed to load referenced workflow ${referencedWorkflowId} for NodeGroup ${node.id}.`);
        return null; // 加载失败，无法继续
      }

      // 标记此组正在处理
      processedGroupIds.add(referencedWorkflowId);

      // 准备子工作流元素 (需要转换)
      const subWorkflowElements: (VueFlowNode | Edge)[] = [];
      if (loadedData.nodes) {
          for (const storageNode of loadedData.nodes) {
              // 使用 workflowManager 实例进行转换
              const vueNode = workflowManager.storageNodeToVueFlowNode(storageNode);
              subWorkflowElements.push(vueNode);
          }
      }
      if (loadedData.edges) {
          for (const storageEdge of loadedData.edges) {
               // 使用 workflowManager 实例进行转换
              const vueEdge = workflowManager.storageEdgeToVueFlowEdge(storageEdge);
              subWorkflowElements.push(vueEdge);
          }
      }


      // 递归处理子工作流
      // 注意：这里调用自身 flattenWorkflow
      const flattenedSubWorkflow = await flattenWorkflow(
        internalId,
        subWorkflowElements,
        workflowDataHandler,
        projectStore,
        workflowManager, // 传递 workflowManager
        new Set(processedGroupIds) // 传递副本以隔离递归分支
      );

      if (!flattenedSubWorkflow) {
        console.error(`[Flatten] Failed to flatten sub-workflow ${referencedWorkflowId} for NodeGroup ${node.id}.`);
        processedGroupIds.delete(referencedWorkflowId); // 回溯时移除标记
        return null; // 递归失败
      }

      // --- 核心：I/O 映射 ---
      const internalNodesMap = new Map(flattenedSubWorkflow.nodes.map(n => [n.id, n])); // 子流扁平化后的节点

      // 找到内部的 GroupInput 和 GroupOutput 节点 (假设类型固定)
      // 注意：需要使用 getNodeType 辅助函数
      const internalGroupInput = flattenedSubWorkflow.nodes.find(n => getNodeType(n) === 'core:GroupInput'); // Roo: 使用带命名空间的类型
      const internalGroupOutput = flattenedSubWorkflow.nodes.find(n => getNodeType(n) === 'core:GroupOutput'); // Roo: 使用带命名空间的类型

      // 映射连接到 NodeGroup 输入的边
      const incomingEdges = edgeQueue.filter(edge => edge.target === node.id);
      for (const incomingEdge of incomingEdges) {
        const targetHandle = incomingEdge.targetHandle; // NodeGroup 上的输入句柄 (对应 interfaceInputs key)
        if (!targetHandle || !internalGroupInput) continue;

        // 找到内部 GroupInput 对应输出句柄出发的边
        const internalEdge = flattenedSubWorkflow.edges.find(
          subEdge => subEdge.source === internalGroupInput.id && subEdge.sourceHandle === targetHandle
        );
        if (internalEdge) {
          // 获取内部目标节点
          const internalTargetNode = internalNodesMap.get(internalEdge.target);
          if (!internalTargetNode) {
              console.warn(`[Flatten] Internal target node ${internalEdge.target} not found for edge ${internalEdge.id}`);
              continue;
          }
          // 创建新的扁平化边：外部源 -> 内部目标
          flattenedEdges.push({
            ...incomingEdge, // 保留原始边的属性 (ID 可能需要重新生成)
            id: `${incomingEdge.id}_flat_${internalEdge.target}`, // 生成更唯一的 ID
            target: internalEdge.target, // 重定向到内部节点 ID
            targetHandle: internalEdge.targetHandle, // 使用内部节点的句柄
          });
           // 从队列中移除已处理的边
           const index = edgeQueue.findIndex(e => e.id === incomingEdge.id);
           if (index > -1) edgeQueue.splice(index, 1);
        } else {
           console.warn(`[Flatten] No internal edge found originating from GroupInput ${internalGroupInput.id} handle ${targetHandle} for NodeGroup ${node.id} input ${targetHandle}`);
        }
      }

      // 映射从 NodeGroup 输出出发的边
      const outgoingEdges = edgeQueue.filter(edge => edge.source === node.id);
      for (const outgoingEdge of outgoingEdges) {
        const sourceHandle = outgoingEdge.sourceHandle; // NodeGroup 上的输出句柄 (对应 interfaceOutputs key)
        if (!sourceHandle || !internalGroupOutput) continue;

        // 找到连接到内部 GroupOutput 对应输入句柄的边
        const internalEdge = flattenedSubWorkflow.edges.find(
          subEdge => subEdge.target === internalGroupOutput.id && subEdge.targetHandle === sourceHandle
        );
        if (internalEdge) {
           // 获取内部源节点
          const internalSourceNode = internalNodesMap.get(internalEdge.source);
          if (!internalSourceNode) {
              console.warn(`[Flatten] Internal source node ${internalEdge.source} not found for edge ${internalEdge.id}`);
              continue;
          }
          // 创建新的扁平化边：内部源 -> 外部目标
          flattenedEdges.push({
            ...outgoingEdge, // 保留原始边的属性 (ID 可能需要重新生成)
            id: `${outgoingEdge.id}_flat_${internalEdge.source}`, // 生成更唯一的 ID
            source: internalEdge.source, // 重定向到内部节点 ID
            sourceHandle: internalEdge.sourceHandle, // 使用内部节点的句柄
          });
           // 从队列中移除已处理的边
           const index = edgeQueue.findIndex(e => e.id === outgoingEdge.id);
           if (index > -1) edgeQueue.splice(index, 1);
        } else {
           console.warn(`[Flatten] No internal edge found targeting GroupOutput ${internalGroupOutput.id} handle ${sourceHandle} for NodeGroup ${node.id} output ${sourceHandle}`);
        }
      }

      // 将子流的扁平化节点（除IO节点）和边添加到结果中
      // Roo: 使用带命名空间的类型
      flattenedNodes.push(...flattenedSubWorkflow.nodes.filter(n => getNodeType(n) !== 'core:GroupInput' && getNodeType(n) !== 'core:GroupOutput'));
      // 子流内部的边（不涉及IO节点的）也需要添加
      flattenedEdges.push(...flattenedSubWorkflow.edges.filter(
          edge => {
              const sourceNode = internalNodesMap.get(edge.source);
              const targetNode = internalNodesMap.get(edge.target);
              // Roo: 使用带命名空间的类型
              const sourceIsIO = sourceNode && (getNodeType(sourceNode) === 'core:GroupInput' || getNodeType(sourceNode) === 'core:GroupOutput');
              // Roo: 使用带命名空间的类型
              const targetIsIO = targetNode && (getNodeType(targetNode) === 'core:GroupInput' || getNodeType(targetNode) === 'core:GroupOutput');
              return !sourceIsIO && !targetIsIO; // 只保留完全在内部的边
          }
      ));


      // 处理完成，从此递归路径移除标记
      processedGroupIds.delete(referencedWorkflowId);

    } else {
      // 普通节点，直接添加到结果
      flattenedNodes.push(node);
    }
  }

  // 处理剩余在队列中的边（这些是顶层图中未连接到任何 NodeGroup 的边）
  flattenedEdges.push(...edgeQueue);


  return { nodes: flattenedNodes, edges: flattenedEdges };
}