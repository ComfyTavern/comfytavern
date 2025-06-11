import type { NodeDefinition, WorkflowObject } from '@comfytavern/types' // Import WorkflowObject
// Removed: import { nodeManager } from '../NodeManager'
// Assuming ExecutionEngine is available for nested execution later
// import { ExecutionEngine } from '../../ExecutionEngine';

// 注意：这是一个非常基础的骨架，实际功能需要更复杂的实现
// 来处理组的加载、内部图的执行、动态端口等

export class NodeGroupNodeImpl {
  // NodeGroup 实例的执行逻辑需要：
  // 1. 获取其引用的 Group 定义（内部节点和连接）
  // 2. 创建一个嵌套的执行上下文
  // 3. 将实例的输入值传递给内部 GroupInput 节点
  // 4. 执行内部图
  // 5. 从内部 GroupOutput 节点获取结果
  // 6. 将结果传递给实例的输出端口
  static async execute(inputs: Record<string, any>, context: any): Promise<Record<string, any>> {
    // context should contain nodeData (instance config) and workflow (main workflow object)
    const nodeData = context?.nodeData; // Instance data (includes groupMode, IDs)
    const workflow = context?.workflow; // Main workflow object

    if (!nodeData || !workflow) {
      console.error(`NodeGroup (${context?.nodeId}): Missing nodeData or workflow context.`);
      return {};
    }

    const { referencedWorkflowId } = nodeData; // 只保留 referencedWorkflowId
    let groupDefinition: WorkflowObject | null = null;

    try {
      // 始终处理为 referenced 模式
      if (referencedWorkflowId) {
        console.log(`NodeGroup (${context?.nodeId}): Loading referenced workflow: ${referencedWorkflowId}`);
        // TODO: Implement loading workflow definition (needs access to storage/API)
        // Example: groupDefinition = await workflowStorage.load(referencedWorkflowId);
        throw new Error('Referenced group loading not yet implemented.');
        // groupDefinition = await loadReferencedWorkflow(referencedWorkflowId); // 假设有加载函数
      } else {
        throw new Error(`Missing referencedWorkflowId.`);
      }
    } catch (error: any) {
      console.error(`NodeGroup (${context?.nodeId}): Failed to get group definition - ${error.message}`);
      return {}; // Return empty on error
    }


    // --- Placeholder for Nested Execution ---
    console.log(`NodeGroup (${context?.nodeId}): Executing with definition from referenced workflow (ID: ${referencedWorkflowId})`);
    console.log(`NodeGroup (${context?.nodeId}): Inputs received:`, inputs);
    console.log(`NodeGroup (${context?.nodeId}): Group Definition:`, groupDefinition);

    // TODO: Instantiate ExecutionEngine with groupDefinition.nodes, groupDefinition.edges
    // TODO: Map instance inputs to internal GroupInput nodes
    // TODO: Run the nested engine
    // TODO: Map internal GroupOutput nodes to instance outputs

    // 假设执行后得到结果
    const internalResults = { /* ... 获取内部执行结果 ... */ };

    // 返回结果，映射到实例的输出端口
    return internalResults; // 需要具体实现映射
  }
}


export const definition: NodeDefinition = {
  type: 'NodeGroup', // Base type name
  // namespace will be set to 'core' (or similar) via index.ts registerer
  category: 'Group', // Functional category
  displayName: '📦节点组',
  description: '实例化一个可复用的节点组',
  width: 250, // 添加默认宽度
  // 输入和输出端口是动态的，取决于它引用的 Group 定义
  // 这些需要在加载时或运行时根据 Group 定义动态生成
  inputs: {
    // 示例:
    // dynamic_input_1: { type: 'string', description: '来自组定义的输入' }
  },
  outputs: {
    // 示例:
    // dynamic_output_1: { type: 'number', description: '来自组定义的输出' }
  },

  // 使用 RESOURCE_SELECTOR 来选择引用的 Group 定义
  configSchema: {
    referencedWorkflowId: {
      dataFlowType: 'STRING', // RESOURCE_SELECTOR value is a string (ID)
      displayName: '引用的工作流',
      description: '选择一个保存的工作流作为节点组定义',
      required: true,
      matchCategories: ['ResourceId'],
      config: {
        acceptedTypes: [{ value: 'workflow', label: '工作流' }],
        placeholder: '选择一个工作流...',
      }
    }
    // 移除 groupMode 和 embeddedWorkflowId
  },

  // Inputs and Outputs are dynamic and determined by the referenced group's interface
  // They will be populated/updated by the frontend or engine when the group reference changes.
  execute: NodeGroupNodeImpl.execute
}

// Removed: Node registration is now handled by index.ts